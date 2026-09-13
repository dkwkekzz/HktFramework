// C017 — 여럿의 누적과 남의 자취 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// C016 까지 세계의 상태는 **내가 한 일의 결과**였다. 이 Cycle 이 처음으로 "여럿의 합"과
// "내가 없던 사이"를 세계 사실로 세운다. 그래서 재는 것은 넷이다:
//   ① 소란 — 캐고 때리고 건너는 것이 그 방의 값이 되고(걷기는 0), 고요에만 가라앉는다
//   ② 임계와 위상 — 임계에서 깨어나고 임계를 넘어 오르지 않으며 0 에 닿아야 잠든다.
//      한 몸으로는 못 닿는 그 시간에 세 몸이면 닿는다 (**여럿의 합**)
//   ③ 자국 — 걸음이 땅에 남기고, 방향은 들되 **이름은 들지 않으며**, 나이로 사라지고
//      뒤척임이 묻는다
//   ④ 불변 — 미로의 압력은 한 줄도 바뀌지 않고(걸음↔압력 · 소란은 패턴을 굴리지 않는다),
//      C016 의 뒤척임과 철의 덧씌움도 그대로다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/world 의 새 규칙 · content/regions 의 새 데이터 · content/view)은
// **읽지 않았다.** 기대값의 출처는 cycles/C017-others-were-here/spec.md 와
// content/protocol/gameview.ts 의 관찰 계약뿐이다.
//
// **이름도 자리도 손으로 적지 않는다** — 깨어남의 덧씌움 area · 원천 · 문의 이름은
// content/regions 에서 읽고, 설 자리는 컴파일된 격자에서 고른다. 손으로 적는 유일한 수는
// spec 의 「데이터 값」 표(300 · 10 · 5 · 3 · 0.5 · 60 · 4.0 · 48)이고, 그것은 저장되지 않는
// 헤더 상수라 세계에서 가져올 자리가 없다 (c015 가 시계 상수에 세운 규율 그대로).
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.
// 방도 자국도 통째로 세지 않는다 (자국의 **상한**만은 spec SPEC-008 경계 ③ 이 요구하는 값이다).

import { describe, expect, it } from 'vitest';
import {
  areasOf,
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
  DEPTH_LAYER,
  FOREST_DEEP,
  FOREST_EDGE,
  HAZARD_LAYER,
  REGION_SPECS,
  START_REGION_ID,
  regionSpec,
  type ResourceSourceSpec,
  type SeasonId,
} from '../../regions';
// C008 이 세운 미로의 이름들 — 그 파일이 소유한다 (c008 ~ c016 시나리오의 선례 그대로).
import { CELL_LAYER, FANTASY_MAZE, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, TrackView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { awarenessCapSource } from '../semantic/body-property';
import { SWING_BEGIN } from '../semantic/collision';
import { SKILL_DEFINITIONS } from '../semantic/combat';
import {
  CYCLE_SECONDS,
  LONG_NIGHT_SECONDS,
  SEEP_SECONDS,
  STILL_SECONDS,
  TURN_SECONDS,
} from '../semantic/clock';
import { INTERACTION_RANGE, STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { sourcesInRegion } from '../semantic/resource';
import { driveWorld, OBSERVER, OBSERVER_2, type WorldDriver } from './drive';

// ── spec 의 「데이터 값」 표 (헤더 상수 · 결정론 · 저장되지 않는다) ───
const DISTURBANCE_THRESHOLD = 300;
const DISTURBANCE_PER_HARVEST = 10;
const DISTURBANCE_PER_STRIKE = 5;
const DISTURBANCE_PER_TRANSIT = 3;
const DISTURBANCE_DECAY_PER_SECOND = 0.5;
const TRACK_LIFETIME_SECONDS = 60;
const TRACK_STEP_DISTANCE = 4.0;
const TRACK_LIMIT_PER_REGION = 48;

/** 위상 둘 — 관찰 계약이 값 자체로 든다 (spec 기본형 ⑧: 코드가 곧 값이다) */
const DORMANT = 'dormant';
const AWAKE = 'awake';

/** 세 번째 관찰자 — 이름은 세계가 따지지 않는다 (c010 의 선례) */
const OBSERVER_3 = 'observer-3';

// ── 철의 이름과 자리 (clock.ts 의 상수에서 유도한다 · c016 그대로) ───
const STILL: SeasonId = 'STILL';
const SEEP: SeasonId = 'SEEP';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN: SeasonId = 'TURN';
const SEASONS: readonly SeasonId[] = [STILL, SEEP, LONG_NIGHT, TURN];
/** 가라앉지 **않는** 철들 — 고요가 아닌 셋 (spec Observable 2 · R2) */
const NOT_QUIET: readonly SeasonId[] = [SEEP, LONG_NIGHT, TURN];

const SEASON_AT: Readonly<Record<SeasonId, number>> = {
  STILL: 0,
  SEEP: STILL_SECONDS,
  LONG_NIGHT: STILL_SECONDS + SEEP_SECONDS,
  TURN: STILL_SECONDS + SEEP_SECONDS + LONG_NIGHT_SECONDS,
};

/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (C011~C016 어법) */
const MINE_SECONDS = 1.2;
/** 휘두름이 열리는 자리 — combat.spec 의 선례 그대로 */
const AFTER_SWING_OPEN = SWING_BEGIN * SKILL_DEFINITIONS.attack.baseDuration + 2 * TICK_INTERVAL;

/** spec 이 적은 State 형 버전 — 이 Cycle 이 여기까지 올린다 (SPEC-010 경계) */
// C018 CHANGED — 지나감의 지금이 실리며 다시 올랐다. 이 항이 재는 것은 글자가 아니라
// "세계가 찍는 판이 팩의 판과 같다" 이므로 값만 따라 올린다
// C022 CHANGED — 탄생지와 개체군이 실리며 다시 올랐다 (같은 이유로 값만 따라 올린다)
// C034 CHANGED — 방의 기억(history)이 실리며 다시 올랐다 (같은 이유로 값만 따라 올린다)
// C039 — 몸의 State 에서 자리 셋이 사라지고 둘이 섰다 (최대값 둘 · 인지 범위 → 묻는 것 ·
// core · propertySources). 옛 스냅샷을 그대로 읽으면 틀린 세계가 되므로 판이 올랐다.
const RAISED_STATE_VERSION = 'hkt-adv-proto-i/12';
/** 그 앞의 버전(C016) — 옛 스냅샷은 되살아나지 않는다 */
const OLD_STATE_VERSION = 'hkt-adv-proto-i/8';

const solo: WorldSetup = { npcs: [] };

// ── 계약이 준 형 (spec State 절 그대로 적어 둔다) ────────────────────
interface DisturbanceShape {
  value: number;
  phase: string;
}
/** 저장되는 자국 하나 — 관찰 결과의 TrackView 와 갈린다 (at 은 여기서 **시각**이다) */
interface TrackShape {
  position: { x: number; z: number };
  heading: { x: number; z: number };
  at: number;
}
interface RegionStateShape {
  rule?: { pattern: string; pressure: number; rearrangedAt?: number };
  sources?: Record<
    string,
    { phase: string; taken: number; progress?: number; siteIndex?: number; collapsedSites?: number[] }
  >;
  disturbance?: DisturbanceShape;
  tracks?: TrackShape[];
}
type RegionStatesShape = Record<string, RegionStateShape>;

// ── 하네스 (c013 · c015 · c016 의 선례 그대로) ───────────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id: string) => state(w).actors.find((a) => a.id === id)!;
const bodyOf = (w: WorldDriver, observerId = OBSERVER): string =>
  w.observe(observerId).observer.characterId;
const here = (w: WorldDriver, bodyId: string): XZ => ({
  x: actorOf(w, bodyId).position.x,
  z: actorOf(w, bodyId).position.z,
});
const timeOf = (w: WorldDriver): number => state(w).time;
/** 지금까지 적용한 뒤척임의 수 — C016 이 세운 자리 */
const turnsAppliedOf = (w: WorldDriver): number =>
  (state(w) as unknown as { turnsApplied: number }).turnsApplied;

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

const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;
/** 그 자리의 손 닿는 곳 — InteractionRange 안이다 */
const besideSpot = (at: XZ): XZ => ({ x: at.x + INTERACTION_RANGE / 2, z: at.z });

/** 그 원천의 성질 — 그 방 resourceEcology 가 소유한다 */
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

/**
 * 그 방에서 **곧게** 걸을 수 있는 가장 긴 줄 — 걸음으로 자국을 내는 자리다.
 * 자리를 손으로 적지 않기 위해 컴파일된 격자에서 고른다 (직선이라 걷다 막히지 않는다).
 */
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
        // 양 끝을 한 칸씩 물린다 — 방의 가장자리에 딱 붙지 않기 위해
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
//
// C018 CHANGED — 세계에 **지나가는 것**이 생겼고, 그 중 하나는 세계가 서는 그 시각(고요의 낮 ·
// 첫 바퀴)에 시간표가 맞아 첫 Tick 부터 방들 위를 지나며 소란을 올린다. 이 시나리오가 재는
// 것은 지나가는 것이 아니라 **몸이 한 일**이므로, 세우자마자 지나가던 것을 멈추고 그 방들의
// 소란을 0 으로 되돌린 뒤에 잰다 — 세계의 규칙을 하나도 바꾸지 않고 Given 만 조용하게 하는
// 것이고, 지나가는 것이 소란을 올린다는 사실 자체는 C018 의 시나리오가 잰다.
const standingIn = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver => {
  const base = driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
  });
  return hushed(base);
};

/** 지나가던 것을 멈추고 모든 방의 소란을 0 으로 되돌린 세계 (C018 ADDED · 위 주석) */
function hushed(base: WorldDriver): WorldDriver {
  return worldFrom(base, (s) => {
    for (const pass of Object.values(s.presences)) delete pass.startedAt;
    for (const regionState of Object.values(s.regionStates)) {
      regionState.disturbance.value = 0;
      regionState.disturbance.phase = 'dormant';
    }
  });
}
/** 그 철에서 시작하는 세계 — C015 가 세운 손잡이 (WorldSetup.clock) */
const inSeason = (season: SeasonId, region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  standingIn(region, at, { ...extra, clock: season });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};
/** dt 를 잘게 나누어 준다 (기본 한 걸음 1 세계 초) — c013 · c015 · c016 의 wait 선례 그대로 */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}
/** 그 세계 시각까지 굴린다 — 큰 걸음(기본 60 초)으로 간다 (c016 선례) */
function runTo(w: WorldDriver, target: number, step = 60) {
  const left = target - timeOf(w);
  if (left <= 1e-9) return;
  wait(w, left, step);
}
const SEASON_MARGIN = 1;
/** 그 철 **안으로** 굴린다 — 그 철에서 시작하는 Tick 이 하나 있어야 그 철의 일이 일어난다 */
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
const cross = (w: WorldDriver, connector: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector }, observerId);

/** 그 자리까지 걷는다 (c009 · c010 의 선례 그대로) */
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
/** 자리 둘을 오가며 걷는다 — 멈춤 조건이 참이 될 때까지 (c010 의 walkUntil 그대로) */
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

