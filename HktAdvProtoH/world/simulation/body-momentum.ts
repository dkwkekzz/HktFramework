// RULE-BODY-MOMENTUM-001 — Implements INTENT-BODY-MOMENTUM-001
// Input          모든 Actor, dt
// Preconditions  없음 — 몸은 언제나 물리 아래 있다
// Transition     Position += Velocity × dt (관성).
//                Velocity 는 FRICTION 으로 감쇠하고, REST_SPEED 아래로 잦아들면 0 이 된다.
//                Position 이 World.Bounds 를 벗어나면 경계에 고정하고
//                그 축의 Velocity 를 0 으로 한다 (경계 너머로는 밀리지 않는다).
// Result         Moved | Rested

import { FRICTION, REST_SPEED } from '../semantic/collision';
import type { WorldState } from '../semantic/world-state';

export function ruleBodyMomentum(state: WorldState, dt: number): void {
  const damping = Math.max(0, 1 - FRICTION * dt);

  for (const actor of state.actors) {
    actor.position.x += actor.velocity.x * dt;
    actor.position.z += actor.velocity.z * dt;

    actor.velocity.x *= damping;
    actor.velocity.z *= damping;
    const speed = Math.sqrt(actor.velocity.x ** 2 + actor.velocity.z ** 2);
    if (speed < REST_SPEED) {
      actor.velocity.x = 0;
      actor.velocity.z = 0;
    }

    const { bounds } = state;
    if (actor.position.x < bounds.minX) {
      actor.position.x = bounds.minX;
      actor.velocity.x = 0;
    } else if (actor.position.x > bounds.maxX) {
      actor.position.x = bounds.maxX;
      actor.velocity.x = 0;
    }
    if (actor.position.z < bounds.minZ) {
      actor.position.z = bounds.minZ;
      actor.velocity.z = 0;
    } else if (actor.position.z > bounds.maxZ) {
      actor.position.z = bounds.maxZ;
      actor.velocity.z = 0;
    }
  }
}
