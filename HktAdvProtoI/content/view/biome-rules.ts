// Biome Rules — 지면의 표면 규칙 표 (결정 Layer 데이터, C005 ADDED).
//
// 기반(engine/world-authoring)은 경사를 재기만 하고 그 값이 무슨 뜻인지 모른다. "얼마나 기울면
// 비탈이고 어디부터 급경사인가" 는 이 세계의 의미이므로 여기 표가 정한다 — 표의 값이 바뀌면
// 땅의 뜻이 바뀌고, 코드는 한 줄도 바뀌지 않는다 (region-presentation 의 색 표와 같은 성격).
//
// 이 Cycle 에서는 **관찰자만** 컴파일하므로 표가 View 에 산다 (L2-World-Tool §4 의 파일 지도).
// 세계가 traversable 을 읽어야 하는 C006 에서 비로소 "world 와 view 가 같은 표를 읽는가" 가
// 문제가 된다 — 그때 자리를 정한다. 지금 옮겨 두는 것은 아무도 요구하지 않은 구조다.
//
// 젖음(wet)은 없다 — 강이 오는 C006 의 것이다. 확정 5 의 넷 중 셋만 쓴다.

import type { CompileRules, SurfaceRule } from '../../engine/world-authoring/compiled';

/**
 * 격자 칸의 크기 (세계 단위) — 확정 4.
 *
 * 컴파일 결과의 hash 에 섞이므로 이 값이 바뀌면 다른 땅이다. 결정론 상수이니 표가 아니라
 * 헤더 상수로 고정한다 (핵심 원칙 6 · SPEC-002).
 */
export const TERRAIN_RESOLUTION = 1;

// 도 → 라디안. **변환은 이 한 자리에만 둔다** — 임계는 사람이 읽는 도(°)로 적고
// SurfaceRule.maxSlope 는 기반이 재는 라디안이므로, 두 단위가 만나는 곳이 여기뿐이어야 한다.
const DEGREE = Math.PI / 180;

/**
 * 경사 임계 둘 (도).
 *
 *   45°  급경사 — 확정 1 이 준 값이다. **그 각이 C006 에서 몸을 세운다**
 *   15°  비탈 — 어느 문서에도 없어 45° 의 1/3 로 두었다. 걸어 오를 수 있지만 평평하지는 않은 구간
 */
export const SLOPE_DEGREES = { sloped: 15, steep: 45 } as const;

// 표면 태그 — 이름은 이 세계의 것이고 기반은 뜻을 모른다 (불투명 문자열).
// 색 표(terrain-presentation)와 이 표가 같은 이름을 읽도록 상수로 둔다.
export const SURFACE_FLAT = 'flat';
export const SURFACE_SLOPE = 'slope';
export const SURFACE_STEEP = 'steep';

/**
 * 표면 규칙 표 — **배열 순서로 첫 번째로 맞는 것이 이긴다** (evaluateSurface).
 *
 * maxSlope 는 "이 값 미만" 이므로 오름차순으로 적고, 마지막 줄만 위를 열어 둔다 —
 * 열린 줄이 앞에 오면 그 뒤는 아무것도 맞지 않는다. 셋의 뜻은 아래와 같다.
 *
 *   flat    평지    걸어 다니는 땅. 방의 남쪽과 능선의 기슭이 여기다
 *   slope   비탈    오를 수는 있으나 평평하지 않은 땅. 능선의 허리
 *   steep   급경사  꼭대기 언저리. 이 Cycle 에서는 색일 뿐이고, 몸을 세우는 것은 C006 이다
 */
export const SURFACE_RULES: readonly SurfaceRule[] = [
  { tag: SURFACE_FLAT, maxSlope: SLOPE_DEGREES.sloped * DEGREE },
  { tag: SURFACE_SLOPE, maxSlope: SLOPE_DEGREES.steep * DEGREE },
  { tag: SURFACE_STEEP }, // 위가 열려 있다 — 남은 전부를 받는 마지막 줄
];

/** 컴파일이 받는 규칙 한 벌 — 해상도와 표면 규칙. 이 값이 곧 hash 의 일부다 */
export const COMPILE_RULES: CompileRules = {
  resolution: TERRAIN_RESOLUTION,
  surface: SURFACE_RULES,
};
