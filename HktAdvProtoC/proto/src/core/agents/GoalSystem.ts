// 목적 활성도 (기획서 §8 생존 압력, §19 목적 그래프, §20 활성도 계산 / Phase-3 §3.5)
//
// §20 의 11개 항을 각각 독립 함수로 구현한다. **모든 항의 입력은 BeliefView 다** —
// "계산에 실제 상태가 아니라 주체가 믿는 상태를 사용한다"(§20)가 이 파일의 유일한 규약이다.
// 각 항의 값은 breakdown 으로 남는다(Phase 6 진단 · Phase 8 §36.3 주체 관찰 화면의 입력).
import type { ActiveGoalState, GoalActivationBreakdown } from "../../shared/beliefs";
import { TICKS_PER_DAY } from "../../shared/time";
import type { WorldRuntime } from "../world/WorldRuntime";
import type { GoalEdge, GoalGraph, GoalNode, SurvivalPressureDefinition, UrgencyPolicy } from "../world/types";
import { BeliefView } from "./BeliefView";
import { rememberEvent } from "./MemorySystem";

/** 행동 태그 → 이 행동에 끌리는 성향 (§18 판단 변수, §20 valueAlignment) */
export const TAG_TRAIT: Record<string, string> = {
  investigate: "curiosity",
  track: "curiosity",
  trade: "greed",
  combat: "vengefulness",
  attack: "vengefulness",
  report: "loyalty",
  gather: "patience",
  hunt: "riskTolerance",
  flee: "empathy",
  rest: "patience",
  social: "empathy",
  delegate: "loyalty",
  rumor: "deceptionPreference",
};

const VALUE_ALIGNMENT_SCALE = 0.12;
/** 관계 항의 배율 — 관계 100 이 활성도 12 만큼을 옮긴다 */
const RELATIONSHIP_SCALE = 0.12;
const EMOTION_SCALE = 0.15;
/** 실행 가능성 항의 최대 기여 */
const MAX_FEASIBILITY = 15;
const UTILITY_SCALE = 0.15;
const COST_SCALE = 0.1;
const RISK_SCALE = 0.12;
/** 위임받은 목적이 접히는 기한 (기본 3일) */
export const DELEGATION_TTL = 3 * TICKS_PER_DAY;

function zeroBreakdown(baseImportance: number): GoalActivationBreakdown {
  return {
    baseImportance,
    needPressure: 0,
    urgency: 0,
    valueAlignment: 0,
    relationshipImpact: 0,
    emotionalBias: 0,
    feasibility: 0,
    expectedUtility: 0,
    cost: 0,
    risk: 0,
    conflict: 0,
  };
}

function sumBreakdown(breakdown: GoalActivationBreakdown): number {
  return (
    breakdown.baseImportance +
    breakdown.needPressure +
    breakdown.urgency +
    breakdown.valueAlignment +
    breakdown.relationshipImpact +
    breakdown.emotionalBias +
    breakdown.feasibility +
    breakdown.expectedUtility -
    breakdown.cost -
    breakdown.risk -
    breakdown.conflict
  );
}

// --- §8 생존 압력 ---------------------------------------------------------------

/** 이 주체에게 적용되는 압력 — 종족 태그로 고른다 (§8 "모든 종에게 동일하게 부여하지 않는다") */
export function pressuresFor(runtime: WorldRuntime, view: BeliefView): SurvivalPressureDefinition[] {
  const tags = view.selfTags();
  return runtime.definition.survivalPressures.filter((pressure) =>
    pressure.applicableSpeciesTags.some((tag) => tags.includes(tag)),
  );
}

/**
 * 하루 한 번의 압력 누적 (§8 urgencyGrowth).
 * 해소 조건이 참이면 0 으로 되돌린다 — 밥을 먹으면 배고픔의 압력은 사라진다.
 */
