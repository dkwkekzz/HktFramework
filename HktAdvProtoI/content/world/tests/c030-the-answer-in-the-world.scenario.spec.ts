// C030 — 답이 세계에 있다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-005 · SPEC-007 ~ SPEC-009)
//
// C029 는 협곡의 문이 **묻게** 했고 거기서 멈췄다. 이 Cycle 이 그 물음의 **답을 세계에 세운다** —
// 협곡이 아니라 숲에, 그것도 살아 있는 것 안에. 그래서 여기서 재는 것은 일곱이다:
//   ① 원천 — 재료 하나와 원천 하나가 spec 의 값 표대로 서고, 그 원천이 자기 재료의 코드를 싣는다
//   ② 흔적 — 셋째 어휘(온기)가 서고 들어온 문에서 원천까지 **단조롭게** 짙어진다.
//      앞의 두 어휘(흙 · 숨)를 읽던 답은 한 값도 달라지지 않는다
//   ③ 채취 — 한 번에 고갈되고, 둘레가 한 단계 옅어지고, 고갈된 동안 「자리가 식었다」를 진다.
//      그 코드를 밝히지 않은 원천은 몇 번을 캐도 한 글자도 늘지 않는다
//   ④ 사슬 — 매달린 것(거목균)이 고갈이면 진행이 0 이고 「되돌아옴이 멎었다」가 함께 실린다
//   ⑤ 성질 — 그 재료가 성질 태그를 지고, 그 이름(축:관계)은 화면 어디에도 실리지 않는다
//   ⑥ 문 — 결정을 지녀도 문의 답이 한 값도 달라지지 않는다 (K12)
//   ⑦ 길 — 백왕령에서 그 원천까지 그 문을 지나지 않고 닿는다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/regions 의 새 원천 데이터 · 새 흔적 어휘 · 새 조건 코드 ·
// content/world 의 새 규칙 · content/view/** 의 표 · engine 의 accessAnswerMap)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C030-the-answer-in-the-world/spec.md 와 이미 있던 하네스·선례
// (c011 · c012 · c013 · c020 · c021 · c029)뿐이다.
//
// **자리도 시간도 횟수도 손으로 적지 않는다** — 원천의 자리는 그 방 resource layer 의 point 에서,
// 들어온 문의 자리는 graph 의 anchor 에서, 되돌아옴의 길이와 캘 횟수는 resourceEcology 에서 읽는다.
// 손으로 적는 것은 spec 이 「데이터 값」 표에서 이름으로 못 박은 것(재료 · 원천 · 방 · 성질 ·
// 형태의 이름 · 고갈의 코드 · 흔적 어휘의 접두사 · 지는 것 · 기회 자리 · 공급)뿐이고, 그것들은
// 세계에서 유도할 자리가 없다 (c013 · c020 · c029 의 규율 그대로).
//
// **번호는 이어 붙인다** — 이 저장소의 시나리오가 쓴 마지막 번호(S-144 · c029)를 잇는다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.
//
// **여기서 재지 않는 것 셋** — 검사 ㊴ ㊵ 와 열쇠 × 자물쇠 표(SPEC-006)는 도구의 자리이고,
// 지목한 판의 줄(재료의 이름 · 성질 문장 · 온기의 색 · 「자리가 식었다」의 문구 · SPEC-005 의 판)은
// View 의 표가 짓는다. 세계 쪽에서 잴 수 있는 것은 그 판이 읽는 재료(entities[].material)와
// 그 재료가 진 성질 데이터, 그리고 원천이 지는 조건 코드(entities[].conditions)까지다.

