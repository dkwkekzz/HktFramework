// S0-e 5질문 검사기 — 사람·생물·조직·국가·신이 같은 다섯 질문에 답하는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, type Id } from '../../src/v1/index.ts';
import { SUBJECT_KINDS, type SubjectKind } from '../../src/o1/index.ts';
import { axiomId, type AbilityDefinition, type Definition, type SpeciesDefinition, type SlotRef } from '../../src/o0/index.ts';
import {
  answerFive,
  buildSubject,
  commonInterfaceReport,
  commonInterfaceVerdict,
  fiveQuestionVerdict,
  QUESTION_KEYS,
  QUESTION_SPECS,
  questionOf,
  subjectIdOf,
  type Boundary,
  type Need,
  type PerceptionAcuity,
  type SubjectProfile,
  type ValueTarget,
} from '../../src/s0/index.ts';

const villagersId = deterministicId('subject', 'veil', 'villagers');
const nestId = deterministicId('entity', 'veil', 'nest');
const herbId = deterministicId('entity', 'veil', 'herb');
const capitalId = deterministicId('entity', 'veil', 'capital');
const bodyId = deterministicId('entity', 'veil', 'body');

/** 전언 새김 — 누구나 쓸 수 있는 능력. 소문 자리에 흔적을 남긴다. */
const inscribeId = deterministicId('rule', 'ability', '전언 새김');
const inscribe: AbilityDefinition = {
  kind: 'Rule',
  id: inscribeId,
  definitionKind: 'ability',
  domain: 'informational',
  name: '전언 새김',
  when: ['말이 옮겨질 자리가 있다'],
  then: ['그 말이 퍼진다'],
  axiomId: axiomId('observable-trace'),
  supportIds: [],
  strength: 0.2,
  costs: [{ domain: 'psychic', path: 'energy', amount: 1 }],
  traces: [{ channel: 'report', domain: 'psychic', path: `trace.${inscribeId}` }],
};

function speciesFor(
  kind: SubjectKind,
  name: string,
  slots: readonly SlotRef[],
  originId: Id | null,
): SpeciesDefinition {
  return {
    kind: 'Rule',
    id: deterministicId('rule', 'species', name),
    definitionKind: 'species',
    domain: 'biological',
    name,
    when: ['세계에 그런 것이 선다'],
    then: ['자기 자리를 지고 굴러간다'],
    axiomId: axiomId(originId === null ? 'psychic-life' : 'emergent-divinity'),
    supportIds: [],
    subjectKind: kind,
    alive: true,
    slots: [{ domain: 'psychic', path: 'conviction' }, ...slots],
    originId,
  };
}

/** 주체 종류별 한 명 — 경계·감각·의존·유지가 종류마다 다르지만 질문은 같다. */
interface Sketch {
  readonly kind: SubjectKind;
  readonly name: string;
  readonly slots: readonly SlotRef[];
  readonly originId: Id | null;
  readonly boundaries: readonly Boundary[];
  readonly channels: readonly PerceptionAcuity[];
  readonly need: (self: Id) => Need;
  readonly value: (self: Id) => ValueTarget;
}

