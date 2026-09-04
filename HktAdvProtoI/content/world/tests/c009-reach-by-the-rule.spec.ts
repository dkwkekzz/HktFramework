// C009 — 규칙을 이용해 닿는다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-009 + 회귀)
//
// 이 Cycle 에서 **방의 State 가 처음으로 방 밖으로 나가는 문을 정한다.** 그래서 여기서 재는 것은
// "무엇이 문을 열었는가" 다:
//   ① 같은 자리에 선 같은 몸인데 패턴만 다르면 표식과 대답이 갈리는가 (활성은 몸의 것이 아니다)
//   ② 걸어서 압력을 두 번 넘기면 그 문이 실제로 열리고, 세 번이면 다시 잠기는가
//   ③ 열린 문으로 건너면 심장이고, 그 문 **하나**로 되돌아오는가
//   ④ 돌아가기가 몸만 옮기는가 — 압력도 패턴도 한 값도 건드리지 않는가
//   ⑤ 저장되는 State 가 하나도 늘지 않았는가 (문의 열림은 유도된 사실이다)
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 구현(content/regions 의 새 방·문·조건 표 · content/world 의 새 규칙 ·
// content/view 의 새 표)은 **읽지 않았다.** 기대값의 출처는 cycles/C009-reach-by-the-rule/spec.md
// 와 거기서 동결된 이름들뿐이다.
//
// **좌표를 손으로 적지 않는다** — 자리는 언제나 Description 의 anchor · area 와 컴파일 결과의
// 격자에서 골라 쓴다. 임계(P)도 걸음값(k)도 그 방의 규칙 데이터에서 읽는다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.
// 다만 spec 이 스스로 못박은 수("심장에서 나가는 끝은 둘이다")는 그 방의 것만 센다.

import { describe, expect, it } from 'vitest';
import {
  pointsOf,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { checkGraph } from '../../../engine/world-authoring/check';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { exitsOf } from '../../../engine/world-authoring/graph';
import { isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  ANCHOR_LAYER,
  COMPILE_RULES,
  FRONTIER_REGIONS,
  REGION_GRAPH,
  REGION_SPECS,
  START_REGION_ID,
  regionSpec,
} from '../../regions';
// C008 이 세운 미로의 이름들 — 그 파일이 소유한다 (C008 시나리오의 선례 그대로).
import { CELL_LAYER, FANTASY_MAZE, PASSAGE_LAYER } from '../../regions/fantasy-maze';
import { codeText } from '../../view/code-text';
import type { ActionResult } from '../../protocol/actions';
import { createWorld, restoreWorld, type World } from '../index';
import type {
  CommandView,
  GameViewSnapshot,
  InteractionView,
  RequestOutcomeView,
} from '../../protocol/gameview';
import { STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, OBSERVER, PLAYER, type WorldDriver } from './drive';

// ── 이 Cycle 이 동결한 이름들 (spec State 절 · 데이터 값) ─────────
const MAZE_HEART = 'MAZE_HEART';
const MAZE_HEART_GATE = 'MAZE_HEART_GATE';
const INVERTED_GARDEN = 'INVERTED_GARDEN';
const INVERTED_GARDEN_DOOR = 'INVERTED_GARDEN_DOOR';
/** 심장의 anchor 둘 — 미로에서 들어서는 자리 · 뒤집힌 정원 쪽 */
const MAZE_SIDE = 'MAZE_SIDE';
const GARDEN_DOOR = 'GARDEN_DOOR';
/** 미로의 anchor 둘 — 입구(비상 자리) · 심장 쪽 문 */
const ANCIENT_GATE = 'ANCIENT_GATE';
const HEART_GATE = 'HEART_GATE';
/** 심장 쪽 문을 여는 패턴 하나 (확정 2) — 나머지 패턴에서는 잠겨 있다 */
const OPENING_PATTERN = 'P2';
/** 세계 밖의 명령 하나 — id 와 role 과 effect 가 같은 이름이다 */
const EMERGENCY_RETURN = 'emergency-return';
/** 이 Cycle 이 더한 사유 코드 하나 */
const NO_EMERGENCY_EXIT = 'no-emergency-exit';
/** 그대로 쓰는 사유 코드 둘 */
const CONNECTOR_INACTIVE = 'connector-inactive';
const REGION_NOT_BUILT = 'region-not-built';

const FOREST_EDGE = 'FOREST_EDGE';
const FOREST_DEEP = 'FOREST_DEEP';
const FOREST_PATH = 'FOREST_PATH';
const DEEP_TRAIL = 'DEEP_TRAIL';
const MAZE_GATE_RETURN = 'MAZE_GATE_RETURN';
const RED_WASTE_PASS = 'RED_WASTE_PASS';

const solo = { npcs: [] };

// ── 하네스 (c008 의 선례 그대로) ───────────────────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id = PLAYER) => state(w).actors.find((a) => a.id === id)!;
const here = (w: WorldDriver, id = PLAYER): XZ => ({
  x: actorOf(w, id).position.x,
  z: actorOf(w, id).position.z,
});
const move = (w: WorldDriver, at: XZ, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x: at.x, z: at.z } }, observerId);
const standing = (region: string, at: XZ) =>
  driveWorld({ ...solo, actorRegion: region, actorPosition: { x: at.x, z: at.z } });

