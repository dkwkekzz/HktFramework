// 주체 실행 사이클 (기획서 §26, §27, Phase-1 §1.2·1.3)
//
// Phase 1 은 판단을 "간이형"으로 둔다 — 활성도는 baseImportance + 긴급도 두 항, 행동 선택은 최고 점수 1개.
// 데이터 구조(§19 GoalNode, §22 ActionCandidate)는 기획서 그대로이므로 Phase 3 은 아래 네 함수만 교체한다:
//   calculateGoalActivation / generateActionCandidates / scoreActionCandidate / selectAction
import type { ActiveGoalState } from "../../shared/beliefs";
import {
  AGENT_REPLAN_EVENT,
  resolveDuration,
  startAction,
  travelDuration,
  type PlannedAction,
} from "../actions/ActionSystem";
import { distanceBetween, evaluateAll, type EvalScope } from "../world/Conditions";
import { findTargets } from "../world/Queries";
import type { WorldRuntime } from "../world/WorldRuntime";
import type { ActionDefinition, GoalNode, UrgencyPolicy } from "../world/types";
import { findBelief } from "./BeliefStore";

/** 접근(이동) 후보의 기대 진척도 할인 — 다가가는 것 자체는 목적을 이루지 않는다 */
const APPROACH_DISCOUNT = 0.6;
const DIRECT_CONFIDENCE = 0.8;
const APPROACH_CONFIDENCE = 0.5;
/** 거리도 비용이다 — 가까운 대상을 먼저 고르게 하는 항 */
const DISTANCE_COST_DIVISOR = 25;
/** 시간도 비용이다 (분 → 비용) */
const DURATION_COST_DIVISOR = 60;
/**
 * §22 점수식의 항들은 서로 단위가 다르다(상태 변화량 / 상태 소모량 / 0~100 위험도).
 * 아래 두 계수가 그 단위를 맞춘다 — 값이 커지면 세계의 모든 주체가 겁이 많고 인색해진다.
 */
const COST_SCALE = 0.5;
const RISK_SCALE = 0.25;
/**
 * 행동 중인 주체가 압력 때문에 다시 판단할 수 있는 최소 간격.
 * §26 shouldReplan 은 상태 조건만 보므로, 이 장치가 없으면 압력이 높은 주체는 매 이벤트마다 계획을 갈아엎는다.
 */
export const REPLAN_COOLDOWN = 60;
/**
 * 이 점수 이하의 후보는 "하지 않는 편이 낫다"로 본다.
 * 활성도가 높아도 실행 수단이 없는 목적을 붙잡고 있지 않게 하는 장치 —
 * §20 활성도의 feasibility 항이 Phase 3 에서 들어오면 이 임계값은 사라진다.
 */
const MIN_ACCEPTABLE_SCORE = 0;
const MOVE_ACTION_ID = "action.move";
const IDLE_ACTION_ID = "action.rest";

/** 행동 태그 → 이 행동에 끌리는 성향 (§18 판단 변수, §22 valueAlignment) */
const TAG_TRAIT: Record<string, string> = {
  investigate: "curiosity",
  track: "curiosity",
  trade: "greed",
  combat: "vengefulness",
  attack: "vengefulness",
  report: "loyalty",
  gather: "patience",
  flee: "empathy",
  rest: "patience",
};
const TRAIT_ALIGNMENT_SCALE = 0.08;

export interface ActionCandidate {
  actionId: string;
  targetIds: string[];
  expectedGoalProgress: number;
  expectedCost: number;
  expectedRisk: number;
  valueAlignment: number;
  confidence: number;
  score: number;
  /** 이 후보가 "다가가기"라면 원래 하려던 행동 */
  approachFor?: string;
  duration: number;
  goalId: string;
}

// --- 목적 활성도 (§19, §20 의 Phase 1 간이형) -----------------------------------

function urgencyValue(runtime: WorldRuntime, agentId: string, policy: UrgencyPolicy): number {
  if (policy.type === "constant") return policy.value;

  let raw: unknown;
  switch (policy.source) {
    case "self":
      raw = runtime.store.read(agentId, policy.stateKey);
      break;
    case "entity":
      raw =
        policy.entityId === undefined
          ? undefined
          : runtime.store.findEntity(policy.entityId) === undefined
            ? undefined
            : runtime.store.read(policy.entityId, policy.stateKey);
      break;
    case "belief": {
      if (policy.subjectId === undefined) break;
      raw = findBelief(runtime.agentRuntime(agentId), policy.subjectId, policy.stateKey)
        ?.believedValue;
      break;
    }
  }
  if (typeof raw !== "number") return 0;
  const gap = policy.comparison === ">" ? raw - policy.threshold : policy.threshold - raw;
  if (gap <= 0) return 0;
  return Math.min(policy.max, gap * policy.weight);
}

