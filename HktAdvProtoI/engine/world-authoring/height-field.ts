// World Authoring — 공유 vertex 격자 (ENGINE A).
//
// 높이의 단일 출처다. 세계가 읽는 격자도 View 가 그리는 chunk 도 전부 이 하나에서 나오므로
// 두 쪽이 어긋날 자리가 없다 (design/Plan-World-Authoring-Engine.md §3.2).
//
// 순수하다 — Math.random · Date 를 쓰지 않고, 같은 (description, resolution) 은 언제나 같은
// Float32Array 를 준다. 기본 높이는 0 이고 그 위에 stamp op 를 **ops 순서대로** 더한다.
// Description 의 ops 는 순서 있는 편집이므로 순서가 다르면 다른 땅이다.

import type { RegionDescription, StampOp } from './description';
import type { HeightField } from './compiled';

/**
 * Description 의 extent 를 resolution 으로 나눈 vertex 격자를 만든다.
 *
 * 칸 수는 `ceil(폭 / resolution)` — 격자는 extent 를 **덮는다**. 폭이 resolution 의 배수가
 * 아니면 마지막 vertex 가 max 를 조금 넘는다 (덮지 못하는 것보다 낫다). 칸은 최소 하나다.
 * vertex 는 row-major 로 담긴다 — z 가 바깥, x 가 안쪽.
 */
export function buildHeightField(description: RegionDescription, resolution: number): HeightField {
  if (!(resolution > 0) || !Number.isFinite(resolution)) {
    throw new RangeError(`resolution must be a positive finite number, got ${resolution}`);
  }
  const { extent } = description;
  const cols = Math.max(1, Math.ceil((extent.maxX - extent.minX) / resolution)) + 1;
  const rows = Math.max(1, Math.ceil((extent.maxZ - extent.minZ) / resolution)) + 1;
  const height = new Float32Array(cols * rows); // 기본 높이 0
  const field: HeightField = { extent, resolution, cols, rows, height };
  for (const op of description.ops) {
    if (op.kind === 'stamp') applyStamp(field, op);
  }
  return field;
}

/** vertex 하나의 세계 좌표 — 격자의 자리는 오직 이 식이 정한다 */
export function vertexX(field: HeightField, ix: number): number {
  return field.extent.minX + ix * field.resolution;
}

export function vertexZ(field: HeightField, iz: number): number {
  return field.extent.minZ + iz * field.resolution;
}

/** 격자 밖은 가장자리 값으로 친다 (clamp) */
export function heightAtVertex(field: HeightField, ix: number, iz: number): number {
  const cx = clampInt(ix, 0, field.cols - 1);
  const cz = clampInt(iz, 0, field.rows - 1);
  return field.height[cz * field.cols + cx] ?? 0;
}

/** 네 vertex 사이의 bilinear. vertex 자리에서는 그 격자 값 그대로다 */
export function sampleHeight(field: HeightField, x: number, z: number): number {
  const cx = cellCoord(x, field.extent.minX, field.resolution, field.cols);
  const cz = cellCoord(z, field.extent.minZ, field.resolution, field.rows);
  const h00 = heightAtVertex(field, cx.index, cz.index);
  const h10 = heightAtVertex(field, cx.index + 1, cz.index);
  const h01 = heightAtVertex(field, cx.index, cz.index + 1);
  const h11 = heightAtVertex(field, cx.index + 1, cz.index + 1);
  const a = h00 + (h10 - h00) * cx.fraction;
  const b = h01 + (h11 - h01) * cx.fraction;
  return a + (b - a) * cz.fraction;
}

/**
 * vertex 하나의 경사 — 라디안 (0 = 평지, π/2 로 다가갈수록 수직).
 *
 * 이웃 vertex 의 높이차로 구한다. 안쪽은 양옆의 중앙차분이고, 가장자리는 한쪽만 있으므로
 * 그쪽으로만 본다 — 어느 자리에서도 값이 나온다.
 */
