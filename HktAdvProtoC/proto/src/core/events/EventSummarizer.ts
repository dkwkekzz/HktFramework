// 사건 요약 (기획서 §26 updateEventSummaries, §28 affectedStates, §44-9·§44-10 / Phase-4 §4.2)
//
// 여기까지가 Phase 4 의 몫이다 — **구조화된 요약**만 만든다. 사람이 읽는 문장은 Phase 8 Event Interpreter 의 일이다.
// 요약은 두 단계로 나뉜다.
//  ① absorbIntoSummary : change 를 흡수할 때마다 영향 상태의 첫 값·마지막 값을 누적한다(원본 change 는 곧 폐기되므로).
//  ② refreshSummary    : 주기마다 파생값(순변화 수·새 목적·목적 충돌)을 다시 계산한다.
import type { RawWorldChange } from "../../shared/change";
import type { AffectedStateSummary, EventSummary, GoalConflict, WorldEvent } from "../../shared/events";
import type { ActionDefinition, GoalNode } from "../world/types";
import type { WorldRuntime } from "../world/WorldRuntime";

/** 사건 하나가 추적하는 영향 상태 수 상한 — 넘으면 변화가 잦은 것부터 남긴다 */
export const MAX_AFFECTED_STATES = 80;

function emptySummary(): EventSummary {
  return {
    affectedStateSummaries: [],
    netChangedStateCount: 0,
    newlyActivatedGoals: [],
    goalConflicts: [],
    totalChangeCount: 0,
    lastUpdatedAt: 0,
  };
}

function stateKeyOf(entityId: string, stateKey: string): string {
  return `${entityId}.${stateKey}`;
}

/** §28 affectedStates 누적 — 첫 값은 사건이 시작되기 직전 값, 마지막 값은 지금 값이다 */
export function absorbIntoSummary(
  runtime: WorldRuntime,
  event: WorldEvent,
  changes: RawWorldChange[],
): void {
  const summary = (event.summary ??= emptySummary());
  const index = new Map(
    summary.affectedStateSummaries.map((entry) => [stateKeyOf(entry.entityId, entry.stateKey), entry]),
  );

  for (const change of changes) {
    summary.totalChangeCount += 1;
    for (const state of change.changedStates) {
      const key = stateKeyOf(state.entityId, state.stateKey);
      const existing = index.get(key);
      if (existing === undefined) {
        const entry: AffectedStateSummary = {
          entityId: state.entityId,
          stateKey: state.stateKey,
          before: state.before,
          after: state.after,
          changeCount: 1,
        };
        index.set(key, entry);
        summary.affectedStateSummaries.push(entry);
        if (!event.affectedStates.includes(key)) event.affectedStates.push(key);
        continue;
      }
      existing.after = state.after;
      existing.changeCount += 1;
    }
  }

  for (const entry of summary.affectedStateSummaries) {
    // 순변화는 숫자 상태에만 있다 — 불리언·문자열 상태는 before/after 로만 남는다
    if (typeof entry.before === "number" && typeof entry.after === "number") {
      entry.delta = entry.after - entry.before;
    } else {
      delete entry.delta;
    }
  }

  if (summary.affectedStateSummaries.length > MAX_AFFECTED_STATES) {
    summary.affectedStateSummaries.sort((a, b) => b.changeCount - a.changeCount);
    summary.affectedStateSummaries = summary.affectedStateSummaries.slice(0, MAX_AFFECTED_STATES);
  }
  // 표시 순서를 고정한다 — 같은 시드면 같은 요약이 나와야 한다(§39)
  summary.affectedStateSummaries.sort((a, b) =>
    a.entityId === b.entityId ? a.stateKey.localeCompare(b.stateKey) : a.entityId.localeCompare(b.entityId),
  );
  event.affectedStates = [...new Set(event.affectedStates)].sort();
  summary.netChangedStateCount = summary.affectedStateSummaries.filter(
    (entry) => entry.delta !== undefined && entry.delta !== 0,
  ).length;
  summary.lastUpdatedAt = runtime.state.simulationTime;
}

// --- 목적 충돌 (§44-7) --------------------------------------------------------------

/** 목적이 세계에 거는 요구 — "누구의 어떤 상태를 어느 쪽으로" */
interface GoalDemand {
  agentId: string;
  goalId: string;
  entityId: string;
  stateKey: string;
  direction: "increase" | "decrease";
}

function goalNodeOf(runtime: WorldRuntime, goalId: string): GoalNode | undefined {
  for (const graph of runtime.definition.goalTemplates) {
    const node = graph.nodes.find((candidate) => candidate.id === goalId);
    if (node !== undefined) return node;
  }
  return undefined;
}

function hasState(runtime: WorldRuntime, entityId: string, stateKey: string): boolean {
  const entity = runtime.store.findEntity(entityId);
  if (entity === undefined) return false;
  return runtime.schemas.find(runtime.store.ownerTypeOf(entity), stateKey) !== undefined;
}

/**
 * 목적 하나가 거는 요구를 뽑는다.
 * desiredChanges 는 "무엇을 어느 쪽으로"만 말하고 **누구의** 상태인지는 말하지 않는다 —
 * 그 답은 행동 정의에 있다(§21 expectedEffects.on = actor|target). 그래서 목적 → 허용 행동 → 효과 대상 순으로 역산한다.
 */
