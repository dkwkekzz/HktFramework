// E0-b 단위 테스트 — 둘 이상 걸린 자리만 상황이 되고, 겹쳤다고 서로를 아는 것은 아니다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { assembleWorld, emptyWorld, type WorldState } from '../../src/o2/index.ts';
import {
  awarenessOf,
  clusterStakes,
  pairIdOf,
  pairLine,
  pairsFor,
  situationIdOf,
  situationLine,
  type SituationStake,
} from '../../src/e0/index.ts';

const aId = deterministicId('subject', 'person', '몰이꾼 04');
const bId = deterministicId('subject', 'person', '상단 11');
const cId = deterministicId('subject', 'person', '사제 02');
const meatId = deterministicId('entity', 'thing', '말린 고기');

const stakeOf = (overrides: Partial<SituationStake>): SituationStake => ({
  id: deterministicId('stake', String(overrides.subjectId ?? aId), String(overrides.key ?? 'k')),
  subjectId: aId,
  axis: 'target',
  key: meatId,
  label: '말린 고기',
  via: 'intent',
  sourceId: 'affordance:x',
  urgency: 0.5,
  aimed: false,
  note: '',
  ...overrides,
});

/** 겨눔 하나 — A 가 B 를 겨눈다 (사람 축). 겨눔당하는 B 자신도 그 자리에 선다 (E0-a). */
const aimStakes = (fromId: string, toId: string, urgency = 0.5): readonly SituationStake[] => [
  stakeOf({
    id: deterministicId('stake', fromId, 'subject', toId),
    subjectId: fromId,
    axis: 'subject',
    key: toId,
    label: toId,
    aimed: true,
    urgency,
  }),
  stakeOf({
    id: deterministicId('stake', toId, 'subject', toId),
    subjectId: toId,
    axis: 'subject',
    key: toId,
    label: toId,
    aimed: false,
    urgency: 0,
  }),
];

/** 서로의 사이가 적힌 세계 — R6 `knownCounterparts` 가 "안다" 로 읽는 재료다. */
function worldWhere(pairs: readonly (readonly [string, string])[]): WorldState {
  if (pairs.length === 0) return emptyWorld();
  return assembleWorld(
    pairs.map(([holderId, otherId], index) => ({
      kind: 'State' as const,
      id: `state:${String(index)}`,
      domain: 'relational' as const,
      ofId: holderId,
      path: `grudge.${otherId}`,
      value: 0.4,
    })),
  ).world;
}

describe('E0-b 혼자 걸린 자리는 상황이 아니다', () => {
  test('하나뿐인 걸림은 상황이 되지 않고 사실로 남는다', () => {
    const result = clusterStakes({ stakes: [stakeOf({})] });
    assert.equal(result.situations.length, 0);
    assert.equal(result.solitudes.length, 1);
    assert.equal(result.solitudes[0]?.subjectId, aId);
  });

  test('같은 자리에 둘이 걸리면 상황이 선다', () => {
    const result = clusterStakes({
      stakes: [stakeOf({ subjectId: aId }), stakeOf({ subjectId: bId })],
    });
    assert.equal(result.situations.length, 1);
    assert.deepEqual(result.situations[0]?.participants, [aId, bId].sort());
    assert.equal(result.solitudes.length, 0);
  });

  test('한 주체가 같은 자리에 두 번 걸려도 상황이 되지 않는다 — 자기와 다투는 것은 상황이 아니다', () => {
    const result = clusterStakes({
      stakes: [
        stakeOf({ subjectId: aId, sourceId: 'a' }),
        stakeOf({ subjectId: aId, id: 'stake:other', sourceId: 'b' }),
      ],
    });
    assert.equal(result.situations.length, 0);
    assert.equal(result.solitudes.length, 1);
  });

  test('축이 다르면 같은 문자라도 다른 자리다', () => {
    const result = clusterStakes({
      stakes: [
        stakeOf({ subjectId: aId, axis: 'target', key: meatId }),
        stakeOf({ subjectId: bId, axis: 'goal', key: meatId, id: 'stake:g' }),
      ],
    });
    assert.equal(result.situations.length, 0);
    assert.equal(result.solitudes.length, 2);
  });

  test('빈 재료는 빈 결과다', () => {
    assert.deepEqual(clusterStakes({ stakes: [] }), { situations: [], solitudes: [] });
  });
});

