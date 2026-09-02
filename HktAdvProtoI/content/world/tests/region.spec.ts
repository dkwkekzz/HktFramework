// C001 — Region Graph Rooms World 단독 테스트 (01-spec SPEC-001 ~ SPEC-010)
// Implements RULE-REGION-TRANSIT-001 · RULE-MOVE-001(전제 1 CHANGED) · R3~R7

import { describe, expect, it } from 'vitest';
import { checkGraph } from '../../../engine/world-authoring/check';
import { descriptionHash } from '../../../engine/world-authoring/description';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  ANCHOR_LAYER,
  FOREST_EDGE,
  FOREST_PATH,
  REGION_GRAPH,
  REGION_SPECS,
  WHITE_KING_DOMAIN,
  regionSpec,
} from '../../regions';
import { createWorld, restoreWorld } from '../index';
import { INTERACTION_RANGE, STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';

const solo = { npcs: [] };
/** 백왕령 anchor (0, 18) 바로 앞 — 거리 1 ≤ INTERACTION_RANGE */
const nearAnchor = { actorPosition: { x: 0, z: 17 } };

const entity = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const transit = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'transit');
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
const exits = (v: GameViewSnapshot) => v.entities.filter((e) => e.role === 'region-exit');
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id: string) => state(w).actors.find((a) => a.id === id)!;

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const crossForest = (world: WorldDriver, observerId = OBSERVER) =>
  world.dispatch({ interactionId: 'transit', targetEntityId: FOREST_PATH }, observerId);

describe('SPEC-001 — Region 이 있다', () => {
  it('세계는 Region 둘을 안다 — WHITE_KING_DOMAIN(civil) · FOREST_EDGE(outer), 각각 extent −20..20', () => {
    expect(REGION_SPECS.map((r) => r.id)).toEqual([WHITE_KING_DOMAIN, FOREST_EDGE]);
    expect(regionSpec(WHITE_KING_DOMAIN)?.depth).toBe('civil');
    expect(regionSpec(FOREST_EDGE)?.depth).toBe('outer');
    for (const spec of REGION_SPECS) {
      expect(spec.space.extent).toEqual({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
    }
  });

  it('두 Region 의 좌표는 서로 무관하다 — 같은 (x, z) 에 선 두 몸이 서로 다른 방에 있다', () => {
    const world = driveWorld({ ...solo, ...nearAnchor });
    crossForest(world);
    // 숲의 anchor (0, −18) 로 옮긴 뒤 백왕령의 같은 좌표에는 아무도 없다 — 관찰에 실리지 않는다
    world.join(OBSERVER_2);
    world.tick(0);
    world.dispatch({ interactionId: 'move', position: { x: 0, z: -18 } }, OBSERVER_2);
    tickFor(world, 4);
    const p2 = actorOf(world, PLAYER_2);
    expect(p2.regionId).toBe(WHITE_KING_DOMAIN);
    expect(p2.position.z).toBeCloseTo(-18);
    expect(actorOf(world, PLAYER).position.z).toBeCloseTo(-18);
    // 같은 (x, z) 인데 서로의 관찰에 없다
    expect(entity(world.observe(OBSERVER), PLAYER_2)).toBeUndefined();
    expect(entity(world.observe(OBSERVER_2), PLAYER)).toBeUndefined();
  });
});

describe('SPEC-002 — Graph 가 있다', () => {
  it('Connector FOREST_PATH 하나 — 백왕령.FOREST_PATH ↔ 숲가장자리.FOREST_PATH · bidirectional · road', () => {
    expect(REGION_GRAPH.connectors).toEqual([
      {
        id: FOREST_PATH,
        from: { region: WHITE_KING_DOMAIN, anchor: FOREST_PATH },
        to: { region: FOREST_EDGE, anchor: FOREST_PATH },
        direction: 'bidirectional',
        transition: 'road',
      },
    ]);
  });

  it('anchor 는 각 Region 의 한 자리다 — Graph 검사에 문제가 없다', () => {
    const issues = checkGraph(
      REGION_SPECS.map((r) => r.space),
      REGION_GRAPH,
      ANCHOR_LAYER,
    );
    expect(issues).toEqual([]);
  });
});

describe('SPEC-003 — 몸은 자리를 가진다', () => {
  it('관찰자의 새 몸은 WHITE_KING_DOMAIN 에 SPAWN_POINTS 로 놓인다', () => {
    const world = driveWorld(solo);
    const body = actorOf(world, PLAYER);
    expect(body.regionId).toBe(WHITE_KING_DOMAIN);
    expect(body.position).toEqual({ x: 0, z: 0 });
  });

  it('기본 자율 존재 둘과 광맥 하나도 WHITE_KING_DOMAIN 에 있다 · FOREST_EDGE 는 비어 있다', () => {
    const world = driveWorld();
    const s = state(world);
    expect(s.actors.map((a) => a.id)).toEqual(['npc-1', 'npc-2', PLAYER]);
    for (const actor of s.actors) expect(actor.regionId).toBe(WHITE_KING_DOMAIN);
    expect(s.deposits.map((d) => d.regionId)).toEqual([WHITE_KING_DOMAIN]);
    expect(s.actors.some((a) => a.regionId === FOREST_EDGE)).toBe(false);
    expect(s.deposits.some((d) => d.regionId === FOREST_EDGE)).toBe(false);
  });
});

describe('SPEC-004 — 이동의 경계는 방이다 (RULE-MOVE-001 전제 1)', () => {
  it('그 몸이 선 Region 의 extent 안이면 이동 진입', () => {
    const world = driveWorld(solo);
    expect(world.dispatch({ interactionId: 'move', position: { x: 20, z: -20 } })).toEqual({
      status: 'success',
      rule: 'RULE-MOVE-001',
    });
  });

  it('extent 밖 목적지는 out-of-bounds 로 거절된다 (기존 사유 코드 그대로)', () => {
    const world = driveWorld(solo);
    expect(world.dispatch({ interactionId: 'move', position: { x: 20.5, z: 0 } })).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'out-of-bounds',
    });
  });

  it('건너간 뒤에도 판정은 그 방의 extent 다', () => {
    const world = driveWorld({ ...solo, ...nearAnchor });
    crossForest(world);
    expect(world.dispatch({ interactionId: 'move', position: { x: 0, z: 0 } }).status).toBe('success');
    expect(world.dispatch({ interactionId: 'move', position: { x: 0, z: -21 } })).toMatchObject({
      status: 'failure',
      reason: 'out-of-bounds',
    });
  });
});

