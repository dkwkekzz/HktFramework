// World Authoring — 컴파일 결과를 **숫자로 관찰한다** (ENGINE A).
//
// 컴파일 산출물을 격자와 1:1 인 값 판(raster)과 요약 수치로 편다. 그림도 색도 파일도 여기 없다 —
// PNG 인코딩과 색 표는 도구의 것이다 (design/Plan-World-Authoring-Engine.md §3.4 Observation API).
//
// 게임 명사가 없다 — layer · tag · reason 은 전부 불투명 문자열이고, 기반은 그 뜻을 모른다.
//
// 순수하다 — Math.random · Date 를 쓰지 않고 객체 키 순회 순서에 기대지 않는다.
// 같은 입력은 언제나 바이트까지 같은 버퍼를 준다. 파일을 쓰지 않는다.
//
// **판의 순서** — 격자와 똑같이 row-major (z 바깥 · x 안쪽) 그대로 낸다. 곧 values[0] 은
// (ix=0, iz=0) = (extent.minX, extent.minZ) 의 vertex 다. 이 판을 그림으로 뒤집을지 말지는
// 도구가 정한다 — 기반은 격자의 순서를 그대로 넘길 뿐 위아래를 결정하지 않는다.

import type { CompiledRegion, CompiledWorldTerrain, HeightField } from './compiled';
import type { Extent } from './description';
import { vertexX, vertexZ } from './height-field';
import { tagsAt } from './query';

/** 격자와 1:1 인 값 판 — row-major (z 바깥 · x 안쪽), 격자 vertex 하나 = 픽셀 하나 */
export interface RasterMap {
  width: number;            // = cols
  height: number;           // = rows
  /** 0..255. 뜻은 legend 가 정한다 */
  values: Uint8Array;
  /** 값 = 이 배열의 색인 (태그 판). 눈금 판이면 빈 배열 */
  legend: string[];
  /** 눈금 판일 때 그 눈금의 실제 최소·최대 (없으면 undefined) */
  range?: { min: number; max: number };
}

/**
 * 높이 — 그 격자의 최소~최대를 0..255 로 편다. 평평하면 전부 0 이고 range.min === range.max.
 *
 * **상대 눈금**인 이유: 절대 눈금을 쓰면 기복이 작은 방이 전부 같은 한 색이 되어 아무것도
 * 읽히지 않는다. 실제 높이는 range 가 그대로 들고 있으므로 잃는 것이 없다.
 */
export function rasterHeight(world: CompiledWorldTerrain): RasterMap {
  const count = vertexCount(world);
  const values = new Uint8Array(count);
  const { min, max } = heightRange(world);
  // 폭이 0 이거나(평평) 수가 아니면 전부 0 — 0 으로 나누지 않는다
  if (max > min) {
    const span = max - min;
    for (let i = 0; i < count; i++) {
      const h = world.height[i] ?? 0;
      const t = Number.isFinite(h) ? (h - min) / span : 0;
      values[i] = clampByte(Math.round(t * 255));
    }
  }
  return { width: world.cols, height: world.rows, values, legend: [], range: { min, max } };
}

/** 표면 — 값 = surfaceTags 의 색인. legend = surfaceTags 그대로 */
export function rasterSurface(world: CompiledWorldTerrain): RasterMap {
  const count = vertexCount(world);
  const values = new Uint8Array(count);
  for (let i = 0; i < count; i++) values[i] = world.surface[i] ?? 0;
  return { width: world.cols, height: world.rows, values, legend: world.surfaceTags.slice() };
}

/**
 * 통행 — 값 0 = 통행 가능, 그 밖은 blockedTags 의 색인. legend = blockedTags (색인 0 은 '').
 *
 * 통행 가능한 칸은 blocked 색인을 보지 않고 0 으로 못 박는다 — 판의 0 이 곧 "지나갈 수 있다" 다.
 */
export function rasterTraversable(world: CompiledWorldTerrain): RasterMap {
  const count = vertexCount(world);
  const values = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    values[i] = (world.traversable[i] ?? 1) !== 0 ? 0 : (world.blocked[i] ?? 0);
  }
  return { width: world.cols, height: world.rows, values, legend: world.blockedTags.slice() };
}

/**
 * 의미 — 그 layer 의 area 가 덮은 칸에 그 area 의 태그 색인.
 * 값 0 = 아무 area 도 없음. legend[0] 은 '' 이고 그 뒤가 그 layer 의 태그들(areas 순서 · 중복 제거).
 * 겹치면 **먼저 온 area** 가 이긴다 (ops 순서 = 결정론).
 *
 * 자리 판정은 query.ts 의 `tagsAt` 을 그대로 쓴다 — 세계가 묻는 자리와 그림이 묻는 자리가
 * 같은 규약이어야 한다(변 위는 안). vertex 의 세계 좌표도 격자의 식(vertexX · vertexZ)이 정한다.
 */
