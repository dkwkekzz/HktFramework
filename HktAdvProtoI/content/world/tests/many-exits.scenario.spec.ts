// C002 — 출구는 여럿, 목적지는 모른다 · 검증 시나리오 (01-spec SPEC-001 ~ SPEC-010 + 회귀)
//
// 세계의 공개 경로로만 본다 — driveWorld 로 굴리고, dispatch / dispatchForOutcome 으로 요청하고,
// observe() 의 관찰 결과와 world.snapshot().state 로 확인한다. 내부 함수는 부르지 않는다.
// 기대값의 출처는 cycles/C002-many-exits/01-spec.md 의 표뿐이다.

import { describe, expect, it } from 'vitest';
import { checkGraph } from '../../../engine/world-authoring/check';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { ANCHOR_LAYER, REGION_GRAPH, REGION_SPECS, regionSpec } from '../../regions';
import { createWorld, restoreWorld } from '../index';
import { INTERACTION_RANGE, STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2, type WorldDriver } from './drive';
import { sourcesInRegion } from '../semantic/resource';

// ── 01-spec 의 이름들 (표에서만 왔다) ───────────────────────────
const WHITE_KING_DOMAIN = 'WHITE_KING_DOMAIN';
const FOREST_EDGE = 'FOREST_EDGE';
const FOREST_DEEP = 'FOREST_DEEP';
const EXPLORER_RUIN = 'EXPLORER_RUIN';
const PREDATOR_NEST = 'PREDATOR_NEST';
const BIO_ORE_FIELD = 'BIO_ORE_FIELD';
const BUILT_REGIONS = [
  WHITE_KING_DOMAIN,
  FOREST_EDGE,
  FOREST_DEEP,
  EXPLORER_RUIN,
  PREDATOR_NEST,
  BIO_ORE_FIELD,
];
// C003 이 RED_EYE_TREE 를, C008 이 FANTASY_MAZE 를 지어 경계 목록에서 뺐다 — 남은 경계 둘
const FRONTIERS = ['ICE_CANYON', 'RED_WASTE'];
/** 관찰 결과에 이름이 실려서는 안 되는 다른 방들 — 경계 둘 + 그 뒤로 지어진 방들 */
const OTHER_ROOM_NAMES = [
  ...FRONTIERS,
  'RED_EYE_TREE',
  'TREE_INNER_WORLD',
  'HEART_LAKE',
  'FANTASY_MAZE',
];

const FOREST_PATH = 'FOREST_PATH';
const RUIN_TRAIL = 'RUIN_TRAIL';
const DEEP_TRAIL = 'DEEP_TRAIL';
const NEST_TRAIL = 'NEST_TRAIL';
const ORE_TRAIL = 'ORE_TRAIL';
const TREE_APPROACH = 'TREE_APPROACH';
const ORE_TREE_TRAIL = 'ORE_TREE_TRAIL';
const ANCIENT_GATE = 'ANCIENT_GATE';
const RED_WASTE_PASS = 'RED_WASTE_PASS';
const ICE_CANYON_PASS = 'ICE_CANYON_PASS';

/** 01-spec SPEC-002 의 anchor 표 — 각 방에서 관찰되는 출구 표식의 자리 */
const EXIT_POSITIONS: Record<string, Record<string, { x: number; z: number }>> = {
  [WHITE_KING_DOMAIN]: {
    [FOREST_PATH]: { x: 0, z: 18 },
    [RED_WASTE_PASS]: { x: 18, z: 0 },
    [ICE_CANYON_PASS]: { x: -18, z: 0 },
  },
  [FOREST_EDGE]: {
    [FOREST_PATH]: { x: 0, z: -18 },
    [DEEP_TRAIL]: { x: 0, z: 18 },
    [RUIN_TRAIL]: { x: -18, z: 0 },
  },
  [FOREST_DEEP]: {
    [DEEP_TRAIL]: { x: 0, z: -18 },
    [NEST_TRAIL]: { x: -18, z: 0 },
    [ORE_TRAIL]: { x: 18, z: 0 },
    [TREE_APPROACH]: { x: 0, z: 18 },
    [ANCIENT_GATE]: { x: -13, z: 13 },
  },
  [EXPLORER_RUIN]: { [RUIN_TRAIL]: { x: 18, z: 0 } },
  [PREDATOR_NEST]: { [NEST_TRAIL]: { x: 18, z: 0 } },
  [BIO_ORE_FIELD]: {
    [ORE_TRAIL]: { x: -18, z: 0 },
    [ORE_TREE_TRAIL]: { x: 0, z: 18 },
  },
};

/** 01-spec SPEC-003 의 transition — 출구 표식의 kind */
const EXIT_KINDS: Record<string, string> = {
  [FOREST_PATH]: 'road',
  [RUIN_TRAIL]: 'trail',
  [DEEP_TRAIL]: 'trail',
  [NEST_TRAIL]: 'trail',
  [ORE_TRAIL]: 'trail',
  [TREE_APPROACH]: 'interaction',
  [ORE_TREE_TRAIL]: 'trail',
  [ANCIENT_GATE]: 'door',
  [RED_WASTE_PASS]: 'pass',
  [ICE_CANYON_PASS]: 'pass',
};

// ── 하네스 ──────────────────────────────────────────────────
const solo = { npcs: [] };

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const actorOf = (w: WorldDriver, id: string) => state(w).actors.find((a) => a.id === id)!;
const body = (w: WorldDriver) => actorOf(w, PLAYER);
const exits = (v: GameViewSnapshot) => v.entities.filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string) => exits(v).find((e) => e.id === id);
const transits = (v: GameViewSnapshot) => v.interactions.filter((i) => i.id === 'transit');
const transitTo = (v: GameViewSnapshot, connector: string) =>
  transits(v).find((i) => i.targetEntityId === connector);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
const rolesOf = (v: GameViewSnapshot, role: string) => v.entities.filter((e) => e.role === role);

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
  const steps = Math.ceil(60 / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    w.tick(TICK_INTERVAL);
    if (arrived()) return;
  }
  throw new Error(`걸어서 (${x}, ${z}) 에 닿지 못했다 — 지금 자리 ${JSON.stringify(body(w).position)}`);
}