const spaceOf = (id: string): RegionDescription => regionSpec(id)!.space;
const anchorAt = (region: string, tag: string): XZ =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)!.position;
const anchorTags = (region: string): string[] =>
  pointsOf(spaceOf(region), ANCHOR_LAYER).map((p) => p.tag);

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
const mazeRule = () => regionSpec(FANTASY_MAZE)!.rule!;
const mazeTerrain = () => terrainOf(FANTASY_MAZE);
const entryAt = (): XZ => anchorAt(FANTASY_MAZE, ANCIENT_GATE);
const gateAt = (): XZ => anchorAt(FANTASY_MAZE, HEART_GATE);
const patternNames = () => mazeRule().patterns.map((p) => p.name);
const otherPatterns = () => patternNames().filter((n) => n !== OPENING_PATTERN);
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
const cellOf = (at: XZ): string => tagsAt(mazeTerrain(), at.x, at.z, CELL_LAYER)[0]!;

const regionStateOf = (w: WorldDriver, id: string) => state(w).regionStates[id];
const mazeState = (w: WorldDriver) => {
  const s = regionStateOf(w, FANTASY_MAZE);
  if (!s) throw new Error('미로에 Region State 가 없다');
  return s;
};

// ── 관찰 결과를 읽는 자리 ─────────────────────────────────────
const exitsIn = (v: GameViewSnapshot) => v.entities.filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string) => exitsIn(v).find((e) => e.id === id);
const transitTo = (v: GameViewSnapshot, connector: string): InteractionView | undefined =>
  v.interactions.find((i) => i.id === 'transit' && i.targetEntityId === connector);
const commandOf = (v: GameViewSnapshot, id: string): CommandView | undefined =>
  v.commands.find((c) => c.id === id);
const roleOf = (v: GameViewSnapshot, role: string): InteractionView | undefined =>
  v.interactions.find((i) => i.role === role);

const cross = (w: WorldDriver, connector: string): ActionResult =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector });
const askCross = (w: WorldDriver, connector: string): RequestOutcomeView[] =>
  w.dispatchForOutcome({ interactionId: 'transit', targetEntityId: connector });
const goBack = (w: WorldDriver): ActionResult => w.dispatch({ interactionId: EMERGENCY_RETURN });
const askGoBack = (w: WorldDriver): RequestOutcomeView[] =>
  w.dispatchForOutcome({ interactionId: EMERGENCY_RETURN });

// ── 걷기 (c008 의 선례 그대로) ────────────────────────────────
function walkTo(w: WorldDriver, at: XZ) {
  const arrived = () => distanceBetween(here(w), at) <= 0.05;
  if (arrived()) return;
  expect(move(w, at).status).toBe('success');
  const steps = Math.ceil(240 / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    w.tick(TICK_INTERVAL);
    if (arrived()) return;
  }
  throw new Error(`걸어서 (${at.x}, ${at.z}) 에 닿지 못했다 — 지금 자리 ${JSON.stringify(here(w))}`);
}

/** 자리 둘을 오가며 걷는다 — 멈춤 조건이 참이 될 때까지 (요청은 도착할 때마다 다시 낸다) */
function walkUntil(w: WorldDriver, path: readonly XZ[], stop: () => boolean, limitTicks = 60000) {
  let leg = 0;
  const order = () => expect(move(w, path[leg % path.length]!).status).toBe('success');
  order();
  for (let i = 0; i < limitTicks; i++) {
    w.tick(TICK_INTERVAL);
    if (stop()) return;
    if (actorOf(w).currentAction.kind !== 'move') {
      leg += 1;
      order();
    }
  }
  throw new Error('걸어도 그 일이 일어나지 않았다');
}

// ── 이미 무언가 겪은 세계를 짓는 하네스 (c008 의 선례 그대로) ──
//
// "패턴이 이미 P2 인 세계" 는 걸어서도 만들 수 있지만 오래 걸린다. 그래서 저장·복구라는
// 공개 길로 그런 세계를 세운다 — 세계를 뜯어 고치는 것이 아니라, 그런 일을 이미 겪은
// 세계를 되살리는 것이다. **걸어서 실제로 그리 되는가는 SPEC-003 이 따로 잰다.**
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

function reviveOf(base: WorldDriver): WorldDriver {
  const revived = wrap(createWorld({}, restoreWorld(throughFile(base.world.snapshot()))!));
  revived.join(OBSERVER);
  revived.tick(0);
  return revived;
}

function worldFrom(base: WorldDriver, edit: (s: WorldState) => void): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  edit(restored);
  const world = createWorld({}, restored);
  world.join(OBSERVER);
  world.tick(0);
  return wrap(world);
}

/** 미로 안에 선 세계 — 자리를 밝히지 않으면 입구 anchor 다 */
const inMaze = (at: XZ = entryAt()) => standing(FANTASY_MAZE, at);

/** 미로의 패턴이 name 인 세계, 몸은 at 에 선다 (압력은 0) */
function mazeAtPattern(name: string, at: XZ = gateAt()): WorldDriver {
  return worldFrom(inMaze(at), (s) => {
    s.regionStates[FANTASY_MAZE]!.pattern = name;
    s.regionStates[FANTASY_MAZE]!.pressure = 0;
  });
}

/** 심장 안에 선 세계 — 미로의 패턴은 밝힌 대로다 */
function inHeart(pattern = OPENING_PATTERN, at: XZ = anchorAt(MAZE_HEART, MAZE_SIDE)): WorldDriver {
  return worldFrom(standing(MAZE_HEART, at), (s) => {
    s.regionStates[FANTASY_MAZE]!.pattern = pattern;
    s.regionStates[FANTASY_MAZE]!.pressure = 0;
  });
}

