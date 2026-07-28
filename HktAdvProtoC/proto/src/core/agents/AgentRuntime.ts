// 주체 실행 사이클 (기획서 §26, §27 / Phase-3 §3.8)
//
// 판단의 알맹이는 GoalSystem(§20)·ActionPlanner(§22)·PerceptionSystem(§23) 이 갖는다.
// 이 파일은 그 순서를 지키는 사이클과, 하루 한 번의 유지 작업(압력·기억·약속·조직)만 담당한다.
import type { ScheduledActionState } from "../../shared/beliefs";
import { isPlayerState } from "../../shared/player";
import {
  AGENT_REPLAN_EVENT,
  resolveDuration,
  startAction,
  type PlannedAction,
} from "../actions/ActionSystem";
import { TICKS_PER_DAY } from "../../shared/time";
import type { WorldRuntime } from "../world/WorldRuntime";
import {
  acceptableScore,
  generateActionCandidates,
  goalCooldownFor,
  selectAction,
  type ActionCandidate,
} from "./ActionPlanner";
import { BeliefView } from "./BeliefView";
import { checkFactionCollapse, syncDelegations } from "./FactionRuntime";
import { accumulatePressures, findGoalNode, rankGoals, updateGoalLifecycle } from "./GoalSystem";
import { maintainMemories, rememberEvent } from "./MemorySystem";
import { resolveDuePromises } from "./RelationshipSystem";

/**
 * 행동 중인 주체가 압력 때문에 다시 판단할 수 있는 최소 간격.
 * §26 shouldReplan 은 상태 조건만 보므로, 이 장치가 없으면 압력이 높은 주체는 매 이벤트마다 계획을 갈아엎는다.
 */
export const REPLAN_COOLDOWN = 60;
/** 조직의 재판단 주기 — 개인보다 느리다 (§17, Phase-3 §3.7) */
export const FACTION_REPLAN_INTERVAL = TICKS_PER_DAY;
const IDLE_ACTION_ID = "action.rest";

export type { ActionCandidate };
export {
  generateActionCandidates,
  selectAction,
  scoreActionCandidate,
} from "./ActionPlanner";
export { calculateGoalActivation, rankGoals } from "./GoalSystem";

// --- 재판단 조건 (§26) ------------------------------------------------------------

/** §26 shouldReplan — 기획서 조건 그대로. 조직은 자기 위기 지표와 느린 주기를 쓴다(§17). */
export function shouldReplan(runtime: WorldRuntime, agentId: string): boolean {
  const agent = runtime.agentRuntime(agentId);
  // §31 판단 분기 — 플레이어는 시스템이 계획하지 않는다. 행동 선택만 사용자에게 넘어간다.
  if (isPlayerState(agent)) return false;
  const urgentFlag =
    agent.flags.includes("important_observation") ||
    agent.flags.includes("goal_invalidated") ||
    agent.flags.includes("relationship_shift");

  if (agent.kind === "faction") {
    // 조직은 하루에 한 번 판단한다. 위기·급변은 그 주기를 1/4 까지만 앞당긴다 (§17 느린 주체)
    const sinceLast = runtime.state.simulationTime - agent.lastReplanAt;
    if (sinceLast >= FACTION_REPLAN_INTERVAL) return true;
    if (sinceLast < FACTION_REPLAN_INTERVAL / 4) return false;
    return urgentFlag || runtime.store.readNumber(agentId, "crisis") > 70;
  }
  return (
    agent.currentAction === null ||
    urgentFlag ||
    runtime.store.readNumber(agentId, "survivalPressure") > 70 ||
    runtime.store.readNumber(agentId, "stress") > 85
  );
}