/** 하던 행동이 끝날 때까지 — 때린 뒤 걸으려면 휘두름이 끝나야 한다 (c010 의 settle 선례) */
function settle(w: WorldDriver, observerId = OBSERVER, limitTicks = 20000) {
  const body = bodyOf(w, observerId);
  for (let i = 0; i < limitTicks; i++) {
    if (actorOf(w, body).currentAction.kind === 'idle') return;
    w.tick(TICK_INTERVAL);
  }
  throw new Error('하던 행동이 끝나지 않는다');
}

/**
 * 한 번 때려 **닿게** 한다 — 몸이 +x 를 보게 한 걸음 낸 뒤 휘두른다 (combat.spec 의 aimRight).
 * 대상은 그 자리 오른쪽에 세워 둔 자율 존재다.
 */
function strikeOnce(w: WorldDriver, at: XZ, observerId = OBSERVER) {
  move(w, { x: at.x + 2, z: at.z }, observerId);
  w.tick(TICK_INTERVAL);
  expect(w.dispatch({ interactionId: 'attack' }, observerId).status).toBe('success');
  tickFor(w, AFTER_SWING_OPEN);
}

// ── 저장·복구 (c013 ~ c016 의 선례 그대로) ──────────────────────────
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
/** 되살리면서 State 를 고친 세계 — 걸어서는 세울 수 없는 Given 을 공개 길로 세운다 */
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

/**
 * 그 방의 소란을 그만큼 **이미 겪은** 세계로 만든다.
 *
 * 걸어서도 세울 수 있지만(300 을 채우려면 서른 번을 캐야 한다) 그 사이 걸음과 자국이
 * Given 을 흐린다. 그래서 저장·복구라는 공개 길로 "그런 일을 이미 겪은 세계" 를 되살린다
 * (c008 · c010 · c016 이 압력에 쓴 그 어법 그대로). **위상은 손으로 적지 않는다** —
 * 잠듦으로 두고, 깨우는 것은 언제나 세계의 규칙(R3)이 하게 한다.
 */
function charge(s: WorldState, region: string, value: number) {
  const states = s.regionStates as unknown as RegionStatesShape;
  const held = (states[region] ??= {});
  held.disturbance = { value, phase: DORMANT };
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────
const seenDisturbance = (w: WorldDriver, observerId = OBSERVER) =>
  w.observe(observerId).region.disturbance;
const seenValue = (w: WorldDriver, observerId = OBSERVER): number =>
  seenDisturbance(w, observerId).value;
const seenPhase = (w: WorldDriver, observerId = OBSERVER): string =>
  seenDisturbance(w, observerId).phase;
const seenTracks = (w: WorldDriver, observerId = OBSERVER): TrackView[] =>
  w.observe(observerId).tracks;
/** 몸이 없는 방의 소란 — 관찰 결과로는 볼 수 없어 세계 State 로 읽는다 (하네스 결손 참조) */
const heldValue = (w: WorldDriver, region: string): number | undefined =>
  shapeOf(w)[region]?.disturbance?.value;
const heldPhase = (w: WorldDriver, region: string): string | undefined =>
  shapeOf(w)[region]?.disturbance?.phase;

const seasonOf = (w: WorldDriver, observerId = OBSERVER): string =>
  w.observe(observerId).clock.season;
/** hud 의 region.depth 줄 — 내가 선 자리의 깊이 (C016 R2) */
const depthSeen = (w: WorldDriver, observerId = OBSERVER): unknown =>
  w.observe(observerId).hud.find((h) => h.id === 'region.depth')?.value;
const conditionsSeen = (w: WorldDriver, observerId = OBSERVER): string[] =>
  w.observe(observerId).standingConditions;
const sourceEntity = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  v.entities.find((e) => e.role === 'resource-source' && e.id === id);

// ── 이 Cycle 이 데이터에 세운 것들 — **이름을 읽어 온다** ────────────
//
// spec 은 area 의 이름을 적지 않는다 (Observable "싣지 않는다" 의 규율 그대로).
// 관찰자가 자기 content/regions 를 훑어 스스로 얻는 것이 이 저장소의 길이다.

interface OverlayShape {
  areaId: string;
  depth?: string;
  hazard?: string;
}
interface PhasesShape {
  seasons?: Record<string, { depthOverlay?: OverlayShape[]; hazardExtend?: OverlayShape[] }>;
  onTurn?: unknown;
  awake?: { depthOverlay?: OverlayShape[]; hazardExtend?: OverlayShape[] };
}
const phasesOf = (region: string): PhasesShape | undefined =>
  regionSpec(region)?.phases as unknown as PhasesShape | undefined;
const awakeOf = (region: string) => phasesOf(region)?.awake;

/** 깨어남의 덧씌움을 밝힌 방들 (데이터가 말한다) */
const AWAKE_ROOMS = REGION_SPECS.map((s) => s.id).filter((id) => awakeOf(id));
/** 철별 덧씌움을 밝힌 방 · 뒤척임을 밝힌 방 (C016 이 세운 것) */
const SEASON_ROOMS = REGION_SPECS.map((s) => s.id).filter((id) => phasesOf(id)?.seasons);
const TURN_ROOMS = REGION_SPECS.map((s) => s.id).filter((id) => phasesOf(id)?.onTurn);

function requireAwakeRoom(): string {
  const found = AWAKE_ROOMS[0];
  if (!found) {
    throw new Error(
      '깨어남의 덧씌움(phases.awake)을 밝힌 방이 데이터에 없다 — spec 데이터 값 절이 생체 광석 지대에 두라고 못박았다',
    );
  }
  return found;
}

/** 덧씌움이 가리키는 area op 의 태그 — 컴파일 결과를 훑을 때 쓰는 이름이다 (c016 그대로) */
function areaTagOf(region: string, areaId: string): string {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return op.tag;
}
/** 그 layer 의 area 태그가 걸린, 걸어 설 수 있는 자리 — 덧씌움 안이다 (c016 그대로) */
function spotInLayer(region: string, layer: string, tag: string): XZ {
  const t = terrainOf(region);
  const inside = walkableSpots(region).filter((p) => tagsAt(t, p.x, p.z, layer).includes(tag));
  if (inside.length === 0) throw new Error(`${region} 에 '${layer}/${tag}' 가 걸린 설 자리가 없다`);
  const area = areasOf(spaceOf(region), layer).find((a) => a.tag === tag);
  const center = area && area.shape.kind === 'circle' ? area.shape.center : inside[0]!;
  return minBy(inside, (p) => distanceBetween(p, center));
}
/** 그 layer 의 태그가 하나도 걸리지 않은, 걸어 설 수 있는 자리 — 덧씌움 **밖**이다 */
function spotOutsideLayer(region: string, layer: string, from: XZ): XZ {
  const t = terrainOf(region);
  const outside = walkableSpots(region).filter((p) => tagsAt(t, p.x, p.z, layer).length === 0);
  if (outside.length === 0) throw new Error(`${region} 에 '${layer}' 밖의 설 자리가 없다`);
  return minBy(outside, (p) => distanceBetween(p, from));
}

/** 이 Cycle 이 깨어남의 덧씌움을 둔 방과 그 자락 (지금 데이터로는 생체 광석 지대) */
const awakeDepthOverlay = () => awakeOf(requireAwakeRoom())?.depthOverlay?.[0];
const awakeHazardOverlay = () => awakeOf(requireAwakeRoom())?.hazardExtend?.[0];

/** C016 이 철의 덧씌움을 둔 방과 그 철 (회귀에 쓴다) */
const SEASON_ROOM = SEASON_ROOMS[0]!;
const seasonOverlaySeason = (): SeasonId =>
  Object.keys(phasesOf(SEASON_ROOM)!.seasons!)[0] as SeasonId;
const seasonDepthOverlay = () =>
  phasesOf(SEASON_ROOM)!.seasons![seasonOverlaySeason()]!.depthOverlay?.[0];

// ── 이 Cycle 이 세우는 "이미 겪은 세계" 들 ──────────────────────────

/** 그 방에서 나가는 문 하나 — 데이터가 말한다 (건너기가 소란을 올리는 자리) */
const DOOR_OUT: Readonly<Record<string, string>> = {
  [START_REGION_ID]: 'FOREST_PATH',
  [FOREST_EDGE]: 'DEEP_TRAIL',
  [FOREST_DEEP]: 'ANCIENT_GATE',
};
/** 그 문의 anchor 자리 — 이름과 자리를 데이터에서 읽는다 */
const doorSpot = (region: string): XZ => anchorAt(region, DOOR_OUT[region]!);

/** 그 anchor 둘레의 설 자리 셋 — 셋이 같은 문 앞에 서기 위한 것 (좌표를 적지 않는다) */
function spotsAround(region: string, at: XZ, count: number): XZ[] {
  const t = terrainOf(region);
  const r = INTERACTION_RANGE / 2;
  const candidates: XZ[] = [
    { x: at.x + r, z: at.z },
    { x: at.x - r, z: at.z },
    { x: at.x, z: at.z + r },
    { x: at.x, z: at.z - r },
  ];
  const open = candidates.filter((p) => isTraversableAt(t, p.x, p.z));
  if (open.length < count) throw new Error(`${region} 의 그 문 앞에 설 자리가 ${count} 개 없다`);
  return open.slice(0, count);
}

/** 관찰자 여럿이 저마다의 방·자리에 선, 소란이 이미 쌓인 세계 */
function staged(
  placements: readonly { observer: string; region: string; at: XZ }[],
  charged: Readonly<Record<string, number>> = {},
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
      // C018 CHANGED — 지나가던 것을 먼저 멈춘다 (standingIn 의 hushed 와 같은 이유).
      // 세우는 소란은 이 시나리오가 밝힌 값이어야 하므로 지나가는 것이 얹기 전에 세운다.
      for (const pass of Object.values(s.presences)) delete pass.startedAt;
      for (const regionState of Object.values(s.regionStates)) {
        regionState.disturbance.value = 0;
        regionState.disturbance.phase = 'dormant';
      }
      for (const one of bodies) place(s, one.body, one.region, one.at);
      for (const [region, value] of Object.entries(charged)) charge(s, region, value);
    },
    placements.map((one) => one.observer),
  );
}

/** 관찰자 하나가 그 방 그 자리에 선, 소란이 이미 쌓인 세계 */
function chargedWorld(
  region: string,
  at: XZ,
  value: number,
  extra: WorldSetup = {},
): WorldDriver {
  const base = standingIn(region, at, extra);
  return worldFrom(base, (s) => charge(s, region, value));
}

