// C031 — 답은 하나가 아니다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-003 · SPEC-007)
//
// C029 는 협곡의 문이 **묻게** 했고, C030 은 그 물음의 **답을 세계에 세웠다**(거목 안의 결정 하나).
// 이 Cycle 이 세우는 것은 답의 **둘째 종류**다 — 쥐는 것이 아니라 **서 있는 것**. 그래서 여기서
// 재는 것은 다섯이다:
//   ① 밝힘 — 요구 하나가 자기를 무르게 하는 자락과 그때 대신 설 사유를 밝히고, 그 자락이
//      그 방에 실제로 있다 (그리고 그것이 C019 의 눈보라다)
//   ② 자리 — 같은 문이 자락 **밖**에서는 처음 사유로, **안**에서는 완화된 사유로 읽힌다.
//      둘은 함께 서지 않는다 — 하나가 다른 하나를 **대신**한다
//   ③ 오감 — 걸어 나오면 돌아오고 다시 들면 다시 갈린다 · 되살린 세계도 같은 자리에서 같은 답이다 ·
//      자락 안팎의 세 관찰자가 같은 문을 각자의 자리대로 읽는다 (세계의 값은 하나다)
//   ④ 분할선 — 완화가 붙은 자리에서도 열림 · 잠김 · 건너기의 거절 사유 · 몸에 걸리는 것 ·
//      걸린 것 · 관찰 범위가 한 값 달라지지 않는다 (2층은 표시까지다)
//   ⑤ 불변 — 앞의 세계(방 열셋의 땅 · 원천 · 흔적 · phase · 문의 열림)는 그대로다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/regions 의 완화 데이터 · content/world 의 새 규칙 ·
// content/view/** 의 문구 · engine 의 relaxations)은 **읽지 않았다.** 기대값의 출처는
// cycles/C031-the-answer-is-not-one/spec.md 와 이미 있던 하네스·선례(c019 · c020 · c021 ·
// c022 · c029 · c030)뿐이다.
//
// **자리도 자락의 이름도 손으로 적지 않는다** — 문의 자리는 graph 의 anchor 에서, 완화 자락은
// 그 문에 걸린 Lock 이 가리킨 op 에서, 그 자락이 눈보라라는 것은 그 방 상시 위상이 밝힌
// 관찰 범위에서 읽는다. 손으로 적는 것은 spec 이 「데이터 값」 표에서 이름으로 못 박은 것
// (완화된 사유 코드 하나 · 그 앞의 사유 코드 하나 · 문 셋)뿐이고, 그것들은 세계에서 유도할
// 자리가 없다 (c020 · c021 · c029 · c030 의 규율 그대로).
//
// **번호는 이어 붙인다** — 이 저장소의 시나리오가 쓴 마지막 번호(S-179 · c030)를 잇는다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.
//
// **여기서 재지 않는 것 셋** — 검사 ㊴ ㊵ 와 열쇠 × 자물쇠 표(SPEC-004 · SPEC-005)와 계약
// 목록의 성질 어휘(SPEC-006)는 **도구/기반**의 자리이고, 지목한 판의 줄(「눈보라 속에서
// 약하다」의 문구)은 View 의 표가 짓는다. 세계 쪽에서 잴 수 있는 것은 그 판이 읽는 코드
// (entities[].conditions)까지다.
//
// **이 협곡의 눈보라는 그치지 않는다** (C019 확정 · phases.standing). 그래서 "걷히면 돌아온다"
// 를 철로 재지 않고 **자락을 걸어 나가는 것**으로 잰다 (spec 기본형 ①). 들어온 자리
// (협곡 남쪽 끝의 anchor)는 자락 밖이고 문은 자락 안이다 — 그 둘을 데이터에서 읽어 쓴다.

import { describe, expect, it } from 'vitest';
import {
  descriptionHash,
  pointsOf,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { exitsOf } from '../../../engine/world-authoring/graph';
import { areaCoversPoint, isTraversableAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
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
  MAZE_HEART,
  MAZE_HEART_GATE,
  PREDATOR_NEST,
  RED_EYE_TREE,
  REGION_GRAPH,
  REGION_SPECS,
  TREE_INNER_WORLD,
  WALKING_FOREST_DOOR,
  WHITE_KING_DOMAIN,
  regionSpec,
  type SeasonId,
} from '../../regions';
// C008 이 세운 미로의 이름 — 그 파일이 소유한다 (c008 ~ c030 시나리오의 선례 그대로).
import { FANTASY_MAZE } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { sourceStateOf, traceStrengthAt } from '../semantic/resource';
import { driveWorld, OBSERVER, OBSERVER_2, type WorldDriver } from './drive';

// ── spec 이 이름으로 못 박은 것들 (State 의 「데이터 값」 표) ──────────

/** 완화된 사유 코드 — 「체열이 감지된다 — 눈보라 속에서 약하다」 (데이터 값 표 · Play §6 V25) */
const ASKS_WARMTH_WEAK = 'asks-warmth-weak';
/** 그 앞에 서던 사유 코드 — C029 가 세웠다 (Reuse: RULE-LOCK-REASON-001 은 그대로다) */
const ASKS_WARMTH = 'asks-warmth';
/** C029 가 문 앞의 자락에서 몸에 싣는 코드 — 이 Cycle 에서 한 값도 달라지지 않는다 (기본형 ②) */
const BREATH_GLOWS = 'breath-glows';

/** 철 넷 (C015 · C016 그대로) */
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
const SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT, TURN];
/** 낮으로 여는 때 · 밤으로 여는 때 (c018 · c019 의 어법 그대로) */
const DAY_CLOCK = 'STILL';
const NIGHT_CLOCK = 'STILL:NIGHT';

/** 사유 코드 — 그대로 쓰는 것들 (C002 · C009 · C016 · C029) */
const NOT_THIS_SEASON = 'not-this-season';
const REGION_NOT_BUILT = 'region-not-built';

/** 위험 자락의 layer (C019 그대로) */
const HAZARD_LAYER = 'hazard';

const solo: WorldSetup = { npcs: [] };

// ── 회귀의 기준값 (SPEC-007) ─────────────────────────────────────────
//
// 이 Cycle 이 시작하기 전의 세계에서 온 값이다 — 표의 꼴과 값은 c030 시나리오의 그 표들을
// 본보기로 삼았고(BASELINE · ENTITY_BASELINE · PHASE_BASELINE · CANYON_STANDING_BASELINE),
// c030 이 「거목 내부 세계」 만 비켜 두었던 자리는 그 Cycle 이 닫힌 뒤의 값으로 채웠다.
// **이 Cycle 은 Description 을 한 op 도 건드리지 않는다** — 그래서 방 열셋의 hash 를 모두 견준다.

