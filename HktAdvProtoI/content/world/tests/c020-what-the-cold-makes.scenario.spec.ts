// C020 — 추위가 만든 것 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010)
//
// C019 는 고개 너머에 방 둘을 세우고 "위험이 다르다" 까지 갔다. 이 Cycle 이 그 위험을 만든
// 그것을 **보상으로** 세운다. 그래서 재는 것은 여섯이다:
//   ① 계통 — Seed 하나에 자연 형태 넷 · 붙잡는 것 넷(대기가 처음 선다) · 맡은 자리 넷
//   ② 흔적 — 흙의 사다리가 아니라 숨이 어는 정도. 두 어휘가 한 자리에서 섞이지 않는다
//   ③ 캐기와 되돌아옴 — 옆 면으로 옮겨 서고, 깨진 면이 위험으로 남고, 철이 속도를 바꾼다
//   ④ 그 철에만 서는 것 — 사유 코드가 바닥남 · 되돌아오는 중과 갈린다
//   ⑤ 요구 — 문의 표식에 실리되 **표시일 뿐**이다 (잠그지도 열지도 않는다)
//   ⑥ 불변 — 앞의 세계도 C019 가 세운 협곡의 땅·자락도 한 값도 달라지지 않는다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/regions/ice-canyon.ts · frost-canyon.ts · resource-ecology.ts 의
// 새 줄 · semantic/resource.ts · simulation/source-recovery.ts 의 새 함수 · content/view/**)은
// **읽지 않았다.** 기대값의 출처는 cycles/C020-what-the-cold-makes/spec.md 와 이미 있던
// 하네스·선례(c011~c016 · c019)뿐이다.
//
// **자리도 형태 코드도 손으로 적지 않는다** — 원천의 자리는 resource point 와 presence 곡선에서,
// 마디의 자락은 traceOps · depletedHazards 가 가리키는 op 에서, 자연 형태의 코드는 form 에서
// 읽는다. 손으로 적는 것은 spec 이 이름으로 못 박은 것(방 둘 · 원천 넷의 id · Seed · 세계 원인 ·
// 요구를 받는 방 이름)과 spec 「데이터 값」 표의 수(3·2·2·1 · 360·180·120·720 · 마디 넷 ·
// 바닥 1·2 · 두 배)뿐이고, 그것들은 세계에서 유도할 자리가 없다 (c015 · c019 의 규율 그대로).
//
// **회귀의 기준값은 이 Cycle 이 시작하기 전의 세계에서 떠 왔다** — SPEC-010 이 "한 값도 달라지지
// 않는다" 를 말하려면 견줄 값이 있어야 하고, 그것을 계산으로 다시 얻으면 함께 흔들린다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { describe, expect, it } from 'vitest';
import {
  areasOf,
  curvesOf,
  descriptionHash,
  pointsOf,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { exitsOf } from '../../../engine/world-authoring/graph';
import { areaCoversPoint, isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import {
  ANCHOR_LAYER,
  BIO_ORE_FIELD,
  COMPILE_RULES,
  EXPLORER_RUIN,
  FOREST_DEEP,
  FOREST_EDGE,
  FRONTIER_REGIONS,
  HAZARD_LAYER,
  HEART_LAKE,
  ICE_CANYON,
  FROST_CANYON,
  LOCKS,
  PREDATOR_NEST,
  PRESENCE_LAYER,
  RED_EYE_TREE,
  REGION_GRAPH,
  REGION_SPECS,
  RESOURCE_LAYER,
  TRACE_LAYER,
  WHITE_KING_DOMAIN,
  regionSpec,
  soilStainLevel,
  type ResourceSourceSpec,
  type SeasonId,
} from '../../regions';
// 이 Cycle 이 **처음 내는** 데이터 문(門). 이름 하나를 못 찾아 파일 전체가 서지 못하는 일을
// 막으려고 이름 공간으로 읽는다 (그 하나가 없으면 그 항만 붉어진다).
import * as REGIONS from '../../regions';
// C008 이 세운 미로의 이름 — 그 파일이 소유한다 (c008 ~ c019 시나리오의 선례 그대로).
import { FANTASY_MAZE } from '../../regions/fantasy-maze';
import { MAZE_HEART } from '../../regions/maze-heart';
// 이 세계가 이미 가진 어휘 — 붙잡는 것과 맡은 자리 (SPEC-001 경계 ② 가 이 목록을 가리킨다).
import { WORLD_CONTRACTS } from '../../authoring/contracts';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, type WorldSetup } from '../index';
import { INTERACTION_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { isCollapsedAt, sourceStateOf, traceStrengthAt } from '../semantic/resource';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';

// ── spec 이 이름으로 못 박은 것들 (World Change · State 의 데이터 값 표) ──

/** C019 가 세운 방 둘 — 이 Cycle 이 원천을 낳는 방으로 만든다 */
const CANYON_OUTER = ICE_CANYON;
const CANYON_INNER = FROST_CANYON;
const CANYONS: readonly string[] = [CANYON_OUTER, CANYON_INNER];

/** 빙정석 계통 (Region §5.1 이름 표 · 확정 2) */
const FROST_CRYSTAL = 'FROST_CRYSTAL';
const CRYSTAL_GROWTH = 'CRYSTAL_GROWTH';

/** 원천 넷의 id (spec State 의 데이터 값 표) */
const PASS_RIME = 'PASS_RIME';
const CLIFF_FROST_VEIN = 'CLIFF_FROST_VEIN';
const SNOW_DRIFT_DUST = 'SNOW_DRIFT_DUST';
const FROZEN_REMAINS = 'FROZEN_REMAINS';

/** 요구가 가리키는 아직 짓지 않은 방 (Region §5.1 이름 표 · Play §5.3) */
const FROST_DEPTH = 'FROST_DEPTH';

/**
 * 원천 넷 — 방 · 붙잡는 것 · 맡은 자리 · 캘 횟수 · 되돌아오는 데 걸리는 세계 초.
 * 전부 spec State 의 데이터 값 표가 못 박은 값이다 (자연 형태의 **코드**는 기본형 ⑦ 가
 * "지어 두었다" 고 하므로 여기 적지 않고 데이터에서 읽는다).
 */
const FOUR = [
  {
    id: PASS_RIME,
    region: CANYON_OUTER,
    carrier: 'phenomenon',
    role: 'baseline',
    harvests: 3,
    recovery: 360,
  },
  {
    id: CLIFF_FROST_VEIN,
    region: CANYON_INNER,
    carrier: 'terrain',
    role: 'risk',
    harvests: 2,
    recovery: 180,
  },
  {
    id: SNOW_DRIFT_DUST,
    region: CANYON_INNER,
    carrier: 'atmosphere',
    role: 'conditional',
    harvests: 2,
    recovery: 120,
  },
  {
    id: FROZEN_REMAINS,
    region: CANYON_INNER,
    carrier: 'residue',
    role: 'by-product',
    harvests: 1,
    // 720 — spec 「데이터 값」 표는 240 을 적었으나 그 값은 SPEC-008 본문("되돌아옴은
    // 세계에서 가장 느리다")과 어긋난다: 같은 표의 고개의 서리가 360 이다. 둘 다 Design 이
    // 아니라 기본형이고 어긋난 쪽은 수이므로, 통합에서 하루(360)의 두 배로 세워 본문의 뜻을
    // 세계가 실제로 지키게 했다 (마감 커밋과 TODO 가 그 경위를 진다).
    recovery: 720,
  },
] as const;
type One = (typeof FOUR)[number];
const oneOf = (id: string): One => {
  const found = FOUR.find((f) => f.id === id);
  if (!found) throw new Error(`이 Cycle 의 원천이 아니다 — ${id}`);
  return found;
};

/**
 * 붙잡는 것의 어휘 여덟 — Material §6.2 가 이미 이름해 둔 칸들이다 (SPEC-001 경계 ②).
 * 이 Cycle 은 그 가운데 **대기** 하나를 처음 채우고 어휘를 새로 짓지 않는다.
 */
const CARRIER_VOCABULARY: readonly string[] = [
  'creature',
  'plant',
  'fungus',
  'terrain',
  'water',
  'atmosphere',
  'phenomenon',
  'residue',
];

/** 협곡 두 방의 바닥 흔적 단계 (spec 데이터 값 표 · 기본형 ②) */
const FLOOR_OUTER = 1;
const FLOOR_INNER = 2;
/** 원천 둘레는 방 바닥보다 **한 단계** 짙다 (기본형 ②) */
const RING_STEP = 1;

/** 결정면의 마디 수 (spec 데이터 값 표 · 기본형 ③) */
const VEIN_SITES = 4;
/** 긴 밤의 되돌아옴 배속 (확정 7 · World Change 6) */
const LONG_NIGHT_SPEED = 2;

/** 이 Cycle 이 거는 위험 갈래 하나와 접촉 코드 하나 (C019 가 이름한 그것 그대로) */
const HAZARD_MATTER = 'hazard/matter';
const CONTACT_CRYSTALLIZING = 'crystallizing';

/** phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';
const RECOVERING = 'recovering';

/** 사유 코드 — 그대로 쓰는 것들 (C012 · C013 · C016 · C002) */
const SOURCE_DEPLETED = 'source-depleted';
const SOURCE_RECOVERING = 'source-recovering';
const NOT_THIS_SEASON = 'not-this-season';
const REGION_NOT_BUILT = 'region-not-built';
const OUT_OF_RANGE = 'out-of-range';

/** 철 넷 (C015 · C016 그대로) */
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
const SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT, TURN];

/** 되돌아옴이 눈에 보이기 시작하는 지점 — C013 이 0.5 로 못 박았다 */
const RECOVERY_VISIBLE_FRACTION = 0.5;
/** 채취의 소요 시간 — 행동표가 소유한다. "넉넉히 지난다" 로만 쓴다 (C011~C019 어법) */
const MINE_SECONDS = 1.2;

const solo: WorldSetup = { npcs: [] };

// ─────────────────────────────────────────────────────────────────────
// 회귀의 기준값 (SPEC-001 경계 ① · SPEC-002 경계 ① · SPEC-010)
//
// 이 Cycle 이 시작하기 전의 세계에서 떠 온 값이다. 계산으로 다시 얻지 않는다 —
// 그러면 데이터가 흔들릴 때 기준도 함께 흔들려 아무것도 재지 못한다.
// ─────────────────────────────────────────────────────────────────────

/** 숲의 원천 열 — 이 Cycle 전의 데이터 그대로 (SPEC-001 경계 ①) */
const FOREST_SOURCE_BASELINE: Readonly<Record<string, unknown>> = {
  MOLT_LITTER: {
    region: FOREST_EDGE,
    materialId: 'ORE_EATER_MOLT',
    worldCause: 'FOREST_CHAIN',
    form: 'molt-litter',
    carrier: 'residue',
    opportunity: 'baseline',
    supply: 'baseline-renewable',
    recoveryCause: 'molt-cycle',
    harvests: 3,
    recoverySeconds: 60,
  },
  SEEP_CRUST: {
    region: FOREST_EDGE,
    materialId: 'BIO_ORE',
    worldCause: 'FOREST_CHAIN',
    form: 'seep-crust',
    carrier: 'terrain',
    opportunity: 'conditional',
    supply: 'conditional-renewable',
    recoveryCause: 'tree-uptake',
    harvests: 3,
    recoverySeconds: 60,
  },
  FALLEN_SCALE: {
    region: FOREST_EDGE,
    materialId: 'WHALE_SCALE',
    worldCause: 'SKY_PASSAGE',
    form: 'fallen-scale',
    carrier: 'phenomenon',
    opportunity: 'world-event',
    supply: 'event-scarce',
    recoveryCause: 'whale-passage',
    harvests: 1,
    recoverySeconds: 240,
  },
  PREY_REMAINS: {
    region: FOREST_EDGE,
    materialId: 'ORE_EATER_MOLT',
    worldCause: 'FOREST_CHAIN',
    form: 'prey-remains',
    carrier: 'residue',
    opportunity: 'by-product',
    supply: 'event-scarce',
    recoveryCause: 'hunter-passage',
    harvests: 1,
    recoverySeconds: 240,
  },
  RIVER_SILT: {
    region: FOREST_DEEP,
    materialId: 'BIO_ORE',
    worldCause: 'FOREST_CHAIN',
    form: 'river-grain',
    carrier: 'water',
    opportunity: 'conditional',
    supply: 'event-scarce',
    recoveryCause: 'flow-arrival',
    harvests: 2,
    recoverySeconds: 30,
  },
  RUIN_SPOIL: {
    region: EXPLORER_RUIN,
    materialId: 'ORE_EATER_MOLT',
    worldCause: 'FOREST_CHAIN',
    form: 'spoil-pile',
    carrier: 'residue',
    opportunity: 'baseline',
    supply: 'baseline-renewable',
    recoveryCause: 'pile-erosion',
    harvests: 2,
    recoverySeconds: 90,
  },
  NEST_FUNGUS: {
    region: PREDATOR_NEST,
    materialId: 'GIANT_TREE_FUNGUS',
    worldCause: 'FOREST_CHAIN',
    form: 'nest-mycelium',
    carrier: 'fungus',
    opportunity: 'by-product',
    supply: 'conditional-renewable',
    recoveryCause: 'carcass-decay',
    harvests: 1,
    recoverySeconds: 120,
  },
  ORE_OUTCROP: {
    region: BIO_ORE_FIELD,
    materialId: 'BIO_ORE',
    worldCause: 'FOREST_CHAIN',
    form: 'outcrop',
    carrier: 'terrain',
    opportunity: 'risk',
    supply: 'migratory',
    recoveryCause: 'tree-uptake',
    harvests: 3,
    recoverySeconds: 180,
  },
  ROOT_NODULE: {
    region: RED_EYE_TREE,
    materialId: 'BIO_ORE',
    worldCause: 'FOREST_CHAIN',
    form: 'root-nodule',
    carrier: 'plant',
    opportunity: 'risk',
    supply: 'conditional-renewable',
    recoveryCause: 'tree-uptake',
    harvests: 1,
    recoverySeconds: 180,
  },
  LAKE_SILT_BED: {
    region: HEART_LAKE,
    materialId: 'BIO_ORE',
    worldCause: 'FOREST_CHAIN',
    form: 'silt-bed',
    carrier: 'water',
    opportunity: 'risk',
    supply: 'baseline-renewable',
    recoveryCause: 'lake-settling',
    harvests: 2,
    recoverySeconds: 180,
  },
};

interface RoomBaseline {
  depth: string;
  hash: string;
  exits: readonly string[];
  entities: readonly string[];
  surface: Readonly<Record<string, number>>;
  traversable: number;
  /** 흔적 사다리 — 방 바닥과 가장 짙은 자리 (아무것도 캐지 않은 세계에서) */
  floorTrace: number;
  peakTrace: number;
  /** trace layer 의 태그마다 흙 사다리의 단계 (차례 그대로) */
  traceTags: readonly string[];
}

/** 앞의 세계 — 백왕령 · 숲 넷 · 미로 둘 (SPEC-010) */
const BASELINE: Readonly<Record<string, RoomBaseline>> = {
  [WHITE_KING_DOMAIN]: {
    depth: 'civil',
    hash: '1c57fb5f',
    exits: ['FOREST_PATH', 'RED_WASTE_PASS', 'ICE_CANYON_PASS'],
    entities: [
      'player-1/player-character',
      'FOREST_PATH/region-exit',
      'RED_WASTE_PASS/region-exit',
      'ICE_CANYON_PASS/region-exit',
    ],
    surface: { flat: 1022, wet: 497, slope: 95, steep: 67 },
    traversable: 1337,
    floorTrace: 0,
    peakTrace: 0,
    traceTags: [],
  },
  [FOREST_EDGE]: {
    depth: 'outer',
    hash: '30563ef4',
    exits: ['FOREST_PATH', 'RUIN_TRAIL', 'DEEP_TRAIL'],
    entities: [
      'player-1/player-character',
      'MOLT_LITTER/resource-source',
      'FALLEN_SCALE/resource-source',
      'PREY_REMAINS/resource-source',
      'FOREST_PATH/region-exit',
      'RUIN_TRAIL/region-exit',
      'DEEP_TRAIL/region-exit',
    ],
    surface: { flat: 1386, slope: 127, steep: 168 },
    traversable: 1513,
    floorTrace: 1,
    peakTrace: 2,
    traceTags: [
      'soil-stain:1=1',
      'soil-stain:2=2',
      'soil-stain:2=2',
      'soil-stain:2=2',
      'soil-stain:2=2',
      'soil-stain:2=2',
      'soil-stain:2=2',
      'soil-stain:2=2',
      'soil-stain:2=2',
      'soil-stain:2=2',
    ],
  },
  [FOREST_DEEP]: {
    depth: 'wild',
    hash: '4dbb88ee',
    exits: ['DEEP_TRAIL', 'NEST_TRAIL', 'ORE_TRAIL', 'TREE_APPROACH', 'ANCIENT_GATE', 'WALKING_FOREST_DOOR'],
    entities: [
      'player-1/player-character',
      'RIVER_SILT/resource-source',
      'DEEP_TRAIL/region-exit',
      'NEST_TRAIL/region-exit',
      'ORE_TRAIL/region-exit',
      'TREE_APPROACH/region-exit',
      'ANCIENT_GATE/region-exit',
      'WALKING_FOREST_DOOR/region-exit',
    ],
    surface: { flat: 1681 },
    traversable: 1681,
    floorTrace: 2,
    peakTrace: 3,
    traceTags: ['soil-stain:2=2', 'soil-stain:3=3', 'soil-stain:3=3', 'soil-stain:3=3', 'soil-stain:3=3'],
  },
  [BIO_ORE_FIELD]: {
    depth: 'wild',
    hash: '9c50bd1e',
    exits: ['ORE_TRAIL', 'ORE_TREE_TRAIL'],
    entities: [
      'player-1/player-character',
      'ORE_OUTCROP/resource-source',
      'ORE_TRAIL/region-exit',
      'ORE_TREE_TRAIL/region-exit',
    ],
    surface: { flat: 1681 },
    traversable: 1681,
    floorTrace: 3,
    peakTrace: 4,
    traceTags: ['soil-stain:3=3', 'soil-stain:4=4', 'soil-stain:4=4', 'soil-stain:4=4', 'soil-stain:4=4'],
  },
  [PREDATOR_NEST]: {
    depth: 'wild',
    hash: '7b0e444e',
    exits: ['NEST_TRAIL'],
    entities: ['player-1/player-character', 'NEST_FUNGUS/resource-source', 'NEST_TRAIL/region-exit'],
    surface: { flat: 1681 },
    traversable: 1681,
    floorTrace: 2,
    peakTrace: 4,
    traceTags: ['soil-stain:2=2', 'soil-stain:4=4'],
  },
  [FANTASY_MAZE]: {
    depth: 'deep',
    hash: '53ca6a70',
    exits: ['MAZE_GATE_RETURN', 'MAZE_HEART_GATE'],
    entities: [
      'player-1/player-character',
      'MAZE_GATE_RETURN/region-exit',
      'MAZE_HEART_GATE/region-exit',
    ],
    surface: { flat: 6561 },
    traversable: 6561,
    floorTrace: 0,
    peakTrace: 0,
    traceTags: [],
  },
  [MAZE_HEART]: {
    depth: 'deep',
    hash: 'b9b77a14',
    exits: ['MAZE_HEART_GATE', 'INVERTED_GARDEN_DOOR'],
    entities: [
      'player-1/player-character',
      'MAZE_HEART_GATE/region-exit',
      'INVERTED_GARDEN_DOOR/region-exit',
    ],
    surface: { flat: 1681 },
    traversable: 1681,
    floorTrace: 0,
    peakTrace: 0,
    traceTags: [],
  },
};

/** C019 가 세운 협곡의 **땅** — 이 Cycle 은 표면도 통행도 건드리지 않는다 (SPEC-010) */
const CANYON_TERRAIN_BASELINE: Readonly<
  Record<string, { surface: Readonly<Record<string, number>>; traversable: number }>
> = {
  [CANYON_OUTER]: { surface: { steep: 810, slope: 164, frost: 697, flat: 10 }, traversable: 871 },
  [CANYON_INNER]: { surface: { steep: 902, slope: 72, frost: 697, flat: 10 }, traversable: 779 },
};

/** C019 가 세운 상시 위상 — 눈보라 · 절벽 · 결정면 자락 (SPEC-010) */
const CANYON_STANDING_BASELINE: Readonly<Record<string, unknown>> = {
  [CANYON_OUTER]: {
    hazardExtend: [
      { areaId: 'hazard-ice-cliff-west', hazard: 'hazard/terrain' },
      { areaId: 'hazard-ice-cliff-east', hazard: 'hazard/terrain' },
    ],
  },
  [CANYON_INNER]: {
    hazardExtend: [
      { areaId: 'hazard-blizzard', hazard: 'hazard/climate', observeRange: { day: 20, night: 10 } },
      { areaId: 'hazard-crystal-face', hazard: 'hazard/matter', contact: 'crystallizing' },
      { areaId: 'hazard-ice-cliff-west', hazard: 'hazard/terrain' },
      { areaId: 'hazard-ice-cliff-east', hazard: 'hazard/terrain' },
    ],
  },
};

/** 이 Cycle 전의 경계 이름 셋 — FROST_DEPTH 가 뒤에 이어 붙어 넷이 된다 (World Change 8) */
const FRONTIERS_BEFORE: readonly string[] = ['RED_WASTE', 'INVERTED_GARDEN', 'WALKING_FOREST'];

// ── 하네스 (c011 ~ c016 · c019 의 선례 그대로) ──────────────────────

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

/** 표면 태그마다 vertex 수 — "땅이 한 값도 달라지지 않았는가" 를 재는 자리 (c019 의 어법) */
function surfaceCounts(region: string): Record<string, number> {
  const t = terrainOf(region);
  const out: Record<string, number> = {};
  for (let i = 0; i < t.surface.length; i++) {
    const tag = t.surfaceTags[t.surface[i]!] ?? '?';
    out[tag] = (out[tag] ?? 0) + 1;
  }
  return out;
}

const anchorAt = (region: string, tag: string): XZ => {
  const found = pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag);
  if (!found) throw new Error(`${region} 에 anchor '${tag}' 가 없다`);
  return found.position;
};

