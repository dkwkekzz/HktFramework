// RULE-BODY-PUSH-001 — Implements INTENT-BODY-OCCUPY-001 · INTENT-BODY-PUSH-001
// Input          모든 Actor 쌍 (Tick 마다), dt
// Preconditions  두 몸의 중심 거리 < Radius 합 (겹침 깊이 > 0)
// Transition     겹침 깊이 × PUSH_STIFFNESS 의 힘을 중심선 방향으로 서로 반대로 가한다.
//                힘의 크기는 양쪽이 같다 (제3법칙).
//                각자의 Velocity 변화 = 힘 / 자신의 Mass × dt (제2법칙).
//                중심이 완전히 일치하면 Actors 순서가 앞선 쪽을 -x 로 미는 고정 방향 (결정론).
// Result         Pushed(쌍 수) — 상태 변화는 Velocity 에만 생긴다. 위치는
//                RULE-BODY-MOMENTUM-001 이 옮긴다.

import { CENTER_EPSILON, PUSH_STIFFNESS } from '../semantic/collision';
import type { WorldState } from '../semantic/world-state';

export function ruleBodyPush(state: WorldState, dt: number): number {
  let pushedPairs = 0;

  for (let i = 0; i < state.actors.length; i++) {
    for (let j = i + 1; j < state.actors.length; j++) {
      const a = state.actors[i]!;
      const b = state.actors[j]!;

      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const overlap = a.bodyRadius + b.bodyRadius - dist;
      if (overlap <= 0) continue;

      // 방향 a → b. 중심 일치 시 앞선 쪽(a)이 -x 로 밀리는 고정 방향.
      const nx = dist > CENTER_EPSILON ? dx / dist : 1;
      const nz = dist > CENTER_EPSILON ? dz / dist : 0;

      const force = PUSH_STIFFNESS * overlap; // 크기는 양쪽 동일 (제3법칙)
      a.velocity.x -= nx * (force / a.bodyMass) * dt;
      a.velocity.z -= nz * (force / a.bodyMass) * dt;
      b.velocity.x += nx * (force / b.bodyMass) * dt;
      b.velocity.z += nz * (force / b.bodyMass) * dt;
      pushedPairs++;
    }
  }

  return pushedPairs;
}
