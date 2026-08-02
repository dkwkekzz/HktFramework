// D4-c 압력 — 원문이 준 식 하나가 세계와 목적을 잇는다.
//
//   Pressure = Strength × Deficit × Urgency × FailureRisk
//
// 네 자리 중 셋은 이미 그래프에 있다. 강도와 급함은 간선이 지고 있고(D1·D2·D3), 결핍은
// D4-b 가 세계에서 읽었다. 남은 하나가 **FailureRisk** 이고, 그것이 시간을 들여온다:
//
//   FailureRisk = (1 + 결핍이 이어진 틱) ÷ (끊김까지의 시한 + 1)
//
// 이 모양을 고른 까닭은 둘이다. ① 결핍이 시작된 순간에도 0 이 아니다 — 비어 있는 것은 언제나
// 조금은 위험하다. ② 같은 결핍이라도 **시한이 짧을수록 처음부터 위험하다** — 체력(1틱)이 비면
// 첫 틱부터 0.5 이고, 허기(30틱)가 비면 0.03 에서 시작해 서른 틱에 걸쳐 1 로 오른다.
// 하나의 수가 "무엇이 먼저 급한가" 를 정한다.
//
// 압력은 **간선의 것**이다. 기댐 하나하나가 압력을 지고, 노드는 자기에게서 나가는 기댐 중 가장
// 큰 것으로 칠해진다 — 한 사람의 굶주림이 얼마나 급한가는 그를 채우는 것들 중 가장 빈 것이 정한다.
//
// 그리고 원문이 건 조건이 여기서 성립한다: **식량이 충분하면 압력이 0 이다.** 결핍이 0 이면 곱이
// 0 이므로, 채워진 의존은 아무 목적도 만들지 않는다 (P 계층은 압력에서만 목적을 낸다).

import type { Id } from '../v1/id.ts';
import { stateHash } from '../v1/hash.ts';
import type { Tick } from '../v1/tick.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import type { DependencyEdge, DependencyGraph } from '../d1/index.ts';
import { readDeficit, type DeficitReading } from './deficit.ts';
import { snapshotHash, type WorldSnapshot } from './snapshot.ts';
import { violatePressure, type PressureViolation } from './violation.ts';

/** 충족 5단계 (원문 D4 출력). */
export const FULFILLMENT_LEVELS = [
  'met', // 충족
  'unstable', // 불안정
  'deficient', // 결핍
  'critical', // 위기
  'collapsing', // 붕괴
] as const;
export type FulfillmentLevel = (typeof FULFILLMENT_LEVELS)[number];

/** 단계의 한국어 이름. */
export const LEVEL_LABELS: Readonly<Record<FulfillmentLevel, string>> = {
  met: '충족',
  unstable: '불안정',
  deficient: '결핍',
  critical: '위기',
  collapsing: '붕괴',
};

/**
 * 단계의 경계 — 압력이 이 값을 넘으면 다음 단계다.
 * 결핍이 0 이면 압력도 0 이고, 그때만 '충족' 이다 (0 은 경계가 아니라 상태다).
 */
export const LEVEL_THRESHOLDS: Readonly<Record<Exclude<FulfillmentLevel, 'collapsing'>, number>> = {
  met: 0,
  unstable: 0.1,
  deficient: 0.3,
  critical: 0.6,
};

/** 압력 하나를 5단계로 판정한다. */
export function levelOf(pressure: number): FulfillmentLevel {
  if (pressure <= LEVEL_THRESHOLDS.met) return 'met';
  if (pressure <= LEVEL_THRESHOLDS.unstable) return 'unstable';
  if (pressure <= LEVEL_THRESHOLDS.deficient) return 'deficient';
  if (pressure <= LEVEL_THRESHOLDS.critical) return 'critical';
  return 'collapsing';
}

/** 결핍이 이어진 틱에서 끊김의 위험을 낸다 — 시한이 짧을수록 처음부터 크다. */
export function failureRisk(unmetTicks: number, failureDelayTicks: number): number {
  const delay = Math.max(1, failureDelayTicks);
  const elapsed = Math.max(0, unmetTicks);
  return Math.min(1, (1 + elapsed) / (delay + 1));
}