const cross = (w: WorldDriver, connector: string) =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector });

const askTransit = (w: WorldDriver, connector: string) =>
  w.dispatchForOutcome({ interactionId: 'transit', targetEntityId: connector })[0];

/** anchor 자리에 서서 그 Connector 로 건넌다 — 수락을 기대한다 */
function crossFrom(w: WorldDriver, region: string, connector: string) {
  const at = EXIT_POSITIONS[region]![connector]!;
  walkTo(w, at.x, at.z);
  expect(cross(w, connector)).toMatchObject({ status: 'success' });
}

/** 백왕령 → 숲 가장자리 */
function toForestEdge(w: WorldDriver) {
  crossFrom(w, WHITE_KING_DOMAIN, FOREST_PATH);
}
/** 백왕령 → 숲 가장자리 → 숲 안쪽 */
function toForestDeep(w: WorldDriver) {
  toForestEdge(w);
  crossFrom(w, FOREST_EDGE, DEEP_TRAIL);
}

/** 여섯 방을 한 바퀴 돌며 각 방의 관찰 결과를 모은다 */
function tourAllRooms(): Record<string, GameViewSnapshot> {
  const w = driveWorld(solo);
  const seen: Record<string, GameViewSnapshot> = {};
  seen[WHITE_KING_DOMAIN] = w.observe();

  toForestEdge(w);
  seen[FOREST_EDGE] = w.observe();

  crossFrom(w, FOREST_EDGE, DEEP_TRAIL);
  seen[FOREST_DEEP] = w.observe();

  crossFrom(w, FOREST_DEEP, NEST_TRAIL);
  seen[PREDATOR_NEST] = w.observe();
  expect(cross(w, NEST_TRAIL)).toMatchObject({ status: 'success' }); // 숲 안쪽으로 되돌아온다

  crossFrom(w, FOREST_DEEP, ORE_TRAIL);
  seen[BIO_ORE_FIELD] = w.observe();
  expect(cross(w, ORE_TRAIL)).toMatchObject({ status: 'success' });

  crossFrom(w, FOREST_DEEP, DEEP_TRAIL); // 숲 가장자리로
  crossFrom(w, FOREST_EDGE, RUIN_TRAIL);
  seen[EXPLORER_RUIN] = w.observe();
  return seen;
}

let toured: Record<string, GameViewSnapshot> | undefined;
/** 한 바퀴 결과를 한 번만 만들어 나눠 쓴다 (수집 시점이 아니라 처음 쓰일 때) */
const rooms = () => (toured ??= tourAllRooms());

const descriptions = () => REGION_SPECS.map((r) => r.space);
const graphFrontiers = (REGION_GRAPH as unknown as { frontiers?: string[] }).frontiers ?? [];

// ─────────────────────────────────────────────────────────────

describe('S-001 (SPEC-001) — C002 의 여섯 방이 있고 새 방 넷은 wild · extent 40×40', () => {
  it('C002 의 여섯 방이 그대로 있고 depth 가 그대로다 (civil 1 · outer 1 · wild 4)', () => {
    // C003 이 방을 셋 더했다 — 총 개수 대신 "C002 의 여섯이 그대로 있는가" 로 느슨하게 본다
    const ids = REGION_SPECS.map((r) => r.id);
    for (const id of BUILT_REGIONS) expect(ids).toContain(id);

    const depthOf = (id: string) => REGION_SPECS.find((r) => r.id === id)?.depth;
    expect(depthOf(WHITE_KING_DOMAIN)).toBe('civil');
    expect(depthOf(FOREST_EDGE)).toBe('outer');
    for (const id of [FOREST_DEEP, EXPLORER_RUIN, PREDATOR_NEST, BIO_ORE_FIELD]) {
      expect(depthOf(id)).toBe('wild');
    }
    expect(BUILT_REGIONS.filter((id) => depthOf(id) === 'wild').length).toBe(4);
  });

  it('그 여섯 방 모두 extent −20..20 × −20..20 (새 방 넷도 자기 Local Space 를 가진다)', () => {
    // C003 이 방마다 크기가 다를 수 있음을 처음 썼다 (TREE_INNER_WORLD 만 한 변 80) —
    // C002 가 검증하던 여섯 방의 크기가 그대로인지만 본다
    for (const id of BUILT_REGIONS) {
      expect(REGION_SPECS.find((r) => r.id === id)?.space.extent).toEqual({
        minX: -20,
        maxX: 20,
        minZ: -20,
        maxZ: 20,
      });
    }
  });
});

describe('S-002 (SPEC-001 경계) — 새 방 넷에 초기 배치가 놓이지 않는다', () => {
  it('모든 Actor 가 WHITE_KING_DOMAIN 에 있다', () => {
    const s = state(driveWorld());
    expect([...new Set(s.actors.map((a) => a.regionId))]).toEqual([WHITE_KING_DOMAIN]);
    for (const id of [FOREST_DEEP, EXPLORER_RUIN, PREDATOR_NEST, BIO_ORE_FIELD]) {
      expect(s.actors.some((a) => a.regionId === id)).toBe(false);
    }
  });

  // C011 CHANGED — 광맥은 더 이상 초기 배치가 아니다. 캘 것은 방이 **낳는** 것이고
  // (content/regions 의 resourceEcology) 그래서 이 넷 가운데 둘에는 이제 원천이 서 있다.
  // 이 Cycle 이 뒤집은 것은 "무엇이 놓였는가" 가 아니라 **누가 놓는가** 다.
  // C014 CHANGED — 이제 넷 다 원천을 낳는다 (숲 깊은 곳의 어귀 · 둥지의 균사가 섰다).
  // 백왕령만은 여전히 하나도 없고, 그것이 이 경계가 묻는 것이다.
  it('캘 것은 State 가 아니라 방의 데이터에서 온다 — 백왕령에는 하나도 없다', () => {
    expect(sourcesInRegion(WHITE_KING_DOMAIN).length).toBe(0);
    for (const id of [EXPLORER_RUIN, BIO_ORE_FIELD, FOREST_DEEP, PREDATOR_NEST]) {
      const declared = (regionSpec(id)?.resourceEcology?.sources ?? []).map((one) => one.id);
      expect({ id, stood: sourcesInRegion(id).map((one) => one.id) }).toEqual({
        id,
        stood: declared,
      });
    }
  });
});

