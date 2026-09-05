// C003 — 작은 문, 큰 방, 돌아올 수 없는 길 · 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// 세계의 공개 경로로만 본다 — driveWorld 로 굴리고, dispatch / dispatchForOutcome 으로 요청하고,
// observe() 의 관찰 결과와 world.snapshot().state 로 확인한다. 이 Cycle 이 새로 쓴 구현
// (규칙 · 방 데이터 · 표현 표)은 읽지 않았다. 기대값의 출처는 cycles/C003-small-door-big-room/spec.md 의 표뿐이다.
//
// 총량 단언을 두지 않는다 — "방이 아홉이다" 대신 "이 Cycle 이 더한 것이 있고 이렇게 행동한다" 로 쓴다.
// 예외는 spec 이 한 방의 관찰 결과로 못박은 자리(방마다의 출구 수)뿐이다.

import { describe, expect, it } from 'vitest';
import { checkGraph } from '../../../engine/world-authoring/check';
import { findPoint, pointsOf } from '../../../engine/world-authoring/description';
import { reachableRegions } from '../../../engine/world-authoring/graph';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { ANCHOR_LAYER, REGION_GRAPH, REGION_SPECS, regionSpec } from '../../regions';
import { createWorld, restoreWorld } from '../index';
import { INTERACTION_RANGE, STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

// ── spec 의 이름들 (표에서만 왔다) ─────────────────────────────
const WHITE_KING_DOMAIN = 'WHITE_KING_DOMAIN';
const FOREST_EDGE = 'FOREST_EDGE';
const FOREST_DEEP = 'FOREST_DEEP';
const EXPLORER_RUIN = 'EXPLORER_RUIN';
const PREDATOR_NEST = 'PREDATOR_NEST';
const BIO_ORE_FIELD = 'BIO_ORE_FIELD';
const RED_EYE_TREE = 'RED_EYE_TREE';
const TREE_INNER_WORLD = 'TREE_INNER_WORLD';
const HEART_LAKE = 'HEART_LAKE';

/** C002 까지 지어진 여섯 — 이 Cycle 이 손대지 않는다 */
const C002_REGIONS = [
  WHITE_KING_DOMAIN,
  FOREST_EDGE,
  FOREST_DEEP,
  EXPLORER_RUIN,
  PREDATOR_NEST,
  BIO_ORE_FIELD,
];
/** 이 Cycle 이 세우는 셋 */
const C003_REGIONS = [RED_EYE_TREE, TREE_INNER_WORLD, HEART_LAKE];

const FOREST_PATH = 'FOREST_PATH';
const DEEP_TRAIL = 'DEEP_TRAIL';
const NEST_TRAIL = 'NEST_TRAIL';
const ORE_TRAIL = 'ORE_TRAIL';
const RUIN_TRAIL = 'RUIN_TRAIL';
const TREE_APPROACH = 'TREE_APPROACH';
const ORE_TREE_TRAIL = 'ORE_TREE_TRAIL';
const ANCIENT_GATE = 'ANCIENT_GATE';
const RED_WASTE_PASS = 'RED_WASTE_PASS';
const ICE_CANYON_PASS = 'ICE_CANYON_PASS';
const TREE_INNER_DOOR = 'TREE_INNER_DOOR';
const TREE_FALL = 'TREE_FALL';
const HEART_RIVER = 'HEART_RIVER';

/** spec SPEC-002 의 anchor 표 — 이 Cycle 이 더하는 자리들 */
const NEW_ANCHORS: Record<string, Record<string, { x: number; z: number }>> = {
  [RED_EYE_TREE]: {
    FOREST_DEEP_SIDE: { x: 0, z: -18 },
    ORE_SIDE: { x: 18, z: 0 },
    INNER_DOOR: { x: 0, z: 6 },
  },
  [TREE_INNER_WORLD]: {
    OUTER_DOOR: { x: 0, z: -38 },
    FALL: { x: 0, z: 38 },
  },
  [HEART_LAKE]: {
    FALL_LANDING: { x: 0, z: 0 },
    RIVER: { x: 0, z: -18 },
  },
  [FOREST_DEEP]: {
    RIVER_MOUTH: { x: 14, z: -8 }, // C002 의 다섯에 더한다
  },
};

const SMALL_EXTENT = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
const BIG_EXTENT = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };

// ── 하네스 (many-exits.scenario.spec.ts 의 선례 그대로) ────────
const solo = { npcs: [] };

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id: string) => state(w).actors.find((a) => a.id === id)!;
const body = (w: WorldDriver) => actorOf(w, PLAYER);
const exits = (v: GameViewSnapshot) => v.entities.filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string) => exits(v).find((e) => e.id === id);
const transits = (v: GameViewSnapshot) => v.interactions.filter((i) => i.id === 'transit');
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
const descriptions = () => REGION_SPECS.map((r) => r.space);
const graphFrontiers = (REGION_GRAPH as unknown as { frontiers?: string[] }).frontiers ?? [];
const anchorAt = (region: string, tag: string) =>
  findPoint(regionSpec(region)!.space, ANCHOR_LAYER, tag)?.position;

function tickFor(w: WorldDriver, seconds: number) {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
}

/** 그 방 안을 걸어 (x, z) 에 선다 — 이동 요청 + Tick 뿐이다 (State 를 직접 놓지 않는다) */
function walkTo(w: WorldDriver, x: number, z: number) {
  const arrived = () => {
    const p = body(w).position;
    return Math.hypot(p.x - x, p.z - z) <= 0.05;
  };
  if (arrived()) return;
  expect(w.dispatch({ interactionId: 'move', position: { x, z } }).status).toBe('success');
  const steps = Math.ceil(120 / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    w.tick(TICK_INTERVAL);
    if (arrived()) return;
  }
  throw new Error(`걸어서 (${x}, ${z}) 에 닿지 못했다 — 지금 자리 ${JSON.stringify(body(w).position)}`);
}

/**
 * 그 방을 벗어날 때까지 (x, z) 쪽으로 걷는다 — 도착이 아니라 **방이 바뀜**을 기다린다.
 * 추락은 걷는 도중에 세계가 데려가는 것이므로 walkTo 로는 잡을 수 없다.
 */
function walkUntilRegionChanges(w: WorldDriver, x: number, z: number) {
  const from = body(w).regionId;
  expect(w.dispatch({ interactionId: 'move', position: { x, z } }).status).toBe('success');
  const steps = Math.ceil(120 / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    w.tick(TICK_INTERVAL);
    if (body(w).regionId !== from) return;
  }
  throw new Error(`${from} 에서 (${x}, ${z}) 쪽으로 걸었는데 방이 바뀌지 않았다`);
}

const cross = (w: WorldDriver, connector: string) =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector });

const askTransit = (w: WorldDriver, connector: string) =>
  w.dispatchForOutcome({ interactionId: 'transit', targetEntityId: connector })[0];

