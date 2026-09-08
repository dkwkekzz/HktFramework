// C021 — 추위가 고개를 넘는다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-007)
//
// C016 ~ C020 까지 방의 위상은 언제나 **자기 방** 안의 일이었다. 이 Cycle 에서 그것이
// 처음 방을 넘는다 — 그래서 여기서 재는 것은 다섯이다:
//   ① 넘어옴 — 빙결 협곡의 철이 백왕령 산기슭의 안전 코드를 **옅게** 한다 (스밈 · 긴 밤에만)
//   ② 밝힘 — 덧씌움이 자기가 타는 이음과 실어 오는 것을 밝히고, 그것이 세계에 실제로 있다
//   ③ 약해짐 — 코드가 사라지지도 위험이 되지도 않는다. 땅도 통행도 hash 도 그대로다
//   ④ 문과 자리 — 긴 밤에만 빙결 심층의 문이 열리고, 다시 자란 원천이 그것을 말한다
//   ⑤ 불변 — 앞의 세계(백왕령의 다른 자리 · 숲 넷 · 미로 둘 · 협곡 둘)는 한 값도 달라지지 않는다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/regions/phases.ts · terrain-rules.ts · frost-canyon.ts ·
// graph.ts 의 새 줄 · semantic/region-phase.ts · region.ts · resource.ts 의 새 함수 ·
// content/view/** · tools/**)은 **읽지 않았다.** 기대값의 출처는
// cycles/C021-cold-crosses-the-pass/spec.md 와 이미 있던 하네스·선례(c006 · c013 · c016 ·
// c019 · c020)뿐이다.
//
// **자리를 손으로 적지 않는다** — 조건 자락의 자리는 컴파일된 settlement 태그에서, 원천의
// 마디는 presence 곡선에서, 문의 자리는 graph 의 anchor 에서 읽는다. 손으로 적는 것은 spec 이
// 이름으로 못 박은 것(나가는 방 · 받는 방 · 타는 이음 · 실어 오는 것 · 넘어오는 철 둘 ·
// 코드 둘)뿐이고, 그것들은 세계에서 유도할 자리가 없다 (c016 · c020 의 규율 그대로).
//
// **회귀의 기준값은 이 Cycle 이 시작하기 전의 세계에서 떠 왔다** — 일곱 방의 값은 C020 의
// 시나리오가 적어 둔 표 그대로이고, 협곡 둘의 hash 는 여기서 처음 적는다 (C020 은 협곡의
// 표면·통행만 적었다). 그 일곱이 C020 의 값과 한 글자도 다르지 않다는 것이 협곡의 두 값도
// 이 Cycle 이전의 것임을 받쳐 준다 — 이 Cycle 은 Description 의 op 를 하나도 건드리지 않는다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  curvesOf,
  descriptionHash,
  pointsOf,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  ANCHOR_LAYER,
  BIO_ORE_FIELD,
  COMPILE_RULES,
  CONDITION_PREFIX,
  CONDITION_RIDGE,
  CONDITION_RIVER,
  CONDITION_TREE,
  FOREST_DEEP,
  FOREST_EDGE,
  FROST_CANYON,
  FROST_DEPTH,
  ICE_CANYON,
  PREDATOR_NEST,
  PRESENCE_LAYER,
  REGION_GRAPH,
  REGION_SPECS,
  RESOURCE_LAYER,
  SETTLEMENT_LAYER,
  WHITE_KING_DOMAIN,
  lockOfConnector,
  regionSpec,
  type ResourceSourceSpec,
  type SeasonId,
} from '../../regions';
// 이 Cycle 이 **처음 내는** 데이터 문(門) — 이름 하나를 못 찾아 파일 전체가 서지 못하는 일을
// 막으려고 이름 공간으로 읽는다 (c020 의 선례 그대로 · 그 하나가 없으면 그 항만 붉어진다).
import * as REGIONS from '../../regions';
// C008 이 세운 미로의 이름 — 그 파일이 소유한다 (c008 ~ c020 시나리오의 선례 그대로).
import { FANTASY_MAZE } from '../../regions/fantasy-maze';
import { MAZE_HEART, MAZE_HEART_GATE } from '../../regions';
// 이 세계가 이미 가진 어휘 — 위험의 갈래 일곱 (SPEC-003 경계 ① 이 이 목록을 가리킨다).
import { WORLD_CONTRACTS } from '../../authoring/contracts';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { INTERACTION_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { sourceStateOf } from '../semantic/resource';
import { driveWorld, OBSERVER, PLAYER, type WorldDriver } from './drive';

// ── spec 이 이름으로 못 박은 것들 (State 의 데이터 값 표) ──────────────

/** 철 넷 (C015 · C016 그대로) */
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
const SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT, TURN];

/** 넘어오는 철 둘 — Play §5.4 "스밈 · 긴 밤 동안" */
const CROSSING_SEASONS: readonly SeasonId[] = [SEEP, LONG_NIGHT];
/** 넘어오지 않는 철 둘 (SPEC-001 경계 ①) */
const QUIET_SEASONS: readonly SeasonId[] = SEASONS.filter((s) => !CROSSING_SEASONS.includes(s));

/** 나가는 방 · 받는 방 · 타는 이음 · 실어 오는 것 (spec 데이터 값 표) */
const OUTFLOW_ROOM = FROST_CANYON;
const RECEIVING_ROOM = WHITE_KING_DOMAIN;
const THROUGH_CONNECTOR = 'ICE_CANYON_PASS';
const CARRIER_WIND = 'wind';

/** 옅어진 코드 — `condition-weak:` + 그 조건의 이름 (spec 데이터 값 표) */
const WEAK_PREFIX = 'condition-weak:';
const WEAK_RIDGE = 'condition-weak:ridge';
/** 다시 자란 자리의 코드 (Play §6 V18 · spec 데이터 값 표) */
const REGROWN = 'frost-vein-regrown';

/** 사유 코드 — 그대로 쓰는 것들 (C002 · C012 · C016) */
const NOT_THIS_SEASON = 'not-this-season';
const CONNECTOR_INACTIVE = 'connector-inactive';
const REGION_NOT_BUILT = 'region-not-built';

/** phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';
const RECOVERING = 'recovering';

/** 위험의 어휘 일곱 — contracts.ts 가 소유한다 (SPEC-003 경계 ①) */
const HAZARD_KINDS: readonly string[] = WORLD_CONTRACTS.hazardKinds;

/** 채취의 소요 시간 — 행동표가 소유한다. "넉넉히 지난다" 로만 쓴다 (C011~C020 어법) */
const MINE_SECONDS = 1.2;

const solo: WorldSetup = { npcs: [] };

// ── 회귀의 기준값 (SPEC-007) ─────────────────────────────────────────

interface RoomBaseline {
  hash: string;
  surface: Readonly<Record<string, number>>;
  traversable: number;
}

/**
 * 앞의 세계 — 백왕령 · 숲 넷 · 미로 둘 (C020 시나리오의 BASELINE 표에서 그대로 왔다).
 * 협곡 둘의 hash 는 C020 이 적지 않았으므로 여기서 처음 적는다.
 */
  // RoomBecomesLand · RoomBearsMaterial · RoomNeverSame 실주행 판정 CHANGED — 거목의 줄기가 백왕령의 땅을 막고(통행 자리 1337 → 1328),
  // 흩어진 것들과 철의 자락이 숲의 방들에 늘었다 (hash · 존재 목록 · 흔적 태그). 앞의 세계의 **형**은 그대로다.