export function accumulatePressures(runtime: WorldRuntime, agentId: string): void {
  const agent = runtime.agentRuntime(agentId);
  const view = new BeliefView(runtime, agentId);
  for (const pressure of pressuresFor(runtime, view)) {
    const relieved =
      pressure.relievedWhen.length > 0 &&
      view.evaluateConditions(pressure.relievedWhen, undefined, { unknown: "fail" }).ok;
    if (relieved) {
      if (agent.pressures[pressure.id] !== undefined) delete agent.pressures[pressure.id];
      continue;
    }
    const current = agent.pressures[pressure.id] ?? 0;
    agent.pressures[pressure.id] = Math.min(
      pressure.maxUrgency,
      current + pressure.urgencyGrowth * 10,
    );
  }
}

// --- §20 의 11항 ----------------------------------------------------------------

/** ② needPressure — 이 목적을 밀어 올리는 생존 압력의 누적 (§8) */
function evaluateNeedPressure(runtime: WorldRuntime, view: BeliefView, goal: GoalNode): number {
  const agent = runtime.agentRuntime(view.agentId);
  let total = 0;
  for (const pressure of pressuresFor(runtime, view)) {
    if (pressure.goalId !== goal.id) continue;
    total += agent.pressures[pressure.id] ?? 0;
  }
  return total;
}

/** ③ urgency — 임계를 넘은 만큼 급하다. 남의 상태는 **믿음으로** 읽는다 (§19 UrgencyPolicy) */
export function evaluateUrgency(view: BeliefView, policy: UrgencyPolicy): number {
  if (policy.type === "constant") return policy.value;

  let raw: unknown;
  switch (policy.source) {
    case "self":
      raw = view.selfState(policy.stateKey);
      break;
    case "entity":
      raw = policy.entityId === undefined ? undefined : view.perceive(policy.entityId, policy.stateKey).value;
      break;
    case "belief":
      raw =
        policy.subjectId === undefined
          ? undefined
          : view.belief(policy.subjectId, policy.stateKey)?.believedValue;
      break;
  }
  if (typeof raw !== "number") return 0;
  const gap = policy.comparison === ">" ? raw - policy.threshold : policy.threshold - raw;
  if (gap <= 0) return 0;
  return Math.min(policy.max, gap * policy.weight);
}

/** ④ valueAlignment — 이 목적이 요구하는 행동이 내 성향과 맞는가 (§18) */
function evaluateValueAlignment(view: BeliefView, goal: GoalNode): number {
  let alignment = 0;
  for (const tag of goal.allowedActionTags) {
    const traitKey = TAG_TRAIT[tag];
    if (traitKey === undefined) continue;
    // 성향은 50 이 중립이다 — 그보다 높으면 끌리고, 낮으면 꺼린다
    alignment += (view.trait(traitKey) - 50) * VALUE_ALIGNMENT_SCALE;
  }
  return alignment;
}

/** ⑤ relationshipImpact — 이 목적이 마음 쓰는 대상과의 관계 (§25) */
function evaluateRelationshipImpact(view: BeliefView, goal: GoalNode): number {
  const focus = goal.focusIds ?? [];
  if (focus.length === 0) return 0;
  let total = 0;
  for (const id of focus) {
    const relation = view.relationTo(id);
    total +=
      (relation.affection + relation.trust + relation.dependency + relation.debt - relation.resentment) *
      RELATIONSHIP_SCALE;
  }
  return total / focus.length;
}

/** ⑥ emotionalBias — 공포·호기심 같은 지금의 감정이 목적을 부풀린다 (§18, §26 stress) */
function evaluateEmotionalBias(view: BeliefView, goal: GoalNode): number {
  const keys = goal.emotionKeys ?? [];
  if (keys.length === 0) return 0;
  let total = 0;
  for (const key of keys) total += view.selfNumber(key.stateKey) * key.weight * EMOTION_SCALE;
  return total;
}

/**
 * ⑦ feasibility — 지금 이 목적을 실행할 수단이 보이는가.
 * "아는 대상"이 있어야 실행 가능하다 — 모르면 낮다(§20 은 믿음으로 계산한다).
 */