function demandsOf(
  runtime: WorldRuntime,
  agentId: string,
  node: GoalNode,
  participants: string[],
): GoalDemand[] {
  const demands: GoalDemand[] = [];
  const push = (entityId: string, stateKey: string, direction: "increase" | "decrease"): void => {
    if (
      demands.some(
        (demand) =>
          demand.entityId === entityId && demand.stateKey === stateKey && demand.direction === direction,
      )
    ) {
      return;
    }
    demands.push({ agentId, goalId: node.id, entityId, stateKey, direction });
  };

  const actions: ActionDefinition[] = [];
  for (const tag of node.allowedActionTags) {
    for (const action of runtime.index.actionsByTag.get(tag) ?? []) {
      if (!actions.includes(action)) actions.push(action);
    }
  }

  for (const desired of node.desiredChanges) {
    for (const action of actions) {
      for (const effect of action.expectedEffects) {
        if (effect.stateKey !== desired.stateKey || effect.direction !== desired.direction) continue;
        if (effect.on === "actor") {
          if (hasState(runtime, agentId, desired.stateKey)) push(agentId, desired.stateKey, desired.direction);
          continue;
        }
        // 대상에게 거는 요구 — 이 사건의 참여자 중 그 상태를 가진 쪽이 대상이다
        for (const participantId of participants) {
          if (participantId === agentId) continue;
          if (!hasState(runtime, participantId, desired.stateKey)) continue;
          push(participantId, desired.stateKey, desired.direction);
        }
      }
    }
  }
  return demands;
}

/**
 * 사건 참여자들의 활성 목적이 서로 배타적인 쌍을 찾는다 (§44-7).
 * 같은 개체의 같은 상태를 한쪽은 올리려 하고 다른 쪽은 내리려 한다 — 그것이 목적 충돌이다.
 */
export function findGoalConflicts(runtime: WorldRuntime, event: WorldEvent): GoalConflict[] {
  const demands: GoalDemand[] = [];
  for (const participantId of event.participants) {
    const entity = runtime.store.findEntity(participantId);
    if (entity === undefined) continue;
    for (const active of entity.activeGoals ?? []) {
      const node = goalNodeOf(runtime, active.goalId);
      if (node === undefined) continue;
      demands.push(...demandsOf(runtime, participantId, node, event.participants));
    }
  }

  const conflicts: GoalConflict[] = [];
  for (let i = 0; i < demands.length; i++) {
    for (let j = i + 1; j < demands.length; j++) {
      const left = demands[i]!;
      const right = demands[j]!;
      if (left.agentId === right.agentId) continue;
      if (left.entityId !== right.entityId || left.stateKey !== right.stateKey) continue;
      if (left.direction === right.direction) continue;
      conflicts.push({
        entityId: left.entityId,
        stateKey: left.stateKey,
        left: { agentId: left.agentId, goalId: left.goalId, demand: left.direction },
        right: { agentId: right.agentId, goalId: right.goalId, demand: right.direction },
      });
    }
  }
  return conflicts;
}

/** 충돌에 등장하는 주체 수 — §44-7 "세 주체 이상의 목적이 충돌하는 사건" 의 판정값 */
export function conflictingAgents(conflicts: GoalConflict[]): string[] {
  const agents = new Set<string>();
  for (const conflict of conflicts) {
    agents.add(conflict.left.agentId);
    agents.add(conflict.right.agentId);
  }
  return [...agents].sort();
}

// --- §26 ⑦ updateEventSummaries -----------------------------------------------------

/** 사건 시작 이후 참여자에게 새로 활성화된 목적 (§44-10 후속 목적) */
function newlyActivatedGoals(runtime: WorldRuntime, event: WorldEvent): { agentId: string; goalId: string }[] {
  const baseline = new Set(event.baselineGoals.map((goal) => `${goal.agentId}|${goal.goalId}`));
  const found: { agentId: string; goalId: string }[] = [];
  for (const participantId of event.participants) {
    const entity = runtime.store.findEntity(participantId);
    for (const active of entity?.activeGoals ?? []) {
      const key = `${participantId}|${active.goalId}`;
      if (baseline.has(key)) continue;
      if (found.some((goal) => goal.agentId === participantId && goal.goalId === active.goalId)) continue;
      found.push({ agentId: participantId, goalId: active.goalId });
    }
  }
  return found;
}

/**
 * §26 ⑦ — 탐지가 한 번 돌고 난 뒤 사건 요약의 파생값을 갱신한다.
 * 진행 중 사건과 방금 종결된 사건만 손댄다(이미 닫힌 사건의 결과는 바뀌지 않는다).
 */
export function updateEventSummaries(runtime: WorldRuntime): number {
  const store = runtime.state.events;
  if (store.lastSummaryAt >= store.lastDetectionAt) return 0;

  let updated = 0;
  for (const event of store.events) {
    if (event.status === "concluded" && (event.concludedAt ?? 0) < store.lastSummaryAt) continue;
    const summary = (event.summary ??= emptySummary());
    summary.newlyActivatedGoals = newlyActivatedGoals(runtime, event);
    summary.goalConflicts = findGoalConflicts(runtime, event);
    summary.lastUpdatedAt = runtime.state.simulationTime;
    updated += 1;
  }
  store.lastSummaryAt = store.lastDetectionAt;
  return updated;
}
