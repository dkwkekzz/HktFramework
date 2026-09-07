// C015 — 세계에 시계가 선다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// C014 까지 세계에는 시각만 있었다. 이 Cycle 이 그 시각을 **때**로 읽는다. 그래서 재는 것은 넷이다:
//   ① 같은 세계 시각은 언제나 같은 때다 — 잘게 주든 몰아 주든, 몸이 있든 없든, 껐다 켜든
//   ② 철 넷이 순서대로 돌고 한 바퀴에 하나씩만 온다 — 건너뛰지 않는다
//   ③ 긴 밤에는 낮이 오지 않고, 그 앞뒤(스밈의 마지막 하루 · 뒤척임)는 낮이다
//   ④ 밤은 **좁힐** 뿐 계약을 바꾸지 않는다 — 먼 몸과 원천이 빠지고 그것에 걸린 것도 함께 빠지되,
//      내 몸 · 출구 · 방의 사실 · HUD 는 그대로이고 관찰 결과의 형도 그대로다
// 그리고 다섯째가 회귀다 — 때가 아직 방을 바꾸지 않는다 (원천 · 통행 · 미로 · 흔적 세기 불변).
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 observe() 를 읽는다. 이 Cycle 의 새 구현
// (semantic/clock.ts · projection/observer-view.ts · content/view/) 은 **읽지 않았다.**
// 기대값의 출처는 cycles/C015-the-world-has-a-clock/spec.md 뿐이다.
// (protocol/gameview.ts 의 WorldClockView 는 관찰 계약이므로 형으로만 쓴다.)
//
// **자리는 손으로 적지 않는다** — 원천의 자리는 그 방 데이터에서, 설 자리는 컴파일된 격자에서
// 고른다. 손으로 적는 유일한 수는 spec 의 시뮬레이션 상수 표(240 · 120 · 3 · 2 · 1 · 60 · 20)이고,
// 그것은 저장되지 않는 헤더 상수라 세계에서 가져올 자리가 없다 (spec State 절).
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.
// 밤에 무엇이 빠졌는가는 그 id 가 없는 것으로 잰다.

import { describe, expect, it } from 'vitest';
import { descriptionHash, pointsOf, type RegionDescription, type XZ } from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  ANCHOR_LAYER,
  BIO_ORE_FIELD,
  COMPILE_RULES,
  FOREST_DEEP,
  FOREST_EDGE,
  REGION_SPECS,
  RESOURCE_LAYER,
  START_REGION_ID,
  regionSpec,
  type ResourceSourceSpec,
} from '../../regions';
// C008 이 세운 미로의 이름들 — 그 파일이 소유한다 (c008 ~ c014 시나리오의 선례 그대로).
import { CELL_LAYER, FANTASY_MAZE, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type {
  EntityView,
  GameViewSnapshot,
  InteractionView,
  WorldClockView,
} from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import {
  INTERACTION_RANGE,
  STATE_VERSION,
  TICK_INTERVAL,
  type WorldState,
} from '../semantic/world-state';
import {
  isCollapsedAt,
  isFlowActive,
  inflowOf,
  sourcePositionOf,
  sourceStateOf,
  sourcesInRegion,
  traceStrengthAt,
} from '../semantic/resource';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

// ── spec 의 시뮬레이션 상수 표 (State 절 · 헤더 상수 · 결정론) ───────
//
// 시계는 세계 시각에서 유도되고 **저장되지 않으므로** 세계 데이터에서 읽어 올 자리가 없다
// (c013 의 recoveryOf 가 데이터에서 읽던 것과 다른 갈래다 — spec State 절이 그렇게 못 박았다).
// 그래서 여기 적는 수는 전부 spec 의 표에서 왔다.

const DAY_SECONDS = 240; // 낮의 길이
const NIGHT_SECONDS = 120; // 밤의 길이
const DAY_LENGTH = DAY_SECONDS + NIGHT_SECONDS; // 하루 360
const STILL_DAYS = 3; // 고요 3일 = 1080
const SEEP_DAYS = 2; // 스밈 2일 = 720
const LONG_NIGHT_DAYS = 1; // 긴 밤 1일 = 360 (전부 밤)
const TURN_SECONDS = 60; // 뒤척임 (낮)
/** 밤에 몸과 원천이 실리는 거리 (spec 기본형 ②) */
const OBSERVE_RANGE_NIGHT = 20;

/** 철 넷이 차지하는 구간 — spec R1 의 표 그대로 */
const STILL_SPAN = STILL_DAYS * DAY_LENGTH; // 1080
const SEEP_SPAN = SEEP_DAYS * DAY_LENGTH; // 720
const LONG_NIGHT_SPAN = LONG_NIGHT_DAYS * DAY_LENGTH; // 360
const CYCLE_LENGTH = STILL_SPAN + SEEP_SPAN + LONG_NIGHT_SPAN + TURN_SECONDS; // 2220
/** 한 바퀴의 하루 수 (spec State 절) */
const DAYS_PER_CYCLE = 6;

/** 철이 시작하는 자리 (한 바퀴 안) */
const STILL_AT = 0;
const SEEP_AT = STILL_SPAN; // 1080
const LONG_NIGHT_AT = SEEP_AT + SEEP_SPAN; // 1800
const TURN_AT = LONG_NIGHT_AT + LONG_NIGHT_SPAN; // 2160

/** 때의 값들 (spec State 절 · Observable 절) */
const DAY = 'DAY';
const NIGHT = 'NIGHT';
const STILL = 'STILL';
const SEEP = 'SEEP';
const LONG_NIGHT = 'LONG_NIGHT';
const TURN = 'TURN';

/** spec 이 적은 State 형 버전 — 이 Cycle 은 이것을 올리지 않는다 (SPEC-006 경계) */
const FROZEN_STATE_VERSION = 'hkt-adv-proto-i/6';

/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (C011~C014 어법) */
const MINE_SECONDS = 1.2;

const solo: WorldSetup = { npcs: [] };

// ── 하네스 (c010 · c013 · c014 의 선례 그대로) ───────────────────────

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

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id = PLAYER) => state(w).actors.find((a) => a.id === id)!;
const here = (w: WorldDriver, id = PLAYER): XZ => ({
  x: actorOf(w, id).position.x,
  z: actorOf(w, id).position.z,
});
/** 세계 시각 — 때는 여기서 나온다 (spec R1) */
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

/** 격자를 고르게 훑는 표본 — 철 넷을 견줄 때 방마다 수천 자리를 네 번 재지 않기 위한 것 */
const sampleSpots = (id: string): XZ[] => gridSpots(id).filter((_, i) => i % 7 === 0);

const distanceBetween = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
const minBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]!);
const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);

const walkableSpots = (region: string): XZ[] => {
  const t = terrainOf(region);
  return gridSpots(region).filter((p) => isTraversableAt(t, p.x, p.z));
};

const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;

/** C011 이 놓은 자리 — resource layer point 하나 */
const pointOf = (region: string, id: string): XZ => {
  const found = pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id);
  if (!found) throw new Error(`데이터에 원천 '${id}' 의 자리가 없다 (${region})`);
  return found.position;
};

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

/** 그 자리의 손 닿는 곳 — InteractionRange 안이다 */
const besideSpot = (at: XZ): XZ => ({ x: at.x + INTERACTION_RANGE / 2, z: at.z });

// ── 세계를 세우고 굴리는 자리 ────────────────────────────────────────

const standingIn = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
  });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};

/** dt 를 잘게 나누어 준다 (기본 한 걸음 1 세계 초) — c013 의 wait 선례 그대로 */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}

