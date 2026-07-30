// Phase-9 §9.3 — 플레이어 연속 이동 (MMORPG 조작의 코어 층)
//
// 이동은 행동(§21)이 아니라 **행동 체계의 내장 공간 효과의 연속형**이다 —
// ActionSystem.applyMovement(순간 배치)와 같은 층에 서고, 감각·신호·사건은 기존 파이프라인이 처리한다.
// §26 이벤트 기반 루프와의 정합: 이동 중일 때만 1 tick 간격 체인 이벤트가 존재한다(조용한 tick 을 만들지 않는다).
// 결정론: player_move/player_travel 은 다른 요청과 같은 "입력"이다 — 같은 시퀀스면 같은 세계.
import { distance3d, type Position } from "../../shared/state";
import { isPlayerState, type PlayerRuntimeState } from "../../shared/player";
import type { RuleEngine } from "../rules/RuleEngine";
import type { ScheduledSimulationEvent } from "../simulation/Scheduler";
import type { WorldRuntime } from "../world/WorldRuntime";
import { crossableConnectionBetween, WALK_SPEED } from "../actions/ActionSystem";
import { appendJournal, findPlayerId } from "./PlayerAgent";

/**
 * 달리기 속도 (거리/tick) — WALK_SPEED(0.5) 의 4배.
 * 결정론에 영향을 주는 상수이므로 헤더에 고정한다(CVar 금지 — 루트 CLAUDE.md 규약).
 * NPC 는 아직 달리지 않는다(§35 기준선 보호) — 기존 행동 이동(순간 배치)을 유지한다.
 */
export const PLAYER_MOVE_SPEED = WALK_SPEED * 4;

export const PLAYER_MOVE_STEP_EVENT = "player_move_step";
export const PLAYER_TRAVEL_ARRIVE_EVENT = "player_travel_arrive";

export interface MoveOutcome {
  accepted: boolean;
  reason?: string;
}

function playerOf(runtime: WorldRuntime): PlayerRuntimeState | undefined {
  const playerId = findPlayerId(runtime);
  if (playerId === undefined) return undefined;
  const agent = runtime.state.agentRuntimes[playerId];
  return agent !== undefined && isPlayerState(agent) ? agent : undefined;
}

/** 지역 경계로 자른다 — ActionSystem.clampToRegion 과 같은 규약(z 는 현재 값 유지) */
function clampTarget(runtime: WorldRuntime, regionId: string, x: number, y: number, z: number): Position {
  const region = runtime.index.regions.get(regionId);
  const clamp = (v: number, max: number): number => (v < 0 ? 0 : v > max ? max : v);
  if (region === undefined) return { regionId, x, y, z };
  return {
    regionId,
    x: clamp(x, region.bounds.width),
    y: clamp(y, region.bounds.height),
    z: clamp(z, region.bounds.depth),
  };
}

/** 진행 중인 이동 체인·지역 이동을 멈춘다 — 행동 시작(§31)·조작 해제가 부른다 */
export function cancelPlayerMovement(runtime: WorldRuntime, player: PlayerRuntimeState): void {
  if (player.moveEventId !== undefined) {
    runtime.scheduler.cancel(player.moveEventId);
    delete player.moveEventId;
  }
  delete player.moveTarget;
  if (player.travel !== undefined) {
    runtime.scheduler.cancel(player.travel.eventId);
    delete player.travel;
  }
}

/** 진행 중 행동을 접는다 — §31 재판단과 같은 취소 경로 (MMORPG 의 "움직이면 시전 취소") */
function cancelCurrentAction(runtime: WorldRuntime, player: PlayerRuntimeState): string | undefined {
  const previous = player.currentAction;
  if (previous === null || previous === undefined) return undefined;
  runtime.scheduler.cancel(previous.eventId);
  player.currentAction = null;
  return previous.actionId;
}

function nextMoveEventId(player: PlayerRuntimeState, kind: "pmove" | "ptravel"): string {
  const seq = player.moveSeq ?? 0;
  player.moveSeq = seq + 1;
  return `${kind}.${player.agentId}.${seq}`;
}

/**
 * player_move — 현재 지역 안 목표점으로 달리기 시작.
 * 수락 시 진행 중 행동·이전 이동은 취소되고, 1 tick 뒤부터 체인 이벤트가 전진시킨다.
 */
export function requestPlayerMove(runtime: WorldRuntime, x: number, y: number): MoveOutcome {
  const player = playerOf(runtime);
  if (player === undefined) return { accepted: false, reason: "조작 중인 주체가 없다 — attach_player 가 먼저다" };
  if (player.travel !== undefined) return { accepted: false, reason: "지역을 건너는 중이다 — 도착까지 이동할 수 없다" };
  const position = runtime.store.findEntity(player.agentId)?.position;
  if (position === undefined) return { accepted: false, reason: "위치가 없는 주체는 이동할 수 없다" };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { accepted: false, reason: "목표 좌표가 유효하지 않다" };

  cancelPlayerMovement(runtime, player);
  cancelCurrentAction(runtime, player);

  player.moveTarget = clampTarget(runtime, position.regionId, x, y, position.z);
  const eventId = nextMoveEventId(player, "pmove");
  player.moveEventId = eventId;
  runtime.scheduler.schedule({
    id: eventId,
    executeAt: runtime.state.simulationTime + 1,
    type: PLAYER_MOVE_STEP_EVENT,
    targetIds: [player.agentId],
    payload: { agentId: player.agentId },
    priority: 0,
  });
  return { accepted: true };
}

