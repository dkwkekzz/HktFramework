// content/authoring/templates — 이 세계의 작성 기본형 (T3 ADDED).
//
// 뼈대 생성기(engine/world-authoring/author.ts)는 "갈래마다 땅 묶음이 있다 · 역할마다 원천의
// 기본형이 있다 · 탄생 방식마다 결속의 기본형이 있다" 는 형만 안다. **무엇이 그 갈래이고
// 얼마나 주는지는 이 파일이 안다** — 게임 명사가 있으므로 content 다
// (CLAUDE.md 원칙 5 · Tool-Scale §3.1 자리 표).
//
// 값의 출처는 지금 서 있는 방들이다. 지어낸 수가 없다 — 손으로 쓴 방에서 잰 것을 옮겼다.
// 표를 고치는 것이 곧 다음 방들의 모습을 고치는 일이고, 그것은 코드가 아니라 이 데이터다.
//
// **잴 방이 없으면 표에 두지 않는다.** 표에 없는 갈래 · 없는 탄생 방식 · 없는 세계 상태는
// 생성기가 그 자리를 **내지 않는 것**으로 답한다 (탄생 방식은 `unauthored` 에 왜 못 냈는지가
// 남는다). 없는 것을 지어 넣는 것이 이 파일에서 가장 나쁜 일이다.

import type {
  AuthorTemplates,
  BirthDefaults,
  PhaseRecipe,
  PopulationDefaults,
  StateRequirement,
  TerrainRecipe,
} from '../../../engine/world-authoring/author';
import { ANCHOR_LAYER } from '../../regions';
import { CLUE_LAYER, RESOURCE_LAYER, TRACE_LAYER, soilStainTag } from '../../regions';
import { DEPTH_LAYER, HAZARD_LAYER, PRESENCE_LAYER } from '../../regions';
import {
  LIFE_FUNGUS_CROWDED,
  LIFE_HAS_OWNER,
  LIFE_NEEDS_CARCASS,
  LIFE_NEEDS_MATERIAL,
  LIFE_NEEDS_PARENT,
  LIFE_NEEDS_RAIN,
  LIFE_SOURCE_RAIN,
} from '../../regions';