/** 그 세계 시각까지 굴린다 (이미 지났으면 아무것도 하지 않는다) */
function runTo(w: WorldDriver, target: number, step?: number) {
  const left = target - timeOf(w);
  if (left <= 1e-9) return;
  if (step === undefined) w.tick(left);
  else wait(w, left, step);
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

// ── 저장·복구 (c010 · c013 · c014 의 선례 그대로) ───────────────────
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

/** 관찰자 둘이 각자의 자리에 선 세계 (방이 같아도 달라도 된다) */
function two(regionA: string, atA: XZ, regionB: string, atB: XZ): WorldDriver {
  const base = driveWorld({ ...solo, actorRegion: regionA, actorPosition: { x: atA.x, z: atA.z } });
  base.join(OBSERVER_2);
  base.tick(0);
  return worldFrom(
    base,
    (s) => {
      place(s, PLAYER, regionA, atA);
      place(s, PLAYER_2, regionB, atB);
    },
    [OBSERVER, OBSERVER_2],
  );
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────
const clockOf = (w: WorldDriver, observerId = OBSERVER): WorldClockView =>
  w.observe(observerId).clock;
const entityOf = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  v.entities.find((e) => e.id === id);
const sourcesIn = (v: GameViewSnapshot): EntityView[] =>
  v.entities.filter((e) => e.role === 'resource-source');
const exitsIn = (v: GameViewSnapshot): EntityView[] =>
  v.entities.filter((e) => e.role === 'region-exit');
const onTarget = (v: GameViewSnapshot, targetEntityId: string): InteractionView[] =>
  v.interactions.filter((i) => i.targetEntityId === targetEntityId);
const hudIds = (v: GameViewSnapshot): string[] => v.hud.map((h) => h.id);
const hudValue = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;

/** 그 원천이 지금 서 있는 자리 — State 를 들여다보지 않고 세계 쪽 함수에 묻는다 */
const sourceAt = (w: WorldDriver, region: string, id: string): XZ => {
  const source = sourcesInRegion(region).find((s) => s.id === id)!;
  const at = sourcePositionOf(statesOf(w), source);
  return { x: at.x, z: at.z };
};

/**
 * 여러 시각의 때를 한 세계에서 읽는다 — 시각마다 새 세계를 세우지 않는다.
 *
 * 큰 걸음 한 번으로 건너뛴다: 시계는 시각에서 유도되므로 그래도 같은 답이어야 하고,
 * 그것 자체가 SPEC-001 경계 ① 이다 (S-013 이 따로 증명한다).
 */
function clocksAt(times: readonly number[]): { t: number; clock: WorldClockView }[] {
  const w = driveWorld(solo);
  return [...times]
    .sort((a, b) => a - b)
    .map((t) => {
      runTo(w, t);
      return { t, clock: clockOf(w) };
    });
}

/** 그 시각의 낮밤 · 철을 "t:값" 한 줄로 — 실패했을 때 어느 시각이 틀렸는지 그대로 보인다 */
const phaseLine = (s: { t: number; clock: WorldClockView }) => `${s.t}:${s.clock.dayPhase}`;
const seasonLine = (s: { t: number; clock: WorldClockView }) => `${s.t}:${s.clock.season}`;

/** [from, to) 를 1 초씩 걸으며 때를 모은다 — 표의 길이를 세는 자리 */
function walkClock(from: number, to: number): WorldClockView[] {
  const w = driveWorld(solo);
  runTo(w, from);
  const out: WorldClockView[] = [];
  for (let t = from; t < to; t += 1) {
    out.push(clockOf(w));
    w.tick(1);
  }
  return out;
}

/** 잇달아 같은 값을 하나로 접는다 — "건너뛰지 않았는가" 를 보는 자리 */
const runs = <T>(values: readonly T[]): T[] =>
  values.filter((v, i) => i === 0 || v !== values[i - 1]!);

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 세계 시각에서 낮과 밤이 갈린다', () => {
  it('S-011 0~239 초는 낮이고 240~359 초는 밤이며 360 초에 다시 낮이다', () => {
    // Given 0 초에서 시작한 세계 / When 하루의 안팎을 짚어 본다
    const seen = clocksAt([0, 1, 120, 239, 240, 241, 300, 359, 360, 361, 599, 600, 719, 720]);
    // Then 낮 → 밤 → 낮이 하루(360)마다 되풀이된다
    expect(seen.map(phaseLine)).toEqual([
      '0:DAY',
      '1:DAY',
      '120:DAY',
      '239:DAY',
      '240:NIGHT',
      '241:NIGHT',
      '300:NIGHT',
      '359:NIGHT',
      '360:DAY',
      '361:DAY',
      '599:DAY',
      '600:NIGHT',
      '719:NIGHT',
      '720:DAY',
    ]);
  });

  it('S-012 하루의 길이가 낮 240 + 밤 120 이다 — 1 초씩 걸으며 센다', () => {
    // Given 첫 하루 / When 360 초를 1 초씩 걷는다
    const day = walkClock(0, DAY_LENGTH);
    // Then 낮이 240 초 · 밤이 120 초다 (spec 의 상수 표 그대로)
    expect({
      day: day.filter((c) => c.dayPhase === DAY).length,
      night: day.filter((c) => c.dayPhase === NIGHT).length,
    }).toEqual({ day: DAY_SECONDS, night: NIGHT_SECONDS });
    // And 낮이 먼저다 — 하루는 낮으로 시작한다 (기본형 ④)
    expect(runs(day.map((c) => c.dayPhase))).toEqual([DAY, NIGHT]);
  });

  it('S-013 며칠째가 360 초마다 하나씩 오른다', () => {
    // Given 한 바퀴 안의 하루 경계들 (뒤척임 앞까지 — 뒤척임의 dayIndex 는 S-025 가 본다)
    const edges: number[] = [];
    for (let day = 0; day < DAYS_PER_CYCLE; day++) edges.push(day * DAY_LENGTH, day * DAY_LENGTH + DAY_LENGTH - 1);
    // When 그 자리들의 며칠째를 읽는다
    const seen = clocksAt(edges);
    // Then 하루가 시작할 때마다 하나씩 오르고 그 하루 안에서는 그대로다
    expect(seen.map((s) => `${s.t}:${s.clock.dayIndex}`)).toEqual([
      '0:0', '359:0',
      '360:1', '719:1',
      '720:2', '1079:2',
      '1080:3', '1439:3',
      '1440:4', '1799:4',
      '1800:5', '2159:5',
    ]);
  });

  it('S-014 (경계 ①) dt 를 잘게 나누어 주든 한 번에 몰아 주든 같은 시각에서 같은 답이다', () => {
    for (const target of [250, 1500, 1900, 2190, 2400]) {
      // Given 같은 시각까지 굴린 세계 둘 — 하나는 1 초씩, 하나는 한 번에
      const stepped = driveWorld(solo);
      runTo(stepped, target, 1);
      const lumped = driveWorld(solo);
      runTo(lumped, target);
      // Then 때가 한 값도 다르지 않다
      expect({ target, ...clockOf(stepped) }).toEqual({ target, ...clockOf(lumped) });
    }
  });

  it('S-015 (경계 ①) Tick 주기로 잘게 굴려도 같은 때다', () => {
    // Given 밤 한가운데까지 세계의 Tick 주기(1/30 초)로만 굴린 세계
    const ticked = driveWorld(solo);
    const steps = Math.round(250 / TICK_INTERVAL);
    for (let i = 0; i < steps; i++) ticked.tick(TICK_INTERVAL);
    // When 같은 자리를 한 번에 건너뛴 세계와 견준다
    const lumped = driveWorld(solo);
    lumped.tick(250);
    // Then 같은 때다
    expect(clockOf(ticked)).toEqual(clockOf(lumped));
    expect(clockOf(ticked)).toEqual({ dayPhase: NIGHT, season: STILL, dayIndex: 0, seasonCycle: 0 });
  });

  it('S-016 (경계 ②) 몸이 하나도 없어도 때는 돈다', () => {
    // Given 몸이 하나도 없는 세계 — 자율 존재도 없고 관찰자도 아직 들어오지 않았다
    const world = createWorld(solo);
    expect((world.snapshot().state as WorldState).actors).toEqual([]);
    // When 낮이 다 가도록 굴린다 (아무도 보고 있지 않다)
    world.tick(250);
    expect((world.snapshot().state as WorldState).actors).toEqual([]);
    // Then 그제야 들어온 이가 보는 때는 밤이다 — 그동안에도 때는 돌았다
    const w = wrap(world);
    w.join(OBSERVER);
    w.tick(0);
    expect(clockOf(w)).toEqual({ dayPhase: NIGHT, season: STILL, dayIndex: 0, seasonCycle: 0 });
  });
});