export function calculateGoalActivation(
  runtime: WorldRuntime,
  agentId: string,
  goal: GoalNode,
): ActiveGoalState {
  const scope: EvalScope = { runtime, actorId: agentId };
  if (goal.abandonmentConditions.length > 0 && evaluateAll(goal.abandonmentConditions, scope)) {
    return { goalId: goal.id, activation: Number.NEGATIVE_INFINITY, urgency: 0 };
  }
  // 이미 이루어진 목적은 활성화되지 않는다 (§19 targetConditions)
  if (goal.targetConditions.length > 0 && evaluateAll(goal.targetConditions, scope)) {
    return { goalId: goal.id, activation: Number.NEGATIVE_INFINITY, urgency: 0 };
  }
  const urgency = urgencyValue(runtime, agentId, goal.urgencyPolicy);
  return { goalId: goal.id, activation: goal.baseImportance + urgency, urgency };
}

/** 활성도 내림차순 목적 목록 (동점은 목적 id 사전순 — 결정론) */
export function rankGoals(runtime: WorldRuntime, agentId: string): ActiveGoalState[] {
  const graphId = runtime.store.read(agentId, "goal_graph_id");
  if (typeof graphId !== "string") return [];
  const graph = runtime.index.goalGraphs.get(graphId);
  if (graph === undefined) return [];
  return graph.nodes
    .map((node) => calculateGoalActivation(runtime, agentId, node))
    .filter((state) => state.activation > Number.NEGATIVE_INFINITY)
    .sort((a, b) =>
      a.activation === b.activation ? a.goalId.localeCompare(b.goalId) : b.activation - a.activation,
    );
}

// --- 행동 후보 (§22 의 Phase 1 간이형) -------------------------------------------

