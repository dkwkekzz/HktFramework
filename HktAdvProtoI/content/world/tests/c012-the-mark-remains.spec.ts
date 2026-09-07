// C012 — 캐면 세계가 달라진다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// 이 Cycle 에서 **원천이 처음으로 State 를 갖는다.** C011 의 원천은 데이터에서 유도되는
// 사실이었고, 지금부터 그 위에 "세계가 겪은 일" 이 얹힌다. 그래서 여기서 재는 것은 인과다:
//   ① 정해진 횟수만큼만 캘 수 있는가 — 그리고 마지막 한 번까지는 미리 고갈되지 않는가
//   ② 다 캐면 phase 가 넘어가고 그것이 관찰 결과에 실리는가
//   ③ 고갈이 세계에 넷을 하는가 — 외형 · 흔적 · 통행 · 의존
//   ④ 그 자국이 사람을 건너가고(관찰자 둘) 세계를 껐다 켜도 남는가
//   ⑤ 그러는 동안 건드리지 않은 것은 한 값도 안 바뀌는가 (백왕령 · 다른 원천 · 컴파일 결과)
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 구현(고갈 전이 · 붕괴 자리 판정 · 조건 평가 · View 의 표)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C012-the-mark-remains/spec.md 와 그것이 동결한 관찰 계약뿐이다.
//
// **좌표도 횟수도 손으로 적지 않는다** — 원천의 자리는 Description 의 resource point 에서,
// 캘 수 있는 횟수는 그 방 resourceEcology 의 harvests 에서, 붕괴 자리의 반경은 그 방
// resource layer area 에서 읽는다. 값이 데이터에서 바뀌면 이 시나리오도 함께 옮겨 간다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { describe, expect, it } from 'vitest';
import {
  areasOf,
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
  BRIDGE_TAG,
  CITY_TAG,
  COMPILE_RULES,
  CONDITION_RIDGE,
  CONDITION_RIVER,
  CONDITION_TREE,
  EXPLORER_RUIN,
  FEATURE_LAYER,
  FOREST_DEEP,
  FOREST_EDGE,
  FORM_MOLT_LITTER,
  FORM_OUTCROP,
  FORM_ROOT_NODULE,
  FORM_SPOIL_PILE,
  ORE_EATER_MOLT,
  RECOVERY_STALLED,
  RED_EYE_TREE,
  RESOURCE_LAYER,
  RIVER_TAG,
  SETTLEMENT_LAYER,
  START_REGION_ID,
  TRACE_LAYER,
  WHITE_KING_DOMAIN,
  regionSpec,
} from '../../regions';
// C008 이 세운 미로의 이름들 — 그 파일이 소유한다 (c008 · c009 · c010 시나리오의 선례 그대로).
import { CELL_LAYER, FANTASY_MAZE, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { INTERACTION_RANGE, STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { findResourceSource, isCollapsedAt, sourceStateOf, sourcesInRegion, traceStrengthAt, type ResourceSource } from '../semantic/resource';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

// ── spec 이 동결한 이름과 코드 ────────────────────────────────────────
const MOLT_LITTER = 'MOLT_LITTER';
const RUIN_SPOIL = 'RUIN_SPOIL';
const ORE_OUTCROP = 'ORE_OUTCROP';
const ROOT_NODULE = 'ROOT_NODULE';

/** 거절 사유 — 이미 다 캐 간 원천이다 (spec R1) */
const SOURCE_DEPLETED = 'source-depleted';

const AVAILABLE = 'available';
const DEPLETED = 'depleted';

/** 원천 넷 — 방 · 재료 · 자연 형태. 자리도 횟수도 데이터에서 읽는다 (여기 적지 않는다) */
const FOUR = [
  { id: MOLT_LITTER, region: FOREST_EDGE, material: ORE_EATER_MOLT, form: FORM_MOLT_LITTER },
  { id: RUIN_SPOIL, region: EXPLORER_RUIN, material: ORE_EATER_MOLT, form: FORM_SPOIL_PILE },
  { id: ORE_OUTCROP, region: BIO_ORE_FIELD, material: BIO_ORE, form: FORM_OUTCROP },
  { id: ROOT_NODULE, region: RED_EYE_TREE, material: BIO_ORE, form: FORM_ROOT_NODULE },
] as const;

/** 노두 말고 셋 — 고갈돼도 통행을 막지 않는 것들 (SPEC-006 경계 ②) */
const NOT_COLLAPSING = FOUR.filter((one) => one.id !== ORE_OUTCROP);

/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (C011 어법) */
const MINE_SECONDS = 1.2;

const solo: WorldSetup = { npcs: [] };

// ── 계약이 준 형 (spec State 절 · Observable 절 그대로 적어 둔다) ─────
//
// 이 파일은 구현의 형을 읽지 않는다. spec 이 글로 적은 자리를 여기 다시 적고,
// 세계가 내놓은 값을 그 형으로 좁혀 본다.

interface SourceStateShape {
  phase: string;
  taken: number;
}
interface RegionStateShape {
  rule?: { pattern: string; pressure: number; rearrangedAt?: number };
  sources?: Record<string, SourceStateShape>;
}
type RegionStatesShape = Record<string, RegionStateShape>;

/** 원천에 걸린 조건 코드가 실리는 자리 (protocol 의 새 자리) */
type SourceView = EntityView & { conditions?: readonly string[] };

/** 검증·촬영용 손잡이 — 세계 규칙을 바꾸지 않는다 (actorRegion · regionPatterns 와 같은 갈래) */
type Setup = WorldSetup & { sourcePhases?: Record<string, string> };
const setup = (options: Setup): WorldSetup => options as WorldSetup;

// ── 하네스 (c008 · c010 · c011 의 선례 그대로) ───────────────────────
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

/** 그 방에서 지날 수 있는 자리들 */
const walkableSpots = (region: string): XZ[] => {
  const t = terrainOf(region);
  return gridSpots(region).filter((p) => isTraversableAt(t, p.x, p.z));
};

// ── 데이터를 읽는 자리 (횟수 · 반경 · 흔적) ──────────────────────────
const sourceOf = (id: string): ResourceSource => {
  const found = findResourceSource(id);
  if (!found) throw new Error(`세계가 원천 '${id}' 를 모른다`);
  return found;
};

/** 캘 수 있는 횟수 — 위임된 결정 D4 의 표는 데이터가 소유한다 (여기 적지 않는다) */
function harvestsOf(id: string): number {
  const source = sourceOf(id);
  const spec = regionSpec(source.regionId)!.resourceEcology!.sources.find((s) => s.id === id)!;
  return spec.harvests;
}

/** 노두의 붕괴 자리 — 그 방 resource layer 의 area 하나 (반경도 데이터의 것이다) */
function collapseCircle(): { center: XZ; radius: number } {
  const area = areasOf(spaceOf(BIO_ORE_FIELD), RESOURCE_LAYER).find((a) => a.tag === ORE_OUTCROP);
  if (!area || area.shape.kind !== 'circle') throw new Error('노두의 붕괴 area 가 데이터에 없다');
  return { center: area.shape.center, radius: area.shape.radius };
}

/** 붕괴 자리 안이면서 **고갈 전에는 지날 수 있는** 자리들 */
function collapseSpots(): XZ[] {
  const { center, radius } = collapseCircle();
  const t = terrainOf(BIO_ORE_FIELD);
  return gridSpots(BIO_ORE_FIELD).filter(
    (p) => distanceBetween(p, center) <= radius && isTraversableAt(t, p.x, p.z),
  );
}

/** 붕괴 자리에서 넉넉히 벗어난, 지날 수 있는 자리 하나 — 몸이 설 자리 */
function outsideCollapse(): XZ {
  const { center, radius } = collapseCircle();
  const away = walkableSpots(BIO_ORE_FIELD).filter((p) => distanceBetween(p, center) > radius + 1);
  if (away.length === 0) throw new Error('붕괴 자리 밖에 설 자리가 없다');
  return minBy(away, (p) => distanceBetween(p, center));
}

/**
 * 그 방의 **바닥** 흔적 — 격자 전체에서 가장 옅은 값이다 (C011 하네스 그대로).
 * 짙은 자리는 바닥 위에 겹쳐 얹히므로 가장 옅은 값이 곧 방 바닥이다.
 */
const floorTrace = (states: never, id: string): number =>
  gridSpots(id).reduce((low, at) => Math.min(low, traceStrengthAt(states, id, at)), Infinity);

// ── 세계를 세우는 자리 ───────────────────────────────────────────────
/** 그 방에 선 몸 하나 — 자리를 밝히지 않으면 그 방의 기본 자리 */
const standingIn = (region: string, at?: XZ, extra: Setup = {}): WorldDriver =>
  driveWorld(
    setup({
      ...solo,
      actorRegion: region,
      ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
      ...extra,
    }),
  );

/** 그 원천의 손 닿는 곳 — InteractionRange 안이다 (좌표를 적지 않고 한 걸음 옆으로 선다) */
const besideSpot = (source: ResourceSource): XZ => ({
  x: source.position.x + INTERACTION_RANGE / 2,
  z: source.position.z,
});

const beside = (source: ResourceSource, extra: Setup = {}): WorldDriver =>
  standingIn(source.regionId, besideSpot(source), extra);

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};

const mine = (w: WorldDriver, targetEntityId: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId }, observerId);