/**
 * 이동 체인 한 걸음 — 목표 방향으로 PLAYER_MOVE_SPEED 만큼 전진, 도달하면 체인 종료.
 * 위치 변경은 moveEntity 로 — change 로그·감각·사건 탐지는 기존 파이프라인이 그대로 본다.
 */
export function handlePlayerMoveStep(runtime: WorldRuntime, event: ScheduledSimulationEvent): void {
  const player = playerOf(runtime);
  // 조작 해제·목표 소거·다른 체인으로 대체된 뒤의 뒤늦은 걸음은 버린다
  if (player === undefined || player.moveTarget === undefined || player.moveEventId !== event.id) return;
  const position = runtime.store.findEntity(player.agentId)?.position;
  if (position === undefined || position.regionId !== player.moveTarget.regionId) {
    cancelPlayerMovement(runtime, player);
    return;
  }

  const target = player.moveTarget;
  const remaining = distance3d(position, target);
  runtime.store.withContext(
    { sourceId: player.agentId, tags: ["move", "player_move"] },
    () => {
      if (remaining <= PLAYER_MOVE_SPEED) {
        runtime.store.moveEntity(player.agentId, { ...target });
        return;
      }
      const unit = {
        x: (target.x - position.x) / remaining,
        y: (target.y - position.y) / remaining,
        z: (target.z - position.z) / remaining,
      };
      runtime.store.moveEntity(player.agentId, {
        regionId: position.regionId,
        x: position.x + unit.x * PLAYER_MOVE_SPEED,
        y: position.y + unit.y * PLAYER_MOVE_SPEED,
        z: position.z + unit.z * PLAYER_MOVE_SPEED,
      });
    },
  );

  if (remaining <= PLAYER_MOVE_SPEED) {
    delete player.moveTarget;
    delete player.moveEventId;
    return;
  }
  const eventId = nextMoveEventId(player, "pmove");
  player.moveEventId = eventId;
  runtime.scheduler.schedule({
    id: eventId,
    executeAt: runtime.state.simulationTime + 1,
    type: PLAYER_MOVE_STEP_EVENT,
    targetIds: [player.agentId],
    payload: { agentId: player.agentId },
    priority: 0,
  });
}

/**
 * player_travel — §13 연결을 따라 지역을 건넌다.
 * canCross 검증(조건부 길은 조건대로), travelCost tick 뒤 도착 이벤트.
 */
export function requestPlayerTravel(runtime: WorldRuntime, toRegionId: string): MoveOutcome {
  const player = playerOf(runtime);
  if (player === undefined) return { accepted: false, reason: "조작 중인 주체가 없다 — attach_player 가 먼저다" };
  if (player.travel !== undefined) return { accepted: false, reason: "이미 지역을 건너는 중이다" };
  const position = runtime.store.findEntity(player.agentId)?.position;
  if (position === undefined) return { accepted: false, reason: "위치가 없는 주체는 이동할 수 없다" };
  if (position.regionId === toRegionId) return { accepted: false, reason: "이미 그 지역에 있다" };
  if (runtime.index.regions.get(toRegionId) === undefined) {
    return { accepted: false, reason: `그런 지역이 없다: ${toRegionId}` };
  }
  const connection = crossableConnectionBetween(runtime, player.agentId, position.regionId, toRegionId);
  if (connection === undefined) {
    return { accepted: false, reason: "그 지역으로 열린 길이 없다 (§13 연결·통행 조건)" };
  }

  cancelPlayerMovement(runtime, player);
  cancelCurrentAction(runtime, player);

  const eventId = nextMoveEventId(player, "ptravel");
  const arrivesAt = runtime.state.simulationTime + Math.max(1, connection.travelCost);
  player.travel = { toRegionId, arrivesAt, eventId };
  runtime.scheduler.schedule({
    id: eventId,
    executeAt: arrivesAt,
    type: PLAYER_TRAVEL_ARRIVE_EVENT,
    targetIds: [player.agentId],
    payload: { agentId: player.agentId, toRegionId },
    priority: 0,
  });
  appendJournal(runtime, player, {
    kind: "action",
    key: "travel",
    subjectIds: [toRegionId],
    detail: `${position.regionId} → ${toRegionId} (${connection.travelCost}분)`,
  });
  return { accepted: true };
}

/** 도착 — 지역 입구(지역 개체 위치, 없으면 중심)에 배치하고 §11.1 entity_entered 를 발화한다 */
export function handlePlayerTravelArrive(
  runtime: WorldRuntime,
  rules: RuleEngine,
  event: ScheduledSimulationEvent,
): void {
  const player = playerOf(runtime);
  if (player === undefined || player.travel === undefined || player.travel.eventId !== event.id) return;
  const toRegionId = player.travel.toRegionId;
  delete player.travel;

  const region = runtime.index.regions.get(toRegionId);
  const regionEntity = runtime.store.findEntity(toRegionId);
  const entry: Position =
    regionEntity?.position !== undefined
      ? { ...regionEntity.position, regionId: toRegionId }
      : {
          regionId: toRegionId,
          x: (region?.bounds.width ?? 0) / 2,
          y: (region?.bounds.height ?? 0) / 2,
          z: 0,
        };

  runtime.store.withContext(
    { sourceId: player.agentId, tags: ["move", "player_travel"], locationId: toRegionId },
    () => {
      runtime.store.moveEntity(player.agentId, entry);
      // §11.1 entity_entered — 행동 이동(completeAction)과 같은 규약으로 발화한다
      rules.dispatchEntityEntered(runtime, player.agentId, regionEntity?.tags ?? []);
    },
  );
}