interface RoomBaseline {
  hash: string;
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
    hash: '2b6a4c96',
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
    hash: '7e437aff',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['NEST_TRAIL'],
    floorTrace: 2,
    peakTrace: 4,
    sources: ['NEST_FUNGUS', 'GLOW_CAP_NEST_1', 'GLOW_CAP_NEST_2', 'HUSK_SHARD_NEST'],
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

/** 방마다 실리는 것의 차례 — 그 방 한가운데(기본 자리)에 선 세계에서 (c030 S-177 의 어법) */
const ENTITY_BASELINE: Readonly<Record<string, readonly string[]>> = {
  [WHITE_KING_DOMAIN]: ['player-1/player-character', 'FOREST_PATH/region-exit', 'RED_WASTE_PASS/region-exit', 'ICE_CANYON_PASS/region-exit'],
  [FOREST_EDGE]: ['player-1/player-character', 'MOLT_LITTER/resource-source', 'FALLEN_SCALE/resource-source', 'PREY_REMAINS/resource-source', 'ORE_PEBBLE_EDGE/resource-source', 'HUSK_SHARD_EDGE/resource-source', 'FOREST_PATH/region-exit', 'RUIN_TRAIL/region-exit', 'DEEP_TRAIL/region-exit'],
  [FOREST_DEEP]: ['player-1/player-character', 'RIVER_SILT/resource-source', 'ORE_PEBBLE_DEEP_1/resource-source', 'ORE_PEBBLE_DEEP_2/resource-source', 'HUSK_SHARD_DEEP/resource-source', 'DEEP_TRAIL/region-exit', 'NEST_TRAIL/region-exit', 'ORE_TRAIL/region-exit', 'TREE_APPROACH/region-exit', 'ANCIENT_GATE/region-exit', 'WALKING_FOREST_DOOR/region-exit'],
  [EXPLORER_RUIN]: ['player-1/player-character', 'RUIN_SPOIL/resource-source', 'ORE_PEBBLE_RUIN/resource-source', 'HUSK_SHARD_RUIN_1/resource-source', 'HUSK_SHARD_RUIN_2/resource-source', 'RUIN_TRAIL/region-exit'],
  [PREDATOR_NEST]: ['player-1/player-character', 'NEST_FUNGUS/resource-source', 'HUSK_SHARD_NEST/resource-source', 'NEST_TRAIL/region-exit'],
  [BIO_ORE_FIELD]: ['player-1/player-character', 'ORE_OUTCROP/resource-source', 'ORE_PEBBLE_ORE_1/resource-source', 'ORE_PEBBLE_ORE_2/resource-source', 'ORE_PEBBLE_ORE_3/resource-source', 'HUSK_SHARD_ORE/resource-source', 'ORE_TRAIL/region-exit', 'ORE_TREE_TRAIL/region-exit'],
  [RED_EYE_TREE]: ['player-1/player-character', 'ROOT_NODULE/resource-source', 'ORE_PEBBLE_TREE/resource-source', 'CLUTCH_HUSK/resource-source', 'EGG_HUSK/resource-source', 'ROOT_CLUTCH/life-site', 'ROOT_EGGS/life-site', 'TREE_APPROACH/region-exit', 'ORE_TREE_TRAIL/region-exit', 'TREE_INNER_DOOR/region-exit'],
  [TREE_INNER_WORLD]: ['player-1/player-character', 'CORE_EMBER/resource-source', 'TREE_INNER_DOOR/region-exit', 'TREE_FALL/region-exit'],
  [HEART_LAKE]: ['player-1/player-character', 'LAKE_SILT_BED/resource-source', 'HEART_RIVER/region-exit'],
  [FANTASY_MAZE]: ['player-1/player-character', 'MAZE_GATE_RETURN/region-exit', 'MAZE_HEART_GATE/region-exit'],
  [MAZE_HEART]: ['player-1/player-character', 'MAZE_HEART_GATE/region-exit', 'INVERTED_GARDEN_DOOR/region-exit'],
  [ICE_CANYON]: ['player-1/player-character', 'PASS_RIME/resource-source', 'ICE_CANYON_PASS/region-exit', 'FROST_CANYON_TRAIL/region-exit'],
  [FROST_CANYON]: ['player-1/player-character', 'CLIFF_FROST_VEIN/resource-source', 'FROZEN_REMAINS/resource-source', 'FROST_CANYON_TRAIL/region-exit', 'FROST_DEPTH_DOOR/region-exit'],
};

/**
 * 원천마다 **세계가 서자마자의** phase 와 캔 횟수 (SPEC-007 "원천").
 *
 * 다 available 이 아니다 — 사건에 기대는 원천(고래 비늘 · 먹이 잔해 · 강가의 알갱이 · 알집)은
 * 그 사건이 아직 오지 않아 처음부터 바닥나 있다 (C014 · C016 이 세운 자리). 그 값이 이
 * Cycle 로 한 값도 달라지지 않아야 한다는 것이 여기서 재는 것이고, 철 넷에서 모두 같다.
 */
const PHASE_BASELINE: Readonly<Record<string, { phase: string; taken: number }>> = {
  MOLT_LITTER: { phase: 'available', taken: 0 },
  SEEP_CRUST: { phase: 'available', taken: 0 },
  FALLEN_SCALE: { phase: 'depleted', taken: 1 },
  PREY_REMAINS: { phase: 'depleted', taken: 1 },
  ORE_PEBBLE_EDGE: { phase: 'available', taken: 0 },
  HUSK_SHARD_EDGE: { phase: 'available', taken: 0 },
  GLOW_CAP_EDGE: { phase: 'available', taken: 0 },
  RIVER_SILT: { phase: 'depleted', taken: 2 },
  ORE_PEBBLE_DEEP_1: { phase: 'available', taken: 0 },
  ORE_PEBBLE_DEEP_2: { phase: 'available', taken: 0 },
  HUSK_SHARD_DEEP: { phase: 'available', taken: 0 },
  GLOW_CAP_DEEP: { phase: 'available', taken: 0 },
  SEEP_CRUST_DEEP: { phase: 'available', taken: 0 },
  RUIN_SPOIL: { phase: 'available', taken: 0 },
  ORE_PEBBLE_RUIN: { phase: 'available', taken: 0 },
  HUSK_SHARD_RUIN_1: { phase: 'available', taken: 0 },
  HUSK_SHARD_RUIN_2: { phase: 'available', taken: 0 },
  NEST_FUNGUS: { phase: 'available', taken: 0 },
  GLOW_CAP_NEST_1: { phase: 'available', taken: 0 },
  GLOW_CAP_NEST_2: { phase: 'available', taken: 0 },
  HUSK_SHARD_NEST: { phase: 'available', taken: 0 },
  ORE_OUTCROP: { phase: 'available', taken: 0 },
  ORE_PEBBLE_ORE_1: { phase: 'available', taken: 0 },
  ORE_PEBBLE_ORE_2: { phase: 'available', taken: 0 },
  ORE_PEBBLE_ORE_3: { phase: 'available', taken: 0 },
  HUSK_SHARD_ORE: { phase: 'available', taken: 0 },
  ROOT_NODULE: { phase: 'available', taken: 0 },
  GLOW_CAP_TREE: { phase: 'available', taken: 0 },
  ORE_PEBBLE_TREE: { phase: 'available', taken: 0 },
  CLUTCH_HUSK: { phase: 'depleted', taken: 1 },
  EGG_HUSK: { phase: 'depleted', taken: 1 },
  CORE_EMBER: { phase: 'available', taken: 0 },
  LAKE_SILT_BED: { phase: 'available', taken: 0 },
  PASS_RIME: { phase: 'available', taken: 0 },
  CLIFF_FROST_VEIN: { phase: 'available', taken: 0 },
  SNOW_DRIFT_DUST: { phase: 'available', taken: 0 },
  FROZEN_REMAINS: { phase: 'available', taken: 0 },
};

/** C019 가 세운 상시 위상 — 눈보라의 관찰 범위까지 그대로다 (SPEC-001 경계 ③ · SPEC-007) */
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

// ── 하네스 (c019 · c020 · c021 · c029 · c030 의 선례 그대로) ──────────

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
const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);

/** 표면 태그마다 vertex 수 (c019 ~ c030 의 어법) */
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