const BASELINE: Readonly<Record<string, RoomBaseline>> = {
  [WHITE_KING_DOMAIN]: {
    hash: '1c57fb5f',
    surface: { flat: 1022, wet: 497, slope: 95, steep: 67 },
    traversable: 1328,
  },
  [FOREST_EDGE]: { hash: 'da66b8e9', surface: { flat: 1386, slope: 127, steep: 168 }, traversable: 1513 },
  [FOREST_DEEP]: { hash: '2b6a4c96', surface: { flat: 1681 }, traversable: 1681 },
  [BIO_ORE_FIELD]: { hash: 'f111570c', surface: { flat: 1681 }, traversable: 1681 },
  // C024 CHANGED — 둥지는 C024 가 만졌다 (사체 · 변성지 · 자락 넷). **표면도 통행도 한 값
  // 달라지지 않았고**(아래 두 수가 그것을 그대로 잰다) 달라진 것은 Description 에 선 자리뿐이라
  // hash 하나가 바뀌었다.
  [PREDATOR_NEST]: { hash: '010d1f16', surface: { flat: 1681 }, traversable: 1681 },
  [FANTASY_MAZE]: { hash: '53ca6a70', surface: { flat: 6561 }, traversable: 6561 },
  [MAZE_HEART]: { hash: 'b9b77a14', surface: { flat: 1681 }, traversable: 1681 },
  [ICE_CANYON]: {
    hash: '5928ed79',
    surface: { steep: 810, slope: 164, frost: 697, flat: 10 },
    traversable: 871,
  },
  // C029 CHANGED — 이 방의 hash 하나가 바뀐다 (e5d9cd3d → ba0afb9e). 그 Cycle 이 **문 앞의
  // 자락** op 하나를 이 방 Description 에 더했기 때문이고, 땅은 한 값도 달라지지 않는다 —
  // 표면 넷도 걸을 수 있는 자리 수도 아래 그대로다 (trace layer 의 area 는 높이도 표면도
  // 통행도 건드리지 않는다). 다른 방 여덟의 hash 는 한 글자도 바뀌지 않았다.
  [FROST_CANYON]: {
    hash: 'ba0afb9e',
    surface: { steep: 902, slope: 72, frost: 697, flat: 10 },
    traversable: 779,
  },
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

/**
 * C016 · C008 이 세운 문의 활성 — 이 Cycle 은 여기에 **한 줄을 더할 뿐**이다 (SPEC-004 경계 ②).
 *
 * C029 CHANGED — 활성 조건이 사는 자리가 표에서 **Lock** 으로 옮겨 갔으므로, 같은 사실을
 * Lock 의 요구로 적는다. 재는 것은 그대로다: 두 문이 무엇을 읽어 열리는가가 한 값도 달라지지
 * 않았다는 것.
 */
const ACTIVATIONS_BEFORE: Readonly<Record<string, unknown>> = {
  MAZE_HEART_GATE: [{ state: { region: FANTASY_MAZE, patterns: ['P2'] } }],
  WALKING_FOREST_DOOR: [{ time: { seasons: [LONG_NIGHT] } }],
};

// ── 하네스 (c006 · c013 · c016 · c019 · c020 의 선례 그대로) ──────────

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

/** 표면 태그마다 vertex 수 — "땅이 한 값도 달라지지 않았는가" 를 재는 자리 (c019 · c020 어법) */
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
/** 그 이음이 이 방에서 서는 자리 (c020 의 connectorSpot 그대로) */
function connectorSpot(connectorId: string, region: string): XZ {
  const c = REGION_GRAPH.connectors.find((x) => x.id === connectorId);
  if (!c) throw new Error(`graph 에 이음 '${connectorId}' 가 없다`);
  return anchorAt(region, c.from.region === region ? c.from.anchor : c.to.anchor);
}

/** 그 자리의 settlement 태그들 — "왜 여기가 안전한가" 의 바탕 (C006) */
const settlementTagsAt = (region: string, at: XZ): string[] =>
  tagsAt(terrainOf(region), at.x, at.z, SETTLEMENT_LAYER);
const conditionTagsAt = (region: string, at: XZ): string[] =>
  settlementTagsAt(region, at).filter((tag) => tag.startsWith(CONDITION_PREFIX));
/** 그 조건이 걸린, 걸어 설 수 있는 자리들 */
const spotsWithCondition = (region: string, tag: string): XZ[] =>
  walkableSpots(region).filter((p) => conditionTagsAt(region, p).includes(tag));

// ── 원천을 읽는 자리 (c013 · c016 · c020 그대로) ─────────────────────

/** 방마다의 원천 목록 — {방, 원천} 짝으로 편다 */
const ALL_SOURCES = REGION_SPECS.flatMap((spec) =>
  (spec.resourceEcology?.sources ?? []).map((source) => ({ region: spec.id, source })),
);
const oneOf = (id: string) => {
  const found = ALL_SOURCES.find((x) => x.source.id === id);
  if (!found) throw new Error(`세계가 원천 '${id}' 를 모른다`);
  return found;
};
const specOf = (id: string): ResourceSourceSpec => oneOf(id).source;
const harvestsOf = (id: string): number => specOf(id).harvests;
function recoveryOf(id: string): number {
  const seconds = specOf(id).recoverySeconds;
  if (!(typeof seconds === 'number' && seconds > 0)) {
    throw new Error(`원천 '${id}' 에 recoverySeconds 가 없다`);
  }
  return seconds;
}
const pointOf = (region: string, id: string): XZ => {
  const found = pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id);
  if (!found) throw new Error(`${region} 의 resource layer 에 '${id}' 자리가 없다`);
  return found.position;
};
/** 그 원천의 마디 목록 — 밝힌 원천은 presence 곡선의 points, 아니면 자리 하나 (C013 R4) */
function sitesOf(region: string, id: string): XZ[] {
  const tag = specOf(id).siteCurve;
  if (!tag) return [pointOf(region, id)];
  const curve = curvesOf(spaceOf(region), PRESENCE_LAYER, tag)[0];
  if (!curve) throw new Error(`원천 '${id}' 의 마디 곡선(presence · ${tag})이 데이터에 없다`);
  return curve.points.map((p) => ({ x: p.x, z: p.z }));
}
/** 뒤척임에 자리를 옮기는 원천들 — C016 이 세운 데이터 (회귀가 그 철을 셈에서 뺀다) */
const MIGRATE_ON_TURN = new Set(
  REGION_SPECS.flatMap(
    (spec) =>
      ((spec.phases as { onTurn?: { migrateSources?: readonly string[] } } | undefined)?.onTurn
        ?.migrateSources ?? []) as readonly string[],
  ),
);

/** 마디를 여럿 가진 원천 · 하나뿐인 원천 (SPEC-005 경계 ②) */
const MIGRATORY_SOURCES = ALL_SOURCES.filter((x) => sitesOf(x.region, x.source.id).length > 1);
const FIXED_SOURCES = ALL_SOURCES.filter((x) => sitesOf(x.region, x.source.id).length === 1);

/** 그 자리에 손이 닿는, 걸어 설 수 있는 자리 하나 (c020 의 besideIn 그대로) */
function besideIn(region: string, at: XZ): XZ {
  const near = walkableSpots(region).filter((p) => distanceBetween(p, at) <= INTERACTION_RANGE * 0.9);
  if (near.length === 0) throw new Error(`(${at.x}, ${at.z}) 곁에 걸어 설 자리가 없다 (${region})`);
  return minBy(near, (p) => distanceBetween(p, at));
}

// ── 세계를 세우고 굴리는 자리 ────────────────────────────────────────

const standingIn = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
  });
/** 그 철에서 시작하는 세계 — C015 가 세운 clock 손잡이 (c016 의 inSeason 그대로) */
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

