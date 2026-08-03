// P1 검증 장면 — 같은 겨울, 네 사람 앞에 다른 갈래가 놓인다.
//
// P0 은 "무엇을 할 수 있는가" 를 확정했다. 그러나 열여섯을 다 늘어놓는 것은 아직 전개가 아니다.
// 이 장면이 보이는 것은 셋이다.
//
//   ① **결핍의 종이 갈래를 좁힌다.** 겨울 식량(자원) 앞에는 여섯이 열리고, 겨울 움막(공간)
//      앞에는 셋만 열린다 — 장소는 만들 수도, 남에게 맡길 수도, 덜 쓸 수도 없기 때문이다.
//      이 좁힘은 P1 이 새로 정한 규칙이 아니라 D0·D1·P0 이 이미 못박은 성질의 결과다.
//   ② **같은 세계에서도 누구에게 무엇이 가장 급한지가 갈린다.** 04 는 굶주림이, 나머지 셋은
//      겨울 움막이 먼저다.
//   ③ **일곱 중 하나는 아무에게도 열리지 않는다.** 겨루는 자를 볼 눈이 아직 세계에 없기
//      때문이고(D5), 그 눈을 손으로 쥐여 주면 그 자리에서 열린다 — 문법은 이미 서 있다.

import { deterministicId, type Id } from '@hkt/core/v1';
import type { DependencyGraph, DependencyNode } from '@hkt/core/d1';
import { evaluatePressure, type PressureReport } from '@hkt/core/d4';
import {
  expandStrategies,
  openOption,
  type StrategyBranch,
  type StrategyTree,
} from '@hkt/core/p1';

import {
  bareInstance,
  greedyInstance,
  personalGraphOf,
  priestInstance,
  sinceFor,
  trackerInstance,
  VEIL_INSTANCES,
} from './d4-veil-world.ts';
import { CRISIS_TICK, CRISIS_WORLD } from './p0-veil-actions.ts';

export {
  bareInstance,
  CRISIS_TICK,
  CRISIS_WORLD,
  greedyInstance,
  personalGraphOf,
  priestInstance,
  trackerInstance,
  VEIL_INSTANCES,
};

/** 개체 하나의 지금 압력. */
export function pressureOf(instance: typeof trackerInstance): PressureReport {
  const graph = personalGraphOf(instance);
  return evaluatePressure(graph, CRISIS_WORLD, { since: sinceFor(graph) });
}

/** 개체 하나의 지금 갈래. */
export function treeOf(instance: typeof trackerInstance, rivals: readonly Id[] = []): StrategyTree {
  const graph = personalGraphOf(instance);
  return expandStrategies(graph, pressureOf(instance), rivals.length === 0 ? {} : { rivals });
}

export const trackerGraph: DependencyGraph = personalGraphOf(trackerInstance);
export const trackerTree: StrategyTree = treeOf(trackerInstance);

/** 네 사람의 갈래 — 같은 겨울, 다른 길. */
export interface SubjectTree {
  readonly label: string;
  readonly subjectId: Id;
  readonly tree: StrategyTree;
}

const LABELS: Readonly<Record<string, string>> = {
  [trackerInstance.id]: '몰이꾼 04 (빚 40)',
  [greedyInstance.id]: '몰이꾼 11 (욕심)',
  [bareInstance.id]: '몰이꾼 23 (맨몸)',
  [priestInstance.id]: '사제 31 (의념 200)',
};

export const VEIL_TREES: readonly SubjectTree[] = VEIL_INSTANCES.map((instance) => ({
  label: LABELS[instance.id] ?? instance.id,
  subjectId: instance.id,
  tree: treeOf(instance),
}));

/** 겨루는 자를 손에 쥐여 준 04 — D5 가 서면 세계가 이 값을 줄 것이다. */
export const RIVAL_TREE: StrategyTree = treeOf(trackerInstance, [greedyInstance.id]);

/** 갈래 하나를 이름으로 찾는다. */
export function branchOf(tree: StrategyTree, label: string): StrategyBranch | null {
  return tree.branches.find((branch) => branch.label === label) ?? null;
}

/** 손으로 세운 노드 — 그래프에 없는 종(시간·규칙)의 결핍을 보기 위한 것. */
function nodeWithKind(kind: DependencyNode['kind'], label: string): DependencyNode {
  const base = trackerGraph.nodes.find((node) => node.kind === 'resource') as DependencyNode;
  return { ...base, id: deterministicId('dep-node', label), kind, label };
}

/** 채울 길이 아예 없는 결핍 둘 — 원문 D0 가 미룬 자리가 여기서 갈래로 드러난다. */
export const UNFILLABLE_CASES: readonly {
  readonly label: string;
  readonly node: DependencyNode;
  readonly expected: string;
}[] = [
  { label: '붉은 장막의 주기 (시간)', node: nodeWithKind('time', '장막 주기'), expected: 'no-target' },
  {
    label: '의념은 대가를 요구한다 (규칙)',
    node: nodeWithKind('rule', '의념의 법'),
    expected: 'no-filling-atom',
  },
];

/** 뿌리 하나 — 굶주림 자체는 버릴 수 없다. */
export const HUNGER_ROOT: DependencyNode = trackerGraph.nodes.find(
  (node) => trackerGraph.rootIds.includes(node.id) && node.label === '주린 몸',
) as DependencyNode;

/** 뿌리·잎에서 의존 제거가 어떻게 갈리는가. */
export function detachOn(node: DependencyNode, isRoot: boolean) {
  return openOption('removeDependency', node, null, isRoot);
}

/** 설 수 없는 전개 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenExpansion {
  readonly broke: string;
  readonly expected: string;
  readonly graph: DependencyGraph;
  readonly report: PressureReport;
}

const trackerReport = pressureOf(trackerInstance);
const otherReport = pressureOf(greedyInstance);
const ghostId = deterministicId('dep-node', '없는 자리');

/** 설 수 없는 전개 넷 — 사유마다 하나씩. */
export const BROKEN_EXPANSIONS: readonly BrokenExpansion[] = [
  {
    broke: '남의 압력을 내 그래프에 얹었다',
    expected: 'foreign-node',
    graph: trackerGraph,
    report: { ...trackerReport, subjectId: greedyInstance.id },
  },
  {
    broke: '남의 노드가 내 그래프에 섞였다',
    expected: 'foreign-node',
    graph: {
      ...trackerGraph,
      nodes: trackerGraph.nodes.map((node) =>
        node.label === '겨울 식량' ? { ...node, subjectId: greedyInstance.id } : node,
      ),
    },
    report: trackerReport,
  },
  {
    broke: '그래프에 없는 자리를 펼치려 한다',
    expected: 'unknown-node',
    graph: trackerGraph,
    report: {
      ...trackerReport,
      nodes: [
        ...trackerReport.nodes,
        {
          nodeId: ghostId,
          label: '없는 자리',
          isRoot: false,
          deficit: 1,
          pressure: 0.5,
          level: 'deficient' as const,
          worstEdgeId: null,
        },
      ],
    },
  },
  {
    broke: '압력이 있는데 펼칠 자리를 전부 지웠다',
    expected: 'empty-tree',
    graph: trackerGraph,
    report: { ...trackerReport, nodes: [] },
  },
];

/** 다른 주체의 보고 — 위 장면이 실제로 다른 값임을 보이기 위해 함께 내보낸다. */
export { otherReport };
