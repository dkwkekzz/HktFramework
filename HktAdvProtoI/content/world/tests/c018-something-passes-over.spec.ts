// C018 — 지나가는 것 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// C017 까지 세계를 바꾸는 것은 **시계와 내가 한 일**뿐이었다. 이 Cycle 이 위상을 거는
// **원인 셋째**(지나가는 것)를 얹는다. 그래서 재는 것은 다섯이다:
//   ① 시간표 — 그 철·낮밤·바퀴가 오면 스스로 시작하고 마디 수 × 45 초가 지나면 끝난다.
//      한 바퀴에 두 번 시작하지 않고, 관찰자와 무관하다
//   ② 관찰 — 그 방을 지금 지나는 것만이 실린다. 시간표도 남은 시간도 다음 방도 없다 (T8)
//   ③ 작용 — 밝힌 만큼 소란이 오르고 밝힌 자락이 위험으로 읽힌다. 밝히지 않은 것은 그대로다
//   ④ 휨과 남김 — 소란이 높은 쪽으로 **시작할 때 한 번** 휘고, 실제로 지난 방에만 남긴다.
//      남겨지는 원천은 지나가야만 서고, 시간이 아니라 **다시 지나가는 것**이 되돌린다
//   ⑤ 불변 — 땅도 hash 도 미로의 압력도 C015~C017 의 시계·덧씌움·소란도 한 줄도 달라지지 않는다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/world 의 새 규칙 · content/regions 의 경로 데이터 · content/view ·
// engine · tools 의 이번 변경)은 **읽지 않았다.** 기대값의 출처는
// cycles/C018-something-passes-over/spec.md 와 content/protocol/gameview.ts 의 관찰 계약뿐이다.
//
// **이름을 손으로 잇지 않는다** — 경로의 이름(routeId)은 세계 State 의 자리에서 읽고
// (spec State: "모든 경로에 선다"), 어느 이름이 무엇인지는 **그것이 지나는 때**로 가른다
// (낮에 서는 것 · 긴 밤에 서는 것). 경로 선의 이름은 관찰 결과가 말하고, 그 선의 마디는
// 관찰자가 자기 content/regions 에서 얻는다 (C013 의 siteCurve 규율 그대로).
// 손으로 적는 수는 spec 의 「데이터 값」 표(45 · 4 · 2 · 3 · 2 …)뿐이고, 그것은 저장되지 않는
// 헤더 상수라 세계에서 가져올 자리가 없다 (c015 · c017 이 시계·소란 상수에 세운 규율 그대로).
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  curvesOf,
  descriptionHash,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import type { CheckItem, CheckReport } from '../../../engine/world-authoring/check';