describe('SPEC-005 — 건너기의 가용', () => {
  it('anchor 근처(≤ INTERACTION_RANGE)면 transit 이 available = true 로 실린다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 0, z: 18 - INTERACTION_RANGE } });
    const t = transit(world.observe());
    expect(t).toEqual({
      id: 'transit',
      role: 'transit-connector',
      targetEntityId: FOREST_PATH,
      available: true,
    });
  });

  it('멀면 available = false · reason = out-of-range — 요청해도 같은 사유로 거절된다 (Request.Outcome)', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    expect(transit(world.observe())).toMatchObject({ available: false, reason: 'out-of-range' });

    const outcomes = world.dispatchForOutcome({ interactionId: 'transit', targetEntityId: FOREST_PATH });
    expect(outcomes).toEqual([
      { accepted: false, rule: 'RULE-REGION-TRANSIT-001', reason: 'out-of-range' },
    ]);
    expect(actorOf(world, PLAYER).regionId).toBe(WHITE_KING_DOMAIN);
  });

  it('행동이 대체 불가면 reason = action-busy (RULE-ACTION-BEGIN-001 재사용)', () => {
    const world = driveWorld({ ...solo, ...nearAnchor });
    expect(world.dispatch({ interactionId: 'attack' }).status).toBe('success'); // attack 은 대체 불가
    expect(transit(world.observe())).toMatchObject({ available: false, reason: 'action-busy' });
    expect(crossForest(world)).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: 'action-busy',
    });
  });

  it('모르는 Connector 는 unknown-connector · 이 방에 끝이 없는 Connector 는 wrong-region', () => {
    const world = driveWorld({ ...solo, ...nearAnchor });
    expect(world.dispatch({ interactionId: 'transit', targetEntityId: 'NO_SUCH_PATH' })).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: 'unknown-connector',
    });
    // wrong-region 은 C001 의 Graph(양방향 하나)로는 도달할 수 없다 — 몸을 세계가 모르는 방에 두지 않는다.
    // 대상을 밝히지 않은 요청은 dispatch 가 거른다.
    expect(world.dispatch({ interactionId: 'transit' })).toEqual({
      status: 'failure',
      rule: 'DISPATCH',
      reason: 'missing-target',
    });
  });
});