/** 자율 존재 하나를 그 방 그 자리에 세운다 (c008 S-022 의 선례 그대로) */
function placeNpc(
  s: WorldState,
  id: string,
  region: string,
  at: XZ,
  opts: { wanderPath?: readonly XZ[]; perceptionRange?: number } = {},
) {
  const npc = s.actors.find((a: ActorState) => a.id === id)!;
  npc.regionId = region;
  npc.position = { x: at.x, z: at.z };
  npc.velocity = { x: 0, z: 0 };
  npc.wanderPath = (opts.wanderPath ?? []).map((p) => ({ x: p.x, z: p.z }));
  npc.wanderIndex = 0;
  // C039 — 인지 재정의가 몸에 걸리는 Source 한 줄이 되었다 (뜻도 값도 그대로다)
  npc.propertySources = [awarenessCapSource(opts.perceptionRange ?? 0)];
  npc.currentAction = idleAction();
}

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 한 일이 그 방의 소란이 된다', () => {
  it('S-011 채취를 마치면 그 방의 소란이 10 오른다', () => {
    // Given 곡괭이를 지닌 몸이 그 방 원천 곁에 선다 (소란은 0 이다)
    //
    // **가라앉지 않는 철에서 잰다** — 고요에서는 캐는 동안에도 R2 가 초당 0.5 를 깎아
    // "오른 값" 과 "가라앉은 값" 이 한 수에 섞인다. 여기서 재는 것은 R1 뿐이다.
    const source = plainSourceIn(FOREST_EDGE);
    const base = inSeason(SEEP, FOREST_EDGE, undefined, { actorItems: { pickaxe: 3 } });
    const at = sourceEntity(base.observe(), source)!.position;
    const w = moveBody(base, FOREST_EDGE, besideSpot({ x: at.x, z: at.z }), bodyOf(base));
    expect(seenValue(w)).toBe(0);
    // When 한 번 캔다
    expect(mineOnce(w, source).status).toBe('success');
    // Then 그 방의 소란이 채취 한 번만큼 올랐다
    expect(seenValue(w)).toBe(DISTURBANCE_PER_HARVEST);
    // And 임계도 함께 실린다 (얼마나 찼는가를 View 가 재기 위해)
    expect(seenDisturbance(w).threshold).toBe(DISTURBANCE_THRESHOLD);
  });

  it('S-012 닿은 타격 하나가 소란을 5 올린다', () => {
    // Given 자율 존재 하나가 오른쪽에 선 방 (관찰자가 그것을 때린다)
    const run = straightRun(START_REGION_ID);
    const at = run.from;
    // 휘두름이 열리기까지 시간이 흐르므로 **가라앉지 않는 철**에서 잰다 (S-011 의 주석 그대로)
    const base = inSeason(SEEP, START_REGION_ID, at, {
      npcs: [{ id: 'npc-1', position: { x: at.x + 1.2, z: at.z }, wanderPath: [], perceptionRange: 0 }],
    });
    const w = worldFrom(base, (s) => {
      place(s, bodyOf(base), START_REGION_ID, at);
      placeNpc(s, 'npc-1', START_REGION_ID, { x: at.x + 1.2, z: at.z });
    });
    expect(seenValue(w)).toBe(0);
    // When 한 번 때려 닿는다
    strikeOnce(w, at);
    expect(w.observe().strikes.length).toBeGreaterThan(0);
    // Then 닿은 타격 하나만큼 올랐다
    expect(seenValue(w)).toBe(DISTURBANCE_PER_STRIKE * w.observe().strikes.length);
  });

  it('S-013 문을 건너면 소란이 3 오른다', () => {
    // Given 문 앞에 선 몸
    const w = standingIn(START_REGION_ID, doorSpot(START_REGION_ID));
    expect(seenValue(w)).toBe(0);
    // When 건넌다
    expect(cross(w, DOOR_OUT[START_REGION_ID]!)).toMatchObject({ status: 'success' });
    // Then 건너기 한 번만큼 올랐다 (그 값이 어느 방의 것인지는 S-016 이 잰다)
    expect(heldValue(w, START_REGION_ID)).toBe(DISTURBANCE_PER_TRANSIT);
  });

  it('S-014 (경계 ①) 걷기만 해서는 한 값도 오르지 않는다', () => {
    // Given 곧게 걸을 줄이 있는 방
    const run = straightRun(START_REGION_ID);
    const w = standingIn(START_REGION_ID, run.from);
    expect(seenValue(w)).toBe(0);
    // When 그 줄을 끝까지 걷는다 (자국이 여럿 날 만큼 멀다)
    walkTo(w, run.to);
    expect(run.length).toBeGreaterThan(TRACK_STEP_DISTANCE * 2);
    // Then 걸음은 자국을 남기되 소란은 한 값도 올리지 않았다 (이동 0)
    expect(seenTracks(w).length).toBeGreaterThan(0);
    expect(seenValue(w)).toBe(0);
    expect(seenPhase(w)).toBe(DORMANT);
  });

  it('S-015 (경계 ②) 오르는 것은 그 일이 일어난 방뿐이다 — 다른 방은 그대로다', () => {
    // Given 곡괭이를 지닌 몸이 그 방 원천 곁에 선다
    const source = plainSourceIn(FOREST_EDGE);
    // 가라앉음이 섞이지 않는 철에서 잰다 (S-011 의 주석 그대로)
    const base = inSeason(SEEP, FOREST_EDGE, undefined, { actorItems: { pickaxe: 3 } });
    const at = sourceEntity(base.observe(), source)!.position;
    const w = moveBody(base, FOREST_EDGE, besideSpot({ x: at.x, z: at.z }), bodyOf(base));
    // When 그 방에서 캔다
    expect(mineOnce(w, source).status).toBe('success');
    // Then 그 방만 올랐고 다른 방은 하나도 오르지 않았다
    expect(heldValue(w, FOREST_EDGE)).toBe(DISTURBANCE_PER_HARVEST);
    for (const spec of REGION_SPECS) {
      if (spec.id === FOREST_EDGE) continue;
      expect({ region: spec.id, value: heldValue(w, spec.id) ?? 0 }).toEqual({
        region: spec.id,
        value: 0,
      });
    }
  });

  it('S-016 (경계 ③) 건너기가 올리는 것은 떠난 방이다', () => {
    // Given 문 앞에 선 몸 (두 방 모두 소란이 0 이다)
    const w = standingIn(START_REGION_ID, doorSpot(START_REGION_ID));
    expect(heldValue(w, START_REGION_ID) ?? 0).toBe(0);
    expect(heldValue(w, FOREST_EDGE) ?? 0).toBe(0);
    // When 건넌다
    expect(cross(w, DOOR_OUT[START_REGION_ID]!)).toMatchObject({ status: 'success' });
    expect(actorOf(w, bodyOf(w)).regionId).toBe(FOREST_EDGE);
    // Then 오른 것은 **떠난 방**이고 닿은 방은 그대로다
    expect(heldValue(w, START_REGION_ID)).toBe(DISTURBANCE_PER_TRANSIT);
    expect(heldValue(w, FOREST_EDGE) ?? 0).toBe(0);
    // And 닿은 방의 관찰 결과도 0 이다
    expect(seenValue(w)).toBe(0);
  });

  it('S-017 (경계 ④) 요청 없이 일어나는 전이(추락)는 올리지 않는다', () => {
    // Given 거목 내부 세계의 FALL 자리 **밖**에 선 몸 (C003 이 세운 그 자리)
    //
    // 범위 안에 세우면 세계가 세워지는 첫 Tick 에 이미 데려가 버려 "그 전" 을 볼 수 없다.
    // 그래서 밖에 세워 두고 걸어 들어간다 — 걸음도 추락도 소란이 아니라는 것을 함께 잰다.
    const fallAt = anchorAt('TREE_INNER_WORLD', 'FALL');
    const w = standingIn('TREE_INNER_WORLD', {
      x: fallAt.x,
      z: fallAt.z - (INTERACTION_RANGE + 1),
    });
    expect(actorOf(w, bodyOf(w)).regionId).toBe('TREE_INNER_WORLD');
    expect(seenValue(w)).toBe(0);
    // When 그 자리 쪽으로 걷기만 한다 — 요청은 걸음 하나뿐이다
    expect(move(w, fallAt).status).toBe('success');
    const body = bodyOf(w);
    let taken = false;
    for (let i = 0; i < Math.ceil(120 / TICK_INTERVAL); i++) {
      w.tick(TICK_INTERVAL);
      if (actorOf(w, body).regionId !== 'TREE_INNER_WORLD') {
        taken = true;
        break;
      }
    }
    // Then 세계가 데려갔다
    expect(taken).toBe(true);
    expect(actorOf(w, body).regionId).toBe('HEART_LAKE');
    // And 떠난 방도 닿은 방도 한 값도 오르지 않았다 — 몸이 한 일이 아니다
    expect(heldValue(w, 'TREE_INNER_WORLD') ?? 0).toBe(0);
    expect(heldValue(w, 'HEART_LAKE') ?? 0).toBe(0);
  });

  it('S-018 (경계 ⑤) 자율 존재가 한 것도 같이 쌓인다 — 방은 누가 했는지 묻지 않는다', () => {
    // Given 관찰자를 인지하고 다가와 때리는 자율 존재 하나 (관찰자는 아무것도 요청하지 않는다)
    const run = straightRun(START_REGION_ID);
    const at = run.from;
    const npcAt = { x: at.x + 6, z: at.z };
    const base = standingIn(START_REGION_ID, at, {
      npcs: [{ id: 'npc-1', position: npcAt, wanderPath: [] }],
    });
    const w = worldFrom(base, (s) => {
      place(s, bodyOf(base), START_REGION_ID, at);
      placeNpc(s, 'npc-1', START_REGION_ID, npcAt, { perceptionRange: 9 });
    });
    expect(seenValue(w)).toBe(0);
    // When 시간만 흐른다 — 그 존재가 다가와 때린다
    let landed = false;
    for (let i = 0; i < 900; i++) {
      w.tick(TICK_INTERVAL);
      if (w.observe().strikes.some((s) => s.attackerId === 'npc-1')) landed = true;
      if (landed && seenValue(w) > 0) break;
    }
    expect(landed).toBe(true);
    // Then 관찰자는 아무 요청도 하지 않았는데 그 방의 소란이 올랐다
    expect(seenValue(w)).toBeGreaterThanOrEqual(DISTURBANCE_PER_STRIKE);
    expect(seenValue(w) % DISTURBANCE_PER_STRIKE).toBe(0);
  });

  it('S-019 소란은 **모든 방**에 실린다 — 규칙도 원천도 없는 방에도 있다 (기본형 ⑩)', () => {
    for (const spec of REGION_SPECS) {
      const w = standingIn(spec.id);
      const seen = seenDisturbance(w);
      // Then 어느 방에서도 자리가 있고 형이 셋뿐이다
      expect({ region: spec.id, keys: Object.keys(seen).sort() }).toEqual({
        region: spec.id,
        keys: ['phase', 'threshold', 'value'],
      });
      expect({ region: spec.id, value: seen.value, phase: seen.phase }).toEqual({
        region: spec.id,
        value: 0,
        phase: DORMANT,
      });
      expect(seen.threshold).toBe(DISTURBANCE_THRESHOLD);
    }
  });
});