describe('S-003 · S-004 (SPEC-002) — anchor 가 방마다 여럿이고, 방 사이 좌표는 무관하다', () => {
  it('각 방의 출구 표식 자리가 SPEC-002 의 표 그대로다', () => {
    for (const region of BUILT_REGIONS) {
      const view = rooms()[region]!;
      const observed = Object.fromEntries(exits(view).map((e) => [e.id, e.position]));
      expect(observed).toEqual(EXIT_POSITIONS[region]);
    }
  });

  it('모든 anchor 가 자기 방의 extent 안이고, 한 방 안에서 자리가 겹치지 않는다', () => {
    for (const region of BUILT_REGIONS) {
      const places = exits(rooms()[region]!).map((e) => e.position);
      for (const p of places) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(20);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(20);
      }
      expect(new Set(places.map((p) => `${p.x},${p.z}`)).size).toBe(places.length);
    }
  });

  it('같은 tag 가 두 방에서 다른 자리다', () => {
    const at = (region: string, connector: string) => exitOf(rooms()[region]!, connector)?.position;
    expect(at(WHITE_KING_DOMAIN, FOREST_PATH)).not.toEqual(at(FOREST_EDGE, FOREST_PATH));
    expect(at(FOREST_EDGE, DEEP_TRAIL)).not.toEqual(at(FOREST_DEEP, DEEP_TRAIL));
    expect(at(FOREST_EDGE, RUIN_TRAIL)).not.toEqual(at(EXPLORER_RUIN, RUIN_TRAIL));
    expect(at(FOREST_DEEP, NEST_TRAIL)).not.toEqual(at(PREDATOR_NEST, NEST_TRAIL));
    expect(at(FOREST_DEEP, ORE_TRAIL)).not.toEqual(at(BIO_ORE_FIELD, ORE_TRAIL));
  });
});

describe('S-005 (SPEC-003) — C002 의 Connector 열이 이 순서로 앞에 있다', () => {
  it('World.graph.connectors 의 앞 열이 SPEC-003 의 표 그대로 (exitsOf 의 결정론이 이 순서를 따른다)', () => {
    // C003 이 뒤에 셋을 이었다 — 배열 전체 일치 대신 "이 열이 이 순서로 앞에 있다" 로 느슨하게 본다
    expect(REGION_GRAPH.connectors.slice(0, 10)).toEqual([
      {
        id: FOREST_PATH,
        from: { region: WHITE_KING_DOMAIN, anchor: FOREST_PATH },
        to: { region: FOREST_EDGE, anchor: FOREST_PATH },
        direction: 'bidirectional',
        transition: 'road',
      },
      {
        id: RUIN_TRAIL,
        from: { region: FOREST_EDGE, anchor: RUIN_TRAIL },
        to: { region: EXPLORER_RUIN, anchor: RUIN_TRAIL },
        direction: 'bidirectional',
        transition: 'trail',
      },
      {
        id: DEEP_TRAIL,
        from: { region: FOREST_EDGE, anchor: DEEP_TRAIL },
        to: { region: FOREST_DEEP, anchor: DEEP_TRAIL },
        direction: 'bidirectional',
        transition: 'trail',
      },
      {
        id: NEST_TRAIL,
        from: { region: FOREST_DEEP, anchor: NEST_TRAIL },
        to: { region: PREDATOR_NEST, anchor: NEST_TRAIL },
        direction: 'bidirectional',
        transition: 'trail',
      },
      {
        id: ORE_TRAIL,
        from: { region: FOREST_DEEP, anchor: ORE_TRAIL },
        to: { region: BIO_ORE_FIELD, anchor: ORE_TRAIL },
        direction: 'bidirectional',
        transition: 'trail',
      },
      {
        id: TREE_APPROACH,
        from: { region: FOREST_DEEP, anchor: TREE_APPROACH },
        to: { region: 'RED_EYE_TREE', anchor: 'FOREST_DEEP_SIDE' },
        direction: 'bidirectional',
        transition: 'interaction',
      },
      {
        id: ORE_TREE_TRAIL,
        from: { region: BIO_ORE_FIELD, anchor: 'TREE_TRAIL' },
        to: { region: 'RED_EYE_TREE', anchor: 'ORE_SIDE' },
        direction: 'bidirectional',
        transition: 'trail',
      },
      {
        id: ANCIENT_GATE,
        from: { region: FOREST_DEEP, anchor: ANCIENT_GATE },
        to: { region: 'FANTASY_MAZE', anchor: ANCIENT_GATE },
        direction: 'one-way',
        transition: 'door',
      },
      {
        id: RED_WASTE_PASS,
        from: { region: WHITE_KING_DOMAIN, anchor: RED_WASTE_PASS },
        to: { region: 'RED_WASTE', anchor: 'WHITE_KING_SIDE' },
        direction: 'one-way',
        transition: 'pass',
      },
      {
        id: ICE_CANYON_PASS,
        from: { region: WHITE_KING_DOMAIN, anchor: ICE_CANYON_PASS },
        to: { region: 'ICE_CANYON', anchor: 'WHITE_KING_SIDE' },
        direction: 'one-way',
        transition: 'pass',
      },
    ]);
  });
});