const move = (w: WorldDriver, at: XZ): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } });
const mine = (w: WorldDriver, targetEntityId: string): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId });
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
/** 걸어서 그 자리에 선다 (c017 · c019 · c020 의 walkTo 그대로) */
function walkTo(w: WorldDriver, at: XZ, budgetSeconds = 240) {
  const hereOf = (): XZ => {
    const a = state(w).actors.find((x) => x.id === PLAYER)!;
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

// ── 저장·복구 (c013 ~ c016 · c020 의 선례 그대로) ────────────────────

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

type SourceView = EntityView & { conditions?: string[]; siteIndex?: number };
type ExitView = EntityView & { conditions?: string[] };

const conditionsSeen = (w: WorldDriver): string[] => w.observe().standingConditions;
const sourcesIn = (v: GameViewSnapshot): SourceView[] =>
  v.entities.filter((e) => e.role === 'resource-source') as SourceView[];
const sourceEntity = (v: GameViewSnapshot, id: string): SourceView | undefined =>
  sourcesIn(v).find((e) => e.id === id);
const exitsIn = (v: GameViewSnapshot): ExitView[] =>
  v.entities.filter((e) => e.role === 'region-exit') as ExitView[];
const exitOf = (v: GameViewSnapshot, id: string): ExitView | undefined =>
  exitsIn(v).find((e) => e.id === id);
const transitTo = (v: GameViewSnapshot, connector: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'transit' && i.targetEntityId === connector);

interface SourceStateShape {
  phase: string;
  taken: number;
  siteIndex?: number;
  collapsedSites?: number[];
}
const phaseOf = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w), region, id) as SourceStateShape;

// ── 이 Cycle 이 데이터에 세운 것 — **이름을 읽어 온다** ───────────────
//
// spec 은 area op 의 이름을 적지 않는다 (관찰 계약의 규율 그대로). 관찰자가 자기
// content/regions 를 훑어 스스로 얻는 것이 이 저장소의 길이다 (c016 · c020).

/** 그 방 그 철의 덧씌움이 밝힌 **다른 방으로 나가는 것**들 — 없으면 빈 목록 */
interface OutflowShape {
  region?: string;
  areaId?: string;
  throughConnector?: string;
  carrier?: string;
}
type PhaseShape = { outflow?: unknown } | undefined;
function phaseAt(region: string, season: SeasonId): PhaseShape {
  const phases = regionSpec(region)?.phases as
    | { seasons?: Record<string, PhaseShape> }
    | undefined;
  return phases?.seasons?.[season];
}
function outflowsOf(region: string, season: SeasonId): OutflowShape[] {
  const raw = phaseAt(region, season)?.outflow;
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]) as OutflowShape[];
}
/** 늘 서 있는 위상이 밝힌 것 — "밝히지 않은 방" 을 셀 때 여기도 함께 본다 */
function standingOutflowsOf(region: string): OutflowShape[] {
  const phases = regionSpec(region)?.phases as { standing?: PhaseShape } | undefined;
  const raw = phases?.standing?.outflow;
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]) as OutflowShape[];
}
/** 지금 세계에서 다른 방에 무엇을 거는 방 · 철의 짝 전부 */
const DECLARED = REGION_SPECS.flatMap((spec) =>
  SEASONS.map((season) => ({ region: spec.id, season, list: outflowsOf(spec.id, season) })),
).filter((x) => x.list.length > 0);

/** 빙결 심층으로 드는 문 — 이름을 손으로 적지 않고 graph 가 고르게 한다 (c020 그대로) */
const depthDoor = () => REGION_GRAPH.connectors.find((c) => c.to.region === FROST_DEPTH);
/** 이 세계에 서 있는 다시 자랄 수 있는 원천 — 마디를 여럿 가진 것 가운데 협곡의 것 */
const REGROWN_SOURCE = MIGRATORY_SOURCES.find((x) => x.region === FROST_CANYON);

/** 백왕령의 조건 자락 안팎의 자리들 */
const ridgeSpots = (): XZ[] => spotsWithCondition(RECEIVING_ROOM, CONDITION_RIDGE);
/** 산맥의 조건 **하나만** 걸린 자리 — 옅어짐을 홀로 재는 자리 */
const soleRidgeSpot = (): XZ => {
  const only = ridgeSpots().filter((p) => conditionTagsAt(RECEIVING_ROOM, p).length === 1);
  if (only.length === 0) throw new Error('백왕령에 산맥 조건만 걸린 설 자리가 없다');
  return only[Math.floor(only.length / 2)]!;
};
/** 산맥과 다른 조건이 함께 걸린 자리 (없을 수도 있다 — 데이터가 정한다) */
const overlapRidgeSpot = (): XZ | undefined =>
  ridgeSpots().find((p) => conditionTagsAt(RECEIVING_ROOM, p).length > 1);