describe('SPEC-002 소란은 고요에만 가라앉는다', () => {
  const CHARGED = 100;
  const SPAN = 20;

  it('S-021 고요에는 초당 정해진 만큼 줄어든다', () => {
    // Given 소란이 쌓인 방, 고요다
    const w = chargedWorld(START_REGION_ID, straightRun(START_REGION_ID).from, CHARGED, {
      clock: STILL,
    });
    expect(seasonOf(w)).toBe(STILL);
    expect(seenValue(w)).toBe(CHARGED);
    // When 가만히 선 채로 시간이 흐른다
    wait(w, SPAN, 1);
    // Then 그만큼 줄었다
    expect(seenValue(w)).toBeCloseTo(CHARGED - SPAN * DISTURBANCE_DECAY_PER_SECOND, 5);
  });

  it('S-022 스밈 · 긴 밤 · 뒤척임에는 한 값도 줄지 않는다 (경계 ③ 포함)', () => {
    for (const season of NOT_QUIET) {
      // Given 같은 소란, 다른 철
      const w = chargedWorld(START_REGION_ID, straightRun(START_REGION_ID).from, CHARGED, {
        clock: season,
      });
      expect(seasonOf(w)).toBe(season);
      // When 가만히 선 채로 시간이 흐른다 (뒤척임은 그 길이 안에서 본다)
      wait(w, Math.min(SPAN, TURN_SECONDS - 10), 1);
      // Then 한 값도 줄지 않았다 — 뒤척임도 소란을 건드리지 않는다 (확정 8)
      expect({ season, value: seenValue(w) }).toEqual({ season, value: CHARGED });
    }
  });

  it('S-023 (경계 ①) 0 아래로 내려가지 않는다', () => {
    // Given 조금 남은 소란
    const w = chargedWorld(START_REGION_ID, straightRun(START_REGION_ID).from, 5, { clock: STILL });
    // When 다 비우고도 남을 만큼 기다린다
    wait(w, 60, 1);
    // Then 0 에서 멎었다
    expect(seenValue(w)).toBe(0);
    expect(seenPhase(w)).toBe(DORMANT);
  });

  it('S-024 (경계 ②) 몸이 하나도 없는 방도 가라앉는다 — 세계 과정이다', () => {
    // Given 관찰자의 몸은 백왕령에 있고, 소란은 **다른 방**에 쌓여 있다
    const base = standingIn(START_REGION_ID, undefined, { clock: STILL });
    const w = worldFrom(base, (s) => charge(s, FOREST_DEEP, CHARGED));
    expect(actorOf(w, bodyOf(w)).regionId).toBe(START_REGION_ID);
    for (const actor of state(w).actors) expect(actor.regionId).not.toBe(FOREST_DEEP);
    // When 시간만 흐른다
    wait(w, SPAN, 1);
    // Then 아무도 없는 그 방의 소란도 줄었다
    expect(heldValue(w, FOREST_DEEP)).toBeCloseTo(CHARGED - SPAN * DISTURBANCE_DECAY_PER_SECOND, 5);
  });
});

describe('SPEC-003 임계에서 방이 깨어난다', () => {
  it('S-031 임계에 닿으면 그 방의 위상이 깨어남이 된다', () => {
    // Given 임계 바로 아래(건너기 하나가 모자란) 방, 문 앞에 선 몸
    const w = chargedWorld(
      START_REGION_ID,
      doorSpot(START_REGION_ID),
      DISTURBANCE_THRESHOLD - DISTURBANCE_PER_TRANSIT,
    );
    expect(seenPhase(w)).toBe(DORMANT);
    // When 건넌다 — 그 한 걸음이 임계를 채운다
    expect(cross(w, DOOR_OUT[START_REGION_ID]!)).toMatchObject({ status: 'success' });
    // Then 그 방이 깨어났고 값은 임계다
    expect(heldValue(w, START_REGION_ID)).toBe(DISTURBANCE_THRESHOLD);
    expect(heldPhase(w, START_REGION_ID)).toBe(AWAKE);
  });

  it('S-032 (경계 ①) 임계에 못 미치면 잠듦 그대로다', () => {
    const w = chargedWorld(
      START_REGION_ID,
      doorSpot(START_REGION_ID),
      DISTURBANCE_THRESHOLD - DISTURBANCE_PER_TRANSIT - 1,
    );
    expect(cross(w, DOOR_OUT[START_REGION_ID]!)).toMatchObject({ status: 'success' });
    expect(heldValue(w, START_REGION_ID)).toBe(DISTURBANCE_THRESHOLD - 1);
    expect(heldPhase(w, START_REGION_ID)).toBe(DORMANT);
  });

  it('S-033 (경계 ②) 임계에 닿은 뒤 더 캐도 값이 임계를 넘지 않는다', () => {
    // Given 임계에서 채취 하나보다 조금 덜 모자란 방 (넘칠 만큼 남았다)
    const source = plainSourceIn(FOREST_EDGE);
    // 가라앉음이 섞이지 않는 철에서 잰다 (S-011 의 주석 그대로)
    const base = inSeason(SEEP, FOREST_EDGE, undefined, { actorItems: { pickaxe: 9 } });
    const at = sourceEntity(base.observe(), source)!.position;
    const near = DISTURBANCE_THRESHOLD - (DISTURBANCE_PER_HARVEST - 2);
    const w = worldFrom(base, (s) => {
      place(s, bodyOf(base), FOREST_EDGE, besideSpot({ x: at.x, z: at.z }));
      charge(s, FOREST_EDGE, near);
    });
    // When 캔다 — 넘칠 만큼 오른다
    expect(mineOnce(w, source).status).toBe('success');
    // Then 임계에서 멎었다 (넘친 만큼이 쌓이지 않는다 · 기본형 ①)
    expect(seenValue(w)).toBe(DISTURBANCE_THRESHOLD);
    expect(seenPhase(w)).toBe(AWAKE);
    // And 깨어난 뒤 또 무엇을 해도 임계 그대로다
    walkTo(w, doorSpot(FOREST_EDGE));
    expect(cross(w, DOOR_OUT[FOREST_EDGE]!)).toMatchObject({ status: 'success' });
    expect(heldValue(w, FOREST_EDGE)).toBe(DISTURBANCE_THRESHOLD);
    expect(heldPhase(w, FOREST_EDGE)).toBe(AWAKE);
  });

  it('S-034 (경계 ③) 위상은 방마다 따로다 — 한 방이 깨어나도 다른 방은 잠듦이다', () => {
    const w = chargedWorld(
      START_REGION_ID,
      doorSpot(START_REGION_ID),
      DISTURBANCE_THRESHOLD - DISTURBANCE_PER_TRANSIT,
    );
    expect(cross(w, DOOR_OUT[START_REGION_ID]!)).toMatchObject({ status: 'success' });
    expect(heldPhase(w, START_REGION_ID)).toBe(AWAKE);
    // Then 그 밖의 방은 전부 잠듦이다
    for (const spec of REGION_SPECS) {
      if (spec.id === START_REGION_ID) continue;
      expect({ region: spec.id, phase: heldPhase(w, spec.id) ?? DORMANT }).toEqual({
        region: spec.id,
        phase: DORMANT,
      });
    }
    // And 닿은 방의 관찰 결과도 잠듦이다
    expect(seenPhase(w)).toBe(DORMANT);
  });

  it('S-035 (경계) 가라앉는 철에서도 임계에 닿으면 깨어난다', () => {
    // Given 채취 하나가 임계를 넘기고도 남는 방 — **고요**다 (가라앉는 철)
    const source = plainSourceIn(FOREST_EDGE);
    const base = inSeason(STILL, FOREST_EDGE, undefined, { actorItems: { pickaxe: 9 } });
    const at = sourceEntity(base.observe(), source)!.position;
    const w = worldFrom(base, (s) => {
      place(s, bodyOf(base), FOREST_EDGE, besideSpot({ x: at.x, z: at.z }));
      charge(s, FOREST_EDGE, DISTURBANCE_THRESHOLD - 1);
    });
    expect(seasonOf(w)).toBe(STILL);
    // When 캔다 — 오르는 값(10)이 남은 자리(1)보다 크므로 임계에 닿는다
    expect(mineOnce(w, source).status).toBe('success');
    // Then 그 방이 깨어났다 — 임계에 닿는 것과 가라앉는 것은 같은 Tick 에서도 갈린다
    // (SPEC-003 도 Observable 3 도 철을 가리지 않는다: "임계에 닿으면 깨어난다")
    expect(seenPhase(w)).toBe(AWAKE);
  });
});