describe('S-006 (SPEC-003) — 방마다 나갈 곳의 수가 3 · 3 · 5 · 1 · 1 · 2 다', () => {
  it('exits 의 수가 §5.8 그대로다', () => {
    expect(exits(rooms()[WHITE_KING_DOMAIN]!).length).toBe(3);
    expect(exits(rooms()[FOREST_EDGE]!).length).toBe(3);
    expect(exits(rooms()[FOREST_DEEP]!).length).toBe(5);
    expect(exits(rooms()[EXPLORER_RUIN]!).length).toBe(1);
    expect(exits(rooms()[PREDATOR_NEST]!).length).toBe(1);
    expect(exits(rooms()[BIO_ORE_FIELD]!).length).toBe(2);
  });
});

describe('S-007 (SPEC-004) — 아직 짓지 않은 곳은 경계(frontier)로 밝혀져 있다', () => {
  it('frontiers 에 RED_WASTE · ICE_CANYON 이 있다 (지어진 방은 이 목록에서 빠진다)', () => {
    for (const name of FRONTIERS) expect(graphFrontiers).toContain(name);
    // 지어진 방은 경계가 아니다 — C003 이 거목을, C008 이 환상의 미로를 그렇게 뺐다
    expect(graphFrontiers).not.toContain('RED_EYE_TREE');
    expect(graphFrontiers).not.toContain('FANTASY_MAZE');
  });

  it('Description 없는 끝은 전부 frontier 안에 있고, frontier 중 지어진 방은 없다', () => {
    const built = new Set(REGION_SPECS.map((r) => r.id));
    for (const c of REGION_GRAPH.connectors) {
      for (const end of [c.from, c.to]) {
        if (!built.has(end.region)) expect(graphFrontiers).toContain(end.region);
      }
    }
    for (const name of graphFrontiers) expect(built.has(name)).toBe(false);
  });
});

// C004 가 데이터로 열었다 — CLOSED_CONNECTORS 가 비면서 이 기대가 뒤집혔다.
// 닫힌 문이라는 갈래도 그 규칙도 그대로다: c004-polish-is-data.spec.ts 의 변형이 계속 검증한다.
describe('S-008 (SPEC-005) — 닫힌 Connector 가 하나도 없고 닫힘은 세계 State 에 없다', () => {
  it('locked 인 출구가 하나도 없다 — 고대 문까지 열 곳이 전부 open', () => {
    const locked: string[] = [];
    const open: string[] = [];
    for (const region of BUILT_REGIONS) {
      for (const e of exits(rooms()[region]!)) (e.state === 'locked' ? locked : open).push(e.id);
    }
    expect([...new Set(locked)]).toEqual([]);
    expect(locked.length).toBe(0);
    expect([...new Set(open)].sort()).toEqual(
      [
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
      ].sort(),
    );
  });

  it('스냅샷의 State 에 closedConnectors · graph · regions · frontiers 가 없다', () => {
    const saved = driveWorld(solo).world.snapshot();
    for (const key of ['closedConnectors', 'graph', 'regions', 'frontiers', 'bounds']) {
      expect(saved.state).not.toHaveProperty(key);
    }
  });
});

describe('S-009 (SPEC-006 ①) — 없는 Connector 는 unknown-connector', () => {
  it('Graph 에 없는 이름을 요청하면 unknown-connector 로 거절된다', () => {
    const w = driveWorld({ ...solo, actorPosition: { x: 0, z: 17 } });
    expect(askTransit(w, 'NO_SUCH_PATH')).toMatchObject({
      accepted: false,
      reason: 'unknown-connector',
    });
  });
});

describe('S-010 (SPEC-006 ②) — 이 방에 끝이 없는 Connector 는 wrong-region (C001 이월)', () => {
  it('백왕령에서 DEEP_TRAIL 을 요청하면 wrong-region — 거리보다 앞선다', () => {
    const w = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    expect(askTransit(w, DEEP_TRAIL)).toMatchObject({ accepted: false, reason: 'wrong-region' });
    expect(body(w).regionId).toBe(WHITE_KING_DOMAIN);
    expect(body(w).position).toEqual({ x: 0, z: 0 });
  });
});

describe('S-011 (SPEC-006 ③) — 멀면 out-of-range · 닫힘·경계보다 앞이다', () => {
  it('경계 밖(2.1)에서 RED_WASTE_PASS 를 요청하면 region-not-built 가 아니라 out-of-range', () => {
    const w = driveWorld(solo);
    walkTo(w, 18 - INTERACTION_RANGE - 0.1, 0);
    expect(transitTo(w.observe(), RED_WASTE_PASS)).toMatchObject({
      available: false,
      reason: 'out-of-range',
    });
    expect(askTransit(w, RED_WASTE_PASS)).toMatchObject({
      accepted: false,
      reason: 'out-of-range',
    });
  });

  // C004 가 데이터로 열었다 — 멀리서 오던 사유가 connector-inactive 를 가리던 것이 이제 경계를 가린다.
  // 거리가 그 둘보다 앞이라는 규칙은 그대로다
  it('멀리서 ANCIENT_GATE 를 요청해도 region-not-built 가 아니라 out-of-range', () => {
    const w = driveWorld(solo);
    toForestDeep(w); // FOREST_DEEP 의 DEEP_TRAIL anchor (0, −18) — 고대 문까지 멀다
    expect(askTransit(w, ANCIENT_GATE)).toMatchObject({
      accepted: false,
      reason: 'out-of-range',
    });
  });
});

// C004 가 데이터로 열었다 — 전제 ④(열려 있다)가 이제 늘 참이므로 대답이 ⑤ 로 넘어간다.
// 규칙의 순서(④ < ⑤)는 그대로다: 값이 달라져 다른 답이 나올 뿐이다
// C008 이 고대 문 너머를 지었다 — 이 자리의 대답이 region-not-built 에서 성공으로 넘어갔다.
// 규칙도 사유 코드도 그대로다: 아직 경계인 문(백왕령의 고개 둘)에서는 S-013 이 같은 사유를 계속 잰다
describe('S-012 (SPEC-006 ⑤) — 고대 문 너머가 지어져 이제 건널 수 있다', () => {
  it('ANCIENT_GATE anchor(−13, 13) 위에서 요청하면 받아들여진다 (C008 이 방을 지었다)', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    walkTo(w, -13, 13);
    expect(transitTo(w.observe(), ANCIENT_GATE)).toMatchObject({ available: true });
    expect(askTransit(w, ANCIENT_GATE)).toMatchObject({ accepted: true });
    expect(body(w).regionId).toBe('FANTASY_MAZE');
  });
});