const anchorAt = (region: string, tag: string): XZ => {
  const found = pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag);
  if (!found) throw new Error(`${region} 에 anchor '${tag}' 가 없다`);
  return found.position;
};
/** 그 이음이 이 방에서 서는 자리 (c020 · c021 · c029 · c030 의 connectorSpot 그대로) */
function connectorSpot(connectorId: string, region: string): XZ {
  const c = REGION_GRAPH.connectors.find((x) => x.id === connectorId);
  if (!c) throw new Error(`graph 에 이음 '${connectorId}' 가 없다`);
  return anchorAt(region, c.from.region === region ? c.from.anchor : c.to.anchor);
}

/** 그 op 이 그 방의 area 인가 (c029 그대로) */
function isAreaOp(region: string, opId: string): boolean {
  const op = spaceOf(region).ops.find((o) => o.id === opId);
  return op !== undefined && op.kind === 'area';
}
function areaShapeOf(region: string, areaId: string) {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return op.shape;
}
const areaTagOf = (region: string, areaId: string): string => {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return op.tag;
};
const coveredBy = (region: string, areaId: string, at: XZ): boolean =>
  areaCoversPoint(areaShapeOf(region, areaId), at.x, at.z);
/** 그 자락 안의 걸어 설 수 있는 자리들 (c020 · c029 의 spotsInAreaOp 그대로) */
const spotsInAreaOp = (region: string, areaId: string): XZ[] =>
  walkableSpots(region).filter((p) => coveredBy(region, areaId, p));
/** 그 자락 **밖**의, 그 자리에서 가장 가까운 걸어 설 자리 (c029 의 outsideAreaOp 그대로) */
function outsideAreaOp(region: string, areaId: string, from: XZ): XZ {
  const outside = walkableSpots(region).filter((p) => !coveredBy(region, areaId, p));
  if (outside.length === 0) throw new Error(`자락 '${areaId}' 밖에 걸어 설 자리가 없다 (${region})`);
  return minBy(outside, (p) => distanceBetween(p, from));
}

// ── 세계를 세우고 굴리는 자리 ────────────────────────────────────────

const standingIn = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    ...extra,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
  });
/** 그 철에서 시작하는 세계 — C015 가 세운 clock 손잡이 (c016 ~ c030 의 inSeason 그대로) */
const inSeason = (season: SeasonId, region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  standingIn(region, at, { ...extra, clock: season });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};

const move = (w: WorldDriver, at: XZ, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } }, observerId);
const cross = (w: WorldDriver, connector: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector }, observerId);
const reasonOf = (result: ActionResult): string | undefined =>
  'reason' in result ? (result.reason as string) : undefined;

const bodyIdOf = (w: WorldDriver, observerId = OBSERVER): string =>
  w.observe(observerId).observer.characterId;
const hereOf = (w: WorldDriver, bodyId: string): XZ => {
  const a = state(w).actors.find((x) => x.id === bodyId)!;
  return { x: a.position.x, z: a.position.z };
};

/** 걸어서 그 자리에 선다 (c017 · c019 ~ c029 의 walkTo 그대로) */
function walkTo(w: WorldDriver, at: XZ, budgetSeconds = 240) {
  const body = bodyIdOf(w);
  if (distanceBetween(hereOf(w, body), at) <= 0.05) return;
  expect(move(w, at).status).toBe('success');
  const steps = Math.ceil(budgetSeconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    w.tick(TICK_INTERVAL);
    if (distanceBetween(hereOf(w, body), at) <= 0.05) return;
  }
  throw new Error(`걸어서 (${at.x}, ${at.z}) 에 닿지 못했다 — 지금 ${JSON.stringify(hereOf(w, body))}`);
}

// ── 저장·복구 · 여럿이 선 세계 (c017 · c019 · c029 의 선례 그대로) ───

function wrap(world: World): WorldDriver {
  return {
    dispatch(action, observerId = OBSERVER) {
      world.request(observerId, action);
      const result = world.tick(0).results[0];
      if (!result) throw new Error('요청이 처리되지 않았다');
      return result;
    },
    dispatchForOutcome(action, observerId = OBSERVER) {
      world.request(observerId, action);
      return world.tick(0).outcomes.get(observerId) ?? [];
    },
    tick: (dt) => void world.tick(dt),
    join: (observerId) => world.join(observerId),
    leave: (observerId) => world.leave(observerId),
    mark: (value, observerId = OBSERVER) => world.mark(observerId, value),
    observe(observerId = OBSERVER) {
      const snapshot = world.latestObservation(observerId);
      if (!snapshot) throw new Error(`관찰 결과가 없다 — ${observerId}`);
      return snapshot as GameViewSnapshot;
    },
    world,
  };
}
const throughFile = (snapshot: WorldSnapshot): WorldSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;

function revive(base: WorldDriver, observers: readonly string[] = [OBSERVER]): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  const world = createWorld({}, restored);
  for (const observerId of observers) world.join(observerId);
  world.tick(0);
  return wrap(world);
}
function worldFrom(
  base: WorldDriver,
  edit: (s: WorldState) => void,
  observers: readonly string[] = [OBSERVER],
): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  edit(restored);
  const world = createWorld({}, restored);
  for (const observerId of observers) world.join(observerId);
  world.tick(0);
  return wrap(world);
}
/** 그 몸을 그 방 그 자리에 세운다 (관성도 하던 행동도 없이 · c017 · c019 의 place 그대로) */
function place(s: WorldState, id: string, region: string, at: XZ) {
  const a = s.actors.find((x: ActorState) => x.id === id)!;
  a.regionId = region;
  a.position = { x: at.x, z: at.z };
  a.velocity = { x: 0, z: 0 };
  a.currentAction = idleAction();
}
/** 관찰자 여럿이 한 방의 저마다의 자리에 선 세계 (c017 의 staged 를 이 Cycle 이 쓰는 만큼만) */
const OBSERVER_3 = 'observer-3';
function staged(
  region: string,
  placements: readonly { observer: string; at: XZ }[],
  extra: WorldSetup = {},
): WorldDriver {
  const first = placements[0]!;
  const base = driveWorld({
    ...solo,
    ...extra,
    actorRegion: region,
    actorPosition: { x: first.at.x, z: first.at.z },
  });
  for (const one of placements.slice(1)) base.join(one.observer);
  base.tick(0);
  const bodies = placements.map((one) => ({ ...one, body: bodyIdOf(base, one.observer) }));
  return worldFrom(
    base,
    (s) => {
      for (const one of bodies) place(s, one.body, region, one.at);
    },
    placements.map((one) => one.observer),
  );
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────

type SeenEntity = EntityView & { conditions?: string[]; material?: string };
const entitiesIn = (v: GameViewSnapshot): SeenEntity[] => v.entities as SeenEntity[];
const exitsIn = (v: GameViewSnapshot): SeenEntity[] =>
  entitiesIn(v).filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string): SeenEntity | undefined =>
  exitsIn(v).find((e) => e.id === id);
const entityOf = (v: GameViewSnapshot, id: string): SeenEntity | undefined =>
  entitiesIn(v).find((e) => e.id === id);