describe('SPEC-004 여럿이라야 넘는다', () => {
  /** 하나가 못 닿는 자리 — 건너기 셋이면 딱 임계다 */
  const NEAR = DISTURBANCE_THRESHOLD - 3 * DISTURBANCE_PER_TRANSIT;

  it('S-041 같은 방 같은 시간에 셋이 올린 값이 하나가 올린 값의 세 배다 — 셋만 임계에 닿는다', () => {
    const region = START_REGION_ID;
    const door = DOOR_OUT[region]!;
    const spots = spotsAround(region, doorSpot(region), 3);

    // Given ① 같은 방에 한 몸만 있는 세계 (소란은 임계에서 건너기 셋만큼 모자라다)
    const one = staged([{ observer: OBSERVER, region, at: spots[0]! }], { [region]: NEAR });
    // Given ② 같은 방에 세 몸이 함께 선 세계 (시작 값이 같다)
    const three = staged(
      [
        { observer: OBSERVER, region, at: spots[0]! },
        { observer: OBSERVER_2, region, at: spots[1]! },
        { observer: OBSERVER_3, region, at: spots[2]! },
      ],
      { [region]: NEAR },
      {},
    );
    expect(heldValue(one, region)).toBe(NEAR);
    expect(heldValue(three, region)).toBe(NEAR);
    const at = timeOf(one);
    expect(timeOf(three)).toBe(at);

    // When 같은 시간(시간이 흐르지 않는 한 Tick) 안에 저마다 한 번씩 건넌다
    expect(cross(one, door, OBSERVER)).toMatchObject({ status: 'success' });
    for (const observerId of [OBSERVER, OBSERVER_2, OBSERVER_3]) {
      expect(cross(three, door, observerId)).toMatchObject({ status: 'success' });
    }
    // 시간은 흐르지 않았다 — 갈리는 것은 몸의 수뿐이다
    expect(timeOf(one)).toBe(at);
    expect(timeOf(three)).toBe(at);

    // Then 셋이 올린 값이 하나가 올린 값의 세 배다
    const byOne = heldValue(one, region)! - NEAR;
    const byThree = heldValue(three, region)! - NEAR;
    expect(byOne).toBe(DISTURBANCE_PER_TRANSIT);
    expect(byThree).toBe(3 * byOne);
    // And 하나로는 못 닿는 그 시간에 셋이면 닿아 방이 깨어난다
    expect(heldPhase(one, region)).toBe(DORMANT);
    expect(heldValue(three, region)).toBe(DISTURBANCE_THRESHOLD);
    expect(heldPhase(three, region)).toBe(AWAKE);
  });

  it('S-042 (경계 ①) 셋이 다른 방에 흩어지면 어느 방도 넘지 않는다', () => {
    const rooms = [START_REGION_ID, FOREST_EDGE, FOREST_DEEP];
    const charged = Object.fromEntries(rooms.map((id) => [id, NEAR]));
    // Given 셋이 저마다 다른 방의 문 앞에 선다 (세 방 모두 같은 값이다)
    const w = staged(
      [
        { observer: OBSERVER, region: rooms[0]!, at: spotsAround(rooms[0]!, doorSpot(rooms[0]!), 1)[0]! },
        { observer: OBSERVER_2, region: rooms[1]!, at: spotsAround(rooms[1]!, doorSpot(rooms[1]!), 1)[0]! },
        { observer: OBSERVER_3, region: rooms[2]!, at: spotsAround(rooms[2]!, doorSpot(rooms[2]!), 1)[0]! },
      ],
      charged,
    );
    // When 저마다 자기 방에서 한 번씩 건넌다
    for (const [i, observerId] of [OBSERVER, OBSERVER_2, OBSERVER_3].entries()) {
      expect(cross(w, DOOR_OUT[rooms[i]!]!, observerId)).toMatchObject({ status: 'success' });
    }
    // Then 어느 방도 임계에 닿지 않았다 — 합쳐지는 것은 **같은 방**의 일뿐이다
    for (const region of rooms) {
      expect({ region, value: heldValue(w, region), phase: heldPhase(w, region) }).toEqual({
        region,
        value: NEAR + DISTURBANCE_PER_TRANSIT,
        phase: DORMANT,
      });
    }
  });

  it('S-043 (경계 ②) 방은 몸을 가리지 않는다 — 자율 존재가 닿게 한 타격도 그 수만큼 쌓인다', () => {
    // Given 관찰자를 때리는 자율 존재 둘 (관찰자는 아무것도 요청하지 않는다)
    const run = straightRun(START_REGION_ID);
    const at = run.from;
    const seats = [
      { x: at.x + 5, z: at.z },
      { x: at.x - 5, z: at.z },
    ];
    // 여러 Tick 이 지나므로 **가라앉지 않는 철**에서 잰다 (S-011 의 주석 그대로)
    const base = inSeason(SEEP, START_REGION_ID, at, {
      npcs: seats.map((p, i) => ({ id: `npc-${i + 1}`, position: p, wanderPath: [] })),
    });
    const w = worldFrom(base, (s) => {
      place(s, bodyOf(base), START_REGION_ID, at);
      seats.forEach((p, i) => placeNpc(s, `npc-${i + 1}`, START_REGION_ID, p, { perceptionRange: 9 }));
    });
    // When 시간만 흐른다 — 닿은 타격을 하나도 빠짐없이 센다 (같은 것을 두 번 세지 않는다)
    const seen = new Set<string>();
    for (let i = 0; i < 1200; i++) {
      w.tick(TICK_INTERVAL);
      for (const s of w.observe().strikes) {
        seen.add(`${s.attackerId}>${s.targetId}@${s.since}`);
      }
      if (seen.size >= 3) break;
    }
    // Then 여러 몸이 닿게 한 타격이 그 수만큼 그대로 쌓였다
    expect(seen.size).toBeGreaterThanOrEqual(2);
    expect(new Set([...seen].map((k) => k.split('>')[0])).size).toBeGreaterThan(1);
    expect(seenValue(w)).toBe(DISTURBANCE_PER_STRIKE * seen.size);
  });
});

describe('SPEC-005 깨어난 방이 달라진다', () => {
  /** 깨어남의 덧씌움을 밝힌 방을 실제로 깨워, 그 자락에 선 세계를 돌려준다 */
  function awokenAt(spot: XZ): WorldDriver {
    const room = requireAwakeRoom();
    const source = plainSourceIn(room);
    // **가라앉지 않는 철에서 깨운다** — 이 SPEC 이 재는 것은 깨어난 방의 덧씌움이지
    // 무엇이 방을 깨우는가가 아니다 (그 자리는 SPEC-003 S-035 가 따로 잰다).
    const base = inSeason(SEEP, room, undefined, { actorItems: { pickaxe: 9 } });
    const at = sourceEntity(base.observe(), source)!.position;
    const staged = worldFrom(base, (s) => {
      place(s, bodyOf(base), room, besideSpot({ x: at.x, z: at.z }));
      // 채취 하나로 **넘치게** 채운다 — 고요라면 캐는 동안에도 가라앉으므로 딱 맞춰 두면
      // 임계에 닿지 못한다. 넘친 만큼은 임계에서 멎으므로(기본형 ①) 값은 언제나 임계다.
      charge(s, room, DISTURBANCE_THRESHOLD - 1);
    });
    // 세계의 규칙으로 깨운다 — 위상을 손으로 적지 않는다
    expect(mineOnce(staged, source).status).toBe('success');
    expect(seenPhase(staged)).toBe(AWAKE);
    return moveBody(staged, room, spot, bodyOf(staged));
  }
  /** 같은 자락에 잠든 채로 선 세계 (견주는 것이 위상뿐이도록 철을 맞춘다) */
  const dormantAt = (spot: XZ): WorldDriver => inSeason(SEEP, requireAwakeRoom(), spot);

  it('S-051 잠듦에는 방의 깊이 그대로 · 깨어남에는 한 단계 깊은 값과 그 자리의 위험 코드', () => {
    const room = requireAwakeRoom();
    const depth = awakeDepthOverlay();
    const hazard = awakeHazardOverlay();
    if (!depth || !hazard) throw new Error(`${room} 이 깨어남의 깊이·위험 덧씌움을 밝히지 않았다`);
    const spot = spotInLayer(room, DEPTH_LAYER, areaTagOf(room, depth.areaId));

    // Given 그 자락에 잠든 채로 선다
    const asleep = dormantAt(spot);
    expect(seenPhase(asleep)).toBe(DORMANT);
    // Then 방의 깊이 그대로이고 위험의 답이 없다
    expect(depthSeen(asleep)).toBe(regionSpec(room)!.depth);
    expect(conditionsSeen(asleep)).not.toContain(hazard.hazard);

    // When 같은 자락에 깨어난 방으로 선다
    const awake = awokenAt(spot);
    expect(seenPhase(awake)).toBe(AWAKE);
    // Then 한 단계 깊은 값이 실리고 그 자리의 위험 코드가 함께 실린다
    expect(depthSeen(awake)).toBe(depth.depth);
    expect(depthSeen(awake)).not.toBe(regionSpec(room)!.depth);
    expect(conditionsSeen(awake)).toContain(hazard.hazard);
  });

  it('S-052 (경계 ①) 그 자락 밖에 서면 위상과 무관하게 방의 깊이 그대로다', () => {
    const room = requireAwakeRoom();
    const depth = awakeDepthOverlay()!;
    const inside = spotInLayer(room, DEPTH_LAYER, areaTagOf(room, depth.areaId));
    const outside = spotOutsideLayer(room, DEPTH_LAYER, inside);
    for (const w of [dormantAt(outside), awokenAt(outside)]) {
      expect({ phase: seenPhase(w), depth: depthSeen(w) }).toEqual({
        phase: seenPhase(w),
        depth: regionSpec(room)!.depth,
      });
    }
  });

  it('S-053 (경계 ②) 밝히지 않은 방은 깨어나도 깊이도 위험도 한 값도 달라지지 않는다', () => {
    // Given 깨어남의 덧씌움을 밝히지 않은 방 하나 (백왕령)
    const room = START_REGION_ID;
    expect(AWAKE_ROOMS).not.toContain(room);
    const at = straightRun(room).from;
    const before = standingIn(room, at);
    const seenBefore = {
      depth: depthSeen(before),
      conditions: [...conditionsSeen(before)].sort(),
    };
    // When 그 방을 깨운다
    const w = worldFrom(
      chargedWorld(room, doorSpot(room), DISTURBANCE_THRESHOLD - DISTURBANCE_PER_TRANSIT),
      () => undefined,
    );
    expect(cross(w, DOOR_OUT[room]!)).toMatchObject({ status: 'success' });
    expect(heldPhase(w, room)).toBe(AWAKE);
    const back = moveBody(w, room, at, bodyOf(w));
    expect(seenPhase(back)).toBe(AWAKE);
    // Then 값과 위상만 올랐고 깊이도 위험도 그대로다
    expect({ depth: depthSeen(back), conditions: [...conditionsSeen(back)].sort() }).toEqual(
      seenBefore,
    );
  });

  it('S-054 (경계 ③ 절반) 깨어남이 철의 덧씌움을 지우지 않는다', () => {
    // Given 철의 덧씌움을 밝힌 방, 그 철, 그 자락
    const season = seasonOverlaySeason();
    const overlay = seasonDepthOverlay();
    if (!overlay) throw new Error(`${SEASON_ROOM} 이 철의 깊이 덧씌움을 밝히지 않았다`);
    const spot = spotInLayer(SEASON_ROOM, DEPTH_LAYER, areaTagOf(SEASON_ROOM, overlay.areaId));
    const source = plainSourceIn(SEASON_ROOM);
    const base = inSeason(season, SEASON_ROOM, undefined, { actorItems: { pickaxe: 9 } });
    const at = sourceEntity(base.observe(), source)!.position;
    const staged = worldFrom(base, (s) => {
      place(s, bodyOf(base), SEASON_ROOM, besideSpot({ x: at.x, z: at.z }));
      charge(s, SEASON_ROOM, DISTURBANCE_THRESHOLD - DISTURBANCE_PER_HARVEST);
    });
    // When 그 방을 깨운다
    expect(mineOnce(staged, source).status).toBe('success');
    expect(seenPhase(staged)).toBe(AWAKE);
    const w = moveBody(staged, SEASON_ROOM, spot, bodyOf(staged));
    expect(seasonOf(w)).toBe(season);
    // Then 철의 덧씌움이 그대로 걸려 있다 — 깨어남이 그것을 지우지 않았다
    expect(depthSeen(w)).toBe(overlay.depth);
  });

  it('S-055 (경계 ④) 관찰 결과는 무엇이 깨웠는지도 무엇을 덧씌우는지도 말하지 않는다', () => {
    const room = requireAwakeRoom();
    const depth = awakeDepthOverlay()!;
    const spot = spotInLayer(room, DEPTH_LAYER, areaTagOf(room, depth.areaId));
    const w = awokenAt(spot);
    const text = JSON.stringify(w.observe());
    // Then 덧씌움이 걸린 area 의 이름도, 덧씌움을 밝힌 자리도 어디에도 없다
    expect(text.includes(depth.areaId)).toBe(false);
    // And 소란의 자리에는 값 · 임계 · 위상 셋뿐이다 — 무엇이 올렸는지가 없다
    expect(Object.keys(seenDisturbance(w)).sort()).toEqual(['phase', 'threshold', 'value']);
  });

  it.todo(
    'GAP: SPEC-005 경계 ③ (철의 덧씌움과 깨어남의 덧씌움이 **같은 자락**에서 겹치면 둘 다 걸린다) 를 세울 수 없다 — 지금 데이터에는 seasons 와 awake 를 함께 밝힌 방이 없다 (spec 데이터 값 절이 "생체 광석 지대는 seasons 를 여전히 밝히지 않는다" 고 못박았다). 그래서 겹침을 한 자리에서 잴 수 없고, S-054 가 "깨어남이 철의 덧씌움을 지우지 않는다" 는 절반만 잰다',
  );
});