function evaluateFeasibility(runtime: WorldRuntime, view: BeliefView, goal: GoalNode): number {
  let actions = 0;
  for (const tag of goal.allowedActionTags) {
    for (const action of runtime.index.actionsByTag.get(tag) ?? []) {
      const actor = view.evaluateConditions(action.actorRequirements);
      if (!actor.ok) continue;
      actions += 1;
    }
  }
  if (actions === 0) return -MAX_FEASIBILITY;
  return Math.min(MAX_FEASIBILITY, actions * 4);
}

/** ⑧ expectedUtility — 이루면 무엇이 얼마나 좋아지는가 (§19 utilityFactors) */
function evaluateExpectedUtility(view: BeliefView, goal: GoalNode): number {
  const factors =
    goal.utilityFactors ??
    goal.desiredChanges.map((change) => ({
      owner: "actor" as const,
      stateKey: change.stateKey,
      direction: change.direction,
      weight: change.weight,
    }));
  let total = 0;
  for (const factor of factors) {
    // 자기에게 없는 상태를 원할 수는 없다 (조직이 hunger 를 줄이려 하지 않는다)
    if (factor.owner === "actor" && !view.hasSelfState(factor.stateKey)) continue;
    const value =
      factor.owner === "actor"
        ? view.selfNumber(factor.stateKey, 0)
        : factor.entityId === undefined
          ? 0
          : view.perceiveNumber(factor.entityId, factor.stateKey, 0);
    // 늘리고 싶은 상태는 낮을수록, 줄이고 싶은 상태는 높을수록 이룰 값어치가 크다
    const gap = factor.direction === "increase" ? 100 - value : value;
    total += Math.max(0, gap) * factor.weight * UTILITY_SCALE;
  }
  return total;
}

/** ⑨ cost — 이 목적이 요구하는 행동들의 평균 자원 소모 (§21 costs) */
function evaluateExpectedCost(runtime: WorldRuntime, view: BeliefView, goal: GoalNode): number {
  let total = 0;
  let count = 0;
  for (const tag of goal.allowedActionTags) {
    for (const action of runtime.index.actionsByTag.get(tag) ?? []) {
      total += action.costs.reduce((sum, cost) => sum + cost.amount, 0);
      count += 1;
    }
  }
  if (count === 0) return 0;
  // 지친 주체에게는 같은 비용이 더 크게 느껴진다 — energy 는 자기 감각이다
  const fatigue = 1 + (100 - view.selfNumber("energy", 100)) / 100;
  return (total / count) * COST_SCALE * fatigue;
}

