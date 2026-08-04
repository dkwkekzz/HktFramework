// R6-a 단위 테스트 — 계획의 걸음 하나가 요청이 되고, 상대가 필요한 원자는 여섯뿐이다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { ACTION_ATOMS, type ActionAtom, type ChangeRef } from '../../src/p0/index.ts';
import { buildGrammar, type PossibilityGrammar } from '../../src/p2/index.ts';
import type { ActiveGoal } from '../../src/p4/index.ts';
import type { ActionPlan, PlanStep } from '../../src/p5/index.ts';
import {
  aimingAtoms,
  consentOf,
  formIntent,
  intentIdOf,
  needsCounterpart,
  nextStep,
  orderIntents,
  type ActionIntent,
  type Aim,
  type IntentViolation,
} from '../../src/r6/index.ts';

const actorId = deterministicId('subject', 'person', '몰이꾼 04');
const rivalId = deterministicId('subject', 'person', '상단 11');
const meatId = deterministicId('entity', 'thing', '말린 고기');

const stepOf = (overrides: Partial<PlanStep> = {}): PlanStep => ({
  order: 0,
  atom: 'seize',
  label: '빼앗다',
  reason: 'goal',
  forAtom: null,
  forSlot: null,
  verdict: 'payable',
  unbrakedSlots: [],
  note: '지금 낼 수 있다',
  ...overrides,
});

const planOf = (steps: readonly PlanStep[]): ActionPlan => ({
  subjectId: actorId,
  goalId: 'possibility:겨울 식량',
  label: '겨울 식량',
  direction: 'fulfill',
  steps,
  atoms: steps.map((step) => step.atom),
  deadEnds: [],
  depth: steps.length,
  violations: [],
  complete: true,
});

const goal: ActiveGoal = {
  subjectId: actorId,
  tick: 420,
  nodeId: 'possibility:겨울 식량',
  label: '겨울 식량',
  direction: 'fulfill',
  viaAtom: 'seize',
  score: 0.7,
  commitmentInertia: 0,
  heldTicks: 0,
  changed: true,
  change: 'first',
  note: '',
} as unknown as ActiveGoal;

const grammarOf = (denied: readonly ActionAtom[] = []): PossibilityGrammar => {
  const base = buildGrammar({
    archetype: {
      id: deterministicId('species', '사람'),
      name: '사람',
      subjectKind: 'person',
    } as never,
  });
  if (denied.length === 0) return base;
  return {
    ...base,
    allowed: base.allowed.filter((atom) => !denied.includes(atom)),
    denied: [...base.denied, ...denied],
  };
};

const grudgeAim: Aim = {
  counterpartId: rivalId,
  axis: 'grudge',
  value: 0.03,
  via: 'attribution',
  note: '원한이 가장 큰 상대',
};

const seizeChanges: readonly ChangeRef[] = [
  { domain: 'economic', holderId: actorId, path: `stock.${meatId}` },
];
const seizePayments: readonly ChangeRef[] = [
  { domain: 'biological', holderId: actorId, path: 'vitality' },
];

