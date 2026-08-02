// D1-c 그래프 조립 — 점과 선을 한 주체의 의존 그래프로 묶는다.
//
// 노드와 간선이 각각 온전해도 그래프가 온전한 것은 아니다. 여기서 보는 것은 **모양**이다.
//
//   ① 뿌리   그래프는 주체가 무너지는 자리에서 시작한다. 뿌리 없는 그래프는 아무 무너짐과도
//      이어지지 않으므로 이 주체의 의존이 아니다. (뿌리가 실제 Need 와 맞는지는 D2 가 본다 —
//      D1 은 개체를 받지 않는다.)
//   ② 도달   뿌리에서 간선을 따라 닿지 않는 노드는 이 그래프에 있을 이유가 없다. 그런 노드는
//      D4 가 압력을 계산해도 아무 무너짐에도 기여하지 못한다 — 장식이다.
//   ③ 맴돔   A 가 B 에 기대고 B 가 A 에 기대면 압력이 끝나지 않는다. 한 주체의 그래프 안에서는
//      순환을 금지한다. 실제 세계의 맞물림(마을은 사냥꾼에, 사냥꾼은 마을에)은 **주체 사이**의
//      일이고 그것은 D5 가 본다.
//   ④ 한 주체 다른 주체의 노드가 섞이면 이것은 한 주체의 그래프가 아니다.
//
// 그리고 그래프는 해시를 갖는다. 같은 그래프는 어떤 순서로 적혀도 같은 해시가 되어야
// D3 의 변형 diff 와 V1 의 결정성 검사가 성립한다 — 순서는 뜻이 아니다.

import { deterministicId, type Id } from '../v1/id.ts';
import { stateHash } from '../v1/hash.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { kindLabel } from '../d0/index.ts';
import { checkNodes, conditionSummary, type DependencyNode } from './node.ts';
import { checkEdges, type DependencyEdge } from './edge.ts';
import { violateGraph, type GraphViolation } from './violation.ts';

/** 한 주체의 의존 그래프. */
export interface DependencyGraph {
  readonly id: Id;
  /** 누구의 그래프인가 */
  readonly subjectId: Id;
  /** 사람이 읽는 이름 (`몰이꾼 04 의 겨울`) — id 가 여기서 나온다 */
  readonly name: string;
  readonly nodes: readonly DependencyNode[];
  readonly edges: readonly DependencyEdge[];
  /** 주체가 무너지는 자리에 직접 걸린 노드들 — 그래프는 여기서 시작한다 */
  readonly rootIds: readonly Id[];
}

/** 그래프 ID — 같은 주체·같은 이름이면 항상 같다. */
export function graphIdOf(subjectId: Id, name: string): Id {
  return deterministicId('dep-graph', subjectId, name);
}

/** 뿌리에서 간선을 따라 닿는 노드들 (선언 순서 유지, 중복 없음). */
export function reachableFrom(
  rootIds: readonly Id[],
  edges: readonly DependencyEdge[],
): readonly Id[] {
  const out: Id[] = [];
  const queue = [...rootIds];
  while (queue.length > 0) {
    const current = queue.shift() as Id;
    if (out.includes(current)) continue;
    out.push(current);
    for (const edge of edges) {
      if (edge.from === current && !out.includes(edge.to)) queue.push(edge.to);
    }
  }
  return out;
}

/**
 * 맴도는 고리 하나를 찾는다. 없으면 null.
 * 찾은 고리는 노드 id 의 나열(`a → b → a`)로 돌려준다 — 어디를 끊어야 하는지 보이게.
 */
export function findCycle(
  nodes: readonly DependencyNode[],
  edges: readonly DependencyEdge[],
): readonly Id[] | null {
  const visiting = new Set<Id>();
  const done = new Set<Id>();
  const path: Id[] = [];

  const walk = (id: Id): readonly Id[] | null => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      return [...path.slice(start), id];
    }
    if (done.has(id)) return null;
    visiting.add(id);
    path.push(id);
    for (const edge of edges) {
      if (edge.from !== id) continue;
      const found = walk(edge.to);
      if (found !== null) return found;
    }
    path.pop();
    visiting.delete(id);
    done.add(id);
    return null;
  };

  for (const node of nodes) {
    const found = walk(node.id);
    if (found !== null) return found;
  }
  return null;
}

