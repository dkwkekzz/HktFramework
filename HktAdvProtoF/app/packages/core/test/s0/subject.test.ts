// S0-d 주체 골격 — 조각들이 한 주체로 합쳐지고, 능력과 종이 어긋나면 걸리는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, stateHash } from '../../src/v1/index.ts';
import { axiomId, type AbilityDefinition, type Definition, type SpeciesDefinition } from '../../src/o0/index.ts';
import {
  buildSubject,
  checkSubjectProfile,
  checkSubjects,
  subjectIdOf,
  subjectVerdict,
  type Need,
  type PerceptionProfile,
  type SubjectSpec,
  type ValueTarget,
} from '../../src/s0/index.ts';

const merchantId = deterministicId('subject', 'veil', 'merchant');
const bodyId = deterministicId('entity', 'veil', 'hunter-body');

const toxinReadId = deterministicId('rule', 'ability', '독 감별');
const hunterSpeciesId = deterministicId('rule', 'species', '사냥꾼');

/** 약초를 쥐면 독을 안다 — 잔향을 남기고 체력을 조금 태운다. */
const toxinRead: AbilityDefinition = {
  kind: 'Rule',
  id: toxinReadId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '독 감별',
  when: ['약초를 맨손에 쥔다'],
  then: ['그 약초의 독성을 안다'],
  axiomId: axiomId('observable-trace'),
  supportIds: [],
  strength: 0.3,
  costs: [{ domain: 'biological', path: 'vitality', amount: 0.02 }],
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${toxinReadId}` }],
};

/** 사냥꾼 — 굶고, 다치고, 무언가를 믿는다. */
const hunterSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: hunterSpeciesId,
  definitionKind: 'species',
  domain: 'biological',
  name: '사냥꾼',
  when: ['세계에 사람이 선다'],
  then: ['허기와 체력을 지고, 믿는 것에 따라 신념 압력을 갖는다'],
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

const DEFINITIONS: readonly Definition[] = [toxinRead, hunterSpecies];

const eyes: PerceptionProfile = {
  channels: [
    { channel: 'light', threshold: 0.2, range: 300 },
    { channel: 'trace', threshold: 0.1, range: 5 },
  ],
};

const hungerNeed = (holderId: string): Need => ({
  slot: { domain: 'biological', path: 'hunger' },
  holderId,
  band: { kind: 'range', min: 0, max: 0.6 },
  urgency: 0.8,
  collapseAfterTicks: 30,
  note: '굶은 채로 서른 틱이 지나면 사냥할 힘이 남지 않는다',
});

const trustValue = (holderId: string): ValueTarget => ({
  slot: { domain: 'relational', path: `trust.${holderId}` },
  holderId: merchantId,
  band: { kind: 'range', min: 0.2, max: 1 },
  weight: 0.6,
  note: '약초를 제값에 팔려면 행상의 신뢰가 필요하다',
});

/** 붉은 장막 사냥꾼 한 명의 선언. */
function hunterSpec(): SubjectSpec {
  const id = subjectIdOf(hunterSpeciesId, '붉은 장막 사냥꾼');
  return {
    speciesId: hunterSpeciesId,
    label: '붉은 장막 사냥꾼',
    name: '붉은 장막 사냥꾼',
    subjectKind: 'person',
    partOfId: null,
    boundaries: [{ kind: 'body', ofId: bodyId, note: '사냥꾼의 몸 — 허기와 독이 여기 적힌다' }],
    perception: eyes,
    needs: [hungerNeed(id)],
    values: [trustValue(id)],
    capabilities: [toxinReadId],
  };
}

function rulesOf(spec: SubjectSpec, definitions: readonly Definition[] = DEFINITIONS): string[] {
  return checkSubjectProfile(buildSubject(spec), definitions).map((violation) => violation.rule);
}

describe('주체 세우기', () => {
  test('개체 ID 는 종과 이름표에서 나온다 — 같은 종·같은 이름표면 같은 개체다', () => {
    const profile = buildSubject(hunterSpec());
    assert.equal(profile.id, subjectIdOf(hunterSpeciesId, '붉은 장막 사냥꾼'));
    assert.equal(stateHash(buildSubject(hunterSpec())), stateHash(profile));
    assert.notEqual(subjectIdOf(hunterSpeciesId, '다른 사냥꾼'), profile.id);
  });

  test('그래프 4종 자리가 자동으로 열린다 — 손으로 지을 자리가 없다', () => {
    const profile = buildSubject(hunterSpec());
    assert.equal(profile.memoryStoreId.split(':')[0], 'memory');
    assert.equal(profile.beliefGraphId.split(':')[0], 'belief');
    assert.equal(profile.dependencyGraphId.split(':')[0], 'dependency');
    assert.equal(profile.possibilityGraphId.split(':')[0], 'possibility');
  });

  test('세운 주체는 여전히 O1 Subject 다 — 필드를 빼지 않고 더했다', () => {
    const profile = buildSubject(hunterSpec());
    assert.equal(profile.kind, 'Subject');
    assert.equal(profile.subjectKind, 'person');
    assert.equal(profile.partOfId, null);
  });

  test('사냥꾼 한 명이 다섯 조각을 다 갖추고 선다', () => {
    assert.deepEqual(rulesOf(hunterSpec()), []);
  });
});

describe('능력 인용', () => {
  test('아무것도 할 수 없는 주체는 셋째 질문에 답하지 못한다', () => {
    assert.deepEqual(rulesOf({ ...hunterSpec(), capabilities: [] }), ['incapable-subject']);
  });

  test('세계에 없는 능력 · 규칙이 아닌 ID · 두 번 인용이 각각의 사유로 걸린다', () => {
    assert.deepEqual(rulesOf({ ...hunterSpec(), capabilities: [deterministicId('rule', '없는 능력')] }), [
      'unknown-capability',
    ]);
    assert.deepEqual(rulesOf({ ...hunterSpec(), capabilities: [merchantId] }), ['bad-capability']);
    assert.deepEqual(rulesOf({ ...hunterSpec(), capabilities: [toxinReadId, toxinReadId] }), [
      'duplicate-capability',
    ]);
  });

  test('공리를 어긴 능력은 아무에게도 붙지 않는다 — 누구도 예외가 아니다', () => {
    const freeLunch: AbilityDefinition = {
      ...toxinRead,
      id: deterministicId('rule', 'ability', '공짜 장막'),
      name: '공짜 장막',
      strength: 0.9,
      costs: [],
    };
    const violations = checkSubjectProfile(
      buildSubject({ ...hunterSpec(), capabilities: [freeLunch.id] }),
      [...DEFINITIONS, freeLunch],
    );
    assert.deepEqual(
      violations.map((violation) => violation.rule),
      ['unlawful-capability'],
    );
    assert.ok(violations[0]?.message.includes('free-strong-effect'), violations[0]?.message);
  });
});

describe('종과의 대조', () => {
  test('세계에 없는 종에서는 태어날 수 없다', () => {
    assert.deepEqual(rulesOf(hunterSpec(), [toxinRead]), ['unknown-species']);
  });

  test('종이 말하는 주체 종류와 개체가 다르면 걸린다', () => {
    assert.deepEqual(rulesOf({ ...hunterSpec(), subjectKind: 'god' }), [
      'unbounded-subject', // 신에게는 앵커가 필요하다 (S0-a)
      'species-mismatch',
    ]);
  });

  test('종이 열지 않은 자리로 무너질 수는 없다', () => {
    const spec = hunterSpec();
    const id = subjectIdOf(hunterSpeciesId, spec.label);
    const violations = checkSubjectProfile(
      buildSubject({
        ...spec,
        needs: [
          {
            slot: { domain: 'psychic', path: 'energy' },
            holderId: id,
            band: { kind: 'range', min: 100, max: 1000000 },
            urgency: 0.4,
            collapseAfterTicks: 50,
            note: '의념이 마르면 장막을 열 수 없다',
          },
        ],
      }),
      DEFINITIONS,
    );
    assert.deepEqual(
      violations.map((violation) => violation.rule),
      ['off-species-slot'],
    );
    assert.ok(violations[0]?.message.includes('사냥꾼'), violations[0]?.message);
  });

  test('유지는 종 밖이어도 된다 — 종이 갖지 않은 것을 원하는 데서 목적이 자란다', () => {
    // 신뢰(relational)는 사냥꾼 종의 자리 셋 어디에도 없다. 그래도 원할 수 있다.
    assert.deepEqual(rulesOf(hunterSpec()), []);
  });
});

describe('주체 여럿', () => {
  test('온전한 주체는 서고 어긴 주체는 사유로 남는다', () => {
    const report = checkSubjects(
      [buildSubject(hunterSpec()), buildSubject({ ...hunterSpec(), label: '넋 나간 자', capabilities: [] })],
      DEFINITIONS,
    );
    assert.equal(report.accepted.length, 1);
    assert.equal(report.rejected.length, 1);
    assert.equal(report.complete, false);
    assert.ok(subjectVerdict(report).includes('incapable-subject'), subjectVerdict(report));
  });

  test('전부 서면 판정이 한 줄로 접힌다', () => {
    const report = checkSubjects([buildSubject(hunterSpec())], DEFINITIONS);
    assert.equal(report.complete, true);
    assert.equal(subjectVerdict(report), '주체 1명이 섰다 (person)');
    assert.equal(subjectVerdict(checkSubjects([], DEFINITIONS)), '세울 주체가 없다');
  });

  test('신원이 무너지면 사유는 거기서 멈춘다 — 두 겹으로 쌓지 않는다', () => {
    const broken = { ...buildSubject(hunterSpec()), id: '사냥꾼' };
    const violations = checkSubjectProfile(broken, DEFINITIONS);
    assert.deepEqual(
      violations.map((violation) => violation.rule),
      ['bad-subject'],
    );
  });

  test('손으로 지은 그래프 ID 는 프로필 검사에서도 걸린다', () => {
    const broken = { ...buildSubject(hunterSpec()), memoryStoreId: 'memory:손으로지음' };
    assert.deepEqual(
      checkSubjectProfile(broken, DEFINITIONS).map((violation) => violation.rule),
      ['manufactured-graph'],
    );
  });
});