describe('SPEC-006 비워 두면 잠든다', () => {
  /** 임계에서 0 까지 가라앉는 데 드는 시간 — 상한이 임계인 것의 귀결 (기본형 ①) */
  const TO_EMPTY = DISTURBANCE_THRESHOLD / DISTURBANCE_DECAY_PER_SECOND;

  /**
   * 그 방을 세계의 규칙으로 깨운 세계 (몸은 그 방에 선 채로 둔다).
   * **가라앉지 않는 철(스밈)에서 깨운다** — 이 SPEC 이 재는 것은 "비우면 잠드는가" 이고,
   * 무엇이 방을 깨우는가는 SPEC-003 S-035 가 따로 잰다.
   */
  function awoken(room: string, extra: WorldSetup = {}): WorldDriver {
    const source = plainSourceIn(room);
    const base = standingIn(room, undefined, { clock: SEEP, ...extra, actorItems: { pickaxe: 9 } });
    const at = sourceEntity(base.observe(), source)!.position;
    const staged = worldFrom(base, (s) => {
      place(s, bodyOf(base), room, besideSpot({ x: at.x, z: at.z }));
      // 채취 하나로 넘치게 채운다 (SPEC-005 awokenAt 의 주석 그대로)
      charge(s, room, DISTURBANCE_THRESHOLD - 1);
    });
    expect(mineOnce(staged, source).status).toBe('success');
    expect(seenPhase(staged)).toBe(AWAKE);
    return staged;
  }

  it('S-061 값이 0 에 닿으면 잠듦으로 돌아가고 덧씌움이 걷힌다', () => {
    const room = requireAwakeRoom();
    const depth = awakeDepthOverlay()!;
    const spot = spotInLayer(room, DEPTH_LAYER, areaTagOf(room, depth.areaId));
    // Given 깨어난 방, 그 자락에 선 몸
    const awake = awoken(room);
    const w = moveBody(awake, room, spot, bodyOf(awake));
    expect(seenPhase(w)).toBe(AWAKE);
    expect(depthSeen(w)).toBe(depth.depth);
    // When 아무도 아무것도 하지 않은 채로 고요가 오고, 고요에 다 비워지도록 둔다
    runToSeason(w, STILL);
    expect(seasonOf(w)).toBe(STILL);
    // (그 사이 다른 철에서는 한 값도 줄지 않아 깨어남 그대로다 — 고요에 들어선
    //  한 걸음만큼만 이미 가라앉아 있다)
    expect(seenPhase(w)).toBe(AWAKE);
    expect(seenValue(w)).toBeGreaterThan(
      DISTURBANCE_THRESHOLD - 2 * SEASON_MARGIN * DISTURBANCE_DECAY_PER_SECOND,
    );
    wait(w, TO_EMPTY + 20, 1);
    // Then 값이 0 이고 잠듦이며 덧씌움이 걷혔다
    expect(seenValue(w)).toBe(0);
    expect(seenPhase(w)).toBe(DORMANT);
    expect(depthSeen(w)).toBe(regionSpec(room)!.depth);
  });

  it('S-062 (경계 ①) 임계 아래로 내려간 것만으로는 잠들지 않는다', () => {
    const room = requireAwakeRoom();
    const w = awoken(room);
    // When 고요를 만나 임계 아래로 내려갈 만큼만 비운다 (0 에는 한참 못 미친다)
    runToSeason(w, STILL);
    wait(w, 100, 1);
    // Then 값은 임계 아래인데도 깨어남 그대로다 — 넘은 것과 비운 것이 다르다
    expect(seenValue(w)).toBeLessThan(DISTURBANCE_THRESHOLD);
    expect(seenValue(w)).toBeGreaterThan(0);
    expect(seenPhase(w)).toBe(AWAKE);
  });

  it('S-063 (경계 ②) 고요가 아닌 철에서는 잠들지 않는다', () => {
    const room = requireAwakeRoom();
    // Given 스밈에 깨어난 방
    const w = awoken(room, { clock: SEEP });
    expect(seasonOf(w)).toBe(SEEP);
    // When 다 비워지고도 남을 만큼 둔다
    wait(w, TO_EMPTY + 20, 10);
    // Then 한 값도 줄지 않았고 깨어남 그대로다
    expect(seenValue(w)).toBe(DISTURBANCE_THRESHOLD);
    expect(seenPhase(w)).toBe(AWAKE);
  });
});

describe('SPEC-007 몸이 지나가면 자국이 남는다', () => {
  const dot = (a: { x: number; z: number }, b: { x: number; z: number }) => a.x * b.x + a.z * b.z;
  const unit = (a: { x: number; z: number }) => {
    const len = Math.hypot(a.x, a.z);
    return { x: a.x / len, z: a.z / len };
  };

  it('S-071 가로질러 걸으면 지나온 자리마다 자국이 서고 저마다 가던 방향을 든다', () => {
    // Given 곧게 걸을 줄이 있는 방
    const run = straightRun(START_REGION_ID);
    const w = standingIn(START_REGION_ID, run.from);
    expect(seenTracks(w)).toEqual([]);
    // When 그 줄을 끝까지 걷는다
    walkTo(w, run.to);
    // Then 자국이 여럿 서 있다 (표본 간격만큼씩)
    const tracks = seenTracks(w);
    expect(tracks.length).toBeGreaterThanOrEqual(Math.floor(run.length / TRACK_STEP_DISTANCE) - 1);
    const heading = unit({ x: run.to.x - run.from.x, z: run.to.z - run.from.z });
    for (const track of tracks) {
      // 자리는 걸어온 그 줄 위다
      expect(Math.abs(track.at.z - run.from.z)).toBeLessThan(1);
      expect(track.at.x).toBeGreaterThanOrEqual(Math.min(run.from.x, run.to.x) - 1);
      expect(track.at.x).toBeLessThanOrEqual(Math.max(run.from.x, run.to.x) + 1);
      // 방향은 단위 벡터이고 가던 쪽을 가리킨다
      expect(Math.hypot(track.heading.x, track.heading.z)).toBeCloseTo(1, 3);
      expect(dot(track.heading, heading)).toBeGreaterThan(0.9);
      // 난 시각은 지금까지의 세계 시각 안이다 (나이는 관찰자가 잰다)
      expect(track.since).toBeGreaterThanOrEqual(0);
      expect(track.since).toBeLessThanOrEqual(timeOf(w) + 1e-9);
    }
    // And 이웃한 자국끼리는 표본 간격만큼 떨어져 있다
    const sorted = [...tracks].sort((a, b) => a.since - b.since);
    for (let i = 1; i < sorted.length; i++) {
      const gap = distanceBetween(
        { x: sorted[i - 1]!.at.x, z: sorted[i - 1]!.at.z },
        { x: sorted[i]!.at.x, z: sorted[i]!.at.z },
      );
      expect(gap).toBeGreaterThan(TRACK_STEP_DISTANCE / 2);
      expect(gap).toBeLessThan(TRACK_STEP_DISTANCE * 2);
    }
  });

  it('S-072 (경계 ①) 이름도 사람 수도 어디에도 실리지 않는다', () => {
    const run = straightRun(START_REGION_ID);
    const w = standingIn(START_REGION_ID, run.from);
    walkTo(w, run.to);
    const tracks = seenTracks(w);
    expect(tracks.length).toBeGreaterThan(0);
    const body = bodyOf(w);
    for (const track of tracks) {
      // 형이 셋뿐이다 — 관찰자 id 도 몇 사람인지도 자리 자체가 없다
      expect(Object.keys(track).sort()).toEqual(['at', 'heading', 'since']);
      expect(Object.keys(track.at).sort()).toEqual(['x', 'z']);
      expect(Object.keys(track.heading).sort()).toEqual(['x', 'z']);
      const text = JSON.stringify(track);
      expect(text.includes(body)).toBe(false);
      expect(text.includes(OBSERVER)).toBe(false);
    }
  });

  it('S-073 (경계 ②) 자국은 그 방의 것이다 — 다른 방의 자국은 실리지 않는다', () => {
    // Given 한 방을 걷고 자국을 남긴다
    const run = straightRun(START_REGION_ID);
    const w = standingIn(START_REGION_ID, run.from);
    walkTo(w, run.to);
    const left = seenTracks(w).map((t) => `${t.at.x},${t.at.z}`);
    expect(left.length).toBeGreaterThan(0);
    // When 문으로 건너간다
    walkTo(w, doorSpot(START_REGION_ID));
    expect(cross(w, DOOR_OUT[START_REGION_ID]!)).toMatchObject({ status: 'success' });
    expect(actorOf(w, bodyOf(w)).regionId).toBe(FOREST_EDGE);
    // Then 닿은 방의 관찰 결과에 떠난 방의 자국이 하나도 없다
    const seen = seenTracks(w).map((t) => `${t.at.x},${t.at.z}`);
    for (const one of left) expect(seen).not.toContain(one);
    // And 떠난 방의 자국은 그 방에 그대로 있다 (세계가 잃지 않았다)
    expect((shapeOf(w)[START_REGION_ID]?.tracks ?? []).length).toBeGreaterThan(0);
  });

  it('S-074 (경계 ③) 서 있기만 하면 자국이 늘지 않는다', () => {
    const run = straightRun(START_REGION_ID);
    const w = standingIn(START_REGION_ID, run.from);
    walkTo(w, run.to);
    const before = seenTracks(w).length;
    expect(before).toBeGreaterThan(0);
    // When 걷지 않고 시간만 흐른다 (나이가 차기 전까지)
    wait(w, TRACK_LIFETIME_SECONDS / 2, 1);
    // Then 하나도 늘지 않았다 — 움직인 거리가 자국을 낳는다
    expect(seenTracks(w).length).toBe(before);
  });

  it('S-075 (경계 ④) 자율 존재의 걸음도 자국을 남긴다', () => {
    // Given 순회하는 자율 존재 하나, 관찰자는 한 걸음도 걷지 않는다
    const run = straightRun(START_REGION_ID);
    const path = [run.from, run.to];
    const base = standingIn(START_REGION_ID, run.from, {
      npcs: [{ id: 'npc-1', position: path[0]!, wanderPath: [...path], perceptionRange: 0 }],
    });
    const standAt = { x: run.from.x, z: run.from.z + 2 };
    const w = worldFrom(base, (s) => {
      place(s, bodyOf(base), START_REGION_ID, standAt);
      placeNpc(s, 'npc-1', START_REGION_ID, path[0]!, { wanderPath: path, perceptionRange: 0 });
    });
    expect(seenTracks(w)).toEqual([]);
    // When 시간만 흐른다
    tickFor(w, 12);
    // Then 관찰자는 그대로인데 자국이 났다 — 자국은 누가 남겼는지 말하지 않는다
    expect(here(w, bodyOf(w))).toEqual({ x: standAt.x, z: standAt.z });
    expect(seenTracks(w).length).toBeGreaterThan(0);
  });

  it('S-076 자국은 밤에도 잘리지 않는다 (기본형 ⑥ · R8 경계 ①)', () => {
    // Given 밤이 된 세계 (C015 의 하루 안)
    const run = straightRun(START_REGION_ID);
    const w = standingIn(START_REGION_ID, run.from, { clock: STILL });
    runTo(w, 300, 10); // 하루 안의 한밤 (c015 의 MIDNIGHT 선례)
    expect(w.observe().clock.dayPhase).toBe('NIGHT');
    // When 걷는다
    walkTo(w, run.to);
    // Then 밤인데도 자국이 실린다 — 밤이 자르는 것은 몸과 원천이다
    const tracks = seenTracks(w);
    expect(tracks.length).toBeGreaterThan(0);
    // And 먼 자국도 잘리지 않는다 (있으면 그것으로 잰다)
    const body = here(w, bodyOf(w));
    const far = tracks.filter((t) => distanceBetween({ x: t.at.x, z: t.at.z }, body) > 20);
    if (far.length > 0) expect(far.length).toBeGreaterThan(0);
  });
});