/**
 * 그래프의 해시 — 적은 순서와 무관하게 같은 그래프면 같은 값.
 * D3 의 변형 diff·V1 결정성 검사가 이 값에 기댄다.
 */
export function graphHash(graph: DependencyGraph): string {
  const nodes = stableSort(
    graph.nodes.map(
      (node) =>
        `${node.id}|${node.kind}|${node.target?.id ?? ''}|${conditionSummary(node.condition)}`,
    ),
    compareStrings,
  );
  const edges = stableSort(
    graph.edges.map(
      (edge) =>
        `${edge.from}|${edge.to}|${edge.relation}|${String(edge.strength)}|${String(edge.urgency)}|${String(edge.substitutability)}|${String(edge.failureDelayTicks)}`,
    ),
    compareStrings,
  );
  const roots = stableSort([...graph.rootIds], compareStrings);
  return stateHash({ subjectId: graph.subjectId, nodes, edges, roots });
}

/** 그래프 검사 결과. */
export interface GraphReport {
  readonly graphId: Id;
  readonly nodeCount: number;
  readonly edgeCount: number;
  /** 뿌리에서 닿는 노드들 */
  readonly reachable: readonly Id[];
  /** 뿌리에서 닿지 않는 노드들 */
  readonly unreachable: readonly Id[];
  /** 맴도는 고리 하나 (없으면 null) */
  readonly cycle: readonly Id[] | null;
  readonly violations: readonly GraphViolation[];
  readonly hash: string;
  readonly complete: boolean;
}

/** 그래프가 온전한가. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function checkGraph(
  graph: DependencyGraph,
  schema: StateSchema = STATE_SCHEMA,
): GraphReport {
  const violations: GraphViolation[] = [];
  const nameOf = (id: Id): string => graph.nodes.find((node) => node.id === id)?.label ?? id;

  checkNodes(graph.nodes, violations, '$.nodes', schema);
  checkEdges(graph.edges, graph.nodes, violations, '$.edges', schema);

  for (const [index, node] of graph.nodes.entries()) {
    if (node.subjectId !== graph.subjectId) {
      violateGraph(
        violations,
        node.id,
        node.label,
        'foreign-node',
        `$.nodes[${String(index)}].subjectId`,
        '다른 주체의 노드가 섞였다 — 한 그래프는 한 주체의 것이고, 주체 사이의 맞물림은 D5 가 본다',
      );
    }
  }

  if (graph.rootIds.length === 0) {
    violateGraph(
      violations,
      '',
      '',
      'rootless-graph',
      '$.rootIds',
      '뿌리가 없다 — 아무 무너짐에도 걸리지 않은 그래프는 이 주체의 의존이 아니다',
    );
  }
  for (const [index, rootId] of graph.rootIds.entries()) {
    if (!graph.nodes.some((node) => node.id === rootId)) {
      violateGraph(
        violations,
        rootId,
        rootId,
        'phantom-root',
        `$.rootIds[${String(index)}]`,
        `그래프에 없는 노드를 뿌리로 삼았다 — ${rootId}`,
      );
    }
  }

  const rootsInGraph = graph.rootIds.filter((rootId) =>
    graph.nodes.some((node) => node.id === rootId),
  );
  const reachable = reachableFrom(rootsInGraph, graph.edges);
  const unreachable = graph.nodes
    .filter((node) => !reachable.includes(node.id))
    .map((node) => node.id);
  for (const id of unreachable) {
    violateGraph(
      violations,
      id,
      nameOf(id),
      'unreachable-node',
      '$.nodes',
      `뿌리에서 닿지 않는다 — 아무 무너짐에도 기여하지 못하는 의존은 이 주체의 의존이 아니다 (${kindLabel(graph.nodes.find((node) => node.id === id)?.kind ?? 'resource')})`,
    );
  }

  const cycle = findCycle(graph.nodes, graph.edges);
  if (cycle !== null) {
    violateGraph(
      violations,
      cycle[0] ?? '',
      cycle.map(nameOf).join(' → '),
      'dependency-cycle',
      '$.edges',
      `의존이 맴돈다 — ${cycle.map(nameOf).join(' → ')}. 한 주체 안에서 맴돌면 D4 의 압력이 끝나지 않는다. 주체 사이의 맞물림은 D5 가 본다`,
    );
  }

  if (graph.name === '') {
    violateGraph(
      violations,
      graph.id,
      '',
      'bad-graph',
      '$.name',
      '이름 없는 그래프는 D3 의 변형 대조에서 구별되지 않는다',
    );
  } else if (graph.id !== graphIdOf(graph.subjectId, graph.name)) {
    violateGraph(
      violations,
      graph.id,
      graph.name,
      'bad-graph',
      '$.id',
      `손으로 지은 ID 다 — graphIdOf(주체, 이름) 이 만든 값이어야 한다 (${graphIdOf(graph.subjectId, graph.name)})`,
    );
  }

  return {
    graphId: graph.id,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    reachable,
    unreachable,
    cycle,
    violations,
    hash: graphHash(graph),
    complete: graph.nodes.length > 0 && violations.length === 0,
  };
}

/** 그래프 검사를 한 줄 판정으로 접는다. */
export function graphVerdict(report: GraphReport): string {
  if (report.complete) {
    return `노드 ${String(report.nodeCount)} · 간선 ${String(report.edgeCount)} 이 뿌리에서 모두 닿는다 (해시 ${report.hash.slice(0, 8)})`;
  }
  const reasons: string[] = [];
  if (report.nodeCount === 0) reasons.push('노드가 없다');
  if (report.unreachable.length > 0) {
    reasons.push(`닿지 않는 노드 ${String(report.unreachable.length)}개`);
  }
  if (report.cycle !== null) reasons.push('의존이 맴돈다');
  const rest = [
    ...new Set(
      report.violations
        .filter(
          (violation) =>
            violation.rule !== 'unreachable-node' && violation.rule !== 'dependency-cycle',
        )
        .map((violation) => violation.rule),
    ),
  ];
  reasons.push(...rest);
  return reasons.join(' · ');
}

