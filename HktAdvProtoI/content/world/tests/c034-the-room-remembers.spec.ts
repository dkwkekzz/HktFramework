// C034 — 방이 기억한다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-007 + 회귀 SPEC-008)
//
// C033 까지 세계의 State 는 **전부 지워지는 것**이었다. 되돌아옴이 캔 횟수를 0 으로 되돌리고,
// 뒤척임이 자국과 발자국을 묻고, 시간이 소란을 가라앉혔다. 이 Cycle 이 처음으로
// **지워지지 않는 것** 하나를 세운다 — 방의 기억이다. 그래서 재는 것은 다섯이다:
//   ① 셈 — 다섯 자리(채취 완료 · 고갈 · 뒤척임 · 깨어남 · 경로 통과)가 조건 없이 올린다.
//      관찰자가 없어도 오르고, 누가 했는지는 어디에도 없다
//   ② 지워지지 않음 — 되돌아옴도 뒤척임도 그 셈을 못 지운다. taken 이 0 으로 돌아가도
//      takenTotal 은 남는다
//   ③ 남음 — 저장하고 되살려도 그대로다. 옛 판(hkt-adv-proto-i/10)은 되살아나지 않는다
//   ④ 실림 — 관찰이 원천의 기억과 선 방의 기억을 싣는다. **나이는 싣지 않는다** — 시각만
//      싣고 "N초 전" 은 관찰자가 짓는다
//   ⑤ 불변 — 앞의 세계(phase · taken · 되돌아옴 · 소란 · 자국 · 위상 · 문 · 땅 · hash)가
//      한 값도 달라지지 않고, **규칙은 기억을 읽지 않는다**
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/world/semantic/region-state.ts 의 새 부분 · content/view 의 새 줄 ·
// engine/world-authoring/check.ts 의 새 검사 본문)은 **읽지 않았다.** 기대값의 출처는
// cycles/C034-the-room-remembers/spec.md 와 content/protocol/gameview.ts 의 관찰 계약뿐이다.
//
// **이름도 자리도 손으로 적지 않는다** — 원천의 캘 횟수와 되돌아옴의 길이는 resourceEcology 에서,
// 뒤척임을 밝힌 방과 그것이 옮기는 원천은 phases.onTurn 에서, 경로가 지나는 방들은 세계 State 의
// route 에서 읽는다. 손으로 적는 수는 spec 의 「데이터 값」 표(300 · 10 · 0.5 · 45 · 20)와
// 이름 둘(MOLT_LITTER · 경로 두 이름)뿐이고, 그것은 spec 이 못 박은 것이거나 저장되지 않는
// 헤더 상수라 세계에서 가져올 자리가 없다 (c013 · c015 · c017 · c018 의 규율 그대로).
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다. 검사 항목 수도
// 원천 수도 방 수도 세지 않는다.
//
// **여기서 재지 않는 것** — 판의 「기억」 줄의 **문구**(SPEC-006 의 판)는 View 의 표가 짓는다.
// 세계 쪽에서 잴 수 있는 것은 그 판이 읽는 값(entities[].memory · region.memory)까지다
// (c030 이 세운 그 경계 그대로).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  descriptionHash,
  pointsOf,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import type { CheckItem, CheckReport } from '../../../engine/world-authoring/check';
import {
  ANCHOR_LAYER,
  COMPILE_RULES,
  DEPTH_LAYER,
  FOREST_EDGE,
  ORE_EATER,
  PRESENCE_ROUTES,
  REGION_SPECS,
  RESOURCE_LAYER,
  START_REGION_ID,
  regionSpec,
  type ResourceSourceSpec,
  type SeasonId,
} from '../../regions';
// C008 이 세운 미로의 이름 — 그 파일이 소유한다 (c008 ~ c031 시나리오의 선례 그대로).
import { FANTASY_MAZE } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type {
  EntityView,
  GameViewSnapshot,
  RegionMemoryView,
  SourceMemoryView,
} from '../../protocol/gameview';
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
import { sourcePositionOf, sourceStateOf, sourcesInRegion } from '../semantic/resource';
import { driveWorld, OBSERVER, OBSERVER_2, type WorldDriver } from './drive';

// ── spec 의 「데이터 값」 표 · 앞선 Cycle 의 헤더 상수 (저장되지 않는다) ─
/** 소란의 임계 · 채취 한 번 · 고요의 가라앉음 (C017 · spec 데이터 값 절) */
const DISTURBANCE_THRESHOLD = 300;
const DISTURBANCE_PER_HARVEST = 10;
const DISTURBANCE_DECAY_PER_SECOND = 0.5;
/** 지나가는 것이 마디 하나에 머무는 세계 초 (C018) */
const PRESENCE_SECONDS_PER_NODE = 45;
/** 밤에 몸과 원천이 실리는 거리 (C015) */
const OBSERVE_RANGE_NIGHT = 20;
/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (C011~C018 어법) */
const MINE_SECONDS = 1.2;

/** 실주행이 쓰는 원천 — spec 데이터 값 절이 이름으로 못 박았다 (harvests 3 · recoverySeconds 60) */
const MOLT_LITTER = 'MOLT_LITTER';
/** 경로 둘 — spec 데이터 값 절이 이름으로 못 박았다 (C018 의 데이터) */
const SKY_WHALE_ROUTE = 'SKY_WHALE_ROUTE';
const BLIND_HUNTER_ROUTE = 'BLIND_HUNTER_ROUTE';

/** phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';
const RECOVERING = 'recovering';
/** 되돌아옴이 눈에 보이기 시작하는 지점 (C013 기본형 ①) */
const RECOVERY_VISIBLE_FRACTION = 0.5;
/** 거절 사유 둘 (C012 · C013 그대로 — 회귀에 쓴다) */
const SOURCE_DEPLETED = 'source-depleted';
const SOURCE_RECOVERING = 'source-recovering';

/** 소란의 위상 둘 (C017 그대로) */
const DORMANT = 'dormant';
const AWAKE = 'awake';

/** spec 이 적은 State 형 버전 — 이 Cycle 이 여기까지 올린다 (SPEC-005) */
const RAISED_STATE_VERSION = 'hkt-adv-proto-i/11';
/** 그 앞의 판 — 옛 스냅샷은 되살아나지 않는다 (spec Observable 6) */
const OLD_STATE_VERSION = 'hkt-adv-proto-i/10';

// ── 철의 이름과 자리 (clock.ts 의 상수에서 유도한다 · c016 ~ c018 그대로) ─
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
 * 이 시나리오들이 재는 것은 **셈**이다 — 그 위에 얹힌 생명(C022 · C023)은 여기 없다.
 * c013 이 세운 어법 그대로 **광식충이 이미 가득한 숲**에서 잰다 (상한이면 결속도 계승도
 * 서지 않아, 60 초 넘게 기다리는 이 시나리오들의 전제가 깨지지 않는다).
 */
const solo: WorldSetup = { npcs: [], populations: { [ORE_EATER]: 99 } };

// ── 계약이 준 형 (spec State 절 그대로 적어 둔다) ────────────────────
//
// 이 파일은 구현의 형을 읽지 않는다. spec 이 글로 적은 자리를 여기 다시 적고,
// 세계가 내놓은 값을 그 형으로 좁혀 본다.

/** 그 원천에 일어난 일의 셈 (spec State: history.sources[sourceId]) */
interface SourceMemoryShape {
  takenTotal: number;
  depletedTimes: number;
  /** 마지막 고갈의 세계 시각 — 한 번도 고갈된 적 없으면 없다(또는 null) */
  lastDepletedAt?: number | null;
}
/** 횟수와 마지막 시각 하나 (spec State: awakenings · passages[routeId]) */
interface CountShape {
  times: number;
  lastAt?: number | null;
}
/** 방의 기억 (spec State: RegionState.history — 물음표가 없다 · 모든 방에 선다) */
interface HistoryShape {
  sources?: Record<string, SourceMemoryShape>;
  turns: number;
  awakenings: CountShape;
  passages?: Record<string, CountShape>;
}
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
  history?: HistoryShape;
}
type RegionStatesShape = Record<string, RegionStateShape>;

/** 경로의 지금 (C018 이 세운 자리 — 이 파일은 route 만 읽는다) */
interface PresenceStateShape {
  startedAt?: number;
  startedCycle?: number;
  passes: number;
  route?: string[];
}
type PresencesShape = Record<string, PresenceStateShape>;

/** 원천에 실리는 자리들 (C012 · C013 · C034 의 것) */
type SourceView = EntityView & { memory?: SourceMemoryView };

