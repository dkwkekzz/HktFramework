// Terrain Presentation — 땅을 "어떻게 그릴지" 결정한다 (결정 Layer 데이터, C005 ADDED).
//
// 세계는 관찰 결과에 region { id, hash } 만 싣는다. **땅은 봉투로 오지 않는다** — 관찰자가
// 자기 Description(content/regions)을 같은 규칙으로 컴파일해 그린다. 바닥 polygon 을 그리던
// 것과 같은 방식이고(region-presentation), 30Hz 관찰 결과에 격자를 싣는 것은 관찰 계약의
// 것이 아니다 (Plan §3.5).
//
// 색의 기준 — **경사로 갈리는 것이 읽혀야 한다.** 기울수록 흙과 풀이 붙어 있지 못한다는
// 하나의 이유로 세 색을 잇는다: 평평한 곳은 풀이 앉고, 비탈은 그 풀이 벗겨져 흙이 드러나고,
// 급경사에는 흙마저 남지 못해 맨 바위다. 색상(hue)이 초록 → 갈색 → 무채색으로 한 칸씩
// 옮겨 가므로 밝기가 아니라 색으로 즉시 갈린다 (TRANSITION_TINTS 와 같은 어투).

import type { TerrainPalette } from '../../engine/view-kernel/terrain/terrain';
import type { CompiledRegion } from '../../engine/world-authoring/compiled';
import { compileRegion } from '../../engine/world-authoring/compile';
import { regionSpec } from '../regions/index';
import { COMPILE_RULES, SURFACE_FLAT, SURFACE_SLOPE, SURFACE_STEEP } from './biome-rules';

/** surface 태그 → 지면에 곱할 색. 태그가 늘면 여기 한 줄이 는다 */
export const SURFACE_COLORS: Readonly<Record<string, number>> = {
  // 평지 — 풀이 앉은 땅. 이 세계의 지면 기본색이고, 데이터가 없는 여덟 방은 전부 이 색 하나다
  [SURFACE_FLAT]: 0x4e7a3e,
  // 비탈 — 풀이 벗겨져 흙이 드러난다. 초록에서 갈색으로 한 칸 옮긴 색
  [SURFACE_SLOPE]: 0x9a6b3a,
  // 급경사 — 흙도 남지 못한 맨 바위. 색상 자체를 버리고 무채색으로 나가 앞의 둘과 계열이 갈린다
  [SURFACE_STEEP]: 0xa8a49c,
};

// 표에 없는 태그의 기본 결정 — 무채색 (DEFAULT_DEPTH_PRESENTATION 과 같은 값·같은 뜻).
// 태그가 늘어도 게임은 멈추지 않고 색만 없다 (C001 부터의 폴백 규칙).
export const DEFAULT_SURFACE_COLOR = 0x9a9a9a;

export function surfaceColor(surfaceTag: string): number {
  return SURFACE_COLORS[surfaceTag] ?? DEFAULT_SURFACE_COLOR;
}

/** 기반에 넘기는 색 표 — 기반은 태그의 뜻을 모른 채 이 함수만 부른다 (설계 반전 ⑤) */
export const TERRAIN_PALETTE: TerrainPalette = { colorOf: surfaceColor };

/**
 * 방마다 한 번만 컴파일하고 다시 쓴다.
 *
 * 컴파일 결과는 Description 에서 유도되는 사실이라 저장되지 않지만, 같은 방을 다시 그릴 때마다
 * 다시 만들 이유도 없다 — 방 아홉의 Description 은 켜 있는 동안 바뀌지 않는다. 모르는 방은
 * null 을 기억해 둔다(다시 찾지 않는다) — 땅 없이도 게임은 돈다 (SPEC-007 경계).
 */
const COMPILED = new Map<string, CompiledRegion | null>();

/** 그 방의 컴파일된 땅 — Description 을 모르는 id 면 null */
export function regionTerrain(regionId: string): CompiledRegion | null {
  const cached = COMPILED.get(regionId);
  if (cached !== undefined) return cached;
  const spec = regionSpec(regionId);
  const compiled = spec ? compileRegion(spec.space, COMPILE_RULES) : null;
  COMPILED.set(regionId, compiled);
  return compiled;
}
