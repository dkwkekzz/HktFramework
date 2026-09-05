// C010 — 세계는 하나다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-009)
//
// 이 Cycle 은 **증명 Cycle** 이다. 새 규칙도 새 방도 새 문도 짓지 않는다 —
// 앞의 아홉 Cycle 이 "세계에 하나" 라고 적어 둔 것이 **관찰자가 둘일 때도 참인가**를 잰다.
// 그래서 여기서 재는 것은 언제나 인과가 **사람을 건너간다**는 사실이다:
//   ① 한쪽만 걷는데 둘의 압력이 같이 오르는가 (규칙은 몸을 셀 뿐 사람을 세지 않는가)
//   ② 남의 걸음이 내 통로를 바꾸고 내 문을 닫는가 (조건이 읽는 것은 방의 State 이지 사람이 아닌가)
//   ③ 떠나도 방의 State 가 한 값도 안 바뀌는가 (방의 State 가 관찰자에게 매여 있지 않은가)
//   ④ 새로 들어온 사람이 보는 것이 처음이 아니라 지금의 미로인가
//   ⑤ 그러는 동안 State 도 Protocol 형도 STATE_VERSION 도 하나도 늘지 않았는가
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 구현(content/world/index.ts 에 더해지는 배치 손잡이)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C010-one-world/spec.md 와 앞 Cycle 이 동결한 이름들뿐이다.
//
// **좌표를 손으로 적지 않는다** — 자리는 언제나 Description 의 anchor · area 와 컴파일 결과의
// 격자에서 골라 쓴다. 임계(P)도 걸음값(k)도 그 방의 규칙 데이터에서 읽는다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 재려는 것의 존재와 행동만 본다.

import { describe, expect, it } from 'vitest';
import {
  areasOf,
  pointsOf,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { blockedReasonAt, isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  ANCHOR_LAYER,
  BLOCK_STEEP,
  BLOCK_WATER,
  COMPILE_RULES,
  REGION_SPECS,
  START_REGION_ID,
  regionSpec,
} from '../../regions';
// C008 이 세운 미로의 이름들 — 그 파일이 소유한다 (c008 · c009 시나리오의 선례 그대로).
import { CELL_LAYER, FANTASY_MAZE, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import { codeText } from '../../view/code-text';
import type { ActionResult } from '../../protocol/actions';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import type {
  EntityView,
  GameViewSnapshot,
  InteractionView,
  RegionView,
} from '../../protocol/gameview';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

// ── 앞 Cycle 이 동결한 이름들 ─────────────────────────────────
const MAZE_HEART = 'MAZE_HEART';
const MAZE_HEART_GATE = 'MAZE_HEART_GATE';
/** 미로의 anchor 둘 — 입구(구역 A) · 심장 쪽 문 */
const ANCIENT_GATE = 'ANCIENT_GATE';
const HEART_GATE = 'HEART_GATE';
/** 심장 쪽 문을 여는 패턴 하나 (C009 확정 2) */
const OPENING_PATTERN = 'P2';
/** 사유 코드 — 잠긴 문 · 닫힌 통로 */
const CONNECTOR_INACTIVE = 'connector-inactive';
const PASSAGE_CLOSED = 'passage-closed';
const REGION_NOT_BUILT = 'region-not-built';

const FOREST_EDGE = 'FOREST_EDGE';
const FOREST_DEEP = 'FOREST_DEEP';
const FOREST_PATH = 'FOREST_PATH';
const DEEP_TRAIL = 'DEEP_TRAIL';
const RED_WASTE_PASS = 'RED_WASTE_PASS';

/** 세 번째 관찰자 — 이름은 세계가 따지지 않는다 (RULE-OBSERVER-JOIN-001) */
const OBSERVER_3 = 'observer-3';

const solo: WorldSetup = { npcs: [] };

// ── 하네스 (c008 · c009 의 선례 그대로) ───────────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id = PLAYER) => state(w).actors.find((a) => a.id === id)!;
const here = (w: WorldDriver, id = PLAYER): XZ => ({
  x: actorOf(w, id).position.x,
  z: actorOf(w, id).position.z,
});
/** 그 관찰자의 몸 — 세계가 정해 준 것을 관찰 결과에서 읽는다 (손으로 적지 않는다) */
const bodyOf = (w: WorldDriver, observerId: string): string =>
  w.observe(observerId).observer.characterId;

const move = (w: WorldDriver, at: XZ, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } }, observerId);
const cross = (w: WorldDriver, connector: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector }, observerId);
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

const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);
const distanceBetween = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);

// ── 미로의 데이터를 읽는 자리 (C008 이 세운 것) ────────────────
const mazeSpace = () => spaceOf(FANTASY_MAZE);
const mazeRule = () => regionSpec(FANTASY_MAZE)!.rule!;
const mazeTerrain = () => terrainOf(FANTASY_MAZE);
const entryAt = (): XZ => anchorAt(FANTASY_MAZE, ANCIENT_GATE);
const gateAt = (): XZ => anchorAt(FANTASY_MAZE, HEART_GATE);

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

/** 미로 안에서 어느 통로에도 들지 않는 구역 안의 자리들 — 어느 패턴에서도 막히지 않는다 */
function cellSpots(cell?: string): XZ[] {
  const t = mazeTerrain();
  return gridSpots(FANTASY_MAZE).filter((p) => {
    if (!isTraversableAt(t, p.x, p.z)) return false;
    if (tagsAt(t, p.x, p.z, PASSAGE_LAYER).length > 0) return false;
    const cells = tagsAt(t, p.x, p.z, CELL_LAYER);
    return cells.length > 0 && (cell === undefined || cells.includes(cell));
  });
}
/** 걸린 통로가 전부 allowed 안인 자리들 — 겹친 자리를 섞지 않는다 */
function passageSpots(allowed: readonly string[]): XZ[] {
  const t = mazeTerrain();
  return gridSpots(FANTASY_MAZE).filter((p) => {
    if (!isTraversableAt(t, p.x, p.z)) return false;
    const tags = tagsAt(t, p.x, p.z, PASSAGE_LAYER);
    return tags.length > 0 && tags.every((tag) => allowed.includes(tag));
  });
}
const cellOf = (at: XZ): string => tagsAt(mazeTerrain(), at.x, at.z, CELL_LAYER)[0]!;
const passagesAt = (at: XZ): string[] => tagsAt(mazeTerrain(), at.x, at.z, PASSAGE_LAYER);