/** 그 방의 anchor 자리에 서서 그 Connector 로 건넌다 — 수락을 기대한다 */
function crossFrom(w: WorldDriver, region: string, tag: string, connector: string) {
  const at = anchorAt(region, tag);
  if (!at) throw new Error(`${region} 에 anchor ${tag} 가 없다`);
  walkTo(w, at.x, at.z);
  expect(cross(w, connector)).toMatchObject({ status: 'success' });
}

/** 백왕령 → 숲 가장자리 → 숲 안쪽 (C002 의 길) */
function toForestDeep(w: WorldDriver) {
  crossFrom(w, WHITE_KING_DOMAIN, FOREST_PATH, FOREST_PATH);
  crossFrom(w, FOREST_EDGE, DEEP_TRAIL, DEEP_TRAIL);
}

/** … → 붉은 눈의 거목 */
function toRedEyeTree(w: WorldDriver) {
  toForestDeep(w);
  crossFrom(w, FOREST_DEEP, TREE_APPROACH, TREE_APPROACH);
}

/** … → 거목 내부 세계 (작은 문을 건넌다) */
function toTreeInnerWorld(w: WorldDriver) {
  toRedEyeTree(w);
  crossFrom(w, RED_EYE_TREE, 'INNER_DOOR', TREE_INNER_DOOR);
}

/** 거목 내부 세계 안에 바로 세운 세계 — 추락 판정만 보려는 자리 */
function inInnerWorld(at: { x: number; z: number }): WorldDriver {
  return driveWorld({ ...solo, actorRegion: TREE_INNER_WORLD, actorPosition: at });
}

// ─────────────────────────────────────────────────────────────

describe('SPEC-001 — 방이 늘고 깊이가 넷이 된다', () => {
  it('S-001 이 Cycle 이 세운 방 셋이 있다 — RED_EYE_TREE(wild) · TREE_INNER_WORLD(deep) · HEART_LAKE(deep)', () => {
    // Given 세계가 만들어진다
    const ids = REGION_SPECS.map((r) => r.id);
    // Then 셋이 있고 depth 가 표 그대로다 (총 개수는 세지 않는다 — 존재와 행동만 본다)
    for (const id of C003_REGIONS) expect(ids).toContain(id);
    expect(regionSpec(RED_EYE_TREE)?.depth).toBe('wild');
    expect(regionSpec(TREE_INNER_WORLD)?.depth).toBe('deep');
    expect(regionSpec(HEART_LAKE)?.depth).toBe('deep');
  });

  it('S-002 depth 값이 넷이 되고 배정이 표 그대로다 — civil · outer · wild · deep', () => {
    // Given 아홉 방의 depth 를 방마다 읽는다 (합계가 아니라 배정을 본다)
    const depthOf = (id: string) => regionSpec(id)?.depth;
    expect(depthOf(WHITE_KING_DOMAIN)).toBe('civil');
    expect(depthOf(FOREST_EDGE)).toBe('outer');
    for (const id of [FOREST_DEEP, EXPLORER_RUIN, PREDATOR_NEST, BIO_ORE_FIELD, RED_EYE_TREE]) {
      expect(depthOf(id)).toBe('wild');
    }
    for (const id of [TREE_INNER_WORLD, HEART_LAKE]) expect(depthOf(id)).toBe('deep');
    // deep 이 이번에 처음 나온다
    expect(new Set(REGION_SPECS.map((r) => r.depth))).toContain('deep');
  });

  it('S-003 extent 는 TREE_INNER_WORLD 만 한 변 80 이고 나머지 여덟은 한 변 40 이다 (확정 4)', () => {
    expect(regionSpec(TREE_INNER_WORLD)?.space.extent).toEqual(BIG_EXTENT);
    for (const id of [...C002_REGIONS, RED_EYE_TREE, HEART_LAKE]) {
      expect(regionSpec(id)?.space.extent).toEqual(SMALL_EXTENT);
    }
  });

  it('S-004 (경계) 새 방 셋에는 anchor 말고 아무 것도 없다 — 몸도 광맥도 놓이지 않는다', () => {
    // Given 기본 배치의 세계
    const s = state(driveWorld());
    // Then 새 방 셋에는 Actor · Deposit 이 하나도 없다
    for (const id of C003_REGIONS) {
      expect(s.actors.some((a) => a.regionId === id)).toBe(false);
      expect(s.deposits.some((d) => d.regionId === id)).toBe(false);
    }
  });
});

describe('SPEC-002 — 새 anchor 는 표의 자리다', () => {
  it('S-005 Description 의 anchor layer 에 표의 자리가 그대로 있다', () => {
    // Given / Then — 표가 원본이다
    for (const [region, table] of Object.entries(NEW_ANCHORS)) {
      for (const [tag, at] of Object.entries(table)) {
        expect({ region, tag, at: anchorAt(region, tag) }).toEqual({ region, tag, at });
      }
    }
  });

  it('S-006 한 Region 안에서 anchor tag 는 유일하고, 자리도 서로 겹치지 않는다', () => {
    for (const id of [...C002_REGIONS, ...C003_REGIONS]) {
      const points = pointsOf(regionSpec(id)!.space, ANCHOR_LAYER);
      const tags = points.map((p) => p.tag);
      expect(new Set(tags).size).toBe(tags.length);
      const places = points.map((p) => `${p.position.x},${p.position.z}`);
      expect(new Set(places).size).toBe(places.length);
    }
  });

  it('S-007 모든 새 anchor 가 자기 방의 extent 안이다 — 큰 방의 (0, ±38) 도 안이다', () => {
    for (const [region, table] of Object.entries(NEW_ANCHORS)) {
      const extent = regionSpec(region)!.space.extent;
      for (const at of Object.values(table)) {
        expect(at.x).toBeGreaterThanOrEqual(extent.minX);
        expect(at.x).toBeLessThanOrEqual(extent.maxX);
        expect(at.z).toBeGreaterThanOrEqual(extent.minZ);
        expect(at.z).toBeLessThanOrEqual(extent.maxZ);
      }
    }
  });

  it('S-008 (경계) 숲 안쪽에 RIVER_MOUTH 가 생겼지만 그 방에서 나가는 끝은 다섯 그대로다', () => {
    // Given 숲 안쪽에 선다
    const w = driveWorld(solo);
    toForestDeep(w);
    const v = w.observe();
    // Then anchor 는 하나 늘었는데 출구 표식은 다섯이고 RIVER_MOUTH 는 그 안에 없다
    expect(anchorAt(FOREST_DEEP, 'RIVER_MOUTH')).toEqual({ x: 14, z: -8 });
    expect(exits(v).length).toBe(5);
    expect(exits(v).map((e) => e.id)).not.toContain('RIVER_MOUTH');
    expect(exits(v).some((e) => e.position.x === 14 && e.position.z === -8)).toBe(false);
  });
});

