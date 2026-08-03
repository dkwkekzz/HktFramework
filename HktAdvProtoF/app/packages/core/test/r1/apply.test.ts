// R1-b 단위 테스트 — 사건이 원장의 근거 자리를 채우고, 사건 없이 담긴 칸이 걸린다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { readSlot, slotStateId, type StateDomain } from '../../src/o2/index.ts';
import type { ActionProposal } from '../../src/p0/index.ts';
import {
  causedBy,
  commit,
  genesisCause,
  latest,
  openStore,
  type WorldStateStore,
} from '../../src/r0/index.ts';
import {
  appendLog,
  applyEvent,
  logVerdict,
  mintEvent,
  openLog,
  statesAfter,
  undoneSlots,
  witnessViolations,
  type EventLog,
  type EventValue,
  type WorldEvent,
} from '../../src/r1/index.ts';

const hunterId = deterministicId('subject', 'person', '몰이꾼 04');
const rivalId = deterministicId('subject', 'person', '상단 11');
const meatId = deterministicId('entity', 'resource', '말린 고기');
const canyonId = deterministicId('entity', 'place', '협곡');

const slot = (domain: StateDomain, ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

const worldStates = (stock: number): readonly State[] => [
  slot('biological', hunterId, 'hunger', 0.6),
  slot('biological', hunterId, 'vitality', 0.8),
  slot('biological', rivalId, 'vitality', 0.9),
  slot('economic', hunterId, `stock.${meatId}`, stock),
  slot('physical', hunterId, 'region', canyonId),
];

/** 세계가 선 원장 — genesis 하나. */
const opened = (stock = 2): WorldStateStore =>
  commit(openStore(), {
    tick: 400,
    states: worldStates(stock),
    cause: genesisCause('붉은 장막의 겨울이 시작된다'),
  }).store;

const acquireProposal: ActionProposal = {
  atom: 'acquire',
  actorId: hunterId,
  targetIds: [meatId],
  changes: [
    { domain: 'economic', holderId: hunterId, path: `stock.${meatId}` },
    { domain: 'biological', holderId: hunterId, path: 'hunger' },
  ],
  payments: [{ domain: 'biological', holderId: hunterId, path: 'vitality' }],
  observedIds: [meatId],
};

const acquireValues = (stock: number, hunger: number, vitality: number): readonly EventValue[] => [
  { kind: 'change', domain: 'economic', holderId: hunterId, path: `stock.${meatId}`, to: stock },
  { kind: 'change', domain: 'biological', holderId: hunterId, path: 'hunger', to: hunger },
  { kind: 'payment', domain: 'biological', holderId: hunterId, path: 'vitality', to: vitality },
];

/** 협곡에서 고기를 가져오는 사건 하나. */
const acquireEvent = (store: WorldStateStore, tick = 403, stock = 4): WorldEvent =>
  mintEvent({
    proposal: acquireProposal,
    world: (latest(store) as NonNullable<ReturnType<typeof latest>>).world,
    tick,
    name: '협곡에서 고기를 가져온다',
    values: acquireValues(stock, 0.3, 0.7),
  }).event as WorldEvent;

const rulesOf = (violations: readonly { readonly rule: string }[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('R1-b 사건이 세계를 바꾼다', () => {
  test('사건을 얹으면 원장의 근거 자리가 사건 id 로 찬다', () => {
    const store = opened();
    const event = acquireEvent(store);
    const result = applyEvent(store, openLog(), event);

    assert.equal(result.applied, true);
    assert.deepEqual(result.violations, []);
    assert.equal(result.snapshot?.tick, 403);
    assert.deepEqual(result.snapshot?.cause.eventIds, [event.id]);
    assert.match(result.snapshot?.cause.label ?? '', /획득 — 협곡에서 고기를 가져온다/);
  });

  test('바뀌는 자리는 사건이 적은 자리뿐이다 — 나머지 세계는 그대로다', () => {
    const store = opened();
    const result = applyEvent(store, openLog(), acquireEvent(store));
    const world = result.snapshot?.world as NonNullable<typeof result.snapshot>['world'];

    assert.equal(readSlot(world, 'economic', hunterId, `stock.${meatId}`), 4);
    assert.equal(readSlot(world, 'biological', hunterId, 'hunger'), 0.3);
    assert.equal(readSlot(world, 'biological', hunterId, 'vitality'), 0.7);
    assert.equal(readSlot(world, 'biological', rivalId, 'vitality'), 0.9);
    assert.equal(readSlot(world, 'physical', hunterId, 'region'), canyonId);
    assert.equal(result.snapshot?.changes.length, 3);
  });

  test('로그가 사건을 담고, 얹힌 세계가 다음 사건의 재료가 된다', () => {
    const store = opened();
    const first = applyEvent(store, openLog(), acquireEvent(store));
    const second = applyEvent(first.store, first.log, acquireEvent(first.store, 406, 6));

    assert.equal(second.applied, true);
    assert.equal(second.log.events.length, 2);
    assert.equal(second.store.snapshots.length, 3);
    assert.equal(logVerdict(second.store, second.log), '사건 2 · 변화한 칸 2 중 사건이 대는 칸 2');
  });

  test('세계에 얹을 State 는 바뀐 자리만 갈아 끼운다', () => {
    const store = opened();
    const states = statesAfter((latest(store) as NonNullable<ReturnType<typeof latest>>).world, acquireEvent(store));
    assert.equal(states.length, worldStates(2).length);
  });

  test('빈 원장에는 사건을 얹을 수 없다 — 세계가 먼저 서야 한다', () => {
    const store = opened();
    const result = applyEvent(openStore(), openLog(), acquireEvent(store));
    assert.deepEqual(rulesOf(result.violations), ['unwitnessed-commit']);
    assert.equal(result.applied, false);
  });
});

describe('R1-b 얹을 수 없는 사건', () => {
  test('낡은 전제 위에 쓰지 않는다 — 사건이 만들어진 뒤 세계가 움직였다', () => {
    const store = opened();
    const event = acquireEvent(store); // 재고 2 를 전제한다
    const moved = applyEvent(store, openLog(), acquireEvent(store, 401, 5)).store; // 재고가 5 가 됐다
    const result = applyEvent(moved, openLog(), { ...event, tick: 402 });

    assert.deepEqual(rulesOf(result.violations), ['stale-effect']);
    assert.match(result.violations[0]?.message ?? '', /이미 다른 세계의 것이다/);
    assert.equal(result.store, moved);
  });

  test('되돌릴 수 없는 원자가 바꾼 자리는 되돌리지 못한다', () => {
    const store = opened();
    // 상단 11 을 제거한다 — destroy 는 P0-b 가 reversible: false 로 적어 둔 원자다
    const destroy = mintEvent({
      proposal: {
        atom: 'destroy',
        actorId: hunterId,
        targetIds: [rivalId],
        changes: [{ domain: 'biological', holderId: rivalId, path: 'vitality' }],
        payments: [{ domain: 'biological', holderId: hunterId, path: 'vitality' }],
        observedIds: [rivalId],
      },
      world: (latest(store) as NonNullable<ReturnType<typeof latest>>).world,
      tick: 403,
      name: '상단 11 을 친다',
      values: [
        { kind: 'change', domain: 'biological', holderId: rivalId, path: 'vitality', to: 0 },
        { kind: 'payment', domain: 'biological', holderId: hunterId, path: 'vitality', to: 0.6 },
      ],
    }).event as WorldEvent;

    const after = applyEvent(store, openLog(), destroy);
    assert.equal(after.applied, true);

    // 같은 자리를 예전 값(0.9)으로 되돌리려 한다
    const undo = mintEvent({
      proposal: {
        atom: 'destroy',
        actorId: hunterId,
        targetIds: [rivalId],
        changes: [{ domain: 'biological', holderId: rivalId, path: 'vitality' }],
        payments: [{ domain: 'biological', holderId: hunterId, path: 'vitality' }],
        observedIds: [rivalId],
      },
      world: (latest(after.store) as NonNullable<ReturnType<typeof latest>>).world,
      tick: 406,
      name: '없던 일로 한다',
      values: [
        { kind: 'change', domain: 'biological', holderId: rivalId, path: 'vitality', to: 0.9 },
        { kind: 'payment', domain: 'biological', holderId: hunterId, path: 'vitality', to: 0.5 },
      ],
    }).event as WorldEvent;

    const result = applyEvent(after.store, after.log, undo);
    assert.deepEqual(rulesOf(result.violations), ['irreversible-undo']);
    assert.deepEqual(undoneSlots(after.log, undo), [`biological.${rivalId}.vitality`]);
    assert.equal(result.applied, false);
  });

  test('되돌릴 수 있는 원자가 바꾼 자리는 되돌아간다 — 모든 손실이 봉인되는 것은 아니다', () => {
    const store = opened();
    const first = applyEvent(store, openLog(), acquireEvent(store, 403, 4));
    const back = mintEvent({
      proposal: acquireProposal,
      world: (latest(first.store) as NonNullable<ReturnType<typeof latest>>).world,
      tick: 406,
      name: '도로 내려놓는다',
      values: acquireValues(2, 0.6, 0.65),
    }).event as WorldEvent;

    const result = applyEvent(first.store, first.log, back);
    assert.equal(result.applied, true);
  });

  test('세계가 거부하는 값은 사건이라도 담기지 않는다 — O2 관문 그대로', () => {
    const store = opened(0);
    const belowZero = mintEvent({
      proposal: acquireProposal,
      world: (latest(store) as NonNullable<ReturnType<typeof latest>>).world,
      tick: 403,
      name: '없는 고기를 먹는다',
      values: acquireValues(-2, 0.3, 0.7),
    }).event as WorldEvent;

    const result = applyEvent(store, openLog(), belowZero);
    assert.deepEqual(rulesOf(result.violations), ['unwitnessed-commit']);
    assert.match(result.violations[0]?.message ?? '', /rejected-state/);
    assert.equal(result.applied, false);
  });

  test('없는 사건 때문에 일어날 수는 없다', () => {
    const store = opened();
    const event = { ...acquireEvent(store), causeIds: ['event:ffff'] };
    const result = applyEvent(store, openLog(), event);
    assert.deepEqual(rulesOf(result.violations), ['dangling-cause']);
  });
});

describe('R1-b 원장 감사 — 사건 없이 담긴 칸', () => {
  const witnessed = (): { store: WorldStateStore; log: EventLog } => {
    const store = opened();
    const result = applyEvent(store, openLog(), acquireEvent(store));
    return { store: result.store, log: result.log };
  };

  test('사건으로만 자란 원장에는 사유가 없다 — genesis 는 예외다', () => {
    const { store, log } = witnessed();
    assert.deepEqual(witnessViolations(store, log), []);
    assert.equal(store.snapshots[0]?.cause.kind, 'genesis');
  });

  test('사건 없이 담긴 칸이 걸린다 — 이것이 "사건 없는 변경 금지" 의 검사다', () => {
    const store = opened();
    const silent = commit(store, {
      tick: 403,
      states: worldStates(9),
      cause: causedBy('누군가 창고를 채웠다'),
    }).store;

    const found = witnessViolations(silent, openLog());
    assert.deepEqual(rulesOf(found), ['unwitnessed-commit']);
    assert.match(found[0]?.message ?? '', /세계는 사건으로만 바뀐다/);
  });

  test('로그에 없는 사건을 가리키는 칸도 걸린다', () => {
    const { store } = witnessed();
    assert.deepEqual(rulesOf(witnessViolations(store, openLog())), ['dangling-cause']);
  });

  test('칸의 틱과 사건의 틱이 어긋나도 걸린다', () => {
    const { store, log } = witnessed();
    const shifted = appendLog(openLog(), {
      ...(log.events[0] as WorldEvent),
      tick: 999,
    });
    assert.deepEqual(rulesOf(witnessViolations(store, shifted)), ['dangling-cause']);
  });
});
