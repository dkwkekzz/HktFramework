// D4-a 세계 스냅샷 — 개체가 지고 온 값과 세계의 자리가 O2 트리 하나로 모인다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { countSlots } from '../../src/o2/index.ts';
import {
  atTick,
  slotsFromResidue,
  snapshotHash,
  snapshotOf,
  snapshotSummary,
  stateOf,
  valueAt,
  valueForNode,
  withSlot,
  type SlotValue,
} from '../../src/d4/index.ts';

import { baseGraphOf, berryId, plain } from '../d3/fixture.ts';

const subjectId = plain.id;
const slots: readonly SlotValue[] = [
  { domain: 'biological', path: 'hunger', holderId: subjectId, value: 0.3 },
  { domain: 'economic', path: `stock.${berryId}`, holderId: subjectId, value: 10 },
];

describe('D4-a 세계 모으기', () => {
  test('값 선언이 O2 트리로 서고 자리마다 읽힌다', () => {
    const { snapshot, violations, slotCount } = snapshotOf(slots, 100);
    assert.deepEqual(violations, []);
    assert.equal(slotCount, 2);
    assert.equal(snapshot.tick, 100);
    assert.equal(valueAt(snapshot, 'biological', subjectId, 'hunger'), 0.3);
    assert.equal(valueAt(snapshot, 'economic', subjectId, `stock.${berryId}`), 10);
    assert.equal(valueAt(snapshot, 'biological', subjectId, 'vitality'), null);
  });

  test('State 의 ID 는 유래에서 나온다 — 손으로 적지 않는다', () => {
    const state = stateOf(slots[0] as SlotValue);
    assert.equal(state.kind, 'State');
    assert.equal(state.ofId, subjectId);
    assert.equal(state.path, 'hunger');
    assert.equal(stateOf(slots[0] as SlotValue).id, state.id);
  });

  test('개체가 지고 온 값이 세계의 첫 값이 된다', () => {
    const carried = slotsFromResidue([
      {
        slot: { domain: 'relational', path: `debt.${subjectId}` },
        holderId: subjectId,
        value: 40,
      },
    ]);
    const { snapshot, violations } = snapshotOf(carried, 100);
    assert.deepEqual(violations, []);
    assert.equal(valueAt(snapshot, 'relational', subjectId, `debt.${subjectId}`), 40);
  });

  test('스키마를 어긴 값은 세계에 들어가지 않고 사유로 남는다', () => {
    const { snapshot, violations } = snapshotOf(
      [...slots, { domain: 'biological', path: 'despair', holderId: subjectId, value: 1 }],
      100,
    );
    assert.equal(violations[0]?.rule, 'bad-state');
    assert.equal(countSlots(snapshot.world), 2); // 나머지 둘은 그대로 선다
  });

  test('같은 자리에 값이 둘이면 뒤엣것이 막힌다 — O0 state-exclusion', () => {
    const { snapshot, violations } = snapshotOf(
      [...slots, { domain: 'biological', path: 'hunger', holderId: subjectId, value: 0.9 }],
      100,
    );
    assert.equal(violations[0]?.rule, 'duplicate-state');
    assert.equal(valueAt(snapshot, 'biological', subjectId, 'hunger'), 0.3);
  });

  test('지금이 틱이 아니면 세계가 서지 않는다', () => {
    const negative = snapshotOf(slots, -1);
    assert.equal(negative.violations[0]?.rule, 'bad-tick');
    assert.equal(negative.slotCount, 0);
    assert.equal(snapshotOf(slots, 1.5).violations[0]?.rule, 'bad-tick');
  });

  test('값 하나를 바꾼 세계는 나머지를 그대로 두고 선다', () => {
    const first = snapshotOf(slots, 100).snapshot;
    const next = withSlot(
      first,
      { domain: 'economic', path: `stock.${berryId}`, holderId: subjectId, value: 2 },
      103,
    );
    assert.deepEqual(next.violations, []);
    assert.equal(valueAt(next.snapshot, 'economic', subjectId, `stock.${berryId}`), 2);
    assert.equal(valueAt(next.snapshot, 'biological', subjectId, 'hunger'), 0.3);
    assert.equal(next.snapshot.tick, 103);
  });

  test('시간만 흐르면 값은 그대로다 — 값을 바꾸는 것은 사건의 몫이다', () => {
    const first = snapshotOf(slots, 100).snapshot;
    const later = atTick(first, 130);
    assert.equal(later.tick, 130);
    assert.notEqual(snapshotHash(first), snapshotHash(later));
    assert.equal(countSlots(later.world), countSlots(first.world));
  });

  test('같은 틱·같은 값이면 같은 해시다', () => {
    const once = snapshotOf(slots, 100).snapshot;
    const twice = snapshotOf([...slots].reverse(), 100).snapshot;
    assert.equal(snapshotHash(once), snapshotHash(twice));
    assert.match(snapshotSummary(once), /100틱 · 자리 2개/);
  });

  test('노드의 조건이 가리키는 값을 읽는다 — 시계 조건은 읽을 값이 없다', () => {
    const graph = baseGraphOf(plain);
    const { snapshot } = snapshotOf(slots, 100);
    const food = graph.nodes.find((node) => node.label === '겨울 열매');
    assert.equal(valueForNode(snapshot, food as never), 10);
  });
});
