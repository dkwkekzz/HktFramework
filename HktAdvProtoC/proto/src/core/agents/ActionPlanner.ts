// 행동 후보 생성과 선택 (기획서 §21, §22, §27-5·6 / Phase-3 §3.6)
//
// 대상 열거는 **아는 대상만**(BeliefView), 조건 평가는 **믿음으로**(§20).
// 선택은 최고 점수 1개가 아니라 성향에 따른 확률적 선택이다(§22 weightedSoftmaxSelection) —
// "항상 최고 점수만 선택하면 모든 행동이 지나치게 최적화된다".
import { resolveDuration, travelDuration } from "../actions/ActionSystem";
import { CROSS_REGION_DISTANCE } from "../world/Conditions";
import type { WorldRuntime } from "../world/WorldRuntime";
import type { ActionDefinition, GoalNode } from "../world/types";
import { BeliefView } from "./BeliefView";
import { riskSensitivity, TAG_TRAIT } from "./GoalSystem";

/** 접근(이동) 후보의 기대 진척도 할인 — 다가가는 것 자체는 목적을 이루지 않는다 */
const APPROACH_DISCOUNT = 0.6;
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
const TRAIT_ALIGNMENT_SCALE = 0.08;
/**
 * 이 점수 이하의 후보는 "하지 않는 편이 낫다"로 본다 (§27 handleNoAvailableAction).
 * 활성도가 높아도 실행 수단이 없는 목적을 붙잡고 있지 않게 하는 장치다.
 */
export const MIN_ACCEPTABLE_SCORE = 0;
/**
 * 절박함이 기준선을 낮춘다.
 * §22 의 점수는 목적의 활성도를 모른다 — 굶어 죽기 직전에도 "비용이 이득보다 크다"는 결론이 나온다.
 * 활성도가 높을수록 감수하는 손해가 커진다(§8 생존 압력이 판단을 밀어붙이는 지점).
 */
const DESPERATION_PER_ACTIVATION = 0.06;

/** 이 목적을 위해 받아들일 수 있는 최저 점수 */
export function acceptableScore(activation: number): number {
  if (!Number.isFinite(activation)) return MIN_ACCEPTABLE_SCORE;
  return MIN_ACCEPTABLE_SCORE - Math.max(0, activation) * DESPERATION_PER_ACTIVATION;
}
export const MOVE_ACTION_ID = "action.move";
/** softmax 온도 하한 — 0 이면 결정론적 최고 점수 선택이 된다 */
const MIN_TEMPERATURE = 0.02;
/** 확률적 선택에 올릴 상위 후보 수 */
const SOFTMAX_POOL = 4;

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

function valueAlignmentOf(view: BeliefView, action: ActionDefinition): number {
  let alignment = 0;
  for (const tag of action.tags) {
    const traitKey = TAG_TRAIT[tag];
    if (traitKey === undefined) continue;
    alignment += view.trait(traitKey, 0) * TRAIT_ALIGNMENT_SCALE;
  }
  return alignment;
}

function costOf(action: ActionDefinition, duration: number, distance: number): number {
  const stateCost = action.costs.reduce((sum, cost) => sum + cost.amount, 0) * COST_SCALE;
  const distanceCost = Number.isFinite(distance) ? distance / DISTANCE_COST_DIVISOR : 0;
  return stateCost + duration / DURATION_COST_DIVISOR + distanceCost;
}

/** 대상에게 느끼는 위험 — 관계의 공포와 믿고 있는 공격성이 위험도를 키운다 (§10, §25) */
function perceivedRisk(view: BeliefView, action: ActionDefinition, targetId: string | undefined): number {
  if (targetId === undefined) return action.risk;
  const relation = view.relationTo(targetId);
  const believedAggression = view.perceive(targetId, "aggression");
  const aggression = typeof believedAggression.value === "number" ? believedAggression.value : 0;
  return action.risk + relation.fear * 0.3 + aggression * 0.3 * believedAggression.confidence;
}

/** §22 scoreActionCandidate — 계수는 기획서 그대로 */
export function scoreActionCandidate(view: BeliefView, candidate: ActionCandidate): ActionCandidate {
  candidate.score =
    candidate.expectedGoalProgress * 1.4 +
    candidate.valueAlignment +
    candidate.confidence * 0.7 -
    candidate.expectedCost -
    candidate.expectedRisk * RISK_SCALE * riskSensitivity(view);
  return candidate;
}

