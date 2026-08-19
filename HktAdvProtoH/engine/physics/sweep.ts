// Sim Lib — 호(arc) 스윕 충돌체와 접촉·충격 (P6 ADDED).
//
// "몸이 향한 방향을 기준으로 진행도에 따라 호를 그리며 쓸고 지나가는 구" —
// 칼이든 채찍이든 손끝이든, 어느 세계에서든 같은 기하다.
// 닿으면 무슨 일이 일어나는지(피해·경직·판정)는 팩이 접촉 결과를 받아 정한다.
//
// 호의 각·반경·구간·충격량은 그 세계의 결정론 상수다 — 팩이 넘긴다.

import type { KineticBody, PointBody } from './body';
import { normalizedOrFixed, type Vec2 } from './vec';

export interface ArcSweepSpec {
  /** 쓸고 지나가는 호의 전체 각 (rad) */
  arc: number;
  /** 끝점 충돌 구의 반경 */
  tipRadius: number;
  /** 몸 중심에서 끝점까지의 거리 */
  reach: number;
  /** 진행도(0..1) 중 활성 구간 — 구간 밖에서는 경계 각에 고정된다 (예비/여운 자세) */
  begin: number;
  end: number;
}

export interface ArcSweep {
  center: Vec2; // 끝점 자리 — 진행에 따라 호를 그리며 이동
  radius: number;
  active: boolean; // 활성 구간 안 — 이때 닿은 몸이 접촉이다
}

/** 진행도에 따른 끝점 자리 — +arc/2 에서 -arc/2 로 쓸고 지나간다 */
export function arcSweepCollider(
  position: Vec2,
  facing: Vec2,
  progress: number,
  spec: ArcSweepSpec,
): ArcSweep {
  // 구간 안 진행도 0..1 (구간 밖은 경계에 고정)
  const sweep = Math.min(1, Math.max(0, (progress - spec.begin) / (spec.end - spec.begin)));
  const theta = spec.arc / 2 - spec.arc * sweep;

  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // 지면 평면(x, z)에서 facing 을 theta 만큼 회전한 방향
  const dx = facing.x * cos - facing.z * sin;
  const dz = facing.x * sin + facing.z * cos;

  return {
    center: { x: position.x + dx * spec.reach, z: position.z + dz * spec.reach },
    radius: spec.tipRadius,
    active: progress >= spec.begin && progress <= spec.end,
  };
}

/** 충돌 구가 그 몸에 닿았는가 — 중심 거리 <= 구 반경 + 몸 반경 */
export function circleHits(
  center: Vec2,
  radius: number,
  body: PointBody & { bodyRadius: number },
): boolean {
  const dx = center.x - body.position.x;
  const dz = center.z - body.position.z;
  return Math.sqrt(dx * dx + dz * dz) <= radius + body.bodyRadius;
}

/**
 * origin 에서 멀어지는 방사 방향으로 충격량을 가한다 (속도 변화 = 충격량 / 질량).
 * origin 과 몸의 중심이 일치하면 +x 고정 방향 (결정론).
 */
export function applyRadialImpulse(origin: Vec2, body: KineticBody, impulse: number): void {
  const n = normalizedOrFixed(body.position.x - origin.x, body.position.z - origin.z);
  body.velocity.x += n.x * (impulse / body.bodyMass);
  body.velocity.z += n.z * (impulse / body.bodyMass);
}
