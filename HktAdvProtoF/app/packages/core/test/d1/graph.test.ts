// D1-c 단위 테스트 — 뿌리에서 닿지 않는 노드·맴도는 의존·순서에 흔들리는 해시.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  checkGraph,
  diffGraphs,
  edgeIdOf,
  findCycle,
  graphHash,
  graphIdOf,
  graphVerdict,
  nodeIdOf,
  reachableFrom,
  type DependencyEdge,
  type DependencyGraph,
  type DependencyNode,
  type EdgeRelation,
  type NodeCondition,
  type NodeTarget,
} from '../../src/d1/index.ts';

const beaterId = deterministicId('subject', 'person', '몰이꾼 04');
const priestId = deterministicId('subject', 'person', '사제 09');
const meatId = deterministicId('entity', 'material', '말린 고기');
const ravineId = deterministicId('entity', 'place', '붉은 장막 협곡');
const lawId = deterministicId('rule', 'institutional', '고개 통행법');

const slot = (domain: string, path: string, min: number, max: number): NodeCondition => ({
  kind: 'slot',
  slot: { domain: domain as never, path },
  holderId: beaterId,
  band: { kind: 'range', min, max },
});

function node(
  kind: DependencyNode['kind'],
  label: string,
  target: NodeTarget | null,
  condition: NodeCondition,
  subjectId = beaterId,
): DependencyNode {
  return {
    id: nodeIdOf(subjectId, kind, label),
    subjectId,
    kind,
    label,
    target,
    condition,
    note: '겨울을 나려면 필요하다',
  };
}

const hunger = node('body', '주린 몸', {
  ontology: 'State',
  id: deterministicId('state', beaterId, 'biological.hunger'),
  name: '몰이꾼의 허기',
  entityKind: null,
  domain: 'biological',
}, slot('biological', 'hunger', 0, 0.6));

const food = node('resource', '겨울 식량', {
  ontology: 'Entity',
  id: meatId,
  name: '말린 고기',
  entityKind: 'material',
  domain: null,
}, slot('economic', `stock.${meatId}`, 3, 999));

const ground = node('space', '사냥터', {
  ontology: 'Entity',
  id: ravineId,
  name: '붉은 장막 협곡',
  entityKind: 'place',
  domain: null,
}, {
  kind: 'slot',
  slot: { domain: 'physical', path: 'region' },
  holderId: beaterId,
  band: { kind: 'is', value: ravineId },
});

const license = node('institution', '고개 통행권', {
  ontology: 'Rule',
  id: lawId,
  name: '고개 통행법',
  entityKind: null,
  domain: null,
}, {
  kind: 'slot',
  slot: { domain: 'institutional', path: `license.${lawId}` },
  holderId: beaterId,
  band: { kind: 'is', value: true },
});

const cycle = node('time', '장막 주기', null, {
  kind: 'clock',
  everyTicks: 12,
  withinTicks: 3,
});

const effect = {
  slot: { domain: 'biological' as const, path: 'hunger' },
  holderId: beaterId,
  change: { kind: 'delta' as const, by: 12 },
  note: '끊긴 채 사흘이면 허기가 열둘 오른다',
};

function edge(
  from: DependencyNode,
  to: DependencyNode,
  relation: EdgeRelation,
  patch: Partial<DependencyEdge> = {},
): DependencyEdge {
  return {
    id: edgeIdOf(from.id, to.id, relation),
    from: from.id,
    to: to.id,
    relation,
    strength: 0.8,
    urgency: 0.5,
    substitutability: 0,
    failureDelayTicks: 3,
    failureEffects: [effect],
    note: '이것이 끊기면 겨울을 못 난다',
    ...patch,
  };
}

const GRAPH_NAME = '몰이꾼 04 의 겨울';

/** 주린 몸 → 식량 → 사냥터 → 통행권, 그리고 사냥터는 장막 주기에 떠받쳐진다. */
function winterGraph(patch: Partial<DependencyGraph> = {}): DependencyGraph {
  return {
    id: graphIdOf(beaterId, GRAPH_NAME),
    subjectId: beaterId,
    name: GRAPH_NAME,
    nodes: [hunger, food, ground, license, cycle],
    edges: [
      edge(hunger, food, 'consumes', { substitutability: 0.7 }),
      edge(food, ground, 'requires'),
      edge(ground, license, 'authorized_by'),
      edge(ground, cycle, 'sustained_by'),
    ],
    rootIds: [hunger.id],
    ...patch,
  };
}

describe('그래프가 한 주체의 것으로 선다', () => {
  const report = checkGraph(winterGraph());

  test('뿌리 하나에서 다섯 노드가 전부 닿는다', () => {
    assert.equal(report.complete, true);
    assert.deepEqual(report.violations, []);
    assert.deepEqual(report.unreachable, []);
    assert.equal(report.reachable.length, 5);
    assert.equal(report.cycle, null);
  });

  test('판정 한 줄이 크기와 해시를 말한다', () => {
    assert.match(graphVerdict(report), /노드 5 · 간선 4 이 뿌리에서 모두 닿는다/);
  });

  test('도달은 간선 방향을 따른다 — 거꾸로는 닿지 않는다', () => {
    const graph = winterGraph();
    assert.deepEqual(reachableFrom([license.id], graph.edges), [license.id]);
    assert.equal(reachableFrom([hunger.id], graph.edges).length, 5);
  });

  test('같은 그래프는 적은 순서와 무관하게 같은 해시다', () => {
    const forward = winterGraph();
    const shuffled = winterGraph({
      nodes: [...forward.nodes].reverse(),
      edges: [...forward.edges].reverse(),
    });
    assert.equal(graphHash(forward), graphHash(shuffled));
    assert.equal(checkGraph(shuffled).complete, true);
  });

  test('수치 하나만 달라도 다른 그래프가 된다', () => {
    const forward = winterGraph();
    const weaker = winterGraph({
      edges: forward.edges.map((entry, index) =>
        index === 0 ? { ...entry, strength: 0.2 } : entry,
      ),
    });
    assert.notEqual(graphHash(forward), graphHash(weaker));
  });

  test('해시는 결정적이다 — 100번 물어도 하나다', () => {
    const hashes = new Set(Array.from({ length: 100 }, () => graphHash(winterGraph())));
    assert.equal(hashes.size, 1);
  });
});