const regionStateOf = (w: WorldDriver, id: string) => state(w).regionStates[id];
const mazeState = (w: WorldDriver) => {
  const s = regionStateOf(w, FANTASY_MAZE);
  if (!s) throw new Error('미로에 Region State 가 없다');
  return s;
};

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ─────────
const viewState = (r: RegionView) => r.state;
const entityOf = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  v.entities.find((e) => e.id === id);
const exitOf = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  v.entities.find((e) => e.role === 'region-exit' && e.id === id);
const othersIn = (v: GameViewSnapshot): EntityView[] =>
  v.entities.filter((e) => e.role === 'other-player-character');
const transitTo = (v: GameViewSnapshot, connector: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'transit' && i.targetEntityId === connector);
const hudValue = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
const presentIn = (v: GameViewSnapshot) => hudValue(v, 'observers.present');

// ── 걷기 (c008 의 선례 그대로 · 관찰자를 밝힌다) ───────────────
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

/** 자리 둘을 오가며 걷는다 — 멈춤 조건이 참이 될 때까지 (요청은 도착할 때마다 다시 낸다) */
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

/** 하던 걸음이 끝날 때까지 — 떠나기 전에 몸을 세워 두기 위한 것 */
function settle(w: WorldDriver, observerId = OBSERVER, limitTicks = 20000) {
  const body = bodyOf(w, observerId);
  for (let i = 0; i < limitTicks; i++) {
    if (actorOf(w, body).currentAction.kind === 'idle') return;
    w.tick(TICK_INTERVAL);
  }
  throw new Error('걸음이 끝나지 않는다');
}

/** 백왕령에서 걸어서 미로까지 — 이 Play 가 시작하는 길 그대로 */
function walkIntoMaze(w: WorldDriver, observerId = OBSERVER) {
  const body = bodyOf(w, observerId);
  for (const [region, tag, connector] of [
    [START_REGION_ID, FOREST_PATH, FOREST_PATH],
    [FOREST_EDGE, DEEP_TRAIL, DEEP_TRAIL],
    [FOREST_DEEP, ANCIENT_GATE, ANCIENT_GATE],
  ] as const) {
    expect(actorOf(w, body).regionId).toBe(region);
    walkTo(w, anchorAt(region, tag), observerId);
    expect(cross(w, connector, observerId)).toMatchObject({ status: 'success' });
  }
  expect(actorOf(w, body).regionId).toBe(FANTASY_MAZE);
}

// ── 이미 무언가 겪은 세계를 짓는 하네스 (c008 의 선례 그대로) ──
//
// "관찰자 둘이 미로 안 각자의 자리에 선 세계" 는 걸어서도 만들 수 있지만, 걷는 동안
// 압력이 쌓여 Given 이 흐려진다. 그래서 저장·복구라는 공개 길로 그런 세계를 세운다 —
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

/** 파일을 지나는 저장 — server/world-store.ts 가 하는 일 그대로 */
const throughFile = (snapshot: WorldSnapshot): WorldSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;

function worldFrom(
  base: WorldDriver,
  edit: (s: WorldState) => void,
  observers: readonly string[] = [OBSERVER, OBSERVER_2],
): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  edit(restored);
  const world = createWorld({}, restored);
  for (const observerId of observers) world.join(observerId);
  world.tick(0);
  return wrap(world);
}

/** 저장했다 되살린 세계 — 관찰자 둘이 다시 이어진다 */
function reviveTwo(base: WorldDriver): WorldDriver {
  const revived = wrap(createWorld({}, restoreWorld(throughFile(base.world.snapshot()))!));
  revived.join(OBSERVER);
  revived.join(OBSERVER_2);
  revived.tick(0);
  return revived;
}

/** 그 몸을 그 방 그 자리에 세운다 (관성도 하던 행동도 없이) */
function place(s: WorldState, id: string, region: string, at: XZ) {
  const a = s.actors.find((x: ActorState) => x.id === id)!;
  a.regionId = region;
  a.position = { x: at.x, z: at.z };
  a.velocity = { x: 0, z: 0 };
  a.currentAction = idleAction();
}

/** 관찰자 둘이 미로 안 각자의 자리에 선 세계 (압력 0 · 패턴은 처음) */
function twoInMaze(
  atA: XZ,
  atB: XZ,
  edit?: (s: WorldState) => void,
  setup: WorldSetup = solo,
): WorldDriver {
  const base = driveWorld({
    ...setup,
    actorRegion: FANTASY_MAZE,
    actorPosition: { x: atA.x, z: atA.z },
  });
  base.join(OBSERVER_2);
  base.tick(0);
  return worldFrom(base, (s) => {
    place(s, PLAYER, FANTASY_MAZE, atA);
    place(s, PLAYER_2, FANTASY_MAZE, atB);
    s.regionStates[FANTASY_MAZE]!.pressure = 0;
    edit?.(s);
  });
}

/** A 는 미로 안, B 는 백왕령에 — 둘이 다른 방에 있는 세계 */
function acrossRooms(): { w: WorldDriver; atA: XZ; atB: XZ } {
  const atA = entryAt();
  const t = terrainOf(START_REGION_ID);
  const atB = gridSpots(START_REGION_ID).find((p) => isTraversableAt(t, p.x, p.z))!;
  const base = driveWorld({ ...solo, actorRegion: FANTASY_MAZE, actorPosition: atA });
  base.join(OBSERVER_2);
  base.tick(0);
  const w = worldFrom(base, (s) => {
    place(s, PLAYER, FANTASY_MAZE, atA);
    place(s, PLAYER_2, START_REGION_ID, atB);
    s.regionStates[FANTASY_MAZE]!.pressure = 0;
  });
  return { w, atA, atB };
}

// ── A 가 걷는 자리 · B 가 서 있는 자리 (자리는 데이터가 고른다) ─
/** A 가 오가며 걷는 구역 — 입구가 든 구역이다 (통로에 들지 않으므로 어느 패턴에서도 막히지 않는다) */
const walkPath = (): XZ[] => {
  const from = entryAt();
  return [maxBy(cellSpots(cellOf(from)), (s) => distanceBetween(s, from)), from];
};
/** B 가 서 있는 자리 — A 가 걷는 구역이 아닌 다른 구역, A 에게서 가장 먼 자리 */
const standSpot = (): XZ => {
  const other = cellTags().find((t) => t !== cellOf(entryAt()))!;
  return maxBy(cellSpots(other), (s) => distanceBetween(s, entryAt()));
};

/** A 가 걸어서 패턴을 한 칸 넘긴다 (B 는 아무것도 하지 않는다) */
function flipByA(w: WorldDriver) {
  const now = mazeState(w).pattern;
  walkUntil(w, walkPath(), () => mazeState(w).pattern !== now, OBSERVER);
}

