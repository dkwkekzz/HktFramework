// World Authoring — 컴파일 산출물의 형 (ENGINE A).
//
// Description 을 재생해 얻는 **유도된 사실**이다. 세계 State 가 아니므로 저장되지 않는다 —
// 저장되는 것은 Description 과 그 hash 뿐이고, 복구는 같은 Description 을 다시 컴파일한다
// (design/Plan-World-Authoring-Engine.md §3.5).
//
// 게임 명사가 없다 — surface 태그도 layer 도 불투명 문자열이고, 기반은 그 뜻을 모른다.
// 무엇이 "급경사" 이고 그것이 무슨 색인지는 컨텐츠가 정한다.
//
// 두 산출물은 **같은 height 격자**에서 나온다. chunk 경계는 격자의 vertex 를 공유하므로
// seam 이 구조적으로 없다 (§3.2).

import type { Extent } from './description';

export interface XZ {
  x: number;
  z: number;
}

/** 공유 vertex 격자 — 높이의 단일 출처. row-major (z 바깥 · x 안쪽) */
export interface HeightField {
  extent: Extent;
  /** 격자 칸의 크기 (세계 단위) — Region 크기의 상한이 아니다 */
  resolution: number;
  /** vertex 수 (칸 수 + 1) */
  cols: number;
  rows: number;
  height: Float32Array;
}

/**
 * 표면 규칙 하나 — 경사(라디안)의 구간에 태그를 붙인다.
 * 위에서부터 첫 번째로 맞는 것이 이긴다 (배열 순서 = 결정론).
 * 태그의 뜻은 컨텐츠의 것이다.
 */
export interface SurfaceRule {
  tag: string;
  /** 이 값 미만의 경사에만 붙는다 (라디안). 없으면 위가 열려 있다 */
  maxSlope?: number;
}

/** 세계 규칙이 읽는 것 — 고정 해상도 격자. chunk 없음 */
export interface CompiledWorldTerrain {
  extent: Extent;
  resolution: number;
  cols: number;
  rows: number;
  height: Float32Array;
  /** surfaceTags 의 색인 — vertex 마다 하나 */
  surface: Uint8Array;
  surfaceTags: string[];
  areas: { layer: string; tag: string; shape: AreaShape }[];
  points: { layer: string; tag: string; position: XZ }[];
}

export type AreaShape =
  | { kind: 'polygon'; points: XZ[] }
  | { kind: 'circle'; center: XZ; radius: number };

/** View 가 그리는 것 — chunk 로 나뉜다. chunkSize 는 runtime 인자다 */
export interface CompiledViewTerrain {
  chunkSize: number;
  /** positions 는 (x, y, z) 셋씩 — chunk 안의 vertex 격자 */
  chunks: { ix: number; iz: number; cols: number; rows: number; positions: Float32Array; surface: Uint8Array }[];
  surfaceTags: string[];
}

/** 컴파일이 받는 규칙 — 이름도 뜻도 컨텐츠가 준다 */
export interface CompileRules {
  resolution: number;
  /** 위에서부터 첫 번째로 맞는 것이 이긴다 */
  surface: readonly SurfaceRule[];
}

export interface CompiledRegion {
  world: CompiledWorldTerrain;
  view: CompiledViewTerrain;
  /** 같은 (description, rules) → 같은 값 */
  hash: string;
}
