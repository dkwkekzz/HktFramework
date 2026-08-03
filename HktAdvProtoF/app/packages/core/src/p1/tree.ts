// P1-c 대응 트리 조립 — 압력이 있는 자리마다 갈래를 묶어 하나의 트리로 세운다.
//
// D4 는 어느 자리가 얼마나 비었는지를 잰다. P1 은 그 위에 갈래를 얹는다. 두 가지 규칙이
// 이 조립을 지배한다:
//
//   ① **결핍 0 인 자리는 펼치지 않는다.** 채워진 의존은 아무 목적도 만들지 않는다 —
//      D4 가 이미 못박은 조항이고, 여기서 어기면 세계는 늘 무언가를 하려 드는 소음이 된다.
//   ② **막힌 갈래도 자리를 지킨다.** 일곱은 언제나 일곱으로 서고, 그중 몇이 열렸는지가
//      그 결핍의 성격이다. 막힌 것을 빼 버리면 "할 수 없다" 가 화면에서 사라진다.
//
// 트리는 압력 순으로 선다 — 급한 것이 위다. 같은 압력이면 그래프의 선언 순서를 따른다
// (V1 결정성: 같은 세계·같은 그래프면 언제나 같은 트리, 같은 해시).

import { stateHash } from '../v1/hash.ts';
import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import { kindLabel } from '../d0/index.ts';
import type { DependencyGraph, DependencyNode } from '../d1/index.ts';
import type { FulfillmentLevel, PressureReport } from '../d4/index.ts';
import { STRATEGY_DIRECTIONS, directionLabel, type StrategyDirection } from './direction.ts';
import {
  checkOptions,
  leadingEdge,
  openOptions,
  type OpeningContext,
  type StrategyOption,
} from './opening.ts';
import { violateStrategy, type StrategyViolation } from './violation.ts';

/** 결핍 하나와 그 앞에 놓인 일곱 갈래. */
export interface StrategyBranch {
  readonly nodeId: Id;
  readonly label: string;
  readonly kind: string;
  readonly isRoot: boolean;
  /** 이 자리가 얼마나 비었는가 (D4) */
  readonly deficit: number;
  /**
   * 얼마나 급한가 — **이 자리에 기댄 쪽**의 압력이다.
   * 결핍은 잎(공급처)에 있고 급함은 그것에 기댄 쪽에 있다: 창고가 비는 것 자체는 아프지 않고,
   * 그 창고에 기댄 몸이 아프다. 그래서 갈래의 급함은 들어오는 기댐에서 읽는다.
   */
  readonly pressure: number;
  readonly level: FulfillmentLevel;
  /** 누가 이 자리에 기대고 있는가 — 들어오는 기댐의 출발 노드 이름 */
  readonly dependedBy: string;
  /** 어떤 기댐인가 (D1 관계 7종) */
  readonly relation: string;
  /** 일곱 갈래 — 막힌 것도 자리를 지킨다 */
  readonly options: readonly StrategyOption[];
  /** 그중 열린 방향들 */
  readonly open: readonly StrategyDirection[];
}

/** 한 주체의 지금 — 무엇이 비었고 각각 앞에 무엇이 놓였는가. */
export interface StrategyTree {
  readonly subjectId: Id;
  readonly tick: Tick;
  /** 압력 큰 순서. 결핍 0 인 자리는 들어오지 않는다 */
  readonly branches: readonly StrategyBranch[];
  /** 가장 급한 자리 */
  readonly leadingNodeId: Id | null;
  /** 어느 방향이 이 주체에게 몇 번 열렸는가 */
  readonly openCounts: Readonly<Record<string, number>>;
  /** 이 주체에게 한 번도 열리지 않은 방향 — 무엇을 할 수 없는지가 그를 말한다 */
  readonly neverOpen: readonly StrategyDirection[];
  readonly violations: readonly StrategyViolation[];
  readonly hash: string;
}