/**
 * 갈래별 땅 — 비율로 적는다 (방 반지름 1 기준).
 *
 * `hazard/terrain` 의 값은 숲 가장자리의 분지에서 왔다 (C007 실측): 방 반지름 20 에 중심
 * (10, 0) · 반경 10 · 깊이 9 · falloff 2 → 비율로 (0.5, 0) · 0.5 · 0.45 · 2.
 * 중심을 한가운데에 두지 않는 것이 그 실측의 핵심이다 — 급경사 고리가 닫히면 그 안의 몸이 갇힌다.
 *
 * `hazard/climate` 의 마루는 백왕령의 북쪽 능선과 같은 족(族)이다.
 *
 * **나머지 다섯 갈래는 잴 방이 없어 표에 두지 않는다** (T3 CHANGED — 지금 세계에서 다시 쟀다).
 * 갈래를 밝힌 방은 넷뿐이고(brief 의 `kinds`), 그 넷의 `space.ops` 를 훑은 결과가 이렇다.
 *
 *   hazard/creature    포식수 둥지 — stamp 가 **하나도 없다**. anchor · 흔적 · 원천 · 덧씌움 ·
 *                      떼의 자락뿐이고 그 방은 어디나 평지다 (그 파일이 그렇게 적어 두었다).
 *   hazard/matter      빙결 협곡이 밝힌 셋 가운데 하나. 그 방에 stamp 여섯이 있지만 그것은
 *                      **협곡의 벽**이고, 같은 벽을 hazard/terrain 하나만 밝힌 얼음 협곡이
 *                      그대로 가지고 있다 — 곧 그 여섯은 terrain 의 것이지 matter 의 것이
 *                      아니다. 결정이 땅을 어떻게 짓는가를 밝힌 방은 없다.
 *   hazard/phenomenon  환상 미로가 밝힌 둘 가운데 하나. 그 방의 벽은 stamp 가 아니라
 *   hazard/knowledge   polygon 열이다 — 높이를 짓지 않는다 (막힌 땅을 그리는 다른 어법).
 *   hazard/ecology     **어느 brief 도 밝히지 않은 갈래다** — 잴 방 자체가 없다.
 *                      (폐허의 SEEP 위험이 이 갈래이지만 그 방은 `kinds: []` 라 근거가 되지
 *                      못한다 — 밝히지 않은 방의 값은 갈래의 근거가 아니다.)
 *
 * 얼음 협곡(hazard/terrain 하나만 밝힌 방)의 벽을 이 표의 terrain 줄로 삼을 수도 있다 —
 * 실측은 방 반지름 20 에 마루 여섯, 중심 (∓0.9, −0.7 · 0 · 0.7) · 반경 0.7 · 높이 1.0 ·
 * falloff 2 다. **두지 않았다**: 분지와 벽 여섯을 한 방에 함께 세운 방이 이 세계에 없고,
 * 둘 중 무엇이 이 갈래의 땅인가는 재서 답할 것이 아니라 정해야 하는 것이기 때문이다
 * (DESIGN GAP — 그 결정이 서면 이 줄을 그것으로 바꾼다).
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
// recoverySeconds 는 지금 선 방들이 쓰는 값에서 왔다 — 역할마다 하나씩 (지어낸 수가 아니다):
//   baseline 60(허물) · 90(폐허) → 60 · conditional 30(물길) · by-product 120(사체) · risk 180(광맥 · 뿌리혹 · 호수)
const SOURCE_BY_ROLE = {
  baseline: { supply: 'baseline-renewable', harvests: 3, recoverySeconds: 60 },
  risk: { supply: 'migratory', harvests: 3, collapses: true, recoverySeconds: 180 },
  conditional: { supply: 'conditional-renewable', harvests: 1, recoverySeconds: 30 },
  'by-product': { supply: 'baseline-renewable', harvests: 1, recoverySeconds: 120 },
} as const;

/**
 * 탄생 방식별 기본형 — 이 세계에 **선 탄생지 셋**에서 그대로 잰 것이다 (T3 ADDED).
 *
 *   ENVIRONMENTAL_BINDING  붉은 알집 ROOT_CLUTCH (content/regions/red-eye-tree.ts)
 *   INHERITED              뿌리의 알 ROOT_EGGS   (같은 방)
 *   TRANSFORMATION         사체의 변성 CARCASS_TO_FUNGUS (content/regions/predator-nest.ts)
 *
 * **SEPARATION 은 표에 없다.** 어휘 넷 가운데 하나이지만(content/regions/lives.ts) 이 세계에
 * 그것으로 선 탄생지가 **하나도 없어 잴 것이 없다**. 여기에 지어 넣으면 생성기가 아무 방에서도
 * 재지 않은 결속의 길이와 요구의 꼴을 방 백 개에 퍼뜨리게 된다. 표에 없는 방식이 brief 에 오면
 * 생성기는 그 탄생지를 내지 않고 `unauthored` 에 왜 못 냈는지를 남긴다 — 그것이 옳은 답이다.
 * 분화로 태어나는 것이 세계에 처음 서는 날 그 방에서 재어 한 줄을 더한다.
 *
 * `transition` 이 셋 다 같은 것은 지어낸 것이 아니라 잰 것이다 — 셋 다
 * `{ from: 'DORMANT', to: 'BORN' }` 이다 (탄생지의 phase 넷 · ecology.ts `LifeSitePhase`).
 *
 * `spentSeconds` 도 셋 다 120 이다 — 결속의 길이(60 · 90 · 120)는 방식마다 갈리는데
 * 터진 채 머무는 길이는 갈리지 않았다 (ROOT_EGGS 가 "알집과 **같은 길이**로 머문다" 고 적어 둔
 * 그 자리다: 밝히지 않으면 계승이 끝없이 돌아 상한까지 순식간에 찬다).
 *
 * `sourceUnmetCode` 는 **방식마다 하나**뿐인데 방은 소비하는 원천마다 다른 코드를 준다 —
 * ROOT_CLUTCH 는 뿌리혹에 `life-needs-material`, 둥지의 균사에 `life-needs-decay` 를 건다.
 * 셋의 소비 원천 넷 가운데 셋이 **그 방의 재료**이고 그 셋이 material · material · carcass 이므로
 * 방식마다 "그 방식이 먹는 것" 하나를 옮겼다. 다른 방의 것을 먹는 탄생(ROOT_CLUTCH 의 균사)이
 * 주는 둘째 코드는 이 꼴로는 실을 자리가 없다 — 지어내는 대신 비운다.
 */