const entityLines = (v: GameViewSnapshot): string[] => v.entities.map((e) => `${e.id}/${e.role}`);
const codesOn = (e: SeenEntity | undefined): string[] => e?.conditions ?? [];
const transitTo = (v: GameViewSnapshot, connector: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'transit' && i.targetEntityId === connector);
/** 그 관찰자의 몸의 투영 — C029 가 문 앞의 현상을 싣는 자리 */
const bodyOf = (w: WorldDriver, observerId = OBSERVER): SeenEntity => {
  const v = w.observe(observerId);
  const found = entitiesIn(v).find((e) => e.id === v.observer.characterId);
  if (!found) throw new Error(`관찰 결과에 몸이 없다 — ${observerId}`);
  return found;
};

interface SourceStateShape {
  phase: string;
  taken: number;
}
const phaseOf = (w: WorldDriver, region: string, id: string): SourceStateShape | undefined =>
  sourceStateOf(statesOf(w), region, id) as SourceStateShape | undefined;

const UNTOUCHED = {} as never;
/** 아무것도 캐지 않은 세계에서 그 자리의 흔적 단계 (c020 · c030 의 traceAt 그대로) */
const traceAt = (region: string, at: XZ) => traceStrengthAt(UNTOUCHED, region, at);
const floorTraceOf = (region: string) =>
  gridSpots(region).reduce((low, at) => Math.min(low, traceAt(region, at)), Infinity);
const peakTraceOf = (region: string) =>
  gridSpots(region).reduce((high, at) => Math.max(high, traceAt(region, at)), 0);

// ── Lock 을 읽는 자리 (c029 의 LockShape 어법에 이 Cycle 의 두 자리를 더한다) ──
//
// spec 은 완화의 export 이름도 자락 op 의 이름도 적지 않는다 (관찰 계약의 규율 그대로).
// 관찰자가 자기 content/regions 를 훑어 스스로 얻는 것이 이 저장소의 길이다.

interface RelaxationShape {
  area?: string;
}
interface LockShape {
  id?: string;
  at?: { kind?: string; ref?: string };
  requires?: readonly Record<string, unknown>[];
  important?: boolean;
  traces?: readonly { op?: string; showsOnBody?: unknown; code?: unknown }[];
  reason?: string;
  relaxedBy?: readonly RelaxationShape[];
  relaxedReason?: string;
}

const locksOf = (region: string): LockShape[] => [
  ...(((regionSpec(region) as unknown as { access?: { locks?: readonly LockShape[] } } | undefined)
    ?.access?.locks ?? []) as readonly LockShape[]),
];
/** 세계의 모든 Lock — {방, Lock} 짝으로 편다 (c029 의 allLocks 그대로) */
const allLocks = (): { region: string; lock: LockShape }[] =>
  REGION_SPECS.flatMap((spec) => locksOf(spec.id).map((lock) => ({ region: spec.id, lock })));
/** 완화를 **밝힌** Lock 들 — 자락도 사유도 밝혀야 밝힌 것이다 */
const relaxedLocks = (): { region: string; lock: LockShape }[] =>
  allLocks().filter(
    (x) =>
      Array.isArray(x.lock.relaxedBy) &&
      x.lock.relaxedBy.length > 0 &&
      typeof x.lock.relaxedReason === 'string' &&
      x.lock.relaxedReason.length > 0,
  );
/** 완화를 밝히지 않은 Lock 들 */
const plainLocks = (): { region: string; lock: LockShape }[] =>
  allLocks().filter((x) => !relaxedLocks().some((r) => r.lock === x.lock));

/** 빙결 심층으로 드는 문 — 이름을 손으로 적지 않고 graph 가 고르게 한다 (c020 ~ c030 그대로) */
const depthDoor = () => {
  const found = REGION_GRAPH.connectors.find((c) => c.to.region === FROST_DEPTH);
  if (!found) throw new Error('graph 에 빙결 심층으로 드는 문이 없다');
  return found;
};
const DOOR_ROOM = depthDoor().from.region;
const depthDoorSpot = () => connectorSpot(depthDoor().id, DOOR_ROOM);

/** 그 문에 걸린, 완화를 밝힌 Lock 하나 (없으면 그 자리에서 걸린다) */
function relaxedLockOnDoor(): LockShape {
  const found = relaxedLocks().find(
    (x) => x.lock.at?.kind === 'connector' && x.lock.at?.ref === depthDoor().id,
  );
  if (!found) throw new Error('빙결 심층의 문에 완화를 밝힌 Lock 이 없다');
  return found.lock;
}
/** 그 Lock 이 가리킨 완화 자락들의 op id */
const relaxedAreaIds = (lock: LockShape): string[] =>
  (lock.relaxedBy ?? []).map((one) => String(one.area));
/** 그 문을 무르게 하는 자락 하나 — 그 방에 실제로 있는 area 여야 한다 */
function relaxingArea(): string {
  const ids = relaxedAreaIds(relaxedLockOnDoor()).filter((id) => isAreaOp(DOOR_ROOM, id));
  if (ids.length === 0) throw new Error(`${DOOR_ROOM} 에 그 Lock 이 가리킨 area 가 하나도 없다`);
  return ids[0]!;
}

/** 그 흔적이 몸에 보일 것을 밝혔으면 그 코드 (c029 의 bodyCodeOf 그대로) */
function bodyCodeOf(trace: { showsOnBody?: unknown; code?: unknown }): string | undefined {
  const raw = trace.showsOnBody;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (raw === true && typeof trace.code === 'string' && trace.code.length > 0) return trace.code;
  return undefined;
}
/** C029 가 놓은 **문 앞의 자락** — 몸에 보일 것을 밝힌 흔적의 area op 들 */
const bodyTraceAreas = (lock: LockShape): string[] =>
  (lock.traces ?? [])
    .filter((t) => bodyCodeOf(t) !== undefined && typeof t.op === 'string')
    .map((t) => String(t.op))
    .filter((op) => isAreaOp(DOOR_ROOM, op));

/** 그 방의 상시 위상이 밝힌 위험 덧씌움들 (C019 가 세운 자리 — 그대로 읽는다) */
interface StandingHazardShape {
  areaId?: string;
  hazard?: string;
  observeRange?: { day: number; night: number };
  contact?: string;
}
const standingHazards = (region: string): StandingHazardShape[] =>
  (((regionSpec(region) as unknown as { phases?: { standing?: { hazardExtend?: readonly StandingHazardShape[] } } } | undefined)
    ?.phases?.standing?.hazardExtend ?? []) as readonly StandingHazardShape[]).map((h) => h);
/** 그 방에서 **관찰 범위를 밝힌** 자락 — 이 세계에서는 눈보라다 (c019 의 rangeOverlays 그대로) */
const rangeHazardOf = (region: string): StandingHazardShape => {
  const found = standingHazards(region).find((h) => h.observeRange !== undefined);
  if (!found) throw new Error(`${region} 에 관찰 범위를 밝힌 자락이 없다`);
  return found;
};

// ── 이 Cycle 이 재는 두 자리 (자락 밖 · 자락 안) ─────────────────────
//
// spec 기본형 ① — 눈보라는 그치지 않으므로 "돌아옴" 을 철이 아니라 **걸음**으로 잰다.
// 들어온 자리는 이 방으로 드는 이음의 anchor 이고(협곡 남쪽 끝), 문은 그 반대쪽 끝이다.