import { describe, expect, it } from 'vitest';
import {
  areasOf,
  descriptionHash,
  pointsOf,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import {
  exitsOf,
  reachableRegions,
  reachableRegionsExcept,
} from '../../../engine/world-authoring/graph';
import { areaCoversPoint, isTraversableAt } from '../../../engine/world-authoring/query';
import {
  ANCHOR_LAYER,
  BIO_ORE_FIELD,
  COMPILE_RULES,
  EXPLORER_RUIN,
  FOREST_DEEP,
  FOREST_EDGE,
  FROST_CANYON,
  FROST_DEPTH,
  HEART_LAKE,
  ICE_CANYON,
  MATERIAL_SEEDS,
  MAZE_HEART,
  MAZE_HEART_GATE,
  PREDATOR_NEST,
  RECOVERY_STALLED,
  RED_EYE_TREE,
  REGION_GRAPH,
  REGION_SPECS,
  RESOURCE_LAYER,
  TRACE_LAYER,
  TREE_INNER_WORLD,
  WALKING_FOREST_DOOR,
  WHITE_KING_DOMAIN,
  regionSpec,
  soilStainLevel,
  type ResourceSourceSpec,
  type SeasonId,
  ORE_EATER,
  SOIL_STAIN_PREFIX,
} from '../../regions';
// 이 Cycle 이 **처음 내는** 데이터 이름들 — 이름 하나를 못 찾아 파일 전체가 서지 못하는 일을
// 막으려고 이름 공간으로 읽는다 (c020 · c021 · c029 의 선례 그대로 · 그 하나가 없으면 그 항만 붉어진다).
import * as REGIONS from '../../regions';
// C008 이 세운 미로의 이름 — 그 파일이 소유한다 (c008 ~ c029 시나리오의 선례 그대로).
import { FANTASY_MAZE } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { type WorldSetup } from '../index';
import { INTERACTION_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { sourceStateOf, traceStrengthAt } from '../semantic/resource';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';

// ── spec 이 이름으로 못 박은 것들 (State 의 「데이터 값」 표) ──────────

/** 미지 M7 — 열을 저장하는 결정과 그 원천 (데이터 값 표 · Region §5.1 · 확정 5) */
const HEAT_CRYSTAL = 'HEAT_CRYSTAL';
const CORE_EMBER = 'CORE_EMBER';
/** 그 재료의 세계 원인 · 성질 (데이터 값 표 · Access D2 · §9.2) */
const FOREST_CHAIN = 'FOREST_CHAIN';
const STORES_HEAT = 'heat:stores';
/** 그 성질이 어느 문장에서 나왔는가 (State 표 · Material §6.1) */
const FROM_BEHAVIOR = 'behavior';
/** 그 원천이 밝히는 것들 (데이터 값 표 · Play §5.3) */
const CARRIER_PLANT = 'plant';
const OPPORTUNITY_RISK = 'risk';
const SUPPLY_CONDITIONAL = 'conditional-renewable';
/** 매달린 것 — 거목균 (데이터 값 표 · Play §5.3 · A.2 뿌리혹의 사슬) */
const NEST_FUNGUS = 'NEST_FUNGUS';
/** 캘 횟수 · 되돌아옴의 길이 (데이터 값 표 · 기본형 ③) */
const HARVESTS = 1;
const RECOVERY_SECONDS = 180;
/** 원천의 자리 (데이터 값 표 · 기본형 ②) */
const EMBER_AT: XZ = { x: -34, z: 20 };

/** 고갈된 동안 그 원천이 지는 조건 코드 (데이터 값 표 · Play §6 V25) */
const EMBER_COOLED = 'ember-cooled';

/** 셋째 흔적 어휘 — 온기 (데이터 값 표 · 기본형 ④) */
const EMBER_WARMTH_PREFIX = 'ember-warmth:';
const EMBER_WARMTH_LEVELS: readonly number[] = [1, 2, 3];
/** 방 바닥 1 · 원천 쪽 절반 2 · 원천 둘레 3 */
const EMBER_FLOOR = 1;
const EMBER_PEAK = 3;

/** 이 Cycle 이 처음 내는 데이터 이름 셋 (spec Reuse 의 Added — Data) */
const NAME_FORM_WALL_EMBER = 'FORM_WALL_EMBER';
const NAME_EMBER_WARMTH_MAX = 'EMBER_WARMTH_MAX';
const NAME_EMBER_WARMTH_TAG = 'emberWarmthTag';

/** phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';
const RECOVERING = 'recovering';

/** 되돌아옴이 **눈에 보이기 시작하는** 지점 — C013 spec 기본형 ① 이 0.5 로 못 박았다 */
const RECOVERY_VISIBLE_FRACTION = 0.5;

/** 사유 코드 — 그대로 쓰는 것들 (C012 · C013) */
const SOURCE_DEPLETED = 'source-depleted';

/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (C011 ~ C013 어법) */
const MINE_SECONDS = 1.2;

/** 철 넷 (C015 · C016 그대로) */
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
const SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT, TURN];

/**
 * C024 CHANGED — **거목균을 배속 1 의 자리에 세우고 둥지의 사체를 비워 둔다.**
 *
 * C024 부터 균사의 되돌아옴이 거목균의 수에 매이고(C024 SPEC-008), 그 값은 둥지의 사체가
 * 균류로 바뀔 때마다 오른다. 이 파일이 재는 것은 요구와 답이지 둥지의 생태가 아니므로,
 * 배속이 1 이 되는 값에 세워 균사가 C014 가 잰 그 초 그대로 돌아오게 둔다 (값이 0 이면 아예
 * 멎고 상한이면 두 배다). **사체는 여기서 건드리지 않는다** — 그것은 세계의 처음 상태이고
 * 회귀의 기준값이 그것을 그대로 재기 때문이다. 사슬의 길이를 실제로 재는 자리에서만 비운다.
 */
const solo: WorldSetup = { npcs: [], populations: { TREE_FUNGUS: 1 } };

// ── 회귀의 기준값 (SPEC-009) ─────────────────────────────────────────
//
// 이 Cycle 이 시작하기 전의 세계에서 온 값이다 — hash · 표면 · 통행 · 출구 · 실리는 것은
// c020 · c029 시나리오의 표에서 그대로 왔고, 그 표가 적지 않은 방 넷(탐험가의 폐허 · 붉은 눈의
// 거목 · 심장 호수 · 거목 내부 세계)의 값은 이 Cycle 이 시작하기 전의 데이터에서 왔다.
// **거목 내부 세계의 hash 만 견주지 않는다** — 이 Cycle 이 그 방에 op 을 더하는 방이다.
// 견주는 것은 그 방의 **땅** 이다 (C019 가 "덧씌움이지 재컴파일이 아니다" 로 세운 그 규율).

interface RoomBaseline {
  /** 이 Cycle 이 Description 을 건드리는 방에는 없다 (거목 내부 세계) */
  hash?: string;
  surface: Readonly<Record<string, number>>;
  traversable: number;
  exits: readonly string[];
  /** 흔적 사다리 — 방 바닥과 가장 짙은 자리 (아무것도 캐지 않은 세계에서) */
  floorTrace: number;
  peakTrace: number;
  /** 그 방의 원천 이름들 (차례는 데이터 차례) */
  sources: readonly string[];
}

const BASELINE: Readonly<Record<string, RoomBaseline>> = {
  [WHITE_KING_DOMAIN]: {
    hash: '1c57fb5f',
    surface: { flat: 1022, wet: 497, slope: 95, steep: 67 },
    traversable: 1328,
    exits: ['FOREST_PATH', 'RED_WASTE_PASS', 'ICE_CANYON_PASS'],
    floorTrace: 0,
    peakTrace: 0,
    sources: [],
  },
  [FOREST_EDGE]: {
    hash: 'da66b8e9',
    surface: { flat: 1386, slope: 127, steep: 168 },
    traversable: 1513,
    exits: ['FOREST_PATH', 'RUIN_TRAIL', 'DEEP_TRAIL'],
    floorTrace: 1,
    peakTrace: 2,
    sources: ['MOLT_LITTER', 'SEEP_CRUST', 'FALLEN_SCALE', 'PREY_REMAINS', 'ORE_PEBBLE_EDGE', 'HUSK_SHARD_EDGE', 'GLOW_CAP_EDGE'],
  },
  [FOREST_DEEP]: {
    hash: 'b0cabbb8',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['DEEP_TRAIL', 'NEST_TRAIL', 'ORE_TRAIL', 'TREE_APPROACH', 'ANCIENT_GATE', 'WALKING_FOREST_DOOR'],
    floorTrace: 2,
    peakTrace: 3,
    sources: ['RIVER_SILT', 'ORE_PEBBLE_DEEP_1', 'ORE_PEBBLE_DEEP_2', 'HUSK_SHARD_DEEP', 'GLOW_CAP_DEEP', 'SEEP_CRUST_DEEP'],
  },
  [EXPLORER_RUIN]: {
    hash: 'a1cfb66b',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['RUIN_TRAIL'],
    floorTrace: 1,
    peakTrace: 2,
    sources: ['RUIN_SPOIL', 'ORE_PEBBLE_RUIN', 'HUSK_SHARD_RUIN_1', 'HUSK_SHARD_RUIN_2'],
  },
  [PREDATOR_NEST]: {
    // C024 CHANGED — 둥지는 C024 가 만졌다 (사체 · 변성지 · 자락 넷). **표면도 통행도 한 값
    // 달라지지 않았고** 달라진 것은 Description 에 선 자리뿐이라 hash 하나가 바뀌었다.
    hash: 'c9a53392',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['NEST_TRAIL'],
    floorTrace: 2,
    peakTrace: 4,
    // C024 CHANGED — 둥지의 사체가 늘었다 (데이터 차례의 끝)
    sources: ['NEST_FUNGUS', 'GLOW_CAP_NEST_1', 'GLOW_CAP_NEST_2', 'HUSK_SHARD_NEST', 'NEST_CARCASS'],
  },
  [BIO_ORE_FIELD]: {
    hash: 'f111570c',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['ORE_TRAIL', 'ORE_TREE_TRAIL'],
    floorTrace: 3,
    peakTrace: 4,
    sources: ['ORE_OUTCROP', 'ORE_PEBBLE_ORE_1', 'ORE_PEBBLE_ORE_2', 'ORE_PEBBLE_ORE_3', 'HUSK_SHARD_ORE'],
  },
  [RED_EYE_TREE]: {
    hash: '594e1d6d',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['TREE_APPROACH', 'ORE_TREE_TRAIL', 'TREE_INNER_DOOR'],
    floorTrace: 3,
    peakTrace: 5,
    sources: ['ROOT_NODULE', 'GLOW_CAP_TREE', 'ORE_PEBBLE_TREE', 'CLUTCH_HUSK', 'EGG_HUSK'],
  },
  [TREE_INNER_WORLD]: {
    hash: 'fed501ba',
    surface: { flat: 6561 },
    traversable: 6561,
    exits: ['TREE_INNER_DOOR', 'TREE_FALL'],
    floorTrace: 1,
    peakTrace: 3,
    sources: ['CORE_EMBER'],
  },
  [HEART_LAKE]: {
    hash: 'dfb3a6cf',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['HEART_RIVER'],
    floorTrace: 2,
    peakTrace: 4,
    sources: ['LAKE_SILT_BED'],
  },
  [FANTASY_MAZE]: {
    hash: '53ca6a70',
    surface: { flat: 6561 },
    traversable: 6561,
    exits: ['MAZE_GATE_RETURN', 'MAZE_HEART_GATE'],
    floorTrace: 0,
    peakTrace: 0,
    sources: [],
  },
  [MAZE_HEART]: {
    hash: 'b9b77a14',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['MAZE_HEART_GATE', 'INVERTED_GARDEN_DOOR'],
    floorTrace: 0,
    peakTrace: 0,
    sources: [],
  },
  [ICE_CANYON]: {
    hash: '5928ed79',
    surface: { steep: 810, slope: 164, frost: 697, flat: 10 },
    traversable: 871,
    exits: ['ICE_CANYON_PASS', 'FROST_CANYON_TRAIL'],
    floorTrace: 1,
    peakTrace: 2,
    sources: ['PASS_RIME'],
  },
  [FROST_CANYON]: {
    hash: 'ba0afb9e',
    surface: { steep: 902, slope: 72, frost: 697, flat: 10 },
    traversable: 779,
    exits: ['FROST_CANYON_TRAIL', 'FROST_DEPTH_DOOR'],
    floorTrace: 2,
    peakTrace: 3,
    sources: ['CLIFF_FROST_VEIN', 'SNOW_DRIFT_DUST', 'FROZEN_REMAINS'],
  },
};

/** 이 Cycle 이 흔적과 원천을 얹는 방 하나 — 나머지는 한 값도 달라지지 않는다 */
const ROOMS_BEFORE = Object.keys(BASELINE).filter((id) => id !== TREE_INNER_WORLD);

/** 방마다 실리는 것의 차례 — c020 · c029 시나리오의 표에서 그대로 왔다 (SPEC-009) */
const ENTITY_BASELINE: Readonly<Record<string, readonly string[]>> = {
  [WHITE_KING_DOMAIN]: ['player-1/player-character', 'FOREST_PATH/region-exit', 'RED_WASTE_PASS/region-exit', 'ICE_CANYON_PASS/region-exit'],
  [FOREST_EDGE]: ['player-1/player-character', 'MOLT_LITTER/resource-source', 'FALLEN_SCALE/resource-source', 'PREY_REMAINS/resource-source', 'ORE_PEBBLE_EDGE/resource-source', 'HUSK_SHARD_EDGE/resource-source', 'FOREST_PATH/region-exit', 'RUIN_TRAIL/region-exit', 'DEEP_TRAIL/region-exit'],
  [FOREST_DEEP]: ['player-1/player-character', 'RIVER_SILT/resource-source', 'ORE_PEBBLE_DEEP_1/resource-source', 'ORE_PEBBLE_DEEP_2/resource-source', 'HUSK_SHARD_DEEP/resource-source', 'DEEP_TRAIL/region-exit', 'NEST_TRAIL/region-exit', 'ORE_TRAIL/region-exit', 'TREE_APPROACH/region-exit', 'ANCIENT_GATE/region-exit', 'WALKING_FOREST_DOOR/region-exit'],
  [BIO_ORE_FIELD]: ['player-1/player-character', 'ORE_OUTCROP/resource-source', 'ORE_PEBBLE_ORE_1/resource-source', 'ORE_PEBBLE_ORE_2/resource-source', 'ORE_PEBBLE_ORE_3/resource-source', 'HUSK_SHARD_ORE/resource-source', 'ORE_TRAIL/region-exit', 'ORE_TREE_TRAIL/region-exit'],
  // C024 CHANGED — 둘이 늘었다: 둥지의 사체(원천)와 그 위의 변성지(탄생지)
  [PREDATOR_NEST]: ['player-1/player-character', 'NEST_FUNGUS/resource-source', 'HUSK_SHARD_NEST/resource-source', 'NEST_CARCASS/resource-source', 'CARCASS_TO_FUNGUS/life-site', 'NEST_TRAIL/region-exit'],
  [FANTASY_MAZE]: ['player-1/player-character', 'MAZE_GATE_RETURN/region-exit', 'MAZE_HEART_GATE/region-exit'],
  [MAZE_HEART]: ['player-1/player-character', 'MAZE_HEART_GATE/region-exit', 'INVERTED_GARDEN_DOOR/region-exit'],
};

/**
 * 원천마다 **세계가 서자마자의** phase 와 캔 횟수 (SPEC-009 "원천의 phase").
 *
 * 다 available 이 아니다 — 사건에 기대는 원천(고래 비늘 · 먹이 잔해 · 강가의 알갱이)은
 * 그 사건이 아직 오지 않아 처음부터 바닥나 있다 (C014 · C016 이 세운 자리). 그 값이 이
 * Cycle 로 한 값도 달라지지 않아야 한다는 것이 여기서 재는 것이고, 철 넷에서 모두 같다.
 */
const PHASE_BASELINE: Readonly<Record<string, { phase: string; taken: number }>> = {
  MOLT_LITTER: { phase: AVAILABLE, taken: 0 },
  SEEP_CRUST: { phase: AVAILABLE, taken: 0 },
  FALLEN_SCALE: { phase: DEPLETED, taken: 1 },
  PREY_REMAINS: { phase: DEPLETED, taken: 1 },
  ORE_PEBBLE_EDGE: { phase: AVAILABLE, taken: 0 },
  HUSK_SHARD_EDGE: { phase: AVAILABLE, taken: 0 },
  GLOW_CAP_EDGE: { phase: AVAILABLE, taken: 0 },
  RIVER_SILT: { phase: DEPLETED, taken: 2 },
  ORE_PEBBLE_DEEP_1: { phase: AVAILABLE, taken: 0 },
  ORE_PEBBLE_DEEP_2: { phase: AVAILABLE, taken: 0 },
  HUSK_SHARD_DEEP: { phase: AVAILABLE, taken: 0 },
  GLOW_CAP_DEEP: { phase: AVAILABLE, taken: 0 },
  SEEP_CRUST_DEEP: { phase: AVAILABLE, taken: 0 },
  RUIN_SPOIL: { phase: AVAILABLE, taken: 0 },
  ORE_PEBBLE_RUIN: { phase: AVAILABLE, taken: 0 },
  HUSK_SHARD_RUIN_1: { phase: AVAILABLE, taken: 0 },
  HUSK_SHARD_RUIN_2: { phase: AVAILABLE, taken: 0 },
  NEST_FUNGUS: { phase: AVAILABLE, taken: 0 },
  GLOW_CAP_NEST_1: { phase: AVAILABLE, taken: 0 },
  GLOW_CAP_NEST_2: { phase: AVAILABLE, taken: 0 },
  HUSK_SHARD_NEST: { phase: AVAILABLE, taken: 0 },
  // C024 ADDED — 둥지의 사체 (처음은 거기 있다)
  NEST_CARCASS: { phase: AVAILABLE, taken: 0 },
  ORE_OUTCROP: { phase: AVAILABLE, taken: 0 },
  ORE_PEBBLE_ORE_1: { phase: AVAILABLE, taken: 0 },
  ORE_PEBBLE_ORE_2: { phase: AVAILABLE, taken: 0 },
  ORE_PEBBLE_ORE_3: { phase: AVAILABLE, taken: 0 },
  HUSK_SHARD_ORE: { phase: AVAILABLE, taken: 0 },
  ROOT_NODULE: { phase: AVAILABLE, taken: 0 },
  GLOW_CAP_TREE: { phase: AVAILABLE, taken: 0 },
  ORE_PEBBLE_TREE: { phase: AVAILABLE, taken: 0 },
  CLUTCH_HUSK: { phase: DEPLETED, taken: 1 },
  EGG_HUSK: { phase: DEPLETED, taken: 1 },
  LAKE_SILT_BED: { phase: AVAILABLE, taken: 0 },
  PASS_RIME: { phase: AVAILABLE, taken: 0 },
  CLIFF_FROST_VEIN: { phase: AVAILABLE, taken: 0 },
  SNOW_DRIFT_DUST: { phase: AVAILABLE, taken: 0 },
  FROZEN_REMAINS: { phase: AVAILABLE, taken: 0 },
};

/** C019 가 세운 상시 위상 — 눈보라의 관찰 범위까지 그대로다 (SPEC-009 "관찰 범위") */
const CANYON_STANDING_BASELINE: Readonly<Record<string, unknown>> = {
  [ICE_CANYON]: {
    hazardExtend: [
      { areaId: 'hazard-ice-cliff-west', hazard: 'hazard/terrain' },
      { areaId: 'hazard-ice-cliff-east', hazard: 'hazard/terrain' },
    ],
  },
  [FROST_CANYON]: {
    hazardExtend: [
      { areaId: 'hazard-blizzard', hazard: 'hazard/climate', observeRange: { day: 20, night: 10 } },
      { areaId: 'hazard-crystal-face', hazard: 'hazard/matter', contact: 'crystallizing' },
      { areaId: 'hazard-ice-cliff-west', hazard: 'hazard/terrain' },
      { areaId: 'hazard-ice-cliff-east', hazard: 'hazard/terrain' },
    ],
  },
};

// ── 하네스 (c013 · c020 · c021 · c029 의 선례 그대로) ────────────────

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const statesOf = (w: WorldDriver) => state(w).regionStates as never;

function spaceOf(id: string): RegionDescription {
  const spec = regionSpec(id);
  if (!spec) throw new Error(`세계가 방 '${id}' 를 알지 못한다`);
  return spec.space;
}

const terrainMemo = new Map<string, CompiledWorldTerrain>();
function terrainOf(id: string): CompiledWorldTerrain {
  const hit = terrainMemo.get(id);
  if (hit) return hit;
  const made = compileRegion(spaceOf(id), COMPILE_RULES).world;
  terrainMemo.set(id, made);
  return made;
}

const gridMemo = new Map<string, XZ[]>();
function gridSpots(id: string): XZ[] {
  const hit = gridMemo.get(id);
  if (hit) return hit;
  const t = terrainOf(id);
  const out: XZ[] = [];
  for (let iz = 0; iz < t.rows; iz++) {
    for (let ix = 0; ix < t.cols; ix++) {
      out.push({ x: t.extent.minX + ix * t.resolution, z: t.extent.minZ + iz * t.resolution });
    }
  }
  gridMemo.set(id, out);
  return out;
}
const walkableSpots = (region: string): XZ[] => {
  const t = terrainOf(region);
  return gridSpots(region).filter((p) => isTraversableAt(t, p.x, p.z));
};

const distanceBetween = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
const minBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]!);