describe('SPEC-003 — Connector 셋이 C002 의 열 뒤에 이 순서로 이어진다', () => {
  const connectorOf = (id: string) => REGION_GRAPH.connectors.find((c) => c.id === id);
  const indexOf = (id: string) => REGION_GRAPH.connectors.findIndex((c) => c.id === id);

  it('S-009 세 Connector 가 표 그대로 있다 — TREE_INNER_DOOR · TREE_FALL · HEART_RIVER', () => {
    expect(connectorOf(TREE_INNER_DOOR)).toEqual({
      id: TREE_INNER_DOOR,
      from: { region: RED_EYE_TREE, anchor: 'INNER_DOOR' },
      to: { region: TREE_INNER_WORLD, anchor: 'OUTER_DOOR' },
      direction: 'bidirectional',
      transition: 'door',
    });
    expect(connectorOf(TREE_FALL)).toEqual({
      id: TREE_FALL,
      from: { region: TREE_INNER_WORLD, anchor: 'FALL' },
      to: { region: HEART_LAKE, anchor: 'FALL_LANDING' },
      direction: 'one-way',
      transition: 'falling',
    });
    expect(connectorOf(HEART_RIVER)).toEqual({
      id: HEART_RIVER,
      from: { region: HEART_LAKE, anchor: 'RIVER' },
      to: { region: FOREST_DEEP, anchor: 'RIVER_MOUTH' },
      direction: 'one-way',
      transition: 'river',
    });
  });

  it('S-010 C002 의 열이 이 순서로 앞에 있고 새 셋이 그 뒤에 이 순서로 온다 (exitsOf 의 결정론)', () => {
    const c002 = [
      FOREST_PATH,
      RUIN_TRAIL,
      DEEP_TRAIL,
      NEST_TRAIL,
      ORE_TRAIL,
      TREE_APPROACH,
      ORE_TREE_TRAIL,
      ANCIENT_GATE,
      RED_WASTE_PASS,
      ICE_CANYON_PASS,
    ];
    expect(REGION_GRAPH.connectors.slice(0, c002.length).map((c) => c.id)).toEqual(c002);
    expect(indexOf(TREE_INNER_DOOR)).toBeGreaterThan(indexOf(ICE_CANYON_PASS));
    expect(indexOf(TREE_FALL)).toBeGreaterThan(indexOf(TREE_INNER_DOOR));
    expect(indexOf(HEART_RIVER)).toBeGreaterThan(indexOf(TREE_FALL));
  });

  it('S-011 (경계) C002 의 열은 하나도 바뀌지 않는다 — 거목 쪽 끝 둘도 그대로다', () => {
    expect(connectorOf(TREE_APPROACH)).toEqual({
      id: TREE_APPROACH,
      from: { region: FOREST_DEEP, anchor: TREE_APPROACH },
      to: { region: RED_EYE_TREE, anchor: 'FOREST_DEEP_SIDE' },
      direction: 'bidirectional',
      transition: 'interaction',
    });
    expect(connectorOf(ORE_TREE_TRAIL)).toEqual({
      id: ORE_TREE_TRAIL,
      from: { region: BIO_ORE_FIELD, anchor: 'TREE_TRAIL' },
      to: { region: RED_EYE_TREE, anchor: 'ORE_SIDE' },
      direction: 'bidirectional',
      transition: 'trail',
    });
  });

  it('S-012 방마다 나갈 곳의 수 — 거목 3 · 거목 내부 세계 2 · 심장 호수 1 (그 방의 관찰 결과다)', () => {
    const w = driveWorld(solo);
    toRedEyeTree(w);
    expect(exits(w.observe()).length).toBe(3);
    expect(exits(w.observe()).map((e) => e.id).sort()).toEqual(
      [TREE_APPROACH, ORE_TREE_TRAIL, TREE_INNER_DOOR].sort(),
    );

    crossFrom(w, RED_EYE_TREE, 'INNER_DOOR', TREE_INNER_DOOR);
    expect(exits(w.observe()).length).toBe(2);
    expect(exits(w.observe()).map((e) => e.id).sort()).toEqual([TREE_INNER_DOOR, TREE_FALL].sort());

    walkUntilRegionChanges(w, 0, 38); // 요청 없이 떨어진다
    expect(body(w).regionId).toBe(HEART_LAKE);
    expect(exits(w.observe()).length).toBe(1);
    expect(exitOf(w.observe(), HEART_RIVER)?.kind).toBe('river');
  });
});

describe('SPEC-004 — 중첩이 세계 데이터에 있다', () => {
  it('S-013 containment 가 표의 사슬 둘이다 — 거목 ⊃ 거목 내부 세계 ⊃ 심장 호수', () => {
    expect(REGION_GRAPH.containment).toContainEqual({
      parent: RED_EYE_TREE,
      child: TREE_INNER_WORLD,
    });
    expect(REGION_GRAPH.containment).toContainEqual({
      parent: TREE_INNER_WORLD,
      child: HEART_LAKE,
    });
  });

  it('S-014 (경계) 중첩은 관찰 결과에 실리지 않는다 — 부모의 이름도 사슬도 화면에 없다', () => {
    const w = driveWorld(solo);
    toTreeInnerWorld(w);
    const text = JSON.stringify(w.observe());
    expect(text).not.toContain(`"${RED_EYE_TREE}"`);
    expect(text).not.toContain('containment');
    expect(text).not.toContain('parent');
  });

  it('S-015 (경계) Spatial Embedding 이 없다 — 자식의 extent 가 부모보다 넓어도 오류가 아니다', () => {
    // Given 중첩의 자식이 부모보다 크다
    const parent = regionSpec(RED_EYE_TREE)!.space.extent;
    const child = regionSpec(TREE_INNER_WORLD)!.space.extent;
    expect(child.maxX - child.minX).toBeGreaterThan(parent.maxX - parent.minX);
    // Then 검사가 오류를 내지 않는다
    expect(checkGraph(descriptions(), REGION_GRAPH, ANCHOR_LAYER, WHITE_KING_DOMAIN)).toEqual([]);
  });
});

