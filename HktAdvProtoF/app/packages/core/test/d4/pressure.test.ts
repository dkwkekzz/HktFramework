// D4-c 압력 — 원문 식 하나가 세계와 목적을 잇는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import {
  atTick,
  evaluatePressure,
  failureRisk,
  FULFILLMENT_LEVELS,
  LEVEL_LABELS,
  levelOf,
  pressureVerdict,
  snapshotOf,
  trendOf,
  withSlot,
  type SlotValue,
  type WorldSnapshot,
} from '../../src/d4/index.ts';

import { baseGraphOf, berryId, denId, plain } from '../d3/fixture.ts';

const graph = baseGraphOf(plain);
const foodId = graph.nodes.find((node) => node.label === '겨울 열매')?.id ?? '';

const slotsAt = (stock: number): readonly SlotValue[] => [
  { domain: 'biological', path: 'hunger', holderId: plain.id, value: 0.3 },
  { domain: 'biological', path: 'fertility', holderId: plain.id, value: 0.5 },
  { domain: 'economic', path: `stock.${berryId}`, holderId: plain.id, value: stock },
  { domain: 'physical', path: 'region', holderId: plain.id, value: denId },
];
const worldAt = (stock: number, tick = 100): WorldSnapshot =>
  snapshotOf(slotsAt(stock), tick).snapshot;

describe('D4-c 압력 식', () => {
  test('결핍이 0 이면 압력도 0 이다 — 채워진 의존은 목적을 만들지 않는다', () => {
    const report = evaluatePressure(graph, worldAt(10));
    const hunger = report.roots.find((node) => node.label === '주린 몸');
    assert.equal(hunger?.pressure, 0);
    assert.equal(hunger?.level, 'met');
    assert.match(pressureVerdict(report), /전부 채워졌다/);
  });

  test('네 자리가 그대로 남는다 — 곱의 재료를 화면이 다시 셀 수 있다', () => {
    const report = evaluatePressure(graph, worldAt(0));
    const edge = report.edges.find((entry) => entry.to === '겨울 열매');
    assert.notEqual(edge, undefined);
    if (edge === undefined) return;
    assert.equal(edge.strength, 0.9);
    assert.equal(edge.deficit, 1);
    assert.equal(edge.urgency, 0.8);
    assert.equal(
      Number(edge.pressure.toFixed(6)),
      Number((edge.strength * edge.deficit * edge.urgency * edge.failureRisk).toFixed(6)),
    );
  });

  test('시한이 짧을수록 처음부터 위험하다', () => {
    assert.equal(failureRisk(0, 1), 0.5);
    assert.equal(Number(failureRisk(0, 30).toFixed(3)), 0.032);
    assert.equal(failureRisk(30, 30), 1);
    assert.equal(failureRisk(100, 30), 1); // 넘어가도 1 을 넘지 않는다
  });

  test('결핍이 이어질수록 압력이 오른다', () => {
    const since = new Map([[foodId, 100]]);
    const before = evaluatePressure(graph, worldAt(0, 100), { since });
    const later = evaluatePressure(graph, worldAt(0, 115), { since });
    const worst = (report: typeof before): number =>
      report.roots.find((node) => node.label === '주린 몸')?.pressure ?? 0;

    assert.ok(worst(later) > worst(before));
    assert.equal(
      later.edges.find((entry) => entry.to === '겨울 열매')?.unmetTicks,
      15,
    );
  });

  test('5단계는 경계로 갈리고, 0 은 채워졌을 때뿐이다', () => {
    assert.deepEqual([...FULFILLMENT_LEVELS], [
      'met',
      'unstable',
      'deficient',
      'critical',
      'collapsing',
    ]);
    assert.equal(levelOf(0), 'met');
    assert.equal(levelOf(0.0001), 'unstable');
    assert.equal(levelOf(0.1), 'unstable');
    assert.equal(levelOf(0.3), 'deficient');
    assert.equal(levelOf(0.6), 'critical');
    assert.equal(levelOf(0.61), 'collapsing');
    assert.equal(LEVEL_LABELS.collapsing, '붕괴');
  });

  test('노드는 자기를 채우는 기댐 중 가장 급한 것으로 칠해진다', () => {
    const report = evaluatePressure(graph, worldAt(0), { since: new Map([[foodId, 100]]) });
    const hunger = report.nodes.find((node) => node.label === '주린 몸');
    const edge = report.edges.find((entry) => entry.to === '겨울 열매');
    assert.equal(hunger?.pressure, edge?.pressure);
    assert.equal(hunger?.worstEdgeId, edge?.edgeId);
  });

  test('잎 노드는 나가는 기댐이 없으므로 압력을 지지 않는다', () => {
    const report = evaluatePressure(graph, worldAt(0));
    const leaf = report.nodes.find((node) => node.label === '겨울 열매');
    assert.equal(leaf?.pressure, 0);
    assert.equal(leaf?.deficit, 1); // 그러나 자기 자리는 비어 있다
  });
});

describe('D4-c 추이와 결정성', () => {
  test('재고가 줄면 압력이 단조 증가한다 (원문 D4 조건)', () => {
    const since = new Map([[foodId, 112]]);
    const line: readonly WorldSnapshot[] = [
      worldAt(10, 100),
      worldAt(4, 106),
      worldAt(1, 112),
      worldAt(0, 118),
      worldAt(0, 124),
      atTick(worldAt(0, 124), 142),
    ];
    const trend = trendOf(graph, line, '주린 몸', { since });

    assert.deepEqual(
      trend.map((point) => point.level),
      ['met', 'met', 'unstable', 'deficient', 'critical', 'collapsing'],
    );
    for (const [index, point] of trend.entries()) {
      if (index === 0) continue;
      assert.ok(
        point.pressure >= (trend[index - 1] as (typeof trend)[number]).pressure,
        `${String(point.tick)}틱에서 압력이 내려갔다`,
      );
    }
    assert.equal(trend[2]?.driver, '겨울 열매');
  });

  test('같은 세계를 100번 재도 같은 압력이다', () => {
    const first = evaluatePressure(graph, worldAt(0, 130), { since: new Map([[foodId, 100]]) });
    for (let count = 0; count < 100; count += 1) {
      const again = evaluatePressure(graph, worldAt(0, 130), { since: new Map([[foodId, 100]]) });
      assert.equal(again.hash, first.hash);
    }
    assert.equal(stateHash(first.edges), stateHash(first.edges));
  });

  test('세계가 바뀌면 압력도 바뀐다 — 해시가 그것을 증명한다', () => {
    const before = evaluatePressure(graph, worldAt(10, 100));
    const after = evaluatePressure(
      graph,
      withSlot(worldAt(10, 100), {
        domain: 'economic',
        path: `stock.${berryId}`,
        holderId: plain.id,
        value: 0,
      }).snapshot,
    );
    assert.notEqual(before.hash, after.hash);
  });

  test('없는 노드·미래의 결핍은 사유로 남는다', () => {
    const unknown = evaluatePressure(graph, worldAt(0, 100), {
      since: new Map([['dep-node:없는것', 90]]),
    });
    assert.equal(unknown.violations[0]?.rule, 'unknown-node');

    const future = evaluatePressure(graph, worldAt(0, 100), { since: new Map([[foodId, 110]]) });
    assert.equal(future.violations[0]?.rule, 'future-since');
    assert.match(pressureVerdict(future), /압력을 잴 수 없다/);
  });
});