// ── 데이터를 읽는 자리 (계통 · 마디 · 자락) ─────────────────────────

/** 그 원천의 성질 — 그 방 resourceEcology 가 소유한다 (c013 · c014 의 ecologyOf 그대로) */
function ecologyOf(region: string, id: string): ResourceSourceSpec {
  const found = regionSpec(region)?.resourceEcology?.sources.find((s) => s.id === id);
  if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다 (${region})`);
  return found;
}
const specOf = (id: string): ResourceSourceSpec => ecologyOf(oneOf(id).region, id);
const harvestsOf = (id: string): number => specOf(id).harvests;
function recoveryOf(id: string): number {
  const seconds = specOf(id).recoverySeconds;
  if (!(typeof seconds === 'number' && seconds > 0)) {
    throw new Error(`원천 '${id}' 에 recoverySeconds 가 없다`);
  }
  return seconds;
}
const visibleAt = (id: string): number => recoveryOf(id) * RECOVERY_VISIBLE_FRACTION;

/** 철마다의 되돌아옴 배속 — 이 Cycle 이 더한 데이터 자리 (밝히지 않으면 없다) */
const recoverySpeedOf = (id: string): Record<string, number> | undefined =>
  (specOf(id) as unknown as { recoverySpeed?: Record<string, number> }).recoverySpeed;

/** 마디마다의 위험 자락 — op id 만 밝히든 자락 통째로 밝히든 areaId 로 읽는다 */
function depletedHazardAreasOf(id: string): string[] {
  const raw = (specOf(id) as unknown as { depletedHazards?: readonly unknown[] }).depletedHazards;
  if (!raw || raw.length === 0) throw new Error(`원천 '${id}' 가 고갈된 마디의 위험 자락을 밝히지 않는다`);
  return raw.map((entry) =>
    typeof entry === 'string' ? entry : String((entry as { areaId?: string }).areaId),
  );
}

/** C011 이 놓은 자리 — resource layer point 하나 */
const pointOf = (region: string, id: string): XZ => {
  const found = pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id);
  if (!found) throw new Error(`${region} 의 resource layer 에 '${id}' 자리가 없다`);
  return found.position;
};

/** 그 원천의 마디 목록 — 밝힌 원천은 presence 곡선의 points, 아니면 resource point 하나 (C013 R4) */
function sitesOf(id: string): XZ[] {
  const one = oneOf(id);
  const tag = specOf(id).siteCurve;
  if (!tag) return [pointOf(one.region, id)];
  const curve = curvesOf(spaceOf(one.region), PRESENCE_LAYER, tag)[0];
  if (!curve) throw new Error(`원천 '${id}' 의 마디 곡선(presence · ${tag})이 데이터에 없다`);
  return curve.points.map((p) => ({ x: p.x, z: p.z }));
}

/** 그 방의 area op 의 태그 (c016 · c019 의 areaTagOf 그대로) */
function areaTagOf(region: string, areaId: string): string {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return op.tag;
}

/**
 * **그 area op 하나**가 덮은, 걸어 설 수 있는 자리들.
 *
 * 태그로 고르면 안 된다 — 마디마다의 깨진 자락은 넷이 **같은 태그**를 달고 있어서,
 * 태그로 고르면 깨지지 않은 마디의 자리가 뽑힌다 (그러면 "깨진 자리에 코드가 선다" 가
 * 헛돈다). 어느 자락인지는 op id 로만 갈리므로 Description 의 그 op 모양을 직접 묻는다 —
 * semantic/region-phase.ts 가 덧씌움을 op id 로 훑는 그 이유와 같다.
 */
function spotsInAreaOp(region: string, areaId: string): XZ[] {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return walkableSpots(region).filter((p) => areaCoversPoint(op.shape, p.x, p.z));
}

/** 그 자락(태그)이 걸린, 걸어 설 수 있는 자리들 — 모양을 묻지 않고 컴파일된 격자로 고른다 */
function spotsWithHazardTag(region: string, tag: string): XZ[] {
  const t = terrainOf(region);
  return walkableSpots(region).filter((p) => tagsAt(t, p.x, p.z, HAZARD_LAYER).includes(tag));
}

/** C019 가 세운 상시 위상의 자락들 — 데이터에서 읽는다 */
type HazardOverlayShape = { areaId: string; hazard: string; contact?: string };
const standingHazards = (region: string): readonly HazardOverlayShape[] =>
  ((regionSpec(region)?.phases as { standing?: { hazardExtend?: readonly HazardOverlayShape[] } } | undefined)
    ?.standing?.hazardExtend ?? []) as readonly HazardOverlayShape[];

/** 그 자리에 **C019 가 이미 걸어 둔** 코드들 — 이 Cycle 이 더한 것을 견주는 바탕이다 */
function standingCodesAt(region: string, at: XZ): string[] {
  const t = terrainOf(region);
  const tags = tagsAt(t, at.x, at.z, HAZARD_LAYER);
  const out: string[] = [];
  for (const overlay of standingHazards(region)) {
    if (!tags.includes(areaTagOf(region, overlay.areaId))) continue;
    out.push(overlay.hazard);
    if (overlay.contact) out.push(overlay.contact);
  }
  return [...new Set(out)].sort();
}

/**
 * 그 마디의 깨진 자락 안에 설 자리 하나.
 *
 * **C019 의 상시 자락이 덮지 않은 자리를 먼저 고른다** — 그래야 "캐기 전에는 아무것도 걸지
 * 않는다"(경계 ①)와 "캐면 는다"(본항)가 둘 다 헛돌지 않는다. 그런 자리가 없으면
 * 덮인 자리를 쓰되, 견주는 바탕은 standingCodesAt 이 데이터에서 낸다.
 */
function brokenSpot(id: string, site: number): XZ {
  const region = oneOf(id).region;
  const covered = spotsInAreaOp(region, depletedHazardAreasOf(id)[site]!);
  if (covered.length === 0) throw new Error(`마디 ${site} 의 깨진 자락 안에 설 자리가 없다 (${id})`);
  const clean = covered.filter((p) => standingCodesAt(region, p).length === 0);
  return (clean.length > 0 ? clean : covered)[Math.floor((clean.length > 0 ? clean : covered).length / 2)]!;
}

// ── 세계를 세우고 굴리는 자리 ────────────────────────────────────────

const standingIn = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
  });
/** 그 철에서 시작하는 세계 (C015 가 세운 clock 손잡이 · c016 의 inSeason 그대로) */
const inSeason = (season: SeasonId, region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  standingIn(region, at, { ...extra, clock: season });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};
/** 되돌아옴을 기다린다 — 한 걸음 1 세계 초로 나눠 굴린다 (c013 의 wait 그대로) */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}

const move = (w: WorldDriver, at: XZ, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } }, observerId);
/** 걸어서 그 자리에 선다 (c017 · c019 의 walkTo 그대로) */
function walkTo(w: WorldDriver, at: XZ, budgetSeconds = 240) {
  const body = w.observe().observer.characterId;
  const hereOf = (): XZ => {
    const a = state(w).actors.find((x) => x.id === body)!;
    return { x: a.position.x, z: a.position.z };
  };
  if (distanceBetween(hereOf(), at) <= 0.05) return;
  expect(move(w, at).status).toBe('success');
  const steps = Math.ceil(budgetSeconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    w.tick(TICK_INTERVAL);
    if (distanceBetween(hereOf(), at) <= 0.05) return;
  }
  throw new Error(`걸어서 (${at.x}, ${at.z}) 에 닿지 못했다 — 지금 ${JSON.stringify(hereOf())}`);
}
const mine = (w: WorldDriver, targetEntityId: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId }, observerId);
const cross = (w: WorldDriver, connector: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector }, observerId);
const reasonOf = (result: ActionResult): string | undefined =>
  'reason' in result ? (result.reason as string) : undefined;

function mineOnce(w: WorldDriver, id: string, observerId = OBSERVER): ActionResult {
  const result = mine(w, id, observerId);
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

const sourcesIn = (v: GameViewSnapshot): EntityView[] =>
  v.entities.filter((e) => e.role === 'resource-source');
const sourceEntity = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  sourcesIn(v).find((e) => e.id === id);
const exitsIn = (v: GameViewSnapshot): EntityView[] => v.entities.filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  exitsIn(v).find((e) => e.id === id);
const mineOn = (v: GameViewSnapshot, targetEntityId: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'mine' && i.targetEntityId === targetEntityId);
const entityLines = (v: GameViewSnapshot): string[] => v.entities.map((e) => `${e.id}/${e.role}`);
const conditionsSeen = (w: WorldDriver, observerId = OBSERVER): string[] =>
  w.observe(observerId).standingConditions;
const heldOf = (v: GameViewSnapshot, material: string): number | boolean | string | undefined =>
  v.hud.find((h) => h.id === `inventory.${material}`)?.value;

interface SourceStateShape {
  phase: string;
  taken: number;
  progress?: number;
  siteIndex?: number;
  collapsedSites?: number[];
}
const phaseOf = (w: WorldDriver, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w), oneOf(id).region, id) as SourceStateShape;

/** 그 원천이 지금 서 있는 자리 — 관찰 결과가 답한다 (State 를 들여다보지 않는다) */
function seenAt(w: WorldDriver, id: string): XZ {
  const seen = sourceEntity(w.observe(), id);
  if (!seen) throw new Error(`관찰 결과에 원천 '${id}' 가 없다`);
  return { x: seen.position.x, z: seen.position.z };
}

/** 그 자리에 손이 닿는, 걸어 설 수 있는 자리 하나 (절벽 투성이라 좌표를 더하지 않는다) */
function besideIn(region: string, at: XZ): XZ {
  const near = walkableSpots(region).filter((p) => distanceBetween(p, at) <= INTERACTION_RANGE * 0.9);
  if (near.length === 0) throw new Error(`(${at.x}, ${at.z}) 곁에 걸어 설 자리가 없다 (${region})`);
  return minBy(near, (p) => distanceBetween(p, at));
}

/** 그 문(이음)이 이 방에서 서는 자리 */
function connectorSpot(connectorId: string, region: string): XZ {
  const c = REGION_GRAPH.connectors.find((x) => x.id === connectorId);
  if (!c) throw new Error(`graph 에 이음 '${connectorId}' 가 없다`);
  return anchorAt(region, c.from.region === region ? c.from.anchor : c.to.anchor);
}

/** 빙결 심층으로 드는 문 — 이름을 손으로 적지 않고 graph 가 고르게 한다 */
const depthDoor = () => REGION_GRAPH.connectors.find((c) => c.to.region === FROST_DEPTH);

/**
 * 문마다 그 표식이 지는 코드들 — 밝힌 문만 든다 (C029 CHANGED).
 *
 * C020 은 이것을 `CONNECTOR_REQUIREMENTS` 표에서 읽었다. 그 표가 사라지고 같은 사실이 그 방의
 * Lock 으로 옮겨 갔으므로 여기서도 Lock 을 읽는다 — **재는 사실은 한 값도 다르지 않다**:
 * 그 문 하나만이 코드를 지고, 그 코드가 표식에 실리며, 열림/잠김을 건드리지 않는다.
 * (그 코드가 무엇을 말하는가는 C029 에서 요구의 이름에서 현상으로 바뀌었고, 이 시나리오는
 * 코드의 글자를 손으로 적지 않으므로 그 뜻에 매이지 않는다.)
 */
const connectorRequirements = (): Record<string, readonly string[]> | undefined => {
  const table: Record<string, readonly string[]> = {};
  for (const lock of LOCKS) {
    if (lock.at.kind !== 'connector' || lock.reason === undefined) continue;
    table[lock.at.ref] = [lock.reason];
  }
  return table;
};

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 빙정석 계통이 선다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 빙정석 계통이 선다', () => {
  it('S-011 원천 넷이 제 방에 서고 넷 다 빙정석 하나를 낸다 — 세계 원인은 결정의 자람이다', () => {
    for (const one of FOUR) {
      // Given 데이터가 그 방에 그 원천을 놓았다
      const spec = ecologyOf(one.region, one.id);
      // Then Seed 하나와 셋째 세계 원인이 넷 다 같다 (World Change 1 · 확정 2)
      expect({ id: one.id, material: spec.materialId, cause: spec.worldCause }).toEqual({
        id: one.id,
        material: FROST_CRYSTAL,
        cause: CRYSTAL_GROWTH,
      });
      // And 그 방에 서서 보면 관찰 결과에도 그 Seed 로 실린다
      // (그 철에만 서는 것은 SPEC-007 이 따로 잰다 — 여기서는 스밈에 본다)
      const w = inSeason(SEEP, one.region, besideIn(one.region, pointOf(one.region, one.id)), {
        actorItems: { pickaxe: 1 },
      });
      expect({ id: one.id, material: sourceEntity(w.observe(), one.id)?.material }).toEqual({
        id: one.id,
        material: FROST_CRYSTAL,
      });
    }
  });

  it('S-012 붙잡는 것 넷이 다 다르고 맡은 자리 넷이 다 다르다 (현상 · 땅 · 대기 · 잔류)', () => {
    for (const one of FOUR) {
      const spec = ecologyOf(one.region, one.id);
      expect({ id: one.id, carrier: spec.carrier, role: spec.opportunity }).toEqual({
        id: one.id,
        carrier: one.carrier,
        role: one.role,
      });
    }
    // And 넷이 서로 겹치지 않는다
    expect(new Set(FOUR.map((o) => o.carrier)).size).toBe(FOUR.length);
    expect(new Set(FOUR.map((o) => o.role)).size).toBe(FOUR.length);
  });

  it('S-013 자연 형태 넷이 서로 다르고 숲의 형태와도 겹치지 않는다', () => {
    const forms = FOUR.map((o) => ecologyOf(o.region, o.id).form);
    // Then 넷이 다 다르다 (Seed 하나에 자연 형태 넷)
    expect(new Set(forms).size).toBe(FOUR.length);
    for (const form of forms) expect(typeof form).toBe('string');
    // And 숲이 쓰는 형태 코드와 한 자리도 겹치지 않는다
    const forestForms = Object.values(FOREST_SOURCE_BASELINE).map((v) => (v as { form: string }).form);
    for (const form of forms) expect({ form, reused: forestForms.includes(form) }).toEqual({ form, reused: false });
  });

  it('S-014 캘 수 있는 횟수가 차례로 3 · 2 · 2 · 1 이다', () => {
    for (const one of FOUR) {
      expect({ id: one.id, harvests: ecologyOf(one.region, one.id).harvests }).toEqual({
        id: one.id,
        harvests: one.harvests,
      });
    }
  });

  it('S-015 (경계 ①) 숲의 재료 넷과 그 원천 열은 한 값도 달라지지 않는다', () => {
    // Given 이 Cycle 전의 숲 원천 열 (기준값)
    for (const [id, base] of Object.entries(FOREST_SOURCE_BASELINE)) {
      const want = base as Record<string, unknown>;
      const spec = ecologyOf(String(want.region), id) as unknown as Record<string, unknown>;
      // Then 그 원천의 성질이 하나도 달라지지 않았다
      const seen: Record<string, unknown> = { region: want.region };
      for (const key of Object.keys(want)) {
        if (key === 'region') continue;
        seen[key] = spec[key];
      }
      expect({ id, ...seen }).toEqual({ id, ...want });
    }
    // And 숲의 재료 넷이 그대로다 — 빙정석은 그 넷에 섞이지 않는다
    const forestMaterials = [
      ...new Set(Object.values(FOREST_SOURCE_BASELINE).map((v) => (v as { materialId: string }).materialId)),
    ].sort();
    expect(forestMaterials).toEqual(['BIO_ORE', 'GIANT_TREE_FUNGUS', 'ORE_EATER_MOLT', 'WHALE_SCALE']);
    expect(forestMaterials).not.toContain(FROST_CRYSTAL);
  });

  it('S-016 (경계 ②) 대기가 이 세계에서 처음 선다 — 어휘 여덟 안의 값이다', () => {
    // Given 이 Cycle 전의 어느 원천도 대기를 지고 있지 않았다
    for (const [id, base] of Object.entries(FOREST_SOURCE_BASELINE)) {
      expect({ id, carrier: (base as { carrier: string }).carrier }).not.toEqual({ id, carrier: 'atmosphere' });
    }
    // Then 이 Cycle 의 원천 하나가 그것을 진다
    expect(FOUR.filter((o) => o.carrier === 'atmosphere').map((o) => o.id)).toEqual([SNOW_DRIFT_DUST]);
    expect(ecologyOf(oneOf(SNOW_DRIFT_DUST).region, SNOW_DRIFT_DUST).carrier).toBe('atmosphere');
    // And 세계가 아는 어휘가 그것을 안다 — 그리고 그 어휘는 Material §6.2 의 여덟 안이다
    expect(WORLD_CONTRACTS.carriers as readonly string[]).toContain('atmosphere');
    for (const carrier of WORLD_CONTRACTS.carriers as readonly string[]) {
      expect({ carrier, known: CARRIER_VOCABULARY.includes(carrier) }).toEqual({ carrier, known: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 흔적이 원천으로 이끈다 · 색이 아니라 온도로
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-002 흔적이 원천으로 이끈다 — 색이 아니라 온도로', () => {
  const UNTOUCHED = {} as never;
  const traceAt = (region: string, at: XZ) => traceStrengthAt(UNTOUCHED, region, at);
  const floorTrace = (region: string) =>
    gridSpots(region).reduce((low, at) => Math.min(low, traceAt(region, at)), Infinity);

  it('S-021 협곡 두 방의 바닥이 숨의 단계를 말한다 — 안쪽이 고개 너머 첫 방보다 한 단계 짙다', () => {
    // Then 얼음 협곡 바닥이 1 이고 빙결 협곡 바닥이 2 다
    expect({ outer: floorTrace(CANYON_OUTER), inner: floorTrace(CANYON_INNER) }).toEqual({
      outer: FLOOR_OUTER,
      inner: FLOOR_INNER,
    });
    // And 그 둘의 차이가 정확히 한 단계다
    expect(floorTrace(CANYON_INNER) - floorTrace(CANYON_OUTER)).toBe(1);
  });

  it('S-022 원천 둘레가 그 방 바닥보다 한 단계 짙다 — 흔적이 원천으로 이끈다', () => {
    for (const one of FOUR) {
      const at = pointOf(one.region, one.id);
      expect({ id: one.id, ring: traceAt(one.region, at) }).toEqual({
        id: one.id,
        ring: floorTrace(one.region) + RING_STEP,
      });
    }
  });

  it('S-023 (경계 ①) 숲의 방들에서 읽히는 흔적 태그는 한 값도 달라지지 않는다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      // Then trace layer 의 태그마다 흙 사다리의 단계가 그대로다
      const tags = areasOf(spaceOf(region), TRACE_LAYER).map((a) => `${a.tag}=${soilStainLevel(a.tag)}`);
      expect({ region, tags }).toEqual({ region, tags: base.traceTags });
      // And 그 방의 사다리(바닥과 가장 짙은 자리)가 그대로다
      const peak = gridSpots(region).reduce((high, at) => Math.max(high, traceAt(region, at)), 0);
      expect({ region, floor: floorTrace(region), peak }).toEqual({
        region,
        floor: base.floorTrace,
        peak: base.peakTrace,
      });
    }
  });

  it('S-024 (경계 ②) 협곡에서 흙의 사다리는 한 번도 읽히지 않는다 — 두 어휘가 섞이지 않는다', () => {
    for (const region of CANYONS) {
      // Given 그 방의 흔적 자락들
      const areas = areasOf(spaceOf(region), TRACE_LAYER);
      expect({ region, hasTrace: areas.length > 0 }).toEqual({ region, hasTrace: true });
      // Then 그 어느 태그도 흙의 사다리로는 읽히지 않는다 (읽으면 0 이다)
      const soil = areas.filter((a) => soilStainLevel(a.tag) !== 0).map((a) => a.tag);
      expect({ region, soil }).toEqual({ region, soil: [] });
    }
    // And 거꾸로 숲의 방에서는 협곡의 사다리가 서지 않는다 — 숲의 바닥이 그대로다
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({ region, floor: floorTrace(region) }).toEqual({ region, floor: base.floorTrace });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 캐면 고갈되고 세계 시간이 되돌린다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 캐면 고갈되고 세계 시간이 되돌린다', () => {
  it('S-031 원천마다 제 횟수만큼 캐면 바닥나고 그다음은 거절된다', () => {
    for (const one of FOUR) {
      // Given 그 원천 곁에 곡괭이를 지고 선다 (그 철에만 서는 것은 스밈에 본다)
      const at = besideIn(one.region, pointOf(one.region, one.id));
      const w = inSeason(SEEP, one.region, at, { actorItems: { pickaxe: 1 } });
      // When 제 횟수만큼 캔다
      mineUntilDepleted(w, one.id);
      // Then 바닥났고 손에 빙정석이 그 횟수만큼 들어왔다
      expect({ id: one.id, ...phaseOf(w, one.id) }).toMatchObject({
        id: one.id,
        phase: DEPLETED,
        taken: one.harvests,
      });
      expect({ id: one.id, held: heldOf(w.observe(), FROST_CRYSTAL) }).toEqual({
        id: one.id,
        held: one.harvests,
      });
      // And 한 번 더 지목하면 바닥남으로 거절된다
      expect({ id: one.id, reason: reasonOf(mine(w, one.id)) }).toEqual({
        id: one.id,
        reason: SOURCE_DEPLETED,
      });
    }
  });

  it('S-032 고개의 서리는 360 · 절벽의 결정면은 180 세계 초에 되돌아온다 — 데이터가 그렇게 말한다', () => {
    for (const one of FOUR) {
      expect({ id: one.id, seconds: recoveryOf(one.id) }).toEqual({ id: one.id, seconds: one.recovery });
    }
  });

  it('S-033 아무도 그 방에 없어도 그 길이만큼 지나면 되돌아온다', () => {
    for (const id of [PASS_RIME, CLIFF_FROST_VEIN]) {
      // Given 그 원천이 바닥난 세계 · 몸은 백왕령에 선다 (협곡에는 아무도 없다)
      const w = standingIn(WHITE_KING_DOMAIN, undefined, { sourcePhases: { [id]: DEPLETED } });
      const full = recoveryOf(id);
      // When 제 길이 직전까지 굴린다 / Then 아직 돌아오지 않았다
      wait(w, full - 1);
      expect({ id, phase: phaseOf(w, id).phase }).not.toEqual({ id, phase: AVAILABLE });
      // When 마지막 1 초를 마저 준다 / Then 돌아왔고 캔 횟수가 0 이다
      wait(w, 1);
      expect({ id, ...phaseOf(w, id) }).toMatchObject({ id, phase: AVAILABLE, taken: 0 });
    }
  });

  it('S-034 (경계) 바닥난 원천의 둘레 흔적이 한 단계 옅어지고 되돌아오면 제 단계로 돌아온다', () => {
    // Given 고개의 서리 — 자리를 옮기지 않으므로 둘레가 한자리에 있다
    const one = oneOf(PASS_RIME);
    const at = pointOf(one.region, PASS_RIME);
    const fresh = standingIn(one.region, besideIn(one.region, at));
    const full = traceStrengthAt(statesOf(fresh), one.region, at);
    // When 다 캔다
    const w = standingIn(one.region, besideIn(one.region, at), { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(w, PASS_RIME);
    // Then 그 둘레가 한 단계 옅어졌다
    expect(traceStrengthAt(statesOf(w), one.region, at)).toBe(full - 1);
    // When 제 길이만큼 기다린다 / Then 제 단계로 돌아온다
    wait(w, recoveryOf(PASS_RIME));
    expect(phaseOf(w, PASS_RIME).phase).toBe(AVAILABLE);
    expect(traceStrengthAt(statesOf(w), one.region, at)).toBe(full);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 결정면은 옆 면으로 옮겨 선다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 결정면은 옆 면으로 옮겨 선다', () => {
  const region = oneOf(CLIFF_FROST_VEIN).region;

  it('S-041 마디 넷을 가지고, 고갈되어 되돌아올 때 다음 마디에 선다', () => {
    // Given 마디가 넷이다 (기본형 ③)
    const sites = sitesOf(CLIFF_FROST_VEIN);
    expect(sites.length).toBe(VEIN_SITES);
    // And 결정면 곁에서 다 캔다 — 그때까지는 마디 0 이다
    const w = standingIn(region, besideIn(region, sites[0]!), { actorItems: { pickaxe: 1 } });
    expect(seenAt(w, CLIFF_FROST_VEIN)).toEqual(sites[0]);
    mineUntilDepleted(w, CLIFF_FROST_VEIN);
    // When 되돌아오는 중이 될 때까지 굴린다
    wait(w, visibleAt(CLIFF_FROST_VEIN));
    expect(phaseOf(w, CLIFF_FROST_VEIN).phase).toBe(RECOVERING);
    // Then 다음 마디에 서 있고 관찰 결과의 자리와 siteIndex 가 그것을 말한다
    const seen = sourceEntity(w.observe(), CLIFF_FROST_VEIN)!;
    expect({ position: { x: seen.position.x, z: seen.position.z }, siteIndex: seen.siteIndex }).toEqual({
      position: sites[1],
      siteIndex: 1,
    });
    // And 돌아온 뒤에도 그 자리다
    wait(w, recoveryOf(CLIFF_FROST_VEIN) - visibleAt(CLIFF_FROST_VEIN));
    expect(phaseOf(w, CLIFF_FROST_VEIN).phase).toBe(AVAILABLE);
    expect(seenAt(w, CLIFF_FROST_VEIN)).toEqual(sites[1]);
  });

  it('S-042 (경계 ①) 옛 마디에서는 캐기를 걸 수 없다 — 원천이 거기 없다', () => {
    const sites = sitesOf(CLIFF_FROST_VEIN);
    // Given 마디 0 에서 다 캐고 마디 1 로 옮겨 선 세계
    const w = standingIn(region, besideIn(region, sites[0]!), { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(w, CLIFF_FROST_VEIN);
    wait(w, recoveryOf(CLIFF_FROST_VEIN));
    expect(seenAt(w, CLIFF_FROST_VEIN)).toEqual(sites[1]);
    // When 몸은 옛 마디 곁에 그대로 서 있다 (걸어가지 않았다)
    // Then 그 자리에서는 캐기가 걸리지 않는다 — 손이 닿지 않는다
    expect(mineOn(w.observe(), CLIFF_FROST_VEIN)?.available ?? false).toBe(false);
    expect({ reason: reasonOf(mine(w, CLIFF_FROST_VEIN)) }).toEqual({ reason: OUT_OF_RANGE });
  });

  it('S-043 (경계 ②) 마디를 한 바퀴 돌면 처음 마디로 돌아온다', () => {
    const sites = sitesOf(CLIFF_FROST_VEIN);
    // Given 마디 0 에 선 결정면
    const world = standingIn(region, besideIn(region, sites[0]!), { actorItems: { pickaxe: 1 } });
    // When 마디 수만큼 "그 마디 곁으로 걸어가 다 캐고 되돌아옴을 기다린다" 를 되풀이한다
    for (let turn = 0; turn < sites.length; turn++) {
      // 지금 선 마디 — 차례대로 0 · 1 · 2 · 3 이다
      const index = phaseOf(world, CLIFF_FROST_VEIN).siteIndex ?? 0;
      expect({ turn, index }).toEqual({ turn, index: turn % sites.length });
      // 걸어서 그 마디 곁에 선다 (멀면 관찰에 실리지 않으므로 먼저 다가간다)
      walkTo(world, besideIn(region, sites[index]!));
      // 가까이 서면 관찰 결과가 그 자리를 말한다
      expect({ turn, at: seenAt(world, CLIFF_FROST_VEIN) }).toEqual({ turn, at: sites[index] });
      mineUntilDepleted(world, CLIFF_FROST_VEIN);
      wait(world, recoveryOf(CLIFF_FROST_VEIN));
      expect({ turn, phase: phaseOf(world, CLIFF_FROST_VEIN).phase }).toEqual({ turn, phase: AVAILABLE });
    }
    // Then 한 바퀴를 다 돌면 처음 마디로 돌아와 있다
    expect(phaseOf(world, CLIFF_FROST_VEIN).siteIndex ?? 0).toBe(0);
    walkTo(world, besideIn(region, sites[0]!));
    expect(seenAt(world, CLIFF_FROST_VEIN)).toEqual(sites[0]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 — 깨진 면이 결정화 위험으로 남는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-005 깨진 면이 결정화 위험으로 남는다', () => {
  const region = oneOf(CLIFF_FROST_VEIN).region;
  /** 마디 0 을 다 캔 세계 (걸어서 닿는 Given) */
  function brokenAtSiteZero(extra: WorldSetup = {}): WorldDriver {
    const sites = sitesOf(CLIFF_FROST_VEIN);
    const w = standingIn(region, besideIn(region, sites[0]!), { actorItems: { pickaxe: 1 }, ...extra });
    mineUntilDepleted(w, CLIFF_FROST_VEIN);
    return w;
  }

  it('S-051 마디가 고갈되면 그 자락 위에 hazard/matter 와 접촉의 코드가 함께 실린다', () => {
    const at = brokenSpot(CLIFF_FROST_VEIN, 0);
    // Given 마디 0 을 다 캔 세계
    const spent = brokenAtSiteZero();
    // When 그 깨진 자락 위에 선다
    const world = standingIn(region, at, { sourcePhases: { [CLIFF_FROST_VEIN]: DEPLETED } });
    void spent;
    const seen = conditionsSeen(world);
    // Then 위험의 코드와 접촉의 코드가 같은 목록에 함께 선다
    expect(seen).toContain(HAZARD_MATTER);
    expect(seen).toContain(CONTACT_CRYSTALLIZING);
  });

  it('S-052 원천이 옆 면으로 옮겨 가도 옛 자리의 위험은 남는다', () => {
    const sites = sitesOf(CLIFF_FROST_VEIN);
    const at = brokenSpot(CLIFF_FROST_VEIN, 0);
    // Given 마디 0 을 다 캐고 되돌아와 마디 1 에 선 세계
    const w = brokenAtSiteZero();
    wait(w, recoveryOf(CLIFF_FROST_VEIN));
    expect(phaseOf(w, CLIFF_FROST_VEIN).phase).toBe(AVAILABLE);
    expect(seenAt(w, CLIFF_FROST_VEIN)).toEqual(sites[1]);
    // When 옛 마디의 깨진 자락 위로 걸어간다
    walkTo(w, at);
    // Then 원천이 거기 없는데도 위험과 접촉의 코드가 그대로 실린다
    const seen = conditionsSeen(w);
    expect(seen).toContain(HAZARD_MATTER);
    expect(seen).toContain(CONTACT_CRYSTALLIZING);
  });

  it('S-053 (경계 ①) 캐기 전에는 그 자락이 아무것도 걸지 않는다', () => {
    const at = brokenSpot(CLIFF_FROST_VEIN, 0);
    // Given 아무것도 캐지 않은 세계에서 그 자리에 선다
    const fresh = standingIn(region, at);
    // Then 걸린 것은 C019 가 이미 걸어 둔 것뿐이다 — 이 Cycle 의 자락은 아무것도 더하지 않았다
    expect([...new Set(conditionsSeen(fresh))].sort()).toEqual(standingCodesAt(region, at));
  });

  it('S-054 (경계 ②) 늘 서 있는 것의 덧씌움과 **함께** 걸린다 — 서로 지우지 않는다', () => {
    const region2 = region;
    // Given **마디 0** 의 깨진 자락과 C019 의 상시 자락이 함께 덮은 자리
    // (자락은 넷이 같은 태그이므로 태그가 아니라 op id 로 고른다 — 깨진 것은 마디 0 뿐이다)
    const both = spotsInAreaOp(region2, depletedHazardAreasOf(CLIFF_FROST_VEIN)[0]!).filter(
      (p) => standingCodesAt(region2, p).length > 0,
    );
    if (both.length === 0) throw new Error('깨진 자락과 상시 자락이 함께 덮은 자리가 없다 — 겹침을 잴 수 없다');
    const at = both[Math.floor(both.length / 2)]!;
    const already = standingCodesAt(region2, at);
    // When 마디 0 이 고갈된 세계에서 그 자리에 선다
    const w = standingIn(region2, at, { sourcePhases: { [CLIFF_FROST_VEIN]: DEPLETED } });
    const seen = conditionsSeen(w);
    // Then 상시 위상이 걸던 코드가 하나도 지워지지 않았고
    for (const code of already) expect({ code, kept: seen.includes(code) }).toEqual({ code, kept: true });
    // 깨진 자락의 코드도 함께 실린다
    expect(seen).toContain(HAZARD_MATTER);
    expect(seen).toContain(CONTACT_CRYSTALLIZING);
  });

  // 협곡 두 방에는 **철 · 소란 · 지나가는 것**이 거는 덧씌움이 하나도 없다 (C019 가 세운 것은
  // 상시 위상뿐이고 이 Cycle 은 그것을 늘리지 않는다). 그래서 경계 ② 의 "함께 걸린다" 는
  // 위에서 **늘 서 있는 것**과의 겹침으로만 쟀다. 나머지 셋과의 겹침은 그 자락을 세울 손잡이가
  // 아니라 **그 데이터 자체**가 협곡에 없어 놓을 수 없다.
  it.todo(
    'GAP: 협곡에 철 · 소란 · 지나가는 것의 덧씌움이 없어 깨진 자락과의 겹침을 그 셋으로는 잴 수 없다',
  );

  it('S-055 (경계 ③) 땅이 한 값도 바뀌지 않는다 — 깨진 자리도 지날 수 있다 (무너짐과 갈린다)', () => {
    const at = brokenSpot(CLIFF_FROST_VEIN, 0);
    const beforeSurface = surfaceCounts(region);
    const beforeWalkable = walkableSpots(region).length;
    const beforeHash = descriptionHash(spaceOf(region));
    const fresh = standingIn(region, besideIn(region, sitesOf(CLIFF_FROST_VEIN)[0]!));
    const freshHash = fresh.observe().region.hash;
    // Given 마디 0 을 다 캔 세계
    const w = brokenAtSiteZero();
    // Then 그 자리는 무너지지 않았다 — 걸어 들어갈 수 있다
    expect(isCollapsedAt(statesOf(w), region, at)).toBe(false);
    walkTo(w, at);
    // And 땅도 통행 격자도 hash 도 한 값 바뀌지 않았다
    expect(surfaceCounts(region)).toEqual(beforeSurface);
    expect(walkableSpots(region).length).toBe(beforeWalkable);
    expect(descriptionHash(spaceOf(region))).toBe(beforeHash);
    expect(w.observe().region.hash).toBe(freshHash);
  });

  it('S-056 깨진 마디가 State 에 쌓인다 — 캐기 전에는 자리 자체가 없다', () => {
    // Given 아무것도 캐지 않은 세계
    const sites = sitesOf(CLIFF_FROST_VEIN);
    const fresh = standingIn(region, besideIn(region, sites[0]!));
    expect(sourceEntity(fresh.observe(), CLIFF_FROST_VEIN)?.collapsedSites).toBeUndefined();
    // When 마디 0 을 다 캔다
    const w = brokenAtSiteZero();
    // Then 그 마디가 깨진 마디로 쌓인다 (spec State 의 collapsedSites)
    expect(sourceEntity(w.observe(), CLIFF_FROST_VEIN)?.collapsedSites).toEqual([0]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-006 — 긴 밤에 결정면의 되돌아옴이 두 배 빠르다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-006 긴 밤에 결정면의 되돌아옴이 두 배 빠르다', () => {
  const region = oneOf(CLIFF_FROST_VEIN).region;

  it('S-061 긴 밤에는 제 길이의 절반만에 되돌아온다', () => {
    const full = recoveryOf(CLIFF_FROST_VEIN);
    const half = full / LONG_NIGHT_SPEED;
    // Given 긴 밤에 결정면이 바닥난 세계
    const w = inSeason(LONG_NIGHT, region, undefined, {
      sourcePhases: { [CLIFF_FROST_VEIN]: DEPLETED },
    });
    // When 절반 직전까지 굴린다 / Then 아직 돌아오지 않았다
    wait(w, half - 1);
    expect(phaseOf(w, CLIFF_FROST_VEIN).phase).not.toBe(AVAILABLE);
    // When 마지막 1 초를 마저 준다 / Then 돌아왔다 — 제 길이의 절반이다
    wait(w, 1);
    expect(phaseOf(w, CLIFF_FROST_VEIN)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });

  it('S-062 (경계 ①) 밝히지 않은 철에는 한 값도 다르지 않다 — 고요에는 제 길이 그대로다', () => {
    const full = recoveryOf(CLIFF_FROST_VEIN);
    const w = inSeason(STILL, region, undefined, { sourcePhases: { [CLIFF_FROST_VEIN]: DEPLETED } });
    // When 절반을 넘겨도 아직 돌아오지 않았다
    wait(w, full / LONG_NIGHT_SPEED + 1);
    expect(phaseOf(w, CLIFF_FROST_VEIN).phase).not.toBe(AVAILABLE);
    // Then 제 길이에 이르러서야 돌아온다
    wait(w, full - (full / LONG_NIGHT_SPEED + 1));
    expect(phaseOf(w, CLIFF_FROST_VEIN).phase).toBe(AVAILABLE);
  });

  it('S-063 (경계 ①) 배속을 밝히지 않은 원천은 긴 밤에도 제 길이 그대로다 (숲의 원천이 그렇다)', () => {
    // Given 배속을 밝힌 원천은 결정면뿐이다
    for (const spec of REGION_SPECS) {
      for (const source of spec.resourceEcology?.sources ?? []) {
        const speed = (source as unknown as { recoverySpeed?: unknown }).recoverySpeed;
        if (speed !== undefined) {
          expect({ id: source.id, declared: true }).toEqual({ id: CLIFF_FROST_VEIN, declared: true });
        }
      }
    }
    // When 긴 밤에 숲의 원천(폐허의 무더기 · 90 초)을 바닥내고 절반을 넘겨 굴린다
    const RUIN_SPOIL = 'RUIN_SPOIL';
    const full = ecologyOf(EXPLORER_RUIN, RUIN_SPOIL).recoverySeconds!;
    const w = inSeason(LONG_NIGHT, EXPLORER_RUIN, undefined, { sourcePhases: { [RUIN_SPOIL]: DEPLETED } });
    wait(w, full / 2 + 1);
    // Then 아직 돌아오지 않았다 — 제 길이에 이르러서야 돌아온다
    const stateOf = () =>
      (sourceStateOf(statesOf(w), EXPLORER_RUIN, RUIN_SPOIL) as SourceStateShape).phase;
    expect(stateOf()).not.toBe(AVAILABLE);
    wait(w, full - (full / 2 + 1));
    expect(stateOf()).toBe(AVAILABLE);
  });

  it('S-064 (경계 ②) 되돌아옴의 **길이**는 바뀌지 않는다 — 진행만 빨라진다', () => {
    // Then 데이터의 초는 철과 무관하게 하나다
    expect(recoveryOf(CLIFF_FROST_VEIN)).toBe(oneOf(CLIFF_FROST_VEIN).recovery);
    for (const season of SEASONS) {
      const w = inSeason(season, region, undefined, { sourcePhases: { [CLIFF_FROST_VEIN]: DEPLETED } });
      expect({ season, seconds: recoveryOf(CLIFF_FROST_VEIN) }).toEqual({
        season,
        seconds: oneOf(CLIFF_FROST_VEIN).recovery,
      });
      void w;
    }
    // And 데이터가 밝힌 것은 **배속**이고 그것이 긴 밤에 두 배다
    const speed = recoverySpeedOf(CLIFF_FROST_VEIN);
    expect({ declared: speed !== undefined }).toEqual({ declared: true });
    expect(speed![LONG_NIGHT]).toBe(LONG_NIGHT_SPEED);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-007 — 눈보라의 가루는 그 철에만 선다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-007 눈보라의 가루는 그 철에만 선다', () => {
  const one = oneOf(SNOW_DRIFT_DUST);
  const at = () => pointOf(one.region, SNOW_DRIFT_DUST);
  const seasonsOf = (): readonly SeasonId[] => {
    const occurrence = specOf(SNOW_DRIFT_DUST).occurrence;
    if (!occurrence) throw new Error('눈보라의 가루가 출현 조건을 밝히지 않는다');
    return occurrence.seasons;
  };

  it('S-071 스밈과 긴 밤에는 그 자리에 서 있고 캘 수 있다', () => {
    // Given 데이터가 그 둘만 밝혔다
    expect([...seasonsOf()].sort()).toEqual([LONG_NIGHT, SEEP].sort());
    for (const season of seasonsOf()) {
      // When 그 철에 그 자리 곁에 선다
      const w = inSeason(season, one.region, besideIn(one.region, at()), { actorItems: { pickaxe: 1 } });
      // Then 서 있고 자리가 데이터 그대로다
      const seen = sourceEntity(w.observe(), SNOW_DRIFT_DUST);
      expect({ season, x: seen?.position.x, z: seen?.position.z }).toEqual({
        season,
        x: at().x,
        z: at().z,
      });
      // And 캘 수 있다
      expect({ season, ...mineOnce(w, SNOW_DRIFT_DUST) }).toEqual({
        season,
        status: 'success',
        rule: 'RULE-MINE-001',
      });
      expect(heldOf(w.observe(), FROST_CRYSTAL)).toBe(1);
    }
  });

  it('S-072 다른 철에는 그 자리에 아무것도 없다', () => {
    for (const season of SEASONS.filter((s) => !seasonsOf().includes(s))) {
      const w = inSeason(season, one.region, besideIn(one.region, at()), { actorItems: { pickaxe: 1 } });
      expect({ season, seen: sourceEntity(w.observe(), SNOW_DRIFT_DUST) }).toEqual({
        season,
        seen: undefined,
      });
    }
  });

  it('S-073 사유 코드가 바닥남 · 되돌아오는 중 · 아직 그때가 아님 셋으로 갈린다', () => {
    const off = SEASONS.filter((s) => !seasonsOf().includes(s));
    expect(off.length).toBeGreaterThan(0);
    // ① 아직 그때가 아니다
    const notYet = inSeason(off[0]!, one.region, besideIn(one.region, at()), {
      actorItems: { pickaxe: 1 },
    });
    const notYetReason = reasonOf(mine(notYet, SNOW_DRIFT_DUST));
    expect(notYetReason).toBe(NOT_THIS_SEASON);
    // And 손에 아무것도 들어오지 않는다
    expect(heldOf(notYet.observe(), FROST_CRYSTAL)).toBeUndefined();
    // ② 바닥났다 — 그 철에 다 캐고 한 번 더 지목한다
    const dry = inSeason(seasonsOf()[0]!, one.region, besideIn(one.region, at()), {
      actorItems: { pickaxe: 1 },
    });
    mineUntilDepleted(dry, SNOW_DRIFT_DUST);
    const dryReason = reasonOf(mine(dry, SNOW_DRIFT_DUST));
    expect(dryReason).toBe(SOURCE_DEPLETED);
    // ③ 되돌아오는 중이다
    const back = inSeason(seasonsOf()[0]!, one.region, besideIn(one.region, at()), {
      actorItems: { pickaxe: 1 },
      sourcePhases: { [SNOW_DRIFT_DUST]: RECOVERING },
    });
    const backReason = reasonOf(mine(back, SNOW_DRIFT_DUST));
    expect(backReason).toBe(SOURCE_RECOVERING);
    // Then 셋이 서로 다른 말이다
    expect(new Set([notYetReason, dryReason, backReason]).size).toBe(3);
  });

  it('S-074 (경계) 그 자리의 흔적은 어느 철에도 그대로다 — 원천이 없다고 땅이 달라지지 않는다', () => {
    const values = SEASONS.map((season) => {
      const w = inSeason(season, one.region, besideIn(one.region, at()));
      return { season, trace: traceStrengthAt(statesOf(w), one.region, at()) };
    });
    const first = values[0]!.trace;
    for (const v of values) expect({ season: v.season, trace: v.trace }).toEqual({ season: v.season, trace: first });
    // And 그 값은 방 바닥보다 한 단계 짙다 (SPEC-002 의 사다리 그대로)
    const untouched = {} as never;
    const floor = gridSpots(one.region).reduce(
      (low, p) => Math.min(low, traceStrengthAt(untouched, one.region, p)),
      Infinity,
    );
    expect(first).toBe(floor + RING_STEP);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-008 — 언 사체 곁의 결정은 한 번뿐이다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-008 언 사체 곁의 결정은 한 번뿐이다', () => {
  const one = oneOf(FROZEN_REMAINS);

  it('S-081 한 번 캐면 바닥난다', () => {
    expect(harvestsOf(FROZEN_REMAINS)).toBe(1);
    const w = standingIn(one.region, besideIn(one.region, pointOf(one.region, FROZEN_REMAINS)), {
      actorItems: { pickaxe: 1 },
    });
    expect(mineOnce(w, FROZEN_REMAINS)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    expect(phaseOf(w, FROZEN_REMAINS)).toMatchObject({ phase: DEPLETED, taken: 1 });
    expect(reasonOf(mine(w, FROZEN_REMAINS))).toBe(SOURCE_DEPLETED);
  });

  it('S-082 되돌아옴의 원인이 밝혀져 있고, 되돌아옴은 세계에서 가장 느리다', () => {
    // Given 데이터가 그 원인을 밝힌다 (그 경로는 이 Cycle 밖이다 — 기본형 ④)
    const cause = specOf(FROZEN_REMAINS).recoveryCause;
    expect(typeof cause).toBe('string');
    expect(String(cause).length).toBeGreaterThan(0);
    // Then 이 Cycle **전**의 세계 어느 원천보다 느리다 (기본형 ④ "세계에서 가장 느린 값을 주고")
    //
    // 견주는 자리를 지금의 세계가 아니라 이 Cycle 전의 세계로 둔 이유 — SPEC-008 은 "세계에서
    // 가장 느리다" 고 적지만 같은 spec 의 데이터 값 표가 고개의 서리에 360 을 준다. 기본형 ④ 가
    // 말하는 것은 그 값을 고를 때의 기준(그때까지의 세계에서 가장 느린 값)이므로 그것을 잰다.
    const slowest = recoveryOf(FROZEN_REMAINS);
    expect(slowest).toBe(one.recovery);
    for (const [id, base] of Object.entries(FOREST_SOURCE_BASELINE)) {
      const seconds = (base as { recoverySeconds: number }).recoverySeconds;
      expect({ id, slower: seconds <= slowest }).toEqual({ id, slower: true });
    }
    // And 이 Cycle 의 넷 가운데서도 가장 느린 축이다 — 가루 · 결정면보다 오래 걸린다
    for (const other of FOUR.filter((o) => o.id !== FROZEN_REMAINS && o.id !== PASS_RIME)) {
      expect({ id: other.id, slower: recoveryOf(other.id) < slowest }).toEqual({
        id: other.id,
        slower: true,
      });
    }
  });

  it('S-083 (경계) 처음부터 서 있다 — 지나간 자리에 매달린 원천과 갈린다', () => {
    // Given 아무 일도 일어나지 않은 세계에서 그 자리 곁에 선다
    const w = standingIn(one.region, besideIn(one.region, pointOf(one.region, FROZEN_REMAINS)), {
      actorItems: { pickaxe: 1 },
    });
    // Then 관찰 결과에 서 있고 available 이고 바로 캘 수 있다
    expect(sourceEntity(w.observe(), FROZEN_REMAINS)?.state).toBe(AVAILABLE);
    expect(mineOn(w.observe(), FROZEN_REMAINS)?.available).toBe(true);
    // And 그 원천은 어느 철에도 조건으로 사라지지 않는다 (출현 조건을 밝히지 않았다)
    expect(specOf(FROZEN_REMAINS).occurrence).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-009 — 협곡이 요구하는 것은 협곡에 없다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-009 협곡이 요구하는 것은 협곡에 없다', () => {
  it('S-091 빙결 심층으로 드는 문이 서고, 그 표식에 요구의 코드가 실린다', () => {
    // Given graph 가 빙결 심층으로 드는 문 하나를 든다
    const door = depthDoor();
    expect({ found: door !== undefined }).toEqual({ found: true });
    expect({ from: door!.from.region, transition: door!.transition }).toEqual({
      from: CANYON_INNER,
      transition: 'door',
    });
    // And 데이터가 그 문의 요구를 밝힌다
    const requirements = connectorRequirements();
    expect({ declared: requirements !== undefined }).toEqual({ declared: true });
    const codes = requirements![door!.id];
    expect({ id: door!.id, has: (codes?.length ?? 0) > 0 }).toEqual({ id: door!.id, has: true });
    // When 그 문 앞에 서서 본다
    const w = standingIn(CANYON_INNER, connectorSpot(door!.id, CANYON_INNER));
    // Then 그 출구 존재의 조건 자리에 그 코드가 실린다 (봉투에 새 자리는 나지 않는다)
    const seen = exitOf(w.observe(), door!.id) as (EntityView & { conditions?: string[] }) | undefined;
    expect({ id: door!.id, standing: seen !== undefined }).toEqual({ id: door!.id, standing: true });
    for (const code of codes!) {
      expect({ code, carried: seen!.conditions?.includes(code) ?? false }).toEqual({ code, carried: true });
    }
  });

  it('S-092 협곡 두 방 어디에도 그 요구를 채울 원천이 없고, 두 방이 그 이유를 밝힌다', () => {
    // Given 두 방의 원천은 이 Cycle 의 넷뿐이고 넷 다 빙정석을 낸다
    for (const region of CANYONS) {
      const sources = regionSpec(region)?.resourceEcology?.sources ?? [];
      expect({ region, empty: sources.length === 0 }).toEqual({ region, empty: false });
      for (const source of sources) {
        expect({ region, id: source.id, material: source.materialId }).toEqual({
          region,
          id: source.id,
          material: FROST_CRYSTAL,
        });
      }
      // Then 그 방이 **왜 밖에서 아무것도 받지 않는지**를 밝힌다 (C014 §6.4 의 자리 그대로)
      const reason = (
        regionSpec(region)?.resourceEcology as unknown as { isolationReason?: string } | undefined
      )?.isolationReason;
      expect({ region, told: typeof reason === 'string' && reason.length > 0 }).toEqual({
        region,
        told: true,
      });
    }
    // And 열을 저장하는 것을 내는 원천은 두 방 어디에도 없다 — 빙정석은 열을 **먹는** 것이다
    const canyonMaterials = [
      ...new Set(
        CANYONS.flatMap((r) => (regionSpec(r)?.resourceEcology?.sources ?? []).map((s) => s.materialId)),
      ),
    ];
    expect(canyonMaterials).toEqual([FROST_CRYSTAL]);
  });

  it('S-093 (경계 ①) 그 너머는 아직 짓지 않은 곳이다 — 건너기 요청은 그렇게 거절된다', () => {
    // C021 로 좁혀졌다 — 그 문에 철 조건이 붙어 긴 밤에만 열린다 (C021 SPEC-004). 다른 철에는
    // "이 철이 아니다" 가 먼저 나므로 **문이 열린 때**에 묻는다. "그 너머는 아직 짓지 않았다"
    // 라는 이 항의 주장은 그대로이고, 물을 수 있는 때가 하나로 좁아졌을 뿐이다.
    const door = depthDoor()!;
    const w = standingIn(CANYON_INNER, connectorSpot(door.id, CANYON_INNER), {
      clock: 'LONG_NIGHT',
    });
    expect(cross(w, door.id)).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: REGION_NOT_BUILT,
    });
    // And 몸은 그대로 빙결 협곡에 있다
    expect(w.observe().scene).toBe(CANYON_INNER);
    // And 경계 이름이 넷이 되었다 — 앞의 셋은 차례 그대로다
    const frontiers = [...FRONTIER_REGIONS];
    expect(frontiers.slice(0, FRONTIERS_BEFORE.length)).toEqual(FRONTIERS_BEFORE);
    expect(frontiers).toContain(FROST_DEPTH);
  });

  it('S-094 (경계 ②) 요구는 **표시**다 — 그것 때문에 문이 잠기지도 채워져 열리지도 않는다', () => {
    // C021 로 좁혀졌다 — 이제 그 문을 잠그는 것이 있다. 다만 그것은 **철**이지 요구가 아니므로
    // (C021 SPEC-004 경계 ①) 문이 열리는 때에 견주면 이 항의 주장은 그대로 선다:
    // 요구를 밝힌 문과 밝히지 않은 문의 열림이 같고, 요구를 채워도 달라지는 것이 없다.
    const door = depthDoor()!;
    const w = standingIn(CANYON_INNER, connectorSpot(door.id, CANYON_INNER), {
      clock: 'LONG_NIGHT',
    });
    const seen = exitOf(w.observe(), door.id)!;
    // Then 요구를 밝히지 않은 다른 문과 열림 상태가 같다 (요구는 활성을 판정하지 않는다)
    const plain = exitsIn(w.observe()).find((e) => e.id !== door.id);
    expect({ id: door.id, state: seen.state }).toEqual({ id: door.id, state: plain?.state ?? seen.state });
    // And 거절의 사유는 요구가 아니라 "아직 짓지 않았다" 다
    expect(reasonOf(cross(w, door.id))).toBe(REGION_NOT_BUILT);
    // And 요구를 채웠다 해서 달라지는 것도 없다 — 손에 무엇을 들고 와도 같은 대답이다
    const carrying = standingIn(CANYON_INNER, connectorSpot(door.id, CANYON_INNER), {
      clock: 'LONG_NIGHT',
      actorItems: { pickaxe: 3 },
    });
    expect(reasonOf(cross(carrying, door.id))).toBe(REGION_NOT_BUILT);
    expect(exitOf(carrying.observe(), door.id)?.state).toBe(seen.state);
  });

  it('S-095 (경계 ③) 요구를 밝히지 않은 문의 표식은 한 값도 달라지지 않는다', () => {
    const door = depthDoor()!;
    const requirements = connectorRequirements() ?? {};
    // Given 요구를 밝힌 문은 그 하나뿐이다
    expect(Object.keys(requirements)).toEqual([door.id]);
    // Then 앞의 방들의 출구에는 조건 자리 자체가 서지 않는다
    for (const region of Object.keys(BASELINE)) {
      const w = standingIn(region);
      for (const exit of exitsIn(w.observe())) {
        const conditions = (exit as EntityView & { conditions?: string[] }).conditions;
        expect({ region, id: exit.id, conditions }).toEqual({ region, id: exit.id, conditions: undefined });
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — SPEC-010 앞의 세계는 그대로다
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('S-101 백왕령 · 숲 넷 · 미로 둘의 깊이 · hash · 출구 차례 · 표면 · 통행이 그대로다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({ region, depth: regionSpec(region)?.depth }).toEqual({ region, depth: base.depth });
      expect({ region, hash: descriptionHash(spaceOf(region)) }).toEqual({ region, hash: base.hash });
      expect({ region, exits: exitsOf(REGION_GRAPH, region).map((e) => e.connector.id) }).toEqual({
        region,
        exits: base.exits,
      });
      expect({ region, surface: surfaceCounts(region) }).toEqual({ region, surface: base.surface });
      expect({ region, walkable: walkableSpots(region).length }).toEqual({
        region,
        walkable: base.traversable,
      });
    }
  });

  it('S-102 그 방들의 관찰 결과에 실리는 존재 목록과 그 차례가 그대로다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      const w = standingIn(region);
      expect({ region, entities: entityLines(w.observe()) }).toEqual({ region, entities: base.entities });
      // And 그 방의 걸린 것에는 이 Cycle 의 코드가 하나도 실리지 않는다
      const seen = conditionsSeen(w);
      expect({ region, matter: seen.includes(HAZARD_MATTER) }).toEqual({ region, matter: false });
      expect({ region, contact: seen.includes(CONTACT_CRYSTALLIZING) }).toEqual({ region, contact: false });
      // And 그 방의 hash 는 관찰 결과에서도 그대로다
      expect({ region, hash: w.observe().region.hash }).toEqual({ region, hash: base.hash });
    }
  });

  it('S-103 C019 가 세운 협곡의 땅(표면 태그 · 통행)이 한 값도 달라지지 않는다', () => {
    for (const [region, base] of Object.entries(CANYON_TERRAIN_BASELINE)) {
      expect({ region, surface: surfaceCounts(region) }).toEqual({ region, surface: base.surface });
      expect({ region, walkable: walkableSpots(region).length }).toEqual({
        region,
        walkable: base.traversable,
      });
    }
  });

  it('S-104 C019 가 세운 상시 위상(눈보라 · 절벽 · 결정면 자락)이 한 값도 달라지지 않는다', () => {
    for (const [region, base] of Object.entries(CANYON_STANDING_BASELINE)) {
      const standing = (regionSpec(region)?.phases as { standing?: unknown } | undefined)?.standing;
      expect({ region, standing }).toEqual({ region, standing: base });
    }
  });

  it('S-105 협곡의 관찰 범위와 접촉의 줄이 C019 그대로다 — 눈보라 안 20/10 · 결정면 위 crystallizing', () => {
    // Given 눈보라 자락 안의 한 자리 (데이터가 고른다)
    const blizzard = standingHazards(CANYON_INNER).find(
      (h) => (h as { observeRange?: unknown }).observeRange,
    )!;
    const tag = areaTagOf(CANYON_INNER, blizzard.areaId);
    const spots = spotsWithHazardTag(CANYON_INNER, tag);
    expect(spots.length).toBeGreaterThan(0);
    // Then 그 자리에 서면 눈보라의 위험 코드가 그대로 실린다
    const w = standingIn(CANYON_INNER, spots[Math.floor(spots.length / 2)]!);
    expect(conditionsSeen(w)).toContain(blizzard.hazard);
    // And C019 의 결정면 자락 위에서는 접촉의 줄이 그대로 선다 (아무것도 캐지 않은 세계에서도)
    const face = standingHazards(CANYON_INNER).find((h) => h.contact === CONTACT_CRYSTALLIZING)!;
    const faceSpots = spotsWithHazardTag(CANYON_INNER, areaTagOf(CANYON_INNER, face.areaId));
    expect(faceSpots.length).toBeGreaterThan(0);
    const onFace = standingIn(CANYON_INNER, faceSpots[Math.floor(faceSpots.length / 2)]!);
    expect(conditionsSeen(onFace)).toContain(CONTACT_CRYSTALLIZING);
    expect(conditionsSeen(onFace)).toContain(face.hazard);
  });

  it('S-106 이 Cycle 의 원천 넷과 문 하나는 앞의 방에 한 자리도 실리지 않는다', () => {
    for (const region of Object.keys(BASELINE)) {
      const w = standingIn(region);
      const ids = sourcesIn(w.observe()).map((e) => e.id);
      for (const one of FOUR) expect({ region, id: one.id, seen: ids.includes(one.id) }).toEqual({
        region,
        id: one.id,
        seen: false,
      });
      const door = depthDoor();
      if (door) {
        expect({ region, door: exitsIn(w.observe()).some((e) => e.id === door.id) }).toEqual({
          region,
          door: false,
        });
      }
    }
  });

  it('S-107 협곡의 hash 는 State 로 흔들리지 않는다 — 캐도 철이 돌아도 그 방의 판은 하나다', () => {
    const fresh = standingIn(CANYON_INNER, besideIn(CANYON_INNER, pointOf(CANYON_INNER, CLIFF_FROST_VEIN)));
    const base = fresh.observe().region.hash;
    expect(base).toBe(descriptionHash(spaceOf(CANYON_INNER)));
    for (const season of SEASONS) {
      const w = inSeason(season, CANYON_INNER, besideIn(CANYON_INNER, pointOf(CANYON_INNER, CLIFF_FROST_VEIN)), {
        sourcePhases: { [CLIFF_FROST_VEIN]: DEPLETED },
      });
      expect({ season, hash: w.observe().region.hash }).toEqual({ season, hash: base });
    }
  });
});
