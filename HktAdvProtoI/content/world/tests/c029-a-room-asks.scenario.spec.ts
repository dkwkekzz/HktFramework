// C029 — 방이 묻는다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-005 · SPEC-007)
//
// C020 은 문의 표식에 **요구의 이름**을 실었다("저장된 열이 있어야 한다"). 이 Cycle 이 그것을
// 거둬들이고 **현상**을 세운다 — 문 앞에 서면 몸이 그것을 보이고, 지목하면 판이 본 것만 말한다.
// 그래서 여기서 재는 것은 여섯이다:
//   ① 어휘 — 축 다섯 · 관계 일곱 · 요구에 답하는 줄이 세계에 하나로 서고, 규칙 코드는 그것을 모른다
//   ② 한 형 — 세 문의 조건이 Lock 으로 옮겨졌는데 열림/잠김의 답과 사유가 한 값도 다르지 않다
//   ③ 현상 — 문 앞의 자락에 든 **몸**에 코드가 실리고, 밖으로 나오면 사라지고, 몸이 아닌 것에는 없다
//   ④ 지목 — 그 문의 표식이 지는 것이 요구의 이름에서 현상의 코드로 바뀐다 (열림은 그대로다)
//   ⑤ 성질 — 재료 넷이 성질 태그를 지고, 태그마다 그 재료의 문장 하나를 가리킨다
//   ⑥ 불변 — 앞의 세계(방들의 hash · 표면 · 통행 · 출구 · 실리는 것 · 원천의 phase)는 그대로다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/regions/properties.ts · access.ts · 그 방들의 새 줄 ·
// content/world 의 새 규칙 · content/view/** · engine/world-authoring 의 검사 아홉)은
// **읽지 않았다.** 기대값의 출처는 cycles/C029-a-room-asks/spec.md 와 이미 있던 하네스·선례
// (c004 · c009 · c016 · c019 · c020 · c021)뿐이다.
//
// **자리도 op 의 이름도 손으로 적지 않는다** — 문의 자리는 graph 의 anchor 에서, 문 앞 자락의
// 자리는 그 문에 걸린 Lock 이 가리킨 흔적의 op 에서, 성질의 어휘는 content/regions 가 내는
// 값에서 읽는다. 손으로 적는 것은 spec 이 「데이터 값」 표에서 이름으로 못 박은 것(코드 둘 ·
// 요구 하나 · 축 다섯 · 관계 일곱 · 재료 넷의 성질 · 문 셋)뿐이고, 그것들은 세계에서 유도할
// 자리가 없다 (c016 · c020 · c021 의 규율 그대로).
//
// **번호는 이어 붙인다** — 이 저장소의 시나리오가 쓴 마지막 번호(S-115)를 잇는다. 파일마다
// SPEC 안에서 다시 세는 어법도 있으나, 그러면 C019 ~ C021 의 번호와 겹친다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.
//
// **여기서 재지 않는 것 둘** — 검사 아홉(SPEC-006)은 도구의 자리이고, 지목한 판의 줄(재료의
// 이름과 성질 문장 · SPEC-005 의 판)은 View 의 표가 짓는다. 세계 쪽에서 잴 수 있는 것은
// 그 판이 읽는 재료(entities[].material)와 그 재료가 진 성질 데이터까지다.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  FOREST_DEEP,
  FOREST_EDGE,
  FROST_CANYON,
  FROST_DEPTH,
  ICE_CANYON,
  MATERIAL_SEEDS,
  MAZE_HEART,
  MAZE_HEART_GATE,
  PREDATOR_NEST,
  REGION_GRAPH,
  REGION_SPECS,
  RESOURCE_LAYER,
  WHITE_KING_DOMAIN,
  regionSpec,
  type SeasonId,
} from '../../regions';
// 이 Cycle 이 **처음 내는** 데이터 문(門) — 이름 하나를 못 찾아 파일 전체가 서지 못하는 일을
// 막으려고 이름 공간으로 읽는다 (c020 · c021 의 선례 그대로 · 그 하나가 없으면 그 항만 붉어진다).
import * as REGIONS from '../../regions';
// C008 이 세운 미로의 이름 — 그 파일이 소유한다 (c008 ~ c021 시나리오의 선례 그대로).
import { FANTASY_MAZE } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { sourceStateOf } from '../semantic/resource';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';

// ── spec 이 이름으로 못 박은 것들 (State 의 「데이터 값」 표) ──────────

/** 철 넷 (C015 · C016 그대로) */
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
const SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT, TURN];

/** 성질의 축 다섯 · 관계 일곱 (데이터 값 표 · Access §4.1 · D1) */
const ASPECTS: readonly string[] = ['heat', 'light', 'vibration', 'space', 'flesh'];
const RELATIONS: readonly string[] = [
  'absorbs',
  'stores',
  'emits',
  'senses',
  'hides',
  'grows-on',
  'fixes',
];
/** answers 가 밝히는 관계 셋 — 데이터로만 선다 (기본형 ⑦ · K11) */
const ANSWER_KINDS: readonly string[] = ['SUPPORTS', 'OPPOSES', 'REVEALS'];

/** 빙결 심층 문이 묻는 것 · 그 요구에 SUPPORTS 로 답하는 성질 (데이터 값 표 · 확정 2) */
const ASKED = 'heat:hides';
const ANSWERING = 'heat:stores';

/** 이 Cycle 의 코드 둘 (데이터 값 표 · 기본형 ④ · Play §6 V25) */
const BREATH_GLOWS = 'breath-glows';
const ASKS_WARMTH = 'asks-warmth';
/**
 * C031 AFFECTED — 그 사유를 **대신하는** 완화된 코드 (C031 데이터 값 표).
 *
 * 이 방의 문 앞은 눈보라 자락 **안에 통째로 들어 있다** (C031 이 잰 세계의 사실) — 그래서
 * 문 앞에 선 몸은 밝힌 사유가 아니라 이것을 읽는다. 이 Cycle 이 재는 사실("표식이 그 문의
 * 사유를 진다 · 열림을 판정하지 않는다")은 한 값도 무르지 않고, 어느 코드가 실리는가만
 * 자리를 따라 갈린다 (RULE-LOCK-RELAXED-001 · 둘이 함께 서지 않는다).
 */
const ASKS_WARMTH_WEAK = 'asks-warmth-weak';
/** C020 이 표식에 싣던 요구의 이름 — 이 Cycle 이 그것을 거둔다 (R3 비고) */
const OLD_REQUIREMENT_CODE = 'requires-stored-heat';

/** 문 셋 (데이터 값 표 · Access §9.1) */
const WALKING_FOREST_DOOR = 'WALKING_FOREST_DOOR';

/** 재료의 성질 (데이터 값 표 · Access §9.2) — 이름은 C011 · C014 · C020 이 세운 그대로다 */
const MATERIAL_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  BIO_ORE: ['flesh:stores', 'light:emits'],
  ORE_EATER_MOLT: ['light:emits'],
  GIANT_TREE_FUNGUS: ['flesh:absorbs', 'light:absorbs'],
  FROST_CRYSTAL: ['heat:absorbs', 'light:emits', 'heat:grows-on'],
};
/** 성질을 밝히지 않은 재료 (데이터 값 표 "(성질 미정)" · 빈칸 4) */
const WITHOUT_PROPERTIES = 'WHALE_SCALE';
/** 성질 태그가 가리킬 수 있는 문장 다섯 (State · Material §6.1) */
const SENTENCE_FIELDS: readonly string[] = [
  'appearance',
  'behavior',
  'conditionResponse',
  'persistence',
  'danger',
];

/** 사유 코드 — 그대로 쓰는 것들 (C002 · C009 · C016) */
const NOT_THIS_SEASON = 'not-this-season';
const CONNECTOR_INACTIVE = 'connector-inactive';
const REGION_NOT_BUILT = 'region-not-built';

const solo: WorldSetup = { npcs: [] };

// ── 회귀의 기준값 (SPEC-007) ─────────────────────────────────────────
//
// 이 Cycle 이 시작하기 전의 세계에서 온 값이다 — hash · 표면 · 통행은 C021 시나리오의 표에서,
// 출구 차례와 실리는 존재는 C020 시나리오의 표에서 그대로 왔다. 계산으로 다시 얻지 않는다.