describe('SPEC-002 철 넷이 순서대로 돈다', () => {
  it('S-021 고요 → 스밈 → 긴 밤 → 뒤척임 → 다시 고요 순으로 선다', () => {
    // Given 한 바퀴의 안팎 / When 철의 경계를 짚는다
    const seen = clocksAt([
      STILL_AT,
      SEEP_AT - 1,
      SEEP_AT,
      LONG_NIGHT_AT - 1,
      LONG_NIGHT_AT,
      TURN_AT - 1,
      TURN_AT,
      CYCLE_LENGTH - 1,
      CYCLE_LENGTH,
    ]);
    // Then 철이 spec 의 표 그대로 갈린다
    expect(seen.map(seasonLine)).toEqual([
      '0:STILL',
      '1079:STILL',
      '1080:SEEP',
      '1799:SEEP',
      '1800:LONG_NIGHT',
      '2159:LONG_NIGHT',
      '2160:TURN',
      '2219:TURN',
      '2220:STILL',
    ]);
  });

  it('S-022 철의 길이가 1080 · 720 · 360 · 60 이다 — 1 초씩 걸으며 센다', () => {
    // Given 한 바퀴 / When 2220 초를 1 초씩 걷는다
    const cycle = walkClock(0, CYCLE_LENGTH);
    const count = (season: string) => cycle.filter((c) => c.season === season).length;
    // Then 저마다 spec 의 표만큼이다
    expect({
      still: count(STILL),
      seep: count(SEEP),
      longNight: count(LONG_NIGHT),
      turn: count(TURN),
    }).toEqual({ still: STILL_SPAN, seep: SEEP_SPAN, longNight: LONG_NIGHT_SPAN, turn: TURN_SECONDS });
  });

  it('S-023 몇 바퀴째가 2220 초마다 하나씩 오른다', () => {
    const seen = clocksAt([0, CYCLE_LENGTH - 1, CYCLE_LENGTH, 2 * CYCLE_LENGTH - 1, 2 * CYCLE_LENGTH]);
    expect(seen.map((s) => `${s.t}:${s.clock.seasonCycle}`)).toEqual([
      '0:0',
      '2219:0',
      '2220:1',
      '4439:1',
      '4440:2',
    ]);
  });

  it('S-024 (경계 ①) 두 바퀴째의 같은 자리는 첫 바퀴와 같은 철 · 같은 낮밤이다', () => {
    const offsets = [0, 200, 250, 700, 1079, 1080, 1500, 1799, 1800, 2000, 2159, 2160, 2219];
    const first = clocksAt(offsets);
    const second = clocksAt(offsets.map((o) => o + CYCLE_LENGTH));
    for (let i = 0; i < offsets.length; i++) {
      const a = first[i]!.clock;
      const b = second[i]!.clock;
      // Then 철과 낮밤은 같고, 바퀴는 하나 · 며칠째는 여섯 늘었다
      expect({ offset: offsets[i], season: b.season, dayPhase: b.dayPhase }).toEqual({
        offset: offsets[i],
        season: a.season,
        dayPhase: a.dayPhase,
      });
      expect({ offset: offsets[i], cycle: b.seasonCycle, day: b.dayIndex }).toEqual({
        offset: offsets[i],
        cycle: a.seasonCycle + 1,
        day: a.dayIndex + DAYS_PER_CYCLE,
      });
    }
  });

  it('S-025 (경계 ②) 한 바퀴에 네 철이 모두 한 번씩 온다 — 건너뛰지 않는다', () => {
    // Given 한 바퀴 / When 1 초씩 걸으며 철이 바뀌는 자리를 모은다
    const cycle = walkClock(0, CYCLE_LENGTH);
    // Then 순서 그대로 넷이고, 한 철도 두 번 나뉘어 오지 않는다
    expect(runs(cycle.map((c) => c.season))).toEqual([STILL, SEEP, LONG_NIGHT, TURN]);
    // And 뒤척임의 며칠째는 다음 바퀴 첫 하루의 것과 같다 (R1 경계 ③ — 뒤척임이 그 하루의 새벽이다)
    const seen = clocksAt([TURN_AT, CYCLE_LENGTH, CYCLE_LENGTH + DAY_LENGTH - 1, CYCLE_LENGTH + DAY_LENGTH]);
    expect(seen.map((s) => `${s.t}:${s.clock.dayIndex}`)).toEqual([
      '2160:6',
      '2220:6',
      '2579:6',
      '2580:7',
    ]);
  });
});

