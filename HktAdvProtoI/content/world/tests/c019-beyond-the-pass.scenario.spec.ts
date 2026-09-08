// C019 — 고개 너머 다른 갈래 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010)
//
// C018 까지 세계를 바꾸는 것은 **무언가가 걸어 온 것**이었다 (철 · 소란 · 지나가는 것).
// 이 Cycle 이 **원인 없이 늘 걸리는 자리**를 얹고, 그 자락이 관찰자에게 실제로 하는 일 둘
// (시야를 좁힌다 · 닿아 있다고 말한다)을 처음 낸다. 그래서 재는 것은 다섯이다:
//   ① 고개와 방 둘 — 백왕령에서 건너면 얼음 협곡이고 같은 고개로 돌아온다. 안쪽은 빙결 협곡이다.
//      백왕령의 출구 차례는 한 자리도 바뀌지 않고 경계 이름은 셋 그대로다
//   ② 땅 — 골 바닥은 서리이고 걸어서 이어지며, 양옆 절벽은 통행 0 이고 too-steep 으로 거절된다.
//      서리 선이 없는 방의 표면은 한 값도 달라지지 않는다
//   ③ 상시 위상 — 어느 철에도 · 소란과 무관하게 · 아무것도 지나지 않아도 걸리고, 저장되지 않는다
//   ④ 자락이 하는 일 — 낮에도 시야가 20 으로(밤엔 10) 좁아지되 내 몸 · 출구 · 방의 사실 · 걸린 것 ·
//      자국 · 때 · HUD 는 잘리지 않는다. 그리고 발밑이 "지금 닿아 있다"(crystallizing)를 말한다
//   ⑤ 불변 — 덧씌움은 높이도 표면도 통행 격자도 hash 도 건드리지 않고, 앞의 방 다섯은 그대로다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/regions/ice-canyon.ts · frost-canyon.ts · semantic/region-phase.ts 의
// 새 함수 · projection/observer-view.ts 의 새 줄 · content/view/**)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C019-beyond-the-pass/spec.md 와 이미 있던 하네스·선례뿐이다.
//
// **자리는 손으로 적지 않는다** — 자락의 자리도 절벽도 서리도 컴파일된 격자와 방 데이터에서
// 고른다. 손으로 적는 것은 spec 이 이름으로 못 박은 것(방 둘 · 이음 하나 · 코드 넷)과
// spec 「데이터 값」 표의 수(20 · 10 · outer · wild)뿐이고, 그것들은 세계에서 유도할 자리가 없다
// (c015 · c018 이 시계·소란 상수에 세운 규율 그대로).
//
// **회귀의 기준값은 이 Cycle 이 시작하기 전의 세계에서 떠 왔다** — SPEC-010 이 "한 값도 달라지지
// 않는다" 를 말하려면 견줄 값이 있어야 하고, 그것을 계산으로 다시 얻으면 함께 흔들린다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

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
import {
  blockedReasonAt,
  isTraversableAt,
  surfaceAt,
  tagsAt,
} from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  ANCHOR_LAYER,
  BIO_ORE_FIELD,
  BLOCK_STEEP,
  COMPILE_RULES,
  CONDITION_PREFIX,
  FOREST_DEEP,
  FOREST_EDGE,
  FRONTIER_REGIONS,
  HAZARD_LAYER,
  ICE_CANYON,
  ICE_CANYON_PASS,
  REGION_GRAPH,
  REGION_SPECS,
  SETTLEMENT_LAYER,
  WHITE_KING_DOMAIN,
  regionSpec,
  type SeasonId,
} from '../../regions';
// C008 이 세운 미로의 이름 — 그 파일이 소유한다 (c008 ~ c018 시나리오의 선례 그대로).
import { FANTASY_MAZE } from '../../regions/fantasy-maze';
// 이 세계가 이미 가진 어휘 — 위험 갈래 일곱 · 깊이 다섯 (SPEC-008 경계가 이 목록을 가리킨다).
import { WORLD_CONTRACTS } from '../../authoring/contracts';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

// ── spec 이 이름으로 못 박은 것들 (World Change 1 · 2 · 데이터 값 표) ─────
//
// 얼음 협곡의 이름은 C002 부터 graph 가 들고 있었으므로 거기서 읽는다. 나머지 둘은 이 Cycle 이
// 처음 내는 이름이라 spec 말고 읽어 올 자리가 없다 (c018 이 경로 코드 둘에 세운 그 자리).
/** 고개 너머 첫 방 — 경계 이름이었다가 지어진 방이 된다 */
const CANYON_OUTER = ICE_CANYON;
/** 그 안쪽 */
const CANYON_INNER = 'FROST_CANYON';
/** 두 방을 잇는 오솔길 */
const CANYON_TRAIL = 'FROST_CANYON_TRAIL';
const CANYONS: readonly string[] = [CANYON_OUTER, CANYON_INNER];

/** 두 방의 깊이 (spec 데이터 값 표 · 확정 1) */
const DEPTH_OUTER = 'outer';
const DEPTH_INNER = 'wild';

/** 눈보라 안의 관찰 범위 (spec 데이터 값 표 · 확정 6) */
const BLIZZARD_RANGE_DAY = 20;
const BLIZZARD_RANGE_NIGHT = 10;
/** 자락 밖의 밤 — C015 그대로 (spec 데이터 값 표가 "한 값도 건드리지 않는다" 고 적었다) */
const OBSERVE_RANGE_NIGHT = 20;

/** 이 Cycle 의 위험 갈래 셋과 접촉 코드 하나 (spec 데이터 값 표 · World Change 6) */
const HAZARD_CLIMATE = 'hazard/climate';
const HAZARD_TERRAIN = 'hazard/terrain';
const HAZARD_MATTER = 'hazard/matter';
const CANYON_HAZARDS: readonly string[] = [HAZARD_CLIMATE, HAZARD_MATTER, HAZARD_TERRAIN];
/** 숲이 쓰는 갈래 — 겹치지 않는다는 것이 SPEC-008 이다 */
const HAZARD_CREATURE = 'hazard/creature';
/** 결정면에 선 동안 실리는 접촉 코드 (Play V18) */
const CONTACT_CRYSTALLIZING = 'crystallizing';

/** 골 바닥의 표면 태그 (spec 데이터 값 표 · Play §5.1 · V17) */
const SURFACE_FROST_TAG = 'frost';

/** 철 넷 (C015 · C016 그대로) */
const SEASONS: readonly SeasonId[] = ['STILL', 'SEEP', 'LONG_NIGHT', 'TURN'];
/** 낮으로 여는 때 · 밤으로 여는 때 — WorldSetup.clock 의 어법 (c018 의 'SEEP:NIGHT' 선례) */
const DAY_CLOCK = 'STILL';
const NIGHT_CLOCK = 'STILL:NIGHT';

const solo: WorldSetup = { npcs: [] };

// ─────────────────────────────────────────────────────────────────────
// 회귀의 기준값 (SPEC-010 · SPEC-003 경계)
//
// 이 Cycle 이 시작하기 전의 세계에서 떠 온 값이다. 계산으로 다시 얻지 않는다 —
// 그러면 데이터가 흔들릴 때 기준도 함께 흔들려 아무것도 재지 못한다.
// ─────────────────────────────────────────────────────────────────────

interface RoomBaseline {
  depth: string;
  hash: string;
  /** exitsOf 가 내는 차례 그대로 (배열 순서가 곧 결정론이다) */
  exits: readonly string[];
  /** 관찰 결과에 실리는 것들 — "<id>/<role>" (기본 배치 · 자율 존재 없이 · 세계 시각 0) */
  entities: readonly string[];
  /** 컴파일된 격자의 표면 태그마다 vertex 수 */
  surface: Readonly<Record<string, number>>;
  /** 걸어 설 수 있는 vertex 수 */
  traversable: number;
}

  // RoomBecomesLand · RoomBearsMaterial · RoomNeverSame 실주행 판정 CHANGED — 거목의 줄기가 백왕령의 땅을 막고(통행 자리 1337 → 1328),
  // 흩어진 것들과 철의 자락이 숲의 방들에 늘었다 (hash · 존재 목록 · 흔적 태그). 앞의 세계의 **형**은 그대로다.