function actionsForGoal(runtime: WorldRuntime, goal: GoalNode): ActionDefinition[] {
  const found = new Map<string, ActionDefinition>();
  for (const tag of goal.allowedActionTags) {
    for (const action of runtime.index.actionsByTag.get(tag) ?? []) found.set(action.id, action);
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function expectedProgress(action: ActionDefinition, goal: GoalNode): number {
  let progress = 0;
  for (const effect of action.expectedEffects) {
    for (const desired of goal.desiredChanges) {
      if (effect.stateKey === desired.stateKey && effect.direction === desired.direction) {
        progress += effect.magnitude * desired.weight;
      }
    }
  }
  return progress;
}

function valueAlignmentOf(runtime: WorldRuntime, agentId: string, action: ActionDefinition): number {
  const traits = runtime.agentRuntime(agentId).traits;
  let alignment = 0;
  for (const tag of action.tags) {
    const traitKey = TAG_TRAIT[tag];
    if (traitKey === undefined) continue;
    alignment += (traits[traitKey] ?? 0) * TRAIT_ALIGNMENT_SCALE;
  }
  return alignment;
}

function riskSensitivity(runtime: WorldRuntime, agentId: string): number {
  const tolerance = runtime.agentRuntime(agentId).traits["riskTolerance"] ?? 50;
  return (100 - tolerance) / 50;
}

/** §22 scoreActionCandidate — 계수는 기획서 그대로, 확률적 선택(softmax)만 Phase 3 으로 미룬다 */
export function scoreActionCandidate(
  runtime: WorldRuntime,
  agentId: string,
  candidate: ActionCandidate,
): ActionCandidate {
  candidate.score =
    candidate.expectedGoalProgress * 1.4 +
    candidate.valueAlignment +
    candidate.confidence * 0.7 -
    candidate.expectedCost -
    candidate.expectedRisk * RISK_SCALE * riskSensitivity(runtime, agentId);
  return candidate;
}

function costOf(action: ActionDefinition, duration: number, distance: number): number {
  const stateCost = action.costs.reduce((sum, cost) => sum + cost.amount, 0) * COST_SCALE;
  const distanceCost = Number.isFinite(distance) ? distance / DISTANCE_COST_DIVISOR : 0;
  return stateCost + duration / DURATION_COST_DIVISOR + distanceCost;
}

export function generateActionCandidates(
  runtime: WorldRuntime,
  agentId: string,
  goal: GoalNode,
): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];
  const moveAction = runtime.index.actions.get(MOVE_ACTION_ID);

  for (const action of actionsForGoal(runtime, goal)) {
    const actorScope: EvalScope = { runtime, actorId: agentId };
    if (!evaluateAll(action.actorRequirements, actorScope)) continue;
    const progress = expectedProgress(action, goal);
    const alignment = valueAlignmentOf(runtime, agentId, action);

    if (action.targetQuery.kind === "none") {
      const duration = resolveDuration(runtime, agentId, action, []);
      if (duration === undefined) continue;
      if (!evaluateAll(action.worldRequirements, actorScope)) continue;
      candidates.push(
        scoreActionCandidate(runtime, agentId, {
          actionId: action.id,
          targetIds: [],
          expectedGoalProgress: progress,
          expectedCost: costOf(action, duration, 0),
          expectedRisk: action.risk,
          valueAlignment: alignment,
          confidence: DIRECT_CONFIDENCE,
          score: 0,
          duration,
          goalId: goal.id,
        }),
      );
      continue;
    }

    const reachable = findTargets(runtime, agentId, action.targetQuery);
    for (const target of reachable) {
      const scope: EvalScope = { runtime, actorId: agentId, targetId: target.id };
      if (!evaluateAll(action.worldRequirements, scope)) continue;
      const duration = resolveDuration(runtime, agentId, action, [target.id]);
      if (duration === undefined) continue;
      const distance = target.id === agentId ? 0 : distanceBetween(scope, agentId, target.id);
      candidates.push(
        scoreActionCandidate(runtime, agentId, {
          actionId: action.id,
          targetIds: [target.id],
          expectedGoalProgress: progress,
          expectedCost: costOf(action, duration, distance),
          expectedRisk: action.risk,
          valueAlignment: alignment,
          confidence: DIRECT_CONFIDENCE,
          score: 0,
          duration,
          goalId: goal.id,
        }),
      );
    }

    // 사거리 안에 대상이 없으면 "다가가는" 후보를 만든다 (§27-5 의 Phase 1 확장)
    if (reachable.length > 0 || moveAction === undefined) continue;
    if (!evaluateAll(moveAction.actorRequirements, actorScope)) continue;
    for (const target of findTargets(runtime, agentId, action.targetQuery, { ignoreDistance: true })) {
      // 도착해서도 못 할 행동이면 다가갈 이유가 없다
      if (!evaluateAll(action.worldRequirements, { runtime, actorId: agentId, targetId: target.id })) {
        continue;
      }
      const duration = travelDuration(runtime, agentId, target.id);
      if (duration === undefined) continue;
      candidates.push(
        scoreActionCandidate(runtime, agentId, {
          actionId: moveAction.id,
          targetIds: [target.id],
          // 다가가는 값어치는 도착해서 할 행동의 값어치에서 나온다 — 그 행동의 비용·위험도 함께 짊어진다
          expectedGoalProgress: progress * APPROACH_DISCOUNT,
          expectedCost: costOf(moveAction, duration, 0) + costOf(action, 0, 0) * APPROACH_DISCOUNT,
          expectedRisk: moveAction.risk + action.risk * APPROACH_DISCOUNT,
          valueAlignment: alignment * APPROACH_DISCOUNT,
          confidence: APPROACH_CONFIDENCE,
          score: 0,
          approachFor: action.id,
          duration,
          goalId: goal.id,
        }),
      );
    }
  }
  return candidates;
}

/**
 * §22 selectAction — Phase 1 은 최고 점수 1개(동점은 행동 id → 대상 id 사전순).
 * 개인 성향에 따른 확률적 선택(weightedSoftmaxSelection)은 Phase 3.
 */
export function selectAction(candidates: ActionCandidate[]): ActionCandidate | undefined {
  let best: ActionCandidate | undefined;
  for (const candidate of candidates) {
    if (best === undefined || candidate.score > best.score) {
      best = candidate;
      continue;
    }
    if (candidate.score === best.score) {
      const key = `${candidate.actionId}|${candidate.targetIds.join(",")}`;
      const bestKey = `${best.actionId}|${best.targetIds.join(",")}`;
      if (key.localeCompare(bestKey) < 0) best = candidate;
    }
  }
  return best;
}

// --- 재판단 (§26, §27) ----------------------------------------------------------

