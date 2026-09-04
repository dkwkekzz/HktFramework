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
//
// C006 이 넷째를 더한다 — **젖음**. 앞의 셋을 가른 것이 경사였다면 이것을 가르는 것은 물이다:
// 물이 밴 흙은 마른 흙보다 어둡고, 색상이 초록·갈색 계열을 벗어나 청록으로 넘어간다. 그래서
// 앞의 셋 중 어느 것 옆에 놓여도(강은 평지도 비탈도 가로지른다) 계열이 겹치지 않고,
// 넷 가운데 가장 어두워 강이 방을 가르는 **띠**로 한눈에 읽힌다.
//
// C006 ADDED — 땅 위에 서는 것(instance). 색이 지면의 결이라면 이것은 지면에 꽂힌 표식이다.
// 무엇을 그릴지도(sprite) 얼마나 크게 세울지도(worldHeight) 여기 표가 정한다 — 기반은
// landmark 태그의 뜻을 모른 채 이 함수만 부른다.

import type { TerrainPalette } from '../../engine/view-kernel/terrain/terrain';
import type { CompiledRegion, CompileRules } from '../../engine/world-authoring/compiled';
import { compileRegion } from '../../engine/world-authoring/compile';
import { pointsOf } from '../../engine/world-authoring/description';
import { tagsAt } from '../../engine/world-authoring/query';
import { REGION_SPECS, regionSpec } from '../regions/index';
import { COMPILE_RULES, SURFACE_FLAT, SURFACE_SLOPE, SURFACE_STEEP, SURFACE_WET } from './biome-rules';

/** surface 태그 → 지면에 곱할 색. 태그가 늘면 여기 한 줄이 는다 */
export const SURFACE_COLORS: Readonly<Record<string, number>> = {
  // 평지 — 풀이 앉은 땅. 이 세계의 지면 기본색이고, 데이터가 없는 여덟 방은 전부 이 색 하나다
  [SURFACE_FLAT]: 0x4e7a3e,
  // 비탈 — 풀이 벗겨져 흙이 드러난다. 초록에서 갈색으로 한 칸 옮긴 색
  [SURFACE_SLOPE]: 0x9a6b3a,
  // 급경사 — 흙도 남지 못한 맨 바위. 색상 자체를 버리고 무채색으로 나가 앞의 둘과 계열이 갈린다
  [SURFACE_STEEP]: 0xa8a49c,
  // 젖음 — 강이 적신 땅. 초록·갈색·무채색 어느 쪽도 아닌 청록으로 나가고(앞의 셋 중 무엇과
  // 이웃해도 계열이 겹치지 않는다), 넷 가운데 가장 어둡다 — 젖은 흙이 마른 흙보다 어둡다는
  // 같은 이유가 화면에서 "여기가 물이 지나는 자리" 로 읽히게 한다.
  // 출구 표식의 물길 색(TRANSITION_TINTS.river = 0x2f9a8f)과 같은 청록 계열이되 지면이므로
  // 훨씬 어둡다 — 표식은 눈에 띄어야 하고 지면은 그 위에 선 것을 가리지 않아야 한다.
  [SURFACE_WET]: 0x39707a,
};

// 표에 없는 태그의 기본 결정 — 무채색 (DEFAULT_DEPTH_PRESENTATION 과 같은 값·같은 뜻).
// 태그가 늘어도 게임은 멈추지 않고 색만 없다 (C001 부터의 폴백 규칙).
export const DEFAULT_SURFACE_COLOR = 0x9a9a9a;

export function surfaceColor(surfaceTag: string): number {
  return SURFACE_COLORS[surfaceTag] ?? DEFAULT_SURFACE_COLOR;
}

// 백색 거목 — L2-World-Concept §3 의 정식 이름이자 백왕령이 안전한 조건 셋 중 하나다.
// 태그를 **놓는** 자리는 Region 데이터이고(content/regions/white-king-domain.ts),
// 여기는 그 이름을 **그림으로 옮기는** 표다. 방 이름 표(REGION_NAMES)가 region id 를
// 글자로 적는 것과 같은 어법이다 — 표현 표는 세계의 코드를 키로 받아 적지, 그 코드를
// 선언하는 쪽에 매이지 않는다 (모르는 태그는 아래에서 null 로 떨어진다).
const WHITE_GIANT_TREE = 'WHITE_GIANT_TREE';

/**
 * 땅에 서는 표식 — landmark 태그 → 그림과 높이. 태그가 늘면 여기 한 줄이 는다.
 *
 * 높이 17 의 근거 — 관찰자의 몸이 3.4(character-catalog: rabbit-swordsman body.height)이므로
 * **몸 높이의 5배**다. 셋을 견주어 고른 값이다.
 *   ① 사람보다 훨씬 커야 한다 — "거목" 이 이름이다. 2~3배로는 큰 나무일 뿐 거목이 아니다.
 *   ② 북쪽 능선(높이 14)에 밀리지 않아야 한다 — 남쪽 평지에 선 이것이 방에서 가장 높은
 *      것이어야 산맥 반대편에서도 눈에 들고, 도시가 "거목 곁" 이라는 것이 읽힌다.
 *   ③ 방(40×40)을 가리지 않아야 한다 — 그림은 정사각이지만 줄기·잎이 16px 폭의 절반쯤만
 *      차지하므로 실제 덮는 폭은 8 남짓이다. 방의 1/5 — 표식이지 벽이 아니다.
 */
export const LANDMARK_INSTANCES: Readonly<
  Record<string, { spriteId: string; worldHeight: number }>
