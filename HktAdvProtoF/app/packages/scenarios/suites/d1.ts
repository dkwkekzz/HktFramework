// D1 검증 시나리오 3종 — 그래프가 정말 한 주체의 무너짐에서 뻗는가, 그리고 D0 의 성격이 지켜지는가.

import { stateHash } from '@hkt/core/v1';
import {
  checkGraph,
  EDGE_RELATIONS,
  graphHash,
  graphVerdict,
  reachableFrom,
  relationsFor,
  RELATION_SPECS,
} from '@hkt/core/d1';
import { DEPENDENCY_KINDS, kindGrounding } from '@hkt/core/d0';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BROKEN_GRAPHS,
  cycleNode,
  foodNode,
  groundNode,
  hungerNode,
  licenseNode,
  WINTER_EDGES,
  WINTER_GRAPH,
  WINTER_NODES,
} from './d1-winter-graph.ts';

/** 정상 — 하나의 무너짐에서 일곱 노드가 뻗고, 순서를 뒤집어도 같은 그래프다. */
export const d1WinterFoodGraph = defineScenario({
  id: 'd1-winter-food-graph',
  module: 'D1',
  kind: 'normal',
  purpose:
    '몰이꾼의 허기 하나에서 일곱 노드가 여섯 관계로 뻗고, 간선마다 D0 가 못박은 성격(소모·가리킴)이 지켜지며, 적은 순서를 뒤집어도 같은 그래프 해시가 된다.',
  arrange: () => ({ graph: WINTER_GRAPH }),
  act: ({ graph }) => {
    const report = checkGraph(graph);
    const shuffled = {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    };

    return {
      // ① 그래프가 선다
      complete: report.complete,
      violations: report.violations.map((violation) => violation.rule),
      verdict: graphVerdict(report),
      nodeCount: report.nodeCount,
      edgeCount: report.edgeCount,

      // ② 뿌리 하나에서 전부 닿는다
      roots: graph.rootIds.length,
      unreachable: report.unreachable,
      reached: report.reachable.length,
      cycle: report.cycle,

      // ③ 사슬의 모양 — 무엇이 무엇에 어떻게 기대는가
      chain: graph.edges.map((edge) => {
        const name = (id: string): string =>
          graph.nodes.find((node) => node.id === id)?.label ?? id;
        return `${name(edge.from)} --${edge.relation}--> ${name(edge.to)}`;
      }),
      kindsUsed: [...new Set(graph.nodes.map((node) => node.kind))],

      // ④ D0 의 성격이 그대로 강제된다
      consumedKinds: graph.edges
        .filter((edge) => edge.relation === 'consumes')
        .map((edge) => graph.nodes.find((node) => node.id === edge.to)?.kind ?? ''),
      consumedAreDepleting: graph.edges
        .filter((edge) => edge.relation === 'consumes')
        .every(
          (edge) =>
            kindGrounding(
              graph.nodes.find((node) => node.id === edge.to)?.kind ?? 'resource',
            )?.depletes === true,
        ),
      // 그 대상이어야 하는 종에 걸린 간선은 절대 1 이 아니다
      namedSubstitutability: graph.edges
        .filter(
          (edge) =>
            kindGrounding(graph.nodes.find((node) => node.id === edge.to)?.kind ?? 'resource')
              ?.targeting === 'named',
        )
        .map((edge) => edge.substitutability),
      // 아무것이나 되는 식량은 갈아탈 수 있고, 시간은 조금도 갈아탈 수 없다
      foodSubstitutability:
        graph.edges.find((edge) => edge.to === foodNode.id)?.substitutability ?? null,
      timeSubstitutability:
        graph.edges.find((edge) => edge.to === cycleNode.id)?.substitutability ?? null,

      // ⑤ 끊김은 언제나 세계에 흔적을 남긴다
      effectSlots: graph.edges.flatMap((edge) =>
        edge.failureEffects.map((effect) => `${effect.slot.domain}.${effect.slot.path.split('.')[0] ?? ''}`),
      ),

      // ⑥ 순서는 뜻이 아니다
      sameHash: graphHash(graph) === graphHash(shuffled),
      shuffledStands: checkGraph(shuffled).complete,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('그래프가 선다', true, result.complete),
    expectState('거부 사유가 없다', [], result.violations),
    expectState('노드 일곱과 간선 여섯', [7, 6], [result.nodeCount, result.edgeCount]),
    expectState('뿌리는 하나다', 1, result.roots),
    expectState('닿지 않는 노드가 없다', [], result.unreachable),
    expectState('일곱이 전부 뿌리에서 닿는다', 7, result.reached),
    expectState('맴돌지 않는다', null, result.cycle),
    expectState(
      '사슬의 모양이 그대로 선다',
      [
        '주린 몸 --consumes--> 겨울 식량',
        '겨울 식량 --requires--> 사냥터',
        '사냥터 --authorized_by--> 고개 통행권',
        '사냥터 --sustained_by--> 장막이 걷히는 주기',
        '겨울 식량 --informed_by--> 마비독 감별',
        '겨울 식량 --produced_by--> 행상의 신뢰',
      ],
      result.chain,
    ),
    expectState(
      '한 사람의 굶주림이 일곱 종을 건드린다',
      ['body', 'resource', 'space', 'institution', 'time', 'information', 'relationship'],
      result.kindsUsed,
    ),
    expectState('소모되는 것은 D0 가 줄어든다고 적은 종뿐이다', true, result.consumedAreDepleting),
    expectState('그 대상이어야 하는 종은 하나도 1 이 아니다', true, result.namedSubstitutability.every((value) => value < 1)),
    expectState('아무 식량이든 되므로 갈아탈 수 있다', 0.7, result.foodSubstitutability),
    expectState('시간은 조금도 갈아탈 수 없다', 0, result.timeSubstitutability),
    expectTrue(
      '끊김은 전부 세계의 자리에 흔적을 남긴다',
      result.effectSlots.length >= result.edgeCount,
      result.effectSlots,
    ),
    expectState('순서를 뒤집어도 같은 그래프다', true, result.sameHash),
    expectState('뒤집힌 그래프도 그대로 선다', true, result.shuffledStands),
    expectDeterministic('같은 그래프를 100번 물어도 같은 해시다', () =>
      stateHash([graphHash(WINTER_GRAPH), checkGraph(WINTER_GRAPH).violations]),
    ),
  ],
});

/** 실패 — 열둘이 각자의 사유로 거부된다. */
export const d1BrokenGraphsRejected = defineScenario({
  id: 'd1-broken-graphs-rejected',
  module: 'D1',
  kind: 'failure',
  purpose:
    '줄지 않는 것을 소모하거나 그 대상이어야 하는 것을 대체 가능하다 적거나 뿌리에서 닿지 않거나 맴도는 그래프가 각자의 사유·경로로 거부된다.',
  arrange: () => ({ graphs: BROKEN_GRAPHS }),
  act: ({ graphs }) =>
    graphs.map((entry) => {
      const report = checkGraph(entry.graph);
      const first = report.violations[0];
      return {
        broke: entry.broke,
        expected: entry.expected,
        actual: first?.rule ?? '(통과해 버렸다)',
        complete: report.complete,
        path: first?.path ?? '',
        where: first?.label ?? '',
      };
    }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '무너진 그래프 열둘이 전부 예상한 사유로 걸린다',
      result.map((entry) => entry.expected),
      result.map((entry) => entry.actual),
    ),
    expectState(
      '하나도 온전하다고 판정되지 않는다',
      result.map(() => false),
      result.map((entry) => entry.complete),
    ),
    expectTrue(
      '어디를 고쳐야 하는지가 경로로 실린다',
      result.every((entry) => entry.path.startsWith('$')),
      result.map((entry) => entry.path),
    ),
    expectTrue(
      '맴도는 그래프는 끊어야 할 고리를 이름으로 말한다',
      result.some((entry) => entry.where.includes('→')),
      result.find((entry) => entry.expected === 'dependency-cycle')?.where,
    ),
    expectDeterministic('거부 사유는 반복해도 같다', () =>
      stateHash(BROKEN_GRAPHS.map((entry) => checkGraph(entry.graph).violations)),
    ),
  ],
});