// ─────────────────────────────────────────────────────────────
describe('SPEC-001 미로는 하나다', () => {
  it('S-001 둘이 같은 미로에 서면 pattern · pressure · pressureLimit 이 같은 tick 에 같다', () => {
    // Given 관찰자 둘이 미로 안 서로 다른 자리에 선다
    const w = twoInMaze(entryAt(), standSpot());
    expect(actorOf(w, PLAYER).regionId).toBe(FANTASY_MAZE);
    expect(actorOf(w, PLAYER_2).regionId).toBe(FANTASY_MAZE);

    // Then 같은 tick 의 두 관찰 결과가 같은 값을 싣는다
    const same = () => {
      const a = viewState(w.observe(OBSERVER).region);
      const b = viewState(w.observe(OBSERVER_2).region);
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      expect({
        pattern: a!.pattern,
        pressure: a!.pressure,
        pressureLimit: a!.pressureLimit,
      }).toEqual({
        pattern: b!.pattern,
        pressure: b!.pressure,
        pressureLimit: b!.pressureLimit,
      });
      // 그리고 그것은 세계가 든 하나의 State 다
      expect(a!.pattern).toBe(mazeState(w).pattern);
      expect(a!.pressure).toBe(mazeState(w).pressure);
      expect(a!.pressureLimit).toBe(mazeRule().pressureLimit);
    };
    same();

    // When A 가 걸어 압력이 오른다
    walkTo(w, walkPath()[0]!, OBSERVER);
    expect(mazeState(w).pressure).toBeGreaterThan(0);
    // Then 여전히 같다 — 값이 하나이므로 갈릴 자리가 없다
    same();

    // 통로의 열림/닫힘을 정하는 값이 하나이므로 둘이 보는 길도 하나다 —
    // 지금 닫힌 통로는 둘 모두에게 같은 사유로 막힌다
    const closed = passageSpots(closedOf(mazeState(w).pattern))[0]!;
    expect(move(w, closed, OBSERVER)).toMatchObject({ status: 'failure', reason: PASSAGE_CLOSED });
    expect(move(w, closed, OBSERVER_2)).toMatchObject({ status: 'failure', reason: PASSAGE_CLOSED });
    // 그리고 지금 열린 통로는 둘 모두에게 열려 있다
    const open = passageSpots(openOf(mazeState(w).pattern))[0]!;
    expect(move(w, open, OBSERVER).status).toBe('success');
    expect(move(w, open, OBSERVER_2).status).toBe('success');
  });

  it('S-002 (경계) 둘이 다른 방에 있으면 각자 자기 방의 것만 실린다 — 다른 방의 몸도 실리지 않는다', () => {
    // Given A 는 미로 안, B 는 백왕령
    const { w } = acrossRooms();
    const va = w.observe(OBSERVER);
    const vb = w.observe(OBSERVER_2);

    // Then 미로의 관찰 결과에는 그 방의 State 가 있고
    expect(viewState(va.region)).toMatchObject({
      pattern: mazeState(w).pattern,
      pressure: mazeState(w).pressure,
      pressureLimit: mazeRule().pressureLimit,
    });
    // 미로 밖의 방에는 그 자리가 아예 없다 (없는 것을 0 으로 지어내지 않는다)
    expect(vb.region.id).toBe(START_REGION_ID);
    expect(viewState(vb.region)).toBeUndefined();
    expect(JSON.stringify(vb)).not.toContain('pressureLimit');

    // 그리고 다른 방의 몸은 실리지 않는다 — 관찰은 방으로 잘린다
    expect(entityOf(va, PLAYER_2)).toBeUndefined();
    expect(entityOf(vb, PLAYER)).toBeUndefined();
    expect(othersIn(va)).toEqual([]);
    expect(othersIn(vb)).toEqual([]);
    // 함께 있는 사람의 수는 세계의 사실이므로 둘 다 둘이다
    expect(presentIn(va)).toBe(2);
    expect(presentIn(vb)).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-002 한쪽의 걸음이 다른 쪽의 압력이다', () => {
  it('S-003 A 만 거리 d 를 걷는데 둘 다 압력이 d × k 만큼 오른 것을 본다 — B 의 몸은 한 걸음도 안 움직였다', () => {
    // Given 미로 안의 관찰자 둘, 압력은 0 이다
    const w = twoInMaze(entryAt(), standSpot());
    expect(mazeState(w)).toMatchObject({ pressure: 0, pattern: patternNames()[0] });
    const bBefore = here(w, PLAYER_2);
    const target = walkPath()[0]!;
    // 임계를 넘지 않을 만큼의 거리다 (넘으면 압력이 0 으로 돌아가 d × k 를 잴 수 없다)
    expect(distanceBetween(target, entryAt())).toBeLessThan(mazeRule().pressureLimit);

    // When A 만 걷는다 — 실제로 옮겨진 거리를 tick 마다 더한다. B 는 아무 요청도 하지 않는다
    expect(move(w, target, OBSERVER).status).toBe('success');
    let walkedA = 0;
    let walkedB = 0;
    for (let i = 0; i < 20000; i++) {
      const beforeA = here(w, PLAYER);
      const beforeB = here(w, PLAYER_2);
      w.tick(TICK_INTERVAL);
      walkedA += distanceBetween(beforeA, here(w, PLAYER));
      walkedB += distanceBetween(beforeB, here(w, PLAYER_2));
      if (actorOf(w, PLAYER).currentAction.kind !== 'move') break;
    }
    expect(walkedA).toBeGreaterThan(0);

    // Then B 의 몸은 한 걸음도 움직이지 않았다
    expect(walkedB).toBe(0);
    expect(here(w, PLAYER_2)).toEqual(bBefore);
    expect(actorOf(w, PLAYER_2).movedThisTick).toBe(0);

    // 그런데 압력은 A 가 걸은 거리 × k 만큼 올랐고
    const risen = walkedA * mazeRule().pressurePerDistance;
    expect(mazeState(w).pressure).toBeCloseTo(risen, 6);
    // **둘 다** 그것을 본다 — 서 있는 사람의 화면에도 같은 숫자다
    expect(viewState(w.observe(OBSERVER_2).region)!.pressure).toBeCloseTo(risen, 6);
    expect(viewState(w.observe(OBSERVER).region)!.pressure).toBe(
      viewState(w.observe(OBSERVER_2).region)!.pressure,
    );
  });

  it('S-004 (경계) 미로 밖의 관찰자가 아무리 걸어도 미로의 압력은 오르지 않는다', () => {
    // Given A 는 미로 안에 서 있고 B 는 백왕령에 있다
    const { w, atB } = acrossRooms();
    const before = { ...mazeState(w) };
    expect(before.pressure).toBe(0);

    // When B 가 백왕령에서 한참 걷는다 (걸을 자리는 그 방의 땅이 정한다)
    const t = terrainOf(START_REGION_ID);
    const target = maxBy(
      gridSpots(START_REGION_ID).filter((p) => isTraversableAt(t, p.x, p.z)),
      (p) => distanceBetween(p, atB),
    );
    expect(distanceBetween(target, atB)).toBeGreaterThan(5);
    walkTo(w, target, OBSERVER_2);
    expect(distanceBetween(here(w, PLAYER_2), atB)).toBeGreaterThan(1);

    // Then 미로의 State 는 한 값도 바뀌지 않았다 — 규칙의 Scope 는 **그 방 안의** 몸이다
    expect(mazeState(w)).toEqual(before);
    expect(viewState(w.observe(OBSERVER).region)!.pressure).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-003 남이 내 길을 바꾼다', () => {
  it('S-005 A 의 걸음이 임계를 넘기면 B 의 관찰 결과에서도 열린 통로가 바뀐다 — B 는 아무 요청도 안 했다', () => {
    // Given 관찰자 둘, 압력은 임계 바로 아래다 (넘기는 것은 A 의 몇 걸음이다)
    const first = patternNames()[0]!;
    const w = twoInMaze(entryAt(), standSpot(), (s) => {
      s.regionStates[FANTASY_MAZE]!.pressure = mazeRule().pressureLimit - 0.5;
    });
    expect(mazeState(w).pattern).toBe(first);

    // 지금은 닫혀 있지만 다음 패턴에서 열리는 통로 하나, 지금 열려 있지만 닫히는 통로 하나
    const willOpen = closedOf(first).find((t) => openOf(nextOf(first)).includes(t))!;
    const willClose = openOf(first).find((t) => closedOf(nextOf(first)).includes(t))!;
    expect({ willOpen, willClose }).toEqual({ willOpen: expect.any(String), willClose: expect.any(String) });
    const opening = passageSpots([willOpen])[0]!;
    const closing = passageSpots([willClose])[0]!;

    // 지금 B 에게 그 둘은 이렇게 판정된다 — 닫힌 쪽은 거절, 열린 쪽은 열려 있다
    const bBefore = here(w, PLAYER_2);
    expect(move(w, opening, OBSERVER_2)).toMatchObject({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: PASSAGE_CLOSED,
    });
    expect(viewState(w.observe(OBSERVER_2).region)!.pattern).toBe(first);

    // When A 만 걸어 임계를 넘긴다 (B 는 한 번도 요청하지 않는다)
    flipByA(w);

    // Then 패턴이 한 칸 넘어갔고 **B 의 관찰 결과에서도** 그렇다
    expect(mazeState(w).pattern).toBe(nextOf(first));
    expect(viewState(w.observe(OBSERVER_2).region)!.pattern).toBe(nextOf(first));
    expect(viewState(w.observe(OBSERVER).region)!.pattern).toBe(nextOf(first));
    // B 의 몸은 그대로다 — 자기는 아무것도 하지 않았다
    expect(here(w, PLAYER_2)).toEqual(bBefore);

    // 그리고 B 의 길이 실제로 바뀌었다 — 열려 있던 통로가 이제 막고
    expect(move(w, closing, OBSERVER_2)).toMatchObject({
      status: 'failure',
      reason: PASSAGE_CLOSED,
    });
    // 막혀 있던 통로가 이제 받아들여진다
    expect(move(w, opening, OBSERVER_2).status).toBe('success');
  });

  it('S-006 (경계) 재배열로 B 의 발밑이 닫힌 통로가 되어도 몸은 밀려나지 않는다 — 나가는 요청은 받아들여진다', () => {
    // Given 지금은 열려 있지만 다음 패턴에서 닫히는 통로 하나, 그 안에 선 B
    const first = patternNames()[0]!;
    const willClose = openOf(first).find((t) => closedOf(nextOf(first)).includes(t))!;
    const inside = passageSpots([willClose]);
    expect(inside.length).toBeGreaterThan(0);
    const bAt = inside[0]!;
    const w = twoInMaze(entryAt(), bAt, (s) => {
      s.regionStates[FANTASY_MAZE]!.pressure = mazeRule().pressureLimit - 0.5;
    });
    expect(passagesAt(here(w, PLAYER_2))).toContain(willClose);

    // When A 의 걸음이 임계를 넘겨 통로가 재배열된다
    flipByA(w);
    expect(mazeState(w).pattern).toBe(nextOf(first));

    // Then B 는 이제 **닫힌** 통로 안에 서 있는데 몸은 밀려나지 않았다
    expect(closedOf(mazeState(w).pattern)).toContain(willClose);
    expect(here(w, PLAYER_2)).toEqual({ x: bAt.x, z: bAt.z });
    // 거기서 열린 자리로 나가는 요청은 받아들여진다 (판정은 목표 자리만 본다)
    const out = maxBy(cellSpots(), (s) => -distanceBetween(s, bAt));
    expect(move(w, out, OBSERVER_2).status).toBe('success');
    // 다른 닫힌 통로로 가는 것은 여전히 거절된다
    const stillClosed = passageSpots(closedOf(mazeState(w).pattern))[0]!;
    expect(move(w, stillClosed, OBSERVER_2)).toMatchObject({
      status: 'failure',
      reason: PASSAGE_CLOSED,
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-004 남이 내 문을 닫는다', () => {
  /** 패턴이 P2 이고 B 가 심장 쪽 문 곁에 선 세계 — 압력은 임계 바로 아래다 */
  function gateWorld(): WorldDriver {
    const w = twoInMaze(entryAt(), gateAt(), (s) => {
      s.regionStates[FANTASY_MAZE]!.pattern = OPENING_PATTERN;
      s.regionStates[FANTASY_MAZE]!.pressure = mazeRule().pressureLimit - 0.5;
    });
    expect(mazeState(w).pattern).toBe(OPENING_PATTERN);
    return w;
  }

  it('S-007 A 의 걸음이 넘기면 B 의 문 표식이 열림에서 잠김이 되고 건너기가 거절된다 — B 는 자리를 안 옮겼다', () => {
    // Given 패턴이 P2 라 심장 쪽 문이 열려 있고, B 가 그 문 곁에 서 있다
    const w = gateWorld();
    const bBefore = here(w, PLAYER_2);
    expect(bBefore).toEqual({ x: gateAt().x, z: gateAt().z });
    const before = w.observe(OBSERVER_2);
    expect(exitOf(before, MAZE_HEART_GATE)).toMatchObject({ state: 'open' });
    expect(transitTo(before, MAZE_HEART_GATE)).toMatchObject({ available: true });
    expect(transitTo(before, MAZE_HEART_GATE)!.reason).toBeUndefined();

    // When A 만 걸어 임계를 넘긴다 (B 는 문 곁에 서 있기만 한다)
    flipByA(w);
    expect(mazeState(w).pattern).toBe(nextOf(OPENING_PATTERN));

    // Then B 의 관찰 결과에서 그 문의 표식이 잠김이다
    const after = w.observe(OBSERVER_2);
    expect(exitOf(after, MAZE_HEART_GATE)).toMatchObject({ state: 'locked' });
    expect(transitTo(after, MAZE_HEART_GATE)).toMatchObject({
      available: false,
      reason: CONNECTOR_INACTIVE,
    });
    // 그리고 건너기 요청이 connector-inactive 로 거절된다
    expect(cross(w, MAZE_HEART_GATE, OBSERVER_2)).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: CONNECTOR_INACTIVE,
    });
    // B 는 자리를 옮기지 않았다 — 자기는 아무것도 하지 않았다
    expect(here(w, PLAYER_2)).toEqual(bBefore);
    expect(actorOf(w, PLAYER_2).regionId).toBe(FANTASY_MAZE);
    expect(codeText(CONNECTOR_INACTIVE)).toBe('잠겨 있다');
  });

  it('S-008 (경계) A 가 두 번 더 넘기면 P2 가 돌아오고 B 의 문도 다시 열린다 — 순환은 셋이다', () => {
    // Given 문이 잠긴 자리에서 시작한다 (A 가 한 번 넘긴 뒤)
    const w = gateWorld();
    const bBefore = here(w, PLAYER_2);
    flipByA(w);
    expect(exitOf(w.observe(OBSERVER_2), MAZE_HEART_GATE)).toMatchObject({ state: 'locked' });

    // When A 가 두 번 더 넘긴다
    const seen: string[] = [mazeState(w).pattern];
    for (let n = 0; n < 2; n++) {
      flipByA(w);
      seen.push(mazeState(w).pattern);
    }

    // Then 순환이 셋이므로 패턴은 P2 로 돌아왔고
    expect(seen).toEqual([nextOf(OPENING_PATTERN), nextOf(nextOf(OPENING_PATTERN)), OPENING_PATTERN]);
    expect(mazeState(w).pattern).toBe(OPENING_PATTERN);
    // B 의 문도 다시 열렸다 — B 는 그 자리에 서 있기만 했다
    const v = w.observe(OBSERVER_2);
    expect(exitOf(v, MAZE_HEART_GATE)).toMatchObject({ state: 'open' });
    expect(transitTo(v, MAZE_HEART_GATE)).toMatchObject({ available: true });
    expect(here(w, PLAYER_2)).toEqual(bBefore);
    // 그리고 그 자리에서 건너면 심장이다
    expect(cross(w, MAZE_HEART_GATE, OBSERVER_2)).toMatchObject({ status: 'success' });
    expect(actorOf(w, PLAYER_2).regionId).toBe(MAZE_HEART);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-005 떠나도 남는다', () => {
  /** A 가 압력을 쌓고 패턴을 한 번 넘긴 뒤 걸음을 멈춘 세계 */
  function livedWorld(): WorldDriver {
    const w = twoInMaze(entryAt(), standSpot(), (s) => {
      s.regionStates[FANTASY_MAZE]!.pressure = mazeRule().pressureLimit - 0.5;
    });
    flipByA(w);
    settle(w, OBSERVER); // 하던 걸음을 끝내고 선다 — 떠난 뒤에도 이어지지 않도록
    expect(mazeState(w).pressure).toBeGreaterThan(0);
    expect(mazeState(w).rearrangedAt).toBeDefined();
    return w;
  }

  it('S-009 A 가 떠나도 pattern · pressure · rearrangedAt 이 한 값도 안 바뀐다 — 몸은 남고 사람 수는 준다', () => {
    // Given 압력을 쌓은 A 와 함께 있는 B
    const w = livedWorld();
    const before = { ...mazeState(w) };
    const aAt = here(w, PLAYER);
    expect(presentIn(w.observe(OBSERVER_2))).toBe(2);
    expect(entityOf(w.observe(OBSERVER_2), PLAYER)).toMatchObject({
      role: 'other-player-character',
      attended: true,
    });

    // When A 가 세계를 떠난다
    w.leave(OBSERVER);
    w.tick(0);

    // Then 그 방의 State 는 한 값도 바뀌지 않았다 — 방의 State 는 관찰자에게 매여 있지 않다
    expect(mazeState(w)).toEqual(before);
    expect(viewState(w.observe(OBSERVER_2).region)).toMatchObject({
      pattern: before.pattern,
      pressure: before.pressure,
      rearrangedAt: before.rearrangedAt,
    });
    // A 의 몸은 미로에 남아 있고 조종하는 이가 없다는 사실이 B 에게 보인다
    expect(actorOf(w, PLAYER).regionId).toBe(FANTASY_MAZE);
    expect(here(w, PLAYER)).toEqual(aAt);
    expect(entityOf(w.observe(OBSERVER_2), PLAYER)).toMatchObject({ attended: false });
    // 함께 있는 사람의 수는 준다
    expect(presentIn(w.observe(OBSERVER_2))).toBe(1);
  });

  it('S-010 (경계) 남은 몸은 걷지 않으므로 압력을 더하지 않는다 — 세계는 계속 도는데 그 몸은 서 있다', () => {
    // Given A 가 떠난 세계
    const w = livedWorld();
    w.leave(OBSERVER);
    w.tick(0);
    const before = { ...mazeState(w) };
    const aAt = here(w, PLAYER);
    const timeBefore = state(w).time;

    // When 세계가 한참 돈다 (B 도 아무것도 요청하지 않는다)
    for (let i = 0; i < 600; i++) w.tick(TICK_INTERVAL);

    // Then 세계는 계속 돌았는데
    expect(state(w).time).toBeGreaterThan(timeBefore);
    // 남은 몸은 한 걸음도 걷지 않았고
    expect(here(w, PLAYER)).toEqual(aAt);
    expect(actorOf(w, PLAYER).movedThisTick).toBe(0);
    // 압력도 패턴도 그대로다 — 압력을 올리는 것은 걸음이지 몸의 존재가 아니다
    expect(mazeState(w)).toEqual(before);
    expect(viewState(w.observe(OBSERVER_2).region)!.pressure).toBe(before.pressure);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-006 다시 들어와도 같은 미로다', () => {
  /** A 가 압력을 쌓고 패턴을 넘긴 뒤 떠난 세계 (B 는 남아 있다) */
  function afterLeaving(): WorldDriver {
    const w = twoInMaze(entryAt(), standSpot(), (s) => {
      s.regionStates[FANTASY_MAZE]!.pressure = mazeRule().pressureLimit - 0.5;
    });
    flipByA(w);
    settle(w, OBSERVER);
    w.leave(OBSERVER);
    w.tick(0);
    return w;
  }

  it('S-011 새 관찰자 C 가 미로에 닿으면 처음이 아니라 지금의 미로를 본다 — B 가 보는 값과 같다', () => {
    // Given A 가 쌓아 두고 떠난 미로 (패턴은 처음이 아니고 압력도 0 이 아니다)
    const w = afterLeaving();
    const rolled = { ...mazeState(w) };
    expect(rolled.pattern).not.toBe(patternNames()[0]);
    expect(rolled.pressure).toBeGreaterThan(0);

    // When 새 관찰자 C 가 들어와 걸어서 미로까지 간다
    w.join(OBSERVER_3);
    w.tick(0);
    walkIntoMaze(w, OBSERVER_3);

    // Then C 가 보는 pattern · pressure 는 세계가 굴려 온 그 값이다 — 처음으로 되돌아가지 않았다
    const seen = viewState(w.observe(OBSERVER_3).region)!;
    expect(seen.pattern).toBe(rolled.pattern);
    expect(seen.pattern).not.toBe(patternNames()[0]);
    expect(seen.pressure).toBe(mazeState(w).pressure);
    // 그 값은 A 가 남기고 간 값 그대로다 — 들어오는 것은 걸음이 아니므로 압력을 더하지 않는다
    expect(seen.pressure).toBe(rolled.pressure);
    expect(seen.pressure).toBeGreaterThan(0);
    // 그리고 그것은 B 가 보는 값과 같다
    const bSeen = viewState(w.observe(OBSERVER_2).region)!;
    expect({ pattern: seen.pattern, pressure: seen.pressure, limit: seen.pressureLimit }).toEqual({
      pattern: bSeen.pattern,
      pressure: bSeen.pressure,
      limit: bSeen.pressureLimit,
    });
    // 함께 있는 사람은 둘이다 (떠난 A 는 세지 않는다)
    expect(presentIn(w.observe(OBSERVER_3))).toBe(2);
  });

  it('S-012 (경계) C 의 새 몸은 시작 방에 선다 — 미로에 닿기 전에는 그 자리가 관찰 결과에 없다', () => {
    // Given A 가 쌓아 두고 떠난 미로
    const w = afterLeaving();
    // When C 가 들어온다
    w.join(OBSERVER_3);
    w.tick(0);

    // Then 새 몸은 시작 방에 선다 (C001 부터의 기본형 그대로)
    const body = bodyOf(w, OBSERVER_3);
    expect(body).not.toBe(PLAYER);
    expect(body).not.toBe(PLAYER_2);
    expect(actorOf(w, body).regionId).toBe(START_REGION_ID);
    // 그리고 미로에 닿기 전에는 그 자리가 관찰 결과에 없다
    const v = w.observe(OBSERVER_3);
    expect(v.region.id).toBe(START_REGION_ID);
    expect(viewState(v.region)).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain('pressureLimit');
    // 미로 안의 몸들도 실리지 않는다 — 관찰은 방으로 잘린다
    expect(entityOf(v, PLAYER)).toBeUndefined();
    expect(entityOf(v, PLAYER_2)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-007 저장하고 되살려도 하나다', () => {
  /** 관찰자 둘이 있는 세계에서 압력을 쌓고 패턴을 P2 까지 넘긴다 */
  function livedTwo(): WorldDriver {
    const w = twoInMaze(entryAt(), gateAt(), (s) => {
      s.regionStates[FANTASY_MAZE]!.pattern = nextOf(nextOf(OPENING_PATTERN));
      s.regionStates[FANTASY_MAZE]!.pressure = mazeRule().pressureLimit - 0.5;
    });
    flipByA(w); // 걸어서 P2 로 넘긴다
    settle(w, OBSERVER);
    expect(mazeState(w).pattern).toBe(OPENING_PATTERN);
    expect(mazeState(w).pressure).toBeGreaterThan(0);
    return w;
  }

  it('S-013 되살린 세계에서 둘이 같은 pattern · pressure 를 보고 같은 통로와 같은 문이 열려 있다', () => {
    // Given 관찰자 둘이 압력을 쌓고 패턴을 넘긴 세계
    const lived = livedTwo();
    const before = { ...mazeState(lived) };

    // When 파일을 지나 저장하고 되살린다 (둘 다 다시 이어진다)
    const w = reviveTwo(lived);

    // Then 둘이 같은 pattern · pressure 를 본다 — 되살린 값도 하나다
    const va = viewState(w.observe(OBSERVER).region)!;
    const vb = viewState(w.observe(OBSERVER_2).region)!;
    expect(mazeState(w)).toEqual(before);
    expect({ pattern: va.pattern, pressure: va.pressure }).toEqual({
      pattern: vb.pattern,
      pressure: vb.pressure,
    });
    expect(va.pattern).toBe(before.pattern);
    expect(va.pressure).toBe(before.pressure);

    // 같은 통로가 열려 있다 — 닫힌 통로는 둘 모두를 같은 사유로 막는다
    const closed = passageSpots(closedOf(before.pattern))[0]!;
    for (const observerId of [OBSERVER, OBSERVER_2]) {
      expect(move(w, closed, observerId)).toEqual({
        status: 'failure',
        rule: 'RULE-MOVE-001',
        reason: PASSAGE_CLOSED,
      });
    }
    // 같은 문이 열려 있다 — 패턴이 P2 이므로 둘 모두에게 열림이다
    expect(exitOf(w.observe(OBSERVER), MAZE_HEART_GATE)).toMatchObject({ state: 'open' });
    expect(exitOf(w.observe(OBSERVER_2), MAZE_HEART_GATE)).toMatchObject({ state: 'open' });
    // 그리고 문 곁에 선 B 가 실제로 건널 수 있다
    expect(cross(w, MAZE_HEART_GATE, OBSERVER_2)).toMatchObject({ status: 'success' });
  });

  it('S-014 (경계) 저장되는 방의 State 가 하나도 늘지 않았다', () => {
    // C011 CHANGED — `STATE_VERSION === 'hkt-adv-proto-i/3'` 을 걷었다 (C009 S-020 과 같은 이유).
    // 판 이름은 C011 이 광맥을 없애며 올렸고, 이 경계가 묻던 것은 그 이름이 아니라
    // **관찰자가 둘이어도 방의 State 가 늘지 않는가** 다.

    // When 관찰자 둘이 있는 세계를 저장한다
    const lived = livedTwo();
    const saved = throughFile(lived.world.snapshot());
    expect(saved.version).toBe(STATE_VERSION);

    // Then 저장된 방의 State 는 C008 의 셋 그대로다 — 이 Cycle 이 한 자리도 더하지 않았다
    const stored = (saved.state as WorldState).regionStates[FANTASY_MAZE]!;
    expect(
      Object.keys(stored).filter((k) => !['pattern', 'pressure', 'rearrangedAt'].includes(k)),
    ).toEqual([]);
    expect(Object.keys(stored)).toContain('pattern');
    expect(Object.keys(stored)).toContain('pressure');
    // 누가 그것을 바꿨는가는 어디에도 저장되지 않는다 — 압력에는 이름표가 없다
    const text = JSON.stringify(stored);
    expect(text).not.toContain(PLAYER);
    expect(text).not.toContain(OBSERVER);
    // 그리고 그 판의 스냅샷은 그대로 되살아난다
    expect(mazeState(reviveTwo(lived))).toEqual(mazeState(lived));
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-008 세계는 플레이어 없이도 돈다', () => {
  /**
   * 미로 안에 자율 존재 하나가 순회하고 관찰자 둘은 가만히 선 세계.
   *
   * 자율 존재를 **미로에** 놓는 길은 c008 시나리오의 선례 그대로 저장·복구다 —
   * 놓인 뒤로는 기존 순회와 기존 규칙이 그대로 굴린다.
   */
  function mazeWithWanderer(pressure = 0): { w: WorldDriver; path: XZ[] } {
    const cells = cellSpots(cellOf(entryAt()));
    const path = [cells[0]!, maxBy(cells, (s) => distanceBetween(s, cells[0]!))];
    const atA = entryAt();
    const atB = standSpot();
    const base = driveWorld({
      npcs: [{ id: 'npc-maze', position: path[0]!, wanderPath: [...path], perceptionRange: 0 }],
      actorRegion: FANTASY_MAZE,
      actorPosition: atA,
    });
    base.join(OBSERVER_2);
    base.tick(0);
    const w = worldFrom(base, (s) => {
      place(s, PLAYER, FANTASY_MAZE, atA);
      place(s, PLAYER_2, FANTASY_MAZE, atB);
      const npc = s.actors.find((a: ActorState) => a.id === 'npc-maze')!;
      npc.regionId = FANTASY_MAZE;
      npc.position = { x: path[0]!.x, z: path[0]!.z };
      npc.wanderPath = path.map((p) => ({ x: p.x, z: p.z }));
      npc.wanderIndex = 0;
      npc.perceptionRange = 0;
      npc.currentAction = idleAction();
      s.regionStates[FANTASY_MAZE]!.pressure = pressure;
    });
    return { w, path };
  }

  it('S-015 관찰자 둘이 한 걸음도 안 걷는데 자율 존재의 걸음으로 압력이 오르고 쌓이면 패턴이 넘어간다', () => {
    // Given 미로 안의 자율 존재 하나, 관찰자 둘은 아무것도 요청하지 않는다. 압력은 임계 아래다
    const primed = mazeRule().pressureLimit - 8;
    const { w } = mazeWithWanderer(primed);
    expect(actorOf(w, 'npc-maze').regionId).toBe(FANTASY_MAZE);
    const first = mazeState(w).pattern;
    const aAt = here(w, PLAYER);
    const bAt = here(w, PLAYER_2);

    // When 시간만 흐른다 (아직 넘치기 전까지)
    let npcWalked = 0;
    for (let i = 0; i < 60; i++) {
      const before = { ...actorOf(w, 'npc-maze').position };
      w.tick(TICK_INTERVAL);
      npcWalked += distanceBetween(before, actorOf(w, 'npc-maze').position);
      if (mazeState(w).pattern !== first) break;
    }

    // Then 관찰자 둘은 한 걸음도 걷지 않았는데
    expect(here(w, PLAYER)).toEqual(aAt);
    expect(here(w, PLAYER_2)).toEqual(bAt);
    expect(actorOf(w, PLAYER).movedThisTick).toBe(0);
    expect(actorOf(w, PLAYER_2).movedThisTick).toBe(0);
    // 압력은 그 존재가 걸은 만큼 올랐고 둘 다 그것을 본다
    expect(npcWalked).toBeGreaterThan(0);
    expect(mazeState(w).pressure).toBeCloseTo(primed + npcWalked * mazeRule().pressurePerDistance, 6);
    expect(viewState(w.observe(OBSERVER).region)!.pressure).toBe(mazeState(w).pressure);
    expect(viewState(w.observe(OBSERVER_2).region)!.pressure).toBe(mazeState(w).pressure);

    // When 계속 흐른다 — 쌓이면 넘친다
    for (let i = 0; i < 20000 && mazeState(w).pattern === first; i++) w.tick(TICK_INTERVAL);

    // Then 관찰자가 아무도 걷지 않았는데 패턴이 넘어갔고, 둘 다 그것을 본다
    expect(mazeState(w).pattern).toBe(nextOf(first));
    expect(here(w, PLAYER)).toEqual(aAt);
    expect(here(w, PLAYER_2)).toEqual(bAt);
    expect(viewState(w.observe(OBSERVER).region)!.pattern).toBe(nextOf(first));
    expect(viewState(w.observe(OBSERVER_2).region)!.pattern).toBe(nextOf(first));
  });

  it('S-016 (경계) 미로 밖의 자율 존재는 미로의 압력에 아무것도 더하지 않는다', () => {
    // Given 세계의 기본 배치 — 자율 존재들이 미로 밖을 순회하고 관찰자 둘은 미로 안에 선다
    const base = driveWorld({ actorRegion: FANTASY_MAZE, actorPosition: entryAt() });
    base.join(OBSERVER_2);
    base.tick(0);
    const w = worldFrom(base, (s) => {
      place(s, PLAYER, FANTASY_MAZE, entryAt());
      place(s, PLAYER_2, FANTASY_MAZE, standSpot());
      s.regionStates[FANTASY_MAZE]!.pressure = 0;
    });
    const wanderers = state(w).actors.filter((a) => a.control === 'autonomous');
    expect(wanderers.length).toBeGreaterThan(0);
    expect(wanderers.every((a) => a.regionId !== FANTASY_MAZE)).toBe(true);
    const before = { ...mazeState(w) };

    // When 그들이 한참 순회한다 (관찰자 둘은 서 있기만 한다)
    let outsideWalked = 0;
    for (let i = 0; i < 300; i++) {
      const beforeAll = state(w)
        .actors.filter((a) => a.control === 'autonomous')
        .map((a) => ({ ...a.position }));
      w.tick(TICK_INTERVAL);
      outsideWalked += state(w)
        .actors.filter((a) => a.control === 'autonomous')
        .reduce((sum, a, i2) => sum + distanceBetween(beforeAll[i2]!, a.position), 0);
    }
    expect(outsideWalked).toBeGreaterThan(0);

    // Then 미로의 State 는 한 값도 바뀌지 않았고 둘 다 0 을 본다
    expect(mazeState(w)).toEqual(before);
    expect(viewState(w.observe(OBSERVER).region)!.pressure).toBe(0);
    expect(viewState(w.observe(OBSERVER_2).region)!.pressure).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// SPEC-009 앞의 아홉 Cycle 은 그대로다 — 관찰자의 수는 어느 규칙의 전제도 아니다
describe('회귀', () => {
  it('R-001 (SPEC-009) 건너기의 사유도 순서도 그대로다 — 둘째 관찰자의 요청에도 같은 대답이 온다', () => {
    // Given 관찰자 둘이 백왕령에 선 세계
    const base = driveWorld(solo);
    base.join(OBSERVER_2);
    base.tick(0);
    const w = base;
    expect(actorOf(w, PLAYER_2).regionId).toBe(START_REGION_ID);

    // Then 사유 코드 셋이 그대로다 (둘째 관찰자에게도)
    for (const observerId of [OBSERVER, OBSERVER_2]) {
      expect(cross(w, 'NO_SUCH', observerId)).toMatchObject({ reason: 'unknown-connector' });
      expect(cross(w, DEEP_TRAIL, observerId)).toMatchObject({ reason: 'wrong-region' });
      expect(cross(w, FOREST_PATH, observerId)).toMatchObject({ reason: 'out-of-range' });
    }

    // 아직 짓지 않은 곳 — 문 앞에는 한 번에 한 몸만 선다 (몸은 서로를 밀어낸다 · C001~).
    // 그래서 관찰자마다 세계를 새로 세워 그 몸만 문 앞에 세운다
    for (const observerId of [OBSERVER, OBSERVER_2]) {
      const two = driveWorld(solo);
      two.join(OBSERVER_2);
      two.tick(0);
      walkTo(two, anchorAt(START_REGION_ID, RED_WASTE_PASS), observerId);
      expect(cross(two, RED_WASTE_PASS, observerId)).toEqual({
        status: 'failure',
        rule: 'RULE-REGION-TRANSIT-001',
        reason: REGION_NOT_BUILT,
      });
    }
  });

  it('R-002 (SPEC-009) 통로 거절과 땅의 판정이 관찰자 둘일 때도 한 글자도 다르지 않다', () => {
    // Given 미로 안의 관찰자 둘
    const w = twoInMaze(entryAt(), standSpot());
    const closed = passageSpots(closedOf(mazeState(w).pattern))[0]!;
    // Then 닫힌 통로의 대답이 둘에게 같다
    for (const observerId of [OBSERVER, OBSERVER_2]) {
      expect(move(w, closed, observerId)).toEqual({
        status: 'failure',
        rule: 'RULE-MOVE-001',
        reason: PASSAGE_CLOSED,
      });
    }
    expect(codeText(PASSAGE_CLOSED)).not.toBe(PASSAGE_CLOSED);

    // Given 백왕령의 관찰자 둘 — 급경사 · 물 · 경계 밖
    const outside = driveWorld(solo);
    outside.join(OBSERVER_2);
    outside.tick(0);
    const t = terrainOf(START_REGION_ID);
    const spots = gridSpots(START_REGION_ID);
    const steep = spots.find((p) => blockedReasonAt(t, p.x, p.z) === BLOCK_STEEP)!;
    const water = spots.find((p) => blockedReasonAt(t, p.x, p.z) === BLOCK_WATER)!;
    const { maxX } = spaceOf(START_REGION_ID).extent;
    for (const observerId of [OBSERVER, OBSERVER_2]) {
      expect(move(outside, steep, observerId)).toEqual({
        status: 'failure',
        rule: 'RULE-MOVE-001',
        reason: BLOCK_STEEP,
      });
      expect(move(outside, water, observerId)).toMatchObject({ reason: BLOCK_WATER });
      expect(move(outside, { x: maxX + 0.5, z: 0 }, observerId)).toMatchObject({
        reason: 'out-of-bounds',
      });
    }
  });

  it('R-003 (SPEC-009) 심장 문의 조건은 방의 State 만 읽는다 — 관찰자 둘에게 같은 표식이 실린다', () => {
    // Given 패턴마다 세운 세계, 관찰자 둘 다 미로 안에 있다
    for (const pattern of patternNames()) {
      const w = twoInMaze(gateAt(), standSpot(), (s) => {
        s.regionStates[FANTASY_MAZE]!.pattern = pattern;
      });
      const mark = pattern === OPENING_PATTERN ? 'open' : 'locked';
      // Then 표식이 둘 모두에게 같다 — 조건이 읽는 것은 사람이 아니라 방의 State 다
      for (const observerId of [OBSERVER, OBSERVER_2]) {
        expect({
          pattern,
          observerId,
          state: exitOf(w.observe(observerId), MAZE_HEART_GATE)?.state,
        }).toEqual({ pattern, observerId, state: mark });
      }
      // 그리고 문 곁에 선 A 의 대답도 그 조건 그대로다
      expect({
        pattern,
        status: cross(w, MAZE_HEART_GATE, OBSERVER).status,
      }).toEqual({ pattern, status: pattern === OPENING_PATTERN ? 'success' : 'failure' });
    }
  });

  it('R-004 (SPEC-009 경계) 규칙 없는 방에서는 관찰자가 둘이어도 region.state 가 없다', () => {
    // Given 백왕령의 관찰자 둘
    const w = driveWorld(solo);
    w.join(OBSERVER_2);
    w.tick(0);
    // Then 둘 다 그 자리가 비어 있다 — 없는 것을 지어내지 않는다
    for (const observerId of [OBSERVER, OBSERVER_2]) {
      expect({ observerId, state: viewState(w.observe(observerId).region) }).toEqual({
        observerId,
        state: undefined,
      });
    }
    // 그리고 State 를 가진 방은 rule 을 품은 방들과 정확히 같은 집합이다 (관찰자 수와 무관하다)
    expect(Object.keys(state(w).regionStates).sort()).toEqual(
      REGION_SPECS.filter((s) => s.rule)
        .map((s) => s.id)
        .sort(),
    );
  });
});