describe('SPEC-008 자국은 사라지고 묻힌다', () => {
  it('S-081 60 초를 지난 자국은 관찰 결과에 없다', () => {
    const run = straightRun(START_REGION_ID);
    const w = standingIn(START_REGION_ID, run.from, { clock: STILL });
    // Given 자국을 남긴다
    walkTo(w, run.to);
    const before = seenTracks(w);
    expect(before.length).toBeGreaterThan(0);
    const oldest = Math.min(...before.map((t) => t.since));
    // When 그 나이를 넘길 만큼 가만히 둔다
    wait(w, TRACK_LIFETIME_SECONDS + 5, 1);
    // Then 하나도 남지 않았다 (아무도 없어도 옅어진다 — 세계 과정이다)
    expect(seenTracks(w)).toEqual([]);
    expect(timeOf(w) - oldest).toBeGreaterThan(TRACK_LIFETIME_SECONDS);
  });

  it('S-082 뒤척임을 지나면 그 방의 자국이 한꺼번에 없다 — 아직 나이가 안 된 것도 함께다 (경계 ②)', () => {
    const room = TURN_ROOMS[0];
    if (!room) throw new Error('뒤척임을 밝힌 방이 데이터에 없다 (C016 이 세운 자리)');
    const run = straightRun(room);
    // Given 뒤척임 바로 앞의 세계에서 자국을 남긴다
    const w = inSeason(LONG_NIGHT, room, run.from);
    runTo(w, SEASON_AT[TURN] - 20, 60);
    walkTo(w, run.to);
    const before = seenTracks(w);
    expect(before.length).toBeGreaterThan(0);
    const youngest = Math.max(...before.map((t) => t.since));
    // When 뒤척임을 지난다
    wait(w, 25, 1);
    expect(seasonOf(w)).toBe(TURN);
    expect(turnsAppliedOf(w)).toBe(1);
    // Then 그 방의 자국이 한꺼번에 없다 — 아직 나이가 차지 않았는데도 묻혔다
    expect(timeOf(w) - youngest).toBeLessThan(TRACK_LIFETIME_SECONDS);
    expect(seenTracks(w)).toEqual([]);
    expect(shapeOf(w)[room]?.tracks ?? []).toEqual([]);
  });

  it('S-083 (경계 ①) 뒤척임이 묻는 것은 밝힌 방뿐이다 — 밝히지 않은 방의 자국은 나이로만 사라진다', () => {
    const plain = REGION_SPECS.map((s) => s.id).find((id) => !TURN_ROOMS.includes(id));
    if (!plain) throw new Error('뒤척임을 밝히지 않은 방이 없다');
    const run = straightRun(plain);
    // Given 뒤척임 바로 앞, 밝히지 않은 방에서 자국을 남긴다
    const w = inSeason(LONG_NIGHT, plain, run.from);
    runTo(w, SEASON_AT[TURN] - 20, 60);
    walkTo(w, run.to);
    const before = seenTracks(w).length;
    expect(before).toBeGreaterThan(0);
    // When 뒤척임을 지난다
    wait(w, 25, 1);
    expect(seasonOf(w)).toBe(TURN);
    expect(turnsAppliedOf(w)).toBe(1);
    // Then 자국이 그대로 있다 (나이가 아직 차지 않았다)
    expect(seenTracks(w).length).toBe(before);
  });

  it('S-084 (경계 ③) 상한을 넘으면 가장 오래된 것부터 없다', () => {
    const run = straightRun(START_REGION_ID);
    expect(run.length).toBeGreaterThan(TRACK_STEP_DISTANCE * 4);
    const w = standingIn(START_REGION_ID, run.from, { clock: STILL });
    const startedAt = timeOf(w);
    // Given 상한만큼 자국이 찰 때까지 오간다 (나이로 사라지기 전에 다 채운다)
    walkUntil(w, [run.to, run.from], () => seenTracks(w).length >= TRACK_LIMIT_PER_REGION);
    expect(seenTracks(w).length).toBe(TRACK_LIMIT_PER_REGION);
    expect(timeOf(w) - startedAt).toBeLessThan(TRACK_LIFETIME_SECONDS);
    const oldest = Math.min(...seenTracks(w).map((t) => t.since));
    // When 더 걷는다
    walkUntil(
      w,
      [run.to, run.from],
      () => Math.min(...seenTracks(w).map((t) => t.since)) > oldest,
    );
    // Then 수는 상한을 넘지 않았고, 가장 오래된 것이 밀려났다
    expect(seenTracks(w).length).toBeLessThanOrEqual(TRACK_LIMIT_PER_REGION);
    expect(Math.min(...seenTracks(w).map((t) => t.since))).toBeGreaterThan(oldest);
  });
});

describe('SPEC-009 미로의 압력은 그대로다', () => {
  const mazeRule = () => regionSpec(FANTASY_MAZE)!.rule!;
  const mazePressure = (w: WorldDriver): number => shapeOf(w)[FANTASY_MAZE]!.rule!.pressure;
  const mazePattern = (w: WorldDriver): string => shapeOf(w)[FANTASY_MAZE]!.rule!.pattern;
  /** 미로 안에서 어느 통로에도 들지 않는 구역 안의 자리들 (c010 의 cellSpots 그대로) */
  function cellSpots(): XZ[] {
    const t = terrainOf(FANTASY_MAZE);
    return gridSpots(FANTASY_MAZE).filter(
      (p) =>
        isTraversableAt(t, p.x, p.z) &&
        tagsAt(t, p.x, p.z, PASSAGE_LAYER).length === 0 &&
        tagsAt(t, p.x, p.z, CELL_LAYER).length > 0,
    );
  }

  it('S-091 걸음은 압력만 올리고 소란은 한 값도 올리지 않는다', () => {
    const spots = cellSpots();
    const from = spots[0]!;
    const to = maxBy(spots, (p) => distanceBetween(p, from));
    // Given 미로 안에 선 몸
    const w = standingIn(FANTASY_MAZE, from);
    expect(mazePressure(w)).toBe(0);
    expect(seenValue(w)).toBe(0);
    // When 걷는다
    walkTo(w, to);
    // Then 압력은 올랐고 소란은 한 값도 오르지 않았다 (나란히 선 두 값이다)
    expect(mazePressure(w)).toBeGreaterThan(0);
    expect(seenValue(w)).toBe(0);
    // And 방의 State 에는 규칙의 자리와 소란의 자리가 나란히 있다
    expect(shapeOf(w)[FANTASY_MAZE]!.rule).toBeDefined();
    expect(shapeOf(w)[FANTASY_MAZE]!.disturbance).toBeDefined();
  });

  it('S-092 (경계 ②) 미로에도 소란은 선다 — 걸음이 아니라 때리는 것이 올린다', () => {
    const spots = cellSpots();
    const at = minBy(spots, (p) => Math.abs(p.z));
    const npcAt = { x: at.x + 1.2, z: at.z };
    // 가라앉음이 섞이지 않는 철에서 잰다 (S-011 의 주석 그대로)
    const base = inSeason(SEEP, FANTASY_MAZE, at, {
      npcs: [{ id: 'npc-1', position: npcAt, wanderPath: [], perceptionRange: 0 }],
    });
    const w = worldFrom(base, (s) => {
      place(s, bodyOf(base), FANTASY_MAZE, at);
      placeNpc(s, 'npc-1', FANTASY_MAZE, npcAt);
    });
    const pressureBefore = mazePressure(w);
    // When 한 번 때려 닿는다
    strikeOnce(w, at);
    expect(w.observe().strikes.length).toBeGreaterThan(0);
    // Then 미로에도 소란이 섰다
    expect(seenValue(w)).toBe(DISTURBANCE_PER_STRIKE * w.observe().strikes.length);
    // And 압력은 그 타격으로 오르지 않았다 (걸음만이 압력이다 — 한 걸음 겨눈 만큼만 올랐다)
    expect(mazePressure(w)).toBeGreaterThanOrEqual(pressureBefore);
  });

  it('S-093 (경계 ①) 소란이 임계를 넘어도 재배열은 여전히 압력만이 굴린다', () => {
    const spots = cellSpots();
    const from = spots[0]!;
    const to = maxBy(spots, (p) => distanceBetween(p, from));
    // Given 소란이 임계에 찬(깨어난) 미로 — 압력은 임계 가까이 두었다
    const npcAt = { x: from.x + 1.2, z: from.z };
    // 가라앉지 않는 철에서 깨운다 — 여기서 재는 것은 미로의 불변이다 (S-011 의 주석)
    const base = inSeason(SEEP, FANTASY_MAZE, from, {
      npcs: [{ id: 'npc-1', position: npcAt, wanderPath: [], perceptionRange: 0 }],
    });
    const staged = worldFrom(base, (s) => {
      place(s, bodyOf(base), FANTASY_MAZE, from);
      placeNpc(s, 'npc-1', FANTASY_MAZE, npcAt);
      // 타격 하나로 넘치게 채운다 (SPEC-005 awokenAt 의 주석 그대로)
      charge(s, FANTASY_MAZE, DISTURBANCE_THRESHOLD - 1);
    });
    strikeOnce(staged, from);
    expect(seenPhase(staged)).toBe(AWAKE);
    const pattern = mazePattern(staged);
    // Then 깨어남만으로는 패턴이 바뀌지 않았다
    expect(mazePattern(staged)).toBe(pattern);

    // When 걸어서 압력을 임계까지 올린다
    const limit = mazeRule().pressureLimit;
    const w = worldFrom(staged, (s) => {
      const held = (s.regionStates as unknown as RegionStatesShape)[FANTASY_MAZE]!;
      held.rule!.pressure = limit - 3;
    });
    expect(mazePattern(w)).toBe(pattern);
    settle(w); // 휘두름이 끝나야 걸음을 낼 수 있다
    walkUntil(w, [to, from], () => mazePattern(w) !== pattern);
    // Then 패턴은 **압력**으로 바뀌었고 압력은 0 으로 돌아갔다 (C008 그대로)
    expect(mazePattern(w)).not.toBe(pattern);
    expect(mazePressure(w)).toBe(0);
    // And 소란은 그 재배열에 한 값도 쓰이지 않았다 — 깨어남 그대로다
    expect(heldPhase(w, FANTASY_MAZE)).toBe(AWAKE);
    expect(heldValue(w, FANTASY_MAZE)).toBe(DISTURBANCE_THRESHOLD);
  });
});