interface RoomBaseline {
  /** 이 Cycle 이 Description 을 건드리는 방에는 없다 (아래 빙결 협곡) */
  hash?: string;
  surface: Readonly<Record<string, number>>;
  traversable: number;
  exits: readonly string[];
  entities: readonly string[];
}

const BASELINE: Readonly<Record<string, RoomBaseline>> = {
  [WHITE_KING_DOMAIN]: {
    hash: '1c57fb5f',
    surface: { flat: 1022, wet: 497, slope: 95, steep: 67 },
    traversable: 1328,
    exits: ['FOREST_PATH', 'RED_WASTE_PASS', 'ICE_CANYON_PASS'],
    entities: [
      'player-1/player-character',
      'FOREST_PATH/region-exit',
      'RED_WASTE_PASS/region-exit',
      'ICE_CANYON_PASS/region-exit',
    ],
  },
  [FOREST_EDGE]: {
    hash: 'da66b8e9',
    surface: { flat: 1386, slope: 127, steep: 168 },
    traversable: 1513,
    exits: ['FOREST_PATH', 'RUIN_TRAIL', 'DEEP_TRAIL'],
    entities: [
      'player-1/player-character',
      'MOLT_LITTER/resource-source',
      'FALLEN_SCALE/resource-source',
      'PREY_REMAINS/resource-source',
      'ORE_PEBBLE_EDGE/resource-source',
      'HUSK_SHARD_EDGE/resource-source',
      'FOREST_PATH/region-exit',
      'RUIN_TRAIL/region-exit',
      'DEEP_TRAIL/region-exit',
    ],
  },
  [FOREST_DEEP]: {
    hash: '2b6a4c96',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['DEEP_TRAIL', 'NEST_TRAIL', 'ORE_TRAIL', 'TREE_APPROACH', 'ANCIENT_GATE', 'WALKING_FOREST_DOOR'],
    entities: [
      'player-1/player-character',
      'RIVER_SILT/resource-source',
      'ORE_PEBBLE_DEEP_1/resource-source',
      'ORE_PEBBLE_DEEP_2/resource-source',
      'HUSK_SHARD_DEEP/resource-source',
      'DEEP_TRAIL/region-exit',
      'NEST_TRAIL/region-exit',
      'ORE_TRAIL/region-exit',
      'TREE_APPROACH/region-exit',
      'ANCIENT_GATE/region-exit',
      'WALKING_FOREST_DOOR/region-exit',
    ],
  },
  [BIO_ORE_FIELD]: {
    hash: 'f111570c',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['ORE_TRAIL', 'ORE_TREE_TRAIL'],
    entities: [
      'player-1/player-character',
      'ORE_OUTCROP/resource-source',
      'ORE_PEBBLE_ORE_1/resource-source',
      'ORE_PEBBLE_ORE_2/resource-source',
      'ORE_PEBBLE_ORE_3/resource-source',
      'HUSK_SHARD_ORE/resource-source',
      'ORE_TRAIL/region-exit',
      'ORE_TREE_TRAIL/region-exit',
    ],
  },
  [PREDATOR_NEST]: {
    hash: '7e437aff',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['NEST_TRAIL'],
    entities: [
      'player-1/player-character',
      'NEST_FUNGUS/resource-source',
      'HUSK_SHARD_NEST/resource-source',
      'NEST_TRAIL/region-exit',
    ],
  },
  [FANTASY_MAZE]: {
    hash: '53ca6a70',
    surface: { flat: 6561 },
    traversable: 6561,
    exits: ['MAZE_GATE_RETURN', 'MAZE_HEART_GATE'],
    entities: [
      'player-1/player-character',
      'MAZE_GATE_RETURN/region-exit',
      'MAZE_HEART_GATE/region-exit',
    ],
  },
  [MAZE_HEART]: {
    hash: 'b9b77a14',
    surface: { flat: 1681 },
    traversable: 1681,
    exits: ['MAZE_HEART_GATE', 'INVERTED_GARDEN_DOOR'],
    entities: [
      'player-1/player-character',
      'MAZE_HEART_GATE/region-exit',
      'INVERTED_GARDEN_DOOR/region-exit',
    ],
  },
  [ICE_CANYON]: {
    hash: '5928ed79',
    surface: { steep: 810, slope: 164, frost: 697, flat: 10 },
    traversable: 871,
    exits: ['ICE_CANYON_PASS', 'FROST_CANYON_TRAIL'],
    entities: [
    ],
  },
  [FROST_CANYON]: {
    surface: { steep: 902, slope: 72, frost: 697, flat: 10 },
    traversable: 779,
    exits: ['FROST_CANYON_TRAIL', 'FROST_DEPTH_DOOR'],
    entities: [
    ],
  },
};

/** 출구 차례와 실리는 존재까지 견주는 방들 — 협곡 둘은 hash · 땅만 견준다 (C020 의 표 그대로) */
const ROOMS_WITH_ENTITY_BASELINE = Object.keys(BASELINE).filter(
  (region) => (BASELINE[region]?.entities.length ?? 0) > 0,
);

/**
 * 방마다의 원천 이름 — 이 Cycle 이 시작하기 전의 세계 (C020 시나리오의 표에서 그대로 왔다).
 * 차례는 견주지 않는다 (그 표가 방마다의 차례까지는 적지 않았다) — 이름의 집합만 본다.
 */
const SOURCE_BASELINE: Readonly<Record<string, readonly string[]>> = {
  [FOREST_EDGE]: ['MOLT_LITTER', 'SEEP_CRUST', 'FALLEN_SCALE', 'PREY_REMAINS', 'ORE_PEBBLE_EDGE', 'HUSK_SHARD_EDGE', 'GLOW_CAP_EDGE'],
  [FOREST_DEEP]: ['RIVER_SILT', 'ORE_PEBBLE_DEEP_1', 'ORE_PEBBLE_DEEP_2', 'HUSK_SHARD_DEEP', 'GLOW_CAP_DEEP', 'SEEP_CRUST_DEEP'],
  [BIO_ORE_FIELD]: ['ORE_OUTCROP', 'ORE_PEBBLE_ORE_1', 'ORE_PEBBLE_ORE_2', 'ORE_PEBBLE_ORE_3', 'HUSK_SHARD_ORE'],
  [PREDATOR_NEST]: ['NEST_FUNGUS', 'GLOW_CAP_NEST_1', 'GLOW_CAP_NEST_2', 'HUSK_SHARD_NEST'],
  [ICE_CANYON]: ['PASS_RIME'],
  [FROST_CANYON]: ['CLIFF_FROST_VEIN', 'SNOW_DRIFT_DUST', 'FROZEN_REMAINS'],
};

/** C019 가 세운 상시 위상 — 눈보라의 관찰 범위까지 그대로다 (SPEC-007 "관찰 범위") */
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

// ── 하네스 (c009 · c016 · c019 · c020 · c021 의 선례 그대로) ──────────

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

/** 표면 태그마다 vertex 수 (c019 ~ c021 의 어법) */
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
/** 그 이음이 이 방에서 서는 자리 (c020 · c021 의 connectorSpot 그대로) */
function connectorSpot(connectorId: string, region: string): XZ {
  const c = REGION_GRAPH.connectors.find((x) => x.id === connectorId);
  if (!c) throw new Error(`graph 에 이음 '${connectorId}' 가 없다`);
  return anchorAt(region, c.from.region === region ? c.from.anchor : c.to.anchor);
}

