// C008 — 규칙이 하나 있는 방 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// 이 Cycle 에서 **땅의 통행이 처음으로 State 가 된다.** 그래서 여기서 재는 것은 인과다:
//   ① 걸은 거리만큼 압력이 오르는가 (서 있으면 오르지 않는가)
//   ② 임계를 넘으면 패턴이 **한 칸만** 가는가
//   ③ 닫힌 통로가 실제로 몸을 세우는가 (그리고 갇히지는 않는가)
//   ④ 그 와중에 식물·구역·컴파일 결과·hash 는 한 값도 안 바뀌는가 (관찰의 기준점)
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 구현(content/regions/fantasy-maze.ts 의 속 · content/world 의 새 규칙 · content/view 의 새 표)은
// 읽지 않았다. 기대값의 출처는 cycles/C008-a-room-with-a-rule/spec.md 와 확정된 데이터·관찰 계약뿐이다.
//
// **좌표를 손으로 적지 않는다.** 구역이 어디이고 통로가 어디인지는 데이터다 — 자리는 언제나
// Description 의 area · point 와 컴파일 결과의 격자에서 **골라** 쓴다. 임계(P)도 걸음값(k)도
// 값을 적지 않고 그 방의 규칙 데이터(RegionSpec.rule)에서 읽는다.
//
// **전체 개수를 단언하지 않는다** — 회귀는 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { describe, expect, it } from 'vitest';
import {
  areasOf,
  descriptionHash,
  pointsOf,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { checkGraph } from '../../../engine/world-authoring/check';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { exitsOf } from '../../../engine/world-authoring/graph';
import { blockedReasonAt, isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  ANCHOR_LAYER,
  BLOCK_STEEP,
  BLOCK_WATER,
  COMPILE_RULES,
  REGION_GRAPH,
  REGION_SPECS,
  START_REGION_ID,
  FRONTIER_REGIONS,
  regionSpec,
} from '../../regions';
// 이 Cycle 이 세운 데이터 파일 (§1.2 확정 계약) — 이름은 그 파일이 소유한다.
import { CELL_LAYER, CLUE_LAYER, FANTASY_MAZE, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import { codeText } from '../../view/code-text';
import type { ActionResult } from '../../protocol/actions';
import { createWorld, restoreWorld, type World } from '../index';
import type { GameViewSnapshot, RegionView, RequestOutcomeView } from '../../protocol/gameview';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

const FOREST_EDGE = 'FOREST_EDGE';
const FOREST_DEEP = 'FOREST_DEEP';
const FOREST_PATH = 'FOREST_PATH';
const DEEP_TRAIL = 'DEEP_TRAIL';
const ANCIENT_GATE = 'ANCIENT_GATE';
const HEART_GATE = 'HEART_GATE';
const MAZE_GATE_RETURN = 'MAZE_GATE_RETURN';
const RED_WASTE_PASS = 'RED_WASTE_PASS';

const solo = { npcs: [] };

// ── 하네스 (c005 · c006 · c007 의 선례 그대로) ─────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id = PLAYER) => state(w).actors.find((a) => a.id === id)!;
const here = (w: WorldDriver, id = PLAYER): XZ => ({
  x: actorOf(w, id).position.x,
  z: actorOf(w, id).position.z,
});
const move = (w: WorldDriver, at: XZ, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } }, observerId);
const askMove = (w: WorldDriver, at: XZ, observerId = OBSERVER): RequestOutcomeView[] =>
  w.dispatchForOutcome({ interactionId: 'move', position: { x: at.x, z: at.z } }, observerId);
const standing = (region: string, at: XZ) =>
  driveWorld({ ...solo, actorRegion: region, actorPosition: { x: at.x, z: at.z } });

const spaceOf = (id: string): RegionDescription => regionSpec(id)!.space;
const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;

const terrainMemo = new Map<string, CompiledWorldTerrain>();
function terrainOf(id: string): CompiledWorldTerrain {
  const hit = terrainMemo.get(id);
  if (hit) return hit;
  const made = compileRegion(spaceOf(id), COMPILE_RULES).world;
  terrainMemo.set(id, made);
  return made;
}

/** 그 방 격자의 vertex 자리 전부 — 자리를 손으로 적지 않기 위한 후보 목록 */
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

// ── 미로의 데이터를 읽는 자리 ─────────────────────────────────
const mazeSpace = () => spaceOf(FANTASY_MAZE);
const mazeRule = () => regionSpec(FANTASY_MAZE)!.rule!;
const mazeTerrain = () => terrainOf(FANTASY_MAZE);
const entryAt = (): XZ => anchorAt(FANTASY_MAZE, ANCIENT_GATE);

const passageTags = () => areasOf(mazeSpace(), PASSAGE_LAYER).map((a) => a.tag);
const cellTags = () => areasOf(mazeSpace(), CELL_LAYER).map((a) => a.tag);
const patternNames = () => mazeRule().patterns.map((p) => p.name);
const openOf = (name: string): readonly string[] =>
  mazeRule().patterns.find((p) => p.name === name)!.open;
const closedOf = (name: string): string[] => passageTags().filter((t) => !openOf(name).includes(t));
const nextOf = (name: string): string => {
  const names = patternNames();
  return names[(names.indexOf(name) + 1) % names.length]!;
};

/** 미로 안의 한 자리 — 어느 구역·통로에 드는가 (판정은 데이터가 한다) */
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

/** 통로에만 드는 자리들 — 걸린 통로가 전부 allowed 안이어야 한다 (겹친 자리를 섞지 않는다) */
const passageSpots = (allowed: readonly string[]): Spot[] =>
  mazeSpots().filter((s) => s.traversable && s.passages.length > 0 && within(s.passages, allowed));
/** 통로에 하나도 들지 않는 구역 안의 자리들 — 어느 패턴에서도 막히지 않는다 */
const cellSpots = (cell?: string): Spot[] =>
  mazeSpots().filter(
    (s) =>
      s.traversable &&
      s.passages.length === 0 &&
      s.cells.length > 0 &&
      (cell === undefined || s.cells.includes(cell)),
  );

const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);
const distanceBetween = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);

// ── 이 방의 State 를 읽는 자리 ────────────────────────────────
const regionStateOf = (w: WorldDriver, id = FANTASY_MAZE) => state(w).regionStates[id]?.rule;
const mazeState = (w: WorldDriver) => {
  const s = regionStateOf(w);
  if (!s) throw new Error('미로에 Region State 가 없다');
  return s;
};
const viewState = (r: RegionView) => r.state;