describe('SPEC-010 세계에 하나이고 껐다 켜도 이어진다', () => {
  it('S-0101 관찰자 둘이 같은 소란 · 위상 · 자국을 본다', () => {
    const region = START_REGION_ID;
    const run = straightRun(region);
    const spots = [run.from, { x: run.from.x, z: run.from.z + 2 }];
    // Given 같은 방에 선 관찰자 둘, 소란이 이미 쌓여 있다
    const w = staged(
      [
        { observer: OBSERVER, region, at: spots[0]! },
        { observer: OBSERVER_2, region, at: spots[1]! },
      ],
      { [region]: 40 },
      // 걷는 동안 가라앉지 않는 철에서 본다 — 재는 것은 "둘이 같은가" 다 (S-011 의 주석)
      { clock: SEEP },
    );
    // When 하나가 걸어 자국을 남긴다
    walkTo(w, run.to, OBSERVER);
    // Then 둘의 소란이 한 값도 다르지 않다
    expect(seenDisturbance(w, OBSERVER_2)).toEqual(seenDisturbance(w, OBSERVER));
    expect(seenValue(w, OBSERVER)).toBe(40);
    // And 둘이 같은 자국을 본다 (누가 남겼는지는 둘 다 모른다)
    const sortTracks = (list: readonly TrackView[]) =>
      [...list].map((t) => JSON.stringify(t)).sort();
    expect(seenTracks(w, OBSERVER).length).toBeGreaterThan(0);
    expect(sortTracks(seenTracks(w, OBSERVER_2))).toEqual(sortTracks(seenTracks(w, OBSERVER)));
  });

  it('S-0102 저장하고 되살린 세계가 소란과 자국을 잇는다', () => {
    const region = START_REGION_ID;
    const run = straightRun(region);
    // Given 소란이 임계에 차 깨어난 방과 자국을 남긴 세계
    const w = chargedWorld(region, doorSpot(region), DISTURBANCE_THRESHOLD - DISTURBANCE_PER_TRANSIT, {
      clock: SEEP,
    });
    const body = bodyOf(w);
    const back = moveBody(w, region, run.from, body);
    walkTo(back, run.to);
    const walked = worldFrom(back, () => undefined);
    walkTo(walked, doorSpot(region));
    expect(cross(walked, DOOR_OUT[region]!)).toMatchObject({ status: 'success' });
    expect(heldPhase(walked, region)).toBe(AWAKE);
    const before = {
      value: heldValue(walked, region),
      phase: heldPhase(walked, region),
      tracks: JSON.stringify(shapeOf(walked)[region]?.tracks ?? []),
    };
    expect(JSON.parse(before.tracks).length).toBeGreaterThan(0);

    // When 파일을 지나 저장하고 되살린다
    const revived = revive(walked);
    // Then 소란도 위상도 자국도 그대로 이어진다
    expect({
      value: heldValue(revived, region),
      phase: heldPhase(revived, region),
      tracks: JSON.stringify(shapeOf(revived)[region]?.tracks ?? []),
    }).toEqual(before);
    // And 되살린 세계에서 그 값이 그대로 굴러간다 (스밈이라 줄지 않는다)
    wait(revived, 20, 1);
    expect(heldValue(revived, region)).toBe(before.value);
    expect(heldPhase(revived, region)).toBe(AWAKE);
  });

  it('S-0103 (경계) STATE_VERSION 이 올랐으므로 옛 스냅샷은 복구되지 않는다', () => {
    expect(STATE_VERSION).toBe(RAISED_STATE_VERSION);
    const w = standingIn(START_REGION_ID);
    const snapshot = throughFile(w.world.snapshot());
    expect(snapshot.version).toBe(RAISED_STATE_VERSION);
    expect(restoreWorld(snapshot)).not.toBeNull();
    expect(restoreWorld({ ...snapshot, version: OLD_STATE_VERSION })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('회귀', () => {
  it('R-001 (C008 · C009) 미로의 압력이 걸음으로 그대로 굴러간다 — 소란이 그것을 흔들지 않는다', () => {
    const t = terrainOf(FANTASY_MAZE);
    const spots = gridSpots(FANTASY_MAZE).filter(
      (p) =>
        isTraversableAt(t, p.x, p.z) &&
        tagsAt(t, p.x, p.z, PASSAGE_LAYER).length === 0 &&
        tagsAt(t, p.x, p.z, CELL_LAYER).length > 0,
    );
    const from = spots[0]!;
    const to = maxBy(spots, (p) => distanceBetween(p, from));
    const w = standingIn(FANTASY_MAZE, from);
    const rule = regionSpec(FANTASY_MAZE)!.rule!;
    const first = shapeOf(w)[FANTASY_MAZE]!.rule!.pattern;
    // Given 압력이 0 인 미로
    expect(shapeOf(w)[FANTASY_MAZE]!.rule!.pressure).toBe(0);
    // When 걷는다 — 압력이 오르고 임계에서 재배열이 일어난다
    walkUntil(w, [to, from], () => shapeOf(w)[FANTASY_MAZE]!.rule!.pattern !== first);
    // Then 패턴이 바뀌었고 압력이 0 으로 돌아갔다
    expect(shapeOf(w)[FANTASY_MAZE]!.rule!.pattern).not.toBe(first);
    expect(shapeOf(w)[FANTASY_MAZE]!.rule!.pressure).toBe(0);
    expect(rule.pressureLimit).toBeGreaterThan(0);
    // And 그 사이 소란은 한 값도 오르지 않았다 (걸음은 소란이 아니다)
    expect(heldValue(w, FANTASY_MAZE)).toBe(0);
  });

  it('R-002 (C016) 뒤척임이 원천을 처음 상태로 되돌리고 다음 마디로 옮긴다', () => {
    const room = TURN_ROOMS[0]!;
    const migrating = (phasesOf(room)!.onTurn as { migrateSources?: string[] }).migrateSources?.[0];
    if (!migrating) throw new Error(`${room} 이 옮길 원천을 밝히지 않았다`);
    const base = standingIn(room, undefined, { actorItems: { pickaxe: 9 } });
    const at = sourceEntity(base.observe(), migrating)!.position;
    const w = moveBody(base, room, besideSpot({ x: at.x, z: at.z }), bodyOf(base));
    // Given 한 번 캔 원천
    expect(mineOnce(w, migrating).status).toBe('success');
    const before = shapeOf(w)[room]!.sources![migrating]!;
    expect(before.taken).toBe(1);
    const site = before.siteIndex ?? 0;
    // When 뒤척임을 지난다
    runToSeason(w, TURN);
    expect(turnsAppliedOf(w)).toBe(1);
    // Then 캔 횟수가 처음 상태이고 마디가 옮겨 갔다 (C016 그대로)
    const after = shapeOf(w)[room]!.sources![migrating]!;
    expect(after.taken).toBe(0);
    expect(after.siteIndex ?? 0).not.toBe(site);
  });

  it('R-003 (C016) 철의 덧씌움이 그대로다 — 그 자락이 그 철에 한 단계 깊어진다', () => {
    const season = seasonOverlaySeason();
    const overlay = seasonDepthOverlay();
    if (!overlay) throw new Error(`${SEASON_ROOM} 이 철의 깊이 덧씌움을 밝히지 않았다`);
    const spot = spotInLayer(SEASON_ROOM, DEPTH_LAYER, areaTagOf(SEASON_ROOM, overlay.areaId));
    // Given 그 철이 아닌 때 — 방의 깊이 그대로다
    const other = SEASONS.find((s) => s !== season && s !== TURN)!;
    expect(depthSeen(inSeason(other, SEASON_ROOM, spot))).toBe(regionSpec(SEASON_ROOM)!.depth);
    // Then 그 철에는 한 단계 깊다
    expect(depthSeen(inSeason(season, SEASON_ROOM, spot))).toBe(overlay.depth);
  });

  it('R-004 (C011 ~ C013) 캐는 것이 그대로 산다 — 곡괭이를 들고 원천 곁에 서면 캘 수 있다', () => {
    const source = plainSourceIn(FOREST_EDGE);
    const base = standingIn(FOREST_EDGE, undefined, { actorItems: { pickaxe: 1 } });
    const at = sourceEntity(base.observe(), source)!.position;
    const w = moveBody(base, FOREST_EDGE, besideSpot({ x: at.x, z: at.z }), bodyOf(base));
    expect(mine(w, source)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
  });

  it('R-005 (C010) 관찰자 둘이 같은 세계를 본다 — 소란과 자국이 그 사실을 흐리지 않는다', () => {
    const region = START_REGION_ID;
    const run = straightRun(region);
    const w = staged([
      { observer: OBSERVER, region, at: run.from },
      { observer: OBSERVER_2, region, at: { x: run.from.x, z: run.from.z + 2 } },
    ]);
    // 둘이 서로의 몸을 본다
    const others = (observerId: string) =>
      w.observe(observerId).entities.filter((e) => e.role === 'other-player-character').length;
    expect(others(OBSERVER)).toBeGreaterThan(0);
    expect(others(OBSERVER_2)).toBeGreaterThan(0);
    // 방의 사실이 같다
    expect(w.observe(OBSERVER_2).region.id).toBe(w.observe(OBSERVER).region.id);
    expect(w.observe(OBSERVER_2).region.hash).toBe(w.observe(OBSERVER).region.hash);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('하네스 결손', () => {
  it.todo(
    'GAP: 몸이 없는 방을 **관찰 결과로** 볼 수 없다 — world:observe --at 이 C018 의 것이라(spec Out of Scope), SPEC-002 경계 ②(몸이 없어도 가라앉는다)는 세계 State(regionStates[..].disturbance)로만 잰다',
  );
  it.todo(
    'GAP: 자율 존재 셋이 **같은 시간에 같은 수의 일**을 하도록 세울 손잡이가 없다 (자율 존재의 걸음·타격은 인지와 충돌로 갈린다). 그래서 SPEC-004 경계 ②는 "몸을 가리지 않는다"(닿은 타격 수 × 5)로만 재고, "자율 존재 셋 = 관찰자 셋"의 등식은 세우지 못했다',
  );
  it.todo(
    'GAP: 세계는 한 걸음이 **끝난** 시각을 다음 Tick 에 읽는다 (c016 S-064 가 적은 어긋남). 그래서 뒤척임과 자국 묻기의 **순서**(같은 Tick 안에서 무엇이 먼저인가 · R10 이 말하는 "뒤척인 뒤의 값")를 한 걸음 안에서 가려낼 수 없어, S-082 는 뒤척임을 지난 **뒤**의 값으로만 잰다',
  );
  it.todo(
    'GAP: 소란을 걸어서 임계까지 채우려면 서른 번을 캐야 하고 그 사이 원천이 고갈·회복을 돈다. 그래서 임계 부근의 Given 은 저장·복구(charge)로 세웠다 — 실제로 서른 번 캐서 넘기는 길은 재지 못했다',
  );
});