describe('E0-b 겨눔이 셋으로 갈린다', () => {
  test('서로 겨누면 알아본 쌍이다', () => {
    const result = clusterStakes({
      stakes: [...aimStakes(aId, bId), ...aimStakes(bId, aId)],
      world: worldWhere([
        [aId, bId],
        [bId, aId],
      ]),
    });
    // 사람 축의 자리는 겨눔당한 자마다 하나씩이므로 상황이 둘 선다.
    const pairs = result.situations.flatMap((situation) => situation.pairs);
    assert.ok(pairs.length > 0);
    assert.ok(pairs.every((pair) => pair.aim === 'mutual'));
    assert.ok(pairs.every((pair) => !pair.ambush));
  });

  test('한쪽만 겨누면 한쪽 겨눔이고, 상대가 그를 모르면 매복이다', () => {
    // 둘이 같은 고기를 놓고 걸렸고, A 만 B 를 겨눈다. B 는 A 를 모른다.
    const result = clusterStakes({
      stakes: [
        stakeOf({ subjectId: aId }),
        stakeOf({ subjectId: bId, id: 'stake:b' }),
        ...aimStakes(aId, bId),
      ],
      world: worldWhere([[aId, bId]]),
    });
    const meat = result.situations.find((situation) => situation.axis === 'target');
    const pair = meat?.pairs[0];
    assert.equal(pair?.aim, 'one-sided');
    assert.deepEqual(pair?.aimerIds, [aId < bId ? aId : bId].filter((id) => id === aId));
    assert.equal(pair?.ambush, true);
    assert.equal(pair?.awareness, 'one-way');
  });

  test('상대도 그를 알면 매복이 아니다 — 겨눔은 같은데 값이 갈린다', () => {
    const stakes = [
      stakeOf({ subjectId: aId }),
      stakeOf({ subjectId: bId, id: 'stake:b' }),
      ...aimStakes(aId, bId),
    ];
    const blind = clusterStakes({ stakes, world: worldWhere([[aId, bId]]) });
    const seen = clusterStakes({
      stakes,
      world: worldWhere([
        [aId, bId],
        [bId, aId],
      ]),
    });
    const ambushOf = (result: ReturnType<typeof clusterStakes>): boolean =>
      result.situations.find((situation) => situation.axis === 'target')?.pairs[0]?.ambush ?? false;
    assert.equal(ambushOf(blind), true);
    assert.equal(ambushOf(seen), false);
  });

  test('아무도 겨누지 않으면 눈먼 쌍이다 — D5 가 멈춘 자리', () => {
    const result = clusterStakes({
      stakes: [stakeOf({ subjectId: aId }), stakeOf({ subjectId: bId, id: 'stake:b' })],
    });
    const pair = result.situations[0]?.pairs[0];
    assert.equal(pair?.aim, 'blind');
    assert.equal(pair?.awareness, 'neither');
    assert.equal(pair?.ambush, false);
  });

  test('셋이 걸리면 쌍은 셋이다', () => {
    const result = clusterStakes({
      stakes: [
        stakeOf({ subjectId: aId }),
        stakeOf({ subjectId: bId, id: 'stake:b' }),
        stakeOf({ subjectId: cId, id: 'stake:c' }),
      ],
    });
    assert.equal(result.situations[0]?.pairs.length, 3);
    assert.equal(result.situations[0]?.participants.length, 3);
  });
});

describe('E0-b 상황이 지는 값', () => {
  test('급함은 걸림이 진 값의 최대다 — E0 는 다시 재지 않는다', () => {
    const result = clusterStakes({
      stakes: [
        stakeOf({ subjectId: aId, urgency: 0.3 }),
        stakeOf({ subjectId: bId, id: 'stake:b', urgency: 0.9 }),
      ],
    });
    assert.equal(result.situations[0]?.urgency, 0.9);
  });

  test('상황은 급한 순으로 서고 순서는 결정적이다', () => {
    const stakes = [
      stakeOf({ subjectId: aId, key: 'low', urgency: 0.2, id: 'stake:1' }),
      stakeOf({ subjectId: bId, key: 'low', urgency: 0.2, id: 'stake:2' }),
      stakeOf({ subjectId: aId, key: 'high', urgency: 0.8, id: 'stake:3' }),
      stakeOf({ subjectId: bId, key: 'high', urgency: 0.8, id: 'stake:4' }),
    ];
    const first = clusterStakes({ stakes });
    const again = clusterStakes({ stakes });
    assert.deepEqual(first, again);
    assert.deepEqual(
      first.situations.map((situation) => situation.key),
      ['high', 'low'],
    );
  });

  test('같은 자리는 같은 id 를 낸다 (V1 결정적 ID)', () => {
    assert.equal(situationIdOf('target', meatId), situationIdOf('target', meatId));
    assert.notEqual(situationIdOf('target', meatId), situationIdOf('goal', meatId));
  });

  test('쌍의 id 는 순서를 타지 않는다', () => {
    assert.equal(pairIdOf('situation:x', aId, bId), pairIdOf('situation:x', bId, aId));
  });

  test('그 주체가 낀 쌍만 골라진다', () => {
    const result = clusterStakes({
      stakes: [
        stakeOf({ subjectId: aId }),
        stakeOf({ subjectId: bId, id: 'stake:b' }),
        stakeOf({ subjectId: cId, id: 'stake:c' }),
      ],
    });
    const situation = result.situations[0];
    assert.ok(situation !== undefined);
    assert.equal(pairsFor(situation, aId).length, 2);
  });

  test('사람이 읽는 한 줄이 난다', () => {
    const result = clusterStakes({
      stakes: [stakeOf({ subjectId: aId }), stakeOf({ subjectId: bId, id: 'stake:b' })],
    });
    const situation = result.situations[0];
    assert.ok(situation !== undefined);
    assert.match(situationLine(situation), /매복/);
    assert.match(pairLine(situation.pairs[0] as never), /겨/);
  });

  test('앎 둘을 접는 이름은 셋이다', () => {
    assert.equal(awarenessOf(true, true), 'both');
    assert.equal(awarenessOf(true, false), 'one-way');
    assert.equal(awarenessOf(false, false), 'neither');
  });
});