describe('S-013 (SPEC-006 ⑤) — 아직 없는 곳으로 건너려 하면 region-not-built', () => {
  it('백왕령의 고개 둘 — RED_WASTE_PASS · ICE_CANYON_PASS', () => {
    const w = driveWorld(solo);
    for (const connector of [RED_WASTE_PASS, ICE_CANYON_PASS]) {
      const at = EXIT_POSITIONS[WHITE_KING_DOMAIN]![connector]!;
      walkTo(w, at.x, at.z);
      expect(transitTo(w.observe(), connector)).toMatchObject({
        available: false,
        reason: 'region-not-built',
      });
      expect(askTransit(w, connector)).toMatchObject({
        accepted: false,
        reason: 'region-not-built',
      });
      expect(body(w).regionId).toBe(WHITE_KING_DOMAIN);
    }
  });

  it('광석 지대의 거목 쪽 오솔길 — ORE_TREE_TRAIL 은 C003 이 그 방을 지어 이제 건너진다', () => {
    // C002 에서는 region-not-built 였다. Connector 는 손대지 않았고 방이 지어졌을 뿐이다 —
    // 사유 자체는 위 고개 둘이 그대로 검증한다 (이 사유를 잃지 않는다)
    const w = driveWorld(solo);
    toForestDeep(w);
    crossFrom(w, FOREST_DEEP, ORE_TRAIL);
    walkTo(w, 0, 18);
    expect(askTransit(w, ORE_TREE_TRAIL)).toMatchObject({ accepted: true });
    expect(body(w).regionId).toBe('RED_EYE_TREE');
  });
});

describe('S-014 (SPEC-006 ⑥) — 대체 불가 행동은 action-busy · 다만 닫힘이 먼저다', () => {
  it('열린 출구 위에서 대체 불가 행동 중이면 action-busy', () => {
    const w = driveWorld(solo);
    toForestDeep(w); // DEEP_TRAIL anchor 위
    expect(w.dispatch({ interactionId: 'attack' }).status).toBe('success');
    expect(askTransit(w, DEEP_TRAIL)).toMatchObject({ accepted: false, reason: 'action-busy' });
    expect(body(w).regionId).toBe(FOREST_DEEP);
  });

  // C004 가 데이터로 열었다 — 닫힘(④)이 사라져 이제 경계(⑤)가 행동(⑥)보다 앞선다는 것을 잰다.
  // C008 이 고대 문 너머를 지었으므로 그 순서는 아직 경계인 문(백왕령의 고개)에서 잰다
  it('아직 경계인 문 위에서는 같은 행동 중이어도 region-not-built (⑤ < ⑥)', () => {
    const w = driveWorld(solo);
    const at = EXIT_POSITIONS[WHITE_KING_DOMAIN]![RED_WASTE_PASS]!;
    walkTo(w, at.x, at.z);
    expect(w.dispatch({ interactionId: 'attack' }).status).toBe('success');
    expect(askTransit(w, RED_WASTE_PASS)).toMatchObject({
      accepted: false,
      reason: 'region-not-built',
    });
  });
});

