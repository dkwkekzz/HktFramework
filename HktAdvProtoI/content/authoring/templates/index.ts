// content/authoring/templates — 이 세계의 작성 기본형 (T3 ADDED).
//
// 뼈대 생성기(engine/world-authoring/author.ts)는 "갈래마다 땅 묶음이 있다 · 역할마다 원천의
// 기본형이 있다" 는 형만 안다. **무엇이 그 갈래이고 얼마나 주는지는 이 파일이 안다** —
// 게임 명사가 있으므로 content 다 (CLAUDE.md 원칙 5 · Tool-Scale §3.1 자리 표).
//
// 값의 출처는 지금 서 있는 방들이다. 지어낸 수가 없다 — 손으로 쓴 방에서 잰 것을 옮겼다.
// 표를 고치는 것이 곧 다음 방들의 모습을 고치는 일이고, 그것은 코드가 아니라 이 데이터다.

import type { AuthorTemplates, TerrainRecipe } from '../../../engine/world-authoring/author';
import { ANCHOR_LAYER } from '../../regions';
import { RESOURCE_LAYER, TRACE_LAYER, soilStainTag } from '../../regions';

/**
 * 갈래별 땅 — 비율로 적는다 (방 반지름 1 기준).
 *
 * `hazard/terrain` 의 값은 숲 가장자리의 분지에서 왔다 (C007 실측): 방 반지름 20 에 중심
 * (10, 0) · 반경 10 · 깊이 9 · falloff 2 → 비율로 (0.5, 0) · 0.5 · 0.45 · 2.
 * 중심을 한가운데에 두지 않는 것이 그 실측의 핵심이다 — 급경사 고리가 닫히면 그 안의 몸이 갇힌다.
 *
 * `hazard/climate` 의 마루는 백왕령의 북쪽 능선과 같은 족(族)이다.
 * 나머지 다섯 갈래(creature · ecology · matter · phenomenon · knowledge)는 **땅으로 적히지
 * 않는다** — 그것들은 생물 · 물질 · 규칙이 지는 것이고, 이 표에 지어 넣지 않는다.
 */
const TERRAIN_BY_KIND: Record<string, readonly TerrainRecipe[]> = {
  'hazard/terrain': [
    { id: 'basin-hollow', stamp: 'basin', center: { x: 0.5, z: 0 }, radius: 0.5, height: 0.45, falloff: 2 },
  ],
  'hazard/climate': [
    { id: 'ridge-north', stamp: 'ridge', center: { x: 0, z: 0.8 }, radius: 0.6, height: 0.5, falloff: 2 },
  ],
};

/** 갈래가 땅을 말하지 않는 방 — 평평한 채로 선다. 없는 지형을 지어내지 않는다 */
const TERRAIN_FALLBACK: readonly TerrainRecipe[] = [];

/**
 * 깊이별 방 크기와 흔적 바탕.
 *
 * 크기: 지금 방 열하나 가운데 아홉이 한 변 40(반지름 20)이고 거목 내부와 미로만 한 변 80 이다.
 * 흔적 바탕: C011 의 사다리 그대로 — 백왕령 0 · 경계부 1 · 중간부 2 · 핵심부 3.
 * 깊이는 그 사다리의 자리를 정하고, 원천 둘레가 거기서 한 단계 짙어진다.
 */
const BY_DEPTH = {
  civil: { half: 20, traceBase: 0 },
  outer: { half: 20, traceBase: 1 },
  wild: { half: 20, traceBase: 2 },
  deep: { half: 40, traceBase: 3 },
} as const;

/**
 * 역할별 원천 기본형 — C011 · C012 의 원천 넷에서 옮겼다.
 *
 *   baseline     거저 주는 자리. 다시 난다 (숲 가장자리의 허물 3 · 폐허의 더미 2 → 3 을 기본으로)
 *   risk         위험을 낀 자리. 캔 자리에는 다시 나지 않고 옮겨 서며, 무너져 길을 막는다 (노두)
 *   conditional  조건이 맞아야 다시 맺힌다. 한 번에 하나 (거목의 뿌리혹)
 *   by-product   곁딸려 나오는 것. 아직 이 세계에 선 예가 없어 baseline 을 따르되 덜 준다
 */
const SOURCE_BY_ROLE = {
  baseline: { supply: 'baseline-renewable', harvests: 3 },
  risk: { supply: 'migratory', harvests: 3, collapses: true },
  conditional: { supply: 'conditional-renewable', harvests: 1 },
  'by-product': { supply: 'baseline-renewable', harvests: 1 },
} as const;

export const WORLD_AUTHOR_TEMPLATES: AuthorTemplates = {
  anchorLayer: ANCHOR_LAYER,
  resourceLayer: RESOURCE_LAYER,
  traceLayer: TRACE_LAYER,
  traceTag: soilStainTag,
  byDepth: BY_DEPTH,
  depthFallback: { half: 20, traceBase: 0 },
  terrainByKind: TERRAIN_BY_KIND,
  terrainFallback: TERRAIN_FALLBACK,
  sourceByRole: SOURCE_BY_ROLE,
};