const BIRTH_BY_MODE: Record<string, BirthDefaults> = {
  // 붉은 알집 — 환경의 조건들이 맺혀 태어난다. 요구 넷 가운데 개체군에 거는 것 하나:
  // "광식충이 아직 하나도 없다" (최초는 결속이고 이후는 계승이기 때문이다)
  ENVIRONMENTAL_BINDING: {
    bindingSeconds: 60,
    spentSeconds: 120,
    transition: { from: 'DORMANT', to: 'BORN' },
    populationRequirement: { kind: 'population-at-most', value: 0, unmetCode: LIFE_HAS_OWNER },
    sourceUnmetCode: LIFE_NEEDS_MATERIAL,
  },
  // 뿌리의 알 — 이미 있는 것이 낳는다. 알집의 "아직 아무도 없다" 와 정확히 반대인 요구가
  // 개체군에 걸린다: 이을 것이 하나 이상. 결속(60)보다 긴 90 초다
  INHERITED: {
    bindingSeconds: 90,
    spentSeconds: 120,
    transition: { from: 'DORMANT', to: 'BORN' },
    populationRequirement: { kind: 'population-at-least', value: 1, unmetCode: LIFE_NEEDS_PARENT },
    sourceUnmetCode: LIFE_NEEDS_MATERIAL,
  },
  // 사체의 변성 — 있던 것이 다른 것으로 바뀐다. 개체군에 거는 것은 "아직 다 피지 않았다":
  // 값 1(상한 2 의 바로 아래)이 그 방에서 잰 눈금이고, 코드가 균류를 이름하는 것은
  // 이 방식으로 선 것이 지금 거목균 하나뿐이기 때문이다 (둘째가 서면 그때 갈린다)
  TRANSFORMATION: {
    bindingSeconds: 120,
    spentSeconds: 120,
    transition: { from: 'DORMANT', to: 'BORN' },
    populationRequirement: { kind: 'population-at-most', value: 1, unmetCode: LIFE_FUNGUS_CROWDED },
    sourceUnmetCode: LIFE_NEEDS_CARCASS,
  },
};

/**
 * 재료가 아닌 세계 상태 → 요구 (T3 ADDED).
 *
 * 지금 세계가 그 대응을 세운 자리는 **하나**다: 붉은 알집이 재료 둘(생체 광석 · 거목균) 곁에
 * 재료가 아닌 것 하나로 **비**를 들고, 그것이 요구 `{ kind: 'rain', unmetCode: life-needs-rain }`
 * 으로 선다 (비는 세계 시각과 철에서 유도되고 저장되지 않는다).
 *
 * **뿌리의 알이 든 `ORE_EATER`(부모 개체군)는 이 표에 없다.** 그 방도 그것을 `source.states` 에
 * 적지만 요구로 세우는 것은 `population-at-least` 이지 상태 요구가 아니다 — 곧 그 자리는 위
 * `birthByMode.INHERITED.populationRequirement` 가 이미 가지고 있다. 여기에 또 한 줄을 두면
 * 같은 요구가 두 번 걸린다.
 *
 * 표에 없는 상태는 요구가 되지 않는다 — 생성기가 거르고 지나간다.
 */
