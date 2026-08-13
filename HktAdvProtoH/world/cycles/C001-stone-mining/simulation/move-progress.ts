// RULE-MOVE-PROGRESS-001 — Implements INTENT-MOVE-001 (시간 진행 법칙)
// Input          경과 시간 dt
// Preconditions  Actor.MoveTarget 이 존재한다
// Transition     MoveTarget 방향으로 MoveSpeed × dt 만큼 이동, 도달 시 MoveTarget 제거
// Result         Progress | Arrived

import type { WorldState } from '../../../kernel/state';

export function ruleMoveProgress(state: WorldState, dt: number): 'progress' | 'arrived' | 'none' {
  const actor = state.actor;
  if (!actor.moveTarget) return 'none';

  const dx = actor.moveTarget.x - actor.position.x;
  const dz = actor.moveTarget.z - actor.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const step = actor.moveSpeed * dt;

  if (dist <= step) {
    actor.position = { x: actor.moveTarget.x, z: actor.moveTarget.z };
    actor.moveTarget = null;
    return 'arrived';
  }

  actor.position = {
    x: actor.position.x + (dx / dist) * step,
    z: actor.position.z + (dz / dist) * step,
  };
  return 'progress';
}