const rulesOf = (violations: readonly IntentViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

const form = (overrides: Partial<Parameters<typeof formIntent>[0]> = {}) =>
  formIntent({
    plan: planOf([stepOf()]),
    goal,
    tick: 420,
    grammar: grammarOf(),
    aim: grudgeAim,
    changes: seizeChanges,
    payments: seizePayments,
    observedIds: [rivalId, meatId],
    ...overrides,
  });

describe('R6-a 상대가 필요한 원자는 여섯뿐이다', () => {
  test('P0-b touches: between 이 그 여섯을 이미 갈라 두었다', () => {
    assert.deepEqual(
      [...aimingAtoms()],
      ['exchange', 'seize', 'persuade', 'coerce', 'ally', 'betray'],
    );
  });

  test('동의 축이 그 여섯을 셋씩 나눈다', () => {
    const mutual = aimingAtoms().filter((atom) => consentOf(atom) === 'mutual');
    const against = aimingAtoms().filter((atom) => consentOf(atom) === 'against');
    assert.deepEqual([...mutual], ['exchange', 'persuade', 'ally']);
    assert.deepEqual([...against], ['seize', 'coerce', 'betray']);
  });

  test('나머지 열은 상대를 요구하지 않는다 — 자리와 물건을 겨눈다', () => {
    const solo = ACTION_ATOMS.filter((atom) => !needsCounterpart(atom));
    assert.equal(solo.length, 10);
    assert.equal(needsCounterpart('acquire'), false);
    assert.equal(needsCounterpart('seize'), true);
  });
});

describe('R6-a 계획의 걸음 하나가 요청이 된다', () => {
  test('막히지 않은 첫 걸음을 고른다 — 새로 재지 않는다', () => {
    const plan = planOf([
      stepOf({ order: 0, atom: 'exchange', verdict: 'blocked' }),
      stepOf({ order: 1, atom: 'seize', verdict: 'payable' }),
    ]);
    assert.equal(nextStep(plan)?.order, 1);
  });

  test('브레이크가 없는 걸음도 낼 수 있다 — 위험이지 막힘이 아니다', () => {
    const plan = planOf([stepOf({ verdict: 'unbraked' })]);
    assert.equal(nextStep(plan)?.verdict, 'unbraked');
  });

  test('요청서가 P0-c 관문을 그대로 지난다 — 여기서 새 문법을 만들지 않았다', () => {
    const intent = form().intent as ActionIntent;
    assert.equal(intent.kind, 'Affordance');
    assert.equal(intent.atom, 'seize');
    assert.equal(intent.proposal.actorId, actorId);
    assert.deepEqual([...intent.proposal.targetIds], [rivalId]);
    assert.equal(intent.goalId, goal.nodeId);
    assert.equal(intent.stepOrder, 0);
  });

  test('바꿀 자리와 치를 자리는 호출자가 준 것 그대로다 — R6 가 고르지 않는다', () => {
    const intent = form().intent as ActionIntent;
    assert.deepEqual([...intent.proposal.changes], [...seizeChanges]);
    assert.deepEqual([...intent.proposal.payments], [...seizePayments]);
  });

  test('같은 내는 자·같은 목적·같은 틱이면 같은 의도다 (V1 결정적 id)', () => {
    assert.equal(intentIdOf(actorId, goal.nodeId, 420), intentIdOf(actorId, goal.nodeId, 420));
    assert.notEqual(intentIdOf(actorId, goal.nodeId, 420), intentIdOf(actorId, goal.nodeId, 421));
  });

  test('의도는 틱 → 내는 자 → id 로 정렬된다 (배치가 결정적이다)', () => {
    const a = form().intent as ActionIntent;
    const b = form({ tick: 419 }).intent as ActionIntent;
    assert.deepEqual(
      orderIntents([a, b]).map((intent) => intent.tick),
      [419, 420],
    );
  });
});

describe('R6-a 설 수 없는 의도가 걸린다', () => {
  const check = (overrides: Partial<Parameters<typeof formIntent>[0]>) =>
    rulesOf(form(overrides).violations);

  test('선 의도는 아무 사유도 내지 않는다', () => {
    assert.deepEqual(rulesOf(form().violations), []);
  });

  test('빈 계획은 의도가 되지 않는다', () => {
    assert.deepEqual(check({ plan: planOf([]) }), ['no-step']);
  });

  test('걸음이 전부 막히면 의도가 서지 않는다', () => {
    assert.deepEqual(check({ plan: planOf([stepOf({ verdict: 'blocked' })]) }), ['blocked-step']);
  });

  test('문법이 닫은 원자는 의도가 되지 못한다 — 사제의 죽임처럼', () => {
    assert.deepEqual(check({ grammar: grammarOf(['seize']) }), ['ungrammatical-intent']);
  });

  test('상대가 있어야 서는 원자인데 겨눈 상대가 없으면 서지 못한다', () => {
    assert.deepEqual(check({ aim: null }), ['aimless-intent']);
  });

  test('상대를 겨누지 않는 원자에 상대를 적으면 걸린다', () => {
    const plan = planOf([stepOf({ atom: 'acquire' })]);
    assert.deepEqual(check({ plan }), ['targetless-atom']);
  });

  test('자기 자신은 겨눌 수 없다', () => {
    assert.deepEqual(
      check({ aim: { ...grudgeAim, counterpartId: actorId } }),
      ['self-aimed'],
    );
  });

  test('내는 자가 없는 계획은 의도가 되지 않는다', () => {
    const plan = { ...planOf([stepOf()]), subjectId: '' };
    assert.deepEqual(check({ plan }), ['actorless-intent']);
  });

  test('공짜 요청은 P0-c 관문에서 걸린다 — R6 가 다시 판정하지 않는다', () => {
    assert.ok(check({ payments: [] }).includes('malformed-request'));
  });
});
