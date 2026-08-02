// S3-c 개체 조립 — 다섯 층이 한 개체가 되고, 모든 값이 유래를 댄다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, stateHash, type Id } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import {
  axiomId,
  type AbilityDefinition,
  type Definition,
  type SpeciesDefinition,
} from '../../src/o0/index.ts';
import { subjectIdOf } from '../../src/s0/index.ts';
import { buildArchetype, type SpeciesArchetype, type SpeciesSpec } from '../../src/s1/index.ts';
import {
  buildCulture,
  buildRole,
  type CultureArchetype,
  type RoleArchetype,
} from '../../src/s2/index.ts';
import {
  buildInstance,
  buildTrait,
  capabilityKey,
  checkInstance,
  checkInstances,
  instanceVerdict,
  needKey,
  originCounts,
  originOf,
  readingKey,
  tunableKeys,
  valueKey,
  type InstanceSpec,
  type PastEvent,
  type SubjectInstance,
  type Trait,
} from '../../src/s3/index.ts';

// ── 세계 ─────────────────────────────────────────────────────────────────────

const trackId = deterministicId('rule', 'ability', '자국 읽기');
const veilCallId = deterministicId('rule', 'ability', '장막 부름');

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
const veilCall: AbilityDefinition = {
  ...track,
  id: veilCallId,
  name: '장막 부름',
  when: ['어미의 이름을 세 번 부른다'],
  then: ['붉은 장막이 그 자리로 흘러온다'],
  strength: 0.8,
  costs: [{ domain: 'biological', path: 'vitality', amount: 0.2 }],
  traces: [{ channel: 'light', domain: 'psychic', path: `trace.${veilCallId}` }],
};

const hunterSpeciesId = deterministicId('rule', 'species', '사냥꾼');
const hunterSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: hunterSpeciesId,
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
      { stage: '성체', ticks: 600, metabolism: 1, senseScale: 1, opens: [] },
    ],
  },
  baseNeeds: [
    {
      slot: { domain: 'biological', path: 'hunger' },
      holder: 'self',
      band: { kind: 'range', min: 0, max: 0.6 },
      urgency: 0.5,
      baseTicks: 30,
      note: '굶으면 무너진다',
    },
  ],
  capabilities: [trackId],
};
const hunter: SpeciesArchetype = buildArchetype(hunterSpec);

const villagersId = deterministicId('subject', 'organization', '아랫마을 사람들');
const partnerId = deterministicId('subject', 'veil', '사냥꾼 07');
const bodyId = deterministicId('entity', 'veil', '사냥꾼의 몸');

const cultureId = deterministicId('rule', 'culture', '자국을 쫓는 자들');

const beater: RoleArchetype = buildRole({
  cultureId,
  id: deterministicId('rule', 'role', '몰이꾼'),
  name: '몰이꾼',
  domain: 'ecological',
  when: ['무리의 맨 앞에 선다'],
  then: ['장막을 부르는 법을 배우고, 값을 스스로 매긴다'],
  axiomId: axiomId('psychic-life'),
  grants: [veilCallId],
  values: [
    {
      slot: { domain: 'psychic', path: 'conviction' },
      holder: { of: 'self' },
      band: { kind: 'range', min: 0.7, max: 1 },
      weight: 0.6,
      note: '맨 앞에 서려면 흔들리지 않아야 한다',
    },
  ],
});

const huntCulture: CultureArchetype = buildCulture({
  id: cultureId,
  name: '자국을 쫓는 자들',
  domain: 'ecological',
  when: ['같은 골짜기에서 같은 것을 쫓으며 자란다'],
  then: ['빛을 사냥의 표식으로 읽고, 마을의 신뢰로 산다'],
  axiomId: axiomId('psychic-life'),
  speciesIds: [hunterSpeciesId],
  readings: [
    {
      channel: 'light',
      sign: '붉은 장막의 빛',
      assertion: '장막벌레가 방금 지나갔다',
      confidence: 0.7,
      stance: 'approach',
    },
  ],
  values: [
    {
      slot: { domain: 'relational', path: `trust.${villagersId}` },
      holder: { of: 'self' },
      band: { kind: 'range', min: 0.5, max: 1 },
      weight: 0.7,
      note: '자국을 읽어 주는 값으로 마을에서 얻는 자리',
    },
  ],
  roles: [beater],
});

const DEFINITIONS: readonly Definition[] = [track, veilCall, hunter];

// ── 개체 둘 — 같은 종·같은 문화·같은 자리, 다른 과거와 다른 성격 ─────────────────

const debtEvent: PastEvent = {
  tick: 120,
  name: '겨울에 마을 창고를 열었다',
  actorId: villagersId,
  causes: [],
  residue: [
    {
      slot: { domain: 'relational', path: `debt.${villagersId}` },
      holderId: subjectIdOf(hunterSpeciesId, '사냥꾼 04'),
      value: 40,
    },
  ],
};
const lossEvent: PastEvent = {
  tick: 260,
  name: '협곡에서 07 을 잃었다',
  actorId: null,
  causes: [],
  residue: [
    {
      slot: { domain: 'relational', path: `grudge.${partnerId}` },
      holderId: subjectIdOf(hunterSpeciesId, '사냥꾼 09'),
      value: 0.6,
    },
  ],
};