const SKETCHES: readonly Sketch[] = [
  {
    kind: 'person',
    name: '붉은 장막 사냥꾼',
    slots: [{ domain: 'biological', path: 'hunger' }],
    originId: null,
    boundaries: [{ kind: 'body', ofId: bodyId, note: '사냥꾼의 몸' }],
    channels: [{ channel: 'light', threshold: 0.2, range: 300 }],
    need: (self) => ({
      slot: { domain: 'biological', path: 'hunger' },
      holderId: self,
      band: { kind: 'range', min: 0, max: 0.6 },
      urgency: 0.8,
      collapseAfterTicks: 30,
      note: '굶으면 사냥할 힘이 남지 않는다',
    }),
    value: (self) => ({
      slot: { domain: 'economic', path: `stock.${herbId}` },
      holderId: self,
      band: { kind: 'range', min: 5, max: 1000 },
      weight: 0.5,
      note: '약초를 늘 다섯 뿌리는 쥐고 있으려 한다',
    }),
  },
  {
    kind: 'creature',
    name: '장막벌레',
    slots: [{ domain: 'ecological', path: 'population' }],
    originId: null,
    boundaries: [{ kind: 'body', ofId: nestId, note: '둥지에 붙은 몸' }],
    channels: [{ channel: 'smell', threshold: 0.05, range: 40 }],
    need: (self) => ({
      slot: { domain: 'ecological', path: 'population' },
      holderId: self,
      band: { kind: 'range', min: 20, max: 1000000000 },
      urgency: 0.4,
      collapseAfterTicks: 200,
      note: '개체군이 스무 마리 아래로 내려가면 군집이 끊긴다',
    }),
    value: (self) => ({
      slot: { domain: 'psychic', path: 'energy' },
      holderId: self,
      band: { kind: 'range', min: 10, max: 1000000 },
      weight: 0.3,
      note: '안개를 머금을수록 의념이 두터워진다',
    }),
  },
  {
    kind: 'organization',
    name: '채집 길드',
    slots: [{ domain: 'economic', path: 'stock.{entity}' }],
    originId: null,
    boundaries: [{ kind: 'membership', ofId: villagersId, note: '길드원' }],
    channels: [{ channel: 'report', threshold: 0.4, range: 1000000 }],
    need: (self) => ({
      slot: { domain: 'economic', path: `stock.${herbId}` },
      holderId: self,
      band: { kind: 'range', min: 30, max: 1000000000 },
      urgency: 0.5,
      collapseAfterTicks: 120,
      note: '창고가 비면 길드는 흩어진다',
    }),
    value: (self) => ({
      slot: { domain: 'relational', path: `trust.${self}` },
      holderId: villagersId,
      band: { kind: 'range', min: 0.3, max: 1 },
      weight: 0.6,
      note: '마을이 길드를 믿어야 채집권이 유지된다',
    }),
  },
  {
    kind: 'nation',
    name: '협곡 국가',
    slots: [{ domain: 'transcendent', path: 'legitimacy' }],
    originId: null,
    boundaries: [
      { kind: 'membership', ofId: villagersId, note: '국민' },
      { kind: 'territory', ofId: capitalId, note: '수도' },
    ],
    channels: [{ channel: 'report', threshold: 0.5, range: 1000000 }],
    need: (self) => ({
      slot: { domain: 'transcendent', path: 'legitimacy' },
      holderId: self,
      band: { kind: 'range', min: 0.35, max: 1 },
      urgency: 0.5,
      collapseAfterTicks: 400,
      note: '정당성이 이 아래로 오래 머물면 국가는 조직으로 흩어진다',
    }),
    value: () => ({
      slot: { domain: 'institutional', path: `passage.${capitalId}` },
      holderId: villagersId,
      band: { kind: 'is', value: true },
      weight: 0.4,
      note: '국민이 수도를 자유로이 드나들 수 있어야 한다',
    }),
  },
  {
    kind: 'god',
    name: '붉은 장막의 어미',
    slots: [
      { domain: 'transcendent', path: 'anchor' },
      { domain: 'transcendent', path: 'worship' },
    ],
    originId: villagersId,
    boundaries: [{ kind: 'anchor', ofId: nestId, note: '어미가 걸린 둥지' }],
    channels: [{ channel: 'psychic', threshold: 0.05, range: 1000000 }],
    need: (self) => ({
      slot: { domain: 'transcendent', path: 'worship' },
      holderId: self,
      band: { kind: 'range', min: 1, max: 1000000000000 },
      urgency: 0.3,
      collapseAfterTicks: 1000,
      note: '아무도 빌지 않으면 어미는 흩어진다',
    }),
    value: (self) => ({
      slot: { domain: 'psychic', path: 'conviction' },
      holderId: villagersId,
      band: { kind: 'range', min: 0.4, max: 1 },
      weight: 0.7,
      note: `${self} 를 믿는 마음이 두터워야 신역이 넓어진다`,
    }),
  },
];

const SPECIES = SKETCHES.map((sketch) =>
  speciesFor(sketch.kind, sketch.name, sketch.slots, sketch.originId),
);
const DEFINITIONS: readonly Definition[] = [inscribe, ...SPECIES];

function profileOf(sketch: Sketch): SubjectProfile {
  const species = SPECIES.find((entry) => entry.name === sketch.name) as SpeciesDefinition;
  const self = subjectIdOf(species.id, sketch.name);
  return buildSubject({
    speciesId: species.id,
    label: sketch.name,
    name: sketch.name,
    subjectKind: sketch.kind,
    partOfId: null,
    boundaries: sketch.boundaries,
    perception: { channels: sketch.channels },
    needs: [sketch.need(self)],
    values: [sketch.value(self)],
    capabilities: [inscribeId],
  });
}

const PROFILES = SKETCHES.map(profileOf);
const hunter = PROFILES[0] as SubjectProfile;

describe('질문 배정', () => {
  test('원문 다섯 질문이 순서 그대로 선다', () => {
    assert.deepEqual(
      QUESTION_SPECS.map((spec) => spec.key),
      [...QUESTION_KEYS],
    );
    assert.deepEqual(
      QUESTION_SPECS.map((spec) => spec.question),
      [
        '무엇을 감지할 수 있는가?',
        '무엇에 의존하는가?',
        '무엇을 할 수 있는가?',
        '무엇을 기억하는가?',
        '어떤 상태를 유지하려 하는가?',
      ],
    );
  });

  test('위반은 자기 자리의 질문으로 간다', () => {
    const at = (path: string): string | null =>
      questionOf({
        rule: 'bad-stake',
        subjectId: hunter.id,
        subjectName: hunter.name,
        subjectKind: 'person',
        path,
        message: '',
      });
    assert.equal(at('$.perception.channels[0].threshold'), 'perceive');
    assert.equal(at('$.beliefGraphId'), 'perceive');
    assert.equal(at('$.needs[0].band'), 'depend');
    assert.equal(at('$.dependencyGraphId'), 'depend');
    assert.equal(at('$.capabilities[0]'), 'act');
    assert.equal(at('$.memoryStoreId'), 'remember');
    assert.equal(at('$.values[0]'), 'keep');
    // 토대는 어느 질문의 것도 아니다 — 다섯 전부를 막는다.
    assert.equal(at('$.boundaries'), null);
    assert.equal(at('$.speciesId'), null);
  });
});