describe('SPEC-006 — 건너기의 전이 (RULE-REGION-TRANSIT-001)', () => {
  it('가용한 건너기 → regionId = 상대 Region · position = 상대 anchor · velocity 0 · idle · 같은 Tick 부터 scene', () => {
    const world = driveWorld({ ...solo, ...nearAnchor });
    world.dispatch({ interactionId: 'move', position: { x: 0, z: 18 } }); // 진행 중인 이동은 뜻을 잃는다

    expect(crossForest(world)).toEqual({ status: 'success', rule: 'RULE-REGION-TRANSIT-001' });

    const body = actorOf(world, PLAYER);
    expect(body.regionId).toBe(FOREST_EDGE);
    expect(body.position).toEqual({ x: 0, z: -18 });
    expect(body.velocity).toEqual({ x: 0, z: 0 });
    expect(body.currentAction.kind).toBe('idle');
    expect(world.observe().scene).toBe(FOREST_EDGE);
  });

  it('양방향 — 상대 anchor 에서 같은 Connector 로 건너면 원래 anchor 로 돌아온다', () => {
    const world = driveWorld({ ...solo, ...nearAnchor });
    crossForest(world);
    expect(transit(world.observe())).toMatchObject({ available: true, targetEntityId: FOREST_PATH });

    expect(crossForest(world).status).toBe('success');
    const body = actorOf(world, PLAYER);
    expect(body.regionId).toBe(WHITE_KING_DOMAIN);
    expect(body.position).toEqual({ x: 0, z: 18 });
    expect(world.observe().scene).toBe(WHITE_KING_DOMAIN);
  });
});

describe('SPEC-007 — 관찰은 방으로 잘린다', () => {
  it('① scene = R.id ② 같은 방의 몸·광맥만 ③ anchor 마다 region-exit ④ 봉투 region { id, hash }', () => {
    const world = driveWorld(nearAnchor); // 기본 배치 — npc 둘 · deposit-1 이 백왕령에 있다
    const v = world.observe();

    expect(v.scene).toBe(WHITE_KING_DOMAIN);
    expect(v.entities.map((e) => e.id).sort()).toEqual(
      [PLAYER, 'npc-1', 'npc-2', 'deposit-1', FOREST_PATH].sort(),
    );
    expect(exits(v)).toEqual([
      { id: FOREST_PATH, role: 'region-exit', state: 'open', kind: 'road', position: { x: 0, z: 18 } },
    ]);
    expect(v.region).toEqual({ id: WHITE_KING_DOMAIN, hash: descriptionHash(regionSpec(WHITE_KING_DOMAIN)!.space) });
    // 목적지 Region 의 이름은 어디에도 실리지 않는다
    expect(JSON.stringify(v)).not.toContain(FOREST_EDGE);
  });

  it('경계 — FOREST_EDGE 에서는 entities 가 관찰자 자신 + region-exit 하나뿐이다', () => {
    const world = driveWorld(nearAnchor);
    crossForest(world);
    const v = world.observe();

    expect(v.scene).toBe(FOREST_EDGE);
    expect(v.entities.map((e) => e.id)).toEqual([PLAYER, FOREST_PATH]);
    expect(exits(v)).toEqual([
      { id: FOREST_PATH, role: 'region-exit', state: 'open', kind: 'road', position: { x: 0, z: -18 } },
    ]);
    expect(v.interactions.filter((i) => i.id === 'mine')).toEqual([]); // 다른 방의 광맥은 가용성도 없다
    expect(v.region.id).toBe(FOREST_EDGE);
    expect(JSON.stringify(v)).not.toContain(WHITE_KING_DOMAIN);
  });

  it('hash 는 Description 에서 결정적으로 나온다 — 같은 Description → 같은 hash, 다른 Region 은 다른 hash', () => {
    const a = driveWorld(solo).observe().region.hash;
    const b = driveWorld(solo).observe().region.hash;
    expect(a).toBe(b);
    const world = driveWorld({ ...solo, ...nearAnchor });
    crossForest(world);
    expect(world.observe().region.hash).not.toBe(a);
  });

  it('다른 방의 관찰자는 서로의 관찰에 없고, 같은 방이면 있다', () => {
    const world = driveWorld({ ...solo, ...nearAnchor });
    world.join(OBSERVER_2);
    world.tick(0);
    expect(entity(world.observe(OBSERVER), PLAYER_2)?.role).toBe('other-player-character');

    crossForest(world);
    expect(entity(world.observe(OBSERVER), PLAYER_2)).toBeUndefined();
    expect(entity(world.observe(OBSERVER_2), PLAYER)).toBeUndefined();
    expect(hud(world.observe(OBSERVER_2), 'observers.present')).toBe(2); // 세계에 함께 있는 것은 그대로다
  });
});

describe('SPEC-008 — 깊이가 읽힌다', () => {
  it('hud region.depth = label · value = 그 Region 의 depth 태그 (civil → outer)', () => {
    const world = driveWorld({ ...solo, ...nearAnchor });
    expect(world.observe().hud.find((h) => h.id === 'region.depth')).toEqual({
      id: 'region.depth',
      kind: 'label',
      value: 'civil',
    });
    crossForest(world);
    expect(hud(world.observe(), 'region.depth')).toBe('outer');
  });
});