const move = (w: WorldDriver, at: XZ, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } }, observerId);

/** 한 번 캔다 — 걸고, 행동이 끝날 때까지 세계를 진행시킨다 */
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

// ── 저장·복구 (c008 · c010 의 선례 그대로) ───────────────────────────
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

/** 저장했다 되살린 세계 — 그 관찰자들이 다시 이어진다 */
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

/** 그 몸을 그 방 그 자리에 세운다 (관성도 하던 행동도 없이 — C010 하네스 그대로) */
function place(s: WorldState, id: string, region: string, at: XZ) {
  const a = s.actors.find((x: ActorState) => x.id === id)!;
  a.regionId = region;
  a.position = { x: at.x, z: at.z };
  a.velocity = { x: 0, z: 0 };
  a.currentAction = idleAction();
}

/** 관찰자 둘이 같은 원천 곁에 선 세계 — A 만 곡괭이를 지녔다 */
function twoBeside(sourceId: string): { w: WorldDriver; atA: XZ; atB: XZ } {
  const source = sourceOf(sourceId);
  const atA = besideSpot(source);
  const atB = { x: source.position.x - INTERACTION_RANGE / 2, z: source.position.z };
  const base = beside(source, { actorItems: { pickaxe: 1 } });
  base.join(OBSERVER_2);
  base.tick(0);
  const w = worldFrom(
    base,
    (s) => {
      place(s, PLAYER, source.regionId, atA);
      place(s, PLAYER_2, source.regionId, atB);
    },
    [OBSERVER, OBSERVER_2],
  );
  return { w, atA, atB };
}

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