describe('SPEC-003 긴 밤에는 낮이 오지 않는다', () => {
  it('S-031 긴 밤이 시작한 뒤 그 360 초가 내내 밤이다', () => {
    // Given 긴 밤이 시작한 시각 / When 그 하루를 1 초씩 걷는다
    const night = walkClock(LONG_NIGHT_AT, LONG_NIGHT_AT + LONG_NIGHT_SPAN);
    // Then 한 초도 낮이 없다
    expect(runs(night.map((c) => c.dayPhase))).toEqual([NIGHT]);
    expect(runs(night.map((c) => c.season))).toEqual([LONG_NIGHT]);
    expect(night).toHaveLength(LONG_NIGHT_SPAN);
  });

  it('S-032 (경계 ①) 그 앞은 낮으로 시작하고 그 뒤는 낮으로 열린다', () => {
    const seen = clocksAt([
      LONG_NIGHT_AT - DAY_LENGTH, // 스밈의 마지막 하루가 시작하는 자리
      LONG_NIGHT_AT - 1, // 긴 밤 바로 앞 (스밈의 마지막 밤)
      LONG_NIGHT_AT, // 긴 밤의 첫 초
      TURN_AT, // 긴 밤이 끝나고 뒤척임이 여는 자리
    ]);
    expect(seen.map((s) => `${s.t}:${s.clock.season}/${s.clock.dayPhase}`)).toEqual([
      '1440:SEEP/DAY',
      '1799:SEEP/NIGHT',
      '1800:LONG_NIGHT/NIGHT',
      '2160:TURN/DAY',
    ]);
  });

  it('S-033 (경계 ②) 뒤척임 60 초는 내내 낮이다 — 새벽이다', () => {
    const turn = walkClock(TURN_AT, TURN_AT + TURN_SECONDS);
    expect(runs(turn.map((c) => c.dayPhase))).toEqual([DAY]);
    expect(runs(turn.map((c) => c.season))).toEqual([TURN]);
    expect(turn).toHaveLength(TURN_SECONDS);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 밤에는 보이는 범위가 좁다
//
// 자리는 데이터가 고른다: 원천의 자리에서 밤의 범위 **밖**에 겨우 선 자리를 A 로 삼고,
// 그 A 에서 범위 안팎에 각각 서는 자리를 B 로 삼는다.
// ─────────────────────────────────────────────────────────────────────

/** 이 검사가 쓰는 방과 원천 — 원천 하나만 선 방이라 무엇이 빠졌는지가 흐려지지 않는다 */
const NIGHT_ROOM = BIO_ORE_FIELD;
const NIGHT_SOURCE = sourcesInRegion(BIO_ORE_FIELD)[0]!.id;

/** 원천에서 밤의 범위 **밖**에 선, 그러나 가장 가까운 자리 — 한 걸음이면 범위에 든다 */
const outsideSpot = (): XZ => {
  const at = pointOf(NIGHT_ROOM, NIGHT_SOURCE);
  const out = walkableSpots(NIGHT_ROOM).filter((p) => distanceBetween(p, at) > OBSERVE_RANGE_NIGHT + 1);
  return minBy(out, (p) => distanceBetween(p, at));
};
/** 그 자리에서 걸어갈, 원천이 밤의 범위 **안**에 드는 자리 */
const insideSpot = (from: XZ): XZ => {
  const at = pointOf(NIGHT_ROOM, NIGHT_SOURCE);
  const inside = walkableSpots(NIGHT_ROOM).filter(
    (p) => distanceBetween(p, at) < OBSERVE_RANGE_NIGHT - 1,
  );
  return minBy(inside, (p) => distanceBetween(p, from));
};
/** A 에서 밤의 범위 안에 서는 몸의 자리 (몸끼리 밀리지 않도록 두 걸음 떨어뜨린다) */
const nearBody = (from: XZ): XZ =>
  minBy(
    walkableSpots(NIGHT_ROOM).filter(
      (p) => distanceBetween(p, from) > 2 && distanceBetween(p, from) < OBSERVE_RANGE_NIGHT - 1,
    ),
    (p) => distanceBetween(p, from),
  );
/** A 에서 밤의 범위 밖에 서는 몸의 자리 */
const farBody = (from: XZ): XZ =>
  maxBy(walkableSpots(NIGHT_ROOM), (p) => distanceBetween(p, from));

/** 밤 한가운데 (첫 하루의 밤 — 고요다) */
const MIDNIGHT = DAY_SECONDS + NIGHT_SECONDS / 2; // 300
/** 낮 한가운데 */
const MIDDAY = DAY_SECONDS / 2; // 120

describe('SPEC-004 밤에는 보이는 범위가 좁다', () => {
  /** A 는 원천에서 범위 밖에, B 는 A 곁(범위 안)에 선 세계 */
  const roomFarSource = (): WorldDriver => {
    const a = outsideSpot();
    return two(NIGHT_ROOM, a, NIGHT_ROOM, nearBody(a));
  };
  /** A 는 원천에서 범위 밖에, B 도 A 에게서 범위 밖에 선 세계 */
  const roomFarBody = (): WorldDriver => {
    const a = outsideSpot();
    return two(NIGHT_ROOM, a, NIGHT_ROOM, farBody(a));
  };

  it('S-041 낮에는 방 안의 것이 전부 실리고 밤에는 범위 밖의 원천이 빠진다 — 걸린 상호작용도 함께', () => {
    // Given 원천이 밤의 범위 밖에 있는 자리에 선 관찰자
    const world = roomFarSource();
    runTo(world, MIDDAY, 1);
    // Then 낮에는 그 원천이 실리고 그것에 걸린 상호작용도 있다
    expect(clockOf(world).dayPhase).toBe(DAY);
    expect(entityOf(world.observe(), NIGHT_SOURCE)?.role).toBe('resource-source');
    expect(onTarget(world.observe(), NIGHT_SOURCE).length).toBeGreaterThan(0);
    // When 밤이 온다
    runTo(world, MIDNIGHT, 1);
    // Then 그 원천이 실리지 않고, 그것에 걸려 있던 상호작용도 함께 사라진다
    expect(clockOf(world).dayPhase).toBe(NIGHT);
    expect(entityOf(world.observe(), NIGHT_SOURCE)).toBeUndefined();
    expect(sourcesIn(world.observe())).toEqual([]);
    expect(onTarget(world.observe(), NIGHT_SOURCE)).toEqual([]);
  });

  it('S-042 밤에도 범위 안의 몸은 실리고 범위 밖의 몸은 빠진다', () => {
    // Given 곁에 선 몸 (범위 안) / 저편에 선 몸 (범위 밖)
    const near = roomFarSource();
    const far = roomFarBody();
    for (const world of [near, far]) runTo(world, MIDDAY, 1);
    // Then 낮에는 둘 다 실린다
    expect(entityOf(near.observe(), PLAYER_2)).toBeDefined();
    expect(entityOf(far.observe(), PLAYER_2)).toBeDefined();
    // When 밤이 온다
    for (const world of [near, far]) runTo(world, MIDNIGHT, 1);
    // Then 곁의 몸은 남고 저편의 몸은 빠진다
    expect(clockOf(near).dayPhase).toBe(NIGHT);
    expect(entityOf(near.observe(), PLAYER_2)).toBeDefined();
    expect(entityOf(far.observe(), PLAYER_2)).toBeUndefined();
  });

  it('S-043 (경계 ①) 내 몸은 밤에도 언제나 실린다', () => {
    const world = roomFarBody();
    runTo(world, MIDNIGHT, 1);
    // Then 밤이어도 내 몸은 그대로이고, 저쪽 관찰자에게도 자기 몸은 그대로다
    expect(clockOf(world).dayPhase).toBe(NIGHT);
    expect(entityOf(world.observe(OBSERVER), PLAYER)).toMatchObject({ role: 'player-character' });
    expect(entityOf(world.observe(OBSERVER_2), PLAYER_2)).toMatchObject({ role: 'player-character' });
    // And 서로는 보이지 않는다 — 둘은 서로에게서 범위 밖이다
    expect(entityOf(world.observe(OBSERVER), PLAYER_2)).toBeUndefined();
    expect(entityOf(world.observe(OBSERVER_2), PLAYER)).toBeUndefined();
  });

  it('S-044 (경계 ②) 출구 · 방의 사실 · HUD 는 밤에도 낮과 같다', () => {
    const world = roomFarSource();
    runTo(world, MIDDAY, 1);
    const day = world.observe();
    const daySeen = {
      exits: exitsIn(day).map((e) => `${e.id}/${e.state}@${e.position.x},${e.position.z}`).sort(),
      region: day.region,
      conditions: day.standingConditions,
      hud: hudIds(day),
      scene: day.scene,
      specId: day.specId,
    };
    runTo(world, MIDNIGHT, 1);
    const night = world.observe();
    expect(clockOf(world).dayPhase).toBe(NIGHT);
    expect({
      exits: exitsIn(night).map((e) => `${e.id}/${e.state}@${e.position.x},${e.position.z}`).sort(),
      region: night.region,
      conditions: night.standingConditions,
      hud: hudIds(night),
      scene: night.scene,
      specId: night.specId,
    }).toEqual(daySeen);
    // And 「세계 시간」 줄은 여전히 서 있다 (SPEC-007 경계 ③ — 촬영 하네스가 그것을 기다린다)
    expect(hudValue(night, 'world.time')).toBe(timeOf(world));
  });

  it('S-045 (경계 ③) 걸어가 범위 안에 들면 다시 실린다', () => {
    // Given 밤이고, 원천이 범위 밖이라 실리지 않는다
    const world = roomFarSource();
    runTo(world, MIDNIGHT, 1);
    expect(entityOf(world.observe(), NIGHT_SOURCE)).toBeUndefined();
    // When 범위 안으로 걸어간다
    const target = insideSpot(here(world));
    expect(move(world, target).status).toBe('success');
    for (let i = 0; i < Math.ceil(60 / TICK_INTERVAL); i++) {
      world.tick(TICK_INTERVAL);
      if (distanceBetween(here(world), target) <= 0.05) break;
    }
    expect(distanceBetween(here(world), target)).toBeLessThanOrEqual(0.05);
    // Then 아직 밤인데 그 원천이 다시 실리고 상호작용도 돌아온다
    expect(clockOf(world).dayPhase).toBe(NIGHT);
    expect(entityOf(world.observe(), NIGHT_SOURCE)?.role).toBe('resource-source');
    expect(onTarget(world.observe(), NIGHT_SOURCE).length).toBeGreaterThan(0);
  });

  it('S-046 (경계 ④) 관찰 결과의 형은 낮과 밤이 같다 — 새 필드도 사라진 필드도 없다', () => {
    const world = roomFarSource();
    runTo(world, MIDDAY, 1);
    const day = world.observe();
    const keys = (v: object) => Object.keys(v).sort();
    const dayShape = {
      envelope: keys(day),
      clock: keys(day.clock),
      self: keys(entityOf(day, PLAYER)!),
      exit: keys(exitsIn(day)[0]!),
      hudItem: keys(day.hud[0]!),
    };
    runTo(world, MIDNIGHT, 1);
    const night = world.observe();
    expect(clockOf(world).dayPhase).toBe(NIGHT);
    expect({
      envelope: keys(night),
      clock: keys(night.clock),
      self: keys(entityOf(night, PLAYER)!),
      exit: keys(exitsIn(night)[0]!),
      hudItem: keys(night.hud[0]!),
    }).toEqual(dayShape);
    // And 밤이 실어 오는 새 자리는 없다 — 원천의 형도 낮과 밤이 같다 (범위 안에서 본다)
    const inside = moveBody(world, NIGHT_ROOM, besideSpot(sourceAt(world, NIGHT_ROOM, NIGHT_SOURCE)));
    expect(clockOf(inside).dayPhase).toBe(NIGHT);
    const nightSource = entityOf(inside.observe(), NIGHT_SOURCE)!;
    const daySource = entityOf(day, NIGHT_SOURCE)!;
    expect(keys(nightSource)).toEqual(keys(daySource));
  });
});

describe('SPEC-005 때는 세계에 하나다', () => {
  /** A 는 숲 어귀에, B 는 광맥 벌에 — 둘이 다른 방에 있는 세계 */
  const acrossRooms = (): WorldDriver =>
    two(FOREST_EDGE, walkableSpots(FOREST_EDGE)[0]!, BIO_ORE_FIELD, walkableSpots(BIO_ORE_FIELD)[0]!);

  it('S-051 서로 다른 방의 두 관찰자가 같은 순간에 같은 때를 본다', () => {
    const world = acrossRooms();
    expect(actorOf(world, PLAYER).regionId).not.toBe(actorOf(world, PLAYER_2).regionId);
    for (const target of [MIDDAY, MIDNIGHT, LONG_NIGHT_AT + 100, TURN_AT + 10]) {
      runTo(world, target, 1);
      // Then 낮밤 · 철 · 며칠째 · 몇 바퀴째가 한 값도 다르지 않다
      expect({ target, ...clockOf(world, OBSERVER_2) }).toEqual({ target, ...clockOf(world, OBSERVER) });
    }
  });

  it('S-052 A 가 떠나 있던 동안에도 때는 흘렀다', () => {
    // Given 낮에 두 관찰자가 서 있다
    const world = acrossRooms();
    runTo(world, MIDDAY, 1);
    const before = clockOf(world, OBSERVER);
    expect(before.dayPhase).toBe(DAY);
    // When A 가 이어짐을 잃고, 그동안 세계가 밤으로 넘어간다
    world.leave(OBSERVER);
    world.tick(0);
    runTo(world, MIDNIGHT, 1);
    expect(clockOf(world, OBSERVER_2).dayPhase).toBe(NIGHT);
    // And A 가 다시 들어온다
    world.join(OBSERVER);
    world.tick(0);
    // Then A 가 보는 때는 흘러 있고 B 의 것과 같다
    const after = clockOf(world, OBSERVER);
    expect(after).not.toEqual(before);
    expect(after).toEqual(clockOf(world, OBSERVER_2));
    expect(after.dayPhase).toBe(NIGHT);
  });

  it('S-053 (경계) 관찰자가 하나도 없는 동안에도 때는 흐른다', () => {
    // Given 낮에 두 관찰자가 서 있다가 둘 다 떠난다
    const world = acrossRooms();
    runTo(world, MIDDAY, 1);
    world.leave(OBSERVER);
    world.leave(OBSERVER_2);
    world.tick(0);
    expect(state(world).observers.every((o) => !o.present)).toBe(true);
    // When 아무도 보고 있지 않은 채로 밤이 지나 다음 낮까지 간다
    runTo(world, DAY_LENGTH + MIDDAY, 1);
    // Then 돌아온 둘이 보는 때는 다음 하루의 낮이다
    world.join(OBSERVER);
    world.join(OBSERVER_2);
    world.tick(0);
    expect(clockOf(world, OBSERVER)).toEqual({
      dayPhase: DAY,
      season: STILL,
      dayIndex: 1,
      seasonCycle: 0,
    });
    expect(clockOf(world, OBSERVER_2)).toEqual(clockOf(world, OBSERVER));
  });
});

describe('SPEC-006 때는 껐다 켜도 이어진다', () => {
  it('S-061 밤에 저장하고 되살리면 때가 그대로다', () => {
    for (const target of [MIDNIGHT, LONG_NIGHT_AT + 100, TURN_AT + 10, CYCLE_LENGTH + MIDNIGHT]) {
      // Given 그 시각까지 굴린 세계
      const world = driveWorld(solo);
      runTo(world, target);
      const before = clockOf(world);
      // When 파일을 지나 저장하고 되살린다
      const revived = revive(world);
      // Then 되살린 세계의 때가 그대로다
      expect({ target, ...clockOf(revived) }).toEqual({ target, ...before });
      expect(timeOf(revived)).toBe(target);
    }
    // And 밤이었으면 밤이다
    const night = driveWorld(solo);
    runTo(night, MIDNIGHT);
    expect(clockOf(revive(night)).dayPhase).toBe(NIGHT);
  });

  it('S-062 (경계) STATE_VERSION 은 오르지 않았다 — 옛 스냅샷이 그대로 되살아난다', () => {
    // Then spec 이 적은 그 값 그대로다 — 시계는 저장되는 것이 아니다
    expect(STATE_VERSION).toBe(FROZEN_STATE_VERSION);
    const world = driveWorld(solo);
    runTo(world, MIDNIGHT);
    const snapshot = throughFile(world.world.snapshot());
    expect(snapshot.version).toBe(FROZEN_STATE_VERSION);
    // And 그 버전으로 찍힌 스냅샷은 버려지지 않는다
    expect(restoreWorld(snapshot)).not.toBeNull();
    // And 스냅샷 어디에도 때는 적혀 있지 않다 — 세계 시각에서 나오기 때문이다
    const written = JSON.stringify(snapshot.state);
    for (const word of ['dayPhase', 'season', 'dayIndex', 'seasonCycle', LONG_NIGHT, TURN]) {
      expect({ word, written: written.includes(word) }).toEqual({ word, written: false });
    }
  });

  it('S-063 되살린 세계에서 때가 이어서 돈다 — 밤이 다음 낮으로 넘어간다', () => {
    // Given 밤에 되살린 세계
    const world = driveWorld(solo);
    runTo(world, MIDNIGHT);
    const revived = revive(world);
    expect(clockOf(revived).dayPhase).toBe(NIGHT);
    // When 그 밤의 남은 만큼을 굴린다
    runTo(revived, DAY_LENGTH, 1);
    // Then 낮이 오고 며칠째가 하나 올랐다
    expect(clockOf(revived)).toEqual({ dayPhase: DAY, season: STILL, dayIndex: 1, seasonCycle: 0 });
  });
});

describe('SPEC-007 HUD 가 때를 말한다', () => {
  it('S-071 (경계 ①) 세계는 남은 시간 · 다음 철 · 시간표를 싣지 않는다 — clock 의 자리는 넷뿐이다', () => {
    for (const target of [MIDDAY, MIDNIGHT, LONG_NIGHT_AT + 100, TURN_AT + 10]) {
      const world = driveWorld(solo);
      runTo(world, target);
      // Then 실린 자리는 spec Observable 의 넷이다 — "언제 바뀌는가" 는 어디에도 없다
      expect({ target, keys: Object.keys(world.observe().clock).sort() }).toEqual({
        target,
        keys: ['dayIndex', 'dayPhase', 'season', 'seasonCycle'],
      });
    }
  });

  it('S-072 (경계 ③) HUD 는 있던 그대로다 — 「세계 시간」 줄을 포함해 한 줄도 빠지거나 늘지 않는다', () => {
    const world = driveWorld(solo);
    const before = hudIds(world.observe());
    expect(before).toContain('world.time');
    for (const target of [MIDNIGHT, LONG_NIGHT_AT + 100, TURN_AT + 10]) {
      runTo(world, target, 1);
      // Then 때가 바뀌어도 HUD 의 줄은 그대로이고 「세계 시간」은 세계 시각 그대로다
      expect({ target, hud: hudIds(world.observe()) }).toEqual({ target, hud: before });
      expect(hudValue(world.observe(), 'world.time')).toBe(timeOf(world));
    }
  });

  it.todo(
    'GAP: 화면의 몫 — HUD 의 「때」 「철」 두 줄이 서고 그 값이 그때의 말(낮/밤 · 고요/스밈/긴 밤/뒤척임)인가. 세계는 코드만 싣고 문구는 View 가 clock 에서 만든다 (spec Observable "세계가 짓지 않는 것") — 이 파일은 세계의 값만 잰다',
  );
  it.todo(
    'GAP: 화면의 몫 — 세계 위에 늘 떠 있는 글자가 여전히 0 인가 (C028 의 규율 · SPEC-007 경계 ②). 세계 관찰 결과에는 "떠 있는 글자" 라는 것이 없다',
  );
});

describe('SPEC-008 하늘과 바닥이 때마다 다르다', () => {
  it('S-081 (경계 ①) 땅의 모양은 때가 바뀌어도 한 값도 바뀌지 않는다 — 높이 · 표면 · 통행 · hash', () => {
    const world = standingIn(FOREST_EDGE);
    const shapeNow = () => ({
      terrain: REGION_SPECS.map((s) => JSON.stringify(compileRegion(s.space, COMPILE_RULES).world)),
      hash: REGION_SPECS.map((s) => descriptionHash(s.space)),
      walkable: REGION_SPECS.map((s) => walkableSpots(s.id).length),
      seenHash: world.observe().region.hash,
    });
    const before = shapeNow();
    for (const target of [MIDNIGHT, LONG_NIGHT_AT + 100, TURN_AT + 10]) {
      runTo(world, target, 1);
      expect({ target, ...shapeNow() }).toEqual({ target, ...before });
    }
    // And 관찰 결과가 말하는 hash 는 그 방 Description 의 것 그대로다
    expect(world.observe().region.hash).toBe(descriptionHash(spaceOf(FOREST_EDGE)));
  });

  it.todo(
    'GAP: 화면의 몫 — 장면의 분위기(하늘 색 · 주변광 · 해)가 때마다 다르고 밤이 낮보다, 긴 밤이 가장 어두운가. 세계는 분위기를 싣지 않는다 (View 가 clock 에서 만든다 — spec Observable)',
  );
  it.todo(
    'GAP: 화면의 몫 — 때를 모르는 옛 장면도 그려지는가 (SPEC-008 경계 ②). 분위기가 없는 장면은 view/engine 의 것이라 세계 시나리오가 세울 Given 이 없다',
  );
});

describe('SPEC-009 밤에는 흔적이 또렷해진다', () => {
  it('S-091 (경계 ①) 세계가 싣는 흔적의 세기는 낮과 밤에 한 값도 다르지 않다', () => {
    const world = standingIn(FOREST_EDGE);
    const tracesNow = () =>
      SOURCE_REGIONS.map((region) =>
        sampleSpots(region).map((p) => traceStrengthAt(statesOf(world), region, p)),
      );
    // 낮의 한가운데를 기준으로 삼는다 — 세계가 서자마자의 첫 순간이 아니라. 어귀의 퇴적은
    // 세계가 설 때 고갈로 섰다가 첫 물길에 실려 오고(C014), 그 도착이 그 방 둘레의 흔적을
    // 한 단계 바꾼다. 그것은 때가 아니라 세계 시각이 하는 일이므로 여기 섞이면 안 된다.
    runTo(world, MIDDAY, 1);
    expect(clockOf(world).dayPhase).toBe(DAY);
    const day = tracesNow();
    for (const target of [MIDNIGHT, LONG_NIGHT_AT + 100, TURN_AT + 10]) {
      runTo(world, target, 1);
      expect({ target, traces: tracesNow() }).toEqual({ target, traces: day });
    }
  });

  it('S-092 (경계 ②) 흔적이 없는 방은 밤에도 아무것도 서지 않는다', () => {
    const world = standingIn(START_REGION_ID);
    const none = () =>
      sampleSpots(START_REGION_ID).every((p) => traceStrengthAt(statesOf(world), START_REGION_ID, p) === 0);
    expect(none()).toBe(true);
    runTo(world, MIDNIGHT, 1);
    expect(clockOf(world).dayPhase).toBe(NIGHT);
    expect(none()).toBe(true);
  });

  it.todo(
    'GAP: 화면의 몫 — 밤의 흔적 구역이 낮보다 진하게 서는가. 세계가 싣는 것은 세기뿐이고 진하기는 View 의 표가 정한다 (spec 기본형 ⑥)',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-010 — 때는 아직 방을 바꾸지 않는다
//
// 철 넷을 견주는 시각은 **물길의 주기(240)에 같은 자리**로 고른다 — 물길은 때가 아니라
// 세계 시각으로 도므로(C014), 주기 안의 자리가 다르면 때 때문이 아닌 차이가 섞인다.
// ─────────────────────────────────────────────────────────────────────

/** 철 넷에서 하나씩 — 넷 다 240 으로 나누어떨어지는 자리다 */
const FOUR_SEASONS = [
  { season: STILL, at: 480 },
  { season: SEEP, at: 1440 },
  { season: LONG_NIGHT, at: 1920 },
  { season: TURN, at: 2160 },
] as const;

/** 그 순간 세계가 쥐고 있는 방의 사실 — 원천 · 통행 · 규칙 · 흔적 세기 */
function roomFacts(w: WorldDriver) {
  const states = statesOf(w);
  return {
    sources: SOURCE_REGIONS.map((region) =>
      sourcesInRegion(region).map((source) => {
        const at = sourcePositionOf(states, source);
        const held = sourceStateOf(states, region, source.id) as SourceStateShape;
        return `${region}/${source.id}@${at.x},${at.z} ${held.phase} taken=${held.taken} site=${held.siteIndex ?? 0} collapsed=${(held.collapsedSites ?? []).join('|')}`;
      }),
    ),
    trace: SOURCE_REGIONS.map((region) =>
      sampleSpots(region).map((p) => traceStrengthAt(states, region, p)),
    ),
    collapsed: SOURCE_REGIONS.map((region) =>
      sampleSpots(region).map((p) => isCollapsedAt(states, region, p)),
    ),
    walkable: SOURCE_REGIONS.map((region) =>
      sampleSpots(region).map((p) => isTraversableAt(terrainOf(region), p.x, p.z)),
    ),
    maze: shapeOf(w)[FANTASY_MAZE]?.rule,
  };
}

describe('SPEC-010 때는 아직 방을 바꾸지 않는다', () => {
  it('S-0101 철 넷에서 원천 · 통행 · 규칙 · 흔적 세기가 한 값도 다르지 않다', () => {
    // Given 아무도 아무것도 하지 않는 세계 (몸은 시작 방에 가만히 서 있다)
    const world = driveWorld(solo);
    let expected: ReturnType<typeof roomFacts> | null = null;
    for (const { season, at } of FOUR_SEASONS) {
      // When 그 철까지 굴린다
      runTo(world, at, 1);
      expect({ at, season: clockOf(world).season }).toEqual({ at, season });
      // Then 네 철에서 한 값도 다르지 않다
      const facts = roomFacts(world);
      if (expected === null) expected = facts;
      else expect({ season, ...facts }).toEqual({ season, ...expected });
    }
  });

  it('S-0102 (경계 ①) 뒤척임이 와도 무너진 자리 · 원천의 자리 · 미로의 패턴은 그대로다', () => {
    // Given 한 번 캐고 되돌아와 자리를 옮긴 원천 — 옛 자리는 무너진 채 남아 있다 (C013)
    const at = pointOf(BIO_ORE_FIELD, NIGHT_SOURCE);
    let world = standingIn(BIO_ORE_FIELD, besideSpot(at), { actorItems: { pickaxe: 1 } });
    for (let i = 0; i < harvestsOf(BIO_ORE_FIELD, NIGHT_SOURCE); i++) {
      expect(mineOnce(world, NIGHT_SOURCE)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    }
    wait(world, recoveryOf(BIO_ORE_FIELD, NIGHT_SOURCE));
    const moved = shapeOf(world)[BIO_ORE_FIELD]?.sources?.[NIGHT_SOURCE];
    expect(moved).toMatchObject({ phase: 'available', siteIndex: 1, collapsedSites: [0] });
    const before = roomFacts(world);
    // When 뒤척임까지 굴린다 (그 사이에 밤도 긴 밤도 지난다)
    runTo(world, TURN_AT + 10, 1);
    expect(clockOf(world).season).toBe(TURN);
    // Then 무너진 자리도 원천의 자리도 미로의 패턴도 그대로다
    expect(roomFacts(world)).toEqual(before);
  });

  it('S-0103 (경계 ②) 되돌아옴은 때와 무관하게 세계 시각으로 돈다 — 밤을 지나 돌아온다', () => {
    // Given 낮이 끝나 갈 무렵 허물을 다 캔다
    const at = pointOf(FOREST_EDGE, 'MOLT_LITTER');
    const world = standingIn(FOREST_EDGE, besideSpot(at), { actorItems: { pickaxe: 3 } });
    runTo(world, DAY_SECONDS - 20, 1);
    for (let i = 0; i < harvestsOf(FOREST_EDGE, 'MOLT_LITTER'); i++) {
      expect(mineOnce(world, 'MOLT_LITTER')).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    }
    expect(shapeOf(world)[FOREST_EDGE]?.sources?.MOLT_LITTER?.phase).toBe('depleted');
    const depletedAt = timeOf(world);
    // When 되돌아오는 길이만큼 기다린다 — 그 사이에 밤이 온다
    wait(world, recoveryOf(FOREST_EDGE, 'MOLT_LITTER'));
    // Then 밤인데도 제 길이대로 돌아왔다
    expect(clockOf(world).dayPhase).toBe(NIGHT);
    expect(timeOf(world)).toBeGreaterThan(DAY_SECONDS);
    expect(timeOf(world) - depletedAt).toBeCloseTo(recoveryOf(FOREST_EDGE, 'MOLT_LITTER'), 6);
    expect(shapeOf(world)[FOREST_EDGE]?.sources?.MOLT_LITTER?.phase).toBe('available');
  });

  it('S-0104 (경계 ②) 물길의 주기도 때와 무관하다 — 밤에도 어귀에 실려 온다', () => {
    // Given 어귀가 빈 채로 선 세계 (C014 그대로) 와 그 흐름
    const flow = inflowOf('RIVER_SILT');
    if (!flow) throw new Error('어귀로 들어오는 흐름이 데이터에 없다');
    const world = standingIn(FOREST_DEEP);
    expect(shapeOf(world)[FOREST_DEEP]?.sources?.RIVER_SILT?.phase).not.toBe('available');
    // When 밤이 시작하는 자리의 활성 구간을 채운다 (밤은 240 에서 시작하고 주기는 240 이다)
    runTo(world, DAY_SECONDS, 1);
    expect(clockOf(world).dayPhase).toBe(NIGHT);
    expect(isFlowActive(flow, timeOf(world))).toBe(true);
    wait(world, recoveryOf(FOREST_DEEP, 'RIVER_SILT'));
    // Then 밤인데도 실려 왔다
    expect(clockOf(world).dayPhase).toBe(NIGHT);
    expect(shapeOf(world)[FOREST_DEEP]?.sources?.RIVER_SILT).toMatchObject({
      phase: 'available',
      taken: 0,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — 이 Cycle 이 얹은 것 때문에 앞의 것이 무너지지 않았는가
// ─────────────────────────────────────────────────────────────────────

// 미로의 데이터를 읽는 자리 (C008 이 세운 것 — c008 ~ c014 하네스 그대로)
const mazeRule = () => regionSpec(FANTASY_MAZE)!.rule!;
const mazeTerrain = () => terrainOf(FANTASY_MAZE);
const entryAt = (): XZ => anchorAt(FANTASY_MAZE, 'ANCIENT_GATE');
const patternNames = () => mazeRule().patterns.map((p) => p.name);
const nextOf = (name: string): string => {
  const names = patternNames();
  return names[(names.indexOf(name) + 1) % names.length]!;
};

interface Spot extends XZ {
  cells: string[];
  passages: string[];
  traversable: boolean;
}
let spotsMemo: Spot[] | null = null;
function mazeSpots(): Spot[] {
  if (spotsMemo) return spotsMemo;
  const t = mazeTerrain();
  spotsMemo = gridSpots(FANTASY_MAZE).map((p) => ({
    ...p,
    cells: tagsAt(t, p.x, p.z, CELL_LAYER),
    passages: tagsAt(t, p.x, p.z, PASSAGE_LAYER),
    traversable: isTraversableAt(t, p.x, p.z),
  }));
  return spotsMemo;
}
const cellSpots = (cell: string): Spot[] =>
  mazeSpots().filter((s) => s.traversable && s.passages.length === 0 && s.cells.includes(cell));

function mazeState(w: WorldDriver) {
  const held = shapeOf(w)[FANTASY_MAZE];
  if (!held?.rule) throw new Error('미로에 규칙 State 가 없다');
  return held.rule;
}

function primedMaze(at: XZ, pressure: number): WorldDriver {
  const base = driveWorld({ ...solo, actorRegion: FANTASY_MAZE, actorPosition: { x: at.x, z: at.z } });
  return worldFrom(base, (s) => {
    const held = (s.regionStates as unknown as RegionStatesShape)[FANTASY_MAZE]!;
    held.rule!.pressure = pressure;
  });
}

function walkUntil(w: WorldDriver, path: readonly XZ[], stop: () => boolean, limitTicks = 40000) {
  let leg = 0;
  const order = () => expect(move(w, path[leg % path.length]!).status).toBe('success');
  order();
  for (let i = 0; i < limitTicks; i++) {
    w.tick(TICK_INTERVAL);
    if (stop()) return i + 1;
    if (actorOf(w).currentAction.kind !== 'move') {
      leg += 1;
      order();
    }
  }
  throw new Error('걸어도 그 일이 일어나지 않았다');
}

describe('회귀', () => {
  it('R-001 (C011 · C012) 캐지 않은 세계의 흔적 사다리와 원천이 그대로다', () => {
    const w = driveWorld(solo);
    for (const region of SOURCE_REGIONS) {
      for (const source of sourcesInRegion(region)) {
        const held = sourceStateOf(statesOf(w), region, source.id) as SourceStateShape;
        // 어귀의 퇴적만 고갈로 서고(C014) 나머지는 available · taken 0 이다
        expect({
          id: source.id,
          settled: source.id === 'RIVER_SILT' ? held.phase !== 'available' : held.phase === 'available',
        }).toEqual({ id: source.id, settled: true });
      }
      // 그리고 원천은 저마다 자기 방 바닥보다 짙은 자리 위에 서 있다
      const floor = sampleSpots(region).reduce(
        (low, at) => Math.min(low, traceStrengthAt(statesOf(w), region, at)),
        Infinity,
      );
      for (const source of sourcesInRegion(region)) {
        const at = sourcePositionOf(statesOf(w), source);
        expect({
          id: source.id,
          deeper: traceStrengthAt(statesOf(w), region, at) >= floor,
        }).toEqual({ id: source.id, deeper: true });
      }
    }
  });

  it('R-002 (C012 · C013) 낮에 캐는 일과 되돌아옴이 그대로 돈다', () => {
    const at = pointOf(BIO_ORE_FIELD, NIGHT_SOURCE);
    const world = standingIn(BIO_ORE_FIELD, besideSpot(at), { actorItems: { pickaxe: 1 } });
    expect(clockOf(world).dayPhase).toBe(DAY);
    expect(mine(world, NIGHT_SOURCE)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    tickFor(world, MINE_SECONDS + TICK_INTERVAL);
    expect(shapeOf(world)[BIO_ORE_FIELD]?.sources?.[NIGHT_SOURCE]?.taken).toBe(1);
    expect(mine(world, 'c015-test:no-such-source')).toMatchObject({ reason: 'unknown-source' });
  });

  it('R-003 (C008) 미로의 압력 → 재배열이 때와 무관하게 그대로 돈다', () => {
    const from = entryAt();
    const cell = tagsAt(mazeTerrain(), from.x, from.z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(cell), (s) => distanceBetween(s, from));
    const first = patternNames()[0]!;
    const primed = primedMaze(from, mazeRule().pressureLimit - 3);
    // 밤부터 걷는다 — 밤이라고 규칙이 멎지 않는다
    runTo(primed, MIDNIGHT, 1);
    expect(clockOf(primed).dayPhase).toBe(NIGHT);
    walkUntil(primed, [far, from], () => mazeState(primed).pattern !== first);
    const after = mazeState(primed);
    expect(after.pattern).toBe(nextOf(first));
    expect(after.pressure).toBe(0);
    expect(after.rearrangedAt).toBeDefined();
  });

  it('R-004 (C010) 관찰자 둘이 같은 세계를 본다 — 때가 그 사실을 흐리지 않는다', () => {
    const world = two(FANTASY_MAZE, entryAt(), START_REGION_ID, walkableSpots(START_REGION_ID)[0]!);
    runTo(world, MIDNIGHT, 1);
    // 서로 다른 방에 있으므로 서로가 보이지 않고 (C010 그대로), 세계에는 둘이 이어져 있다
    expect(entityOf(world.observe(OBSERVER), PLAYER_2)).toBeUndefined();
    expect(hudValue(world.observe(OBSERVER), 'observers.present')).toBe(2);
    expect(hudValue(world.observe(OBSERVER_2), 'observers.present')).toBe(2);
  });

  it('R-005 (C001~C007) 백왕령이 그대로다 — 밤에도 몸이 서고 걸을 수 있고 출구가 보인다', () => {
    const w = driveWorld(solo);
    runTo(w, MIDNIGHT, 1);
    expect(actorOf(w).regionId).toBe(START_REGION_ID);
    const view = w.observe();
    expect(view.region.id).toBe(START_REGION_ID);
    expect(sourcesIn(view)).toEqual([]);
    expect(exitsIn(view).length).toBeGreaterThan(0);
    const from = here(w);
    const to = maxBy(
      walkableSpots(START_REGION_ID).filter((p) => distanceBetween(p, from) < 8),
      (p) => distanceBetween(p, from),
    );
    expect(move(w, to).status).toBe('success');
  });

  it('R-006 (원칙 8 · SPEC-010 경계 ③) 앞 Cycle 의 시나리오가 서던 자리는 밤에도 원천을 본다', () => {
    // 그 앞 Cycle 들은 방 한가운데(기본 자리)에 서서 원천을 관찰했고, 되돌아옴(180)과
    // 물길(240)을 기다리는 동안 그 시각이 밤으로 넘어간다. **세계의 값이 아니라 그 시나리오가
    // 무엇을 보고 있었는가**를 옮긴다 — 그 자리에서 원천이 밤에도 실리는가.
    for (const region of SOURCE_REGIONS) {
      for (const source of sourcesInRegion(region)) {
        const world = standingIn(region);
        runTo(world, MIDNIGHT, 1);
        expect({ region, id: source.id, phase: clockOf(world).dayPhase }).toEqual({
          region,
          id: source.id,
          phase: NIGHT,
        });
        expect({ region, id: source.id, seen: entityOf(world.observe(), source.id) !== undefined }).toEqual(
          { region, id: source.id, seen: true },
        );
      }
    }
    // 그리고 원천 곁에 선 자리(c013 의 beside)는 말할 것도 없다
    const at = pointOf(BIO_ORE_FIELD, NIGHT_SOURCE);
    const beside = standingIn(BIO_ORE_FIELD, besideSpot(at));
    runTo(beside, MIDNIGHT, 1);
    expect(entityOf(beside.observe(), NIGHT_SOURCE)).toBeDefined();
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 화면의 몫 — 한 방에 서서 기다릴 때 하늘과 바닥이 실제로 어두워졌다 밝아지는가 (Observable 1 · 3 · 4). 세계는 때의 코드만 싣는다',
  );
  it.todo(
    'GAP: 화면의 몫 — 밤에 붉은 흙이 낮보다 또렷한가 (Observable 5). 세계가 싣는 흔적 세기는 S-091 이 불변으로 재고, 진하기는 View 의 표가 정한다',
  );
  it.todo(
    'GAP: 관찰자가 밤에 **멀리가 지워지는 것을 겪는가** — 사라짐이 사람에게 어떻게 읽히는지(놀람 · 다가감)는 이 층에서 잴 것이 없다 (촬영과 실주행이 답할 자리)',
  );
  it.todo(
    'GAP: 밤의 범위가 **몸이 옮겨 가는 도중**에 어떻게 갈리는가 — spec 은 "관찰자의 몸에서" 만 말하고 Tick 앞뒤 어느 자리를 재는지 말하지 않아 한 Tick 어긋남을 기대값으로 세울 수 없다 (c014 가 남긴 결손과 같은 갈래)',
  );
});
