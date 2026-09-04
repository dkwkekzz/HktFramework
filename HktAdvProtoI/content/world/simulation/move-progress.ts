// RULE-MOVE-PROGRESS-001 — Implements INTENT-MOVE-001 · INTENT-ACTION-PROGRESS-001
// · INTENT-BODY-FACING-001 (움직이면 그 방향을 향한다)
// Input          경과 시간 dt, CurrentAction.Kind = move 인 모든 Actor
// Preconditions  CurrentAction.TargetPosition 이 존재한다
// Transition     TargetPosition 방향으로 (MoveSpeed × Modifiers × 달리기 배율) × dt 만큼 이동,
//                Facing = 이동 방향
//                도달하면 Position = TargetPosition, CurrentAction = idle
// Result         Progress | Arrived
//
// P6 CHANGED — 적분 자체는 엔진 솔버(physics/seek)가 한다. 이 Rule 이 소유하는 것은
// 걸음의 크기(이 세계의 능력치·배율)와 도착의 의미(행동이 idle 로 끝난다)다.
//
// C008 CHANGED — Transition 에 한 줄이 는다: Actor.movedThisTick = 이번 tick 에 실제로 옮겨진
// 거리 (움직이지 않았으면 0). 게임 명사가 없는 사실이고 걸음을 실제로 옮기는 자리가 여기뿐이라
// 여기가 적는다. 무엇이 이 값을 읽는지는 이 Rule 이 알지 못한다 (지금은 통로 규칙 하나다).

import { integrateSeek } from '../../../engine/physics/seek';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { faceToward } from '../semantic/collision';
import { effectiveMoveSpeed } from '../semantic/combat';
import type { WorldState } from '../semantic/world-state';

export function ruleMoveProgressActor(actor: ActorState, dt: number): 'progress' | 'arrived' | 'none' {
  const action = actor.currentAction;
  // 이번 tick 의 기록은 언제나 여기서 시작한다 — 움직이지 않은 몸은 0 이지 지난 tick 의 값이 아니다.
  actor.movedThisTick = 0;
  if (action.kind !== 'move' || !action.targetPosition) return 'none';

  const before = { x: actor.position.x, z: actor.position.z };

  // 빠르기는 이동 속도 능력치 × 배율 × (달리는 중이면 달리기 배율) 이다
  // (INTENT-TEMPO-MOVE-001 · INTENT-RUN-001).
  const step = effectiveMoveSpeed(actor) * dt;
  const seek = integrateSeek(actor, action.targetPosition, step);

  faceToward(actor, seek.dx, seek.dz); // RULE-BODY-FACING-001 — 움직이는 방향을 향한다

  // 실제로 옮겨진 거리다 — 걸음의 크기(step)가 아니라 자리의 차다. 도착한 tick 은 걸음보다
  // 짧게 가고, 이미 목표에 서 있으면 0 이다 (SPEC-003 경계 "서 있으면 오르지 않는다").
  actor.movedThisTick = Math.hypot(actor.position.x - before.x, actor.position.z - before.z);

  if (seek.arrived) {
    actor.currentAction = idleAction();
    return 'arrived';
  }
  return 'progress';
}

export function ruleMoveProgress(state: WorldState, dt: number): void {
  for (const actor of state.actors) ruleMoveProgressActor(actor, dt);
}