describe('한 주체의 응답표', () => {
  test('사냥꾼이 다섯 질문에 전부 답한다', () => {
    const report = answerFive(hunter, DEFINITIONS);
    assert.equal(report.complete, true);
    assert.equal(report.answeredCount, 5);
    assert.deepEqual(
      report.answers.map((answer) => answer.answer),
      [
        '빛 ≥0.2 · 300m',
        'hunger 0~0.6 (급함 0.8)',
        '전언 새김',
        `${hunter.memoryStoreId} (R5 가 채운다)`,
        `stock.${herbId} → 5~1000 (힘 0.5)`,
      ],
    );
    assert.ok(fiveQuestionVerdict(report).includes('전부 답한다'), fiveQuestionVerdict(report));
  });

  test('막힌 질문은 답 대신 사유가 실린다', () => {
    const mute = { ...hunter, capabilities: [], perception: { channels: [] } };
    const report = answerFive(mute, DEFINITIONS);
    assert.equal(report.answeredCount, 3);
    assert.deepEqual(
      report.answers.filter((answer) => !answer.answered).map((answer) => answer.key),
      ['perceive', 'act'],
    );
    assert.ok(report.answers[2]?.answer.includes('사물이다'), report.answers[2]?.answer);
    assert.ok(fiveQuestionVerdict(report).includes('3/5'), fiveQuestionVerdict(report));
  });

  test('토대가 무너지면 다섯 전부가 막힌다 — 질문 자체가 성립하지 않는다', () => {
    const report = answerFive({ ...hunter, boundaries: [] }, DEFINITIONS);
    assert.equal(report.answeredCount, 0);
    assert.equal(report.foundation.length, 1);
    assert.equal(report.foundation[0]?.rule, 'unbounded-subject');
    for (const answer of report.answers) {
      assert.deepEqual(answer.blockers, report.foundation, answer.key);
    }
  });

  test('같은 주체면 같은 응답표다', () => {
    assert.deepEqual(answerFive(hunter, DEFINITIONS), answerFive(hunter, DEFINITIONS));
  });
});

describe('공통 인터페이스', () => {
  test('주체 5종이 각자 다른 방식으로 같은 다섯 질문에 답한다', () => {
    const report = commonInterfaceReport(PROFILES, DEFINITIONS);
    assert.deepEqual(report.gaps, []);
    assert.deepEqual(report.missingKinds, []);
    assert.equal(report.complete, true);
    assert.ok(commonInterfaceVerdict(report).includes('공통 인터페이스가 선다'));
  });

  test('감지하는 방법은 종류마다 다르다 — 답이 있다는 것만 같다', () => {
    const report = commonInterfaceReport(PROFILES, DEFINITIONS);
    assert.deepEqual(
      report.reports.map((entry) => entry.answers[0]?.answer),
      ['빛 ≥0.2 · 300m', '냄새 ≥0.05 · 40m', '보고 ≥0.4 · 1000000m', '보고 ≥0.5 · 1000000m', '의념 잔향 ≥0.05 · 1000000m'],
    );
    assert.deepEqual(
      report.reports.map((entry) => entry.subjectKind),
      [...SUBJECT_KINDS],
    );
  });

  test('한 종류라도 빠지면 공통이라 말할 수 없다', () => {
    const report = commonInterfaceReport(PROFILES.slice(0, 4), DEFINITIONS);
    assert.equal(report.complete, false);
    assert.deepEqual([...report.missingKinds], ['god']);
    assert.ok(commonInterfaceVerdict(report).includes('god'), commonInterfaceVerdict(report));
  });

  test('한 칸이라도 비면 격자가 그 자리를 지목한다', () => {
    const broken = [...PROFILES.slice(0, 4), { ...(PROFILES[4] as SubjectProfile), values: [] }];
    const report = commonInterfaceReport(broken, DEFINITIONS);
    assert.deepEqual([...report.gaps], ['god/keep']);
    assert.deepEqual([...report.missingKinds], ['god']);
    assert.equal(report.complete, false);
  });

  test('세운 주체가 없으면 완결이 아니다', () => {
    assert.equal(commonInterfaceReport([], DEFINITIONS).complete, false);
    assert.ok(commonInterfaceVerdict(commonInterfaceReport([], DEFINITIONS)).includes('세운 주체가 없다'));
  });
});
