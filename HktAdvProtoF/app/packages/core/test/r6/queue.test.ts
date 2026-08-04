// R6-c 단위 테스트 — 의도가 사건이 되고 흔적이 난다. 고리는 주장이 아니라 검사다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { assembleWorld, disassembleWorld, slotStateId } from '../../src/o2/index.ts';
import { buildGrammar, type PossibilityGrammar } from '../../src/p2/index.ts';
import type { ActiveGoal } from '../../src/p4/index.ts';
import type { ActionPlan, PlanStep } from '../../src/p5/index.ts';
import { commit, genesisCause, openStore, type WorldStateStore } from '../../src/r0/index.ts';
import { openLog } from '../../src/r1/index.ts';
import {
  auditIntents,
  closeLoop,
  enqueue,
  formIntent,
  idle,
  intentQueueVerdict,
  intentsAt,
  intentsFor,
  openIntentQueue,
  type ActionIntent,
  type Aim,
} from '../../src/r6/index.ts';

const actorId = deterministicId('subject', 'person', '몰이꾼 04');
const rivalId = deterministicId('subject', 'person', '상단 11');
const meatId = deterministicId('entity', 'thing', '말린 고기');

const slot = (domain: State['domain'], ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

const canyonId = deterministicId('entity', 'place', '협곡');

// 흔적은 지닌 자가 선 곳에서 난다 (R2-b) — 자리를 적어 두지 않으면 고리가 흔적에서 끊긴다.
const genesis = assembleWorld([
  slot('physical', actorId, 'region', canyonId),
  slot('physical', rivalId, 'region', canyonId),
  slot('economic', actorId, `stock.${meatId}`, 2),
  slot('biological', actorId, 'vitality', 0.7),
  slot('relational', actorId, `grudge.${rivalId}`, 0.3),
  slot('biological', rivalId, 'vitality', 0.8),
]).world;

const storeOf = (): WorldStateStore =>
  commit(openStore(), {
    tick: 400,
    states: disassembleWorld(genesis),
    cause: genesisCause('겨울이 시작된다'),
  }).store;

const grammar: PossibilityGrammar = buildGrammar({
  archetype: {
    id: deterministicId('species', '사람'),
    name: '사람',
    subjectKind: 'person',
  } as never,
});

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

const planOf = (steps: readonly PlanStep[], subjectId = actorId): ActionPlan => ({
  subjectId,
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

const goalOf = (nodeId = 'possibility:겨울 식량'): ActiveGoal =>
  ({
    subjectId: actorId,
    tick: 420,
    nodeId,
    label: '겨울 식량',
    direction: 'fulfill',
    viaAtom: 'seize',
    score: 0.7,
    commitmentInertia: 0,
    heldTicks: 0,
    changed: true,
    change: 'first',
    note: '',
  }) as unknown as ActiveGoal;

const aim: Aim = {
  counterpartId: rivalId,
  axis: 'grudge',
  value: 0.3,
  via: 'attribution',
  note: '원한이 가장 크다',
};

const intentOf = (tick = 420, goalId?: string): ActionIntent =>
  formIntent({
    plan: planOf([stepOf()]),
    goal: goalOf(goalId),
    tick,
    grammar,
    aim,
    changes: [{ domain: 'economic', holderId: actorId, path: `stock.${meatId}` }],
    payments: [{ domain: 'biological', holderId: actorId, path: 'vitality' }],
    observedIds: [rivalId, meatId],
  }).intent as ActionIntent;

const valuesFor = () => [
  { kind: 'change' as const, domain: 'economic' as const, holderId: actorId, path: `stock.${meatId}`, to: 5 },
  { kind: 'payment' as const, domain: 'biological' as const, holderId: actorId, path: 'vitality', to: 0.6 },
];

describe('R6-c 의도장', () => {
  test('담은 것을 주체별·틱별로 찾을 수 있다', () => {
    const queue = enqueue(openIntentQueue(), [intentOf(420), intentOf(421)]);
    assert.equal(queue.intents.length, 2);
    assert.equal(intentsFor(queue, actorId).length, 2);
    assert.equal(intentsAt(queue, 420).length, 1);
  });

  test('같은 id 는 늘어나지 않고 갈아 끼워진다', () => {
    const queue = enqueue(openIntentQueue(), [intentOf(420)]);
    assert.equal(enqueue(queue, [intentOf(420)]).intents.length, 1);
  });

  test('아무 의도도 내지 못한 주체는 사실로 센다', () => {
    const queue = enqueue(openIntentQueue(), [intentOf(420)]);
    assert.deepEqual([...idle(queue, [actorId, rivalId])], [rivalId]);
  });

  test('한 주체가 한 틱에 둘을 내면 걸린다', () => {
    const queue = enqueue(openIntentQueue(), [
      intentOf(420, 'possibility:겨울 식량'),
      intentOf(420, 'possibility:겨울 움막'),
    ]);
    const audit = auditIntents({ queue, subjectIds: [actorId] });
    assert.ok(audit.violations.some((violation) => violation.rule === 'unqueued-intent'));
  });

  test('빈 의도장은 아무 어긋남도 내지 않는다', () => {
    const audit = auditIntents({ queue: openIntentQueue(), subjectIds: [actorId] });
    assert.equal(audit.queued, 0);
    assert.deepEqual(audit.violations, []);
    assert.deepEqual([...audit.idle], [actorId]);
  });
});

describe('R6-c 고리가 닫힌다 — 주장이 아니라 검사다', () => {
  test('의도가 사건이 되고 그 사건이 흔적을 낸다', () => {
    const result = closeLoop({
      store: storeOf(),
      log: openLog(),
      intents: [intentOf()],
      valuesFor,
    });
    const step = result.steps[0];
    assert.ok(step?.event !== null, '사건이 섰다');
    assert.equal(step?.event?.atom, 'seize');
    assert.ok((step?.phenomena.length ?? 0) > 0, '흔적이 났다');
    assert.deepEqual(result.violations, []);
  });

  test('세계가 실제로 움직인다 — 원장에 칸이 는다', () => {
    const before = storeOf();
    const result = closeLoop({ store: before, log: openLog(), intents: [intentOf()], valuesFor });
    assert.equal(result.store.snapshots.length, before.snapshots.length + 1);
    assert.equal(result.log.events.length, 1);
  });

  test('그 사건의 흔적은 다시 읽힐 수 있는 모양이다 — 고리가 이어진다', () => {
    const result = closeLoop({ store: storeOf(), log: openLog(), intents: [intentOf()], valuesFor });
    for (const phenomenon of result.phenomena) {
      assert.equal(phenomenon.kind, 'Phenomenon');
      assert.equal(phenomenon.causeEventId, result.log.events[0]?.id);
      assert.ok(phenomenon.channel.length > 0);
    }
  });

  test('세계가 거부하면 사건이 서지 않고 사유가 남는다 — R6 가 다시 판정하지 않는다', () => {
    const result = closeLoop({
      store: storeOf(),
      log: openLog(),
      intents: [intentOf()],
      // 재고를 0 아래로 내린다 — O2 관문이 막는다
      valuesFor: () => [
        { kind: 'change' as const, domain: 'economic' as const, holderId: actorId, path: `stock.${meatId}`, to: -5 },
        { kind: 'payment' as const, domain: 'biological' as const, holderId: actorId, path: 'vitality', to: 0.6 },
      ],
    });
    assert.ok(result.violations.length > 0);
    assert.ok(result.violations.every((violation) => violation.rule === 'uncaused-event'));
    assert.equal(result.steps[0]?.phenomena.length, 0);
  });

  test('세계가 서기 전에는 의도를 얹을 자리가 없다', () => {
    const result = closeLoop({
      store: openStore(),
      log: openLog(),
      intents: [intentOf()],
      valuesFor,
    });
    assert.deepEqual(
      result.violations.map((violation) => violation.rule),
      ['uncaused-event'],
    );
  });

  test('감사가 고리의 결과를 값으로 낸다', () => {
    const queue = enqueue(openIntentQueue(), [intentOf()]);
    const loop = closeLoop({ store: storeOf(), log: openLog(), intents: queue.intents, valuesFor });
    const audit = auditIntents({ queue, subjectIds: [actorId, rivalId], loop });
    assert.equal(audit.queued, 1);
    assert.equal(audit.aimed, 1);
    assert.equal(audit.enacted, 1);
    assert.equal(audit.witnessed, 1);
    assert.equal(audit.silent, 0);
    assert.deepEqual([...audit.idle], [rivalId]);
    assert.deepEqual(audit.violations, []);
    assert.ok(intentQueueVerdict(audit).startsWith('의도장이 성립한다'));
  });

  test('같은 재료면 언제나 같은 고리다 (결정성)', () => {
    const one = closeLoop({ store: storeOf(), log: openLog(), intents: [intentOf()], valuesFor });
    const two = closeLoop({ store: storeOf(), log: openLog(), intents: [intentOf()], valuesFor });
    assert.equal(one.log.events[0]?.id, two.log.events[0]?.id);
    assert.deepEqual(
      one.phenomena.map((entry) => entry.id),
      two.phenomena.map((entry) => entry.id),
    );
  });
});