describe('SPEC-005 — 안이 밖보다 크다', () => {
  it('S-016 작은 문을 건너면 OUTER_DOOR(0, −38) 에 서고 방은 한 변 80 이다', () => {
    // Given 관찰자의 몸이 붉은 눈의 거목의 INNER_DOOR 에 있다
    const w = driveWorld(solo);
    toRedEyeTree(w);
    expect(body(w).regionId).toBe(RED_EYE_TREE);
    // When 작은 문을 건넌다
    crossFrom(w, RED_EYE_TREE, 'INNER_DOOR', TREE_INNER_DOOR);
    // Then 큰 방의 반대쪽 anchor 에 선다
    expect(body(w).regionId).toBe(TREE_INNER_WORLD);
    expect(body(w).position).toEqual({ x: 0, z: -38 });
    expect(body(w).velocity).toEqual({ x: 0, z: 0 });
    expect(body(w).currentAction.kind).toBe('idle');
    expect(w.observe().scene).toBe(TREE_INNER_WORLD);
    expect(hud(w.observe(), 'region.depth')).toBe('deep');
  });

  it('S-017 (0, 38) 이동은 받아들여지고 (0, 41) 은 out-of-bounds 다 (RULE-MOVE-001 그대로)', () => {
    const w = driveWorld(solo);
    toTreeInnerWorld(w);
    // 요청만 본다 — 실제로 걸어가면 FALL anchor 에 닿아 떨어진다 (SPEC-006)
    expect(w.dispatch({ interactionId: 'move', position: { x: 0, z: 38 } })).toMatchObject({
      status: 'success',
      rule: 'RULE-MOVE-001',
    });
    expect(w.dispatch({ interactionId: 'move', position: { x: 0, z: 41 } })).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'out-of-bounds',
    });
    expect(w.dispatch({ interactionId: 'move', position: { x: 40, z: -40 } }).status).toBe('success');
  });

  it('S-018 같은 좌표가 큰 방에서는 안이고 작은 방에서는 밖이다 — 넓이가 네 배다', () => {
    const small = driveWorld(solo);
    toRedEyeTree(small);
    expect(small.dispatch({ interactionId: 'move', position: { x: 0, z: 38 } })).toMatchObject({
      status: 'failure',
      reason: 'out-of-bounds',
    });
    // 한 변이 두 배 → 넓이는 네 배
    const area = (id: string) => {
      const e = regionSpec(id)!.space.extent;
      return (e.maxX - e.minX) * (e.maxZ - e.minZ);
    };
    expect(area(TREE_INNER_WORLD)).toBe(area(RED_EYE_TREE) * 4);
  });

  it('S-019 (경계) 되돌아가는 문은 RED_EYE_TREE.INNER_DOOR(0, 6) 로 나온다 — 들어간 자리다', () => {
    const w = driveWorld(solo);
    toTreeInnerWorld(w);
    // OUTER_DOOR 자리에 그대로 서 있으므로 같은 Connector 를 바로 건널 수 있다
    expect(cross(w, TREE_INNER_DOOR)).toMatchObject({ status: 'success' });
    expect(body(w).regionId).toBe(RED_EYE_TREE);
    expect(body(w).position).toEqual({ x: 0, z: 6 });
    expect(w.observe().scene).toBe(RED_EYE_TREE);
  });
});

describe('SPEC-006 — 추락은 요청 없이 일어난다', () => {
  it('S-020 FALL anchor 이내에 서 있으면 요청 하나 없이 Tick 하나로 심장 호수에 선다', () => {
    // Given 몸이 거목 내부 세계의 FALL(0, 38) 로부터 INTERACTION_RANGE 이내에 있다
    const w = inInnerWorld({ x: 0, z: 38 - INTERACTION_RANGE + 0.5 });
    // When 아무 요청도 하지 않고 Tick 을 하나 돈다
    w.tick(TICK_INTERVAL);
    // Then 세계가 데려간다
    expect(body(w).regionId).toBe(HEART_LAKE);
    expect(body(w).position).toEqual({ x: 0, z: 0 });
    expect(body(w).velocity).toEqual({ x: 0, z: 0 });
    expect(body(w).currentAction.kind).toBe('idle');
    expect(w.observe().scene).toBe(HEART_LAKE);
  });

  it('S-021 범위 밖이면 아무 일도 없다 — 거리가 판정한다', () => {
    // Given FALL 로부터 INTERACTION_RANGE 보다 멀다
    const w = inInnerWorld({ x: 0, z: 38 - INTERACTION_RANGE - 1 });
    // When Tick 을 여러 번 돈다
    tickFor(w, 2);
    // Then 그 방에 그대로 있다
    expect(body(w).regionId).toBe(TREE_INNER_WORLD);
    expect(body(w).position.z).toBeCloseTo(38 - INTERACTION_RANGE - 1);
  });

  it('S-022 (경계 ①) 진행 중인 행동이 있어도 떨어진다 — 추락은 대체 가능성을 묻지 않는다', () => {
    // 판정 방식 메모: 몸이 FALL 범위에 **드는** 그 Tick 의 끝에서 추락이 일어나므로,
    // "범위 안 + 진행 중인 행동" 을 미리 만들어 둘 수 없다. 그래서 범위에 드는 Tick 직전의
    // currentAction 을 읽어 "행동이 진행 중이었는가" 를 본다 (spec 이 침묵한 자리 · 보고 ①).
    const w = inInnerWorld({ x: 0, z: 30 });
    expect(w.dispatch({ interactionId: 'move', position: { x: 0, z: 38 } }).status).toBe('success');

    let actionBefore = 'idle';
    const steps = Math.ceil(120 / TICK_INTERVAL);
    for (let i = 0; i < steps; i++) {
      actionBefore = body(w).currentAction.kind;
      w.tick(TICK_INTERVAL);
      if (body(w).regionId !== TREE_INNER_WORLD) break;
    }
    // Then 행동이 진행 중이었는데도 떨어졌고, 떨어진 뒤의 행동은 idle 이다
    expect(actionBefore).not.toBe('idle');
    expect(body(w).regionId).toBe(HEART_LAKE);
    expect(body(w).currentAction.kind).toBe('idle');
    expect(body(w).velocity).toEqual({ x: 0, z: 0 });
  });

  it('S-022b (경계 ①) 같은 상황에서 **요청**은 대체 가능성을 묻는다 — 그 차이가 추락의 뜻이다', () => {
    // Given 문 anchor 위에서 대체 불가 행동(attack)을 시작한다
    const w = driveWorld({ ...solo, actorRegion: TREE_INNER_WORLD, actorPosition: { x: 0, z: -38 } });
    expect(w.dispatch({ interactionId: 'attack' })).toMatchObject({ status: 'success' });
    // Then 건너기 요청은 action-busy 로 거절된다 (RULE-REGION-TRANSIT-001 은 묻는다)
    expect(askTransit(w, TREE_INNER_DOOR)).toMatchObject({
      accepted: false,
      reason: 'action-busy',
    });
    expect(body(w).regionId).toBe(TREE_INNER_WORLD);
  });

  it('S-022c (경계 ①) 대체 불가 행동이 받아들여진 그 Tick 에도 떨어진다 — 행동을 묻지 않는다', () => {
    // Given 몸이 FALL 범위 안에 서는 그 Tick 에 대체 불가 행동을 요청한다.
    //       driveWorld 는 join 뒤에 Tick 을 하나 돌므로 이 자리만 createWorld 로 직접 짠다.
    const world = createWorld({
      npcs: [],
      actorRegion: TREE_INNER_WORLD,
      actorPosition: { x: 0, z: 38 - INTERACTION_RANGE + 0.5 },
    });
    world.join(OBSERVER);
    world.request(OBSERVER, { interactionId: 'attack' });

    // When 그 Tick 을 돈다
    const { outcomes } = world.tick(0);

    // Then 행동은 받아들여졌고(거절이 아니다) 그럼에도 떨어졌다
    expect(outcomes.get(OBSERVER)).toMatchObject([{ accepted: true }]);
    const actor = (world.snapshot().state as WorldState).actors.find((a) => a.id === PLAYER)!;
    expect(actor.regionId).toBe(HEART_LAKE);
    expect(actor.position).toEqual({ x: 0, z: 0 });
    expect(actor.currentAction.kind).toBe('idle'); // 추락이 하던 일을 끝낸다
    expect(actor.velocity).toEqual({ x: 0, z: 0 });
  });

  it('S-023 (경계 ①) 걷는 중에도 떨어진다 — 반대편 끝으로 걸어가면 scene 이 바뀐다', () => {
    const w = driveWorld(solo);
    toTreeInnerWorld(w);
    expect(w.observe().scene).toBe(TREE_INNER_WORLD);
    // When 반대편 끝으로 걸어간다 (Q 를 누르지 않는다)
    walkUntilRegionChanges(w, 0, 38);
    // Then 심장 호수다
    expect(body(w).regionId).toBe(HEART_LAKE);
    expect(body(w).position).toEqual({ x: 0, z: 0 });
    expect(w.observe().scene).toBe(HEART_LAKE);
    expect(hud(w.observe(), 'region.depth')).toBe('deep');
  });

  it('S-024 (경계 ②) 방금 떨어진 몸은 다음 Tick 에 다시 떨어지지 않는다', () => {
    const w = inInnerWorld({ x: 0, z: 38 - INTERACTION_RANGE + 0.5 });
    w.tick(TICK_INTERVAL);
    expect(body(w).regionId).toBe(HEART_LAKE);
    // When Tick 을 더 돈다 — 떨어진 자리(0, 0) 에 그대로 서 있다
    tickFor(w, 3);
    expect(body(w).regionId).toBe(HEART_LAKE);
    expect(body(w).position).toEqual({ x: 0, z: 0 });
  });

  it('S-025 (경계 ③) falling 이 아닌 Connector 의 anchor 위에 서 있어도 아무 일이 없다', () => {
    // Given door · trail · road · interaction · pass 의 anchor 위
    const cases: [string, { x: number; z: number }][] = [
      [RED_EYE_TREE, { x: 0, z: 6 }], // TREE_INNER_DOOR — door
      [RED_EYE_TREE, { x: 18, z: 0 }], // ORE_TREE_TRAIL — trail
      [WHITE_KING_DOMAIN, { x: 0, z: 18 }], // FOREST_PATH — road
      [WHITE_KING_DOMAIN, { x: 18, z: 0 }], // RED_WASTE_PASS — pass
      [FOREST_DEEP, { x: 0, z: 18 }], // TREE_APPROACH — interaction
      [HEART_LAKE, { x: 0, z: -18 }], // HEART_RIVER — river
    ];
    for (const [region, at] of cases) {
      const w = driveWorld({ ...solo, actorRegion: region, actorPosition: at });
      tickFor(w, 2);
      expect({ region, id: body(w).regionId, at: body(w).position }).toEqual({
        region,
        id: region,
        at,
      });
    }
  });

  it('S-026 (경계 ③) 심장 호수에는 falling 이 없다 — FALL_LANDING 위에서도 옮겨지지 않는다', () => {
    const w = driveWorld({ ...solo, actorRegion: HEART_LAKE, actorPosition: { x: 0, z: 0 } });
    tickFor(w, 3);
    expect(body(w).regionId).toBe(HEART_LAKE);
    expect(body(w).position).toEqual({ x: 0, z: 0 });
  });
});