export function slopeAtVertex(field: HeightField, ix: number, iz: number): number {
  const cx = clampInt(ix, 0, field.cols - 1);
  const cz = clampInt(iz, 0, field.rows - 1);
  const x0 = Math.max(0, cx - 1);
  const x1 = Math.min(field.cols - 1, cx + 1);
  const z0 = Math.max(0, cz - 1);
  const z1 = Math.min(field.rows - 1, cz + 1);
  const dx =
    x1 === x0 ? 0 : (heightAtVertex(field, x1, cz) - heightAtVertex(field, x0, cz)) / ((x1 - x0) * field.resolution);
  const dz =
    z1 === z0 ? 0 : (heightAtVertex(field, cx, z1) - heightAtVertex(field, cx, z0)) / ((z1 - z0) * field.resolution);
  return Math.atan(Math.hypot(dx, dz));
}

/** 자리의 경사 — vertex 경사의 bilinear. vertex 자리에서는 slopeAtVertex 그대로다 */
export function sampleSlope(field: HeightField, x: number, z: number): number {
  const cx = cellCoord(x, field.extent.minX, field.resolution, field.cols);
  const cz = cellCoord(z, field.extent.minZ, field.resolution, field.rows);
  const s00 = slopeAtVertex(field, cx.index, cz.index);
  const s10 = slopeAtVertex(field, cx.index + 1, cz.index);
  const s01 = slopeAtVertex(field, cx.index, cz.index + 1);
  const s11 = slopeAtVertex(field, cx.index + 1, cz.index + 1);
  const a = s00 + (s10 - s00) * cx.fraction;
  const b = s01 + (s11 - s01) * cx.fraction;
  return a + (b - a) * cz.fraction;
}

// ── 안쪽 ─────────────────────────────────────────────────────────────

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** 어느 칸의 어디인가 — index 는 칸의 왼쪽 vertex, fraction 은 그 안의 자리 [0, 1] */
function cellCoord(value: number, min: number, resolution: number, count: number): { index: number; fraction: number } {
  const g = Math.min(count - 1, Math.max(0, (value - min) / resolution));
  const index = clampInt(Math.floor(g), 0, Math.max(0, count - 2));
  return { index, fraction: g - index };
}

/**
 * stamp 하나를 더한다 — 반경 밖은 한 톨도 건드리지 않으므로 반경의 사각형만 훑는다.
 *
 * 모양은 정규화 거리 t = 거리 / radius 하나로만 말한다 (t >= 1 이면 0):
 *   hill    (1 - t²)^falloff        중심에서 평평한 돔
 *   ridge   (1 - t)^falloff         중심에서 꺾이는 원뿔
 *   basin   -(1 - t²)^falloff       hill 의 부호를 뒤집은 것
 */
function applyStamp(field: HeightField, op: StampOp): void {
  if (!(op.radius > 0) || !Number.isFinite(op.radius) || !Number.isFinite(op.height)) return;
  const falloff = op.falloff ?? 1;
  const { resolution } = field;
  const ix0 = clampInt(Math.floor((op.center.x - op.radius - field.extent.minX) / resolution), 0, field.cols - 1);
  const ix1 = clampInt(Math.ceil((op.center.x + op.radius - field.extent.minX) / resolution), 0, field.cols - 1);
  const iz0 = clampInt(Math.floor((op.center.z - op.radius - field.extent.minZ) / resolution), 0, field.rows - 1);
  const iz1 = clampInt(Math.ceil((op.center.z + op.radius - field.extent.minZ) / resolution), 0, field.rows - 1);
  for (let iz = iz0; iz <= iz1; iz++) {
    const dz = vertexZ(field, iz) - op.center.z;
    for (let ix = ix0; ix <= ix1; ix++) {
      const dx = vertexX(field, ix) - op.center.x;
      const t = Math.hypot(dx, dz) / op.radius;
      if (t >= 1) continue;
      const weight = stampWeight(op.stamp, t, falloff);
      if (weight === 0) continue;
      const i = iz * field.cols + ix;
      field.height[i] = (field.height[i] ?? 0) + op.height * weight;
    }
  }
}

function stampWeight(stamp: StampOp['stamp'], t: number, falloff: number): number {
  switch (stamp) {
    case 'ridge':
      return Math.pow(1 - t, falloff);
    case 'basin':
      return -Math.pow(1 - t * t, falloff);
    case 'hill':
    default:
      return Math.pow(1 - t * t, falloff);
  }
}