/** 전개에서 제외할 만큼 채워졌는가 — D4 의 "결핍 0 이면 압력 0" 을 그대로 쓴다. */
function isMet(deficit: number): boolean {
  return deficit === 0;
}

/**
 * 압력 보고 위에 갈래를 얹는다. 던지지 않는다 — 어긋남은 값으로 남는다.
 *
 * 그래프와 보고가 서로 다른 주체의 것이면 그 사실 자체가 위반이다: 갈래는 언제나 **한 주체의
 * 지금** 이고, 남의 결핍 앞에서 내 갈래를 펼칠 수는 없다.
 */
export function expandStrategies(
  graph: DependencyGraph,
  report: PressureReport,
  context: OpeningContext = {},
): StrategyTree {
  const violations: StrategyViolation[] = [];
  const branches: StrategyBranch[] = [];

  if (graph.subjectId !== report.subjectId) {
    violateStrategy(
      violations,
      '',
      'foreign-node',
      '$.report.subjectId',
      `${graph.subjectId} 의 그래프 위에 ${report.subjectId} 의 압력을 얹으려 한다 — 갈래는 한 주체의 것이다`,
    );
  }

  for (const [index, entry] of report.nodes.entries()) {
    const at = `$.branches[${String(index)}]`;
    const node = graph.nodes.find((candidate) => candidate.id === entry.nodeId);
    if (node === undefined) {
      violateStrategy(
        violations,
        '',
        'unknown-node',
        at,
        `그래프에 없는 노드 ${entry.nodeId} 를 펼치려 한다`,
      );
      continue;
    }
    if (node.subjectId !== graph.subjectId) {
      violateStrategy(
        violations,
        '',
        'foreign-node',
        at,
        `${node.label} 은 ${node.subjectId} 의 의존이다 — 남의 결핍 앞에서 내 갈래를 펼칠 수 없다`,
      );
      continue;
    }
    if (isMet(entry.deficit)) continue;

    const leading = leadingEdge(graph, node.id);
    const edgePressure =
      leading === null ? null : (report.edges.find((edge) => edge.edgeId === leading.id) ?? null);
    const options = openOptions(graph, node, context);
    violations.push(...checkOptions(options, `${at}.options`));
    if (options.length !== STRATEGY_DIRECTIONS.length) {
      violateStrategy(
        violations,
        '',
        'missing-direction',
        `${at}.options`,
        `${node.label} 앞에 방향이 ${String(options.length)}개만 섰다 — 막힌 것도 자리를 지켜야 한다`,
      );
    }

    branches.push({
      nodeId: node.id,
      label: node.label,
      kind: node.kind,
      isRoot: graph.rootIds.includes(node.id),
      deficit: entry.deficit,
      pressure: edgePressure?.pressure ?? entry.pressure,
      level: edgePressure?.level ?? entry.level,
      dependedBy: edgePressure?.from ?? '(기대는 쪽이 없다)',
      relation: leading?.relation ?? '(들어오는 기댐 없음)',
      options,
      open: options.filter((option) => option.open).map((option) => option.direction),
    });
  }

  // 압력 큰 순서. 같으면 보고에 실린 순서(그래프 선언 순서)를 지킨다 — 안정 정렬.
  const ordered = branches
    .map((branch, index) => ({ branch, index }))
    .sort((left, right) =>
      right.branch.pressure === left.branch.pressure
        ? left.index - right.index
        : right.branch.pressure - left.branch.pressure,
    )
    .map((entry) => entry.branch);

  if (ordered.length === 0 && report.peak > 0) {
    violateStrategy(
      violations,
      '',
      'empty-tree',
      '$.branches',
      `압력이 ${report.peak.toFixed(2)} 인데 갈래가 하나도 서지 않았다`,
    );
  }

  const openCounts: Record<string, number> = {};
  for (const direction of STRATEGY_DIRECTIONS) openCounts[direction] = 0;
  for (const branch of ordered) {
    for (const direction of branch.open) {
      openCounts[direction] = (openCounts[direction] ?? 0) + 1;
    }
  }
  const neverOpen = STRATEGY_DIRECTIONS.filter((direction) => (openCounts[direction] ?? 0) === 0);

  return {
    subjectId: graph.subjectId,
    tick: report.tick,
    branches: ordered,
    leadingNodeId: ordered[0]?.nodeId ?? null,
    openCounts,
    neverOpen,
    violations,
    hash: treeHash(ordered, report.tick, graph.subjectId),
  };
}