describe('SPEC-007 — 떨어진 자리에서는 돌아갈 수 없다', () => {
  /** 떨어진 직후의 심장 호수 */
  function fallen(): WorldDriver {
    const w = inInnerWorld({ x: 0, z: 38 - INTERACTION_RANGE + 0.5 });
    w.tick(TICK_INTERVAL);
    expect(body(w).regionId).toBe(HEART_LAKE);
    return w;
  }

  it('S-027 출구 표식이 하나뿐이고 그 kind 는 river 다 · transit 도 하나다', () => {
    const v = fallen().observe();
    expect(v.scene).toBe(HEART_LAKE);
    expect(exits(v).length).toBe(1);
    expect(exits(v)[0]).toEqual({
      id: HEART_RIVER,
      role: 'region-exit',
      state: 'open',
      kind: 'river',
      position: { x: 0, z: -18 },
    });
    expect(transits(v).length).toBe(1);
    expect(transits(v)[0]?.targetEntityId).toBe(HEART_RIVER);
  });

  it('S-028 떨어져 선 자리(0, 0) 에는 아무 표식도 없다', () => {
    const v = fallen().observe();
    expect(exits(v).some((e) => e.position.x === 0 && e.position.z === 0)).toBe(false);
    expect(exitOf(v, TREE_FALL)).toBeUndefined();
  });

  it('S-029 (경계) TREE_FALL 로 건너기를 요청하면 wrong-region 이다 (C001 의 사유 그대로)', () => {
    const w = fallen();
    expect(askTransit(w, TREE_FALL)).toMatchObject({
      accepted: false,
      rule: 'RULE-REGION-TRANSIT-001',
      reason: 'wrong-region',
    });
    expect(body(w).regionId).toBe(HEART_LAKE);
    expect(body(w).position).toEqual({ x: 0, z: 0 });
  });

  it('S-030 관찰 결과에 다른 방의 이름도 목적지도 없다', () => {
    const text = JSON.stringify(fallen().observe());
    for (const name of [...C002_REGIONS, RED_EYE_TREE, TREE_INNER_WORLD]) {
      expect(text).not.toContain(`"${name}"`);
    }
  });
});

