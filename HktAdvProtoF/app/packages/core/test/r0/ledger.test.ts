// R0-a 단위 테스트 — 세계에 주인이 생긴다: 담기는 것과 물리는 것, 그리고 지워지지 않는 열.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { readSlot, slotStateId, type StateDomain } from '../../src/o2/index.ts';
import {
  causedBy,
  chainViolations,
  commit,
  commitAll,
  genesisCause,
  latest,
  openStore,
  replayStore,
  snapshotHashOf,
  snapshotStates,
  snapshotLine,
  storeVerdict,
  storeViolationVerdict,
  type CommitAttempt,
  type WorldStateSnapshot,
  type WorldStateStore,
} from '../../src/r0/index.ts';

const hunterId = deterministicId('subject', 'person', '몰이꾼 04');
const meatId = deterministicId('entity', 'resource', '말린 고기');

const slot = (domain: StateDomain, ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

/** 재고가 stock 인 그 틱의 세계 — 자리 셋짜리 최소 세계다. */
const worldStates = (stock: number): readonly State[] => [
  slot('biological', hunterId, 'hunger', 0.3),
  slot('biological', hunterId, 'vitality', 0.8),
  slot('economic', hunterId, `stock.${meatId}`, stock),
];

const genesis: CommitAttempt = {
  tick: 400,
  states: worldStates(10),
  cause: genesisCause(),
};

const opened = (): WorldStateStore => commit(openStore(), genesis).store;

describe('R0-a 원장에 담기', () => {
  test('빈 원장에 세계가 처음 서면 모든 자리가 새로 생긴 것으로 남는다', () => {
    const result = commit(openStore(), genesis);
    assert.equal(result.accepted, true);
    assert.deepEqual(result.violations, []);
    const snapshot = result.snapshot as WorldStateSnapshot;
    assert.equal(snapshot.seq, 0);
    assert.equal(snapshot.tick, 400);
    assert.equal(snapshot.slotCount, 3);
    assert.equal(snapshot.prevHash, null);
    assert.deepEqual(
      snapshot.changes.map((entry) => entry.change),
      ['added', 'added', 'added'],
    );
    assert.equal(result.store.ledgerHash, snapshot.hash);
  });

  test('담긴 세계는 자리로 읽힌다 — 조립 관문은 O2 것을 그대로 쓴다', () => {
    const store = opened();
    const snapshot = latest(store) as WorldStateSnapshot;
    assert.equal(readSlot(snapshot.world, 'economic', hunterId, `stock.${meatId}`), 10);
    assert.equal(readSlot(snapshot.world, 'economic', hunterId, 'stock.없는것'), null);
  });

  test('담긴 세계는 다시 State 원소로 펴진다 — O2 왕복 성질 그대로', () => {
    const snapshot = latest(opened()) as WorldStateSnapshot;
    const states = snapshotStates(snapshot);
    assert.equal(states.length, 3);
    assert.deepEqual(
      [...states].map((state) => state.path).sort(),
      ['hunger', `stock.${meatId}`, 'vitality'],
    );
  });

  test('세계가 달라지면 바뀐 자리만 남는다 — 원장은 시간이 아니라 변화를 센다', () => {
    const result = commit(opened(), {
      tick: 403,
      states: worldStates(8),
      cause: causedBy('사흘치를 먹었다'),
    });
    assert.equal(result.accepted, true);
    const snapshot = result.snapshot as WorldStateSnapshot;
    assert.equal(snapshot.seq, 1);
    assert.equal(snapshot.slotCount, 3);
    assert.deepEqual(snapshot.changes.length, 1);
    assert.equal(snapshot.changes[0]?.change, 'changed');
    assert.equal(snapshot.changes[0]?.before, 10);
    assert.equal(snapshot.changes[0]?.after, 8);
  });

  test('근거의 사건 자리는 비어 있다 — 채우는 것은 R1 이다', () => {
    assert.deepEqual(genesisCause().eventIds, []);
    assert.deepEqual(causedBy('사흘치를 먹었다').eventIds, []);
  });

  test('요약 한 줄이 사람에게 읽힌다', () => {
    const snapshot = latest(opened()) as WorldStateSnapshot;
    assert.match(snapshotLine(snapshot), /#0 틱 400 · 자리 3 · 바뀐 자리 3/);
    assert.match(storeVerdict(opened()), /칸 1 · 틱 400~400 · 지문 /);
    assert.equal(storeVerdict(openStore()), '빈 원장 — 아직 세계가 서지 않았다');
  });
});

describe('R0-a 담을 수 없는 커밋', () => {
  const rulesOf = (attempt: CommitAttempt, store: WorldStateStore = opened()): readonly string[] =>
    commit(store, attempt).violations.map((violation) => violation.rule);

  test('시간은 되돌릴 수 없다', () => {
    assert.deepEqual(
      rulesOf({ tick: 399, states: worldStates(8), cause: causedBy('되감기') }),
      ['backward-tick'],
    );
  });

  test('한 틱에 세계가 둘일 수 없다', () => {
    assert.deepEqual(
      rulesOf({ tick: 400, states: worldStates(8), cause: causedBy('같은 틱') }),
      ['duplicate-tick'],
    );
  });

  test('그대로인 세계는 칸을 늘리지 않는다', () => {
    assert.deepEqual(
      rulesOf({ tick: 403, states: worldStates(10), cause: causedBy('아무 일도 없었다') }),
      ['empty-commit'],
    );
  });

  test('무엇 때문인지 없이 세계가 달라지지 않는다 — R1 이 채울 자리', () => {
    assert.deepEqual(
      rulesOf({ tick: 403, states: worldStates(8), cause: causedBy('  ') }),
      ['causeless-commit'],
    );
  });

  test('O2 관문이 막은 값이 하나라도 있으면 커밋 전체가 물린다 — 세계는 반쪽으로 담기지 않는다', () => {
    const result = commit(opened(), {
      tick: 403,
      states: [...worldStates(8), slot('biological', hunterId, 'despair', 0.9)],
      cause: causedBy('없는 자리를 적었다'),
    });
    assert.equal(result.accepted, false);
    assert.deepEqual(
      result.violations.map((violation) => violation.rule),
      ['rejected-state'],
    );
    assert.equal(latest(result.store)?.tick, 400);
  });

  test('세계는 두 번 처음 서지 않는다', () => {
    assert.deepEqual(
      rulesOf({ tick: 403, states: worldStates(8), cause: genesisCause() }),
      ['genesis-required'],
    );
    assert.deepEqual(
      rulesOf({ tick: 400, states: worldStates(10), cause: causedBy('첫 칸') }, openStore()),
      ['genesis-required'],
    );
  });

  test('물린 커밋은 원장을 늘리지 않는다 — 던지지 않고 사유만 남는다', () => {
    const store = opened();
    const result = commit(store, { tick: 399, states: worldStates(8), cause: causedBy('되감기') });
    assert.equal(result.store, store);
    assert.equal(result.snapshot, null);
    assert.equal(storeViolationVerdict(result.violations), '틱 399 을 담을 수 없다 — backward-tick');
    assert.equal(storeViolationVerdict([]), '세계를 담을 수 있다');
  });
});

describe('R0-a 지워지지 않는 열', () => {
  const twoDeep = (): WorldStateStore =>
    commitAll(openStore(), [
      genesis,
      { tick: 403, states: worldStates(8), cause: causedBy('사흘치를 먹었다') },
      { tick: 406, states: worldStates(6), cause: causedBy('사흘치를 먹었다') },
    ]).store;

  test('칸마다 앞 칸의 해시를 품는다', () => {
    const store = twoDeep();
    assert.equal(store.snapshots.length, 3);
    assert.equal(store.snapshots[1]?.prevHash, store.snapshots[0]?.hash);
    assert.equal(store.snapshots[2]?.prevHash, store.snapshots[1]?.hash);
    assert.deepEqual(chainViolations(store), []);
  });

  test('지나간 칸의 값 하나를 손대면 그 뒤가 전부 어긋난다', () => {
    const store = twoDeep();
    const first = store.snapshots[0] as WorldStateSnapshot;
    const tampered: WorldStateStore = {
      ...store,
      snapshots: [
        {
          ...first,
          world: {
            ...first.world,
            economic: { [hunterId]: { [`stock.${meatId}`]: 99 } },
          },
        },
        ...store.snapshots.slice(1),
      ],
    };
    const found = chainViolations(tampered);
    assert.equal(found.length > 0, true);
    assert.deepEqual([...new Set(found.map((violation) => violation.rule))], ['broken-chain']);
    assert.equal(found[0]?.path, '$.snapshots[0].hash');
  });

  test('손댄 원장 위에는 새 칸을 쌓지 못한다', () => {
    const store = twoDeep();
    const tampered: WorldStateStore = { ...store, ledgerHash: 'ffffffff' };
    const result = commit(tampered, {
      tick: 409,
      states: worldStates(4),
      cause: causedBy('그다음 사흘'),
    });
    assert.equal(result.accepted, false);
    assert.deepEqual(
      [...new Set(result.violations.map((violation) => violation.rule))],
      ['broken-chain'],
    );
  });

  test('같은 재료면 다시 세워도 같은 지문이다', () => {
    const store = twoDeep();
    assert.equal(replayStore(store).ledgerHash, store.ledgerHash);
    assert.equal(replayStore(store, 403).ledgerHash, store.snapshots[1]?.hash);
    assert.equal(replayStore(store, 403).snapshots.length, 2);
  });

  test('해시는 앞 해시·틱·세계·근거에서 나온다 — 하나만 달라도 갈린다', () => {
    const snapshot = latest(opened()) as WorldStateSnapshot;
    assert.equal(
      snapshotHashOf(null, snapshot.tick, snapshot.world, snapshot.cause),
      snapshot.hash,
    );
    assert.notEqual(
      snapshotHashOf(null, snapshot.tick + 1, snapshot.world, snapshot.cause),
      snapshot.hash,
    );
    assert.notEqual(
      snapshotHashOf(null, snapshot.tick, snapshot.world, causedBy('다른 까닭')),
      snapshot.hash,
    );
  });
});
