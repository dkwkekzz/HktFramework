// Sim Lib — 목표점 추적 이동 적분 (P6 ADDED).
//
// "목표를 향해 일정 걸음만큼 간다. 걸음 안이면 도착한다" — 어느 세계에서든 같은 수식이다.
// 걸음의 크기(속도 × 배율 × dt)를 정하는 것은 팩의 능력치·규칙이고,
// 도착하면 무슨 일이 일어나는지(행동 종료·목표 소거)도 팩이 결과를 받아 정한다.

import type { PointBody } from './body';
import type { Vec2 } from './vec';

export interface SeekStep {
  arrived: boolean;
  /** 적분 **전** 기준의 목표까지 변위 — 이동 방향 판정(몸 돌리기 등)에 쓴다 */
  dx: number;
  dz: number;
}

/**
 * position 을 target 방향으로 step 만큼 옮긴다 (제자리 변경).
 * 남은 거리가 step + arriveEpsilon 이하이면 target 에 스냅하고 도착으로 판정한다.
 */
export function integrateSeek(
  body: PointBody,
  target: Vec2,
  step: number,
  arriveEpsilon = 0,
): SeekStep {
  const dx = target.x - body.position.x;
  const dz = target.z - body.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist <= step + arriveEpsilon) {
    body.position = { x: target.x, z: target.z };
    return { arrived: true, dx, dz };
  }

  body.position = {
    x: body.position.x + (dx / dist) * step,
    z: body.position.z + (dz / dist) * step,
  };
  return { arrived: false, dx, dz };
}