function actionsForGoal(runtime: WorldRuntime, goal: GoalNode): ActionDefinition[] {
  const found = new Map<string, ActionDefinition>();
  for (const tag of goal.allowedActionTags) {
    for (const action of runtime.index.actionsByTag.get(tag) ?? []) found.set(action.id, action);
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * §22 generateActionCandidates —
 *   allowedActionTags → actorRequirements 필터 → 대상 열거(아는 대상만) → 점수화.
 * 조건 평가에서 "모르는 값"은 후보를 막지 않고 confidence 를 깎는다 —
 * 그래서 잘못된 믿음을 가진 주체는 **실패할 행동을 실제로 시도한다**(§44-6).
 */
export function generateActionCandidates(
  runtime: WorldRuntime,
  agentId: string,
  goal: GoalNode,
  view: BeliefView = new BeliefView(runtime, agentId),
): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];
  const moveAction = runtime.index.actions.get(MOVE_ACTION_ID);

  for (const action of actionsForGoal(runtime, goal)) {
    const actorCheck = view.evaluateConditions(action.actorRequirements);
    if (!actorCheck.ok) continue;
    const progress = expectedProgress(action, goal);
    const alignment = valueAlignmentOf(view, action);

    if (action.targetQuery.kind === "none") {
      const duration = resolveDuration(runtime, agentId, action, []);
      if (duration === undefined) continue;
      const worldCheck = view.evaluateConditions(action.worldRequirements);
      if (!worldCheck.ok) continue;
      candidates.push(
        scoreActionCandidate(view, {
          actionId: action.id,
          targetIds: [],
          expectedGoalProgress: progress,
          expectedCost: costOf(action, duration, 0),
          expectedRisk: action.risk,
          valueAlignment: alignment,
          confidence: actorCheck.confidence * worldCheck.confidence,
          score: 0,
          duration,
          goalId: goal.id,
        }),
      );
      continue;
    }

    const reachable = view.findTargets(action.targetQuery);
    for (const target of reachable) {
      const worldCheck = view.evaluateConditions(action.worldRequirements, target.id);
      if (!worldCheck.ok) continue;
      const duration = resolveDuration(runtime, agentId, action, [target.id]);
      if (duration === undefined) continue;
      const distance = target.id === agentId ? 0 : view.distanceTo(target.id);
      candidates.push(
        scoreActionCandidate(view, {
          actionId: action.id,
          targetIds: [target.id],
          expectedGoalProgress: progress,
          expectedCost: costOf(action, duration, distance),
          expectedRisk: perceivedRisk(view, action, target.id),
          valueAlignment: alignment,
          confidence: actorCheck.confidence * worldCheck.confidence,
          score: 0,
          duration,
          goalId: goal.id,
        }),
      );
    }

    // 사거리 안에 대상이 없으면 "다가가는" 후보를 만든다 (§27-5).
    // 물러나는 행동(도주)에는 만들지 않는다 — 피하려는 대상에게 다가가는 계획은 없다.
    if (reachable.length > 0 || moveAction === undefined) continue;
    if (action.movement === "away_from_target") continue;
    if (!view.evaluateConditions(moveAction.actorRequirements).ok) continue;
    for (const target of view.findTargets(action.targetQuery, { ignoreDistance: true })) {
      // 도착해서도 못 할 행동이면 다가갈 이유가 없다
      const worldCheck = view.evaluateConditions(action.worldRequirements, target.id);
      if (!worldCheck.ok) continue;
      const duration = travelDuration(runtime, agentId, target.id);
      if (duration === undefined) continue;
      candidates.push(
        scoreActionCandidate(view, {
          actionId: moveAction.id,
          targetIds: [target.id],
          // 다가가는 값어치는 도착해서 할 행동의 값어치에서 나온다 — 그 행동의 비용·위험도 함께 짊어진다
          expectedGoalProgress: progress * APPROACH_DISCOUNT,
          expectedCost: costOf(moveAction, duration, 0) + costOf(action, 0, 0) * APPROACH_DISCOUNT,
          expectedRisk:
            moveAction.risk + perceivedRisk(view, action, target.id) * APPROACH_DISCOUNT,
          valueAlignment: alignment * APPROACH_DISCOUNT,
          confidence: actorCheck.confidence * worldCheck.confidence * APPROACH_DISCOUNT,
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

function candidateKey(candidate: ActionCandidate): string {
  return `${candidate.actionId}|${candidate.targetIds.join(",")}`;
}

/** 후보 정렬 — 점수 내림차순, 동점은 행동 id → 대상 id 사전순 (결정론) */
export function sortCandidates(candidates: ActionCandidate[]): ActionCandidate[] {
  return [...candidates].sort((a, b) =>
    a.score === b.score ? candidateKey(a).localeCompare(candidateKey(b)) : b.score - a.score,
  );
}

/**
 * §22 selectAction — 상위 후보 중 성향에 따라 확률적으로 고른다.
 * randomness = impulsiveness * 0.01 + stress * 0.005 (기획서 계수 그대로).
 * 난수는 (worldSeed, simulationStep, agentId#select) 스트림이므로 같은 시드면 같은 선택이다(§39).
 */
export function selectAction(
  view: BeliefView,
  candidates: ActionCandidate[],
): ActionCandidate | undefined {
  const sorted = sortCandidates(candidates);
  const best = sorted[0];
  if (best === undefined) return undefined;

  const randomness = view.trait("impulsiveness", 0) * 0.01 + view.selfNumber("stress") * 0.005;
  const temperature = Math.max(MIN_TEMPERATURE, randomness);
  if (randomness <= MIN_TEMPERATURE) return best;

  const pool = sorted.slice(0, SOFTMAX_POOL);
  const weights = pool.map((candidate) =>
    Math.exp((candidate.score - best.score) / (temperature * 10)),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return best;

  let roll = view.random(`select.${candidateKey(best)}`) * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return best;
}

/** 후보가 없거나 전부 손해인 목적은 잠시 접는다 (§27 handleNoAvailableAction, §35 deadlock 방지) */
export function goalCooldownFor(view: BeliefView, goalId: string): number {
  // 참을성이 없는 주체일수록 빨리 다시 시도한다
  const patience = view.trait("patience");
  return Math.round(60 + patience * 2 + (goalId.length % 5));
}

export { CROSS_REGION_DISTANCE };