// C004 가 데이터로 열었다 — connector-inactive 를 낼 문이 이 세계에 하나도 없어졌다.
// 사유 코드도 규칙의 전제 여섯도 그대로다 (spec REUSED): 닫힌 문의 대답은
// c004-polish-is-data.spec.ts 의 변형이 계속 검증한다
describe('S-015 (SPEC-006) — 다섯 사유가 이 세계의 데이터에서 관측된다', () => {
  it('unknown-connector · wrong-region · out-of-range · region-not-built · action-busy', () => {
    const reasons = new Set<string>();

    const a = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    reasons.add(askTransit(a, 'NO_SUCH_PATH')!.reason!);
    reasons.add(askTransit(a, DEEP_TRAIL)!.reason!);
    reasons.add(askTransit(a, FOREST_PATH)!.reason!);

    const b = driveWorld(solo);
    walkTo(b, 18, 0);
    reasons.add(askTransit(b, RED_WASTE_PASS)!.reason!);

    // C002 에서는 connector-inactive 였고 C004 에서는 region-not-built 였다 —
    // C008 이 그 너머를 지어 이제 받아들여진다. region-not-built 는 위의 고개가 계속 낸다
    const gate = driveWorld(solo);
    toForestDeep(gate);
    walkTo(gate, -13, 13);
    expect(transitTo(gate.observe(), ANCIENT_GATE)).toMatchObject({ available: true });

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
});

describe('S-016 (SPEC-006 경계) — 거절은 세계 State 를 하나도 바꾸지 않는다', () => {
  it('regionId · position · velocity · currentAction 이 요청 전과 같다', () => {
    // C004 가 데이터로 열었고 C008 이 고대 문 너머를 지었다 — 거절이 State 를 바꾸지 않는다는
    // 규칙은 그대로이므로, 아직 거절이 오는 문(백왕령의 고개)에서 같은 것을 잰다
    const w = driveWorld(solo);
    const at = EXIT_POSITIONS[WHITE_KING_DOMAIN]![RED_WASTE_PASS]!;
    walkTo(w, at.x, at.z);
    const before = JSON.parse(JSON.stringify(body(w)));

    expect(askTransit(w, RED_WASTE_PASS)).toMatchObject({
      accepted: false,
      reason: 'region-not-built',
    });
    const after = body(w);
    expect(after.regionId).toBe(before.regionId);
    expect(after.position).toEqual(before.position);
    expect(after.velocity).toEqual(before.velocity);
    expect(after.currentAction).toEqual(before.currentAction);
    expect(w.observe().scene).toBe(WHITE_KING_DOMAIN);
  });
});

describe('S-017 (SPEC-007) — region-exit 의 kind 는 Connector 의 transition 그대로다', () => {
  it('road · trail · door · pass · interaction 다섯 값이 표대로 실린다', () => {
    const kinds = new Set<string>();
    for (const region of BUILT_REGIONS) {
      for (const e of exits(rooms()[region]!)) {
        expect(e.kind).toBe(EXIT_KINDS[e.id]);
        kinds.add(e.kind!);
      }
    }
    expect([...kinds].sort()).toEqual(['door', 'interaction', 'pass', 'road', 'trail']);
  });
});

describe('S-018 (SPEC-007 경계) — 경계를 가리키는 출구도 state = open 이다', () => {
  it('고개 둘 · 거목 쪽 둘 모두 open — "아직 없는 곳" 은 표식이 아니라 대답으로만 드러난다', () => {
    expect(exitOf(rooms()[WHITE_KING_DOMAIN]!, RED_WASTE_PASS)).toMatchObject({
      state: 'open',
      kind: 'pass',
    });
    expect(exitOf(rooms()[WHITE_KING_DOMAIN]!, ICE_CANYON_PASS)).toMatchObject({
      state: 'open',
      kind: 'pass',
    });
    expect(exitOf(rooms()[FOREST_DEEP]!, TREE_APPROACH)?.state).toBe('open');
    expect(exitOf(rooms()[BIO_ORE_FIELD]!, ORE_TREE_TRAIL)?.state).toBe('open');
  });

  it('관찰 결과 어디에도 frontier 이름이 실리지 않는다', () => {
    // 값 하나로 실렸는지를 본다 — Connector id(ICE_CANYON_PASS · RED_WASTE_PASS)는
    // C001 SPEC-007 대로 실리는 것이고, 금지된 것은 frontier 로 밝힌 **방 이름**이다
    for (const region of BUILT_REGIONS) {
      const text = JSON.stringify(rooms()[region]);
      // 경계 셋에 더해 C003 이 지은 방 셋의 이름도 실리면 안 된다 (목적지는 여전히 밝히지 않는다)
      for (const name of OTHER_ROOM_NAMES) expect(text).not.toContain(`"${name}"`);
    }
  });
});

// C004 가 데이터로 열었다 — 숲 안쪽의 잠긴 표식 하나가 열린 표식이 됐다 (출구 수도 갈래도 그대로다)
describe('S-019 (SPEC-008) — 숲 안쪽은 출구가 다섯이고 이제 다섯이 전부 열려 있다', () => {
  it('exits 다섯 · ANCIENT_GATE 도 open/door · transit 다섯 · depth wild · 목적지 이름 없음', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    const v = w.observe();

    expect(v.scene).toBe(FOREST_DEEP);
    expect(v.region.id).toBe(FOREST_DEEP);
    expect(exits(v).length).toBe(5);
    expect(exits(v).filter((e) => e.state === 'locked').map((e) => e.id)).toEqual([]);
    expect(exitOf(v, ANCIENT_GATE)?.kind).toBe('door'); // 갈래는 그대로 door 다
    for (const id of [DEEP_TRAIL, NEST_TRAIL, ORE_TRAIL, TREE_APPROACH, ANCIENT_GATE]) {
      expect(exitOf(v, id)?.state).toBe('open');
    }
    expect(transits(v).length).toBe(5);
    expect(
      transits(v)
        .map((i) => i.targetEntityId)
        .sort(),
    ).toEqual([ANCIENT_GATE, DEEP_TRAIL, NEST_TRAIL, ORE_TRAIL, TREE_APPROACH].sort());
    expect(hud(v, 'region.depth')).toBe('wild');

    const text = JSON.stringify(v);
    for (const name of [
      WHITE_KING_DOMAIN,
      FOREST_EDGE,
      EXPLORER_RUIN,
      PREDATOR_NEST,
      BIO_ORE_FIELD,
      ...OTHER_ROOM_NAMES,
    ]) {
      expect(text).not.toContain(`"${name}"`);
    }
  });
});

describe('S-020 (SPEC-008 경계) — 막다른 방 셋에는 남의 몸이 없다', () => {
  // C011 CHANGED — 폐허와 광석 지대는 더 이상 "비어" 있지 않다. 그 둘이 낳는 원천이
  // 하나씩 서 있기 때문이다 (RoomBearsMaterial A.3 — 경계부 하나 · 핵심부 하나).
  // 이 경계가 원래 묻던 것은 **다른 방의 것이 새어 오지 않는가** 이고 그것은 그대로다.
  it('셋 다 관찰자 자신 + 출구 + 그 방이 낳는 원천뿐이다', () => {
    for (const [region, exitCount, sourceCount] of [
      // C014 CHANGED — 둥지도 이제 자기 원천 하나를 낳는다 (사슬의 부산물)
      [EXPLORER_RUIN, 1, 1],
      [PREDATOR_NEST, 1, 1],
      [BIO_ORE_FIELD, 2, 1],
    ] as const) {
      const v = rooms()[region]!;
      expect(v.scene).toBe(region);
      expect(rolesOf(v, 'player-character').map((e) => e.id)).toEqual([PLAYER]);
      expect(exits(v).length).toBe(exitCount);
      expect(rolesOf(v, 'resource-source').length).toBe(sourceCount);
      expect(v.entities.length).toBe(1 + exitCount + sourceCount);
      expect(rolesOf(v, 'npc-character').length).toBe(0);
      expect(rolesOf(v, 'other-player-character').length).toBe(0);
      expect(hud(v, 'region.depth')).toBe('wild');
    }
    expect(exitOf(rooms()[EXPLORER_RUIN]!, RUIN_TRAIL)).toMatchObject({
      kind: 'trail',
      position: { x: 18, z: 0 },
    });
    expect(exitOf(rooms()[PREDATOR_NEST]!, NEST_TRAIL)).toMatchObject({
      kind: 'trail',
      position: { x: 18, z: 0 },
    });
  });

  it('돌아가는 Connector 로 요청하면 숲 안쪽의 그 anchor 자리에 선다', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    crossFrom(w, FOREST_DEEP, NEST_TRAIL);
    expect(body(w).regionId).toBe(PREDATOR_NEST);
    expect(cross(w, NEST_TRAIL)).toMatchObject({ status: 'success' });
    expect(body(w).regionId).toBe(FOREST_DEEP);
    expect(body(w).position).toEqual({ x: -18, z: 0 });
  });
});

