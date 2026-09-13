// C035 — 조건은 하나의 형이다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-007 + 회귀 SPEC-008)
//
// C034 까지 세계의 조건은 데이터 넷에 서로 다른 모양으로 흩어져 있었다 — 문의 요구(Lock.requires
// 의 time · state) · 원천의 때(occurrence.seasons · dayPhases) · 방의 철 위상(RegionPhases.seasons
// 의 철 열쇠) · 결속의 요구(LifeRequirement 넷). 이 Cycle 이 그 넷을 **한 형**(Condition)으로 읽고,
// 그 형이 처음으로 **기억을 읽는다**. 그래서 재는 것은 일곱이다:
//   ① 형 — Target · Query · Operator · Value · Qualifier · all/any 로 적힌 조건을 평가기가 참/거짓/
//      판정 불가 셋 중 하나로 낸다. 자리만인 것(actor · player · faction · distance … · chance)은
//      거짓이 아니라 판정 불가이고, change qualifier 는 직전 값을 주지 않으면 판정 불가다
//   ② 문 — Lock 의 time · state 항이 clock/region 조건으로 읽히고 그 판정이 isConnectorOpen 과 같다.
//      property · knowledge 항은 읽되 판정 불가다 (2층은 판정하지 않는다 · K12)
//   ③ 원천의 때 — occurrence 가 clock IN 조건으로 읽히고 sourceConditions 의 not-this-season ·
//      not-this-hour 와 같다
//   ④ 위상과 결속 — 철 열쇠가 clock 조건으로, 결속의 요구 넷이 source/clock/region 조건으로 읽히고
//      regionPhaseAt · lifeUnmetCodes 와 같다 — **철 넷 × 낮밤 둘**에서 (회귀의 자)
//   ⑤ 검사 ㊹ — 읽힌 조건 전부의 참조 무결이 통과이고, 유령 ref · 없는 속성 · 어긋난 qualifier 는 fail 이다.
//      ㉓ · ㉖ · ㉞ 의 답은 그대로다
//   ⑥ 기억 — 숲 가장자리 비늘 자리의 history 조건이 고래가 이 방을 지난 적 있을 때만 참이고, 판이
//      그것을 코드(needs-passage)로 싣는다. 조건은 **말해질 뿐** 원천의 phase · 되돌아옴 · 채취를
//      한 값도 바꾸지 않고, 되살린 세계에서도 같은 답이다
//   ⑦ 이름 0 — 어댑터 · 평가기 · 검사 어디에도 방 · 원천 · 경로 · 철의 이름 글자가 없다 (grep 이 증거)
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(engine/world-authoring/condition.ts 의 본문 · content/world/semantic/condition.ts
// 의 본문 · content/world/projection/observer-view.ts · check.ts 의 ㊹ 본문)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C035-one-shape-of-condition/spec.md 와 content/protocol/gameview.ts 의 관찰
// 계약, 그리고 두 파일이 **선언한 계약**(형 · 함수 이름 · 문서 주석의 점 경로)뿐이다.
//
// **이름도 자리도 손으로 적지 않는다** — 문은 LOCKS 에서, 원천은 sourcesInRegion 에서, 방은
// REGION_SPECS 에서, 경로는 PRESENCE_ROUTES 에서, 탄생지는 lifeSitesInRegion 에서 읽는다. 손으로
// 적는 이름은 spec 이 못 박은 셋(FOREST_EDGE · SKY_WHALE_ROUTE · 코드 `needs-passage`)과 spec 이 수로
// 못 박은 형의 크기(Target 여덟 · Query 다섯 · Operator 아홉)뿐이다.
//
// **전체 개수를 단언하지 않는다** — 검사 항목 수도 원천 수도 방 수도 세지 않는다.
//
// **여기서 재지 않는 것** — 판의 조건 줄의 **문구**는 View 의 표가 짓는다. 세계 쪽에서 잴 수 있는
// 것은 그 판이 읽는 값(entities[].conditions 의 코드)까지다 (c030 · c034 가 세운 그 경계 그대로).

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONDITION_OPERATORS,
  DECIDABLE_QUERY_KINDS,
  DECIDABLE_TARGET_KINDS,
  DEFERRED_QUERY_KINDS,
  DEFERRED_TARGET_KINDS,
  UNREADABLE,
  conditionLeaves,
  evaluateCondition,
  type Condition,
  type ConditionLeaf,
  type ConditionRead,
  type ConditionValue,
  type ConditionVerdict,
} from '../../../engine/world-authoring/condition';
import {
  CONDITION_ITEM,
  checkRegions,
  type CheckConditionSite,
  type CheckItem,
  type CheckRegionsInput,
  type CheckReport,
} from '../../../engine/world-authoring/check';
import { descriptionHash, pointsOf, type XZ } from '../../../engine/world-authoring/description';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  ANCHOR_LAYER,
  FOREST_EDGE,
  LOCKS,
  PRESENCE_ROUTES,
  REGION_SPECS,
  regionSpec,
  type LifeRequirement,
  type Lock,
  type SeasonId,
  REGION_GRAPH,
} from '../../regions';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import {
  CYCLE_SECONDS,
  DAY_SECONDS,
  LONG_NIGHT_SECONDS,
  SEEP_SECONDS,
  STILL_SECONDS,
  worldClockAt,
} from '../semantic/clock';
import {
  CONDITION_SITE_LOCK,
  NEEDS_PASSAGE,
  lifeRequirementCondition,
  lockCondition,
  phaseSeasonCondition,
  sourceMemoryConditionCodes,
  sourceOccurrenceCondition,
  worldConditionSites,
  worldConditionVerdict,
} from '../semantic/condition';
import { lifeSitesInRegion, lifeUnmetCodes, type LifeSite } from '../semantic/life';
import { isConnectorOpen } from '../semantic/region';
import { NOT_THIS_HOUR, NOT_THIS_SEASON, regionPhaseAt } from '../semantic/region-phase';
import {
  sourceConditions,
  sourcePositionOf,
  sourceStateOf,
  sourcesInRegion,
  type ResourceSource,
} from '../semantic/resource';
import { INTERACTION_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { runWorldCheck, worldCheckInput } from '../../../tools/world-editor/check';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';

// ── spec 이 못 박은 것 (여기 말고는 손으로 적지 않는다) ────────────────
/** 기억을 읽는 첫 조건이 읽는 경로 — spec SPEC-006 · Q2 */
const SKY_WHALE_ROUTE = 'SKY_WHALE_ROUTE';
/** 판의 조건 줄이 싣는 코드 — spec Observable (가칭 그대로 semantic 이 확정했다) */
const CODE_NEEDS_PASSAGE = 'needs-passage';
/**
 * 형의 크기 — spec SPEC-001 "Target 여덟 · Query 다섯 · Operator 아홉".
 *
 * C039 CHANGED — **아홉 · 여섯**이 되었다: 행위자(actor) Target 과 성질(capability) Query 가
 * 판정 가능해졌다 (C039 규칙 5). 기대값이 아니라 **세계의 형을 세는 수**다.
 */
const TARGET_KINDS_DECIDABLE = 9;
const QUERY_KINDS_DECIDABLE = 6;
const OPERATOR_COUNT = 9;
/** 검사 ㊹ 의 id 와 그 앞의 셋 — spec SPEC-005 경계 (㉓ · ㉖ · ㉞ 의 답은 그대로다) */
const CONDITION_REFS_ID = 'condition-refs';
const CONDITION_REFS_MARK = '㊹';
const KEPT_MARKS = ['㉓', '㉖', '㉞'] as const;

/** phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';
/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (c011~c034 어법) */
const MINE_SECONDS = 1.2;
/** 지나가는 것이 마디 하나에 머무는 세계 초 (C018) */
const PRESENCE_SECONDS_PER_NODE = 45;

// ── 철의 이름과 자리 (clock.ts 의 상수에서 유도한다 · c016 ~ c034 그대로) ─
const SEASONS: readonly SeasonId[] = ['STILL', 'SEEP', 'LONG_NIGHT', 'TURN'];
const SEASON_AT: Readonly<Record<SeasonId, number>> = {
  STILL: 0,
  SEEP: STILL_SECONDS,
  LONG_NIGHT: STILL_SECONDS + SEEP_SECONDS,
  TURN: STILL_SECONDS + SEEP_SECONDS + LONG_NIGHT_SECONDS,
};
/**
 * 철 넷 × 낮밤 둘 — spec SPEC-004 경계가 못 박은 **회귀의 자**.
 *
 * 철마다 두 시각을 잰다: 그 철의 첫 하루 낮과 밤. 긴 밤은 하루가 전부 밤이고 뒤척임은 60 초가
 * 전부 낮이라(C015) 그 둘은 같은 낮밤의 두 시각이다 — 무엇이 실제로 낮이고 밤인가는 시계가
 * 답한다 (worldClockAt · 여기서 짓지 않는다).
 */
interface TimeSample {
  season: SeasonId;
  slot: 'first' | 'second';
  dayPhase: 'DAY' | 'NIGHT';
  time: number;
}
const TIME_GRID: readonly TimeSample[] = SEASONS.flatMap((season) => {
  const start = SEASON_AT[season];
  const first = start + 1;
  const second = season === 'TURN' ? start + 30 : start + DAY_SECONDS + 1;
  return [
    { season, slot: 'first' as const, dayPhase: worldClockAt(first).dayPhase, time: first },
    { season, slot: 'second' as const, dayPhase: worldClockAt(second).dayPhase, time: second },
  ];
});
/** 결속의 비를 잡으려면 더 촘촘히 — 한 바퀴를 30 초 걸음으로 (비는 시각과 철에서 유도된다 · C022) */
const DENSE_GRID: readonly number[] = Array.from(
  { length: Math.floor(CYCLE_SECONDS / 30) },
  (_, i) => i * 30 + 1,
);

/**
 * 이 시나리오들이 재는 것은 **조건의 판정**이다 — 광식충이 이미 가득한 숲(c013 · c034 의 어법)에서
 * 세운다. 결속의 요구를 재는 자리는 개체군 값을 따로 세운다 (아래 lifeVariants).
 */
const solo: WorldSetup = { npcs: [] };

// ── 하네스 (c013 · c034 의 선례 그대로) ────────────────────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id: string) => state(w).actors.find((a) => a.id === id)!;
const bodyOf = (w: WorldDriver, observerId = OBSERVER): string =>
  w.observe(observerId).observer.characterId;
const timeOf = (w: WorldDriver): number => state(w).time;
/** 같은 세계를 **그 시각**으로 본다 — 조건도 기존 판정 함수도 같은 State 를 같은 시각으로 읽는다 */
const at = (s: WorldState, time: number): WorldState => ({ ...s, time });

const spaceOf = (id: string) => regionSpec(id)!.space;
/** 그 문의 anchor 자리 — 이름과 자리를 데이터에서 읽는다 (c017 · c034 의 anchorAt 그대로) */
const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;
/** 그 문 — 그래프가 소유한다 (양 끝의 방과 anchor 이름) */
const connectorOf = (id: string) => REGION_GRAPH.connectors.find((c) => c.id === id)!;
/** 그 자리의 손 닿는 곳 — InteractionRange 안이다 */
const besideSpot = (at: XZ): XZ => ({ x: at.x + INTERACTION_RANGE / 2, z: at.z });

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
/** dt 를 잘게 나누어 준다 (c013 ~ c034 의 wait 선례 그대로) */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}
/** 그 세계 시각까지 굴린다 (c016 ~ c034 선례) */
function runTo(w: WorldDriver, target: number, step = 5) {
  const left = target - timeOf(w);
  if (left <= 1e-9) return;
  wait(w, left, step);
}
/** 그 철 **안으로** 굴린다 (c017 ~ c034 선례) */
function runToSeason(w: WorldDriver, season: SeasonId, step = 60) {
  const now = timeOf(w);
  const cycles = Math.floor(now / CYCLE_SECONDS);
  let start = cycles * CYCLE_SECONDS + SEASON_AT[season];
  if (start < now + 1e-9) start += CYCLE_SECONDS;
  runTo(w, start, step);
  wait(w, 1, 1);
}

