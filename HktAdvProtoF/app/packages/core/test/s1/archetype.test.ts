// S1-e 종 원형 조립 — 넷을 하나로 합치고, 종에서 개체가 나온다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, stateHash } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import {
  axiomId,
  validateDefinition,
  type AbilityDefinition,
  type Definition,
  type SpeciesDefinition,
} from '../../src/o0/index.ts';
import { checkNeeds, type SubjectViolation } from '../../src/s0/index.ts';
import {
  archetypeVerdict,
  birthStage,
  buildArchetype,
  checkArchetype,
  checkArchetypes,
  seedFromSpecies,
  type LifeStage,
  type SpeciesArchetype,
  type SpeciesSpec,
} from '../../src/s1/index.ts';

const trackId = deterministicId('rule', 'ability', '자국 읽기');
const inscribeId = deterministicId('rule', 'ability', '전언 새김');

/** 자국 읽기 — 약한 능력이라 대가가 없다. */
const track: AbilityDefinition = {
  kind: 'Rule',
  id: trackId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '자국 읽기',
  when: ['땅에 남은 자국을 들여다본다'],
  then: ['지나간 것의 무게와 방향이 읽힌다'],
  axiomId: axiomId('observable-trace'),
  supportIds: [],
  strength: 0.3,
  costs: [],
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${trackId}` }],
};

const inscribe: AbilityDefinition = {
  ...track,
  id: inscribeId,
  name: '전언 새김',
  when: ['상대의 눈을 마주 보고 한 문장을 말한다'],
  then: ['그 문장이 상대의 기억에 자기 것으로 새겨진다'],
  strength: 0.4,
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${inscribeId}` }],
};

const hunterSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: deterministicId('rule', 'species', '사냥꾼'),
  definitionKind: 'species',
  domain: 'biological',
  name: '사냥꾼',
  when: ['세계에 사람이 선다'],
  then: ['허기와 체력을 진다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'person',
  alive: true,
  slots: [
    { domain: 'biological', path: 'hunger' },
    { domain: 'biological', path: 'vitality' },
    { domain: 'psychic', path: 'conviction' },
  ],
  originId: null,
};

const hunterSpec: SpeciesSpec = {
  definition: hunterSpecies,
  body: {
    organs: [
      { organ: 'core', count: 1, note: '몸통' },
      { organ: 'eye', count: 2, note: '자국을 읽는 눈' },
      { organ: 'limb', count: 4, note: '기어오르고 쥔다' },
    ],
  },
  senses: [
    { channel: 'light', threshold: 0.2, range: 300, organ: 'eye' },
    { channel: 'report', threshold: 0.5, range: 1000, organ: null },
  ],
  lifecycle: {
    stages: [
      { stage: '유체', ticks: 200, metabolism: 1.5, senseScale: 0.5, opens: [trackId] },
      { stage: '성체', ticks: 600, metabolism: 1, senseScale: 1, opens: [inscribeId] },
    ],
  },
  baseNeeds: [
    {
      slot: { domain: 'biological', path: 'hunger' },
      holder: 'self',
      band: { kind: 'range', min: 0, max: 0.6 },
      urgency: 0.8,
      baseTicks: 30,
      note: '허기가 이 위로 오래 머물면 사냥할 힘이 남지 않는다',
    },
  ],
  capabilities: [trackId, inscribeId],
};

const DEFINITIONS: readonly Definition[] = [track, inscribe, hunterSpecies];

const hunter = buildArchetype(hunterSpec);
const hunterId = deterministicId('subject', 'veil', '사냥꾼 04');
const bodyId = deterministicId('entity', 'veil', '사냥꾼 04의 몸');

function rules(archetype: SpeciesArchetype): string[] {
  return checkArchetype(archetype, DEFINITIONS).map((violation) => violation.rule);
}