/** 경계 — 노드 하나짜리 그래프, 관계마다 걸 수 있는 종, 도달의 양끝. */
export const d1Boundary = defineScenario({
  id: 'd1-boundary',
  module: 'D1',
  kind: 'boundary',
  purpose:
    '노드 하나·간선 없는 그래프도 서고, requires 만 열한 종 전부에 걸리며, 도달은 간선 방향을 따르고 거꾸로는 닿지 않는다.',
  arrange: () => ({ graph: WINTER_GRAPH }),
  act: ({ graph }) => {
    const lone = {
      ...graph,
      nodes: [hungerNode],
      edges: [],
      rootIds: [hungerNode.id],
    };
    const loneReport = checkGraph(lone);

    return {
      // 가장 작은 그래프 — 무너질 자리 하나, 아직 아무것에도 기대지 않는다
      loneStands: loneReport.complete,
      loneNodes: loneReport.nodeCount,
      loneEdges: loneReport.edgeCount,
      loneReached: loneReport.reachable.length,

      // 관계 7종이 종마다 갈린다
      relationCount: EDGE_RELATIONS.length,
      universal: RELATION_SPECS.filter((spec) => spec.targetKinds.length === 0).map(
        (spec) => spec.relation,
      ),
      perKind: DEPENDENCY_KINDS.map((kind) => relationsFor(kind).length),
      timeRelations: relationsFor('time'),

      // 도달의 양끝
      fromRoot: reachableFrom([hungerNode.id], WINTER_EDGES).length,
      fromLeaf: reachableFrom([licenseNode.id], WINTER_EDGES),
      fromNothing: reachableFrom([], WINTER_EDGES),
      // 사냥터에서 시작하면 그 아래만 닿는다
      fromMiddle: reachableFrom([groundNode.id], WINTER_EDGES).length,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('노드 하나짜리 그래프도 선다', true, result.loneStands),
    expectState('간선 없이 뿌리 하나가 곧 전부다', [1, 0, 1], [
      result.loneNodes,
      result.loneEdges,
      result.loneReached,
    ]),
    expectState('관계는 일곱이다', 7, result.relationCount),
    expectState('열한 종 전부에 걸리는 관계는 requires 하나다', ['requires'], result.universal),
    expectTrue(
      '어느 종이든 걸 수 있는 관계가 하나 이상 있다',
      result.perKind.every((count) => count >= 1),
      result.perKind,
    ),
    expectState('시간에 걸 수 있는 것은 둘뿐이다', ['requires', 'sustained_by'], result.timeRelations),
    expectState('뿌리에서는 일곱 전부에 닿는다', 7, result.fromRoot),
    expectState('잎에서는 자기 자신뿐이다', [licenseNode.id], result.fromLeaf),
    expectState('뿌리가 없으면 아무데도 닿지 않는다', [], result.fromNothing),
    expectState('중간에서 시작하면 그 아래만 닿는다', 3, result.fromMiddle),
  ],
});

export const d1Scenarios = [d1WinterFoodGraph, d1BrokenGraphsRejected, d1Boundary];