const mine = (w: WorldDriver, targetEntityId: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId }, observerId);
function mineOnce(w: WorldDriver, id: string, observerId = OBSERVER): ActionResult {
  const result = mine(w, id, observerId);
  tickFor(w, MINE_SECONDS + TICK_INTERVAL);
  return result;
}
const cross = (w: WorldDriver, connector: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector }, observerId);

// ── 저장·복구 (c013 ~ c034 의 선례 그대로) ──────────────────────────
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
/** 되살리면서 State 를 고친 세계 — 걸어서는 세울 수 없는 Given 을 공개 길로 세운다 (c017 · c034 그대로) */
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
const revive = (base: WorldDriver): WorldDriver => worldFrom(base, () => {});
/** 그 몸을 그 방 그 자리에 세운다 (관성도 하던 행동도 없이) */
function place(s: WorldState, id: string, region: string, at: XZ) {
  const a = s.actors.find((x: ActorState) => x.id === id)!;
  a.regionId = region;
  a.position = { x: at.x, z: at.z };
  a.velocity = { x: 0, z: 0 };
  a.currentAction = idleAction();
}

// ── 계약이 준 형 (spec State 절 · C034 의 점 경로) ───────────────────
interface CountShape {
  times: number;
  lastAt?: number | null;
}
interface HistoryShape {
  turns: number;
  awakenings: CountShape;
  passages?: Record<string, CountShape>;
  sources?: Record<string, unknown>;
}
interface SourceStateShape {
  phase: string;
  taken: number;
  progress?: number;
}
interface RegionStateShape {
  history?: HistoryShape;
  sources?: Record<string, SourceStateShape>;
}
const shapeOf = (w: WorldDriver): Record<string, RegionStateShape> =>
  state(w).regionStates as unknown as Record<string, RegionStateShape>;
/** 그 경로가 그 방을 지난 셈 — 지난 적 없으면 자리가 없다 (C034 spec State) */
const passageOf = (w: WorldDriver, region: string, routeId: string): CountShape | undefined =>
  shapeOf(w)[region]?.history?.passages?.[routeId];
/** 그 방의 기억에 지나감 하나를 **써 넣는다** — 걸어서 세울 수 없는 Given (c034 S-236 의 어법) */
function writePassage(s: WorldState, region: string, routeId: string, lastAt: number) {
  const states = s.regionStates as unknown as Record<string, RegionStateShape>;
  const held = (states[region] ??= {});
  const history = (held.history ??= { turns: 0, awakenings: { times: 0 } });
  (history.passages ??= {})[routeId] = { times: 1, lastAt };
}
const storedOf = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(state(w).regionStates, region, id) as unknown as SourceStateShape;
const sourceAt = (w: WorldDriver, source: ResourceSource): XZ => {
  const p = sourcePositionOf(state(w).regionStates, source);
  return { x: p.x, z: p.z };
};
/** 그 원천 곁에 몸을 세운 세계 */
const beside = (w: WorldDriver, source: ResourceSource): WorldDriver =>
  worldFrom(w, (s) => place(s, bodyOf(w), source.regionId, besideSpot(sourceAt(w, source))));