const timid: Trait = buildTrait({
  id: deterministicId('rule', 'trait', '겁이 많다'),
  name: '겁이 많다',
  domain: 'psychic',
  when: ['혼자 어스름의 협곡에 선다'],
  then: ['허기는 더 급해지고, 빛에 대한 확신은 옅어진다'],
  axiomId: axiomId('psychic-life'),
  tunes: [
    { target: 'need-urgency', key: 'hunger', scale: 1.4, note: '배고픔을 더 빨리 위험으로 읽는다' },
    {
      target: 'reading-confidence',
      key: 'light:붉은 장막의 빛',
      scale: 0.6,
      note: '확신하지 못하고 한 번 더 본다',
    },
  ],
});

function spec(overrides: Partial<InstanceSpec> = {}): InstanceSpec {
  return {
    species: hunter,
    culture: huntCulture,
    role: beater,
    label: '사냥꾼 04',
    name: '사냥꾼 04',
    partOfId: null,
    bodyId,
    stage: '성체',
    bornAtTick: 400,
    boundaries: [{ kind: 'body', ofId: bodyId, note: '이 몸까지가 나다' }],
    history: [debtEvent],
    traits: [timid],
    ...overrides,
  };
}

const first: SubjectInstance = buildInstance(spec());
const second: SubjectInstance = buildInstance(
  spec({ label: '사냥꾼 09', name: '사냥꾼 09', history: [lossEvent], traits: [] }),
);

function check(instance: SubjectInstance): readonly string[] {
  return checkInstance(instance, huntCulture, DEFINITIONS).map((violation) => violation.rule);
}

