// RULE-MOVE-PROGRESS-001 — Implements INTENT-MOVE-001 · INTENT-ACTION-PROGRESS-001
//                          · INTENT-BODY-FACING-001 (C006 R1 — 움직이면 그 방향을 향한다)
// Input          경과 시간 dt, CurrentAction.Kind = move 인 모든 Actor    ← C002 CHANGED
// Preconditions  CurrentAction.TargetPosition 이 존재한다
// Transition     TargetPosition 방향으로 (MoveSpeed × Modifiers × 달리기 배율) × dt 만큼 이동,
//                Facing = 이동 방향                                        ← C007 CHANGED
//                도달하면 Position = TargetPosition, CurrentAction = idle
// Result         Progress | Arrived

import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { faceToward } from '../semantic/collision';
import { effectiveMoveSpeed } from '../semantic/combat';
import type { WorldState } from '../semantic/world-state';

export function ruleMoveProgressActor(actor: ActorState, dt: number): 'progress' | 'arrived' | 'none' {
  const action = actor.currentAction;
  if (action.kind !== 'move' || !action.targetPosition) return 'none';

  const dx = action.targetPosition.x - actor.position.x;
  const dz = action.targetPosition.z - actor.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  // C007 CHANGED — 빠르기는 이동 속도 능력치 × 배율 × (달리는 중이면 달리기 배율) 이다
  // (INTENT-TEMPO-MOVE-001 · INTENT-RUN-001).
  const step = effectiveMoveSpeed(actor) * dt;

  faceToward(actor, dx, dz); // RULE-BODY-FACING-001 — 움직이는 방향을 향한다 (C006 R1)

  if (dist <= step) {
    actor.position = { x: action.targetPosition.x, z: action.targetPosition.z };
    actor.currentAction = idleAction();
    return 'arrived';
  }

  actor.position = {
    x: actor.position.x + (dx / dist) * step,
    z: actor.position.z + (dz / dist) * step,
  };
  return 'progress';
}

export function ruleMoveProgress(state: WorldState, dt: number): void {
  for (const actor of state.actors) ruleMoveProgressActor(actor, dt);
}
