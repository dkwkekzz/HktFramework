// RULE-MOVE-PROGRESS-001 — Implements INTENT-MOVE-001 · INTENT-ACTION-PROGRESS-001
// Input          경과 시간 dt, CurrentAction.Kind = move 인 모든 Actor    ← C002 CHANGED
// Preconditions  CurrentAction.TargetPosition 이 존재한다
// Transition     TargetPosition 방향으로 MoveSpeed × dt 만큼 이동
//                도달하면 Position = TargetPosition, CurrentAction = idle
// Result         Progress | Arrived

import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import type { WorldState } from '../semantic/world-state';

export function ruleMoveProgressActor(actor: ActorState, dt: number): 'progress' | 'arrived' | 'none' {
  const action = actor.currentAction;
  if (action.kind !== 'move' || !action.targetPosition) return 'none';

  const dx = action.targetPosition.x - actor.position.x;
  const dz = action.targetPosition.z - actor.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const step = actor.moveSpeed * dt;

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