describe('SPEC-008 — 물길은 다른 자리로 낸다', () => {
  /** 떨어진 뒤 물길까지 걸어가 건넌다 */
  function throughRiver(): WorldDriver {
    const w = inInnerWorld({ x: 0, z: 38 - INTERACTION_RANGE + 0.5 });
    w.tick(TICK_INTERVAL);
    walkTo(w, 0, -18);
    expect(cross(w, HEART_RIVER)).toMatchObject({ status: 'success' });
    return w;
  }

  it('S-031 물길로 나온 자리가 FOREST_DEEP 의 RIVER_MOUTH(14, −8) 다', () => {
    const w = throughRiver();
    expect(body(w).regionId).toBe(FOREST_DEEP);
    expect(body(w).position).toEqual({ x: 14, z: -8 });
    expect(body(w).velocity).toEqual({ x: 0, z: 0 });
    expect(body(w).currentAction.kind).toBe('idle');
    expect(w.observe().scene).toBe(FOREST_DEEP);
  });

  it('S-032 거목으로 나갔던 TREE_APPROACH(0, 18) 와 다른 자리다', () => {
    const w = throughRiver();
    expect(anchorAt(FOREST_DEEP, TREE_APPROACH)).toEqual({ x: 0, z: 18 });
    expect(body(w).position).not.toEqual({ x: 0, z: 18 });
  });

  // C004 가 데이터로 열었다 — 닫힌 목록이 비면서 이 기대가 뒤집혔다 (규칙은 한 글자도 안 바뀌었다).
  it('S-033 그 방의 출구 다섯이 다시 실리고 이제 다섯이 전부 open 이다 (고대 문도 열렸다)', () => {
    const v = throughRiver().observe();
    expect(exits(v).length).toBe(5);
    expect(exits(v).filter((e) => e.state === 'locked').map((e) => e.id)).toEqual([]);
    expect(exitOf(v, ANCIENT_GATE)?.kind).toBe('door'); // 갈래는 그대로 door 다
    for (const id of [DEEP_TRAIL, NEST_TRAIL, ORE_TRAIL, TREE_APPROACH, ANCIENT_GATE]) {
      expect(exitOf(v, id)?.state).toBe('open');
    }
    expect(hud(v, 'region.depth')).toBe('wild');
  });

  it('S-034 (경계) 숲 안쪽에서 HEART_RIVER 로 되건너기를 요청하면 wrong-region 이다 — one-way 다', () => {
    const w = throughRiver();
    expect(askTransit(w, HEART_RIVER)).toMatchObject({
      accepted: false,
      reason: 'wrong-region',
    });
    expect(body(w).regionId).toBe(FOREST_DEEP);
    // RIVER_MOUTH 자리에 그대로 서 있어도 마찬가지다 — 자리가 아니라 방향의 문제다
    expect(body(w).position).toEqual({ x: 14, z: -8 });
  });
});

describe('SPEC-009 — 검사가 중첩을 알고, 경계가 하나 줄었다', () => {
  const withGraph = (patch: object) => ({ ...REGION_GRAPH, ...patch }) as typeof REGION_GRAPH;

  it('S-035 이 Cycle 의 데이터로 검사를 돌리면 오류가 하나도 없다 · 두 번 돌려도 같다 (읽기 전용)', () => {
    const first = checkGraph(descriptions(), REGION_GRAPH, ANCHOR_LAYER, WHITE_KING_DOMAIN);
    expect(first).toEqual([]);
    const second = checkGraph(descriptions(), REGION_GRAPH, ANCHOR_LAYER, WHITE_KING_DOMAIN);
    expect(second).toEqual(first);
  });

  it('S-036 ① 부모와 자식을 잇는 Connector 가 없으면 containment-unlinked (검사 ⑥)', () => {
    // Given 거목 ⊃ 거목 내부 세계 를 잇던 문을 끊는다
    const cut = withGraph({
      connectors: REGION_GRAPH.connectors.filter((c) => c.id !== TREE_INNER_DOOR),
    });
    // Then 검사가 그 사슬을 잡아낸다
    const issues = checkGraph(descriptions(), cut, ANCHOR_LAYER, WHITE_KING_DOMAIN);
    expect(JSON.stringify(issues)).toContain('containment-unlinked');
  });

  it('S-037 ① 방향은 묻지 않는다 — one-way 하나로도 이어진 것이다 (추락은 one-way 다)', () => {
    // TREE_INNER_WORLD ⊃ HEART_LAKE 는 one-way(TREE_FALL) 하나로만 이어져 있는데 오류가 아니다
    expect(REGION_GRAPH.connectors.find((c) => c.id === TREE_FALL)?.direction).toBe('one-way');
    expect(checkGraph(descriptions(), REGION_GRAPH, ANCHOR_LAYER, WHITE_KING_DOMAIN)).toEqual([]);
    // 그 하나마저 끊으면 잡힌다
    const cut = withGraph({
      connectors: REGION_GRAPH.connectors.filter((c) => c.id !== TREE_FALL),
    });
    expect(JSON.stringify(checkGraph(descriptions(), cut, ANCHOR_LAYER, WHITE_KING_DOMAIN))).toContain(
      'containment-unlinked',
    );
  });

  it('S-038 ② RED_EYE_TREE 는 경계 목록에서 빠졌고 남은 것은 전부 가리켜져 있다', () => {
    expect(graphFrontiers).not.toContain(RED_EYE_TREE);
    // C008 이 환상의 미로를 지어 그 이름도 이 목록에서 뺐다.
    // C009 가 심장에서 나가는 문으로 뒤집힌 정원을 가리켜 새 이름 하나를 더했다 — 경계는 셋이다.
    // C003 의 주장(지어진 방은 경계 목록에 남지 않는다 · 밝힌 경계는 전부 가리켜져 있다)은
    // 한 글자도 바뀌지 않았고 목록만 오갔다.
    expect([...graphFrontiers].sort()).toEqual(['ICE_CANYON', 'INVERTED_GARDEN', 'RED_WASTE']);
    expect(graphFrontiers).not.toContain('FANTASY_MAZE');

    const pointed = new Set<string>();
    for (const c of REGION_GRAPH.connectors) for (const end of [c.from, c.to]) pointed.add(end.region);
    for (const name of graphFrontiers) expect(pointed.has(name)).toBe(true);

    const built = new Set(REGION_SPECS.map((r) => r.id));
    for (const name of graphFrontiers) expect(built.has(name)).toBe(false);
  });

  it('S-039 ② 경계로 밝혔는데 Description 이 있으면 frontier-built — 거목을 다시 넣으면 잡힌다', () => {
    const issues = checkGraph(
      descriptions(),
      withGraph({ frontiers: [...graphFrontiers, RED_EYE_TREE] }),
      ANCHOR_LAYER,
      WHITE_KING_DOMAIN,
    );
    expect(JSON.stringify(issues)).toContain('frontier-built');
  });

  it('S-040 ③ 지어진 방 전부가 WHITE_KING_DOMAIN 에서 Connector 를 따라 닿는다', () => {
    const reached = new Set(reachableRegions(REGION_GRAPH, WHITE_KING_DOMAIN));
    for (const spec of REGION_SPECS) expect([...reached]).toContain(spec.id);
    for (const id of C003_REGIONS) expect([...reached]).toContain(id);
  });

  it('S-041 (경계) 검사는 세계를 바꾸지 않는다 — 돌린 뒤에도 데이터가 그대로다', () => {
    const before = JSON.stringify({ specs: REGION_SPECS, graph: REGION_GRAPH });
    checkGraph(descriptions(), REGION_GRAPH, ANCHOR_LAYER, WHITE_KING_DOMAIN);
    expect(JSON.stringify({ specs: REGION_SPECS, graph: REGION_GRAPH })).toBe(before);
  });
});