/** 압력을 잴 때의 곁가지 — 지금이 몇 틱이고, 어느 자리가 언제부터 비었는가. */
export interface PressureContext {
  /** 결핍이 시작된 시각 (노드 ID → 틱). 적지 않으면 방금 비었다고 본다 */
  readonly since?: ReadonlyMap<Id, Tick>;
  readonly schema?: StateSchema;
}

/** 기댐 하나의 압력 — 원문 식의 네 자리가 그대로 남는다. */
export interface EdgePressure {
  readonly edgeId: Id;
  /** 누가 무엇에 기대는가 */
  readonly from: string;
  readonly to: string;
  readonly relation: DependencyEdge['relation'];
  readonly strength: number;
  readonly deficit: number;
  readonly urgency: number;
  readonly failureRisk: number;
  /** 결핍이 이어진 틱 */
  readonly unmetTicks: number;
  readonly failureDelayTicks: number;
  readonly pressure: number;
  readonly level: FulfillmentLevel;
}

/** 노드 하나의 압력 — 자기에게서 나가는 기댐 중 가장 큰 것. */
export interface NodePressure {
  readonly nodeId: Id;
  readonly label: string;
  readonly isRoot: boolean;
  /** 이 노드 자신의 자리가 얼마나 비었는가 */
  readonly deficit: number;
  /** 이 노드를 채우는 기댐들 중 최대 압력 */
  readonly pressure: number;
  readonly level: FulfillmentLevel;
  /** 무엇이 가장 급한가 */
  readonly worstEdgeId: Id | null;
}

/** 압력 보고 — 원문 D4 의 출력. */
export interface PressureReport {
  readonly subjectId: Id;
  readonly tick: Tick;
  readonly readings: readonly DeficitReading[];
  readonly edges: readonly EdgePressure[];
  readonly nodes: readonly NodePressure[];
  /** 뿌리들 — 지금 무엇이 가장 급한가는 여기서 읽는다 */
  readonly roots: readonly NodePressure[];
  /** 가장 큰 압력 */
  readonly peak: number;
  readonly peakLevel: FulfillmentLevel;
  readonly violations: readonly PressureViolation[];
  readonly hash: string;
}

/**
 * 지금 세계에서 이 그래프의 압력을 잰다.
 * 던지지 않는다 — 읽을 수 없는 조건은 사유로 남고, 그 노드는 완전히 빈 것으로 읽힌다.
 */
export function evaluatePressure(
  graph: DependencyGraph,
  snapshot: WorldSnapshot,
  context: PressureContext = {},
): PressureReport {
  const schema = context.schema ?? STATE_SCHEMA;
  const since = context.since ?? new Map<Id, Tick>();
  const violations: PressureViolation[] = [];
  const readings = graph.nodes.map((node) => readDeficit(node, snapshot, violations, schema));

  // 결핍이 시작된 시각을 적을 수 있는 것은 **지금 비어 있는 자리**뿐이다.
  // 아직 채워져 있는 자리에 미래의 시각이 적혀 있는 것은 어긋남이 아니다 — 아직 비지 않았다는 뜻이고,
  // 줄을 따라 되감아 볼 때(같은 since 로 여러 틱을 재는 리플레이) 자연히 생긴다.
  for (const [nodeId, tick] of since) {
    const node = graph.nodes.find((entry) => entry.id === nodeId);
    if (node === undefined) {
      violatePressure(
        violations,
        nodeId,
        nodeId,
        'unknown-node',
        '$.context.since',
        '그래프에 없는 노드의 결핍 시작을 적었다 — 없는 의존은 비지도 않는다',
      );
      continue;
    }
    if (tick <= snapshot.tick) continue;
    const reading = readings.find((entry) => entry.nodeId === nodeId);
    if (reading === undefined || reading.met) continue;
    violatePressure(
      violations,
      nodeId,
      node.label,
      'future-since',
      '$.context.since',
      `${node.label} 은 지금 비어 있는데 그 결핍이 아직 오지 않은 시각(${String(tick)})에 시작됐다고 적혔다 — 지금은 ${String(snapshot.tick)}틱이다`,
    );
  }
  const readingOf = (nodeId: Id): DeficitReading | undefined =>
    readings.find((reading) => reading.nodeId === nodeId);
  const labelOf = (nodeId: Id): string =>
    graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId;

  const edges: EdgePressure[] = graph.edges.map((edge) => {
    const reading = readingOf(edge.to);
    const deficit = reading?.deficit ?? 1;
    const startedAt = since.get(edge.to);
    const unmetTicks =
      deficit === 0 || startedAt === undefined || startedAt > snapshot.tick
        ? 0
        : snapshot.tick - startedAt;
    const risk = failureRisk(unmetTicks, edge.failureDelayTicks);
    const pressure = edge.strength * deficit * edge.urgency * risk;
    return {
      edgeId: edge.id,
      from: labelOf(edge.from),
      to: labelOf(edge.to),
      relation: edge.relation,
      strength: edge.strength,
      deficit,
      urgency: edge.urgency,
      failureRisk: risk,
      unmetTicks,
      failureDelayTicks: edge.failureDelayTicks,
      pressure,
      level: levelOf(pressure),
    };
  });

  const nodes: NodePressure[] = graph.nodes.map((node) => {
    const outgoing = graph.edges
      .filter((edge) => edge.from === node.id)
      .map((edge) => edges.find((entry) => entry.edgeId === edge.id))
      .filter((entry): entry is EdgePressure => entry !== undefined);
    const worst = outgoing.reduce<EdgePressure | null>(
      (best, entry) => (best === null || entry.pressure > best.pressure ? entry : best),
      null,
    );
    const pressure = worst?.pressure ?? 0;
    return {
      nodeId: node.id,
      label: node.label,
      isRoot: graph.rootIds.includes(node.id),
      deficit: readingOf(node.id)?.deficit ?? 1,
      pressure,
      level: levelOf(pressure),
      worstEdgeId: worst?.edgeId ?? null,
    };
  });

  const peak = nodes.reduce((best, node) => Math.max(best, node.pressure), 0);

  return {
    subjectId: graph.subjectId,
    tick: snapshot.tick,
    readings,
    edges,
    nodes,
    roots: nodes.filter((node) => node.isRoot),
    peak,
    peakLevel: levelOf(peak),
    violations,
    hash: stateHash({
      snapshot: snapshotHash(snapshot),
      edges: edges.map((entry) => `${entry.edgeId}:${entry.pressure.toFixed(6)}`),
    }),
  };
}