// ── 하네스 (c013 · c016 · c017 · c018 의 선례 그대로) ────────────────
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
/** 지금까지 적용한 뒤척임의 수 — C016 이 세운 자리 (뒤척임이 실제로 왔는가의 증인) */
const turnsAppliedOf = (w: WorldDriver): number =>
  (state(w) as unknown as { turnsApplied: number }).turnsApplied;

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
const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);

/** 그 문의 anchor 자리 — 이름과 자리를 데이터에서 읽는다 (c017 의 anchorAt 그대로) */
const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;

/** 그 자리의 손 닿는 곳 — InteractionRange 안이다 */
const besideSpot = (at: XZ): XZ => ({ x: at.x + INTERACTION_RANGE / 2, z: at.z });
/** 그 방에서 걸어 설 수 있는 자리 하나 */
const anySpot = (region: string): XZ => walkableSpots(region)[0]!;

/** C011 이 놓은 자리 — resource layer point 하나 */
const pointOf = (region: string, id: string): XZ =>
  pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id)!.position;

/** 그 원천의 성질 — 그 방 resourceEcology 가 소유한다 (c017 · c018 의 ecologyOf 그대로) */
function ecologyOf(region: string, id: string): ResourceSourceSpec {
  const found = regionSpec(region)?.resourceEcology?.sources.find((s) => s.id === id);
  if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다 (${region})`);
  return found;
}
/** 캘 수 있는 횟수 · 되돌아오는 데 걸리는 세계 초 — 데이터가 소유한다 (여기 적지 않는다) */
const harvestsOf = (region: string, id: string): number => ecologyOf(region, id).harvests;
function recoveryOf(region: string, id: string): number {
  const seconds = ecologyOf(region, id).recoverySeconds;
  if (!(typeof seconds === 'number' && seconds > 0)) {
    throw new Error(`원천 '${id}' 에 recoverySeconds 가 없다 (${region})`);
  }
  return seconds;
}
/** 철을 타지 않는(어느 철에도 서는) 그 방의 원천 하나 — 이름을 손으로 적지 않는다 */
function plainSourceIn(region: string): string {
  const found = sourcesInRegion(region)
    .map((s) => s.id)
    .find((id) => !ecologyOf(region, id).occurrence && !ecologyOf(region, id).dayPhases);
  if (!found) throw new Error(`${region} 에 철을 타지 않는 원천이 없다`);
  return found;
}

/** 뒤척임을 밝힌 방과 그것이 옮기는 원천 — 데이터가 말한다 (c016 · c018 의 어법 그대로) */
interface PhasesShape {
  seasons?: Record<string, { depthOverlay?: { areaId: string; depth?: string }[] }>;
  onTurn?: { migrateSources?: string[] };
}
const phasesOf = (region: string): PhasesShape | undefined =>
  regionSpec(region)?.phases as unknown as PhasesShape | undefined;
const TURN_ROOMS = REGION_SPECS.map((s) => s.id).filter((id) => phasesOf(id)?.onTurn);
const SEASON_ROOMS = REGION_SPECS.map((s) => s.id).filter((id) => phasesOf(id)?.seasons);

function requireTurnRoom(): string {
  const found = TURN_ROOMS[0];
  if (!found) throw new Error('뒤척임을 밝힌 방이 데이터에 없다 (C016 이 세운 자리)');
  return found;
}
function requireMigrating(region: string): string {
  const found = phasesOf(region)?.onTurn?.migrateSources?.[0];
  if (!found) throw new Error(`${region} 이 옮길 원천을 밝히지 않았다`);
  return found;
}

/** 경로가 지나는 방들 — C018 의 데이터가 소유한다 (이름을 손으로 잇지 않는다) */
function roomsOnRoute(routeId: string): string[] {
  const route = PRESENCE_ROUTES.find((r) => r.id === routeId);
  if (!route) throw new Error(`데이터가 경로 '${routeId}' 를 모른다`);
  return [...new Set(route.nodes.flatMap((node) => node.map((c) => c.region)))];
}
/** 그 경로의 의미 코드 — 관찰이 방의 기억을 이 코드로 싣는다 (관찰 계약) */
function presenceCodeOf(routeId: string): string {
  const route = PRESENCE_ROUTES.find((r) => r.id === routeId);
  if (!route) throw new Error(`데이터가 경로 '${routeId}' 를 모른다`);
  return route.presence;
}
/** 어느 경로도 지나지 않는 방들 — "아무 일도 없던 방" 과 가라앉힘을 재는 자리다 */
const ROUTE_ROOMS = new Set([
  ...roomsOnRoute(SKY_WHALE_ROUTE),
  ...roomsOnRoute(BLIND_HUNTER_ROUTE),
]);
const QUIET_ROOMS = REGION_SPECS.map((s) => s.id).filter((id) => !ROUTE_ROOMS.has(id));

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
/** dt 를 잘게 나누어 준다 (기본 한 걸음 1 세계 초) — c013 ~ c018 의 wait 선례 그대로 */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}
/**
 * 그 원천이 그 phase 에 닿을 때까지 굴린다 — **되돌아옴의 길이를 손으로 적지 않는다.**
 *
 * C024 뒤로 되돌아옴의 진행에 **개체군의 배속**이 곱해진다 (RULE-RECOVERY-SPEED-001) —
 * 그래서 데이터의 `recoverySeconds` 는 더 이상 그 원천이 실제로 걸리는 시간이 아니다
 * (허물이 그 배속을 밝힌 원천이다). 이 Cycle 이 재는 것은 **셈이 그대로인가**이지
 * 되돌아옴이 몇 초인가가 아니므로, 문턱을 어림하지 않고 세계가 그 자리에 설 때까지 굴린다.
 */
function runUntilPhase(w: WorldDriver, region: string, id: string, phase: string, limit = 600) {
  for (let i = 0; i < limit; i++) {
    if (storedOf(w, region, id).phase === phase) return;
    w.tick(1);
  }
  expect({ id, phase: storedOf(w, region, id).phase }).toEqual({ id, phase });
}
/** 그 세계 시각까지 굴린다 (c016 ~ c018 선례) */
function runTo(w: WorldDriver, target: number, step = 60) {
  const left = target - timeOf(w);
  if (left <= 1e-9) return;
  wait(w, left, step);
}
const SEASON_MARGIN = 1;
/** 그 철 **안으로** 굴린다 (c017 · c018 선례) */
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
/** 그 원천이 고갈될 때까지 캔다 (c013 의 mineUntilDepleted 그대로) */
function mineUntilDepleted(w: WorldDriver, region: string, id: string, observerId = OBSERVER) {
  for (let i = 0; i < harvestsOf(region, id); i++) {
    expect({ nth: i + 1, ...mineOnce(w, id, observerId) }).toEqual({
      nth: i + 1,
      status: 'success',
      rule: 'RULE-MINE-001',
    });
  }
}
const cross = (w: WorldDriver, connector: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector }, observerId);

/** 그 자리까지 걷는다 (c009 ~ c018 의 선례 그대로) */
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

/** 그 방에서 곧게 걸을 수 있는 가장 긴 줄 — 걸음으로 자국을 내는 자리다 (c017 · c018 그대로) */
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

// ── 저장·복구 (c013 ~ c018 의 선례 그대로) ──────────────────────────
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

/**
 * 그 방의 소란을 그만큼 **이미 겪은** 세계로 만든다 (c017 · c018 의 charge 그대로).
 * **위상은 손으로 적지 않는다** — 잠듦으로 두고, 깨우는 것은 언제나 세계의 규칙이 한다.
 */
function charge(s: WorldState, region: string, value: number) {
  const states = s.regionStates as unknown as RegionStatesShape;
  const held = (states[region] ??= {});
  held.disturbance = { value, phase: DORMANT };
}

// ── 이 Cycle 이 세운 자리를 읽는다 (spec State 절의 점 경로) ──────────
/**
 * 그 방의 기억 — spec State 절이 "모든 방에 선다 (물음표가 없다)" 고 못 박은 자리다.
 * 자리가 없으면 그것이 곧 **아직 없는 자리**라는 답이므로 무엇이 없는지 밝히고 멈춘다.
 */
function historyOf(w: WorldDriver, region: string): HistoryShape {
  const held = shapeOf(w)[region]?.history;
  if (!held) {
    throw new Error(
      `세계 State 에 ${region} 의 history 자리가 없다 — spec State 절이 "RegionState.history · 모든 방에 선다" 고 못 박았다`,
    );
  }
  return held;
}
/** 그 원천의 셈 — 한 번도 캔 적 없으면 자리가 없다 */
const sourceMemoryOf = (
  w: WorldDriver,
  region: string,
  id: string,
): SourceMemoryShape | undefined => historyOf(w, region).sources?.[id];
/** 그 경로가 그 방을 지난 셈 — 지난 적 없으면 자리가 없다 */
const passageOf = (w: WorldDriver, region: string, routeId: string): CountShape | undefined =>
  historyOf(w, region).passages?.[routeId];
/** "한 번도 없었다" — 자리가 없거나 시각이 없는 것 (저장된 표시가 아니다) */
const noTime = (at: number | null | undefined): boolean => at === undefined || at === null;

/** 경로의 지금 (C018 이 세운 자리) */
function presencesOf(w: WorldDriver): PresencesShape {
  const held = (state(w) as unknown as { presences?: PresencesShape }).presences;
  if (!held) throw new Error('세계 State 에 presences 자리가 없다 (C018 이 세운 자리)');
  return held;
}
const routeStateOf = (w: WorldDriver, routeId: string): PresenceStateShape => {
  const held = presencesOf(w)[routeId];
  if (!held) throw new Error(`세계가 경로 '${routeId}' 를 모른다`);
  return held;
};
const isPassing = (w: WorldDriver, routeId: string): boolean =>
  routeStateOf(w, routeId).startedAt !== undefined;
const routeRoomsOf = (w: WorldDriver, routeId: string): string[] =>
  routeStateOf(w, routeId).route ?? [];
/** 그 경로가 시작한 뒤 이만큼 흐른 자리까지 굴린다 (c018 그대로) */
function runToElapsed(w: WorldDriver, routeId: string, elapsed: number, step = 1) {
  const held = routeStateOf(w, routeId);
  if (held.startedAt === undefined) throw new Error(`경로 '${routeId}' 는 지금 지나고 있지 않다`);
  runTo(w, held.startedAt + elapsed, step);
}
/** 마디 k 의 한가운데까지 굴린다 */
const runToNode = (w: WorldDriver, routeId: string, node: number, step = 1) =>
  runToElapsed(w, routeId, node * PRESENCE_SECONDS_PER_NODE + PRESENCE_SECONDS_PER_NODE / 2, step);

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────
const sourceEntity = (v: GameViewSnapshot, id: string): SourceView | undefined =>
  v.entities.find((e) => e.role === 'resource-source' && e.id === id) as SourceView | undefined;
/** 지목한 대상(원천) 프레임이 읽는 자리 — 판의 「기억」 줄이 이것을 옮긴다 */
const seenSourceMemory = (
  w: WorldDriver,
  id: string,
  observerId = OBSERVER,
): SourceMemoryView | undefined => sourceEntity(w.observe(observerId), id)?.memory;
/** 내가 선 자리의 판이 읽는 자리 */
const seenRegionMemory = (w: WorldDriver, observerId = OBSERVER): RegionMemoryView =>
  w.observe(observerId).region.memory;
const seenDisturbance = (w: WorldDriver, observerId = OBSERVER) =>
  w.observe(observerId).region.disturbance;
const seenValue = (w: WorldDriver, observerId = OBSERVER): number =>
  seenDisturbance(w, observerId).value;
const seenPhase = (w: WorldDriver, observerId = OBSERVER): string =>
  seenDisturbance(w, observerId).phase;
const seasonOf = (w: WorldDriver, observerId = OBSERVER): string =>
  w.observe(observerId).clock.season;
const depthSeen = (w: WorldDriver, observerId = OBSERVER): unknown =>
  w.observe(observerId).hud.find((h) => h.id === 'region.depth')?.value;
const hudIds = (w: WorldDriver, observerId = OBSERVER): string[] =>
  w.observe(observerId).hud.map((h) => h.id).sort();
const storedOf = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w), region, id) as SourceStateShape;
const sourceAt = (w: WorldDriver, region: string, id: string): XZ => {
  const source = sourcesInRegion(region).find((s) => s.id === id)!;
  const at = sourcePositionOf(statesOf(w), source);
  return { x: at.x, z: at.z };
};
/** 그 원천 곁에 몸을 세운 세계 */
function beside(w: WorldDriver, region: string, id: string, observerId = OBSERVER): WorldDriver {
  return moveBody(w, region, besideSpot(sourceAt(w, region, id)), bodyOf(w, observerId));
}
/** 곡괭이를 지닌 몸이 그 원천 곁에 선 세계 */
function atSource(region: string, id: string, extra: WorldSetup = {}): WorldDriver {
  const base = standingIn(region, undefined, { actorItems: { pickaxe: 9 }, ...extra });
  return beside(base, region, id);
}

// ── 도구를 밖에서 돌린다 (c018 의 선례 그대로) ───────────────────────
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CHECK = 'tools/world-editor/check.ts';
function runTool(script: string, args: readonly string[]) {
  const result = spawnSync('npx', ['tsx', script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 방이 센다 — 셈은 조건 없이 오른다', () => {
  it('S-203 채취를 마치면 그 원천의 takenTotal 이 하나 오른다 (다섯 자리 중 채취 완료)', () => {
    // Given 곡괭이를 지닌 몸이 허물 곁에 선다 — 아직 아무것도 캐지 않았다
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    expect(sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)).toBeUndefined();
    // When 한 번 캔다
    expect(mineOnce(w, MOLT_LITTER)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    // Then 그 방의 기억에 그 원천의 자리가 나고 캐인 횟수가 하나다
    expect(sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)).toMatchObject({
      takenTotal: 1,
      depletedTimes: 0,
    });
    // And 캘 횟수(taken)도 함께 하나다 — 두 값이 지금은 같다 (갈리는 것은 SPEC-002 다)
    expect(storedOf(w, FOREST_EDGE, MOLT_LITTER).taken).toBe(1);
  });

  it('S-204 고갈되면 depletedTimes 가 오르고 그 세계 시각이 남는다 (다섯 자리 중 고갈)', () => {
    // Given 곡괭이를 지닌 몸이 허물 곁에 선다
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    const harvests = harvestsOf(FOREST_EDGE, MOLT_LITTER);
    // When 캘 수 있는 만큼 다 캔다
    for (let i = 0; i < harvests - 1; i++) expect(mineOnce(w, MOLT_LITTER).status).toBe('success');
    expect(storedOf(w, FOREST_EDGE, MOLT_LITTER).phase).toBe(AVAILABLE);
    expect(noTime(sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)?.lastDepletedAt)).toBe(true);
    const before = timeOf(w);
    expect(mineOnce(w, MOLT_LITTER).status).toBe('success');
    const after = timeOf(w);
    // Then 고갈되었고 셈 셋이 다 섰다
    expect(storedOf(w, FOREST_EDGE, MOLT_LITTER).phase).toBe(DEPLETED);
    const memory = sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)!;
    expect({ takenTotal: memory.takenTotal, depletedTimes: memory.depletedTimes }).toEqual({
      takenTotal: harvests,
      depletedTimes: 1,
    });
    // And 마지막 고갈의 시각은 그 채취가 마쳐진 그 세계 시각이다
    expect(memory.lastDepletedAt).toBeGreaterThanOrEqual(before);
    expect(memory.lastDepletedAt).toBeLessThanOrEqual(after);
  });

  it('S-205 (경계 ①) 관찰자가 그 방에 없어도 깨어남 · 지나감 · 뒤척임이 세어진다', () => {
    // Given 관찰자는 미로에 홀로 서 있고, 소란은 **다른 방**에 이미 임계만큼 쌓여 있다
    const asleep = QUIET_ROOMS.find((id) => id !== FANTASY_MAZE);
    if (!asleep) throw new Error('어느 경로도 지나지 않는 방이 데이터에 없다');
    const w = standingIn(FANTASY_MAZE, undefined, {
      disturbances: { [asleep]: DISTURBANCE_THRESHOLD },
    });
    for (const actor of state(w).actors) expect(actor.regionId).not.toBe(asleep);
    // Then 아무도 없는 그 방이 세계의 규칙으로 깨어났고 그 셈이 올랐다
    expect(shapeOf(w)[asleep]?.disturbance?.phase).toBe(AWAKE);
    expect(historyOf(w, asleep).awakenings.times).toBe(1);
    expect(noTime(historyOf(w, asleep).awakenings.lastAt)).toBe(false);

    // And 아무도 보지 않는 방들 위를 지나가는 것도 세어진다 (세계가 선 그 시각에 지나간다)
    expect(isPassing(w, SKY_WHALE_ROUTE)).toBe(true);
    const rooms = routeRoomsOf(w, SKY_WHALE_ROUTE);
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms).not.toContain(FANTASY_MAZE);
    // 세계는 든 것을 **다음 Tick 에 읽는다** (c016 S-064 가 적은 그 어긋남 그대로 —
    // 실주행의 Tick 은 1/30 초라 보이지 않는다). 그래서 한 걸음 굴린 뒤에 잰다
    w.tick(TICK_INTERVAL);
    expect(passageOf(w, rooms[0]!, SKY_WHALE_ROUTE)?.times).toBe(1);

    // When 뒤척임까지 굴린다 (관찰자는 내내 미로에 있다)
    runToSeason(w, TURN);
    expect(turnsAppliedOf(w)).toBe(1);
    // Then 관찰자가 한 번도 들지 않은 방도 뒤척임을 세었다
    expect(historyOf(w, asleep).turns).toBe(1);
  });

  it('S-206 (경계 ②) 관찰자가 둘이어도 셈은 하나다 — 누가 했는지는 어디에도 없다', () => {
    // Given 관찰자 둘이 같은 방에 선 세계 (몸 둘 다 곡괭이를 지닌다)
    const base = driveWorld({
      ...solo,
      actorRegion: FOREST_EDGE,
      actorItems: { pickaxe: 9 },
    });
    base.join(OBSERVER_2);
    base.tick(0);
    const both = [OBSERVER, OBSERVER_2];
    const bodyA = bodyOf(base, OBSERVER);
    const bodyB = bodyOf(base, OBSERVER_2);
    const at = sourceAt(base, FOREST_EDGE, MOLT_LITTER);
    const away = maxBy(walkableSpots(FOREST_EDGE), (p) => distanceBetween(p, at));

    // When 첫째가 한 번 캐고, 둘째가 그 자리에 서서 한 번 더 캔다
    const first = worldFrom(
      base,
      (s) => {
        place(s, bodyA, FOREST_EDGE, besideSpot(at));
        place(s, bodyB, FOREST_EDGE, away);
      },
      both,
    );
    expect(mineOnce(first, MOLT_LITTER, OBSERVER).status).toBe('success');
    expect(sourceMemoryOf(first, FOREST_EDGE, MOLT_LITTER)?.takenTotal).toBe(1);
    const second = worldFrom(
      first,
      (s) => {
        place(s, bodyA, FOREST_EDGE, away);
        place(s, bodyB, FOREST_EDGE, besideSpot(at));
      },
      both,
    );
    expect(mineOnce(second, MOLT_LITTER, OBSERVER_2).status).toBe('success');

    // Then 셈은 **하나**다 — 둘의 것이 따로 서지 않고 합쳐 둘이다
    expect(sourceMemoryOf(second, FOREST_EDGE, MOLT_LITTER)).toMatchObject({ takenTotal: 2 });
    // And 누가 했는지는 기억 어디에도 없다 (T2.7 의 규율)
    const written = JSON.stringify(historyOf(second, FOREST_EDGE));
    for (const name of [OBSERVER, OBSERVER_2, bodyA, bodyB]) {
      expect({ name, written: written.includes(name) }).toEqual({ name, written: false });
    }
  });

  it('S-207 (경계 ③) 아무 일도 없던 방의 기억은 비어 있다 — 자리가 있는 것과 값이 찬 것이 다르다', () => {
    // Given 세계가 막 섰다. 어느 경로도 지나지 않고 관찰자도 들지 않은 방을 본다
    const w = standingIn(FANTASY_MAZE);
    const quiet = QUIET_ROOMS.find((id) => id !== FANTASY_MAZE);
    if (!quiet) throw new Error('어느 경로도 지나지 않는 방이 데이터에 없다');
    const memory = historyOf(w, quiet);
    // Then 자리는 있는데 값이 비어 있다
    expect(memory.turns).toBe(0);
    expect(memory.awakenings.times).toBe(0);
    expect(noTime(memory.awakenings.lastAt)).toBe(true);
    // And 한 번도 캔 적 없는 원천의 자리도, 지난 적 없는 경로의 자리도 아예 없다
    expect(Object.keys(memory.sources ?? {})).toEqual([]);
    expect(Object.keys(memory.passages ?? {})).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-002 되돌아옴이 셈을 지우지 않는다', () => {
  const harvests = () => harvestsOf(FOREST_EDGE, MOLT_LITTER);
  const recovery = () => recoveryOf(FOREST_EDGE, MOLT_LITTER);

  it('S-208 되돌아와 taken 이 0 인데 takenTotal 은 그대로다 — 처음으로 지워지지 않는 것이다', () => {
    // Given 세 번 캐 고갈시킨 허물
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    mineUntilDepleted(w, FOREST_EDGE, MOLT_LITTER);
    const depleted = { ...sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)! };
    expect(depleted).toMatchObject({ takenTotal: harvests(), depletedTimes: 1 });
    // When 제 길이만큼 기다린다
    wait(w, recovery());
    // Then 원천은 되돌아왔고 캘 횟수는 0 인데
    expect(storedOf(w, FOREST_EDGE, MOLT_LITTER)).toMatchObject({ phase: AVAILABLE, taken: 0 });
    // 셈은 한 값도 달라지지 않았다 — 되돌아옴이 그것을 못 지운다
    expect(sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)).toEqual(depleted);
  });

  it('S-209 (경계 ①) 되돌아오는 도중(recovering)에도 셈은 그대로다', () => {
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    mineUntilDepleted(w, FOREST_EDGE, MOLT_LITTER);
    const depleted = { ...sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)! };
    // When 되돌아옴이 눈에 보이기 시작하는 자리까지만 굴린다 (문턱은 세계가 정한다 —
    // C024 뒤로 개체군의 배속이 그 시간을 바꾸므로 데이터의 초를 어림하지 않는다)
    runUntilPhase(w, FOREST_EDGE, MOLT_LITTER, RECOVERING);
    // Then 셈은 그대로다
    expect(sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)).toEqual(depleted);
  });

  it('S-210 (경계 ②) 다시 캐 고갈시키면 셈이 곱절이고 시각이 새것이다', () => {
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    mineUntilDepleted(w, FOREST_EDGE, MOLT_LITTER);
    const first = sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)!.lastDepletedAt!;
    wait(w, recovery());
    expect(storedOf(w, FOREST_EDGE, MOLT_LITTER).phase).toBe(AVAILABLE);
    // When 다시 다 캔다
    mineUntilDepleted(w, FOREST_EDGE, MOLT_LITTER);
    // Then 캐인 횟수는 곱절이고 고갈은 둘이며 시각이 새것으로 바뀌었다
    const memory = sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)!;
    expect({ takenTotal: memory.takenTotal, depletedTimes: memory.depletedTimes }).toEqual({
      takenTotal: harvests() * 2,
      depletedTimes: 2,
    });
    expect(memory.lastDepletedAt!).toBeGreaterThan(first);
  });

  it('S-211 (경계 ③) 한 번만 캐고 두면 고갈의 셈도 시각도 서지 않는다', () => {
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    expect(harvests()).toBeGreaterThan(1);
    // When 한 번만 캔다 (고갈이 아니다)
    expect(mineOnce(w, MOLT_LITTER).status).toBe('success');
    wait(w, recovery());
    // Then 캐인 횟수만 하나이고 고갈은 0 이며 시각이 없다
    const memory = sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)!;
    expect({ takenTotal: memory.takenTotal, depletedTimes: memory.depletedTimes }).toEqual({
      takenTotal: 1,
      depletedTimes: 0,
    });
    expect(noTime(memory.lastDepletedAt)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-003 뒤척임은 자국을 묻고 셈은 못 묻는다', () => {
  const room = requireTurnRoom();
  const migrating = requireMigrating(room);

  /** 뒤척임을 밝힌 방에서 발자국을 내고 한 번 캔 세계 (뒤척임 바로 앞이다) */
  function markedRoom(): WorldDriver {
    const run = straightRun(room);
    const w = inSeason(LONG_NIGHT, room, run.from, { actorItems: { pickaxe: 9 } });
    walkTo(w, run.to);
    expect(w.observe().tracks.length).toBeGreaterThan(0);
    const staged = beside(w, room, migrating);
    expect(mineOnce(staged, migrating).status).toBe('success');
    return staged;
  }

  it('S-212 자국을 묻는 그 순간 turns 가 하나 오르고 sources 의 셈은 한 값도 달라지지 않는다', () => {
    // Given 발자국이 남고 한 번 캐인 방 (뒤척임 앞이다)
    const w = markedRoom();
    expect(historyOf(w, room).turns).toBe(0);
    const before = { ...sourceMemoryOf(w, room, migrating)! };
    expect(before.takenTotal).toBe(1);
    // When 뒤척임이 지나간다
    runToSeason(w, TURN);
    expect(seasonOf(w)).toBe(TURN);
    expect(turnsAppliedOf(w)).toBe(1);
    // Then 발자국은 묻혔고
    expect(shapeOf(w)[room]?.tracks ?? []).toEqual([]);
    // 뒤척임의 셈이 하나 올랐으며
    expect(historyOf(w, room).turns).toBe(1);
    // 원천의 셈은 한 값도 달라지지 않았다
    expect(sourceMemoryOf(w, room, migrating)).toEqual(before);
  });

  it('S-213 (경계 ③) 뒤척임이 처음으로 되돌린 원천의 taken 은 0 인데 takenTotal 은 그대로다', () => {
    const w = markedRoom();
    expect(storedOf(w, room, migrating).taken).toBe(1);
    // When 뒤척임이 지나간다
    runToSeason(w, TURN);
    // Then 캘 횟수는 처음으로 돌아갔는데
    expect(storedOf(w, room, migrating).taken).toBe(0);
    // 캐인 횟수 누계는 남았다 — 뒤척임도 그것을 못 묻는다
    expect(sourceMemoryOf(w, room, migrating)?.takenTotal).toBe(1);
  });

  it('S-214 (경계 ①) 같은 뒤척임이 두 번 세지 않는다 — 그 60 초 안에 여러 Tick 이 지나도 한 번이다', () => {
    // Given 뒤척임 바로 앞까지 굴린 세계
    const w = inSeason(LONG_NIGHT, room);
    runTo(w, SEASON_AT[TURN] - 1, 60);
    expect(historyOf(w, room).turns).toBe(0);
    // When 뒤척임의 60 초를 **1 초씩** 걷고 그 뒤 하루를 더 간다
    wait(w, TURN_SECONDS + 1, 1);
    expect(seasonOf(w)).not.toBe(TURN);
    // Then 그 사이 예순 번이 넘는 Tick 이 지났어도 셈은 하나다
    expect(historyOf(w, room).turns).toBe(1);
    // And 그 뒤로도 늘지 않는다
    wait(w, TURN_SECONDS * 4, 1);
    expect(historyOf(w, room).turns).toBe(1);
  });

  it('S-215 (경계 ②) 큰 걸음으로 뒤척임을 건너뛰어도 빠뜨리지 않는다', () => {
    const rounds = 3;
    // Given 아무것도 하지 않은 세계
    const w = inSeason(STILL, room);
    expect(historyOf(w, room).turns).toBe(0);
    // When 한 걸음으로 세 바퀴를 통째로 건너뛴다 (그 안에 뒤척임이 셋 있다)
    w.tick(rounds * CYCLE_SECONDS + DAY_SECONDS);
    // 세계는 그 걸음이 **끝난** 시각을 다음 Tick 에 읽는다 (c016 S-064 가 적은 어긋남 그대로)
    w.tick(0);
    // Then 셋이 다 세어졌다 — 하나도 빠지지 않았다
    expect({ applied: turnsAppliedOf(w), counted: historyOf(w, room).turns }).toEqual({
      applied: rounds,
      counted: rounds,
    });
  });

  it('S-216 (R3 경계 ②) 뒤척임을 밝히지 않은 방도 센다 — 뒤척임은 세계의 순간이다', () => {
    const plain = REGION_SPECS.map((s) => s.id).find((id) => !TURN_ROOMS.includes(id));
    if (!plain) throw new Error('뒤척임을 밝히지 않은 방이 없다');
    // Given 뒤척임을 밝히지 않은 방 하나
    const w = inSeason(LONG_NIGHT, plain);
    expect(historyOf(w, plain).turns).toBe(0);
    // When 뒤척임이 지나간다
    runToSeason(w, TURN);
    expect(turnsAppliedOf(w)).toBe(1);
    // Then 그 방도 세었다 — 방마다 하나씩이다
    expect(historyOf(w, plain).turns).toBe(1);
    expect(historyOf(w, requireTurnRoom()).turns).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-004 깨어남과 지나감이 세어진다', () => {
  /** 임계만큼 이미 쌓인 채로 서는, 어느 경로도 지나지 않는 방 (가라앉힘을 흐리지 않는다) */
  const quietRoom = (): string => {
    const found = QUIET_ROOMS.find((id) => id !== FANTASY_MAZE);
    if (!found) throw new Error('어느 경로도 지나지 않는 방이 데이터에 없다');
    return found;
  };

  it('S-217 소란이 임계를 넘어 깨어나면 awakenings 가 오르고 그 시각이 남는다', () => {
    // Given 곡괭이를 지닌 몸이 그 방 원천 곁에 서고, 소란은 임계 코앞이다 (고요다)
    const room = quietRoom();
    const source = plainSourceIn(room);
    const base = standingIn(room, undefined, {
      actorItems: { pickaxe: 9 },
      disturbances: { [room]: DISTURBANCE_THRESHOLD - 1 },
      clock: STILL,
    });
    const w = beside(base, room, source);
    expect(seenPhase(w)).toBe(DORMANT);
    expect(historyOf(w, room).awakenings.times).toBe(0);
    const before = timeOf(w);
    // When 한 번 캔다 — 그 한 걸음이 임계를 채운다 (세계의 규칙이 깨운다)
    expect(mineOnce(w, source).status).toBe('success');
    const after = timeOf(w);
    // Then 그 방이 깨어났고 그 셈이 하나 올랐다
    expect(seenPhase(w)).toBe(AWAKE);
    const awakenings = historyOf(w, room).awakenings;
    expect(awakenings.times).toBe(1);
    expect(awakenings.lastAt!).toBeGreaterThanOrEqual(before);
    expect(awakenings.lastAt!).toBeLessThanOrEqual(after);
  });

  it('S-218 (경계 ①) 깨어 있는 동안 오르내려도 한 번 — 잠들고 다시 넘어야 두 번이다', () => {
    // Given 고요에 임계만큼 쌓여 세계가 서자마자 깨어난, 어느 경로도 지나지 않는 방
    const room = quietRoom();
    const w0 = standingIn(FANTASY_MAZE, undefined, {
      disturbances: { [room]: DISTURBANCE_THRESHOLD },
      clock: STILL,
    });
    expect(shapeOf(w0)[room]?.disturbance?.phase).toBe(AWAKE);
    const firstAt = historyOf(w0, room).awakenings.lastAt;
    expect(historyOf(w0, room).awakenings.times).toBe(1);

    // When 깨어 있는 동안 값이 가라앉는다 (고요는 초당 0.5 를 깎는다)
    wait(w0, 100, 10);
    expect(shapeOf(w0)[room]!.disturbance!.value).toBeCloseTo(
      DISTURBANCE_THRESHOLD - 100 * DISTURBANCE_DECAY_PER_SECOND,
      5,
    );
    // Then 아직 한 번이다 — 깨어 있는 동안의 오르내림은 세지 않는다
    expect(shapeOf(w0)[room]?.disturbance?.phase).toBe(AWAKE);
    expect(historyOf(w0, room).awakenings.times).toBe(1);

    // When 0 에 닿을 때까지 둔다 (고요 안에서 다 가라앉는다)
    wait(w0, DISTURBANCE_THRESHOLD / DISTURBANCE_DECAY_PER_SECOND, 10);
    expect(seasonOf(w0)).toBe(STILL);
    expect(shapeOf(w0)[room]!.disturbance!.value).toBe(0);
    // Then 잠들었고 셈은 그대로 하나다 (깨어남 → 잠듦은 세지 않는다 · R4 경계 ②)
    expect(shapeOf(w0)[room]?.disturbance?.phase).toBe(DORMANT);
    expect(historyOf(w0, room).awakenings.times).toBe(1);

    // When 다시 임계를 넘긴다 (값만 세우고 깨우는 것은 세계의 규칙이 한다)
    const w1 = worldFrom(w0, (s) => charge(s, room, DISTURBANCE_THRESHOLD));
    // Then 그때 비로소 둘이고 시각이 새것이다
    expect(shapeOf(w1)[room]?.disturbance?.phase).toBe(AWAKE);
    const again = historyOf(w1, room).awakenings;
    expect(again.times).toBe(2);
    expect(again.lastAt!).toBeGreaterThan(firstAt as number);
  });

  it('S-219 경로가 한 방에 들면 그 방의 지나감이 오르고 그 시각이 남는다', () => {
    // Given 관찰자는 경로의 어느 방에도 없다 (미로에 홀로 서 있다)
    const w = standingIn(FANTASY_MAZE);
    expect(isPassing(w, SKY_WHALE_ROUTE)).toBe(true);
    const rooms = routeRoomsOf(w, SKY_WHALE_ROUTE);
    expect(rooms.length).toBeGreaterThan(1);
    const started = routeStateOf(w, SKY_WHALE_ROUTE).startedAt!;

    // Then 첫 마디의 방만 세어졌다 — 아직 들지 않은 방에는 자리가 없다
    // (세계는 든 것을 다음 Tick 에 읽는다 — c016 S-064 의 그 어긋남)
    w.tick(TICK_INTERVAL);
    const first = passageOf(w, rooms[0]!, SKY_WHALE_ROUTE);
    expect(first?.times).toBe(1);
    expect(first!.lastAt).toBe(started);
    expect(passageOf(w, rooms[1]!, SKY_WHALE_ROUTE)).toBeUndefined();

    // When 둘째 마디로 굴린다
    runToNode(w, SKY_WHALE_ROUTE, 1, 1);
    // Then 그 방도 세어졌고 시각은 그 마디에 든 자리다
    const second = passageOf(w, rooms[1]!, SKY_WHALE_ROUTE);
    expect(second?.times).toBe(1);
    expect(second!.lastAt!).toBeGreaterThanOrEqual(started + PRESENCE_SECONDS_PER_NODE);
    expect(second!.lastAt!).toBeLessThan(started + PRESENCE_SECONDS_PER_NODE * 2);
    // And 그 마디에 서 있지 않아도 올랐다 (관찰자는 내내 미로에 있다)
    expect(actorOf(w, bodyOf(w)).regionId).toBe(FANTASY_MAZE);
  });

  it('S-220 (경계 ②) 한 지나감이 지나는 방마다 한 번씩이고 같은 방에서 두 번 세지 않는다', () => {
    // Given 관찰자가 경로 밖에 선 세계
    const w = standingIn(FANTASY_MAZE);
    const rooms = routeRoomsOf(w, SKY_WHALE_ROUTE);
    expect(rooms.length).toBeGreaterThan(1);
    // When 그 지나감이 끝날 때까지 굴린다
    wait(w, PRESENCE_SECONDS_PER_NODE * rooms.length + 2, 5);
    expect(isPassing(w, SKY_WHALE_ROUTE)).toBe(false);
    // Then 지나간 방마다 하나씩이다 — 어느 방도 둘이 아니다
    for (const one of rooms) {
      expect({ room: one, times: passageOf(w, one, SKY_WHALE_ROUTE)?.times }).toEqual({
        room: one,
        times: 1,
      });
    }
  });

  it('S-221 (경계 ③) 경로가 지나지 않는 방에는 그 경로의 자리가 아예 없다', () => {
    const w = standingIn(FANTASY_MAZE);
    const rooms = routeRoomsOf(w, SKY_WHALE_ROUTE);
    wait(w, PRESENCE_SECONDS_PER_NODE * rooms.length + 2, 5);
    // Then 그 경로가 들지 않은 방에는 자리가 없다 (0 으로 지어내지 않는다)
    for (const one of QUIET_ROOMS) {
      expect({ room: one, held: passageOf(w, one, SKY_WHALE_ROUTE) }).toEqual({
        room: one,
        held: undefined,
      });
    }
    // And 아직 한 번도 서지 않은 경로의 자리도 어느 방에도 없다
    expect(routeStateOf(w, BLIND_HUNTER_ROUTE).passes).toBe(0);
    for (const one of roomsOnRoute(BLIND_HUNTER_ROUTE)) {
      expect({ room: one, held: passageOf(w, one, BLIND_HUNTER_ROUTE) }).toEqual({
        room: one,
        held: undefined,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-005 기억은 세계에 남는다', () => {
  /** 셈 넷이 다 선 세계 — 캐고 고갈시키고 지나가고 뒤척인다 */
  function remembered(): WorldDriver {
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    mineUntilDepleted(w, FOREST_EDGE, MOLT_LITTER);
    runToSeason(w, TURN);
    return w;
  }
  const historiesOf = (w: WorldDriver): string =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(shapeOf(w))
          .map(([id, held]) => [id, held.history])
          .sort(([a], [b]) => (a as string).localeCompare(b as string)),
      ),
    );

  it('S-222 저장하고 되살린 세계의 기억이 저장 직전과 같다 — 판이 오르고 옛 판은 되살아나지 않는다', () => {
    const w = remembered();
    const before = historiesOf(w);
    expect(sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)?.depletedTimes).toBe(1);
    expect(historyOf(w, FOREST_EDGE).turns).toBe(1);

    // When 파일을 지나 저장하고 되살린다
    const revived = revive(w);
    // Then 방마다의 기억이 한 값도 다르지 않다
    expect(historiesOf(revived)).toBe(before);

    // And 판이 올랐고 옛 판의 스냅샷은 되살아나지 않는다
    expect(STATE_VERSION).toBe(RAISED_STATE_VERSION);
    const snapshot = throughFile(w.world.snapshot());
    expect(snapshot.version).toBe(RAISED_STATE_VERSION);
    expect(restoreWorld(snapshot)).not.toBeNull();
    expect(restoreWorld({ ...snapshot, version: OLD_STATE_VERSION })).toBeNull();
  });

  it('S-223 (경계 ①) 관찰자가 그 방을 떠나 방이 실리지 않아도 남는다', () => {
    // Given 숲 가장자리에서 한 번 캔 뒤
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    expect(mineOnce(w, MOLT_LITTER).status).toBe('success');
    const before = { ...sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)! };
    // When 그 방을 떠난다 (그 방은 이제 관찰에 실리지 않는다)
    const left = moveBody(w, FANTASY_MAZE, anySpot(FANTASY_MAZE), bodyOf(w));
    expect(left.observe().region.id).toBe(FANTASY_MAZE);
    wait(left, 60, 10);
    // Then 떠난 방의 셈은 그대로 남아 있다
    expect(sourceMemoryOf(left, FOREST_EDGE, MOLT_LITTER)).toEqual(before);
    // And 되살려도 그대로다
    expect(sourceMemoryOf(revive(left), FOREST_EDGE, MOLT_LITTER)).toEqual(before);
  });

  it('S-224 (경계 ②) 관찰자 둘이 같은 방의 같은 셈을 읽는다', () => {
    // Given 관찰자 하나가 한 번 캔 세계
    const base = atSource(FOREST_EDGE, MOLT_LITTER);
    expect(mineOnce(base, MOLT_LITTER).status).toBe('success');
    const spot = here(base, bodyOf(base));
    const both = [OBSERVER, OBSERVER_2];
    // When 둘째 관찰자가 그 곁에 들어온다
    const joined = worldFrom(base, () => {}, both);
    const staged = worldFrom(
      joined,
      (s) => place(s, bodyOf(joined, OBSERVER_2), FOREST_EDGE, { x: spot.x, z: spot.z + 2 }),
      both,
    );
    // Then 둘이 읽는 방의 기억이 한 값도 다르지 않다
    expect(staged.observe(OBSERVER_2).region.id).toBe(staged.observe(OBSERVER).region.id);
    expect(seenRegionMemory(staged, OBSERVER_2)).toEqual(seenRegionMemory(staged, OBSERVER));
    // And 그 원천의 셈도 같다
    expect(seenSourceMemory(staged, MOLT_LITTER, OBSERVER_2)).toEqual(
      seenSourceMemory(staged, MOLT_LITTER, OBSERVER),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-006 지목하면 셈이 읽힌다', () => {
  it('S-225 관찰이 싣는 원천에 그 셈이 함께 실린다 — 계수 둘과 마지막 고갈의 시각', () => {
    // Given 곡괭이를 지닌 몸이 허물 곁에 선다 — 아직 캐지 않았다
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    expect(sourceEntity(w.observe(), MOLT_LITTER)).toBeDefined();
    // Then (경계 ①) 한 번도 캔 적 없는 원천에는 그 자리가 아예 없다 (0 을 말하지 않는다)
    expect(seenSourceMemory(w, MOLT_LITTER)).toBeUndefined();

    // When 다 캐 고갈시킨다
    mineUntilDepleted(w, FOREST_EDGE, MOLT_LITTER);
    // Then 그 셈이 관찰에 실리고 세계 State 의 것과 같다
    const seen = seenSourceMemory(w, MOLT_LITTER)!;
    const held = sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)!;
    expect(seen.takenTotal).toBe(held.takenTotal);
    expect(seen.depletedTimes).toBe(held.depletedTimes);
    expect(seen.lastDepletedAt).toBe(held.lastDepletedAt);
    // And (경계 ②) 실리는 것은 시각뿐이다 — 나이("N초 전")는 어디에도 없다
    expect(Object.keys(seen).sort()).toEqual(
      ['depletedTimes', 'lastDepletedAt', 'takenTotal'].sort(),
    );
  });

  it('S-226 내가 선 방의 셈이 늘 실린다 — 뒤척임 · 깨어남 · 지나감', () => {
    // Given 갓 선 세계에서 내 방을 본다
    const w = standingIn(FANTASY_MAZE);
    const fresh = seenRegionMemory(w);
    // Then 자리는 늘 있고 (disturbance 와 같은 어법 · 기본형 ⑥)
    // C037 CHANGED — 마디가 하나 늘었다 (태어남의 셈). 나머지는 한 값도 달라지지 않는다
    expect(Object.keys(fresh).sort()).toEqual(
      ['awakenings', 'births', 'passages', 'turns'].sort(),
    );
    expect(fresh.turns).toBe(0);
    // And (경계 ①) 한 번도 없던 것은 시각도 목록도 없다
    expect(fresh.awakenings.times).toBe(0);
    expect(noTime(fresh.awakenings.lastAt)).toBe(true);
    expect(fresh.passages).toEqual([]);
    expect(fresh.births).toEqual([]);

    // When 고래가 지나는 방으로 옮겨 그 지나감이 끝날 때까지 둔다
    const rooms = routeRoomsOf(w, SKY_WHALE_ROUTE);
    const passed = rooms[0]!;
    const moved = moveBody(w, passed, anySpot(passed), bodyOf(w));
    wait(moved, PRESENCE_SECONDS_PER_NODE * rooms.length + 2, 5);
    runToSeason(moved, TURN);
    // Then 그 방의 판이 읽을 값이 서 있다 — 뒤척임과 지나감이 함께
    const seen = seenRegionMemory(moved);
    expect(seen.turns).toBe(1);
    const passage = seen.passages.find((p) => p.presence === presenceCodeOf(SKY_WHALE_ROUTE));
    expect(passage, '지나간 것이 방의 기억에 실리지 않았다').toBeDefined();
    expect(passage!.times).toBe(1);
    // And (경계 ②) 실리는 것은 시각뿐이다 — 나이는 관찰자가 잰다
    expect(Object.keys(passage!).sort()).toEqual(['lastAt', 'presence', 'times'].sort());
    expect(passage!.lastAt).toBe(passageOf(moved, passed, SKY_WHALE_ROUTE)?.lastAt);
    // And 지난 적 없는 것은 목록에 서지 않는다
    expect(seen.passages.map((p) => p.presence)).not.toContain(
      presenceCodeOf(BLIND_HUNTER_ROUTE),
    );
  });

  it('S-227 (경계 ③) 세계 위에 뜨는 숫자 HUD 는 하나도 늘지 않는다', () => {
    // Given 셈이 하나도 없는 세계와, 셈 셋(뒤척임 · 깨어남 · 지나감)이 다 선 같은 방
    //
    // **캐지 않는다** — 캐면 C011 의 소지품 줄이 하나 늘어 이 Cycle 이 더한 것과 섞인다.
    // 여기서 재는 것은 "기억이 HUD 를 늘리는가" 하나다.
    const room = START_REGION_ID;
    const fresh = standingIn(room);
    const w = standingIn(room, undefined, { disturbances: { [room]: DISTURBANCE_THRESHOLD } });
    wait(w, PRESENCE_SECONDS_PER_NODE + 2, 5);
    runToSeason(w, TURN);
    const memory = historyOf(w, room);
    expect({ turns: memory.turns, awakenings: memory.awakenings.times }).toEqual({
      turns: 1,
      awakenings: 1,
    });
    // 지나감도 세어져 있다 — 몇 번인가는 C018 의 시간표가 정하므로 여기서는 세지 않는다
    expect(passageOf(w, room, SKY_WHALE_ROUTE)!.times).toBeGreaterThanOrEqual(1);
    // Then 세계가 싣는 HUD 의 줄은 한 줄도 늘지 않았다 (판이 읽는 것은 HUD 가 아니다)
    expect(hudIds(w)).toEqual(hudIds(fresh));
  });

  it('S-228 (경계 ④) 관찰 범위 밖의 원천은 실리지 않으므로 그 기억도 실리지 않는다', () => {
    // Given 한 번 캔 허물에서 밤의 범위 **밖**에 선 몸
    const base = atSource(FOREST_EDGE, MOLT_LITTER);
    expect(mineOnce(base, MOLT_LITTER).status).toBe('success');
    const at = sourceAt(base, FOREST_EDGE, MOLT_LITTER);
    const far = walkableSpots(FOREST_EDGE).filter(
      (p) => distanceBetween(p, at) > OBSERVE_RANGE_NIGHT + 1,
    );
    if (far.length === 0) throw new Error(`${FOREST_EDGE} 에 밤의 범위 밖에 설 자리가 없다`);
    const w = moveBody(base, FOREST_EDGE, maxBy(far, (p) => distanceBetween(p, at)), bodyOf(base));
    // Then 낮에는 그 원천도 그 셈도 실린다
    expect(w.observe().clock.dayPhase).toBe('DAY');
    expect(seenSourceMemory(w, MOLT_LITTER)?.takenTotal).toBe(1);

    // When 밤이 온다
    runTo(w, DAY_SECONDS + 30, 5);
    expect(w.observe().clock.dayPhase).toBe('NIGHT');
    // Then 그 원천이 실리지 않고 그 기억도 함께 실리지 않는다
    expect(sourceEntity(w.observe(), MOLT_LITTER)).toBeUndefined();
    expect(seenSourceMemory(w, MOLT_LITTER)).toBeUndefined();
    // And 세계는 그 셈을 그대로 쥐고 있다 — 실리지 않은 것과 없어진 것이 다르다
    expect(sourceMemoryOf(w, FOREST_EDGE, MOLT_LITTER)?.takenTotal).toBe(1);
  });

  it.todo(
    'GAP: 판의 「기억」 줄 자체(「세 번 캐였다 · 마지막 고갈 N초 전」 · 「뒤척임 N번 · 깨어남 N번 · 고래가 N번 지났다」 의 문구와 그 줄이 서는 자리)는 이 하네스로 놓을 수 없다 — 문구는 content/view 의 code-text 가 짓고 나이("N초 전")는 관찰자가 세계 시각으로 잰다. 세계 쪽에서 잴 수 있는 것은 그 판이 읽는 값(entities[].memory · region.memory)까지다 (c030 이 세운 그 경계 그대로). 판의 줄은 View 쪽 시나리오의 몫이다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// 도구를 밖에서 돌린다 — 검사 보고는 관찰 계약이 아니라 도구가 데이터에서
// 직접 읽는 것이다 (c018 SPEC-009 의 선례 그대로).
describe('SPEC-007 검사가 기억을 본다 — ㊸ ㊼', () => {
  const HISTORY_REFS = '㊸';
  const PERSISTENCE_SUMMARY = '㊼';
  /** 이 Cycle 앞의 마지막 번호 — 기억의 검사 둘이 그 **뒤에** 선다 */
  const LAST_BEFORE = '㊷';

  const plain = runTool(CHECK, []);
  const report = (): CheckReport => JSON.parse(plain.out) as CheckReport;
  const numbered = (): CheckItem[] => report().items.filter((i) => i.mark !== '·');
  const itemAt = (mark: string): CheckItem => {
    const found = numbered().find((i) => i.mark === mark);
    if (!found) throw new Error(`보고에 검사 ${mark} 가 없다`);
    return found;
  };

  it('S-229 ㊸ 가 앞의 마지막 번호 뒤에 서고 ㊼ 가 그 뒤에 선다', () => {
    // **붙어 있음이 아니라 차례를 잰다** — 뒤 Cycle 이 앞 계통에 검사를 더하면 그 번호가 둘
    // 사이에 끼는데(접근 계통의 ㊽ 이 그랬다), 이 시나리오가 말하려는 것은 "기억의 검사가 그
    // 뒤에 선다" 이지 "바로 다음 칸이다" 가 아니다. 붙어 있음을 재면 남의 계통이 늘 때마다 깨진다
    const marks = numbered().map((i) => i.mark);
    const at = marks.indexOf(LAST_BEFORE);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(marks.indexOf(HISTORY_REFS)).toBeGreaterThan(at);
    expect(marks.indexOf(PERSISTENCE_SUMMARY)).toBeGreaterThan(marks.indexOf(HISTORY_REFS));
  });

  it('S-230 ㊸ 는 통과로, ㊼ 는 보고로 답한다 — 둘 다 기계가 잡을 것을 다 낸다', () => {
    expect(itemAt(HISTORY_REFS).status).toBe('pass');
    // ㊼ 는 판정하지 않는다 (경계 ① — 사람이 본다)
    expect(itemAt(PERSISTENCE_SUMMARY).status).toBe('report');
    for (const mark of [HISTORY_REFS, PERSISTENCE_SUMMARY]) {
      expect(itemAt(mark)).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        answer: expect.any(String),
        refs: expect.any(Array),
      });
      expect(itemAt(mark).answer.length).toBeGreaterThan(0);
    }
    // 그리고 판정에 드는 것은 pass/fail 뿐이다 — report 가 ok 를 흔들지 않는다
    expect(report().ok).toBe(report().counts.fail === 0);
    expect({ fail: report().counts.fail, ok: report().ok }).toEqual({ fail: 0, ok: true });
    expect(plain.status).toBe(0);
  });

  it('S-231 (경계 ②) 두 번 돌려도 글자까지 같다 · 읽기 전용이다', () => {
    expect(runTool(CHECK, []).out).toBe(plain.out);
    // 그리고 데이터가 달라지지 않았다 — 같은 데이터가 같은 hash 를 낸다
    for (const spec of REGION_SPECS) {
      expect({ id: spec.id, hash: descriptionHash(spec.space) }).toEqual({
        id: spec.id,
        hash: descriptionHash(spaceOf(spec.id)),
      });
    }
  });

  it.todo(
    'GAP: SPEC-007 ㊸ 의 **뒷면**(방이 가진 것 가운데 셀 수 없는 것이 있으면 fail 이고 종료 코드가 1 이다)은 이 파일이 잴 수 없다 — 데이터를 실제로 훼손해야 하고, 그것은 손으로 지은 데이터로 재는 engine/world-authoring/tests/check.spec.ts 의 자리다 (담당 경계상 그 파일을 만지지 않았다)',
  );
  it.todo(
    'GAP: ㊼ 의 표에서 **빠진 State 필드**를 잡는 것은 검사가 아니라 형이다 (spec 기본형 ⑤ — State 필드 전부를 키로 요구하는 표). 형이 잡는 것은 tsc 가 재는 것이지 시나리오가 재는 것이 아니라, 이 파일은 ㊼ 가 표를 **읊는가**까지만 본다',
  );
});

// ─────────────────────────────────────────────────────────────────────
describe('회귀', () => {
  it('S-232 (SPEC-008 · C012 · C013) 원천의 phase · taken · 되돌아옴의 길이와 거절 사유가 그대로다', () => {
    const w = atSource(FOREST_EDGE, MOLT_LITTER);
    // 캐면 캘 횟수가 오르고 다 캐면 고갈이다
    mineUntilDepleted(w, FOREST_EDGE, MOLT_LITTER);
    expect(storedOf(w, FOREST_EDGE, MOLT_LITTER)).toMatchObject({
      phase: DEPLETED,
      taken: harvestsOf(FOREST_EDGE, MOLT_LITTER),
    });
    expect(mine(w, MOLT_LITTER)).toMatchObject({ reason: SOURCE_DEPLETED });
    // 절반을 넘기면 되돌아오는 중이고 그 사유가 갈린다 (그 자리에 설 때까지 굴린다 —
    // 몇 초인가는 이 항의 주장이 아니다)
    runUntilPhase(w, FOREST_EDGE, MOLT_LITTER, RECOVERING);
    expect(mine(w, MOLT_LITTER)).toMatchObject({ reason: SOURCE_RECOVERING });
    // 제 길이를 다 채우면 돌아오고 다시 캘 수 있다
    wait(w, recoveryOf(FOREST_EDGE, MOLT_LITTER));
    expect(storedOf(w, FOREST_EDGE, MOLT_LITTER)).toMatchObject({ phase: AVAILABLE, taken: 0 });
    expect(mineOnce(w, MOLT_LITTER)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
  });

  it('S-233 (SPEC-008 · C017) 소란의 값과 위상 · 자국이 그대로다', () => {
    // 채취 한 번이 그 방의 소란을 밝힌 만큼 올린다 (어느 경로도 지나지 않는 방에서 잰다)
    const room = QUIET_ROOMS.find((id) => id !== FANTASY_MAZE)!;
    const source = plainSourceIn(room);
    const base = inSeason(SEEP, room, undefined, { actorItems: { pickaxe: 3 } });
    const w = beside(base, room, source);
    expect(seenValue(w)).toBe(0);
    expect(mineOnce(w, source).status).toBe('success');
    expect(seenValue(w)).toBe(DISTURBANCE_PER_HARVEST);
    expect(seenDisturbance(w).threshold).toBe(DISTURBANCE_THRESHOLD);
    expect(seenPhase(w)).toBe(DORMANT);
    // 걸음이 땅에 자국을 남기고 실리는 자리는 셋뿐이다
    const run = straightRun(room);
    const walker = inSeason(SEEP, room, run.from);
    expect(walker.observe().tracks).toEqual([]);
    walkTo(walker, run.to);
    expect(walker.observe().tracks.length).toBeGreaterThan(0);
    for (const track of walker.observe().tracks) {
      expect(Object.keys(track).sort()).toEqual(['at', 'heading', 'since'].sort());
    }
  });

  it('S-234 (SPEC-008 · C016) 철의 위상 덧씌움이 그대로다', () => {
    const room = SEASON_ROOMS[0];
    if (!room) throw new Error('철별 덧씌움을 밝힌 방이 데이터에 없다 (C016 이 세운 것)');
    const season = Object.keys(phasesOf(room)!.seasons!)[0] as SeasonId;
    const overlay = phasesOf(room)!.seasons![season]!.depthOverlay?.[0];
    if (!overlay) throw new Error(`${room} 의 ${season} 덧씌움이 깊이를 밝히지 않았다`);
    const op = spaceOf(room).ops.find((o) => o.id === overlay.areaId);
    if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${overlay.areaId}' 가 없다`);
    const t = terrainOf(room);
    const spot = walkableSpots(room).find((p) => tagsAt(t, p.x, p.z, DEPTH_LAYER).includes(op.tag));
    expect(spot, '덧씌움이 걸린 설 자리가 없다').toBeDefined();
    // 그 철에는 한 단계 깊고 다른 철에는 방의 깊이 그대로다
    expect(depthSeen(inSeason(season, room, spot))).toBe(overlay.depth);
    const other = ([STILL, SEEP, LONG_NIGHT] as SeasonId[]).find((s) => s !== season)!;
    expect(depthSeen(inSeason(other, room, spot))).toBe(regionSpec(room)!.depth);
  });

  it('S-235 (SPEC-008 · C001 ~ C008) 방마다 땅과 hash 가 그대로이고 문이 그대로 열린다', () => {
    // 같은 데이터가 같은 땅을 낸다 — 방을 세지 않고 방마다 잰다
    for (const spec of REGION_SPECS) {
      const w = standingIn(spec.id);
      expect({ id: spec.id, hash: w.observe().region.hash }).toEqual({
        id: spec.id,
        hash: descriptionHash(spaceOf(spec.id)),
      });
    }
    // 그리고 문이 그대로 열린다 — 건너면 다른 방에 선다 (c017 이 쓴 그 문)
    const from = START_REGION_ID;
    const door = 'FOREST_PATH';
    const w = standingIn(from, anchorAt(from, door));
    expect(cross(w, door)).toMatchObject({ status: 'success' });
    expect(actorOf(w, bodyOf(w)).regionId).not.toBe(from);
  });

  it('S-236 (SPEC-008 경계 ①) 규칙은 기억을 읽지 않는다 — 셈을 부풀려도 세계가 한 값도 달라지지 않는다', () => {
    // Given 같은 자리에서 갈라진 세계 둘 — 하나는 기억이 잔뜩 부풀려져 있다
    const base = standingIn(FOREST_EDGE, undefined, { clock: SEEP });
    const plainWorld = worldFrom(base, () => {});
    const loaded = worldFrom(base, (s) => {
      const states = s.regionStates as unknown as RegionStatesShape;
      for (const spec of REGION_SPECS) {
        const held = states[spec.id];
        if (!held?.history) continue;
        held.history.turns = 999;
        held.history.awakenings = { times: 999, lastAt: 1 };
        held.history.passages = {
          [SKY_WHALE_ROUTE]: { times: 999, lastAt: 1 },
          [BLIND_HUNTER_ROUTE]: { times: 999, lastAt: 1 },
        };
        held.history.sources = Object.fromEntries(
          sourcesInRegion(spec.id).map((one) => [
            one.id,
            { takenTotal: 999, depletedTimes: 999, lastDepletedAt: 1 },
          ]),
        );
      }
    });
    // When 둘을 똑같이 굴린다
    wait(plainWorld, 120, 5);
    wait(loaded, 120, 5);
    // Then 기억을 뺀 세계가 한 값도 다르지 않다 — 셈은 아무것도 판정하지 않는다
    const withoutHistory = (w: WorldDriver): string => {
      const copy = JSON.parse(JSON.stringify(state(w))) as { regionStates: RegionStatesShape };
      for (const held of Object.values(copy.regionStates)) delete held.history;
      return JSON.stringify(copy);
    };
    expect(withoutHistory(loaded)).toBe(withoutHistory(plainWorld));
  });
});