describe('SPEC-010 — 관찰 계약과 영속은 형이 그대로다', () => {
  it('S-042 이 Cycle 은 저장되는 State 의 형을 늘리지 않았다', () => {
    // C003 은 이 값을 'hkt-adv-proto-i/2' 로 못박아 "올리지 않았다" 를 말했다.
    // C008 이 Region State 를 저장하면서 그 값을 올렸으므로(spec R5) 글자를 재는 것은
    // 더 이상 C003 의 주장이 아니다 — 남은 것은 "세계가 찍는 판이 팩의 판과 같다" 다.
    expect(driveWorld(solo).world.snapshot().version).toBe(STATE_VERSION);
  });

  it('S-043 저장/복구가 새 방에서도 돈다 — 되살린 몸이 심장 호수에 그대로 서 있다', () => {
    const w = inInnerWorld({ x: 0, z: 38 - INTERACTION_RANGE + 0.5 });
    w.tick(TICK_INTERVAL);
    expect(body(w).regionId).toBe(HEART_LAKE);

    const saved = JSON.parse(JSON.stringify(w.world.snapshot()));
    const restored = restoreWorld(saved);
    expect(restored).not.toBeNull();
    expect(restored!.actors.find((a) => a.id === PLAYER)?.regionId).toBe(HEART_LAKE);

    const revived = createWorld({}, restored!);
    revived.join(OBSERVER);
    revived.tick(0);
    const v = revived.latestObservation(OBSERVER) as GameViewSnapshot;
    expect(v.scene).toBe(HEART_LAKE);
    expect(exits(v).length).toBe(1);
    expect(exits(v)[0]?.kind).toBe('river');
  });

  it('S-044 큰 방에서 저장해도 형이 같다 — 중첩 · 방 크기 · 시점 거리는 스냅샷에 없다', () => {
    const w = driveWorld(solo);
    toTreeInnerWorld(w);
    const saved = JSON.parse(JSON.stringify(w.world.snapshot()));
    for (const key of [
      'regions',
      'graph',
      'containment',
      'frontiers',
      'closedConnectors',
      'bounds',
      'extent',
    ]) {
      expect(saved.state).not.toHaveProperty(key);
    }
    expect(JSON.stringify(saved.state)).not.toContain('containment');

    const restored = restoreWorld(saved);
    expect(restored!.actors.find((a) => a.id === PLAYER)?.regionId).toBe(TREE_INNER_WORLD);
  });

  it('S-045 C001 · C002 에서 저장된 스냅샷도 그대로 되살아난다', () => {
    // C002 의 세계에서 저장한 것과 같은 모양 — 몸이 숲 안쪽에 있다
    const w = driveWorld({ actorPosition: { x: 0, z: 17 } }); // 기본 배치 (npc 둘 · 광맥 하나)
    toForestDeep(w);
    const saved = JSON.parse(JSON.stringify(w.world.snapshot()));

    const restored = restoreWorld(saved);
    expect(restored).not.toBeNull();
    expect(restored!.actors.find((a) => a.id === PLAYER)?.regionId).toBe(FOREST_DEEP);
    for (const npc of restored!.actors.filter((a) => a.id !== PLAYER)) {
      expect(npc.regionId).toBe(WHITE_KING_DOMAIN);
    }

    const revived = createWorld({}, restored!);
    revived.join(OBSERVER);
    revived.tick(0);
    const v = revived.latestObservation(OBSERVER) as GameViewSnapshot;
    expect(v.scene).toBe(FOREST_DEEP);
    expect(exits(v).length).toBe(5); // C003 이 숲 안쪽의 나갈 곳을 늘리지 않았다
  });

  it('S-046 봉투의 형이 그대로다 — kind 에 falling · river 가 값으로 더해질 뿐이다', () => {
    const w = driveWorld(solo);
    toTreeInnerWorld(w);
    const v = w.observe();
    // 큰 방의 두 출구 — door 와 falling
    expect(exitOf(v, TREE_INNER_DOOR)?.kind).toBe('door');
    expect(exitOf(v, TREE_FALL)?.kind).toBe('falling');
    for (const e of exits(v)) {
      expect(Object.keys(e).sort()).toEqual(['id', 'kind', 'position', 'role', 'state'].sort());
    }
    // falling 도 나가는 끝이므로 transit 이 실린다 — 특별한 자리를 두지 않는다
    expect(transits(v).map((i) => i.targetEntityId).sort()).toEqual(
      [TREE_INNER_DOOR, TREE_FALL].sort(),
    );
    // 방 크기 · 중첩 · 목적지는 봉투에 없다
    const text = JSON.stringify(v);
    expect(text).not.toContain('extent');
    expect(text).not.toContain(`"${HEART_LAKE}"`);
  });
});

// ── 회귀 — C001 · C002 의 REUSED / AFFECTED 행동이 그대로인가 ──

