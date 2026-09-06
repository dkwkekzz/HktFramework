// C013 — 세계가 되돌린다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// C012 는 자국을 남겼고 거기서 멈췄다. 이 Cycle 에서 **세계가 그것을 되돌린다.** 그래서 재는 것은
// 시간과 인과다:
//   ① 고갈된 것이 제 길이(recoverySeconds)만큼 지나야 돌아오는가 — 미리도 늦게도 아니게
//   ② 절반을 넘기면 눈에 보이는가 (recovering) 그리고 그동안에는 캘 수 없는가
//   ③ 매달린 것이 available 이 아니면 진행이 **실제로 멎는가** (표시가 아니라 원인이다)
//   ④ 자리를 옮기는 원천이 다음 마디에 서고 옛 자리는 무너진 채 쌓이는가
//   ⑤ 그 모든 것이 관찰자 없이 돌고 사람을 건너가고 세계를 껐다 켜도 이어지는가
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(회복 세계 과정 · 자리 이동 · 새 그림 · 새 문구)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C013-the-world-brings-it-back/spec.md 뿐이다.
//
// **좌표도 횟수도 시간도 손으로 적지 않는다** — 마디의 자리는 그 방 Description 의 presence
// 곡선에서, 캘 수 있는 횟수는 harvests 에서, 되돌아오는 데 걸리는 시간은 recoverySeconds 에서,
// 둘레 흔적·붕괴 자리는 traceOps · collapseOps 가 가리키는 op 에서 읽는다.
// 값이 데이터에서 바뀌면 이 시나리오도 함께 옮겨 간다.
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
  BIO_ORE,
  BIO_ORE_FIELD,
  BLOCK_COLLAPSED,
  COMPILE_RULES,
  EXPLORER_RUIN,
  FOREST_DEEP,
  FOREST_EDGE,
  FORM_MOLT_LITTER,
  FORM_OUTCROP,
  FORM_ROOT_NODULE,
  FORM_SPOIL_PILE,
  ORE_EATER_MOLT,
  PRESENCE_LAYER,
  RECOVERY_STALLED,
  RED_EYE_TREE,
  RESOURCE_LAYER,
  START_REGION_ID,
  TRACE_LAYER,
  WHITE_KING_DOMAIN,
  regionSpec,
  type ResourceSourceSpec,
} from '../../regions';
// C008 이 세운 미로의 이름들 — 그 파일이 소유한다 (c008 ~ c012 시나리오의 선례 그대로).
import { CELL_LAYER, FANTASY_MAZE, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import {
  INTERACTION_RANGE,
  STATE_VERSION,
  TICK_INTERVAL,
  type WorldState,
} from '../semantic/world-state';
import { isCollapsedAt, sourceStateOf, traceStrengthAt } from '../semantic/resource';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

// ── spec 이 동결한 이름과 코드 ────────────────────────────────────────
const MOLT_LITTER = 'MOLT_LITTER';
const RUIN_SPOIL = 'RUIN_SPOIL';
const ORE_OUTCROP = 'ORE_OUTCROP';
const ROOT_NODULE = 'ROOT_NODULE';

/** phase 셋 (spec State 절) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';
const RECOVERING = 'recovering';

/** 거절 사유 — 되돌아오는 중이다 (spec R3 · 기본형 ④) */
const SOURCE_RECOVERING = 'source-recovering';
/** 거절 사유 — 이미 다 캐 갔다 (C012 그대로) */
const SOURCE_DEPLETED = 'source-depleted';

/**
 * 되돌아옴이 **눈에 보이기 시작하는** 지점 — spec 기본형 ① 이 0.5 로 못 박았다.
 * 데이터가 아니라 헤더 상수이므로 여기에도 그 값을 적는다 (spec 이 유일한 출처다).
 */
const RECOVERY_VISIBLE_FRACTION = 0.5;

/** 원천 넷 — 방 · 재료 · 자연 형태. 시간도 자리도 횟수도 데이터에서 읽는다 (여기 적지 않는다) */
const FOUR = [
  { id: MOLT_LITTER, region: FOREST_EDGE, material: ORE_EATER_MOLT, form: FORM_MOLT_LITTER },
  { id: RUIN_SPOIL, region: EXPLORER_RUIN, material: ORE_EATER_MOLT, form: FORM_SPOIL_PILE },
  { id: ORE_OUTCROP, region: BIO_ORE_FIELD, material: BIO_ORE, form: FORM_OUTCROP },
  { id: ROOT_NODULE, region: RED_EYE_TREE, material: BIO_ORE, form: FORM_ROOT_NODULE },
] as const;

type One = (typeof FOUR)[number];
const oneOf = (id: string): One => FOUR.find((f) => f.id === id)!;

/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (C011 · C012 어법) */
const MINE_SECONDS = 1.2;

const solo: WorldSetup = { npcs: [] };

// ── 계약이 준 형 (spec State 절 · Observable 절 그대로 적어 둔다) ─────
//
// 이 파일은 구현의 형을 읽지 않는다. spec 이 글로 적은 자리를 여기 다시 적고,
// 세계가 내놓은 값을 그 형으로 좁혀 본다.

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

/** 원천에 실리는 새 자리들 (spec Observable) */
type SourceView = EntityView & {
  conditions?: readonly string[];
  siteIndex?: number;
  collapsedSites?: readonly number[];
};

/** 검증·촬영용 손잡이 — 세계 규칙을 바꾸지 않는다 (C012 가 세운 자리. 이제 recovering 도 받는다) */
type Setup = WorldSetup & { sourcePhases?: Record<string, string> };
const setup = (options: Setup): WorldSetup => options as WorldSetup;

// ── 하네스 (c008 · c010 · c011 · c012 의 선례 그대로) ─────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id = PLAYER) => state(w).actors.find((a) => a.id === id)!;
const here = (w: WorldDriver, id = PLAYER): XZ => ({
  x: actorOf(w, id).position.x,
  z: actorOf(w, id).position.z,
});

/** 방들의 State — 원천 함수들에 그대로 건넨다 (형은 구현이 소유한다) */
const statesOf = (w: WorldDriver) => state(w).regionStates as never;
/** 같은 것을 spec 이 적은 형으로 본다 */
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
const minBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]!);

const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;

const walkableSpots = (region: string): XZ[] => {
  const t = terrainOf(region);
  return gridSpots(region).filter((p) => isTraversableAt(t, p.x, p.z));
};

// ── 데이터를 읽는 자리 (시간 · 마디 · 흔적 · 붕괴) ───────────────────