describe('설 수 없는 그래프는 사유와 함께 거부된다', () => {
  test('뿌리가 없으면 아무 무너짐에도 걸리지 않은 그래프다', () => {
    const report = checkGraph(winterGraph({ rootIds: [] }));
    assert.equal(report.complete, false);
    assert.equal(report.violations[0]?.rule, 'rootless-graph');
    // 뿌리가 없으면 다섯 전부 닿지 않는다
    assert.equal(report.unreachable.length, 5);
  });

  test('그래프에 없는 노드를 뿌리로 삼으면 걸린다', () => {
    const report = checkGraph(winterGraph({ rootIds: ['dep-node:000000000000'] }));
    assert.equal(report.violations[0]?.rule, 'phantom-root');
  });

  test('뿌리에서 닿지 않는 노드는 이 주체의 의존이 아니다', () => {
    const base = winterGraph();
    const report = checkGraph(
      winterGraph({ edges: base.edges.filter((entry) => entry.to !== license.id) }),
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.unreachable, [license.id]);
    assert.equal(report.violations[0]?.rule, 'unreachable-node');
    assert.match(report.violations[0]?.message ?? '', /아무 무너짐에도 기여하지 못하는/);
    assert.match(graphVerdict(report), /닿지 않는 노드 1개/);
  });

  test('의존이 맴돌면 어디를 끊어야 하는지 나온다', () => {
    const base = winterGraph();
    const report = checkGraph(
      winterGraph({ edges: [...base.edges, edge(license, hunger, 'requires')] }),
    );
    assert.equal(report.complete, false);
    assert.notEqual(report.cycle, null);
    const looping = report.violations.find((entry) => entry.rule === 'dependency-cycle');
    assert.match(looping?.message ?? '', /주린 몸 → 겨울 식량 → 사냥터 → 고개 통행권 → 주린 몸/);
    assert.match(looping?.message ?? '', /주체 사이의 맞물림은 D5 가 본다/);
  });

  test('맴돔 찾기는 고리가 없으면 null 이다', () => {
    const graph = winterGraph();
    assert.equal(findCycle(graph.nodes, graph.edges), null);
  });

  test('다른 주체의 노드가 섞이면 걸린다', () => {
    const stranger = node('resource', '사제의 제물', null, slot('economic', `stock.${meatId}`, 1, 9), priestId);
    const base = winterGraph();
    const report = checkGraph(
      winterGraph({
        nodes: [...base.nodes, stranger],
        edges: [...base.edges, edge(hunger, stranger, 'requires')],
      }),
    );
    assert.equal(report.violations.some((entry) => entry.rule === 'foreign-node'), true);
  });

  test('이름 없는 그래프와 손으로 지은 ID 는 각각 걸린다', () => {
    assert.equal(
      checkGraph(winterGraph({ name: '', id: graphIdOf(beaterId, '') })).violations.some(
        (entry) => entry.rule === 'bad-graph',
      ),
      true,
    );
    const forged = checkGraph(winterGraph({ id: 'dep-graph:0000' }));
    assert.match(
      forged.violations.find((entry) => entry.rule === 'bad-graph')?.message ?? '',
      /손으로 지은 ID/,
    );
  });

  test('빈 그래프는 노드가 없다고 말한다', () => {
    const report = checkGraph(winterGraph({ nodes: [], edges: [], rootIds: [] }));
    assert.equal(report.complete, false);
    assert.match(graphVerdict(report), /노드가 없다/);
  });

  test('노드·간선의 결함이 그래프 검사에 그대로 실린다', () => {
    const base = winterGraph();
    const report = checkGraph(
      winterGraph({
        edges: base.edges.map((entry, index) =>
          index === 0 ? { ...entry, failureEffects: [] } : entry,
        ),
      }),
    );
    assert.equal(report.violations[0]?.rule, 'traceless-failure');
  });
});

describe('그래프 diff — D3 가 쓸 자리', () => {
  test('같은 그래프면 차이가 없다', () => {
    const diff = diffGraphs(winterGraph(), winterGraph());
    assert.equal(diff.same, true);
    assert.deepEqual(diff.addedNodes, []);
    assert.deepEqual(diff.removedNodes, []);
  });

  test('노드를 하나 빼면 빠진 것으로 잡힌다', () => {
    const base = winterGraph();
    const thinner = winterGraph({
      nodes: base.nodes.filter((entry) => entry.id !== cycle.id),
      edges: base.edges.filter((entry) => entry.to !== cycle.id),
    });
    const diff = diffGraphs(base, thinner);
    assert.deepEqual(diff.removedNodes, [cycle.id]);
    assert.equal(diff.removedEdges.length, 1);
    assert.equal(diff.same, false);
  });
});