/** 경로가 지나는 방들 — 데이터가 소유한다 (c034 의 roomsOnRoute 그대로) */
function roomsOnRoute(routeId: string): string[] {
  const route = PRESENCE_ROUTES.find((r) => r.id === routeId);
  if (!route) throw new Error(`데이터가 경로 '${routeId}' 를 모른다`);
  return [...new Set(route.nodes.flatMap((node) => node.map((c) => c.region)))];
}
interface PresenceStateShape {
  startedAt?: number;
  route?: string[];
}
const routeStateOf = (w: WorldDriver, routeId: string): PresenceStateShape => {
  const held = (state(w) as unknown as { presences: Record<string, PresenceStateShape> }).presences[
    routeId
  ];
  if (!held) throw new Error(`세계가 경로 '${routeId}' 를 모른다`);
  return held;
};
/** 그 경로가 시작한 뒤 마디 k 의 한가운데까지 굴린다 (c018 · c034 그대로) */
function runToNode(w: WorldDriver, routeId: string, node: number) {
  const held = routeStateOf(w, routeId);
  if (held.startedAt === undefined) throw new Error(`경로 '${routeId}' 는 지금 지나고 있지 않다`);
  runTo(w, held.startedAt + node * PRESENCE_SECONDS_PER_NODE + PRESENCE_SECONDS_PER_NODE / 2, 1);
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────
const sourceEntity = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  v.entities.find((e) => e.role === 'resource-source' && e.id === id);
/** 지목한 대상(원천) 프레임의 조건 줄이 읽는 자리 — entities[].conditions (C014 · C035 코드 하나) */
const seenConditions = (w: WorldDriver, id: string): string[] | undefined =>
  sourceEntity(w.observe(), id)?.conditions;

// ── 조건을 읽는 자리 (선언된 계약의 점 경로) ────────────────────────
const verdictOf = (s: WorldState, condition: Condition | undefined): ConditionVerdict | undefined =>
  condition === undefined ? undefined : worldConditionVerdict(s, condition);
/** 판정하는 잎만 남긴 all — Lock 의 property · knowledge 항(자리만)을 빼고 문의 열림과 견주는 자 */
function decidablePart(condition: Condition): Condition {
  const leaves = conditionLeaves(condition).filter(
    (leaf) =>
      DECIDABLE_TARGET_KINDS.includes(leaf.target.kind) &&
      DECIDABLE_QUERY_KINDS.includes(leaf.query.kind) &&
      leaf.chance === undefined,
  );
  return { all: leaves };
}
const hasDeferred = (condition: Condition): boolean =>
  conditionLeaves(condition).length !== conditionLeaves(decidablePart(condition)).length;

/** 그 Lock 의 요구 항들 — 갈래별로 (데이터가 소유한다) */
const timeClauses = (lock: Lock) => lock.requires.flatMap((r) => (r.time ? [r.time] : []));
const stateClauses = (lock: Lock) => lock.requires.flatMap((r) => (r.state ? [r.state] : []));
const deferredClauses = (lock: Lock) =>
  lock.requires.flatMap((r) => [
    ...(r.property !== undefined ? ['property'] : []),
    ...(r.knowledge !== undefined ? ['knowledge'] : []),
  ]);
/** 그 방이 설 수 있는 패턴 이름들 — 규칙 없는 방은 빈 목록이다 */
const patternsOf = (region: string): string[] =>
  regionSpec(region)?.rule?.patterns.map((p) => p.name) ?? [];

/** 문마다의 세계들 — 그 문의 state 항이 가리키는 방을 **패턴마다** 세운다 (regionPatterns 손잡이) */
function lockWorlds(lock: Lock & { region: string }): { label: string; w: WorldDriver }[] {
  const clauses = stateClauses(lock);
  if (clauses.length === 0) return [{ label: 'default', w: standingIn(lock.region) }];
  const worlds: { label: string; w: WorldDriver }[] = [];
  for (const clause of clauses) {
    for (const pattern of patternsOf(clause.region)) {
      worlds.push({
        label: `${clause.region}=${pattern}`,
        w: standingIn(lock.region, undefined, { regionPatterns: { [clause.region]: pattern } }),
      });
    }
  }
  return worlds;
}

/** 세계의 원천 전부 — 방 순 · 원천 순 (데이터가 소유한다) */
const ALL_SOURCES: readonly ResourceSource[] = REGION_SPECS.flatMap((spec) =>
  sourcesInRegion(spec.id),
);
/** 세계의 탄생지 전부 — 방 순 · 탄생지 순 */
const ALL_SITES: readonly LifeSite[] = REGION_SPECS.flatMap((spec) => lifeSitesInRegion(spec.id));
/** 철별 덧씌움을 밝힌 방들과 그 철 열쇠 */
const SEASON_ROOMS = REGION_SPECS.filter((spec) => spec.phases?.seasons).map((spec) => spec.id);
const seasonKeysOf = (region: string): SeasonId[] =>
  Object.keys(regionSpec(region)?.phases?.seasons ?? {}) as SeasonId[];

/** 원천이 밝힌 기억 조건 — semantic 이 `ResourceSource.condition` 으로 선언했다 (spec State 절) */
const memoryConditionOf = (source: ResourceSource): Condition | undefined =>
  (source as ResourceSource & { condition?: Condition }).condition;
/** 숲 가장자리에서 기억 조건을 밝힌 원천 — 데이터에서 찾는다 (spec 은 그것이 비늘 자리라고 못 박았다) */
function scaleSource(): ResourceSource {
  const found = sourcesInRegion(FOREST_EDGE).filter((s) => memoryConditionOf(s) !== undefined);
  if (found.length === 0) {
    throw new Error(
      `${FOREST_EDGE} 에 기억 조건(condition)을 밝힌 원천이 없다 — spec State 절이 비늘 자리의 조건 한 줄을 못 박았다`,
    );
  }
  if (found.length > 1) throw new Error(`${FOREST_EDGE} 에 기억 조건을 밝힌 원천이 여럿이다`);
  return found[0]!;
}

// ── 도구를 밖에서 돌린다 (c018 · c034 의 선례 그대로) ───────────────────
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OBSERVE = 'tools/world-editor/observe.ts';
function runTool(script: string, args: readonly string[]) {
  const result = spawnSync('npx', ['tsx', script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

// ── SPEC-001 의 가짜 read — 값이 어디서 오는지 기반은 모른다 ─────────
/** 잎의 열쇠 — ref 와 path 로 (테스트가 짓는 표의 열쇠일 뿐 형이 아니다) */
const keyOf = (leaf: ConditionLeaf): string =>
  `${leaf.target.kind}:${leaf.target.ref ?? ''}:${leaf.query.kind}:${leaf.query.path ?? ''}`;
function fakeRead(
  values: Record<string, ConditionValue | undefined | typeof UNREADABLE>,
  extra: Partial<Omit<ConditionRead, 'value'>> = {},
): ConditionRead {
  return {
    value: (leaf) => (keyOf(leaf) in values ? values[keyOf(leaf)] : UNREADABLE),
    ...extra,
  };
}
const leaf = (
  target: ConditionLeaf['target'],
  query: ConditionLeaf['query'],
  operator: ConditionLeaf['operator'],
  value?: ConditionValue,
  more: Partial<ConditionLeaf> = {},
): ConditionLeaf => ({ target, query, operator, ...(value !== undefined ? { value } : {}), ...more });
const ROOM = { kind: 'region', ref: 'R' } as const;
const PATTERN = { kind: 'state', path: 'pattern' } as const;
const K_PATTERN = 'region:R:state:pattern';

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 형이 선다 — 평가기가 참 · 거짓 · 판정 불가를 낸다', () => {
  it('S-237 Target 여덟 · Query 다섯 · Operator 아홉 — 형의 크기가 spec 그대로다', () => {
    expect(DECIDABLE_TARGET_KINDS.length).toBe(TARGET_KINDS_DECIDABLE);
    expect(DECIDABLE_QUERY_KINDS.length).toBe(QUERY_KINDS_DECIDABLE);
    expect(CONDITION_OPERATORS.length).toBe(OPERATOR_COUNT);
    // 자리만인 것도 형에 **있다** (경계 ① — 갈래는 있되 판정하지 않는다)
    expect(DEFERRED_TARGET_KINDS.length).toBeGreaterThan(0);
    expect(DEFERRED_QUERY_KINDS.length).toBeGreaterThan(0);
  });

  it('S-238 잎 하나 — IN · == · 비교 · EXISTS 가 값을 견줘 참/거짓을 낸다', () => {
    // Given 방 R 의 패턴이 P2 인 세계 (가짜 read)
    const read = fakeRead({ [K_PATTERN]: 'P2', 'region:R:count:population.X': 3 });
    // Then IN 은 목록 안이면 참
    expect(evaluateCondition(leaf(ROOM, PATTERN, 'IN', ['P1', 'P2']), read)).toBe('met');
    expect(evaluateCondition(leaf(ROOM, PATTERN, 'IN', ['P1']), read)).toBe('unmet');
    expect(evaluateCondition(leaf(ROOM, PATTERN, '==', 'P2'), read)).toBe('met');
    expect(evaluateCondition(leaf(ROOM, PATTERN, '!=', 'P2'), read)).toBe('unmet');
    const count = { kind: 'count', path: 'population.X' } as const;
    expect(evaluateCondition(leaf(ROOM, count, '<=', 3), read)).toBe('met');
    expect(evaluateCondition(leaf(ROOM, count, '<', 3), read)).toBe('unmet');
    expect(evaluateCondition(leaf(ROOM, count, '>=', 3), read)).toBe('met');
    expect(evaluateCondition(leaf(ROOM, count, '>', 3), read)).toBe('unmet');
    expect(evaluateCondition(leaf(ROOM, PATTERN, 'EXISTS'), read)).toBe('met');
    expect(evaluateCondition(leaf(ROOM, PATTERN, 'NOT_EXISTS'), read)).toBe('unmet');
  });

  it('S-239 EXISTS — 없는 것(undefined)은 거짓이고 모르는 것(UNREADABLE)은 판정 불가다', () => {
    // Given 그 경로가 **없는** read 와 그 잎을 **모르는** read
    const absent = fakeRead({ [K_PATTERN]: undefined });
    const unknown = fakeRead({});
    // Then 없음은 거짓 · 모름은 판정 불가 (둘은 다르다 — 기본형 ②)
    expect(evaluateCondition(leaf(ROOM, PATTERN, 'EXISTS'), absent)).toBe('unmet');
    expect(evaluateCondition(leaf(ROOM, PATTERN, 'NOT_EXISTS'), absent)).toBe('met');
    expect(evaluateCondition(leaf(ROOM, PATTERN, 'EXISTS'), unknown)).toBe('undecidable');
    expect(evaluateCondition(leaf(ROOM, PATTERN, 'NOT_EXISTS'), unknown)).toBe('undecidable');
    // And 비교도 없는 값에는 거짓 · 모르는 값에는 판정 불가다
    expect(evaluateCondition(leaf(ROOM, PATTERN, '==', 'P2'), absent)).toBe('unmet');
    expect(evaluateCondition(leaf(ROOM, PATTERN, '==', 'P2'), unknown)).toBe('undecidable');
  });

  it('S-240 (경계 ①) 자리만인 Target · Query · chance 는 값이 있어도 판정 불가다 — 거짓이 아니다', () => {
    // Given 무엇을 물어도 참이 나올 값을 주는 read
    const generous: ConditionRead = { value: () => 'P2' };
    // Then 자리만인 Target 셋
    for (const kind of DEFERRED_TARGET_KINDS) {
      expect({
        kind,
        verdict: evaluateCondition(leaf({ kind, ref: 'X' }, PATTERN, '==', 'P2'), generous),
      }).toEqual({ kind, verdict: 'undecidable' });
    }
    // And 자리만인 Query 다섯
    for (const kind of DEFERRED_QUERY_KINDS) {
      expect({
        kind,
        verdict: evaluateCondition(leaf(ROOM, { kind, path: 'x' }, '==', 'P2'), generous),
      }).toEqual({ kind, verdict: 'undecidable' });
    }
    // And chance 를 밝힌 잎
    expect(evaluateCondition(leaf(ROOM, PATTERN, '==', 'P2', { chance: 0.5 }), generous)).toBe(
      'undecidable',
    );
    expect(evaluateCondition(leaf(ROOM, PATTERN, '==', 'P2', { chance: 1 }), generous)).toBe(
      'undecidable',
    );
  });

  it('S-241 (경계 ②) change qualifier 는 직전 값을 주지 않으면 판정 불가다 — 평가기는 아무것도 저장하지 않는다', () => {
    const count = { kind: 'count', path: 'population.X' } as const;
    const K = 'region:R:count:population.X';
    const increased = leaf(ROOM, count, '>', 0, { qualifier: { kind: 'change', mode: 'INCREASED' } });
    // Given 직전 값 없는 read — 두 번 불러도 평가기는 앞 호출을 기억하지 않는다
    const noPrevious = fakeRead({ [K]: 3 });
    expect(evaluateCondition(increased, noPrevious)).toBe('undecidable');
    expect(evaluateCondition(increased, noPrevious)).toBe('undecidable');
    // When 호출자가 직전 값을 준다
    const rose = fakeRead({ [K]: 3 }, { previous: () => 1 });
    const fell = fakeRead({ [K]: 3 }, { previous: () => 5 });
    // Then 그때 비로소 판정한다
    expect(evaluateCondition(increased, rose)).toBe('met');
    expect(evaluateCondition(increased, fell)).toBe('unmet');
    const decreased = leaf(ROOM, count, '>', 0, { qualifier: { kind: 'change', mode: 'DECREASED' } });
    expect(evaluateCondition(decreased, fell)).toBe('met');
    // And BECAME — 직전에는 거짓이던 것이 지금 참이다
    const became = leaf(ROOM, count, '>=', 3, { qualifier: { kind: 'change', mode: 'BECAME' } });
    expect(evaluateCondition(became, rose)).toBe('met');
    expect(evaluateCondition(became, fell)).toBe('unmet');
    // And CROSSED — 직전 값과 지금 값 사이에 value 가 있다
    const crossed = leaf(ROOM, count, '>=', 2, { qualifier: { kind: 'change', mode: 'CROSSED' } });
    expect(evaluateCondition(crossed, rose)).toBe('met');
    expect(evaluateCondition(crossed, fakeRead({ [K]: 3 }, { previous: () => 3 }))).toBe('unmet');
  });

  it('S-242 time qualifier — 지금(now)을 주지 않으면 WITHIN · AFTER 는 판정 불가이고 주면 시각을 견준다', () => {
    const stamp = { kind: 'history', path: 'passages.X.lastAt' } as const;
    const K = 'history:R:history:passages.X.lastAt';
    const within = leaf({ kind: 'history', ref: 'R' }, stamp, 'EXISTS', undefined, {
      qualifier: { kind: 'time', mode: 'WITHIN', seconds: 240 },
    });
    const after = leaf({ kind: 'history', ref: 'R' }, stamp, 'EXISTS', undefined, {
      qualifier: { kind: 'time', mode: 'AFTER', seconds: 240 },
    });
    expect(evaluateCondition(within, fakeRead({ [K]: 100 }))).toBe('undecidable');
    // 지금이 200 이면 100 은 240 초 안이다
    expect(evaluateCondition(within, fakeRead({ [K]: 100 }, { now: 200 }))).toBe('met');
    expect(evaluateCondition(after, fakeRead({ [K]: 100 }, { now: 200 }))).toBe('unmet');
    // 지금이 1000 이면 240 초보다 오래됐다
    expect(evaluateCondition(within, fakeRead({ [K]: 100 }, { now: 1000 }))).toBe('unmet');
    expect(evaluateCondition(after, fakeRead({ [K]: 100 }, { now: 1000 }))).toBe('met');
    // SINCE · BEFORE 는 절대 시각이라 now 가 없어도 판정한다
    const since = leaf({ kind: 'history', ref: 'R' }, stamp, 'EXISTS', undefined, {
      qualifier: { kind: 'time', mode: 'SINCE', seconds: 50 },
    });
    expect(evaluateCondition(since, fakeRead({ [K]: 100 }))).toBe('met');
    expect(evaluateCondition(since, fakeRead({ [K]: 10 }))).toBe('unmet');
    // 없는 시각(undefined)은 EXISTS 가 거짓이다 — qualifier 이전의 답이다
    expect(evaluateCondition(within, fakeRead({ [K]: undefined }, { now: 200 }))).toBe('unmet');
  });

  it('S-243 집합 — all 은 거짓이 이기고 any 는 참이 이기며 판정 불가는 거짓으로 눌리지 않는다', () => {
    const read = fakeRead({ [K_PATTERN]: 'P2' });
    const met = leaf(ROOM, PATTERN, '==', 'P2');
    const unmet = leaf(ROOM, PATTERN, '==', 'P1');
    const undecidable = leaf({ kind: 'actor', ref: 'me' }, { kind: 'capability', path: 'x' }, 'EXISTS');
    expect(evaluateCondition({ all: [met, met] }, read)).toBe('met');
    expect(evaluateCondition({ all: [met, unmet] }, read)).toBe('unmet');
    expect(evaluateCondition({ all: [met, undecidable] }, read)).toBe('undecidable');
    expect(evaluateCondition({ all: [unmet, undecidable] }, read)).toBe('unmet');
    expect(evaluateCondition({ any: [unmet, unmet] }, read)).toBe('unmet');
    expect(evaluateCondition({ any: [unmet, met] }, read)).toBe('met');
    expect(evaluateCondition({ any: [unmet, undecidable] }, read)).toBe('undecidable');
    expect(evaluateCondition({ any: [met, undecidable] }, read)).toBe('met');
    // 빈 all 은 참 · 빈 any 는 거짓 (선언된 어법)
    expect(evaluateCondition({ all: [] }, read)).toBe('met');
    expect(evaluateCondition({ any: [] }, read)).toBe('unmet');
    // 집합 안의 집합도 같은 어법이다
    expect(evaluateCondition({ all: [met, { any: [unmet, met] }] }, read)).toBe('met');
    expect(evaluateCondition({ any: [unmet, { all: [met, undecidable] }] }, read)).toBe('undecidable');
    // And 잎을 적힌 차례 그대로 편다
    expect(conditionLeaves({ all: [met, { any: [unmet, undecidable] }] })).toEqual([
      met,
      unmet,
      undecidable,
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-002 Lock 이 형으로 읽힌다', () => {
  it('S-244 데이터에 Lock 이 있고, time 항은 clock IN 으로 · state 항은 region IN 으로 읽힌다', () => {
    expect(LOCKS.length).toBeGreaterThan(0);
    for (const lock of LOCKS) {
      const condition = lockCondition(lock);
      expect({ lock: lock.id, read: condition !== undefined }).toEqual({ lock: lock.id, read: true });
      const leaves = conditionLeaves(condition!);
      // time 항마다 clock · property season · IN · 그 철들
      for (const clause of timeClauses(lock)) {
        const found = leaves.find(
          (l) => l.target.kind === 'clock' && l.query.kind === 'property' && l.query.path === 'season',
        );
        expect({ lock: lock.id, leaf: found }).toMatchObject({
          lock: lock.id,
          leaf: { operator: 'IN', value: [...clause.seasons] },
        });
      }
      // state 항마다 region <그 방> · state pattern · IN · 그 패턴들
      for (const clause of stateClauses(lock)) {
        const found = leaves.find(
          (l) => l.target.kind === 'region' && l.target.ref === clause.region && l.query.kind === 'state',
        );
        expect({ lock: lock.id, leaf: found }).toMatchObject({
          lock: lock.id,
          leaf: { query: { path: 'pattern' }, operator: 'IN', value: [...clause.patterns] },
        });
      }
      // 항의 수만큼 잎이 있다 — 더 지어내지 않는다
      expect({ lock: lock.id, leaves: leaves.length }).toEqual({
        lock: lock.id,
        leaves: timeClauses(lock).length + stateClauses(lock).length + deferredClauses(lock).length,
      });
    }
  });

  it('S-245 모든 문 · 모든 철 × 낮밤 · 모든 패턴에서 판정이 isConnectorOpen 과 같다', () => {
    for (const lock of LOCKS) {
      if (lock.at.kind !== 'connector') continue;
      // C039 CHANGED — **성질 · 앎을 밝힌 문은 여기서 재지 않는다** (아래 S-246 이 잰다).
      // 그 문의 열림은 이제 **문 앞에 선 몸**이 함께 정하고(규칙 6), 조건 하나는 몸을 자리로
      // 고르지 못한다(ref 없는 행위자 잎 = 판정 불가 · 규칙 5) — 그래서 조건의 답과 문의
      // 열림이 같을 수 없는 갈래가 생겼다. 나머지 문(철 · 배열만 묻는 문)의 답은 그대로다.
      if (deferredClauses(lock).length > 0) continue;
      const condition = lockCondition(lock)!;
      const decidable = decidablePart(condition);
      for (const { label, w } of lockWorlds(lock)) {
        for (const sample of TIME_GRID) {
          const s = at(state(w), sample.time);
          const open = isConnectorOpen(s.regionStates, lock.at.ref, sample.time);
          // 판정하는 잎만 모은 all 의 답이 문의 열림과 같다
          const judged = worldConditionVerdict(s, decidable);
          expect({ lock: lock.id, world: label, ...sample, open, judged }).toEqual({
            lock: lock.id,
            world: label,
            ...sample,
            open,
            judged: open ? 'met' : 'unmet',
          });
        }
      }
    }
  });

  it('S-246 (경계) property · knowledge 항을 가진 문은 조건으로는 판정 불가다 — 열림은 문 앞의 몸이 함께 정한다', () => {
    const asking = LOCKS.filter((lock) => deferredClauses(lock).length > 0);
    // 데이터에 그런 문이 있다 (없으면 이 경계는 잴 것이 없다 — 그것도 밝힌다)
    expect({ asking: asking.length > 0 }).toEqual({ asking: true });
    for (const lock of asking) {
      if (lock.at.kind !== 'connector') continue;
      const condition = lockCondition(lock)!;
      // C039 CHANGED — 그 잎은 이제 **판정 가능한 갈래**(actor · capability)이고, 판정 불가인
      // 까닭이 갈래가 아니라 **ref 가 없다는 것**으로 옮겼다: 자리로 고르는 것이고 고르는
      // 자리는 문의 판정이다 (규칙 5 · 기본형 ⑧). 그래서 형의 크기를 재던 두 줄을 뺀다.
      expect(hasDeferred(condition)).toBe(false);
      for (const one of conditionLeaves(condition)) {
        if (one.target.kind !== 'actor') continue;
        expect(one.target.ref).toBeUndefined();
      }
      for (const { label, w } of lockWorlds(lock)) {
        for (const sample of TIME_GRID) {
          const s = at(state(w), sample.time);
          const open = isConnectorOpen(s.regionStates, lock.at.ref, sample.time);
          const whole = worldConditionVerdict(s, condition);
          // 몸을 가리키지 않는 나머지 항들(철 · 배열)의 답
          const others = worldConditionVerdict(s, {
            all: conditionLeaves(condition).filter((leaf) => leaf.target.kind !== 'actor'),
          });
          // C039 CHANGED — **몸 없이 물으면 그 문은 어느 철에도 잠김이다** (규칙 6 ⑤ · 규칙 10 ②):
          // 여기 isConnectorOpen 은 몸을 주지 않으므로 성질 요구가 서지 않는다. 조건 하나로 묻는
          // 전체는 나머지가 참일 때 **판정 불가**이고(몸의 잎이 자리로 골라지지 않았다),
          // 나머지가 거짓이면 거짓이다 (지금 그대로).
          expect({ lock: lock.id, world: label, ...sample, open, whole }).toEqual({
            lock: lock.id,
            world: label,
            ...sample,
            open: false,
            whole: others === 'met' ? 'undecidable' : others,
          });
        }
      }
    }
  });

  it('S-247 항이 하나도 없는 요구는 묻지 않는 것과 같다 — undefined', () => {
    const bare: Lock = {
      id: 'BARE',
      at: { kind: 'connector', ref: 'NOWHERE' },
      strength: 'hard',
      requires: [{}],
      traces: [],
    };
    expect(lockCondition(bare)).toBeUndefined();
    expect(lockCondition({ ...bare, requires: [] })).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-003 원천의 때가 형으로 읽힌다', () => {
  const timed = ALL_SOURCES.filter((s) => s.occurrenceSeasons || s.occurrenceDayPhases);
  const plain = ALL_SOURCES.filter((s) => !s.occurrenceSeasons && !s.occurrenceDayPhases);

  it('S-248 seasons · dayPhases 가 clock Target 의 IN 조건으로 읽히고, 밝히지 않은 원천은 undefined 다', () => {
    expect({ timed: timed.length > 0, plain: plain.length > 0 }).toEqual({ timed: true, plain: true });
    for (const source of timed) {
      const condition = sourceOccurrenceCondition(source);
      expect({ source: source.id, read: condition !== undefined }).toEqual({ source: source.id, read: true });
      const leaves = conditionLeaves(condition!);
      for (const one of leaves) {
        expect({ source: source.id, target: one.target.kind, query: one.query.kind, operator: one.operator }).toEqual({
          source: source.id,
          target: 'clock',
          query: 'property',
          operator: 'IN',
        });
      }
      if (source.occurrenceSeasons) {
        const found = leaves.find((l) => l.query.path === 'season');
        expect({ source: source.id, value: found?.value }).toEqual({
          source: source.id,
          value: [...source.occurrenceSeasons],
        });
      }
      if (source.occurrenceDayPhases) {
        const found = leaves.find((l) => l.query.path !== 'season');
        expect({ source: source.id, value: found?.value }).toEqual({
          source: source.id,
          value: [...source.occurrenceDayPhases],
        });
      }
      expect(leaves.length).toBe((source.occurrenceSeasons ? 1 : 0) + (source.occurrenceDayPhases ? 1 : 0));
    }
    for (const source of plain) {
      expect({ source: source.id, condition: sourceOccurrenceCondition(source) }).toEqual({
        source: source.id,
        condition: undefined,
      });
    }
  });

  it('S-249 판정이 sourceConditions 의 not-this-season · not-this-hour 와 철 넷 × 낮밤 둘에서 같다', () => {
    const w = standingIn(FOREST_EDGE);
    for (const source of timed) {
      const condition = sourceOccurrenceCondition(source)!;
      for (const sample of TIME_GRID) {
        const s = at(state(w), sample.time);
        const codes = sourceConditions(
          s.regionStates,
          source,
          sample.time,
          (s as unknown as { presences: Record<string, never> }).presences,
        );
        const stands = !codes.includes(NOT_THIS_SEASON) && !codes.includes(NOT_THIS_HOUR);
        expect({ source: source.id, ...sample, stands, verdict: verdictOf(s, condition) }).toEqual({
          source: source.id,
          ...sample,
          stands,
          verdict: stands ? 'met' : 'unmet',
        });
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-004 위상과 결속이 형으로 읽힌다', () => {
  it('S-250 철 열쇠가 clock 조건으로 읽히고 그 판정이 regionPhaseAt 과 철 넷 × 낮밤 둘에서 같다', () => {
    expect(SEASON_ROOMS.length).toBeGreaterThan(0);
    const w = standingIn(FOREST_EDGE);
    for (const season of SEASONS) {
      const condition = phaseSeasonCondition(season);
      expect(conditionLeaves(condition)).toMatchObject([
        { target: { kind: 'clock' }, query: { kind: 'property', path: 'season' }, operator: '==', value: season },
      ]);
      for (const sample of TIME_GRID) {
        const s = at(state(w), sample.time);
        const verdict = worldConditionVerdict(s, condition);
        // 시계가 그 철이면 참이다
        expect({ key: season, ...sample, verdict }).toEqual({
          key: season,
          ...sample,
          verdict: worldClockAt(sample.time).season === season ? 'met' : 'unmet',
        });
        // 그리고 그 철의 열쇠를 밝힌 방마다 — 참일 때만 그 철의 덧씌움이 난다
        for (const room of SEASON_ROOMS) {
          if (!seasonKeysOf(room).includes(season)) continue;
          const expected = regionSpec(room)!.phases!.seasons![season];
          const phase = regionPhaseAt(room, sample.time);
          expect({ room, key: season, ...sample, isThat: phase === expected }).toEqual({
            room,
            key: season,
            ...sample,
            isThat: verdict === 'met',
          });
        }
      }
    }
  });

  it('S-251 결속의 요구 넷이 source · clock · region 조건으로 읽힌다', () => {
    const requirements = ALL_SITES.flatMap((site) => site.requires);
    expect(requirements.length).toBeGreaterThan(0);
    const kinds = new Set(requirements.map((r) => r.kind));
    for (const requirement of requirements) {
      const leaves = conditionLeaves(lifeRequirementCondition(requirement));
      expect(leaves.length).toBe(1);
      const one = leaves[0]!;
      switch (requirement.kind) {
        case 'source-available':
          expect(one).toMatchObject({
            target: { kind: 'source', ref: requirement.sourceId },
            operator: '==',
            value: AVAILABLE,
          });
          expect(['state', 'exists']).toContain(one.query.kind);
          break;
        case 'rain':
          expect(one).toMatchObject({ target: { kind: 'clock' }, query: { kind: 'property' }, operator: '==' });
          expect(one.query.path).toMatch(/rain/);
          break;
        case 'population-at-most':
          expect(one).toMatchObject({ target: { kind: 'region' }, query: { kind: 'count' }, operator: '<=', value: requirement.value });
          expect(one.query.path).toContain(requirement.populationId);
          break;
        case 'population-at-least':
          expect(one).toMatchObject({ target: { kind: 'region' }, query: { kind: 'count' }, operator: '>=', value: requirement.value });
          expect(one.query.path).toContain(requirement.populationId);
          break;
      }
    }
    // 데이터가 넷을 다 쓰는가는 데이터의 일이다 — 쓰는 갈래를 밝혀 둔다 (수를 단언하지 않는다)
    expect(kinds.size).toBeGreaterThan(0);
  });

  /** 결속의 요구를 갈라 보는 세계들 — 개체군의 값과 원천의 phase 를 손잡이로 세운다 */
  function lifeVariants(): { label: string; w: WorldDriver }[] {
    const populationIds = new Set<string>();
    const sourceIds = new Set<string>();
    for (const requirement of ALL_SITES.flatMap((site) => site.requires)) {
      if (requirement.kind === 'population-at-most' || requirement.kind === 'population-at-least') {
        populationIds.add(requirement.populationId);
      }
      if (requirement.kind === 'source-available') sourceIds.add(requirement.sourceId);
    }
    const zero = Object.fromEntries([...populationIds].map((id) => [id, 0]));
    const many = Object.fromEntries([...populationIds].map((id) => [id, 99]));
    const gone = Object.fromEntries([...sourceIds].map((id) => [id, 'depleted']));
    return [
      { label: 'default', w: standingIn(FOREST_EDGE) },
      { label: 'population=0', w: standingIn(FOREST_EDGE, undefined, { populations: zero }) },
      { label: 'population=many', w: standingIn(FOREST_EDGE, undefined, { populations: many }) },
      { label: 'sources=depleted', w: standingIn(FOREST_EDGE, undefined, { sourcePhases: gone }) },
      {
        label: 'population=0+depleted',
        w: standingIn(FOREST_EDGE, undefined, { populations: zero, sourcePhases: gone }),
      },
    ];
  }

  it('S-252 요구마다의 판정이 lifeUnmetCodes 와 같다 — 철 넷 × 낮밤 둘 · 값과 phase 를 갈라 본다', () => {
    const variants = lifeVariants();
    let unmetSeen = 0;
    let metSeen = 0;
    for (const { label, w } of variants) {
      for (const site of ALL_SITES) {
        for (const [index, requirement] of site.requires.entries()) {
          const condition = lifeRequirementCondition(requirement);
          // 요구 하나만 든 탄생지로 물어 코드가 겹쳐도 그 요구의 답을 잰다
          const single: LifeSite = { ...site, requires: [requirement] };
          for (const sample of TIME_GRID) {
            const s = at(state(w), sample.time);
            const unmet = lifeUnmetCodes(s.regionStates, single, sample.time).includes(requirement.unmetCode);
            if (unmet) unmetSeen++;
            else metSeen++;
            expect({ world: label, site: site.id, n: index, ...sample, unmet, verdict: worldConditionVerdict(s, condition) }).toEqual({
              world: label,
              site: site.id,
              n: index,
              ...sample,
              unmet,
              verdict: unmet ? 'unmet' : 'met',
            });
          }
        }
      }
    }
    // 두 답을 다 보았다 — 한쪽만 보면 같음이 헛돈다
    expect({ unmetSeen: unmetSeen > 0, metSeen: metSeen > 0 }).toEqual({ unmetSeen: true, metSeen: true });
  });

  it('S-253 (경계) 비의 요구는 한 바퀴를 촘촘히 걸어도 lifeUnmetCodes 와 같다 — 비 오는 때와 아닌 때를 다 본다', () => {
    const rain = ALL_SITES.flatMap((site) => site.requires.map((r) => ({ site, r }))).filter(
      (x): x is { site: LifeSite; r: Extract<LifeRequirement, { kind: 'rain' }> } => x.r.kind === 'rain',
    );
    expect({ rain: rain.length > 0 }).toEqual({ rain: true });
    const w = standingIn(FOREST_EDGE);
    let raining = 0;
    let dry = 0;
    for (const { site, r } of rain) {
      const condition = lifeRequirementCondition(r);
      const single: LifeSite = { ...site, requires: [r] };
      for (const time of DENSE_GRID) {
        const s = at(state(w), time);
        const unmet = lifeUnmetCodes(s.regionStates, single, time).includes(r.unmetCode);
        if (unmet) dry++;
        else raining++;
        expect({ site: site.id, time, verdict: worldConditionVerdict(s, condition) }).toEqual({
          site: site.id,
          time,
          verdict: unmet ? 'unmet' : 'met',
        });
      }
    }
    expect({ raining: raining > 0, dry: dry > 0 }).toEqual({ raining: true, dry: true });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-005 검사 ㊹ — 조건이 가리키는 것', () => {
  const report = runWorldCheck();
  const itemById = (r: CheckReport, id: string): CheckItem | undefined => r.items.find((i) => i.id === id);
  const itemByMark = (r: CheckReport, mark: string): CheckItem => {
    const found = r.items.find((i) => i.mark === mark);
    if (!found) throw new Error(`보고에 검사 ${mark} 가 없다`);
    return found;
  };
  /** 검사의 입력에 유령 자리 하나를 더한다 — 데이터는 손대지 않는다 */
  function withGhost(ghost: CheckConditionSite): CheckRegionsInput {
    const input = worldCheckInput();
    if (!input.condition) throw new Error('worldCheckInput 이 조건 쪽 계약(condition)을 주지 않는다');
    return { ...input, condition: { ...input.condition, sites: [...input.condition.sites, ghost] } };
  }
  const soundLeaf = (): ConditionLeaf => ({
    target: { kind: 'clock' },
    query: { kind: 'property', path: 'season' },
    operator: 'IN',
    value: ['STILL'],
  });

  it('S-254 ㊹ 가 id condition-refs 로 서고 통과다 — 읽힌 조건 전부의 참조가 성하다', () => {
    expect(CONDITION_ITEM.id).toBe(CONDITION_REFS_ID);
    const item = itemById(report, CONDITION_REFS_ID);
    expect(item, '보고에 condition-refs 가 없다').toBeDefined();
    expect(item!.mark).toBe(CONDITION_REFS_MARK);
    expect(item!.status).toBe('pass');
    expect(item!.answer.length).toBeGreaterThan(0);
    // 자리 넷과 기억 조건이 다 검사에 들었다 — Lock 마다 그 자리가 있다
    const sites = worldConditionSites();
    for (const lock of LOCKS) {
      expect(sites.map((s) => s.where)).toContain(`${CONDITION_SITE_LOCK}:${lock.id}`);
    }
    expect(sites.some((s) => conditionLeaves(s.condition).some((l) => l.target.kind === 'history'))).toBe(true);
    // 보고는 ok 다
    expect({ fail: report.counts.fail, ok: report.ok }).toEqual({ fail: 0, ok: true });
  });

  it('S-255 유령 ref 를 넣으면 ㊹ 만 fail 이고 다른 항목의 답은 그대로다', () => {
    const ghost: CheckConditionSite = {
      where: 'ghost:room',
      condition: { ...soundLeaf(), target: { kind: 'region', ref: 'NO_SUCH_ROOM' }, query: { kind: 'state', path: 'pattern' } },
    };
    const broken = checkRegions(withGhost(ghost));
    const item = itemById(broken, CONDITION_REFS_ID)!;
    expect(item.status).toBe('fail');
    expect(item.refs.map((r) => r.where)).toContain('ghost:room');
    expect(broken.ok).toBe(false);
    for (const before of report.items) {
      if (before.id === CONDITION_REFS_ID) continue;
      expect({ id: before.id, status: itemById(broken, before.id)?.status }).toEqual({ id: before.id, status: before.status });
    }
  });

  it('S-256 없는 속성 · 어긋난 qualifier · 값 없는 IN 도 fail 이다', () => {
    const cases: { name: string; condition: Condition }[] = [
      { name: 'no-such-path', condition: { ...soundLeaf(), query: { kind: 'property', path: 'no-such-property' } } },
      { name: 'bad-qualifier', condition: { ...soundLeaf(), qualifier: { kind: 'time', mode: 'WITHIN', seconds: -1 } } },
      { name: 'in-without-list', condition: { ...soundLeaf(), value: 'STILL' } },
      { name: 'exists-with-value', condition: { ...soundLeaf(), operator: 'EXISTS' } },
    ];
    for (const one of cases) {
      const broken = checkRegions(withGhost({ where: `ghost:${one.name}`, condition: one.condition }));
      expect({ name: one.name, status: itemById(broken, CONDITION_REFS_ID)?.status }).toEqual({ name: one.name, status: 'fail' });
    }
    // 성한 잎은 통과다 — 검사가 헛돌지 않는다
    const sound = checkRegions(withGhost({ where: 'ghost:sound', condition: soundLeaf() }));
    expect(itemById(sound, CONDITION_REFS_ID)?.status).toBe('pass');
  });

  it('S-257 (경계) ㉓ · ㉖ · ㉞ 의 답은 그대로다 — 겹쳐 보되 지우지 않는다', () => {
    for (const mark of KEPT_MARKS) {
      expect({ mark, status: itemByMark(report, mark).status }).toEqual({ mark, status: 'pass' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-006 기억이 조건이 된다', () => {
  /** 숲 가장자리의 방 차례 안에서 고래가 이 방에 드는 마디 — 데이터가 소유한다 */
  const scaleNode = (): number => {
    const index = roomsOnRoute(SKY_WHALE_ROUTE).indexOf(FOREST_EDGE);
    if (index < 0) throw new Error(`${SKY_WHALE_ROUTE} 가 ${FOREST_EDGE} 를 지나지 않는다`);
    return index;
  };
  /** 고래가 아직 이 방에 들지 않은 세계 — 몸은 비늘 자리 곁이다 */
  function beforePassage(extra: WorldSetup = {}): { w: WorldDriver; source: ResourceSource } {
    const source = scaleSource();
    const base = standingIn(FOREST_EDGE, undefined, { actorItems: { pickaxe: 9 }, ...extra });
    const w = beside(base, source);
    if (passageOf(w, FOREST_EDGE, SKY_WHALE_ROUTE) !== undefined) {
      throw new Error('세계가 서자마자 고래가 이미 이 방을 지났다 — 하네스가 "지나기 전" 을 세울 수 없다');
    }
    return { w, source };
  }

  it('S-258 비늘 자리의 조건이 history <이 방> · passages[SKY_WHALE_ROUTE] · EXISTS 로 적혀 있다', () => {
    const source = scaleSource();
    // spec 이 못 박은 자리 — 비늘이다
    expect(source.id).toBe('FALLEN_SCALE');
    expect(conditionLeaves(memoryConditionOf(source)!)).toMatchObject([
      {
        target: { kind: 'history', ref: FOREST_EDGE },
        query: { kind: 'history', path: `passages.${SKY_WHALE_ROUTE}` },
        operator: 'EXISTS',
      },
    ]);
    // 다른 원천은 기억 조건을 밝히지 않았다 — 첫 사례 하나뿐이다
    expect(ALL_SOURCES.filter((s) => memoryConditionOf(s) !== undefined).map((s) => s.id)).toEqual([source.id]);
  });

  it('S-259 고래가 지나지 않은 세계에서는 거짓이고 판이 needs-passage 를 싣는다 — 지난 뒤에는 그 줄이 사라진다', () => {
    const { w, source } = beforePassage();
    const condition = memoryConditionOf(source)!;
    // Then 지나기 전 — 조건이 서지 않고 코드가 실린다
    expect(worldConditionVerdict(state(w), condition)).toBe('unmet');
    expect(NEEDS_PASSAGE).toBe(CODE_NEEDS_PASSAGE);
    expect(sourceMemoryConditionCodes(state(w), source)).toEqual([CODE_NEEDS_PASSAGE]);
    const seenBefore = seenConditions(w, source.id);
    expect(seenBefore, '비늘 자리가 관찰에 실리지 않았다').toBeDefined();
    expect(seenBefore).toContain(CODE_NEEDS_PASSAGE);

    // When 고래가 이 방을 지난다 (세계의 시간표가 부른 그 지나감이다)
    runToNode(w, SKY_WHALE_ROUTE, scaleNode());
    expect(passageOf(w, FOREST_EDGE, SKY_WHALE_ROUTE)?.times).toBe(1);
    // Then 조건이 참이고 그 줄이 사라졌다 — 조건이 기억을 읽었다
    expect(worldConditionVerdict(state(w), condition)).toBe('met');
    expect(sourceMemoryConditionCodes(state(w), source)).toEqual([]);
    expect(seenConditions(w, source.id) ?? []).not.toContain(CODE_NEEDS_PASSAGE);
    // And 지나간 뒤에도 (지나감이 끝나도) 기억은 남아 조건이 참이다
    wait(w, PRESENCE_SECONDS_PER_NODE * roomsOnRoute(SKY_WHALE_ROUTE).length + 2, 5);
    expect(worldConditionVerdict(state(w), condition)).toBe('met');
    expect(seenConditions(w, source.id) ?? []).not.toContain(CODE_NEEDS_PASSAGE);
  });

  it('S-260 (경계 ①) 조건이 거짓이어도 참이어도 원천의 phase · 되돌아옴 · 채취 판정은 한 값도 다르지 않다', () => {
    // Given 같은 자리에서 갈라진 세계 둘 — 하나는 기억에 지나감이 써 있다 (조건만 참이다)
    const { w: base, source } = beforePassage();
    const condition = memoryConditionOf(source)!;
    const plainWorld = worldFrom(base, () => {});
    const remembered = worldFrom(base, (s) => writePassage(s, FOREST_EDGE, SKY_WHALE_ROUTE, 1));
    expect(worldConditionVerdict(state(plainWorld), condition)).toBe('unmet');
    expect(worldConditionVerdict(state(remembered), condition)).toBe('met');
    // Then 원천의 State 가 같고
    expect(storedOf(remembered, FOREST_EDGE, source.id)).toEqual(storedOf(plainWorld, FOREST_EDGE, source.id));
    // 채취의 판정이 같고 (거절이든 성공이든 같은 답이다)
    const a = mineOnce(plainWorld, source.id);
    const b = mineOnce(remembered, source.id);
    expect(b).toEqual(a);
    // 그리고 조건 코드만 갈린다 — 갈라진 직후에 잰다 (시간을 굴리면 시간표의 고래가 두 세계 모두를 지나
    // 기억을 같게 만든다 · 그것은 이 항의 물음이 아니다)
    expect(sourceMemoryConditionCodes(state(plainWorld), source)).toEqual([CODE_NEEDS_PASSAGE]);
    expect(sourceMemoryConditionCodes(state(remembered), source)).toEqual([]);
    // 되돌아옴도 같다 — 같은 시간을 굴려 같은 자리에 선다
    wait(plainWorld, 300, 5);
    wait(remembered, 300, 5);
    expect(storedOf(remembered, FOREST_EDGE, source.id)).toEqual(storedOf(plainWorld, FOREST_EDGE, source.id));
    // And 기억을 뺀 세계 전체가 한 값도 다르지 않다 (c034 S-236 의 자)
    const withoutHistory = (w: WorldDriver): string => {
      const copy = JSON.parse(JSON.stringify(state(w))) as { regionStates: Record<string, RegionStateShape> };
      for (const held of Object.values(copy.regionStates)) delete held.history;
      return JSON.stringify(copy);
    };
    expect(withoutHistory(remembered)).toBe(withoutHistory(plainWorld));
  });

  it('S-261 (경계 ②) 되살린 세계에서도 같은 답이다 — history 가 남으므로 조건도 남는다', () => {
    const { w, source } = beforePassage();
    const condition = memoryConditionOf(source)!;
    // 지나기 전에 되살려도 거짓이고
    const revivedBefore = revive(w);
    expect(worldConditionVerdict(state(revivedBefore), condition)).toBe('unmet');
    expect(seenConditions(revivedBefore, source.id)).toContain(CODE_NEEDS_PASSAGE);
    // 지난 뒤에 되살리면 참이다
    runToNode(w, SKY_WHALE_ROUTE, scaleNode());
    expect(worldConditionVerdict(state(w), condition)).toBe('met');
    const revivedAfter = revive(w);
    expect(passageOf(revivedAfter, FOREST_EDGE, SKY_WHALE_ROUTE)?.times).toBe(1);
    expect(worldConditionVerdict(state(revivedAfter), condition)).toBe('met');
    expect(sourceMemoryConditionCodes(state(revivedAfter), source)).toEqual([]);
    expect(seenConditions(revivedAfter, source.id) ?? []).not.toContain(CODE_NEEDS_PASSAGE);
  });

  it('S-262 (경계 ③) 기억 조건을 밝히지 않은 원천에는 그 코드가 어느 때에도 실리지 않는다', () => {
    const w = standingIn(FOREST_EDGE);
    const loaded = worldFrom(w, (s) => {
      for (const spec of REGION_SPECS) writePassage(s, spec.id, SKY_WHALE_ROUTE, 1);
    });
    for (const source of ALL_SOURCES) {
      if (memoryConditionOf(source) !== undefined) continue;
      expect({ source: source.id, fresh: sourceMemoryConditionCodes(state(w), source) }).toEqual({ source: source.id, fresh: [] });
      expect({ source: source.id, loaded: sourceMemoryConditionCodes(state(loaded), source) }).toEqual({ source: source.id, loaded: [] });
    }
  });

  it.todo(
    'GAP: 판의 조건 줄 자체(「지나간 것이 있어야 한다」 의 문구와 그 줄이 서는 자리)는 이 하네스로 놓을 수 없다 — 문구는 content/view 의 code-text 가 짓는다. 세계 쪽에서 잴 수 있는 것은 그 판이 읽는 값(entities[].conditions 의 코드 needs-passage)까지다 (c030 · c034 가 세운 그 경계 그대로)',
  );
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-007 규칙 코드의 이름 0', () => {
  it('S-263 어댑터 · 평가기 · 검사에 방 · 원천 · 경로 · 철의 이름 글자가 없다 (grep 이 증거)', () => {
    const names = [
      ...REGION_SPECS.map((s) => s.id),
      ...ALL_SOURCES.map((s) => s.id),
      ...PRESENCE_ROUTES.map((r) => r.id),
      ...SEASONS,
    ];
    const files = [
      'content/world/semantic/condition.ts',
      'engine/world-authoring/condition.ts',
      'engine/world-authoring/check.ts',
    ];
    const hits: string[] = [];
    for (const file of files) {
      readFileSync(`${ROOT}${file}`, 'utf8')
        .split('\n')
        .forEach((text, index) => {
          for (const name of names) {
            // 낱말로 잰다 — RETURN 이 TURN 에 걸리지 않게 (이름 글자 그 자체만 본다)
            if (new RegExp(`(^|[^A-Za-z0-9_])${name}([^A-Za-z0-9_]|$)`).test(text)) {
              hits.push(`${file}:${index + 1}  ${name}  │ ${text.trim()}`);
            }
          }
        });
    }
    // Given 검사가 헛돌지 않는다 — 이름이 살아도 되는 자리(데이터)에서는 걸린다
    const data = readFileSync(`${ROOT}content/regions/presence-routes.ts`, 'utf8');
    expect(names.some((name) => data.includes(name))).toBe(true);
    // Then 세 파일 어디에도 한 자리도 없다
    expect(hits.join('\n')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('회귀', () => {
  it('S-264 (SPEC-008 · 문) 문마다 · 철마다 건너기의 답이 조건의 판정과 같다 — 열리면 건너고 닫히면 거절이다', () => {
    for (const lock of LOCKS) {
      if (lock.at.kind !== 'connector') continue;
      const decidable = decidablePart(lockCondition(lock)!);
      for (const season of SEASONS) {
        // 문의 anchor 이름은 그래프의 그 방 쪽 끝이 안다 — 문 id 와 같지 않을 수 있다 (미로의 심장 문이 그렇다)
        const end = [connectorOf(lock.at.ref).from, connectorOf(lock.at.ref).to].find((e) => e.region === lock.region)!;
        const w = inSeason(season, lock.region, anchorAt(lock.region, end.anchor));
        if (w.observe().clock.season !== season) runToSeason(w, season);
        expect(w.observe().clock.season).toBe(season);
        const judged = worldConditionVerdict(state(w), decidable);
        const result = cross(w, lock.at.ref);
        const reason = (result as { reason?: string }).reason;
        // 문의 답 — 닫혔으면 **문의 사유**(철 · 배열)로 거절이고, 열렸으면 문은 거절하지 않는다.
        // 열린 문 너머가 아직 세워지지 않은 방(frontier)이면 다른 사유로 서지만 그것은 문의 답이 아니다 (C002 의 규율)
        const doorReasons = ['not-this-season', 'connector-inactive'];
        expect({ lock: lock.id, season, judged, doorRefused: result.status === 'failure' && doorReasons.includes(reason ?? '') }).toEqual({
          lock: lock.id,
          season,
          judged,
          doorRefused: judged !== 'met',
        });
        if (result.status === 'success') expect(actorOf(w, bodyOf(w)).regionId).not.toBe(lock.region);
      }
    }
  });

  it('S-265 (SPEC-008 · 원천 · 위상 · 결속) 조건 자리 넷의 데이터가 한 글자도 달라지지 않았다 — 어댑터는 읽기만 한다', () => {
    // 읽기 전과 후의 데이터가 같다 (JSON 으로 잰다 — 형으로 읽는 것이 데이터를 바꾸지 않는다)
    const before = JSON.stringify({
      locks: LOCKS,
      sources: ALL_SOURCES.map((s) => [s.id, s.occurrenceSeasons, s.occurrenceDayPhases, memoryConditionOf(s)]),
      phases: REGION_SPECS.map((s) => [s.id, s.phases?.seasons]),
      sites: ALL_SITES.map((s) => [s.id, s.requires]),
    });
    for (const lock of LOCKS) lockCondition(lock);
    for (const source of ALL_SOURCES) sourceOccurrenceCondition(source);
    for (const season of SEASONS) phaseSeasonCondition(season);
    for (const site of ALL_SITES) for (const r of site.requires) lifeRequirementCondition(r);
    worldConditionSites();
    const after = JSON.stringify({
      locks: LOCKS,
      sources: ALL_SOURCES.map((s) => [s.id, s.occurrenceSeasons, s.occurrenceDayPhases, memoryConditionOf(s)]),
      phases: REGION_SPECS.map((s) => [s.id, s.phases?.seasons]),
      sites: ALL_SITES.map((s) => [s.id, s.requires]),
    });
    expect(after).toBe(before);
  });

  it('S-266 (SPEC-008 · hash) 방마다 땅의 hash 가 그대로다', () => {
    for (const spec of REGION_SPECS) {
      const w = standingIn(spec.id);
      expect({ id: spec.id, hash: w.observe().region.hash }).toEqual({
        id: spec.id,
        hash: descriptionHash(spaceOf(spec.id)),
      });
    }
  });

  it('S-267 (SPEC-008 · 검사) 두 번 돌려도 글자까지 같고 ok 다 — 조건 자리는 결정론 차례다', () => {
    const a = JSON.stringify(runWorldCheck());
    const b = JSON.stringify(runWorldCheck());
    expect(a).toBe(b);
    expect(JSON.stringify(worldConditionSites())).toBe(JSON.stringify(worldConditionSites()));
    expect(runWorldCheck().ok).toBe(true);
  });

  it('S-268 (Observable 4) world:observe --report 에 조건 표가 선다 — 조건 자리마다 그 자리의 이름이 한 줄씩 있다', () => {
    const run = runTool(OBSERVE, ['--report']);
    expect(run.status).toBe(0);
    for (const site of worldConditionSites()) {
      expect({ where: site.where, listed: run.out.includes(site.where) }).toEqual({ where: site.where, listed: true });
    }
  });
});
