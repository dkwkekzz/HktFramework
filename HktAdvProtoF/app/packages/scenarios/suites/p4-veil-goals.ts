// P4 검증 장면 — 같은 겨울, 같은 갈래. 무엇을 좇는가는 압력만으로 정해지지 않는다.
//
// P3 의 장면은 "본 것이 다르면 무엇이 펴지는가" 를 물었다. 이 장면이 묻는 것은 그 다음이다 —
// **펴 놓은 것 중 무엇을 좇는가.**
//
//   ① **지금 보는 04.** 아홉 갈래 앞에서 점수가 매겨지고 하나가 뽑힌다. 여기서는 가장 급한
//      것(겨울 식량)이 뽑힌다 — 압력이 요소 아홉 중 가장 무겁기 때문이다.
//   ② **모르는 04.** 마비독을 모르면 정보 갈래가 서고, 그것이 아홉 전부의 선행이 된다.
//      겨울 식량은 여전히 위기(0.31)이고 마비독 감별은 불안정(0.10)일 뿐인데 — **뽑히는 것은
//      찾기다.** 선행이 서지 않은 것은 지금 고를 수 없기 때문이다. 압력 1위와 선택이 갈린다.
//   ③ **몫이 있는 04.** 같은 04 에게 감춰 둔 몫 둘을 쥐여 주면 주고받기가 선다. 그러면
//      **가치관·약속·관계가 한꺼번에 그쪽을 당긴다** — 신뢰를 세우는 원자는 열여섯 중 하나뿐이고
//      04 의 유지 자리가 바로 그 신뢰이며, 마을에 진 빚 40 이 갚을 자리를 가리키기 때문이다.
//      빈손인 04 는 제 몸으로 협곡에 들어가고, 몫이 있는 04 는 마을과 주고받는다.
//   ④ **관성이 지킨다.** ①의 04 가 2위를 좇고 있었다면, 1위와의 차이가 문턱을 넘지 못해 바뀌지 않는다.
//   ⑤ **관성이 진다.** 빈손일 때 기대는 구조를 버리려던 04 가, 몫이 생기자 그것을 다시 붙든다.
//   ⑥ **고를 것이 없다.** 아무것도 못 본 자에게는 후보가 서지 않고, 목적도 서지 않는다.

import type { Tick } from '@hkt/core/v1';
import { evaluatePressure, withSlot } from '@hkt/core/d4';
import { expandStrategies } from '@hkt/core/p1';
import { narrowTree, type NarrowedTree } from '@hkt/core/p2';
import { expandSubgraph, type ExpansionContext, type PossibilitySubgraph } from '@hkt/core/p3';
import { selectGoal, type ActiveGoal, type GoalSelection, type SelectSpec } from '@hkt/core/p4';

import { meatId, sinceFor } from './d4-veil-world.ts';
import {
  BLIND,
  CRISIS_TICK,
  MEAT_TARGET,
  SCENE_WORLD,
  SEEING,
  TRACKER_GRAPH,
  trackerGrammar,
  trackerInstance,
  trackerNarrowed,
  UNKNOWING_REMEMBERING,
  UNKNOWING_TREE,
  UNKNOWING_WORLD,
} from './p3-veil-expansion.ts';

export {
  CRISIS_TICK,
  MEAT_TARGET,
  SCENE_WORLD,
  SEEING,
  TRACKER_GRAPH,
  trackerInstance,
  trackerNarrowed,
  UNKNOWING_TREE,
};

/** 목적 하나가 서는 장면 — 세계·갈래·근거를 함께 지고 다닌다. */
export interface GoalCase {
  readonly label: string;
  readonly tells: string;
  readonly spec: SelectSpec;
  readonly selection: GoalSelection;
}

function caseOf(
  label: string,
  tells: string,
  world: typeof SCENE_WORLD,
  tree: NarrowedTree,
  context: ExpansionContext,
  subgraph: PossibilitySubgraph,
  previousGoal: ActiveGoal | null = null,
  tick: Tick = CRISIS_TICK,
): GoalCase {
  const spec: SelectSpec = {
    subject: trackerInstance,
    world: world.world,
    tree,
    context,
    subgraph,
    tick,
    ...(previousGoal === null ? {} : { previousGoal }),
  };
  return { label, tells, spec, selection: selectGoal(subgraph.active, spec) };
}

/** ① 지금 보는 04 — 아홉 갈래 앞의 점수표. */
export const SEEING_SUBGRAPH = expandSubgraph({
  tree: trackerNarrowed,
  graph: TRACKER_GRAPH,
  context: SEEING,
});

export const SEEING_CASE = caseOf(
  '지금 보는 04',
  '협곡의 고기와 움막이 눈앞에 있다 — 가장 급한 것이 뽑힌다',
  SCENE_WORLD,
  trackerNarrowed,
  SEEING,
  SEEING_SUBGRAPH,
);

/** ② 모르는 04 — 압력 1위가 선행에 걸려 뽑히지 못한다. */
export const UNKNOWING_CASE = caseOf(
  '모르는 04',
  '마비독을 모르니 아홉 전부에 찾기가 선행으로 걸린다 — 뽑히는 것은 압력 1위가 아니다',
  UNKNOWING_WORLD,
  UNKNOWING_TREE,
  UNKNOWING_REMEMBERING.context,
  UNKNOWING_REMEMBERING.subgraph,
);