/** 이 방으로 **들어오는** 이음 — graph 가 고르게 한다 (이름을 손으로 적지 않는다) */
const wayIn = () => {
  const found = REGION_GRAPH.connectors.find(
    (c) => c.id !== depthDoor().id && (c.from.region === DOOR_ROOM || c.to.region === DOOR_ROOM),
  );
  if (!found) throw new Error(`${DOOR_ROOM} 으로 드는 이음이 없다`);
  return found;
};
/** 협곡에 들어선 자리 — 자락 **밖**이다 (아래 S-181 이 그것을 잰다) */
const enteredSpot = () => connectorSpot(wayIn().id, DOOR_ROOM);

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 요구가 자기를 무르게 하는 자락을 밝힌다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 요구가 자기를 무르게 하는 자락을 밝힌다', () => {
  it('S-180 완화를 밝힌 Lock 이 세계에 하나뿐이고, 그것이 빙결 심층의 문에 걸렸다', () => {
    // Given 세계의 모든 Lock 가운데 완화(자락 + 대신 설 사유)를 밝힌 것
    const relaxed = relaxedLocks();
    // Then 하나뿐이고 그 자리는 빙결 심층으로 드는 문이다 (Play 확정 1)
    expect(relaxed.map((x) => `${x.region}/${x.lock.at?.kind}:${x.lock.at?.ref}`)).toEqual([
      `${DOOR_ROOM}/connector:${depthDoor().id}`,
    ]);
    // And 그 문이 여전히 중요한 것으로 서고 처음 사유도 그대로다 (C029 의 그 자리는 바뀌지 않는다)
    const lock = relaxedLockOnDoor();
    expect({ important: lock.important, reason: lock.reason }).toEqual({
      important: true,
      reason: ASKS_WARMTH,
    });
    // And 그 자락 안에서 대신 설 사유가 spec 이 이름한 그것이다
    expect(lock.relaxedReason).toBe(ASKS_WARMTH_WEAK);
  });

  it('S-181 그 Lock 이 가리킨 자락이 그 방에 실제로 있는 area 이고, 그것이 관찰 범위를 밝힌 그 자락(눈보라)이다', () => {
    const lock = relaxedLockOnDoor();
    const ids = relaxedAreaIds(lock);
    // Given 가리킨 자락이 하나 이상이다
    expect({ pointed: ids.length > 0 }).toEqual({ pointed: true });
    // Then 가리킨 것마다 그 방에 실제로 있는 area op 이고, 걸어 설 자리가 있다
    for (const id of ids) {
      expect({ id, isArea: isAreaOp(DOOR_ROOM, id) }).toEqual({ id, isArea: true });
      expect({ id, spots: spotsInAreaOp(DOOR_ROOM, id).length > 0 }).toEqual({ id, spots: true });
    }
    // And 그 가운데 하나가 C019 가 관찰 범위를 밝혀 둔 그 자락이다 — 새 자락을 짓지 않았다
    expect({ pointsAtBlizzard: ids.includes(String(rangeHazardOf(DOOR_ROOM).areaId)) }).toEqual({
      pointsAtBlizzard: true,
    });
    // And 문은 그 자락 **안**에 있고 들어온 자리는 그 **밖**이다 (spec 기본형 ①)
    const area = relaxingArea();
    expect({
      door: coveredBy(DOOR_ROOM, area, depthDoorSpot()),
      entered: coveredBy(DOOR_ROOM, area, enteredSpot()),
    }).toEqual({ door: true, entered: false });
  });

  it('S-182 (경계 ①) 완화를 밝히지 않은 문들은 어느 자리에서도 한 글자도 달라지지 않는다', () => {
    // Given 완화를 밝히지 않은 Lock 이 아직 세계에 남아 있다 (미로의 심장 · 걷는 숲)
    const plain = plainLocks();
    expect({ left: plain.length > 0 }).toEqual({ left: true });
    // Then 그 문들의 표식에는 조건 자리 자체가 서지 않는다 — 철도 자리도 가리지 않는다
    const forestDoor = REGION_GRAPH.connectors.find((c) => c.id === WALKING_FOREST_DOOR)!;
    const doors: { id: string; region: string }[] = [
      { id: forestDoor.id, region: forestDoor.from.region },
      { id: MAZE_HEART_GATE, region: FANTASY_MAZE },
    ];
    for (const door of doors) {
      for (const season of SEASONS) {
        const v = inSeason(season, door.region, connectorSpot(door.id, door.region)).observe();
        expect({ id: door.id, season, conditions: exitOf(v, door.id)?.conditions }).toEqual({
          id: door.id,
          season,
          conditions: undefined,
        });
      }
    }
    // And 같은 방 안의 다른 문(Lock 이 걸리지 않은 오솔길)도 자락 **안팎** 어디서 읽어도 그대로다.
    //     이것이 "어느 자리에서도" 를 한 방 안에서 재는 자리다 — 눈보라는 그 방 전체가 아니다
    const area = relaxingArea();
    const outside = enteredSpot();
    const inside = depthDoorSpot();
    for (const at of [outside, inside]) {
      const v = inSeason(LONG_NIGHT, DOOR_ROOM, at).observe();
      expect({ at, id: wayIn().id, conditions: exitOf(v, wayIn().id)?.conditions }).toEqual({
        at,
        id: wayIn().id,
        conditions: undefined,
      });
    }
    // And 그 두 자리가 실제로 자락 안팎으로 갈린다 — Given 이 헛돌지 않는다
    expect({
      outside: coveredBy(DOOR_ROOM, area, outside),
      inside: coveredBy(DOOR_ROOM, area, inside),
    }).toEqual({ outside: false, inside: true });
  });

  it('S-183 (경계 ③) 그 자락 자체가 한 값도 바뀌지 않는다 — 상시 위상도 관찰 범위도 가리킬 뿐이다', () => {
    // Then 협곡 둘의 상시 위상이 C019 가 세운 그대로다 (관찰 범위 { day 20 · night 10 } 까지)
    for (const [region, standing] of Object.entries(CANYON_STANDING_BASELINE)) {
      const phases = (regionSpec(region) as unknown as { phases?: { standing?: unknown } } | undefined)
        ?.phases?.standing;
      expect({ region, standing: phases }).toEqual({ region, standing });
    }
    // And 그 자락이 실제로 자르는 범위도 그대로다 — 낮인데도 자락 안에서는 밝힌 수 밖의 몸이 실리지 않는다
    const area = relaxingArea();
    const range = rangeHazardOf(DOOR_ROOM).observeRange!;
    const mine = depthDoorSpot();
    const far = walkableSpots(DOOR_ROOM).filter((p) => distanceBetween(p, mine) > range.day + 1);
    expect({ far: far.length > 0 }).toEqual({ far: true });
    const beyond = staged(
      DOOR_ROOM,
      [
        { observer: OBSERVER, at: mine },
        { observer: OBSERVER_2, at: minBy(far, (p) => distanceBetween(p, mine)) },
      ],
      { clock: DAY_CLOCK },
    );
    expect({
      inside: coveredBy(DOOR_ROOM, area, mine),
      seen: entityOf(beyond.observe(OBSERVER), bodyIdOf(beyond, OBSERVER_2)) !== undefined,
    }).toEqual({ inside: true, seen: false });
    // And 그 수 안의 몸은 낮에도 밤에도 밝힌 대로 실린다
    const near = walkableSpots(DOOR_ROOM).filter(
      (p) => distanceBetween(p, mine) > 2 && distanceBetween(p, mine) < range.night - 1,
    );
    expect({ near: near.length > 0 }).toEqual({ near: true });
    const close = maxBy(near, (p) => distanceBetween(p, mine));
    for (const clock of [DAY_CLOCK, NIGHT_CLOCK]) {
      const w = staged(
        DOOR_ROOM,
        [
          { observer: OBSERVER, at: mine },
          { observer: OBSERVER_2, at: close },
        ],
        { clock },
      );
      expect({ clock, seen: entityOf(w.observe(OBSERVER), bodyIdOf(w, OBSERVER_2)) !== undefined }).toEqual({
        clock,
        seen: true,
      });
    }
  });

  it.todo(
    'GAP: 세계가 모르는 자락을 가리킨 줄이 조용히 아무 일도 하지 않는다 (SPEC-001 경계 ② · R1 경계 ②) — ' +
      'content/regions 는 정적으로 읽히는 데이터라 WorldSetup 에 끊긴 참조를 밝힌 Lock 을 세울 손잡이가 ' +
      '없다 (c029 가 흔적의 같은 자리에 남긴 그 GAP). 이 파일은 "지금 가리킨 op 이 그 방에 실제로 ' +
      '있다"(S-181) 까지만 잰다',
  );

  it.todo(
    'GAP: 자락 여럿을 밝히면 하나만 들어도 완화되고 겹침이 개수를 늘리지 않는다 (R1 경계 ③) — ' +
      '지금 데이터는 자락 하나만 밝히므로(S-181) 겹칠 둘째 자락을 놓을 자리가 없다. 데이터가 둘을 ' +
      '밝히는 날 이 자리가 선다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 완화는 선 자리에서 읽힌다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-002 완화는 선 자리에서 읽힌다', () => {
  it('S-184 자락 밖(협곡에 들어선 자리)에서 그 문을 읽으면 처음 사유가 실린다', () => {
    for (const season of SEASONS) {
      const v = inSeason(season, DOOR_ROOM, enteredSpot()).observe();
      const seen = exitOf(v, depthDoor().id);
      // Given 그 자리에서 그 문이 실제로 보인다 (Given 이 헛돌지 않는다)
      expect({ season, standing: seen !== undefined }).toEqual({ season, standing: true });
      // Then 표식이 지는 것은 처음 사유 하나다 — 완화된 사유는 서지 않는다
      expect({ season, codes: codesOn(seen) }).toEqual({ season, codes: [ASKS_WARMTH] });
    }
  });

  it('S-185 자락 안(문 앞)에서 같은 문을 읽으면 완화된 사유가 **대신** 선다 — 둘이 함께 서지 않는다', () => {
    for (const season of SEASONS) {
      const v = inSeason(season, DOOR_ROOM, depthDoorSpot()).observe();
      const seen = exitOf(v, depthDoor().id);
      expect({ season, standing: seen !== undefined }).toEqual({ season, standing: true });
      // Then 완화된 사유 하나뿐이다 (C021 이 안전의 코드에 세운 그 어법 — 대신 선다)
      expect({ season, codes: codesOn(seen) }).toEqual({ season, codes: [ASKS_WARMTH_WEAK] });
    }
  });

  it('S-186 자락 안이면 문 앞이 아니어도 완화된다 — 정하는 것은 문 앞의 자락이 아니라 눈보라다', () => {
    const area = relaxingArea();
    // Given C029 가 놓은 문 앞의 자락 **밖**이면서 눈보라 **안**인 자리
    const doorTraceAreas = bodyTraceAreas(relaxedLockOnDoor());
    expect({ traces: doorTraceAreas.length > 0 }).toEqual({ traces: true });
    const range = rangeHazardOf(DOOR_ROOM).observeRange!;
    const spots = spotsInAreaOp(DOOR_ROOM, area).filter(
      (p) =>
        !doorTraceAreas.some((op) => coveredBy(DOOR_ROOM, op, p)) &&
        distanceBetween(p, depthDoorSpot()) < range.day - 1,
    );
    expect({ spots: spots.length > 0 }).toEqual({ spots: true });
    const at = minBy(spots, (p) => -distanceBetween(p, depthDoorSpot()));
    // Then 문 앞이 아닌데도 그 표식이 완화된 사유를 진다
    const v = inSeason(LONG_NIGHT, DOOR_ROOM, at).observe();
    expect({ at, codes: codesOn(exitOf(v, depthDoor().id)) }).toEqual({
      at,
      codes: [ASKS_WARMTH_WEAK],
    });
    // And 그 자리에서 몸에는 문 앞의 현상이 실리지 않는다 — 두 자락은 따로다 (C029 의 그 자리)
    expect({ at, body: codesOn(bodyOf(inSeason(LONG_NIGHT, DOOR_ROOM, at))) }).toEqual({
      at,
      body: [],
    });
  });

  it('S-187 (경계 ①) 자락을 걸어 나오면 처음 말로 돌아오고, 다시 들면 다시 갈린다 — 오갈 때마다 갈린다', () => {
    const id = depthDoor().id;
    const area = relaxingArea();
    const inside = depthDoorSpot();
    const outside = outsideAreaOp(DOOR_ROOM, area, inside);
    // Given 눈보라 안(문 앞)에 서서 그 문을 읽는다 — 완화된 사유다
    const w = standingIn(DOOR_ROOM, inside, { clock: DAY_CLOCK });
    expect(codesOn(exitOf(w.observe(), id))).toEqual([ASKS_WARMTH_WEAK]);
    // When 걸어서 자락 밖으로 나온다 (철은 흐르지 않는다 — 눈보라는 그치지 않는다)
    walkTo(w, outside);
    expect({ standing: coveredBy(DOOR_ROOM, area, hereOf(w, bodyIdOf(w))) }).toEqual({
      standing: false,
    });
    // Then 처음 말로 돌아온다
    expect(codesOn(exitOf(w.observe(), id))).toEqual([ASKS_WARMTH]);
    // When 다시 자락 안으로 걸어 든다
    walkTo(w, inside);
    // Then 다시 완화된 사유가 선다
    expect(codesOn(exitOf(w.observe(), id))).toEqual([ASKS_WARMTH_WEAK]);
  });

  it('S-188 (경계 ②) 저장되지 않는다 — 되살린 세계도 같은 자리에서 같은 답을 낸다', () => {
    const id = depthDoor().id;
    for (const [at, expected] of [
      [depthDoorSpot(), ASKS_WARMTH_WEAK],
      [enteredSpot(), ASKS_WARMTH],
    ] as const) {
      const w = standingIn(DOOR_ROOM, at, { clock: DAY_CLOCK });
      expect({ at, codes: codesOn(exitOf(w.observe(), id)) }).toEqual({ at, codes: [expected] });
      // When 세계를 저장했다 되살린다
      const again = revive(w);
      // Then 같은 자리에서 같은 답이다
      expect({ at, codes: codesOn(exitOf(again.observe(), id)) }).toEqual({ at, codes: [expected] });
      // And 저장된 것 어디에도 이 Cycle 의 코드가 없다 — 유도된 사실이다
      const stored = JSON.stringify(throughFile(w.world.snapshot()));
      expect({ at, stored: stored.includes(ASKS_WARMTH_WEAK) }).toEqual({ at, stored: false });
    }
  });

  it('S-189 (경계 ③) 자락 안의 둘과 밖의 하나가 같은 문을 각자의 자리대로 읽는다 — 세계의 값은 하나다', () => {
    const id = depthDoor().id;
    const area = relaxingArea();
    const range = rangeHazardOf(DOOR_ROOM).observeRange!;
    // Given 자락 안의 두 자리 (문 앞 하나 · 그 문이 보이는 다른 하나) 와 자락 밖의 한 자리
    const first = depthDoorSpot();
    const others = spotsInAreaOp(DOOR_ROOM, area).filter(
      (p) => distanceBetween(p, first) > 2 && distanceBetween(p, first) < range.day - 1,
    );
    expect({ others: others.length > 0 }).toEqual({ others: true });
    const second = maxBy(others, (p) => distanceBetween(p, first));
    const third = enteredSpot();
    const w = staged(
      DOOR_ROOM,
      [
        { observer: OBSERVER, at: first },
        { observer: OBSERVER_2, at: second },
        { observer: OBSERVER_3, at: third },
      ],
      { clock: DAY_CLOCK },
    );
    // Given 셋이 실제로 자락 안 · 안 · 밖에 선다
    expect({
      a: coveredBy(DOOR_ROOM, area, first),
      b: coveredBy(DOOR_ROOM, area, second),
      c: coveredBy(DOOR_ROOM, area, third),
    }).toEqual({ a: true, b: true, c: false });
    // Then 자락 안의 둘은 완화된 사유를, 밖의 하나는 처음 사유를 읽는다
    const seenBy = (observerId: string) => exitOf(w.observe(observerId), id);
    expect({
      a: codesOn(seenBy(OBSERVER)),
      b: codesOn(seenBy(OBSERVER_2)),
      c: codesOn(seenBy(OBSERVER_3)),
    }).toEqual({
      a: [ASKS_WARMTH_WEAK],
      b: [ASKS_WARMTH_WEAK],
      c: [ASKS_WARMTH],
    });
    // And 세계의 값은 하나다 — 셋이 읽는 문의 열림이 같다
    const states = [OBSERVER, OBSERVER_2, OBSERVER_3].map((o) => seenBy(o)?.state);
    expect({ states, one: new Set(states).size }).toEqual({ states, one: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 완화는 판정하지 않는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 완화는 판정하지 않는다', () => {
  it('S-190 (경계 ①) 문의 열림 · 잠김이 자락 안팎에서 같고, 어느 철에서도 C029 의 답 그대로다', () => {
    const id = depthDoor().id;
    for (const season of SEASONS) {
      const inside = exitOf(inSeason(season, DOOR_ROOM, depthDoorSpot()).observe(), id);
      const outside = exitOf(inSeason(season, DOOR_ROOM, enteredSpot()).observe(), id);
      // Then 자락 안팎에서 같은 값이고, 긴 밤에만 열린다 (C029 S-123 · S-135 의 그 답)
      expect({ season, inside: inside?.state, outside: outside?.state }).toEqual({
        season,
        inside: season === LONG_NIGHT ? 'open' : 'locked',
        outside: season === LONG_NIGHT ? 'open' : 'locked',
      });
    }
  });

  it('S-191 (경계 ①) 건너기의 거절 사유가 한 값 달라지지 않는다 — 완화가 붙은 자리에서도 C029 의 답 그대로다', () => {
    const id = depthDoor().id;
    for (const season of SEASONS) {
      const w = inSeason(season, DOOR_ROOM, depthDoorSpot());
      // Given 그 자리에서 완화된 사유가 서 있다 (Given 이 헛돌지 않는다)
      expect({ season, codes: codesOn(exitOf(w.observe(), id)) }).toEqual({
        season,
        codes: [ASKS_WARMTH_WEAK],
      });
      const expected = season === LONG_NIGHT ? REGION_NOT_BUILT : NOT_THIS_SEASON;
      // Then 지목한 판이 미리 밝히는 사유도 · 실제로 건너려 했을 때의 사유도 그대로다
      expect({ season, told: transitTo(w.observe(), id)?.reason }).toEqual({
        season,
        told: expected,
      });
      expect({ season, reason: reasonOf(cross(w, id)) }).toEqual({ season, reason: expected });
    }
  });

  it('S-192 (경계 ②) 몸에 걸리는 것이 한 값도 달라지지 않는다 — 김은 문 앞의 자락이 정한다', () => {
    const area = relaxingArea();
    const doorTraceAreas = bodyTraceAreas(relaxedLockOnDoor());
    // Given 몸에 김을 거는 문 앞의 자락은 눈보라 자락 **안에 통째로 들어 있다** (spec 기본형 ②)
    for (const op of doorTraceAreas) {
      const spots = spotsInAreaOp(DOOR_ROOM, op);
      expect({ op, spots: spots.length > 0 }).toEqual({ op, spots: true });
      expect({
        op,
        allInside: spots.every((p) => coveredBy(DOOR_ROOM, area, p)),
      }).toEqual({ op, allInside: true });
    }
    // Then 문 앞에 선 몸은 C029 가 세운 그 코드 하나를 그대로 진다 — 어느 철에서도
    for (const season of SEASONS) {
      expect({ season, codes: codesOn(bodyOf(inSeason(season, DOOR_ROOM, depthDoorSpot()))) }).toEqual({
        season,
        codes: [BREATH_GLOWS],
      });
    }
    // And 눈보라 안이라도 문 앞의 자락 밖이면 몸에는 한 글자도 실리지 않는다 —
    //     완화가 몸에 무엇을 걸지 않는다는 것이 여기서 갈린다
    const away = spotsInAreaOp(DOOR_ROOM, area).filter(
      (p) => !doorTraceAreas.some((op) => coveredBy(DOOR_ROOM, op, p)),
    );
    expect({ away: away.length > 0 }).toEqual({ away: true });
    for (const at of [away[0]!, away[Math.floor(away.length / 2)]!, away.at(-1)!]) {
      expect({ at, codes: codesOn(bodyOf(standingIn(DOOR_ROOM, at, { clock: DAY_CLOCK }))) }).toEqual({
        at,
        codes: [],
      });
    }
    // And 자락 밖(들어선 자리)에서도 마찬가지다
    expect(codesOn(bodyOf(standingIn(DOOR_ROOM, enteredSpot(), { clock: DAY_CLOCK })))).toEqual([]);
  });

  it('S-193 (경계 ②) 걸린 것도 · 관찰 범위도 달라지지 않는다 — 데이터가 정한 그대로다', () => {
    // Then 그 자리에 걸린 것은 그 자리를 덮은 상시 위상들이 밝힌 위험 갈래 그대로다 (C006 R4 · C019)
    for (const at of [depthDoorSpot(), enteredSpot()]) {
      const expected = standingHazards(DOOR_ROOM)
        .filter((h) => typeof h.areaId === 'string' && coveredBy(DOOR_ROOM, h.areaId, at))
        .map((h) => String(h.hazard));
      const seen = standingIn(DOOR_ROOM, at, { clock: DAY_CLOCK }).observe().standingConditions;
      expect({ at, seen: [...seen].sort() }).toEqual({ at, seen: [...expected].sort() });
      // And 그 자락의 태그가 데이터에 실제로 서 있다 — 가리킬 뿐 짓지 않았다
      for (const h of standingHazards(DOOR_ROOM)) {
        expect({ areaId: h.areaId, tagged: areaTagOf(DOOR_ROOM, String(h.areaId)).length > 0 }).toEqual({
          areaId: h.areaId,
          tagged: true,
        });
      }
    }
  });

  it('S-194 (경계 ②) 방의 값이 자락 안팎에서 같다 — 실리는 것 · 원천의 phase · 흔적 · hash', () => {
    const inside = standingIn(DOOR_ROOM, depthDoorSpot(), { clock: DAY_CLOCK });
    const outside = standingIn(DOOR_ROOM, enteredSpot(), { clock: DAY_CLOCK });
    // Then 그 방의 원천이 안팎에서 같은 phase 다 (완화는 세계의 값을 건드리지 않는다)
    for (const id of BASELINE[DOOR_ROOM]!.sources) {
      const base = PHASE_BASELINE[id]!;
      for (const [where, w] of [
        ['inside', inside],
        ['outside', outside],
      ] as const) {
        const p = phaseOf(w, DOOR_ROOM, id);
        expect({ where, id, phase: p?.phase, taken: p?.taken }).toEqual({
          where,
          id,
          phase: base.phase,
          taken: base.taken,
        });
      }
    }
    // And 방의 사실(hash · 소란)이 같다
    expect({
      hash: inside.observe().region.hash,
      same: inside.observe().region.hash === outside.observe().region.hash,
    }).toEqual({ hash: descriptionHash(spaceOf(DOOR_ROOM)), same: true });
    // And 흔적은 자리가 정한다 — 안팎의 단계가 데이터가 말하는 그대로다
    for (const at of [depthDoorSpot(), enteredSpot()]) {
      expect({ at, level: traceAt(DOOR_ROOM, at) }).toEqual({ at, level: traceAt(DOOR_ROOM, at) });
    }
    expect({
      floor: floorTraceOf(DOOR_ROOM),
      peak: peakTraceOf(DOOR_ROOM),
    }).toEqual({
      floor: BASELINE[DOOR_ROOM]!.floorTrace,
      peak: BASELINE[DOOR_ROOM]!.peakTrace,
    });
    // And 그 방의 문 둘이 안팎 어디서 읽어도 같은 차례로 서고 같은 열림을 낸다.
    //     **실리는 것 전체를 견주지 않는다** — 무엇이 실리는가는 관찰 범위(C015 · C019)가
    //     자르는 것이고 그것은 자리에 따라 갈리는 것이 이미 옳다. 완화가 건드리지 않았음을
    //     재는 자리는 "같은 것을 볼 때 같은 값인가" 다 (판정 방식은 이 시나리오가 정했다)
    const doorsOf = (w: WorldDriver) =>
      exitsIn(w.observe()).map((e) => `${e.id}/${e.state}`);
    expect({ inside: doorsOf(inside), outside: doorsOf(outside) }).toEqual({
      inside: doorsOf(outside),
      outside: doorsOf(outside),
    });
    expect({ doors: doorsOf(inside).length }).toEqual({ doors: BASELINE[DOOR_ROOM]!.exits.length });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — 앞의 세계는 그대로다 (SPEC-007)
//
// 이 Cycle 은 Description 을 한 op 도 건드리지 않고 저장되는 State 를 하나도 늘리지 않는다.
// 그래서 방 열셋의 hash 를 모두 견준다 (c030 이 「거목 내부 세계」 를 비켜 둔 자리까지).
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('S-195 방 열셋의 hash 가 한 값도 달라지지 않는다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({ region, hash: descriptionHash(spaceOf(region)) }).toEqual({
        region,
        hash: base.hash,
      });
    }
  });

  it('S-196 방마다 표면 · 통행 · 출구의 차례가 그대로다', () => {
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

  it('S-197 방마다의 원천 이름과 차례가 그대로고, 그 phase 는 어느 철에도 같다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      const ids = (regionSpec(region)?.resourceEcology?.sources ?? []).map((s) => s.id);
      expect({ region, ids }).toEqual({ region, ids: [...base.sources] });
    }
    for (const season of SEASONS) {
      const w = inSeason(season, WHITE_KING_DOMAIN);
      for (const [region, base] of Object.entries(BASELINE)) {
        for (const id of base.sources) {
          const p = phaseOf(w, region, id);
          const expected = PHASE_BASELINE[id]!;
          expect({ season, region, id, phase: p?.phase, taken: p?.taken }).toEqual({
            season,
            region,
            id,
            phase: expected.phase,
            taken: expected.taken,
          });
        }
      }
    }
  });

  it('S-198 방마다 흔적의 바닥과 가장 짙은 자리가 그대로다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({ region, floor: floorTraceOf(region), peak: peakTraceOf(region) }).toEqual({
        region,
        floor: base.floorTrace,
        peak: base.peakTrace,
      });
    }
  });

  it('S-199 방마다 실리는 것의 차례가 그대로고, 이 Cycle 의 코드는 협곡 밖 어디에도 실리지 않는다', () => {
    for (const [region, lines] of Object.entries(ENTITY_BASELINE)) {
      expect({ region, lines: entityLines(standingIn(region).observe()) }).toEqual({
        region,
        lines: [...lines],
      });
    }
    // And 완화된 사유는 그 문이 선 방 말고는 어디에도 실리지 않는다
    for (const region of Object.keys(ENTITY_BASELINE).filter((r) => r !== DOOR_ROOM)) {
      const text = JSON.stringify(standingIn(region).observe());
      expect({ region, projected: text.includes(ASKS_WARMTH_WEAK) }).toEqual({
        region,
        projected: false,
      });
    }
  });

  it('S-200 C019 가 세운 협곡의 상시 위상(관찰 범위까지)이 그대로다', () => {
    for (const [region, standing] of Object.entries(CANYON_STANDING_BASELINE)) {
      const phases = (regionSpec(region) as unknown as { phases?: { standing?: unknown } } | undefined)
        ?.phases?.standing;
      expect({ region, standing: phases }).toEqual({ region, standing });
    }
  });

  it('S-201 문 셋의 열림이 철마다 그대로다 — 완화는 어느 문의 열림도 건드리지 않는다', () => {
    const forestDoor = REGION_GRAPH.connectors.find((c) => c.id === WALKING_FOREST_DOOR)!;
    const seasonal: { id: string; region: string }[] = [
      { id: depthDoor().id, region: DOOR_ROOM },
      { id: forestDoor.id, region: forestDoor.from.region },
    ];
    for (const door of seasonal) {
      for (const season of SEASONS) {
        const v = inSeason(season, door.region, connectorSpot(door.id, door.region)).observe();
        expect({ id: door.id, season, state: exitOf(v, door.id)?.state }).toEqual({
          id: door.id,
          season,
          state: season === LONG_NIGHT ? 'open' : 'locked',
        });
      }
    }
    // And 미로의 심장 문은 배열이 정한다 — 철은 그 답을 바꾸지 않는다 (C029 S-121 의 그 답)
    for (const season of SEASONS) {
      const v = inSeason(season, FANTASY_MAZE, connectorSpot(MAZE_HEART_GATE, FANTASY_MAZE), {
        regionPatterns: { [FANTASY_MAZE]: 'P2' },
      } as WorldSetup).observe();
      expect({ season, state: exitOf(v, MAZE_HEART_GATE)?.state }).toEqual({ season, state: 'open' });
    }
  });

  it('S-202 걸어 다녀도 앞의 방에서는 아무것도 늘지 않는다 — 완화는 협곡의 것뿐이다', () => {
    // Given 완화를 밝힌 Lock 을 가진 방은 이 세계에 하나뿐이다
    expect([...new Set(relaxedLocks().map((x) => x.region))]).toEqual([DOOR_ROOM]);
    // Then 다른 방을 한동안 걸어도 표식에도 몸에도 한 글자도 늘지 않는다
    const w = standingIn(FOREST_DEEP);
    const spots = walkableSpots(FOREST_DEEP);
    walkTo(w, spots[Math.floor(spots.length / 3)]!);
    tickFor(w, 5);
    const v = w.observe();
    expect(codesOn(bodyOf(w))).toEqual([]);
    for (const exit of exitsIn(v)) {
      expect({ id: exit.id, conditions: exit.conditions }).toEqual({
        id: exit.id,
        conditions: undefined,
      });
    }
  });
});