/** 트리 해시 — 같은 세계·같은 그래프면 언제나 같다 (V1 결정성). */
function treeHash(
  branches: readonly StrategyBranch[],
  tick: Tick,
  subjectId: Id,
): string {
  return stateHash({
    subjectId,
    tick,
    branches: branches.map((branch) => ({
      node: branch.nodeId,
      pressure: branch.pressure,
      options: branch.options.map(
        (option) =>
          `${option.direction}:${option.open ? option.atoms.join('+') : (option.blockedBy ?? '')}`,
      ),
    })),
  });
}

/** 갈래 하나가 서는 자리의 노드 — 화면이 그래프를 그릴 때 쓴다. */
export function branchNode(graph: DependencyGraph, branch: StrategyBranch): DependencyNode | null {
  return graph.nodes.find((node) => node.id === branch.nodeId) ?? null;
}

/** 그 갈래가 기대는 간선의 성격 — 화면 설명용. */
export function branchRelation(graph: DependencyGraph, branch: StrategyBranch): string {
  return leadingEdge(graph, branch.nodeId)?.relation ?? '(들어오는 기댐 없음)';
}

/** 트리를 한 줄 판정으로 접는다 — 터미널·배지용. */
export function treeVerdict(tree: StrategyTree): string {
  if (tree.violations.length > 0) {
    const rules = [...new Set(tree.violations.map((violation) => violation.rule))];
    return `전개가 막혔다 — ${rules.join(', ')}`;
  }
  if (tree.branches.length === 0) {
    return '빈 자리가 없다 — 아무 갈래도 펼치지 않는다 (채워진 의존은 목적을 만들지 않는다)';
  }
  const leading = tree.branches[0] as StrategyBranch;
  return `빈 자리 ${String(tree.branches.length)}곳 · 가장 급한 것은 ${leading.label}(${leading.level} — ${leading.dependedBy} 가 기댄다) 이고 그 앞에 ${String(leading.open.length)}갈래가 열린다 · 한 번도 열리지 않은 방향 ${String(tree.neverOpen.length)}`;
}

/** 화면·터미널이 함께 쓰는 요약 줄. */
export function treeSummary(tree: StrategyTree): readonly string[] {
  return [
    `빈 자리: ${tree.branches.map((branch) => `${branch.label}(${branch.pressure.toFixed(2)})`).join(' · ') || '(없다)'}`,
    `방향별 열린 횟수: ${STRATEGY_DIRECTIONS.map((direction) => `${directionLabel(direction)} ${String(tree.openCounts[direction] ?? 0)}`).join(' · ')}`,
    `한 번도 열리지 않은 방향: ${tree.neverOpen.length === 0 ? '(없다)' : tree.neverOpen.map(directionLabel).join(' · ')}`,
  ];
}

/** 같은 종의 결핍이 여럿일 때 종별로 몇 갈래가 열리는가 — 화면 대조표용. */
export function openByKind(tree: StrategyTree): Readonly<Record<string, readonly string[]>> {
  const out: Record<string, string[]> = {};
  for (const branch of tree.branches) {
    const key = kindLabel(branch.kind as never);
    out[key] = [...new Set([...(out[key] ?? []), ...branch.open.map(directionLabel)])];
  }
  return out;
}