const STATE_REQUIREMENT: Record<string, StateRequirement> = {
  [LIFE_SOURCE_RAIN]: { kind: LIFE_SOURCE_RAIN, unmetCode: LIFE_NEEDS_RAIN },
};

/**
 * 개체군의 기본형 (T3 ADDED).
 *
 * `birthDisturbance` 5 — 거목의 방의 광식충에서 왔다. 타격과 같은 눈금이고 채취(10)보다 작으며,
 * 깨어남의 임계가 300 이므로 탄생만으로는 방이 깨어나지 않는다. 소란을 밝힌 개체군은 지금
 * 그것 하나뿐이다 (둥지의 거목균 · 포식수 · 숲 안쪽의 새는 셋 다 밝히지 않는다 — 태어나지 않는
 * 개체군은 방을 술렁이게 할 탄생이 없기 때문이고, 생성기도 그 개체군을 올리는 탄생지가 있을
 * 때만 이 값을 싣는다).
 *
 * `radiusStep` 0.15 — 거목의 방의 떼 자락 넷에서 **잰 것**이다: 반지름이 4 · 7 · 10 · 13 으로
 * 한 자락마다 3 씩 넓어지고, 방 반지름 20 에 대해 3/20 = 0.15 다.
 * (같은 방의 둥지 하나짜리 자락 — 포식수 — 은 반지름 8 하나뿐이라 **넓어지는 비를 재지 못한다**:
 * 자락이 둘 이상인 개체군은 이 세계에 광식충 넷과 숲 안쪽의 새 둘뿐이고, 새의 두 자락도
 * 4 · 7 로 같은 3 이다 — 두 방이 같은 눈금을 쓴다.)
 * **첫 자락의 4 는 이 꼴이 담지 못한다** — `half × radiusStep × n` 은 0 에서 3 씩 오르므로
 * 3 · 6 · 9 · 12 를 낸다. 넓어지는 비는 잰 그대로이고 시작점 하나가 1 만큼 안쪽이다.
 * 시작점을 따로 둘 손잡이를 지금 만들지 않는다 (선행 추상화 금지 · 쓰는 자리가 아직 하나다).
 */
const POPULATION: PopulationDefaults = {
  birthDisturbance: 5,
  radiusStep: 0.15,
};

/**
 * 갈래별 철 덧씌움 (T3 ADDED).
 *
 * **잰 자리가 하나뿐이다.** 갈래를 밝힌 방 넷 가운데 철에 `depthOverlay` · `hazardExtend` 를
 * 거는 방은 포식수 둥지(`kinds: ['hazard/creature']`) 하나다 — 긴 밤에 굴 둘레가 한 단계
 * 깊어지고(wild → deep) 같은 자락이 hazard/creature 로 읽힌다.
 *
 * 레시피를 **둘로 나눈 것**은 그 방이 자락을 둘로 나눠 세웠기 때문이다 (`depth-nest-den` ·
 * `hazard-nest-den` — 같은 원 둘). 생성기도 레시피 하나마다 area 를 하나 세운다.
 *
 * 나머지 갈래에 줄이 없는 까닭:
 *   hazard/climate · hazard/terrain · hazard/matter  빙결 협곡이 셋을 밝히지만 그 방이 철에
 *     거는 것은 **다른 방으로 나가는 흐름**(outflow)뿐이고, 위험 넷은 철이 아니라 `standing`
 *     에 선다 — 늘 서 있는 것은 철 덧씌움이 아니다. 얼음 협곡(hazard/terrain)도 `standing` 뿐이다.
 *   hazard/phenomenon · hazard/knowledge  환상 미로는 `phases` 자체가 없다.
 *   hazard/ecology  어느 brief 도 밝히지 않은 갈래다 — 잴 방이 없다.
 *
 * 거목의 방도 긴 밤에 같은 hazard/creature 를 걸지만 `kinds: []` 라 **근거로 세지 않았다**
 * (밝히지 않은 방의 철은 그 갈래의 근거가 되지 못한다). 값이 우연히 같다는 것은 덤이다.
 */