/** 세계가 스스로 답하는 그 원천의 지금 (semantic 의 공개 경로) */
const phaseOf = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(statesOf(w), region, id) as SourceStateShape;

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 캘 수 있는 횟수가 정해져 있다', () => {
  it('S-011 원천 넷마다 harvests 만큼 재료가 손에 들어오고 taken 이 그만큼 오른다', () => {
    for (const one of FOUR) {
      // Given 곡괭이를 지닌 몸이 그 원천의 손 닿는 곳에 선다
      const world = beside(sourceOf(one.id), { actorItems: { pickaxe: 1 } });
      const times = harvestsOf(one.id);
      expect({ id: one.id, times: times > 0 }).toEqual({ id: one.id, times: true });
      // When 정해진 횟수만큼 캔다
      mineUntilDepleted(world, one.id);
      // Then 그 횟수만큼 재료가 들어왔고
      expect({ id: one.id, held: held(world.observe(), one.material) }).toEqual({
        id: one.id,
        held: times,
      });
      // And 그 방의 State 에 taken 이 그만큼 올랐다
      expect({ id: one.id, taken: storedSource(world, one.region, one.id)?.taken }).toEqual({
        id: one.id,
        taken: times,
      });
    }
  });

  it('S-012 (경계) 마지막 한 번까지는 phase 가 available 이다 — 미리 고갈되지 않는다', () => {
    for (const one of FOUR) {
      const times = harvestsOf(one.id);
      const world = beside(sourceOf(one.id), { actorItems: { pickaxe: 1 } });
      // When 마지막 한 번을 남겨 두고 멈춘다
      for (let i = 0; i < times - 1; i++) {
        expect(mineOnce(world, one.id).status).toBe('success');
        // Then 그 사이 내내 phase 는 available 이다
        expect({ id: one.id, nth: i + 1, phase: phaseOf(world, one.region, one.id).phase }).toEqual({
          id: one.id,
          nth: i + 1,
          phase: AVAILABLE,
        });
      }
      const view = world.observe();
      expect({ id: one.id, state: sourceEntity(view, one.id)?.state }).toEqual({
        id: one.id,
        state: AVAILABLE,
      });
      // And 아직 걸 수 있다
      expect({ id: one.id, can: mineOn(view, one.id)?.available }).toEqual({ id: one.id, can: true });
    }
  });
});

describe('SPEC-002 다 캐면 고갈된다', () => {
  it('S-021 뿌리혹을 한 번(harvests) 캐면 phase 가 depleted 가 되고 관찰 결과가 그것을 말한다', () => {
    // Given 곡괭이를 지닌 몸이 뿌리혹 곁에 선다
    const world = beside(sourceOf(ROOT_NODULE), { actorItems: { pickaxe: 1 } });
    expect(sourceEntity(world.observe(), ROOT_NODULE)?.state).toBe(AVAILABLE);
    // When 마지막 한 번을 캔다
    mineUntilDepleted(world, ROOT_NODULE);
    // Then 방의 State 도 관찰 결과도 고갈을 말한다
    expect(storedSource(world, RED_EYE_TREE, ROOT_NODULE)).toMatchObject({ phase: DEPLETED });
    expect(sourceEntity(world.observe(), ROOT_NODULE)?.state).toBe(DEPLETED);
  });

  it('S-022 원천 넷이 저마다 자기 횟수를 채우면 고갈된다', () => {
    for (const one of FOUR) {
      const world = beside(sourceOf(one.id), { actorItems: { pickaxe: 1 } });
      mineUntilDepleted(world, one.id);
      expect({ id: one.id, phase: phaseOf(world, one.region, one.id).phase }).toEqual({
        id: one.id,
        phase: DEPLETED,
      });
      expect({ id: one.id, state: sourceEntity(world.observe(), one.id)?.state }).toEqual({
        id: one.id,
        state: DEPLETED,
      });
    }
  });

  it('S-023 (경계) 캐지 않은 다른 원천 셋의 phase 는 그대로 available 이다', () => {
    // Given 노두를 다 캔 세계
    const world = beside(sourceOf(ORE_OUTCROP), { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(world, ORE_OUTCROP);
    // Then 나머지 셋은 하나도 달라지지 않았다
    for (const one of FOUR.filter((f) => f.id !== ORE_OUTCROP)) {
      expect({ id: one.id, phase: phaseOf(world, one.region, one.id).phase }).toEqual({
        id: one.id,
        phase: AVAILABLE,
      });
      // And 캔 적이 없으므로 taken 도 오르지 않았다
      expect({ id: one.id, taken: phaseOf(world, one.region, one.id).taken }).toEqual({
        id: one.id,
        taken: 0,
      });
    }
  });
});

describe('SPEC-003 고갈된 원천은 다시 캘 수 없다', () => {
  it('S-031 고갈된 원천에 채취를 걸면 거절되고 사유가 source-depleted 다', () => {
    // Given 노두를 다 캔 몸 (손에는 캔 만큼 들어 있다)
    const world = beside(sourceOf(ORE_OUTCROP), { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(world, ORE_OUTCROP);
    const before = held(world.observe(), BIO_ORE);
    expect(before).toBe(harvestsOf(ORE_OUTCROP));
    // When 한 번 더 건다
    expect(mine(world, ORE_OUTCROP)).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: SOURCE_DEPLETED,
    });
    tickFor(world, MINE_SECONDS + TICK_INTERVAL);
    // Then 소지품은 늘지 않았다
    expect(held(world.observe(), BIO_ORE)).toBe(before);
    // And 요청한 이에게도 같은 대답이 간다
    expect(
      world.dispatchForOutcome({ interactionId: 'mine', targetEntityId: ORE_OUTCROP })[0],
    ).toMatchObject({ accepted: false, reason: SOURCE_DEPLETED });
  });

  it('S-032 (경계) 같은 사유가 요청 전에도 읽힌다 — available 이 거짓이고 reason 이 실린다', () => {
    // Given 이미 고갈된 세계에 곡괭이를 지니고 원천 곁에 선다 (캐 보기 전이다)
    const world = beside(sourceOf(ORE_OUTCROP), {
      actorItems: { pickaxe: 1 },
      sourcePhases: { [ORE_OUTCROP]: DEPLETED },
    });
    const offer = mineOn(world.observe(), ORE_OUTCROP);
    expect(offer).toBeDefined();
    expect({ available: offer!.available, reason: offer!.reason }).toEqual({
      available: false,
      reason: SOURCE_DEPLETED,
    });
  });
});

describe('SPEC-004 (세계 몫) 고갈이 관찰 결과의 state 로 갈린다', () => {
  it('S-041 원천 넷 저마다 available 과 depleted 가 관찰 결과에서 다른 값이다', () => {
    for (const one of FOUR) {
      const fresh = sourceEntity(standingIn(one.region).observe(), one.id)!;
      const spent = sourceEntity(
        standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } }).observe(),
        one.id,
      )!;
      expect({ id: one.id, fresh: fresh.state, spent: spent.state }).toEqual({
        id: one.id,
        fresh: AVAILABLE,
        spent: DEPLETED,
      });
      // And 무엇인가(자연 형태 · 재료 · 자리)는 그대로다 — 바뀌는 것은 지금의 상태뿐이다
      expect({ kind: spent.kind, material: spent.material, position: spent.position }).toEqual({
        kind: one.form,
        material: one.material,
        position: fresh.position,
      });
    }
  });

  it('S-042 (경계) 고갈되지 않은 원천의 관찰 값은 한 자리도 바뀌지 않는다', () => {
    // Given 뿌리혹만 고갈된 세계 / When 다른 방의 원천들을 본다
    for (const one of FOUR.filter((f) => f.id !== ROOT_NODULE)) {
      const fresh = sourceEntity(standingIn(one.region).observe(), one.id)!;
      const beside = sourceEntity(
        standingIn(one.region, undefined, { sourcePhases: { [ROOT_NODULE]: DEPLETED } }).observe(),
        one.id,
      )!;
      // 노두에는 조건이 붙는다 (SPEC-007) — 그 자리 하나를 빼면 나머지가 같다
      const { conditions: _ignored, ...rest } = beside;
      expect({ ...rest, id: one.id }).toEqual({ ...fresh, id: one.id });
    }
  });
});