> = {
  [WHITE_GIANT_TREE]: { spriteId: 'landmark:white-giant-tree', worldHeight: 17 },
};

/**
 * 모르는 태그는 **null — 그리지 않는다** (C001 부터의 폴백 규칙).
 * 표에 없는 표식이 있다고 아무 그림이나 세우면, 화면이 세계에 없는 것을 말하게 된다.
 */
export function landmarkInstance(tag: string): { spriteId: string; worldHeight: number } | null {
  return LANDMARK_INSTANCES[tag] ?? null;
}

// ── 미로의 식물 (C008 ADDED) ──────────────────────────────────────────
//
// 재배열이 건드리지 않는 유일한 것이고(spec R3) 그래서 **관찰의 기준점**이다 —
// "지도는 못 그려도 이름표는 읽는다"(Play §5.3). 그림 넷은 sprites.ts 가 그렸고,
// 여기는 **어느 자리에 어느 그림을 세울지**를 정한다.
//
// layer 이름을 데이터 쪽에서 import 하지 않고 여기 적는 것은 위의 WHITE_GIANT_TREE 와
// 같은 이유다 — 표현 표는 세계의 코드를 키로 받아 적지, 그 코드를 선언하는 쪽에 매이지 않는다.
const CELL_LAYER = 'cell';
const CLUE_LAYER = 'clue';

/**
 * **구역 태그 → 그 구역의 식물.** clue 태그가 아니라 cell 태그가 키인 것이 핵심이다.
 *
 * 식물 넷의 **이름은 아직 데이터의 것**이다 (spec UNRESOLVED "식물 넷의 이름" — 이름 짓기는
 * Human 에게 위임되어 있다). 그 이름을 여기에 미리 적어 두면 이름이 정해지는 순간 표가
 * 어긋나고 식물이 사라진다. 그래서 이름을 묻지 않고 **그 식물이 선 구역**을 묻는다 —
 * 자리는 데이터에 이미 있고(clue point 가 어느 cell area 안인가), 구역 태그 A~D 는
 * spec 이 못 박은 값이다.
 *
 * 그래서 "구역마다 다른 식물" 이 이름과 무관하게 **구성으로** 참이 된다. 이름이 확정되면
 * 이 표를 clue 태그로 옮겨 적을 수 있고, 그때도 그림과 색은 한 값도 바뀌지 않는다.
 *
 * 높이 6 의 근거 — 관찰자의 몸이 3.4 이므로 **몸의 1.75배**다. 사람보다 크게 서야 40×40
 * 구역의 반대편에서도 눈에 들고, 거목(17)의 1/3 아래로 두어야 "표식" 과 "거목" 의 계급이
 * 갈린다 — 식물은 이름표이지 방을 가리는 것이 아니다.
 */
const CLUE_PLANTS: Readonly<Record<string, { spriteId: string; worldHeight: number }>> = {
  A: { spriteId: 'clue:coil-fern', worldHeight: 6 },
  B: { spriteId: 'clue:cap-bloom', worldHeight: 6 },
  C: { spriteId: 'clue:spine-stalk', worldHeight: 6 },
  D: { spriteId: 'clue:bell-vine', worldHeight: 6 },
};

// clue 태그 → 식물. 방 데이터를 한 번 훑어 만든다 (아래 clueInstance 가 처음 물을 때).
const CLUE_BY_TAG = new Map<string, { spriteId: string; worldHeight: number }>();
let clueMapBuilt = false;

/**
 * clue point 마다 "그 자리를 품은 cell area" 를 물어 식물을 정한다.
 * 판정은 기반의 tagsAt 그대로다 — 자리로 묻는 기구는 이미 있고 새로 만들지 않는다.
 *
 * clue point 가 없는 방은 컴파일하지도 않는다 — 아홉 방을 다 컴파일할 이유가 없다.
 */
function buildClueMap(): void {
  clueMapBuilt = true;
  for (const spec of REGION_SPECS) {
    const clues = pointsOf(spec.space, CLUE_LAYER);
    if (clues.length === 0) continue;
    const compiled = regionTerrain(spec.id);
    if (!compiled) continue;
    for (const clue of clues) {
      const cell = tagsAt(compiled.world, clue.position.x, clue.position.z, CELL_LAYER)[0];
      const plant = cell === undefined ? undefined : CLUE_PLANTS[cell];
      if (plant) CLUE_BY_TAG.set(clue.tag, plant);
    }
  }
}

/** 그 clue 태그의 식물 — 구역 밖에 놓인 clue 는 null 이다 (모르는 것은 그리지 않는다) */
export function clueInstance(tag: string): { spriteId: string; worldHeight: number } | null {
  if (!clueMapBuilt) buildClueMap();
  return CLUE_BY_TAG.get(tag) ?? null;
}

/**
 * 땅에 서는 것 전부 — 표식(landmark)과 식물(clue). 어느 쪽도 아니면 그리지 않는다.
 * 기반은 layer 를 알지 못하고 태그 하나만 묻는다 (TerrainPalette.instanceOf).
 */
export function terrainInstance(tag: string): { spriteId: string; worldHeight: number } | null {
  return landmarkInstance(tag) ?? clueInstance(tag);
}


/** 기반에 넘기는 표현 표 — 기반은 태그의 뜻을 모른 채 이 함수들만 부른다 (설계 반전 ⑤) */
export const TERRAIN_PALETTE: TerrainPalette = {
  colorOf: surfaceColor,
  instanceOf: terrainInstance,
};

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
