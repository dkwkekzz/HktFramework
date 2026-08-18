// Sim Lib — 원(캡슐의 지면 투영) 밀어내기 솔버 (P6 ADDED).
//
// 겹친 두 몸은 겹침 깊이에 비례한 힘으로 서로를 밀어낸다.
//   힘의 크기는 양쪽이 같고 (제3법칙),
//   각자의 속도 변화 = 힘 / 자신의 질량 × dt (제2법칙).
// 중심이 완전히 일치하면 배열 순서가 앞선 쪽이 -x 로 밀리는 고정 방향 (결정론).
// 위치는 여기서 바뀌지 않는다 — 옮기는 것은 관성 적분(momentum)의 몫이다.
//
// 강성(stiffness)은 그 세계의 결정론 상수다 — 팩이 넘긴다.

import type { KineticBody } from './body';
import { normalizedOrFixed } from './vec';

/** 겹친 쌍마다 속도를 밀어낸다. 밀린 쌍의 수를 돌려준다 (진단·검증용) */
export function resolveCirclePush(
  bodies: readonly KineticBody[],
  stiffness: number,
  dt: number,
): number {
  let pushedPairs = 0;

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!;
      const b = bodies[j]!;

      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const overlap = a.bodyRadius + b.bodyRadius - dist;
      if (overlap <= 0) continue;

      // 방향 a → b. 중심 일치 시 앞선 쪽(a)이 -x 로 밀리는 고정 방향.
      const n = normalizedOrFixed(dx, dz);

      const force = stiffness * overlap; // 크기는 양쪽 동일 (제3법칙)
      a.velocity.x -= n.x * (force / a.bodyMass) * dt;
      a.velocity.z -= n.z * (force / a.bodyMass) * dt;
      b.velocity.x += n.x * (force / b.bodyMass) * dt;
      b.velocity.z += n.z * (force / b.bodyMass) * dt;
      pushedPairs++;
    }
  }

  return pushedPairs;
}