describe('SPEC-009 — 다른 방의 몸은 서로 없는 것과 같다 (R5)', () => {
  // 두 관찰자의 몸을 같은 좌표(숲 anchor 좌표와 같은 (0, −18))에, 다른 방에 둔다
  function splitWorld(setup: object = {}): WorldDriver {
    const world = driveWorld({ ...solo, ...nearAnchor, ...setup });
    crossForest(world); // PLAYER → FOREST_EDGE (0, −18)
    world.join(OBSERVER_2);
    world.tick(0);
    world.dispatch({ interactionId: 'move', position: { x: 0, z: -18 } }, OBSERVER_2);
    tickFor(world, 4); // PLAYER_2 → WHITE_KING_DOMAIN (0, −18)
    return world;
  }

  it('좌표가 겹쳐도 서로 밀지 않는다 (RULE-BODY-PUSH-001)', () => {
    const world = splitWorld();
    const before = { p1: { ...actorOf(world, PLAYER).position }, p2: { ...actorOf(world, PLAYER_2).position } };
    expect(before.p1.z).toBeCloseTo(before.p2.z);
    tickFor(world, 1);
    expect(actorOf(world, PLAYER).position).toEqual(before.p1);
    expect(actorOf(world, PLAYER_2).position).toEqual(before.p2);
    expect(actorOf(world, PLAYER).velocity).toEqual({ x: 0, z: 0 });
  });

  it('휘두름에 맞지 않는다 (RULE-SWING-STRIKE-001)', () => {
    const world = splitWorld();
    const hpBefore = actorOf(world, PLAYER_2).hp;
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, 1.5);
    expect(actorOf(world, PLAYER_2).hp).toBe(hpBefore);
    expect(state(world).strikeEvents).toEqual([]);
  });

  it('자율 존재의 인지 범위에 들지 않는다 (RULE-NPC-DECIDE-001)', () => {
    // 숲 anchor 와 같은 좌표에 선 백왕령의 NPC — 관찰자가 숲으로 건너가면 같은 (x, z) 인데 인지하지 않는다
    const world = driveWorld({
      ...nearAnchor,
      npcs: [{ id: 'npc-1', position: { x: 0, z: -18 }, wanderPath: [] }],
    });
    crossForest(world);
    tickFor(world, 1);
    const npc = actorOf(world, 'npc-1');
    expect(npc.currentAction.kind).toBe('idle'); // 접근도 공격도 하지 않는다
    expect(npc.position).toEqual({ x: 0, z: -18 });
  });

  it('경계 — 같은 Region 이면 지금과 똑같이 판정된다', () => {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [{ id: 'npc-1', position: { x: -8, z: 0 }, wanderPath: [] }],
    });
    tickFor(world, 0.1);
    expect(actorOf(world, 'npc-1').currentAction.kind).toBe('move'); // 인지 → 접근
  });
});

describe('SPEC-010 — 영속', () => {
  it('STATE_VERSION 이 올라갔다 — hkt-adv-proto-i/2', () => {
    expect(STATE_VERSION).toBe('hkt-adv-proto-i/2');
  });

  it('되살린 State 의 모든 몸·광맥이 regionId 를 가진다 — 건너간 몸은 그 방에 그대로다', () => {
    const world = driveWorld(nearAnchor);
    crossForest(world);
    const saved = JSON.parse(JSON.stringify(world.world.snapshot()));
    const restored = restoreWorld(saved);
    expect(restored).not.toBeNull();
    for (const actor of restored!.actors) expect(typeof actor.regionId).toBe('string');
    for (const deposit of restored!.deposits) expect(typeof deposit.regionId).toBe('string');
    expect(restored!.actors.find((a) => a.id === PLAYER)?.regionId).toBe(FOREST_EDGE);
    expect(restored!.deposits[0]?.regionId).toBe(WHITE_KING_DOMAIN);
    // World.regions · World.graph 는 실리지 않는다
    expect(saved.state).not.toHaveProperty('regions');
    expect(saved.state).not.toHaveProperty('graph');
    expect(saved.state).not.toHaveProperty('bounds');

    const revived = createWorld({}, restored!);
    revived.join(OBSERVER);
    revived.tick(0);
    expect(revived.latestObservation(OBSERVER)?.scene).toBe(FOREST_EDGE);
  });

  it('이전 버전의 스냅샷은 복구되지 않는다', () => {
    const saved = driveWorld(solo).world.snapshot();
    expect(restoreWorld({ ...saved, version: 'hkt-adv-proto-i/1' })).toBeNull();
  });
});
