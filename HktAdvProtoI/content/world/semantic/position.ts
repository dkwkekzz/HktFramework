// World Semantic — Position

export interface WorldPosition {
  x: number;
  z: number;
}

// 거리 계산은 엔진 물리의 것이다 — 같은 이름으로 그대로 쓴다 (P6).
export { distance } from '../../../engine/physics/vec';

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function inBounds(p: WorldPosition, bounds: WorldBounds): boolean {
  return p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ;
}