describe('S-021 (SPEC-009) — 이 Cycle 의 데이터로 검사를 돌리면 오류가 없다', () => {
  it('checkGraph 의 오류가 0 이고, 두 번 돌려도 같다 (읽기 전용)', () => {
    const first = checkGraph(descriptions(), REGION_GRAPH, ANCHOR_LAYER, WHITE_KING_DOMAIN);
    expect(first).toEqual([]);
    const second = checkGraph(descriptions(), REGION_GRAPH, ANCHOR_LAYER, WHITE_KING_DOMAIN);
    expect(second).toEqual(first);
    // 검사가 데이터를 건드리지 않았다 — 개수 대신 C002 의 여섯이 그대로 있는지로 본다
    for (const id of BUILT_REGIONS) expect(REGION_SPECS.map((r) => r.id)).toContain(id);
  });
});

describe('S-022 (SPEC-009 ②③④) — frontier-built · unused-frontier · unreachable 이 잡힌다', () => {
  const withFrontiers = (list: string[]) =>
    ({ ...REGION_GRAPH, frontiers: list }) as unknown as typeof REGION_GRAPH;

  it('② 경계로 밝혔는데 Description 이 있으면 frontier-built', () => {
    const issues = checkGraph(
      descriptions(),
      withFrontiers([...graphFrontiers, WHITE_KING_DOMAIN]),
      ANCHOR_LAYER,
      WHITE_KING_DOMAIN,
    );
    expect(JSON.stringify(issues)).toContain('frontier-built');
  });

  it('③ 아무 Connector 도 가리키지 않는 경계는 unused-frontier', () => {
    const issues = checkGraph(
      descriptions(),
      withFrontiers([...graphFrontiers, 'NOWHERE_LAND']),
      ANCHOR_LAYER,
      WHITE_KING_DOMAIN,
    );
    expect(JSON.stringify(issues)).toContain('unused-frontier');
  });

  it('④ 시작 방에서 닿지 않는 지어진 방이 있으면 unreachable', () => {
    const cut = {
      ...REGION_GRAPH,
      connectors: REGION_GRAPH.connectors.filter((c) => c.id !== FOREST_PATH),
    };
    const issues = checkGraph(descriptions(), cut, ANCHOR_LAYER, WHITE_KING_DOMAIN);
    expect(JSON.stringify(issues)).toContain('unreachable');
  });
});

describe('S-023 (SPEC-010) — STATE_VERSION 이 올라가지 않고 방·Graph 는 저장되지 않는다', () => {
  it('스냅샷 왕복 — 되살린 몸이 FOREST_DEEP 에 그대로 서 있다', () => {
    // C008 이 Region State 를 저장하면서 판을 올렸다 (spec R5) — 못박힌 글자 대신
    // "세계가 찍는 판이 팩의 판과 같다" 를 잰다. 방·Graph 가 실리지 않는다는 주장은 그대로다
    const w = driveWorld(solo);
    toForestDeep(w);
    const saved = JSON.parse(JSON.stringify(w.world.snapshot()));
    expect(saved.version).toBe(STATE_VERSION);
    for (const key of ['regions', 'graph', 'frontiers', 'closedConnectors', 'bounds']) {
      expect(saved.state).not.toHaveProperty(key);
    }

    const restored = restoreWorld(saved);
    expect(restored).not.toBeNull();
    expect(restored!.actors.find((a) => a.id === PLAYER)?.regionId).toBe(FOREST_DEEP);

    const revived = createWorld({}, restored!);
    revived.join(OBSERVER);
    revived.tick(0);
    const v = revived.latestObservation(OBSERVER) as GameViewSnapshot;
    expect(v.scene).toBe(FOREST_DEEP);
    expect(exits(v).length).toBe(5);
    // C004 가 데이터로 열었다 — 되살린 세계에서도 잠긴 표식이 없다 (닫힘은 저장되지 않는다)
    expect(exits(v).filter((e) => e.state === 'locked').map((e) => e.id)).toEqual([]);
    // 방과 Graph 는 컨텐츠 데이터에서 다시 온다 — C003 이 뒤에 더했으므로 개수 대신 존재로 본다
    for (const id of BUILT_REGIONS) expect(REGION_SPECS.map((r) => r.id)).toContain(id);
    for (const id of [FOREST_PATH, ANCIENT_GATE, ORE_TREE_TRAIL]) {
      expect(REGION_GRAPH.connectors.map((c) => c.id)).toContain(id);
    }
  });
});

describe('S-024 (SPEC-010) — C001 에서 저장된 스냅샷도 그대로 되살아난다', () => {
  it('방 둘만 쓰던 스냅샷(몸이 FOREST_EDGE)이 C002 의 세계에서 복구된다', () => {
    const w = driveWorld({ actorPosition: { x: 0, z: 17 } }); // 기본 배치 — npc 둘 · 광맥 하나
    expect(cross(w, FOREST_PATH)).toMatchObject({ status: 'success' });
    const saved = JSON.parse(JSON.stringify(w.world.snapshot()));

    const restored = restoreWorld(saved);
    expect(restored).not.toBeNull();
    expect(restored!.actors.find((a) => a.id === PLAYER)?.regionId).toBe(FOREST_EDGE);
    for (const npc of restored!.actors.filter((a) => a.id !== PLAYER)) {
      expect(npc.regionId).toBe(WHITE_KING_DOMAIN);
    }

    const revived = createWorld({}, restored!);
    revived.join(OBSERVER);
    revived.tick(0);
    const v = revived.latestObservation(OBSERVER) as GameViewSnapshot;
    expect(v.scene).toBe(FOREST_EDGE);
    expect(exits(v).length).toBe(3); // C002 의 데이터가 실린다
  });
});