/** 그 조건 **하나만** 걸린 자리 (강 · 거목) */
const soleSpotOf = (tag: string): XZ | undefined => {
  const only = spotsWithCondition(RECEIVING_ROOM, tag).filter(
    (p) => conditionTagsAt(RECEIVING_ROOM, p).length === 1,
  );
  return only[Math.floor(only.length / 2)];
};
/** 산맥의 조건이 걸리지 않은 자리 — 자락 밖 */
const outsideRidgeSpot = (): XZ => {
  const outside = walkableSpots(RECEIVING_ROOM).filter(
    (p) => !conditionTagsAt(RECEIVING_ROOM, p).includes(CONDITION_RIDGE),
  );
  if (outside.length === 0) throw new Error('백왕령에 산맥 자락 밖의 설 자리가 없다');
  return minBy(outside, (p) => distanceBetween(p, soleRidgeSpot()));
};

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 철이 두 Region 사이에 선다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 철이 두 Region 사이에 선다', () => {
  it('S-011 스밈과 긴 밤에 백왕령 산기슭에 서면 산맥의 코드가 옅어진 것으로 실린다', () => {
    const at = soleRidgeSpot();
    // Given 고요에 그 자락에 서면 「산맥이 막는다」의 코드가 그대로 실린다
    const quiet = inSeason(STILL, RECEIVING_ROOM, at);
    expect(conditionsSeen(quiet)).toEqual([CONDITION_RIDGE]);
    for (const season of CROSSING_SEASONS) {
      // When 같은 자리에 스밈(또는 긴 밤)에 선다
      const w = inSeason(season, RECEIVING_ROOM, at);
      expect({ season, now: w.observe().clock.season }).toEqual({ season, now: season });
      // Then 그 줄이 **옅어진 것**으로 바뀐다 — 대신 서고 곁에 함께 서지 않는다 (기본형 ①)
      expect({ season, seen: conditionsSeen(w) }).toEqual({ season, seen: [WEAK_RIDGE] });
    }
  });

  it('S-012 (경계 ①) 고요와 뒤척임에는 지금과 한 값도 다르지 않다', () => {
    const at = soleRidgeSpot();
    for (const season of QUIET_SEASONS) {
      const w = inSeason(season, RECEIVING_ROOM, at);
      // Then 안전의 코드가 그대로 서고 옅어진 것은 어디에도 없다
      expect({ season, seen: conditionsSeen(w) }).toEqual({ season, seen: [CONDITION_RIDGE] });
    }
  });

  it('S-013 (경계 ②) 강과 거목의 조건은 어느 철에도 그대로다 — 약해진 것은 산맥 하나다', () => {
    for (const tag of [CONDITION_RIVER, CONDITION_TREE]) {
      const at = soleSpotOf(tag);
      expect({ tag, found: at !== undefined }).toEqual({ tag, found: true });
      for (const season of SEASONS) {
        const w = inSeason(season, RECEIVING_ROOM, at!);
        expect({ tag, season, seen: conditionsSeen(w) }).toEqual({ tag, season, seen: [tag] });
      }
    }
  });

  it('S-014 (경계 ②) 겹친 자리에서도 옅어지는 것은 산맥 하나뿐이다', () => {
    const at = overlapRidgeSpot();
    // 겹친 자리가 데이터에 없으면 S-013 의 자리별 대조가 이미 그것을 지킨다 (c006 S-028 의 어법)
    if (!at) return;
    const quiet = conditionsSeen(inSeason(STILL, RECEIVING_ROOM, at));
    expect(quiet).toContain(CONDITION_RIDGE);
    expect(quiet.length).toBeGreaterThan(1);
    for (const season of CROSSING_SEASONS) {
      const seen = conditionsSeen(inSeason(season, RECEIVING_ROOM, at));
      // Then 산맥 자리에만 옅어진 것이 서고 나머지 줄은 차례까지 그대로다
      expect({ season, seen }).toEqual({
        season,
        seen: quiet.map((tag) => (tag === CONDITION_RIDGE ? WEAK_RIDGE : tag)),
      });
    }
  });

  it('S-015 (경계 ②) 그 자락 밖의 자리는 철 넷에 한 값도 달라지지 않는다', () => {
    const at = outsideRidgeSpot();
    const quiet = conditionsSeen(inSeason(STILL, RECEIVING_ROOM, at));
    for (const season of SEASONS) {
      const seen = conditionsSeen(inSeason(season, RECEIVING_ROOM, at));
      expect({ season, seen }).toEqual({ season, seen: quiet });
      for (const tag of seen) {
        expect({ season, tag, weak: tag.startsWith(WEAK_PREFIX) }).toEqual({ season, tag, weak: false });
      }
    }
  });

  it('S-016 (경계 ②) 나가는 방(빙결 협곡)의 걸린 것은 어느 철에도 달라지지 않는다', () => {
    // Given 협곡 안의 자리 하나 — 나가는 쪽이지 받는 쪽이 아니다 (Observable Result 4)
    const at = besideIn(FROST_CANYON, pointOf(FROST_CANYON, REGROWN_SOURCE!.source.id));
    const quiet = [...conditionsSeen(inSeason(STILL, FROST_CANYON, at))].sort();
    for (const season of SEASONS) {
      const seen = [...conditionsSeen(inSeason(season, FROST_CANYON, at))].sort();
      expect({ season, seen }).toEqual({ season, seen: quiet });
      for (const tag of seen) {
        expect({ season, tag, weak: tag.startsWith(WEAK_PREFIX) }).toEqual({ season, tag, weak: false });
      }
    }
  });

  it('S-017 (경계 ③) 저장되지 않는다 — 되살린 세계도 같은 답을 낸다', () => {
    const at = soleRidgeSpot();
    // Given 스밈에 그 자락에 선 세계
    const w = inSeason(SEEP, RECEIVING_ROOM, at);
    expect(conditionsSeen(w)).toEqual([WEAK_RIDGE]);
    // When 저장했다가 되살린다 (파일을 지나는 저장 그대로)
    const stored = throughFile(w.world.snapshot());
    // Then 저장된 것 어디에도 옅어진 코드가 없다 — 유도된 사실이다 (spec State)
    expect(JSON.stringify(stored).includes(WEAK_PREFIX)).toBe(false);
    // And 되살린 세계는 같은 답을 낸다
    const again = revive(w);
    expect(conditionsSeen(again)).toEqual([WEAK_RIDGE]);
    expect(again.observe().clock.season).toBe(SEEP);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 이음을 통해서만 넘는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-002 이음을 통해서만 넘는다', () => {
  it('S-021 덧씌움이 자기가 타는 이음과 실어 오는 것을 밝힌다', () => {
    // Given 다른 방에 무엇을 거는 것을 밝힌 방·철의 짝
    expect({ declared: DECLARED.length > 0 }).toEqual({ declared: true });
    // Then 밝힌 것은 빙결 협곡의 스밈과 긴 밤이다 (spec 데이터 값 표)
    expect(DECLARED.map((x) => `${x.region}/${x.season}`).sort()).toEqual(
      CROSSING_SEASONS.map((s) => `${OUTFLOW_ROOM}/${s}`).sort(),
    );
    for (const one of DECLARED) {
      for (const flow of one.list) {
        // And 넷을 다 밝힌다 — 어느 방 · 어느 자락 · 어느 이음 · 무엇이 실어 오는가
        expect({ at: `${one.region}/${one.season}`, ...flow }).toEqual({
          at: `${one.region}/${one.season}`,
          region: RECEIVING_ROOM,
          areaId: flow.areaId,
          throughConnector: THROUGH_CONNECTOR,
          carrier: CARRIER_WIND,
        });
        expect({ at: `${one.region}/${one.season}`, told: (flow.areaId ?? '').length > 0 }).toEqual({
          at: `${one.region}/${one.season}`,
          told: true,
        });
      }
    }
  });

  it('S-022 (경계 ①) 밝힌 방 · 자락 · 이음이 셋 다 세계에 실제로 있고, 그 이음이 그 방에 닿는다', () => {
    for (const one of DECLARED) {
      for (const flow of one.list) {
        // 방 — 세계가 아는 방이다
        expect({ region: flow.region, known: regionSpec(flow.region ?? '') !== undefined }).toEqual({
          region: flow.region,
          known: true,
        });
        // 자락 — 그 방 Description 의 settlement layer area op 이고 condition 접두사를 달았다
        const op = spaceOf(flow.region!).ops.find((o) => o.id === flow.areaId);
        expect({ areaId: flow.areaId, isArea: op?.kind === 'area' }).toEqual({
          areaId: flow.areaId,
          isArea: true,
        });
        const area = op as { kind: 'area'; layer: string; tag: string };
        expect({ areaId: flow.areaId, layer: area.layer }).toEqual({
          areaId: flow.areaId,
          layer: SETTLEMENT_LAYER,
        });
        expect({ areaId: flow.areaId, condition: area.tag.startsWith(CONDITION_PREFIX) }).toEqual({
          areaId: flow.areaId,
          condition: true,
        });
        // 이음 — graph 에 있고, **그 방에 실제로 닿는다** (기본형 ③ "백왕령에 닿는 마지막 이음")
        const connector = REGION_GRAPH.connectors.find((c) => c.id === flow.throughConnector);
        expect({ id: flow.throughConnector, known: connector !== undefined }).toEqual({
          id: flow.throughConnector,
          known: true,
        });
        expect({
          id: flow.throughConnector,
          touches: [connector!.from.region, connector!.to.region].includes(flow.region!),
        }).toEqual({ id: flow.throughConnector, touches: true });
      }
    }
  });

  it('S-023 (경계 ②) 밝히지 않은 방은 어느 철에도 다른 방에 아무것도 걸지 않는다', () => {
    // Given 밝힌 방은 빙결 협곡 하나뿐이다 (늘 서 있는 위상에도 그런 것이 없다)
    for (const spec of REGION_SPECS) {
      expect({ region: spec.id, standing: standingOutflowsOf(spec.id).length }).toEqual({
        region: spec.id,
        standing: 0,
      });
      if (spec.id === OUTFLOW_ROOM) continue;
      for (const season of SEASONS) {
        expect({ region: spec.id, season, out: outflowsOf(spec.id, season).length }).toEqual({
          region: spec.id,
          season,
          out: 0,
        });
      }
    }
    // Then 옅어진 코드는 어느 방 어느 철에도 서지 않는다 — 밝힌 자락 하나를 뺀 세계 그대로다
    for (const spec of REGION_SPECS.filter((s) => s.id !== RECEIVING_ROOM)) {
      for (const season of SEASONS) {
        const seen = conditionsSeen(inSeason(season, spec.id));
        for (const tag of seen) {
          expect({ region: spec.id, season, tag, weak: tag.startsWith(WEAK_PREFIX) }).toEqual({
            region: spec.id,
            season,
            tag,
            weak: false,
          });
        }
      }
    }
  });

  it.todo(
    'GAP: 세계가 모르는 방 · 없는 area · 없는 이음을 가리킨 덧씌움이 아무 일도 하지 않는다(경계 ①) — ' +
      'WorldSetup 에 그런 덧씌움을 세울 손잡이가 없어(regionPatterns · sourcePhases · clock 과 달리 phases 는 데이터다) ' +
      '이 파일에서는 "지금 밝힌 셋이 세계에 실제로 있다"(S-022) 까지만 잰다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 약해지는 것이지 사라지는 것이 아니다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 약해지는 것이지 사라지는 것이 아니다', () => {
  it('S-031 옅어진 코드는 그 조건의 이름을 그대로 지고, 안전의 코드가 서던 자리에 선다', () => {
    // Given 이름 — 접두사만 옅어지고 뒤는 그대로다 (R1 경계 ①)
    const name = CONDITION_RIDGE.slice(CONDITION_PREFIX.length);
    expect(WEAK_RIDGE).toBe(`${WEAK_PREFIX}${name}`);
    // And 세계가 스스로 밝힌 접두사도 그 값이다 (spec Reuse 의 CONDITION_WEAK_PREFIX)
    const declaredPrefix = (REGIONS as unknown as { CONDITION_WEAK_PREFIX?: string }).CONDITION_WEAK_PREFIX;
    expect({ declared: declaredPrefix }).toEqual({ declared: WEAK_PREFIX });
    // And 그 접두사는 안전의 접두사와 갈린다 — 코드가 사라지지 않는다
    expect(WEAK_RIDGE.startsWith(CONDITION_PREFIX)).toBe(false);
    expect(WEAK_RIDGE).not.toBe(CONDITION_RIDGE);
    // When 겹친 자리(또는 홀로 걸린 자리)에서 스밈에 선다
    const at = overlapRidgeSpot() ?? soleRidgeSpot();
    const quiet = conditionsSeen(inSeason(STILL, RECEIVING_ROOM, at));
    const seep = conditionsSeen(inSeason(SEEP, RECEIVING_ROOM, at));
    // Then 그 자리(차례)에 그대로 선다 — 목록의 다른 줄은 하나도 움직이지 않는다
    expect(seep.indexOf(WEAK_RIDGE)).toBe(quiet.indexOf(CONDITION_RIDGE));
    expect(seep.length).toBe(quiet.length);
  });

  it('S-032 (경계 ①) 위험의 코드가 되지 않는다 — 어휘 일곱의 어느 갈래도 그 자리에 서지 않는다', () => {
    // Given 어휘 일곱 (contracts.ts)
    expect(HAZARD_KINDS.length).toBe(7);
    // Then 옅어진 코드는 그 어느 것도 아니고 그 접두사도 쓰지 않는다
    expect(HAZARD_KINDS).not.toContain(WEAK_RIDGE);
    expect(WEAK_RIDGE.startsWith('hazard/')).toBe(false);
    for (const season of SEASONS) {
      const seen = conditionsSeen(inSeason(season, RECEIVING_ROOM, soleRidgeSpot()));
      // And 그 자리의 걸린 것에 위험의 갈래가 하나도 섞이지 않는다
      for (const tag of seen) {
        expect({ season, tag, hazard: HAZARD_KINDS.includes(tag) || tag.startsWith('hazard/') }).toEqual({
          season,
          tag,
          hazard: false,
        });
      }
    }
  });

  it('S-033 (경계 ②) 그 자락의 땅 · hash 는 한 값도 바뀌지 않는다 — 덧씌움이지 재컴파일이 아니다', () => {
    const at = soleRidgeSpot();
    const hash = descriptionHash(spaceOf(RECEIVING_ROOM));
    expect(hash).toBe(BASELINE[RECEIVING_ROOM]!.hash);
    for (const season of SEASONS) {
      const w = inSeason(season, RECEIVING_ROOM, at);
      // Then 관찰 결과의 hash 도 방 id 도 철을 타지 않는다
      expect({ season, id: w.observe().region.id, hash: w.observe().region.hash }).toEqual({
        season,
        id: RECEIVING_ROOM,
        hash,
      });
    }
    // And 표면 태그와 통행 자리 수도 그대로다 (땅은 컴파일이 소유한다)
    expect(surfaceCounts(RECEIVING_ROOM)).toEqual(BASELINE[RECEIVING_ROOM]!.surface);
    expect(walkableSpots(RECEIVING_ROOM).length).toBe(BASELINE[RECEIVING_ROOM]!.traversable);
  });

  it('S-034 (경계 ②) 그 자락의 통행 격자도 바뀌지 않는다 — 같은 자리에 같은 대답이다', () => {
    // Given 그 자락 안팎의 자리들 (걸어 설 수 있는 것과 없는 것을 섞는다)
    const inside = ridgeSpots();
    const t = terrainOf(RECEIVING_ROOM);
    const blocked = gridSpots(RECEIVING_ROOM)
      .filter((p) => !isTraversableAt(t, p.x, p.z))
      .slice(0, 4);
    const sample = [...inside.filter((_, i) => i % 5 === 0).slice(0, 6), ...blocked];
    expect(sample.length).toBeGreaterThan(0);
    // When 철마다 그 자리들로 걸어가겠다고 요청한다
    const answersIn = (season: SeasonId) => {
      const w = inSeason(season, RECEIVING_ROOM, soleRidgeSpot());
      return sample.map((p) => {
        const result = move(w, p);
        return { at: [p.x, p.z], accepted: result.status === 'success', reason: reasonOf(result) ?? null };
      });
    };
    // Then 고요의 대답은 땅이 말하는 것 그대로이고
    const base = answersIn(STILL);
    base.forEach((answer, i) => {
      const p = sample[i]!;
      expect({ at: answer.at, accepted: answer.accepted }).toEqual({
        at: answer.at,
        accepted: isTraversableAt(t, p.x, p.z),
      });
    });
    // And 철 넷의 대답이 사유까지 그 값이다 — 통행은 땅의 것이다
    for (const season of SEASONS) {
      expect({ season, answers: answersIn(season) }).toEqual({ season, answers: base });
    }
  });

  it.todo(
    'GAP: 옅어진 자락이 **화면에서** 갈리는 것(Observable Result 3 · 서리가 앉은 것으로 읽힌다)은 ' +
      'view 의 문구·그림표가 짓는다 — content/view/tests 의 몫이다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 긴 밤에만 빙결 심층의 문이 열린다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 긴 밤에만 빙결 심층의 문이 열린다', () => {
  const door = () => {
    const found = depthDoor();
    if (!found) throw new Error('graph 에 빙결 심층으로 드는 문이 없다');
    return found;
  };
  const doorSpot = () => connectorSpot(door().id, door().from.region);

  it('S-041 긴 밤에는 열려 있고 다른 철에는 잠긴다', () => {
    const id = door().id;
    const room = door().from.region;
    // Given 데이터가 그 문의 철을 밝힌다 (spec 데이터 값 표 · 긴 밤)
    const seasons = lockOfConnector(id)?.requires.find((one) => one.time)?.time?.seasons;
    expect({ id, seasons: seasons ? [...seasons] : undefined }).toEqual({ id, seasons: [LONG_NIGHT] });
    // When 긴 밤에 그 문 앞에 선다 / Then 열려 있다
    const night = inSeason(LONG_NIGHT, room, doorSpot());
    expect(exitOf(night.observe(), id)?.state).toBe('open');
    // And 건너기의 거절은 철이 아니라 "아직 짓지 않았다" 다 (그 너머는 경계다 · C020)
    expect(reasonOf(cross(night, id))).toBe(REGION_NOT_BUILT);
    // When 다른 철에 같은 자리에 선다 / Then 잠긴다
    for (const season of SEASONS.filter((s) => s !== LONG_NIGHT)) {
      const w = inSeason(season, room, doorSpot());
      expect({ season, state: exitOf(w.observe(), id)?.state }).toEqual({ season, state: 'locked' });
    }
  });

  it('S-042 잠긴 사유는 "이 철이 아니다" 이고 잠긴 문의 것과 갈린다', () => {
    const id = door().id;
    const room = door().from.region;
    for (const season of SEASONS.filter((s) => s !== LONG_NIGHT)) {
      const w = inSeason(season, room, doorSpot());
      // Then 판에도 판정에도 같은 사유가 실린다
      expect({ season, reason: transitTo(w.observe(), id)?.reason }).toEqual({
        season,
        reason: NOT_THIS_SEASON,
      });
      expect({ season, ...cross(w, id) }).toEqual({
        season,
        status: 'failure',
        rule: 'RULE-REGION-TRANSIT-001',
        reason: NOT_THIS_SEASON,
      });
    }
    // And 그 사유는 "잠긴 문" 의 것과 다른 말이다 (미로의 심장 문 — 패턴이 아니라서 잠긴다)
    expect(NOT_THIS_SEASON).not.toBe(CONNECTOR_INACTIVE);
    for (const season of SEASONS) {
      const maze = inSeason(season, FANTASY_MAZE, connectorSpot(MAZE_HEART_GATE, FANTASY_MAZE));
      expect({ season, reason: reasonOf(cross(maze, MAZE_HEART_GATE)) }).toEqual({
        season,
        reason: CONNECTOR_INACTIVE,
      });
    }
  });

  it('S-043 (경계 ①) 표식의 코드는 어느 철에도 그대로 실린다 — 그것은 활성을 판정하지 않는다', () => {
    const id = door().id;
    const room = door().from.region;
    // Given C020 이 세운 그 문의 표식 코드 (C029 에서 요구의 이름이 현상으로 바뀐 그 자리다 —
    // 읽는 자리도 데이터도 Lock 으로 옮겨 갔고, 재는 사실은 그대로다)
    //
    // C031 AFFECTED — 그 문 앞의 자리는 눈보라 자락 **안**이라 밝힌 사유를 **대신하는** 완화된
    // 코드가 실린다 (RULE-LOCK-RELAXED-001). 이 항이 재는 것은 그대로다: 그 코드는 **철을 타지
    // 않는다** — 네 철 어디서도 같은 것 하나가 실리고, 그래서 표식의 코드는 활성을 판정하지
    // 않는다. 갈리는 것은 몸이 선 자리이고 철이 아니다.
    const lock = lockOfConnector(id);
    const reason = lock?.reason === undefined ? undefined : (lock.relaxedReason ?? lock.reason);
    const codes = reason === undefined ? undefined : [reason];
    expect({ id, declared: (codes?.length ?? 0) > 0 }).toEqual({ id, declared: true });
    for (const season of SEASONS) {
      const seen = exitOf(inSeason(season, room, doorSpot()).observe(), id);
      expect({ season, standing: seen !== undefined }).toEqual({ season, standing: true });
      for (const code of codes!) {
        // Then 열려 있든 잠겼든 그 코드는 표식에 그대로 있다
        expect({ season, code, carried: seen!.conditions?.includes(code) ?? false }).toEqual({
          season,
          code,
          carried: true,
        });
      }
    }
  });

  it('S-044 (경계 ②) 다른 문들의 활성은 한 값도 달라지지 않는다', () => {
    // Given 이 Cycle 앞의 활성 조건은 그대로다 — 는 것은 빙결 심층의 문 하나뿐이다
    for (const [id, before] of Object.entries(ACTIVATIONS_BEFORE)) {
      expect({ id, entry: lockOfConnector(id)?.requires }).toEqual({ id, entry: before });
    }
    // Then 조건이 없는 문들은 철 넷에 늘 열려 있다
    const plain = REGION_GRAPH.connectors.filter((c) => lockOfConnector(c.id) === undefined);
    const sample = plain.filter((c) => regionSpec(c.from.region) !== undefined).slice(0, 4);
    expect(sample.length).toBeGreaterThan(0);
    for (const connector of sample) {
      for (const season of SEASONS) {
        const w = inSeason(season, connector.from.region, connectorSpot(connector.id, connector.from.region));
        expect({ id: connector.id, season, state: exitOf(w.observe(), connector.id)?.state }).toEqual({
          id: connector.id,
          season,
          state: 'open',
        });
      }
    }
    // And C016 이 세운 걷는 숲의 문은 여전히 긴 밤에만 열린다
    const walking = REGION_GRAPH.connectors.find((c) => c.id === 'WALKING_FOREST_DOOR')!;
    for (const season of SEASONS) {
      const w = inSeason(season, walking.from.region, connectorSpot(walking.id, walking.from.region));
      expect({ season, state: exitOf(w.observe(), walking.id)?.state }).toEqual({
        season,
        state: season === LONG_NIGHT ? 'open' : 'locked',
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 — 다시 자란 자리가 그것을 말한다
// ─────────────────────────────────────────────────────────────────────

// spec 이 두 갈래로 읽히는 자리가 하나 있다 — R3 은 "원천이 마디를 여럿 가지고" 라고 두루 쓰고,
// World Change 5 와 코드 이름(FROST_VEIN_REGROWN)은 **결정면**의 일로 쓴다. 그래서 이 파일은
// spec 이 한 갈래로만 읽히는 두 끝만 잰다: 결정면은 실린다(S-051) · 자리를 옮기지 않는 원천에는
// 어느 때에도 실리지 않는다(S-053 · S-054). 다른 방의 **옮겨 다니는** 원천(뒤척임이 옮기는 노두 ·
// 지나감이 옮기는 것들)에 실려야 하는가는 Human 이 감사할 자리라 어느 쪽으로도 단언하지 않는다.
describe('SPEC-005 다시 자란 자리가 그것을 말한다', () => {
  const one = () => {
    if (!REGROWN_SOURCE) throw new Error('빙결 협곡에 마디를 여럿 가진 원천이 없다');
    return REGROWN_SOURCE;
  };
  const sites = () => sitesOf(one().region, one().source.id);

  /** 마디 0 을 다 캐고 되돌아와 다음 마디에 선 세계 (걸어서 닿는 Given · c020 S-041 의 길) */
  function regrownWorld(): WorldDriver {
    const id = one().source.id;
    const region = one().region;
    const w = standingIn(region, besideIn(region, sites()[0]!), { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(w, id);
    wait(w, recoveryOf(id));
    expect(phaseOf(w, region, id).phase).toBe(AVAILABLE);
    expect(phaseOf(w, region, id).siteIndex ?? 0).toBe(1);
    return w;
  }

  it('S-051 처음 마디가 아닌 자리에 선 원천에 다시 자란 것의 코드가 실린다', () => {
    const id = one().source.id;
    const region = one().region;
    // Given 마디 0 을 다 캐고 되돌아와 마디 1 에 선 세계
    const w = regrownWorld();
    // When 그 마디 곁으로 걸어가 지목한다
    walkTo(w, besideIn(region, sites()[1]!));
    const seen = sourceEntity(w.observe(), id);
    expect({ id, standing: seen !== undefined }).toEqual({ id, standing: true });
    // Then 그 원천의 조건 코드에 다시 자란 것이 실린다
    expect(seen!.conditions ?? []).toContain(REGROWN);
    // And 세계가 스스로 밝힌 코드도 그 값이다 (spec Reuse 의 FROST_VEIN_REGROWN)
    const declaredCode = (REGIONS as unknown as { FROST_VEIN_REGROWN?: string }).FROST_VEIN_REGROWN;
    expect({ declared: declaredCode }).toEqual({ declared: REGROWN });
    // And 지금 선 마디는 여전히 따로 실린다 (C013 의 자리 — 이 Cycle 이 더한 것이 아니다)
    expect(seen!.siteIndex).toBe(1);
  }, 60_000);

  it('S-052 (경계 ①) 처음 마디에 선 동안에는 실리지 않는다', () => {
    const id = one().source.id;
    const region = one().region;
    // Given 아무것도 캐지 않은 세계 — 마디 0 이다
    const fresh = standingIn(region, besideIn(region, sites()[0]!));
    expect(phaseOf(fresh, region, id).siteIndex ?? 0).toBe(0);
    const seen = sourceEntity(fresh.observe(), id);
    expect({ id, standing: seen !== undefined }).toEqual({ id, standing: true });
    // Then 다시 자란 것의 코드가 없다 (걸린 것이 없으면 자리 자체가 없다 · C012)
    expect(seen!.conditions ?? []).not.toContain(REGROWN);
  });

  it('S-053 (경계 ②) 자리를 옮기지 않는 원천에는 어느 때에도 실리지 않는다', () => {
    // Given 마디가 하나뿐인 원천들
    expect(FIXED_SOURCES.length).toBeGreaterThan(0);
    for (const fixed of FIXED_SOURCES) {
      const id = fixed.source.id;
      const at = besideIn(fixed.region, pointOf(fixed.region, id));
      for (const season of SEASONS) {
        const w = inSeason(season, fixed.region, at);
        const seen = sourceEntity(w.observe(), id);
        // 밤에는 원천이 실리지 않는다 (C015) — 실리는 때에만 묻는다
        if (!seen) continue;
        expect({ id, season, codes: seen.conditions ?? [] }).toEqual({
          id,
          season,
          codes: (seen.conditions ?? []).filter((c) => c !== REGROWN),
        });
      }
    }
  });

  it('S-054 (경계 ②) 캐서 고갈시키고 되돌아와도 자리를 옮기지 않는 원천에는 실리지 않는다', () => {
    // Given 마디가 하나뿐이면서 **지금 캘 수 있는** 원천 하나.
    //
    // 어느 것인지는 세계가 고르게 한다 — 세계에는 처음부터 고갈된 채 서서 흐름이나 지나감을
    // 기다리는 원천도 있고(C014 · C018), 그런 것은 이 항이 재려는 것을 재지 못한다.
    // 되돌아옴이 짧은 것부터 물어 첫 번째로 캐지는 것을 쓴다.
    const candidates = [...FIXED_SOURCES.filter((x) => typeof x.source.recoverySeconds === 'number')].sort(
      (a, b) => (a.source.recoverySeconds ?? 0) - (b.source.recoverySeconds ?? 0),
    );
    expect(candidates.length).toBeGreaterThan(0);
    let picked: (typeof candidates)[number] | undefined;
    let w: WorldDriver | undefined;
    for (const one of candidates) {
      const world = standingIn(one.region, besideIn(one.region, pointOf(one.region, one.source.id)), {
        actorItems: { pickaxe: 1 },
      });
      if (phaseOf(world, one.region, one.source.id).phase !== AVAILABLE) continue;
      if (mineOnce(world, one.source.id).status !== 'success') continue;
      picked = one;
      w = world;
      break;
    }
    expect({ found: picked !== undefined }).toEqual({ found: true });
    const id = picked!.source.id;
    // When 남은 횟수를 마저 캐고 되돌아옴을 기다린다
    for (let i = 1; i < harvestsOf(id); i++) {
      expect({ id, nth: i + 1, ...mineOnce(w!, id) }).toEqual({
        id,
        nth: i + 1,
        status: 'success',
        rule: 'RULE-MINE-001',
      });
    }
    wait(w!, recoveryOf(id));
    // Then 되돌아온 자리는 처음 그 자리이고 다시 자란 것의 코드가 없다
    const seen = sourceEntity(w!.observe(), id);
    expect({ id, phase: phaseOf(w!, picked!.region, id).phase }).toEqual({ id, phase: AVAILABLE });
    if (seen) {
      expect(seen.conditions ?? []).not.toContain(REGROWN);
      expect(seen.siteIndex ?? 0).toBe(0);
    }
  }, 60_000);

  it('S-055 (경계 ③) 어디서 옮겨 왔는지도 몇 번째인지도 싣지 않는다', () => {
    const id = one().source.id;
    const region = one().region;
    const all = sites();
    // Given 마디 1 에 선 세계
    const w = regrownWorld();
    walkTo(w, besideIn(region, all[1]!));
    const atOne = [...(sourceEntity(w.observe(), id)!.conditions ?? [])];
    expect(atOne).toContain(REGROWN);
    // Then 그 코드에 마디 번호도 옛 자리의 좌표도 섞이지 않는다
    for (const code of atOne) {
      expect({ code, hasDigit: /[0-9]/.test(code) }).toEqual({ code, hasDigit: false });
      expect({ code, tellsRoom: code.includes(region) }).toEqual({ code, tellsRoom: false });
    }
    // When 한 마디를 더 옮겨 선다 (마디 2)
    mineUntilDepleted(w, id);
    wait(w, recoveryOf(id));
    expect(phaseOf(w, region, id).siteIndex ?? 0).toBe(2 % all.length);
    walkTo(w, besideIn(region, all[2 % all.length]!));
    // Then 실리는 코드는 마디 1 에서와 한 글자도 다르지 않다 — 몇 번째인지 말하지 않는다
    expect([...(sourceEntity(w.observe(), id)!.conditions ?? [])]).toEqual(atOne);
  }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-006 — 두 Region 이 한 보고에 나란히 선다
//
// 이 항은 **도구**의 것이다. 렌더러 하나하나의 줄은 tools/world-editor/tests 가 재고,
// 여기서는 Observable Result 7 이 적은 대로 **명령 그대로** 돌려 본다
// (`npm run world:observe -- --report` 와 같은 자리로 간다).
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-006 두 Region 이 한 보고에 나란히 선다', () => {
  const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
  const runReport = (): string =>
    execFileSync('npx', ['tsx', 'tools/world-editor/observe.ts', '--report'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env },
    });

  it('S-061 보고가 방마다 한 줄을 적어 협곡 둘을 나란히 견줄 수 있다', () => {
    const out = runReport();
    // Then 인자를 알아듣는다 — 쓰임말로 돌려보내지 않는다
    expect(out.includes('모르는 인자')).toBe(false);
    // And 세계가 아는 방이 모두 그 글에 선다 (방마다의 분포)
    for (const spec of REGION_SPECS) {
      expect({ region: spec.id, listed: out.includes(spec.id) }).toEqual({ region: spec.id, listed: true });
    }
    // And 협곡 둘이 나란히 서고, 방마다 세 가지를 함께 적는다 (spec SPEC-006 의 세 말)
    for (const region of [ICE_CANYON, FROST_CANYON]) {
      const at = out.lastIndexOf(`\n    ${region}\n`);
      expect({ region, listed: at >= 0 }).toEqual({ region, listed: true });
      const rest = out.slice(at + 1);
      const next = rest.slice(1).search(/\n {4}\S/);
      const block = next >= 0 ? rest.slice(0, next + 1) : rest;
      for (const heading of ['기회 자리 분포', '붙잡는 것 분포', '흐름과 고립']) {
        expect({ region, heading, told: block.includes(heading) }).toEqual({ region, heading, told: true });
      }
    }
  }, 120_000);

  it('S-062 (경계 ②) 두 번 돌리면 글자까지 같다', () => {
    expect(runReport()).toBe(runReport());
  }, 120_000);

  it('S-063 (경계 ①) 읽기 전용이다 — 돌린 앞뒤로 도구의 그림 폴더에 는 것이 없다', () => {
    const outDir = new URL('../../../tools/world-editor/out/', import.meta.url);
    const listing = (): string[] => {
      try {
        return readdirSync(fileURLToPath(outDir)).sort();
      } catch {
        return []; // 아직 없는 폴더 — 보고가 만들어서도 안 된다
      }
    };
    const before = listing();
    runReport();
    expect(listing()).toEqual(before);
  }, 120_000);

  it.todo(
    'GAP: "돌린 앞뒤로 저장소에 는 것이 없다"(경계 ①) 를 저장소 전체로 재려면 git 작업 트리를 견줘야 하는데, ' +
      '다른 레인이 같은 나무에서 함께 쓰고 있어 이 파일에서는 도구의 그림 폴더까지만 잰다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — SPEC-007 앞의 세계는 그대로다
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('S-101 백왕령 · 숲 넷 · 미로 둘 · 협곡 둘의 hash · 표면 태그 · 통행이 그대로다', () => {
    for (const [region, base] of Object.entries(BASELINE)) {
      expect({ region, hash: descriptionHash(spaceOf(region)) }).toEqual({ region, hash: base.hash });
      expect({ region, surface: surfaceCounts(region) }).toEqual({ region, surface: base.surface });
      expect({ region, walkable: walkableSpots(region).length }).toEqual({
        region,
        walkable: base.traversable,
      });
      // And 그 방의 hash 는 관찰 결과에서도 그대로다 (철 넷에 흔들리지 않는다)
      for (const season of SEASONS) {
        expect({ region, season, hash: inSeason(season, region).observe().region.hash }).toEqual({
          region,
          season,
          hash: base.hash,
        });
      }
    }
  }, 60_000);

  it('S-102 백왕령의 **다른 자리** 와 앞의 방들의 걸린 것이 철 넷에 그대로다', () => {
    // 백왕령 — 산맥 자락 밖의 자리들 (자락 안은 이 Cycle 이 바꾸는 자리다)
    const outside = walkableSpots(RECEIVING_ROOM)
      .filter((p) => !conditionTagsAt(RECEIVING_ROOM, p).includes(CONDITION_RIDGE))
      .filter((_, i) => i % 211 === 0)
      .slice(0, 6);
    expect(outside.length).toBeGreaterThan(0);
    for (const at of outside) {
      const quiet = conditionsSeen(inSeason(STILL, RECEIVING_ROOM, at));
      // 그 자리에 걸린 것은 땅이 말하는 것 그대로다 (C006)
      expect([...quiet].sort()).toEqual([...conditionTagsAt(RECEIVING_ROOM, at)].sort());
      for (const season of SEASONS) {
        expect({ at: [at.x, at.z], season, seen: conditionsSeen(inSeason(season, RECEIVING_ROOM, at)) }).toEqual({
          at: [at.x, at.z],
          season,
          seen: quiet,
        });
      }
    }
    // 숲 넷 · 미로 둘 — 이 Cycle 의 코드가 하나도 실리지 않는다
    for (const region of Object.keys(BASELINE).filter((r) => r !== RECEIVING_ROOM)) {
      for (const season of SEASONS) {
        const seen = conditionsSeen(inSeason(season, region));
        expect({ region, season, weak: seen.some((t) => t.startsWith(WEAK_PREFIX)) }).toEqual({
          region,
          season,
          weak: false,
        });
        expect({ region, season, regrown: seen.includes(REGROWN) }).toEqual({
          region,
          season,
          regrown: false,
        });
      }
    }
  }, 60_000);

  it('S-103 C019 가 세운 협곡의 상시 위상(눈보라의 관찰 범위까지)이 한 값도 달라지지 않는다', () => {
    for (const [region, base] of Object.entries(CANYON_STANDING_BASELINE)) {
      const standing = (regionSpec(region)?.phases as { standing?: unknown } | undefined)?.standing;
      expect({ region, standing }).toEqual({ region, standing: base });
    }
  });

  it('S-104 원천들의 phase 와 마디가 그대로다 — 아무것도 캐지 않은 세계는 어느 철에도 처음 자리다', () => {
    // spec 은 "원천의 phase 와 마디" 라고만 한다. 이 Cycle **이전의** 값을 따로 적어 둔 표가
    // 없으므로 재는 것을 둘로 나눈다:
    //   ① 아무것도 캐지 않은 세계에서 원천은 모두 **처음 마디**에 선다 (C013 이 세운 그대로)
    //   ② 그 원천의 phase 는 **철을 타지 않는다** — 이 Cycle 이 더한 것은 방을 넘는 조건 하나이지
    //      원천의 State 가 아니다 (처음부터 고갈된 채 흐름을 기다리는 원천도 있어(C014 · C018)
    //      "모두 available" 로는 잴 수 없다)
    for (const { region, source } of ALL_SOURCES) {
      const base = phaseOf(standingIn(region), region, source.id);
      expect({ region, id: source.id, site: base.siteIndex ?? 0 }).toEqual({
        region,
        id: source.id,
        site: 0,
      });
      for (const season of SEASONS) {
        const stored = phaseOf(inSeason(season, region), region, source.id);
        // 뒤척임에 자리를 옮기는 원천은 그 철에 마디가 옮겨져 있다 — C016 이 세운 세계다
        const moved = season === TURN && MIGRATE_ON_TURN.has(source.id);
        expect({ region, id: source.id, season, phase: stored.phase, site: moved ? 0 : stored.siteIndex ?? 0 }).toEqual({
          region,
          id: source.id,
          season,
          phase: base.phase,
          site: 0,
        });
      }
    }
    // And 협곡의 원천들은 C020 이 세운 그대로 처음부터 캘 수 있다
    for (const { region, source } of ALL_SOURCES.filter((x) => x.region === ICE_CANYON || x.region === FROST_CANYON)) {
      expect({ region, id: source.id, phase: phaseOf(standingIn(region), region, source.id).phase }).toEqual({
        region,
        id: source.id,
        phase: AVAILABLE,
      });
    }
  }, 60_000);

  it('S-105 협곡 둘의 hash 는 State 로도 흔들리지 않는다 — 캐도 철이 돌아도 그 방의 판은 하나다', () => {
    const id = REGROWN_SOURCE!.source.id;
    const region = REGROWN_SOURCE!.region;
    const at = besideIn(region, sitesOf(region, id)[0]!);
    const w = standingIn(region, at, { actorItems: { pickaxe: 1 } });
    const base = w.observe().region.hash;
    expect(base).toBe(BASELINE[region]!.hash);
    // When 캐서 마디를 옮기고 되돌아옴을 지난다
    mineUntilDepleted(w, id);
    wait(w, recoveryOf(id));
    expect(phaseOf(w, region, id).phase).toBe(AVAILABLE);
    // Then 그 방의 판은 그대로다
    expect(w.observe().region.hash).toBe(base);
    // And 되돌아오는 중에도, 이웃 협곡에서도 마찬가지다
    const other = ICE_CANYON === region ? FROST_CANYON : ICE_CANYON;
    for (const season of SEASONS) {
      expect({ season, hash: inSeason(season, other).observe().region.hash }).toEqual({
        season,
        hash: BASELINE[other]!.hash,
      });
    }
    expect([RECOVERING, AVAILABLE]).toContain(phaseOf(w, region, id).phase);
  }, 60_000);
});