describe('S3-c 개체 조립 — 다섯 층이 한 개체가 된다', () => {
  test('온전한 개체 둘이 나란히 서고, 여전히 O1 Subject 다', () => {
    const report = checkInstances([first, second], [huntCulture], DEFINITIONS);
    assert.deepEqual(report.violations, []);
    assert.equal(report.complete, true);
    assert.equal(classify(first).kind, 'Subject');
    assert.equal(instanceVerdict(report), '개체 2명이 섰다 (문화 1개)');
  });

  test('같은 문화·같은 자리의 둘이 이력과 성격으로 갈린다', () => {
    // 이력이 남긴 값이 다르다
    assert.deepEqual(
      first.residue.map((entry) => entry.slot.path),
      [`debt.${villagersId}`],
    );
    assert.deepEqual(
      second.residue.map((entry) => entry.slot.path),
      [`grudge.${partnerId}`],
    );
    // 성격이 값을 흔든다 — 같은 종의 같은 허기가 다른 급함이 된다
    assert.equal(first.needs[0]?.urgency, 0.7, '겁이 많으면 0.5 × 1.4');
    assert.equal(second.needs[0]?.urgency, 0.5, '흔들지 않으면 종의 값 그대로');
    // 같은 문화의 같은 읽기가 다른 확신이 된다
    const light = (instance: SubjectInstance) =>
      instance.readings.find((reading) => reading.sign === '붉은 장막의 빛')?.confidence;
    assert.equal(light(first), 0.7 * 0.6);
    assert.equal(light(second), 0.7);
    // 그런데 종이 준 것(감각)과 자리가 준 것(능력)은 둘이 같다
    assert.deepEqual(first.perception, second.perception);
    assert.deepEqual(first.capabilities, second.capabilities);
  });

  test('모든 값이 유래를 댄다 — 개체는 지어내지 않는다', () => {
    assert.deepEqual(check(first), []);

    const need = first.needs[0];
    assert.ok(need !== undefined);
    assert.deepEqual(originOf(first, needKey(need)), {
      key: needKey(need),
      origin: 'trait',
      from: '겁이 많다',
      scale: 1.4,
    });
    // 흔들지 않은 개체의 같은 자리는 종이 유래다
    assert.equal(originOf(second, needKey(need))?.origin, 'species');
    assert.equal(originOf(second, needKey(need))?.from, '사냥꾼');

    // 원함은 문화와 자리로 갈린다
    const trust = first.values.find((value) => value.slot.path.startsWith('trust.'));
    const conviction = first.values.find((value) => value.slot.path === 'conviction');
    assert.ok(trust !== undefined && conviction !== undefined);
    assert.equal(originOf(first, valueKey(trust))?.origin, 'culture');
    assert.equal(originOf(first, valueKey(conviction))?.origin, 'role');
    assert.equal(originOf(first, valueKey(conviction))?.from, '몰이꾼');

    // 능력도 종과 자리로 갈린다
    assert.equal(originOf(first, capabilityKey(trackId))?.origin, 'species');
    assert.equal(originOf(first, capabilityKey(veilCallId))?.origin, 'role');

    // 이력이 남긴 값은 어느 사건이 남겼는지까지 댄다
    assert.equal(
      originOf(first, `residue:relational.debt.${villagersId}`)?.from,
      '겨울에 마을 창고를 열었다',
    );
    // 개체가 스스로 적는 것은 경계뿐이다
    assert.equal(originOf(first, 'boundary:body')?.origin, 'self');
  });

  test('유래 표가 여섯 갈래로 센다', () => {
    const counts = originCounts(first);
    assert.equal(counts.species, 1, '능력 하나 (의존은 성격이 흔들어 trait 로 옮겨 갔다)');
    assert.equal(counts.trait, 2, '허기의 급함 · 빛의 확신');
    assert.equal(counts.role, 2, '연 능력 하나 · 덧댄 원함 하나');
    assert.equal(counts.culture, 1, '원함 하나 (읽기는 성격이 흔들어 trait 로 옮겨 갔다)');
    assert.equal(counts.history, 1);
    assert.equal(counts.self, 1);
  });

  test('유래를 못 대는 값이 있으면 개체가 서지 못한다', () => {
    const forged: SubjectInstance = {
      ...first,
      capabilities: [...first.capabilities, deterministicId('rule', 'ability', '지어낸 재주')],
    };
    const rules = check(forged);
    assert.ok(rules.includes('orphan-value'), '유래 없는 능력이 걸린다');

    const stripped: SubjectInstance = { ...first, provenance: [] };
    const stripRules = check(stripped);
    assert.ok(stripRules.filter((rule) => rule === 'orphan-value').length >= 4);
  });

  test('같은 선언이면 언제나 같은 개체다 — 손으로 지은 값이 하나도 없다', () => {
    assert.equal(stateHash(buildInstance(spec())), stateHash(first));
    assert.notEqual(stateHash(second), stateHash(first));
    // 개체 ID 는 종 + 이름표에서 나온다
    assert.equal(first.id, subjectIdOf(hunterSpeciesId, '사냥꾼 04'));
  });

  test('성격은 이 개체가 실제로 가진 자리만 흔든다', () => {
    const keys = tunableKeys(first);
    assert.deepEqual(keys.needs, ['hunger']);
    assert.ok(keys.values.includes('conviction'), '자리가 덧댄 원함도 흔들 수 있다');
    assert.deepEqual(keys.readings, ['light:붉은 장막의 빛']);

    const strange = buildTrait({
      ...timid,
      id: deterministicId('rule', 'trait', '떠돌고 싶다'),
      name: '떠돌고 싶다',
      tunes: [{ target: 'need-urgency', key: 'thirst', scale: 1.5, note: '없는 자리' }],
    });
    assert.ok(check(buildInstance(spec({ traits: [strange] }))).includes('phantom-tune'));
  });

  test('이 개체가 지닐 수 없는 문화·자리는 거부된다', () => {
    const otherCulture = buildCulture({
      ...huntCulture,
      id: deterministicId('rule', 'culture', '남의 문화'),
      name: '남의 문화',
      speciesIds: [deterministicId('rule', 'species', '다른 종')],
      roles: [beater],
    });
    const wrong = buildInstance(spec({ culture: otherCulture, role: null }));
    assert.ok(
      checkInstance(wrong, otherCulture, DEFINITIONS)
        .map((violation) => violation.rule)
        .includes('off-species-culture'),
    );

    const foreignRole: SubjectInstance = {
      ...first,
      roleId: deterministicId('rule', 'role', '없는 자리'),
    };
    assert.ok(check(foreignRole).includes('off-culture-role'));
  });

  test('S0 관문을 지나지 못하는 개체는 개체가 아니다', () => {
    const unbounded = buildInstance(spec({ boundaries: [] }));
    assert.ok(check(unbounded).includes('bad-instance'));
    assert.ok(check({ ...first, name: '' }).includes('unnamed-instance'));
  });

  test('이력·성격 없이도 개체는 선다', () => {
    const bare = buildInstance(spec({ history: [], traits: [] }));
    assert.deepEqual(check(bare), []);
    assert.deepEqual(bare.residue, []);
    assert.equal(bare.needs[0]?.urgency, 0.5, '흔들지 않으면 종의 값 그대로');
    assert.equal(originCounts(bare).trait, 0);
    assert.equal(originCounts(bare).history, 0);
  });

  test('자리 없이 문화만 지녀도 개체는 선다', () => {
    const bare = buildInstance(spec({ role: null }));
    assert.deepEqual(check(bare), []);
    assert.equal(bare.roleId, null);
    assert.equal(originCounts(bare).role, 0);
    assert.deepEqual(bare.capabilities, [trackId], '자리가 열지 않았으니 종의 것뿐이다');
  });

  test('빈 목록', () => {
    const empty = checkInstances([], [huntCulture], DEFINITIONS);
    assert.equal(empty.complete, false);
    assert.equal(instanceVerdict(empty), '세울 개체가 없다');
    assert.match(
      instanceVerdict(checkInstances([{ ...first, name: '' }], [huntCulture], DEFINITIONS)),
      /^개체 1명이 막혔다/,
    );
    assert.equal(originOf(first, 'need:없는것'), null);
    assert.equal(readingKey(first.readings[0] as never), 'reading:light:붉은 장막의 빛');
  });
});
