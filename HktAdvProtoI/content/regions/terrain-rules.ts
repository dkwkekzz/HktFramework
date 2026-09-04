// Terrain Rules — 지면의 표면·통행 규칙 표 (C005 의 content/view/biome-rules.ts 가 이리로 옮겨 왔다).
//
// 기반(engine/world-authoring)은 경사를 재고 거리를 재기만 하고 그 값이 무슨 뜻인지 모른다.
// "얼마나 기울면 비탈이고 어디부터 급경사인가" · "얼마나 가까우면 물인가" 는 이 세계의 의미이므로
// 여기 표가 정한다 — 표의 값이 바뀌면 땅의 뜻이 바뀌고, 코드는 한 줄도 바뀌지 않는다.
//
// C005 까지는 **관찰자만** 컴파일했으므로 표가 View 에 살았다. C006 에서 이동 규칙이
// traversable 을 읽는 순간 표는 world 와 view 의 공유물이 된다 — 값이 갈리면 세계가 막는 자리와
// 화면이 그리는 자리가 어긋난다 (C006 spec SPEC-006). 그 자리가 여기다.
// 경계 규칙 4 — 이 폴더는 engine 만 import 한다 (content/world · content/view 를 부르지 않는다).
//
// C005 에서 옮겨 온 값(TERRAIN_RESOLUTION · SLOPE_DEGREES · 표면 태그 셋 · SURFACE_RULES ·
// COMPILE_RULES)은 **한 글자도 바뀌지 않았다**. 이 Cycle 이 더한 것은 젖음(wet) 하나와
// 막힘/통과 규칙이다.

import type {
  BlockRule,
  CompileRules,
  PassRule,
  SurfaceRule,
} from '../../engine/world-authoring/compiled';

/**
 * 격자 칸의 크기 (세계 단위) — 확정 4.
 *
 * 컴파일 결과의 hash 에 섞이므로 이 값이 바뀌면 다른 땅이다. 결정론 상수이니 표가 아니라
 * 헤더 상수로 고정한다 (핵심 원칙 6 · C005 SPEC-002).
 */
export const TERRAIN_RESOLUTION = 1;

// 도 → 라디안. **변환은 이 한 자리에만 둔다** — 임계는 사람이 읽는 도(°)로 적고
// SurfaceRule.maxSlope · BlockRule.minSlope 는 기반이 재는 라디안이므로, 두 단위가 만나는
// 곳이 여기뿐이어야 한다.
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
/** C006 ADDED — 강 곁의 젖은 땅. 확정 5 의 넷째가 여기서 선다 */
export const SURFACE_WET = 'wet';

// 편집(op)의 layer · tag 이름 — Description 을 적는 쪽(content/regions/*.ts)과 그것을 읽는
// 쪽(world 의 판정 · view 의 그림)이 같은 글자를 쓰도록 상수로 둔다. 기반에게는 불투명 문자열이다.
export const FEATURE_LAYER = 'feature';
export const RIVER_TAG = 'river';
export const BRIDGE_TAG = 'bridge';
export const LANDMARK_LAYER = 'landmark';
export const SETTLEMENT_LAYER = 'settlement';
/** Concept §3.5 의 `condition` 을 셋으로 가른 접두사 — 관찰이 이 접두사로 조건을 고른다 */
export const CONDITION_PREFIX = 'condition:';
export const CONDITION_RIDGE = 'condition:ridge';
export const CONDITION_RIVER = 'condition:river';
export const CONDITION_TREE = 'condition:tree';
export const CITY_TAG = 'city';

// 막힘의 사유 코드 — 세계의 것이다. 문구("너무 가파르다")는 View 의 표가 옮긴다 (C001 부터의 규약).
export const BLOCK_STEEP = 'too-steep';
export const BLOCK_WATER = 'deep-water';

/**
 * 강 중심선에서 **물**이 되는 거리 (세계 단위 · 중심선에서 한쪽).
 *
 * 4 로 둔다 — 백왕령의 강 폭(width 8)의 절반이다. 강 폭 안이 곧 물이라는 뜻이며
 * (C006 spec R3), 폭이 바뀌면 이 값도 함께 바뀌어야 한다.
 *
 * 왜 8 이 폭인가: 클라이언트의 걸음은 진행 방향 1.6m 앞을 요청한다 (app/main.ts KEY_LOOKAHEAD).
 * 물의 폭이 그보다 넉넉히 커야 한 걸음으로 물을 뛰어넘지 못한다 — 8 은 그 다섯 배다.
 */
export const RIVER_WATER_DISTANCE = 4;

/**
 * 강 중심선에서 **젖음**으로 그리는 거리.
 *
 * 6 으로 둔다 — 물(4) 밖으로 2m 의 띠가 더 젖는다. Design 은 젖음의 폭을 어디에도 적지 않았다
 * (spec UNRESOLVED "강가 젖음의 폭"). 두 가지를 보고 골랐다.
 *   ① 물과 젖음이 같은 폭이면 띠가 보이지 않는다 — "강가 띠는 다른 색" (Observable ②) 이 관찰되려면
 *      물 바깥에 걸어 다닐 수 있는 젖은 땅이 있어야 한다.
 *   ② carve 는 자기 폭(4) 안에서만 높이를 건드리므로, 6 이면 파인 자리 전체가 젖음 안에 들어온다 —
 *      "파인 곳은 젖어 있다" 가 데이터로 늘 성립한다.
 */
