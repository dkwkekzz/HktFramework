// C016 — 철이 방을 바꾼다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// C015 까지 때는 하늘의 색일 뿐이었다. 이 Cycle 이 그 때를 **방 위에 얹는다.** 그래서 재는 것은 넷이다:
//   ① 덧씌움 — 스밈에 그 자락이 한 단계 깊어지고 같은 자락이 위험으로 읽힌다
//      (그리고 그 자락 **밖**은 철과 무관하다 · 밝히지 않은 방은 철을 타지 않는다)
//   ② 활성과 출현 — 긴 밤에만 열리는 문 하나 · 스밈에만 서는 원천 하나.
//      둘 다 거절 사유가 **이 철이 아니다** 이고, 잠긴 것(connector-inactive)과 갈린다
//   ③ 뒤척임 — 자국을 묻고 자리를 옮긴다. **같은 뒤척임이 두 번 세지지 않고 통째로 건너뛰어도
//      빠뜨리지 않는다** (이 Cycle 의 가장 미끄러운 자리라 걸음의 크기를 나누어 잰다)
//   ④ 불변 — 땅도 hash 도 미로의 규칙도 백왕령도 한 값도 달라지지 않는다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(semantic/region-phase.ts · 바뀐 region.ts · resource.ts · transit.ts ·
// simulation/**)과 content/view/** 는 **읽지 않았다.** 기대값의 출처는
// cycles/C016-a-season-changes-the-room/spec.md 와 content/regions 의 데이터뿐이다.
//
// **이름도 자리도 손으로 적지 않는다** — 새 원천 · 새 문 · 덧씌움 area 의 이름은 content/regions
// 에서 읽고, 설 자리는 컴파일된 격자에서 고른다. 철의 길이는 semantic/clock.ts 의 상수를 쓴다
// (spec State 절이 "시계를 한 줄도 고치지 않는다" 고 못박았으므로 그 상수가 곧 계약이다).
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
import { isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  ANCHOR_LAYER,
  BIO_ORE_FIELD,
  COMPILE_RULES,
  CONDITION_PREFIX,
  DEPTH_LAYER,
  FOREST_DEEP,
  FOREST_EDGE,
  HAZARD_LAYER,
  PRESENCE_LAYER,
  REGION_GRAPH,
  PRESENCE_ROUTES,
  REGION_SPECS,
  RESOURCE_FLOWS,
  lockOfConnector,
  RESOURCE_LAYER,
  SETTLEMENT_LAYER,
  START_REGION_ID,
  WALKING_FOREST_DOOR,
  regionSpec,
  type ResourceSourceSpec,
  type SeasonId,
  ORE_EATER,
} from '../../regions';
// C008 이 세운 미로의 이름들 — 그 파일이 소유한다 (c008 ~ c015 시나리오의 선례 그대로).
import { CELL_LAYER, FANTASY_MAZE, MAZE_PATTERN_P2, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import { MAZE_HEART, MAZE_HEART_GATE, WHITE_KING_DOMAIN } from '../../regions';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import {
  CYCLE_SECONDS,
  DAY_SECONDS,
  LONG_NIGHT_SECONDS,
  SEEP_SECONDS,
  STILL_SECONDS,
  TURN_SECONDS,
} from '../semantic/clock';
import {
  INTERACTION_RANGE,
  STATE_VERSION,
  TICK_INTERVAL,
  type WorldState,
} from '../semantic/world-state';
import {
  isCollapsedAt,
  sourcePositionOf,
  sourceStateOf,
  sourcesInRegion,
  traceStrengthAt,
} from '../semantic/resource';
import type { PropertySource } from '../../../engine/world-authoring/property';
import { ASPECT_HEAT, RELATION_HIDES, propertyTag } from '../../regions/properties';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

// ── 철의 이름과 자리 (clock.ts 의 상수에서 유도한다 — 손으로 적는 수가 없다) ─────
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
/** 철 넷 — 관찰을 견주는 자리 */
const SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT, TURN];
/** Play 완료 확인이 말하는 세 철 (SPEC-010) — 뒤척임은 철과 철 사이의 60 초다 */
const THREE_SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT];

/** 그 철이 시작하는 세계 시각 — clock.ts 의 길이에서 그대로 나온다 */
const SEASON_AT: Readonly<Record<SeasonId, number>> = {
  STILL: 0,
  SEEP: STILL_SECONDS,
  LONG_NIGHT: STILL_SECONDS + SEEP_SECONDS,
  TURN: STILL_SECONDS + SEEP_SECONDS + LONG_NIGHT_SECONDS,
};

/** 이 Cycle 이 더한 사유·조건 코드 하나 (spec Observable · R5 · R7) */
const NOT_THIS_SEASON = 'not-this-season';
/** 그대로 쓰는 사유 코드들 (C002 · C009 · C012) */
const CONNECTOR_INACTIVE = 'connector-inactive';
const REGION_NOT_BUILT = 'region-not-built';
const OUT_OF_RANGE = 'out-of-range';
const SOURCE_DEPLETED = 'source-depleted';

/** phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';
const RECOVERING = 'recovering';

/** 깊이의 어휘 다섯 (spec SPEC-001 경계 ③ · Concept §3.2 — content/authoring/contracts.ts 와 같은 목록) */
const DEPTHS = ['civil', 'outer', 'wild', 'deep', 'abyss'] as const;

/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (C011~C015 어법) */
const MINE_SECONDS = 1.2;

/** spec 이 적은 State 형 버전 — 이 Cycle 이 여기까지 올린다 (SPEC-009 경계) */
// C017 CHANGED — 소란과 자국이 실리며 다시 올랐다. 이 항이 재는 것은 글자가 아니라
// "세계가 찍는 판이 팩의 판과 같다" 이므로 값만 따라 올린다
// C018 CHANGED — 지나감의 지금이 실리며 다시 올랐다 (재는 것은 글자가 아니라
// "세계가 찍는 판이 팩의 판과 같다" 이므로 값만 따라 올린다)
// C022 CHANGED — 탄생지와 개체군이 실리며 다시 올랐다 (같은 이유로 값만 따라 올린다)
// C034 CHANGED — 방의 기억(history)이 실리며 다시 올랐다 (같은 이유로 값만 따라 올린다)
// C039 — 몸의 State 에서 자리 셋이 사라지고 둘이 섰다 (최대값 둘 · 인지 범위 → 묻는 것 ·
// core · propertySources). 옛 스냅샷을 그대로 읽으면 틀린 세계가 되므로 판이 올랐다.
const RAISED_STATE_VERSION = 'hkt-adv-proto-i/12';
/** 그 앞의 버전 — 옛 스냅샷은 되살아나지 않는다 */
const OLD_STATE_VERSION = 'hkt-adv-proto-i/6';

/**
 * 이 시나리오들이 재는 것은 **재료 계통**이다 — 그 위에 얹힌 생명(C022 · C023)은 여기 없다.
 *
 * C023 부터 기본 세계는 t=60 에 첫 탄생을 일으켜 뿌리혹과 균사를 먹는다 (세계가 나 없이도
 * 도는 그것이다). 그러면 거기 매달린 노두의 되돌아옴이 멎어, 60 초 넘게 기다리는 이 시나리오들의
 * 전제("캐지 않으면 원천은 그대로다")가 깨진다.
 *
 * 그래서 **광식충이 이미 가득한 숲**에서 잰다 — 상한이면 결속도(요구가 "값 0" 이다) 계승도
 * (값을 올릴 수 없는 전이는 일어나지 않는다) 서지 않는다. 손잡이는 값을 상한으로 자르므로
 * 큰 수 하나면 된다. 재료 계통의 규칙은 한 줄도 달라지지 않는다.
 */
const solo: WorldSetup = { npcs: [], populations: { [ORE_EATER]: 99 } };

// C039 CHANGED — 빙결 심층의 문이 문 앞 몸에게 「체열이 숨겨지는가」를 묻게 되어(C039 규칙 6 ①)
// 답할 Source 가 없는 몸 앞에서는 긴 밤에도 잠긴다. 이 파일이 재는 것은 「철이 방을 바꾼다」이지
// 「몸이 답하는가」가 아니므로, 그 물음에 **답하는 몸**을 세워 철의 답을 그대로 잰다
// (C039 규칙 6 ② — 답이 들어오면 긴 밤에 열린다).
const HEAT_HIDDEN_SOURCE: PropertySource = {
  origin: 'c016:heat-hidden',
  property: propertyTag(ASPECT_HEAT, RELATION_HIDES),
  share: { kind: 'flag', value: true },
};

// ── 계약이 준 형 (spec State 절 그대로 적어 둔다) ────────────────────
interface SourceStateShape {
  phase: string;
  taken: number;
  progress?: number;
  siteIndex?: number;
  collapsedSites?: number[];
}
interface RegionStateShape {
  rule?: { pattern: string; pressure: number; rearrangedAt?: number };
  sources?: Record<string, SourceStateShape>;
}
type RegionStatesShape = Record<string, RegionStateShape>;
/** 원천에 실리는 자리들 (C012 · C013 의 것 그대로 — 이 Cycle 은 새 자리를 더하지 않는다) */
type SourceView = EntityView & {
  conditions?: readonly string[];
  siteIndex?: number;
  collapsedSites?: readonly number[];
};

// ── 하네스 (c013 · c014 · c015 의 선례 그대로) ───────────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id = PLAYER) => state(w).actors.find((a) => a.id === id)!;
const here = (w: WorldDriver, id = PLAYER): XZ => ({
  x: actorOf(w, id).position.x,
  z: actorOf(w, id).position.z,
});
const timeOf = (w: WorldDriver): number => state(w).time;
/** 지금까지 **적용한** 뒤척임의 수 — spec State 가 세운 자리 하나 (World.turnsApplied) */
const turnsAppliedOf = (w: WorldDriver): number =>
  (state(w) as unknown as { turnsApplied: number }).turnsApplied;

const statesOf = (w: WorldDriver) => state(w).regionStates as never;
const shapeOf = (w: WorldDriver): RegionStatesShape =>
  state(w).regionStates as unknown as RegionStatesShape;
const storedSource = (w: WorldDriver, region: string, id: string): SourceStateShape | undefined =>
  shapeOf(w)[region]?.sources?.[id];

const spaceOf = (id: string): RegionDescription => regionSpec(id)!.space;

const terrainMemo = new Map<string, CompiledWorldTerrain>();
function terrainOf(id: string): CompiledWorldTerrain {
  const hit = terrainMemo.get(id);
  if (hit) return hit;
  const made = compileRegion(spaceOf(id), COMPILE_RULES).world;
  terrainMemo.set(id, made);
  return made;
}

/** 그 방 격자의 자리 전부 — 자리를 손으로 적지 않기 위한 후보 목록 */
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
/** 격자를 고르게 훑는 표본 — 방마다 수천 자리를 네 번 재지 않기 위한 것 (c015 선례) */
const sampleSpots = (id: string): XZ[] => gridSpots(id).filter((_, i) => i % 7 === 0);
const walkableSpots = (region: string): XZ[] => {
  const t = terrainOf(region);
  return gridSpots(region).filter((p) => isTraversableAt(t, p.x, p.z));
};