import {
  BIO_ORE_FIELD,
  COMPILE_RULES,
  DEPTH_LAYER,
  EXPLORER_RUIN,
  FOREST_DEEP,
  FOREST_EDGE,
  HAZARD_LAYER,
  PRESENCE_LAYER,
  RED_EYE_TREE,
  REGION_SPECS,
  START_REGION_ID,
  WHITE_KING_DOMAIN,
  regionSpec,
  type ResourceSourceSpec,
  type SeasonId,
} from '../../regions';
// C008 이 세운 미로의 이름들 — 그 파일이 소유한다 (c008 ~ c017 시나리오의 선례 그대로).
import { CELL_LAYER, FANTASY_MAZE, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type {
  CommandView,
  EntityView,
  GameViewSnapshot,
  PresenceView,
  RequestOutcomeView,
} from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import {
  CYCLE_SECONDS,
  LONG_NIGHT_SECONDS,
  SEEP_SECONDS,
  STILL_SECONDS,
} from '../semantic/clock';
import {
  INTERACTION_RANGE,
  STATE_VERSION,
  TICK_INTERVAL,
  type WorldState,
} from '../semantic/world-state';
import { sourcePositionOf, sourceStateOf, sourcesInRegion } from '../semantic/resource';
import { driveWorld, OBSERVER, OBSERVER_2, type WorldDriver } from './drive';

// ── spec 의 「데이터 값」 표 (헤더 상수 · 결정론 · 저장되지 않는다) ───
/** 마디 하나에 머무는 세계 초 (spec 데이터 값 · 기본형 ②) */
const PRESENCE_SECONDS_PER_NODE = 45;
/** 천공고래 — 마디 넷 · 낮에만 · 철 바퀴 셋에 한 번 · 소란 초당 2 */
const WHALE_NODES = 4;
const WHALE_PASS_SECONDS = WHALE_NODES * PRESENCE_SECONDS_PER_NODE; // 180
const WHALE_DISTURBANCE_PER_SECOND = 2;
const WHALE_CYCLE_EVERY = 3;
/** 맹목의 사냥꾼 — 마디 둘 · 긴 밤에만 · 매 바퀴 */
const HUNTER_NODES = 2;
const HUNTER_PASS_SECONDS = HUNTER_NODES * PRESENCE_SECONDS_PER_NODE; // 90

/** 지나는 것의 의미 코드 둘 (spec 데이터 값 절이 이름한 그대로) */
const SKY_WHALE = 'sky-whale';
const BLIND_HUNTER = 'blind-hunter';

/** 눈 없는 것이 지나는 자락이 읽히는 위험 코드 (spec 데이터 값) */
const HAZARD_CREATURE = 'hazard/creature';
/** 이 Cycle 이 **새로 만들지 않고 그대로 쓰는** 조건 코드 — C014 의 "아직 그때가 아니다" (R7) */
const CONDITION_UNMET = 'condition-unmet';
/** 조작이 닫힌 세계의 사유 (C009 · command.spec 그대로) */
const DEBUG_CLOSED = 'debug-closed';

/** C017 의 소란 상수들 — 회귀와 휨의 Given 에 쓴다 */
const DISTURBANCE_THRESHOLD = 300;
const DISTURBANCE_PER_HARVEST = 10;
const DORMANT = 'dormant';
const AWAKE = 'awake';

/** phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';

/** spec 이 적은 State 형 버전 — 이 Cycle 이 여기까지 올린다 (SPEC-008 경계) */
// C022 CHANGED — 탄생지와 개체군이 실리며 다시 올랐다. 이 항이 재는 것은 글자가 아니라
// "세계가 찍는 판이 팩의 판과 같다" 이므로 값만 따라 올린다 (C017 · C018 이 한 그대로)
// C034 CHANGED — 방의 기억(history)이 실리며 다시 올랐다 (같은 이유로 값만 따라 올린다)
// C039 — 몸의 State 에서 자리 셋이 사라지고 둘이 섰다 (최대값 둘 · 인지 범위 → 묻는 것 ·
// core · propertySources). 옛 스냅샷을 그대로 읽으면 틀린 세계가 되므로 판이 올랐다.
const RAISED_STATE_VERSION = 'hkt-adv-proto-i/12';
/** 그 앞의 버전(C017) — 옛 스냅샷은 되살아나지 않는다 */
const OLD_STATE_VERSION = 'hkt-adv-proto-i/8';

// ── 철의 이름과 자리 (clock.ts 의 상수에서 유도한다 · c016 · c017 그대로) ───
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
const SEASON_AT: Readonly<Record<SeasonId, number>> = {
  STILL: 0,
  SEEP: STILL_SECONDS,
  LONG_NIGHT: STILL_SECONDS + SEEP_SECONDS,
  TURN: STILL_SECONDS + SEEP_SECONDS + LONG_NIGHT_SECONDS,
};

/**
 * 경로가 지나는 방들 (spec 데이터 값 절 · 마디 순서 그대로).
 *
 * 방 이름을 여기 적는 것은 spec 이 표로 못 박았기 때문이다 — 경로 데이터 자체는 읽지 않는다.
 * 규칙이 이름을 알지 못한다는 것(R1 경계 ③)은 이 파일이 아니라 SPEC-007 이 잰다.
 */
const WHALE_ROOMS: readonly string[] = [WHITE_KING_DOMAIN, FOREST_EDGE, FOREST_DEEP, RED_EYE_TREE];
/** 눈 없는 것 — 첫 마디는 하나, 둘째 마디는 후보 둘 (데이터 순서 그대로) */
const HUNTER_FIRST = FOREST_DEEP;
const HUNTER_CANDIDATES: readonly string[] = [FOREST_EDGE, BIO_ORE_FIELD];
/** 남기는 것이 서는 방 — 둘 다 숲 가장자리다 (spec 기본형 ⑤ · 확정 13) */
const LEFTOVER_ROOM = FOREST_EDGE;

/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (C011~C017 어법) */
const MINE_SECONDS = 1.2;

const solo: WorldSetup = { npcs: [] };

// ── 계약이 준 형 (spec State 절 그대로 적어 둔다) ────────────────────
//
// 이 파일은 구현의 형을 읽지 않는다. spec 이 글로 적은 자리를 여기 다시 적고,
// 세계가 내놓은 값을 그 형으로 좁혀 본다.
interface PresenceStateShape {
  /** 지나기 시작한 세계 시각 — 지나고 있지 않으면 자리가 없다 */
  startedAt?: number;
  /** 그 지나감이 시작한 철 바퀴 */
  startedCycle?: number;
  /** 지금까지 **마친** 지나감의 수 */
  passes: number;
  /** 이 지나감이 마디마다 고른 방들 (휨의 결과) */
  route?: string[];
}
type PresencesShape = Record<string, PresenceStateShape>;

interface SourceStateShape {
  phase: string;
  taken: number;
  progress?: number;
  siteIndex?: number;
  collapsedSites?: number[];
}
interface DisturbanceShape {
  value: number;
  phase: string;
}
interface RegionStateShape {
  rule?: { pattern: string; pressure: number; rearrangedAt?: number };
  sources?: Record<string, SourceStateShape>;
  disturbance?: DisturbanceShape;
  tracks?: { position: XZ; heading: XZ; at: number }[];
}
type RegionStatesShape = Record<string, RegionStateShape>;

/** 원천에 실리는 자리들 (C012 · C013 · C014 의 것 그대로) */
type SourceView = EntityView & {
  conditions?: readonly string[];
  siteIndex?: number;
};

// ── 하네스 (c013 · c015 · c016 · c017 의 선례 그대로) ────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id: string) => state(w).actors.find((a) => a.id === id)!;
const bodyOf = (w: WorldDriver, observerId = OBSERVER): string =>
  w.observe(observerId).observer.characterId;
const here = (w: WorldDriver, bodyId: string): XZ => ({
  x: actorOf(w, bodyId).position.x,
  z: actorOf(w, bodyId).position.z,
});
const timeOf = (w: WorldDriver): number => state(w).time;
const statesOf = (w: WorldDriver) => state(w).regionStates as never;
const shapeOf = (w: WorldDriver): RegionStatesShape =>
  state(w).regionStates as unknown as RegionStatesShape;

const spaceOf = (id: string): RegionDescription => regionSpec(id)!.space;

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

/** 그 자리의 손 닿는 곳 — InteractionRange 안이다 */
const besideSpot = (at: XZ): XZ => ({ x: at.x + INTERACTION_RANGE / 2, z: at.z });
/** 그 방에서 걸어 설 수 있는, 어느 자락에도 들지 않을 만큼 흔한 자리 하나 */
const anySpot = (region: string): XZ => walkableSpots(region)[0]!;

/** 그 원천의 성질 — 그 방 resourceEcology 가 소유한다 (c017 의 ecologyOf 그대로) */
function ecologyOf(region: string, id: string): ResourceSourceSpec {
  const found = regionSpec(region)?.resourceEcology?.sources.find((s) => s.id === id);
  if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다 (${region})`);
  return found;
}
/** 철을 타지 않는(어느 철에도 서는) 그 방의 원천 하나 — 이름을 손으로 적지 않는다 */
function plainSourceIn(region: string): string {
  const found = sourcesInRegion(region)
    .map((s) => s.id)
    .find((id) => !ecologyOf(region, id).occurrence && !ecologyOf(region, id).dayPhases);
  if (!found) throw new Error(`${region} 에 철을 타지 않는 원천이 없다`);
  return found;
}

/** 그 방에서 곧게 걸을 수 있는 가장 긴 줄 — 걸음으로 자국을 내는 자리다 (c017 그대로) */
function straightRun(region: string): { from: XZ; to: XZ; length: number } {
  const t = terrainOf(region);
  let best: { from: XZ; to: XZ; length: number } | null = null;
  for (let iz = 0; iz < t.rows; iz++) {
    const z = t.extent.minZ + iz * t.resolution;
    let runStart = -1;
    for (let ix = 0; ix <= t.cols; ix++) {
      const x = t.extent.minX + ix * t.resolution;
      const open = ix < t.cols && isTraversableAt(t, x, z);
      if (open && runStart < 0) runStart = ix;
      if (!open && runStart >= 0) {
        const a = runStart + 1;
        const b = ix - 2;
        if (b > a) {
          const length = (b - a) * t.resolution;
          if (!best || length > best.length) {
            best = {
              from: { x: t.extent.minX + a * t.resolution, z },
              to: { x: t.extent.minX + b * t.resolution, z },
              length,
            };
          }
        }
        runStart = -1;
      }
    }
  }
  if (!best) throw new Error(`${region} 에 곧게 걸을 줄이 없다`);
  return best;
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
const inSeason = (season: string, region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  standingIn(region, at, { ...extra, clock: season });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};
/** dt 를 잘게 나누어 준다 (기본 한 걸음 1 세계 초) — c013 · c015 · c016 · c017 의 wait 선례 */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}
/** 그 세계 시각까지 굴린다 (c016 · c017 선례) */
function runTo(w: WorldDriver, target: number, step = 60) {
  const left = target - timeOf(w);
  if (left <= 1e-9) return;
  wait(w, left, step);
}
const SEASON_MARGIN = 1;
/** 그 철 **안으로** 굴린다 (c017 선례) */
function runToSeason(w: WorldDriver, season: SeasonId, step = 60) {
  const now = timeOf(w);
  const cycles = Math.floor(now / CYCLE_SECONDS);
  let start = cycles * CYCLE_SECONDS + SEASON_AT[season];
  if (start < now + 1e-9) start += CYCLE_SECONDS;
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

/** 그 자리까지 걷는다 (c009 · c010 · c017 의 선례 그대로) */
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
  throw new Error(`걸어서 (${at.x}, ${at.z}) 에 닿지 못했다`);
}
/** 자리 둘을 오가며 걷는다 — 멈춤 조건이 참이 될 때까지 (c010 · c017 의 walkUntil 그대로) */
function walkUntil(
  w: WorldDriver,
  path: readonly XZ[],
  stop: () => boolean,
  observerId = OBSERVER,
  limitTicks = 60000,
) {
  const body = bodyOf(w, observerId);
  let leg = 0;
  const order = () => expect(move(w, path[leg % path.length]!, observerId).status).toBe('success');
  order();
  for (let i = 0; i < limitTicks; i++) {
    w.tick(TICK_INTERVAL);
    if (stop()) return;
    if (actorOf(w, body).currentAction.kind !== 'move') {
      leg += 1;
      order();
    }
  }
  throw new Error('걸어도 그 일이 일어나지 않았다');
}

// ── 저장·복구 (c013 ~ c017 의 선례 그대로) ──────────────────────────
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
/** 되살리면서 State 를 고친 세계 — 걸어서는 세울 수 없는 Given 을 공개 길로 세운다 (c017 그대로) */
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
  bodyId: string,
  observers: readonly string[] = [OBSERVER],
): WorldDriver => worldFrom(w, (s) => place(s, bodyId, region, at), observers);

/** 그 방의 소란을 그만큼 이미 겪은 세계로 만든다 (c017 의 charge 그대로 — 위상은 세계가 정한다) */
function charge(s: WorldState, region: string, value: number) {
  const states = s.regionStates as unknown as RegionStatesShape;
  const held = (states[region] ??= {});
  held.disturbance = { value, phase: DORMANT };
}

/** 관찰자 여럿이 저마다의 방·자리에 선 세계 (c017 의 staged 그대로) */
function staged(
  placements: readonly { observer: string; region: string; at: XZ }[],
  extra: WorldSetup = {},
): WorldDriver {
  const first = placements[0]!;
  const base = driveWorld({
    ...solo,
    ...extra,
    actorRegion: first.region,
    actorPosition: { x: first.at.x, z: first.at.z },
  });
  for (const one of placements.slice(1)) base.join(one.observer);
  base.tick(0);
  const bodies = placements.map((one) => ({ ...one, body: bodyOf(base, one.observer) }));
  return worldFrom(
    base,
    (s) => {
      for (const one of bodies) place(s, one.body, one.region, one.at);
    },
    placements.map((one) => one.observer),
  );
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────
const seenPresences = (w: WorldDriver, observerId = OBSERVER): PresenceView[] =>
  w.observe(observerId).presences;
const seenCodes = (w: WorldDriver, observerId = OBSERVER): string[] =>
  seenPresences(w, observerId).map((p) => p.presence);
const seenDisturbance = (w: WorldDriver, observerId = OBSERVER) =>
  w.observe(observerId).region.disturbance;
const seenValue = (w: WorldDriver, observerId = OBSERVER): number =>
  seenDisturbance(w, observerId).value;
const seenPhase = (w: WorldDriver, observerId = OBSERVER): string =>
  seenDisturbance(w, observerId).phase;
const conditionsSeen = (w: WorldDriver, observerId = OBSERVER): string[] =>
  w.observe(observerId).standingConditions;
const depthSeen = (w: WorldDriver, observerId = OBSERVER): unknown =>
  w.observe(observerId).hud.find((h) => h.id === 'region.depth')?.value;
const seasonOf = (w: WorldDriver, observerId = OBSERVER): string =>
  w.observe(observerId).clock.season;
const sourceEntity = (v: GameViewSnapshot, id: string): SourceView | undefined =>
  v.entities.find((e) => e.role === 'resource-source' && e.id === id) as SourceView | undefined;
/** 몸이 없는 방의 값 — 관찰 결과로는 볼 수 없어 세계 State 로 읽는다 (c017 의 그 자리) */
const heldValue = (w: WorldDriver, region: string): number | undefined =>
  shapeOf(w)[region]?.disturbance?.value;
const storedOf = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w), region, id) as SourceStateShape;
const sourceAt = (w: WorldDriver, region: string, id: string): XZ => {
  const source = sourcesInRegion(region).find((s) => s.id === id)!;
  const at = sourcePositionOf(statesOf(w), source);
  return { x: at.x, z: at.z };
};

// ── 지나가는 것을 읽는 자리 (spec State 절의 점 경로) ────────────────
/**
 * 세계가 든 경로들의 지금 — **모든 경로에 선다** (spec State 절).
 * 이름을 손으로 적지 않고 여기서 읽는 것이 이 파일의 유일한 경로 이름 출처다.
 */
function presencesOf(w: WorldDriver): PresencesShape {
  const held = (state(w) as unknown as { presences?: PresencesShape }).presences;
  if (!held) {
    throw new Error(
      '세계 State 에 presences 자리가 없다 — spec State 절이 "World.presences[routeId] · 모든 경로에 선다" 고 못 박았다',
    );
  }
  return held;
}
const routeStateOf = (w: WorldDriver, routeId: string): PresenceStateShape => {
  const held = presencesOf(w)[routeId];
  if (!held) throw new Error(`세계가 경로 '${routeId}' 를 모른다`);
  return held;
};
const isPassing = (w: WorldDriver, routeId: string): boolean =>
  routeStateOf(w, routeId).startedAt !== undefined;
const passesOf = (w: WorldDriver, routeId: string): number => routeStateOf(w, routeId).passes;
const routeRoomsOf = (w: WorldDriver, routeId: string): string[] =>
  routeStateOf(w, routeId).route ?? [];
/** 지금 지나고 있는 경로들의 이름 */
const passingRoutes = (w: WorldDriver): string[] =>
  Object.entries(presencesOf(w))
    .filter(([, held]) => held.startedAt !== undefined)
    .map(([id]) => id);
/** 지금 그 경로가 지나고 있는 마디 번호 (유도되는 것 — 저장되지 않는다) */
function nodeIndexOf(w: WorldDriver, routeId: string): number {
  const held = routeStateOf(w, routeId);
  if (held.startedAt === undefined) throw new Error(`경로 '${routeId}' 는 지금 지나고 있지 않다`);
  return Math.floor((timeOf(w) - held.startedAt) / PRESENCE_SECONDS_PER_NODE);
}
/** 그 경로가 시작한 뒤 이만큼 흐른 자리까지 굴린다 (마디 한가운데를 짚기 위한 것) */
function runToElapsed(w: WorldDriver, routeId: string, elapsed: number, step = 1) {
  const held = routeStateOf(w, routeId);
  if (held.startedAt === undefined) throw new Error(`경로 '${routeId}' 는 지금 지나고 있지 않다`);
  runTo(w, held.startedAt + elapsed, step);
}
/** 마디 k 의 한가운데까지 굴린다 */
const runToNode = (w: WorldDriver, routeId: string, node: number, step = 1) =>
  runToElapsed(w, routeId, node * PRESENCE_SECONDS_PER_NODE + PRESENCE_SECONDS_PER_NODE / 2, step);

/**
 * 그 철에서 세계가 서면 **혼자 지나가기 시작하는** 경로의 이름.
 *
 * 낮의 철(스밈)에서는 천공고래가, 긴 밤에서는 눈 없는 것이 시간표에 든다 (spec 데이터 값).
 * 그래서 "그 때에 지나고 있는 하나" 가 곧 그 경로다 — 이름을 손으로 잇지 않는 유일한 길이다.
 */
function routeStartingIn(season: string): string {
  const w = inSeason(season, START_REGION_ID);
  const running = passingRoutes(w);
  if (running.length !== 1) {
    throw new Error(
      `${season} 에서 세계가 선 자리에 지나는 것이 하나가 아니다 (${running.join(', ') || '없음'}) — spec 데이터 값 절은 그 철에 경로 하나가 시간표에 든다고 못 박았다`,
    );
  }
  return running[0]!;
}
let whaleMemo: string | undefined;
let hunterMemo: string | undefined;
/** 천공고래의 경로 이름 — 낮의 철에 시작하는 것 */
const whaleRoute = (): string => (whaleMemo ??= routeStartingIn(SEEP));
/** 맹목의 사냥꾼의 경로 이름 — 긴 밤에 시작하는 것 */
const hunterRoute = (): string => (hunterMemo ??= routeStartingIn(LONG_NIGHT));

/** 스밈의 낮에 선 세계 — 천공고래가 그 첫 Tick 에 지나가기 시작한다 (가라앉음이 섞이지 않는 철) */
const whaleWorld = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  inSeason(SEEP, region, at, extra);
/** 긴 밤에 선 세계 — 눈 없는 것이 그 첫 Tick 에 지나가기 시작한다 */
const hunterWorld = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  inSeason(LONG_NIGHT, region, at, extra);

/** 그 방 presence 곡선의 마디들 — 관찰자가 자기 데이터에서 얻는다 (C013 의 siteCurve 규율) */
function curvePoints(region: string, tag: string): XZ[] {
  const curve = curvesOf(spaceOf(region), PRESENCE_LAYER, tag)[0];
  if (!curve) throw new Error(`${region} 의 presence 곡선 '${tag}' 가 데이터에 없다`);
  return curve.points.map((p) => ({ x: p.x, z: p.z }));
}

/**
 * hazard layer 의 자락마다, 그 경로 선에 가장 가까운 설 자리 하나씩.
 *
 * **자락의 이름을 손으로 적지 않는다** — layer 의 태그는 area 의 이름이지 위험 코드가 아니므로
 * (C016 이 세운 어법: 코드는 덧씌움이 따로 밝힌다) 이름으로 고를 수 없다. 그래서 후보를
 * 자락마다 하나씩 뽑아 두고, **지나는 동안 그 코드가 실제로 답해지는 자리**를 세계에게 묻는다.
 */
function hazardSpots(region: string, curveTag: string): XZ[] {
  const t = terrainOf(region);
  const points = curvePoints(region, curveTag);
  const byTag = new Map<string, XZ[]>();
  for (const p of walkableSpots(region)) {
    for (const tag of tagsAt(t, p.x, p.z, HAZARD_LAYER)) {
      const held = byTag.get(tag) ?? [];
      held.push(p);
      byTag.set(tag, held);
    }
  }
  if (byTag.size === 0) {
    throw new Error(
      `${region} 에 hazard 자락이 하나도 없다 — spec 데이터 값 절이 경로 선 둘레에 그것을 두라고 못 박았다`,
    );
  }
  return [...byTag.values()].map((spots) =>
    minBy(spots, (p) => Math.min(...points.map((q) => distanceBetween(p, q)))),
  );
}
/** 지나는 동안 그 위험 코드가 답해지는 자리에 몸을 세운 세계 */
function standingInCreature(
  w: WorldDriver,
  region: string,
  curveTag: string,
  bodyId: string,
  /** 그 태그가 걸린 자리는 빼고 고른다 — 다른 원인이 같은 코드를 거는 자락을 피할 때 쓴다 */
  excludeTag?: string,
): { world: WorldDriver; spot: XZ } {
  const t = terrainOf(region);
  const spots = hazardSpots(region, curveTag).filter(
    (p) => !excludeTag || !tagsAt(t, p.x, p.z, HAZARD_LAYER).includes(excludeTag),
  );
  for (const spot of spots) {
    const probe = moveBody(w, region, spot, bodyId);
    if (conditionsSeen(probe).includes(HAZARD_CREATURE)) return { world: probe, spot };
  }
  throw new Error(
    `${region} 의 어느 자락에서도 '${HAZARD_CREATURE}' 가 답해지지 않는다 — spec 데이터 값 절이 지나는 동안 그 자락을 그렇게 읽으라고 못 박았다`,
  );
}
/** 어느 hazard 자락에도 들지 않는 설 자리 — 위험이 걸리지 않는 자리다 */
function spotOutsideHazard(region: string, from: XZ): XZ {
  const t = terrainOf(region);
  const outside = walkableSpots(region).filter(
    (p) => tagsAt(t, p.x, p.z, HAZARD_LAYER).length === 0,
  );
  if (outside.length === 0) throw new Error(`${region} 에 자락 밖의 설 자리가 없다`);
  return maxBy(outside, (p) => distanceBetween(p, from));
}

// ── 부르기 (개발 명령) ───────────────────────────────────────────────
//
// **spec 이 침묵한 자리** — 명령의 id 도, 경로 이름을 어느 자리로 건네는지도 spec 에 없다.
// 그래서 명령은 **관찰 결과에서 찾고**(경로 이름을 받는 자리를 가진 명령), 이름은 지목
// (targetEntityId)으로 건넨다 — 문의 이름을 건너기에, 원천의 이름을 캐기에 건네던 그 자리다.
const KNOWN_COMMANDS: readonly string[] = ['set-attribute', 'emergency-return'];

function summonCommandOf(v: GameViewSnapshot, routeIds: readonly string[]): CommandView {
  const named = new Set(routeIds);
  const byDomain = v.commands.find((c) =>
    c.parameters.some((p) => (p.domain.options ?? []).some((o) => named.has(o.name))),
  );
  if (byDomain) return byDomain;
  const added = v.commands.filter((c) => !KNOWN_COMMANDS.includes(c.id));
  if (added.length === 1) return added[0]!;
  throw new Error(
    `관찰 결과에서 부르기 명령을 찾을 수 없다 (명령: ${v.commands.map((c) => c.id).join(', ')}) — spec World Change 3 이 개발 명령 하나를 못 박았다`,
  );
}
const summonCommand = (w: WorldDriver): CommandView =>
  summonCommandOf(w.observe(), Object.keys(presencesOf(w)));
const summon = (w: WorldDriver, routeId: string): ActionResult =>
  w.dispatch({ interactionId: summonCommand(w).id, targetEntityId: routeId });
const askSummon = (w: WorldDriver, routeId: string): RequestOutcomeView[] =>
  w.dispatchForOutcome({ interactionId: summonCommand(w).id, targetEntityId: routeId });

// ── 도구를 밖에서 돌린다 (tools/world-editor/tests 의 선례 그대로) ────
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CHECK = 'tools/world-editor/check.ts';
const OBSERVE = 'tools/world-editor/observe.ts';

function runTool(script: string, args: readonly string[]) {
  const result = spawnSync('npx', ['tsx', script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 시간표가 오면 지나간다', () => {
  it('S-011 밝힌 철·낮밤이 되면 그 순간부터 지나가고 마디 넷 × 45 초에 끝난다', () => {
    // Given 스밈의 낮에 선 세계 (천공고래의 시간표가 든 때다)
    const w = whaleWorld(WHALE_ROOMS[0]!);
    const route = whaleRoute();
    const started = timeOf(w);
    // Then 그 자리에서 지나가기 시작했다 — 시작한 시각과 바퀴가 적혔다
    expect(routeStateOf(w, route)).toMatchObject({ startedAt: started, passes: 0 });
    expect(routeStateOf(w, route).startedCycle).toBe(Math.floor(started / CYCLE_SECONDS));
    // And 마디 넷이 밝힌 방들을 차례로 지난다
    expect(routeRoomsOf(w, route)).toEqual([...WHALE_ROOMS]);

    // When 마디 하나만큼 못 미치게 굴린다
    runToElapsed(w, route, WHALE_PASS_SECONDS - 1);
    // Then 아직 지나고 있다
    expect(isPassing(w, route)).toBe(true);
    expect(nodeIndexOf(w, route)).toBe(WHALE_NODES - 1);

    // When 마디 수 × 마디당 시간을 넘긴다
    wait(w, 2);
    // Then 지나감이 끝났고 마친 수가 하나 올랐다
    expect(isPassing(w, route)).toBe(false);
    expect(passesOf(w, route)).toBe(1);
  });

  it('S-012 (경계 ①) 그 철이 이어지는 동안 한 바퀴에 두 번 시작하지 않는다', () => {
    // Given 스밈의 낮에 한 번 지나간 세계
    const w = whaleWorld(WHALE_ROOMS[0]!);
    const route = whaleRoute();
    const cycle = routeStateOf(w, route).startedCycle;
    wait(w, WHALE_PASS_SECONDS + 2, 10);
    expect(passesOf(w, route)).toBe(1);

    // When 그 바퀴 안에서 낮이 여러 번 더 오도록 굴린다 (긴 밤 앞까지)
    runTo(w, cycle! * CYCLE_SECONDS + SEASON_AT[LONG_NIGHT] - 10, 30);
    // Then 한 번뿐이다 — 다시 시작하지 않았다
    expect(passesOf(w, route)).toBe(1);
    expect(isPassing(w, route)).toBe(false);
  });

  it('S-013 (경계 ②) 바퀴 조건을 밝힌 경로는 그 바퀴가 아니면 시작하지 않는다', () => {
    // Given 세계가 선 첫 바퀴에 한 번 지나간 뒤 (0 바퀴)
    const w = standingIn(WHALE_ROOMS[0]!);
    const route = whaleRoute();
    runTo(w, WHALE_PASS_SECONDS + 2, 10);
    expect(passesOf(w, route)).toBe(1);

    // When 다음 두 바퀴를 통째로 지난다 (낮이 열두 번 온다)
    runTo(w, WHALE_CYCLE_EVERY * CYCLE_SECONDS - 10, 30);
    // Then 그 바퀴들에는 한 번도 시작하지 않았다
    expect(passesOf(w, route)).toBe(1);
    expect(isPassing(w, route)).toBe(false);

    // When 셋째 바퀴의 낮으로 들어선다
    runTo(w, WHALE_CYCLE_EVERY * CYCLE_SECONDS + 30, 30);
    // Then 다시 지나간다 — 바퀴 조건이 그것을 정한다
    expect(routeStateOf(w, route).startedCycle).toBe(WHALE_CYCLE_EVERY);
    expect(isPassing(w, route)).toBe(true);
  });

  it('S-014 (경계 ③) 철·낮밤이 맞지 않으면 시작하지 않는다', () => {
    // Given 스밈의 **밤**에 선 세계 — 고래의 시간표는 낮이다
    const night = inSeason('SEEP:NIGHT', WHALE_ROOMS[0]!);
    expect(night.observe().clock.dayPhase).toBe('NIGHT');
    expect(isPassing(night, whaleRoute())).toBe(false);
    // And 눈 없는 것도 서지 않는다 — 그 시간표는 긴 밤이다
    expect(isPassing(night, hunterRoute())).toBe(false);

    // When 낮이 오도록 굴린다
    runTo(night, timeOf(night) + 130, 10);
    expect(night.observe().clock.dayPhase).toBe('DAY');
    // Then 그때 비로소 지나가기 시작한다
    expect(isPassing(night, whaleRoute())).toBe(true);

    // Given 고요에 선 세계 — 눈 없는 것의 시간표는 긴 밤이다
    const still = inSeason(STILL, HUNTER_FIRST);
    expect(seasonOf(still)).toBe(STILL);
    wait(still, HUNTER_PASS_SECONDS + 5, 5);
    // Then 고요 내내 한 번도 서지 않는다
    expect(isPassing(still, hunterRoute())).toBe(false);
    expect(passesOf(still, hunterRoute())).toBe(0);
  });

  it('S-015 (경계 ④) 관찰자가 그 방에 하나도 없어도 지나간다', () => {
    // Given 관찰자가 경로의 어느 방에도 없는 세계 (미로에 홀로 서 있다)
    const base = whaleWorld(FANTASY_MAZE);
    const route = whaleRoute();
    expect(actorOf(base, bodyOf(base)).regionId).toBe(FANTASY_MAZE);
    expect(WHALE_ROOMS).not.toContain(FANTASY_MAZE);

    // Then 아무도 보지 않는 방들을 그대로 지나간다
    expect(isPassing(base, route)).toBe(true);
    expect(routeRoomsOf(base, route)).toEqual([...WHALE_ROOMS]);
    // When 끝까지 둔다
    wait(base, WHALE_PASS_SECONDS + 2, 5);
    // Then 마친 수가 올랐다 — 관찰과 무관한 세계 과정이다
    expect(passesOf(base, route)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-002 부르면 지금부터 지나간다', () => {
  it('S-021 부르면 그 자리에서 지나가기 시작한다 — 명령 표면에 그것이 밝혀져 있다', () => {
    // Given 어느 경로도 지나고 있지 않은 때 (스밈의 밤)
    const w = inSeason('SEEP:NIGHT', WHALE_ROOMS[0]!);
    const route = whaleRoute();
    expect(isPassing(w, route)).toBe(false);
    // 명령 표면에 서 있고 걸 수 있다고 밝혀져 있다 (C009 의 명령 표면 그대로)
    const command = summonCommand(w);
    expect(command.available).toBe(true);
    expect(command.reason).toBeUndefined();

    // When 그 경로를 부른다
    const now = timeOf(w);
    expect(summon(w, route).status).toBe('success');
    // Then 그 자리에서 지나가기 시작했다
    expect(routeStateOf(w, route)).toMatchObject({ startedAt: now });
    expect(routeRoomsOf(w, route)).toEqual([...WHALE_ROOMS]);
  });

  it('S-022 (경계 ①) 조작이 닫힌 세계에서는 가용하지 않고 걸어도 거절된다', () => {
    // Given 조작을 닫아 둔 세계
    const w = driveWorld({ ...solo, debugAuthority: false, clock: 'SEEP:NIGHT' });
    const route = whaleRoute();
    expect(w.observe().debug.open).toBe(false);
    // Then 목록에는 있으나 걸 수 없다고 밝혀져 있다 (C009 의 판정 그대로)
    const command = summonCommand(w);
    expect(command).toMatchObject({ available: false, reason: DEBUG_CLOSED });

    // When 그래도 건다
    const answer = askSummon(w, route);
    // Then 거절되고 아무 일도 일어나지 않는다
    expect(answer).toHaveLength(1);
    expect(answer[0]).toMatchObject({ accepted: false, reason: DEBUG_CLOSED });
    expect(isPassing(w, route)).toBe(false);
  });

  it('S-023 (경계 ②) 모르는 경로 이름은 아무 일도 하지 않는다', () => {
    // Given 어느 경로도 지나고 있지 않은 때
    const w = inSeason('SEEP:NIGHT', WHALE_ROOMS[0]!);
    const before = JSON.stringify(presencesOf(w));

    // When 세계가 모르는 이름을 부른다
    const answer = askSummon(w, 'NO_SUCH_ROUTE');
    // Then 대답은 오되(조용히 사라지지 않는다) 받아들여지지 않았다
    expect(answer).toHaveLength(1);
    expect(answer[0]?.accepted).toBe(false);
    // And 어느 경로도 서지 않았다 — 한 값도 달라지지 않았다
    expect(JSON.stringify(presencesOf(w))).toBe(before);
    expect(passingRoutes(w)).toEqual([]);
  });

  it('S-024 (경계 ③) 부른 것도 그 바퀴의 한 번으로 센다 — 뒤에 시간표가 또 시작하지 않는다', () => {
    // Given 스밈의 밤에 불러서 지나간 세계 (그 바퀴에 시간표는 아직 오지 않았다)
    const w = inSeason('SEEP:NIGHT', WHALE_ROOMS[0]!);
    const route = whaleRoute();
    expect(summon(w, route).status).toBe('success');
    const cycle = routeStateOf(w, route).startedCycle;
    expect(cycle).toBe(Math.floor(timeOf(w) / CYCLE_SECONDS));
    wait(w, WHALE_PASS_SECONDS + 2, 5);
    expect(passesOf(w, route)).toBe(1);

    // When 그 바퀴의 낮이 오도록 굴린다 (시간표가 드는 때다)
    runTo(w, cycle! * CYCLE_SECONDS + SEASON_AT[LONG_NIGHT] - 10, 30);
    expect(seasonOf(w)).toBe(SEEP);
    // Then 그 바퀴에는 다시 시작하지 않았다 — 부른 것이 그 한 번이었다
    expect(passesOf(w, route)).toBe(1);
    expect(isPassing(w, route)).toBe(false);
  });

  it('S-025 (경계 ④) 이미 지나는 것을 부르면 처음부터 다시 지나간다', () => {
    // Given 마디 셋째를 지나고 있는 세계
    const w = whaleWorld(WHALE_ROOMS[0]!);
    const route = whaleRoute();
    runToNode(w, route, 2, 5);
    expect(nodeIndexOf(w, route)).toBe(2);

    // When 그것을 부른다
    const now = timeOf(w);
    expect(summon(w, route).status).toBe('success');
    // Then 처음부터 다시 지나간다 — 시작 시각이 지금이고 첫 마디로 돌아왔다
    expect(routeStateOf(w, route).startedAt).toBe(now);
    expect(nodeIndexOf(w, route)).toBe(0);
    // And 마친 수는 오르지 않았다 (끝난 적이 없다)
    expect(passesOf(w, route)).toBe(0);
  });

  it('S-026 부른 것이 시간표로 시작한 것과 한 값도 다르지 않게 굴러간다', () => {
    const route = whaleRoute();
    /** 그 세계가 지나감 하나를 마친 뒤의 자취 — 시작 시각만 빼고 견준다 */
    const traceOf = (w: WorldDriver) => {
      const rooms = routeRoomsOf(w, route);
      const marks: string[] = [];
      for (let node = 0; node < WHALE_NODES; node++) {
        runToNode(w, route, node, 5);
        marks.push(`${node}:${rooms[node]}:${seenCodes(w).join('+')}`);
      }
      wait(w, PRESENCE_SECONDS_PER_NODE, 5);
      return {
        rooms,
        marks,
        passes: passesOf(w, route),
        passing: isPassing(w, route),
        left: storedOf(w, LEFTOVER_ROOM, leftoverOf(w, route)).phase,
      };
    };
    // Given 시간표로 시작한 세계 (스밈의 낮) / 부른 세계 (스밈의 밤)
    const scheduled = whaleWorld(WHALE_ROOMS[0]!);
    const called = inSeason('SEEP:NIGHT', WHALE_ROOMS[0]!);
    expect(summon(called, route).status).toBe('success');
    // Then 지나는 방도 보이는 것도 남긴 것도 한 값도 다르지 않다
    expect(traceOf(called)).toEqual(traceOf(scheduled));
  });
});

/**
 * 그 경로가 그 방에 **남기는 원천**의 이름 — 지나가기 전과 뒤의 차이가 그것을 말한다.
 *
 * spec 은 원천의 id 를 적지 않는다(관찰자가 자기 데이터에서 얻는 규율 그대로). 그래서
 * 데이터가 밝힌 후보(**지나가야 서는** 갈래 · supply event-scarce)에서 고르고, 그 가운데
 * 이 경로가 지난 뒤에 실제로 선 것을 이름으로 삼는다.
 */
function leftoverCandidates(region: string): string[] {
  const found = sourcesInRegion(region)
    .map((s) => s.id)
    .filter((id) => (ecologyOf(region, id) as { supply?: string }).supply === 'event-scarce');
  if (found.length === 0) {
    throw new Error(
      `${region} 에 event-scarce 원천이 없다 — spec 데이터 값 절이 떨어진 비늘·먹이 잔해를 그렇게 못 박았다`,
    );
  }
  return found;
}
/** 그 경로가 지나기 전에는 서지 않고 지난 뒤에 선 원천 하나 */
function leftoverOf(w: WorldDriver, routeId: string): string {
  const candidates = leftoverCandidates(LEFTOVER_ROOM);
  const standing = candidates.filter((id) => storedOf(w, LEFTOVER_ROOM, id).phase === AVAILABLE);
  if (standing.length === 1) return standing[0]!;
  // 아직 지나가지 않았거나 둘 다 서 있으면 이름을 가릴 수 없다 — 부른 뒤에 다시 묻는다
  throw new Error(
    `${LEFTOVER_ROOM} 에서 '${routeId}' 가 남긴 원천을 가릴 수 없다 (후보 ${candidates.join(', ')} · 서 있는 것 ${standing.join(', ') || '없음'})`,
  );
}

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-003 지나는 것이 관찰에 실린다', () => {
  it('S-031 그 방을 지나는 동안 무엇이 · 어느 선으로 지나는지가 실린다', () => {
    // Given 천공고래가 첫 마디를 지나는 방에 선 관찰자
    const w = whaleWorld(WHALE_ROOMS[0]!);
    const route = whaleRoute();
    runToNode(w, route, 0, 5);
    // Then 판의 「지나는 것」에 그것이 서 있다
    expect(seenCodes(w)).toContain(SKY_WHALE);
    const seen = seenPresences(w).find((p) => p.presence === SKY_WHALE)!;
    // And 그것이 이 방에서 지나는 **선의 이름**이 함께 실린다 — 그 선은 내 데이터에 있다
    expect(curvePoints(WHALE_ROOMS[0]!, seen.curve!).length).toBeGreaterThan(1);
    // And 실린 자리는 무엇과 어느 선, 둘뿐이다 (spec Observable)
    expect(Object.keys(seen).sort()).toEqual(['curve', 'presence']);
  });

  it('S-032 (경계 ①) 다른 방을 지나는 동안에는 실리지 않는다 — 관찰은 방으로 잘린다', () => {
    // Given 경로의 첫 방과 둘째 방에 각각 선 관찰자 둘
    const w = staged(
      [
        { observer: OBSERVER, region: WHALE_ROOMS[0]!, at: anySpot(WHALE_ROOMS[0]!) },
        { observer: OBSERVER_2, region: WHALE_ROOMS[1]!, at: anySpot(WHALE_ROOMS[1]!) },
      ],
      { clock: SEEP },
    );
    const route = whaleRoute();
    // When 첫 마디를 지나는 동안 본다
    runToNode(w, route, 0, 5);
    // Then 첫 방에만 실리고 둘째 방은 빈 배열이다
    expect(seenCodes(w, OBSERVER)).toContain(SKY_WHALE);
    expect(seenPresences(w, OBSERVER_2)).toEqual([]);

    // When 둘째 마디로 넘어간다
    runToNode(w, route, 1, 5);
    // Then 자리가 바뀐다 — 지나간 방에는 이제 없다
    expect(seenPresences(w, OBSERVER)).toEqual([]);
    expect(seenCodes(w, OBSERVER_2)).toContain(SKY_WHALE);
  });

  it('S-033 (경계 ②) 지나가기 전과 지나간 뒤에는 빈 목록이다', () => {
    // Given 아직 지나가지 않은 때 (스밈의 밤)
    const w = inSeason('SEEP:NIGHT', WHALE_ROOMS[0]!);
    expect(seenPresences(w)).toEqual([]);
    // When 불러서 지나가게 한다
    const route = whaleRoute();
    expect(summon(w, route).status).toBe('success');
    runToNode(w, route, 0, 5);
    expect(seenCodes(w)).toContain(SKY_WHALE);
    // When 지나감이 다 끝난다
    wait(w, WHALE_PASS_SECONDS, 5);
    expect(isPassing(w, route)).toBe(false);
    // Then 그 줄이 없다
    expect(seenPresences(w)).toEqual([]);
  });

  it('S-034 (경계 ③) 시간표 · 남은 시간 · 다음 방 · 몇 번째인지는 봉투 어디에도 없다', () => {
    const route = whaleRoute();
    // Given 같은 방 같은 자리에서 본 두 관찰 결과 — 지나는 동안과 지나가기 전
    const idle = inSeason('SEEP:NIGHT', WHALE_ROOMS[0]!, anySpot(WHALE_ROOMS[0]!));
    const passing = whaleWorld(WHALE_ROOMS[0]!, anySpot(WHALE_ROOMS[0]!));
    runToNode(passing, route, 0, 5);
    expect(seenCodes(passing)).toContain(SKY_WHALE);
    // 명령 표면은 빼고 본다 — 부르기 명령은 **무엇을 받는지** 밝혀야 하므로 경로의 이름이
    // 거기 서는 것이 옳다 (C009 의 명령 표면 규율). 여기서 재는 것은 세계의 투영이다.
    const withoutCommands = (v: GameViewSnapshot) => JSON.stringify({ ...v, commands: [] });
    const idleText = withoutCommands(idle.observe());
    const passingText = withoutCommands(passing.observe());

    // Then 경로의 이름이 투영 어디에도 없다 (시간표를 든 것이 그것이다)
    expect(passingText.includes(route)).toBe(false);
    // And 지나감이 **방 이름을 하나도 더하지 않는다** — 다음 방도 지나온 방도 실리지 않는다
    for (const spec of REGION_SPECS) {
      if (spec.id === WHALE_ROOMS[0]) continue;
      expect({ room: spec.id, added: passingText.includes(spec.id) }).toEqual({
        room: spec.id,
        added: idleText.includes(spec.id),
      });
    }
    // And 실린 자리는 무엇과 어느 선뿐이다 — 남은 시간도 몇 번째인지도 없다
    for (const one of seenPresences(passing)) {
      expect(Object.keys(one).sort()).toEqual(['curve', 'presence']);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-004 지나는 동안 그 방이 달라진다', () => {
  it('S-041 소란을 밝힌 경로가 지나는 동안 그 방의 소란이 초당 그만큼 오른다', () => {
    // Given 천공고래가 첫 마디를 지나는 방 (가라앉지 않는 철이라 오르는 값만 남는다)
    const w = whaleWorld(WHALE_ROOMS[0]!);
    const route = whaleRoute();
    expect(seasonOf(w)).toBe(SEEP);
    expect(seenValue(w)).toBe(0);
    // When 그 마디 안에서 열 초를 둔다
    const seconds = 10;
    wait(w, seconds, 1);
    expect(nodeIndexOf(w, route)).toBe(0);
    // Then 밝힌 만큼 올랐다 (포식자가 모여든다)
    expect(seenValue(w)).toBeCloseTo(seconds * WHALE_DISTURBANCE_PER_SECOND, 6);
  });

  it('S-042 (경계 ①) 지나가고 나면 소란이 더 오르지 않는다', () => {
    // Given 천공고래가 다 지나간 방 (가라앉지 않는 철에서 본다)
    const w = whaleWorld(WHALE_ROOMS[0]!);
    const route = whaleRoute();
    wait(w, WHALE_PASS_SECONDS + 2, 5);
    expect(isPassing(w, route)).toBe(false);
    const after = seenValue(w);
    // 첫 마디에 머문 만큼 올라 있다
    expect(after).toBeCloseTo(PRESENCE_SECONDS_PER_NODE * WHALE_DISTURBANCE_PER_SECOND, 6);
    // When 다시 한참 둔다
    wait(w, 60, 5);
    // Then 한 값도 더 오르지 않았다
    expect(seenValue(w)).toBe(after);
  });

  it('S-043 위험을 밝힌 경로가 지나는 동안 그 자락에 서면 그 위험 코드가 실린다', () => {
    // Given 눈 없는 것이 첫 마디를 지나는 방, 그 경로 선 둘레의 자락
    const first = hunterWorld(HUNTER_FIRST);
    const route = hunterRoute();
    expect(routeRoomsOf(first, route)[0]).toBe(HUNTER_FIRST);
    const seen = seenPresences(first).find((p) => p.presence === BLIND_HUNTER);
    expect(seen, '첫 마디의 방에서 눈 없는 것이 보이지 않는다').toBeDefined();
    const { world: w } = standingInCreature(first, HUNTER_FIRST, seen!.curve!, bodyOf(first));
    expect(isPassing(w, route)).toBe(true);

    // Then "왜 여기가 위험한가" 가 답해진다
    expect(conditionsSeen(w)).toContain(HAZARD_CREATURE);

    // When 그것이 다 지나간다
    wait(w, HUNTER_PASS_SECONDS + 2, 5);
    expect(isPassing(w, route)).toBe(false);
    // Then 그 자락의 위험 코드가 사라졌다 (경계 ①)
    expect(conditionsSeen(w)).not.toContain(HAZARD_CREATURE);
  });

  it('S-044 (경계) 그 자락 밖에 서면 지나는 동안에도 실리지 않는다', () => {
    // Given 눈 없는 것이 지나는 방의 **자락 밖** 자리
    const first = hunterWorld(HUNTER_FIRST);
    const seen = seenPresences(first).find((p) => p.presence === BLIND_HUNTER)!;
    const { spot: inside } = standingInCreature(first, HUNTER_FIRST, seen.curve!, bodyOf(first));
    const outside = spotOutsideHazard(HUNTER_FIRST, inside);
    const w = moveBody(first, HUNTER_FIRST, outside, bodyOf(first));
    // Then 지나고 있는데도 그 자리에는 위험이 걸리지 않는다
    expect(seenCodes(w)).toContain(BLIND_HUNTER);
    expect(conditionsSeen(w)).not.toContain(HAZARD_CREATURE);
  });

  it('S-045 (경계 ②) 깨어남의 덧씌움과 겹치면 걸린 것이 전부 실린다', () => {
    // Given 소란이 임계에 차 깨어난 광석 지대 — 눈 없는 것은 소란이 높은 그쪽으로 휜다
    const room = BIO_ORE_FIELD;
    const source = plainSourceIn(room);
    const base = hunterWorld(room, undefined, {
      actorItems: { pickaxe: 9 },
      disturbances: { [room]: DISTURBANCE_THRESHOLD - DISTURBANCE_PER_HARVEST },
    });
    const at = sourceAt(base, room, source);
    const staged = moveBody(base, room, besideSpot(at), bodyOf(base));
    // 세계의 규칙으로 깨운다 — 위상을 손으로 적지 않는다 (c017 의 어법 그대로)
    expect(mineOnce(staged, source).status).toBe('success');
    expect(seenPhase(staged)).toBe(AWAKE);
    const depthAwake = depthSeen(staged);

    // When 그 방으로 눈 없는 것을 부른다 (휨은 시작할 때 정해진다)
    const route = hunterRoute();
    expect(summon(staged, route).status).toBe('success');
    expect(routeRoomsOf(staged, route)[1]).toBe(room);
    runToNode(staged, route, 1, 5);
    const seen = seenPresences(staged).find((p) => p.presence === BLIND_HUNTER);
    expect(seen, '휘어 온 방에서 눈 없는 것이 보이지 않는다').toBeDefined();

    // **깨어남이 건 자락은 뺀다** — 지금 데이터에서 깨어남의 위험 코드도 hazard/creature 라
    // (그것이 곧 "겹치면 하나로 줄지 않는다" 를 눈으로 가릴 수 없게 만든다) 지나는 것이 건
    // 것임을 가리려면 그 자락 밖에서 재야 한다.
    const awakeArea = (
      regionSpec(room)!.phases as unknown as {
        awake?: { hazardExtend?: { areaId: string }[] };
      }
    ).awake?.hazardExtend?.[0]?.areaId;
    const awakeOp = awakeArea && spaceOf(room).ops.find((o) => o.id === awakeArea);
    const awakeTag = awakeOp && awakeOp.kind === 'area' ? awakeOp.tag : undefined;

    // Then 깨어남이 건 깊이는 **그 자락에서** 그대로다 (지나가는 것이 그것을 지우지 않는다)
    const awakeDepth = (
      regionSpec(room)!.phases as unknown as {
        awake?: { depthOverlay?: { areaId: string; depth?: string }[] };
      }
    ).awake!.depthOverlay![0]!;
    const depthOp = spaceOf(room).ops.find((o) => o.id === awakeDepth.areaId);
    if (!depthOp || depthOp.kind !== 'area') throw new Error('깨어남의 깊이 자락이 데이터에 없다');
    const t = terrainOf(room);
    const depthSpot = walkableSpots(room).find((p) =>
      tagsAt(t, p.x, p.z, DEPTH_LAYER).includes(depthOp.tag),
    );
    expect(depthSpot, '깨어남의 깊이 자락에 설 자리가 없다').toBeDefined();
    const atDepth = moveBody(staged, room, depthSpot!, bodyOf(staged));
    expect(seenPhase(atDepth)).toBe(AWAKE);
    expect(depthSeen(atDepth)).toBe(awakeDepth.depth);
    expect(depthSeen(atDepth)).toBe(depthAwake);

    // And 지나는 것이 건 위험도 함께 실린다 — 걸린 것이 전부다
    const { world: w } = standingInCreature(staged, room, seen!.curve!, bodyOf(staged), awakeTag);
    expect(seenPhase(w)).toBe(AWAKE);
    expect(conditionsSeen(w)).toContain(HAZARD_CREATURE);

    // And 그 코드는 **지나는 것**이 건 것이다 — 다 지나가면 그 자리에서 사라지고 깨어남은 남는다
    wait(w, HUNTER_PASS_SECONDS + 2, 5);
    expect(isPassing(w, route)).toBe(false);
    expect(seenPhase(w)).toBe(AWAKE);
    expect(conditionsSeen(w)).not.toContain(HAZARD_CREATURE);
  });

  it('S-046 (경계 ③) 밝히지 않은 것은 달라지지 않는다', () => {
    // Given 소란만 밝힌 경로(천공고래)가 지나는 방
    const whale = whaleWorld(WHALE_ROOMS[0]!);
    wait(whale, 5, 1);
    expect(seenValue(whale)).toBeGreaterThan(0);
    // Then 위험은 하나도 걸리지 않는다
    for (const code of conditionsSeen(whale)) expect(code).not.toBe(HAZARD_CREATURE);

    // Given 위험만 밝힌 경로(눈 없는 것)가 지나는 방
    const hunter = hunterWorld(HUNTER_FIRST);
    expect(isPassing(hunter, hunterRoute())).toBe(true);
    const before = heldValue(hunter, HUNTER_FIRST) ?? 0;
    // When 그 마디 안에서 시간을 둔다 (긴 밤이라 가라앉지도 않는다)
    wait(hunter, 20, 1);
    // Then 소란은 한 값도 오르지 않았다 (기본형 ⑥ — 자기가 낸 소란으로 자기가 휘지 않는다)
    expect(heldValue(hunter, HUNTER_FIRST) ?? 0).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-005 경로가 소란이 높은 쪽으로 휜다', () => {
  it('S-051 마디가 후보를 둘 밝히면 소란이 높은 방으로 간다', () => {
    // Given 광석 지대의 소란을 올려 둔 세계 (숲 가장자리는 0 이다)
    const w = hunterWorld(HUNTER_FIRST, undefined, {
      disturbances: { [BIO_ORE_FIELD]: 100 },
    });
    const route = hunterRoute();
    // Then 그 마디에서 소란이 높은 방으로 간다 — 숲 가장자리에는 오지 않는다
    expect(routeRoomsOf(w, route)).toEqual([HUNTER_FIRST, BIO_ORE_FIELD]);

    // And 그 방에서 실제로 보인다
    const seenThere = moveBody(w, BIO_ORE_FIELD, anySpot(BIO_ORE_FIELD), bodyOf(w));
    runToNode(seenThere, route, 1, 5);
    expect(seenCodes(seenThere)).toContain(BLIND_HUNTER);
  });

  it('S-052 (경계 ①) 소란이 같으면 데이터 순서의 앞선 방이다', () => {
    // Given 두 후보의 소란이 똑같이 0 인 세계
    const w = hunterWorld(HUNTER_FIRST);
    expect(heldValue(w, HUNTER_CANDIDATES[0]!) ?? 0).toBe(heldValue(w, HUNTER_CANDIDATES[1]!) ?? 0);
    // Then 데이터 순서의 앞선 방이다 (결정론)
    expect(routeRoomsOf(w, hunterRoute())).toEqual([HUNTER_FIRST, HUNTER_CANDIDATES[0]!]);
  });

  it('S-053 (경계 ②) 후보가 하나뿐인 마디는 휘지 않는다', () => {
    // Given 고래의 경로 밖·안의 방들에 소란을 잔뜩 올려 둔 세계
    const w = whaleWorld(WHALE_ROOMS[0]!, undefined, {
      disturbances: { [BIO_ORE_FIELD]: 200, [FOREST_DEEP]: 150, [EXPLORER_RUIN]: 250 },
    });
    // Then 고래는 밝힌 방들을 그대로 지난다 — 소란이 그 길을 바꾸지 않는다
    expect(routeRoomsOf(w, whaleRoute())).toEqual([...WHALE_ROOMS]);
  });

  it('S-054 (경계 ③) 도중에 소란이 뒤집혀도 그 지나감은 바뀌지 않는다', () => {
    // Given 광석 지대로 휘어 지나가고 있는 세계
    const start = hunterWorld(HUNTER_FIRST, undefined, {
      disturbances: { [BIO_ORE_FIELD]: 100 },
    });
    const route = hunterRoute();
    expect(routeRoomsOf(start, route)[1]).toBe(BIO_ORE_FIELD);

    // When 지나는 도중에 숲 가장자리의 소란을 훨씬 높인다
    const w = worldFrom(start, (s) => charge(s, FOREST_EDGE, 290));
    expect(heldValue(w, FOREST_EDGE)).toBeGreaterThan(heldValue(w, BIO_ORE_FIELD) ?? 0);
    expect(isPassing(w, route)).toBe(true);
    runToNode(w, route, 1, 5);
    // Then 그 지나감은 그대로다 — 휨은 시작할 때 한 번이다
    expect(routeRoomsOf(w, route)).toEqual([HUNTER_FIRST, BIO_ORE_FIELD]);
    const bent = moveBody(w, BIO_ORE_FIELD, anySpot(BIO_ORE_FIELD), bodyOf(w));
    expect(seenCodes(bent)).toContain(BLIND_HUNTER);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-006 지나간 뒤 남긴 것이 선다', () => {
  /** 천공고래가 한 번 지나간 세계 (남긴 것이 선 뒤다) */
  function afterWhalePass(extra: WorldSetup = {}): WorldDriver {
    const w = whaleWorld(LEFTOVER_ROOM, undefined, { actorItems: { pickaxe: 9 }, ...extra });
    wait(w, WHALE_PASS_SECONDS + 2, 5);
    expect(passesOf(w, whaleRoute())).toBe(1);
    return w;
  }

  it('S-061 실제로 지난 방에 그 원천이 서고 캘 수 있다 — 자리는 그 방 경로 선의 마디 하나다', () => {
    // Given 천공고래가 숲 가장자리를 지나는 동안 그 선의 이름을 읽어 둔다
    const during = whaleWorld(LEFTOVER_ROOM);
    const route = whaleRoute();
    runToNode(during, route, WHALE_ROOMS.indexOf(LEFTOVER_ROOM), 5);
    const curve = seenPresences(during).find((p) => p.presence === SKY_WHALE)?.curve;
    expect(curve, '숲 가장자리에서 고래의 선을 읽지 못했다').toBeDefined();

    // When 그것이 다 지나간다
    const w = afterWhalePass();
    const left = leftoverOf(w, route);
    // Then 그 방에 원천이 서 있다
    expect(storedOf(w, LEFTOVER_ROOM, left)).toMatchObject({ phase: AVAILABLE, taken: 0 });
    // And 자리는 그 방 경로 선의 마디 하나다 (C013 의 siteCurve 그대로)
    const sites = curvePoints(LEFTOVER_ROOM, curve!);
    const at = sourceAt(w, LEFTOVER_ROOM, left);
    expect(sites.map((p) => `${p.x},${p.z}`)).toContain(`${at.x},${at.z}`);

    // And 곁에 서면 캘 수 있다
    const beside = moveBody(w, LEFTOVER_ROOM, besideSpot(at), bodyOf(w));
    expect(sourceEntity(beside.observe(), left)).toBeDefined();
    expect(mine(beside, left)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
  });

  it('S-062 (경계 ①) 지나가기 전에는 그 자리에 없고 지목해도 캘 수 없다', () => {
    // Given 아직 한 번도 지나가지 않은 세계 (스밈의 밤)
    const w = inSeason('SEEP:NIGHT', LEFTOVER_ROOM, undefined, { actorItems: { pickaxe: 9 } });
    expect(passesOf(w, whaleRoute())).toBe(0);
    expect(passesOf(w, hunterRoute())).toBe(0);
    // Then 남겨지는 원천들은 하나도 서 있지 않다 (처음 상태가 고갈이다 — R6)
    //
    // **spec 이 두 갈래로 말한 자리** — Observable 은 "지나간 뒤에만 실린다" 고 하고 경계 ① 은
    // "지목하면 아직 그때가 아니다가 걸린다" 고 한다. 지목할 수 없는 것에는 조건을 볼 수 없으므로
    // 여기서는 R6·R7 이 이름한 **C014 의 어법**(고갈로 서 있고 조건이 걸린다)으로 잰다.
    for (const id of leftoverCandidates(LEFTOVER_ROOM)) {
      expect({ id, phase: storedOf(w, LEFTOVER_ROOM, id).phase }).not.toEqual({
        id,
        phase: AVAILABLE,
      });
      const seen = sourceEntity(w.observe(), id);
      expect({ id, standing: seen?.state }).not.toEqual({ id, standing: AVAILABLE });
      // And 지금 멎었다는 것이 실린다 — C014 의 그 코드 그대로 (새 코드를 만들지 않는다)
      if (seen) expect({ id, conditions: seen.conditions ?? [] }).toEqual({
        id,
        conditions: expect.arrayContaining([CONDITION_UNMET]),
      });
      // And 지목해도 캘 수 없다 — 아직 그때가 아니다
      expect({ id, status: mine(w, id).status }).toEqual({ id, status: 'failure' });
    }
  });

  it('S-063 (경계 ②) 되돌아옴의 진행이 오르지 않는다 — 시간이 아니라 다시 지나가는 것이 되돌린다', () => {
    // Given 한 번 지나가 선 원천을 다 캔 세계 (채취 단위 1)
    const w = afterWhalePass();
    const route = whaleRoute();
    const left = leftoverOf(w, route);
    const at = sourceAt(w, LEFTOVER_ROOM, left);
    const beside = moveBody(w, LEFTOVER_ROOM, besideSpot(at), bodyOf(w));
    expect(mineOnce(beside, left).status).toBe('success');
    expect(storedOf(beside, LEFTOVER_ROOM, left).phase).not.toBe(AVAILABLE);

    // When 되돌아오고도 남을 만큼 시간을 둔다 (그 사이 그것은 지나지 않는다)
    const recovery = (ecologyOf(LEFTOVER_ROOM, left) as { recoverySeconds?: number }).recoverySeconds ?? 0;
    expect(recovery).toBeGreaterThan(0);
    wait(beside, recovery * 2 + 20, 5);
    // Then 진행이 오르지 않아 여전히 서지 않는다
    expect(storedOf(beside, LEFTOVER_ROOM, left).phase).not.toBe(AVAILABLE);
    expect(storedOf(beside, LEFTOVER_ROOM, left).progress ?? 0).toBe(0);
    // And 지금 멎었다는 것이 그 원천에 실린다 — C014 의 그 코드 그대로 (새 코드를 만들지 않는다)
    const seen = sourceEntity(beside.observe(), left);
    if (seen) expect(seen.conditions ?? []).toContain(CONDITION_UNMET);
  });

  it('S-064 (경계 ③) 그 방을 지나지 않았으면(휘었으면) 서지 않는다', () => {
    // Given 광석 지대로 휘어 지나간 세계
    const w = hunterWorld(HUNTER_FIRST, undefined, {
      disturbances: { [BIO_ORE_FIELD]: 100 },
    });
    const route = hunterRoute();
    const before = leftoverCandidates(LEFTOVER_ROOM).map(
      (id) => `${id}:${storedOf(w, LEFTOVER_ROOM, id).phase}`,
    );
    expect(routeRoomsOf(w, route)[1]).toBe(BIO_ORE_FIELD);
    // When 다 지나간다
    wait(w, HUNTER_PASS_SECONDS + 2, 5);
    expect(passesOf(w, route)).toBe(1);
    // Then 숲 가장자리에는 아무것도 서지 않았다 — 그 방을 지나지 않았다
    expect(
      leftoverCandidates(LEFTOVER_ROOM).map((id) => `${id}:${storedOf(w, LEFTOVER_ROOM, id).phase}`),
    ).toEqual(before);
  });

  it('S-065 (경계 ④) 몇 번째 지나감인지가 마디를 정한다 — 같은 세계를 두 번 돌리면 같은 마디다', () => {
    const route = whaleRoute();
    /** 지나감 n 번을 마친 뒤 남겨진 것의 자리 */
    const siteAfter = (times: number) => {
      const w = whaleWorld(LEFTOVER_ROOM);
      for (let i = 0; i < times; i++) {
        expect(summon(w, route).status).toBe('success');
        wait(w, WHALE_PASS_SECONDS + 2, 5);
      }
      expect(passesOf(w, route)).toBe(times);
      const left = leftoverOf(w, route);
      const at = sourceAt(w, LEFTOVER_ROOM, left);
      return { site: storedOf(w, LEFTOVER_ROOM, left).siteIndex ?? 0, at: `${at.x},${at.z}` };
    };
    // Then 같은 세계를 두 번 돌리면 같은 마디다 (결정론)
    expect(siteAfter(1)).toEqual(siteAfter(1));
    expect(siteAfter(2)).toEqual(siteAfter(2));
  });

  it('S-066 (경계 ⑤) 다 캔 뒤 다시 지나가면 다시 선다', () => {
    // Given 한 번 지나가 선 것을 다 캔 세계
    const w = afterWhalePass();
    const route = whaleRoute();
    const left = leftoverOf(w, route);
    const beside = moveBody(
      w,
      LEFTOVER_ROOM,
      besideSpot(sourceAt(w, LEFTOVER_ROOM, left)),
      bodyOf(w),
    );
    expect(mineOnce(beside, left).status).toBe('success');
    expect(storedOf(beside, LEFTOVER_ROOM, left).phase).not.toBe(AVAILABLE);

    // When 다시 지나간다
    expect(summon(beside, route).status).toBe('success');
    wait(beside, WHALE_PASS_SECONDS + 2, 5);
    expect(passesOf(beside, route)).toBe(2);
    // Then 다시 서 있고 다시 캘 수 있다
    expect(storedOf(beside, LEFTOVER_ROOM, left)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-007 밝힌 것만 달라진다', () => {
  /** 그 방의 관찰 가능한 사실들 — 깊이 · 위험 · 소란 · 원천 · 출구 (c016 의 견줌 그대로) */
  const factsOf = (w: WorldDriver, observerId = OBSERVER) => {
    const v = w.observe(observerId);
    return {
      depth: depthSeen(w, observerId),
      conditions: [...v.standingConditions].sort(),
      disturbance: v.region.disturbance,
      sources: v.entities
        .filter((e) => e.role === 'resource-source')
        .map((e) => `${e.id}:${e.state}:${e.position.x},${e.position.z}`)
        .sort(),
      exits: v.entities
        .filter((e) => e.role === 'region-exit')
        .map((e) => `${e.id}:${e.state}`)
        .sort(),
      hash: v.region.hash,
    };
  };

  it('S-071 경로가 지나지 않는 방은 한 값도 달라지지 않는다', () => {
    // Given 어느 경로도 지나지 않는 방 (탐험가의 폐허)
    const room = EXPLORER_RUIN;
    expect(WHALE_ROOMS).not.toContain(room);
    expect([HUNTER_FIRST, ...HUNTER_CANDIDATES]).not.toContain(room);
    const at = anySpot(room);

    // 지나가는 동안과 다 지나간 뒤를 **같은 세계 같은 자리 같은 철**에서 견준다
    // (밤과 견주면 밤이 자르는 것(C015)이 섞이므로 낮 안에서만 잰다)
    const w = whaleWorld(room, at);
    const route = whaleRoute();
    const started = routeStateOf(w, route).startedAt!;
    runToNode(w, route, 1, 5);
    expect(isPassing(w, route)).toBe(true);
    const phase = w.observe().clock.dayPhase;
    const during = factsOf(w);
    // 그 지나감이 끝날 때까지만 굴린다 — **같은 낮 안에서** 견주기 위해서다
    // (밤으로 넘어가면 밤이 자르는 것(C015)이 섞여 지나가는 것의 몫을 가릴 수 없다)
    runTo(w, started + WHALE_PASS_SECONDS + 5, 5);
    expect(isPassing(w, route)).toBe(false);
    expect({ season: seasonOf(w), phase: w.observe().clock.dayPhase }).toEqual({
      season: SEEP,
      phase,
    });
    // Then 깊이 · 위험 · 소란 · 원천 · 출구가 한 값도 다르지 않다
    expect(during).toEqual(factsOf(w));
    // And 그 방에는 지나는 것이 실리지 않는다
    expect(seenPresences(w)).toEqual([]);
  });

  it('S-072 시간표가 아닌 때에는 경로가 지나는 방도 한 값도 달라지지 않는다', () => {
    // Given 고래가 지나는 방, 시간표가 아닌 때 (스밈의 밤 · 아무도 지나지 않는다)
    const room = WHALE_ROOMS[0]!;
    const at = anySpot(room);
    const quiet = inSeason('SEEP:NIGHT', room, at);
    expect(passingRoutes(quiet)).toEqual([]);
    const before = factsOf(quiet);
    // When 그 때에 한참 둔다
    wait(quiet, 60, 5);
    // Then 한 값도 달라지지 않았다 — 소란도 위험도 원천도 그대로다
    expect(factsOf(quiet)).toEqual(before);
    expect(seenPresences(quiet)).toEqual([]);
  });

  it('S-073 (경계 ②) 미로의 압력과 패턴은 어느 경로에도 건드려지지 않는다', () => {
    // Given 고래가 지나는 동안 미로에 선 몸
    const t = terrainOf(FANTASY_MAZE);
    const cells = gridSpots(FANTASY_MAZE).filter(
      (p) =>
        isTraversableAt(t, p.x, p.z) &&
        tagsAt(t, p.x, p.z, PASSAGE_LAYER).length === 0 &&
        tagsAt(t, p.x, p.z, CELL_LAYER).length > 0,
    );
    const from = cells[0]!;
    const to = maxBy(cells, (p) => distanceBetween(p, from));
    const w = whaleWorld(FANTASY_MAZE, from);
    expect(isPassing(w, whaleRoute())).toBe(true);
    const first = shapeOf(w)[FANTASY_MAZE]!.rule!.pattern;
    expect(shapeOf(w)[FANTASY_MAZE]!.rule!.pressure).toBe(0);

    // When 걷는다 — 압력이 오르고 임계에서 재배열이 일어난다 (C008 그대로)
    walkUntil(w, [to, from], () => shapeOf(w)[FANTASY_MAZE]!.rule!.pattern !== first);
    // Then 패턴은 **걸음**이 굴렸고 압력은 0 으로 돌아갔다
    expect(shapeOf(w)[FANTASY_MAZE]!.rule!.pattern).not.toBe(first);
    expect(shapeOf(w)[FANTASY_MAZE]!.rule!.pressure).toBe(0);
    // And 지나가는 것은 미로에 아무 값도 남기지 않았다
    expect(heldValue(w, FANTASY_MAZE) ?? 0).toBe(0);
    expect(seenPresences(w)).toEqual([]);
  });

  it.todo(
    'GAP: SPEC-007 경계 ①(경로 데이터를 지우면 세계가 C017 과 한 값도 다르지 않다 · 코드에 어떤 경로의 이름도 어떤 방의 이름도 없다)을 이 하네스로 세울 수 없다 — content/regions 의 경로 데이터는 모듈 상수이고 WorldSetup 에 그것을 비우는 손잡이가 없다. 여기서는 "지나지 않는 방과 지나지 않는 때는 그대로다"(S-071 · S-072)까지만 잰다',
  );
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-008 땅은 다시 만들어지지 않고, 세계에 하나이고, 껐다 켜도 이어진다', () => {
  it('S-081 지나는 동안 높이 · 표면 · 통행 격자 · hash 가 그대로다', () => {
    const room = WHALE_ROOMS[0]!;
    // Given 컴파일 결과를 미리 재 둔다 (지나가는 것과 무관한 값이다)
    const before = compileRegion(spaceOf(room), COMPILE_RULES).world;
    const w = whaleWorld(room);
    expect(isPassing(w, whaleRoute())).toBe(true);
    wait(w, 20, 5);
    // Then 같은 데이터가 같은 땅을 낸다 — 격자도 hash 도 한 값도 다르지 않다
    const after = compileRegion(spaceOf(room), COMPILE_RULES).world;
    expect({ cols: after.cols, rows: after.rows, resolution: after.resolution }).toEqual({
      cols: before.cols,
      rows: before.rows,
      resolution: before.resolution,
    });
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(w.observe().region.hash).toBe(descriptionHash(spaceOf(room)));
  });

  it('S-082 관찰자 둘이 같은 것을 지나는 것으로 본다', () => {
    const room = WHALE_ROOMS[0]!;
    const spot = anySpot(room);
    const w = staged(
      [
        { observer: OBSERVER, region: room, at: spot },
        { observer: OBSERVER_2, region: room, at: { x: spot.x, z: spot.z + 2 } },
      ],
      { clock: SEEP },
    );
    runToNode(w, whaleRoute(), 0, 5);
    // Then 둘의 「지나는 것」이 한 값도 다르지 않다
    expect(seenPresences(w, OBSERVER).length).toBeGreaterThan(0);
    expect(seenPresences(w, OBSERVER_2)).toEqual(seenPresences(w, OBSERVER));
    // And 방의 사실도 같다
    expect(w.observe(OBSERVER_2).region.hash).toBe(w.observe(OBSERVER).region.hash);
    expect(seenDisturbance(w, OBSERVER_2)).toEqual(seenDisturbance(w, OBSERVER));
  });

  it('S-083 저장하고 되살린 세계가 지나가던 것을 이어 간다 — 처음부터 다시 지나가지 않는다', () => {
    // Given 둘째 마디를 지나고 있는 세계
    const w = whaleWorld(WHALE_ROOMS[1]!);
    const route = whaleRoute();
    runToNode(w, route, 1, 5);
    const before = JSON.stringify(presencesOf(w));
    expect(nodeIndexOf(w, route)).toBe(1);

    // When 파일을 지나 저장하고 되살린다
    const revived = revive(w);
    // Then 시작한 시각도 바퀴도 고른 방들도 그대로 이어진다
    expect(JSON.stringify(presencesOf(revived))).toBe(before);
    expect(nodeIndexOf(revived, route)).toBe(1);
    expect(seenCodes(revived)).toContain(SKY_WHALE);

    // And 되살린 세계에서 그 지나감이 이어져 끝난다 (다시 처음부터 지나가지 않는다)
    wait(revived, WHALE_PASS_SECONDS, 5);
    expect(passesOf(revived, route)).toBe(1);
    expect(isPassing(revived, route)).toBe(false);
  });

  it('S-084 (경계) STATE_VERSION 이 올랐으므로 옛 스냅샷은 복구되지 않는다', () => {
    expect(STATE_VERSION).toBe(RAISED_STATE_VERSION);
    const w = standingIn(START_REGION_ID);
    const snapshot = throughFile(w.world.snapshot());
    expect(snapshot.version).toBe(RAISED_STATE_VERSION);
    expect(restoreWorld(snapshot)).not.toBeNull();
    expect(restoreWorld({ ...snapshot, version: OLD_STATE_VERSION })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 도구를 밖에서 돌린다 — 검사 보고와 방 하나의 보고는 관찰 계약이 아니라
// 도구가 데이터에서 직접 읽는 것이다 (tools/world-editor/tests 의 선례 그대로).
describe('SPEC-009 검사 넷이 선다', () => {
  const ADDED_MARKS = ['㉓', '㉔', '㉕', '㉖'] as const;
  const plain = runTool(CHECK, []);
  const report = (): CheckReport => JSON.parse(plain.out) as CheckReport;
  const numbered = (): CheckItem[] => report().items.filter((i) => i.mark !== '·');
  const itemAt = (mark: string): CheckItem => {
    const found = numbered().find((i) => i.mark === mark);
    if (!found) throw new Error(`보고에 검사 ${mark} 가 없다`);
    return found;
  };

  it('S-091 검사 넷이 재료 계통 뒤에 번호 순으로 이어 붙는다', () => {
    const marks = numbered().map((i) => i.mark);
    // 재료 계통의 끝은 ㉒ 가 아니라 그 뒤에 는 ㊾(캘 횟수)다 — 한 계약의 항목은 함께 선다
    const at = marks.indexOf('㊾');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(marks.slice(at + 1, at + 1 + ADDED_MARKS.length)).toEqual([...ADDED_MARKS]);
  });

  it('S-092 (경계 ③) 넷이 저마다 답을 내고 끊긴 참조가 하나도 없다', () => {
    for (const mark of ADDED_MARKS) {
      const item = itemAt(mark);
      expect({ mark, status: item.status }).toEqual({
        mark,
        // ㉕ 는 판정하지 않는 요약이다 (spec SPEC-009 · R9 의 어법 그대로)
        status: mark === '㉕' ? 'report' : 'pass',
      });
      // 기계가 잡을 것이 다 있다 (check.spec 의 그 형)
      expect(item).toMatchObject({
        id: expect.any(String),
        answer: expect.any(String),
        refs: expect.any(Array),
      });
    }
  });

  it('S-093 ㉕ 는 판정하지 않는다 — 철별 요약이고 종료 코드를 흔들지 않는다', () => {
    expect(itemAt('㉕').status).toBe('report');
    // 판정에 드는 것은 pass/fail 뿐이다 — report 가 ok 를 흔들지 않는다
    expect(report().ok).toBe(report().counts.fail === 0);
  });

  it('S-094 (경계 ①) 종료 코드가 판정이다 — 이 세계는 fail 없이 0 을 적는다', () => {
    expect({ ok: report().ok, status: plain.status }).toEqual({
      ok: report().ok,
      status: report().ok ? 0 : 1,
    });
    // 그리고 지금 세계는 통과한다 — 그래야 검사가 뜻을 갖는다 (check.spec 의 그 규율)
    expect({ fail: report().counts.fail, ok: report().ok }).toEqual({ fail: 0, ok: true });
    // 두 번 돌려도 글자까지 같다 (읽기 전용 관찰)
    expect(runTool(CHECK, []).out).toBe(plain.out);
  });

  it.todo(
    'GAP: SPEC-009 경계 ①의 뒷면(끊긴 참조를 실제로 만들면 fail 이고 종료 코드가 1 이다)과 경계 ②(기반이 게임 명사를 알지 못하고 도구가 계약으로 건넨다)는 이 파일이 잴 수 없다 — 앞의 것은 데이터를 훼손해야 하고(tools/world-editor/tests/check.spec.ts 가 손으로 지은 데이터로 재는 자리다) 뒤의 것은 tools/ 안의 짜임이라 밖에서 보이지 않는다. 그 둘은 도구 쪽 시나리오의 몫이다 (담당 경계상 새 도구 테스트 파일을 만들지 않았다)',
  );
});

describe('SPEC-010 방 하나를 그 시각의 위상으로 읽는다', () => {
  const room = FOREST_EDGE;
  const plain = runTool(OBSERVE, [room, '--report']);
  const at = runTool(OBSERVE, [room, '--at', SEEP]);
  const textOf = (r: { out: string; err: string }) => `${r.out}${r.err}`;
  /** 보고가 읊는 hash — 어느 hash 를 고르는지는 도구의 몫이라 글자만 집는다 (c007 의 어법) */
  const hashIn = (text: string): string | undefined => /hash\s+(\S+)/.exec(text)?.[1];

  it('S-0101 그 시각의 덧씌움 · 그때 열리는 문 · 그때 서는 원천을 보고에 적는다', () => {
    expect({ status: at.status, err: at.err.slice(0, 200) }).toMatchObject({ status: 0 });
    const out = textOf(at);
    // 그 방과 그 철을 적고
    expect(out).toContain(room);
    expect(out).toContain(SEEP);
    // 그 철에 무엇이 서는지를 적는다 — 원천 이름과 문 이름이 그 보고에 있다
    for (const source of sourcesInRegion(room)) expect(out).toContain(source.id);
    // 그리고 그 철의 덧씌움이 걸린 자락의 이름이 적힌다 (데이터가 밝힌 것)
    const overlay = (
      regionSpec(room)?.phases as unknown as
        | { seasons?: Record<string, { depthOverlay?: { areaId: string }[] }> }
        | undefined
    )?.seasons?.[SEEP]?.depthOverlay?.[0];
    if (overlay) expect(out).toContain(overlay.areaId);
  });

  it('S-0102 (경계 ①) --at 은 보고에 **더할** 뿐이다 — 있던 줄을 한 글자도 고치지 않는다', () => {
    expect(plain.status).toBe(0);
    // 지금까지의 보고가 그 순서 그대로 --at 보고 안에 있다 (더하기만 했다는 것이 이 검사다)
    const lines = textOf(at).split('\n');
    let cursor = 0;
    for (const line of textOf(plain).split('\n')) {
      const found = lines.indexOf(line, cursor);
      expect({ line, kept: found >= 0 }).toEqual({ line, kept: true });
      cursor = found + 1;
    }
    // 그리고 --at 은 없던 줄을 더한다 (그 시각의 위상이 그것이다)
    expect(lines.length).toBeGreaterThan(textOf(plain).split('\n').length);
  });

  it('S-0103 (경계 ③) 컴파일 결과는 --at 에 한 값도 달라지지 않는다', () => {
    const before = hashIn(textOf(plain));
    expect(before, '보고가 hash 를 읊지 않는다').toBeDefined();
    expect(hashIn(textOf(at))).toBe(before);
    // 격자도 그대로다 — 컴파일러는 시각을 모른다
    const grid = (text: string) => text.split('\n').find((l) => l.includes('격자'));
    expect(grid(textOf(at))).toBe(grid(textOf(plain)));
  });

  it('S-0104 (경계 ②) 모르는 철 이름은 무엇이 없는지 밝히고 멈춘다', () => {
    const bad = runTool(OBSERVE, [room, '--at', 'NO_SUCH_SEASON']);
    // 조용히 지금으로 읽지 않는다 — 멈추고 그 이름을 적는다
    expect(bad.status).not.toBe(0);
    expect(textOf(bad)).toContain('NO_SUCH_SEASON');
  });

  it('S-0105 (경계 ④) 세계를 바꾸지 않는 읽기 전용이다 — 두 번 돌려도 글자까지 같다', () => {
    expect(runTool(OBSERVE, [room, '--at', SEEP]).out).toBe(at.out);
    expect(runTool(OBSERVE, [room, '--report']).out).toBe(plain.out);
    // 그리고 그 방의 데이터도 그대로다 (읽고 나서 hash 가 달라지지 않는다)
    expect(hashIn(textOf(runTool(OBSERVE, [room, '--at', SEEP])))).toBe(hashIn(textOf(at)));
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('회귀', () => {
  it('R-001 (C015) 시계가 그대로다 — 낮과 밤이 갈리고 철이 순서대로 돈다', () => {
    const w = driveWorld(solo);
    expect(w.observe().clock).toMatchObject({ dayPhase: 'DAY', season: STILL, seasonCycle: 0 });
    runToSeason(w, SEEP);
    expect(seasonOf(w)).toBe(SEEP);
    runToSeason(w, LONG_NIGHT);
    expect(w.observe().clock).toMatchObject({ dayPhase: 'NIGHT', season: LONG_NIGHT });
    runToSeason(w, TURN);
    expect(seasonOf(w)).toBe(TURN);
  });

  it('R-002 (C016) 철의 덧씌움이 그대로다 — 지나가는 것이 그것을 흔들지 않는다', () => {
    // 철의 덧씌움을 밝힌 방과 그 철을 데이터에서 읽는다 (c016 · c017 의 어법 그대로)
    interface OverlayShape {
      areaId: string;
      depth?: string;
    }
    const phases = (region: string) =>
      regionSpec(region)?.phases as unknown as
        | { seasons?: Record<string, { depthOverlay?: OverlayShape[] }> }
        | undefined;
    const room = REGION_SPECS.map((s) => s.id).find((id) => phases(id)?.seasons);
    if (!room) throw new Error('철별 덧씌움을 밝힌 방이 데이터에 없다 (C016 이 세운 것)');
    const season = Object.keys(phases(room)!.seasons!)[0] as SeasonId;
    const overlay = phases(room)!.seasons![season]!.depthOverlay?.[0];
    if (!overlay) throw new Error(`${room} 이 철의 깊이 덧씌움을 밝히지 않았다`);
    const op = spaceOf(room).ops.find((o) => o.id === overlay.areaId);
    if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${overlay.areaId}' 가 없다`);
    const t = terrainOf(room);
    const inside = walkableSpots(room).filter((p) =>
      tagsAt(t, p.x, p.z, DEPTH_LAYER).includes(op.tag),
    );
    expect(inside.length).toBeGreaterThan(0);
    const spot = inside[0]!;
    // Then 그 철에는 한 단계 깊고, 다른 철에는 방의 깊이 그대로다
    expect(depthSeen(inSeason(season, room, spot))).toBe(overlay.depth);
    const other = ([STILL, SEEP, LONG_NIGHT] as SeasonId[]).find((s) => s !== season)!;
    expect(depthSeen(inSeason(other, room, spot))).toBe(regionSpec(room)!.depth);
  });

  it('R-003 (C016) 뒤척임이 원천을 처음 상태로 되돌리고 다음 마디로 옮긴다', () => {
    const room = REGION_SPECS.map((s) => s.id).find(
      (id) => (regionSpec(id)?.phases as unknown as { onTurn?: unknown } | undefined)?.onTurn,
    );
    if (!room) throw new Error('뒤척임을 밝힌 방이 데이터에 없다 (C016 이 세운 것)');
    const migrating = (
      regionSpec(room)!.phases as unknown as { onTurn: { migrateSources?: string[] } }
    ).onTurn.migrateSources?.[0];
    if (!migrating) throw new Error(`${room} 이 옮길 원천을 밝히지 않았다`);
    const base = standingIn(room, undefined, { actorItems: { pickaxe: 9 } });
    const at = sourceAt(base, room, migrating);
    const w = moveBody(base, room, besideSpot(at), bodyOf(base));
    // Given 한 번 캔 원천
    expect(mineOnce(w, migrating).status).toBe('success');
    const before = storedOf(w, room, migrating);
    expect(before.taken).toBe(1);
    const site = before.siteIndex ?? 0;
    // When 뒤척임을 지난다
    runToSeason(w, TURN);
    // Then 캔 횟수가 처음 상태이고 마디가 옮겨 갔다
    const after = storedOf(w, room, migrating);
    expect(after.taken).toBe(0);
    expect(after.siteIndex ?? 0).not.toBe(site);
  });

  it('R-004 (C017) 채취가 그 방의 소란을 올린다 — 지나가는 것이 그 자리를 흐리지 않는다', () => {
    // 어느 경로도 지나지 않는 방에서 잰다 (지나는 것이 올리는 값과 섞이지 않게)
    const room = EXPLORER_RUIN;
    const source = plainSourceIn(room);
    const base = inSeason(SEEP, room, undefined, { actorItems: { pickaxe: 3 } });
    const at = sourceAt(base, room, source);
    const w = moveBody(base, room, besideSpot(at), bodyOf(base));
    expect(seenValue(w)).toBe(0);
    expect(mineOnce(w, source).status).toBe('success');
    expect(seenValue(w)).toBe(DISTURBANCE_PER_HARVEST);
    expect(seenDisturbance(w).threshold).toBe(DISTURBANCE_THRESHOLD);
  });

  it('R-005 (C017) 걸음이 땅에 자국을 남긴다', () => {
    const run = straightRun(EXPLORER_RUIN);
    const w = inSeason(SEEP, EXPLORER_RUIN, run.from);
    expect(w.observe().tracks).toEqual([]);
    walkTo(w, run.to);
    expect(w.observe().tracks.length).toBeGreaterThan(0);
    for (const track of w.observe().tracks) {
      expect(Object.keys(track).sort()).toEqual(['at', 'heading', 'since'].sort());
    }
  });

  it('R-006 (C011 ~ C014) 캐는 것이 그대로 산다 — 곡괭이를 들고 원천 곁에 서면 캘 수 있다', () => {
    const source = plainSourceIn(LEFTOVER_ROOM);
    const base = inSeason(SEEP, LEFTOVER_ROOM, undefined, { actorItems: { pickaxe: 1 } });
    const at = sourceAt(base, LEFTOVER_ROOM, source);
    const w = moveBody(base, LEFTOVER_ROOM, besideSpot(at), bodyOf(base));
    expect(mine(w, source)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
  });

  it('R-007 (C010) 관찰자 둘이 같은 세계를 본다 — 지나가는 것이 그 사실을 흐리지 않는다', () => {
    const room = WHALE_ROOMS[0]!;
    const spot = anySpot(room);
    const w = staged(
      [
        { observer: OBSERVER, region: room, at: spot },
        { observer: OBSERVER_2, region: room, at: { x: spot.x, z: spot.z + 2 } },
      ],
      { clock: SEEP },
    );
    const others = (observerId: string) =>
      w.observe(observerId).entities.filter((e) => e.role === 'other-player-character').length;
    expect(others(OBSERVER)).toBeGreaterThan(0);
    expect(others(OBSERVER_2)).toBeGreaterThan(0);
    expect(w.observe(OBSERVER_2).region.id).toBe(w.observe(OBSERVER).region.id);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('하네스 결손', () => {
  it.todo(
    'GAP: 관찰자가 **하나도 없는** 세계를 세울 손잡이가 없다 — driveWorld 가 관찰자 하나를 들여보낸 뒤 시작한다(drive.ts 의 규율). 그래서 SPEC-001 경계 ④는 "그 방에 아무도 없어도 지나간다"(관찰자를 미로에 세워 둔다)로만 잰다',
  );
  it.todo(
    'GAP: 경로 데이터를 갈아 끼울 손잡이가 없다 — 후보를 셋 이상 밝힌 마디도, 마디 하나짜리 경로도 세울 수 없어 휨(SPEC-005)은 데이터가 준 후보 둘로만 잰다',
  );
  it.todo(
    'GAP: 부르기 명령의 **이름과 받는 자리**를 spec 이 적지 않는다 — 이 파일은 명령 표면에서 명령을 찾고(경로 이름을 받는 자리를 가진 것) 이름을 지목(targetEntityId)으로 건넨다. 건너기·캐기가 문과 원천의 이름을 건네던 그 자리를 따른 것이고, 세계가 다른 자리를 골랐다면 이 파일의 summon 하네스 한 곳만 고치면 된다',
  );
  it.todo(
    'GAP: 남겨지는 원천의 **이름**을 spec 이 적지 않는다 — 이 파일은 데이터의 event-scarce 후보 가운데 "지나간 뒤에 선 것" 을 이름으로 삼는다. 그래서 지나가기 전의 경계(S-062)는 후보 **전부**에 대해 재고, 어느 것이 비늘이고 어느 것이 잔해인지는 묻지 않는다',
  );
});