describe('SPEC-005 자국 ② 둘레 흙이 옅어진다', () => {
  it('S-051 고갈된 원천 둘레의 흔적이 캐기 전보다 한 단계 옅다', () => {
    for (const one of FOUR) {
      const at = sourceOf(one.id).position;
      const fresh = standingIn(one.region);
      const spent = standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } });
      const before = traceStrengthAt(statesOf(fresh), one.region, at);
      const after = traceStrengthAt(statesOf(spent), one.region, at);
      expect({ id: one.id, before, after }).toEqual({ id: one.id, before, after: before - 1 });
    }
  });

  it('S-052 (경계) 그 방의 바닥 흔적은 달라지지 않는다', () => {
    for (const one of FOUR) {
      const fresh = standingIn(one.region);
      const spent = standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } });
      expect({ id: one.id, floor: floorTrace(statesOf(spent), one.region) }).toEqual({
        id: one.id,
        floor: floorTrace(statesOf(fresh), one.region),
      });
    }
  });

  it('S-053 (경계) 다른 원천 둘레도 달라지지 않는다', () => {
    // Given 뿌리혹만 고갈된 세계
    const fresh = standingIn(RED_EYE_TREE);
    const spent = standingIn(RED_EYE_TREE, undefined, {
      sourcePhases: { [ROOT_NODULE]: DEPLETED },
    });
    for (const one of FOUR.filter((f) => f.id !== ROOT_NODULE)) {
      const at = sourceOf(one.id).position;
      expect({ id: one.id, at: traceStrengthAt(statesOf(spent), one.region, at) }).toEqual({
        id: one.id,
        at: traceStrengthAt(statesOf(fresh), one.region, at),
      });
    }
  });
});