describe('S1-e 종 원형 조립', () => {
  test('원형은 여전히 종 정의이고 O1 Rule 이다 — 확장하되 빼지 않는다', () => {
    assert.deepEqual(rules(hunter), []);
    assert.equal(classify(hunter).kind, 'Rule');
    assert.deepEqual(validateDefinition(hunter), []);
    assert.equal(hunter.definitionKind, 'species');
    assert.equal(hunter.id, hunterSpecies.id);
  });

  test('종에서 개체의 씨앗이 나온다 — 감각·의존·능력 셋이 한 번에', () => {
    const seed = seedFromSpecies(hunter, { subjectId: hunterId, bodyId, stage: '성체' });
    assert.equal(seed.speciesId, hunter.id);
    assert.equal(seed.stage, '성체');
    assert.deepEqual(seed.perception.channels[0], { channel: 'light', threshold: 0.2, range: 300 });
    assert.equal(seed.needs[0]?.holderId, hunterId);
    assert.equal(seed.needs[0]?.collapseAfterTicks, 30);
    assert.deepEqual(seed.capabilities, [trackId, inscribeId]);
  });

  test('같은 종이라도 단계가 다르면 다른 개체가 나온다', () => {
    const young = seedFromSpecies(hunter, { subjectId: hunterId, bodyId, stage: '유체' });
    // 유체는 절반만 보고, 스무 틱 만에 무너지고, 아직 전언을 새기지 못한다
    assert.deepEqual(young.perception.channels[0], { channel: 'light', threshold: 0.4, range: 150 });
    assert.equal(young.needs[0]?.collapseAfterTicks, 20);
    assert.deepEqual(young.capabilities, [trackId]);
    // 단계를 적지 않으면 첫 단계로 태어난다
    assert.equal(birthStage(hunter)?.stage, '유체');
    assert.equal(birthStage(hunter, '없는단계'), null);
  });

  test('씨앗의 의존은 S0 검사를 그대로 지난다 — 종에서 나온 개체가 세계에 선다', () => {
    const seed = seedFromSpecies(hunter, { subjectId: hunterId, bodyId, stage: '성체' });
    const out: SubjectViolation[] = [];
    checkNeeds(
      { id: hunterId, name: '사냥꾼 04', subjectKind: 'person' },
      seed.needs,
      [{ kind: 'body', ofId: bodyId, note: '사냥꾼의 몸' }],
      out,
    );
    assert.deepEqual(out, []);
  });

  test('같은 종·같은 자리·같은 단계면 언제나 같은 씨앗이다', () => {
    const once = seedFromSpecies(hunter, { subjectId: hunterId, bodyId, stage: '성체' });
    const twice = seedFromSpecies(hunter, { subjectId: hunterId, bodyId, stage: '성체' });
    assert.equal(stateHash(once), stateHash(twice));
  });

  test('공리를 어긴 종 정의는 살을 붙이기 전에 걸린다 — 사유가 두 겹으로 쌓이지 않는다', () => {
    const godless = buildArchetype({ ...hunterSpec, definition: { ...hunterSpecies, axiomId: null } });
    assert.deepEqual(rules(godless), ['bad-species']);
  });

  test('능력은 인용이고 생애에서 열린다', () => {
    assert.deepEqual(rules({ ...hunter, capabilities: [] }), ['incapable-species']);
    assert.deepEqual(
      rules({ ...hunter, capabilities: [trackId, inscribeId, trackId] }),
      ['duplicate-capability'],
    );
    assert.deepEqual(
      rules({ ...hunter, capabilities: [trackId, inscribeId, deterministicId('rule', 'ability', '없는 능력')] }),
      ['unknown-capability', 'unreachable-capability'],
    );
    // 공리를 어긴 능력은 어느 종도 열지 못한다
    const freeVeil: AbilityDefinition = { ...track, id: deterministicId('rule', 'ability', '공짜 장막'), name: '공짜 장막', strength: 0.9, costs: [] };
    assert.deepEqual(
      checkArchetype(
        {
          ...hunter,
          capabilities: [trackId, inscribeId, freeVeil.id],
          lifecycle: {
            stages: [
              hunter.lifecycle.stages[0] as LifeStage,
              { ...(hunter.lifecycle.stages[1] as LifeStage), opens: [inscribeId, freeVeil.id] },
            ],
          },
        },
        [...DEFINITIONS, freeVeil],
      ).map((violation) => violation.rule),
      ['unlawful-capability'],
    );
  });

  test('평생 열리지 않는 능력과 인용되지 않은 채 열리는 능력이 각각 걸린다', () => {
    assert.deepEqual(
      rules({
        ...hunter,
        lifecycle: { stages: [hunter.lifecycle.stages[0] as LifeStage] },
      }),
      ['unreachable-capability'],
    );
    assert.deepEqual(
      rules({ ...hunter, capabilities: [trackId] }),
      ['unreachable-capability'],
    );
  });

  test('종 목록을 관문에 통과시키면 어긴 종만 남는다', () => {
    const blind = buildArchetype({ ...hunterSpec, body: null });
    const report = checkArchetypes([hunter, blind], DEFINITIONS);
    assert.equal(report.accepted.length, 1);
    assert.equal(report.rejected.length, 1);
    assert.equal(report.complete, false);
    assert.match(archetypeVerdict(report), /막혔다/);
    assert.match(archetypeVerdict(checkArchetypes([hunter], DEFINITIONS)), /종 1개가 섰다/);
    assert.equal(archetypeVerdict(checkArchetypes([], DEFINITIONS)), '세울 종이 없다');
  });
});