/** 표면 태그마다 vertex 수 (c019 ~ c029 의 어법) */
function surfaceCounts(region: string): Record<string, number> {
  const t = terrainOf(region);
  const out: Record<string, number> = {};
  for (let i = 0; i < t.surface.length; i++) {
    const tag = t.surfaceTags[t.surface[i]!] ?? '?';
    out[tag] = (out[tag] ?? 0) + 1;
  }
  return out;
}
const traversableCount = (region: string): number => walkableSpots(region).length;

/** 그 이음이 이 방에서 서는 자리 (c020 · c021 · c029 의 connectorSpot 그대로) */
function connectorSpot(connectorId: string, region: string): XZ {
  const c = REGION_GRAPH.connectors.find((x) => x.id === connectorId);
  if (!c) throw new Error(`graph 에 이음 '${connectorId}' 가 없다`);
  const tag = c.from.region === region ? c.from.anchor : c.to.anchor;
  const found = pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag);
  if (!found) throw new Error(`${region} 에 anchor '${tag}' 가 없다`);
  return found.position;
}

// ── 데이터를 읽는 자리 (원천 · 시간 · 흔적) ─────────────────────────

/** 그 원천의 성질 — 그 방 resourceEcology 가 소유한다 (c013 · c020 의 ecologyOf 그대로) */
function ecologyOf(region: string, id: string): ResourceSourceSpec {
  const found = regionSpec(region)?.resourceEcology?.sources.find((s) => s.id === id);
  if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다 (${region})`);
  return found;
}
/** 세계의 모든 원천 — {방, 원천} 짝으로 편다 */
const allSources = (): { region: string; spec: ResourceSourceSpec }[] =>
  REGION_SPECS.flatMap((r) =>
    (r.resourceEcology?.sources ?? []).map((spec) => ({ region: r.id, spec })),
  );
/** 그 원천이 어느 방에 섰는가 */
function regionOf(id: string): string {
  const found = allSources().find((x) => x.spec.id === id);
  if (!found) throw new Error(`세계에 원천 '${id}' 가 없다`);
  return found.region;
}
const harvestsOf = (id: string): number => ecologyOf(regionOf(id), id).harvests;
function recoveryOf(id: string): number {
  const seconds = ecologyOf(regionOf(id), id).recoverySeconds;
  if (!(typeof seconds === 'number' && seconds > 0)) {
    throw new Error(`원천 '${id}' 에 recoverySeconds 가 없다`);
  }
  return seconds;
}
/** 되돌아옴이 눈에 보이기 시작하는 세계 초 */
const visibleAt = (id: string): number => recoveryOf(id) * RECOVERY_VISIBLE_FRACTION;
/** 그 원천이 고갈된 동안 지겠다고 **밝힌** 코드 (밝히지 않았으면 undefined) */
const depletedCodeOf = (spec: ResourceSourceSpec): string | undefined =>
  (spec as unknown as { depletedCode?: string }).depletedCode;

/** C011 이 놓은 자리 — resource layer point 하나 (c013 · c020 의 pointOf 그대로) */
const pointOf = (region: string, id: string): XZ => {
  const found = pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id);
  if (!found) throw new Error(`${region} 의 resource layer 에 '${id}' 자리가 없다`);
  return found.position;
};

/** 이 Cycle 이 처음 내는 데이터 이름 — content/regions 가 낸다 (c029 의 이름 공간 읽기 그대로) */
function namedInRegions(name: string): unknown {
  return (REGIONS as unknown as Record<string, unknown>)[name];
}
function requireName(name: string): unknown {
  const value = namedInRegions(name);
  if (value === undefined) throw new Error(`content/regions 가 '${name}' 를 내지 않는다`);
  return value;
}

/** 재료의 Seed — 성질 태그가 붙는 자리 (c029 의 seedOf 그대로) */
interface PropertyTagShape {
  tag?: string;
  from?: string;
}
interface SeedShape {
  id?: string;
  worldCause?: string;
  forms?: readonly string[];
  properties?: readonly PropertyTagShape[];
  [key: string]: unknown;
}
const seeds = (): readonly SeedShape[] => MATERIAL_SEEDS as unknown as readonly SeedShape[];

/** 빙결 심층의 문이 묻는 것 · 답이 되는 관계 (C029 가 세운 데이터 값 표 그대로) */
const ASKED = 'heat:hides';
const SUPPORTS = 'SUPPORTS';

interface AnswerShape {
  requirement?: string;
  property?: string;
  kind?: string;
}
interface VocabularyShape {
  aspects?: readonly unknown[];
  relations?: readonly unknown[];
  answers?: readonly AnswerShape[];
}
/** 세계 전체에 하나인 성질의 어휘 — 이름을 적지 않고 이름 공간에서 찾는다 (c029 의 vocabulary 그대로) */
function theVocabulary(): VocabularyShape {
  for (const value of Object.values(REGIONS as unknown as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue;
    const shape = value as VocabularyShape;
    if (Array.isArray(shape.aspects) && Array.isArray(shape.relations)) return shape;
  }
  throw new Error('content/regions 에 성질의 어휘(축 · 관계)가 없다');
}
const seedOf = (id: string): SeedShape => {
  const found = seeds().find((s) => s.id === id);
  if (!found) throw new Error(`MATERIAL_SEEDS 에 재료 '${id}' 가 없다`);
  return found;
};

// ── 세계를 세우고 굴리는 자리 ────────────────────────────────────────

type Setup = WorldSetup & { sourcePhases?: Record<string, string> };
const asSetup = (options: Setup): WorldSetup => options as WorldSetup;

const standingIn = (region: string, at?: XZ, extra: Setup = {}): WorldDriver =>
  driveWorld(
    asSetup({
      ...solo,
      actorRegion: region,
      ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
      ...extra,
      // C024 CHANGED — 개체군과 원천 phase 는 **덮지 않고 겹친다.** 통째로 갈아 끼우면
      // solo 가 잠재워 둔 둥지가 다시 깨어나 균사의 배속이 재는 도중에 바뀐다.
      populations: { ...solo.populations, ...(extra as WorldSetup).populations },
      sourcePhases: { ...solo.sourcePhases, ...(extra as WorldSetup).sourcePhases },
    }),
  );
/** 그 철에서 시작하는 세계 — C015 가 세운 clock 손잡이 (c016 ~ c029 의 inSeason 그대로) */
const inSeason = (season: SeasonId, region: string, at?: XZ, extra: Setup = {}): WorldDriver =>
  standingIn(region, at, { ...extra, clock: season } as Setup);

/** 그 자리 곁에 걸어 설 자리 — 손이 닿는다 (c020 의 besideIn 그대로) */
function besideIn(region: string, at: XZ): XZ {
  const near = walkableSpots(region).filter((p) => distanceBetween(p, at) <= INTERACTION_RANGE * 0.9);
  if (near.length === 0) throw new Error(`(${at.x}, ${at.z}) 곁에 걸어 설 자리가 없다 (${region})`);
  return minBy(near, (p) => distanceBetween(p, at));
}
/** 속의 잉걸 곁에 곡괭이를 지고 선 세계 */
/**
 * 잉걸 곁에 선 세계.
 *
 * 개체군을 **상한까지 채워** 세운다 — 이 원천은 거목균에 매달렸는데(dependsOn), 거목이 낳는
 * 탄생이 그 거목균을 먹는다(C023 의 consumes). 상한에서는 탄생이 멎으므로 거목균이 보전되고,
 * 그래야 "거목균이 있으면" 이라는 이 절의 Given 이 실제로 성립한다. 세계 규칙은 그대로다 —
 * 두 계통이 같은 마디에서 맞물린다는 사실을 이 자리가 밝혀 둔다 (매달린 것이 고갈일 때의
 * 답은 S-162 가 따로 잰다).
 */
/** 개체군의 상한 — content/regions 의 값을 읽는다 (손으로 적지 않는다) */
const ORE_EATER_SCALE =
  REGION_SPECS.find((r) => r.id === RED_EYE_TREE)?.ecology?.populations?.find(
    (p) => p.id === ORE_EATER,
  )?.scale ?? 0;

const besideEmber = (extra: Setup = {}): WorldDriver =>
  standingIn(TREE_INNER_WORLD, besideIn(TREE_INNER_WORLD, EMBER_AT), {
    actorItems: { pickaxe: 1 },
    populations: { ORE_EATER: ORE_EATER_SCALE },
    ...extra,
  });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};
/** 되돌아옴을 기다린다 — 한 걸음 1 세계 초로 나눠 굴린다 (c013 · c020 의 wait 그대로) */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}

const mine = (w: WorldDriver, targetEntityId: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId }, observerId);
const cross = (w: WorldDriver, connector: string): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector });
const reasonOf = (result: ActionResult): string | undefined =>
  'reason' in result ? (result.reason as string) : undefined;

function mineOnce(w: WorldDriver, id: string): ActionResult {
  const result = mine(w, id);
  tickFor(w, MINE_SECONDS + TICK_INTERVAL);
  return result;
}
function mineUntilDepleted(w: WorldDriver, id: string) {
  for (let i = 0; i < harvestsOf(id); i++) {
    expect({ id, nth: i + 1, ...mineOnce(w, id) }).toEqual({
      id,
      nth: i + 1,
      status: 'success',
      rule: 'RULE-MINE-001',
    });
  }
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────

type SeenEntity = EntityView & { conditions?: string[]; material?: string };
const entitiesIn = (v: GameViewSnapshot): SeenEntity[] => v.entities as SeenEntity[];
const exitsIn = (v: GameViewSnapshot): SeenEntity[] =>
  entitiesIn(v).filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string): SeenEntity | undefined =>
  exitsIn(v).find((e) => e.id === id);
const sourcesIn = (v: GameViewSnapshot): SeenEntity[] =>
  entitiesIn(v).filter((e) => e.role === 'resource-source');
const sourceEntity = (v: GameViewSnapshot, id: string): SeenEntity | undefined =>
  sourcesIn(v).find((e) => e.id === id);
const entityLines = (v: GameViewSnapshot): string[] => v.entities.map((e) => `${e.id}/${e.role}`);
const codesOn = (e: SeenEntity | undefined): string[] => e?.conditions ?? [];
const heldOf = (v: GameViewSnapshot, material: string): number | boolean | string | undefined =>
  v.hud.find((h) => h.id === `inventory.${material}`)?.value;
const transitTo = (v: GameViewSnapshot, connector: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'transit' && i.targetEntityId === connector);
/** 내 몸의 투영 — C029 가 문 앞의 현상을 싣는 자리 */
const myBody = (w: WorldDriver): SeenEntity => {
  const v = w.observe();
  const found = entitiesIn(v).find((e) => e.id === v.observer.characterId);
  if (!found) throw new Error('관찰 결과에 내 몸이 없다');
  return found;
};

interface SourceStateShape {
  phase: string;
  taken: number;
  progress?: number;
}
const phaseOf = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w), region, id) as SourceStateShape;
const emberPhase = (w: WorldDriver): SourceStateShape => phaseOf(w, TREE_INNER_WORLD, CORE_EMBER);

// ── 흔적을 읽는 자리 (기존 시나리오가 쓰는 그 함수 그대로) ───────────

const UNTOUCHED = {} as never;
/** 아무것도 캐지 않은 세계에서 그 자리의 흔적 단계 (c020 의 traceAt 그대로) */
const traceAt = (region: string, at: XZ) => traceStrengthAt(UNTOUCHED, region, at);
const floorTraceOf = (region: string) =>
  gridSpots(region).reduce((low, at) => Math.min(low, traceAt(region, at)), Infinity);
const peakTraceOf = (region: string) =>
  gridSpots(region).reduce((high, at) => Math.max(high, traceAt(region, at)), 0);
/** 그 방 흔적 layer 의 태그들 (차례 그대로) */
const traceTagsOf = (region: string): string[] =>
  areasOf(spaceOf(region), TRACE_LAYER).map((a) => a.tag);

/** 거목 내부 세계로 **들어오는** 문 — 이름을 손으로 적지 않고 graph 가 고르게 한다 */
const innerDoor = () => {
  const found = REGION_GRAPH.connectors.find((c) => c.to.region === TREE_INNER_WORLD);
  if (!found) throw new Error('graph 에 거목 내부 세계로 드는 문이 없다');
  return found;
};
const innerDoorSpot = () => connectorSpot(innerDoor().id, TREE_INNER_WORLD);

/** 빙결 심층으로 드는 문 — c020 · c021 · c029 의 depthDoor 그대로 */
const depthDoor = () => {
  const found = REGION_GRAPH.connectors.find((c) => c.to.region === FROST_DEPTH);
  if (!found) throw new Error('graph 에 빙결 심층으로 드는 문이 없다');
  return found;
};
const depthDoorSpot = () => connectorSpot(depthDoor().id, depthDoor().from.region);

// ── C029 가 세운 문 앞의 자락 — 몸에 현상이 실리는 자리 (그 시나리오의 어법 그대로) ──

interface TraceShape {
  op?: string;
  showsOnBody?: unknown;
  code?: unknown;
}
interface LockShape {
  at?: { kind?: string; ref?: string };
  traces?: readonly TraceShape[];
}
const locksOf = (region: string): LockShape[] => [
  ...(((regionSpec(region) as unknown as { access?: { locks?: readonly LockShape[] } } | undefined)
    ?.access?.locks ?? []) as readonly LockShape[]),
];
function bodyCodeOf(trace: TraceShape): string | undefined {
  const raw = trace.showsOnBody;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (raw === true && typeof trace.code === 'string' && trace.code.length > 0) return trace.code;
  return undefined;
}
function isAreaOp(region: string, opId: string): boolean {
  const op = spaceOf(region).ops.find((o) => o.id === opId);
  return op !== undefined && op.kind === 'area';
}
function spotsInAreaOp(region: string, areaId: string): XZ[] {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return walkableSpots(region).filter((p) => areaCoversPoint(op.shape, p.x, p.z));
}
/** 그 문 앞의, 몸에 보이는 흔적 자락 안의 한 자리 (없으면 문 자리) */
function insideDoorTrace(): XZ {
  const region = depthDoor().from.region;
  const found = locksOf(region)
    .flatMap((lock) => lock.traces ?? [])
    .find((trace) => bodyCodeOf(trace) !== undefined && typeof trace.op === 'string' && isAreaOp(region, trace.op));
  if (!found || typeof found.op !== 'string') return depthDoorSpot();
  const spots = spotsInAreaOp(region, found.op);
  if (spots.length === 0) return depthDoorSpot();
  return minBy(spots, (p) => distanceBetween(p, depthDoorSpot()));
}

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 열을 저장하는 결정과 그 원천이 세계에 선다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 열을 저장하는 결정과 그 원천이 세계에 선다', () => {
  it('S-145 재료 하나가 성질 heat:stores 를 지고 세계에 선다', () => {
    // Given 세계의 재료 표에 그 Seed 가 있다
    const seed = seedOf(HEAT_CRYSTAL);
    // Then 세계 원인은 숲의 사슬이다 (살아 있는 것 안에 쌓인다 · Access D2)
    expect({ id: seed.id, cause: seed.worldCause }).toEqual({
      id: HEAT_CRYSTAL,
      cause: FOREST_CHAIN,
    });
    // And 그 성질 하나가 behavior 에서 나온다
    expect(seed.properties ?? []).toContainEqual({ tag: STORES_HEAT, from: FROM_BEHAVIOR });
    // And 그 재료가 나는 자연 형태에 벽의 잉걸이 있다
    const wallEmber = requireName(NAME_FORM_WALL_EMBER) as string;
    expect({ forms: seed.forms ?? [], has: (seed.forms ?? []).includes(wallEmber) }).toMatchObject({
      has: true,
    });
  });

  it('S-146 그 원천 하나가 거목 내부 세계에 서고 자리 · 형태 · 지는 것 · 기회 자리 · 공급 · 매달린 것 · 되돌아옴을 밝힌다', () => {
    // Given 거목 내부 세계의 원천 하나
    const spec = ecologyOf(TREE_INNER_WORLD, CORE_EMBER);
    const wallEmber = requireName(NAME_FORM_WALL_EMBER) as string;
    // Then spec 의 값 표 그대로 밝힌다
    expect({
      material: spec.materialId,
      cause: spec.worldCause,
      form: spec.form,
      carrier: spec.carrier,
      opportunity: spec.opportunity,
      supply: spec.supply,
      dependsOn: spec.dependsOn,
      harvests: spec.harvests,
      recoverySeconds: spec.recoverySeconds,
      depletedCode: depletedCodeOf(spec),
    }).toEqual({
      material: HEAT_CRYSTAL,
      cause: FOREST_CHAIN,
      form: wallEmber,
      carrier: CARRIER_PLANT,
      opportunity: OPPORTUNITY_RISK,
      supply: SUPPLY_CONDITIONAL,
      dependsOn: NEST_FUNGUS,
      harvests: HARVESTS,
      recoverySeconds: RECOVERY_SECONDS,
      depletedCode: EMBER_COOLED,
    });
    // And 되돌아옴의 원인은 거목의 축적이다 — 노두가 이미 쓰는 그 원인과 같은 값이다 (Play A.2)
    expect(spec.recoveryCause).toBe(ecologyOf(BIO_ORE_FIELD, 'ORE_OUTCROP').recoveryCause);
    // And 그 자리는 서쪽 벽의 한 자리다 (기본형 ②)
    expect(pointOf(TREE_INNER_WORLD, CORE_EMBER)).toEqual(EMBER_AT);
  });

  it('S-147 그 방에 서면 원천으로 서 있고 자기 재료의 코드를 싣는다', () => {
    // Given 거목 내부 세계에 선다
    const w = besideEmber();
    const seen = sourceEntity(w.observe(), CORE_EMBER);
    // Then 관찰 결과에 원천으로 서고 그 재료를 싣는다 · 지금은 캘 수 있다
    expect({ standing: seen !== undefined, material: seen?.material, state: seen?.state }).toEqual({
      standing: true,
      material: HEAT_CRYSTAL,
      state: AVAILABLE,
    });
  });

  it('S-148 (경계 ①) 그 방의 땅 · 표면 · 통행 격자가 한 값도 바뀌지 않는다 — 흔적과 원천은 얹히는 것이다', () => {
    const base = BASELINE[TREE_INNER_WORLD]!;
    expect({
      surface: surfaceCounts(TREE_INNER_WORLD),
      traversable: traversableCount(TREE_INNER_WORLD),
    }).toEqual({ surface: base.surface, traversable: base.traversable });
  });

  it('S-149 (경계 ②) 다른 방에는 이 재료의 원천이 하나도 없다', () => {
    const bearing = allSources().filter((x) => x.spec.materialId === HEAT_CRYSTAL);
    // Then 이 재료를 내는 원천은 거목 내부 세계의 그것 하나뿐이다
    expect(bearing.map((x) => `${x.region}/${x.spec.id}`)).toEqual([
      `${TREE_INNER_WORLD}/${CORE_EMBER}`,
    ]);
  });

  it('S-150 (경계 ③) 쓰임은 Seed 에도 원천에도 관찰 결과에도 적히지 않는다', () => {
    // 판정 방식은 이 시나리오가 정했다 (spec 은 "적히지 않는다" 까지만 말한다):
    // 쓰임을 적을 자리의 이름 넷이 데이터에도 투영에도 없는지 본다.
    const USE_FIELDS = ['use', 'uses', 'usage', 'purpose'];
    const seed = seedOf(HEAT_CRYSTAL);
    const spec = ecologyOf(TREE_INNER_WORLD, CORE_EMBER) as unknown as Record<string, unknown>;
    for (const field of USE_FIELDS) {
      expect({ field, onSeed: field in seed, onSource: field in spec }).toEqual({
        field,
        onSeed: false,
        onSource: false,
      });
    }
    // And 관찰 결과의 그 원천에도 그 자리가 없다
    const seen = sourceEntity(besideEmber().observe(), CORE_EMBER) as unknown as Record<string, unknown>;
    for (const field of USE_FIELDS) {
      expect({ field, projected: field in seen }).toEqual({ field, projected: false });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 흔적만으로 닿는다 · 온기가 방향이 된다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-002 흔적만으로 닿는다 — 온기가 방향이 된다', () => {
  it('S-151 그 방의 흔적이 셋째 어휘로 서고 사다리가 셋이다', () => {
    // Given 그 방의 흔적 태그들
    const tags = traceTagsOf(TREE_INNER_WORLD);
    expect({ standing: tags.length > 0 }).toEqual({ standing: true });
    // Then 태그마다 온기의 접두사로 시작한다 (데이터 값 표)
    for (const tag of tags) {
      expect({ tag, ember: tag.startsWith(EMBER_WARMTH_PREFIX) }).toEqual({ tag, ember: true });
    }
    // And 그 어휘가 짓는 태그가 사다리 셋 그대로다
    const emberWarmthTag = requireName(NAME_EMBER_WARMTH_TAG) as (level: number) => string;
    expect(EMBER_WARMTH_LEVELS.map((level) => emberWarmthTag(level))).toEqual(
      EMBER_WARMTH_LEVELS.map((level) => `${EMBER_WARMTH_PREFIX}${level}`),
    );
    expect(requireName(NAME_EMBER_WARMTH_MAX)).toBe(EMBER_PEAK);
    // And 방 바닥이 1 이고 가장 짙은 자리가 3 이다
    expect({
      floor: floorTraceOf(TREE_INNER_WORLD),
      peak: peakTraceOf(TREE_INNER_WORLD),
    }).toEqual({ floor: EMBER_FLOOR, peak: EMBER_PEAK });
  });

  it('S-152 들어온 문에서 원천까지 흔적이 단조롭게 짙어지고, 가장 짙은 자리가 원천 둘레다', () => {
    // Given 들어온 문의 자리와 원천의 자리 — 둘 다 데이터에서 읽는다
    const from = innerDoorSpot();
    const to = pointOf(TREE_INNER_WORLD, CORE_EMBER);
    // When 그 사이에서 열두 점을 고른다
    const STEPS = 12;
    const walk = Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = i / STEPS;
      return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
    });
    const levels = walk.map((at) => traceAt(TREE_INNER_WORLD, at));
    // Then 한 걸음도 옅어지지 않는다 (단조롭다)
    for (let i = 1; i < levels.length; i++) {
      expect({ step: i, drops: levels[i]! < levels[i - 1]! }).toEqual({ step: i, drops: false });
    }
    // And 들어온 문 쪽이 가장 옅고(방 바닥) 원천 자리가 가장 짙다
    expect({ door: levels[0], ember: levels[levels.length - 1] }).toEqual({
      door: EMBER_FLOOR,
      ember: EMBER_PEAK,
    });
    // And 원천 둘레가 그 방에서 가장 짙은 단계다
    expect(traceAt(TREE_INNER_WORLD, to)).toBe(peakTraceOf(TREE_INNER_WORLD));
    // And 사다리 셋이 실제로 이 방 안에 다 선다
    expect([...new Set(gridSpots(TREE_INNER_WORLD).map((at) => traceAt(TREE_INNER_WORLD, at)))].sort()).toEqual(
      [...EMBER_WARMTH_LEVELS],
    );
  });

  it('S-153 (경계 ①) 앞의 두 어휘(흙 · 숨)를 읽던 답이 한 값도 달라지지 않는다', () => {
    // Then 앞의 방마다 바닥과 가장 짙은 자리가 그대로다
    for (const region of ROOMS_BEFORE) {
      const base = BASELINE[region]!;
      expect({ region, floor: floorTraceOf(region), peak: peakTraceOf(region) }).toEqual({
        region,
        floor: base.floorTrace,
        peak: base.peakTrace,
      });
    }
    // And 흙의 사다리가 온기의 태그를 읽지 못한다 — 어휘 셋이 한 자리에서 섞이지 않는다
    for (const tag of traceTagsOf(TREE_INNER_WORLD)) {
      expect({ tag, soil: soilStainLevel(tag) }).toEqual({ tag, soil: 0 });
    }
    // And 거꾸로 숲의 태그는 여전히 흙의 사다리로 읽힌다 (그 답이 달라지지 않았다).
    // **개수를 세지 않는다** — 흔적이 느는 것은 다른 Cycle 의 일이고, 이 항이 재는 것은
    // "흙의 태그가 흙의 사다리로 읽히는가" 하나다 (그 자리가 곧 어휘 셋의 갈림이다)
    const forest = traceTagsOf(FOREST_EDGE);
    expect(forest.length).toBeGreaterThan(0);
    for (const tag of forest) {
      expect({ tag, soil: soilStainLevel(tag) }).toEqual({
        tag,
        soil: Number(tag.slice(SOIL_STAIN_PREFIX.length)),
      });
    }
  });

  it('S-154 (경계 ③) 다른 방의 흔적 태그가 한 값도 늘거나 달라지지 않는다', () => {
    for (const region of ROOMS_BEFORE) {
      // Then 어느 방에도 온기의 태그가 서지 않는다
      const ember = traceTagsOf(region).filter((tag) => tag.startsWith(EMBER_WARMTH_PREFIX));
      expect({ region, ember }).toEqual({ region, ember: [] });
    }
  });

  it.todo(
    'GAP: (경계 ②) 재료 아이콘도 미니맵도 원천을 가리키는 화살표도 없다 — 화면이 무엇을 그리지 않는가는 View 의 표가 짓는다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 캐면 그 자리가 식는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 캐면 그 자리가 식는다', () => {
  it('S-155 한 번 캐면 고갈되고 손에 그 재료가 들어온다 — 그다음은 거절된다', () => {
    // Given 속의 잉걸 곁에 곡괭이를 지고 선다
    const w = besideEmber();
    // When 제 횟수(하나)만큼 캔다
    mineUntilDepleted(w, CORE_EMBER);
    // Then 바닥났고 손에 그 재료가 그 횟수만큼 들어왔다
    expect(emberPhase(w)).toMatchObject({ phase: DEPLETED, taken: HARVESTS });
    expect(heldOf(w.observe(), HEAT_CRYSTAL)).toBe(HARVESTS);
    // And 관찰 결과의 state 도 바닥남을 말한다
    expect(sourceEntity(w.observe(), CORE_EMBER)?.state).toBe(DEPLETED);
    // And 한 번 더 지목하면 바닥남으로 거절된다
    expect(reasonOf(mine(w, CORE_EMBER))).toBe(SOURCE_DEPLETED);
  });

  it('S-156 고갈된 동안 그 원천이 「자리가 식었다」를 진다', () => {
    // Given 그 원천만 바닥난 세계 (거목균은 그대로다)
    const w = standingIn(TREE_INNER_WORLD, besideIn(TREE_INNER_WORLD, EMBER_AT), {
      sourcePhases: { [CORE_EMBER]: DEPLETED },
    });
    // Then 그 원천이 고갈의 코드를 진다
    expect(codesOn(sourceEntity(w.observe(), CORE_EMBER))).toContain(EMBER_COOLED);
    // And 거목균은 있으므로 「되돌아옴이 멎었다」는 실리지 않는다
    expect(codesOn(sourceEntity(w.observe(), CORE_EMBER))).not.toContain(RECOVERY_STALLED);
  });

  it('S-157 (경계 ①) 있는 동안과 되돌아오는 중에는 그 코드가 실리지 않는다', () => {
    // Given 아무것도 캐지 않은 세계 — 걸린 것이 없으면 자리 자체가 없다 (C012 가 세운 그대로)
    const fresh = besideEmber();
    expect(sourceEntity(fresh.observe(), CORE_EMBER)?.conditions).toBeUndefined();
    // When 다 캐고 절반을 넘긴다 — 되돌아오는 중이 된다
    mineUntilDepleted(fresh, CORE_EMBER);
    expect(codesOn(sourceEntity(fresh.observe(), CORE_EMBER))).toContain(EMBER_COOLED);
    wait(fresh, visibleAt(CORE_EMBER));
    expect(emberPhase(fresh).phase).toBe(RECOVERING);
    // Then 되돌아오는 중에는 그 코드가 실리지 않는다
    expect(codesOn(sourceEntity(fresh.observe(), CORE_EMBER))).not.toContain(EMBER_COOLED);
    // And 제 길이를 다 채우면 다시 있고, 그때도 실리지 않는다
    wait(fresh, recoveryOf(CORE_EMBER) - visibleAt(CORE_EMBER));
    expect(emberPhase(fresh)).toMatchObject({ phase: AVAILABLE, taken: 0 });
    expect(sourceEntity(fresh.observe(), CORE_EMBER)?.conditions).toBeUndefined();
  });

  it('S-158 (경계 ②) 그 코드를 밝히지 않은 원천은 몇 번을 캐도 한 글자도 늘지 않는다', () => {
    // Given 고갈의 코드를 밝힌 원천은 속의 잉걸 하나뿐이다 (데이터가 그렇게 말한다)
    const declaring = allSources().filter((x) => depletedCodeOf(x.spec) !== undefined);
    expect(declaring.map((x) => x.spec.id)).toEqual([CORE_EMBER]);
    // When 밝히지 않은 원천들을 바닥낸 채로 그 방에 서서 본다
    const others = allSources().filter((x) => depletedCodeOf(x.spec) === undefined);
    const checked: string[] = [];
    for (const { region, spec } of others) {
      const w = standingIn(region, besideIn(region, pointOf(region, spec.id)), {
        sourcePhases: { [spec.id]: DEPLETED },
      });
      const seen = sourceEntity(w.observe(), spec.id);
      // 그 철에만 서는 원천은 이 자리에 없을 수 있다 (C020 SPEC-007) — 선 것만 잰다
      if (!seen) continue;
      checked.push(spec.id);
      // Then 그 코드가 실리지 않는다
      expect({ id: spec.id, cooled: codesOn(seen).includes(EMBER_COOLED) }).toEqual({
        id: spec.id,
        cooled: false,
      });
    }
    // And 실제로 여럿을 쟀다 — 하나도 서지 않아 조용히 통과하는 일이 없도록
    expect(checked).toEqual(expect.arrayContaining(['MOLT_LITTER', 'ORE_OUTCROP', NEST_FUNGUS]));
    // And 진짜로 캐낸 원천도 마찬가지다 — **이 Cycle 의 코드**는 거기 서지 않는다.
    //
    // C024 CHANGED — "조건 자리 자체가 없다" 로 재던 것을 **그 코드가 없다** 로 좁혔다.
    // 허물은 C024 부터 벗을 것이 없으면 자기 멎음 사유를 지므로(no-molter) 그 자리가 비어
    // 있지 않다. 이 경계가 말하려는 것은 "밝히지 않은 원천에 **온기의 코드**가 늘지 않는다"
    // 이고 위의 반쪽이 재는 것도 그것이다 — 남의 Cycle 이 무엇을 걸든 그것과 무관하다.
    const litter = standingIn(FOREST_EDGE, besideIn(FOREST_EDGE, pointOf(FOREST_EDGE, 'MOLT_LITTER')), {
      actorItems: { pickaxe: 1 },
    });
    mineUntilDepleted(litter, 'MOLT_LITTER');
    expect(
      sourceEntity(litter.observe(), 'MOLT_LITTER')?.conditions?.includes(EMBER_COOLED) ?? false,
    ).toBe(false);
  });

  it('S-159 둘레의 온기가 한 단계 옅어지고 되돌아오면 제 단계로 돌아온다', () => {
    // Given 아무것도 캐지 않은 세계의 그 자리 흔적
    const at = pointOf(TREE_INNER_WORLD, CORE_EMBER);
    const fresh = besideEmber();
    const full = traceStrengthAt(statesOf(fresh), TREE_INNER_WORLD, at);
    expect(full).toBe(EMBER_PEAK);
    // When 다 캔다
    const w = besideEmber();
    mineUntilDepleted(w, CORE_EMBER);
    // Then 그 둘레가 한 단계 옅어졌다
    expect(traceStrengthAt(statesOf(w), TREE_INNER_WORLD, at)).toBe(full - 1);
    // When 제 길이만큼 기다린다 / Then 제 단계로 돌아온다
    wait(w, recoveryOf(CORE_EMBER));
    expect(emberPhase(w).phase).toBe(AVAILABLE);
    expect(traceStrengthAt(statesOf(w), TREE_INNER_WORLD, at)).toBe(full);
  });

  it('S-160 (경계 ③) 그 방의 땅도 통행도 무너지지 않는다 — 이 원천은 자리를 막지 않는다', () => {
    // Given 다 캔 세계
    const w = besideEmber();
    mineUntilDepleted(w, CORE_EMBER);
    // Then 걸어 설 수 있는 자리의 수가 그대로다 (컴파일 결과도 그대로다)
    const base = BASELINE[TREE_INNER_WORLD]!;
    expect({
      surface: surfaceCounts(TREE_INNER_WORLD),
      traversable: traversableCount(TREE_INNER_WORLD),
    }).toEqual({ surface: base.surface, traversable: base.traversable });
    // And 무너진 자리를 밝히지 않는다 (무너지는 원천이 아니다)
    const seen = sourceEntity(w.observe(), CORE_EMBER) as unknown as { collapsedSites?: number[] };
    expect(seen.collapsedSites).toBeUndefined();
    // And 그 자리로 걸어 들어갈 수 있다 — 요청이 거절되지 않는다
    const step = besideIn(TREE_INNER_WORLD, EMBER_AT);
    expect(w.dispatch({ interactionId: 'move', position: { x: step.x, z: step.z } }).status).toBe(
      'success',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 되돌아옴이 사슬에 매달린다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 되돌아옴이 사슬에 매달린다', () => {
  /** 속의 잉걸과 거목균이 함께 바닥난 세계 (c013 의 bothSpent 어법 그대로) */
  const bothSpent = (region = TREE_INNER_WORLD, at?: XZ) =>
    standingIn(region, at ?? (region === TREE_INNER_WORLD ? besideIn(TREE_INNER_WORLD, EMBER_AT) : undefined), {
      // C024 CHANGED — 사체도 함께 비운다. 그러지 않으면 재는 동안 변성이 한 번 일어나
      // 거목균이 하나 더 늘고, 균사의 되돌아옴 배속이 도중에 두 배가 된다 (C024 SPEC-008).
      sourcePhases: { [CORE_EMBER]: DEPLETED, [NEST_FUNGUS]: DEPLETED, NEST_CARCASS: DEPLETED },
      populations: { ORE_EATER: ORE_EATER_SCALE },
    });

  it('S-161 거목균이 있으면 제 길이만큼 지나 되돌아온다 — 아무도 그 방에 없어도 돈다', () => {
    // Given 속의 잉걸만 바닥난 세계 · 몸은 백왕령에 선다 (거목 안에는 아무도 없다)
    const w = standingIn(WHITE_KING_DOMAIN, undefined, {
      sourcePhases: { [CORE_EMBER]: DEPLETED },
      populations: { ORE_EATER: ORE_EATER_SCALE },
    });
    // When 제 길이 직전까지 굴린다 / Then 아직 돌아오지 않았다
    wait(w, recoveryOf(CORE_EMBER) - 1);
    expect(emberPhase(w).phase).not.toBe(AVAILABLE);
    // When 마지막 1 초를 마저 준다 / Then 돌아왔고 캔 횟수가 0 이다
    wait(w, 1);
    expect(emberPhase(w)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });

  it('S-162 거목균이 고갈이면 진행이 0 이고 「되돌아옴이 멎었다」가 「자리가 식었다」와 함께 실린다', () => {
    // Given 사슬이 실제로 거목균에 걸려 있다
    expect(ecologyOf(TREE_INNER_WORLD, CORE_EMBER).dependsOn).toBe(NEST_FUNGUS);
    const w = bothSpent();
    // When 속의 잉걸의 제 길이를 훌쩍 넘겨 굴린다 (거목균이 돌아오기 전까지만)
    const until = Math.min(recoveryOf(NEST_FUNGUS), recoveryOf(CORE_EMBER) * 1.5) - 1;
    wait(w, until);
    // Then 진행이 오르지 않아 눈에 보이지도 않는다 — 아직 바닥난 채다
    expect(emberPhase(w).phase).toBe(DEPLETED);
    // And 걸린 것이 둘 다 실린다 (R3 경계 ③)
    const codes = codesOn(sourceEntity(w.observe(), CORE_EMBER));
    expect(codes).toContain(RECOVERY_STALLED);
    expect(codes).toContain(EMBER_COOLED);
  });

  it('S-163 (경계 ①) 거목균이 되돌아오면 진행이 다시 흐르고 결국 되돌아온다 — 멎어 있던 만큼 늦게', () => {
    // Given 멎은 세계와, 멎지 않은 같은 세계(속의 잉걸만 바닥났다) 둘을 나란히 굴린다.
    //       "얼마나 늦는가" 를 초로 적지 않고 **둘을 견주어** 재는 자리다 (세계 시계가
    //       철마다 되돌아옴의 속도를 바꾸므로 · C020 확정 7).
    const stalled = bothSpent();
    const free = standingIn(TREE_INNER_WORLD, besideIn(TREE_INNER_WORLD, EMBER_AT), {
      sourcePhases: { [CORE_EMBER]: DEPLETED },
      populations: { ORE_EATER: ORE_EATER_SCALE },
    });
    // When 거목균이 돌아올 때까지 굴린다 — 그동안 멎은 쪽은 한 걸음도 나아가지 않았다
    wait(stalled, recoveryOf(NEST_FUNGUS));
    wait(free, recoveryOf(NEST_FUNGUS));
    expect(phaseOf(stalled, PREDATOR_NEST, NEST_FUNGUS).phase).toBe(AVAILABLE);
    expect(emberPhase(stalled).phase).toBe(DEPLETED);
    // And 멎었다는 코드가 걷힌다 (식었다는 아직 남는다 — 여전히 비어 있으므로)
    const codes = codesOn(sourceEntity(stalled.observe(), CORE_EMBER));
    expect(codes).not.toContain(RECOVERY_STALLED);
    expect(codes).toContain(EMBER_COOLED);
    // When 멎지 않은 쪽이 돌아올 때까지 둘을 함께 굴린다
    let elapsed = 0;
    while (emberPhase(free).phase !== AVAILABLE && elapsed < recoveryOf(CORE_EMBER) * 4) {
      wait(stalled, 1);
      wait(free, 1);
      elapsed += 1;
    }
    expect(emberPhase(free).phase).toBe(AVAILABLE);
    // Then 그때 멎었던 쪽은 아직 돌아오지 않았다 — 멎어 있던 만큼 늦다
    expect(emberPhase(stalled).phase).not.toBe(AVAILABLE);
    // And 진행은 다시 흐르고 있다 — 더 굴리면 결국 돌아온다
    while (emberPhase(stalled).phase !== AVAILABLE && elapsed < recoveryOf(CORE_EMBER) * 8) {
      wait(stalled, 1);
      elapsed += 1;
    }
    expect(emberPhase(stalled)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });

  it('S-164 (경계 ②) 아무도 그 방에 없어도 멎음과 풀림이 그대로 돈다', () => {
    // Given 둘 다 바닥난 세계 · 몸은 백왕령에 선다
    const w = bothSpent(WHITE_KING_DOMAIN);
    wait(w, Math.min(recoveryOf(NEST_FUNGUS), recoveryOf(CORE_EMBER) * 1.5) - 1);
    expect(emberPhase(w).phase).toBe(DEPLETED);
    // When 거목균이 돌아오고 그 뒤로 제 길이만큼 더 굴린다
    wait(w, recoveryOf(NEST_FUNGUS) - Math.min(recoveryOf(NEST_FUNGUS), recoveryOf(CORE_EMBER) * 1.5) + 1);
    wait(w, recoveryOf(CORE_EMBER));
    // Then 돌아왔다
    expect(emberPhase(w)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 — 지목하면 판이 재료의 이름과 성질을 말한다 (세계 쪽 몫)
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-005 지목하면 판이 재료의 이름과 성질을 말한다', () => {
  it('S-165 판이 읽는 두 값이 세계에 선다 — 원천이 재료의 코드를 싣고 그 재료가 성질 태그를 진다', () => {
    // Given 그 원천 곁에 선다
    const seen = sourceEntity(besideEmber().observe(), CORE_EMBER);
    // Then 판이 재료의 이름을 얻을 자리가 실린다
    expect(seen?.material).toBe(HEAT_CRYSTAL);
    // And 판이 성질 문장을 얻을 자리(그 재료의 태그)가 데이터에 선다
    expect((seedOf(HEAT_CRYSTAL).properties ?? []).map((p) => p.tag)).toContain(STORES_HEAT);
  });

  it('S-166 (경계 ②) 성질의 이름(축:관계)은 관찰 결과 어디에도 실리지 않는다', () => {
    // Given 그 원천이 선 방의 관찰 결과 — 이 Cycle 이 말하는 것이 전부 실린 자리다
    const text = JSON.stringify(besideEmber().observe());
    // Then 그 성질의 이름이 한 글자도 없다
    expect({ projected: text.includes(STORES_HEAT) }).toEqual({ projected: false });
    // And 그 재료가 진 다른 태그들도 마찬가지다
    for (const tag of (seedOf(HEAT_CRYSTAL).properties ?? []).map((p) => String(p.tag))) {
      expect({ tag, projected: text.includes(tag) }).toEqual({ tag, projected: false });
    }
  });

  it('S-167 (경계 ①) 이 재료가 어느 요구에 답하는지도 · 그 요구가 어디 있는지도 실리지 않는다', () => {
    const text = JSON.stringify(besideEmber().observe());
    // Then 협곡의 문도 · 그 너머의 방도 이 방의 관찰 결과에 없다
    for (const name of [depthDoor().id, FROST_DEPTH, FROST_CANYON]) {
      expect({ name, projected: text.includes(name) }).toEqual({ name, projected: false });
    }
  });

  it.todo(
    'GAP: 판의 줄 자체 — 「재료 열을 저장하는 결정 · 성질 열을 담는다」 와 「자리가 식었다」 의 문구는 View 의 표가 짓는다 (세계는 코드까지만 낸다)',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-006 — 답이 둘이 되고, 도구가 그 이음을 보인다 (도구의 자리)
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-006 답이 둘이 되고 도구가 그 이음을 보인다', () => {
  it('S-168 세계 쪽 몫 — 그 요구에 답하는 재료가 둘이 되고 저마다 제 원천이 선다', () => {
    // spec 이 세는 것(검사 ㊴ 의 Material 열)은 도구의 자리다. 세계 쪽에서 잴 수 있는 것은
    // "그 요구에 SUPPORTS 로 답하는 성질을 진 재료가 이제 둘이고, 그 둘이 저마다 원천을
    // 가진다" 까지다. 무엇이 답인가의 표(answers)는 C029 가 세운 데이터를 그대로 읽는다.
    const answering = new Set(
      (theVocabulary().answers ?? [])
        .filter((a) => a.requirement === ASKED && a.kind === SUPPORTS)
        .map((a) => String(a.property)),
    );
    // Given 이 Cycle 의 성질이 그 답들 가운데 하나다
    expect([...answering]).toContain(STORES_HEAT);
    // Then 그 답을 진 재료가 둘이 되고 그 가운데 하나가 이 Cycle 의 것이다
    const bearing = seeds().filter((seed) =>
      (seed.properties ?? []).some((p) => answering.has(String(p.tag))),
    );
    expect(bearing.map((s) => String(s.id))).toContain(HEAT_CRYSTAL);
    expect({ atLeastTwo: bearing.length >= 2 }).toEqual({ atLeastTwo: true });
    // And 저마다 그것을 내는 원천이 세계에 선다 (표에만 있는 답이 아니다)
    for (const seed of bearing) {
      const from = allSources().filter((x) => x.spec.materialId === seed.id);
      expect({ material: seed.id, sources: from.length > 0 }).toEqual({
        material: seed.id,
        sources: true,
      });
    }
  });

  it.todo(
    'GAP: 검사 ㊴ 의 Material 열이 2 · ㉟ 통과 · ㊵ 는 여전히 1 — engine/world-authoring 의 검사와 world:check 의 자리다',
  );
  it.todo(
    'GAP: world:observe --report 의 열쇠 × 자물쇠 표 (읽기 전용 · 두 번 돌리면 글자까지 같다 · 종료 코드는 fail 하나가 정한다) — 도구의 자리다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-007 — 문은 열리지 않는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-007 문은 열리지 않는다', () => {
  /** 그 결정을 손에 지닌 세계 — ItemKind 는 이 재료를 아직 이름으로 알지 못한다 */
  const carrying: Setup = { actorItems: { [HEAT_CRYSTAL]: 1 } as never };
  const empty: Setup = { actorItems: {} };
  /** 소지품 줄만 걷어낸 관찰 결과 — 손에 든 것 말고 무엇이 달라졌는지를 본다 */
  const withoutInventory = (v: GameViewSnapshot): string =>
    JSON.stringify({ ...v, hud: v.hud.filter((h) => !h.id.startsWith('inventory.')) });

  it('S-169 결정을 지닌 채 그 문 앞에 서도 열림 · 거절 사유 · 표식과 몸의 현상이 지니지 않았을 때와 같다', () => {
    const id = depthDoor().id;
    const room = depthDoor().from.region;
    const at = insideDoorTrace();
    for (const season of SEASONS) {
      const held = inSeason(season, room, at, carrying);
      const bare = inSeason(season, room, at, empty);
      // Given 손에 든 것은 실제로 다르다 — Given 이 헛돌지 않는다
      expect({ season, held: heldOf(held.observe(), HEAT_CRYSTAL) }).toEqual({ season, held: 1 });
      expect({ season, held: heldOf(bare.observe(), HEAT_CRYSTAL) }).toEqual({
        season,
        held: undefined,
      });
      // Then 문의 열림도 표식이 지는 것도 같다
      expect({ season, state: exitOf(held.observe(), id)?.state }).toEqual({
        season,
        state: exitOf(bare.observe(), id)?.state,
      });
      expect({ season, codes: codesOn(exitOf(held.observe(), id)) }).toEqual({
        season,
        codes: codesOn(exitOf(bare.observe(), id)),
      });
      // And 지목한 판이 읽는 몸의 현상도 같다
      expect({ season, codes: codesOn(myBody(held)) }).toEqual({
        season,
        codes: codesOn(myBody(bare)),
      });
      // And 건너려 할 때의 거절 사유도 같다
      expect({ season, reason: reasonOf(cross(held, id)) }).toEqual({
        season,
        reason: reasonOf(cross(bare, id)),
      });
    }
  });

  it('S-170 (경계 ①) 어느 철에서도 관찰 결과가 소지품 줄 말고는 한 글자도 다르지 않다', () => {
    const room = depthDoor().from.region;
    const at = insideDoorTrace();
    for (const season of SEASONS) {
      const held = inSeason(season, room, at, carrying);
      const bare = inSeason(season, room, at, empty);
      expect({ season, same: withoutInventory(held.observe()) === withoutInventory(bare.observe()) }).toEqual(
        { season, same: true },
      );
    }
  });

  it('S-171 (경계 ②) 요구를 밝히지 않은 문의 답도 한 값 달라지지 않는다', () => {
    const forestDoor = REGION_GRAPH.connectors.find((c) => c.id === WALKING_FOREST_DOOR)!;
    const plain: { id: string; region: string }[] = [
      { id: forestDoor.id, region: forestDoor.from.region },
      { id: MAZE_HEART_GATE, region: FANTASY_MAZE },
    ];
    for (const door of plain) {
      for (const season of SEASONS) {
        const at = connectorSpot(door.id, door.region);
        const held = inSeason(season, door.region, at, carrying);
        const bare = inSeason(season, door.region, at, empty);
        expect({ id: door.id, season, state: exitOf(held.observe(), door.id)?.state }).toEqual({
          id: door.id,
          season,
          state: exitOf(bare.observe(), door.id)?.state,
        });
        expect({ id: door.id, season, available: transitTo(held.observe(), door.id)?.available }).toEqual({
          id: door.id,
          season,
          available: transitTo(bare.observe(), door.id)?.available,
        });
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-008 — 백왕령에서 그 원천까지 그 문을 지나지 않고 닿는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-008 백왕령에서 그 원천까지 그 문을 지나지 않고 닿는다', () => {
  it('S-172 시작 방에서 빙결 심층의 문을 벽으로 놓아도 그 원천이 선 방에 닿는다', () => {
    const shut = reachableRegionsExcept(REGION_GRAPH, WHITE_KING_DOMAIN, [depthDoor().id]);
    expect(shut).toContain(TREE_INNER_WORLD);
  });

  it('S-173 (경계 ①) 그 문을 벽으로 놓아도 닿지 못하게 되는 방은 늘지 않는다', () => {
    const open = reachableRegions(REGION_GRAPH, WHITE_KING_DOMAIN);
    const shut = reachableRegionsExcept(REGION_GRAPH, WHITE_KING_DOMAIN, [depthDoor().id]);
    expect([...shut].sort()).toEqual([...open].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — 앞의 세계는 그대로다 (SPEC-009)
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('S-174 앞의 방들의 hash 가 한 값도 달라지지 않는다 — op 이 느는 방은 거목 내부 세계뿐이다', () => {
    for (const region of ROOMS_BEFORE) {
      expect({ region, hash: descriptionHash(spaceOf(region)) }).toEqual({
        region,
        hash: BASELINE[region]!.hash,
      });
    }
  });

  it('S-175 방마다 표면 · 통행 · 출구의 차례가 그대로다 (거목 내부 세계의 땅까지)', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({
        region,
        surface: surfaceCounts(region),
        traversable: traversableCount(region),
        exits: exitsOf(REGION_GRAPH, region).map((e) => e.connector.id),
      }).toEqual({
        region,
        surface: base.surface,
        traversable: base.traversable,
        exits: base.exits,
      });
    }
  });

  it('S-176 방마다의 원천 이름과 차례가 그대로다 — 느는 것은 거목 내부 세계의 하나뿐이다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      const ids = (regionSpec(region)?.resourceEcology?.sources ?? []).map((s) => s.id);
      const expected = region === TREE_INNER_WORLD ? [CORE_EMBER] : base.sources;
      expect({ region, ids }).toEqual({ region, ids: expected });
    }
  });

  it('S-177 앞의 방들에 실리는 것의 차례가 그대로고, 그 phase 는 어느 철에도 그대로다', () => {
    for (const [region, lines] of Object.entries(ENTITY_BASELINE)) {
      expect({ region, lines: entityLines(standingIn(region).observe()) }).toEqual({ region, lines });
    }
    for (const region of ROOMS_BEFORE) {
      const ids = BASELINE[region]!.sources;
      if (ids.length === 0) continue;
      for (const season of SEASONS) {
        const w = inSeason(season, region);
        for (const id of ids) {
          const phase = phaseOf(w, region, id) as SourceStateShape | undefined;
          const base = PHASE_BASELINE[id]!;
          expect({ region, season, id, phase: phase?.phase, taken: phase?.taken }).toEqual({
            region,
            season,
            id,
            phase: base.phase,
            taken: base.taken,
          });
        }
      }
    }
  });

  it('S-178 이 Cycle 의 이름과 코드가 앞의 방 어디에도 실리지 않는다', () => {
    const NEW_NAMES = [HEAT_CRYSTAL, CORE_EMBER, EMBER_COOLED, EMBER_WARMTH_PREFIX];
    for (const region of ROOMS_BEFORE) {
      const text = JSON.stringify(standingIn(region).observe());
      for (const name of NEW_NAMES) {
        expect({ region, name, projected: text.includes(name) }).toEqual({
          region,
          name,
          projected: false,
        });
      }
    }
  });

  it('S-179 C019 가 세운 협곡의 상시 위상(관찰 범위까지)이 그대로다', () => {
    for (const [region, standing] of Object.entries(CANYON_STANDING_BASELINE)) {
      const phases = (regionSpec(region) as unknown as { phases?: { standing?: unknown } } | undefined)
        ?.phases?.standing;
      expect({ region, standing: phases }).toEqual({ region, standing });
    }
  });
});