describe('SPEC-006 자국 ③ 무너진 노두는 지날 수 없다', () => {
  it('S-061 노두를 고갈시킨 뒤 그 자리로 이동을 걸면 거절되고 사유가 collapsed 다', () => {
    // Given 붕괴 자리 밖에 선 몸과, 붕괴 자리 안의 지날 수 있던 자리 하나
    const inside = collapseSpots();
    expect(inside.length).toBeGreaterThan(0);
    const target = minBy(inside, (p) => distanceBetween(p, collapseCircle().center));
    const world = standingIn(BIO_ORE_FIELD, outsideCollapse(), {
      sourcePhases: { [ORE_OUTCROP]: DEPLETED },
    });
    const before = here(world);
    // When 거기로 간다고 한다
    expect(move(world, target)).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: BLOCK_COLLAPSED,
    });
    // Then 몸은 그대로다 — 시간이 흘러도 움직이지 않는다
    tickFor(world, 2);
    expect(here(world)).toEqual(before);
    // And 요청한 이에게도 같은 대답이 간다
    expect(
      world.dispatchForOutcome({ interactionId: 'move', position: { x: target.x, z: target.z } })[0],
    ).toMatchObject({ accepted: false, reason: BLOCK_COLLAPSED });
    // And 세계가 그 자리를 붕괴한 자리로 안다
    expect(isCollapsedAt(statesOf(world), BIO_ORE_FIELD, target)).toBe(true);
  });

  it('S-062 (경계 ①) 고갈 전에는 그 자리를 지날 수 있다', () => {
    const target = minBy(collapseSpots(), (p) => distanceBetween(p, collapseCircle().center));
    const world = standingIn(BIO_ORE_FIELD, outsideCollapse());
    expect(isCollapsedAt(statesOf(world), BIO_ORE_FIELD, target)).toBe(false);
    expect(move(world, target).status).toBe('success');
  });

  it('S-063 (경계 ②) 노두 말고 셋은 고갈돼도 통행을 막지 않는다', () => {
    for (const one of NOT_COLLAPSING) {
      const at = sourceOf(one.id).position;
      const world = standingIn(one.region, undefined, { sourcePhases: { [one.id]: DEPLETED } });
      // 그 원천 둘레의 자리들 — 어느 하나도 붕괴한 자리가 아니다
      const around = gridSpots(one.region).filter((p) => distanceBetween(p, at) <= 2);
      expect({ id: one.id, around: around.length > 0 }).toEqual({ id: one.id, around: true });
      const collapsed = around.filter((p) => isCollapsedAt(statesOf(world), one.region, p));
      expect({ id: one.id, collapsed }).toEqual({ id: one.id, collapsed: [] });
      // 그리고 그 둘레에서 지날 수 있던 자리는 여전히 받아들여진다
      const t = terrainOf(one.region);
      const walkable = around.filter((p) => isTraversableAt(t, p.x, p.z));
      if (walkable.length > 0) {
        const to = minBy(walkable, (p) => distanceBetween(p, at));
        expect({ id: one.id, status: move(world, to).status }).toEqual({
          id: one.id,
          status: 'success',
        });
      }
    }
  });

  it('S-064 (경계 ③) 컴파일 결과는 한 값도 바뀌지 않는다 — 덧씌움이지 재컴파일이 아니다', () => {
    // Given 캐기 전의 땅 (높이 · 표면 · traversable 격자 전부)
    const space = spaceOf(BIO_ORE_FIELD);
    const before = JSON.stringify(compileRegion(space, COMPILE_RULES).world);
    const beforeHash = descriptionHash(space);
    const fresh = standingIn(BIO_ORE_FIELD, outsideCollapse());
    const freshWalkable = walkableSpots(BIO_ORE_FIELD).length;
    // When 노두가 고갈된 세계를 세운다
    const spent = standingIn(BIO_ORE_FIELD, outsideCollapse(), {
      sourcePhases: { [ORE_OUTCROP]: DEPLETED },
    });
    // Then 다시 컴파일해도 같은 결과이고, 그 방의 hash 도 그대로다
    expect(JSON.stringify(compileRegion(space, COMPILE_RULES).world)).toBe(before);
    expect(descriptionHash(space)).toBe(beforeHash);
    expect(spent.observe().region.hash).toBe(fresh.observe().region.hash);
    // And traversable 격자도 한 자리도 줄지 않았다 (막는 것은 State 이지 땅이 아니다)
    expect(walkableSpots(BIO_ORE_FIELD).length).toBe(freshWalkable);
  });
});

describe('SPEC-007 자국 ④ 하나를 캐면 다음 것이 멎는다', () => {
  it('S-071 뿌리혹을 고갈시키면 노두의 관찰 결과에 recovery-stalled 가 실린다', () => {
    // Given 뿌리혹이 고갈된 세계에서 광석 지대를 본다
    const world = standingIn(BIO_ORE_FIELD, undefined, {
      sourcePhases: { [ROOT_NODULE]: DEPLETED },
    });
    const outcrop = sourceEntity(world.observe(), ORE_OUTCROP);
    expect(outcrop).toBeDefined();
    expect(outcrop!.conditions ?? []).toContain(RECOVERY_STALLED);
  });

  it('S-072 (경계 ①) 노두를 캘 수 있는지는 달라지지 않는다', () => {
    const world = beside(sourceOf(ORE_OUTCROP), {
      actorItems: { pickaxe: 1 },
      sourcePhases: { [ROOT_NODULE]: DEPLETED },
    });
    const view = world.observe();
    expect(sourceEntity(view, ORE_OUTCROP)?.state).toBe(AVAILABLE);
    expect(mineOn(view, ORE_OUTCROP)?.available).toBe(true);
    // And 실제로 캐도 된다 — 멎은 것은 되돌아옴이지 채취가 아니다
    expect(mineOnce(world, ORE_OUTCROP).status).toBe('success');
    expect(held(world.observe(), BIO_ORE)).toBe(1);
  });

  it('S-073 (경계 ②) 뿌리혹이 available 인 동안에는 그 코드가 실리지 않는다', () => {
    const world = standingIn(BIO_ORE_FIELD);
    const outcrop = sourceEntity(world.observe(), ORE_OUTCROP)!;
    // 걸린 것이 없으면 자리 자체가 없다 — 빈 배열로 지어내지 않는다
    expect(outcrop.conditions).toBeUndefined();
  });

  it('S-074 (경계 ②) 뿌리혹 자신에게도 그 코드는 걸리지 않는다 — 매달린 쪽에만 선다', () => {
    const world = standingIn(RED_EYE_TREE, undefined, {
      sourcePhases: { [ROOT_NODULE]: DEPLETED },
    });
    const nodule = sourceEntity(world.observe(), ROOT_NODULE)!;
    expect(nodule.state).toBe(DEPLETED);
    expect(nodule.conditions ?? []).not.toContain(RECOVERY_STALLED);
  });
});