const distanceBetween = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
const minBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]!);
const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);

const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;
/** C011 이 놓은 자리 — resource layer point 하나 */
const pointOf = (region: string, id: string): XZ => {
  const found = pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id);
  if (!found) throw new Error(`데이터에 원천 '${id}' 의 자리가 없다 (${region})`);
  return found.position;
};
/** 그 자리의 손 닿는 곳 — InteractionRange 안이다 */
const besideSpot = (at: XZ): XZ => ({ x: at.x + INTERACTION_RANGE / 2, z: at.z });

/** 그 원천의 성질 — 그 방 resourceEcology 가 소유한다 */
function ecologyOf(region: string, id: string): ResourceSourceSpec {
  const found = regionSpec(region)?.resourceEcology?.sources.find((s) => s.id === id);
  if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다 (${region})`);
  return found;
}
const harvestsOf = (region: string, id: string): number => ecologyOf(region, id).harvests;
const recoveryOf = (region: string, id: string): number => ecologyOf(region, id).recoverySeconds;

/** 원천을 가진 방들 — 이름을 손으로 적지 않는다 */
const SOURCE_REGIONS = REGION_SPECS.map((s) => s.id).filter((id) => sourcesInRegion(id).length > 0);
/** 방마다의 원천 목록 — {방, 원천 id} 짝으로 편다 */
const ALL_SOURCES = SOURCE_REGIONS.flatMap((region) =>
  sourcesInRegion(region).map((s) => ({ region, id: s.id })),
);
/** 철 조건을 밝힌 원천들 (C016 이 더한 것) — 데이터가 말한다 */
const SEASONAL_SOURCES = ALL_SOURCES.filter((one) => ecologyOf(one.region, one.id).occurrence);
/** 철 조건이 없는 원천들 — 어느 철에도 지금 그대로다 (SPEC-004 경계 ②) */
const PLAIN_SOURCES = ALL_SOURCES.filter(
  // 낮밤을 타는 원천도 뺀다 — 그것은 철이 아니라 해를 탄다 (RoomBearsMaterial 실주행 판정 · dayPhases)
  (one) => !ecologyOf(one.region, one.id).occurrence && !ecologyOf(one.region, one.id).dayPhases,
);
/** 흐름의 두 끝이 사는 방들 — 그 원천과 흔적은 **세계 시각**으로 바뀐다 (C014) */
const inflowRegions = new Set(
  RESOURCE_FLOWS.flatMap((flow) => [flow.from.regionId, flow.to.regionId]),
);

/** 그 원천의 **마디 목록** — 밝힌 원천은 presence 곡선의 points, 아니면 자리 하나 (c013 선례) */
function sitesOf(region: string, id: string): XZ[] {
  const tag = ecologyOf(region, id).siteCurve;
  if (!tag) return [pointOf(region, id)];
  const curve = curvesOf(spaceOf(region), PRESENCE_LAYER, tag)[0];
  if (!curve) throw new Error(`원천 '${id}' 의 뿌리 곡선(presence · ${tag})이 데이터에 없다`);
  return curve.points.map((p) => ({ x: p.x, z: p.z }));
}
const migratory = (region: string, id: string): boolean => sitesOf(region, id).length > 1;

// ── 이 Cycle 이 데이터에 세운 것들 — **이름을 읽어 온다** ────────────
//
// spec 은 이름을 적지 않는다 (Observable "싣지 않는다" 의 규율 그대로). 관찰자가 자기
// content/regions 를 훑어 스스로 얻는 것이 이 저장소의 길이다 (C005~C007 · C011~C013).

/** 스밈에 깊어지는 자락 — 그 방 phases 가 밝힌 depth 덧씌움 하나 */
function depthOverlayOf(region: string, season: SeasonId) {
  return regionSpec(region)?.phases?.seasons?.[season]?.depthOverlay?.[0];
}
/** 그 철에 위험으로 읽히는 자락 */
function hazardOverlayOf(region: string, season: SeasonId) {
  return regionSpec(region)?.phases?.seasons?.[season]?.hazardExtend?.[0];
}
/** 덧씌움을 밝힌 방들 (데이터가 말한다) */
// C019 로 좁혀졌다 — 위상을 밝힌 방이 곧 **철을 타는** 방이 아니게 되었다. 협곡 둘은
// phases.standing 만 밝히고 그것은 철도 소란도 아닌 자리다 (C019 spec R1). 이 목록이 재는
// 것은 "철에 매인 위상을 밝힌 방" 이므로 seasons · onTurn 을 밝힌 방만 여기 든다.
const PHASE_ROOMS = REGION_SPECS.filter((s) => s.phases?.seasons ?? s.phases?.onTurn).map(
  (s) => s.id,
);
/** 그 가운데 철별 덧씌움을 밝힌 방 · 뒤척임을 밝힌 방 */
const SEASON_ROOMS = REGION_SPECS.filter((s) => s.phases?.seasons).map((s) => s.id);
const TURN_ROOMS = REGION_SPECS.filter((s) => s.phases?.onTurn).map((s) => s.id);
/**
 * 그 문이 밝힌 철들 — 밝히지 않았으면 없다 (C029 CHANGED).
 *
 * 읽는 자리가 graph 의 활성 표에서 **그 문에 걸린 Lock** 으로 바뀌었다 (그 방의 access.locks).
 * 재는 사실은 한 값도 다르지 않다: 어느 문이 어느 철에 열리는가는 여전히 데이터에만 있고
 * 이 시나리오는 이름을 손으로 적지 않는다.
 */
const doorSeasonsOf = (connectorId: string): readonly SeasonId[] | undefined =>
  lockOfConnector(connectorId)?.requires.find((one) => one.time)?.time?.seasons;

/** 철 조건을 가진 문들과 그 문이 나가는 방 (그 방의 Lock 이 말한다) */
const SEASONAL_CONNECTORS = REGION_GRAPH.connectors.filter(
  (c) => doorSeasonsOf(c.id) !== undefined,
);
const SEASON_DOOR_ROOMS = [...new Set(SEASONAL_CONNECTORS.map((c) => c.from.region))];
/** 철 조건이 없는 문들 — 어느 철에도 지금 그대로다 (SPEC-003 경계 ②) */
const PLAIN_CONNECTORS = REGION_GRAPH.connectors.filter(
  (c) => doorSeasonsOf(c.id) === undefined,
);

/** 그 layer 의 area 태그가 걸린, 걸어 설 수 있는 자리 — 덧씌움 안이다 */
function spotInLayer(region: string, layer: string, tag: string): XZ {
  const t = terrainOf(region);
  const inside = walkableSpots(region).filter((p) => tagsAt(t, p.x, p.z, layer).includes(tag));
  if (inside.length === 0) throw new Error(`${region} 에 '${layer}/${tag}' 가 걸린 설 자리가 없다`);
  const area = areasOf(spaceOf(region), layer).find((a) => a.tag === tag);
  const center =
    area && area.shape.kind === 'circle' ? area.shape.center : inside[0]!;
  return minBy(inside, (p) => distanceBetween(p, center));
}
/** 그 layer 의 태그가 하나도 걸리지 않은, 걸어 설 수 있는 자리 — 덧씌움 **밖**이다 */
function spotOutsideLayer(region: string, layer: string, from: XZ): XZ {
  const t = terrainOf(region);
  const outside = walkableSpots(region).filter((p) => tagsAt(t, p.x, p.z, layer).length === 0);
  if (outside.length === 0) throw new Error(`${region} 에 '${layer}' 밖의 설 자리가 없다`);
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

/** 그 철에서 시작하는 세계 — C015 가 세운 손잡이 (WorldSetup.clock) */
const inSeason = (season: SeasonId, region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  standingIn(region, at, { ...extra, clock: season });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};

/** dt 를 잘게 나누어 준다 (기본 한 걸음 1 세계 초) — c013 · c015 의 wait 선례 그대로 */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}

/**
 * 그 세계 시각까지 굴린다. 한 바퀴가 2220 세계 초라 **큰 걸음**(기본 60 초)으로 간다.
 *
 * 걸음을 나누는 이유가 하나 더 있다 — 세계는 그 걸음이 **끝난** 시각을 다음 Tick 에 읽는다
 * (아래 S-064 가 그 어긋남을 잰다). 60 초 걸음이면 뒤척임(60 초)을 지나는 걸음의 다음 걸음이
 * 그 안에 있어 기다림이 자연스럽게 끝난다.
 */
function runTo(w: WorldDriver, target: number, step = 60) {
  const left = target - timeOf(w);
  if (left <= 1e-9) return;
  wait(w, left, step);
}
/**
 * 그 철 **안으로** 굴린다 (이미 지났으면 다음 바퀴의 그 자리로).
 *
 * 철이 시작하는 시각에 딱 멈추지 않고 1 초를 더 간다 — 세계는 한 걸음이 **끝난** 시각을
 * 다음 Tick 에 읽으므로, 경계에 딱 멈추면 그 철의 일(뒤척임)이 아직 일어나지 않았다.
 * 실주행의 Tick 은 1/30 초라 이 어긋남은 보이지 않는다 (S-064 의 주석 · 하네스 결손에 적었다).
 */
const SEASON_MARGIN = 1;
function runToSeason(w: WorldDriver, season: SeasonId, step = 60) {
  const now = timeOf(w);
  const cycles = Math.floor(now / CYCLE_SECONDS);
  let start = cycles * CYCLE_SECONDS + SEASON_AT[season];
  if (start < now + 1e-9) start += CYCLE_SECONDS;
  // 그 철이 시작하는 자리까지 큰 걸음으로 가고, 거기서 한 걸음을 더 딛는다 —
  // **그 철에서 시작하는 Tick** 이 하나 있어야 그 철의 일이 일어난다.
  runTo(w, start, step);
  wait(w, SEASON_MARGIN, SEASON_MARGIN);
}

const move = (w: WorldDriver, at: XZ, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } }, observerId);
const mine = (w: WorldDriver, targetEntityId: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId }, observerId);
function mineOnce(w: WorldDriver, id: string, observerId = OBSERVER): ActionResult {
  const result = mine(w, id, observerId);
  tickFor(w, MINE_SECONDS + TICK_INTERVAL);
  return result;
}
const cross = (w: WorldDriver, connector: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector }, observerId);
/** 판정의 사유 — 받아들여진 판정에는 사유가 없다 (ActionResult 는 갈래가 둘이다) */
const reasonOf = (result: ActionResult): string | undefined =>
  'reason' in result ? (result.reason as string) : undefined;

// ── 저장·복구 (c013 · c014 · c015 의 선례 그대로) ───────────────────
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
/** 파일을 지나는 저장 — server/world-store.ts 가 하는 일 그대로 */
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
/** 되살리면서 State 를 한 자리 고친 세계 — 걸어서는 세울 수 없는 Given 을 공개 길로 세운다 */
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
const moveBody = (
  w: WorldDriver,
  region: string,
  at: XZ,
  id = PLAYER,
  observers: readonly string[] = [OBSERVER],
): WorldDriver => worldFrom(w, (s) => place(s, id, region, at), observers);

/** 관찰자 둘이 각자의 자리에 선 세계 */
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
const seasonOf = (w: WorldDriver, observerId = OBSERVER): string =>
  w.observe(observerId).clock.season;
/** hud 의 region.depth 줄 — 이 Cycle 이 **내가 선 자리**의 것으로 바꾼 값 (R2) */
const depthSeen = (w: WorldDriver, observerId = OBSERVER): unknown =>
  w.observe(observerId).hud.find((h) => h.id === 'region.depth')?.value;
const conditionsSeen = (w: WorldDriver, observerId = OBSERVER): string[] =>
  w.observe(observerId).standingConditions;
const sourcesIn = (v: GameViewSnapshot): SourceView[] =>
  v.entities.filter((e) => e.role === 'resource-source') as SourceView[];
const sourceEntity = (v: GameViewSnapshot, id: string): SourceView | undefined =>
  sourcesIn(v).find((e) => e.id === id);
const exitsIn = (v: GameViewSnapshot): EntityView[] =>
  v.entities.filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  exitsIn(v).find((e) => e.id === id);
const transitTo = (v: GameViewSnapshot, connector: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'transit' && i.targetEntityId === connector);
const heldOf = (v: GameViewSnapshot, material: string): unknown =>
  v.hud.find((h) => h.id === `inventory.${material}`)?.value;

/** 그 원천이 지금 서 있는 자리 — 밤에 실리지 않아도 세계 쪽 함수는 답한다 */
const sourceAt = (w: WorldDriver, region: string, id: string): XZ => {
  const source = sourcesInRegion(region).find((s) => s.id === id)!;
  const at = sourcePositionOf(statesOf(w), source);
  return { x: at.x, z: at.z };
};
const storedOf = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w), region, id) as SourceStateShape;

/** 덧씌움이 가리키는 area op 의 태그 — 컴파일 결과를 훑을 때 쓰는 이름이다 */
function areaTagOf(region: string, areaId: string): string {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return op.tag;
}

// ── 이 Cycle 이 세운 구체적 이름들 — 전부 데이터에서 읽는다 ─────────
/** 깊이·위험 덧씌움을 밝힌 방과 그 철 (지금 데이터로는 숲 가장자리의 스밈 하나) */
const OVERLAY_ROOM = SEASON_ROOMS[0]!;
const OVERLAY_SEASON = (Object.keys(regionSpec(OVERLAY_ROOM)!.phases!.seasons!)[0] as SeasonId)!;
const DEPTH_OVERLAY = depthOverlayOf(OVERLAY_ROOM, OVERLAY_SEASON)!;
const HAZARD_OVERLAY = hazardOverlayOf(OVERLAY_ROOM, OVERLAY_SEASON)!;
/** 그 방의 깊이 — 덧씌움이 없을 때 실리는 값 (C001 부터 그대로) */
const ROOM_DEPTH = regionSpec(OVERLAY_ROOM)!.depth;
/** 덧씌움이 걸린 자락 안의 설 자리 · 그 자락 **밖**의 설 자리 */
const insideOverlay = (): XZ =>
  spotInLayer(OVERLAY_ROOM, DEPTH_LAYER, areaTagOf(OVERLAY_ROOM, DEPTH_OVERLAY.areaId));
const outsideOverlay = (): XZ => spotOutsideLayer(OVERLAY_ROOM, DEPTH_LAYER, insideOverlay());

/** 뒤척임을 밝힌 방과 그것이 옮기는 원천 (지금 데이터로는 생체 광석 지대의 노두 하나) */
const TURN_ROOM = TURN_ROOMS[0]!;
const MIGRATING = regionSpec(TURN_ROOM)!.phases!.onTurn!.migrateSources![0]!;

/** 철 조건을 가진 문과 그 방 (지금 데이터로는 숲 깊은 곳의 걷는 숲 문 하나) */
const SEASONAL_DOOR = SEASONAL_CONNECTORS[0]!;
const DOOR_ROOM = SEASONAL_DOOR.from.region;
const DOOR_SEASONS = doorSeasonsOf(SEASONAL_DOOR.id)!;
const doorSpot = (): XZ => anchorAt(DOOR_ROOM, SEASONAL_DOOR.from.anchor);

/** 철 조건을 가진 원천 (지금 데이터로는 숲 가장자리의 스밈 껍질 하나) */
const SEASONAL_SOURCE = SEASONAL_SOURCES[0]!;
const SOURCE_SEASONS = ecologyOf(SEASONAL_SOURCE.region, SEASONAL_SOURCE.id).occurrence!.seasons;

/** 그 철에 그 문/원천이 서지 않는 철들 */
const withoutDoor = SEASONS.filter((s) => !DOOR_SEASONS.includes(s));
const withoutSource = SEASONS.filter((s) => !SOURCE_SEASONS.includes(s));

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 스밈에 방의 한 자락이 깊어진다', () => {
  it('S-011 그 자락에 서면 고요에는 방의 깊이 · 스밈에는 한 단계 깊은 값이 실린다', () => {
    const at = insideOverlay();
    // Given 덧씌움을 밝힌 방의 그 자락 — 고요에 선다
    const quiet = inSeason(STILL, OVERLAY_ROOM, at);
    expect(seasonOf(quiet)).toBe(STILL);
    // Then 방의 깊이 그대로다 (데이터가 말하는 그 방의 depth)
    expect(depthSeen(quiet)).toBe(ROOM_DEPTH);

    // When 같은 자리에 스밈에 선다
    const seep = inSeason(OVERLAY_SEASON, OVERLAY_ROOM, at);
    expect(seasonOf(seep)).toBe(OVERLAY_SEASON);
    // Then 그 area 가 밝힌 한 단계 깊은 값이 실린다
    expect(depthSeen(seep)).toBe(DEPTH_OVERLAY.depth);
    // And 그 값은 방의 깊이보다 한 칸 깊다 (어휘 다섯의 다음 칸)
    expect(DEPTHS.indexOf(DEPTH_OVERLAY.depth as (typeof DEPTHS)[number])).toBe(
      DEPTHS.indexOf(ROOM_DEPTH as (typeof DEPTHS)[number]) + 1,
    );
  });

  it('S-012 (경계 ①) 같은 방이라도 그 자락 밖이면 철과 무관하게 방의 깊이다', () => {
    const out = outsideOverlay();
    for (const season of SEASONS) {
      // Given 같은 방, 덧씌움 밖의 자리
      const w = inSeason(season, OVERLAY_ROOM, out);
      // Then 어느 철에도 방의 깊이 그대로다
      expect({ season, depth: depthSeen(w) }).toEqual({ season, depth: ROOM_DEPTH });
    }
  });

  it('S-013 (경계 ②) 덧씌움을 밝히지 않은 방은 어느 철에도 방의 깊이 그대로다', () => {
    for (const spec of REGION_SPECS.filter((s) => !SEASON_ROOMS.includes(s.id))) {
      for (const season of SEASONS) {
        const w = inSeason(season, spec.id);
        expect({ region: spec.id, season, depth: depthSeen(w) }).toEqual({
          region: spec.id,
          season,
          depth: spec.depth,
        });
      }
    }
  });

  it('S-014 (경계 ③) 실리는 깊이는 어휘 다섯 안이다', () => {
    // 데이터가 밝힌 덧씌움의 값도, 실제로 실린 값도 다섯 안이다
    expect(DEPTHS).toContain(DEPTH_OVERLAY.depth);
    for (const spec of REGION_SPECS) expect(DEPTHS).toContain(spec.depth);
    const seen = inSeason(OVERLAY_SEASON, OVERLAY_ROOM, insideOverlay());
    expect(DEPTHS).toContain(depthSeen(seen));
  });
});

describe('SPEC-002 스밈에 그 자락이 위험으로 읽힌다', () => {
  /** 위험 덧씌움이 걸린 자락 안의 설 자리 */
  const hazardSpot = (): XZ =>
    spotInLayer(OVERLAY_ROOM, HAZARD_LAYER, areaTagOf(OVERLAY_ROOM, HAZARD_OVERLAY.areaId));

  it('S-021 스밈에만 그 자리의 위험 코드가 실린다', () => {
    const at = hazardSpot();
    // Given 스밈에 그 자락에 선다 / Then 데이터가 밝힌 위험 코드가 실린다
    const seep = inSeason(OVERLAY_SEASON, OVERLAY_ROOM, at);
    expect(conditionsSeen(seep)).toContain(HAZARD_OVERLAY.hazard);
    // 그 코드는 어휘 일곱의 형이다 (hazard/… — contracts.ts 의 HAZARD_KINDS 와 같은 어법)
    expect(HAZARD_OVERLAY.hazard.startsWith('hazard/')).toBe(true);
  });

  it('S-022 (경계 ①) 다른 철에는 그 자리에 위험 코드가 없다', () => {
    const at = hazardSpot();
    for (const season of SEASONS.filter((s) => s !== OVERLAY_SEASON)) {
      const w = inSeason(season, OVERLAY_ROOM, at);
      expect({ season, seen: conditionsSeen(w) }).toEqual({ season, seen: [] });
    }
  });

  it('S-023 (경계 ②) **철이 건드리지 않는** 안전의 코드는 철 넷에서 한 값도 달라지지 않는다', () => {
    // C021 로 좁혀졌다 — 다른 방의 위상이 이음을 넘어 어떤 조건 자락을 약하게 할 수 있게
    // 되었다 (C021 SPEC-001). 이 항이 재는 것은 여전히 "철이 밝히지 않은 것은 흔들지
    // 않는다" 이므로, **넘어 온 것이 가리킨 자락**은 이 무리에서 뺀다 — 그 자락의 약해짐은
    // C021 이 잰다. 기대를 낮추는 것이 아니라 자리를 옮기는 것이다 (S-024 의 선례 그대로).
    const weakened = new Set(
      REGION_SPECS.flatMap((spec) =>
        Object.values(spec.phases?.seasons ?? {}).flatMap((phase) =>
          ((phase as { outflow?: readonly { region: string; areaId: string }[] }).outflow ?? [])
            .filter((entry) => entry.region === WHITE_KING_DOMAIN)
            .map((entry) => entry.areaId),
        ),
      ),
    );
    const weakenedTags = new Set(
      spaceOf(WHITE_KING_DOMAIN)
        .ops.filter((op) => weakened.has(op.id) && op.kind === 'area')
        .map((op) => (op as { tag: string }).tag),
    );
    // Given 조건이 걸린 자리 — 백왕령의 settlement layer 에서 데이터로 고른다
    const t = terrainOf(WHITE_KING_DOMAIN);
    const spot = walkableSpots(WHITE_KING_DOMAIN).find((p) => {
      const tags = tagsAt(t, p.x, p.z, SETTLEMENT_LAYER).filter((tag) =>
        tag.startsWith(CONDITION_PREFIX),
      );
      return tags.length > 0 && tags.every((tag) => !weakenedTags.has(tag));
    });
    if (!spot) throw new Error('백왕령에 조건이 걸린 설 자리가 없다');
    let expected: string[] | null = null;
    for (const season of SEASONS) {
      const w = inSeason(season, WHITE_KING_DOMAIN, spot);
      const seen = [...conditionsSeen(w)];
      expect(seen.length).toBeGreaterThan(0);
      // Then 그 코드는 전부 C006 의 것이다 — 위험이 섞여 들지 않는다
      for (const tag of seen) expect({ season, tag, ok: tag.startsWith(CONDITION_PREFIX) }).toEqual({ season, tag, ok: true });
      if (expected === null) expected = seen;
      else expect({ season, seen }).toEqual({ season, seen: expected });
    }
  });

  it('S-024 (경계 ③) 위험을 밝히지 않은 방·자리는 어느 철에도 비어 있다', () => {
    // 같은 방이라도 그 자락 밖이면 비어 있다
    for (const season of SEASONS) {
      const w = inSeason(season, OVERLAY_ROOM, outsideOverlay());
      expect({ season, seen: conditionsSeen(w) }).toEqual({ season, seen: [] });
    }
    // 그리고 위험을 밝히지 않은 방은 어디에도 없다.
    //
    // C018 CHANGED — **지나가는 것**이 지나는 방은 뺀다. 그것이 거는 위험은 철이 거는 것이
    // 아니라 지금 무엇이 그 방을 지나느냐가 거는 것이고(원인이 다르다), 이 항이 재는 것은
    // "철이 밝히지 않은 방을 흔들지 않는다" 이다. 지나가는 것이 거는 위험은 C018 이 잰다.
    const ON_A_ROUTE = new Set(
      PRESENCE_ROUTES.flatMap((route) =>
        route.nodes.flatMap((node) => node.map((choice) => choice.region)),
      ),
    );
    // C019 CHANGED — **늘 서 있는 위상**을 밝힌 방도 뺀다. 그 위험은 철이 거는 것이 아니라
    // 방 자체가 원인 없이 늘 걸고 있는 것이고(C019 spec R1), 이 항이 재는 것은 여전히
    // "철이 밝히지 않은 방을 흔들지 않는다" 이다. 상시의 위험은 C019 가 잰다.
    for (const spec of REGION_SPECS.filter(
      (s) =>
        !SEASON_ROOMS.includes(s.id) &&
        s.id !== WHITE_KING_DOMAIN &&
        !ON_A_ROUTE.has(s.id) &&
        s.phases?.standing === undefined,
    )) {
      for (const season of SEASONS) {
        const w = inSeason(season, spec.id);
        expect({ region: spec.id, season, seen: conditionsSeen(w) }).toEqual({
          region: spec.id,
          season,
          seen: [],
        });
      }
    }
  });
});

describe('SPEC-003 긴 밤에만 문이 열린다', () => {
  it('S-031 그 철에는 열림이고 건너기가 "이 철이 아니다" 로 거절되지 않는다', () => {
    for (const season of DOOR_SEASONS) {
      // Given 그 문 앞에 선다
      const w = inSeason(season, DOOR_ROOM, doorSpot());
      expect(seasonOf(w)).toBe(season);
      // Then 표식이 열림이다
      expect({ season, state: exitOf(w.observe(), SEASONAL_DOOR.id)?.state }).toEqual({
        season,
        state: 'open',
      });
      // And 건너기는 철 때문에 거절되지 않는다 (너머가 아직 없는 것은 경계 ③ 이 본다)
      expect({ season, reason: transitTo(w.observe(), SEASONAL_DOOR.id)?.reason }).not.toEqual({
        season,
        reason: NOT_THIS_SEASON,
      });
      expect(reasonOf(cross(w, SEASONAL_DOOR.id))).not.toBe(NOT_THIS_SEASON);
    }
  });

  it('S-032 다른 철에는 잠김이고 거절 사유가 "이 철이 아니다" 다', () => {
    for (const season of withoutDoor) {
      const w = inSeason(season, DOOR_ROOM, doorSpot());
      // 몸은 아무것도 하지 않았다 — 갈리는 것은 철뿐이다
      expect(here(w)).toEqual({ x: doorSpot().x, z: doorSpot().z });
      // Then 표식이 잠김이다
      expect({ season, state: exitOf(w.observe(), SEASONAL_DOOR.id)?.state }).toEqual({
        season,
        state: 'locked',
      });
      // And 그 자리에서 사유가 읽힌다
      expect(transitTo(w.observe(), SEASONAL_DOOR.id)).toMatchObject({
        available: false,
        reason: NOT_THIS_SEASON,
      });
      // And 건너기가 그 사유로 거절되고 몸은 하나도 바뀌지 않는다
      expect(cross(w, SEASONAL_DOOR.id)).toEqual({
        status: 'failure',
        rule: 'RULE-REGION-TRANSIT-001',
        reason: NOT_THIS_SEASON,
      });
      expect(actorOf(w).regionId).toBe(DOOR_ROOM);
      expect(here(w)).toEqual({ x: doorSpot().x, z: doorSpot().z });
    }
  });

  it('S-033 (경계 ①) 잠긴 문(미로 심장 문)은 여전히 connector-inactive 다 — 둘이 갈린다', () => {
    const gateAt = anchorAt(FANTASY_MAZE, 'HEART_GATE');
    for (const season of SEASONS) {
      // Given 패턴이 P2 가 아닌 미로의 심장 쪽 문 앞 (처음 패턴 그대로)
      const w = inSeason(season, FANTASY_MAZE, gateAt);
      expect(shapeOf(w)[FANTASY_MAZE]?.rule?.pattern).not.toBe(MAZE_PATTERN_P2);
      // Then 표식은 잠김이지만 사유는 **철이 아니다** — 패턴 때문이다
      expect({ season, state: exitOf(w.observe(), MAZE_HEART_GATE)?.state }).toEqual({
        season,
        state: 'locked',
      });
      expect(cross(w, MAZE_HEART_GATE)).toEqual({
        status: 'failure',
        rule: 'RULE-REGION-TRANSIT-001',
        reason: CONNECTOR_INACTIVE,
      });
    }
  });

  it('S-034 (경계 ②) 철 조건이 없는 문 전부는 어느 철에도 지금 그대로다', () => {
    const plainIds = new Set(PLAIN_CONNECTORS.map((c) => c.id));
    for (const spec of REGION_SPECS) {
      let expected: string[] | null = null;
      for (const season of SEASONS) {
        const w = inSeason(season, spec.id);
        const seen = exitsIn(w.observe())
          .filter((e) => plainIds.has(e.id))
          .map((e) => `${e.id}/${e.state}@${e.position.x},${e.position.z}`)
          .sort();
        if (expected === null) expected = seen;
        else expect({ region: spec.id, season, seen }).toEqual({ region: spec.id, season, seen: expected });
      }
    }
  });

  it('S-035 (경계 ③) 열려 있어도 건너간 결과는 region-not-built 이고 거리 판정이 그보다 앞이다', () => {
    const at = doorSpot();
    // Given 그 문이 열리는 철, 문 앞에 선다
    const open = inSeason(DOOR_SEASONS[0]!, DOOR_ROOM, at);
    expect(exitOf(open.observe(), SEASONAL_DOOR.id)?.state).toBe('open');
    // Then 건너면 아직 짓지 않은 곳이라고 거절된다 (C002 가 세운 대답 그대로)
    expect(cross(open, SEASONAL_DOOR.id)).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: REGION_NOT_BUILT,
    });
    expect(actorOf(open).regionId).toBe(DOOR_ROOM);

    // Given 그 문에서 먼 자리 (같은 방)
    const far = maxBy(walkableSpots(DOOR_ROOM), (p) => distanceBetween(p, at));
    expect(distanceBetween(far, at)).toBeGreaterThan(INTERACTION_RANGE);
    // Then 열린 철에도 먼 자리에서는 **거리**가 먼저 걸린다 (C009 가 세운 순서)
    const farOpen = inSeason(DOOR_SEASONS[0]!, DOOR_ROOM, far);
    expect(cross(farOpen, SEASONAL_DOOR.id)).toMatchObject({ reason: OUT_OF_RANGE });
    // And 닫힌 철에도 거리가 닫힘보다 앞이다
    for (const season of withoutDoor) {
      const farShut = inSeason(season, DOOR_ROOM, far);
      expect({ season, reason: reasonOf(cross(farShut, SEASONAL_DOOR.id)) }).toEqual({
        season,
        reason: OUT_OF_RANGE,
      });
    }
  });

  it('S-036 (경계 ④) 관찰 결과는 무엇이 그것을 열었는지 말하지 않는다 — 열림/잠김뿐이다', () => {
    const at = doorSpot();
    const keys = (v: object) => Object.keys(v).sort();
    const open = inSeason(DOOR_SEASONS[0]!, DOOR_ROOM, at);
    const shut = inSeason(withoutDoor[0]!, DOOR_ROOM, at);
    const seenOpen = exitOf(open.observe(), SEASONAL_DOOR.id)!;
    const seenShut = exitOf(shut.observe(), SEASONAL_DOOR.id)!;
    // 형이 같고 — 새 자리가 나지 않았다
    expect(keys(seenOpen)).toEqual(keys(seenShut));
    // 철 조건이 없는 문과도 형이 같다
    const plain = exitsIn(open.observe()).find((e) => e.id !== SEASONAL_DOOR.id)!;
    expect(keys(seenOpen)).toEqual(keys(plain));
    // 다른 것은 state 하나뿐이다 — 무엇이 열었는지는 어디에도 없다
    expect({ ...seenOpen, state: null }).toEqual({ ...seenShut, state: null });
  });
});

describe('SPEC-004 철 조건 원천은 그 철에만 선다', () => {
  const at = () => pointOf(SEASONAL_SOURCE.region, SEASONAL_SOURCE.id);
  const material = () => ecologyOf(SEASONAL_SOURCE.region, SEASONAL_SOURCE.id).materialId;

  it('S-041 그 철에는 서 있고 캘 수 있다 — 다른 철에는 관찰 결과에 서지 않는다', () => {
    for (const season of SOURCE_SEASONS) {
      // Given 그 철에 그 자리 곁에 선다
      const w = inSeason(season, SEASONAL_SOURCE.region, besideSpot(at()), {
        actorItems: { pickaxe: 3 },
      });
      // Then 관찰 결과에 서 있고 자리가 데이터 그대로다
      const seen = sourceEntity(w.observe(), SEASONAL_SOURCE.id);
      expect({ season, role: seen?.role, x: seen?.position.x, z: seen?.position.z }).toEqual({
        season,
        role: 'resource-source',
        x: at().x,
        z: at().z,
      });
      // And 캘 수 있다
      expect(mineOnce(w, SEASONAL_SOURCE.id)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
      expect(heldOf(w.observe(), material())).toBe(1);
    }
    for (const season of withoutSource) {
      // Then 다른 철에는 그 자리에 아무것도 없다
      const w = inSeason(season, SEASONAL_SOURCE.region, besideSpot(at()));
      expect({ season, seen: sourceEntity(w.observe(), SEASONAL_SOURCE.id) }).toEqual({
        season,
        seen: undefined,
      });
    }
  });

  it('S-042 (경계 ①) 다른 철에 지목하면 사유가 "이 철이 아니다" 다 — 바닥남과 갈린다', () => {
    for (const season of withoutSource) {
      const w = inSeason(season, SEASONAL_SOURCE.region, besideSpot(at()), {
        actorItems: { pickaxe: 3 },
      });
      expect({ season, result: mine(w, SEASONAL_SOURCE.id) }).toEqual({
        season,
        result: { status: 'failure', rule: 'RULE-MINE-001', reason: NOT_THIS_SEASON },
      });
      // And 손에 아무것도 들어오지 않는다
      expect(heldOf(w.observe(), material())).toBeUndefined();
    }
    // 그리고 그 사유는 **바닥남**과 다른 말이다 — 같은 방의 다른 원천을 다 캐 본다
    const plain = PLAIN_SOURCES.find((s) => s.region === SEASONAL_SOURCE.region)!;
    const dry = inSeason(STILL, plain.region, besideSpot(pointOf(plain.region, plain.id)), {
      actorItems: { pickaxe: 9 },
    });
    for (let i = 0; i < harvestsOf(plain.region, plain.id); i++) {
      expect(mineOnce(dry, plain.id).status).toBe('success');
    }
    expect(mine(dry, plain.id)).toMatchObject({ reason: SOURCE_DEPLETED });
  });

  it('S-043 (경계 ②) 철 조건이 없는 원천은 어느 철에도 지금 그대로다', () => {
    for (const one of PLAIN_SOURCES) {
      for (const season of SEASONS) {
        const base = inSeason(season, one.region);
        // 밤에는 먼 원천이 실리지 않으므로(C015) 그 자리 곁으로 몸을 옮겨 본다
        const w = moveBody(base, one.region, besideSpot(sourceAt(base, one.region, one.id)));
        const seen = sourceEntity(w.observe(), one.id);
        expect({ id: one.id, season, standing: seen !== undefined }).toEqual({
          id: one.id,
          season,
          standing: true,
        });
      }
    }
  });

  it('S-044 (경계 ③) 그 철이 지나도 손에 든 재료는 그대로 남는다', () => {
    // Given 그 철에 한 번 캐서 손에 든다
    const w = inSeason(SOURCE_SEASONS[0]!, SEASONAL_SOURCE.region, besideSpot(at()), {
      actorItems: { pickaxe: 3 },
    });
    expect(mineOnce(w, SEASONAL_SOURCE.id).status).toBe('success');
    const held = heldOf(w.observe(), material());
    expect(held).toBe(1);
    // When 그 철이 지나 다음 철로 넘어간다
    const next = SEASONS[(SEASONS.indexOf(SOURCE_SEASONS[0] as SeasonId) + 1) % SEASONS.length]!;
    runToSeason(w, next);
    expect(seasonOf(w)).toBe(next);
    // Then 원천은 서지 않지만 손에 든 것은 그대로다
    expect(sourceEntity(w.observe(), SEASONAL_SOURCE.id)).toBeUndefined();
    expect(heldOf(w.observe(), material())).toBe(held);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 · SPEC-006 — 뒤척임
//
// **걸음의 크기가 곧 검사 대상**인 자리다 (R8 경계 ① ②). 그래서 여기서는 runTo 의 기본 걸음에
// 기대지 않고 검사마다 걸음을 손으로 나눈다.
// ─────────────────────────────────────────────────────────────────────

/** 그 방 그 원천의 마디 목록 · 지금 선 마디 */
const sitesOfTurnRoom = (): XZ[] => sitesOf(TURN_ROOM, MIGRATING);
const siteIndexOf = (w: WorldDriver, region = TURN_ROOM, id = MIGRATING): number =>
  storedOf(w, region, id).siteIndex ?? 0;
const collapsedOf = (w: WorldDriver, region = TURN_ROOM, id = MIGRATING): number[] =>
  storedOf(w, region, id).collapsedSites ?? [];

/** 그 원천 곁에 선 세계 — 지금 서 있는 마디의 손 닿는 곳이다 */
function besideSource(w: WorldDriver, region: string, id: string): WorldDriver {
  return moveBody(w, region, besideSpot(sourceAt(w, region, id)));
}

describe('SPEC-005 뒤척임이 자국을 묻는다', () => {
  it('S-051 고갈시켜 무너뜨린 뒤 뒤척임을 지나면 전부 처음 상태이고 그 자리를 다시 지난다', () => {
    // Given 노두 곁에서 다 캔다 — 캔 횟수가 차고 그 마디가 무너진다 (C012 · C013)
    const start = inSeason(LONG_NIGHT, TURN_ROOM, besideSpot(pointOf(TURN_ROOM, MIGRATING)), {
      actorItems: { pickaxe: 9 },
    });
    for (let i = 0; i < harvestsOf(TURN_ROOM, MIGRATING); i++) {
      expect(mineOnce(start, MIGRATING).status).toBe('success');
    }
    const buriedSite = siteIndexOf(start);
    expect(storedOf(start, TURN_ROOM, MIGRATING)).toMatchObject({
      phase: DEPLETED,
      taken: harvestsOf(TURN_ROOM, MIGRATING),
    });
    expect(collapsedOf(start)).toContain(buriedSite);
    // 그 무너진 자리는 지날 수 없다 (C012)
    const pit = sitesOfTurnRoom()[buriedSite]!;
    expect(isCollapsedAt(statesOf(start), TURN_ROOM, pit)).toBe(true);

    // When 뒤척임이 지나간다
    runToSeason(start, TURN);
    expect(seasonOf(start)).toBe(TURN);
    expect(turnsAppliedOf(start)).toBe(1);

    // Then 캔 횟수 · 되돌아옴의 진행 · 무너진 마디가 전부 처음 상태다
    expect(storedOf(start, TURN_ROOM, MIGRATING)).toMatchObject({
      phase: AVAILABLE,
      taken: 0,
      progress: 0,
    });
    expect(collapsedOf(start)).toEqual([]);
    // And 무너졌던 자리를 다시 지날 수 있다 — 구덩이가 없다
    expect(isCollapsedAt(statesOf(start), TURN_ROOM, pit)).toBe(false);
    // And 노두가 **다른 마디**에 서 있고 (Observable 5 · SPEC-006 이 그 걸음을 따로 잰다)
    expect(siteIndexOf(start)).not.toBe(buriedSite);
    // And 그 자리에서 다시 캘 수 있다
    const again = besideSource(start, TURN_ROOM, MIGRATING);
    expect(sourceEntity(again.observe(), MIGRATING)?.state).toBe(AVAILABLE);
    expect(mineOnce(again, MIGRATING)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
  });

  it('S-052 (경계 ①) 되돌아옴이 도는 도중에 뒤척임이 와도 한 번에 처음 상태다', () => {
    // Given 다 캐고 되돌아옴이 절반쯤 돈 노두
    const w = inSeason(LONG_NIGHT, TURN_ROOM, besideSpot(pointOf(TURN_ROOM, MIGRATING)), {
      actorItems: { pickaxe: 9 },
    });
    for (let i = 0; i < harvestsOf(TURN_ROOM, MIGRATING); i++) mineOnce(w, MIGRATING);
    wait(w, recoveryOf(TURN_ROOM, MIGRATING) / 2, 10);
    const midway = storedOf(w, TURN_ROOM, MIGRATING);
    expect(midway.phase).toBe(RECOVERING);
    expect(midway.progress!).toBeGreaterThan(0);
    expect(midway.progress!).toBeLessThan(recoveryOf(TURN_ROOM, MIGRATING));

    // When 뒤척임이 지나간다 (되돌아옴이 아직 끝나지 않았다)
    runToSeason(w, TURN);
    expect(turnsAppliedOf(w)).toBe(1);
    // Then 회복의 길이와 무관하게 한 번에 처음 상태다
    expect(storedOf(w, TURN_ROOM, MIGRATING)).toMatchObject({
      phase: AVAILABLE,
      taken: 0,
      progress: 0,
    });
    expect(collapsedOf(w)).toEqual([]);
  });

  it('S-053 (경계 ③) 밝히지 않은 방의 원천은 뒤척임에 한 값도 바뀌지 않는다', () => {
    // Given onTurn 을 밝히지 않은 방의 원천 하나를 한 번 캔다 (숲 가장자리는 seasons 만 밝혔다)
    const plain = PLAIN_SOURCES.find((s) => !TURN_ROOMS.includes(s.region))!;
    const w = inSeason(LONG_NIGHT, plain.region, besideSpot(pointOf(plain.region, plain.id)), {
      actorItems: { pickaxe: 9 },
    });
    expect(mineOnce(w, plain.id).status).toBe('success');
    expect(storedOf(w, plain.region, plain.id).taken).toBe(1);
    // When 뒤척임이 지나간다
    runToSeason(w, TURN);
    expect(seasonOf(w)).toBe(TURN);
    expect(turnsAppliedOf(w)).toBe(1);
    // Then 캔 횟수가 그대로다 — 이 방의 자국은 묻히지 않는다 (기본형 ⑧)
    expect({ id: plain.id, taken: storedOf(w, plain.region, plain.id).taken }).toEqual({
      id: plain.id,
      taken: 1,
    });
  });

  it.todo(
    'GAP: SPEC-005 경계 ② (흐름에 매달린 원천은 처음 상태가 고갈이라 그대로 고갈이다) 를 세울 수 없다 — 흐름에 매달린 원천(RIVER_SILT)이 사는 방(FOREST_DEEP)이 onTurn 을 밝히지 않아 뒤척임이 그 원천에 닿지 않는다. 지금 데이터로는 경계 ③(밝히지 않은 방은 바뀌지 않는다)과 구별되지 않는다',
  );
});

describe('SPEC-006 뒤척임이 자리를 옮기는 원천을 옮긴다', () => {
  it('S-061 캐지 않았어도 다음 마디로 옮겨 선다', () => {
    const sites = sitesOfTurnRoom();
    expect(sites.length).toBeGreaterThan(1);
    // Given 아무도 아무것도 하지 않은 방 — 노두는 마디 0 에 선다
    const w = inSeason(LONG_NIGHT, TURN_ROOM);
    expect(siteIndexOf(w)).toBe(0);
    expect(sourceAt(w, TURN_ROOM, MIGRATING)).toEqual(sites[0]);
    // When 뒤척임이 지나간다
    runToSeason(w, TURN);
    // Then 다음 마디에 서 있다 — 관찰 결과의 자리와 siteIndex 가 그것을 말한다
    expect(siteIndexOf(w)).toBe(1);
    expect(sourceAt(w, TURN_ROOM, MIGRATING)).toEqual(sites[1]);
    const seen = sourceEntity(besideSource(w, TURN_ROOM, MIGRATING).observe(), MIGRATING)!;
    expect({ x: seen.position.x, z: seen.position.z, siteIndex: seen.siteIndex }).toEqual({
      x: sites[1]!.x,
      z: sites[1]!.z,
      siteIndex: 1,
    });
  });

  it('S-062 (경계 ①) 뒤척임을 두 번 지나면 또 한 마디 옮겨 간다', () => {
    const sites = sitesOfTurnRoom();
    const w = inSeason(LONG_NIGHT, TURN_ROOM);
    runToSeason(w, TURN);
    expect({ turns: turnsAppliedOf(w), site: siteIndexOf(w) }).toEqual({ turns: 1, site: 1 });
    // When 다음 바퀴의 뒤척임까지 굴린다
    runToSeason(w, TURN);
    // Then 또 한 마디다 — 두 번의 뒤척임이 두 번 세어졌다
    expect({ turns: turnsAppliedOf(w), site: siteIndexOf(w) }).toEqual({ turns: 2, site: 2 });
    expect(sourceAt(w, TURN_ROOM, MIGRATING)).toEqual(sites[2]);
  });

  it('S-063 (경계 ②) 같은 뒤척임이 두 번 세지지 않는다 — 그 60 초 안에 여러 Tick 이 지나도 한 번이다', () => {
    // Given 뒤척임 바로 앞까지 굴린 세계
    const w = inSeason(LONG_NIGHT, TURN_ROOM);
    runTo(w, SEASON_AT[TURN] - 1, 60);
    expect({ turns: turnsAppliedOf(w), site: siteIndexOf(w) }).toEqual({ turns: 0, site: 0 });
    // When 뒤척임의 60 초를 **1 초씩** 걷고 그 뒤 하루를 더 간다
    wait(w, TURN_SECONDS + 1, 1);
    expect(seasonOf(w)).not.toBe(TURN);
    // Then 그 사이 60 번이 넘는 Tick 이 지났어도 뒤척임은 한 번이다
    expect({ turns: turnsAppliedOf(w), site: siteIndexOf(w) }).toEqual({ turns: 1, site: 1 });
    // And 그 뒤로도 늘지 않는다 (다음 뒤척임까지는 한 번 그대로)
    wait(w, TURN_SECONDS * 4, 1);
    expect({ turns: turnsAppliedOf(w), site: siteIndexOf(w) }).toEqual({ turns: 1, site: 1 });
  });

  it('S-064 (경계 ③) 뒤척임을 통째로 건너뛴 큰 걸음이어도 빠뜨리지 않는다', () => {
    const sites = sitesOfTurnRoom();
    const rounds = 3;
    // Given 아무것도 하지 않은 세계
    const w = inSeason(STILL, TURN_ROOM);
    expect(turnsAppliedOf(w)).toBe(0);
    // When 한 걸음으로 세 바퀴를 통째로 건너뛴다 (그 안에 뒤척임이 셋 있다)
    w.tick(rounds * CYCLE_SECONDS + DAY_SECONDS);
    // 세계는 그 걸음이 **끝난** 시각을 다음 Tick 에 읽는다 — 실주행의 Tick 은 1/30 초라
    // 이 어긋남은 보이지 않는다. spec 이 순서를 말하지 않으므로 판정을 세우지 않고,
    // 다음 Tick 뒤의 값으로 "빠뜨리지 않았는가" 만 잰다 (보고에 남긴다).
    w.tick(0);
    // Then 셋이 다 세어졌다 — 하나도 빠지지 않았다
    expect(turnsAppliedOf(w)).toBe(rounds);
    // And 마디도 셋 옮겨 갔다
    expect(siteIndexOf(w)).toBe(rounds % sites.length);
    expect(sourceAt(w, TURN_ROOM, MIGRATING)).toEqual(sites[rounds % sites.length]);
  });

  it('S-065 (경계 ④) 자리를 옮기지 않는 원천은 자리가 그대로다', () => {
    const w = inSeason(STILL, START_REGION_ID);
    const before = ALL_SOURCES.filter((one) => !migratory(one.region, one.id)).map(
      (one) => `${one.id}@${JSON.stringify(sourceAt(w, one.region, one.id))}`,
    );
    // When 뒤척임을 둘 지난다
    runToSeason(w, TURN);
    runToSeason(w, TURN);
    expect(turnsAppliedOf(w)).toBe(2);
    // Then 마디 하나뿐인 원천은 한 값도 자리가 바뀌지 않았다
    const after = ALL_SOURCES.filter((one) => !migratory(one.region, one.id)).map(
      (one) => `${one.id}@${JSON.stringify(sourceAt(w, one.region, one.id))}`,
    );
    expect(after).toEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-007 ~ SPEC-010 — 달라지지 않는 것들
//
// 철 넷을 견줄 때 관찰 결과에서 **밤이 좁히는 것**(먼 몸과 먼 원천 · C015)은 빼고 본다:
// 긴 밤은 그 하루가 전부 밤이라 낮과 견줄 수 없기 때문이다. 그래서 아래 묶음은
// 밤에도 그대로인 자리(깊이 · standingConditions · 출구 · region)와 **세계 쪽** 원천 State 로
// 짜여 있다 (c015 S-0101 이 roomFacts 로 쓴 규율 그대로).
// ─────────────────────────────────────────────────────────────────────

/** 그 순간 그 방이 관찰자에게 말하는 것 + 세계가 쥐고 있는 그 방의 원천 */
function roomFacts(w: WorldDriver, region: string) {
  const v = w.observe();
  return {
    depth: depthSeen(w),
    conditions: [...conditionsSeen(w)].sort(),
    exits: exitsIn(v)
      .map((e) => `${e.id}/${e.state}@${e.position.x},${e.position.z}`)
      .sort(),
    // C034 CHANGED — 봉투의 region 에 **기억**이 늘 실린다. 여기서 빼는 것은 그것이
    // 철을 타서가 아니라 **세계가 지나온 시간**을 세기 때문이다: 철 넷을 견주려면
    // 세계를 서로 다른 시각에 세워야 하고, 그러면 그때까지 지난 뒤척임의 수가 다르다.
    // 뒤척임은 방의 선택이 아니라 세계의 순간이므로 밝히지 않은 방도 함께 센다
    // (C034 spec R3 경계 ② · SPEC-003). 이 항이 재는 것 — 깊이 · 걸린 것 · 문 · 원천 ·
    // 그 방의 값 — 은 한 값도 달라지지 않았다.
    regionView: JSON.stringify({ ...v.region, memory: undefined }),
    sources: sourcesInRegion(region).map((s) => {
      const at = sourcePositionOf(statesOf(w), s);
      const held = storedOf(w, region, s.id);
      return `${s.id}@${at.x},${at.z} ${held.phase} taken=${held.taken} site=${held.siteIndex ?? 0} collapsed=${(held.collapsedSites ?? []).join('|')}`;
    }),
  };
}

/** 그 방에서 견줄 자리들 — 기본 자리와 격자의 양 끝, 그리고 덧씌움이 걸린 자락 */
function probeSpots(region: string): (XZ | undefined)[] {
  const walkable = walkableSpots(region);
  const spots: (XZ | undefined)[] = [undefined, walkable[0], walkable[walkable.length - 1]];
  for (const season of SEASONS) {
    const depth = depthOverlayOf(region, season);
    if (depth) spots.push(spotInLayer(region, DEPTH_LAYER, areaTagOf(region, depth.areaId)));
  }
  return spots;
}

describe('SPEC-007 규칙은 철의 이름을 모른다', () => {
  it('S-071 덧씌움을 밝히지 않은 방(백왕령 · 미로)은 철 넷에서 한 값도 다르지 않다', () => {
    for (const region of [WHITE_KING_DOMAIN, FANTASY_MAZE, MAZE_HEART]) {
      for (const at of probeSpots(region)) {
        let expected: ReturnType<typeof roomFacts> | null = null;
        for (const season of SEASONS) {
          const w = inSeason(season, region, at);
          const facts = roomFacts(w, region);
          if (expected === null) expected = facts;
          else expect({ region, season, ...facts }).toEqual({ region, season, ...expected });
        }
      }
      // 그리고 통행 격자도 철을 타지 않는다 — 땅은 다시 만들어지지 않는다 (SPEC-008 과 같은 뜻)
      const t = terrainOf(region);
      expect(sampleSpots(region).map((p) => isTraversableAt(t, p.x, p.z)).length).toBeGreaterThan(0);
    }
  });

  it('S-072 (경계 ①) 철을 타는 방은 데이터가 밝힌 방뿐이다 — 코드에 철 이름이 없다', () => {
    // 데이터가 밝힌 것: 덧씌움을 밝힌 방 · 뒤척임을 밝힌 방 · 철 조건 문을 가진 방
    const declared = new Set([...PHASE_ROOMS, ...SEASON_DOOR_ROOMS]);
    const changed = new Set<string>();
    for (const spec of REGION_SPECS) {
      for (const at of probeSpots(spec.id)) {
        let expected: string | null = null;
        for (const season of SEASONS) {
          // C039 CHANGED — 문이 몸에게 묻게 되었으므로 그 물음에 답하는 몸으로 선다 (위 HEAT_HIDDEN_SOURCE)
          const seen = JSON.stringify(
            roomFacts(inSeason(season, spec.id, at, { actorSources: [HEAT_HIDDEN_SOURCE] }), spec.id),
          );
          if (expected === null) expected = seen;
          else if (seen !== expected) changed.add(spec.id);
        }
      }
    }
    // Then 철을 탄 방은 밝힌 방의 부분집합이다
    for (const id of changed) expect({ id, declared: declared.has(id) }).toEqual({ id, declared: true });
    // And 밝힌 방은 지어낸 것도 빠뜨린 것도 없다 — 데이터가 말하는 그대로다.
    // C021 로 넓어졌다 — 빙결 협곡이 철을 밝혀 넷이 되었다 (C021 SPEC-001). 이 항의 주장은
    // "철을 탄 방은 밝힌 방의 부분집합" 이고 그것은 그대로다: 목록이 자란 것뿐이다.
    // RoomNeverSame 실주행 판정으로 다시 넓어졌다 — 폐허 · 둥지 · 거목이 철을 밝혀 일곱이 되었다
    expect([...declared].sort()).toEqual(
      [
        BIO_ORE_FIELD,
        FOREST_DEEP,
        FOREST_EDGE,
        'FROST_CANYON',
        'EXPLORER_RUIN',
        'PREDATOR_NEST',
        'RED_EYE_TREE',
      ].sort(),
    );
    // And 그 셋은 실제로 철을 탔다 (밝혔는데 아무 일도 없는 방이 없다)
    expect([...changed].sort()).toEqual([...declared].sort());
  });

  it('S-073 (경계 ②) 미로의 압력과 패턴은 뒤척임에도 그대로 돈다', () => {
    const rule = regionSpec(FANTASY_MAZE)!.rule!;
    const entry = anchorAt(FANTASY_MAZE, 'ANCIENT_GATE');
    const cell = tagsAt(terrainOf(FANTASY_MAZE), entry.x, entry.z, CELL_LAYER)[0]!;
    const t = terrainOf(FANTASY_MAZE);
    const inCell = gridSpots(FANTASY_MAZE).filter(
      (p) =>
        isTraversableAt(t, p.x, p.z) &&
        tagsAt(t, p.x, p.z, PASSAGE_LAYER).length === 0 &&
        tagsAt(t, p.x, p.z, CELL_LAYER).includes(cell),
    );
    const far = maxBy(inCell, (p) => distanceBetween(p, entry));

    // Given 압력이 임계 가까이 찬 미로 — 긴 밤의 끝에 선다 (곧 뒤척임이다)
    const base = inSeason(LONG_NIGHT, FANTASY_MAZE, entry);
    runTo(base, SEASON_AT[TURN] - 10, 60);
    const w = worldFrom(base, (s) => {
      const held = (s.regionStates as unknown as RegionStatesShape)[FANTASY_MAZE]!;
      held.rule!.pressure = rule.pressureLimit - 3;
    });
    const before = { ...shapeOf(w)[FANTASY_MAZE]!.rule! };

    // When 가만히 선 채로 뒤척임을 지난다
    wait(w, TURN_SECONDS + 5, 1);
    expect(turnsAppliedOf(w)).toBe(1);
    // Then 미로의 압력도 패턴도 한 값도 건드려지지 않았다 (기본형 ⑥)
    expect(shapeOf(w)[FANTASY_MAZE]!.rule).toEqual(before);

    // And 뒤척인 뒤에도 걸음이 그대로 압력을 올려 재배열이 일어난다
    const first = before.pattern;
    expect(move(w, far).status).toBe('success');
    let leg = 0;
    for (let i = 0; i < 40000; i++) {
      w.tick(TICK_INTERVAL);
      if (shapeOf(w)[FANTASY_MAZE]!.rule!.pattern !== first) break;
      if (actorOf(w).currentAction.kind !== 'move') {
        leg += 1;
        expect(move(w, leg % 2 === 0 ? far : entry).status).toBe('success');
      }
    }
    expect(shapeOf(w)[FANTASY_MAZE]!.rule!.pattern).not.toBe(first);
    expect(shapeOf(w)[FANTASY_MAZE]!.rule!.pressure).toBe(0);
  });
});

describe('SPEC-008 땅은 다시 만들어지지 않는다', () => {
  it('S-081 철 넷에서도 뒤척임을 지난 뒤에도 높이 · 표면 · 통행 격자 · hash 가 한 값도 다르지 않다', () => {
    const shapeNow = () => ({
      terrain: REGION_SPECS.map((s) => JSON.stringify(compileRegion(s.space, COMPILE_RULES).world)),
      hash: REGION_SPECS.map((s) => descriptionHash(s.space)),
      walkable: REGION_SPECS.map((s) => walkableSpots(s.id).length),
    });
    const before = shapeNow();
    const w = inSeason(STILL, OVERLAY_ROOM, insideOverlay());
    const seenHash: string[] = [];
    for (const season of SEASONS) {
      runToSeason(w, season);
      expect({ season, ...shapeNow() }).toEqual({ season, ...before });
      seenHash.push(w.observe().region.hash);
    }
    // 두 바퀴를 더 돌아 뒤척임을 몇 번 지나도 그대로다
    runTo(w, timeOf(w) + 2 * CYCLE_SECONDS, 60);
    expect(turnsAppliedOf(w)).toBeGreaterThan(1);
    expect(shapeNow()).toEqual(before);
    // And 관찰 결과가 말하는 hash 는 그 방 Description 의 것 그대로이고 철마다 같다
    expect(new Set(seenHash).size).toBe(1);
    expect(seenHash[0]).toBe(descriptionHash(spaceOf(OVERLAY_ROOM)));
  });

  it('S-082 (경계) 덧씌움이 걸린 자리도 땅으로는 같은 자리다', () => {
    const at = insideOverlay();
    const t = terrainOf(OVERLAY_ROOM);
    const land = {
      traversable: isTraversableAt(t, at.x, at.z),
      trace: tagsAt(t, at.x, at.z, 'trace'),
      settlement: tagsAt(t, at.x, at.z, SETTLEMENT_LAYER),
    };
    for (const season of SEASONS) {
      const w = inSeason(season, OVERLAY_ROOM, at);
      // 깊이는 달라져도 (S-011) 몸은 같은 자리에 서고 방의 hash 는 그대로다
      expect({ season, x: here(w).x, z: here(w).z }).toEqual({ season, x: at.x, z: at.z });
      expect({ season, hash: w.observe().region.hash }).toEqual({
        season,
        hash: descriptionHash(spaceOf(OVERLAY_ROOM)),
      });
      expect({
        season,
        traversable: isTraversableAt(terrainOf(OVERLAY_ROOM), at.x, at.z),
        trace: tagsAt(terrainOf(OVERLAY_ROOM), at.x, at.z, 'trace'),
        settlement: tagsAt(terrainOf(OVERLAY_ROOM), at.x, at.z, SETTLEMENT_LAYER),
      }).toEqual({ season, ...land });
    }
  });
});

describe('SPEC-009 덧씌움은 세계에 하나이고 껐다 켜도 이어진다', () => {
  it('S-091 관찰자 둘이 같은 덧씌움을 본다 — 깊이 · 위험 · 출구 · 원천이 한 값도 다르지 않다', () => {
    // Given 같은 자락 안에 선 관찰자 둘 (몸끼리 밀리지 않게 두 걸음 떨어뜨린다)
    const a = insideOverlay();
    const tag = areaTagOf(OVERLAY_ROOM, DEPTH_OVERLAY.areaId);
    const t = terrainOf(OVERLAY_ROOM);
    const b = minBy(
      walkableSpots(OVERLAY_ROOM).filter(
        (p) => tagsAt(t, p.x, p.z, DEPTH_LAYER).includes(tag) && distanceBetween(p, a) > 2,
      ),
      (p) => distanceBetween(p, a),
    );
    const w = two(OVERLAY_ROOM, a, b, { clock: OVERLAY_SEASON });
    expect(seasonOf(w, OBSERVER)).toBe(OVERLAY_SEASON);
    expect(seasonOf(w, OBSERVER_2)).toBe(OVERLAY_SEASON);
    // Then 둘이 같은 것을 본다
    expect(depthSeen(w, OBSERVER_2)).toBe(depthSeen(w, OBSERVER));
    expect(depthSeen(w, OBSERVER)).toBe(DEPTH_OVERLAY.depth);
    expect([...conditionsSeen(w, OBSERVER_2)].sort()).toEqual([...conditionsSeen(w, OBSERVER)].sort());
    expect(conditionsSeen(w, OBSERVER)).toContain(HAZARD_OVERLAY.hazard);
    const exitsFor = (id: string) =>
      exitsIn(w.observe(id)).map((e) => `${e.id}/${e.state}`).sort();
    expect(exitsFor(OBSERVER_2)).toEqual(exitsFor(OBSERVER));
    const sourcesFor = (id: string) => sourcesIn(w.observe(id)).map((e) => e.id).sort();
    expect(sourcesFor(OBSERVER_2)).toEqual(sourcesFor(OBSERVER));
    expect(sourcesFor(OBSERVER)).toContain(SEASONAL_SOURCE.id);
  });

  it('S-092 저장하고 되살린 뒤 뒤척임이 다시 일어나지 않는다', () => {
    // Given 뒤척임을 한 번 지난 세계
    const w = inSeason(LONG_NIGHT, TURN_ROOM);
    runToSeason(w, TURN);
    expect({ turns: turnsAppliedOf(w), site: siteIndexOf(w) }).toEqual({ turns: 1, site: 1 });
    // When 파일을 지나 저장하고 되살린다
    const revived = revive(w);
    // Then 세운 수도 마디도 그대로다 — 되살린 세계가 다시 뒤척이지 않는다
    expect({ turns: turnsAppliedOf(revived), site: siteIndexOf(revived) }).toEqual({
      turns: 1,
      site: 1,
    });
    // And 그 뒤척임의 60 초가 아직 남아 있는데도 다시 일어나지 않는다
    expect(seasonOf(revived)).toBe(TURN);
    wait(revived, TURN_SECONDS, 1);
    expect({ turns: turnsAppliedOf(revived), site: siteIndexOf(revived) }).toEqual({
      turns: 1,
      site: 1,
    });
    // And 다음 뒤척임은 제때 온다
    runToSeason(revived, TURN);
    expect({ turns: turnsAppliedOf(revived), site: siteIndexOf(revived) }).toEqual({
      turns: 2,
      site: 2,
    });
  });

  it('S-093 (경계) STATE_VERSION 이 올랐으므로 옛 스냅샷은 복구되지 않는다', () => {
    expect(STATE_VERSION).toBe(RAISED_STATE_VERSION);
    const w = inSeason(STILL, TURN_ROOM);
    const snapshot = throughFile(w.world.snapshot());
    expect(snapshot.version).toBe(RAISED_STATE_VERSION);
    expect(restoreWorld(snapshot)).not.toBeNull();
    // 옛 버전으로 찍힌 스냅샷은 버려진다
    expect(restoreWorld({ ...snapshot, version: OLD_STATE_VERSION })).toBeNull();
  });
});

describe('SPEC-010 같은 방에 세 철에 세 번 온다', () => {
  it('S-0101 세 번의 관찰이 서로 다르다 — 태그 · 활성 · 출현 가운데 하나 이상이 다르다', () => {
    // Given 같은 자락에 세 철에 각각 선다
    const at = insideOverlay();
    const seen = THREE_SEASONS.map((season) => {
      const w = inSeason(season, OVERLAY_ROOM, at);
      return {
        season,
        // ① 태그 — 깊이와 위험
        depth: depthSeen(w),
        hazard: [...conditionsSeen(w)].sort(),
        // ③ 출현 — 그 철에만 나는 원천
        sources: sourcesIn(w.observe()).map((e) => e.id).sort(),
      };
    });
    // Then 셋이 서로 다르다 — 적어도 하나가 갈린다
    const lines = seen.map((s) => JSON.stringify({ ...s, season: null }));
    expect(new Set(lines).size).toBeGreaterThan(1);
    // 그 방에서 갈리는 것은 태그와 출현이다 (활성은 다음 검사가 본다)
    const seep = seen.find((s) => s.season === OVERLAY_SEASON)!;
    for (const other of seen.filter((s) => s.season !== OVERLAY_SEASON)) {
      expect({ season: other.season, depth: other.depth }).not.toEqual({
        season: other.season,
        depth: seep.depth,
      });
      expect(other.hazard).toEqual([]);
      expect(other.sources).not.toContain(SEASONAL_SOURCE.id);
    }
    expect(seep.sources).toContain(SEASONAL_SOURCE.id);

    // ② 활성 — 그 문이 있는 방에서는 열림/잠김이 갈린다
    const doors = THREE_SEASONS.map((season) => ({
      season,
      state: exitOf(inSeason(season, DOOR_ROOM, doorSpot()).observe(), SEASONAL_DOOR.id)?.state,
    }));
    expect(new Set(doors.map((d) => d.state)).size).toBeGreaterThan(1);
  });

  it('S-0102 (경계 ①) 다른 것은 그 셋뿐이다 — 땅도 방의 이름도 연결의 종류도 그대로다', () => {
    for (const region of [OVERLAY_ROOM, DOOR_ROOM]) {
      const at = region === OVERLAY_ROOM ? insideOverlay() : doorSpot();
      let expected: string | null = null;
      for (const season of THREE_SEASONS) {
        const v = inSeason(season, region, at).observe();
        const same = JSON.stringify({
          region: v.region.id,
          hash: v.region.hash,
          scene: v.scene,
          // 출구의 **이름 · 종류 · 자리**는 그대로다 (갈리는 것은 state 하나다)
          exits: exitsIn(v).map((e) => `${e.id}/${e.kind}@${e.position.x},${e.position.z}`).sort(),
          terrain: descriptionHash(spaceOf(region)),
        });
        if (expected === null) expected = same;
        else expect({ region, season, same }).toEqual({ region, season, same: expected });
      }
    }
  });

  it('S-0103 (경계 ②) 세 철 어디에서도 갈 곳이 하나도 없는 방이 생기지 않는다', () => {
    for (const spec of REGION_SPECS) {
      for (const season of SEASONS) {
        const w = inSeason(season, spec.id);
        const open = exitsIn(w.observe()).filter((e) => e.state === 'open');
        expect({ region: spec.id, season, open: open.length > 0 }).toEqual({
          region: spec.id,
          season,
          open: true,
        });
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — 이 Cycle 이 얹은 것 때문에 앞의 것이 무너지지 않았는가
// (REUSED / AFFECTED 의 기존 행동)
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('R-001 (C015) 시계는 한 줄도 달라지지 않았다 — 철 넷이 제 자리에서 선다', () => {
    const w = driveWorld(solo);
    for (const season of SEASONS) {
      runTo(w, SEASON_AT[season], 60);
      expect({ at: timeOf(w), season: seasonOf(w) }).toEqual({ at: SEASON_AT[season], season });
    }
    // 그리고 clock 의 자리는 넷 그대로다 — 이 Cycle 은 봉투에 새 자리를 내지 않았다
    expect(Object.keys(w.observe().clock).sort()).toEqual([
      'dayIndex',
      'dayPhase',
      'season',
      'seasonCycle',
    ]);
  });

  it('R-002 (C012 · C013) 캐고 되돌아오고 자리를 옮기는 일이 뒤척임 없이 그대로 돈다', () => {
    // Given 고요 한가운데 — 되돌아옴(180)이 다 도는 동안 뒤척임이 오지 않는다
    const w = inSeason(STILL, TURN_ROOM, besideSpot(pointOf(TURN_ROOM, MIGRATING)), {
      actorItems: { pickaxe: 9 },
    });
    for (let i = 0; i < harvestsOf(TURN_ROOM, MIGRATING); i++) {
      expect(mineOnce(w, MIGRATING).status).toBe('success');
    }
    expect(storedOf(w, TURN_ROOM, MIGRATING).phase).toBe(DEPLETED);
    expect(collapsedOf(w)).toEqual([0]);
    // When 되돌아오는 길이만큼 기다린다
    wait(w, recoveryOf(TURN_ROOM, MIGRATING), 10);
    // Then 돌아왔고 다음 마디에 섰다 — 뒤척임은 한 번도 오지 않았다
    expect(turnsAppliedOf(w)).toBe(0);
    expect(storedOf(w, TURN_ROOM, MIGRATING)).toMatchObject({
      phase: AVAILABLE,
      taken: 0,
      siteIndex: 1,
      collapsedSites: [0],
    });
    expect(seasonOf(w)).toBe(STILL);
  });

  it('R-003 (C014) 물길은 때와 무관하게 세계 시각으로 돈다 — 어귀에 실려 온다', () => {
    const silt = ALL_SOURCES.find((one) => one.region === FOREST_DEEP)!;
    const w = inSeason(STILL, FOREST_DEEP);
    // 어귀의 퇴적은 세계가 설 때 고갈로 선다 (C014)
    expect(storedOf(w, silt.region, silt.id).phase).not.toBe(AVAILABLE);
    runTo(w, DAY_SECONDS, 1);
    wait(w, recoveryOf(silt.region, silt.id), 10);
    // Then 실려 왔다
    expect(storedOf(w, silt.region, silt.id)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });

  it('R-004 (C011 · C012) 흔적의 사다리가 철 넷에 흔들리지 않는다', () => {
    // 흐름에 매달린 두 끝(어귀 · 못)은 세계 시각으로 흔적이 바뀌고(C014), 자리를 옮기는 원천은
    // 뒤척임으로 그 둘레가 따라간다(C013). 그 둘은 **때가 하는 일이 아니므로** 여기서 뺀다 —
    // 남은 방들에서 사다리가 철에 흔들리지 않는가만 본다 (c015 S-091 이 세운 규율).
    //
    // C022 CHANGED — **탄생지를 품은 방**도 뺀다. 그 방의 알집 둘레는 결속하는 동안 한 단계
    // 옅어지고(RULE-LIFE-SITE-PHASE-001) 결속은 비를 요구하며 비는 철을 탄다 — 그러니
    // 그 자락은 철에 흔들리는 것이 맞다. 앞의 둘과 같은 갈래의 뺌이고, 빠지는 것은 방 하나다.
    const lifeRooms = new Set(
      REGION_SPECS.filter((s) => (s.ecology?.lifeFormation?.length ?? 0) > 0).map((s) => s.id),
    );
    const quiet = SOURCE_REGIONS.filter(
      (region) =>
        region !== TURN_ROOM &&
        region !== FOREST_DEEP &&
        !inflowRegions.has(region) &&
        !lifeRooms.has(region),
    );
    expect(quiet.length).toBeGreaterThan(0);
    let base: number[][] | null = null;
    for (const season of SEASONS) {
      const w = inSeason(season, START_REGION_ID);
      const traces = quiet.map((region) =>
        sampleSpots(region).map((p) => traceStrengthAt(statesOf(w), region, p)),
      );
      if (base === null) base = traces;
      else expect({ season, traces }).toEqual({ season, traces: base });
    }
  });

  it('R-005 (C009) 미로의 심장 문은 여전히 패턴이 정한다 — 철이 그것을 흔들지 않는다', () => {
    for (const season of SEASONS) {
      const w = inSeason(season, FANTASY_MAZE, anchorAt(FANTASY_MAZE, 'HEART_GATE'), {
        regionPatterns: { [FANTASY_MAZE]: MAZE_PATTERN_P2 },
      });
      expect(shapeOf(w)[FANTASY_MAZE]?.rule?.pattern).toBe(MAZE_PATTERN_P2);
      // 어느 철에도 열림이고 건널 수 있다
      expect({ season, state: exitOf(w.observe(), MAZE_HEART_GATE)?.state }).toEqual({
        season,
        state: 'open',
      });
      expect({ season, result: cross(w, MAZE_HEART_GATE).status }).toEqual({
        season,
        result: 'success',
      });
      expect(actorOf(w).regionId).toBe(MAZE_HEART);
    }
  });

  it('R-006 (C010) 관찰자 둘이 같은 세계를 본다 — 철이 그 사실을 흐리지 않는다', () => {
    const a = insideOverlay();
    const b = maxBy(walkableSpots(OVERLAY_ROOM), (p) => distanceBetween(p, a));
    const w = two(OVERLAY_ROOM, a, b, { clock: OVERLAY_SEASON });
    expect(w.observe(OBSERVER).hud.find((h) => h.id === 'observers.present')?.value).toBe(2);
    expect(w.observe(OBSERVER_2).hud.find((h) => h.id === 'observers.present')?.value).toBe(2);
    // 그리고 저마다 선 자리의 깊이를 본다 — 하나는 자락 안, 하나는 밖이다
    expect(depthSeen(w, OBSERVER)).toBe(DEPTH_OVERLAY.depth);
    expect(depthSeen(w, OBSERVER_2)).toBe(ROOM_DEPTH);
  });

  it('R-007 (C011 · C012) 채취의 사유 코드가 늘거나 줄지 않았다', () => {
    const w = inSeason(STILL, OVERLAY_ROOM, besideSpot(pointOf(OVERLAY_ROOM, 'MOLT_LITTER')));
    expect(mine(w, 'c016-test:no-such-source')).toMatchObject({ reason: 'unknown-source' });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
// ─────────────────────────────────────────────────────────────────────
describe('하네스 결손', () => {
  it.todo(
    'GAP: SPEC-004 의 entities[].conditions 에 not-this-season 이 실리는가 (Observable · R7) — 그 철이 아니면 원천이 관찰 결과에 **서지 않으므로**(R6) 실릴 자리 자체가 없다. 두 규칙이 같은 자리를 두고 서로 다른 말을 한다: 다음 Cycle 이 어느 쪽인지 정해야 한다',
  );
  it.todo(
    'GAP: SPEC-002 경계 ② 의 "함께 실린다" 를 세울 수 없다 — 위험 덧씌움(숲 가장자리)과 C006 의 안전 코드(백왕령)가 **서로 다른 방**에 있어 한 자리에서 겹치지 않는다. 지금은 "안전의 코드가 달라지지 않는다" 까지만 잰다 (S-023)',
  );
  it.todo(
    'GAP: 화면의 몫 — 새 사유 문구("이 철이 아니다")와 위험 코드의 문구가 판에 어떻게 읽히는가. 세계는 코드만 싣고 문구는 View 의 표가 옮긴다 (원칙 2) — 이 파일은 세계의 값만 잰다',
  );
  it.todo(
    'GAP: 화면의 몫 — 스밈에만 나는 원천의 그림 · 깊어진 자락이 판에서 위험으로 읽히는가 · 뒤척임의 연출(V16 은 out of scope). 관찰 결과에는 그림도 색도 없다',
  );
  it.todo(
    'GAP: 관찰자가 **같은 방에 세 번 와서 배우는가**(Play 완료 확인 ①의 사람 쪽) — 세계는 세 번의 관찰이 서로 다르다는 것까지만 잰다 (S-0101). "외울 것은 자리가 아니라 때다" 를 사람이 겪는지는 촬영과 실주행이 답할 자리다',
  );
  it.todo(
    'GAP: 뒤척임이 **큰 걸음 한 번 안에서** 적용되어야 하는지 spec 이 말하지 않는다 — 지금 세계는 그 걸음이 끝난 시각을 **다음 Tick** 에 읽는다(S-064 의 주석). 실주행의 Tick 은 1/30 초라 보이지 않지만, 판정의 순서를 세울 자리가 spec 에 없다',
  );
});