// ─────────────────────────────────────────────────────────────
describe('SPEC-001 심장이 지어진다', () => {
  it('S-001 심장에 Description 이 있다 — depth deep · anchor 둘 · 미로의 중첩 자식이다', () => {
    // Given 세계가 아는 방들
    const spec = regionSpec(MAZE_HEART);
    // Then 심장이 그 안에 있다 (경계가 아니라 지어진 방이다)
    expect(spec).toBeDefined();
    expect(REGION_SPECS.map((s) => s.id)).toContain(MAZE_HEART);
    expect([...FRONTIER_REGIONS]).not.toContain(MAZE_HEART);
    expect(spec!.depth).toBe('deep');

    // anchor 둘 — 미로 쪽과 정원 쪽
    expect(anchorTags(MAZE_HEART).sort()).toEqual([GARDEN_DOOR, MAZE_SIDE].sort());

    // 그리고 미로의 중첩 자식이다
    expect(REGION_GRAPH.containment).toContainEqual({ parent: FANTASY_MAZE, child: MAZE_HEART });
  });

  it('S-002 (경계) checkGraph 의 검사가 전부 0 이다 — 뒤집힌 정원은 경계이고 Description 이 없다', () => {
    // Given 이 Cycle 이 세운 문 둘
    const gate = REGION_GRAPH.connectors.find((c) => c.id === MAZE_HEART_GATE);
    const garden = REGION_GRAPH.connectors.find((c) => c.id === INVERTED_GARDEN_DOOR);
    expect(gate).toBeDefined();
    expect(garden).toBeDefined();
    // 심장 쪽 문 — 미로의 HEART_GATE 와 심장의 MAZE_SIDE 를 잇고 양방향이며 door 다
    expect(gate).toMatchObject({
      from: { region: FANTASY_MAZE, anchor: HEART_GATE },
      to: { region: MAZE_HEART, anchor: MAZE_SIDE },
      direction: 'bidirectional',
      transition: 'door',
    });
    // 정원 쪽 문 — 심장에서 나가는 한 방향이고 그 너머는 경계다
    expect(garden).toMatchObject({
      from: { region: MAZE_HEART, anchor: GARDEN_DOOR },
      to: { region: INVERTED_GARDEN },
      direction: 'one-way',
      transition: 'door',
    });

    // Then 심장에 나갈 끝이 있다 (no-exit 0)
    expect(exitsOf(REGION_GRAPH, MAZE_HEART).length).toBeGreaterThan(0);
    // 뒤집힌 정원은 경계 목록에 있고 Description 이 없다 (frontier-built 0 · unused-frontier 0)
    expect([...FRONTIER_REGIONS]).toContain(INVERTED_GARDEN);
    expect(REGION_SPECS.map((s) => s.id)).not.toContain(INVERTED_GARDEN);
    expect(regionSpec(INVERTED_GARDEN)).toBeUndefined();

    // Then 정합 검사가 하나도 걸리지 않는다 — 중첩도 Connector 로 이어져 있다
    expect(
      checkGraph(
        REGION_SPECS.map((s) => s.space),
        REGION_GRAPH,
        ANCHOR_LAYER,
        START_REGION_ID,
      ),
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-002 심장 쪽 문은 패턴이 정한다', () => {
  it('S-003 패턴이 P2 면 심장 쪽 문이 활성이다 — 표식이 열림이고 건너기가 거절되지 않는다', () => {
    // Given 패턴이 P2 인 미로, 몸은 심장 쪽 문 곁에 선다
    const w = mazeAtPattern(OPENING_PATTERN);
    expect(mazeState(w).pattern).toBe(OPENING_PATTERN);

    // Then 그 문의 표식이 열림이다
    const v = w.observe();
    expect(exitOf(v, MAZE_HEART_GATE)).toMatchObject({ state: 'open' });
    // 그리고 건너기가 거절되지 않는다
    expect(transitTo(v, MAZE_HEART_GATE)).toMatchObject({ available: true });
    expect(transitTo(v, MAZE_HEART_GATE)!.reason).toBeUndefined();
    expect(askCross(w, MAZE_HEART_GATE)[0]).toMatchObject({ accepted: true });
  });

  it('S-004 (경계) P2 가 아니면 잠김이고 connector-inactive 로 거절된다 — 몸은 아무것도 하지 않았다', () => {
    // Given 같은 자리(심장 쪽 문 곁)에 선, 한 걸음도 걷지 않은 몸.
    //       다른 것은 하나도 없고 **그 방의 패턴만** 다르다
    for (const pattern of otherPatterns()) {
      const w = mazeAtPattern(pattern);
      expect(mazeState(w).pattern).toBe(pattern);
      // 몸은 아무것도 하지 않았다 — 자리도 그대로고 걸은 거리도 0 이다
      expect(here(w)).toEqual({ x: gateAt().x, z: gateAt().z });
      expect(actorOf(w).movedThisTick).toBe(0);

      // Then 표식이 잠김이다
      const v = w.observe();
      expect({ pattern, state: exitOf(v, MAZE_HEART_GATE)?.state }).toEqual({
        pattern,
        state: 'locked',
      });
      // 그리고 건너기가 connector-inactive 로 거절된다 (거리가 아니라 닫힘이 걸린다)
      expect(transitTo(v, MAZE_HEART_GATE)).toMatchObject({
        available: false,
        reason: CONNECTOR_INACTIVE,
      });
      expect(cross(w, MAZE_HEART_GATE)).toEqual({
        status: 'failure',
        rule: 'RULE-REGION-TRANSIT-001',
        reason: CONNECTOR_INACTIVE,
      });
      // 거절은 몸을 하나도 바꾸지 않는다
      expect(actorOf(w).regionId).toBe(FANTASY_MAZE);
      expect(here(w)).toEqual({ x: gateAt().x, z: gateAt().z });
    }

    // 그리고 그 문구는 C002 부터 쓰던 그대로다
    expect(codeText(CONNECTOR_INACTIVE)).toBe('잠겨 있다');
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-003 압력이 문을 연다', () => {
  it('S-005 임계를 두 번 넘기면(DEFAULT → P1 → P2) 그 문이 활성이 된다 — 갈리는 것은 패턴이다', () => {
    // Given 미로의 심장 쪽 문 곁에 선 몸, 패턴은 처음(DEFAULT)이고 문은 잠겨 있다
    const w = inMaze(gateAt());
    const first = patternNames()[0]!;
    expect(mazeState(w)).toMatchObject({ pattern: first, pressure: 0 });
    expect(exitOf(w.observe(), MAZE_HEART_GATE)).toMatchObject({ state: 'locked' });

    // 걸을 자리 — 문이 놓인 구역 안이다 (통로에 들지 않으므로 어느 패턴에서도 막히지 않는다)
    const gateCell = cellOf(gateAt());
    const far = maxBy(cellSpots(gateCell), (s) => distanceBetween(s, gateAt()));

    // When 한 번 넘긴다 — 아직 P2 가 아니다
    walkUntil(w, [far, gateAt()], () => mazeState(w).pattern !== first);
    expect(mazeState(w).pattern).toBe(nextOf(first));
    expect(mazeState(w).pattern).not.toBe(OPENING_PATTERN);
    // Then 문 곁에 돌아와 건너기를 요청해도 거절된다 — 몸이 거기 있는 것으로는 열리지 않는다
    walkTo(w, gateAt());
    expect(exitOf(w.observe(), MAZE_HEART_GATE)).toMatchObject({ state: 'locked' });
    expect(cross(w, MAZE_HEART_GATE)).toMatchObject({
      status: 'failure',
      reason: CONNECTOR_INACTIVE,
    });

    // When 두 번째로 넘긴다
    const second = mazeState(w).pattern;
    walkUntil(w, [far, gateAt()], () => mazeState(w).pattern !== second);

    // Then 그 순간 패턴이 P2 이고 문이 활성이다 — 몸이 어디 있든 표식이 바뀐다
    expect(mazeState(w).pattern).toBe(OPENING_PATTERN);
    expect(exitOf(w.observe(), MAZE_HEART_GATE)).toMatchObject({ state: 'open' });
    // 그리고 같은 요청 하나가 이제 받아들여진다
    walkTo(w, gateAt());
    expect(cross(w, MAZE_HEART_GATE)).toMatchObject({ status: 'success' });
    expect(actorOf(w).regionId).toBe(MAZE_HEART);
  });

  it('S-006 (경계) 세 번 넘기면 DEFAULT 로 돌아오고 문은 다시 잠긴다 — 순환은 셋이다', () => {
    // Given 미로에 선 몸과 걸을 자리
    const w = inMaze(gateAt());
    const first = patternNames()[0]!;
    const far = maxBy(cellSpots(cellOf(gateAt())), (s) => distanceBetween(s, gateAt()));
    const seen: string[] = [mazeState(w).pattern];

    // When 세 번 넘긴다
    for (let n = 0; n < 3; n++) {
      const now = mazeState(w).pattern;
      walkUntil(w, [far, gateAt()], () => mazeState(w).pattern !== now);
      seen.push(mazeState(w).pattern);
      // 넘길 때마다 표식은 그 패턴이 정한 대로다
      expect({
        pattern: mazeState(w).pattern,
        mark: exitOf(w.observe(), MAZE_HEART_GATE)?.state,
      }).toEqual({
        pattern: mazeState(w).pattern,
        mark: mazeState(w).pattern === OPENING_PATTERN ? 'open' : 'locked',
      });
    }

    // Then 순환의 처음으로 돌아왔고 문은 다시 잠겼다
    expect(seen).toEqual([...patternNames(), first]);
    expect(mazeState(w).pattern).toBe(first);
    expect(exitOf(w.observe(), MAZE_HEART_GATE)).toMatchObject({ state: 'locked' });
    walkTo(w, gateAt());
    expect(cross(w, MAZE_HEART_GATE)).toMatchObject({
      status: 'failure',
      reason: CONNECTOR_INACTIVE,
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-004 열린 문으로 건너면 심장이다', () => {
  it('S-007 건너기가 받아들여지고 심장 쪽 anchor 에 선다 — 관성도 진행 중이던 행동도 남지 않는다', () => {
    // Given 패턴이 P2 이고 심장 쪽 문 곁에 선 몸, 그 몸에는 관성이 실려 있다
    const w = worldFrom(inMaze(gateAt()), (s) => {
      s.regionStates[FANTASY_MAZE]!.pattern = OPENING_PATTERN;
      const a = s.actors.find((x) => x.id === PLAYER)!;
      a.velocity = { x: 3, z: -2 };
    });
    expect(actorOf(w).velocity).toEqual({ x: 3, z: -2 });

    // When 건넌다
    expect(cross(w, MAZE_HEART_GATE)).toEqual({
      status: 'success',
      rule: 'RULE-REGION-TRANSIT-001',
    });

    // Then 방이 심장으로 바뀌고 몸은 심장 쪽 anchor 에 선다
    expect(actorOf(w).regionId).toBe(MAZE_HEART);
    expect(here(w)).toEqual({
      x: anchorAt(MAZE_HEART, MAZE_SIDE).x,
      z: anchorAt(MAZE_HEART, MAZE_SIDE).z,
    });
    expect(w.observe().scene).toBe(MAZE_HEART);
    expect(w.observe().region.id).toBe(MAZE_HEART);
    // 그리고 관성과 진행 중이던 행동은 남지 않는다 (C003 이 세운 전이 그대로)
    expect(actorOf(w).velocity).toEqual({ x: 0, z: 0 });
    expect(actorOf(w).currentAction.kind).toBe('idle');
  });

  it('S-008 (경계) 문은 하나이고 양방향이다 — 심장에서 같은 문으로 미로에 돌아온다', () => {
    // Given 미로와 심장을 잇는 문은 하나뿐이다
    const between = REGION_GRAPH.connectors.filter(
      (c) =>
        (c.from.region === FANTASY_MAZE && c.to.region === MAZE_HEART) ||
        (c.from.region === MAZE_HEART && c.to.region === FANTASY_MAZE),
    );
    expect(between.map((c) => c.id)).toEqual([MAZE_HEART_GATE]);

    // Given 패턴이 P2 인 채 심장 안에 선 몸
    const w = inHeart(OPENING_PATTERN);
    expect(actorOf(w).regionId).toBe(MAZE_HEART);
    // When 같은 문으로 건넌다
    expect(cross(w, MAZE_HEART_GATE)).toMatchObject({ status: 'success' });
    // Then 미로의 HEART_GATE anchor 에 선다 — 들어간 자리로 나온다
    expect(actorOf(w).regionId).toBe(FANTASY_MAZE);
    expect(here(w)).toEqual({ x: gateAt().x, z: gateAt().z });
  });

  it('S-009 (경계) 돌아올 때도 같은 조건을 읽는다 — P2 가 아니면 심장에서도 connector-inactive', () => {
    for (const pattern of otherPatterns()) {
      // Given 미로의 패턴이 P2 가 아닌 채 심장 안에 선 몸
      const w = inHeart(pattern);
      // Then 그 문의 표식이 심장 쪽에서도 잠김이다
      const v = w.observe();
      expect({ pattern, state: exitOf(v, MAZE_HEART_GATE)?.state }).toEqual({
        pattern,
        state: 'locked',
      });
      // 그리고 건너기가 같은 사유로 거절된다 — 조건은 문 하나에 하나다
      expect(cross(w, MAZE_HEART_GATE)).toMatchObject({
        status: 'failure',
        reason: CONNECTOR_INACTIVE,
      });
      expect(actorOf(w).regionId).toBe(MAZE_HEART);
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-005 심장은 규칙 없는 방이다', () => {
  it('S-010 심장에는 region.state 가 없고, 그 걸음은 미로의 압력에 아무것도 더하지 않는다', () => {
    // Given 심장 안에 선 몸 (미로의 압력은 0 에서 시작한다)
    const w = inHeart();
    expect(mazeState(w).pressure).toBe(0);
    const beforeMaze = { ...mazeState(w) };

    // Then 관찰 결과에 그 자리가 없고 세계 State 에도 그 방의 자리가 없다
    expect(w.observe().region.state).toBeUndefined();
    expect(regionStateOf(w, MAZE_HEART)).toBeUndefined();
    expect(JSON.stringify(w.observe())).not.toContain('pressureLimit');

    // When 심장 안을 걷는다 — 실제로 옮겨진 거리를 잰다
    const t = terrainOf(MAZE_HEART);
    const from = here(w);
    const target = maxBy(
      gridSpots(MAZE_HEART).filter((p) => isTraversableAt(t, p.x, p.z)),
      (p) => distanceBetween(p, from),
    );
    expect(distanceBetween(target, from)).toBeGreaterThan(0.5);
    expect(move(w, target).status).toBe('success');
    let walked = 0;
    for (let i = 0; i < 20000; i++) {
      const before = here(w);
      w.tick(TICK_INTERVAL);
      walked += distanceBetween(before, here(w));
      if (actorOf(w).currentAction.kind !== 'move') break;
    }
    expect(walked).toBeGreaterThan(0);

    // Then 미로의 State 는 한 값도 바뀌지 않았다 — 걸음을 압력으로 바꾸는 규칙이 없는 방이다
    expect(mazeState(w)).toEqual(beforeMaze);
    expect(regionStateOf(w, MAZE_HEART)).toBeUndefined();
  });

  it('S-011 (경계) 심장에서 나가는 끝은 둘이다 — 정원 쪽은 region-not-built 로 거절된다', () => {
    // Given 심장 안의 관찰자
    const w = inHeart();
    const v = w.observe();
    // Then 이 방의 나가는 끝은 왔던 문과 정원 쪽 문 둘뿐이다 (spec 이 스스로 못박은 수)
    expect(exitsIn(v).map((e) => e.id).sort()).toEqual(
      [MAZE_HEART_GATE, INVERTED_GARDEN_DOOR].sort(),
    );
    // 그 너머가 아직 없는 문도 표식 자체는 열림이다 (C002 가 세운 그대로 — 대답으로만 드러난다)
    expect(exitOf(v, INVERTED_GARDEN_DOOR)).toMatchObject({ state: 'open' });

    // When 정원 쪽 anchor 로 걸어가 건너려 한다
    walkTo(w, anchorAt(MAZE_HEART, GARDEN_DOOR));
    // Then 아직 짓지 않은 곳이라고 거절된다
    expect(cross(w, INVERTED_GARDEN_DOOR)).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: REGION_NOT_BUILT,
    });
    expect(actorOf(w).regionId).toBe(MAZE_HEART);
    expect(codeText(REGION_NOT_BUILT)).toBe('아직 갈 수 없는 곳이다');
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-006 돌아가기는 몸만 옮긴다', () => {
  it('S-012 미로 어디서든 걸면 입구 anchor 에 선다 — 방은 그대로, 관성도 행동도 남지 않는다', () => {
    // Given 미로가 밝힌 비상 자리는 입구 anchor 다 (컨텐츠 데이터)
    expect(regionSpec(FANTASY_MAZE)!.emergencyAnchor).toBe(ANCIENT_GATE);

    // Given 입구에서 멀리 떨어진 자리에 선 몸, 관성이 실려 있다
    const far = maxBy(cellSpots(), (s) => distanceBetween(s, entryAt()));
    expect(distanceBetween(far, entryAt())).toBeGreaterThan(1);
    const w = worldFrom(inMaze(far), (s) => {
      const a = s.actors.find((x) => x.id === PLAYER)!;
      a.velocity = { x: -4, z: 1 };
    });

    // 명령 표면에 그것이 밝혀져 있다 — 받는 자리는 없다
    const v = w.observe();
    expect(commandOf(v, EMERGENCY_RETURN)).toMatchObject({
      effect: EMERGENCY_RETURN,
      available: true,
      parameters: [],
    });
    expect(commandOf(v, EMERGENCY_RETURN)!.reason).toBeUndefined();
    expect(roleOf(v, EMERGENCY_RETURN)).toMatchObject({ available: true });
    // 대상도 값도 싣지 않는다
    expect(roleOf(v, EMERGENCY_RETURN)!.targetEntityId).toBeUndefined();

    // When 돌아가기를 건다
    expect(goBack(w)).toEqual({ status: 'success', rule: 'RULE-EMERGENCY-RETURN-001' });

    // Then 몸이 입구 anchor 에 선다 — 방은 바뀌지 않았다
    expect(actorOf(w).regionId).toBe(FANTASY_MAZE);
    expect(here(w)).toEqual({ x: entryAt().x, z: entryAt().z });
    // 관성과 진행 중이던 행동은 남지 않는다
    expect(actorOf(w).velocity).toEqual({ x: 0, z: 0 });
    expect(actorOf(w).currentAction.kind).toBe('idle');
    // 그리고 그 명령에 사람이 읽을 말이 붙어 있다 (문구 자체는 View 의 표가 정한다)
    expect(codeText(EMERGENCY_RETURN)).not.toBe(EMERGENCY_RETURN);
  });

  it('S-013 (경계) 압력도 패턴도 rearrangedAt 도 한 값도 바뀌지 않는다 — 이동이 아니다', () => {
    // Given 입구에서 먼 자리에 선 몸, 압력은 임계 바로 아래다.
    //       옮겨질 거리는 남은 압력을 훌쩍 넘긴다 — 이동이었다면 패턴이 넘어갔을 것이다
    const far = maxBy(cellSpots(), (s) => distanceBetween(s, entryAt()));
    const rule = mazeRule();
    const w = worldFrom(inMaze(far), (s) => {
      s.regionStates[FANTASY_MAZE]!.pressure = rule.pressureLimit - 0.5;
    });
    const span = distanceBetween(far, entryAt());
    expect(span * rule.pressurePerDistance).toBeGreaterThan(0.5);
    const before = { ...mazeState(w) };

    // When 돌아가기를 건다
    expect(goBack(w)).toMatchObject({ status: 'success' });

    // Then 몸은 실제로 그만큼 옮겨졌는데
    expect(here(w)).toEqual({ x: entryAt().x, z: entryAt().z });
    expect(distanceBetween(here(w), far)).toBeGreaterThan(0.5);
    // 압력도 패턴도 rearrangedAt 도 한 값도 바뀌지 않았다 — 그래서 패턴을 넘길 수도 없다
    expect(mazeState(w)).toEqual(before);
    expect(mazeState(w).pattern).toBe(patternNames()[0]);
    expect(mazeState(w).rearrangedAt).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-007 비상 자리가 없는 방에서는 걸 수 없다', () => {
  it('S-014 미로 밖에서는 가용하지 않다고 밝혀져 있고 걸어도 거절된다 — 자리는 그대로다', () => {
    // Given 백왕령에 선 몸
    const w = driveWorld(solo);
    expect(actorOf(w).regionId).toBe(START_REGION_ID);
    const before = here(w);

    // Then 가용하지 않다고 밝혀져 있다
    const v = w.observe();
    expect(commandOf(v, EMERGENCY_RETURN)).toMatchObject({
      available: false,
      reason: NO_EMERGENCY_EXIT,
    });
    expect(roleOf(v, EMERGENCY_RETURN)).toMatchObject({
      available: false,
      reason: NO_EMERGENCY_EXIT,
    });

    // When 그래도 건다
    expect(goBack(w)).toMatchObject({ status: 'failure', reason: NO_EMERGENCY_EXIT });
    expect(askGoBack(w)[0]).toMatchObject({ accepted: false, reason: NO_EMERGENCY_EXIT });
    // Then 몸의 자리는 바뀌지 않는다
    expect(actorOf(w).regionId).toBe(START_REGION_ID);
    expect(here(w)).toEqual(before);
    // 그 코드에 사람이 읽을 말이 붙어 있다
    expect(codeText(NO_EMERGENCY_EXIT)).not.toBe(NO_EMERGENCY_EXIT);
  });

  it('S-015 (경계) 목록 자체는 늘 실린다 — 걸 수 있는 것이 무엇인지는 허용 여부와 별개다', () => {
    // Given 여러 방의 관찰자 — 비상 자리를 밝힌 방은 미로 하나다
    const rooms: { id: string; at: XZ }[] = [
      { id: START_REGION_ID, at: pointsOf(spaceOf(START_REGION_ID), ANCHOR_LAYER)[0]!.position },
      { id: FOREST_DEEP, at: pointsOf(spaceOf(FOREST_DEEP), ANCHOR_LAYER)[0]!.position },
      { id: MAZE_HEART, at: anchorAt(MAZE_HEART, MAZE_SIDE) },
      { id: FANTASY_MAZE, at: entryAt() },
    ];
    for (const room of rooms) {
      const v = standing(room.id, room.at).observe();
      const command = commandOf(v, EMERGENCY_RETURN);
      // Then 어느 방에서든 목록에 있고, 무엇을 받는지도 함께 밝혀져 있다
      expect({ room: room.id, listed: command !== undefined }).toEqual({
        room: room.id,
        listed: true,
      });
      expect(command!.effect).toBe(EMERGENCY_RETURN);
      expect(command!.parameters).toEqual([]);
      // 다만 걸 수 있는 곳은 비상 자리를 밝힌 방뿐이다
      expect({ room: room.id, available: command!.available }).toEqual({
        room: room.id,
        available: room.id === FANTASY_MAZE,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-008 다른 문들은 그대로다', () => {
  /** 지어진 방마다 anchor 하나에 서서 본 관찰 결과 */
  const rooms = (): Map<string, GameViewSnapshot> => {
    const out = new Map<string, GameViewSnapshot>();
    for (const spec of REGION_SPECS) {
      const at = pointsOf(spec.space, ANCHOR_LAYER)[0]!.position;
      out.set(spec.id, standing(spec.id, at).observe());
    }
    return out;
  };

  it('S-016 활성 조건 표에 없는 문은 언제나 활성이다 — 심장 쪽 문 말고는 어디서도 잠기지 않는다', () => {
    // Given 지어진 방 전부의 관찰 결과 (미로의 패턴은 처음 그대로다)
    for (const [id, v] of rooms()) {
      const locked = exitsIn(v)
        .filter((e) => e.state !== 'open')
        .map((e) => e.id);
      // Then 잠긴 표식은 심장 쪽 문뿐이다
      expect({ region: id, locked }).toEqual({
        region: id,
        locked: id === FANTASY_MAZE || id === MAZE_HEART ? [MAZE_HEART_GATE] : [],
      });
    }

    // 그리고 미로 자신의 다른 문 둘은 패턴이 무엇이든 열려 있다
    for (const pattern of patternNames()) {
      const v = mazeAtPattern(pattern, entryAt()).observe();
      for (const other of [MAZE_GATE_RETURN, ANCIENT_GATE]) {
        expect({ pattern, id: other, state: exitOf(v, other)?.state }).toEqual({
          pattern,
          id: other,
          state: 'open',
        });
      }
    }
  });

  it('S-017 판정도 사유도 C008 과 다르지 않다 — 걸어서 숲을 지나 미로에 들어선다', () => {
    // Given 백왕령에서 시작한 몸
    const w = driveWorld(solo);
    // When 문 셋을 차례로 건넌다
    for (const [region, tag, connector] of [
      [START_REGION_ID, FOREST_PATH, FOREST_PATH],
      [FOREST_EDGE, DEEP_TRAIL, DEEP_TRAIL],
      [FOREST_DEEP, ANCIENT_GATE, ANCIENT_GATE],
    ] as const) {
      expect(actorOf(w).regionId).toBe(region);
      walkTo(w, anchorAt(region, tag));
      expect(cross(w, connector)).toEqual({ status: 'success', rule: 'RULE-REGION-TRANSIT-001' });
    }
    // Then 미로에 들어섰고 그 길 어디에서도 connector-inactive 가 나오지 않았다
    expect(actorOf(w).regionId).toBe(FANTASY_MAZE);

    // 그리고 아직 짓지 않은 곳의 대답은 그대로다
    const other = driveWorld(solo);
    walkTo(other, anchorAt(START_REGION_ID, RED_WASTE_PASS));
    expect(cross(other, RED_WASTE_PASS)).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: REGION_NOT_BUILT,
    });
  });

  it('S-018 (경계) 미로 밖의 방을 관찰해도 심장 쪽 문의 상태는 실리지 않는다 — 관찰은 방으로 잘린다', () => {
    for (const [id, v] of rooms()) {
      if (id === FANTASY_MAZE || id === MAZE_HEART) continue;
      // Then 그 방의 관찰 결과에는 심장 쪽 문이 존재도 하지 않는다
      expect({ region: id, exit: exitOf(v, MAZE_HEART_GATE) }).toEqual({
        region: id,
        exit: undefined,
      });
      expect({ region: id, leaked: JSON.stringify(v).includes(MAZE_HEART_GATE) }).toEqual({
        region: id,
        leaked: false,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-009 세계를 되살려도 문은 패턴대로다', () => {
  it('S-019 P2 까지 넘긴 뒤 저장·복구해도 문이 활성이고 건너면 심장이다', () => {
    // Given 걸어서 패턴을 P2 까지 넘긴 세계
    const lived = inMaze(gateAt());
    const far = maxBy(cellSpots(cellOf(gateAt())), (s) => distanceBetween(s, gateAt()));
    while (mazeState(lived).pattern !== OPENING_PATTERN) {
      const now = mazeState(lived).pattern;
      walkUntil(lived, [far, gateAt()], () => mazeState(lived).pattern !== now);
    }
    walkTo(lived, gateAt());
    expect(mazeState(lived).pattern).toBe(OPENING_PATTERN);

    // When 파일을 지나 저장하고 되살린다
    const revived = reviveOf(lived);

    // Then 패턴이 그대로이고 문이 활성이다 — 문의 열림은 유도된 사실이다
    expect(mazeState(revived).pattern).toBe(OPENING_PATTERN);
    expect(exitOf(revived.observe(), MAZE_HEART_GATE)).toMatchObject({ state: 'open' });
    // 그리고 건너면 심장이다
    expect(cross(revived, MAZE_HEART_GATE)).toMatchObject({ status: 'success' });
    expect(actorOf(revived).regionId).toBe(MAZE_HEART);
  });

  it('S-020 (경계) STATE_VERSION 이 C008 과 같다 — 저장되는 State 가 하나도 늘지 않았다', () => {
    // Given C008 이 세운 판 이름 그대로다
    expect(STATE_VERSION).toBe('hkt-adv-proto-i/3');

    // 그리고 저장되는 방의 State 는 C008 의 셋 그대로다
    const w = mazeAtPattern(OPENING_PATTERN);
    const saved = throughFile(w.world.snapshot());
    expect(saved.version).toBe(STATE_VERSION);
    const stored = (saved.state as WorldState).regionStates[FANTASY_MAZE]!;
    expect(Object.keys(stored).sort()).toEqual(['pattern', 'pressure']);

    // 문이 열렸는가는 어디에도 저장되지 않는다 — 패턴에서 유도된다
    const text = JSON.stringify(saved);
    expect(text).not.toContain('heartAccess');
    expect(text).not.toContain(MAZE_HEART_GATE);
    expect(text).not.toContain('emergencyAnchor');

    // 그리고 그 판의 스냅샷은 그대로 되살아난다
    const revived = reviveOf(w);
    expect(mazeState(revived)).toEqual(mazeState(w));
  });

  it.todo(
    'GAP: C008 이 실제로 저장한 스냅샷 파일이 저장소에 없어 "C008 의 스냅샷이 그대로 되살아난다" 를 재생으로 증명하지 못한다 — 지금은 STATE_VERSION 동일 + 저장 형태 동일로 대신한다',
  );
});

// ─────────────────────────────────────────────────────────────
// 회귀 — REUSED 로 적힌 C008 까지의 행동이 한 글자도 바뀌지 않았는가
describe('회귀', () => {
  it('R-001 (C008) 걸으면 압력이 오르고 임계를 넘으면 패턴이 한 칸 간다', () => {
    const w = inMaze();
    const first = patternNames()[0]!;
    expect(mazeState(w)).toMatchObject({ pressure: 0, pattern: first });
    const far = maxBy(cellSpots(cellOf(entryAt())), (s) => distanceBetween(s, entryAt()));

    expect(move(w, far).status).toBe('success');
    for (let i = 0; i < 60; i++) w.tick(TICK_INTERVAL);
    expect(mazeState(w).pressure).toBeGreaterThan(0);

    walkUntil(w, [far, entryAt()], () => mazeState(w).pattern !== first);
    expect(mazeState(w).pattern).toBe(nextOf(first));
    expect(mazeState(w).pressure).toBe(0);
    expect(mazeState(w).rearrangedAt).toBeDefined();
  });

  it('R-002 (C008) 닫힌 통로는 여전히 passage-closed 로 막는다', () => {
    const w = inMaze();
    const pattern = mazeState(w).pattern;
    const open = mazeRule().patterns.find((p) => p.name === pattern)!.open;
    const t = mazeTerrain();
    const closedSpot = gridSpots(FANTASY_MAZE).find((p) => {
      if (!isTraversableAt(t, p.x, p.z)) return false;
      const tags = tagsAt(t, p.x, p.z, PASSAGE_LAYER);
      return tags.length > 0 && tags.every((tag) => !open.includes(tag));
    })!;
    expect(closedSpot).toBeDefined();
    expect(move(w, closedSpot)).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'passage-closed',
    });
  });

  it('R-003 (C002~C008) 건너기의 사유 코드가 늘거나 줄지 않았다', () => {
    const w = driveWorld(solo);
    expect(cross(w, 'NO_SUCH')).toMatchObject({ reason: 'unknown-connector' });
    expect(cross(w, DEEP_TRAIL)).toMatchObject({ reason: 'wrong-region' });
    expect(cross(w, FOREST_PATH)).toMatchObject({ reason: 'out-of-range' });
    walkTo(w, anchorAt(START_REGION_ID, RED_WASTE_PASS));
    expect(cross(w, RED_WASTE_PASS)).toMatchObject({ reason: REGION_NOT_BUILT });
  });

  it('R-004 (C008 SPEC-007 경계) 규칙 없는 방에는 region.state 가 없다 — 심장도 그런 방이다', () => {
    const w = driveWorld(solo);
    expect(w.observe().region.state).toBeUndefined();
    // State 를 가진 방은 rule 을 품은 방들과 정확히 같은 집합이다 (심장은 그 안에 없다)
    expect(Object.keys(state(w).regionStates).sort()).toEqual(
      REGION_SPECS.filter((s) => s.rule).map((s) => s.id).sort(),
    );
    expect(Object.keys(state(w).regionStates)).not.toContain(MAZE_HEART);
  });

  it('R-005 (C006 · C008) 땅은 여전히 저장되지 않고 팩 State 는 plain JSON 이다', () => {
    const w = inHeart();
    for (let i = 0; i < 5; i++) w.tick(TICK_INTERVAL);
    const saved = w.world.snapshot().state;
    const forbidden = ['traversable', 'blocked', 'blockedTags', 'surface', 'surfaceTags', 'terrain'];
    const found: string[] = [];
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
      for (const [key, child] of Object.entries(value)) {
        if (forbidden.includes(key)) found.push(`${path}.${key}`);
        walk(child, `${path}.${key}`);
      }
    };
    walk(saved, 'state');
    expect(found).toEqual([]);
    expect(offenders).toEqual([]);
  });
});
