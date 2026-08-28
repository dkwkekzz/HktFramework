// Sim Lib — 관성 적분 솔버 (P6 ADDED).
//
// Position += Velocity × dt (관성). Velocity 는 마찰로 감쇠하고,
// 정지 판정 속도 아래로 잦아들면 0 이 된다. 경계가 주어지면 몸은 경계에 고정되고
// 그 축의 속도가 0 이 된다 (경계 너머로는 밀리지 않는다).
//
// 마찰·정지 속도·경계는 그 세계의 결정론 상수/성질이다 — 팩이 넘긴다.

import type { KineticBody } from './body';

export interface PlaneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function integrateMomentum(
  bodies: readonly KineticBody[],
  friction: number,
  restSpeed: number,
  dt: number,
  bounds?: PlaneBounds,
): void {
  const damping = Math.max(0, 1 - friction * dt);

  for (const body of bodies) {
    body.position.x += body.velocity.x * dt;
    body.position.z += body.velocity.z * dt;

    body.velocity.x *= damping;
    body.velocity.z *= damping;
    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
    if (speed < restSpeed) {
      body.velocity.x = 0;
      body.velocity.z = 0;
    }

    if (!bounds) continue;
    if (body.position.x < bounds.minX) {
      body.position.x = bounds.minX;
      body.velocity.x = 0;
    } else if (body.position.x > bounds.maxX) {
      body.position.x = bounds.maxX;
      body.velocity.x = 0;
    }
    if (body.position.z < bounds.minZ) {
      body.position.z = bounds.minZ;
      body.velocity.z = 0;
    } else if (body.position.z > bounds.maxZ) {
      body.position.z = bounds.maxZ;
      body.velocity.z = 0;
    }
  }
}