/** **그 area op 하나**가 덮은, 걸어 설 수 있는 자리들 (c020 의 spotsInAreaOp 그대로) */
function spotsInAreaOp(region: string, areaId: string): XZ[] {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return walkableSpots(region).filter((p) => areaCoversPoint(op.shape, p.x, p.z));
}
/** 그 op 이 그 방의 area 인가 — 흔적이 자락인지 자리인지 데이터가 정한다 (기본형 ⑤) */
function isAreaOp(region: string, opId: string): boolean {
  const op = spaceOf(region).ops.find((o) => o.id === opId);
  return op !== undefined && op.kind === 'area';
}
/** 그 자락 **밖**의, 걸어 설 수 있는 자리 하나 — 안의 자리에서 가장 가까운 것 */
function outsideAreaOp(region: string, areaId: string, from: XZ): XZ {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  const outside = walkableSpots(region).filter((p) => !areaCoversPoint(op.shape, p.x, p.z));
  if (outside.length === 0) throw new Error(`자락 '${areaId}' 밖에 걸어 설 자리가 없다 (${region})`);
  return minBy(outside, (p) => distanceBetween(p, from));
}

// ── 세계를 세우고 굴리는 자리 ────────────────────────────────────────

const standingIn = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
  });
/** 그 철에서 시작하는 세계 — C015 가 세운 clock 손잡이 (c016 ~ c021 의 inSeason 그대로) */
const inSeason = (season: SeasonId, region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  standingIn(region, at, { ...extra, clock: season });
/** 몸 둘이 선 세계 — 하나는 관찰자의 것, 하나는 그 방에 놓인 자율 존재 (attack.spec 의 손잡이) */
const withOtherBody = (
  season: SeasonId,
  region: string,
  mine: XZ,
  theirs: XZ,
): WorldDriver =>
  driveWorld({
    clock: season,
    actorRegion: region,
    actorPosition: { x: mine.x, z: mine.z },
    npcRegion: region,
    npcs: [
      { id: 'npc-1', position: { x: theirs.x, z: theirs.z }, wanderPath: [], perceptionRange: 0 },
    ],
  });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};

const move = (w: WorldDriver, at: XZ): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } });
const cross = (w: WorldDriver, connector: string): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector });
const reasonOf = (result: ActionResult): string | undefined =>
  'reason' in result ? (result.reason as string) : undefined;

/** 걸어서 그 자리에 선다 (c017 · c019 ~ c021 의 walkTo 그대로) */
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

// ── 저장·복구 (c013 ~ c016 · c020 · c021 의 선례 그대로) ─────────────

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

function revive(base: WorldDriver): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  const world = createWorld({}, restored);
  world.join(OBSERVER);
  world.tick(0);
  return wrap(world);
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────

type SeenEntity = EntityView & { conditions?: string[]; material?: string };

/** 몸의 갈래 셋 — 내 몸 · 남의 몸 · 자율 존재의 몸 (projection 의 role 그대로) */
const BODY_ROLES: readonly string[] = [
  'player-character',
  'other-player-character',
  'npc-character',
];
const entitiesIn = (v: GameViewSnapshot): SeenEntity[] => v.entities as SeenEntity[];
const bodiesIn = (v: GameViewSnapshot): SeenEntity[] =>
  entitiesIn(v).filter((e) => BODY_ROLES.includes(e.role));
const notBodiesIn = (v: GameViewSnapshot): SeenEntity[] =>
  entitiesIn(v).filter((e) => !BODY_ROLES.includes(e.role));
const exitsIn = (v: GameViewSnapshot): SeenEntity[] =>
  entitiesIn(v).filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string): SeenEntity | undefined =>
  exitsIn(v).find((e) => e.id === id);
const sourcesIn = (v: GameViewSnapshot): SeenEntity[] =>
  entitiesIn(v).filter((e) => e.role === 'resource-source');
const transitTo = (v: GameViewSnapshot, connector: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'transit' && i.targetEntityId === connector);
const entityLines = (v: GameViewSnapshot): string[] => v.entities.map((e) => `${e.id}/${e.role}`);
/** 내 몸의 투영 — 이 Cycle 이 코드를 싣는 자리 */
const myBody = (w: WorldDriver): SeenEntity => {
  const v = w.observe();
  const found = entitiesIn(v).find((e) => e.id === v.observer.characterId);
  if (!found) throw new Error('관찰 결과에 내 몸이 없다');
  return found;
};
const codesOn = (e: SeenEntity | undefined): string[] => e?.conditions ?? [];

// ── 이 Cycle 이 데이터에 세운 것 — **이름을 읽어 온다** ───────────────
//
// spec 은 성질 어휘의 export 이름도 자락 op 의 이름도 적지 않는다 (관찰 계약의 규율 그대로).
// 관찰자가 자기 content/regions 를 훑어 스스로 얻는 것이 이 저장소의 길이다 (c016 · c020 · c021).

interface VocabularyEntryShape {
  id?: string;
  meaning?: string;
  basis?: string;
}
interface AnswerShape {
  requirement?: string;
  property?: string;
  kind?: string;
  basis?: string;
}
interface VocabularyShape {
  aspects?: readonly VocabularyEntryShape[];
  relations?: readonly VocabularyEntryShape[];
  answers?: readonly AnswerShape[];
}