/** §27 createIdleAction — 할 수 있는 일이 없으면 쉰다 */
function idlePlan(runtime: WorldRuntime, agentId: string): PlannedAction | undefined {
  const action = runtime.index.actions.get(IDLE_ACTION_ID);
  if (action === undefined) return undefined;
  if (runtime.agentRuntime(agentId).kind === "faction") return undefined; // 조직은 쉬지 않는다
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

/** §27 replanAgent — 목적 활성도 → 목적 선택 → 행동 후보 → 선택 → 비용 → 예약 */
export function replanAgent(runtime: WorldRuntime, agentId: string): void {
  const agent = runtime.agentRuntime(agentId);
  const view = new BeliefView(runtime, agentId);

  updateGoalLifecycle(runtime, agentId);
  const ranked = rankGoals(runtime, agentId);
  runtime.store.setActiveGoals(agentId, ranked);

  for (const goalState of ranked) {
    const goal = findGoalNode(runtime, view, goalState.goalId);
    if (goal === undefined) continue;

    const candidates = generateActionCandidates(runtime, agentId, goal, view);
    const selected = selectAction(view, candidates);
    // §27 handleNoAvailableAction — 할 수 있는 행동이 없거나, 기대 이득보다 비용·위험이 크면
    // 그 목적을 잠시 접고(쿨다운) 차선 목적으로 넘어간다.
    if (selected === undefined || selected.score <= acceptableScore(goalState.activation)) {
      agent.goalCooldowns[goal.id] = runtime.state.simulationTime + goalCooldownFor(view, goal.id);
      continue;
    }

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

  const idle = idlePlan(runtime, agentId);
  if (idle !== undefined) {
    const duration = resolveDuration(runtime, agentId, idle.action, []) ?? idle.action.duration;
    commit(runtime, agentId, idle, duration);
    return;
  }
  // 할 일이 없는 조직·빈 세계 — 다음 판단만 예약해 둔다
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
  syncDelegations(runtime);
  for (const agentId of runtime.agentIds()) {
    const agent = runtime.agentRuntime(agentId);
    if (!shouldReplan(runtime, agentId)) continue;
    // 행동 중인데 압력 때문에 재판단하는 경우는 최소 간격을 둔다 (계획 갈아엎기 방지)
    if (agent.currentAction !== null && now - agent.lastReplanAt < REPLAN_COOLDOWN) continue;
    replanAgent(runtime, agentId);
    agent.flags = agent.flags.filter(
      (flag) =>
        flag !== "important_observation" &&
        flag !== "goal_invalidated" &&
        flag !== "relationship_shift",
    );
  }
}

// --- 행동의 기억 (§24 생성 시점 — 상호작용·성공) ------------------------------------

/** 행동이 끝나면 행위자와 대상 모두에게 기억이 남는다 */
export function rememberActionOutcome(
  runtime: WorldRuntime,
  agentId: string,
  scheduled: ScheduledActionState,
): void {
  const action = runtime.index.actions.get(scheduled.actionId);
  if (action === undefined) return;
  const targets = scheduled.targetIds.filter((id) => id !== agentId);
  rememberEvent(runtime, agentId, {
    type: "success",
    participants: [agentId, ...targets],
    tags: [...action.tags, scheduled.goalId],
    emotionalIntensity: Math.min(100, action.risk),
    relevance: 40,
    confidence: 1,
  });
  for (const targetId of targets) {
    if (runtime.state.agentRuntimes[targetId] === undefined) continue;
    rememberEvent(runtime, targetId, {
      type: "interaction",
      participants: [targetId, agentId],
      tags: [...action.tags],
      emotionalIntensity: Math.min(100, action.risk * 1.2),
      relevance: 45,
      confidence: 0.9,
    });
  }
}

// --- 하루 한 번의 유지 (§8 압력 · §24 기억 · §25 약속 · §17 조직) ---------------------

export interface DailyMaintenanceReport {
  day: number;
  memoryCounts: Record<string, number>;
  promiseOutcomes: number;
  collapsedFactions: string[];
}

export function maintainAgentsDaily(runtime: WorldRuntime): DailyMaintenanceReport {
  const report: DailyMaintenanceReport = {
    day: Math.floor(runtime.state.simulationTime / TICKS_PER_DAY),
    memoryCounts: {},
    promiseOutcomes: 0,
    collapsedFactions: [],
  };

  for (const agentId of runtime.agentIds()) {
    accumulatePressures(runtime, agentId);
    maintainMemories(runtime, agentId);
    report.memoryCounts[agentId] = runtime.agentRuntime(agentId).memories.length;
  }
  report.promiseOutcomes = resolveDuePromises(runtime).length;
  report.collapsedFactions = checkFactionCollapse(runtime);
  return report;
}