export function rasterSemantic(world: CompiledWorldTerrain, layer: string): RasterMap {
  const legend: string[] = ['']; // 0 = 아무 area 도 없음
  const indexOfTag = new Map<string, number>();
  for (const area of world.areas) {
    if (area.layer !== layer) continue;
    if (indexOfTag.has(area.tag)) continue;
    indexOfTag.set(area.tag, legend.length);
    legend.push(area.tag);
  }

  const values = new Uint8Array(vertexCount(world));
  if (indexOfTag.size > 0) {
    const field = asField(world);
    for (let iz = 0; iz < world.rows; iz++) {
      const z = vertexZ(field, iz);
      for (let ix = 0; ix < world.cols; ix++) {
        // tagsAt 은 areas 순서를 지키므로 첫 번째가 곧 "먼저 온 area"다
        const first = tagsAt(world, vertexX(field, ix), z, layer)[0];
        if (first === undefined) continue;
        values[iz * world.cols + ix] = clampByte(indexOfTag.get(first) ?? 0);
      }
    }
  }
  return { width: world.cols, height: world.rows, values, legend };
}

/** 보고가 읊는 수 — 도구가 세지 않고 여기서 센다 */
export interface TerrainSummary {
  extent: Extent;
  resolution: number;
  cols: number;
  rows: number;
  vertices: number;
  height: { min: number; max: number };
  /** surfaceTags 순서 그대로 · 칸 수 0 인 태그도 적는다 */
  surface: { tag: string; cells: number }[];
  /** blockedTags 에서 '' 를 뺀 것 · 순서 그대로 */
  blocked: { tag: string; cells: number }[];
  traversableCells: number;
  blockedCells: number;
  areas: { layer: string; tag: string }[];   // areas 순서 그대로
  points: { layer: string; tag: string }[];  // points 순서 그대로
  chunks: number;
  chunkSize: number;
  instances: number;
}

/**
 * 수를 세는 자리는 여기 하나다 — 도구는 다시 세지 않는다.
 *
 * 칸 수 0 인 표면·막힘 태그도 목록에 남긴다: 태그가 없어진 것이 아니라 이 방에서 안 쓰인 것이고,
 * 그 둘은 다른 사실이다.
 */
export function summarize(region: CompiledRegion): TerrainSummary {
  const world = region.world;
  const count = vertexCount(world);

  const surfaceCells = new Array<number>(world.surfaceTags.length).fill(0);
  const blockedCellsByTag = new Array<number>(world.blockedTags.length).fill(0);
  let traversableCells = 0;
  let blockedCells = 0;
  for (let i = 0; i < count; i++) {
    const s = world.surface[i] ?? 0;
    if (s < surfaceCells.length) surfaceCells[s] = (surfaceCells[s] ?? 0) + 1;
    if ((world.traversable[i] ?? 1) !== 0) {
      traversableCells++;
    } else {
      blockedCells++;
      const b = world.blocked[i] ?? 0;
      if (b < blockedCellsByTag.length) blockedCellsByTag[b] = (blockedCellsByTag[b] ?? 0) + 1;
    }
  }

  const blocked: { tag: string; cells: number }[] = [];
  for (let i = 0; i < world.blockedTags.length; i++) {
    const tag = world.blockedTags[i] ?? '';
    if (tag === '') continue; // 색인 0 = 막히지 않음
    blocked.push({ tag, cells: blockedCellsByTag[i] ?? 0 });
  }

  return {
    extent: { ...world.extent },
    resolution: world.resolution,
    cols: world.cols,
    rows: world.rows,
    vertices: count,
    height: heightRange(world),
    surface: world.surfaceTags.map((tag, i) => ({ tag, cells: surfaceCells[i] ?? 0 })),
    blocked,
    traversableCells,
    blockedCells,
    areas: world.areas.map((a) => ({ layer: a.layer, tag: a.tag })),
    points: world.points.map((p) => ({ layer: p.layer, tag: p.tag })),
    chunks: region.view.chunks.length,
    chunkSize: region.view.chunkSize,
    instances: region.view.instances.length,
  };
}

// ── 안쪽 ─────────────────────────────────────────────────────────────

/** 판의 칸 수 — 격자의 vertex 수다. height 배열이 짧아도 판은 격자 크기를 지킨다 */
function vertexCount(world: CompiledWorldTerrain): number {
  return Math.max(0, world.cols) * Math.max(0, world.rows);
}

/**
 * 격자의 실제 높이 최소·최대. 수가 아닌 값은 세지 않고, 아무 값도 없으면 0~0 이다
 * (평평한 격자와 같은 답 — 눈금이 0 으로 접힌다).
 */
function heightRange(world: CompiledWorldTerrain): { min: number; max: number } {
  const count = vertexCount(world);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const h = world.height[i] ?? 0;
    if (!Number.isFinite(h)) continue;
    if (h < min) min = h;
    if (h > max) max = h;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 0 };
  return { min, max };
}

/** 컴파일 결과는 격자를 그대로 품는다 — 자리 식(vertexX · vertexZ)을 쓰기 위한 시선 */
function asField(world: CompiledWorldTerrain): HeightField {
  return world;
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
