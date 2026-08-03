// R0-b 단위 테스트 — 원장 위에서 시간을 가로질러 읽는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { slotStateId, type StateDomain } from '../../src/o2/index.ts';
import {
  causedBy,
  commitAll,
  currentSnapshot,
  diffBetween,
  genesisCause,
  historyLine,
  historyOf,
  openStore,
  readAt,
  worldSlotText,
  slotCountAt,
  snapshotAt,
  type WorldSlotRef,
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

const worldStates = (stock: number, vitality = 0.8): readonly State[] => [
  slot('biological', hunterId, 'hunger', 0.3),
  slot('biological', hunterId, 'vitality', vitality),
  slot('economic', hunterId, `stock.${meatId}`, stock),
];

const stockRef: WorldSlotRef = { domain: 'economic', ofId: hunterId, path: `stock.${meatId}` };
const hungerRef: WorldSlotRef = { domain: 'biological', ofId: hunterId, path: 'hunger' };

/** 재고가 10 → 8 → 6 으로 줄어드는 원장 (틱 400 · 403 · 406). */
const ledger = (): WorldStateStore =>
  commitAll(openStore(), [
    { tick: 400, states: worldStates(10), cause: genesisCause() },
    { tick: 403, states: worldStates(8), cause: causedBy('사흘치를 먹었다') },
    { tick: 406, states: worldStates(6), cause: causedBy('사흘치를 먹었다') },
  ]).store;

describe('R0-b 그때의 세계', () => {
  test('칸이 있는 틱은 그 칸이 답이다', () => {
    const query = snapshotAt(ledger(), 403);
    assert.equal(query.reason, 'found');
    assert.equal(query.snapshot?.tick, 403);
    assert.match(query.note, /틱 403 의 세계다/);
  });

  test('칸이 없는 틱은 그때까지 유효했던 칸이 답이다 — 세계는 다음 변화까지 그대로 있다', () => {
    const query = snapshotAt(ledger(), 405);
    assert.equal(query.reason, 'found');
    assert.equal(query.snapshot?.tick, 403);
    assert.match(query.note, /달라진 것이 없다/);
  });

  test('마지막 칸보다 뒤를 물어도 지금의 세계가 선다', () => {
    const store = ledger();
    assert.equal(snapshotAt(store, 9999).snapshot?.tick, 406);
    assert.equal(currentSnapshot(store)?.tick, 406);
  });

  test('세계가 서기 전은 던지지 않고 사유로 답한다', () => {
    const query = snapshotAt(ledger(), 399);
    assert.equal(query.reason, 'before-genesis');
    assert.equal(query.snapshot, null);
    assert.match(query.note, /물을 자리가 없다/);
  });

  test('빈 원장은 빈 원장이라고 답한다', () => {
    const query = snapshotAt(openStore(), 400);
    assert.equal(query.reason, 'empty-store');
    assert.equal(query.snapshot, null);
  });
});

describe('R0-b 그때 그 자리', () => {
  test('물은 틱과 답한 틱이 다를 수 있다', () => {
    const reading = readAt(ledger(), 405, stockRef);
    assert.equal(reading.value, 8);
    assert.equal(reading.askedTick, 405);
    assert.equal(reading.asOfTick, 403);
  });

  test('세계에 없는 자리는 값이 아니라 사유로 답한다', () => {
    const reading = readAt(ledger(), 406, {
      domain: 'economic',
      ofId: hunterId,
      path: 'stock.없는것',
    });
    assert.equal(reading.value, null);
    assert.equal(reading.reason, 'found');
    assert.match(reading.note, /없는 자리다/);
  });

  test('세계가 서기 전의 자리는 사유가 다르다 — 값이 없는 것과 물을 자리가 없는 것은 다르다', () => {
    const reading = readAt(ledger(), 399, stockRef);
    assert.equal(reading.value, null);
    assert.equal(reading.asOfTick, null);
    assert.equal(reading.reason, 'before-genesis');
  });

  test('자리 이름은 O2 와 같은 모양이다', () => {
    assert.equal(worldSlotText(stockRef), `economic.${hunterId}.stock.${meatId}`);
    assert.equal(slotCountAt(ledger(), 406), 3);
    assert.equal(slotCountAt(openStore(), 406), 0);
  });
});

describe('R0-b 자리의 역사', () => {
  test('값이 바뀐 칸만 역사에 남는다', () => {
    const history = historyOf(ledger(), stockRef);
    assert.deepEqual(
      history.map((entry) => [entry.tick, entry.before, entry.after]),
      [
        [400, null, 10],
        [403, 10, 8],
        [406, 8, 6],
      ],
    );
    assert.deepEqual(history.map((entry) => entry.change), ['added', 'changed', 'changed']);
  });

  test('한 번도 바뀌지 않은 자리는 처음 선 한 줄뿐이다', () => {
    const history = historyOf(ledger(), hungerRef);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.tick, 400);
    assert.equal(history[0]?.change, 'added');
  });

  test('역사에는 그 변화를 담은 커밋의 까닭이 함께 남는다', () => {
    const history = historyOf(ledger(), stockRef);
    assert.equal(history[1]?.cause, '사흘치를 먹었다');
    assert.equal(historyLine(history[0] as (typeof history)[number]), '틱 400 · 없음 → 10 (세계가 처음 선다)');
  });

  test('세계에 없는 자리의 역사는 비어 있다 — 던지지 않는다', () => {
    assert.deepEqual(historyOf(ledger(), { domain: 'psychic', ofId: hunterId, path: 'energy' }), []);
  });
});

describe('R0-b 두 틱 사이', () => {
  test('차이는 O2 가 세고 R0 은 어느 칸과 어느 칸인지만 고른다', () => {
    const diff = diffBetween(ledger(), 400, 406);
    assert.equal(diff.steps, 2);
    assert.equal(diff.entries.length, 1);
    assert.equal(diff.entries[0]?.before, 10);
    assert.equal(diff.entries[0]?.after, 6);
    assert.match(diff.note, /칸 2개를 지나며 자리 1곳이 달라졌다/);
  });

  test('같은 칸을 두 번 물으면 차이가 없다', () => {
    const diff = diffBetween(ledger(), 403, 405);
    assert.equal(diff.steps, 0);
    assert.deepEqual(diff.entries, []);
    assert.match(diff.note, /같은 칸이다/);
  });

  test('자리가 생기고 사라지는 것도 차이로 선다', () => {
    const store = commitAll(openStore(), [
      { tick: 400, states: worldStates(10), cause: genesisCause() },
      {
        tick: 403,
        states: [...worldStates(10), slot('psychic', hunterId, 'energy', 200)],
        cause: causedBy('의념이 깨어났다'),
      },
    ]).store;
    const diff = diffBetween(store, 400, 403);
    assert.equal(diff.entries.length, 1);
    assert.equal(diff.entries[0]?.change, 'added');
    assert.equal(diff.entries[0]?.after, 200);
  });

  test('세계가 서기 전을 한쪽에 두면 사유가 온다', () => {
    const diff = diffBetween(ledger(), 399, 406);
    assert.equal(diff.from, null);
    assert.deepEqual(diff.entries, []);
    assert.match(diff.note, /물을 자리가 없다/);
  });
});