export const RIVER_WET_DISTANCE = 6;

/**
 * 다리 point 둘레의 통과 반경.
 *
 * 5 로 둔다 — 물의 반폭(4)보다 커야 강을 **가로지르는** 칸줄이 끊기지 않는다. 4 로 두면
 * 다리가 중심선에서 조금만 어긋나도 건너편 물가 한 칸이 덮이지 않아 길이 끊긴다.
 * 5 는 그 여유(1m)이고, 걸음 하나(1.6m)로 건널 칸을 넉넉히 잇는다
 * (실측: 백왕령에서 몸이 놓이는 (0, 0) → 다리 8 걸음 → 강 건너 북쪽 문 FOREST_PATH 까지 14 걸음.
 * 다리를 지우면 강 북쪽에 닿는 칸이 0 이다).
 */
export const BRIDGE_PASS_RADIUS = 5;

/**
 * 표면 규칙 표 — **배열 순서로 첫 번째로 맞는 것이 이긴다** (evaluateSurface).
 *
 * 젖음이 맨 앞이다 — 강 곁은 경사보다 먼저 젖는다. 그 뒤 셋은 maxSlope 가 "이 값 미만" 이므로
 * 오름차순으로 적고, 마지막 줄만 위를 열어 둔다 — 열린 줄이 앞에 오면 그 뒤는 아무것도 맞지 않는다.
 *
 *   wet     젖음    강 중심에서 RIVER_WET_DISTANCE 안. 물과 그 물가
 *   flat    평지    걸어 다니는 땅. 방의 남쪽과 능선의 기슭이 여기다
 *   slope   비탈    오를 수는 있으나 평평하지 않은 땅. 능선의 허리
 *   steep   급경사  꼭대기 언저리. 여기서부터 몸이 선다 (BLOCK_RULES 의 첫 줄과 같은 임계다)
 */
export const SURFACE_RULES: readonly SurfaceRule[] = [
  {
    tag: SURFACE_WET,
    nearCurve: { layer: FEATURE_LAYER, tag: RIVER_TAG, maxDistance: RIVER_WET_DISTANCE },
  },
  { tag: SURFACE_FLAT, maxSlope: SLOPE_DEGREES.sloped * DEGREE },
  { tag: SURFACE_SLOPE, maxSlope: SLOPE_DEGREES.steep * DEGREE },
  { tag: SURFACE_STEEP }, // 위가 열려 있다 — 남은 전부를 받는 마지막 줄
];

/**
 * 막는 규칙 표 — 맞는 칸은 traversable = 0 이고 사유 태그를 갖는다 (C006 spec R3).
 * **배열 순서로 첫 번째로 맞는 것이 사유가 된다** (표면 규칙과 같은 규율).
 *
 * 물이 맨 앞이다 — 표면 규칙이 젖음을 맨 앞에 둔 것과 같은 이유다. 강이 산기슭을 지나는
 * 구간에서는 한 칸이 물이면서 급경사이기도 한데(실측: 백왕령에서 46 칸), 화면은 그 칸을
 * 젖음으로 그린다. 사유가 급경사라면 보는 것과 듣는 말이 어긋난다 — 물이 있는 자리는 물이 막는다.
 * 물 밖에서는 이 순서가 아무것도 바꾸지 않는다 (실측: 강이 평지를 지나는 구간의 최대 경사 27.8°).
 *
 * 급경사의 임계는 표면의 steep 과 **같은 값**이다 — 그래야 화면이 급경사로 그린 자리가 곧
 * 세계가 막는 자리다 (SPEC-006). 물은 강 폭 안이다 — 깊이가 아니라 폭이 막는다.
 */
export const BLOCK_RULES: readonly BlockRule[] = [
  {
    nearCurve: { layer: FEATURE_LAYER, tag: RIVER_TAG, maxDistance: RIVER_WATER_DISTANCE },
    reason: BLOCK_WATER,
  },
  { minSlope: SLOPE_DEGREES.steep * DEGREE, reason: BLOCK_STEEP },
];

/**
 * 막힘을 덮는 자리 — 놓은 것이 규칙을 이긴다 (spec R3 의 둘째 IF).
 * 다리 point 둘레는 물 위여도 건널 수 있다. 다리가 없는 방에는 이 규칙이 아무 일도 하지 않는다.
 */
export const PASS_RULES: readonly PassRule[] = [
  { layer: FEATURE_LAYER, tag: BRIDGE_TAG, radius: BRIDGE_PASS_RADIUS },
];

/** 컴파일이 받는 규칙 한 벌 — 해상도 · 표면 · 막힘 · 통과 · 그릴 표식. 이 값이 곧 hash 의 일부다 */
export const COMPILE_RULES: CompileRules = {
  resolution: TERRAIN_RESOLUTION,
  surface: SURFACE_RULES,
  blocked: BLOCK_RULES,
  passages: PASS_RULES,
  // 그리는 쪽으로 내보낼 point layer — 거목이 땅에 서는 자리다 (SPEC-008).
  // anchor·feature 는 내보내지 않는다: 출구는 이미 존재로 관찰되고, 다리는 땅의 모양이 말한다.
  instanceLayers: [LANDMARK_LAYER],
};