describe('회귀', () => {
  // C004 가 데이터로 열었다 — connector-inactive 를 낼 문이 이 세계에 없어졌다.
  // 사유 코드도 규칙의 전제도 그대로다: 닫힌 문 자체는 c004-polish-is-data.spec.ts 의 변형이 계속 검증한다.
  it('R-001 (C002 SPEC-006) 건너기의 사유 다섯이 이 세계의 데이터에서 관측된다', () => {
    const reasons = new Set<string>();

    const a = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    reasons.add(askTransit(a, 'NO_SUCH_PATH')!.reason!);
    reasons.add(askTransit(a, DEEP_TRAIL)!.reason!);
    reasons.add(askTransit(a, FOREST_PATH)!.reason!);

    const b = driveWorld(solo);
    walkTo(b, 18, 0);
    reasons.add(askTransit(b, RED_WASTE_PASS)!.reason!);

    // C002 에서는 connector-inactive 였고 C004 에서는 region-not-built 였다.
    // C008 이 그 너머를 지었으므로 이제 받아들여진다 — 규칙은 한 글자도 바뀌지 않았고
    // 데이터가 바뀌었을 뿐이다 (C008 SPEC-002 경계). region-not-built 는 위의 고개가 낸다.
    const gate = driveWorld(solo);
    toForestDeep(gate);
    walkTo(gate, -13, 13);
    expect(transits(gate.observe()).find((i) => i.targetEntityId === ANCIENT_GATE)).toMatchObject({
      available: true,
    });

    const c = driveWorld(solo);
    toForestDeep(c);
    walkTo(c, 0, -18);
    c.dispatch({ interactionId: 'attack' });
    reasons.add(askTransit(c, DEEP_TRAIL)!.reason!);

    expect([...reasons].sort()).toEqual(
      [
        'unknown-connector',
        'wrong-region',
        'out-of-range',
        'region-not-built',
        'action-busy',
      ].sort(),
    );
    expect([...reasons]).not.toContain('connector-inactive');
  });

  // C004 가 데이터로 열었다 — 숲 안쪽의 닫힌 문 하나가 열린 문이 됐다.
  it('R-002 (C002 SPEC-008) 숲 안쪽의 출구는 다섯이고 이제 다섯이 전부 열려 있다', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    const v = w.observe();
    expect(exits(v).length).toBe(5);
    expect(transits(v).length).toBe(5);
    expect(exits(v).filter((e) => e.state === 'locked').map((e) => e.id)).toEqual([]);
    expect(hud(v, 'region.depth')).toBe('wild');
  });

  it('R-003 (C002 SPEC-003) 백왕령의 출구는 셋이고 아직 건너지 않은 고개 둘이 그대로 남는다', () => {
    const w = driveWorld(solo);
    const v = w.observe();
    expect(exits(v).length).toBe(3);
    for (const id of [RED_WASTE_PASS, ICE_CANYON_PASS]) {
      expect(exitOf(v, id)).toMatchObject({ state: 'open', kind: 'pass' });
    }

    // 거목 안까지 갔다가 물길로 나와 백왕령까지 되짚어 와도 그대로다 (Observable Result ⑧)
    toTreeInnerWorld(w);
    walkUntilRegionChanges(w, 0, 38); // 심장 호수
    walkTo(w, 0, -18);
    expect(cross(w, HEART_RIVER)).toMatchObject({ status: 'success' }); // 숲 안쪽
    crossFrom(w, FOREST_DEEP, DEEP_TRAIL, DEEP_TRAIL); // 숲 가장자리
    crossFrom(w, FOREST_EDGE, FOREST_PATH, FOREST_PATH); // 백왕령

    const back = w.observe();
    expect(back.scene).toBe(WHITE_KING_DOMAIN);
    expect(exits(back).length).toBe(3);
    for (const id of [RED_WASTE_PASS, ICE_CANYON_PASS]) {
      expect(exitOf(back, id)).toMatchObject({ state: 'open', kind: 'pass' });
      expect(askTransit(w, id)).toMatchObject({ accepted: false }); // 여전히 건너지 못한다
    }
  });

  it('R-004 (C001 SPEC-009) 다른 방의 존재는 서로 보이지 않는다 — 거목 안에서도 그렇다', () => {
    // Given 관찰자 하나는 거목 내부 세계로, 하나는 백왕령에 남는다
    const w = driveWorld(solo);
    toTreeInnerWorld(w);
    w.join(OBSERVER_2);
    w.tick(0);

    // Then 서로의 관찰에 없다
    expect(w.observe(OBSERVER).entities.some((e) => e.id === PLAYER_2)).toBe(false);
    expect(w.observe(OBSERVER_2).entities.some((e) => e.id === PLAYER)).toBe(false);
    // 거목 내부 세계에는 내 몸과 출구 둘뿐이다 — 광맥도 자율 존재도 없다
    const v = w.observe(OBSERVER);
    expect(v.entities.filter((e) => e.role !== 'region-exit').map((e) => e.id)).toEqual([PLAYER]);
    expect(v.entities.filter((e) => e.role === 'resource-deposit')).toEqual([]);
    expect(hud(w.observe(OBSERVER_2), 'observers.present')).toBe(2); // 세계에 함께 있는 것은 그대로다
  });

  it('R-005 (C001 SPEC-009) 심장 호수에서도 다른 방의 몸·광맥이 보이지 않는다 (Observable Result ⑦)', () => {
    const w = driveWorld({ actorRegion: TREE_INNER_WORLD, actorPosition: { x: 0, z: 36.5 } });
    w.tick(TICK_INTERVAL);
    expect(body(w).regionId).toBe(HEART_LAKE);
    const v = w.observe();
    expect(v.entities.filter((e) => e.role !== 'region-exit').map((e) => e.id)).toEqual([PLAYER]);
    expect(v.entities.filter((e) => e.role === 'npc-character')).toEqual([]);
    expect(v.entities.filter((e) => e.role === 'resource-deposit')).toEqual([]);
    expect(v.interactions.filter((i) => i.id === 'mine')).toEqual([]);
  });

  it('R-006 (C002 SPEC-008 경계) 막다른 방 셋은 돌아가는 출구뿐이다 — 방이 늘어도 그대로다', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    crossFrom(w, FOREST_DEEP, NEST_TRAIL, NEST_TRAIL);
    expect(exits(w.observe()).length).toBe(1);
    expect(cross(w, NEST_TRAIL)).toMatchObject({ status: 'success' });

    crossFrom(w, FOREST_DEEP, ORE_TRAIL, ORE_TRAIL);
    expect(exits(w.observe()).length).toBe(2); // 광석 지대 — 돌아가는 길 + 거목 쪽 오솔길
    expect(cross(w, ORE_TRAIL)).toMatchObject({ status: 'success' });

    crossFrom(w, FOREST_DEEP, DEEP_TRAIL, DEEP_TRAIL);
    crossFrom(w, FOREST_EDGE, RUIN_TRAIL, RUIN_TRAIL);
    expect(exits(w.observe()).length).toBe(1);
  });

  it('R-007 (C002 SPEC-006 ⑤) 광석 지대에서 거목으로 가는 길은 이제 열린다 — 방이 지어졌다', () => {
    // C002 에서는 region-not-built 였다. 방이 지어졌으므로 이제 건너진다 (AFFECTED — 값만 바뀐다)
    const w = driveWorld(solo);
    toForestDeep(w);
    crossFrom(w, FOREST_DEEP, ORE_TRAIL, ORE_TRAIL);
    walkTo(w, 0, 18);
    expect(cross(w, ORE_TREE_TRAIL)).toMatchObject({ status: 'success' });
    expect(body(w).regionId).toBe(RED_EYE_TREE);
    expect(body(w).position).toEqual({ x: 18, z: 0 }); // ORE_SIDE
  });

  it('R-008 (C001 SPEC-004) 이동의 경계는 그 몸이 선 방의 extent 다 — 작은 방은 그대로 −20..20', () => {
    const w = driveWorld(solo);
    toRedEyeTree(w);
    expect(w.dispatch({ interactionId: 'move', position: { x: 20, z: -20 } }).status).toBe('success');
    expect(w.dispatch({ interactionId: 'move', position: { x: 20.5, z: 0 } })).toMatchObject({
      status: 'failure',
      reason: 'out-of-bounds',
    });
  });

  it('R-009 (C001 SPEC-007) 봉투의 region { id, hash } 는 방마다 다르다', () => {
    const w = driveWorld(solo);
    toRedEyeTree(w);
    const tree = w.observe().region;
    crossFrom(w, RED_EYE_TREE, 'INNER_DOOR', TREE_INNER_DOOR);
    const inner = w.observe().region;
    expect(tree.id).toBe(RED_EYE_TREE);
    expect(inner.id).toBe(TREE_INNER_WORLD);
    expect(inner.hash).not.toBe(tree.hash);
  });
});