describe('SPEC-008 자국은 세계에 하나다', () => {
  it('S-081 A 가 고갈시키면 B 의 관찰 결과에도 같은 phase 가 실린다', () => {
    // Given 관찰자 둘이 노두 곁에 선 세계 (곡괭이는 A 만 지녔다)
    const { w } = twoBeside(ORE_OUTCROP);
    expect(sourceEntity(w.observe(OBSERVER_2), ORE_OUTCROP)?.state).toBe(AVAILABLE);
    // When A 가 다 캔다
    mineUntilDepleted(w, ORE_OUTCROP);
    // Then B 도 같은 것을 본다
    const a = sourceEntity(w.observe(OBSERVER), ORE_OUTCROP)!;
    const b = sourceEntity(w.observe(OBSERVER_2), ORE_OUTCROP)!;
    expect({ who: 'B', state: b.state }).toEqual({ who: 'B', state: DEPLETED });
    expect(b.state).toBe(a.state);
    // And B 에게도 그 원천은 걸 수 없는 것이 되었다
    expect(mineOn(w.observe(OBSERVER_2), ORE_OUTCROP)?.available).toBe(false);
  });

  it('S-082 통행 거절도 B 에게 같다 — 무너진 자리는 사람마다 다르지 않다', () => {
    const { w } = twoBeside(ORE_OUTCROP);
    const target = minBy(collapseSpots(), (p) => distanceBetween(p, collapseCircle().center));
    // Given 캐기 전에는 B 도 지날 수 있다
    expect(move(w, target, OBSERVER_2).status).toBe('success');
    tickFor(w, 2);
    // When A 가 다 캔다
    mineUntilDepleted(w, ORE_OUTCROP);
    // Then B 의 이동도 collapsed 로 거절된다
    expect(move(w, target, OBSERVER_2)).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: BLOCK_COLLAPSED,
    });
  });

  it('S-083 (경계) 손에 든 재료는 A 의 것뿐이다 — B 의 HUD 에는 실리지 않는다', () => {
    const { w } = twoBeside(ORE_OUTCROP);
    mineUntilDepleted(w, ORE_OUTCROP);
    expect(held(w.observe(OBSERVER), BIO_ORE)).toBe(harvestsOf(ORE_OUTCROP));
    expect(inventoryIds(w.observe(OBSERVER_2))).toEqual([]);
  });
});

describe('SPEC-009 자국은 세계를 껐다 켜도 남는다', () => {
  it('S-091 저장했다 되살려도 phase 와 taken 이 그대로다', () => {
    // Given 노두를 다 캔 세계
    const lived = beside(sourceOf(ORE_OUTCROP), { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(lived, ORE_OUTCROP);
    const before = storedSource(lived, BIO_ORE_FIELD, ORE_OUTCROP);
    expect(before).toMatchObject({ phase: DEPLETED, taken: harvestsOf(ORE_OUTCROP) });
    // When 파일을 지나 되살린다
    const revived = revive(lived);
    // Then 그대로다
    expect(storedSource(revived, BIO_ORE_FIELD, ORE_OUTCROP)).toEqual(before);
    expect(sourceEntity(revived.observe(), ORE_OUTCROP)?.state).toBe(DEPLETED);
  });

  it('S-092 되살린 세계에서도 통행 거절이 그대로다', () => {
    const lived = standingIn(BIO_ORE_FIELD, outsideCollapse(), {
      sourcePhases: { [ORE_OUTCROP]: DEPLETED },
    });
    const target = minBy(collapseSpots(), (p) => distanceBetween(p, collapseCircle().center));
    expect(move(lived, target)).toMatchObject({ status: 'failure', reason: BLOCK_COLLAPSED });
    const revived = revive(lived);
    expect(move(revived, target)).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: BLOCK_COLLAPSED,
    });
    expect(isCollapsedAt(statesOf(revived), BIO_ORE_FIELD, target)).toBe(true);
  });

  it('S-093 (경계) STATE_VERSION 이 올랐다 — C011 의 스냅샷은 복구되지 않는다', () => {
    // C013 CHANGED — 원천 State 에 되돌아옴의 셋(progress · siteIndex · collapsedSites)이
    // 더해져 한 번 더 올랐다 (C013 spec State 절 · SPEC-009 경계).
    expect(STATE_VERSION).toBe('hkt-adv-proto-i/6');
    const saved = throughFile(standingIn(BIO_ORE_FIELD).world.snapshot());
    expect(saved.version).toBe(STATE_VERSION);
    expect(restoreWorld(saved)).not.toBeNull();
    expect(restoreWorld({ ...saved, version: 'hkt-adv-proto-i/4' })).toBeNull();
  });
});