/** 세계 전체에 하나인 성질의 어휘 — 축과 관계를 든 값 하나를 이름 공간에서 찾는다 */
function vocabulary(): VocabularyShape | undefined {
  for (const value of Object.values(REGIONS as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue;
    const shape = value as VocabularyShape;
    if (Array.isArray(shape.aspects) && Array.isArray(shape.relations)) return shape;
  }
  return undefined;
}
const theVocabulary = (): VocabularyShape => {
  const found = vocabulary();
  if (!found) throw new Error('content/regions 에 성질의 어휘(축 · 관계)가 없다');
  return found;
};
const idsOf = (entries: readonly VocabularyEntryShape[] | undefined): string[] =>
  (entries ?? []).map((e) => String(e.id));

interface TraceShape {
  op?: string;
  showsOnBody?: unknown;
  code?: unknown;
}
interface LockShape {
  id?: string;
  at?: { kind?: string; ref?: string };
  strength?: string;
  requires?: readonly Record<string, unknown>[];
  important?: boolean;
  traces?: readonly TraceShape[];
  reason?: string;
}

/** 그 방이 묻는 것 — 없으면 묻지 않는 방이다 (State: RegionSpec.access?) */
const locksOf = (region: string): LockShape[] =>
  (((regionSpec(region) as unknown as { access?: { locks?: readonly LockShape[] } } | undefined)
    ?.access?.locks ?? []) as readonly LockShape[]).map((lock) => lock);
/** 세계의 모든 Lock — {방, Lock} 짝으로 편다 */
const allLocks = (): { region: string; lock: LockShape }[] =>
  REGION_SPECS.flatMap((spec) => locksOf(spec.id).map((lock) => ({ region: spec.id, lock })));
/** 그 문에 걸린 Lock (없으면 undefined) */
const lockOn = (connectorId: string) =>
  allLocks().find((x) => x.lock.at?.kind === 'connector' && x.lock.at?.ref === connectorId);

/**
 * Lock 의 요구 가운데 그 갈래의 것들.
 *
 * spec 은 요구의 **갈래 이름**(property · time · state · knowledge)만 못 박고 그 안의 모양은
 * 적지 않았다. 그래서 모양을 단언하지 않고 "그 갈래를 밝혔는가" 와 "그 안에 그 이름이 있는가"
 * 두 가지만 글자로 묻는다 — 어느 모양으로 적히든 뜻은 같다.
 */
const requirementsOf = (lock: LockShape, kind: string): unknown[] =>
  (lock.requires ?? []).filter((r) => r[kind] !== undefined).map((r) => r[kind]);
const declares = (lock: LockShape, kind: string): boolean => requirementsOf(lock, kind).length > 0;
const requirementText = (lock: LockShape, kind: string): string =>
  JSON.stringify(requirementsOf(lock, kind));

/** 그 흔적이 몸에 보일 것을 밝혔으면 그 코드 (밝히지 않았으면 undefined) */
function bodyCodeOf(trace: TraceShape): string | undefined {
  const raw = trace.showsOnBody;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (raw === true && typeof trace.code === 'string' && trace.code.length > 0) return trace.code;
  return undefined;
}
/** 그 방의 Lock 들이 **몸에 보일 것**을 밝힌 흔적들 */
const bodyTracesIn = (region: string): { op: string; code: string }[] =>
  locksOf(region).flatMap((lock) =>
    (lock.traces ?? []).flatMap((trace) => {
      const code = bodyCodeOf(trace);
      return code !== undefined && typeof trace.op === 'string'
        ? [{ op: trace.op, code }]
        : [];
    }),
  );

/** 빙결 심층으로 드는 문 — 이름을 손으로 적지 않고 graph 가 고르게 한다 (c020 · c021 그대로) */
const depthDoor = () => {
  const found = REGION_GRAPH.connectors.find((c) => c.to.region === FROST_DEPTH);
  if (!found) throw new Error('graph 에 빙결 심층으로 드는 문이 없다');
  return found;
};
const depthDoorSpot = () => connectorSpot(depthDoor().id, depthDoor().from.region);
/** 그 문 앞의 자락 — 그 문에 걸린 Lock 이 가리킨, 몸에 보이는 흔적 */
function doorTrace(): { region: string; op: string; code: string } {
  const door = depthDoor();
  const region = door.from.region;
  const traces = bodyTracesIn(region).filter((t) => isAreaOp(region, t.op));
  const found = traces[0];
  if (!found) throw new Error(`${region} 의 Lock 에 몸에 보이는 흔적 자락이 없다`);
  return { region, ...found };
}
/** 그 자락 안의 설 자리들 */
const doorTraceSpots = (): XZ[] => {
  const { region, op } = doorTrace();
  const spots = spotsInAreaOp(region, op);
  if (spots.length === 0) throw new Error(`문 앞 자락 '${op}' 안에 걸어 설 자리가 없다`);
  return spots;
};
const insideDoorTrace = (): XZ => {
  const spots = doorTraceSpots();
  return minBy(spots, (p) => distanceBetween(p, depthDoorSpot()));
};

/** 재료의 Seed — 성질 태그가 붙는 자리 (State: MaterialSeed.properties?) */
interface PropertyTagShape {
  tag?: string;
  from?: string;
}
interface SeedShape {
  id?: string;
  properties?: readonly PropertyTagShape[];
  observableProperties?: Record<string, unknown>;
  [key: string]: unknown;
}
const seedOf = (id: string): SeedShape => {
  const found = (MATERIAL_SEEDS as unknown as readonly SeedShape[]).find((s) => s.id === id);
  if (!found) throw new Error(`MATERIAL_SEEDS 에 재료 '${id}' 가 없다`);
  return found;
};
const tagsOfSeed = (id: string): string[] => (seedOf(id).properties ?? []).map((p) => String(p.tag));
/**
 * 그 재료의 그 문장 — 다섯 항이 Seed 에 곧바로 실리든 observableProperties 아래 묶여 있든
 * 같은 답을 낸다. spec 은 "다섯 항 중 어느 문장에서 나왔는가" 까지만 못 박았다.
 */
function sentenceOf(seed: SeedShape, field: string): unknown {
  const nested = seed.observableProperties;
  if (nested && typeof nested === 'object' && field in nested) return nested[field];
  return seed[field];
}

/** 이 Cycle 이 옮겨 낸 두 표 — Lock 하나로 모였으므로 이름이 사라진다 (Reuse: graph.ts CHANGED) */
const movedTable = (name: string): unknown => (REGIONS as unknown as Record<string, unknown>)[name];

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 세계에 성질의 어휘가 하나 선다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 세계에 성질의 어휘가 하나 선다', () => {
  it('S-116 축 다섯과 관계 일곱이 세계 전체에 하나로 서고, 저마다 뜻과 근거를 진다', () => {
    // Given content/regions 가 어휘 하나를 낸다 (Region 전용이 아니다)
    const vocab = theVocabulary();
    // Then 축 다섯이 그 안에 있다
    for (const aspect of ASPECTS) {
      expect({ aspect, standing: idsOf(vocab.aspects).includes(aspect) }).toEqual({
        aspect,
        standing: true,
      });
    }
    // And 관계 일곱이 그 안에 있다
    for (const relation of RELATIONS) {
      expect({ relation, standing: idsOf(vocab.relations).includes(relation) }).toEqual({
        relation,
        standing: true,
      });
    }
    // And 항목마다 뜻과 근거가 함께 적힌다 (State: { id · meaning · basis })
    for (const entry of [...(vocab.aspects ?? []), ...(vocab.relations ?? [])]) {
      expect({
        id: entry.id,
        told: typeof entry.meaning === 'string' && entry.meaning.length > 0,
        based: typeof entry.basis === 'string' && entry.basis.length > 0,
      }).toEqual({ id: entry.id, told: true, based: true });
    }
  });

  it('S-117 요구에 대해 성질이 하는 일이 함께 적힌다 — 빙결 심층이 묻는 것에 답하는 성질이 있다', () => {
    const answers = theVocabulary().answers ?? [];
    expect({ standing: answers.length > 0 }).toEqual({ standing: true });
    // Then 줄마다 요구 · 성질 · 갈래 · 근거가 있고, 갈래는 셋 안의 값이다 (새 갈래를 짓지 않는다)
    for (const answer of answers) {
      expect({
        requirement: answer.requirement,
        property: answer.property,
        kindKnown: ANSWER_KINDS.includes(String(answer.kind)),
        based: typeof answer.basis === 'string' && answer.basis.length > 0,
      }).toEqual({
        requirement: answer.requirement,
        property: answer.property,
        kindKnown: true,
        based: true,
      });
      // And 요구도 성질도 어휘 안의 축:관계다
      for (const name of [answer.requirement, answer.property]) {
        const [aspect, relation] = String(name).split(':');
        expect({ name, known: ASPECTS.includes(aspect!) && RELATIONS.includes(relation!) }).toEqual({
          name,
          known: true,
        });
      }
    }
    // And 빙결 심층이 묻는 것(heat:hides)에 열을 저장하는 성질이 SUPPORTS 로 답한다
    expect(
      answers.some(
        (a) => a.requirement === ASKED && a.property === ANSWERING && a.kind === 'SUPPORTS',
      ),
    ).toBe(true);
  });

  it('S-118 (경계 ①) 규칙 코드도 기반도 요구의 이름을 알지 못한다 — 어휘를 갈아도 세계는 그대로 돈다', () => {
    // Given 어휘가 낼 수 있는 요구의 이름 전부 (축 × 관계)
    const vocab = theVocabulary();
    const names = idsOf(vocab.aspects).flatMap((aspect) =>
      idsOf(vocab.relations).map((relation) => `${aspect}:${relation}`),
    );
    expect({ counted: names.length > 0 }).toEqual({ counted: true });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const ROOT = resolve(HERE, '..', '..', '..');
    const CONTENT_WORLD = resolve(HERE, '..');
    const CONTENT_REGIONS = join(ROOT, 'content', 'regions');
    const ENGINE = join(ROOT, 'engine');
    /** 그 디렉터리의 .ts 를 전부 — tests/ 는 뺀다 (테스트는 이름을 알아도 된다 · c004 S-010) */
    function sourceFiles(dir: string, out: string[] = []): string[] {
      for (const entry of readdirSync(dir).sort()) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry === 'tests' || entry === 'node_modules') continue;
          sourceFiles(path, out);
        } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
          out.push(path);
        }
      }
      return out;
    }
    function nameHits(dir: string): string[] {
      const hits: string[] = [];
      for (const file of sourceFiles(dir)) {
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((text, index) => {
            for (const name of names) {
              if (text.includes(name)) {
                hits.push(`${relative(ROOT, file)}:${index + 1}  ${name}  │ ${text.trim()}`);
              }
            }
          });
      }
      return hits;
    }
    // Given 검사가 헛돌지 않는다 — 이름이 살아도 되는 자리(데이터)에서는 걸린다
    expect({ dataHits: nameHits(CONTENT_REGIONS).length > 0 }).toEqual({ dataHits: true });
    // Then 규칙 코드에도 기반에도 그 이름이 한 자리도 없다
    expect(nameHits(CONTENT_WORLD).join('\n')).toBe('');
    expect(nameHits(ENGINE).join('\n')).toBe('');
  });

  it('S-119 (경계 ②) 어느 Lock 도 요구하지 않는 항목이 있어도 세계는 그대로 선다', () => {
    // Given 지금 세계의 Lock 들이 요구하는 성질 이름들
    const asked = new Set(
      allLocks().flatMap((x) =>
        requirementsOf(x.lock, 'property').map((value) =>
          typeof value === 'string' ? value : JSON.stringify(value),
        ),
      ),
    );
    const vocab = theVocabulary();
    const names = idsOf(vocab.aspects).flatMap((aspect) =>
      idsOf(vocab.relations).map((relation) => `${aspect}:${relation}`),
    );
    // Then 아무도 요구하지 않는 항목이 남아 있다 (고아는 결손이 아니라 다음 행의 자리다)
    const orphans = names.filter((name) => ![...asked].some((text) => text.includes(name)));
    expect({ orphans: orphans.length > 0 }).toEqual({ orphans: true });
    // And 그래도 세계는 서고 관찰이 나온다
    expect(standingIn(WHITE_KING_DOMAIN).observe().scene).toBe(WHITE_KING_DOMAIN);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 요구가 한 형으로 적히고, 문의 열림은 한 값도 달라지지 않는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-002 요구가 한 형으로 적히고 문의 열림은 그대로다', () => {
  it('S-120 세 문의 조건이 Lock 하나로 모였다 — 흩어져 있던 두 표는 사라진다', () => {
    // Given 미로의 심장 문 · 걷는 숲의 문 · 빙결 심층의 문
    const maze = lockOn(MAZE_HEART_GATE);
    const forest = lockOn(WALKING_FOREST_DOOR);
    const depth = lockOn(depthDoor().id);
    for (const [id, found] of [
      [MAZE_HEART_GATE, maze],
      [WALKING_FOREST_DOOR, forest],
      [depthDoor().id, depth],
    ] as const) {
      expect({ id, locked: found !== undefined }).toEqual({ id, locked: true });
    }
    // Then 요구의 갈래가 spec 이 적은 그대로다 — 배열 · 철 · 철 + 성질
    expect({ state: declares(maze!.lock, 'state') }).toEqual({ state: true });
    expect(requirementText(maze!.lock, 'state')).toContain('P2');
    expect({ time: declares(forest!.lock, 'time') }).toEqual({ time: true });
    expect(requirementText(forest!.lock, 'time')).toContain(LONG_NIGHT);
    expect({
      time: declares(depth!.lock, 'time'),
      property: declares(depth!.lock, 'property'),
    }).toEqual({ time: true, property: true });
    expect(requirementText(depth!.lock, 'time')).toContain(LONG_NIGHT);
    expect(requirementText(depth!.lock, 'property')).toContain(ASKED);
    // And Lock 마다 흔적이 하나 이상이고, 그 op 이 그 방에 실제로 있다
    for (const { region, lock } of [maze!, forest!, depth!]) {
      const traces = lock.traces ?? [];
      expect({ id: lock.id, traced: traces.length > 0 }).toEqual({ id: lock.id, traced: true });
      for (const trace of traces) {
        const op = spaceOf(region).ops.find((o) => o.id === trace.op);
        expect({ region, op: trace.op, placed: op !== undefined }).toEqual({
          region,
          op: trace.op,
          placed: true,
        });
      }
    }
    // And 흩어져 있던 두 표는 세계에 남지 않는다 (요구를 읽는 자리는 이제 하나다)
    expect({
      activations: movedTable('CONNECTOR_ACTIVATIONS'),
      requirements: movedTable('CONNECTOR_REQUIREMENTS'),
    }).toEqual({ activations: undefined, requirements: undefined });
  });

  it('S-121 미로의 심장 문은 배열 P2 에서만 열리고 사유는 "잠겨 있다" 그대로다', () => {
    const patterns = regionSpec(FANTASY_MAZE)!.rule!.patterns.map((p) => p.name);
    const asked = requirementText(lockOn(MAZE_HEART_GATE)!.lock, 'state');
    const opening = patterns.filter((name) => asked.includes(`"${name}"`));
    // Given 그 Lock 이 밝힌 배열은 P2 하나다
    expect(opening).toEqual(['P2']);
    for (const pattern of patterns) {
      const w = standingIn(FANTASY_MAZE, connectorSpot(MAZE_HEART_GATE, FANTASY_MAZE), {
        regionPatterns: { [FANTASY_MAZE]: pattern },
      });
      const open = pattern === 'P2';
      // Then 열림도 사유도 옮기기 전과 같다 (C009 가 세운 그대로)
      expect({ pattern, state: exitOf(w.observe(), MAZE_HEART_GATE)?.state }).toEqual({
        pattern,
        state: open ? 'open' : 'locked',
      });
      expect({ pattern, reason: transitTo(w.observe(), MAZE_HEART_GATE)?.reason }).toEqual({
        pattern,
        reason: open ? undefined : CONNECTOR_INACTIVE,
      });
      if (!open) {
        expect({ pattern, ...cross(w, MAZE_HEART_GATE) }).toEqual({
          pattern,
          status: 'failure',
          rule: 'RULE-REGION-TRANSIT-001',
          reason: CONNECTOR_INACTIVE,
        });
      }
    }
  });

  it('S-122 걷는 숲의 문은 긴 밤에만 열리고 사유는 "이 철이 아니다" 그대로다', () => {
    const door = REGION_GRAPH.connectors.find((c) => c.id === WALKING_FOREST_DOOR)!;
    for (const season of SEASONS) {
      const w = inSeason(season, door.from.region, connectorSpot(door.id, door.from.region));
      const open = season === LONG_NIGHT;
      expect({ season, state: exitOf(w.observe(), door.id)?.state }).toEqual({
        season,
        state: open ? 'open' : 'locked',
      });
      if (!open) {
        expect({ season, reason: reasonOf(cross(w, door.id)) }).toEqual({
          season,
          reason: NOT_THIS_SEASON,
        });
      }
    }
  });

  it('S-123 빙결 심층의 문도 긴 밤에만 열린다 — 답도 사유도 옮기기 전과 같다', () => {
    const id = depthDoor().id;
    const room = depthDoor().from.region;
    for (const season of SEASONS) {
      const w = inSeason(season, room, depthDoorSpot());
      const open = season === LONG_NIGHT;
      expect({ season, state: exitOf(w.observe(), id)?.state }).toEqual({
        season,
        state: open ? 'open' : 'locked',
      });
      // 긴 밤의 거절은 철이 아니라 "그 너머를 아직 짓지 않았다" 다 (C020 · C021 그대로)
      expect({ season, reason: reasonOf(cross(w, id)) }).toEqual({
        season,
        reason: open ? REGION_NOT_BUILT : NOT_THIS_SEASON,
      });
    }
  });

  it('S-124 (경계 ①) Lock 을 갖지 않은 문은 어느 철에도 열려 있다', () => {
    const plain = REGION_GRAPH.connectors.filter(
      (c) => lockOn(c.id) === undefined && regionSpec(c.from.region) !== undefined,
    );
    expect({ some: plain.length > 0 }).toEqual({ some: true });
    for (const connector of plain.slice(0, 4)) {
      for (const season of SEASONS) {
        const w = inSeason(
          season,
          connector.from.region,
          connectorSpot(connector.id, connector.from.region),
        );
        expect({ id: connector.id, season, state: exitOf(w.observe(), connector.id)?.state }).toEqual(
          { id: connector.id, season, state: 'open' },
        );
      }
    }
  });

  it('S-125 (경계 ②) property 요구는 열림을 판정하지 않는다 — 밝힌 문도 밝히지 않은 문과 같은 답이다', () => {
    const depth = lockOn(depthDoor().id)!.lock;
    const forest = lockOn(WALKING_FOREST_DOOR)!.lock;
    // Given 하나는 성질을 묻고 하나는 묻지 않는다. 둘 다 밝힌 철은 긴 밤 하나다
    expect({
      depthProperty: declares(depth, 'property'),
      forestProperty: declares(forest, 'property'),
    }).toEqual({ depthProperty: true, forestProperty: false });
    const forestDoor = REGION_GRAPH.connectors.find((c) => c.id === WALKING_FOREST_DOOR)!;
    for (const season of SEASONS) {
      const asked = inSeason(season, depthDoor().from.region, depthDoorSpot());
      const plain = inSeason(
        season,
        forestDoor.from.region,
        connectorSpot(forestDoor.id, forestDoor.from.region),
      );
      // Then 두 문의 열림이 철마다 같다 — 성질을 물었다고 갈리지 않는다
      expect({ season, state: exitOf(asked.observe(), depthDoor().id)?.state }).toEqual({
        season,
        state: exitOf(plain.observe(), forestDoor.id)?.state,
      });
    }
    // And 손에 무엇을 들고 와도 같은 답이다 (요구를 채우는 것은 이 층의 일이 아니다 · K12)
    const empty = inSeason(LONG_NIGHT, depthDoor().from.region, depthDoorSpot());
    const carrying = inSeason(LONG_NIGHT, depthDoor().from.region, depthDoorSpot(), {
      actorItems: { pickaxe: 3 },
    });
    expect(exitOf(carrying.observe(), depthDoor().id)?.state).toBe(
      exitOf(empty.observe(), depthDoor().id)?.state,
    );
    expect(reasonOf(cross(carrying, depthDoor().id))).toBe(reasonOf(cross(empty, depthDoor().id)));
  });

  it('S-126 (경계 ③) 저장되는 State 가 하나도 늘지 않는다 — 되살린 세계도 같은 답을 낸다', () => {
    const id = depthDoor().id;
    const room = depthDoor().from.region;
    const at = insideDoorTrace();
    const w = inSeason(LONG_NIGHT, room, at);
    const answer = (d: WorldDriver) => ({
      state: exitOf(d.observe(), id)?.state,
      exit: codesOn(exitOf(d.observe(), id)),
      body: codesOn(myBody(d)),
    });
    const before = answer(w);
    // Given 문 앞에 선 그 세계는 코드 둘을 다 말한다 (C031 AFFECTED — 이 자리는 눈보라 자락
    // 안이라 문의 사유가 완화된 것으로 **대신** 실린다. 코드 둘이 다 선다는 이 항의 주장도 ·
    // 그것이 저장되지 않는 유도된 사실이라는 주장도 그대로다)
    expect({
      exit: before.exit.includes(ASKS_WARMTH_WEAK),
      body: before.body.includes(BREATH_GLOWS),
    }).toEqual({ exit: true, body: true });
    // When 저장한다
    const stored = JSON.stringify(throughFile(w.world.snapshot()));
    // Then 저장된 것 어디에도 이 Cycle 의 코드도 요구의 이름도 없다 — 전부 유도된 사실이다
    for (const word of [BREATH_GLOWS, ASKS_WARMTH, ASKS_WARMTH_WEAK, ASKED]) {
      expect({ word, stored: stored.includes(word) }).toEqual({ word, stored: false });
    }
    // And 되살린 세계가 한 값도 다르지 않은 답을 낸다
    expect(answer(revive(w))).toEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 문 앞의 현상 · 몸이 그것을 보인다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 문 앞의 현상 — 몸이 그것을 보인다', () => {
  it('S-127 그 자락에 선 몸에 그 흔적이 밝힌 코드가 실린다', () => {
    const { region, code } = doorTrace();
    // Given 데이터가 밝힌 코드는 spec 이 이름한 그것이다
    expect(code).toBe(BREATH_GLOWS);
    // When 긴 밤에 그 자락 안에 선다
    const w = inSeason(LONG_NIGHT, region, insideDoorTrace());
    // Then 내 몸의 조건 코드에 그것이 실린다
    expect(codesOn(myBody(w))).toContain(BREATH_GLOWS);
    // And 철이 그것을 정하지 않는다 — 자락과 몸이 정한다 (Lock 의 흔적은 요구와 따로다)
    for (const season of SEASONS) {
      const each = inSeason(season, region, insideDoorTrace());
      expect({ season, carried: codesOn(myBody(each)).includes(BREATH_GLOWS) }).toEqual({
        season,
        carried: true,
      });
    }
  });

  it('S-128 (경계 ①) 자락 밖으로 걸어 나오면 사라진다 — 저장되지 않는 유도된 사실이다', () => {
    const { region, op } = doorTrace();
    const at = insideDoorTrace();
    const out = outsideAreaOp(region, op, at);
    const w = inSeason(LONG_NIGHT, region, at);
    expect(codesOn(myBody(w))).toContain(BREATH_GLOWS);
    // When 걸어서 자락 밖으로 나온다
    walkTo(w, out);
    // Then 그 코드가 사라진다 — 내가 서야 참인 말이다
    expect(codesOn(myBody(w))).not.toContain(BREATH_GLOWS);
    // And 다시 들어가면 다시 실린다
    walkTo(w, at);
    expect(codesOn(myBody(w))).toContain(BREATH_GLOWS);
  });

  it('S-129 (경계 ③) 그 자락에 든 **모든 몸**에 실린다 — 관찰자 자신의 것만이 아니다', () => {
    const { region } = doorTrace();
    const spots = doorTraceSpots();
    const mine = insideDoorTrace();
    // Given 같은 자락 안의 다른 자리에 선 다른 몸 하나
    const theirs = spots.reduce(
      (best, p) => (distanceBetween(p, mine) > distanceBetween(best, mine) ? p : best),
      mine,
    );
    expect({ apart: distanceBetween(theirs, mine) > 0 }).toEqual({ apart: true });
    const w = withOtherBody(LONG_NIGHT, region, mine, theirs);
    const bodies = bodiesIn(w.observe());
    // Then 실린 몸이 둘이고 둘 다 그 코드를 진다
    expect({ bodies: bodies.length >= 2 }).toEqual({ bodies: true });
    for (const body of bodies) {
      expect({ id: body.id, carried: codesOn(body).includes(BREATH_GLOWS) }).toEqual({
        id: body.id,
        carried: true,
      });
    }
  });

  it('S-130 (경계 ②) 몸이 아닌 것에는 어느 자리에서도 실리지 않는다', () => {
    const { region } = doorTrace();
    const w = inSeason(LONG_NIGHT, region, insideDoorTrace());
    const v = w.observe();
    // Given 그 자락 안에서 본다 — 내 몸에는 실려 있다
    expect(codesOn(myBody(w))).toContain(BREATH_GLOWS);
    // Then 몸이 아닌 것(원천 · 출구 표식)에는 하나도 실리지 않는다
    for (const seen of notBodiesIn(v)) {
      expect({ id: seen.id, role: seen.role, carried: codesOn(seen).includes(BREATH_GLOWS) }).toEqual(
        { id: seen.id, role: seen.role, carried: false },
      );
    }
    // And 그 문의 표식도 마찬가지다 — 그것이 지는 것은 자기 현상의 코드뿐이다
    const door = exitOf(v, depthDoor().id);
    expect({ standing: door !== undefined }).toEqual({ standing: true });
    expect(codesOn(door)).not.toContain(BREATH_GLOWS);
    // And 「걸린 것」 에도 실리지 않는다 — 실리는 자리를 몸의 투영에만 둔다 (R2 경계 ①)
    expect(v.standingConditions).not.toContain(BREATH_GLOWS);
  });

  it('S-131 (경계 ④) 보일 것을 밝히지 않은 흔적은 몸에 아무것도 걸지 않는다', () => {
    const { region, op } = doorTrace();
    // Given 그 방의 Lock 들이 밝힌 **몸에 보이는** 코드는 그 하나뿐이다
    const declared = new Set(bodyTracesIn(region).map((t) => t.code));
    expect([...declared]).toEqual([BREATH_GLOWS]);
    // And 이 세계에는 보일 것을 밝히지 않은 흔적이 남아 있다 (언 사체의 자리 · 미로의 식물 · 숲의 흙)
    const silent = allLocks().flatMap((x) =>
      (x.lock.traces ?? [])
        .filter((trace) => bodyCodeOf(trace) === undefined)
        .map((trace) => ({ region: x.region, op: String(trace.op) })),
    );
    expect({ silent: silent.length > 0 }).toEqual({ silent: true });
    // Then 그 자락(또는 자리) 곁에 선 몸에는 한 글자도 늘지 않는다
    for (const one of silent.filter((s) => regionSpec(s.region) !== undefined)) {
      const spots = isAreaOp(one.region, one.op) ? spotsInAreaOp(one.region, one.op) : [];
      const at = spots[Math.floor(spots.length / 2)];
      if (!at) continue;
      const w = inSeason(LONG_NIGHT, one.region, at);
      expect({ region: one.region, op: one.op, codes: codesOn(myBody(w)) }).toEqual({
        region: one.region,
        op: one.op,
        codes: [],
      });
    }
    // And 그 방 안이라도 자락 밖이면 실리지 않는다 — 방이 아니라 **자락**이 정한다
    const outside = walkableSpots(region).filter(
      (p) => !spotsInAreaOp(region, op).some((q) => distanceBetween(p, q) < 1e-9),
    );
    for (const at of [outside[0]!, outside[Math.floor(outside.length / 2)]!, outside.at(-1)!]) {
      const w = inSeason(LONG_NIGHT, region, at);
      expect(codesOn(myBody(w))).not.toContain(BREATH_GLOWS);
    }
  });

  it.todo(
    'GAP: 밝힌 op 이 그 방에 없는 흔적이 아무 일도 하지 않는다(R2 경계 ③) — content/regions 는 정적으로 ' +
      '읽히는 데이터라 WorldSetup 에 그런 Lock 을 세울 손잡이가 없다. 이 파일은 "지금 밝힌 op 이 ' +
      '그 방에 실제로 있다"(S-120) 까지만 잰다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 지목하면 현상을 말한다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 지목하면 현상을 말한다', () => {
  it('S-132 빙결 심층 문의 표식에 현상의 코드가 실린다 — 요구의 이름은 거둬졌다', () => {
    const id = depthDoor().id;
    const room = depthDoor().from.region;
    // Given 그 Lock 이 현상의 코드를 밝힌다
    const lock = lockOn(id)!.lock;
    expect({ id, reason: lock.reason }).toEqual({ id, reason: ASKS_WARMTH });
    for (const season of SEASONS) {
      const seen = exitOf(inSeason(season, room, depthDoorSpot()).observe(), id);
      expect({ season, standing: seen !== undefined }).toEqual({ season, standing: true });
      // Then 열려 있든 잠겼든 그 표식이 현상의 코드를 진다 (C031 AFFECTED — 문 앞의 이 자리는
      // 눈보라 자락 안이라 밝힌 사유를 **대신하는** 완화된 코드가 실린다. 재는 사실은 그대로다:
      // 어느 철에도 표식이 그 문의 사유를 지고, 그것이 열림을 한 값도 판정하지 않는다)
      expect({ season, carried: codesOn(seen).includes(ASKS_WARMTH_WEAK) }).toEqual({
        season,
        carried: true,
      });
      // And 대신 선 것이므로 밝힌 사유가 곁에 함께 서지 않는다 (둘이 함께 서지 않는다)
      expect({ season, both: codesOn(seen).includes(ASKS_WARMTH) }).toEqual({
        season,
        both: false,
      });
      // And C020 이 싣던 요구의 이름은 더 이상 실리지 않는다
      expect({ season, old: codesOn(seen).includes(OLD_REQUIREMENT_CODE) }).toEqual({
        season,
        old: false,
      });
    }
  });

  it('S-133 (경계 ①) 요구의 이름도 · 답이 될 성질도 · 답의 자리도 어디에도 실리지 않는다', () => {
    const { region } = doorTrace();
    // Given 문 앞의 자락에 선 세계 — 이 Cycle 이 말하는 것이 전부 실린 자리다
    const v = inSeason(LONG_NIGHT, region, insideDoorTrace()).observe();
    const text = JSON.stringify(v);
    const vocab = theVocabulary();
    const names = idsOf(vocab.aspects).flatMap((aspect) =>
      idsOf(vocab.relations).map((relation) => `${aspect}:${relation}`),
    );
    // Then 관찰 결과 어디에도 축:관계의 이름이 없다 (요구도 · 답도 · answers 표도)
    for (const name of names) {
      expect({ name, projected: text.includes(name) }).toEqual({ name, projected: false });
    }
    // And 건너간 뒤의 방은 실리지 않는다 — 관찰은 내가 선 방으로 잘린다 (C001 R6).
    // **문의 id 는 세지 않는다**: 출구 표식의 id 는 그 Connector 의 id 이고(C001 부터),
    // 그 이름이 저쪽 방의 이름을 품은 것은 C020 이 그 문을 그렇게 부른 결과다 —
    // 문의 이름이지 목적지의 투영이 아니다.
    const doorId = depthDoor().id;
    const beyond = JSON.stringify(v, (_k, value) => (value === doorId ? '' : value));
    expect({ where: beyond.includes(FROST_DEPTH) }).toEqual({ where: false });
  });

  it('S-134 (경계 ②) 현상을 밝히지 않은 Lock 이 걸린 문의 표식은 한 값도 달라지지 않는다', () => {
    // Given 현상의 코드를 밝힌 Lock 은 빙결 심층의 문 하나뿐이다
    const withReason = allLocks().filter((x) => typeof x.lock.reason === 'string');
    expect(withReason.map((x) => x.lock.at?.ref)).toEqual([depthDoor().id]);
    // Then 미로의 심장 문과 걷는 숲의 문의 표식에는 조건 자리 자체가 없다
    const maze = standingIn(FANTASY_MAZE, connectorSpot(MAZE_HEART_GATE, FANTASY_MAZE), {
      regionPatterns: { [FANTASY_MAZE]: 'P2' },
    });
    expect(exitOf(maze.observe(), MAZE_HEART_GATE)?.conditions).toBeUndefined();
    const forestDoor = REGION_GRAPH.connectors.find((c) => c.id === WALKING_FOREST_DOOR)!;
    const forest = inSeason(
      LONG_NIGHT,
      forestDoor.from.region,
      connectorSpot(forestDoor.id, forestDoor.from.region),
    );
    expect(exitOf(forest.observe(), forestDoor.id)?.conditions).toBeUndefined();
    // And 앞의 방들의 출구에도 그 자리가 서지 않는다 (C020 S-095 의 어법 그대로)
    for (const region of ROOMS_WITH_ENTITY_BASELINE) {
      for (const exit of exitsIn(standingIn(region).observe())) {
        expect({ region, id: exit.id, conditions: exit.conditions }).toEqual({
          region,
          id: exit.id,
          conditions: undefined,
        });
      }
    }
  });

  it('S-135 (경계 ③) 그 코드는 문의 열림을 한 값도 건드리지 않는다', () => {
    const id = depthDoor().id;
    const room = depthDoor().from.region;
    const forestDoor = REGION_GRAPH.connectors.find((c) => c.id === WALKING_FOREST_DOOR)!;
    for (const season of SEASONS) {
      const asked = inSeason(season, room, depthDoorSpot());
      const plain = inSeason(
        season,
        forestDoor.from.region,
        connectorSpot(forestDoor.id, forestDoor.from.region),
      );
      // Then 현상을 밝힌 문과 밝히지 않은 문이 철마다 같은 답을 낸다
      expect({
        season,
        asked: exitOf(asked.observe(), id)?.state,
        plain: exitOf(plain.observe(), forestDoor.id)?.state,
      }).toEqual({
        season,
        asked: season === LONG_NIGHT ? 'open' : 'locked',
        plain: season === LONG_NIGHT ? 'open' : 'locked',
      });
      // And 표식이 코드를 지는 것과 무관하게 사유도 그대로다 — 현상을 밝힌 문과
      // 밝히지 않은 문이 **같은 사유**를 낸다. 긴 밤에 둘 다 열리고, 열린 뒤의 거절은
      // 둘 다 "아직 짓지 않은 곳" 이다 (S-123 이 그 답을 이미 잰다)
      expect({
        season,
        asked: transitTo(asked.observe(), id)?.reason,
        plain: transitTo(plain.observe(), forestDoor.id)?.reason,
      }).toEqual({
        season,
        asked: season === LONG_NIGHT ? REGION_NOT_BUILT : NOT_THIS_SEASON,
        plain: season === LONG_NIGHT ? REGION_NOT_BUILT : NOT_THIS_SEASON,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 — 재료가 성질을 지고, 판이 그것을 말한다
//
// 판의 줄(재료의 이름 · 성질 문장 · 없는 것을 지어내지 않음)은 View 의 표가 짓는다.
// 세계 쪽에서 잴 수 있는 것은 그 판이 읽는 것 — 재료의 코드와 그 재료가 진 성질 데이터다.
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-005 재료가 성질을 진다', () => {
  it('S-136 성질을 밝힌 재료마다 태그가 서고, 태그마다 그 재료의 문장 하나를 가리킨다', () => {
    for (const [material, tags] of Object.entries(MATERIAL_PROPERTIES)) {
      const seed = seedOf(material);
      // Then 그 재료의 성질 태그가 spec 이 적은 그대로다 (차례는 데이터가 정한다 — 집합으로 본다)
      expect({ material, tags: tagsOfSeed(material).sort() }).toEqual({
        material,
        tags: [...tags].sort(),
      });
      // And 태그마다 다섯 항 가운데 하나를 가리키고, 그 문장이 실제로 있다
      for (const property of seed.properties ?? []) {
        expect({
          material,
          tag: property.tag,
          field: property.from,
          known: SENTENCE_FIELDS.includes(String(property.from)),
        }).toEqual({ material, tag: property.tag, field: property.from, known: true });
        // **문장 자체는 세계 데이터에 없다.** 태그가 가리키는 것은 다섯 항 가운데
        // 하나이고(위 단언), 그 항의 말을 사람의 문장으로 옮기는 것은 View 의 표다
        // (재료 이름 · 형태 코드 · 조건 코드가 그런 그대로). 같은 태그라도 재료마다
        // 다른 말이 나온다는 것은 그 표를 읽는 자리에서 잰다.
      }
      // And 태그의 이름은 어휘 안의 축:관계다
      for (const tag of tags) {
        const [aspect, relation] = tag.split(':');
        expect({ tag, known: ASPECTS.includes(aspect!) && RELATIONS.includes(relation!) }).toEqual({
          tag,
          known: true,
        });
      }
    }
  });

  it('S-137 (경계 ①) 성질을 밝히지 않은 재료는 태그를 하나도 지지 않는다', () => {
    expect({
      material: WITHOUT_PROPERTIES,
      tags: tagsOfSeed(WITHOUT_PROPERTIES),
    }).toEqual({ material: WITHOUT_PROPERTIES, tags: [] });
  });

  it('S-138 (경계 ②) 재료가 아닌 것에는 재료의 자리가 아예 없다 — 원천에는 있던 그대로 있다', () => {
    const w = standingIn(FOREST_EDGE);
    const v = w.observe();
    // Then 원천은 자기 재료의 코드를 진다 (C011 이 세운 자리 그대로)
    const sources = sourcesIn(v);
    expect({ standing: sources.length > 0 }).toEqual({ standing: true });
    for (const source of sources) {
      expect({ id: source.id, told: typeof source.material === 'string' }).toEqual({
        id: source.id,
        told: true,
      });
    }
    // And 몸에도 출구 표식에도 그 자리가 없다
    for (const seen of [...bodiesIn(v), ...exitsIn(v)]) {
      expect({ id: seen.id, role: seen.role, material: seen.material }).toEqual({
        id: seen.id,
        role: seen.role,
        material: undefined,
      });
    }
  });

  it.todo(
    'GAP: 지목한 판의 줄(재료의 이름 · 성질 문장 · 쓰임 없음 · 같은 태그라도 재료마다 다른 말)은 ' +
      'View 의 표가 짓는다 — 이 하네스는 세계의 투영만 읽으므로 판을 재지 못한다. 세계 쪽에서는 ' +
      '판이 읽는 것(entities[].material · Seed 의 성질 태그)까지가 전부다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — SPEC-007 앞의 세계는 그대로다
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('S-139 방들의 hash · 표면 태그 · 통행이 한 값도 달라지지 않는다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      if (base.hash !== undefined) {
        expect({ region, hash: descriptionHash(spaceOf(region)) }).toEqual({ region, hash: base.hash });
      }
      expect({ region, surface: surfaceCounts(region) }).toEqual({ region, surface: base.surface });
      expect({ region, walkable: walkableSpots(region).length }).toEqual({
        region,
        walkable: base.traversable,
      });
    }
  });

  it('S-140 방마다 출구의 차례와 실리는 것의 차례가 그대로다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({ region, exits: exitsOf(REGION_GRAPH, region).map((e) => e.connector.id) }).toEqual({
        region,
        exits: base.exits,
      });
    }
    for (const region of ROOMS_WITH_ENTITY_BASELINE) {
      expect({ region, entities: entityLines(standingIn(region).observe()) }).toEqual({
        region,
        entities: [...BASELINE[region]!.entities],
      });
    }
  });

  it('S-141 방마다의 원천 이름이 그대로고, 그 phase 는 어느 철에도 같다', () => {
    // Given 이 Cycle 앞의 원천 이름들 (C020 시나리오의 표에서 그대로 왔다 — 이 Cycle 은
    //       Seed 에 성질을 붙일 뿐 원천을 하나도 세우거나 옮기지 않는다)
    for (const [region, ids] of Object.entries(SOURCE_BASELINE)) {
      const standing = (regionSpec(region)?.resourceEcology?.sources ?? [])
        .map((s) => s.id)
        .sort();
      expect({ region, sources: standing }).toEqual({ region, sources: [...ids].sort() });
    }
    // Then 아무것도 캐지 않은 세계에서 그 phase 와 캔 횟수가 철 넷에 한 값도 다르지 않다
    const tableOf = (season: SeasonId) => {
      const w = inSeason(season, WHITE_KING_DOMAIN);
      return REGION_SPECS.flatMap((spec) =>
        (spec.resourceEcology?.sources ?? []).map((source) => {
          const phase = sourceStateOf(statesOf(w), spec.id, source.id) as {
            phase: string;
            taken: number;
          };
          return `${spec.id}/${source.id}=${phase.phase}:${phase.taken}`;
        }),
      );
    };
    const first = tableOf(SEASONS[0]!);
    expect({ counted: first.length > 0 }).toEqual({ counted: true });
    for (const season of SEASONS) expect({ season, table: tableOf(season) }).toEqual({ season, table: first });
  });

  it('S-142 C019 가 세운 협곡의 상시 위상(관찰 범위까지)이 그대로다', () => {
    for (const [region, base] of Object.entries(CANYON_STANDING_BASELINE)) {
      const standing = (regionSpec(region)?.phases as { standing?: unknown } | undefined)?.standing;
      expect({ region, standing }).toEqual({ region, standing: base });
    }
  });

  it('S-143 이 Cycle 의 코드 둘은 앞의 방 어디에도 실리지 않는다', () => {
    for (const region of ROOMS_WITH_ENTITY_BASELINE) {
      const w = standingIn(region);
      const v = w.observe();
      const text = JSON.stringify(v);
      for (const code of [BREATH_GLOWS, ASKS_WARMTH]) {
        expect({ region, code, seen: text.includes(code) }).toEqual({ region, code, seen: false });
      }
      // And 그 방에 선 몸에는 조건 자리 자체가 서지 않는다
      expect({ region, codes: codesOn(myBody(w)) }).toEqual({ region, codes: [] });
    }
  });

  it('S-144 걸어 다녀도 앞의 방에서는 아무것도 늘지 않는다 — 자락은 협곡의 것뿐이다', () => {
    // Given 몸에 보이는 흔적을 밝힌 방은 이 세계에 하나뿐이다
    const rooms = REGION_SPECS.filter((spec) => bodyTracesIn(spec.id).length > 0).map((s) => s.id);
    expect(rooms).toEqual([doorTrace().region]);
    // Then 다른 방을 한동안 걸어도 몸에는 한 글자도 늘지 않는다
    const w = standingIn(FOREST_DEEP);
    const spots = walkableSpots(FOREST_DEEP);
    walkTo(w, spots[Math.floor(spots.length / 3)]!);
    tickFor(w, 5);
    expect(codesOn(myBody(w))).toEqual([]);
  });
});
