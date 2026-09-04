// World Authoring — 컴파일 결과에 **자리로 묻는다**.
//
// 규칙이 격자를 다시 계산하지 않고 한 자리의 답만 얻는 통로다. 읽기 전용이고 순수하다 —
// 같은 (결과, 자리) 는 언제나 같은 답이다 (design/Plan-World-Authoring-Engine.md §3.5).
//
// 게임 명사가 없다 — layer · tag · reason 은 불투명 문자열이고, 기반은 그 뜻을 모른다.
// 무엇이 "막힘" 인지 판정할 뿐, 왜 막혔는지의 의미는 컨텐츠가 읽는다.

import type { AreaShape, CompiledWorldTerrain, XZ } from './compiled';

/**
 * 자리 → 격자 색인. **가장 가까운 vertex** 하나로 정한다.
 *
 * 칸 안에서 값을 섞지 않는다: traversable 도 사유 태그도 사이값이 뜻을 갖지 않는 이산 값이라
 * 섞으면 없는 답이 나온다. 결정론이 유일한 요구이므로 반올림 하나로 고정한다 —
 * 같은 자리는 언제나 같은 vertex 를 가리킨다.
 *
 * 격자 밖(또는 숫자가 아닌 자리)이면 -1 — 부르는 쪽이 "땅이 없다" 로 읽는다.
 */
function vertexIndex(world: CompiledWorldTerrain, x: number, z: number): number {
  const { extent, resolution, cols, rows } = world;
  if (!(resolution > 0) || cols < 1 || rows < 1) return -1;
  const ix = Math.round((x - extent.minX) / resolution);
  const iz = Math.round((z - extent.minZ) / resolution);
  if (!Number.isFinite(ix) || !Number.isFinite(iz)) return -1;
  if (ix < 0 || ix >= cols || iz < 0 || iz >= rows) return -1;
  return iz * cols + ix;
}

/**
 * 그 자리가 통행 가능한가.
 *
 * 격자 밖은 true 다 — **땅이 없는 것은 막는 것이 아니다**. 어디까지 갈 수 있는지는 다른
 * 판정(extent)의 몫이고, 여기서 막으면 땅을 컴파일하지 않은 곳이 전부 벽이 된다.
 */
export function isTraversableAt(world: CompiledWorldTerrain, x: number, z: number): boolean {
  const i = vertexIndex(world, x, z);
  if (i < 0) return true;
  return (world.traversable[i] ?? 1) !== 0;
}

/** 막혔다면 그 사유 태그, 아니면 null. 색인이 표 밖이면(어긋난 결과) null 로 친다 */
export function blockedReasonAt(world: CompiledWorldTerrain, x: number, z: number): string | null {
  const i = vertexIndex(world, x, z);
  if (i < 0) return null;
  if ((world.traversable[i] ?? 1) !== 0) return null;
  const tag = world.blockedTags[world.blocked[i] ?? 0];
  return tag ? tag : null;
}

/**
 * 그 자리를 품는 area 들의 tag — layer 로 거른다. areas 순서(= ops 순서)를 유지하고,
 * 겹치면 걸린 것을 **전부** 낸다 — 하나로 줄이는 것은 기반의 결정이 아니다.
 */
export function tagsAt(
  world: CompiledWorldTerrain,
  x: number,
  z: number,
  layer: string,
): string[] {
  const tags: string[] = [];
  for (const area of world.areas) {
    if (area.layer !== layer) continue;
    if (shapeContains(area.shape, x, z)) tags.push(area.tag);
  }
  return tags;
}

// ── 안쪽 ─────────────────────────────────────────────────────────────

/** 변 위를 "안" 으로 치기 위한 여유 (세계 단위) — 부동소수 오차만 덮을 만큼만 */
const EDGE_EPSILON = 1e-9;

function shapeContains(shape: AreaShape, x: number, z: number): boolean {
  if (shape.kind === 'circle') {
    return Math.hypot(x - shape.center.x, z - shape.center.z) <= shape.radius + EDGE_EPSILON;
  }
  return polygonContains(shape.points, x, z);
}

/**
 * even-odd 채우기 — 자리에서 +x 로 반직선을 쏴 변을 넘은 횟수가 홀수면 안이다.
 *
 * 변 위의 점은 **안으로 친다** (반직선 판정만으로는 변마다 답이 갈린다). 그래서 넘은 횟수를
 * 세기 전에 변 위인지를 먼저 본다 — 경계에 선 몸이 자리에 따라 들락거리지 않게 하는 규약이다.
 */
function polygonContains(points: readonly XZ[], x: number, z: number): boolean {
  if (points.length < 3) return false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j];
    const b = points[i];
    if (a && b && onSegment(a, b, x, z)) return true;
  }
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j];
    const b = points[i];
    if (!a || !b) continue;
    // 변이 z 를 넘는가 — 위쪽 끝만 포함해 꼭짓점을 두 번 세지 않는다
    if (a.z > z !== b.z > z) {
      const crossX = a.x + ((z - a.z) / (b.z - a.z)) * (b.x - a.x);
      if (x < crossX) inside = !inside;
    }
  }
  return inside;
}

function onSegment(a: XZ, b: XZ, x: number, z: number): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 0) return Math.hypot(x - a.x, z - a.z) <= EDGE_EPSILON;
  let t = ((x - a.x) * dx + (z - a.z) * dz) / lengthSquared;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) <= EDGE_EPSILON;
}