/** 그 원천의 성질 — 그 방 resourceEcology 가 소유한다 */
function ecologyOf(id: string): ResourceSourceSpec {
  const one = oneOf(id);
  const found = regionSpec(one.region)?.resourceEcology?.sources.find((s) => s.id === id);
  if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다`);
  return found;
}

/** 캘 수 있는 횟수 (D4) — 데이터가 소유한다 */
const harvestsOf = (id: string): number => ecologyOf(id).harvests;

/** 되돌아오는 데 걸리는 세계 초 (D3) — 데이터가 소유한다 (여기 적지 않는다) */
function recoveryOf(id: string): number {
  const seconds = ecologyOf(id).recoverySeconds;
  if (!(typeof seconds === 'number' && seconds > 0)) {
    throw new Error(`원천 '${id}' 에 recoverySeconds 가 없다 — 데이터가 되돌아옴을 말하지 않는다`);
  }
  return seconds;
}

/** 되돌아옴이 눈에 보이기 시작하는 세계 초 */
const visibleAt = (id: string): number => recoveryOf(id) * RECOVERY_VISIBLE_FRACTION;

/** 그 원천이 매달린 원천 (없으면 undefined) — 데이터가 소유한다 */
const dependsOn = (id: string): string | undefined => ecologyOf(id).dependsOn;

/** C011 이 놓은 자리 — resource layer point 하나 */
const pointOf = (region: string, id: string): XZ =>
  pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id)!.position;

/**
 * 그 원천의 **마디 목록** — 밝힌 원천은 그 방 presence 곡선의 points 가, 밝히지 않은 원천은
 * resource point 하나가 마디다 (spec R4). 좌표를 손으로 적지 않는 유일한 길이다.
 */
function sitesOf(id: string): XZ[] {
  const one = oneOf(id);
  const tag = ecologyOf(id).siteCurve;
  if (!tag) return [pointOf(one.region, id)];
  const curve = curvesOf(spaceOf(one.region), PRESENCE_LAYER, tag)[0];
  if (!curve) throw new Error(`원천 '${id}' 의 뿌리 곡선(presence · ${tag})이 데이터에 없다`);
  if (curve.points.length < 2) throw new Error(`뿌리 곡선에 마디가 하나뿐이다 — ${id}`);
  return curve.points.map((p) => ({ x: p.x, z: p.z }));
}

/** 자리를 옮기는 원천인가 — 마디를 여럿 밝힌 원천이다 */
const migratory = (id: string): boolean => sitesOf(id).length > 1;

/** op id 로 집는 원 — traceOps · collapseOps 가 마디 순서 그대로 가리킨다 */
function circleOp(region: string, opId: string): { center: XZ; radius: number } {
  const op = spaceOf(region).ops.find((o) => o.id === opId);
  if (!op || op.kind !== 'area' || op.shape.kind !== 'circle') {
    throw new Error(`데이터에 원 op '${opId}' 가 없다 (${region})`);
  }
  return { center: op.shape.center, radius: op.shape.radius };
}

/** 마디 i 의 붕괴 자리 — 무너지는 원천만 가진다 */
function collapseCircleAt(id: string, site: number): { center: XZ; radius: number } {
  const ops = ecologyOf(id).collapseOps;
  const opId = ops?.[site];
  if (!opId) throw new Error(`원천 '${id}' 의 마디 ${site} 에 붕괴 area 가 없다`);
  return circleOp(oneOf(id).region, opId);
}

/** 마디 i 의 둘레 흔적 원 */
function traceCircleAt(id: string, site: number): { center: XZ; radius: number } {
  const ops = ecologyOf(id).traceOps;
  const opId = ops?.[site];
  if (!opId) throw new Error(`원천 '${id}' 의 마디 ${site} 에 둘레 흔적 area 가 없다`);
  return circleOp(oneOf(id).region, opId);
}

/** 그 붕괴 원 안이면서 **무너지기 전에는 지날 수 있는** 자리들 */
function collapseSpots(id: string, site: number): XZ[] {
  const { center, radius } = collapseCircleAt(id, site);
  const region = oneOf(id).region;
  const t = terrainOf(region);
  return gridSpots(region).filter(
    (p) => distanceBetween(p, center) <= radius && isTraversableAt(t, p.x, p.z),
  );
}

/** 그 마디의 붕괴 자리 한 가운데 — 걸어 보기 좋은 한 자리 */
const collapseHeart = (id: string, site: number): XZ =>
  minBy(collapseSpots(id, site), (p) => distanceBetween(p, collapseCircleAt(id, site).center));

/** 무너진 자리 전부에서 넉넉히 벗어난, 지날 수 있는 자리 하나 — 몸이 설 자리 */
function awayFromCollapse(id: string): XZ {
  const region = oneOf(id).region;
  const circles = sitesOf(id).map((_, i) => collapseCircleAt(id, i));
  const away = walkableSpots(region).filter((p) =>
    circles.every((c) => distanceBetween(p, c.center) > c.radius + 1),
  );
  if (away.length === 0) throw new Error('붕괴 자리 밖에 설 자리가 없다');
  return away[0]!;
}

/**
 * 그 방의 **바닥** 흔적 — 격자 전체에서 가장 옅은 값이다 (C011 · C012 하네스 그대로).
 */
const floorTrace = (states: never, id: string): number =>
  gridSpots(id).reduce((low, at) => Math.min(low, traceStrengthAt(states, id, at)), Infinity);

// ── 세계를 세우는 자리 ───────────────────────────────────────────────
const standingIn = (region: string, at?: XZ, extra: Setup = {}): WorldDriver =>
  driveWorld(
    setup({
      ...solo,
      actorRegion: region,
      ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
      ...extra,
    }),
  );

/** 그 자리의 손 닿는 곳 — InteractionRange 안이다 (좌표를 적지 않고 한 걸음 옆으로 선다) */
const besideSpot = (at: XZ): XZ => ({ x: at.x + INTERACTION_RANGE / 2, z: at.z });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};

/**
 * 되돌아옴을 기다린다 — 한 걸음 1 세계 초로 **나눠** 굴린다.
 * (한 Tick 에 몰아 주는 것은 spec R1 경계 ② 가 따로 재는 자리다)
 */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
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

/** 정해진 횟수만큼 캔다 — 그 원천이 고갈될 때까지 */
function mineUntilDepleted(w: WorldDriver, id: string, observerId = OBSERVER) {
  for (let i = 0; i < harvestsOf(id); i++) {
    expect({ nth: i + 1, ...mineOnce(w, id, observerId) }).toEqual({
      nth: i + 1,
      status: 'success',
      rule: 'RULE-MINE-001',
    });
  }
}

// ── 저장·복구 (c008 · c010 · c012 의 선례 그대로) ────────────────────
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

/** 되살리면서 State 를 한 자리 고친 세계 — 걸어서는 만들 수 없는 Given 을 공개 길로 세운다 */
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

/** 그 몸을 그 방 그 자리에 세운다 (관성도 하던 행동도 없이 — C010 · C012 하네스 그대로) */
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

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ───────────────
const sourcesIn = (v: GameViewSnapshot): SourceView[] =>
  v.entities.filter((e) => e.role === 'resource-source') as SourceView[];
const sourceEntity = (v: GameViewSnapshot, id: string): SourceView | undefined =>
  sourcesIn(v).find((e) => e.id === id);
const mineOn = (v: GameViewSnapshot, targetEntityId: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'mine' && i.targetEntityId === targetEntityId);

const inventoryIds = (v: GameViewSnapshot): string[] =>
  v.hud.filter((h) => h.id.startsWith('inventory.')).map((h) => h.id);
const held = (v: GameViewSnapshot, material: string): number | boolean | string | undefined =>
  v.hud.find((h) => h.id === `inventory.${material}`)?.value;

/** 그 방 State 가 든 그 원천의 것 — spec 의 점 경로 그대로 */
const storedSource = (w: WorldDriver, region: string, id: string): SourceStateShape | undefined =>
  shapeOf(w)[region]?.sources?.[id];

/** 세계가 스스로 답하는 그 원천의 지금 (semantic 의 공개 경로 — C012 시나리오가 쓰는 어법) */
const phaseOf = (w: WorldDriver, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w), oneOf(id).region, id) as SourceStateShape;

/** 그 원천이 지금 서 있는 자리 — 관찰 결과가 답한다 (State 를 들여다보지 않는다) */
function seenAt(w: WorldDriver, id: string): XZ {
  const seen = sourceEntity(w.observe(), id);
  if (!seen) throw new Error(`관찰 결과에 원천 '${id}' 가 없다`);
  return { x: seen.position.x, z: seen.position.z };
}

/**
 * 그 원천의 **지금 자리** 곁에 선 세계 — 자리가 옮겨 가도 따라간다.
 * 방에 먼저 서서 관찰 결과로 자리를 얻고, 그 옆으로 몸을 옮긴다 (좌표를 적지 않는다).
 */
function beside(id: string, extra: Setup = {}): WorldDriver {
  const one = oneOf(id);
  const base = standingIn(one.region, undefined, extra);
  return moveBody(base, one.region, besideSpot(seenAt(base, id)));
}

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 고갈된 원천이 세계의 과정으로 되돌아온다', () => {
  it('S-011 허물을 다 캐고 제 길이만큼 기다리면 다시 available 이고 taken 이 0 이며 또 캘 수 있다', () => {
    // Given 곡괭이를 지닌 몸이 허물 곁에 선다
    const world = beside(MOLT_LITTER, { actorItems: { pickaxe: 1 } });
    // When 다 캔다
    mineUntilDepleted(world, MOLT_LITTER);
    expect(phaseOf(world, MOLT_LITTER)).toMatchObject({
      phase: DEPLETED,
      taken: harvestsOf(MOLT_LITTER),
    });
    const carried = held(world.observe(), ORE_EATER_MOLT);
    // And 그 원천의 recoverySeconds 만큼 세계를 진행시킨다
    wait(world, recoveryOf(MOLT_LITTER));
    // Then 돌아왔다 — phase 도 관찰 결과도 available 이고 taken 이 0 이다
    expect(phaseOf(world, MOLT_LITTER)).toMatchObject({ phase: AVAILABLE, taken: 0 });
    expect(sourceEntity(world.observe(), MOLT_LITTER)?.state).toBe(AVAILABLE);
    // And 다시 캘 수 있다 — 돌아왔는데 캘 수 없으면 돌아온 것이 아니다 (기본형 ⑥)
    expect(mineOn(world.observe(), MOLT_LITTER)?.available).toBe(true);
    expect(mineOnce(world, MOLT_LITTER)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    expect(held(world.observe(), ORE_EATER_MOLT)).toBe((carried as number) + 1);
  });

  it('S-012 (경계) 임계에 이르기 전에는 available 이 아니다 — 미리 돌아오지 않는다', () => {
    for (const one of FOUR) {
      // Given 그 원천만 고갈된 세계 (매달린 것은 available 이므로 진행이 멎지 않는다)
      const world = standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } });
      const full = recoveryOf(one.id);
      // When 임계 직전까지 진행시킨다
      wait(world, full - 1);
      // Then 아직 돌아오지 않았다
      expect({ id: one.id, phase: phaseOf(world, one.id).phase }).not.toEqual({
        id: one.id,
        phase: AVAILABLE,
      });
      // And 마지막 1 초를 마저 주면 그때 돌아온다
      wait(world, 1);
      expect({ id: one.id, phase: phaseOf(world, one.id).phase }).toEqual({
        id: one.id,
        phase: AVAILABLE,
      });
    }
  });

  it('S-013 (경계 · R1 ②) 한 Tick 이 두 문턱을 함께 넘어도 돌아온다', () => {
    // Given 허물이 고갈된 세계 / When 한 번의 큰 Tick 으로 제 길이를 넘긴다
    const world = standingIn(FOREST_EDGE, undefined, { sourcePhases: { [MOLT_LITTER]: DEPLETED } });
    world.tick(recoveryOf(MOLT_LITTER));
    // Then 절반의 문턱과 임계를 한꺼번에 넘어 available 이다
    expect(phaseOf(world, MOLT_LITTER)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });
});

describe('SPEC-002 되돌아옴의 길이는 원천마다 다르다', () => {
  /** 매달린 것이 없는 원천들 — 저마다 제 길이대로 돌아온다 */
  const independent = FOUR.filter((one) => !dependsOn(one.id));

  it('S-021 원천 넷을 함께 고갈시키면 저마다 자기 recoverySeconds 에 이르러서야 돌아온다', () => {
    // Given 넷이 모두 고갈된 세계
    const phases: Record<string, string> = {};
    for (const one of FOUR) phases[one.id] = DEPLETED;
    const world = standingIn(FOREST_EDGE, undefined, { sourcePhases: phases });

    // When 짧은 것부터 차례로 그 길이만큼 진행시킨다
    const order = [...independent].sort((a, b) => recoveryOf(a.id) - recoveryOf(b.id));
    let elapsed = 0;
    for (const one of order) {
      const full = recoveryOf(one.id);
      wait(world, full - 1 - elapsed);
      elapsed = full - 1;
      // Then 제 임계 직전까지는 돌아오지 않았고
      expect({ id: one.id, at: elapsed, phase: phaseOf(world, one.id).phase }).not.toEqual({
        id: one.id,
        at: elapsed,
        phase: AVAILABLE,
      });
      wait(world, 1);
      elapsed = full;
      // 제 길이에 이르러서야 돌아온다
      expect({ id: one.id, at: elapsed, phase: phaseOf(world, one.id).phase }).toEqual({
        id: one.id,
        at: elapsed,
        phase: AVAILABLE,
      });
      // And (경계) 더 긴 것들은 아직 함께 돌아오지 않았다
      for (const later of order.filter((o) => recoveryOf(o.id) > full)) {
        expect({ id: later.id, at: elapsed, phase: phaseOf(world, later.id).phase }).not.toEqual({
          id: later.id,
          at: elapsed,
          phase: AVAILABLE,
        });
      }
    }
  });

  it('S-022 허물(가장 짧다)이 핵심부(가장 길다)보다 먼저 돌아온다', () => {
    const shortest = minBy(independent, (one) => recoveryOf(one.id));
    const longest = maxBy(independent, (one) => recoveryOf(one.id));
    expect({ shortest: shortest.id, sooner: recoveryOf(shortest.id) < recoveryOf(longest.id) }).toEqual(
      { shortest: MOLT_LITTER, sooner: true },
    );
    const phases: Record<string, string> = {
      [shortest.id]: DEPLETED,
      [longest.id]: DEPLETED,
    };
    const world = standingIn(shortest.region, undefined, { sourcePhases: phases });
    // When 짧은 쪽의 길이만큼만 진행시킨다
    wait(world, recoveryOf(shortest.id));
    // Then 짧은 것만 돌아왔다 — 긴 것은 아직 오는 중이다 (제 길이에 이르지 않았다)
    expect(phaseOf(world, shortest.id).phase).toBe(AVAILABLE);
    expect(phaseOf(world, longest.id).phase).not.toBe(AVAILABLE);
    // And 긴 것도 제 길이에 이르면 돌아온다
    wait(world, recoveryOf(longest.id) - recoveryOf(shortest.id));
    expect(phaseOf(world, longest.id).phase).toBe(AVAILABLE);
  });

  it('S-023 노두 홀로 고갈되면(뿌리혹은 그대로) 자기 길이대로 돌아온다', () => {
    const world = standingIn(BIO_ORE_FIELD, undefined, { sourcePhases: { [ORE_OUTCROP]: DEPLETED } });
    wait(world, recoveryOf(ORE_OUTCROP) - 1);
    expect(phaseOf(world, ORE_OUTCROP).phase).not.toBe(AVAILABLE);
    wait(world, 1);
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(AVAILABLE);
  });
});

describe('SPEC-003 되돌아오는 중이 눈에 보인다', () => {
  /** 그 원천만 고갈시킨 뒤 절반을 갓 넘긴 세계 */
  function halfway(id: string, extra: Setup = {}): WorldDriver {
    const world = standingIn(oneOf(id).region, undefined, {
      ...extra,
      sourcePhases: { [id]: DEPLETED },
    });
    wait(world, visibleAt(id));
    return world;
  }

  it('S-031 절반을 넘기면 phase 가 recovering 이고 관찰 결과의 state 가 그것을 말한다', () => {
    for (const one of FOUR) {
      const world = halfway(one.id);
      expect({ id: one.id, phase: phaseOf(world, one.id).phase }).toEqual({
        id: one.id,
        phase: RECOVERING,
      });
      expect({ id: one.id, state: sourceEntity(world.observe(), one.id)?.state }).toEqual({
        id: one.id,
        state: RECOVERING,
      });
    }
  });

  it('S-032 (경계) 절반에 이르기 전에는 아직 depleted 다 — 보이기 시작하는 때가 있다', () => {
    for (const one of FOUR) {
      const world = standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } });
      wait(world, visibleAt(one.id) - 1);
      expect({ id: one.id, phase: phaseOf(world, one.id).phase }).toEqual({
        id: one.id,
        phase: DEPLETED,
      });
      expect({ id: one.id, state: sourceEntity(world.observe(), one.id)?.state }).toEqual({
        id: one.id,
        state: DEPLETED,
      });
    }
  });

  it('S-033 (경계) 되돌아오는 중에는 캘 수 없다 — 거절되고 소지품은 늘지 않는다', () => {
    for (const one of FOUR) {
      // Given 되돌아오는 중인 원천 곁에 곡괭이를 지니고 선다 (자리가 옮겨 갔으면 그 자리 곁이다)
      const base = halfway(one.id, { actorItems: { pickaxe: 1 } });
      const world = moveBody(base, one.region, besideSpot(seenAt(base, one.id)));
      const before = inventoryIds(world.observe());
      // When 건다
      expect({ id: one.id, ...mine(world, one.id) }).toEqual({
        id: one.id,
        status: 'failure',
        rule: 'RULE-MINE-001',
        reason: SOURCE_RECOVERING,
      });
      tickFor(world, MINE_SECONDS + TICK_INTERVAL);
      // Then 소지품은 늘지 않았다
      expect({ id: one.id, items: inventoryIds(world.observe()) }).toEqual({
        id: one.id,
        items: before,
      });
      // And 요청한 이에게도 같은 대답이 간다
      expect(
        world.dispatchForOutcome({ interactionId: 'mine', targetEntityId: one.id })[0],
      ).toMatchObject({ accepted: false, reason: SOURCE_RECOVERING });
    }
  });

  it('S-034 (경계) 그 사유가 요청 전에도 그 자리에서 읽힌다', () => {
    const base = standingIn(RED_EYE_TREE, undefined, {
      actorItems: { pickaxe: 1 },
      sourcePhases: { [ROOT_NODULE]: RECOVERING },
    });
    const world = moveBody(base, RED_EYE_TREE, besideSpot(seenAt(base, ROOT_NODULE)));
    const offer = mineOn(world.observe(), ROOT_NODULE);
    expect(offer).toBeDefined();
    expect({ available: offer!.available, reason: offer!.reason }).toEqual({
      available: false,
      reason: SOURCE_RECOVERING,
    });
    // 그리고 고갈의 사유는 여전히 source-depleted 다 (셋이 한 코드로 뭉뚱그려지지 않는다)
    const spentBase = standingIn(RED_EYE_TREE, undefined, {
      actorItems: { pickaxe: 1 },
      sourcePhases: { [ROOT_NODULE]: DEPLETED },
    });
    const spent = moveBody(spentBase, RED_EYE_TREE, besideSpot(seenAt(spentBase, ROOT_NODULE)));
    expect(mineOn(spent.observe(), ROOT_NODULE)?.reason).toBe(SOURCE_DEPLETED);
  });

  it('S-035 관찰 결과의 state 가 세 값으로 갈린다 — 형태 넷 저마다', () => {
    // (그림이 셋으로 갈리는가는 화면 쪽 시나리오가 잰다 — 세계는 세 값을 준다)
    for (const one of FOUR) {
      const seen = (phase?: string) =>
        sourceEntity(
          standingIn(one.region, undefined, phase ? { sourcePhases: { [one.id]: phase } } : {}).observe(),
          one.id,
        )?.state;
      expect({
        id: one.id,
        fresh: seen(),
        spent: seen(DEPLETED),
        back: seen(RECOVERING),
      }).toEqual({ id: one.id, fresh: AVAILABLE, spent: DEPLETED, back: RECOVERING });
    }
  });
});

describe('SPEC-004 되돌아오는 중이면 그 자리 흙이 다시 짙어진다', () => {
  /** 그 원천의 **지금 마디** 둘레에서 잰 흔적 세기 */
  const traceAround = (w: WorldDriver, id: string): number =>
    traceStrengthAt(statesOf(w), oneOf(id).region, seenAt(w, id));

  it('S-041 recovering 의 둘레가 depleted 보다 짙고 캐기 전과 같다 — 예보다', () => {
    for (const one of FOUR) {
      const fresh = standingIn(one.region);
      const spent = standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } });
      const back = standingIn(one.region, undefined, { sourcePhases: { [one.id]: RECOVERING } });
      const before = traceAround(fresh, one.id);
      const low = traceAround(spent, one.id);
      const again = traceAround(back, one.id);
      expect({ id: one.id, before, low, again }).toEqual({
        id: one.id,
        before,
        low: before - 1,
        again: before,
      });
    }
  });

  it('S-042 (경계 ①) 방 바닥 흔적은 한 값도 바뀌지 않는다', () => {
    for (const one of FOUR) {
      const fresh = floorTrace(statesOf(standingIn(one.region)), one.region);
      const back = floorTrace(
        statesOf(standingIn(one.region, undefined, { sourcePhases: { [one.id]: RECOVERING } })),
        one.region,
      );
      expect({ id: one.id, floor: back }).toEqual({ id: one.id, floor: fresh });
    }
  });

  it('S-043 (경계 ②) 다른 원천 둘레도 바뀌지 않는다', () => {
    const fresh = standingIn(RED_EYE_TREE);
    const back = standingIn(RED_EYE_TREE, undefined, {
      sourcePhases: { [ROOT_NODULE]: RECOVERING },
    });
    for (const one of FOUR.filter((f) => f.id !== ROOT_NODULE)) {
      const at = sitesOf(one.id)[0]!;
      expect({ id: one.id, at: traceStrengthAt(statesOf(back), one.region, at) }).toEqual({
        id: one.id,
        at: traceStrengthAt(statesOf(fresh), one.region, at),
      });
    }
  });

  it('S-044 자리를 옮기면 흔적도 함께 옮겨 간다 — 옛 마디 둘레는 더 이상 원천의 것이 아니다', () => {
    // Given 노두를 캐 고갈시키고 되돌아오는 중이 될 때까지 진행시킨다
    const world = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(world, ORE_OUTCROP);
    wait(world, visibleAt(ORE_OUTCROP));
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(RECOVERING);
    // Then 지금 마디 둘레는 캐기 전만큼 짙고
    const fresh = standingIn(BIO_ORE_FIELD);
    const nowAt = seenAt(world, ORE_OUTCROP);
    expect(traceStrengthAt(statesOf(world), BIO_ORE_FIELD, nowAt)).toBe(
      traceStrengthAt(statesOf(fresh), BIO_ORE_FIELD, sitesOf(ORE_OUTCROP)[0]!),
    );
    // 옛 마디 둘레는 그 방 바닥과 같다 — 그 원천의 둘레가 아니게 되었다 (spec R7)
    const old = traceCircleAt(ORE_OUTCROP, 0).center;
    expect(traceStrengthAt(statesOf(world), BIO_ORE_FIELD, old)).toBe(
      floorTrace(statesOf(world), BIO_ORE_FIELD),
    );
  });
});

describe('SPEC-005 매달린 것이 available 이 아니면 진행이 멎는다', () => {
  /** 뿌리혹과 노두가 함께 고갈된 세계 */
  const bothSpent = (extra: Setup = {}) =>
    standingIn(BIO_ORE_FIELD, undefined, {
      ...extra,
      sourcePhases: { [ROOT_NODULE]: DEPLETED, [ORE_OUTCROP]: DEPLETED },
    });

  it('S-051 뿌리혹을 캐 놓으면 노두는 제 길이를 훌쩍 넘겨도 돌아오지 않는다', () => {
    expect(dependsOn(ORE_OUTCROP)).toBe(ROOT_NODULE);
    const world = bothSpent();
    // When 노두의 recoverySeconds 를 훌쩍 넘겨 진행시킨다 (뿌리혹이 돌아오기 전까지만)
    const until = Math.min(recoveryOf(ROOT_NODULE), recoveryOf(ORE_OUTCROP) * 1.5) - 1;
    wait(world, until);
    // Then 진행이 오르지 않아 눈에 보이지도 않는다 — 아직 바닥난 채다
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(DEPLETED);
    // And 관찰 결과에 recovery-stalled 가 실린다
    expect(sourceEntity(world.observe(), ORE_OUTCROP)?.conditions ?? []).toContain(
      RECOVERY_STALLED,
    );
  });

  it('S-052 (경계 ①) 뿌리혹은 매달린 것이 없으므로 제 길이대로 돌아온다', () => {
    expect(dependsOn(ROOT_NODULE)).toBeUndefined();
    const world = bothSpent();
    wait(world, recoveryOf(ROOT_NODULE));
    expect(phaseOf(world, ROOT_NODULE).phase).toBe(AVAILABLE);
  });

  it('S-053 (경계 ②) 뿌리혹이 돌아온 뒤부터 노두의 진행이 다시 오르고 결국 돌아온다', () => {
    const world = bothSpent();
    // Given 뿌리혹이 돌아올 때까지 — 그동안 노두는 한 걸음도 나아가지 않았다
    wait(world, recoveryOf(ROOT_NODULE));
    expect(phaseOf(world, ROOT_NODULE).phase).toBe(AVAILABLE);
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(DEPLETED);
    // When 거기서부터 노두의 제 길이만큼 더 진행시킨다
    wait(world, recoveryOf(ORE_OUTCROP) - 1);
    expect(phaseOf(world, ORE_OUTCROP).phase).not.toBe(AVAILABLE);
    wait(world, 1);
    // Then 그때 돌아온다 — 멎어 있던 만큼 늦게
    expect(phaseOf(world, ORE_OUTCROP)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });

  it('S-054 (경계 ③) 매달린 것이 available 인 동안에는 그 코드가 실리지 않는다', () => {
    // Given 노두만 고갈된 세계 (뿌리혹은 그대로다)
    const world = standingIn(BIO_ORE_FIELD, undefined, { sourcePhases: { [ORE_OUTCROP]: DEPLETED } });
    const seen = sourceEntity(world.observe(), ORE_OUTCROP)!;
    // 걸린 것이 없으면 자리 자체가 없다 — 빈 배열로 지어내지 않는다 (C012 S-073 그대로)
    expect(seen.conditions).toBeUndefined();
    // And 진행이 실제로 오른다 — 절반을 넘기면 눈에 보인다
    wait(world, visibleAt(ORE_OUTCROP));
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(RECOVERING);
  });

  it('S-055 (경계) 걸렸다고 캘 수 없는 것은 아니다 — 뿌리혹만 캔 세계에서 노두는 여전히 캔다', () => {
    const base = standingIn(BIO_ORE_FIELD, undefined, {
      actorItems: { pickaxe: 1 },
      sourcePhases: { [ROOT_NODULE]: DEPLETED },
    });
    const world = moveBody(base, BIO_ORE_FIELD, besideSpot(seenAt(base, ORE_OUTCROP)));
    expect(mineOn(world.observe(), ORE_OUTCROP)?.available).toBe(true);
    expect(mineOnce(world, ORE_OUTCROP).status).toBe('success');
  });
});

describe('SPEC-006 자리를 옮기는 원천은 다음 마디에 선다', () => {
  it('S-061 노두가 되돌아오는 중이 되면 뿌리 곡선의 다음 마디에 서고 돌아온 뒤에도 그 자리다', () => {
    const sites = sitesOf(ORE_OUTCROP);
    expect(sites.length).toBeGreaterThan(1);
    // Given 노두 곁에서 다 캔다 — 그때까지는 마디 0 이다
    const world = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    expect(seenAt(world, ORE_OUTCROP)).toEqual(sites[0]);
    mineUntilDepleted(world, ORE_OUTCROP);
    expect(seenAt(world, ORE_OUTCROP)).toEqual(sites[0]);
    // When 되돌아오는 중이 될 때까지 진행시킨다 (돌아오기 전에 자리가 먼저 선다 · 기본형 ②)
    wait(world, visibleAt(ORE_OUTCROP));
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(RECOVERING);
    // Then 자리가 다음 마디로 옮겨 있고 관찰 결과의 position 과 siteIndex 가 그것을 말한다
    const seen = sourceEntity(world.observe(), ORE_OUTCROP)!;
    expect({ position: { x: seen.position.x, z: seen.position.z }, siteIndex: seen.siteIndex }).toEqual({
      position: sites[1],
      siteIndex: 1,
    });
    // And 돌아온 뒤에도 그 자리다
    wait(world, recoveryOf(ORE_OUTCROP) - visibleAt(ORE_OUTCROP));
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(AVAILABLE);
    expect(seenAt(world, ORE_OUTCROP)).toEqual(sites[1]);
  });

  it('S-062 (경계 ①) 자리를 옮기지 않는 원천 셋은 한 값도 자리가 바뀌지 않는다', () => {
    for (const one of FOUR.filter((f) => !migratory(f.id))) {
      const at = sitesOf(one.id)[0]!;
      const world = standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } });
      wait(world, recoveryOf(one.id));
      const seen = sourceEntity(world.observe(), one.id)!;
      expect({ id: one.id, x: seen.position.x, z: seen.position.z }).toEqual({
        id: one.id,
        x: at.x,
        z: at.z,
      });
      // 그리고 마디가 하나뿐인 원천에는 siteIndex 자리가 서지 않는다 (spec Observable)
      expect({ id: one.id, siteIndex: seen.siteIndex }).toEqual({ id: one.id, siteIndex: undefined });
    }
  });

  it('S-063 (경계 ②) 무너진 마디는 건너뛴다 — 지날 수 없는 자리에 서지 않는다', () => {
    // Given 마디 0 과 1 이 이미 무너진 채 마디 0 에서 고갈된 세계 (걸어서는 세울 수 없는 Given)
    const base = standingIn(BIO_ORE_FIELD, awayFromCollapse(ORE_OUTCROP));
    const world = worldFrom(base, (s) => {
      const states = s.regionStates as unknown as RegionStatesShape;
      const room = (states[BIO_ORE_FIELD] ??= {});
      const sources = (room.sources ??= {});
      sources[ORE_OUTCROP] = {
        phase: DEPLETED,
        taken: harvestsOf(ORE_OUTCROP),
        progress: 0,
        siteIndex: 0,
        collapsedSites: [0, 1],
      };
    });
    // When 되돌아오는 중이 될 때까지 진행시킨다
    wait(world, visibleAt(ORE_OUTCROP));
    // Then 무너진 마디 1 을 건너뛰고 마디 2 에 선다
    const seen = sourceEntity(world.observe(), ORE_OUTCROP)!;
    const sites = sitesOf(ORE_OUTCROP);
    expect({ position: { x: seen.position.x, z: seen.position.z }, siteIndex: seen.siteIndex }).toEqual({
      position: sites[2],
      siteIndex: 2,
    });
  });

  it('S-064 (경계 · R1 ③) 무너지지 않은 마디가 하나도 없으면 자리를 옮기지 않는다', () => {
    const sites = sitesOf(ORE_OUTCROP);
    const base = standingIn(BIO_ORE_FIELD, awayFromCollapse(ORE_OUTCROP));
    const world = worldFrom(base, (s) => {
      const states = s.regionStates as unknown as RegionStatesShape;
      const room = (states[BIO_ORE_FIELD] ??= {});
      const sources = (room.sources ??= {});
      sources[ORE_OUTCROP] = {
        phase: DEPLETED,
        taken: harvestsOf(ORE_OUTCROP),
        progress: 0,
        siteIndex: 0,
        collapsedSites: sites.map((_, i) => i),
      };
    });
    wait(world, visibleAt(ORE_OUTCROP));
    const seen = sourceEntity(world.observe(), ORE_OUTCROP)!;
    expect({ position: { x: seen.position.x, z: seen.position.z }, siteIndex: seen.siteIndex }).toEqual({
      position: sites[0],
      siteIndex: 0,
    });
  });

  it('S-065 (경계 · R1 ②) 한 Tick 이 두 문턱을 함께 넘어도 자리 이동은 한 번뿐이다', () => {
    const sites = sitesOf(ORE_OUTCROP);
    const world = standingIn(BIO_ORE_FIELD, awayFromCollapse(ORE_OUTCROP), {
      sourcePhases: { [ORE_OUTCROP]: DEPLETED },
    });
    // When 한 번의 큰 Tick 으로 절반과 임계를 함께 넘긴다
    world.tick(recoveryOf(ORE_OUTCROP));
    const seen = sourceEntity(world.observe(), ORE_OUTCROP)!;
    expect({ phase: phaseOf(world, ORE_OUTCROP).phase, siteIndex: seen.siteIndex }).toEqual({
      phase: AVAILABLE,
      siteIndex: 1,
    });
    expect(seenAt(world, ORE_OUTCROP)).toEqual(sites[1]);
  });
});

describe('SPEC-007 옛 자리는 무너진 채 쌓인다', () => {
  it('S-071 되돌아와 다음 마디에 선 뒤에도 옛 자리는 거절된다 — 원천이 거기 없는데도', () => {
    // Given 노두를 캐 마디 0 을 무너뜨린 세계
    const world = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(world, ORE_OUTCROP);
    // When 되돌아와 다음 마디에 설 때까지 기다린다
    wait(world, recoveryOf(ORE_OUTCROP));
    expect(phaseOf(world, ORE_OUTCROP).phase).toBe(AVAILABLE);
    expect(seenAt(world, ORE_OUTCROP)).toEqual(sitesOf(ORE_OUTCROP)[1]);
    // Then 옛 자리는 여전히 구덩이다
    const old = collapseHeart(ORE_OUTCROP, 0);
    const walker = moveBody(world, BIO_ORE_FIELD, awayFromCollapse(ORE_OUTCROP));
    expect(move(walker, old)).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: BLOCK_COLLAPSED,
    });
    expect(isCollapsedAt(statesOf(walker), BIO_ORE_FIELD, old)).toBe(true);
    // And 관찰 결과가 무너진 마디를 말한다
    expect(sourceEntity(walker.observe(), ORE_OUTCROP)?.collapsedSites).toEqual([0]);
  });

  it('S-072 무너진 자리가 마디마다 쌓인다 — 두 번 돌면 둘이 된다', () => {
    // Given 마디 0 에서 캐고 되돌아온 세계
    const first = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(first, ORE_OUTCROP);
    wait(first, recoveryOf(ORE_OUTCROP));
    // When 옮겨 선 마디 1 곁으로 가서 또 다 캔다
    const second = moveBody(first, BIO_ORE_FIELD, besideSpot(seenAt(first, ORE_OUTCROP)));
    mineUntilDepleted(second, ORE_OUTCROP);
    // Then 무너진 마디가 둘이 되고 둘 다 지날 수 없다
    expect(sourceEntity(second.observe(), ORE_OUTCROP)?.collapsedSites).toEqual([0, 1]);
    const walker = moveBody(second, BIO_ORE_FIELD, awayFromCollapse(ORE_OUTCROP));
    for (const site of [0, 1]) {
      expect({ site, ...move(walker, collapseHeart(ORE_OUTCROP, site)) }).toEqual({
        site,
        status: 'failure',
        rule: 'RULE-MOVE-001',
        reason: BLOCK_COLLAPSED,
      });
    }
  });

  it('S-073 (경계 ①) 아직 고갈된 적 없는 마디는 지날 수 있다', () => {
    const world = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(world, ORE_OUTCROP);
    const walker = moveBody(world, BIO_ORE_FIELD, awayFromCollapse(ORE_OUTCROP));
    for (const site of [1, 2, 3]) {
      const at = collapseHeart(ORE_OUTCROP, site);
      expect({ site, collapsed: isCollapsedAt(statesOf(walker), BIO_ORE_FIELD, at) }).toEqual({
        site,
        collapsed: false,
      });
      expect({ site, status: move(walker, at).status }).toEqual({ site, status: 'success' });
      tickFor(walker, 2);
    }
  });

  it('S-074 (경계 ②) 컴파일 결과는 한 값도 바뀌지 않는다 — 덧씌움이지 재컴파일이 아니다', () => {
    const space = spaceOf(BIO_ORE_FIELD);
    const before = JSON.stringify(compileRegion(space, COMPILE_RULES).world);
    const beforeHash = descriptionHash(space);
    const freshWalkable = walkableSpots(BIO_ORE_FIELD).length;
    const fresh = standingIn(BIO_ORE_FIELD, awayFromCollapse(ORE_OUTCROP));
    // When 마디 둘이 무너지고 원천이 옮겨 선 세계를 세운다
    const world = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(world, ORE_OUTCROP);
    wait(world, recoveryOf(ORE_OUTCROP));
    const second = moveBody(world, BIO_ORE_FIELD, besideSpot(seenAt(world, ORE_OUTCROP)));
    mineUntilDepleted(second, ORE_OUTCROP);
    // Then 다시 컴파일해도 같은 결과이고 그 방의 hash 도 그대로다
    expect(JSON.stringify(compileRegion(space, COMPILE_RULES).world)).toBe(before);
    expect(descriptionHash(space)).toBe(beforeHash);
    expect(second.observe().region.hash).toBe(fresh.observe().region.hash);
    expect(walkableSpots(BIO_ORE_FIELD).length).toBe(freshWalkable);
  });

  it('S-075 (경계 ③) 무너지지 않는 원천 셋은 몇 번을 돌아도 통행을 막지 않는다', () => {
    for (const one of FOUR.filter((f) => f.id !== ORE_OUTCROP)) {
      // Given 그 원천을 캐고 되돌아오게 하고 또 캔 세계
      const world = beside(one.id, { actorItems: { pickaxe: 2 } });
      mineUntilDepleted(world, one.id);
      wait(world, recoveryOf(one.id));
      mineUntilDepleted(world, one.id);
      wait(world, recoveryOf(one.id));
      // Then 그 둘레 어느 자리도 무너지지 않았다
      const at = sitesOf(one.id)[0]!;
      const around = gridSpots(one.region).filter((p) => distanceBetween(p, at) <= 2);
      const collapsed = around.filter((p) => isCollapsedAt(statesOf(world), one.region, p));
      expect({ id: one.id, collapsed }).toEqual({ id: one.id, collapsed: [] });
      // And 그 원천에는 무너진 마디 자리 자체가 실리지 않는다
      expect({
        id: one.id,
        sites: sourceEntity(world.observe(), one.id)?.collapsedSites,
      }).toEqual({ id: one.id, sites: undefined });
    }
  });
});

describe('SPEC-008 되돌아옴은 관찰자 없이도 돌고 세계에 하나다', () => {
  /** 관찰자 둘이 노두 곁에 선 세계 — A 만 곡괭이를 지녔다 (C012 twoBeside 의 어법) */
  function twoBeside(): WorldDriver {
    const source = sitesOf(ORE_OUTCROP)[0]!;
    const base = standingIn(BIO_ORE_FIELD, besideSpot(source), { actorItems: { pickaxe: 1 } });
    base.join(OBSERVER_2);
    base.tick(0);
    return worldFrom(
      base,
      (s) => {
        place(s, PLAYER, BIO_ORE_FIELD, besideSpot(source));
        place(s, PLAYER_2, BIO_ORE_FIELD, { x: source.x - INTERACTION_RANGE / 2, z: source.z });
      },
      [OBSERVER, OBSERVER_2],
    );
  }

  it('S-081 A 가 방을 떠나 기다려도 진행은 올랐고, 돌아와 보면 되돌아와 있다', () => {
    // Given 노두를 다 캔 A
    const world = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(world, ORE_OUTCROP);
    // When 그 방을 떠나 기다린다
    const away = moveBody(world, FOREST_EDGE, walkableSpots(FOREST_EDGE)[0]!);
    wait(away, recoveryOf(ORE_OUTCROP));
    // Then 세계는 그동안에도 되돌리고 있었다
    expect(phaseOf(away, ORE_OUTCROP)).toMatchObject({ phase: AVAILABLE, taken: 0 });
    // And 돌아와 보면 다음 마디에 서 있다
    const back = moveBody(away, BIO_ORE_FIELD, awayFromCollapse(ORE_OUTCROP));
    expect(seenAt(back, ORE_OUTCROP)).toEqual(sitesOf(ORE_OUTCROP)[1]);
  });

  it('S-082 관찰자가 세계 어디에도 없어도 돈다', () => {
    const world = standingIn(BIO_ORE_FIELD, undefined, {
      sourcePhases: { [ORE_OUTCROP]: DEPLETED },
    });
    // When 관찰자가 이어짐을 잃고, 그 뒤로 세계만 흐른다
    world.leave(OBSERVER);
    world.tick(0);
    wait(world, recoveryOf(ORE_OUTCROP));
    // Then 되돌아왔다 — 세계의 과정은 보는 이를 묻지 않는다
    expect(phaseOf(world, ORE_OUTCROP)).toMatchObject({ phase: AVAILABLE, taken: 0 });
  });

  it('S-083 A 와 B 의 관찰 결과에서 phase · 자리 · 무너진 자리가 같다', () => {
    const w = twoBeside();
    expect(sourceEntity(w.observe(OBSERVER_2), ORE_OUTCROP)?.state).toBe(AVAILABLE);
    // When A 가 다 캐고 세계가 되돌린다
    mineUntilDepleted(w, ORE_OUTCROP);
    wait(w, visibleAt(ORE_OUTCROP));
    // Then 둘이 같은 것을 본다
    const a = sourceEntity(w.observe(OBSERVER), ORE_OUTCROP)!;
    const b = sourceEntity(w.observe(OBSERVER_2), ORE_OUTCROP)!;
    expect({
      state: b.state,
      position: b.position,
      siteIndex: b.siteIndex,
      collapsedSites: b.collapsedSites,
    }).toEqual({
      state: a.state,
      position: a.position,
      siteIndex: a.siteIndex,
      collapsedSites: a.collapsedSites,
    });
    expect(b.state).toBe(RECOVERING);
    // And B 에게도 걸 수 없는 것이 되었다
    expect(mineOn(w.observe(OBSERVER_2), ORE_OUTCROP)?.available).toBe(false);
  });

  it('S-084 (경계) 손에 든 재료는 각자의 것이다', () => {
    const w = twoBeside();
    mineUntilDepleted(w, ORE_OUTCROP);
    expect(held(w.observe(OBSERVER), BIO_ORE)).toBe(harvestsOf(ORE_OUTCROP));
    expect(inventoryIds(w.observe(OBSERVER_2))).toEqual([]);
  });
});

describe('SPEC-009 되돌아옴은 세계를 껐다 켜도 이어진다', () => {
  it('S-091 진행 도중에 저장했다 되살려도 그 자리에서 이어지고 남은 만큼 뒤에 돌아온다', () => {
    // Given 노두를 캐고 절반을 갓 넘긴 세계 (되돌아오는 중 · 자리도 옮겼다)
    const lived = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(lived, ORE_OUTCROP);
    wait(lived, visibleAt(ORE_OUTCROP));
    const before = storedSource(lived, BIO_ORE_FIELD, ORE_OUTCROP);
    expect(before).toMatchObject({ phase: RECOVERING, siteIndex: 1, collapsedSites: [0] });
    // When 파일을 지나 되살린다
    const revived = revive(lived);
    // Then State 가 한 자리도 다르지 않다 (phase · progress · 자리 · 무너진 자리)
    expect(storedSource(revived, BIO_ORE_FIELD, ORE_OUTCROP)).toEqual(before);
    const seen = sourceEntity(revived.observe(), ORE_OUTCROP)!;
    expect({ state: seen.state, siteIndex: seen.siteIndex, collapsedSites: seen.collapsedSites }).toEqual({
      state: RECOVERING,
      siteIndex: 1,
      collapsedSites: [0],
    });
    // And 남은 만큼 뒤에 돌아온다 — 되살렸다고 처음부터 다시 세지 않는다
    const left = recoveryOf(ORE_OUTCROP) - visibleAt(ORE_OUTCROP);
    wait(revived, left - 1);
    expect(phaseOf(revived, ORE_OUTCROP).phase).not.toBe(AVAILABLE);
    wait(revived, 1);
    expect(phaseOf(revived, ORE_OUTCROP).phase).toBe(AVAILABLE);
  });

  it('S-092 되살린 세계에서도 무너진 옛 자리가 그대로 거절된다', () => {
    const lived = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(lived, ORE_OUTCROP);
    wait(lived, recoveryOf(ORE_OUTCROP));
    const revived = revive(moveBody(lived, BIO_ORE_FIELD, awayFromCollapse(ORE_OUTCROP)));
    expect(move(revived, collapseHeart(ORE_OUTCROP, 0))).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: BLOCK_COLLAPSED,
    });
    expect(seenAt(revived, ORE_OUTCROP)).toEqual(sitesOf(ORE_OUTCROP)[1]);
  });

  it('S-093 (경계) STATE_VERSION 이 올랐다 — C012 의 스냅샷은 복구되지 않는다', () => {
    expect(STATE_VERSION).toBe('hkt-adv-proto-i/6');
    const saved = throughFile(standingIn(BIO_ORE_FIELD).world.snapshot());
    expect(saved.version).toBe(STATE_VERSION);
    expect(restoreWorld(saved)).not.toBeNull();
    expect(restoreWorld({ ...saved, version: 'hkt-adv-proto-i/5' })).toBeNull();
  });
});

describe('SPEC-010 건드리지 않은 것은 그대로다', () => {
  it('S-0101 되돌아옴이 도는 동안에도 백왕령에는 원천도 흙 변색도 없다', () => {
    // Given 숲에서 캐고 되돌아옴이 도는 세계
    const world = beside(MOLT_LITTER, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(world, MOLT_LITTER);
    wait(world, visibleAt(MOLT_LITTER));
    // Then 백왕령에는 이 계통이 한 자락도 없다
    expect(regionSpec(WHITE_KING_DOMAIN)?.resourceEcology).toBeUndefined();
    expect(areasOf(spaceOf(WHITE_KING_DOMAIN), TRACE_LAYER)).toEqual([]);
    expect(pointsOf(spaceOf(WHITE_KING_DOMAIN), RESOURCE_LAYER)).toEqual([]);
    expect(curvesOf(spaceOf(WHITE_KING_DOMAIN), PRESENCE_LAYER, 'root')).toEqual([]);
    const stained = gridSpots(WHITE_KING_DOMAIN).filter(
      (at) => traceStrengthAt(statesOf(world), WHITE_KING_DOMAIN, at) !== 0,
    );
    expect(stained).toEqual([]);
  });

  it('S-0102 미로의 규칙이 그대로 돈다 — 되돌아옴이 도는 동안에도', () => {
    // Given 노두가 되돌아오는 중인 세계에서 미로에 선다
    const world = standingIn(FANTASY_MAZE, entryAt(), {
      sourcePhases: { [ORE_OUTCROP]: DEPLETED },
    });
    const pattern = mazeState(world).pattern;
    expect({ pattern, pressure: mazeState(world).pressure }).toEqual({ pattern, pressure: 0 });
    // When 걷는다 — 압력이 오른다 (되돌아옴이 함께 도는 동안에도)
    const from = entryAt();
    const cell = tagsAt(mazeTerrain(), from.x, from.z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(cell), (s) => distanceBetween(s, from));
    expect(move(world, far).status).toBe('success');
    for (let i = 0; i < 200; i++) world.tick(TICK_INTERVAL);
    expect(mazeState(world).pressure).toBeGreaterThan(0);
    // And 미로에는 원천이 서지 않는다 — 되돌아옴이 닿을 자리가 없다
    expect(shapeOf(world)[FANTASY_MAZE]?.sources).toBeUndefined();
  });

  it('S-0103 (경계) 캐지 않은 원천은 오래 기다려도 그대로다 — 되돌아옴은 고갈된 것의 일이다', () => {
    const world = driveWorld(solo);
    const longest = maxBy(FOUR, (one) => recoveryOf(one.id));
    wait(world, recoveryOf(longest.id) * 2);
    for (const one of FOUR) {
      expect({ id: one.id, ...phaseOf(world, one.id) }).toMatchObject({
        id: one.id,
        phase: AVAILABLE,
        taken: 0,
      });
    }
    // And 자리도 그대로다 — 캐지 않았으니 옮겨 서지 않는다
    const ore = standingIn(BIO_ORE_FIELD);
    wait(ore, recoveryOf(ORE_OUTCROP) * 2);
    expect(seenAt(ore, ORE_OUTCROP)).toEqual(sitesOf(ORE_OUTCROP)[0]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — 이 Cycle 이 얹은 것 때문에 앞의 것이 무너지지 않았는가
// ─────────────────────────────────────────────────────────────────────

// 미로의 데이터를 읽는 자리 (C008 이 세운 것 — c008 ~ c012 하네스 그대로)
const mazeRule = () => regionSpec(FANTASY_MAZE)!.rule!;
const mazeTerrain = () => terrainOf(FANTASY_MAZE);
const entryAt = (): XZ => anchorAt(FANTASY_MAZE, 'ANCIENT_GATE');
const passageTags = () => areasOf(spaceOf(FANTASY_MAZE), PASSAGE_LAYER).map((a) => a.tag);
const patternNames = () => mazeRule().patterns.map((p) => p.name);
const openOf = (name: string): readonly string[] =>
  mazeRule().patterns.find((p) => p.name === name)!.open;
const closedOf = (name: string): string[] => passageTags().filter((t) => !openOf(name).includes(t));
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
const within = (tags: readonly string[], allowed: readonly string[]) =>
  tags.every((t) => allowed.includes(t));
const passageSpots = (allowed: readonly string[]): Spot[] =>
  mazeSpots().filter((s) => s.traversable && s.passages.length > 0 && within(s.passages, allowed));
const cellSpots = (cell?: string): Spot[] =>
  mazeSpots().filter(
    (s) =>
      s.traversable &&
      s.passages.length === 0 &&
      s.cells.length > 0 &&
      (cell === undefined || s.cells.includes(cell)),
  );

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
    const edge = floorTrace(s, FOREST_EDGE);
    const ruin = floorTrace(s, EXPLORER_RUIN);
    const deep = floorTrace(s, FOREST_DEEP);
    const ore = floorTrace(s, BIO_ORE_FIELD);
    const tree = floorTrace(s, RED_EYE_TREE);
    expect({ edge, ruin, deep, ore, tree }).toEqual({ edge: 1, ruin: 1, deep: 2, ore: 3, tree: 3 });
    // 원천 둘레는 저마다 자기 방 바닥보다 짙다 (마디 0 에 선 채다)
    for (const one of FOUR) {
      const at = traceStrengthAt(s, one.region, sitesOf(one.id)[0]!);
      expect({ id: one.id, deeper: at > floorTrace(s, one.region) }).toEqual({
        id: one.id,
        deeper: true,
      });
    }
    // 그리고 뿌리혹의 자리가 이 세계에서 가장 짙다
    const nodule = traceStrengthAt(s, RED_EYE_TREE, sitesOf(ROOT_NODULE)[0]!);
    for (const one of FOUR.filter((f) => f.id !== ROOT_NODULE)) {
      expect({
        id: one.id,
        below: traceStrengthAt(s, one.region, sitesOf(one.id)[0]!) < nodule,
      }).toEqual({ id: one.id, below: true });
    }
  });

  it('R-002 (C012) 마디가 하나뿐인 원천의 고갈 자국이 한 값도 다르지 않다', () => {
    for (const one of FOUR.filter((f) => !migratory(f.id))) {
      const at = sitesOf(one.id)[0]!;
      const fresh = standingIn(one.region);
      const spent = standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } });
      // 둘레는 한 단계 옅고 바닥은 그대로다 (C012 S-051 · S-052 그대로)
      expect({
        id: one.id,
        ring: traceStrengthAt(statesOf(spent), one.region, at),
        floor: floorTrace(statesOf(spent), one.region),
      }).toEqual({
        id: one.id,
        ring: traceStrengthAt(statesOf(fresh), one.region, at) - 1,
        floor: floorTrace(statesOf(fresh), one.region),
      });
      // 그림이 갈리는 자리(state)와 그대로인 것(형태 · 재료 · 자리)도 C012 그대로다
      const before = sourceEntity(fresh.observe(), one.id)!;
      const after = sourceEntity(spent.observe(), one.id)!;
      expect({ id: one.id, state: after.state, kind: after.kind, material: after.material }).toEqual({
        id: one.id,
        state: DEPLETED,
        kind: one.form,
        material: one.material,
      });
      expect(after.position).toEqual(before.position);
    }
  });

  it('R-003 (C012) 캐는 일과 그 거절 사유가 그대로다', () => {
    const world = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    expect(mine(world, ORE_OUTCROP)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    tickFor(world, MINE_SECONDS + TICK_INTERVAL);
    expect(held(world.observe(), BIO_ORE)).toBe(1);
    const empty = beside(ORE_OUTCROP, { actorItems: {} });
    expect(mine(empty, ORE_OUTCROP)).toMatchObject({ reason: 'no-mining-tool' });
    expect(mine(empty, 'c013-test:no-such-source')).toMatchObject({ reason: 'unknown-source' });
    // 다 캐면 여전히 source-depleted 다 (되돌아오기 전까지)
    const spent = beside(ORE_OUTCROP, { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(spent, ORE_OUTCROP);
    expect(mine(spent, ORE_OUTCROP)).toMatchObject({ reason: SOURCE_DEPLETED });
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
  });

  it('R-005 (C008) 닫힌 통로는 막고 열린 통로는 받아들인다', () => {
    const w = inMaze();
    const pattern = mazeState(w).pattern;
    const closed = passageSpots(closedOf(pattern));
    expect(closed.length).toBeGreaterThan(0);
    expect(move(w, closed[0]!)).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'passage-closed',
    });
    const open = passageSpots(openOf(pattern));
    expect(open.length).toBeGreaterThan(0);
    expect(open.map((s) => move(w, s).status).filter((s) => s !== 'success')).toEqual([]);
  });

  it('R-006 (C001~C007) 백왕령이 그대로다 — 몸이 서고 걸을 수 있다', () => {
    const w = driveWorld(solo);
    expect(actorOf(w).regionId).toBe(START_REGION_ID);
    const view = w.observe();
    expect(view.region.id).toBe(START_REGION_ID);
    expect(sourcesIn(view)).toEqual([]);
    expect(view.interactions.some((i) => i.id === 'mine')).toBe(false);
    const from = here(w);
    const to = maxBy(
      walkableSpots(START_REGION_ID).filter((p) => distanceBetween(p, from) < 8),
      (p) => distanceBetween(p, from),
    );
    expect(move(w, to).status).toBe('success');
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 관찰자가 짙어지는 흙을 **예보로 읽고 미리 가서 기다리는** 한 판 — 흔적은 관찰 결과에 실리지 않고(spec Observable) 짙기가 사람 눈에 갈리는지는 이 층에서 잴 것이 없다 (촬영이 답할 자리)',
  );
  it.todo(
    'GAP: 되돌아온 원천이 **길을 실제로 막는가/터 주는가** — 마디마다 무너진 자리가 쌓여도 방을 가로지르는 경로가 남는지는 길찾기가 있어야 재는데, 이 세계의 이동은 요청 판정뿐이다 (C006 부터의 규율 · C012 가 남긴 결손 그대로)',
  );
  it.todo(
    'GAP: 관찰자 둘이 **같은 Tick 에** 되돌아온 원천의 마지막 한 번을 다투는 경합 — driveWorld 의 dispatch 는 한 요청씩 tick(0) 으로 판정하므로 같은 Tick 안의 두 요청을 세울 수 없다 (C012 가 남긴 결손 그대로)',
  );
  it.todo(
    'GAP: 사슬이 셋(균류 → 뿌리혹 → 노두)으로 이어질 때 진행이 두 단계로 멎는가 — 그 원천(NEST_FUNGUS)이 C014 의 것이라 지금 세계에 자리가 없다',
  );
});