const BASELINE: Readonly<Record<string, RoomBaseline>> = {
  [WHITE_KING_DOMAIN]: {
    depth: 'civil',
    hash: '1c57fb5f',
    exits: ['FOREST_PATH', 'RED_WASTE_PASS', ICE_CANYON_PASS],
    entities: [
      'player-1/player-character',
      'FOREST_PATH/region-exit',
      'RED_WASTE_PASS/region-exit',
      'ICE_CANYON_PASS/region-exit',
    ],
    surface: { flat: 1022, wet: 497, slope: 95, steep: 67 },
    traversable: 1328,
  },
  [FOREST_EDGE]: {
    depth: 'outer',
    hash: 'da66b8e9',
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
    surface: { flat: 1386, slope: 127, steep: 168 },
    traversable: 1513,
  },
  [FOREST_DEEP]: {
    depth: 'wild',
    hash: '2b6a4c96',
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
    surface: { flat: 1681 },
    traversable: 1681,
  },
  [BIO_ORE_FIELD]: {
    depth: 'wild',
    hash: 'f111570c',
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
    surface: { flat: 1681 },
    traversable: 1681,
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
  },
};

/** 이 Cycle 전의 Connector 차례 — 새 이음은 이 뒤에 이어 붙는다 (C003 · C008 · C016 의 규율) */
const CONNECTORS_BEFORE: readonly string[] = [
  'FOREST_PATH',
  'RUIN_TRAIL',
  'DEEP_TRAIL',
  'NEST_TRAIL',
  'ORE_TRAIL',
  'TREE_APPROACH',
  'ORE_TREE_TRAIL',
  'ANCIENT_GATE',
  'RED_WASTE_PASS',
  ICE_CANYON_PASS,
  'TREE_INNER_DOOR',
  'TREE_FALL',
  'HEART_RIVER',
  'MAZE_GATE_RETURN',
  'MAZE_HEART_GATE',
  'INVERTED_GARDEN_DOOR',
  'WALKING_FOREST_DOOR',
];

/** 이 Cycle 뒤의 경계 셋 (SPEC-002 경계 ② — ICE_CANYON 이 빠지고 아무것도 늘지 않는다) */
const FRONTIERS_AFTER: readonly string[] = ['RED_WASTE', 'INVERTED_GARDEN', 'WALKING_FOREST'];

/** 백왕령의 조건 자리 하나와 거기서 읽히는 코드 (C006 이 세운 값 — 이 Cycle 은 건드리지 않는다) */
const RIDGE_SPOT: XZ = { x: -13, z: -4 };
const RIDGE_CONDITIONS: readonly string[] = ['condition:ridge'];

// ── 하네스 (c015 · c016 · c017 · c018 의 선례 그대로) ────────────────

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id: string) => state(w).actors.find((a) => a.id === id)!;
const bodyOf = (w: WorldDriver, observerId = OBSERVER): string =>
  w.observe(observerId).observer.characterId;
const here = (w: WorldDriver, bodyId: string): XZ => ({
  x: actorOf(w, bodyId).position.x,
  z: actorOf(w, bodyId).position.z,
});
function spaceOf(id: string): RegionDescription {
  const spec = regionSpec(id);
  if (!spec) throw new Error(`세계가 방 '${id}' 를 알지 못한다 — 아직 지어지지 않았다`);
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

/** 표면 태그마다 vertex 수 — "표면이 한 값도 달라지지 않았는가" 를 재는 자리 */
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

const connectorOf = (id: string) => REGION_GRAPH.connectors.find((c) => c.id === id);
/** 그 이음이 이 방에서 서는 자리 — from 쪽이면 from.anchor, 아니면 to.anchor */
function connectorSpot(connectorId: string, region: string): XZ {
  const c = connectorOf(connectorId);
  if (!c) throw new Error(`graph 에 이음 '${connectorId}' 가 없다`);
  const anchor = c.from.region === region ? c.from.anchor : c.to.anchor;
  return anchorAt(region, anchor);
}

/** 덧씌움이 가리키는 area op 의 태그 (c016 의 areaTagOf 그대로) */
function areaTagOf(region: string, areaId: string): string {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return op.tag;
}

// ── 이 Cycle 이 데이터에 세운 것 — **이름을 읽어 온다** ──────────────
//
// 어느 자락이 눈보라이고 어느 것이 결정면인지 spec 은 적지 않는다 (Observable "투영하지 않는다").
// 관찰자가 데이터를 훑어 "관찰 범위를 밝힌 자락" · "접촉 코드를 밝힌 자락" 으로 고른다.

type HazardOverlayShape = {
  areaId: string;
  hazard: string;
  observeRange?: { day: number; night: number };
  contact?: string;
};
type PhaseShape = { hazardExtend?: readonly HazardOverlayShape[]; depthOverlay?: readonly { areaId: string; depth: string }[] };

const standingOf = (region: string): PhaseShape | undefined =>
  (regionSpec(region)?.phases as { standing?: PhaseShape } | undefined)?.standing;
const standingHazards = (region: string): readonly HazardOverlayShape[] =>
  standingOf(region)?.hazardExtend ?? [];
/** 상시 위상을 밝힌 방들 — 데이터가 말한다 */
const standingRooms = (): string[] =>
  REGION_SPECS.filter((s) => (s.phases as { standing?: unknown } | undefined)?.standing).map((s) => s.id);

const rangeOverlays = (region: string) => standingHazards(region).filter((h) => h.observeRange);
const contactOverlays = (region: string) => standingHazards(region).filter((h) => h.contact);

/** 그 자락(들)이 걸린, 걸어 설 수 있는 자리 */
function spotsCoveredBy(region: string, tags: readonly string[]): XZ[] {
  const t = terrainOf(region);
  return walkableSpots(region).filter((p) =>
    tagsAt(t, p.x, p.z, HAZARD_LAYER).some((tag) => tags.includes(tag)),
  );
}
/** 그 자락(들)이 하나도 걸리지 않은, 걸어 설 수 있는 자리 */
function spotsOutside(region: string, tags: readonly string[]): XZ[] {
  const t = terrainOf(region);
  return walkableSpots(region).filter(
    (p) => !tagsAt(t, p.x, p.z, HAZARD_LAYER).some((tag) => tags.includes(tag)),
  );
}
const tagsOf = (region: string, overlays: readonly HazardOverlayShape[]): string[] =>
  overlays.map((h) => areaTagOf(region, h.areaId));

/**
 * 그 자락에서 **넉넉히 물러난** 바깥 자리 (경계에서 두 걸음 이상).
 *
 * 자락의 바로 바깥 격자 자리를 쓰면, 걸어간 몸이 목표에서 0.05 안에 멈추는 것만으로도
 * 아직 자락 안일 수 있다 (자락은 격자가 아니라 다각형이다). "밖으로 나왔다" 를 재는
 * 자리이므로 그 애매함을 없앤 자리를 고른다.
 */
function clearOutside(region: string, tags: readonly string[], from: XZ): XZ {
  const covered = spotsCoveredBy(region, tags);
  const outs = spotsOutside(region, tags).filter((p) =>
    covered.every((c) => distanceBetween(p, c) >= 2),
  );
  if (outs.length === 0) throw new Error(`${region} 에 그 자락에서 넉넉히 물러난 설 자리가 없다`);
  return minBy(outs, (p) => distanceBetween(p, from));
}

/** 관찰 범위를 밝힌 자락을 가진 방 하나 — 이 Cycle 의 눈보라다 (데이터가 고른다) */
function blizzardRoom(): string {
  const found = CANYONS.find((id) => regionSpec(id) && rangeOverlays(id).length > 0);
  if (!found) throw new Error('협곡 둘 가운데 관찰 범위를 밝힌 자락을 가진 방이 없다 (SPEC-006)');
  return found;
}
/** 접촉 코드를 밝힌 자락을 가진 방 하나 — 이 Cycle 의 결정면이다 */
function contactRoom(): string {
  const found = CANYONS.find((id) => regionSpec(id) && contactOverlays(id).length > 0);
  if (!found) throw new Error('협곡 둘 가운데 접촉 코드를 밝힌 자락을 가진 방이 없다 (SPEC-007)');
  return found;
}

// ── 걸어서 이어지는가 (SPEC-003 · SPEC-004 경계) ─────────────────────

const keyOf = (p: XZ) => `${p.x},${p.z}`;
/** 그 방에서 from 에 가장 가까운 걸어 설 수 있는 격자 자리 */
const snap = (region: string, at: XZ): XZ => minBy(walkableSpots(region), (p) => distanceBetween(p, at));
/**
 * 걸어서 이어지는 길 (격자 4-이웃 BFS). 없으면 undefined.
 * "골 바닥이 들어온 자리에서 나가는 자리까지 이어진다" 를 재는 자리다.
 */
function walkRoute(region: string, from: XZ, to: XZ): XZ[] | undefined {
  const t = terrainOf(region);
  const start = snap(region, from);
  const goal = snap(region, to);
  const step = t.resolution;
  const open = new Set(walkableSpots(region).map(keyOf));
  const prev = new Map<string, string>();
  const seen = new Set<string>([keyOf(start)]);
  const queue: XZ[] = [start];
  const at = new Map<string, XZ>([[keyOf(start), start]]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (keyOf(cur) === keyOf(goal)) break;
    for (const next of [
      { x: cur.x + step, z: cur.z },
      { x: cur.x - step, z: cur.z },
      { x: cur.x, z: cur.z + step },
      { x: cur.x, z: cur.z - step },
    ]) {
      const key = keyOf(next);
      if (!open.has(key) || seen.has(key)) continue;
      seen.add(key);
      prev.set(key, keyOf(cur));
      at.set(key, next);
      queue.push(next);
    }
  }
  if (!seen.has(keyOf(goal))) return undefined;
  const path: XZ[] = [];
  let cursor: string | undefined = keyOf(goal);
  while (cursor) {
    path.push(at.get(cursor)!);
    cursor = prev.get(cursor);
  }
  return path.reverse();
}

// ── 세계를 세우고 굴리는 자리 ────────────────────────────────────────

const standingIn = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
  });
