// 행동의 시간 점유와 실행 (기획서 §21, §27-7~10, Phase-1 §1.4)
// 공간 이동은 세계 규칙이 아니라 행동 체계의 내장 효과다 — 나머지 결과는 전부 executionRules 가 만든다.
import type { ScheduledActionState } from "../../shared/beliefs";
import { distance3d, type Position } from "../../shared/state";
import type { RuleRegistry } from "../rules/RuleRegistry";
import type { WorldRuntime } from "../world/WorldRuntime";
import type { ActionDefinition } from "../world/types";

/** 지역 내 이동 속도 (거리 단위/분) — travelCost 가 없는 지역 내부 이동에 쓴다 */
export const WALK_SPEED = 0.5;
/** 도주 시 물러나는 거리 */
export const FLEE_DISTANCE = 45;
/** 행동은 반드시 시간을 점유한다 — duration 0 은 같은 tick 무한 루프를 만든다 */
export const MIN_ACTION_DURATION = 1;

export const ACTION_COMPLETED_EVENT = "action_completed";
export const AGENT_REPLAN_EVENT = "agent_replan";

export interface PlannedAction {
  action: ActionDefinition;
  targetIds: string[];
  goalId: string;
}

function positionOf(runtime: WorldRuntime, entityId: string): Position | undefined {
  return runtime.store.entity(entityId).position;
}

/**
 * 이동 소요 시간 (§13 travelCost + 지역 내 3D 거리).
 * 지역이 다르면 연결이 있어야 하며, 없으면 undefined(그 대상에게는 갈 수 없다).
 */
export function travelDuration(
  runtime: WorldRuntime,
  actorId: string,
  targetId: string,
): number | undefined {
  const from = positionOf(runtime, actorId);
  const to = positionOf(runtime, targetId);
  if (from === undefined || to === undefined) return undefined;
  if (from.regionId === to.regionId) {
    return Math.max(MIN_ACTION_DURATION, Math.ceil(distance3d(from, to) / WALK_SPEED));
  }
  const connection = runtime.index.connection(from.regionId, to.regionId);
  if (connection === undefined) return undefined;
  // 지역 경계를 넘는 비용 + 도착 지역 입구(지역 중심)에서 대상까지의 거리
  const entry = runtime.store.findEntity(to.regionId)?.position;
  const inner = entry === undefined ? 0 : distance3d(entry, to);
  return Math.max(MIN_ACTION_DURATION, connection.travelCost + Math.ceil(inner / WALK_SPEED));
}

/** 행동의 실제 소요 시간 — travel 정책이면 대상까지의 이동 시간 */
export function resolveDuration(
  runtime: WorldRuntime,
  actorId: string,
  action: ActionDefinition,
  targetIds: string[],
): number | undefined {
  if (action.durationPolicy !== "travel") {
    return Math.max(MIN_ACTION_DURATION, action.duration);
  }
  const targetId = targetIds[0];
  if (targetId === undefined) return undefined;
  return travelDuration(runtime, actorId, targetId);
}

function clampToRegion(runtime: WorldRuntime, position: Position): Position {
  const region = runtime.index.regions.get(position.regionId);
  if (region === undefined) return position;
  const clamp = (v: number, max: number): number => (v < 0 ? 0 : v > max ? max : v);
  return {
    regionId: position.regionId,
    x: clamp(position.x, region.bounds.width),
    y: clamp(position.y, region.bounds.height),
    z: clamp(position.z, region.bounds.depth),
  };
}

/** 행동에 선언된 공간 이동을 적용한다 (§13) */
export function applyMovement(
  runtime: WorldRuntime,
  actorId: string,
  action: ActionDefinition,
  targetIds: string[],
): void {
  if (action.movement === undefined) return;
  const targetId = targetIds[0];
  if (targetId === undefined) return;
  const from = positionOf(runtime, actorId);
  const to = positionOf(runtime, targetId);
  if (from === undefined || to === undefined) return;

  if (action.movement === "to_target") {
    runtime.store.moveEntity(actorId, { ...to });
    return;
  }
  // away_from_target — 같은 지역 안에서 대상 반대 방향으로 물러난다
  if (from.regionId !== to.regionId) return;
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const dz = from.z - to.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const unit = length === 0 ? { x: 1, y: 0, z: 0 } : { x: dx / length, y: dy / length, z: dz / length };
  runtime.store.moveEntity(
    actorId,
    clampToRegion(runtime, {
      regionId: from.regionId,
      x: from.x + unit.x * FLEE_DISTANCE,
      y: from.y + unit.y * FLEE_DISTANCE,
      z: from.z + unit.z * FLEE_DISTANCE,
    }),
  );
}

/** §27-7 비용 지불 → §27-8 행동 예약 */
export function startAction(
  runtime: WorldRuntime,
  agentId: string,
  planned: PlannedAction,
  duration: number,
): ScheduledActionState {
  const agent = runtime.agentRuntime(agentId);
  const now = runtime.state.simulationTime;
  const eventId = `action.${agentId}.${now}.${agent.completedActionCount}`;

  runtime.store.withContext(
    {
      sourceId: agentId,
      targetIds: planned.targetIds,
      tags: ["action_started", planned.action.id, planned.goalId],
    },
    () => {
      for (const cost of planned.action.costs) {
        runtime.store.modify(agentId, cost.stateKey, "add", -cost.amount);
      }
      runtime.store.modify(agentId, "current_action", "set", planned.action.id);
      runtime.store.modify(agentId, "active_goal", "set", planned.goalId);
    },
  );

  const scheduled: ScheduledActionState = {
    actionId: planned.action.id,
    targetIds: planned.targetIds,
    startedAt: now,
    completesAt: now + duration,
    eventId,
    goalId: planned.goalId,
  };
  agent.currentAction = scheduled;
  agent.lastReplanAt = now;

  runtime.scheduler.schedule({
    id: eventId,
    executeAt: scheduled.completesAt,
    type: ACTION_COMPLETED_EVENT,
    targetIds: [agentId],
    payload: { agentId, actionId: scheduled.actionId, targetIds: scheduled.targetIds },
    priority: 0,
  });
  return scheduled;
}

/**
 * §27-9~10 행동 완료 — 세계 규칙을 실행하고 상태 변화·관찰 신호를 만든다.
 * 재판단은 여기서 하지 않는다. §26 순서대로 updateUrgentAgents 가 맡는다.
 */
export function completeAction(
  runtime: WorldRuntime,
  rules: RuleRegistry,
  agentId: string,
  scheduled: ScheduledActionState,
): void {
  const action = runtime.index.actions.get(scheduled.actionId);
  const agent = runtime.agentRuntime(agentId);
  if (action !== undefined) {
    const locationId = positionOf(runtime, agentId)?.regionId;
    runtime.store.withContext(
      {
        sourceId: agentId,
        targetIds: scheduled.targetIds,
        ...(locationId !== undefined ? { locationId } : {}),
        tags: ["action", action.id, scheduled.goalId],
      },
      () => {
        applyMovement(runtime, agentId, action, scheduled.targetIds);
        rules.dispatchAction(runtime, action.id, agentId, scheduled.targetIds);
      },
    );
  }
  agent.currentAction = null;
  agent.completedActionCount += 1;
  runtime.store.modify(agentId, "current_action", "set", "");
}