describe('S-025 (SPEC-010 경계) — 여섯 방 어느 것도 아닌 regionId 는 데이터 오류다', () => {
  it('세계가 그 State 를 조용히 받아들이지 않는다', () => {
    const saved = JSON.parse(JSON.stringify(driveWorld(solo).world.snapshot()));
    for (const actor of saved.state.actors) actor.regionId = 'NOWHERE_LAND';
    const restored = restoreWorld(saved);
    expect(restored).not.toBeNull();

    expect(() => {
      const revived = createWorld({}, restored!);
      revived.join(OBSERVER_2);
      revived.tick(0);
      revived.tick(0);
    }).toThrow();
  });
});

// ── 회귀 — C001 의 관찰 가능 행동이 그대로인가 ──────────────────

describe('S-026 (회귀 · C001 SPEC-006) — 백왕령 ⇄ 숲 가장자리 왕복', () => {
  it('건너고 되돌아오면 원래 anchor 자리 · depth 도 civil → outer → civil', () => {
    const w = driveWorld({ ...solo, actorPosition: { x: 0, z: 18 } });
    expect(hud(w.observe(), 'region.depth')).toBe('civil');

    expect(cross(w, FOREST_PATH)).toMatchObject({ status: 'success' });
    expect(body(w).regionId).toBe(FOREST_EDGE);
    expect(body(w).position).toEqual({ x: 0, z: -18 });
    expect(body(w).velocity).toEqual({ x: 0, z: 0 });
    expect(body(w).currentAction.kind).toBe('idle');
    expect(w.observe().scene).toBe(FOREST_EDGE);
    expect(hud(w.observe(), 'region.depth')).toBe('outer');

    expect(cross(w, FOREST_PATH)).toMatchObject({ status: 'success' });
    expect(body(w).regionId).toBe(WHITE_KING_DOMAIN);
    expect(body(w).position).toEqual({ x: 0, z: 18 });
    expect(w.observe().scene).toBe(WHITE_KING_DOMAIN);
    expect(hud(w.observe(), 'region.depth')).toBe('civil');
  });
});

describe('S-027 (회귀 · C001 SPEC-005) — 멀리서 요청하면 out-of-range', () => {
  it('투영과 대답이 같은 사유를 낸다 · State 는 그대로', () => {
    const w = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    expect(transitTo(w.observe(), FOREST_PATH)).toMatchObject({
      available: false,
      reason: 'out-of-range',
    });
    expect(askTransit(w, FOREST_PATH)).toMatchObject({
      accepted: false,
      reason: 'out-of-range',
    });
    expect(body(w).regionId).toBe(WHITE_KING_DOMAIN);
    expect(body(w).position).toEqual({ x: 0, z: 0 });
  });
});

describe('S-028 (회귀 · C001 SPEC-009) — 다른 방의 몸은 서로 없는 것과 같다', () => {
  it('같은 좌표 · 다른 방이면 관찰에도 없고 서로 밀지도 않는다', () => {
    const w = driveWorld({ ...solo, actorPosition: { x: 0, z: 18 } });
    expect(cross(w, FOREST_PATH)).toMatchObject({ status: 'success' }); // PLAYER → FOREST_EDGE (0, −18)
    w.join(OBSERVER_2);
    w.tick(0);
    w.dispatch({ interactionId: 'move', position: { x: 0, z: -18 } }, OBSERVER_2);
    tickFor(w, 6);

    const p1 = actorOf(w, PLAYER);
    const p2 = actorOf(w, PLAYER_2);
    expect(p1.regionId).toBe(FOREST_EDGE);
    expect(p2.regionId).toBe(WHITE_KING_DOMAIN);
    expect(p2.position.z).toBeCloseTo(-18);

    expect(w.observe(OBSERVER).entities.some((e) => e.id === PLAYER_2)).toBe(false);
    expect(w.observe(OBSERVER_2).entities.some((e) => e.id === PLAYER)).toBe(false);

    const before = { p1: { ...p1.position }, p2: { ...p2.position } };
    tickFor(w, 1);
    expect(actorOf(w, PLAYER).position).toEqual(before.p1);
    expect(actorOf(w, PLAYER_2).position).toEqual(before.p2);
    expect(actorOf(w, PLAYER).velocity).toEqual({ x: 0, z: 0 });
  });
});

describe('S-029 (회귀 · C001 SPEC-004) — 이동의 경계는 그 몸이 선 방의 extent 다', () => {
  it('새 방(FOREST_DEEP)에서도 extent 안은 수락 · 밖은 out-of-bounds', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    const at = { ...body(w).position };
    expect(w.dispatch({ interactionId: 'move', position: { x: 0, z: 0 } }).status).toBe('success');
    expect(w.dispatch({ interactionId: 'move', position: { x: 0, z: 21 } })).toMatchObject({
      status: 'failure',
      reason: 'out-of-bounds',
    });
    expect(body(w).regionId).toBe(FOREST_DEEP);
    expect(at).toEqual({ x: 0, z: -18 });
  });

  it('막다른 방 셋에서도 같다', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    crossFrom(w, FOREST_DEEP, NEST_TRAIL); // PREDATOR_NEST
    expect(w.dispatch({ interactionId: 'move', position: { x: -19, z: 19 } }).status).toBe('success');
    expect(w.dispatch({ interactionId: 'move', position: { x: -21, z: 0 } })).toMatchObject({
      status: 'failure',
      reason: 'out-of-bounds',
    });
  });
});

describe('S-030 (회귀 · C001 SPEC-010) — 이전 버전의 스냅샷은 복구되지 않는다', () => {
  it('버전이 다르면 null — 세계는 초기 배치로 시작한다', () => {
    const saved = driveWorld(solo).world.snapshot();
    expect(restoreWorld({ ...saved, version: 'hkt-adv-proto-i/1' })).toBeNull();

    const fresh = driveWorld(solo);
    expect(body(fresh).regionId).toBe(WHITE_KING_DOMAIN);
    expect(fresh.observe().scene).toBe(WHITE_KING_DOMAIN);
  });
});
