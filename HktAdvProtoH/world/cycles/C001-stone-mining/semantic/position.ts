// World Semantic — Position (C001 ADDED)

export interface WorldPosition {
  x: number;
  z: number;
}

export function distance(a: WorldPosition, b: WorldPosition): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function inBounds(p: WorldPosition, bounds: WorldBounds): boolean {
  return p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ;
}