/** 보고를 한 줄로 접는다 — 터미널·배지용. */
export function pressureVerdict(report: PressureReport): string {
  if (report.violations.length > 0) {
    const rules = [...new Set(report.violations.map((violation) => violation.rule))];
    return `압력을 잴 수 없다 — ${rules.join(', ')}`;
  }
  const worst = report.roots.reduce<NodePressure | null>(
    (best, node) => (best === null || node.pressure > best.pressure ? node : best),
    null,
  );
  if (worst === null || worst.pressure === 0) {
    return `${String(report.tick)}틱 — 무너지는 자리가 전부 채워졌다 (압력 0)`;
  }
  return `${String(report.tick)}틱 — ${worst.label} ${LEVEL_LABELS[worst.level]} (압력 ${worst.pressure.toFixed(2)})`;
}

/** 뿌리 하나의 압력 추이 — 틱이 흐르며 어떻게 오르는가 (화면의 막대). */
export interface PressureTrendPoint {
  readonly tick: Tick;
  readonly pressure: number;
  readonly level: FulfillmentLevel;
  /** 압력을 끌어올린 기댐의 결핍 — 무엇이 비어서 급해졌는가 */
  readonly deficit: number;
  /** 그 기댐이 무엇에 걸려 있는가 (`겨울 식량`) */
  readonly driver: string | null;
  /** 그 결핍이 이어진 틱 */
  readonly unmetTicks: number;
}

/** 스냅샷의 줄에서 한 노드의 압력 추이를 뽑는다. */
export function trendOf(
  graph: DependencyGraph,
  snapshots: readonly WorldSnapshot[],
  nodeLabel: string,
  context: PressureContext = {},
): readonly PressureTrendPoint[] {
  return snapshots.map((snapshot) => {
    const report = evaluatePressure(graph, snapshot, context);
    const node = report.nodes.find((entry) => entry.label === nodeLabel);
    const worst = report.edges.find((entry) => entry.edgeId === node?.worstEdgeId);
    return {
      tick: snapshot.tick,
      pressure: node?.pressure ?? 0,
      level: node?.level ?? 'met',
      deficit: worst?.deficit ?? node?.deficit ?? 0,
      driver: worst?.to ?? null,
      unmetTicks: worst?.unmetTicks ?? 0,
    };
  });
}