/** ⑩ risk — 행동 위험도 × 위험 민감도, 그리고 믿고 있는 대상의 위험 (§22 getRiskSensitivity) */
function evaluateExpectedRisk(runtime: WorldRuntime, view: BeliefView, goal: GoalNode): number {
  let risk = 0;
  let count = 0;
  for (const tag of goal.allowedActionTags) {
    for (const action of runtime.index.actionsByTag.get(tag) ?? []) {
      risk += action.risk;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const sensitivity = (100 - view.trait("riskTolerance")) / 50;
  return (risk / count) * RISK_SCALE * sensitivity;
}

export function riskSensitivity(view: BeliefView): number {
  return (100 - view.trait("riskTolerance")) / 50;
}

// --- 목적 그래프 (§19 GoalEdge) --------------------------------------------------

function edgesFrom(graph: GoalGraph, goalId: string, relation: GoalEdge["relation"]): GoalEdge[] {
  return graph.edges.filter((edge) => edge.from === goalId && edge.relation === relation);
}

function edgesTo(graph: GoalGraph, goalId: string, relation: GoalEdge["relation"]): GoalEdge[] {
  return graph.edges.filter((edge) => edge.to === goalId && edge.relation === relation);
}

export function goalGraphOf(runtime: WorldRuntime, view: BeliefView): GoalGraph | undefined {
  const graphId = view.goalGraphId();
  if (graphId === "") return undefined;
  return runtime.index.goalGraphs.get(graphId);
}

/** 위임 목적 노드는 전용 그래프에서 찾는다 (§17 조직 → 개인) */
export const DELEGATED_GRAPH_ID = "goal_graph.delegated";

export function findGoalNode(
  runtime: WorldRuntime,
  view: BeliefView,
  goalId: string,
): GoalNode | undefined {
  const own = goalGraphOf(runtime, view)?.nodes.find((node) => node.id === goalId);
  if (own !== undefined) return own;
  return runtime.index.goalGraphs.get(DELEGATED_GRAPH_ID)?.nodes.find((node) => node.id === goalId);
}

// --- 활성도 계산 ----------------------------------------------------------------

export interface GoalActivationResult extends ActiveGoalState {
  breakdown: GoalActivationBreakdown;
}

/**
 * §20 calculateGoalActivation — 충돌항(conflict)을 뺀 나머지 10항.
 * 충돌은 다른 목적의 활성도를 알아야 계산할 수 있으므로 rankGoals 가 2차 통과에서 뺀다.
 */
export function calculateGoalActivation(
  runtime: WorldRuntime,
  agentId: string,
  goal: GoalNode,
  view: BeliefView = new BeliefView(runtime, agentId),
): GoalActivationResult {
  const breakdown = zeroBreakdown(goal.baseImportance);

  // 포기 조건·달성 조건은 활성도 이전의 문제다 (§19)
  if (
    goal.abandonmentConditions.length > 0 &&
    view.evaluateConditions(goal.abandonmentConditions, undefined, { unknown: "fail" }).ok
  ) {
    return { goalId: goal.id, activation: Number.NEGATIVE_INFINITY, urgency: 0, breakdown };
  }
  if (
    goal.targetConditions.length > 0 &&
    view.evaluateConditions(goal.targetConditions, undefined, { unknown: "fail" }).ok
  ) {
    return { goalId: goal.id, activation: Number.NEGATIVE_INFINITY, urgency: 0, breakdown };
  }

  breakdown.needPressure = evaluateNeedPressure(runtime, view, goal);
  breakdown.urgency = evaluateUrgency(view, goal.urgencyPolicy);
  breakdown.valueAlignment = evaluateValueAlignment(view, goal);
  breakdown.relationshipImpact = evaluateRelationshipImpact(view, goal);
  breakdown.emotionalBias = evaluateEmotionalBias(view, goal);
  breakdown.feasibility = evaluateFeasibility(runtime, view, goal);
  breakdown.expectedUtility = evaluateExpectedUtility(view, goal);
  breakdown.cost = evaluateExpectedCost(runtime, view, goal);
  breakdown.risk = evaluateExpectedRisk(runtime, view, goal);

  return {
    goalId: goal.id,
    activation: sumBreakdown(breakdown),
    urgency: breakdown.urgency,
    breakdown,
  };
}

/** 위임받은 목적의 활성도 — 조직이 준 중요도에 충성도와 그 조직에 대한 신뢰가 곱해진다 (§17, §18-6) */
function delegatedActivation(
  runtime: WorldRuntime,
  view: BeliefView,
  goal: GoalNode,
  importance: number,
  fromId: string,
): GoalActivationResult {
  const result = calculateGoalActivation(runtime, view.agentId, goal, view);
  if (result.activation === Number.NEGATIVE_INFINITY) return result;
  const relation = view.relationTo(fromId);
  const loyalty = view.trait("loyalty") / 100;
  const acceptance = loyalty * 0.6 + ((relation.trust + relation.respect + 100) / 400) * 0.4;
  // 조직이 시킨 중요도는 그대로 들어오지 않는다 — 받아들이는 정도만큼만 들어온다
  result.breakdown.baseImportance += importance * acceptance;
  result.breakdown.relationshipImpact += (relation.trust + relation.respect - relation.fear) * 0.05;
  result.activation = sumBreakdown(result.breakdown);
  result.source = "delegated";
  return result;
}

/**
 * 활성도 내림차순 목적 목록 (동점은 목적 id 사전순 — 결정론).
 *  1차: 자기 그래프 노드 + 위임 목적의 10항 활성도
 *  2차: conflicts 엣지로 서로 깎는다 (§19 "가족 생존 ↕ 신념", §20 conflict)
 *       requires 엣지: 선행 목적이 미충족이면 부모의 활성도를 자식에게 위임한다
 */
export function rankGoals(runtime: WorldRuntime, agentId: string): GoalActivationResult[] {
  const view = new BeliefView(runtime, agentId);
  const agent = runtime.agentRuntime(agentId);
  const graph = goalGraphOf(runtime, view);
  const results = new Map<string, GoalActivationResult>();

  if (graph !== undefined) {
    for (const node of graph.nodes) {
      results.set(node.id, calculateGoalActivation(runtime, agentId, node, view));
    }
  }

  // 조직이 위임한 목적 (§17) — 기한이 지난 위임은 스스로 접힌다
  agent.delegations = agent.delegations.filter((delegation) => delegation.expiresAt > view.now);
  for (const delegation of agent.delegations) {
    const node = findGoalNode(runtime, view, delegation.goalId);
    if (node === undefined) continue;
    const result = delegatedActivation(runtime, view, node, delegation.importance, delegation.fromId);
    const existing = results.get(node.id);
    if (existing === undefined || result.activation > existing.activation) results.set(node.id, result);
  }

  // requires: 선행 목적이 아직 이루어지지 않았다면 부모의 힘이 자식으로 흐른다 (§19)
  if (graph !== undefined) {
    for (const [goalId, result] of [...results].sort(([a], [b]) => a.localeCompare(b))) {
      if (result.activation === Number.NEGATIVE_INFINITY) continue;
      for (const edge of edgesTo(graph, goalId, "requires")) {
        const child = results.get(edge.from);
        if (child === undefined || child.activation === Number.NEGATIVE_INFINITY) continue;
        child.breakdown.baseImportance += result.activation * edge.weight;
        child.activation = sumBreakdown(child.breakdown);
      }
    }

    // supports: A→B supports 는 "A 를 이루는 것이 B 에 도움이 된다" (§19).
    // 도움받는 목적(B)이 중요할수록 돕는 목적(A)도 끌려 올라간다 — requires 의 절반 강도.
    for (const [goalId, result] of [...results].sort(([a], [b]) => a.localeCompare(b))) {
      if (result.activation === Number.NEGATIVE_INFINITY) continue;
      for (const edge of edgesTo(graph, goalId, "supports")) {
        const supporter = results.get(edge.from);
        if (supporter === undefined || supporter.activation === Number.NEGATIVE_INFINITY) continue;
        supporter.breakdown.baseImportance += Math.max(0, result.activation) * edge.weight * 0.5;
        supporter.activation = sumBreakdown(supporter.breakdown);
      }
    }

    // conflicts: 충돌하는 목적끼리 서로의 활성도만큼 깎는다
    const snapshot = new Map([...results].map(([id, result]) => [id, result.activation]));
    for (const edge of graph.edges) {
      if (edge.relation !== "conflicts") continue;
      for (const [fromId, toId] of [
        [edge.from, edge.to],
        [edge.to, edge.from],
      ]) {
        const result = results.get(fromId!);
        const other = snapshot.get(toId!);
        if (result === undefined || other === undefined) continue;
        if (result.activation === Number.NEGATIVE_INFINITY || other === Number.NEGATIVE_INFINITY) continue;
        result.breakdown.conflict += Math.max(0, other) * edge.weight * 0.5;
        result.activation = sumBreakdown(result.breakdown);
      }
    }

    // alternative: 같은 필요를 채우는 대안끼리는 더 유망한 쪽이 남는다 (§19).
    // conflicts 와 달리 한쪽만 물러난다 — 주체가 한 번에 한 대안만 좇게 한다.
    const alternativeSnapshot = new Map([...results].map(([id, result]) => [id, result.activation]));
    for (const edge of graph.edges) {
      if (edge.relation !== "alternative") continue;
      const fromActivation = alternativeSnapshot.get(edge.from);
      const toActivation = alternativeSnapshot.get(edge.to);
      if (fromActivation === undefined || toActivation === undefined) continue;
      if (fromActivation === Number.NEGATIVE_INFINITY || toActivation === Number.NEGATIVE_INFINITY) continue;
      // 활성도가 같으면 from 이 남는다 — 결정론 (§39)
      const [weaker, strongerActivation] =
        fromActivation >= toActivation
          ? [results.get(edge.to), fromActivation]
          : [results.get(edge.from), toActivation];
      if (weaker === undefined) continue;
      weaker.breakdown.conflict += Math.max(0, strongerActivation) * edge.weight * 0.5;
      weaker.activation = sumBreakdown(weaker.breakdown);
    }
  }

  // 후속 목적(creates/reveals)으로 열린 목적은 조금 더 밀어 준다 (§44-10)
  for (const goalId of agent.unlockedGoals) {
    const result = results.get(goalId);
    if (result === undefined) continue;
    result.breakdown.baseImportance += 8;
    result.activation = sumBreakdown(result.breakdown);
  }

  // 실행 수단이 없어 접어 둔 목적은 쿨다운이 끝날 때까지 제외한다 (§27 handleNoAvailableAction)
  return [...results.values()]
    .filter((result) => result.activation > Number.NEGATIVE_INFINITY)
    .filter((result) => (agent.goalCooldowns[result.goalId] ?? 0) <= view.now)
    .sort((a, b) =>
      a.activation === b.activation ? a.goalId.localeCompare(b.goalId) : b.activation - a.activation,
    );
}

/**
 * 목적 상태 갱신 — 달성/포기를 감지해 후속 목적을 열고 실패 기억을 남긴다 (§19, §24, §44-10).
 * 재판단마다 호출된다.
 */
export function updateGoalLifecycle(runtime: WorldRuntime, agentId: string): void {
  const view = new BeliefView(runtime, agentId);
  const graph = goalGraphOf(runtime, view);
  if (graph === undefined) return;
  const agent = runtime.agentRuntime(agentId);

  for (const node of graph.nodes) {
    if (
      node.targetConditions.length > 0 &&
      view.evaluateConditions(node.targetConditions, undefined, { unknown: "fail" }).ok
    ) {
      // §19 completionEffects — 달성이 처음 확인되는 순간 1회 적용.
      // 상태 변경은 state_changed 규칙으로 이어지므로 완료가 세계에 파문을 남긴다.
      agent.completedGoals ??= [];
      if (!agent.completedGoals.includes(node.id)) {
        agent.completedGoals.push(node.id);
        const effects = node.completionEffects ?? [];
        if (effects.length > 0) {
          runtime.store.withContext(
            { sourceId: agentId, targetIds: [agentId], tags: ["goal_completed", node.id] },
            () => {
              for (const effect of effects) {
                runtime.store.modify(
                  effect.targetId ?? agentId,
                  effect.stateKey,
                  effect.operation,
                  effect.value,
                );
              }
            },
          );
        }
      }
      // creates/reveals — 이룬 목적이 새 목적을 연다
      for (const edge of [...edgesFrom(graph, node.id, "creates"), ...edgesFrom(graph, node.id, "reveals")]) {
        if (agent.unlockedGoals.includes(edge.to)) continue;
        agent.unlockedGoals.push(edge.to);
        runtime.store.noteChange({
          entityId: agentId,
          stateKey: `goal_unlocked:${edge.to}`,
          before: false,
          after: true,
        });
      }
      continue;
    }
    if (
      node.abandonmentConditions.length > 0 &&
      view.evaluateConditions(node.abandonmentConditions, undefined, { unknown: "fail" }).ok
    ) {
      // 포기 — 실패 기억을 남긴다 (§24 생성 시점 "실패")
      const alreadyRemembered = agent.memories.some(
        (memory) => memory.type === "failure" && memory.tags.includes(node.id),
      );
      if (alreadyRemembered) continue;
      rememberEvent(runtime, agentId, {
        type: "failure",
        participants: [agentId],
        tags: [node.id, "abandonment"],
        emotionalIntensity: 45,
        relevance: 50,
        confidence: 1,
      });
    }
  }
}