/**
 * ③ 몫이 있는 04 — 같은 세계에 감춰 둔 몫 둘만 얹는다.
 *
 * 11 이 감춰 둔 것과 같은 몫이다(P0 장면). 손에 쥔 것이 생기면 주고받기가 서고,
 * 그 원자만이 `relational.trust` 를 세운다 — 04 의 유지 자리가 바로 그것이다.
 */
export const STOCKED_WORLD = withSlot(
  SCENE_WORLD,
  { domain: 'economic', holderId: trackerInstance.id, path: `stock.${meatId}`, value: 2 },
  CRISIS_TICK,
).snapshot;

export const STOCKED_TREE: NarrowedTree = narrowTree(
  expandStrategies(
    TRACKER_GRAPH,
    evaluatePressure(TRACKER_GRAPH, STOCKED_WORLD, { since: sinceFor(TRACKER_GRAPH) }),
    {},
  ),
  trackerGrammar,
);

export const STOCKED_SUBGRAPH = expandSubgraph({
  tree: STOCKED_TREE,
  graph: TRACKER_GRAPH,
  context: SEEING,
});

export const STOCKED_CASE = caseOf(
  '몫이 있는 04',
  '감춰 둔 몫 둘이 있으면 주고받기가 선다 — 가치관·약속이 한꺼번에 그쪽을 당긴다',
  STOCKED_WORLD,
  STOCKED_TREE,
  SEEING,
  STOCKED_SUBGRAPH,
);

/** ④ 관성 — ①의 04 가 2위를 좇고 있었다면 다음 틱에 무엇이 되는가. */
const ranked = SEEING_CASE.selection.scores.filter((score) => score.ready);
const runnerUp = ranked[1] ?? ranked[0];

export const PRIOR_GOAL: ActiveGoal | null =
  runnerUp === undefined
    ? null
    : {
        subjectId: trackerInstance.id,
        tick: CRISIS_TICK - 5,
        possibilityId: runnerUp.possibilityId,
        nodeId: runnerUp.nodeId,
        label: runnerUp.label,
        direction: runnerUp.direction,
        viaAtom: runnerUp.viaAtom,
        score: runnerUp.score,
        commitmentInertia: 0,
        sinceTick: CRISIS_TICK - 5,
        heldTicks: 0,
        changed: true,
        change: 'first',
        note: '다섯 틱 전에 이것을 골랐다',
      };

export const INERTIA_CASE = caseOf(
  '2위를 좇던 04',
  '다섯 틱 전에 2위를 골랐다 — 1위가 문턱을 넘지 못하면 바뀌지 않는다',
  SCENE_WORLD,
  trackerNarrowed,
  SEEING,
  SEEING_SUBGRAPH,
  PRIOR_GOAL,
  CRISIS_TICK,
);

/**
 * ⑤ 몫이 생긴 04 — 버리려던 것을 다시 붙든다.
 *
 * 빈손일 때 04 가 좇던 것은 기대는 구조 자체를 버리는 길(의존 제거)이었다. 몫이 둘 생기자
 * 주고받기가 서고, 그 차이가 문턱을 넘는다 — 관성은 지키기만 하는 것이 아니라 **넘길 수도** 있다.
 */
const shedGoal = STOCKED_CASE.selection.scores.find(
  (score) => score.direction === 'removeDependency' && score.ready,
);

export const SWITCH_PRIOR: ActiveGoal | null =
  shedGoal === undefined
    ? null
    : {
        subjectId: trackerInstance.id,
        tick: CRISIS_TICK - 8,
        possibilityId: shedGoal.possibilityId,
        nodeId: shedGoal.nodeId,
        label: shedGoal.label,
        direction: shedGoal.direction,
        viaAtom: shedGoal.viaAtom,
        score: shedGoal.score,
        commitmentInertia: 0,
        sinceTick: CRISIS_TICK - 8,
        heldTicks: 0,
        changed: true,
        change: 'first',
        note: '빈손일 때는 기대는 구조를 버리는 것이 유일한 길처럼 보였다',
      };

export const SWITCH_CASE = caseOf(
  '몫이 생긴 04',
  '버리려던 것을 다시 붙든다 — 차이가 문턱을 넘으면 관성도 지키지 못한다',
  STOCKED_WORLD,
  STOCKED_TREE,
  SEEING,
  STOCKED_SUBGRAPH,
  SWITCH_PRIOR,
);

/** ⑥ 고를 것이 없는 04 — 아무것도 못 본 자에게는 후보가 서지 않는다. */
export const BLIND_SUBGRAPH = expandSubgraph({
  tree: trackerNarrowed,
  graph: TRACKER_GRAPH,
  context: BLIND,
});

export const BLIND_CASE = caseOf(
  '아무것도 못 본 04',
  '펴 놓은 것이 없으면 고를 것도 없다 — 목적은 세계가 준 것에서만 선다',
  SCENE_WORLD,
  trackerNarrowed,
  BLIND,
  BLIND_SUBGRAPH,
);

export const GOAL_CASES: readonly GoalCase[] = [
  SEEING_CASE,
  UNKNOWING_CASE,
  STOCKED_CASE,
  INERTIA_CASE,
  SWITCH_CASE,
  BLIND_CASE,
];