describe('SPEC-010 건드리지 않은 것은 그대로다', () => {
  it('S-0101 숲에서 캔 뒤에도 백왕령에는 원천도 흙 변색도 없다', () => {
    // Given 숲 가장자리의 허물을 다 캔 세계
    const world = beside(sourceOf(MOLT_LITTER), { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(world, MOLT_LITTER);
    // Then 백왕령에는 이 계통이 한 자락도 없다
    expect(sourcesInRegion(WHITE_KING_DOMAIN)).toEqual([])
    expect(areasOf(spaceOf(WHITE_KING_DOMAIN), TRACE_LAYER)).toEqual([]);
    expect(pointsOf(spaceOf(WHITE_KING_DOMAIN), RESOURCE_LAYER)).toEqual([]);
    const stained = gridSpots(WHITE_KING_DOMAIN).filter(
      (at) => traceStrengthAt(statesOf(world), WHITE_KING_DOMAIN, at) !== 0,
    );
    expect(stained).toEqual([]);
  });

  it('S-0102 능선 · 강 · 다리 · 도시 · 조건 셋이 그대로다', () => {
    const space = spaceOf(WHITE_KING_DOMAIN);
    const rivers = space.ops.filter(
      (op) => op.kind === 'curve' && op.layer === FEATURE_LAYER && op.tag === RIVER_TAG,
    );
    expect(rivers.length).toBe(1);
    expect(pointsOf(space, FEATURE_LAYER).filter((p) => p.tag === BRIDGE_TAG).length).toBe(1);
    expect(space.ops.some((op) => op.kind === 'stamp' && op.stamp === 'ridge')).toBe(true);
    expect(
      areasOf(space, SETTLEMENT_LAYER)
        .map((a) => a.tag)
        .sort(),
    ).toEqual([CONDITION_RIDGE, CONDITION_RIVER, CONDITION_TREE, CITY_TAG].sort());
  });

  it('S-0103 (경계) 다른 방의 자국은 관찰 결과에 실리지 않는다 — 관찰은 방으로 잘린다', () => {
    // Given 노두가 고갈된 세계에서 숲 가장자리에 선다
    const world = standingIn(FOREST_EDGE, undefined, {
      sourcePhases: { [ORE_OUTCROP]: DEPLETED },
    });
    const view = world.observe();
    expect(view.region.id).toBe(FOREST_EDGE);
    // Then 이 방의 원천만 실린다 — 다른 방의 고갈은 여기에 없다
    expect(sourcesIn(view).map((e) => e.id)).toEqual([MOLT_LITTER]);
    expect(sourceEntity(view, ORE_OUTCROP)).toBeUndefined();
    // And 이 방의 것은 캐지 않았으므로 그대로다
    expect(sourceEntity(view, MOLT_LITTER)?.state).toBe(AVAILABLE);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — 이 Cycle 이 얹은 것 때문에 앞의 것이 무너지지 않았는가
// ─────────────────────────────────────────────────────────────────────

// 미로의 데이터를 읽는 자리 (C008 이 세운 것 — c008 · c010 하네스 그대로)
const mazeSpace = () => spaceOf(FANTASY_MAZE);
const mazeRule = () => regionSpec(FANTASY_MAZE)!.rule!;
const mazeTerrain = () => terrainOf(FANTASY_MAZE);
const entryAt = (): XZ => anchorAt(FANTASY_MAZE, 'ANCIENT_GATE');
const passageTags = () => areasOf(mazeSpace(), PASSAGE_LAYER).map((a) => a.tag);
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

/** 미로의 지금 — **State 의 형이 바뀌었다**: 규칙의 것은 rule 아래에 든다 (spec State 절) */
function mazeState(w: WorldDriver) {
  const held = shapeOf(w)[FANTASY_MAZE];
  if (!held?.rule) throw new Error('미로에 규칙 State 가 없다');
  return held.rule;
}

const inMaze = (at: XZ = entryAt()) =>
  driveWorld({ ...solo, actorRegion: FANTASY_MAZE, actorPosition: { x: at.x, z: at.z } });

/** 압력이 이미 쌓인 미로 — 걸어서 임계까지 가지 않고 그 직전을 세운다 (c008 하네스) */
function primedMaze(at: XZ, pressure: number): WorldDriver {
  return worldFrom(inMaze(at), (s) => {
    const held = (s.regionStates as unknown as RegionStatesShape)[FANTASY_MAZE]!;
    held.rule!.pressure = pressure;
  });
}

/** 자리 둘을 오가며 걷는다 — 멈춤 조건이 참이 될 때까지 (c008 하네스 그대로) */
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
  it('R-001 (C011) 원천 넷이 자기 방 자리에 서고, 처음에는 넷 다 available 이다', () => {
    for (const one of FOUR) {
      const point = pointsOf(spaceOf(one.region), RESOURCE_LAYER).find((p) => p.tag === one.id)!;
      const view = standingIn(one.region).observe();
      const entity = sourceEntity(view, one.id);
      expect({ id: one.id, ids: sourcesIn(view).map((e) => e.id) }).toEqual({
        id: one.id,
        ids: [one.id],
      });
      expect({
        id: one.id,
        x: entity?.position.x,
        z: entity?.position.z,
        kind: entity?.kind,
        material: entity?.material,
        state: entity?.state,
      }).toEqual({
        id: one.id,
        x: point.position.x,
        z: point.position.z,
        kind: one.form,
        material: one.material,
        state: AVAILABLE,
      });
    }
  });

  it('R-002 (C011) 흔적의 사다리가 그대로다 — 경계부 → 중간부 → 핵심부로 짙어진다', () => {
    // 아무것도 고갈되지 않은 세계에서 잰다 (사다리는 C011 이 놓은 그대로여야 한다)
    const w = driveWorld(solo);
    const s = statesOf(w);
    const edge = floorTrace(s, FOREST_EDGE);
    const ruin = floorTrace(s, EXPLORER_RUIN);
    const deep = floorTrace(s, FOREST_DEEP);
    const ore = floorTrace(s, BIO_ORE_FIELD);
    const tree = floorTrace(s, RED_EYE_TREE);
    expect({ edge, ruin, deep, ore, tree }).toEqual({ edge: 1, ruin: 1, deep: 2, ore: 3, tree: 3 });
    // 원천 둘레는 저마다 자기 방 바닥보다 짙다
    for (const one of FOUR) {
      const at = traceStrengthAt(s, one.region, sourceOf(one.id).position);
      expect({ id: one.id, deeper: at > floorTrace(s, one.region) }).toEqual({
        id: one.id,
        deeper: true,
      });
    }
    // 그리고 뿌리혹의 자리가 이 세계에서 가장 짙다
    const nodule = traceStrengthAt(s, RED_EYE_TREE, sourceOf(ROOT_NODULE).position);
    for (const one of FOUR.filter((f) => f.id !== ROOT_NODULE)) {
      expect({
        id: one.id,
        below: traceStrengthAt(s, one.region, sourceOf(one.id).position) < nodule,
      }).toEqual({ id: one.id, below: true });
    }
  });

  it('R-003 (C011) 캐면 그 원천의 재료가 손에 들어온다 — 즉시가 아니라 행동을 거쳐서', () => {
    const world = beside(sourceOf(ORE_OUTCROP), { actorItems: { pickaxe: 1 } });
    expect(mine(world, ORE_OUTCROP)).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    // 절반쯤에서는 아직 손에 든 것이 없다
    tickFor(world, MINE_SECONDS / 2 - TICK_INTERVAL);
    const midway = world.observe();
    expect(inventoryIds(midway)).toEqual([]);
    const body = midway.entities.find((e) => e.id === midway.observer.characterId);
    expect(body?.state).toBe('mine');
    // 다 채우면 그때 들어온다
    tickFor(world, MINE_SECONDS);
    expect(held(world.observe(), BIO_ORE)).toBe(1);
    // 그리고 채취의 거절 사유들도 그대로다
    const empty = beside(sourceOf(ORE_OUTCROP), { actorItems: {} });
    expect(mine(empty, ORE_OUTCROP)).toMatchObject({ reason: 'no-mining-tool' });
    expect(mine(empty, 'c012-test:no-such-source')).toMatchObject({ reason: 'unknown-source' });
  });

  it('R-004 (C008) 방 State 의 형이 바뀌어도 압력 → 재배열이 그대로다', () => {
    // Given 미로에 선 몸 — 규칙의 것은 이제 rule 아래에 든다
    const w = inMaze();
    expect(mazeState(w)).toMatchObject({ pattern: patternNames()[0], pressure: 0 });
    expect(mazeState(w).rearrangedAt).toBeUndefined();
    // 그리고 원천 자리는 아직 서지 않았다 — 원천 없는 방에는 sources 가 없다
    expect(shapeOf(w)[FANTASY_MAZE]?.sources).toBeUndefined();

    // When 걷는다 — 압력이 오른다
    const from = entryAt();
    const cell = tagsAt(mazeTerrain(), from.x, from.z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(cell), (s) => distanceBetween(s, from));
    expect(move(w, far).status).toBe('success');
    for (let i = 0; i < 200; i++) w.tick(TICK_INTERVAL);
    expect(mazeState(w).pressure).toBeGreaterThan(0);

    // And 임계 직전에서 조금 더 걸으면 패턴이 한 칸 간다
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
    const rejected = open.map((s) => move(w, s).status).filter((s) => s !== 'success');
    expect(rejected).toEqual([]);
  });

  it('R-006 (C001~C007) 백왕령이 그대로다 — 몸이 서고 걸을 수 있고 이 계통이 닿지 않는다', () => {
    const w = driveWorld(solo);
    expect(actorOf(w).regionId).toBe(START_REGION_ID);
    const view = w.observe();
    expect(view.region.id).toBe(START_REGION_ID);
    expect(sourcesIn(view)).toEqual([]);
    expect(view.interactions.some((i) => i.id === 'mine')).toBe(false);
    // 걸을 수 있다 — 그리고 그 걸음은 이 Cycle 이 하나도 막지 않았다
    const from = here(w);
    const to = maxBy(
      walkableSpots(START_REGION_ID).filter((p) => distanceBetween(p, from) < 8),
      (p) => distanceBetween(p, from),
    );
    expect(move(w, to).status).toBe('success');
  });

  it('R-007 되살린 세계에서 미로의 패턴도 원천의 phase 도 함께 이어진다', () => {
    // Given 노두를 다 캔 세계 (원천의 자국이 얹혔다)
    const lived = beside(sourceOf(ORE_OUTCROP), { actorItems: { pickaxe: 1 } });
    mineUntilDepleted(lived, ORE_OUTCROP);
    // And 그 세계의 미로도 이미 한 번 겪었다 (걸어서 갈 수 없는 Given 은 저장·복구로 세운다)
    const bumped = worldFrom(lived, (s) => {
      const held = (s.regionStates as unknown as RegionStatesShape)[FANTASY_MAZE]!;
      held.rule!.pattern = nextOf(patternNames()[0]!);
      held.rule!.pressure = 17;
      held.rule!.rearrangedAt = s.time;
    });
    const mazeBefore = { ...mazeState(bumped) };
    const sourceBefore = storedSource(bumped, BIO_ORE_FIELD, ORE_OUTCROP);

    // When 파일을 지나 되살린다
    const revived = revive(bumped);

    // Then 둘 다 그대로다 — 한 방의 State 가 규칙과 원천을 함께 든다
    expect(mazeState(revived)).toEqual(mazeBefore);
    expect(storedSource(revived, BIO_ORE_FIELD, ORE_OUTCROP)).toEqual(sourceBefore);
    expect(sourceBefore).toMatchObject({ phase: DEPLETED });
    // And 규칙 없는 방에는 rule 이, 원천 없는 방에는 sources 가 서지 않는다
    expect(shapeOf(revived)[FANTASY_MAZE]?.sources).toBeUndefined();
    expect(shapeOf(revived)[BIO_ORE_FIELD]?.rule).toBeUndefined();
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 관찰자가 **걸어서** 흔적의 옅어짐을 읽고 "이미 훑은 자리" 로 판단하는 한 판 — 흔적은 관찰 결과에 실리지 않고 관찰자가 스스로 얻는다 (spec Observable). 세계 쪽에서 잴 수 있는 것은 traceStrengthAt 의 값까지다',
  );
  it.todo(
    'GAP: 무너진 노두 때문에 **길이 실제로 달라지는가** — 붕괴 자리를 우회해 방을 가로지르는 경로가 있는지는 길찾기가 있어야 재는데, 이 세계의 이동은 요청 판정뿐이고 경로를 세우지 않는다 (C006 부터의 규율)',
  );
  it.todo(
    'GAP: 관찰자 둘이 **동시에** 같은 원천의 마지막 한 번을 거는 경합 — driveWorld 의 dispatch 는 한 요청씩 tick(0) 으로 판정하므로 같은 tick 안의 두 요청을 세울 수 없다',
  );
});