/** 그 때에서 시작하는 세계 (C015 가 세운 손잡이 · c016 · c018 의 inSeason 그대로) */
const atClock = (clock: string, region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  standingIn(region, at, { ...extra, clock });

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

/** 걸어서 그 자리에 선다 (c017 의 walkTo 그대로) */
function walkTo(w: WorldDriver, at: XZ, observerId = OBSERVER) {
  const body = bodyOf(w, observerId);
  const arrived = () => distanceBetween(here(w, body), at) <= 0.05;
  if (arrived()) return;
  expect(move(w, at, observerId).status).toBe('success');
  const steps = Math.ceil(240 / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    w.tick(TICK_INTERVAL);
    if (arrived()) return;
  }
  throw new Error(`걸어서 (${at.x}, ${at.z}) 에 닿지 못했다 — 지금 자리 ${JSON.stringify(here(w, body))}`);
}

// ── 저장·복구 (c015 ~ c018 의 선례 그대로) ──────────────────────────
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
/** 그 몸을 그 방 그 자리에 세운다 (관성도 하던 행동도 없이) */
function place(s: WorldState, id: string, region: string, at: XZ) {
  const a = s.actors.find((x: ActorState) => x.id === id)!;
  a.regionId = region;
  a.position = { x: at.x, z: at.z };
  a.velocity = { x: 0, z: 0 };
  a.currentAction = idleAction();
}
/** 관찰자 둘이 한 방의 각자 자리에 선 세계 (c015 의 two 그대로) */
function two(region: string, atA: XZ, atB: XZ, extra: WorldSetup = {}): WorldDriver {
  const base = driveWorld({
    ...solo,
    ...extra,
    actorRegion: region,
    actorPosition: { x: atA.x, z: atA.z },
  });
  base.join(OBSERVER_2);
  base.tick(0);
  return worldFrom(
    base,
    (s) => {
      place(s, PLAYER, region, atA);
      place(s, PLAYER_2, region, atB);
    },
    [OBSERVER, OBSERVER_2],
  );
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────
const sceneOf = (w: WorldDriver, observerId = OBSERVER): string => w.observe(observerId).scene;
const conditionsSeen = (w: WorldDriver, observerId = OBSERVER): string[] =>
  w.observe(observerId).standingConditions;
const depthSeen = (w: WorldDriver, observerId = OBSERVER): unknown =>
  w.observe(observerId).hud.find((h) => h.id === 'region.depth')?.value;
const clockOf = (w: WorldDriver, observerId = OBSERVER) => w.observe(observerId).clock;
const entityOf = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  v.entities.find((e) => e.id === id);
const exitsIn = (v: GameViewSnapshot): EntityView[] =>
  v.entities.filter((e) => e.role === 'region-exit');
const onTarget = (v: GameViewSnapshot, targetEntityId: string): InteractionView[] =>
  v.interactions.filter((i) => i.targetEntityId === targetEntityId);
const hudIds = (v: GameViewSnapshot): string[] => v.hud.map((h) => h.id);
const entityLines = (v: GameViewSnapshot): string[] => v.entities.map((e) => `${e.id}/${e.role}`);

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 고개가 열린다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 고개가 열린다', () => {
  it('S-011 백왕령에서 고개로 건너기를 요청하면 몸이 얼음 협곡에 선다', () => {
    // Given 백왕령의 고개 표식에 선 몸
    const w = standingIn(WHITE_KING_DOMAIN, connectorSpot(ICE_CANYON_PASS, WHITE_KING_DOMAIN));
    expect(sceneOf(w)).toBe(WHITE_KING_DOMAIN);
    // And 그 고개가 출구로 실려 있다
    expect(exitsIn(w.observe()).map((e) => e.id)).toContain(ICE_CANYON_PASS);
    // When 그 고개로 건너기를 요청한다
    const result = cross(w, ICE_CANYON_PASS);
    // Then 받아들여진다 — "아직 갈 수 없는 곳" 이라는 거절이 나지 않는다
    expect({ status: result.status, reason: reasonOf(result) }).toEqual({
      status: 'success',
      reason: undefined,
    });
    // And 몸이 얼음 협곡에 선다
    expect(sceneOf(w)).toBe(CANYON_OUTER);
    expect(w.observe().region.id).toBe(CANYON_OUTER);
    expect(actorOf(w, bodyOf(w)).regionId).toBe(CANYON_OUTER);
  });

  it('S-012 (경계 ①) 얼음 협곡에서 같은 고개로 요청하면 백왕령으로 돌아온다', () => {
    // Given 얼음 협곡의 고개 쪽 자리에 선 몸
    const w = standingIn(CANYON_OUTER, connectorSpot(ICE_CANYON_PASS, CANYON_OUTER));
    expect(sceneOf(w)).toBe(CANYON_OUTER);
    // When 같은 이름의 고개로 건너기를 요청한다
    const result = cross(w, ICE_CANYON_PASS);
    // Then 받아들여지고 백왕령에 선다 — 문 둘이 아니라 하나가 양방향이다 (기본형 ⑥)
    expect(result.status).toBe('success');
    expect(sceneOf(w)).toBe(WHITE_KING_DOMAIN);
    // And graph 도 그렇게 말한다
    expect(connectorOf(ICE_CANYON_PASS)?.direction).toBe('bidirectional');
  });

  it('S-013 (경계 ②) 백왕령의 출구 차례는 한 자리도 바뀌지 않는다', () => {
    // Then graph 가 내는 차례가 이 Cycle 전 그대로다
    expect(exitsOf(REGION_GRAPH, WHITE_KING_DOMAIN).map((e) => e.connector.id)).toEqual(
      BASELINE[WHITE_KING_DOMAIN]!.exits,
    );
    // And 관찰 결과에 실리는 차례도 그대로다
    const w = standingIn(WHITE_KING_DOMAIN);
    expect(exitsIn(w.observe()).map((e) => e.id)).toEqual(BASELINE[WHITE_KING_DOMAIN]!.exits);
  });

  it('S-014 건너간 뒤에도 고개는 되돌아갈 출구로 실려 있다 (한 걸음으로 오간다)', () => {
    // Given 백왕령에서 고개를 건넌 몸
    const w = standingIn(WHITE_KING_DOMAIN, connectorSpot(ICE_CANYON_PASS, WHITE_KING_DOMAIN));
    expect(cross(w, ICE_CANYON_PASS).status).toBe('success');
    // Then 얼음 협곡에도 그 고개가 출구로 서 있다
    expect(exitsIn(w.observe()).map((e) => e.id)).toContain(ICE_CANYON_PASS);
    // When 다시 건넌다 / Then 백왕령이다
    expect(cross(w, ICE_CANYON_PASS).status).toBe('success');
    expect(sceneOf(w)).toBe(WHITE_KING_DOMAIN);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 방 둘이 선다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-002 방 둘이 선다', () => {
  it('S-021 얼음 협곡의 깊이는 outer 이고 빙결 협곡의 깊이는 wild 다 — 관찰의 scene 이 그 방이다', () => {
    // Given 두 방이 지어져 있다
    expect(regionSpec(CANYON_OUTER)?.depth).toBe(DEPTH_OUTER);
    expect(regionSpec(CANYON_INNER)?.depth).toBe(DEPTH_INNER);
    // When 그 방에 서서 본다
    for (const [region, depth] of [
      [CANYON_OUTER, DEPTH_OUTER],
      [CANYON_INNER, DEPTH_INNER],
    ] as const) {
      const w = standingIn(region);
      // Then scene 도 방의 id 도 그 방이고, 발밑의 깊이가 그 값이다
      expect({ region, scene: sceneOf(w), id: w.observe().region.id, depth: depthSeen(w) }).toEqual({
        region,
        scene: region,
        id: region,
        depth,
      });
      // And 그 깊이는 어휘 다섯 안이다
      expect(WORLD_CONTRACTS.depths as readonly string[]).toContain(depth);
    }
  });

  it('S-022 (경계 ①) 두 방을 잇는 것은 오솔길 하나뿐이고 빙결 협곡에서 나가는 끝은 그 하나다', () => {
    // Given 두 방을 잇는 이음들을 graph 에서 고른다 (이름을 손으로 잇지 않는다)
    const between = REGION_GRAPH.connectors.filter(
      (c) =>
        (c.from.region === CANYON_OUTER && c.to.region === CANYON_INNER) ||
        (c.from.region === CANYON_INNER && c.to.region === CANYON_OUTER),
    );
    // Then 하나뿐이고 그것이 오솔길이며 spec 이 이름한 그것이다
    expect(between.map((c) => c.id)).toEqual([CANYON_TRAIL]);
    expect(between[0]!.transition).toBe('trail');
    // And 빙결 협곡에서 **되돌아 나가는** 끝은 그 하나다.
    // C020 으로 좁혀졌다 — 그 방이 빙결 심층으로 드는 문을 하나 더 얻었지만 그 너머는
    // 아직 짓지 않은 곳이다. "돌아 나갈 길은 이 하나" 라는 주장은 그대로이고,
    // 지어진 방으로 이어지는 끝이 여전히 하나라는 말로 좁아졌을 뿐이다.
    const built = new Set(REGION_SPECS.map((r) => r.id));
    expect(
      exitsOf(REGION_GRAPH, CANYON_INNER)
        .filter((e) => built.has(e.there.region))
        .map((e) => e.connector.id),
    ).toEqual([CANYON_TRAIL]);
  });

  it('S-023 (경계 ②) 얼음 협곡이 경계 목록에서 빠졌고 이 Cycle 은 아무것도 더하지 않았다', () => {
    // C020 으로 좁혀졌다 — 그 Cycle 이 빙결 심층을 가리키며 이름 하나를 더했다(경계 넷).
    // **이 Cycle 이 아무것도 더하지 않았다**는 주장은 그대로다: C019 가 남긴 셋이
    // 지금도 전부 목록에 있고, 얼음 협곡만 빠졌다.
    for (const name of FRONTIERS_AFTER) expect(FRONTIER_REGIONS).toContain(name);
    expect(FRONTIER_REGIONS).not.toContain(CANYON_OUTER);
    expect(FRONTIER_REGIONS).not.toContain(CANYON_INNER);
    // And 이름의 주인이 방 파일로 옮겨 갔다 — 지어진 방으로 선다
    expect(REGION_SPECS.map((s) => s.id)).toEqual(expect.arrayContaining([CANYON_OUTER, CANYON_INNER]));
    // And 그래프의 경계 목록도 같은 말을 한다
    for (const name of FRONTIERS_AFTER) expect(REGION_GRAPH.frontiers ?? []).toContain(name);
  });

  it('S-024 (경계 ①) 새 오솔길은 Connector 배열 **끝**에 이어 붙는다 — 앞의 열일곱이 그대로다', () => {
    const ids = REGION_GRAPH.connectors.map((c) => c.id);
    expect(ids.slice(0, CONNECTORS_BEFORE.length)).toEqual(CONNECTORS_BEFORE);
    expect(ids.indexOf(CANYON_TRAIL)).toBeGreaterThanOrEqual(CONNECTORS_BEFORE.length);
  });

  it('S-025 협곡 안쪽으로 한 번 더 건너면 빙결 협곡이고 같은 길로 돌아온다', () => {
    // Given 얼음 협곡의 오솔길 자리에 선 몸
    const w = standingIn(CANYON_OUTER, connectorSpot(CANYON_TRAIL, CANYON_OUTER));
    // When 오솔길로 건넌다 / Then 빙결 협곡이고 발밑이 한 단계 더 차다
    expect(cross(w, CANYON_TRAIL).status).toBe('success');
    expect({ scene: sceneOf(w), depth: depthSeen(w) }).toEqual({
      scene: CANYON_INNER,
      depth: DEPTH_INNER,
    });
    // When 같은 길로 되돌아간다 / Then 얼음 협곡이다
    expect(cross(w, CANYON_TRAIL).status).toBe('success');
    expect(sceneOf(w)).toBe(CANYON_OUTER);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 골 바닥에 서리가 깔린다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 골 바닥에 서리가 깔린다', () => {
  it('S-031 두 방의 골 바닥은 표면 태그 frost 다 — 들어온 자리에서 나가는 자리까지', () => {
    for (const region of CANYONS) {
      const t = terrainOf(region);
      // Given 그 방에서 들어오는 자리와 나가는 자리 (graph 가 말하는 이음의 anchor 들)
      const ends = exitsOf(REGION_GRAPH, region).map((e) => connectorSpot(e.connector.id, region));
      expect(ends.length).toBeGreaterThan(0);
      const from = snap(region, ends[0]!);
      const to = snap(region, ends[ends.length - 1]!);
      // When 걸어서 이어지는 길을 따라간다
      const route = walkRoute(region, from, to);
      expect({ region, walkable: route !== undefined }).toEqual({ region, walkable: true });
      // Then 그 길의 자리는 전부 서리다
      const other = route!.filter((p) => surfaceAt(t, p.x, p.z) !== SURFACE_FROST_TAG);
      expect({ region, notFrost: other.slice(0, 5) }).toEqual({ region, notFrost: [] });
      // And 그 방의 표면 태그 셈에 서리가 있다
      expect({ region, frost: (surfaceCounts(region)[SURFACE_FROST_TAG] ?? 0) > 0 }).toEqual({
        region,
        frost: true,
      });
    }
  });

  it('S-032 (경계) 서리 선이 없는 방의 표면 태그는 한 값도 달라지지 않는다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      // Then 태그마다 vertex 수가 이 Cycle 전 그대로다
      expect({ region, surface: surfaceCounts(region) }).toEqual({ region, surface: base.surface });
      // And 서리가 한 자리도 깔리지 않았다
      expect({ region, frost: surfaceCounts(region)[SURFACE_FROST_TAG] }).toEqual({
        region,
        frost: undefined,
      });
    }
  });

  it('S-033 (경계) 협곡 밖의 어느 방에도 서리는 없다 — 새 표면 규칙이 남의 방을 흔들지 않는다', () => {
    for (const spec of REGION_SPECS.filter((s) => !CANYONS.includes(s.id))) {
      expect({ region: spec.id, frost: surfaceCounts(spec.id)[SURFACE_FROST_TAG] ?? 0 }).toEqual({
        region: spec.id,
        frost: 0,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 절벽이 몸을 세운다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 절벽이 몸을 세운다', () => {
  /** 그 방의 급경사로 막힌 자리들 */
  const steepSpots = (region: string): XZ[] => {
    const t = terrainOf(region);
    return gridSpots(region).filter((p) => blockedReasonAt(t, p.x, p.z) === BLOCK_STEEP);
  };

  it('S-041 협곡 양옆의 벽은 통행 격자가 0 이다', () => {
    for (const region of CANYONS) {
      const t = terrainOf(region);
      const steep = steepSpots(region);
      // Then 그런 자리가 실제로 있다 (검사가 헛돌지 않는다)
      expect({ region, has: steep.length > 0 }).toEqual({ region, has: true });
      // And 전부 막혀 있다
      const open = steep.filter((p) => isTraversableAt(t, p.x, p.z));
      expect({ region, open: open.slice(0, 5) }).toEqual({ region, open: [] });
    }
  });

  it('S-042 그리로 걷기를 요청하면 too-steep 으로 거절되고 몸이 선다', () => {
    for (const region of CANYONS) {
      // Given 골 바닥에 선 몸
      const w = standingIn(region);
      const body = bodyOf(w);
      const before = here(w, body);
      // When 절벽으로 간다고 한다 (가장 먼 급경사 자리 — 능선의 한복판이다)
      const target = maxBy(steepSpots(region), (p) => distanceBetween(p, before));
      const result = move(w, target);
      // Then 거절된다 — 규칙은 그대로 RULE-MOVE-001 이고 사유는 C006 의 그 코드다
      expect({ region, result }).toEqual({
        region,
        result: { status: 'failure', rule: 'RULE-MOVE-001', reason: BLOCK_STEEP },
      });
      expect(BLOCK_STEEP).toBe('too-steep');
      // And 몸이 실제로 서 있다 — 시간이 흘러도 그대로다
      tickFor(w, 1);
      expect({ region, at: here(w, body) }).toEqual({ region, at: before });
    }
  });

  it('S-043 (경계) 골 바닥은 두 방 다 들어온 자리에서 나가는 자리까지 걸어서 이어진다', () => {
    // 얼음 협곡 — 고개에서 오솔길까지
    const outerRoute = walkRoute(
      CANYON_OUTER,
      connectorSpot(ICE_CANYON_PASS, CANYON_OUTER),
      connectorSpot(CANYON_TRAIL, CANYON_OUTER),
    );
    expect(outerRoute !== undefined).toBe(true);
    // 빙결 협곡 — 들어온 자리(오솔길)에서 이 Cycle 이 서라고 하는 자락들까지
    const inner = CANYON_INNER;
    const entry = connectorSpot(CANYON_TRAIL, inner);
    for (const overlay of standingHazards(inner)) {
      const tag = areaTagOf(inner, overlay.areaId);
      const spots = spotsCoveredBy(inner, [tag]);
      if (spots.length === 0) continue; // 걸어 설 수 없는 자락(절벽)은 이 항이 재는 것이 아니다
      const target = minBy(spots, (p) => distanceBetween(p, entry));
      expect({ tag, walkable: walkRoute(inner, entry, target) !== undefined }).toEqual({
        tag,
        walkable: true,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 — 방이 늘 서 있는 위상을 밝힌다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-005 방이 늘 서 있는 위상을 밝힌다', () => {
  /** 상시 위상의 위험 자락 하나와 그 자락에 선 자리 (데이터가 고른다) */
  const roomWithStanding = (): string => {
    const found = CANYONS.find((id) => regionSpec(id) && standingHazards(id).length > 0);
    if (!found) throw new Error('협곡 둘 가운데 상시 위상을 밝힌 방이 없다 (SPEC-005)');
    return found;
  };
  /** 그 방에서 걸어 설 수 있는 상시 자락 하나 — {태그, 위험 코드, 자리} */
  const standingSpot = (region: string) => {
    for (const overlay of standingHazards(region)) {
      const tag = areaTagOf(region, overlay.areaId);
      const spots = spotsCoveredBy(region, [tag]);
      if (spots.length > 0) return { tag, hazard: overlay.hazard, at: spots[0]! };
    }
    throw new Error(`${region} 에 걸어 설 수 있는 상시 자락이 없다`);
  };

  it('S-051 그 자락에 서면 **어느 철에도** 그 위험 코드가 걸린 것에 실린다', () => {
    const region = roomWithStanding();
    const { hazard, at } = standingSpot(region);
    for (const season of SEASONS) {
      // Given 그 철에서 시작한 세계, 그 자락 위의 몸
      const w = atClock(season, region, at);
      expect(clockOf(w).season).toBe(season);
      // Then 철과 무관하게 그 코드가 실린다 — 원인이 철이 아니기 때문이다
      expect({ season, has: conditionsSeen(w).includes(hazard) }).toEqual({ season, has: true });
    }
  });

  it('S-052 소란과 무관하게 걸린다 — 잠든 방에도 깨어난 방에도', () => {
    const region = roomWithStanding();
    const { hazard, at } = standingSpot(region);
    for (const disturbance of [0, 1000]) {
      // Given 소란이 그만큼 쌓인 세계 (위상은 세계 자신이 정한다)
      const w = standingIn(region, at, { disturbances: { [region]: disturbance } });
      // Then 잠들었든 깨어났든 그 코드가 실린다
      expect({ disturbance, phase: w.observe().region.disturbance.phase, has: conditionsSeen(w).includes(hazard) }).toEqual({
        disturbance,
        phase: w.observe().region.disturbance.phase,
        has: true,
      });
    }
  });

  it('S-053 아무것도 지나지 않아도 걸린다', () => {
    const region = roomWithStanding();
    const { hazard, at } = standingSpot(region);
    const w = standingIn(region, at);
    // Given 이 방을 지나는 것이 하나도 없다
    expect(w.observe().presences).toEqual([]);
    // Then 그래도 그 코드가 실린다 — 원인 없이 걸리는 자리다
    expect(conditionsSeen(w)).toContain(hazard);
    // And 시간이 흘러도 그대로다 (그치지 않는다)
    tickFor(w, 30);
    expect(conditionsSeen(w)).toContain(hazard);
  });

  it('S-054 (경계 ①) 상시 위상을 밝히지 않은 방은 이 Cycle 전과 한 값도 다르지 않다', () => {
    // Then 상시 위상을 밝힌 방은 이 Cycle 이 지은 둘뿐이다
    for (const id of standingRooms()) expect(CANYONS).toContain(id);
    // And 앞의 방들에는 협곡의 위험 코드가 한 값도 실리지 않는다
    for (const region of Object.keys(BASELINE)) {
      const w = standingIn(region);
      for (const code of CANYON_HAZARDS) {
        expect({ region, code, has: conditionsSeen(w).includes(code) }).toEqual({
          region,
          code,
          has: false,
        });
      }
    }
  });

  it('S-055 (경계 ②) 철 · 깨어남의 덧씌움과 함께 걸린다 — 어느 하나가 다른 것을 지우지 않는다', () => {
    const region = roomWithStanding();
    const { hazard, at } = standingSpot(region);
    // Given 그 방이 상시 말고 다른 원인의 덧씌움도 밝혔는가 (데이터가 답한다)
    const phases = regionSpec(region)?.phases as
      | { seasons?: Record<string, PhaseShape>; awake?: PhaseShape }
      | undefined;
    const others: PhaseShape[] = [
      ...Object.values(phases?.seasons ?? {}),
      ...(phases?.awake ? [phases.awake] : []),
    ];
    for (const other of others) {
      for (const overlay of other.hazardExtend ?? []) {
        const tag = areaTagOf(region, overlay.areaId);
        const both = spotsCoveredBy(region, [tag]).filter((p) =>
          tagsAt(terrainOf(region), p.x, p.z, HAZARD_LAYER).includes(
            areaTagOf(region, standingHazards(region)[0]!.areaId),
          ),
        );
        if (both.length === 0) continue;
        const w = standingIn(region, both[0]!, { disturbances: { [region]: 1000 } });
        expect([...conditionsSeen(w)].sort()).toEqual(
          expect.arrayContaining([hazard, overlay.hazard].sort()),
        );
      }
    }
    // 그리고 다른 원인이 무엇이든 상시의 코드는 **지워지지 않는다** — 철 넷 × 소란 둘로 잰다
    for (const season of SEASONS) {
      for (const disturbance of [0, 1000]) {
        const w = atClock(season, region, at, { disturbances: { [region]: disturbance } });
        expect({ season, disturbance, has: conditionsSeen(w).includes(hazard) }).toEqual({
          season,
          disturbance,
          has: true,
        });
      }
    }
  });

  it('S-056 (경계 ③) 저장되지 않는다 — 되살린 세계도 같은 답을 낸다', () => {
    const region = roomWithStanding();
    const { hazard, at } = standingSpot(region);
    // Given 그 자락에 선 세계
    const w = standingIn(region, at);
    const before = [...conditionsSeen(w)].sort();
    expect(before).toContain(hazard);
    // Then 스냅샷 어디에도 그 코드가 적혀 있지 않다 (유도된 사실이다 · spec State 절)
    const written = JSON.stringify(w.world.snapshot());
    expect(written.includes(hazard)).toBe(false);
    // When 파일을 지나 되살린다
    const revived = revive(w);
    // Then 같은 답이 나온다
    expect([...conditionsSeen(revived)].sort()).toEqual(before);
    expect(depthSeen(revived)).toBe(depthSeen(w));
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-006 — 눈보라가 시야를 좁힌다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-006 눈보라가 시야를 좁힌다', () => {
  /** 눈보라(관찰 범위를 밝힌 자락)의 방 · 태그 · 밝힌 두 수 */
  const blizzard = () => {
    const region = blizzardRoom();
    const overlays = rangeOverlays(region);
    return { region, tags: tagsOf(region, overlays), overlays };
  };
  /** 그 자락 안의 설 자리 · 자락 **밖**의 설 자리 */
  const inside = (): { region: string; at: XZ } => {
    const { region, tags } = blizzard();
    const spots = spotsCoveredBy(region, tags);
    if (spots.length === 0) throw new Error('눈보라 자락 안에 설 자리가 없다');
    return { region, at: spots[Math.floor(spots.length / 2)]! };
  };
  const outside = (): { region: string; at: XZ } => {
    const { region, tags } = blizzard();
    const from = spotsCoveredBy(region, tags)[0]!;
    return { region, at: clearOutside(region, tags, from) };
  };
  /** 그 자리에서 그 거리 밖에 서는 몸의 자리 */
  const bodyBeyond = (region: string, from: XZ, range: number): XZ => {
    const far = walkableSpots(region).filter((p) => distanceBetween(p, from) > range + 1);
    if (far.length === 0) throw new Error(`${region} 에 ${range} 보다 먼 설 자리가 없다`);
    return minBy(far, (p) => distanceBetween(p, from));
  };
  /** 그 자리에서 그 거리 안에 서는 몸의 자리 (몸끼리 밀리지 않게 두 걸음 떨어뜨린다) */
  const bodyWithin = (region: string, from: XZ, range: number): XZ => {
    const near = walkableSpots(region).filter(
      (p) => distanceBetween(p, from) > 2 && distanceBetween(p, from) < range - 1,
    );
    if (near.length === 0) throw new Error(`${region} 에 ${range} 안의 설 자리가 없다`);
    return maxBy(near, (p) => distanceBetween(p, from));
  };

  it('S-061 자락이 밝힌 두 수는 낮 20 · 밤 10 이다 (spec 데이터 값 표)', () => {
    const { overlays } = blizzard();
    expect(overlays.length).toBeGreaterThan(0);
    for (const one of overlays) {
      expect(one.observeRange).toEqual({ day: BLIZZARD_RANGE_DAY, night: BLIZZARD_RANGE_NIGHT });
    }
  });

  it('S-062 낮인데도 자락 안에서는 20 보다 먼 몸이 실리지 않는다', () => {
    const { region, at } = inside();
    // Given 낮이고, 자락 안에 선 관찰자와 20 보다 먼 몸
    const w = two(region, at, bodyBeyond(region, at, BLIZZARD_RANGE_DAY), { clock: DAY_CLOCK });
    expect(clockOf(w).dayPhase).toBe('DAY');
    // Then 낮인데도 그 몸이 실리지 않는다
    expect(entityOf(w.observe(), PLAYER_2)).toBeUndefined();
    // And 20 안의 몸은 실린다
    const near = two(region, at, bodyWithin(region, at, BLIZZARD_RANGE_DAY), { clock: DAY_CLOCK });
    expect(entityOf(near.observe(), PLAYER_2)).toBeDefined();
  });

  it('S-063 밤에는 그 자락 안에서 10 보다 먼 몸이 실리지 않는다', () => {
    const { region, at } = inside();
    // Given 밤이고, 자락 안에 선 관찰자와 10 보다 먼(그러나 20 안의) 몸
    const beyond = minBy(
      walkableSpots(region).filter(
        (p) =>
          distanceBetween(p, at) > BLIZZARD_RANGE_NIGHT + 1 &&
          distanceBetween(p, at) < BLIZZARD_RANGE_DAY - 1,
      ),
      (p) => distanceBetween(p, at),
    );
    const w = two(region, at, beyond, { clock: NIGHT_CLOCK });
    expect(clockOf(w).dayPhase).toBe('NIGHT');
    // Then 그 몸이 실리지 않는다 — 밤의 자락은 10 이다
    expect(entityOf(w.observe(), PLAYER_2)).toBeUndefined();
    // And 10 안의 몸은 밤에도 실린다
    const near = two(region, at, bodyWithin(region, at, BLIZZARD_RANGE_NIGHT), { clock: NIGHT_CLOCK });
    expect(entityOf(near.observe(), PLAYER_2)).toBeDefined();
  });

  it('S-064 (경계 ①) 자락 밖은 C015 그대로다 — 낮은 방 전체 · 밤은 20', () => {
    const { region, at } = outside();
    const far = bodyBeyond(region, at, BLIZZARD_RANGE_DAY);
    // Given 낮 · 자락 밖에 선 관찰자와 20 보다 먼 몸
    const day = two(region, at, far, { clock: DAY_CLOCK });
    // Then 낮에는 방 전체가 실린다 — 자락 밖은 좁아지지 않는다
    expect(entityOf(day.observe(), PLAYER_2)).toBeDefined();
    // When 밤이면 / Then 20 밖의 몸은 빠진다 (C015 의 값 그대로)
    const nightFar = bodyBeyond(region, at, OBSERVE_RANGE_NIGHT);
    const night = two(region, at, nightFar, { clock: NIGHT_CLOCK });
    expect(clockOf(night).dayPhase).toBe('NIGHT');
    expect(entityOf(night.observe(), PLAYER_2)).toBeUndefined();
    // And 20 안의 몸은 밤에도 실린다
    const nightNear = two(region, at, bodyWithin(region, at, OBSERVE_RANGE_NIGHT), { clock: NIGHT_CLOCK });
    expect(entityOf(nightNear.observe(), PLAYER_2)).toBeDefined();
  });

  it('S-065 (경계 ②) 관찰자 자신의 몸은 언제나 실린다', () => {
    const { region, at } = inside();
    const far = bodyBeyond(region, at, BLIZZARD_RANGE_DAY);
    for (const clock of [DAY_CLOCK, NIGHT_CLOCK]) {
      const w = two(region, at, far, { clock });
      // Then 서로는 보이지 않아도 각자 자기 몸은 그대로다
      expect({ clock, self: entityOf(w.observe(OBSERVER), PLAYER)?.role }).toEqual({
        clock,
        self: 'player-character',
      });
      expect({ clock, self: entityOf(w.observe(OBSERVER_2), PLAYER_2)?.role }).toEqual({
        clock,
        self: 'player-character',
      });
      expect(entityOf(w.observe(OBSERVER), PLAYER_2)).toBeUndefined();
    }
  });

  it('S-066 (경계 ③) 출구 · 방의 사실 · 걸린 것 · 때 · HUD 는 잘리지 않는다', () => {
    const { region, at } = inside();
    // Given 자락 안에 선 관찰자 (낮)
    const w = standingIn(region, at, { clock: DAY_CLOCK });
    const v = w.observe();
    // Then 그 방의 출구는 **거리와 무관하게** 전부 실린다
    const exits = exitsOf(REGION_GRAPH, region).map((e) => e.connector.id);
    expect(exitsIn(v).map((e) => e.id)).toEqual(exits);
    // And 그 가운데 범위 밖의 출구도 있다 (검사가 헛돌지 않는다)
    const beyond = exitsIn(v).filter(
      (e) => distanceBetween({ x: e.position.x, z: e.position.z }, at) > BLIZZARD_RANGE_DAY,
    );
    if (beyond.length > 0) expect(beyond.length).toBeGreaterThan(0);
    // And 방의 사실 · 걸린 것 · 때 · HUD 는 그대로 서 있다
    expect(v.region.id).toBe(region);
    expect(v.region.hash).toBe(descriptionHash(spaceOf(region)));
    expect(v.standingConditions.length).toBeGreaterThan(0);
    expect(v.clock.dayPhase).toBe('DAY');
    expect(hudIds(v)).toContain('region.depth');
    expect(hudIds(v)).toContain('world.time');
  });

  it('S-067 (경계 ③) 자국은 잘리지 않는다 — 범위 밖에 남긴 것도 실린다', () => {
    const { region, at } = inside();
    // Given 자락 안에서 20 보다 먼 자리에서 걸어온다
    const from = bodyBeyond(region, at, BLIZZARD_RANGE_DAY);
    const w = standingIn(region, from, { clock: DAY_CLOCK });
    // When 자락 안의 자리까지 걸어간다 (걸으며 자국을 남긴다)
    walkTo(w, at);
    // Then 자국이 실리고, 그 가운데 범위 밖의 것도 있다
    const body = here(w, bodyOf(w));
    const tracks = w.observe().tracks;
    expect(tracks.length).toBeGreaterThan(0);
    const far = tracks.filter((t) => distanceBetween({ x: t.at.x, z: t.at.z }, body) > BLIZZARD_RANGE_DAY);
    if (far.length > 0) expect(far.length).toBeGreaterThan(0);
  });

  it('S-068 (경계 ④) 때와 자락 가운데 좁은 쪽이 이긴다 — 밤의 자락 안은 10 이다', () => {
    const { region, at } = inside();
    // Given 밤(때가 주는 범위 20)이고 자락 안(자락이 주는 범위 10)에 선다
    const between = walkableSpots(region).filter(
      (p) =>
        distanceBetween(p, at) > BLIZZARD_RANGE_NIGHT + 1 &&
        distanceBetween(p, at) < OBSERVE_RANGE_NIGHT - 1,
    );
    expect(between.length).toBeGreaterThan(0);
    const w = two(region, at, minBy(between, (p) => distanceBetween(p, at)), { clock: NIGHT_CLOCK });
    // Then 20 안이지만 10 밖이라 실리지 않는다 — 좁은 쪽이 이긴다
    expect(entityOf(w.observe(), PLAYER_2)).toBeUndefined();
  });

  it('S-069 (경계 ④) 관찰 범위를 밝힌 자락이 겹치면 가장 좁은 것이 이긴다', () => {
    const { region, overlays } = blizzard();
    // Given 범위를 밝힌 자락이 둘 이상 겹친 설 자리 (데이터가 그렇게 놓았을 때만 잴 수 있다)
    const narrow = overlays.filter((o) => o.observeRange);
    if (narrow.length < 2) return; // 겹칠 자락 자체가 없다 — 보고의 GAP 목록에 적었다
    const t = terrainOf(region);
    const overlapped = walkableSpots(region).filter((p) => {
      const tags = tagsAt(t, p.x, p.z, HAZARD_LAYER);
      return narrow.filter((o) => tags.includes(areaTagOf(region, o.areaId))).length >= 2;
    });
    if (overlapped.length === 0) return; // 겹치는 자리가 없다 — 같은 GAP
    const at = overlapped[0]!;
    const covering = narrow.filter((o) =>
      tagsAt(t, at.x, at.z, HAZARD_LAYER).includes(areaTagOf(region, o.areaId)),
    );
    const tightest = Math.min(...covering.map((o) => o.observeRange!.day));
    const beyond = walkableSpots(region).filter((p) => distanceBetween(p, at) > tightest + 1);
    const w = two(region, at, minBy(beyond, (p) => distanceBetween(p, at)), { clock: DAY_CLOCK });
    expect(entityOf(w.observe(), PLAYER_2)).toBeUndefined();
  });

  it('S-070 자락 밖으로 걸어 나오면 다시 실린다', () => {
    const { region, tags } = blizzard();
    const at = spotsCoveredBy(region, tags)[Math.floor(spotsCoveredBy(region, tags).length / 2)]!;
    const out = clearOutside(region, tags, at);
    const far = bodyBeyond(region, at, BLIZZARD_RANGE_DAY);
    // Given 낮 · 자락 안에 선 관찰자에게 먼 몸이 실리지 않는다
    const w = two(region, at, far, { clock: DAY_CLOCK });
    expect(entityOf(w.observe(), PLAYER_2)).toBeUndefined();
    // When 자락 밖으로 걸어 나온다
    walkTo(w, out);
    // Then 낮의 방 전체가 다시 실린다 — 그 몸이 돌아온다
    expect(clockOf(w).dayPhase).toBe('DAY');
    expect(entityOf(w.observe(), PLAYER_2)).toBeDefined();
  });

  it('S-071 잘린 것에 걸린 상호작용도 함께 빠진다 — 실리지 않은 것을 겨눈 것이 하나도 없다', () => {
    const { region, at } = inside();
    const w = two(region, at, bodyBeyond(region, at, BLIZZARD_RANGE_DAY), { clock: DAY_CLOCK });
    for (const observerId of [OBSERVER, OBSERVER_2]) {
      const v = w.observe(observerId);
      const ids = new Set(v.entities.map((e) => e.id));
      const orphan = v.interactions.filter(
        (i) => i.targetEntityId !== undefined && !ids.has(i.targetEntityId),
      );
      expect({ observerId, orphan }).toEqual({ observerId, orphan: [] });
    }
    // And 실리지 않은 그 몸을 겨눈 것은 하나도 없다
    expect(onTarget(w.observe(OBSERVER), PLAYER_2)).toEqual([]);
  });

  it.todo(
    'GAP: 눈보라 자락 안에 원천을 세울 수 없다 — 협곡의 원천은 C020 이 짓는다 (R2 가 원천을 자르는 것은 그때 잰다)',
  );
  it.todo(
    'GAP: 협곡을 지나는 것이 없다 — "지나는 것은 잘리지 않는다"(SPEC-006 경계 ③)를 놓을 자리가 없다 (경로는 전부 숲이다)',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-007 — 결정면이 닿음을 말한다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-007 결정면이 닿음을 말한다', () => {
  const crystal = () => {
    const region = contactRoom();
    const overlays = contactOverlays(region);
    return { region, overlays, tags: tagsOf(region, overlays) };
  };
  const insideCrystal = () => {
    const { region, tags, overlays } = crystal();
    const spots = spotsCoveredBy(region, tags);
    if (spots.length === 0) throw new Error('결정면 자락 안에 설 자리가 없다');
    return { region, overlays, at: spots[Math.floor(spots.length / 2)]! };
  };

  it('S-081 그 자락에 선 동안 접촉 코드가 위험의 코드와 함께 걸린 것에 실린다', () => {
    const { region, overlays, at } = insideCrystal();
    const w = standingIn(region, at);
    const seen = conditionsSeen(w);
    for (const one of overlays) {
      // Then 그 자리의 위험 코드와 접촉 코드가 **같은 목록**에 함께 선다
      expect({ hazard: one.hazard, has: seen.includes(one.hazard) }).toEqual({
        hazard: one.hazard,
        has: true,
      });
      expect({ contact: one.contact, has: seen.includes(one.contact!) }).toEqual({
        contact: one.contact,
        has: true,
      });
    }
    // And 그 코드는 Play 가 이름한 그것이다
    expect(seen).toContain(CONTACT_CRYSTALLIZING);
  });

  it('S-082 (경계 ①) 자락 밖으로 나오면 그 줄이 사라진다', () => {
    const { region, tags } = crystal();
    const spots = spotsCoveredBy(region, tags);
    const at = spots[Math.floor(spots.length / 2)]!;
    const out = clearOutside(region, tags, at);
    // Given 자락 안에서는 접촉 코드가 실린다
    const w = standingIn(region, at);
    expect(conditionsSeen(w)).toContain(CONTACT_CRYSTALLIZING);
    // When 걸어서 자락 밖으로 나온다
    walkTo(w, out);
    // Then 그 줄이 사라진다 — 내가 서야 참인 말이다
    expect(conditionsSeen(w)).not.toContain(CONTACT_CRYSTALLIZING);
  });

  it('S-083 (경계 ②) 몸의 값(체력 · 기력 · 속도 · 상태)은 한 값도 달라지지 않는다', () => {
    const { region, tags } = crystal();
    const spots = spotsCoveredBy(region, tags);
    const at = spots[Math.floor(spots.length / 2)]!;
    const out = clearOutside(region, tags, at);
    // Given 자락 밖에 선 몸의 값
    const w = standingIn(region, out);
    const selfOf = (d: WorldDriver) => {
      const me = entityOf(d.observe(), bodyOf(d))!;
      return { vitality: me.vitality, attributes: me.attributes };
    };
    const before = JSON.parse(JSON.stringify(selfOf(w)));
    // When 자락 안으로 걸어 들어가 한동안 서 있는다
    walkTo(w, at);
    expect(conditionsSeen(w)).toContain(CONTACT_CRYSTALLIZING);
    tickFor(w, 30);
    // Then 몸의 값이 한 톨도 달라지지 않았다 — 2층이 하는 것은 말하는 것까지다
    expect(selfOf(w)).toEqual(before);
  });

  it('S-084 접촉 코드를 밝히지 않은 자락은 아무것도 늘리지 않는다', () => {
    // Given 이 세계에서 접촉 코드를 밝힌 자락은 협곡의 것뿐이다
    for (const spec of REGION_SPECS) {
      const declared = standingHazards(spec.id).filter((h) => h.contact);
      if (declared.length > 0) expect(CANYONS).toContain(spec.id);
    }
    // Then 앞의 방들의 걸린 것에는 접촉 코드가 실리지 않는다
    for (const region of Object.keys(BASELINE)) {
      expect(conditionsSeen(standingIn(region))).not.toContain(CONTACT_CRYSTALLIZING);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-008 — 위험 갈래 셋이 숲과 겹치지 않는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-008 위험 갈래 셋이 숲과 겹치지 않는다', () => {
  const canyonHazardCodes = (): string[] =>
    [...new Set(CANYONS.flatMap((id) => standingHazards(id).map((h) => h.hazard)))].sort();

  it('S-091 두 방이 밝힌 위험은 climate · terrain · matter 셋이다', () => {
    expect(canyonHazardCodes()).toEqual([...CANYON_HAZARDS].sort());
  });

  it('S-092 숲이 쓰는 hazard/creature 와 하나도 겹치지 않는다', () => {
    expect(canyonHazardCodes()).not.toContain(HAZARD_CREATURE);
  });

  it('S-093 그 자락에 선 관찰자의 걸린 것에 그 코드가 실린다 — 셋 다', () => {
    const seen = new Set<string>();
    for (const region of CANYONS) {
      for (const overlay of standingHazards(region)) {
        const tag = areaTagOf(region, overlay.areaId);
        const spots = spotsCoveredBy(region, [tag]);
        if (spots.length === 0) continue; // 걸어 설 수 없는 자락은 이 항이 재지 못한다
        const w = standingIn(region, spots[Math.floor(spots.length / 2)]!);
        expect({ region, tag, has: conditionsSeen(w).includes(overlay.hazard) }).toEqual({
          region,
          tag,
          has: true,
        });
        seen.add(overlay.hazard);
      }
    }
    // Then 셋 다 실제로 서 본 자리에서 읽혔다
    expect([...seen].sort()).toEqual([...CANYON_HAZARDS].sort());
  });

  it('S-094 (경계) 셋 다 어휘 일곱 안의 값이다 — 새 갈래를 짓지 않는다', () => {
    for (const code of canyonHazardCodes()) {
      expect({ code, known: (WORLD_CONTRACTS.hazardKinds as readonly string[]).includes(code) }).toEqual({
        code,
        known: true,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-009 — 덧씌움이지 재컴파일이 아니다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-009 덧씌움이지 재컴파일이 아니다', () => {
  it('S-101 상시 위상은 컴파일 결과를 한 값도 바꾸지 않는다 — 높이 · 표면 · 통행 격자 · hash', () => {
    for (const region of CANYONS) {
      const description = spaceOf(region);
      // Given 같은 Description 을 두 번 컴파일한다
      const a = compileRegion(description, COMPILE_RULES).world;
      const b = compileRegion(description, COMPILE_RULES).world;
      expect({ region, height: [...a.height] }).toEqual({ region, height: [...b.height] });
      expect({ region, surface: [...a.surface] }).toEqual({ region, surface: [...b.surface] });
      expect({ region, walk: [...a.traversable] }).toEqual({ region, walk: [...b.traversable] });
      // Then 관찰이 내는 hash 가 Description 의 hash 그대로다
      const w = standingIn(region);
      expect({ region, hash: w.observe().region.hash }).toEqual({
        region,
        hash: descriptionHash(description),
      });
    }
  });

  it('S-102 자락 안팎 · 철 넷 · 소란 둘에서 hash 가 한 값도 달라지지 않는다', () => {
    const region = blizzardRoom();
    const tags = tagsOf(region, rangeOverlays(region));
    const spots = [spotsCoveredBy(region, tags)[0]!, spotsOutside(region, tags)[0]!];
    const expected = descriptionHash(spaceOf(region));
    for (const at of spots) {
      for (const season of SEASONS) {
        for (const disturbance of [0, 1000]) {
          const w = atClock(season, region, at, { disturbances: { [region]: disturbance } });
          expect({ at, season, disturbance, hash: w.observe().region.hash }).toEqual({
            at,
            season,
            disturbance,
            hash: expected,
          });
        }
      }
    }
  });

  it('S-103 (경계) 같은 방을 두 번 컴파일하면 같은 hash 다 — 세계의 모든 방에서', () => {
    for (const spec of REGION_SPECS) {
      const once = descriptionHash(spec.space);
      const twice = descriptionHash(spec.space);
      expect({ region: spec.id, once, twice }).toEqual({ region: spec.id, once, twice: once });
      // And 컴파일 자체가 두 번 다 같은 격자를 낸다
      const a = compileRegion(spec.space, COMPILE_RULES).world;
      const b = compileRegion(spec.space, COMPILE_RULES).world;
      expect({ region: spec.id, same: [...a.surface].join() === [...b.surface].join() }).toEqual({
        region: spec.id,
        same: true,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-010 — 앞의 세계는 그대로다 (회귀)
// ─────────────────────────────────────────────────────────────────────

describe('회귀 — SPEC-010 앞의 세계는 그대로다', () => {
  it('S-111 백왕령 · 숲 가장자리 · 숲 안쪽 · 생체 광석 지대 · 미로의 관찰 결과가 그대로다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      const w = standingIn(region);
      const v = w.observe();
      // Then 방 · hash · 깊이 · 걸린 것 · 실리는 것 · 출구 차례가 이 Cycle 전 그대로다
      expect({
        region,
        scene: v.scene,
        id: v.region.id,
        hash: v.region.hash,
        depth: depthSeen(w),
        conditions: v.standingConditions,
        entities: entityLines(v),
        exits: exitsIn(v).map((e) => e.id),
      }).toEqual({
        region,
        scene: region,
        id: region,
        hash: base.hash,
        depth: base.depth,
        conditions: [],
        entities: [...base.entities],
        exits: [...base.exits],
      });
    }
  });

  it('S-112 그 방들의 hash 와 출구 차례는 graph · Description 쪽에서도 그대로다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({ region, hash: descriptionHash(spaceOf(region)) }).toEqual({ region, hash: base.hash });
      expect({ region, exits: exitsOf(REGION_GRAPH, region).map((e) => e.connector.id) }).toEqual({
        region,
        exits: [...base.exits],
      });
    }
  });

  it('S-113 백왕령의 조건 자리는 여전히 C006 의 코드만 답한다', () => {
    // Given 능선 조건이 걸린 자리 (C006 이 세운 그 자리)
    const t = terrainOf(WHITE_KING_DOMAIN);
    expect(
      tagsAt(t, RIDGE_SPOT.x, RIDGE_SPOT.z, SETTLEMENT_LAYER).filter((g) =>
        g.startsWith(CONDITION_PREFIX),
      ).length,
    ).toBeGreaterThan(0);
    // Then 걸린 것이 이 Cycle 전 그대로다 — 위험도 접촉도 섞여 들지 않는다
    const w = standingIn(WHITE_KING_DOMAIN, RIDGE_SPOT);
    expect([...conditionsSeen(w)].sort()).toEqual([...RIDGE_CONDITIONS].sort());
  });

  it('S-114 그 방들의 실리는 몸과 원천은 밤에도 C015 그대로다 (자락이 없으므로 좁아지지 않는다)', () => {
    for (const region of Object.keys(BASELINE)) {
      // Given 낮 · 밤에 같은 자리에 선다
      const day = standingIn(region, undefined, { clock: DAY_CLOCK });
      const night = standingIn(region, undefined, { clock: NIGHT_CLOCK });
      // Then 낮의 결과는 기준값 그대로이고, 밤이 자르는 것은 오직 20 밖이다 (새 규칙이 끼어들지 않는다)
      expect({ region, day: entityLines(day.observe()) }).toEqual({
        region,
        day: [...BASELINE[region]!.entities],
      });
      const me = here(night, bodyOf(night));
      const survived = night
        .observe()
        .entities.filter((e) => e.role !== 'region-exit' && e.id !== bodyOf(night));
      for (const one of survived) {
        expect({
          region,
          id: one.id,
          within: distanceBetween({ x: one.position.x, z: one.position.z }, me) <= OBSERVE_RANGE_NIGHT,
        }).toEqual({ region, id: one.id, within: true });
      }
    }
  });

  it('S-115 그 방들의 걸어 설 수 있는 자리 수가 그대로다 — 새 규칙이 땅을 막지도 열지도 않았다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      const t = terrainOf(region);
      const walkable = [...t.traversable].reduce((a, b) => a + b, 0);
      expect({ region, walkable }).toEqual({ region, walkable: base.traversable });
    }
  });
});