// ── 걷기 ──────────────────────────────────────────────────────
function walkTo(w: WorldDriver, at: XZ, observerId = OBSERVER) {
  const body = observerId === OBSERVER ? PLAYER : PLAYER_2;
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

function crossFrom(w: WorldDriver, region: string, tag: string, connector: string) {
  walkTo(w, anchorAt(region, tag));
  expect(w.dispatch({ interactionId: 'transit', targetEntityId: connector })).toMatchObject({
    status: 'success',
  });
}

/** 백왕령에서 걸어서 미로까지 — 이 Play 가 시작하는 길 그대로 */
function walkIntoMaze(w: WorldDriver) {
  crossFrom(w, START_REGION_ID, FOREST_PATH, FOREST_PATH);
  crossFrom(w, FOREST_EDGE, DEEP_TRAIL, DEEP_TRAIL);
  crossFrom(w, FOREST_DEEP, ANCIENT_GATE, ANCIENT_GATE);
}

/**
 * 자리 둘을 오가며 걷는다 — 멈춤 조건이 참이 될 때까지. 몇 tick 만에 그리 되었는지를 돌려준다.
 * 요청은 도착할 때마다 다시 낸다 (세계는 경로를 모른다 — 이동은 요청 판정뿐이다).
 */
function walkUntil(
  w: WorldDriver,
  path: readonly XZ[],
  stop: () => boolean,
  limitTicks = 40000,
): number {
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

// ── 이미 무언가 겪은 세계를 짓는 하네스 ───────────────────────
//
// 압력이 이미 쌓인 세계 · 미로 안의 자율 존재는 **걸어서는** 만들 수 없다 (자율 존재를 다른 방에
// 놓는 길이 WorldSetup 에 없다). 그래서 저장·복구라는 공개 길로 그런 세계를 세운다 —
// 세계를 뜯어 고치는 것이 아니라, 그런 일을 이미 겪은 세계를 되살리는 것이다.
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

/** 파일을 지나는 저장 — server/world-store.ts 가 하는 일 그대로 (persistence.spec 의 선례) */
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

/** 미로 안에 선 세계 — 자리를 밝히지 않으면 입구 anchor 다 */
const inMaze = (at: XZ = entryAt()) => standing(FANTASY_MAZE, at);

/** 압력이 이미 `pressure` 만큼 쌓인 미로 */
function primedMaze(at: XZ, pressure: number): WorldDriver {
  return worldFrom(inMaze(at), (s) => {
    s.regionStates[FANTASY_MAZE]!.rule!.pressure = pressure;
  });
}

// ─────────────────────────────────────────────────────────────
describe('SPEC-001 미로가 지어진다', () => {
  it('S-001 미로에 Description 이 있다 — 80×80 · 심부 · 구역 넷 · 통로 여섯 · 식물 넷 · anchor 둘', () => {
    // Given 세계가 아는 방들
    const spec = regionSpec(FANTASY_MAZE);
    // Then 미로가 그 안에 있다 (경계가 아니라 지어진 방이다)
    expect(spec).toBeDefined();
    expect(REGION_SPECS.map((s) => s.id)).toContain(FANTASY_MAZE);
    expect([...FRONTIER_REGIONS]).not.toContain(FANTASY_MAZE);

    const space = mazeSpace();
    expect(spec!.depth).toBe('deep');
    expect({
      width: space.extent.maxX - space.extent.minX,
      depth: space.extent.maxZ - space.extent.minZ,
    }).toEqual({ width: 80, depth: 80 });

    // 구역 넷 · 통로 여섯 — 이름은 데이터가 정하고 자리는 area 가 안다
    expect([...cellTags()].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect([...passageTags()].sort()).toEqual(['AB', 'AC', 'BC', 'BD', 'CD', 'DA'].sort());
    // 식물 넷 — 구역마다 다른 태그다 (이름 자체는 데이터다)
    const clues = pointsOf(space, CLUE_LAYER);
    expect(clues.length).toBe(4);
    expect(new Set(clues.map((p) => p.tag)).size).toBe(4);
    // anchor 둘 — 입구와 심장 쪽
    expect(pointsOf(space, ANCHOR_LAYER).map((p) => p.tag).sort()).toEqual(
      [ANCIENT_GATE, HEART_GATE].sort(),
    );
  });

  it('S-002 (경계) 나가는 문이 하나 서고 checkGraph 의 검사가 전부 0 이다', () => {
    // Given 이 Cycle 이 세운 나가는 문
    const back = REGION_GRAPH.connectors.find((c) => c.id === MAZE_GATE_RETURN);
    expect(back).toBeDefined();
    // Then 미로에서 나가는 끝이다 — 숲 안쪽으로 돌아간다
    expect(back!.from.region).toBe(FANTASY_MAZE);
    expect(back!.to.region).toBe(FOREST_DEEP);
    // 그리고 미로에 나갈 곳이 있다 (검사 ⑦ 이 이것을 본다)
    expect(exitsOf(REGION_GRAPH, FANTASY_MAZE).length).toBeGreaterThan(0);
    // Then 정합 검사가 하나도 걸리지 않는다 — 지어진 방이 경계 목록에 남아 있어도 오류다
    expect(
      checkGraph(
        REGION_SPECS.map((s) => s.space),
        REGION_GRAPH,
        ANCHOR_LAYER,
        START_REGION_ID,
      ),
    ).toEqual([]);
  });

  it('S-003 (경계) 컴파일 결과는 통로를 하나도 막지 않는다 — 막는 것은 State 다', () => {
    // Given 통로 area 안에 드는 자리 전부
    const inPassages = mazeSpots().filter((s) => s.passages.length > 0);
    expect(inPassages.length).toBeGreaterThan(0);
    // Then 컴파일 결과로는 전부 통행 가능하다 (spec World Change ⑤ — State 가 그 위에 덧씌워진다)
    expect(inPassages.filter((s) => !s.traversable).map((s) => [s.x, s.z])).toEqual([]);
    // 그리고 구역·통로 자리를 실제로 고를 수 있다 (아래 검사들이 헛돌지 않는다)
    expect(cellSpots().length).toBeGreaterThan(0);
    for (const tag of passageTags()) {
      expect({ tag, spots: passageSpots([tag]).length > 0 }).toEqual({ tag, spots: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-002 고대 문으로 들어간다', () => {
  it('S-004 숲 안쪽에서 고대 문을 건너면 미로다 — 몸은 입구 anchor 자리, 그곳은 구역 A 안이다', () => {
    // Given 백왕령에서 시작한 몸
    const w = driveWorld(solo);
    // When 숲을 지나 고대 문을 건넌다
    walkIntoMaze(w);
    // Then 방이 미로로 바뀌었다
    expect(actorOf(w).regionId).toBe(FANTASY_MAZE);
    const observed = w.observe();
    expect(observed.region).toMatchObject({
      id: FANTASY_MAZE,
      hash: descriptionHash(mazeSpace()),
    });
    expect(observed.scene).toBe(FANTASY_MAZE);
    // 그리고 몸은 입구 anchor 에 선다 (건너기 규칙이 늘 하던 그대로)
    expect(here(w)).toEqual({ x: entryAt().x, z: entryAt().z });
    // 그 자리는 구역 A 안이다
    expect(tagsAt(mazeTerrain(), entryAt().x, entryAt().z, CELL_LAYER)).toContain('A');
  });

  it('S-005 (경계) 고대 문에서 "아직 갈 수 없는 곳이다" 가 더는 나오지 않는다 — 규칙은 그대로다', () => {
    // Given 고대 문 앞에 선 몸
    const w = driveWorld(solo);
    crossFrom(w, START_REGION_ID, FOREST_PATH, FOREST_PATH);
    crossFrom(w, FOREST_EDGE, DEEP_TRAIL, DEEP_TRAIL);
    walkTo(w, anchorAt(FOREST_DEEP, ANCIENT_GATE));
    // When 건너기를 요청한다
    const crossed = w.dispatch({ interactionId: 'transit', targetEntityId: ANCIENT_GATE });
    // Then 받아들여진다 — C004 에서 region-not-built 였던 그 요청이다
    expect(crossed).toEqual({ status: 'success', rule: 'RULE-REGION-TRANSIT-001' });

    // 그리고 건너기 규칙은 한 글자도 바뀌지 않았다 — 아직 짓지 않은 곳은 여전히 같은 사유로 막힌다
    const other = driveWorld(solo);
    walkTo(other, anchorAt(START_REGION_ID, RED_WASTE_PASS));
    expect(other.dispatch({ interactionId: 'transit', targetEntityId: RED_WASTE_PASS })).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: 'region-not-built',
    });
    expect(codeText('region-not-built')).toBe('아직 갈 수 없는 곳이다');
  });

  it('S-006 (경계) 들어가면 나올 수 있다 — 나가는 문으로 숲 안쪽에 돌아선다', () => {
    // Given 미로 안, 나가는 문의 끝이 놓인 anchor 자리
    const back = REGION_GRAPH.connectors.find((c) => c.id === MAZE_GATE_RETURN)!;
    const w = inMaze(anchorAt(FANTASY_MAZE, back.from.anchor));
    // When 그 문으로 건넌다
    expect(w.dispatch({ interactionId: 'transit', targetEntityId: MAZE_GATE_RETURN })).toMatchObject({
      status: 'success',
    });
    // Then 숲 안쪽에 선다
    expect(actorOf(w).regionId).toBe(FOREST_DEEP);
    expect(here(w)).toEqual({
      x: anchorAt(FOREST_DEEP, back.to.anchor).x,
      z: anchorAt(FOREST_DEEP, back.to.anchor).z,
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-003 걸으면 압력이 오른다', () => {
  it('S-007 걸은 거리 × k 만큼 오른다 — tick 마다 실제로 옮겨진 거리를 재서 맞춘다', () => {
    // Given 미로에 선 몸, 압력은 0 에서 시작한다
    const w = inMaze();
    expect(mazeState(w)).toMatchObject({ pressure: 0, pattern: patternNames()[0] });
    // 그리고 같은 구역 안의 먼 자리 하나 (임계를 넘지 않을 만큼)
    const entryCell = tagsAt(mazeTerrain(), entryAt().x, entryAt().z, CELL_LAYER)[0]!;
    const target = maxBy(cellSpots(entryCell), (s) => distanceBetween(s, entryAt()));
    expect(distanceBetween(target, entryAt())).toBeLessThan(mazeRule().pressureLimit);

    // When 거기까지 걷는다 — 옮겨진 거리를 tick 마다 더한다
    expect(move(w, target).status).toBe('success');
    let walked = 0;
    for (let i = 0; i < 20000; i++) {
      const before = here(w);
      w.tick(TICK_INTERVAL);
      walked += distanceBetween(before, here(w));
      if (actorOf(w).currentAction.kind !== 'move') break;
    }
    expect(walked).toBeGreaterThan(0);

    // Then 압력이 걸은 거리 × k 다
    expect(mazeState(w).pressure).toBeCloseTo(walked * mazeRule().pressurePerDistance, 6);
    // 그리고 아직 넘지 않았으므로 패턴도 그대로다
    expect(mazeState(w).pattern).toBe(patternNames()[0]);
    expect(mazeState(w).rearrangedAt).toBeUndefined();
  });

  it('S-008 (경계) 서 있으면 오르지 않는다 — 시간만 흘러서는 아무 일도 없다', () => {
    // Given 미로에 선 몸이 아무것도 요청하지 않는다
    const w = inMaze();
    const before = { ...mazeState(w) };
    // When 시간이 흐른다
    for (let i = 0; i < 300; i++) w.tick(TICK_INTERVAL);
    // Then 압력도 패턴도 그대로다 — 오르는 것은 걸음이지 시간이 아니다
    expect(mazeState(w)).toEqual(before);
    expect(actorOf(w).movedThisTick).toBe(0);
    expect(here(w)).toEqual({ x: entryAt().x, z: entryAt().z });
  });

  it('S-009 (경계) 미로 밖의 걸음은 미로의 압력이 아니다', () => {
    // Given 백왕령에 선 몸 (미로에는 아무도 없다)
    const w = driveWorld(solo);
    expect(actorOf(w).regionId).toBe(START_REGION_ID);
    const before = { ...mazeState(w) };
    // When 그 방에서 한참 걷는다 (걸을 수 있는 자리는 그 방의 땅이 정한다 — 손으로 적지 않는다)
    const from = here(w);
    const t = terrainOf(START_REGION_ID);
    const walkable = gridSpots(START_REGION_ID).filter(
      (p) => isTraversableAt(t, p.x, p.z) && distanceBetween(p, from) > 5,
    );
    expect(walkable.length).toBeGreaterThan(0);
    walkTo(w, walkable[0]!);
    expect(distanceBetween(here(w), from)).toBeGreaterThan(1);
    // Then 미로의 압력은 0 그대로다
    expect(mazeState(w)).toEqual(before);
    expect(mazeState(w).pressure).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-004 넘치면 길이 바뀐다', () => {
  it('S-010 패턴 표가 확정 2 그대로다 — 셋이 순환하고 저마다 통로 넷이 열린다', () => {
    const rule = mazeRule();
    // Given 그 방이 품은 규칙 데이터
    expect(rule.pressureLimit).toBe(120);
    expect(rule.pressurePerDistance).toBe(1);
    expect(rule.passageLayer).toBe(PASSAGE_LAYER);
    // Then 패턴 셋이 spec 의 표 그대로다 (DEFAULT → P1 → P2 → DEFAULT)
    expect(patternNames()).toEqual(['DEFAULT', 'P1', 'P2']);
    expect([...openOf('DEFAULT')].sort()).toEqual(['AB', 'BC', 'CD', 'DA'].sort());
    expect([...openOf('P1')].sort()).toEqual(['AC', 'BC', 'BD', 'DA'].sort());
    expect([...openOf('P2')].sort()).toEqual(['AC', 'BD', 'CD', 'DA'].sort());
    // 여섯 중 넷이 열리고 둘이 닫힌다
    for (const name of patternNames()) {
      expect({ name, open: openOf(name).length, closed: closedOf(name).length }).toEqual({
        name,
        open: 4,
        closed: 2,
      });
    }
  });

  it('S-011 임계를 넘으면 다음 패턴으로 가고 압력은 0 이 된다 — 그 순간이 State 에 남는다', () => {
    // Given 미로에 선 몸과 같은 구역 안의 자리 둘
    const w = inMaze();
    const entryCell = tagsAt(mazeTerrain(), entryAt().x, entryAt().z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(entryCell), (s) => distanceBetween(s, entryAt()));
    const first = patternNames()[0]!;

    // When 임계를 넘을 때까지 걷는다
    walkUntil(w, [far, entryAt()], () => mazeState(w).pattern !== first);

    // Then 패턴이 순환의 다음이고 압력은 0 이다
    const after = mazeState(w);
    expect(after.pattern).toBe(nextOf(first));
    expect(after.pressure).toBe(0);
    // 그리고 바뀐 순간이 세계 시각으로 남는다 — 그 tick 의 시각이다
    // (시각을 tick 앞에서 읽는지 뒤에서 읽는지는 spec 이 말하지 않는다 — 그래서 tick 하나의 폭으로 잰다)
    expect(after.rearrangedAt).toBeDefined();
    expect(after.rearrangedAt!).toBeGreaterThanOrEqual(state(w).time - TICK_INTERVAL - 1e-9);
    expect(after.rearrangedAt!).toBeLessThanOrEqual(state(w).time + 1e-9);
  });

  it('S-012 세 번 넘기면 처음으로 돌아온다 — 패턴이 셋이므로 순환이다', () => {
    const w = inMaze();
    const entryCell = tagsAt(mazeTerrain(), entryAt().x, entryAt().z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(entryCell), (s) => distanceBetween(s, entryAt()));
    const seen: string[] = [mazeState(w).pattern];
    // When 세 번 넘긴다
    for (let n = 0; n < 3; n++) {
      const now = mazeState(w).pattern;
      walkUntil(w, [far, entryAt()], () => mazeState(w).pattern !== now);
      seen.push(mazeState(w).pattern);
    }
    // Then 지나온 자취가 표의 순환 그대로이고 처음으로 돌아왔다
    expect(seen).toEqual([...patternNames(), patternNames()[0]]);
  });

  it('S-013 (경계) 한 tick 에 임계를 크게 넘겨도 패턴은 한 칸만 간다', () => {
    // Given 미로 안의 몸 둘이 서로 가장 먼 두 자리에 서 있고, 압력은 임계 바로 아래다.
    //       (이 Given 은 걸어서는 못 만든다 — 저장·복구 길로 그런 세계를 세운다)
    const candidates = cellSpots();
    const start = candidates.reduce((best, s) => (s.x + s.z < best.x + best.z ? s : best), candidates[0]!);
    const other = candidates.reduce((best, s) => (s.x + s.z > best.x + best.z ? s : best), candidates[0]!);
    const limit = mazeRule().pressureLimit;
    const primed = limit - 0.5;

    const base = inMaze(start);
    base.join(OBSERVER_2);
    base.tick(0);
    const w = worldFrom(
      base,
      (s) => {
        const a = s.actors.find((x) => x.id === PLAYER)!;
        const b = s.actors.find((x) => x.id === PLAYER_2)!;
        a.regionId = FANTASY_MAZE;
        a.position = { x: start.x, z: start.z };
        b.regionId = FANTASY_MAZE;
        b.position = { x: other.x, z: other.z };
        s.regionStates[FANTASY_MAZE]!.rule!.pressure = primed;
      },
      [OBSERVER, OBSERVER_2],
    );

    // 이 Given 이 실제로 **임계 둘**을 넘길 만한가 — 넘기지 못하면 이 검사는 헛돈다
    const span = distanceBetween(start, other);
    expect(primed + span * 2 * mazeRule().pressurePerDistance).toBeGreaterThanOrEqual(limit * 2);

    const before = mazeState(w).pattern;
    // When 둘이 서로의 자리로 한 tick 에 건너간다 (dt 를 크게 주어 그 tick 에 도착한다)
    expect(move(w, other, OBSERVER).status).toBe('success');
    expect(move(w, start, OBSERVER_2).status).toBe('success');
    w.tick(1000);

    // Then 그 tick 에 두 몸이 실제로 그만큼 움직였다
    expect(distanceBetween(here(w, PLAYER), other)).toBeLessThan(0.05);
    expect(distanceBetween(here(w, PLAYER_2), start)).toBeLessThan(0.05);
    // 그런데 패턴은 **한 칸만** 갔다 (임계를 두 번 넘길 압력이었다)
    const after = mazeState(w);
    expect(after.pattern).toBe(nextOf(before));
    // 그리고 남은 압력을 이월하지 않는다 — 0 이다
    expect(after.pressure).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-005 닫힌 통로는 막는다', () => {
  it('S-014 닫힌 통로 안의 자리로 이동을 요청하면 거절된다 — 사유는 passage-closed, 몸은 그대로다', () => {
    // Given 미로에 선 몸과 지금 패턴에서 닫힌 통로 하나
    const w = inMaze();
    const pattern = mazeState(w).pattern;
    const closed = closedOf(pattern);
    expect(closed.length).toBeGreaterThan(0);
    const target = passageSpots(closed)[0]!;
    const before = here(w);

    // When 거기로 간다고 한다
    const result = move(w, target);
    // Then 거절된다 — 규칙 id 는 C006 의 그것 그대로고 사유 코드 하나가 늘었을 뿐이다
    expect(result).toEqual({ status: 'failure', rule: 'RULE-MOVE-001', reason: 'passage-closed' });
    // 그리고 몸이 실제로 선다 — 시간이 흘러도 그대로다
    expect(here(w)).toEqual(before);
    for (let i = 0; i < 60; i++) w.tick(TICK_INTERVAL);
    expect(here(w)).toEqual(before);
    // 요청한 이에게도 같은 대답이 간다
    expect(askMove(w, target)[0]).toMatchObject({ accepted: false, reason: 'passage-closed' });
    // 그 코드에 사람이 읽을 말이 붙어 있다 (문구 자체는 View 의 표가 정한다)
    expect(codeText('passage-closed')).not.toBe('passage-closed');
  });

  it('S-015 (경계) 열린 통로 안으로는 받아들여진다 — 막는 것은 닫힌 통로뿐이다', () => {
    const w = inMaze();
    const pattern = mazeState(w).pattern;
    // Given 지금 열린 통로들 안의 자리 전부
    const open = passageSpots(openOf(pattern));
    expect(open.length).toBeGreaterThan(0);
    // Then 하나도 거절되지 않는다
    const rejected = open
      .map((s) => ({ at: [s.x, s.z], status: move(w, s).status }))
      .filter((r) => r.status !== 'success');
    expect(rejected).toEqual([]);
    // 그리고 구역 안(통로가 아닌 자리)은 언제나 받아들여진다
    expect(move(w, cellSpots()[0]!).status).toBe('success');
  });

  it('S-016 (경계) 닫힌 통로 안에 서게 되어도 갇히지 않는다 — 판정은 목표 자리만 본다', () => {
    // Given 지금은 열려 있지만 다음 패턴에서 닫히는 통로 하나
    const first = patternNames()[0]!;
    const willClose = openOf(first).find((t) => closedOf(nextOf(first)).includes(t))!;
    expect(willClose).toBeDefined();
    const inside = passageSpots([willClose]);
    expect(inside.length).toBeGreaterThan(1);
    const from = inside[0]!;
    const to = maxBy(inside, (s) => distanceBetween(s, from));
    expect(distanceBetween(from, to)).toBeGreaterThan(0.5);

    // 그리고 임계 바로 아래까지 압력이 찬 세계 (통로 안을 몇 걸음 걸으면 넘는다)
    const w = primedMaze(from, mazeRule().pressureLimit - 0.25);
    // When 그 통로 안을 걸어 임계를 넘긴다
    walkUntil(w, [to], () => mazeState(w).pattern !== first);

    // Then 몸은 이제 **닫힌** 통로 안에 서 있다
    const nowPattern = mazeState(w).pattern;
    const standingIn = tagsAt(mazeTerrain(), here(w).x, here(w).z, PASSAGE_LAYER);
    expect(standingIn).toContain(willClose);
    expect(closedOf(nowPattern)).toContain(willClose);
    // 그런데 열린 자리로 나가는 요청은 받아들여진다 — 밀어내지도 않고 가두지도 않는다
    const out = maxBy(cellSpots(), (s) => -distanceBetween(s, here(w)));
    expect(move(w, out).status).toBe('success');
    // 다른 닫힌 통로로 가는 것은 여전히 거절된다 (판정은 목표 자리만 본다)
    const stillClosed = passageSpots(closedOf(nowPattern))[0]!;
    expect(move(w, stillClosed)).toMatchObject({ status: 'failure', reason: 'passage-closed' });
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-006 식물은 그 자리에 있다', () => {
  /** 그 방의 컴파일 결과를 값으로 뜬다 — 한 값이라도 달라지면 이 지문이 달라진다 */
  const fingerprint = () => {
    const t = compileRegion(mazeSpace(), COMPILE_RULES);
    return JSON.stringify({
      hash: t.hash,
      height: [...t.world.height],
      surface: [...t.world.surface],
      surfaceTags: t.world.surfaceTags,
      traversable: [...t.world.traversable],
      blocked: [...t.world.blocked],
      blockedTags: t.world.blockedTags,
      areas: t.world.areas,
      points: t.world.points,
    });
  };

  it('S-017 패턴이 바뀌어도 식물·구역·컴파일 결과·hash 가 한 값도 바뀌지 않는다', () => {
    // Given 재배열 전의 Description 과 컴파일 결과
    const w = inMaze();
    const first = mazeState(w).pattern;
    const clueBefore = JSON.stringify(pointsOf(mazeSpace(), CLUE_LAYER));
    const cellsBefore = JSON.stringify(areasOf(mazeSpace(), CELL_LAYER));
    const spaceBefore = JSON.stringify(mazeSpace());
    const compiledBefore = fingerprint();
    const hashBefore = descriptionHash(mazeSpace());

    // When 임계를 넘겨 통로가 재배열된다
    const entryCell = tagsAt(mazeTerrain(), entryAt().x, entryAt().z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(entryCell), (s) => distanceBetween(s, entryAt()));
    walkUntil(w, [far, entryAt()], () => mazeState(w).pattern !== first);
    expect(mazeState(w).pattern).not.toBe(first);

    // Then 식물도 구역도 그 자리 그대로다 — 이것이 관찰의 기준점이다
    expect(JSON.stringify(pointsOf(mazeSpace(), CLUE_LAYER))).toBe(clueBefore);
    expect(JSON.stringify(areasOf(mazeSpace(), CELL_LAYER))).toBe(cellsBefore);
    // 그리고 Description 도 컴파일 결과도 hash 도 한 값도 바뀌지 않았다
    expect(JSON.stringify(mazeSpace())).toBe(spaceBefore);
    expect(fingerprint()).toBe(compiledBefore);
    expect(descriptionHash(mazeSpace())).toBe(hashBefore);
  });

  it('S-018 (경계) 관찰 결과의 region.hash 도 그대로다 — 바뀐 것은 State 이지 Description 이 아니다', () => {
    const w = inMaze();
    const first = mazeState(w).pattern;
    const observedBefore = w.observe().region;
    const entryCell = tagsAt(mazeTerrain(), entryAt().x, entryAt().z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(entryCell), (s) => distanceBetween(s, entryAt()));
    walkUntil(w, [far, entryAt()], () => mazeState(w).pattern !== first);

    const observedAfter = w.observe().region;
    // Then 방의 정체(id · hash)는 같고
    expect({ id: observedAfter.id, hash: observedAfter.hash }).toEqual({
      id: observedBefore.id,
      hash: observedBefore.hash,
    });
    // 바뀐 것은 State 하나뿐이다
    expect(viewState(observedAfter)!.pattern).not.toBe(viewState(observedBefore)!.pattern);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-007 세계가 미로의 상태를 말한다', () => {
  it('S-019 관찰 결과에 pattern · pressure · 임계값이 실린다', () => {
    // Given 미로 안의 관찰자
    const w = inMaze();
    const view = viewState(w.observe().region);
    expect(view).toBeDefined();
    // Then 세계가 든 State 그대로다
    expect(view).toMatchObject({
      pattern: mazeState(w).pattern,
      pressure: mazeState(w).pressure,
      pressureLimit: mazeRule().pressureLimit,
    });
    // 아직 한 번도 안 바뀌었으므로 그 자리는 비어 있다 (0 으로 지어내지 않는다)
    expect(view!.rearrangedAt).toBeUndefined();

    // When 걷는다
    const entryCell = tagsAt(mazeTerrain(), entryAt().x, entryAt().z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(entryCell), (s) => distanceBetween(s, entryAt()));
    expect(move(w, far).status).toBe('success');
    for (let i = 0; i < 60; i++) w.tick(TICK_INTERVAL);
    // Then 관찰 결과의 압력도 함께 오른다 — 얼마나 찼는지를 View 가 이 둘로 잰다
    const walking = viewState(w.observe().region)!;
    expect(walking.pressure).toBeGreaterThan(0);
    expect(walking.pressure).toBe(mazeState(w).pressure);
    expect(walking.pressureLimit).toBe(mazeRule().pressureLimit);
  });

  it('S-020 패턴이 바뀐 순간이 관찰 결과에서 읽힌다', () => {
    const w = inMaze();
    const first = mazeState(w).pattern;
    const entryCell = tagsAt(mazeTerrain(), entryAt().x, entryAt().z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(entryCell), (s) => distanceBetween(s, entryAt()));
    walkUntil(w, [far, entryAt()], () => mazeState(w).pattern !== first);

    const view = viewState(w.observe().region)!;
    // Then 바뀐 패턴과 그 순간이 함께 실린다 — "얼마 전인가" 는 View 가 지금 시각과의 차로 잰다
    expect(view.pattern).toBe(nextOf(first));
    expect(view.rearrangedAt).toBe(mazeState(w).rearrangedAt);
    expect(view.rearrangedAt).toBeLessThanOrEqual(state(w).time);
    // 그리고 그 순간을 알리는 코드에 사람이 읽을 말이 있다
    expect(codeText('maze-rearranged')).not.toBe('maze-rearranged');
  });

  it('S-021 (경계) State 를 갖지 않는 방에서는 region.state 가 아예 없다', () => {
    // Given 백왕령의 관찰자
    const w = driveWorld(solo);
    const region = w.observe().region;
    // Then 그 자리가 비어 있다 — 없는 것을 0 으로 지어내지 않는다
    expect(viewState(region)).toBeUndefined();
    // 그리고 세계의 State 에도 그 방의 자리가 없다
    expect(state(w).regionStates[START_REGION_ID]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-008 자율 존재의 걸음도 압력이다', () => {
  /** 미로 안에서 순회하는 자율 존재 하나가 있는 세계 (관찰자는 멀찍이 가만히 선다) */
  function mazeWithWanderer(): { w: WorldDriver; observerAt: XZ } {
    const cell = cellSpots();
    const path = [cell[0]!, maxBy(cell, (s) => distanceBetween(s, cell[0]!))];
    const observerAt = entryAt();
    const base = driveWorld({
      npcs: [{ id: 'npc-maze', position: path[0]!, wanderPath: [...path], perceptionRange: 0 }],
      actorRegion: FANTASY_MAZE,
      actorPosition: observerAt,
    });
    const w = worldFrom(base, (s) => {
      const npc = s.actors.find((a: ActorState) => a.id === 'npc-maze')!;
      npc.regionId = FANTASY_MAZE;
      npc.position = { x: path[0]!.x, z: path[0]!.z };
      npc.wanderPath = path.map((p) => ({ x: p.x, z: p.z }));
      npc.wanderIndex = 0;
      npc.perceptionRange = 0;
      npc.currentAction = idleAction();
      s.regionStates[FANTASY_MAZE]!.rule!.pressure = 0;
    });
    return { w, observerAt };
  }

  it('S-022 관찰자가 가만히 있어도 자율 존재가 움직이면 압력이 오른다', () => {
    // Given 미로 안에 자율 존재 하나, 관찰자는 아무것도 요청하지 않는다
    const { w, observerAt } = mazeWithWanderer();
    expect(actorOf(w, 'npc-maze').regionId).toBe(FANTASY_MAZE);
    expect(mazeState(w).pressure).toBe(0);

    // When 시간만 흐른다
    let npcWalked = 0;
    for (let i = 0; i < 200; i++) {
      const before = { ...actorOf(w, 'npc-maze').position };
      w.tick(TICK_INTERVAL);
      npcWalked += distanceBetween(before, actorOf(w, 'npc-maze').position);
    }

    // Then 관찰자는 한 걸음도 걷지 않았는데
    expect(here(w)).toEqual({ x: observerAt.x, z: observerAt.z });
    expect(actorOf(w).movedThisTick).toBe(0);
    // 압력은 그 존재가 걸은 만큼 올랐다 — Scope 는 그 방 안의 **모든 몸**이다
    expect(npcWalked).toBeGreaterThan(0);
    expect(mazeState(w).pressure).toBeCloseTo(npcWalked * mazeRule().pressurePerDistance, 6);
  });

  it('S-023 (경계) 미로 밖의 자율 존재는 미로의 압력에 아무것도 더하지 않는다', () => {
    // Given 세계의 기본 배치 — 자율 존재 둘이 백왕령을 순회한다
    const w = driveWorld({ actorRegion: FANTASY_MAZE, actorPosition: entryAt() });
    const wanderers = state(w).actors.filter((a) => a.control === 'autonomous');
    expect(wanderers.length).toBeGreaterThan(0);
    expect(wanderers.every((a) => a.regionId !== FANTASY_MAZE)).toBe(true);

    // When 그들이 한참 순회한다
    let outsideWalked = 0;
    for (let i = 0; i < 300; i++) {
      const before = state(w).actors.filter((a) => a.control === 'autonomous').map((a) => ({ ...a.position }));
      w.tick(TICK_INTERVAL);
      const after = state(w).actors.filter((a) => a.control === 'autonomous');
      outsideWalked += after.reduce((sum, a, i2) => sum + distanceBetween(before[i2]!, a.position), 0);
    }
    expect(outsideWalked).toBeGreaterThan(0);
    // Then 미로의 압력은 0 그대로다
    expect(mazeState(w).pressure).toBe(0);
    expect(mazeState(w).pattern).toBe(patternNames()[0]);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-009 미로의 상태는 저장된다', () => {
  /** 압력을 쌓고 패턴을 한 번 넘긴 미로 */
  function livedMaze(): WorldDriver {
    const w = inMaze();
    const first = mazeState(w).pattern;
    const entryCell = tagsAt(mazeTerrain(), entryAt().x, entryAt().z, CELL_LAYER)[0]!;
    const far = maxBy(cellSpots(entryCell), (s) => distanceBetween(s, entryAt()));
    walkUntil(w, [far, entryAt()], () => mazeState(w).pattern !== first);
    // 넘긴 뒤 조금 더 걸어 압력도 0 이 아니게 둔다 (둘 다 되살아나야 한다)
    expect(move(w, entryAt()).status).toBe('success');
    for (let i = 0; i < 30; i++) w.tick(TICK_INTERVAL);
    expect(mazeState(w).pressure).toBeGreaterThan(0);
    return w;
  }

  it('S-024 저장했다 되살려도 pattern 과 pressure 가 그대로다', () => {
    // Given 압력을 쌓고 패턴을 넘긴 세계
    const lived = livedMaze();
    const before = { ...mazeState(lived) };
    expect(before.pattern).not.toBe(patternNames()[0]);

    // When 파일을 지나 저장하고 되살린다
    const revived = wrap(createWorld({}, restoreWorld(throughFile(lived.world.snapshot()))!));
    revived.join(OBSERVER);
    revived.tick(0);

    // Then 셋 다 그대로다
    expect(mazeState(revived)).toEqual(before);
  });

  it('S-025 되살린 세계에서 같은 통로가 열려 있고 같은 통로가 실제로 막는다', () => {
    const lived = livedMaze();
    const revived = wrap(createWorld({}, restoreWorld(throughFile(lived.world.snapshot()))!));
    revived.join(OBSERVER);
    revived.tick(0);

    // Given 되살린 세계의 지금 패턴
    const pattern = mazeState(revived).pattern;
    // When 닫힌 통로로 가겠다고 한다 — 값만 보지 않고 실제로 움직여 본다
    const closed = passageSpots(closedOf(pattern))[0]!;
    const before = here(revived);
    expect(move(revived, closed)).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'passage-closed',
    });
    expect(here(revived)).toEqual(before);
    // Then 열린 통로로는 받아들여진다
    const open = passageSpots(openOf(pattern))[0]!;
    expect(move(revived, open).status).toBe('success');
    // 그리고 관찰 결과도 같은 것을 말한다
    expect(viewState(revived.observe().region)).toMatchObject({
      pattern,
      pressure: mazeState(revived).pressure,
      pressureLimit: mazeRule().pressureLimit,
    });
  });

  it('S-026 (경계) STATE_VERSION 이 올랐다 — C007 의 스냅샷은 복구되지 않는다', () => {
    // Given 저장되는 State 가 늘었다
    expect(STATE_VERSION).not.toBe('hkt-adv-proto-i/2');
    const saved = throughFile(inMaze().world.snapshot());
    expect(saved.version).toBe(STATE_VERSION);
    // Then 옛 판의 스냅샷은 복구하지 않는다 (마이그레이션 없음)
    expect(restoreWorld({ ...saved, version: 'hkt-adv-proto-i/2' })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-010 미로 밖은 그대로다', () => {
  it('S-027 백왕령의 이동 판정이 C006 · C007 과 한 글자도 다르지 않다', () => {
    // Given 백왕령의 컴파일 결과에서 급경사 한 자리와 물 한 자리
    const t = terrainOf(START_REGION_ID);
    const spots = gridSpots(START_REGION_ID);
    const steep = spots.find((p) => blockedReasonAt(t, p.x, p.z) === BLOCK_STEEP)!;
    const water = spots.find((p) => blockedReasonAt(t, p.x, p.z) === BLOCK_WATER)!;
    const open = spots.find((p) => isTraversableAt(t, p.x, p.z))!;
    const w = driveWorld(solo);

    // Then 사유가 C006 의 그것 그대로다 — passage-closed 는 여기에 오지 않는다
    expect(move(w, steep)).toEqual({ status: 'failure', rule: 'RULE-MOVE-001', reason: BLOCK_STEEP });
    expect(move(w, water)).toMatchObject({ status: 'failure', reason: BLOCK_WATER });
    expect(move(w, open).status).toBe('success');
    const { maxX } = spaceOf(START_REGION_ID).extent;
    expect(move(w, { x: maxX + 0.5, z: 0 })).toMatchObject({ reason: 'out-of-bounds' });
  });

  it('S-028 (경계) 미로 밖 방들에는 압력도 통로도 없다 — 규칙 State 를 가진 방은 규칙을 품은 방뿐이다', () => {
    const w = driveWorld(solo);
    const held = Object.entries(state(w).regionStates)
      .filter(([, held]) => held.rule)
      .map(([id]) => id);
    // C012 CHANGED — 방의 State 가 규칙과 원천을 **함께** 든다. 그래서 State 를 가진 방은
    // 늘었지만(원천을 낳는 방 넷이 더해졌다) **규칙 State(.rule)를 가진 방**은 그대로 미로 하나다.
    // 이 경계가 묻던 것은 후자다 — 규칙이 미로 밖으로 새지 않았는가.
    expect(held.sort()).toEqual(
      REGION_SPECS.filter((s) => s.rule).map((s) => s.id).sort(),
    );
    // 그리고 다른 방의 관찰 결과에는 미로의 State 가 실리지 않는다
    for (const id of [START_REGION_ID, FOREST_EDGE, FOREST_DEEP]) {
      const at = pointsOf(spaceOf(id), ANCHOR_LAYER)[0]!.position;
      const observed = standing(id, at).observe();
      expect({ region: id, state: viewState(observed.region) }).toEqual({ region: id, state: undefined });
      expect(JSON.stringify(observed)).not.toContain('pressureLimit');
    }
  });
});

// ── 회귀 — C001~C007 의 행동이 그대로인가 ─────────────────────
describe('회귀', () => {
  it('R-001 (C002 · C003) 걷기와 건너기가 산다 — 백왕령에서 숲 안쪽까지, 그리고 미로까지', () => {
    const w = driveWorld(solo);
    crossFrom(w, START_REGION_ID, FOREST_PATH, FOREST_PATH);
    expect(actorOf(w).regionId).toBe(FOREST_EDGE);
    crossFrom(w, FOREST_EDGE, DEEP_TRAIL, DEEP_TRAIL);
    expect(actorOf(w).regionId).toBe(FOREST_DEEP);
    crossFrom(w, FOREST_DEEP, ANCIENT_GATE, ANCIENT_GATE);
    expect(actorOf(w).regionId).toBe(FANTASY_MAZE);
  });

  it('R-002 (C003) 추락이 산다 — 요청 하나 없이 심장 호수에 선다', () => {
    // Given 거목 내부 세계의 FALL anchor 위
    const at = anchorAt('TREE_INNER_WORLD', 'FALL');
    const w = standing('TREE_INNER_WORLD', at);
    // When 한 Tick 이 흐른다
    w.tick(TICK_INTERVAL);
    // Then 세계가 묻지 않고 데려간다
    expect(actorOf(w).regionId).toBe('HEART_LAKE');
  });

  // C011 CHANGED — 광맥이 방의 원천이 되었다. 재는 것은 그대로다
  it('R-003 채취가 산다 — 곡괭이를 들고 원천 곁에 서면 캘 수 있다', () => {
    const w = driveWorld({ ...solo, actorRegion: 'FOREST_EDGE', actorPosition: { x: -8, z: 5 } });
    expect(w.dispatch({ interactionId: 'mine', targetEntityId: 'MOLT_LITTER' })).toEqual({
      status: 'success',
      rule: 'RULE-MINE-001',
    });
  });

  it('R-004 전투가 산다 — 기본 스킬을 걸 수 있고 그 대가가 실린다', () => {
    const w = driveWorld(solo);
    expect(w.dispatch({ interactionId: 'attack' })).toMatchObject({ status: 'success' });
    const swing = w.observe().entities.find((e) => e.id === PLAYER);
    expect(swing?.state).toBe('attack');
  });

  it('R-005 건너기의 사유 코드가 하나도 늘거나 줄지 않았다', () => {
    const w = driveWorld(solo);
    // 모르는 길
    expect(w.dispatch({ interactionId: 'transit', targetEntityId: 'NO_SUCH' })).toMatchObject({
      reason: 'unknown-connector',
    });
    // 여기서 갈 수 있는 길이 아니다
    expect(w.dispatch({ interactionId: 'transit', targetEntityId: DEEP_TRAIL })).toMatchObject({
      reason: 'wrong-region',
    });
    // 멀다
    expect(w.dispatch({ interactionId: 'transit', targetEntityId: FOREST_PATH })).toMatchObject({
      reason: 'out-of-range',
    });
    // 아직 짓지 않은 곳 (미로는 지어졌지만 붉은 황야는 그대로다)
    walkTo(w, anchorAt(START_REGION_ID, RED_WASTE_PASS));
    expect(w.dispatch({ interactionId: 'transit', targetEntityId: RED_WASTE_PASS })).toMatchObject({
      reason: 'region-not-built',
    });
  });

  it('R-006 (C006 SPEC-010) 땅은 여전히 저장되지 않는다 — 미로의 격자도 스냅샷에 실리지 않는다', () => {
    const w = inMaze();
    const saved = JSON.parse(JSON.stringify(w.world.snapshot()));
    const forbidden = ['traversable', 'blocked', 'blockedTags', 'surface', 'surfaceTags', 'chunks', 'terrain'];
    const found: string[] = [];
    let longestArray = 0;
    const walk = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        longestArray = Math.max(longestArray, value.length);
        value.forEach((item, i) => walk(item, `${path}[${i}]`));
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
          if (forbidden.includes(key)) found.push(`${path}.${key}`);
          walk(item, `${path}.${key}`);
        }
      }
    };
    walk(saved.state, 'state');
    walk(JSON.parse(JSON.stringify(w.observe())), 'view');
    expect(found).toEqual([]);
    expect(longestArray).toBeLessThan(mazeTerrain().height.length);
    // 패턴 표도 투영하지 않는다 — 관찰자가 자기 데이터의 같은 표를 읽는다
    const projected = JSON.stringify(w.observe());
    for (const tag of passageTags()) {
      expect({ tag, leaked: projected.includes(`"${tag}"`) }).toEqual({ tag, leaked: false });
    }
  });

  it('R-007 팩 State 는 여전히 plain JSON 이다 — Region State 가 늘어도 Map · Set · 함수가 없다', () => {
    const w = inMaze();
    for (let i = 0; i < 5; i++) w.tick(TICK_INTERVAL);
    const offenders: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (value === null || typeof value !== 'object') {
        if (typeof value === 'function') offenders.push(path);
        return;
      }
      if (value instanceof Map || value instanceof Set) {
        offenders.push(`${path} (${value.constructor.name})`);
        return;
      }
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
    };
    walk(w.world.snapshot().state, 'state');
    expect(offenders).toEqual([]);
  });
});