const PHASE_BY_KIND: Record<string, readonly PhaseRecipe[]> = {
  'hazard/creature': [
    { season: 'LONG_NIGHT', depth: 'deep' },
    { season: 'LONG_NIGHT', hazard: 'hazard/creature' },
  ],
};

/**
 * **물음의 흔적이 사는 layer** (T2 확장 ADDED).
 *
 * 흔적은 layer 하나에 갇히지 않는다 (access.ts 의 `LockTrace` 가 적어 둔 그대로) — 그러나
 * 생성기가 낼 자리는 하나이므로 **지금 세계에서 재어** 하나를 골랐다. 묻는 방 셋의 Lock 이
 * 가리키는 흔적 일곱이 어느 layer 에 사는지가 그 실측이다.
 *
 *   clue    넷 — 미로의 식물 넷(clue-a · b · c · d). 이 layer 에 사는 op 가 세계를 통틀어
 *           그 넷뿐이고, **넷이 전부 Lock 의 흔적이다**.
 *   trace   셋 — 숲 안쪽의 방 바닥(trace-deep-base) · 협곡의 언 사체 곁(trace-frozen-remains) ·
 *           문 앞의 자락(trace-frost-depth-door). 그런데 이 layer 에 사는 op 는 열 방에
 *           일흔하나이고, 흔적으로 지목된 것은 그 가운데 **셋**이다. 나머지 예순여덟은
 *           원천 둘레의 흙 얼룩·숨의 사다리이고, 이 표가 이미 `traceLayer` · `traceTag` 로
 *           그것을 낸다.
 *
 * 그래서 `clue` 다 — 가르는 잣대는 수가 아니라 **무엇 전용인가**이고, 이 세계에서
 * "알아낼 흔적" 만 사는 layer 는 clue 하나다. 물음의 흔적을 trace 에 내면 그것이 같은 방에
 * 이 표가 낸 흙 얼룩과 같은 layer 에 서서, 읽는 쪽이 "짙기를 말하는 자락" 과 "알아낼 것을
 * 말하는 자락" 을 갈라 볼 자리가 없어진다 (협곡이 문 앞 자락에 짙기가 아닌 태그 하나를
 * 따로 붙여 그 둘을 손으로 가른 것이 그 사정을 이미 말한다).
 *
 * **재어 남은 어긋남 하나** — 이 layer 에 지금 선 넷은 point(식물)이고 생성기가 내는 흔적은
 * area(원)다. 그리는 쪽은 이 layer 에서 point 만 집으므로(view/terrain-presentation) 생성된
 * 자락은 미로의 식물처럼 서지 않는다. 자락을 그리는 규칙을 여기서 지어내지 않는다 — 무엇으로
 * 보일지는 그 방이 서는 날 그 방이 정한다.
 */
const ASKING_CLUE_LAYER = CLUE_LAYER;

export const WORLD_AUTHOR_TEMPLATES: AuthorTemplates = {
  anchorLayer: ANCHOR_LAYER,
  resourceLayer: RESOURCE_LAYER,
  traceLayer: TRACE_LAYER,
  clueLayer: ASKING_CLUE_LAYER,
  traceTag: soilStainTag,
  byDepth: BY_DEPTH,
  depthFallback: { half: 20, traceBase: 0 },
  terrainByKind: TERRAIN_BY_KIND,
  terrainFallback: TERRAIN_FALLBACK,
  sourceByRole: SOURCE_BY_ROLE,
  presenceLayer: PRESENCE_LAYER,
  depthLayer: DEPTH_LAYER,
  hazardLayer: HAZARD_LAYER,
  birthByMode: BIRTH_BY_MODE,
  stateRequirement: STATE_REQUIREMENT,
  population: POPULATION,
  phaseByKind: PHASE_BY_KIND,
};