/**
 * 수치만 달라진 간선 하나 — 더함도 빠짐도 아닌 세 번째 갈림.
 * 같은 두 노드가 같은 관계로 이어져 있는데 강도·급함·시한만 흔들린 경우다 (D3 개인 변형).
 */
export interface EdgeChange {
  readonly id: Id;
  /** [전, 후] — 흔들리지 않았으면 null */
  readonly strength: readonly [number, number] | null;
  readonly urgency: readonly [number, number] | null;
  readonly failureDelayTicks: readonly [number, number] | null;
}

/** 두 그래프의 차이 — D3 가 개인 변형을 보일 때 쓴다. */
export interface GraphDiff {
  readonly addedNodes: readonly Id[];
  readonly removedNodes: readonly Id[];
  readonly addedEdges: readonly Id[];
  readonly removedEdges: readonly Id[];
  /** 양쪽에 다 있으나 수치가 흔들린 간선 */
  readonly changedEdges: readonly EdgeChange[];
  readonly same: boolean;
}

/** 두 수가 다르면 [전, 후], 같으면 null. */
function moved(before: number, after: number): readonly [number, number] | null {
  return before === after ? null : [before, after];
}

/** 기본 그래프 대비 무엇이 더해지고 빠지고 흔들렸는가. */
export function diffGraphs(base: DependencyGraph, next: DependencyGraph): GraphDiff {
  const baseNodes = base.nodes.map((node) => node.id);
  const nextNodes = next.nodes.map((node) => node.id);
  const baseEdges = base.edges.map((edge) => edge.id);
  const nextEdges = next.edges.map((edge) => edge.id);

  const changedEdges: EdgeChange[] = [];
  for (const edge of base.edges) {
    const after = next.edges.find((entry) => entry.id === edge.id);
    if (after === undefined) continue;
    const change: EdgeChange = {
      id: edge.id,
      strength: moved(edge.strength, after.strength),
      urgency: moved(edge.urgency, after.urgency),
      failureDelayTicks: moved(edge.failureDelayTicks, after.failureDelayTicks),
    };
    if (
      change.strength === null &&
      change.urgency === null &&
      change.failureDelayTicks === null
    ) {
      continue;
    }
    changedEdges.push(change);
  }

  return {
    addedNodes: nextNodes.filter((id) => !baseNodes.includes(id)),
    removedNodes: baseNodes.filter((id) => !nextNodes.includes(id)),
    addedEdges: nextEdges.filter((id) => !baseEdges.includes(id)),
    removedEdges: baseEdges.filter((id) => !nextEdges.includes(id)),
    changedEdges,
    same: graphHash(base) === graphHash(next),
  };
}
