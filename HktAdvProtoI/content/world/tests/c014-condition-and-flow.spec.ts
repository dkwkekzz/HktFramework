// C014 — 조건과 흐름, 그리고 보고 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// C013 은 되돌아옴을 세웠고 고리 한 줄에서 멈췄다. 이 Cycle 이 재는 것은 다섯이다:
//   ① 세 번째 재료가 **부산물**로 나고 한 번에 다 뜯긴다 (둥지의 균사)
//   ② 사슬이 **셋**이 된다 — 균사를 캐면 뿌리혹이 멎고 그러면 노두도 멎는다 (두 방 건너)
//   ③ 흐름이 **주기로** 온다 — 물길이 불어난 때만 어귀에 퇴적이 실려 오고, 그 밖에는 오지 않는다
//   ④ 흐름은 **출발에 매달린다** — 호수 바닥을 캐 놓으면 아무리 기다려도 오지 않는다
//   ⑤ 백왕령은 이 계통 밖이고, 앞의 것(원천 넷 · 미로 · 땅)은 한 값도 달라지지 않는다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(흐름의 주기 · 조건 코드 · 검사 열셋)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C014-condition-and-flow/spec.md 뿐이다.
//
// **좌표도 횟수도 시간도 손으로 적지 않는다** — 원천의 자리는 그 방 Description 의 resource
// point 에서, 캘 수 있는 횟수는 harvests 에서, 되돌아오는 길이는 recoverySeconds 에서,
// 흐름의 주기와 활성 구간은 RESOURCE_FLOWS 의 데이터에서 읽는다.
//
// SPEC-007 · SPEC-008(검사 보고)은 세계가 아니라 **도구**를 재므로 다른 파일이 소유한다 —
// tools/world-editor/tests/c014-condition-and-flow.spec.ts (그 폴더의 c007-observe 선례).

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
  BIO_ORE,
  BIO_ORE_FIELD,
  COMPILE_RULES,
  DEEP_TRAIL,
  EXPLORER_RUIN,
  FOREST_DEEP,
  FOREST_EDGE,
  HEART_LAKE,
  HEART_RIVER,
  NEST_TRAIL,
  ORE_EATER_MOLT,
  ORE_TRAIL,
  PREDATOR_NEST,
  PRESENCE_LAYER,
  RECOVERY_STALLED,
  RED_EYE_TREE,
  REGION_SPECS,
  RESOURCE_FLOWS,
  RESOURCE_LAYER,
  START_REGION_ID,
  TRACE_LAYER,
  TREE_APPROACH,
  WHITE_KING_DOMAIN,
  regionSpec,
  type ResourceSourceSpec,
} from '../../regions';
// C008 이 세운 미로의 이름들 — 그 파일이 소유한다 (c008 ~ c013 시나리오의 선례 그대로).
import { CELL_LAYER, FANTASY_MAZE, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { INTERACTION_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { sourceStateOf, traceStrengthAt } from '../semantic/resource';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

// ── spec 이 동결한 이름과 코드 ────────────────────────────────────────
//
// 원천과 재료의 id 는 spec 의 데이터 표가 못 박은 것이다. 형태 코드(사체 위 균사 · 어귀의
// 알갱이 · 호수 바닥의 침전)는 **적지 않는다** — spec 이 사람의 말로만 주었으므로 데이터에서 읽는다.

const MOLT_LITTER = 'MOLT_LITTER';
const RUIN_SPOIL = 'RUIN_SPOIL';
const ORE_OUTCROP = 'ORE_OUTCROP';
const ROOT_NODULE = 'ROOT_NODULE';
/** C014 가 세우는 원천 셋 */
const NEST_FUNGUS = 'NEST_FUNGUS';
const RIVER_SILT = 'RIVER_SILT';
const LAKE_SILT_BED = 'LAKE_SILT_BED';

/** 세 번째 재료 (World Change 1) */
const GIANT_TREE_FUNGUS = 'GIANT_TREE_FUNGUS';

/** 흐름 하나 (Data 절 Flow) */
const FLOW_HEART_SILT = 'FLOW_HEART_SILT';

/** phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';
const RECOVERING = 'recovering';

/** 이 Cycle 이 더한 조건 코드 둘 (spec Observable) */
const FLOW_ARRIVED = 'flow-arrived';
const CONDITION_UNMET = 'condition-unmet';

/** 거절 사유 (C012 · C013 그대로) */
const SOURCE_DEPLETED = 'source-depleted';

/** 원천 일곱 — 방과 재료. 자리 · 횟수 · 시간 · 형태는 전부 데이터에서 읽는다 */
const SEVEN = [
  { id: MOLT_LITTER, region: FOREST_EDGE, material: ORE_EATER_MOLT },
  { id: RUIN_SPOIL, region: EXPLORER_RUIN, material: ORE_EATER_MOLT },
  { id: ORE_OUTCROP, region: BIO_ORE_FIELD, material: BIO_ORE },
  { id: ROOT_NODULE, region: RED_EYE_TREE, material: BIO_ORE },
  { id: NEST_FUNGUS, region: PREDATOR_NEST, material: GIANT_TREE_FUNGUS },
  { id: RIVER_SILT, region: FOREST_DEEP, material: BIO_ORE },
  { id: LAKE_SILT_BED, region: HEART_LAKE, material: BIO_ORE },
] as const;

type One = (typeof SEVEN)[number];
const oneOf = (id: string): One => {
  const found = SEVEN.find((s) => s.id === id);
  if (!found) throw new Error(`시나리오가 원천 '${id}' 를 모른다`);
  return found;
};

/** C011~C013 이 세운 넷 — 이 Cycle 이 건드리지 않는다 (SPEC-010 · 회귀) */
const FOUR = SEVEN.slice(0, 4);
/** 이 Cycle 이 세우는 셋 */
const ADDED = SEVEN.slice(4);
/** 흐름 밖의 원천 다섯 — 흐름의 두 끝이 아닌 것들 (SPEC-004 경계 ③) */
const OUTSIDE_FLOW = SEVEN.filter((one) => one.id !== RIVER_SILT && one.id !== LAKE_SILT_BED);

/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (C011~C013 어법) */
const MINE_SECONDS = 1.2;

const solo: WorldSetup = { npcs: [] };

// ── 계약이 준 형 (spec State 절 · Observable 절 그대로 적어 둔다) ─────

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

// ── 하네스 (c011 · c012 · c013 의 선례 그대로) ───────────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id = PLAYER) => state(w).actors.find((a) => a.id === id)!;
/** 세계 시각 — 흐름의 활성 구간은 여기서 유도된다 (spec R1) */
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
function gridSpots(id: string): XZ[] {
  const t = terrainOf(id);
  const out: XZ[] = [];
  for (let iz = 0; iz < t.rows; iz++) {
    for (let ix = 0; ix < t.cols; ix++) {
      out.push({ x: t.extent.minX + ix * t.resolution, z: t.extent.minZ + iz * t.resolution });
    }
  }
  return out;
}

const distanceBetween = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);

const walkableSpots = (region: string): XZ[] => {
  const t = terrainOf(region);
  return gridSpots(region).filter((p) => isTraversableAt(t, p.x, p.z));
};

const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;

// ── 데이터를 읽는 자리 (원천 · 흐름) ─────────────────────────────────

/** 그 원천의 성질 — 그 방 resourceEcology 가 소유한다 */
function ecologyOf(id: string): ResourceSourceSpec {
  const one = oneOf(id);
  const found = regionSpec(one.region)?.resourceEcology?.sources.find((s) => s.id === id);
  if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다 (${one.region})`);
  return found;
}

/** 데이터가 밝힌 것을 그대로 읽는 자리들 — 값을 여기 적지 않는다 */
const harvestsOf = (id: string): number => ecologyOf(id).harvests;
const formOf = (id: string): string => ecologyOf(id).form;
const dependsOn = (id: string): string | undefined => ecologyOf(id).dependsOn;

function recoveryOf(id: string): number {
  const seconds = ecologyOf(id).recoverySeconds;
  if (!(typeof seconds === 'number' && seconds > 0)) {
    throw new Error(`원천 '${id}' 에 recoverySeconds 가 없다`);
  }
  return seconds;
}

/** C011 이 놓은 자리 — resource layer point 하나 */
const pointOf = (region: string, id: string): XZ => {
  const found = pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id);
  if (!found) throw new Error(`데이터에 원천 '${id}' 의 자리(resource point)가 없다 (${region})`);
  return found.position;
};

/**
 * **흐름 하나** — spec 은 그 데이터가 무엇을 밝히는지(주기 · 활성 구간 · 양 끝 · Connector)를
 * 말하고 **필드 이름은 말하지 않는다.** 그래서 이름을 골라 적지 않고 값을 찾아 읽는다:
 * 수는 이름이 주기/활성을 뜻하는 것에서, 참조는 그 기록에 실린 글자 전부에서 본다.
 */
type FlowShape = { id: string } & Record<string, unknown>;

function flowOf(id: string): FlowShape {
  const flows = RESOURCE_FLOWS as unknown as readonly FlowShape[];
  const found = flows.find((flow) => flow.id === id);
  if (!found) throw new Error(`데이터가 흐름 '${id}' 를 모른다`);
  return found;
}

/** 그 기록에 실린 수 전부 — 열쇠 이름과 함께 (중첩도 따라 들어간다) */
function numbersIn(value: unknown, key = '', out: { key: string; value: number }[] = []) {
  if (typeof value === 'number') out.push({ key, value });
  else if (Array.isArray(value)) for (const item of value) numbersIn(item, key, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) numbersIn(v, k, out);
  }
  return out;
}

/** 그 기록에 실린 글자 전부 — 양 끝의 방·원천과 Connector 를 이름 없이 집는다 */
function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) stringsIn(item, out);
  else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) stringsIn(v, out);
  }
  return out;
}

function flowNumber(id: string, pattern: RegExp, what: string): number {
  const found = numbersIn(flowOf(id)).find((n) => pattern.test(n.key) && n.value > 0);
  if (!found) throw new Error(`흐름 '${id}' 가 ${what} 를 말하지 않는다`);
  return found.value;
}

/** 흐름의 주기 (세계 초) — 데이터가 소유한다 */
const periodOf = (id: string): number => flowNumber(id, /period|cycle|interval/i, '주기');
/** 활성 구간의 길이 (세계 초) — 데이터가 소유한다 */
const activeSpanOf = (id: string): number => flowNumber(id, /active|window|open|surge/i, '활성 구간');

/** 그 세계 시각에 흐름이 활성인가 (spec R1 — 시각에서 유도된다) */
const flowActiveAt = (time: number): boolean =>
  ((time % periodOf(FLOW_HEART_SILT)) + periodOf(FLOW_HEART_SILT)) % periodOf(FLOW_HEART_SILT) <
  activeSpanOf(FLOW_HEART_SILT);

const flowActive = (w: WorldDriver): boolean => flowActiveAt(timeOf(w));

/** 그 시각 다음의 활성 구간이 **시작하는** 세계 시각 */
function nextActiveStart(time: number): number {
  const period = periodOf(FLOW_HEART_SILT);
  const cycles = Math.floor(time / period);
  return flowActiveAt(time) && time % period === 0 ? time : (cycles + 1) * period;
}

// ── 세계를 세우는 자리 ───────────────────────────────────────────────
const standingIn = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
  });

/** 그 자리의 손 닿는 곳 — InteractionRange 안이다 */
const besideSpot = (at: XZ): XZ => ({ x: at.x + INTERACTION_RANGE / 2, z: at.z });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};

/** 세계를 나눠 굴린다 — 한 걸음 1 세계 초 (C013 하네스 그대로) */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}

/** 그 세계 시각까지 굴린다 — 흐름의 구간 안과 밖을 가려 재기 위한 자리 */
function waitUntil(w: WorldDriver, time: number, step = 1) {
  const left = time - timeOf(w);
  if (left < -1e-9) throw new Error(`이미 지난 시각이다 — ${time} < ${timeOf(w)}`);
  if (left > 0) wait(w, left, step);
}

/**
 * 그 원천이 돌아오기까지 걸린 **세계 초** — 한 걸음 1 초로 세어 돌려준다.
 * (사슬이 두 마디가 되면 "언제 왔는가" 가 곧 "얼마나 멎어 있었는가" 다)
 */
function untilAvailable(w: WorldDriver, id: string, limit = 3600): number {
  for (let elapsed = 1; elapsed <= limit; elapsed++) {
    w.tick(1);
    if (phaseOf(w, id).phase === AVAILABLE) return elapsed;
  }
  throw new Error(`원천 '${id}' 가 ${limit} 초 안에 돌아오지 않았다`);
}

/** 걸린 시간이 그 길이인가 — 마디를 넘길 때마다 한 걸음의 여유를 둔다 (S-024 의 판정 방식) */
function expectSpan(what: string, measured: number, expected: number, slack: number) {
  expect({ what, tooEarly: measured < expected - slack }).toEqual({ what, tooEarly: false });
  expect({ what, tooLate: measured > expected + slack }).toEqual({ what, tooLate: false });
}

const mine = (w: WorldDriver, targetEntityId: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId }, observerId);

const move = (w: WorldDriver, at: XZ, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } }, observerId);

function mineOnce(w: WorldDriver, id: string, observerId = OBSERVER): ActionResult {
  const result = mine(w, id, observerId);
  tickFor(w, MINE_SECONDS + TICK_INTERVAL);
  return result;
}

function mineUntilDepleted(w: WorldDriver, id: string, observerId = OBSERVER) {
  for (let i = 0; i < harvestsOf(id); i++) {
    expect({ id, nth: i + 1, ...mineOnce(w, id, observerId) }).toEqual({
      id,
      nth: i + 1,
      status: 'success',
      rule: 'RULE-MINE-001',
    });
  }
}

// ── 저장·복구로 Given 을 세우는 자리 (c012 · c013 의 선례 그대로) ────
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

/** 걸어서는 그 시각에 세울 수 없는 Given — 그 원천을 **지금** 고갈로 돌려놓는다 */
function deplete(w: WorldDriver, id: string, observers: readonly string[] = [OBSERVER]): WorldDriver {
  const one = oneOf(id);
  return worldFrom(
    w,
    (s) => {
      const states = s.regionStates as unknown as RegionStatesShape;
      const room = (states[one.region] ??= {});
      const sources = (room.sources ??= {});
      sources[id] = { phase: DEPLETED, taken: harvestsOf(id), progress: 0 };
    },
    observers,
  );
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────
const sourcesIn = (v: GameViewSnapshot): SourceView[] =>
  v.entities.filter((e) => e.role === 'resource-source') as SourceView[];
const sourceEntity = (v: GameViewSnapshot, id: string): SourceView | undefined =>
  sourcesIn(v).find((e) => e.id === id);
const mineOn = (v: GameViewSnapshot, targetEntityId: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'mine' && i.targetEntityId === targetEntityId);
const held = (v: GameViewSnapshot, material: string): number | boolean | string | undefined =>
  v.hud.find((h) => h.id === `inventory.${material}`)?.value;

const storedSource = (w: WorldDriver, region: string, id: string): SourceStateShape | undefined =>
  shapeOf(w)[region]?.sources?.[id];

/** 세계가 스스로 답하는 그 원천의 지금 (semantic 의 공개 경로 — C012 · C013 어법) */
const phaseOf = (w: WorldDriver, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w), oneOf(id).region, id) as SourceStateShape;

/** 되돌아옴의 진행 — 저장된 State 가 답한다 (없으면 0) */
const progressOf = (w: WorldDriver, id: string): number =>
  storedSource(w, oneOf(id).region, id)?.progress ?? 0;

/** 그 원천에 지금 걸린 조건들 — 걸린 것이 없으면 빈 목록으로 읽는다 */
const conditionsOn = (w: WorldDriver, id: string, observerId = OBSERVER): readonly string[] =>
  sourceEntity(w.observe(observerId), id)?.conditions ?? [];

function seenAt(w: WorldDriver, id: string): XZ {
  const seen = sourceEntity(w.observe(), id);
  if (!seen) throw new Error(`관찰 결과에 원천 '${id}' 가 없다`);
  return { x: seen.position.x, z: seen.position.z };
}

/** 그 원천의 지금 자리 곁에 선 세계 */
function beside(id: string, extra: WorldSetup = {}): WorldDriver {
  const one = oneOf(id);
  const base = standingIn(one.region, undefined, extra);
  return moveBody(base, one.region, besideSpot(seenAt(base, id)));
}

/** 그 방의 **바닥** 흔적 — 격자 전체에서 가장 옅은 값이다 (C011 ~ C013 하네스 그대로) */
const floorTrace = (states: never, id: string): number =>
  gridSpots(id).reduce((low, at) => Math.min(low, traceStrengthAt(states, id, at)), Infinity);

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 세 번째 재료가 부산물로 난다', () => {
  it('S-011 둥지에서 사체 위 균사를 캐면 거목균이 손에 들어온다', () => {
    // Given 곡괭이를 지닌 몸이 둥지의 균사 곁에 선다
    const world = beside(NEST_FUNGUS, { actorItems: { pickaxe: 1 } });
    expect(held(world.observe(), GIANT_TREE_FUNGUS)).toBeUndefined();
    // When 캔다
    expect(mineOnce(world, NEST_FUNGUS)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    // Then 세 번째 재료가 하나 늘었다 — 다른 재료는 늘지 않았다
    const view = world.observe();
    expect(held(view, GIANT_TREE_FUNGUS)).toBe(1);
    expect(held(view, BIO_ORE)).toBeUndefined();
    expect(held(view, ORE_EATER_MOLT)).toBeUndefined();
  });

  it('S-012 한 번에 다 뜯긴다 — 한 번 캐면 고갈이고 그다음은 거절된다 (D4)', () => {
    // Given 데이터가 그 원천을 한 번짜리로 밝힌다
    expect({ id: NEST_FUNGUS, harvests: harvestsOf(NEST_FUNGUS) }).toEqual({
      id: NEST_FUNGUS,
      harvests: 1,
    });
    const world = beside(NEST_FUNGUS, { actorItems: { pickaxe: 1 } });
    // When 한 번 캔다
    mineOnce(world, NEST_FUNGUS);
    // Then 고갈이다
    expect(phaseOf(world, NEST_FUNGUS)).toMatchObject({ phase: DEPLETED, taken: 1 });
    expect(mine(world, NEST_FUNGUS)).toMatchObject({ reason: SOURCE_DEPLETED });
  });

  it('S-013 그 기회의 자리가 **부산물**이다 (A.3 · 데이터)', () => {
    expect({ id: NEST_FUNGUS, opportunity: ecologyOf(NEST_FUNGUS).opportunity }).toEqual({
      id: NEST_FUNGUS,
      opportunity: 'by-product',
    });
    // 그리고 그것을 지고 있는 것은 균류다 (A.2 Carrier)
    expect(ecologyOf(NEST_FUNGUS).carrier).toBe('fungus');
  });

  it('S-014 (경계) 둥지에는 이 원천 말고 아무 원천도 없다 — 다른 방의 것은 실리지 않는다', () => {
    // Given 둥지에 선다
    const world = standingIn(PREDATOR_NEST);
    // Then 그 방의 원천은 균사 하나뿐이고
    expect(regionSpec(PREDATOR_NEST)?.resourceEcology?.sources.map((s) => s.id)).toEqual([
      NEST_FUNGUS,
    ]);
    expect(sourcesIn(world.observe()).map((e) => e.id)).toEqual([NEST_FUNGUS]);
    // 다른 방의 원천은 관찰에 실리지 않는다
    for (const other of SEVEN.filter((s) => s.id !== NEST_FUNGUS)) {
      expect({ id: other.id, seen: sourceEntity(world.observe(), other.id) }).toEqual({
        id: other.id,
        seen: undefined,
      });
    }
  });
});

describe('SPEC-002 사슬이 셋이 된다', () => {
  it('S-021 데이터의 사슬이 두 마디다 — 뿌리혹은 균사에, 노두는 뿌리혹에 매달린다', () => {
    expect({
      nodule: dependsOn(ROOT_NODULE),
      outcrop: dependsOn(ORE_OUTCROP),
      fungus: dependsOn(NEST_FUNGUS),
    }).toEqual({ nodule: NEST_FUNGUS, outcrop: ROOT_NODULE, fungus: undefined });
  });

  it('S-022 균사를 캐 고갈시키면 뿌리혹의 진행이 멎고 recovery-stalled 가 실린다', () => {
    // Given 뿌리혹과 노두가 이미 고갈된 세계에서 둥지의 균사를 캔다
    const world = beside(NEST_FUNGUS, {
      actorItems: { pickaxe: 1 },
      sourcePhases: { [ROOT_NODULE]: DEPLETED, [ORE_OUTCROP]: DEPLETED },
    });
    mineUntilDepleted(world, NEST_FUNGUS);
    // When 뿌리혹의 제 길이를 넘겨 진행시킨다 (균사가 돌아오기 전까지)
    const until = Math.min(recoveryOf(NEST_FUNGUS), recoveryOf(ROOT_NODULE) * 1.5) - 1;
    const tree = moveBody(world, RED_EYE_TREE, walkableSpots(RED_EYE_TREE)[0]!);
    wait(tree, until);
    // Then 진행이 오르지 않아 아직 바닥난 채다
    expect(phaseOf(tree, ROOT_NODULE).phase).toBe(DEPLETED);
    // And 지목하지 않아도 그 사실이 관찰 결과에 실린다
    expect(conditionsOn(tree, ROOT_NODULE)).toContain(RECOVERY_STALLED);
  });

  it('S-023 노두에도 같은 것이 걸린다 — 두 방 건너 멎는다', () => {
    // Given 셋이 함께 고갈된 세계 (균사 · 뿌리혹 · 노두)
    const world = standingIn(BIO_ORE_FIELD, undefined, {
      sourcePhases: {
        [NEST_FUNGUS]: DEPLETED,
        [ROOT_NODULE]: DEPLETED,
        [ORE_OUTCROP]: DEPLETED,
      },
    });
    // When 노두의 제 길이를 넘겨 진행시킨다
    const until = Math.min(recoveryOf(NEST_FUNGUS), recoveryOf(ORE_OUTCROP) * 1.5) - 1;
    wait(world, until);
    // Then 노두도 멎어 있다 — 사슬의 끝을 끊으면 두 마디 위가 멎는다
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(DEPLETED);
    expect(conditionsOn(world, ORE_OUTCROP)).toContain(RECOVERY_STALLED);
  });

  it('S-024 (경계 ①) 균사가 돌아오면 뿌리혹이, 뿌리혹이 돌아오면 노두가 다시 온다 — 차례로', () => {
    // Given 셋이 함께 고갈된 세계
    const world = standingIn(BIO_ORE_FIELD, undefined, {
      sourcePhases: {
        [NEST_FUNGUS]: DEPLETED,
        [ROOT_NODULE]: DEPLETED,
        [ORE_OUTCROP]: DEPLETED,
      },
    });
    // When 셋이 저마다 돌아오기까지 걸린 세계 초를 잰다
    const fungusAt = untilAvailable(world, NEST_FUNGUS);
    // 균사가 돌아온 그때까지 뒤의 둘은 한 걸음도 나아가지 않았다
    expect(phaseOf(world, ROOT_NODULE).phase).toBe(DEPLETED);
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(DEPLETED);
    const noduleAt = fungusAt + untilAvailable(world, ROOT_NODULE);
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(DEPLETED);
    const outcropAt = noduleAt + untilAvailable(world, ORE_OUTCROP);

    // Then 저마다 **앞의 것이 돌아온 뒤부터** 제 길이를 세었다 — 멎어 있던 만큼 늦게 온다
    //
    // **판정 방식** — 한 걸음(1 세계 초)의 여유를 둔다. spec 은 한 Tick 안에서 사슬의 앞뒤가
    // 어느 차례로 굴러가는지 말하지 않으므로, 마디를 넘길 때마다 한 걸음이 어긋날 수 있다
    // (그것을 못 박는 것은 이 층이 아니라 구현의 몫이다 · 하네스 결손에 함께 적었다).
    expectSpan('균사', fungusAt, recoveryOf(NEST_FUNGUS), 0);
    expectSpan('뿌리혹', noduleAt, recoveryOf(NEST_FUNGUS) + recoveryOf(ROOT_NODULE), 1);
    expectSpan(
      '노두',
      outcropAt,
      recoveryOf(NEST_FUNGUS) + recoveryOf(ROOT_NODULE) + recoveryOf(ORE_OUTCROP),
      2,
    );
    expect(phaseOf(world, ORE_OUTCROP)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });

  it('S-025 (경계 ②) 셋 다 available 인 동안에는 어느 것에도 그 코드가 걸리지 않는다', () => {
    for (const one of [
      { id: NEST_FUNGUS, region: PREDATOR_NEST },
      { id: ROOT_NODULE, region: RED_EYE_TREE },
      { id: ORE_OUTCROP, region: BIO_ORE_FIELD },
    ]) {
      const world = standingIn(one.region);
      expect({ id: one.id, phase: phaseOf(world, one.id).phase }).toEqual({
        id: one.id,
        phase: AVAILABLE,
      });
      // 걸린 것이 없으면 자리 자체가 없다 — 빈 배열로 지어내지 않는다 (C012 · C013 그대로)
      expect({ id: one.id, conditions: sourceEntity(world.observe(), one.id)?.conditions }).toEqual({
        id: one.id,
        conditions: undefined,
      });
    }
  });
});

describe('SPEC-003 흐름의 출발과 도착이 선다', () => {
  it('S-031 호수 바닥과 어귀가 둘 다 원천이고 **같은 Material Seed** 를 낸다', () => {
    for (const one of [LAKE_SILT_BED, RIVER_SILT]) {
      expect({ id: one, material: ecologyOf(one).materialId }).toEqual({ id: one, material: BIO_ORE });
      // 그리고 그 자리가 데이터에 있다 (C011 이 세운 resource point)
      expect(pointOf(oneOf(one).region, one)).toBeDefined();
    }
  });

  it('S-032 같은 재료인데 자연 형태가 서로 다르다 — 물에 갈려 다른 형태로 도착한다', () => {
    const forms = [formOf(LAKE_SILT_BED), formOf(RIVER_SILT), formOf(ORE_OUTCROP)];
    expect(new Set(forms).size).toBe(forms.length);
  });

  it('S-033 (경계) 어귀의 원천은 세계가 설 때 **아직 없다** — 고갈로 선다', () => {
    // Given 갓 선 세계
    const world = driveWorld(solo);
    // Then 어귀만 고갈로 서 있고
    expect(phaseOf(world, RIVER_SILT)).toMatchObject({
      phase: DEPLETED,
      taken: harvestsOf(RIVER_SILT),
    });
    // 나머지 여섯은 available · taken 0 이다 (C012 그대로)
    for (const one of SEVEN.filter((s) => s.id !== RIVER_SILT)) {
      expect({ id: one.id, ...phaseOf(world, one.id) }).toMatchObject({
        id: one.id,
        phase: AVAILABLE,
        taken: 0,
      });
    }
  });
});

describe('SPEC-004 물길이 불어난 때만 실려 온다', () => {
  it('S-041 흐름이 데이터에 있다 — 주기와 활성 구간, 그리고 양 끝과 Connector', () => {
    const refs = stringsIn(flowOf(FLOW_HEART_SILT));
    for (const name of [HEART_LAKE, LAKE_SILT_BED, FOREST_DEEP, RIVER_SILT, HEART_RIVER]) {
      expect({ name, said: refs.includes(name) }).toEqual({ name, said: true });
    }
    // 활성 구간은 주기보다 짧다 — 늘 불어 있지 않다
    expect(activeSpanOf(FLOW_HEART_SILT)).toBeLessThan(periodOf(FLOW_HEART_SILT));
    // 그리고 **한 구간이 되돌아옴의 길이를 채운다** (기본형 ③)
    expect(recoveryOf(RIVER_SILT)).toBeLessThanOrEqual(activeSpanOf(FLOW_HEART_SILT));
    // 그 원천이 사는 공급 유형이 넷째다 (World Change 4)
    expect(ecologyOf(RIVER_SILT).supply).toBe('event-scarce');
  });

  it('S-042 활성 구간 하나를 채우면 어귀에 퇴적이 선다', () => {
    // Given 어귀가 비어 있고 (세계가 설 때 그렇다) 흐름이 활성인 세계
    const world = standingIn(FOREST_DEEP);
    const start = nextActiveStart(timeOf(world));
    waitUntil(world, start);
    expect({ active: flowActive(world) }).toEqual({ active: true });
    expect(phaseOf(world, RIVER_SILT).phase).not.toBe(AVAILABLE);
    // When 그 구간 안에서 되돌아옴의 길이만큼 굴린다
    waitUntil(world, start + recoveryOf(RIVER_SILT) - 1);
    expect(phaseOf(world, RIVER_SILT).phase).not.toBe(AVAILABLE);
    wait(world, 1);
    // Then 실려 왔다 — 그 자리로 가면 캘 수 있다
    expect(phaseOf(world, RIVER_SILT)).toMatchObject({ phase: AVAILABLE, taken: 0 });
    const beside = moveBody(world, FOREST_DEEP, besideSpot(seenAt(world, RIVER_SILT)));
    expect(mineOn(beside.observe(), RIVER_SILT)?.available).toBe(true);
  });

  it('S-043 활성이 아닌 동안에는 아무리 기다려도 진행이 없다', () => {
    // Given 활성 구간이 지난 뒤 어귀가 비어 있는 세계 (걸어서는 그 시각에 세울 수 없다)
    const base = standingIn(FOREST_DEEP);
    waitUntil(base, activeSpanOf(FLOW_HEART_SILT) + 1);
    expect(flowActive(base)).toBe(false);
    const world = deplete(base, RIVER_SILT);
    const before = progressOf(world, RIVER_SILT);
    // When 다음 활성 구간이 오기 전까지 오래 기다린다
    waitUntil(world, nextActiveStart(timeOf(world)) - 1);
    // Then 한 걸음도 나아가지 않았다
    expect({ phase: phaseOf(world, RIVER_SILT).phase, progress: progressOf(world, RIVER_SILT) }).toEqual({
      phase: DEPLETED,
      progress: before,
    });
  });

  it('S-044 (경계 ①) 활성이 아니면 condition-unmet · 활성이면 flow-arrived 가 실린다', () => {
    // Given 어귀가 비어 있고 흐름이 활성인 세계
    const world = standingIn(FOREST_DEEP);
    waitUntil(world, nextActiveStart(timeOf(world)));
    expect(flowActive(world)).toBe(true);
    // Then 지금 실려 오는 중이라고 실린다
    expect(conditionsOn(world, RIVER_SILT)).toContain(FLOW_ARRIVED);
    expect(conditionsOn(world, RIVER_SILT)).not.toContain(CONDITION_UNMET);
    // When 그 구간이 지나고 다시 비운다
    waitUntil(world, timeOf(world) + activeSpanOf(FLOW_HEART_SILT) + 1);
    const quiet = deplete(world, RIVER_SILT);
    expect(flowActive(quiet)).toBe(false);
    // Then 아직 그때가 아니라고 실린다
    expect(conditionsOn(quiet, RIVER_SILT)).toContain(CONDITION_UNMET);
    expect(conditionsOn(quiet, RIVER_SILT)).not.toContain(FLOW_ARRIVED);
  });

  it('S-045 (경계 ②) 캐서 다시 없앤 뒤에도 다음 활성 구간에 다시 온다 — 주기는 되풀이된다', () => {
    // Given 첫 구간에 실려 온 어귀의 퇴적 곁에 곡괭이를 지니고 선다
    const arrived = standingIn(FOREST_DEEP, undefined, { actorItems: { pickaxe: 1 } });
    waitUntil(arrived, nextActiveStart(timeOf(arrived)) + recoveryOf(RIVER_SILT));
    expect(phaseOf(arrived, RIVER_SILT).phase).toBe(AVAILABLE);
    const world = moveBody(arrived, FOREST_DEEP, besideSpot(seenAt(arrived, RIVER_SILT)));
    // When 다 캔다
    mineUntilDepleted(world, RIVER_SILT);
    expect(phaseOf(world, RIVER_SILT).phase).toBe(DEPLETED);
    // And 그 주기가 다 갈 때까지 기다려도 오지 않는다
    const next = nextActiveStart(timeOf(world));
    waitUntil(world, next - 1);
    expect(phaseOf(world, RIVER_SILT).phase).not.toBe(AVAILABLE);
    // Then 다음 활성 구간이 한 번 지나면 다시 서 있다
    waitUntil(world, next + recoveryOf(RIVER_SILT));
    expect(phaseOf(world, RIVER_SILT)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });

  it('S-046 (경계 ③) 흐름 밖의 원천 다섯은 주기와 무관하게 제 길이대로 돌아온다', () => {
    for (const one of OUTSIDE_FLOW) {
      // Given 그 원천만 고갈된 세계 (매달린 것은 available 이므로 멎지 않는다)
      const world = standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } });
      const full = recoveryOf(one.id);
      wait(world, full - 1);
      expect({ id: one.id, phase: phaseOf(world, one.id).phase }).not.toEqual({
        id: one.id,
        phase: AVAILABLE,
      });
      wait(world, 1);
      // Then 흐름이 지금 활성이든 아니든 제 길이에 돌아온다
      expect({ id: one.id, phase: phaseOf(world, one.id).phase }).toEqual({
        id: one.id,
        phase: AVAILABLE,
      });
      // And 그 원천에는 흐름의 코드가 실리지 않는다
      const conditions = conditionsOn(world, one.id);
      expect({ id: one.id, flow: conditions.includes(FLOW_ARRIVED) }).toEqual({
        id: one.id,
        flow: false,
      });
      expect({ id: one.id, unmet: conditions.includes(CONDITION_UNMET) }).toEqual({
        id: one.id,
        unmet: false,
      });
    }
  });

  it('S-047 (R1 경계 ②) 관찰자와 무관하게 돌고, 관찰자 둘이 같은 것을 본다', () => {
    // Given 어귀가 빈 세계에서 관찰자가 이어짐을 잃는다
    const alone = standingIn(FOREST_DEEP);
    alone.leave(OBSERVER);
    alone.tick(0);
    waitUntil(alone, nextActiveStart(timeOf(alone)) + recoveryOf(RIVER_SILT));
    // Then 보는 이가 없어도 실려 왔다
    expect(phaseOf(alone, RIVER_SILT)).toMatchObject({ phase: AVAILABLE, taken: 0 });

    // And 관찰자 둘이 같은 어귀를 본다
    const base = standingIn(FOREST_DEEP);
    base.join(OBSERVER_2);
    base.tick(0);
    const two = worldFrom(
      base,
      (s) => {
        const at = walkableSpots(FOREST_DEEP)[0]!;
        place(s, PLAYER, FOREST_DEEP, at);
        place(s, PLAYER_2, FOREST_DEEP, at);
      },
      [OBSERVER, OBSERVER_2],
    );
    waitUntil(two, nextActiveStart(timeOf(two)) + recoveryOf(RIVER_SILT));
    const a = sourceEntity(two.observe(OBSERVER), RIVER_SILT)!;
    const b = sourceEntity(two.observe(OBSERVER_2), RIVER_SILT)!;
    expect({ state: b.state, position: b.position, conditions: b.conditions }).toEqual({
      state: a.state,
      position: a.position,
      conditions: a.conditions,
    });
    expect(b.state).toBe(AVAILABLE);
  });
});

describe('SPEC-005 흐름은 출발에 매달린다', () => {
  it('S-051 호수 바닥을 캐 놓으면 흐름이 활성이어도 어귀의 진행이 오르지 않는다', () => {
    // Given 호수 바닥이 고갈된 채 세계가 서고, 어귀는 비어 있다
    const world = standingIn(FOREST_DEEP, undefined, {
      sourcePhases: { [LAKE_SILT_BED]: DEPLETED },
    });
    const start = nextActiveStart(timeOf(world));
    waitUntil(world, start);
    const before = progressOf(world, RIVER_SILT);
    // When 활성 구간을 통째로 지난다
    waitUntil(world, start + activeSpanOf(FLOW_HEART_SILT));
    // Then 아무것도 오지 않았고 진행도 오르지 않았다
    expect({
      phase: phaseOf(world, RIVER_SILT).phase,
      progress: progressOf(world, RIVER_SILT),
    }).toEqual({ phase: DEPLETED, progress: before });
  });

  it('S-052 그 원천에 recovery-stalled 가 실린다 — 흐름이 활성인 동안에도', () => {
    const world = standingIn(FOREST_DEEP, undefined, {
      sourcePhases: { [LAKE_SILT_BED]: DEPLETED },
    });
    waitUntil(world, nextActiveStart(timeOf(world)));
    expect(flowActive(world)).toBe(true);
    expect(conditionsOn(world, RIVER_SILT)).toContain(RECOVERY_STALLED);
  });

  it('S-053 (경계) 침전이 스스로 되돌아온 뒤부터 다시 실려 온다', () => {
    // Given 호수 바닥이 고갈된 채 선 세계
    const world = standingIn(FOREST_DEEP, undefined, {
      sourcePhases: { [LAKE_SILT_BED]: DEPLETED },
    });
    // When 침전이 제 길이대로 돌아올 때까지 기다린다 (그 사이 지나간 활성 구간은 헛돌았다)
    wait(world, recoveryOf(LAKE_SILT_BED));
    expect(phaseOf(world, LAKE_SILT_BED).phase).toBe(AVAILABLE);
    expect(phaseOf(world, RIVER_SILT).phase).toBe(DEPLETED);
    // Then 그다음 활성 구간 하나로 어귀에 다시 선다
    const next = nextActiveStart(timeOf(world));
    waitUntil(world, next + recoveryOf(RIVER_SILT));
    expect(phaseOf(world, RIVER_SILT)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });
});

describe('SPEC-006 백왕령은 이 계통 밖이고, 그 이유가 적혀 있다', () => {
  /** 그 방의 계통 — 원천 없는 resourceEcology 하나와 그 이유 (§6.4) */
  const isolation = (): { sources: readonly unknown[]; isolationReason?: string } | undefined =>
    regionSpec(WHITE_KING_DOMAIN)?.resourceEcology as
      | { sources: readonly unknown[]; isolationReason?: string }
      | undefined;

  it('S-061 원천도 흙 변색도 하나 없다', () => {
    const world = driveWorld(solo);
    expect(isolation()?.sources ?? []).toEqual([]);
    expect(pointsOf(spaceOf(WHITE_KING_DOMAIN), RESOURCE_LAYER)).toEqual([]);
    expect(areasOf(spaceOf(WHITE_KING_DOMAIN), TRACE_LAYER)).toEqual([]);
    expect(sourcesIn(world.observe())).toEqual([]);
    const stained = gridSpots(WHITE_KING_DOMAIN).filter(
      (at) => traceStrengthAt(statesOf(world), WHITE_KING_DOMAIN, at) !== 0,
    );
    expect(stained).toEqual([]);
  });

  it('S-062 그 방의 데이터가 **왜 유입이 없는지**를 밝힌다', () => {
    const reason = isolation()?.isolationReason;
    expect(typeof reason).toBe('string');
    expect(String(reason).length).toBeGreaterThan(0);
  });

  it('S-063 (경계) 흐름의 어느 끝도 백왕령이 아니다', () => {
    expect(stringsIn(flowOf(FLOW_HEART_SILT))).not.toContain(WHITE_KING_DOMAIN);
  });
});

// SPEC-007 · SPEC-008 은 세계가 아니라 **도구의 보고**를 잰다 —
// tools/world-editor/tests/c014-condition-and-flow.spec.ts 가 소유한다.

describe('SPEC-009 흔적이 세 방향을 가리킨다', () => {
  const traceAt = (w: WorldDriver, region: string, at: XZ) =>
    traceStrengthAt(statesOf(w), region, at);

  /** 숲 깊은 곳의 **안쪽** 출구 셋 — 둥지 · 광석 지대 · 거목 쪽 */
  const INNER = [NEST_TRAIL, ORE_TRAIL, TREE_APPROACH];

  it('S-091 안쪽 출구 셋 둘레가 다 그 방 바닥보다 짙다', () => {
    const world = driveWorld(solo);
    const floor = floorTrace(statesOf(world), FOREST_DEEP);
    for (const tag of INNER) {
      const here = traceAt(world, FOREST_DEEP, anchorAt(FOREST_DEEP, tag));
      expect({ tag, deeper: here > floor }).toEqual({ tag, deeper: true });
    }
  });

  it('S-092 (경계) 방 바닥과 바깥쪽 출구 둘레는 달라지지 않는다', () => {
    const world = driveWorld(solo);
    const floor = floorTrace(statesOf(world), FOREST_DEEP);
    // 바깥쪽 출구 — 숲 가장자리로 돌아가는 길
    expect({ tag: DEEP_TRAIL, at: traceAt(world, FOREST_DEEP, anchorAt(FOREST_DEEP, DEEP_TRAIL)) }).toEqual(
      { tag: DEEP_TRAIL, at: floor },
    );
    // 그 방 바닥은 C011 이 놓은 그대로다 (중간부 = 2)
    expect(floor).toBe(2);
  });
});

describe('SPEC-010 건드리지 않은 것은 그대로다', () => {
  /** 이 Cycle 이 더한 셋을 캐고 흐름이 한 주기를 도는 세계 — 그 뒤에 앞의 것을 본다 */
  function lived(): WorldDriver {
    let world = beside(NEST_FUNGUS, { actorItems: { pickaxe: 4 } });
    mineUntilDepleted(world, NEST_FUNGUS);
    world = moveBody(world, HEART_LAKE, besideSpot(pointOf(HEART_LAKE, LAKE_SILT_BED)));
    mineUntilDepleted(world, LAKE_SILT_BED);
    world = moveBody(world, FOREST_DEEP, walkableSpots(FOREST_DEEP)[0]!);
    wait(world, periodOf(FLOW_HEART_SILT));
    return world;
  }

  it('S-0101 원천 넷의 자리 · 캘 수 있는 횟수 · 되돌아오는 길이가 한 값도 달라지지 않는다', () => {
    const before = FOUR.map((one) => ({
      id: one.id,
      at: pointOf(one.region, one.id),
      harvests: harvestsOf(one.id),
      recovery: recoveryOf(one.id),
      material: ecologyOf(one.id).materialId,
      form: formOf(one.id),
    }));
    const world = lived();
    for (const one of FOUR) {
      const seen = sourceEntity(standingIn(one.region).observe(), one.id)!;
      const was = before.find((b) => b.id === one.id)!;
      expect({
        id: one.id,
        at: { x: seen.position.x, z: seen.position.z },
        harvests: harvestsOf(one.id),
        recovery: recoveryOf(one.id),
        material: seen.material,
        kind: seen.kind,
      }).toEqual({
        id: one.id,
        at: { x: was.at.x, z: was.at.z },
        harvests: was.harvests,
        recovery: was.recovery,
        material: was.material,
        kind: was.form,
      });
      // 그리고 캐지 않은 넷은 여전히 그대로 서 있다
      expect({ id: one.id, ...phaseOf(world, one.id) }).toMatchObject({
        id: one.id,
        phase: AVAILABLE,
        taken: 0,
      });
    }
  });

  it('S-0102 (경계) 땅은 어느 방에서도 한 값도 바뀌지 않는다 — 높이 · 표면 · traversable · hash', () => {
    const before = REGION_SPECS.map((spec) => ({
      id: spec.id,
      world: JSON.stringify(compileRegion(spec.space, COMPILE_RULES).world),
      hash: descriptionHash(spec.space),
      walkable: walkableSpots(spec.id).length,
    }));
    const world = lived();
    for (const was of before) {
      expect({
        id: was.id,
        world: JSON.stringify(compileRegion(spaceOf(was.id), COMPILE_RULES).world),
        hash: descriptionHash(spaceOf(was.id)),
        walkable: walkableSpots(was.id).length,
      }).toEqual(was);
    }
    // 그리고 관찰 결과가 말하는 그 방의 hash 도 그대로다
    const here = world.observe();
    expect(here.region.hash).toBe(descriptionHash(spaceOf(here.region.id)));
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — 이 Cycle 이 얹은 것 때문에 앞의 것이 무너지지 않았는가
// ─────────────────────────────────────────────────────────────────────

// 미로의 데이터를 읽는 자리 (C008 이 세운 것 — c008 ~ c013 하네스 그대로)
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
/** 통로가 아닌 방 안의 자리들 — 통로는 패턴이 열고 닫으므로 걷기의 목표로 삼지 않는다 */
const cellSpots = (cell: string): Spot[] =>
  mazeSpots().filter((s) => s.traversable && s.passages.length === 0 && s.cells.includes(cell));

function mazeState(w: WorldDriver) {
  const held = shapeOf(w)[FANTASY_MAZE];
  if (!held?.rule) throw new Error('미로에 규칙 State 가 없다');
  return held.rule;
}

const inMaze = (at: XZ = entryAt()) =>
  driveWorld({ ...solo, actorRegion: FANTASY_MAZE, actorPosition: { x: at.x, z: at.z } });

function primedMaze(at: XZ, pressure: number): WorldDriver {
  return worldFrom(inMaze(at), (s) => {
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
  it('R-001 (C011) 캐지 않은 세계의 흔적 사다리가 그대로다', () => {
    const w = driveWorld(solo);
    const s = statesOf(w);
    expect({
      edge: floorTrace(s, FOREST_EDGE),
      ruin: floorTrace(s, EXPLORER_RUIN),
      deep: floorTrace(s, FOREST_DEEP),
      ore: floorTrace(s, BIO_ORE_FIELD),
      tree: floorTrace(s, RED_EYE_TREE),
    }).toEqual({ edge: 1, ruin: 1, deep: 2, ore: 3, tree: 3 });
    // 원천 일곱은 저마다 자기 방 바닥보다 짙은 자리 위에 서 있다 (새 셋도 그 사다리를 잇는다).
    // 서 있는 동안의 둘레를 재야 하므로 그 원천을 available 로 세운 세계에서 본다 —
    // 어귀의 퇴적은 세계가 설 때 고갈로 서고, 고갈된 둘레는 한 단계 옅다 (C012 의 자국).
    for (const one of SEVEN) {
      const standing = statesOf(
        standingIn(one.region, undefined, { sourcePhases: { [one.id]: AVAILABLE } }),
      );
      const at = traceStrengthAt(standing, one.region, pointOf(one.region, one.id));
      expect({ id: one.id, deeper: at > floorTrace(standing, one.region) }).toEqual({
        id: one.id,
        deeper: true,
      });
    }
  });

  it('R-002 (C012) 캐는 일과 그 거절 사유가 그대로다', () => {
    const world = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    expect(mine(world, ORE_OUTCROP)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    tickFor(world, MINE_SECONDS + TICK_INTERVAL);
    expect(held(world.observe(), BIO_ORE)).toBe(1);
    const empty = beside(ORE_OUTCROP, { actorItems: {} });
    expect(mine(empty, ORE_OUTCROP)).toMatchObject({ reason: 'no-mining-tool' });
    expect(mine(empty, 'c014-test:no-such-source')).toMatchObject({ reason: 'unknown-source' });
  });

  it('R-003 (C013) 되돌아옴이 그대로 돈다 — 마디 이동과 무너진 자리', () => {
    // Given 노두를 다 캐고 제 길이만큼 기다린다
    const world = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    const sites = curvesOf(spaceOf(BIO_ORE_FIELD), PRESENCE_LAYER, ecologyOf(ORE_OUTCROP).siteCurve!)[0]!
      .points;
    expect(seenAt(world, ORE_OUTCROP)).toEqual({ x: sites[0]!.x, z: sites[0]!.z });
    mineUntilDepleted(world, ORE_OUTCROP);
    wait(world, recoveryOf(ORE_OUTCROP));
    // Then 다음 마디에 서고 옛 자리는 무너진 채 남는다
    const seen = sourceEntity(world.observe(), ORE_OUTCROP)!;
    expect({ phase: phaseOf(world, ORE_OUTCROP).phase, siteIndex: seen.siteIndex }).toEqual({
      phase: AVAILABLE,
      siteIndex: 1,
    });
    expect({ x: seen.position.x, z: seen.position.z }).toEqual({ x: sites[1]!.x, z: sites[1]!.z });
    expect(seen.collapsedSites).toEqual([0]);
  });

  it('R-004 (C008) 미로의 압력 → 재배열이 그대로 돈다', () => {
    const w = inMaze();
    expect(mazeState(w)).toMatchObject({ pattern: patternNames()[0], pressure: 0 });
    const from = entryAt();
    const cell = tagsAt(mazeTerrain(), from.x, from.z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(cell), (s) => distanceBetween(s, from));
    const first = patternNames()[0]!;
    const primed = primedMaze(from, mazeRule().pressureLimit - 3);
    walkUntil(primed, [far, from], () => mazeState(primed).pattern !== first);
    const after = mazeState(primed);
    expect(after.pattern).toBe(nextOf(first));
    expect(after.pressure).toBe(0);
    expect(after.rearrangedAt).toBeDefined();
    // 그리고 미로에는 원천이 서지 않는다 — 흐름도 닿지 않는다
    expect(shapeOf(primed)[FANTASY_MAZE]?.sources).toBeUndefined();
  });

  it('R-005 (C001~C007) 백왕령이 그대로다 — 몸이 서고 걸을 수 있다', () => {
    const w = driveWorld(solo);
    expect(actorOf(w).regionId).toBe(START_REGION_ID);
    const view = w.observe();
    expect(view.region.id).toBe(START_REGION_ID);
    expect(sourcesIn(view)).toEqual([]);
    expect(view.interactions.some((i) => i.id === 'mine')).toBe(false);
    const from = { x: actorOf(w).position.x, z: actorOf(w).position.z };
    const to = maxBy(
      walkableSpots(START_REGION_ID).filter((p) => distanceBetween(p, from) < 8),
      (p) => distanceBetween(p, from),
    );
    expect(move(w, to).status).toBe('success');
  });

  it('R-006 이 Cycle 이 더한 셋도 C012 · C013 의 형을 그대로 산다', () => {
    for (const one of ADDED) {
      // 캘 수 있는 횟수 · 되돌아오는 길이 · 되돌아옴의 원인이 데이터에 있다
      const spec = ecologyOf(one.id) as ResourceSourceSpec & { recoveryCause?: string };
      expect({ id: one.id, harvests: spec.harvests > 0 }).toEqual({ id: one.id, harvests: true });
      expect({ id: one.id, recovery: spec.recoverySeconds > 0 }).toEqual({ id: one.id, recovery: true });
      expect({ id: one.id, cause: typeof spec.recoveryCause }).toEqual({ id: one.id, cause: 'string' });
      // 그리고 관찰 결과의 state 가 세 값으로 갈린다 (C013 그대로)
      const seen = (phase?: string) =>
        sourceEntity(
          standingIn(one.region, undefined, phase ? { sourcePhases: { [one.id]: phase } } : {}).observe(),
          one.id,
        )?.state;
      expect({
        id: one.id,
        spent: seen(DEPLETED),
        back: seen(RECOVERING),
      }).toEqual({ id: one.id, spent: DEPLETED, back: RECOVERING });
    }
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 관찰자가 **어귀에 가서 기다리다 물길이 불어나는 것을 겪는가** — 흐름의 주기도 남은 시간도 관찰 계약에 실리지 않고(spec Observable), 기다림이 사람에게 어떻게 읽히는지는 이 층에서 잴 것이 없다 (촬영이 답할 자리)',
  );
  it.todo(
    'GAP: 실려 오는 것이 **호수에서 강을 타고 온 그것**으로 읽히는가 — 세계는 흐름의 출발도 Connector 도 투영하지 않으므로, 두 방의 원천이 한 흐름으로 이어졌다는 것은 데이터에서만 읽힌다',
  );
  it.todo(
    'GAP: 관찰자 둘이 **같은 Tick 에** 실려 온 마지막 한 번을 다투는 경합 — driveWorld 의 dispatch 는 한 요청씩 tick(0) 으로 판정하므로 같은 Tick 안의 두 요청을 세울 수 없다 (C012 · C013 이 남긴 결손 그대로)',
  );
  it.todo(
    'GAP: 활성 구간의 **경계 한 Tick**(구간이 끝나는 그 순간의 진행) — 세계가 Tick 앞의 시각을 보는지 뒤의 시각을 보는지는 spec 이 말하지 않아, 한 Tick 어긋남을 기대값으로 세울 수 없다',
  );
});