/** §26 shouldReplan — 기획서 조건 그대로 */
export function shouldReplan(runtime: WorldRuntime, agentId: string): boolean {
  const agent = runtime.agentRuntime(agentId);
  return (
    agent.currentAction === null ||
    agent.flags.includes("important_observation") ||
    agent.flags.includes("goal_invalidated") ||
    runtime.store.readNumber(agentId, "survivalPressure") > 70 ||
    runtime.store.readNumber(agentId, "stress") > 85
  );
}

/** §27 createIdleAction — 할 수 있는 일이 없으면 쉰다 */
function idlePlan(runtime: WorldRuntime): PlannedAction | undefined {
  const action = runtime.index.actions.get(IDLE_ACTION_ID);
  if (action === undefined) return undefined;
  return { action, targetIds: [], goalId: "goal.idle" };
}

/**
 * 결정을 실행에 옮긴다.
 * 다시 판단해도 결론이 같으면 진행 중인 행동을 그대로 둔다 — 그러지 않으면
 * 압력이 높은 주체는 재판단 때마다 자기 행동을 취소해 아무것도 끝내지 못한다.
 */
function commit(
  runtime: WorldRuntime,
  agentId: string,
  planned: PlannedAction,
  duration: number,
): void {
  const agent = runtime.agentRuntime(agentId);
  const current = agent.currentAction;
  if (
    current !== null &&
    current.actionId === planned.action.id &&
    current.targetIds.join(",") === planned.targetIds.join(",")
  ) {
    agent.lastReplanAt = runtime.state.simulationTime;
    return;
  }
  if (current !== null) {
    runtime.scheduler.cancel(current.eventId);
    agent.currentAction = null;
  }
  startAction(runtime, agentId, planned, duration);
}

/** §27 replanAgent — 목적 선택 → 후보 생성 → 선택 → 비용 → 예약 */
export function replanAgent(runtime: WorldRuntime, agentId: string): void {
  const agent = runtime.agentRuntime(agentId);
  const ranked = rankGoals(runtime, agentId);
  runtime.store.setActiveGoals(agentId, ranked);

  const graphId = runtime.store.read(agentId, "goal_graph_id");
  const graph = typeof graphId === "string" ? runtime.index.goalGraphs.get(graphId) : undefined;

  for (const goalState of ranked) {
    const goal = graph?.nodes.find((node) => node.id === goalState.goalId);
    if (goal === undefined) continue;

    const candidates = generateActionCandidates(runtime, agentId, goal);
    const selected = selectAction(candidates);
    // §27 handleNoAvailableAction — 할 수 있는 행동이 없거나, 기대 이득보다 비용·위험이 크면
    // 그 목적은 지금 실행 불가로 보고 다음 목적으로 넘어간다.
    if (selected === undefined || selected.score <= MIN_ACCEPTABLE_SCORE) continue;

    const action = runtime.index.actions.get(selected.actionId);
    if (action === undefined) continue;
    commit(
      runtime,
      agentId,
      { action, targetIds: selected.targetIds, goalId: goal.id },
      selected.duration,
    );
    return;
  }

  const idle = idlePlan(runtime);
  if (idle !== undefined) {
    commit(runtime, agentId, idle, idle.action.duration);
    return;
  }
  // 행동 정의조차 없는 세계(빈 세계) — 다음 판단만 예약해 둔다
  agent.lastReplanAt = runtime.state.simulationTime;
  runtime.scheduler.schedule({
    id: `replan.${agentId}.${runtime.state.simulationTime}`,
    executeAt: runtime.state.simulationTime + REPLAN_COOLDOWN,
    type: AGENT_REPLAN_EVENT,
    targetIds: [agentId],
    payload: { agentId },
    priority: -10,
  });
}

/** §26 updateUrgentAgents — 매 틱 전원을 판단하지 않는다. 필요한 주체만 다시 계획한다. */
export function updateUrgentAgents(runtime: WorldRuntime): void {
  const now = runtime.state.simulationTime;
  for (const agentId of runtime.agentIds()) {
    const agent = runtime.agentRuntime(agentId);
    if (!shouldReplan(runtime, agentId)) continue;
    // 행동 중인데 압력 때문에 재판단하는 경우는 최소 간격을 둔다 (계획 갈아엎기 방지)
    if (agent.currentAction !== null && now - agent.lastReplanAt < REPLAN_COOLDOWN) continue;
    replanAgent(runtime, agentId);
    agent.flags = agent.flags.filter(
      (flag) => flag !== "important_observation" && flag !== "goal_invalidated",
    );
  }
}
