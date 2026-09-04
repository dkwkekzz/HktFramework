// C006 — 땅이 막고 흐른다 · 검증 시나리오 (spec SPEC-001 ~ SPEC-010 + 회귀)
//
// C005 는 땅을 **관찰자만** 만들었다. 이 Cycle 에서 세계가 처음 땅을 읽는다 —
// 그래서 여기서 재는 것의 절반은 "몸이 실제로 서는가" 다. 요청의 대답(status · reason)만
// 보는 것으로는 모자란다. 거절된 뒤 **몸의 자리가 그대로인가**를 늘 함께 본다.
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고, dispatch 로 요청하고, observe() 의 관찰
// 결과와 world.snapshot() 으로 확인한다. 이 Cycle 의 구현(세계가 땅을 드는 자리 · 이동 규칙의
// traversable 판정 · view 의 표)은 읽지 않았다. 기대값의 출처는
// cycles/C006-land-blocks-and-flows/spec.md 와 확정된 관찰 계약뿐이다.
//
// **좌표를 손으로 적지 않는다.** 강이 어디를 지나고 다리가 어디 있는지는 데이터다 —
// 그래서 이 파일은 언제나 Description 의 op 와 컴파일 결과에서 자리를 **골라** 쓴다.
// 규칙 표(경사 임계 · 강 폭 · 젖음 폭 · 다리 반경)도 값을 적지 않고 content/regions 의
// 표에서 읽는다. 세계와 관찰자가 같은 표를 읽는다는 것이 SPEC-006 의 주장이기 때문이다.
//
// **전체 개수를 단언하지 않는다** — 예외는 spec 이 못박은 수(curve 하나 · point 둘 · area 넷 ·
// 다리 하나 · 조건 셋)뿐이다.

import { describe, expect, it } from 'vitest';
import {
  areasOf,
  descriptionHash,
  distanceToPolyline,
  findPoint,
  pointsOf,
  type AreaOp,
  type CurveOp,
  type RegionDescription,
} from '../../../engine/world-authoring/description';
import { buildHeightField, slopeAtVertex, vertexX, vertexZ } from '../../../engine/world-authoring/height-field';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledRegion } from '../../../engine/world-authoring/compiled';
import { blockedReasonAt, isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import { terrainHeightSampler } from '../../../engine/view-kernel/terrain/terrain';
import type { ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { ANCHOR_LAYER, REGION_SPECS, START_REGION_ID, regionSpec } from '../../regions';
import {
  BLOCK_STEEP,
  BLOCK_WATER,
  BRIDGE_TAG,
  CITY_TAG,
  COMPILE_RULES,
  CONDITION_PREFIX,
  CONDITION_RIDGE,
  CONDITION_RIVER,
  CONDITION_TREE,
  FEATURE_LAYER,
  LANDMARK_LAYER,
  RIVER_TAG,
  SETTLEMENT_LAYER,
  SURFACE_WET,
} from '../../regions/terrain-rules';
import { createWorld, restoreWorld } from '../index';
import { TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, OBSERVER, PLAYER, type WorldDriver } from './drive';

// ── spec 이 못박은 값들 ────────────────────────────────────────
const DEG = Math.PI / 180;
/** 확정 1 — 통행 임계. 이 각부터 몸이 선다 (결정론 시뮬 상수) */
const STEEP_SLOPE = 45 * DEG;
/** C005 의 비탈 임계 — "오를 수 있는 곳" 을 고르는 데 쓴다 */
const WALK_SLOPE = 15 * DEG;
/** spec 이 이름까지 준 것 — landmark point 의 tag */
const TREE_TAG = 'WHITE_GIANT_TREE';
/** C005 까지의 백왕령 Description hash — 그때의 데이터(anchor 셋 + stamp 하나)로 잰 값이다 */
const WHITE_KING_HASH_AT_C005 = 'def82a11';
/** app/main.ts KEY_LOOKAHEAD — 클라이언트의 걸음은 늘 1.6m 앞을 요청한다 */
const KEY_LOOKAHEAD = 1.6;

/**
 * C004 까지의 anchor 표 — 아홉 방 전부 (SPEC-001 경계 "anchor point 는 아홉 방 모두 그대로다").
 * C005 도 C006 도 anchor 를 건드리지 않는다.
 */
const ANCHORS_AT_C004: Record<string, Record<string, [number, number]>> = {
  WHITE_KING_DOMAIN: { FOREST_PATH: [0, 18], RED_WASTE_PASS: [18, 0], ICE_CANYON_PASS: [-18, 0] },
  FOREST_EDGE: { FOREST_PATH: [0, -18], DEEP_TRAIL: [0, 18], RUIN_TRAIL: [-18, 0] },
  FOREST_DEEP: {
    DEEP_TRAIL: [0, -18],
    NEST_TRAIL: [-18, 0],
    ORE_TRAIL: [18, 0],
    TREE_APPROACH: [0, 18],
    ANCIENT_GATE: [-13, 13],
    RIVER_MOUTH: [14, -8],
  },
  EXPLORER_RUIN: { RUIN_TRAIL: [18, 0] },
  PREDATOR_NEST: { NEST_TRAIL: [18, 0] },
  BIO_ORE_FIELD: { ORE_TRAIL: [-18, 0], TREE_TRAIL: [0, 18] },
  RED_EYE_TREE: { FOREST_DEEP_SIDE: [0, -18], ORE_SIDE: [18, 0], INNER_DOOR: [0, 6] },
  TREE_INNER_WORLD: { OUTER_DOOR: [0, -38], FALL: [0, 38] },
  HEART_LAKE: { FALL_LANDING: [0, 0], RIVER: [0, -18] },
};

// ── 회귀가 쓰는 이름들 (C001~C004 의 표에서만 왔다) ────────────
const FOREST_EDGE = 'FOREST_EDGE';
const FOREST_DEEP = 'FOREST_DEEP';
const TREE_INNER_WORLD = 'TREE_INNER_WORLD';
const HEART_LAKE = 'HEART_LAKE';
const FOREST_PATH = 'FOREST_PATH';
const DEEP_TRAIL = 'DEEP_TRAIL';
const RED_WASTE_PASS = 'RED_WASTE_PASS';
const ICE_CANYON_PASS = 'ICE_CANYON_PASS';
const HEART_RIVER = 'HEART_RIVER';

// ── 하네스 (c003 · c004 · c005 의 선례 그대로) ─────────────────
const solo = { npcs: [] };

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const body = (w: WorldDriver) => state(w).actors.find((a) => a.id === PLAYER)!;
const here = (w: WorldDriver) => ({ x: body(w).position.x, z: body(w).position.z });
const exits = (v: GameViewSnapshot) => v.entities.filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string) => exits(v).find((e) => e.id === id);
const anchorAt = (region: string, tag: string) =>
  findPoint(regionSpec(region)!.space, ANCHOR_LAYER, tag)?.position;

const move = (w: WorldDriver, x: number, z: number): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x, z } });
const askTransit = (w: WorldDriver, connector: string) =>
  w.dispatchForOutcome({ interactionId: 'transit', targetEntityId: connector })[0];
const cross = (w: WorldDriver, connector: string) =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector });

/** 그 방 그 자리에 바로 세운 세계 */
const standing = (region: string, at: { x: number; z: number }) =>
  driveWorld({ ...solo, actorRegion: region, actorPosition: at });

function walkTo(w: WorldDriver, x: number, z: number) {
  const arrived = () => Math.hypot(body(w).position.x - x, body(w).position.z - z) <= 0.05;
  if (arrived()) return;
  expect(move(w, x, z).status).toBe('success');
  const steps = Math.ceil(120 / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) {
    w.tick(TICK_INTERVAL);
    if (arrived()) return;
  }
  throw new Error(`걸어서 (${x}, ${z}) 에 닿지 못했다 — 지금 자리 ${JSON.stringify(here(w))}`);
}

function crossFrom(w: WorldDriver, region: string, tag: string, connector: string) {
  const at = anchorAt(region, tag);
  if (!at) throw new Error(`${region} 에 anchor ${tag} 가 없다`);
  walkTo(w, at.x, at.z);
  expect(cross(w, connector)).toMatchObject({ status: 'success' });
}

function toForestDeep(w: WorldDriver) {
  crossFrom(w, START_REGION_ID, FOREST_PATH, FOREST_PATH);
  crossFrom(w, FOREST_EDGE, DEEP_TRAIL, DEEP_TRAIL);
}

// ── 땅을 재는 하네스 — 컨텐츠의 표로 컴파일한다 ────────────────
//
// 관찰자가 쓰는 그 표(content/regions/terrain-rules)를 그대로 쓴다. 세계도 같은 표를 읽는다는
// 것이 SPEC-006 의 주장이므로, 이 파일이 재는 격자는 곧 "관찰자가 그리는 땅" 이다.

const spaceOf = (id: string): RegionDescription => regionSpec(id)!.space;
const domain = () => spaceOf(START_REGION_ID);
const otherRooms = () => REGION_SPECS.filter((s) => s.id !== START_REGION_ID);

const compiledMemo = new WeakMap<RegionDescription, CompiledRegion>();
function compiled(d: RegionDescription): CompiledRegion {
  const hit = compiledMemo.get(d);
  if (hit) return hit;
  const made = compileRegion(d, COMPILE_RULES);
  compiledMemo.set(d, made);
  return made;
}

const curvesOf = (d: RegionDescription): CurveOp[] =>
  d.ops.filter((op): op is CurveOp => op.kind === 'curve');
const riverOf = (d: RegionDescription): CurveOp | undefined =>
  curvesOf(d).find((op) => op.layer === FEATURE_LAYER && op.tag === RIVER_TAG);
const river = () => {
  const op = riverOf(domain());
  if (!op) throw new Error('백왕령에 feature/river curve 가 없다 (SPEC-001)');
  return op;
};
const bridge = () => {
  const point = findPoint(domain(), FEATURE_LAYER, BRIDGE_TAG);
  if (!point) throw new Error('백왕령에 feature/bridge point 가 없다 (SPEC-001)');
  return point.position;
};

/** 막는 규칙 둘 — 이름이 아니라 형으로 고른다 (경사로 막는 것 · curve 로 막는 것) */
const blockRules = () => COMPILE_RULES.blocked ?? [];
const steepRule = () => {
  const rule = blockRules().find((r) => r.minSlope !== undefined);
  if (!rule) throw new Error('규칙 표에 경사로 막는 줄이 없다 (SPEC-002)');
  return rule;
};
const waterRule = () => {
  const rule = blockRules().find((r) => r.nearCurve !== undefined);
  if (!rule) throw new Error('규칙 표에 curve 로 막는 줄이 없다 (SPEC-003)');
  return rule;
};
/** 강이 막는 폭 (중심선에서의 거리) */
const waterMax = () => waterRule().nearCurve!.maxDistance;
/** 젖음이 붙는 폭 */
const wetMax = () => {
  const rule = COMPILE_RULES.surface.find((r) => r.tag === SURFACE_WET);
  if (!rule?.nearCurve) throw new Error('규칙 표에 젖음(wet) 줄이 없다 (SPEC-004)');
  return rule.nearCurve.maxDistance;
};
/** 다리가 덮는 반경 */
const passRadius = () => {
  const rule = (COMPILE_RULES.passages ?? []).find(
    (r) => r.layer === FEATURE_LAYER && r.tag === BRIDGE_TAG,
  );
  if (!rule) throw new Error('규칙 표에 다리 통과 줄이 없다 (SPEC-003)');
  return rule.radius;
};

/** 한 방의 vertex 하나 — 자리 · 높이 · 경사 · 표면 · 통행 · 사유 · 강/다리까지의 거리 */
interface Cell {
  ix: number;
  iz: number;
  x: number;
  z: number;
  y: number;
  slope: number;
  surfaceTag: string;
  traversable: boolean;
  reason: string;
  riverDistance: number;
  passed: boolean;
}

const cellsMemo = new WeakMap<RegionDescription, Cell[]>();
function cellsOf(d: RegionDescription): Cell[] {
  const hit = cellsMemo.get(d);
  if (hit) return hit;
  const world = compiled(d).world;
  const field = buildHeightField(d, world.resolution);
  const line = riverOf(d)?.points;
  const gate = findPoint(d, FEATURE_LAYER, BRIDGE_TAG)?.position;
  const radius = (COMPILE_RULES.passages ?? []).find(
    (r) => r.layer === FEATURE_LAYER && r.tag === BRIDGE_TAG,
  )?.radius;
  const out: Cell[] = [];
  for (let iz = 0; iz < world.rows; iz++) {
    for (let ix = 0; ix < world.cols; ix++) {
      const i = iz * world.cols + ix;
      const x = vertexX(field, ix);
      const z = vertexZ(field, iz);
      out.push({
        ix,
        iz,
        x,
        z,
        y: world.height[i] ?? 0,
        slope: slopeAtVertex(field, ix, iz),
        surfaceTag: world.surfaceTags[world.surface[i] ?? 0] ?? '?',
        traversable: (world.traversable[i] ?? 1) === 1,
        reason: world.blockedTags[world.blocked[i] ?? 0] ?? '',
        riverDistance: line ? distanceToPolyline(line, x, z) : Infinity,
        passed: gate !== undefined && radius !== undefined && Math.hypot(x - gate.x, z - gate.z) <= radius,
      });
    }
  }
  cellsMemo.set(d, out);
  return out;
}

const cells = () => cellsOf(domain());
/** 규칙이 순수히 경사로만 막는 자리 (강도 다리도 끼지 않은 곳) */
const steepCells = () =>
  cells().filter((c) => c.slope >= STEEP_SLOPE && !c.passed && c.riverDistance > waterMax());
/** 규칙이 순수히 물로만 막는 자리 */
const waterCells = () =>
  cells().filter((c) => c.riverDistance <= waterMax() && !c.passed && c.slope < STEEP_SLOPE);

const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);

/** 그 자리에 걸린 settlement/condition 태그들 — 관찰자 쪽 계산 */
const conditionsAt = (x: number, z: number): string[] =>
  tagsAt(compiled(domain()).world, x, z, SETTLEMENT_LAYER).filter((t) => t.startsWith(CONDITION_PREFIX));

/**
 * 클라이언트의 걸음을 이어 붙인다 — 한 번에 KEY_LOOKAHEAD(1.6m) 앞만 요청한다.
 * 거절되면 거기서 멈추고 그 대답을 돌려준다. 이것이 이 Cycle 의 핵심 관찰이다:
 * 짧은 걸음으로는 강을 **넘어갈 수 없고** 다리 자리에서만 건너진다.
 */
function stepAlongZ(w: WorldDriver, x: number, toZ: number): { rejected?: ActionResult; endZ: number } {
  const dir = Math.sign(toZ - body(w).position.z);
  for (let guard = 0; guard < 200; guard++) {
    const z = body(w).position.z;
    if (Math.abs(z - toZ) <= 0.05 || dir === 0) return { endZ: z };
    const target = dir > 0 ? Math.min(z + KEY_LOOKAHEAD, toZ) : Math.max(z - KEY_LOOKAHEAD, toZ);
    const result = move(w, x, target);
    if (result.status !== 'success') return { rejected: result, endZ: z };
    for (let i = 0; i < Math.ceil(3 / TICK_INTERVAL); i++) {
      w.tick(TICK_INTERVAL);
      if (Math.abs(body(w).position.z - target) <= 0.05) break;
    }
    if (Math.abs(body(w).position.z - z) < 1e-6) return { endZ: body(w).position.z }; // 나아가지 못했다
  }
  return { endZ: body(w).position.z };
}

// ─────────────────────────────────────────────────────────────
describe('SPEC-001 — 백왕령에 강과 거목과 조건이 놓인다', () => {
  it('S-001 curve 가 하나 있고 그것이 feature/river 다 — 파는 profile 이고 동서로 가로지른다', () => {
    // Given 세계가 만들어진다 (컨텐츠 데이터가 그대로 온다)
    const curves = curvesOf(domain());
    // Then curve 는 하나뿐이다 (spec 이 못박은 수)
    expect(curves.length).toBe(1);
    const op = curves[0]!;
    expect({ layer: op.layer, tag: op.tag, profile: op.profile }).toEqual({
      layer: FEATURE_LAYER,
      tag: RIVER_TAG,
      profile: 'carve',
    });
    // 값은 데이터다 — 점이 둘 이상이고 폭도 깊이도 0 이 아니다
    expect(op.points.length).toBeGreaterThanOrEqual(2);
    expect(op.width).toBeGreaterThan(0);
    expect(op.depth ?? 0).toBeGreaterThan(0);
    // 그리고 동서로 가로지른다 — x 로 뻗은 길이가 z 로 뻗은 길이보다 크고, 방의 동·서 변에 닿는다
    const xs = op.points.map((p) => p.x);
    const zs = op.points.map((p) => p.z);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanZ = Math.max(...zs) - Math.min(...zs);
    expect(spanX).toBeGreaterThan(spanZ);
    const { minX, maxX } = domain().extent;
    expect(Math.min(...xs)).toBeLessThanOrEqual(minX);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(maxX);
  });

  it('S-002 point 가 둘 는다 — feature/bridge 하나와 landmark/WHITE_GIANT_TREE 하나', () => {
    const gates = pointsOf(domain(), FEATURE_LAYER);
    expect(gates.map((p) => p.tag)).toEqual([BRIDGE_TAG]); // 건너는 자리는 하나다 (확정 3)
    const marks = pointsOf(domain(), LANDMARK_LAYER);
    expect(marks.map((p) => p.tag)).toEqual([TREE_TAG]);
    // 둘 다 방 안이다
    const { minX, maxX, minZ, maxZ } = domain().extent;
    for (const p of [...gates, ...marks]) {
      expect({ tag: p.tag, inside: p.position.x >= minX && p.position.x <= maxX && p.position.z >= minZ && p.position.z <= maxZ }).toEqual({
        tag: p.tag,
        inside: true,
      });
    }
    // 다리는 강 위에 있다 — 막는 폭 안이다 (그래야 덮을 것이 있다)
    expect(distanceToPolyline(river().points, bridge().x, bridge().z)).toBeLessThanOrEqual(waterMax());
  });

  it('S-003 area 가 넷 있다 — 조건 셋과 도시 하나, 전부 settlement layer 다', () => {
    const areas = domain().ops.filter((op): op is AreaOp => op.kind === 'area');
    expect(areas.length).toBe(4); // spec 이 못박은 수
    expect(areas.every((a) => a.layer === SETTLEMENT_LAYER)).toBe(true);
    expect([...areas.map((a) => a.tag)].sort()).toEqual(
      [CONDITION_RIDGE, CONDITION_RIVER, CONDITION_TREE, CITY_TAG].sort(),
    );
    // 모양은 데이터다 — 넓이가 0 이 아니다
    for (const area of areas) {
      if (area.shape.kind === 'circle') expect(area.shape.radius).toBeGreaterThan(0);
      else expect(area.shape.points.length).toBeGreaterThanOrEqual(3);
    }
    // 조회 기구가 같은 것을 준다 (layer 로 거른다)
    expect(areasOf(domain(), SETTLEMENT_LAYER).map((a) => a.tag)).toEqual(areas.map((a) => a.tag));
  });

  it('S-004 C005 의 stamp(ridge) 는 그대로 남는다', () => {
    const stamps = domain().ops.filter((op) => op.kind === 'stamp');
    expect(stamps.length).toBe(1);
    expect(stamps[0]).toMatchObject({ stamp: 'ridge' });
    // 그리고 그 능선이 실제로 북쪽에 서 있다 (C005 SPEC-001 의 결과가 그대로다)
    const highest = maxBy(cells(), (c) => c.y);
    expect(highest.y).toBeGreaterThan(0);
    expect(highest.z).toBeGreaterThan(0);
  });

  it('S-005 (경계) 나머지 여덟 방의 ops 에는 curve 도 settlement area 도 없다', () => {
    for (const spec of otherRooms()) {
      expect({
        region: spec.id,
        curves: curvesOf(spec.space).length,
        areas: areasOf(spec.space, SETTLEMENT_LAYER).length,
      }).toEqual({ region: spec.id, curves: 0, areas: 0 });
    }
  });

  it('S-006 (경계) anchor point 는 아홉 방 모두 C004 의 표 그대로다', () => {
    const now: Record<string, Record<string, [number, number]>> = {};
    for (const spec of REGION_SPECS) {
      now[spec.id] = Object.fromEntries(
        pointsOf(spec.space, ANCHOR_LAYER).map((p) => [p.tag, [p.position.x, p.position.z]]),
      );
    }
    expect(now).toEqual(ANCHORS_AT_C004);
  });
});

describe('SPEC-002 — 급경사는 몸을 막는다', () => {
  it('S-007 45° 이상인 격자 칸은 통행이 0 이고 급경사 사유를 갖는다', () => {
    // Given 컨텐츠의 규칙 표로 컴파일한 백왕령
    const steep = steepCells();
    // Then 그런 자리가 실제로 있다 (검사가 헛돌지 않는다)
    expect(steep.length).toBeGreaterThan(0);
    // 그리고 전부 막혀 있고 사유가 급경사다
    for (const c of steep) {
      expect({ at: [c.x, c.z], traversable: c.traversable, reason: c.reason }).toEqual({
        at: [c.x, c.z],
        traversable: false,
        reason: BLOCK_STEEP,
      });
    }
    // 임계는 확정 1 의 45° 다 — 규칙 표가 그 값을 들고 있다
    expect(steepRule().minSlope).toBeCloseTo(STEEP_SLOPE, 9);
    expect(steepRule().reason).toBe(BLOCK_STEEP);
  });

  it('S-008 그 자리로 이동을 요청하면 거절되고 몸이 선다 — 사유 코드는 too-steep 이다', () => {
    // Given 백왕령에 선 몸
    const w = driveWorld(solo);
    const target = maxBy(steepCells(), (c) => c.slope);
    const before = here(w);
    // When 능선의 급경사 자리로 간다고 한다
    const result = move(w, target.x, target.z);
    // Then 거절된다 — 규칙은 그대로 RULE-MOVE-001 이고 사유 코드가 하나 늘었다
    expect(result).toEqual({ status: 'failure', rule: 'RULE-MOVE-001', reason: BLOCK_STEEP });
    expect(BLOCK_STEEP).toBe('too-steep');
    // 그리고 몸이 실제로 서 있다 — 자리가 바뀌지 않고, 시간이 흘러도 그대로다
    expect(here(w)).toEqual(before);
    for (let i = 0; i < 30; i++) w.tick(TICK_INTERVAL);
    expect(here(w)).toEqual(before);
    // 요청한 이에게도 같은 대답이 간다
    expect(w.dispatchForOutcome({ interactionId: 'move', position: { x: target.x, z: target.z } })[0]).toMatchObject({
      accepted: false,
      reason: BLOCK_STEEP,
    });
  });

  it('S-009 (경계) 같은 능선의 비탈(45° 미만)로는 받아들여지고 실제로 그 자리에 선다', () => {
    // Given 경사가 15° 이상 45° 미만이고 막히지 않은 북쪽 자리 — 오를 수 있는 곳
    const slopes = cells().filter(
      (c) => c.slope >= WALK_SLOPE && c.slope < STEEP_SLOPE && c.traversable && c.z > 0,
    );
    expect(slopes.length).toBeGreaterThan(0);
    // Then 그런 자리로는 이동이 받아들여진다
    const w = driveWorld(solo);
    for (const c of slopes.slice(0, 8)) {
      expect({ at: [c.x, c.z], status: move(w, c.x, c.z).status }).toEqual({ at: [c.x, c.z], status: 'success' });
    }
    // 그리고 걸어가 그 자리에 선다 — 오를 수 있는 곳과 막힌 곳이 갈린다
    const one = slopes[0]!;
    const fresh = driveWorld(solo);
    walkTo(fresh, one.x, one.z);
    expect(body(fresh).regionId).toBe(START_REGION_ID);
  });

  it('S-010 (경계) extent 판정이 먼저다 — 방 밖은 여전히 out-of-bounds 이지 too-steep 이 아니다', () => {
    const w = driveWorld(solo);
    const { maxX, maxZ } = domain().extent;
    expect(move(w, maxX + 0.5, 0)).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'out-of-bounds',
    });
    expect(move(w, 0, maxZ + 0.5)).toMatchObject({ reason: 'out-of-bounds' });
  });
});

describe('SPEC-003 — 물은 막고 다리는 건네준다', () => {
  it('S-011 강 폭 안의 격자 칸은 통행이 0 이고 물 사유를 갖는다 — 급경사 사유와 다르다', () => {
    const water = waterCells();
    expect(water.length).toBeGreaterThan(0);
    for (const c of water) {
      expect({ at: [c.x, c.z], traversable: c.traversable, reason: c.reason }).toEqual({
        at: [c.x, c.z],
        traversable: false,
        reason: BLOCK_WATER,
      });
    }
    expect(BLOCK_WATER).toBe('deep-water');
    expect(BLOCK_WATER).not.toBe(BLOCK_STEEP);
    expect(waterRule().nearCurve).toMatchObject({ layer: FEATURE_LAYER, tag: RIVER_TAG });
  });

  it('S-012 강으로 이동을 요청하면 거절되고 몸이 선다', () => {
    const w = driveWorld(solo);
    const target = waterCells()[0]!;
    const before = here(w);
    const result = move(w, target.x, target.z);
    expect(result).toEqual({ status: 'failure', rule: 'RULE-MOVE-001', reason: BLOCK_WATER });
    expect(here(w)).toEqual(before);
    for (let i = 0; i < 30; i++) w.tick(TICK_INTERVAL);
    expect(here(w)).toEqual(before);
  });

  it('S-013 (경계) 다리 자리는 물 위여도 통행 가능하다 — 놓은 것이 규칙을 이긴다', () => {
    const gate = bridge();
    const world = compiled(domain()).world;
    // Given 다리 자리는 강이 막는 폭 안이다 (S-002 가 이미 못박았다)
    expect(distanceToPolyline(river().points, gate.x, gate.z)).toBeLessThanOrEqual(waterMax());
    // Then 그래도 통행 가능하다
    expect(isTraversableAt(world, gate.x, gate.z)).toBe(true);
    expect(blockedReasonAt(world, gate.x, gate.z)).toBeNull();
    // 그리고 세계도 그 자리로 가는 것을 받아들인다
    expect(move(driveWorld(solo), gate.x, gate.z).status).toBe('success');
  });

  it('S-014 (경계) 짧은 걸음으로 남북을 오간다 — 다리 자리에서만 건너진다', () => {
    const gate = bridge();
    const span = waterMax() + 3;
    const southZ = gate.z - span;
    const northZ = gate.z + span;

    // Given 다리 남쪽에 선 몸 — 클라이언트의 걸음(1.6m)을 이어 붙인다
    const onBridge = standing(START_REGION_ID, { x: gate.x, z: southZ });
    const crossed = stepAlongZ(onBridge, gate.x, northZ);
    // Then 강을 건너 북쪽에 닿는다 — 한 걸음도 거절되지 않는다
    expect(crossed.rejected).toBeUndefined();
    expect(crossed.endZ).toBeGreaterThan(gate.z);
    // 되건너오는 것도 된다 — 남북을 **오간다**
    const back = stepAlongZ(onBridge, gate.x, southZ);
    expect(back.rejected).toBeUndefined();
    expect(back.endZ).toBeLessThan(gate.z);

    // Given 다리에서 먼 열 — 같은 강, 같은 걸음
    const far = cells().find(
      (c) => Math.abs(c.z - gate.z) < 1 && !c.traversable && c.reason === BLOCK_WATER && !c.passed,
    );
    expect(far).toBeDefined();
    const elsewhere = standing(START_REGION_ID, { x: far!.x, z: southZ });
    const stopped = stepAlongZ(elsewhere, far!.x, northZ);
    // Then 강 앞에서 세계가 대답한다 — 넘어가지 못한다
    expect(stopped.rejected).toMatchObject({ status: 'failure', reason: BLOCK_WATER });
    expect(stopped.endZ).toBeLessThan(gate.z);
  });

  it('S-015 (경계) 남북을 잇는 자리가 하나뿐이다 — 강은 방을 가로지르고 건널 열은 다리 하나다', () => {
    const grid = cells();
    const band = grid.filter((c) => c.riverDistance <= waterMax());
    expect(band.length).toBeGreaterThan(0);

    // 강이 방을 동서로 다 가로지른다 — 어느 열에도 강이 있다
    const columns = [...new Set(grid.map((c) => c.ix))].sort((a, b) => a - b);
    const bandColumns = new Set(band.map((c) => c.ix));
    expect([...bandColumns].sort((a, b) => a - b)).toEqual(columns);

    // 그 열에서 강을 건널 수 있는가 = 그 열의 강 칸이 전부 통행 가능한가
    const crossable = columns.filter((ix) =>
      band.filter((c) => c.ix === ix).every((c) => c.traversable),
    );
    expect(crossable.length).toBeGreaterThan(0);
    // 이어진 한 덩이다 — 건너는 자리가 여기저기 흩어져 있지 않다
    expect(crossable[crossable.length - 1]! - crossable[0]! + 1).toBe(crossable.length);
    // 그리고 그 덩이가 다리 자리다
    const gateColumn = grid.find((c) => Math.hypot(c.x - bridge().x, c.z - bridge().z) < 1)!.ix;
    expect(crossable).toContain(gateColumn);
    // 나머지 열은 전부 막혀 있다 — 길이 하나뿐이라는 뜻이다
    expect(crossable.length).toBeLessThan(columns.length);
  });
});

describe('SPEC-004 — 강가는 젖는다', () => {
  it('S-016 젖음 태그가 있고 강 곁에만 붙는다', () => {
    const world = compiled(domain()).world;
    // Then 표면 태그에 젖음이 있다 (확정 5 의 넷이 다 선다)
    expect(world.surfaceTags).toContain(SURFACE_WET);
    // 그리고 젖는 자리는 정확히 "중심선에서 정해진 거리 안" 이다
    const wet = cells().filter((c) => c.surfaceTag === SURFACE_WET);
    expect(wet.length).toBeGreaterThan(0);
    for (const c of cells()) {
      expect({ at: [c.x, c.z], wet: c.surfaceTag === SURFACE_WET }).toEqual({
        at: [c.x, c.z],
        wet: c.riverDistance <= wetMax(),
      });
    }
  });

  it('S-017 거기서 먼 평지에는 붙지 않는다 — 남쪽 변이 그대로 마른 땅이다', () => {
    const south = cells().filter((c) => c.z === domain().extent.minZ);
    expect(south.length).toBeGreaterThan(0);
    // 남쪽 변은 강에서 멀다 (검사가 헛돌지 않는다)
    expect(Math.min(...south.map((c) => c.riverDistance))).toBeGreaterThan(wetMax());
    expect(south.filter((c) => c.surfaceTag === SURFACE_WET)).toEqual([]);
  });

  it('S-018 (경계) 강이 없는 방에는 젖음이 하나도 없다 — 표면은 규칙 표가 아니라 데이터가 만든다', () => {
    for (const spec of otherRooms()) {
      const world = compiled(spec.space).world;
      const wetIndex = world.surfaceTags.indexOf(SURFACE_WET);
      // 표는 같다 — 태그 목록에는 젖음이 있다
      expect({ region: spec.id, hasTag: wetIndex >= 0 }).toEqual({ region: spec.id, hasTag: true });
      // 그러나 쓰이지 않는다
      expect({ region: spec.id, used: [...world.surface].includes(wetIndex) }).toEqual({
        region: spec.id,
        used: false,
      });
    }
  });

  it('S-019 (경계) 백왕령에서도 curve 를 빼면 젖음이 사라진다 — 같은 표, 다른 데이터', () => {
    const dry: RegionDescription = { ...domain(), ops: domain().ops.filter((op) => op.kind !== 'curve') };
    const world = compiled(dry).world;
    const wetIndex = world.surfaceTags.indexOf(SURFACE_WET);
    expect(wetIndex).toBeGreaterThanOrEqual(0);
    expect([...world.surface].includes(wetIndex)).toBe(false);
  });
});

describe('SPEC-005 — 강은 땅을 판다', () => {
  const dryDomain = (): RegionDescription => ({
    ...domain(),
    ops: domain().ops.filter((op) => op.id !== river().id),
  });

  it('S-020 강 중심선 위의 높이가 curve 전보다 낮다', () => {
    // Given curve 를 더하기 전과 후의 같은 방
    const before = compiled(dryDomain()).world;
    const after = compiled(domain()).world;
    expect({ cols: after.cols, rows: after.rows }).toEqual({ cols: before.cols, rows: before.rows });
    // When 중심선 위의 자리를 잰다
    const online = cells().filter((c) => c.riverDistance <= 0.5);
    expect(online.length).toBeGreaterThan(0);
    // Then 후가 낮다
    for (const c of online) {
      const i = c.iz * after.cols + c.ix;
      expect({ at: [c.x, c.z], carved: (after.height[i] ?? 0) < (before.height[i] ?? 0) }).toEqual({
        at: [c.x, c.z],
        carved: true,
      });
    }
    // 파는 깊이만큼 낮다 — 데이터의 depth 를 넘지 않는다
    const deepest = maxBy(online, (c) => {
      const i = c.iz * after.cols + c.ix;
      return (before.height[i] ?? 0) - (after.height[i] ?? 0);
    });
    const di = deepest.iz * after.cols + deepest.ix;
    expect((before.height[di] ?? 0) - (after.height[di] ?? 0)).toBeLessThanOrEqual(river().depth! + 1e-6);
  });

  it('S-021 강 폭 밖의 자리는 두 경우가 같다 — carve 는 자기 폭 안에서만 작용한다', () => {
    const before = compiled(dryDomain()).world;
    const after = compiled(domain()).world;
    const outside = cells().filter((c) => c.riverDistance > river().width / 2);
    expect(outside.length).toBeGreaterThan(0);
    for (const c of outside) {
      const i = c.iz * after.cols + c.ix;
      expect(after.height[i]).toBeCloseTo(before.height[i] ?? 0, 6);
    }
  });

  it('S-022 (경계) curve 의 값 하나가 달라지면 region hash 가 달라진다', () => {
    const space = domain();
    const op = river();
    const variantOf = (patch: Partial<CurveOp>): RegionDescription => ({
      ...space,
      ops: space.ops.map((each) => (each.id === op.id ? { ...op, ...patch } : each)),
    });
    const moved = [{ x: op.points[0]!.x, z: op.points[0]!.z + 1 }, ...op.points.slice(1)];
    const variants: [string, RegionDescription][] = [
      ['폭', variantOf({ width: op.width + 1 })],
      ['깊이', variantOf({ depth: (op.depth ?? 0) + 1 })],
      ['점 하나', variantOf({ points: moved })],
    ];
    const base = descriptionHash(space);
    for (const [what, variant] of variants) {
      expect({ what, same: descriptionHash(variant) === base }).toEqual({ what, same: false });
    }
    // 그리고 땅도 실제로 달라진다 — hash 만 흔들린 것이 아니다
    expect([...compiled(variants[0]![1]).world.height]).not.toEqual([...compiled(space).world.height]);
    // 세계의 데이터는 하나도 바뀌지 않았다 (변형은 값으로 지었다)
    expect(curvesOf(domain())[0]!.width).toBe(op.width);
  });
});

describe('SPEC-006 — 세계와 관찰자가 같은 땅을 읽는다', () => {
  it('S-023 봉투의 region.hash 가 관찰자가 자기 Description 에서 잰 값과 같다', () => {
    const w = driveWorld(solo);
    expect(w.observe().region).toEqual({
      id: START_REGION_ID,
      hash: descriptionHash(domain()),
    });
    // 방을 옮겨도 그대로다
    toForestDeep(w);
    expect(w.observe().region).toEqual({ id: FOREST_DEEP, hash: descriptionHash(spaceOf(FOREST_DEEP)) });
  });

  it('S-024 세계가 막는 자리와 관찰자가 그리는 자리가 같은 격자 칸이다', () => {
    // Given 관찰자가 자기 표로 컴파일한 땅 (막힌 칸 · 열린 칸을 골고루 훑는다)
    const world = compiled(domain()).world;
    const grid = cells();
    const sample = [
      ...steepCells().slice(0, 10),
      ...waterCells().slice(0, 10),
      ...grid.filter((c) => c.traversable).filter((_, i) => i % 97 === 0).slice(0, 20),
    ];
    expect(sample.filter((c) => !c.traversable).length).toBeGreaterThan(0);
    expect(sample.filter((c) => c.traversable).length).toBeGreaterThan(0);

    // When 세계에 그 자리들을 하나씩 물어본다 (거절은 몸을 움직이지 않으므로 세계 하나로 족하다)
    const w = driveWorld(solo);
    for (const c of sample) {
      const result = move(w, c.x, c.z);
      // Then 세계의 대답과 관찰자의 격자가 같은 말을 한다 — 사유까지 같다
      expect({
        at: [c.x, c.z],
        accepted: result.status === 'success',
        reason: result.status === 'success' ? null : result.reason,
      }).toEqual({
        at: [c.x, c.z],
        accepted: isTraversableAt(world, c.x, c.z),
        reason: blockedReasonAt(world, c.x, c.z),
      });
    }
  });

  it('S-025 (경계) 같은 Description 을 두 번 컴파일하면 traversable 격자의 모든 값이 같다', () => {
    const a = compileRegion(domain(), COMPILE_RULES);
    const b = compileRegion(domain(), COMPILE_RULES);
    expect([...b.world.traversable]).toEqual([...a.world.traversable]);
    expect([...b.world.blocked]).toEqual([...a.world.blocked]);
    expect(b.world.blockedTags).toEqual(a.world.blockedTags);
    expect([...b.world.surface]).toEqual([...a.world.surface]);
    expect([...b.world.height]).toEqual([...a.world.height]);
    expect(b.hash).toBe(a.hash);
    // 여덟 방도 마찬가지다 — 컴파일은 순수하다
    for (const spec of otherRooms()) {
      const x = compileRegion(spec.space, COMPILE_RULES);
      const y = compileRegion(spec.space, COMPILE_RULES);
      expect({ region: spec.id, t: [...y.world.traversable] }).toEqual({
        region: spec.id,
        t: [...x.world.traversable],
      });
    }
  });
});

describe('SPEC-007 — 조건 area 가 왜 안전한지를 말한다', () => {
  /** 그 조건 하나만 걸린 자리 하나 — 데이터에서 고른다 */
  const soleCellOf = (tag: string) =>
    cells().find((c) => {
      const tags = conditionsAt(c.x, c.z);
      return tags.length === 1 && tags[0] === tag;
    });

  it('S-026 조건 셋 각각의 안에 서면 그 조건이 투영된다 — 셋이 서로 다른 코드다', () => {
    const wanted = [CONDITION_RIDGE, CONDITION_RIVER, CONDITION_TREE];
    expect(new Set(wanted).size).toBe(3);
    for (const tag of wanted) {
      // Given 그 조건 area 안의 자리 (겹치지 않은 곳)
      const cell = soleCellOf(tag);
      expect({ tag, found: cell !== undefined }).toEqual({ tag, found: true });
      // When 관찰자가 거기 선다
      const v = standing(START_REGION_ID, { x: cell!.x, z: cell!.z }).observe();
      // Then 그 조건이 관찰 결과에 실린다
      expect({ tag, standing: v.standingConditions }).toEqual({ tag, standing: [tag] });
    }
    // 셋 다 condition 접두사를 쓴다 (Concept §3.5 의 condition 을 셋으로 가른 것이다)
    for (const tag of wanted) expect(tag.startsWith(CONDITION_PREFIX)).toBe(true);
  });

  it('S-027 (경계) 조건 area 밖에 서면 아무 사유도 실리지 않는다', () => {
    // Given 같은 방의 다른 자리 — 조건이 하나도 걸리지 않은 곳
    const outside = cells().find((c) => conditionsAt(c.x, c.z).length === 0);
    expect(outside).toBeDefined();
    const v = standing(START_REGION_ID, { x: outside!.x, z: outside!.z }).observe();
    expect(v.standingConditions).toEqual([]);
    // 관찰 계약의 형은 언제나 배열이다 — 없으면 빈 목록이지 undefined 가 아니다
    expect(Array.isArray(v.standingConditions)).toBe(true);
  });

  it('S-028 (경계) 자리마다 걸린 것을 전부 낸다 — 하나로 줄이지 않는다', () => {
    // Given 조건이 걸린 자리들을 골고루 (겹친 자리가 있으면 그것부터)
    const tagged = cells().filter((c) => conditionsAt(c.x, c.z).length > 0);
    expect(tagged.length).toBeGreaterThan(0);
    const overlaps = tagged.filter((c) => conditionsAt(c.x, c.z).length > 1);
    const sample = [...overlaps.slice(0, 4), ...tagged.filter((_, i) => i % 23 === 0).slice(0, 8)];

    for (const c of sample) {
      // Then 세계가 투영한 것이 그 자리에 걸린 것 전부다 — 우선순위를 지어내지 않는다
      const v = standing(START_REGION_ID, { x: c.x, z: c.z }).observe();
      expect({ at: [c.x, c.z], standing: [...v.standingConditions].sort() }).toEqual({
        at: [c.x, c.z],
        standing: [...conditionsAt(c.x, c.z)].sort(),
      });
    }
    // 겹치는 자리가 데이터에 있다면 실제로 둘 이상이 함께 뜬 것을 보았다.
    // 없다면 위의 자리별 대조가 "줄이지 않는다" 를 이미 지킨다 (spec 은 겹침을 요구하지 않는다).
    if (overlaps.length > 0) {
      const v = standing(START_REGION_ID, { x: overlaps[0]!.x, z: overlaps[0]!.z }).observe();
      expect(v.standingConditions.length).toBeGreaterThan(1);
    }
  });

  it('S-029 (경계) 도시 area 는 조건이 아니다 — 투영에 섞이지 않는다', () => {
    // Given 도시 area 안의 자리
    const inCity = cells().find((c) => tagsAt(compiled(domain()).world, c.x, c.z, SETTLEMENT_LAYER).includes(CITY_TAG));
    expect(inCity).toBeDefined();
    const v = standing(START_REGION_ID, { x: inCity!.x, z: inCity!.z }).observe();
    // Then 실리는 것은 condition 접두사가 붙은 것뿐이다
    expect(v.standingConditions).not.toContain(CITY_TAG);
    for (const tag of v.standingConditions) expect(tag.startsWith(CONDITION_PREFIX)).toBe(true);
  });

  it.todo(
    'GAP: HUD 가 그 조건을 **무슨 문구로** 말하는가(Observable Result ⑤)는 view 의 표가 짓는다 — content/view/tests/c006-terrain-view.spec.ts 가 잰다',
  );
});

describe('SPEC-008 — 거목이 땅에 선다', () => {
  it('S-030 landmark point 가 그리는 쪽 instance 하나로 나오고 그 자리의 높이가 격자의 높이다', () => {
    // Given 백왕령의 컴파일 결과
    const region = compiled(domain());
    const mark = pointsOf(domain(), LANDMARK_LAYER)[0]!;
    // Then instance 가 하나 나온다
    expect(region.view.instances.length).toBe(1);
    const instance = region.view.instances[0]!;
    expect({ tag: instance.tag, x: instance.position.x, z: instance.position.z }).toEqual({
      tag: TREE_TAG,
      x: mark.position.x,
      z: mark.position.z,
    });
    // 그리고 그 y 가 격자의 높이다 — 땅에 붙어 있다
    const sample = terrainHeightSampler(region.world);
    expect(instance.y).toBeCloseTo(sample(instance.position.x, instance.position.z), 6);
    // 컴파일 산출에도 point 로 남아 있다 (자리로 묻는 조회의 원본)
    expect(region.world.points).toEqual(
      expect.arrayContaining([{ layer: LANDMARK_LAYER, tag: TREE_TAG, position: mark.position }]),
    );
  });

  it('S-031 거목이 도시 곁에 선다 — 그 자리가 도시 area 안이거나 그 둘레다', () => {
    const mark = pointsOf(domain(), LANDMARK_LAYER)[0]!;
    const city = areasOf(domain(), SETTLEMENT_LAYER).find((a) => a.tag === CITY_TAG)!;
    const centerOf = (area: AreaOp) =>
      area.shape.kind === 'circle'
        ? area.shape.center
        : {
            x: area.shape.points.reduce((s, p) => s + p.x, 0) / area.shape.points.length,
            z: area.shape.points.reduce((s, p) => s + p.z, 0) / area.shape.points.length,
          };
    const spanOf = (area: AreaOp) =>
      area.shape.kind === 'circle'
        ? area.shape.radius
        : Math.max(...area.shape.points.map((p) => Math.hypot(p.x - centerOf(area).x, p.z - centerOf(area).z)));
    // 도시의 크기만큼 곁에 있다 — "곁" 의 자로 도시 자신을 쓴다 (거리 값을 지어내지 않는다)
    const c = centerOf(city);
    expect(Math.hypot(mark.position.x - c.x, mark.position.z - c.z)).toBeLessThanOrEqual(spanOf(city) * 2);
  });

  it('S-032 (경계) landmark 가 없는 방에는 instance 가 없다 — 없는 것을 지어내지 않는다', () => {
    for (const spec of otherRooms()) {
      expect({ region: spec.id, instances: compiled(spec.space).view.instances }).toEqual({
        region: spec.id,
        instances: [],
      });
    }
  });
});

describe('SPEC-009 — 데이터가 없는 방은 아무것도 막지 않는다', () => {
  // C007 SPEC-009 가 이 주장을 **좁혔다** — 숲 가장자리에 stamp(basin) 하나가 늘면서 그 방에도
  // 막히는 칸이 생긴다. 규칙은 한 글자도 바뀌지 않았고 데이터가 늘었을 뿐이다 (C007 spec R2 · SPEC-010).
  const stillEmptyRooms = () => otherRooms().filter((s) => s.id !== FOREST_EDGE);

  it('S-033 stamp 도 curve 도 없는 일곱 방은 traversable 이 전부 1 이다 (C007 SPEC-009 로 좁혀졌다)', () => {
    for (const spec of stillEmptyRooms()) {
      const world = compiled(spec.space).world;
      expect({ region: spec.id, blockedCells: [...world.traversable].filter((v) => v !== 1).length }).toEqual({
        region: spec.id,
        blockedCells: 0,
      });
      expect({ region: spec.id, reasons: [...new Set(world.blocked)] }).toEqual({ region: spec.id, reasons: [0] });
    }
  });

  it('S-034 그 방들의 이동은 C005 까지와 같이 extent 만으로 판정된다', () => {
    for (const spec of otherRooms()) {
      const start = pointsOf(spec.space, ANCHOR_LAYER)[0]!.position;
      const w = standing(spec.id, start);
      const { minX, maxX, minZ, maxZ } = spec.space.extent;
      // 방 안의 네 귀퉁이는 전부 받아들여진다
      for (const p of [
        { x: minX, z: minZ },
        { x: maxX, z: maxZ },
        { x: minX, z: maxZ },
        { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
      ]) {
        expect({ region: spec.id, p, status: move(w, p.x, p.z).status }).toEqual({
          region: spec.id,
          p,
          status: 'success',
        });
      }
      // 밖은 out-of-bounds 다 — 사유가 늘지 않았다
      expect({ region: spec.id, result: move(w, maxX + 0.5, 0) }).toEqual({
        region: spec.id,
        result: { status: 'failure', rule: 'RULE-MOVE-001', reason: 'out-of-bounds' },
      });
    }
  });

  it.todo(
    'GAP: "Description 을 모르는 region id 면 땅이 없고 extent 판정만으로 돈다"(SPEC-009 경계)를 놓을 Given 이 없다 — ' +
      'createWorld 는 모르는 Region 에 몸을 놓지 못하고(「세계가 모르는 Region 이다」로 던진다) frontier 로 건너기는 region-not-built 로 막힌다',
  );
});

describe('SPEC-010 — 땅은 여전히 저장되지 않는다', () => {
  const savedOf = (w: WorldDriver) => JSON.parse(JSON.stringify(w.world.snapshot()));

  it('S-035 스냅샷에 height · surface · traversable 이 없다', () => {
    const w = driveWorld(solo);
    walkTo(w, 0, 2); // 강가까지 걸어 본 뒤에도 그대로다
    const saved = savedOf(w);

    // 격자를 실을 만한 키가 없다 ('height' 는 C001 부터 **몸의 키**였다 — 늘 수 하나여야 한다)
    const forbidden = ['traversable', 'blocked', 'blockedTags', 'surface', 'surfaceTags', 'chunks', 'terrain'];
    const found: string[] = [];
    const heights: unknown[] = [];
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
          if (key === 'height') heights.push(item);
          walk(item, `${path}.${key}`);
        }
      }
    };
    walk(saved.state, 'state');
    walk(JSON.parse(JSON.stringify(w.observe())), 'view');
    expect(found).toEqual([]);
    for (const value of heights) expect(typeof value).toBe('number');
    // 격자만 한 배열이 실릴 자리가 없다
    expect(longestArray).toBeLessThan(compiled(domain()).world.height.length);
  });

  it('S-036 되살린 세계가 같은 Description 에서 땅을 다시 만들고 똑같이 막는다', () => {
    // Given 저장하고 파일을 지나 되살린 세계
    const saved = savedOf(driveWorld(solo));
    const restored = restoreWorld(saved);
    expect(restored).not.toBeNull();
    const revived = createWorld({}, restored!);
    revived.join(OBSERVER);
    revived.tick(0);

    const ask = (p: { x: number; z: number }): ActionResult => {
      revived.request(OBSERVER, { interactionId: 'move', position: p });
      const result = revived.tick(0).results[0];
      if (!result) throw new Error('요청이 처리되지 않았다');
      return result;
    };
    // Then 급경사도 물도 되살린 뒤에 똑같이 막는다
    const steep = maxBy(steepCells(), (c) => c.slope);
    expect(ask({ x: steep.x, z: steep.z })).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: BLOCK_STEEP,
    });
    const water = waterCells()[0]!;
    expect(ask({ x: water.x, z: water.z })).toMatchObject({ reason: BLOCK_WATER });
    // 다리는 여전히 건네준다
    expect(ask(bridge()).status).toBe('success');
    // 그리고 hash 도 같은 값이다 — 되살림은 같은 Description 을 다시 읽을 뿐이다
    // 봉투 형에서 팩 형으로 좁힌다 (drive.ts 의 observe 와 같은 방식)
    const observed = revived.latestObservation(OBSERVER) as GameViewSnapshot | null;
    expect(observed).not.toBeNull();
    expect(observed!.region.hash).toBe(descriptionHash(domain()));
  });

  it('S-037 (경계) 백왕령의 hash 는 C005 때와 다르다 — 형이 아니라 데이터가 바뀌었다', () => {
    const space = domain();
    expect(descriptionHash(space)).not.toBe(WHITE_KING_HASH_AT_C005);
    // 달라진 이유가 이 Cycle 의 op 일곱이다 — 그것만 빼면 C005 의 값으로 돌아온다
    const asC005: RegionDescription = {
      ...space,
      ops: space.ops.filter(
        (op) => op.kind === 'stamp' || (op.kind === 'point' && op.layer === ANCHOR_LAYER),
      ),
    };
    expect(space.ops.length - asC005.ops.length).toBe(7); // curve 하나 · point 둘 · area 넷
    expect(descriptionHash(asC005)).toBe(WHITE_KING_HASH_AT_C005);
    // 나머지 여덟 방의 hash 는 손대지 않았다
    for (const spec of otherRooms()) {
      expect({ region: spec.id, hash: descriptionHash(spec.space) }).toEqual({
        region: spec.id,
        hash: standing(spec.id, pointsOf(spec.space, ANCHOR_LAYER)[0]!.position).observe().region.hash,
      });
    }
  });
});

// ── 회귀 — C001~C005 의 행동이 그대로인가 ─────────────────────

describe('회귀', () => {
  it('R-001 (C002~C003) 방 사이 건너기가 그대로다 — 백왕령에서 숲 안쪽까지 걸어간다', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    expect(body(w).regionId).toBe(FOREST_DEEP);
    const v = w.observe();
    expect(exits(v).length).toBe(5);
    expect(exits(v).filter((e) => e.state === 'locked')).toEqual([]);
  });

  it('R-002 (C003 R-003) 백왕령의 출구는 셋이고 그 자리로 걸어갈 수 있다 — 땅이 막아도 문은 열려 있다', () => {
    const w = driveWorld(solo);
    const v = w.observe();
    expect(exits(v).length).toBe(3);
    for (const id of [RED_WASTE_PASS, ICE_CANYON_PASS]) {
      expect(exitOf(v, id)).toMatchObject({ state: 'open', kind: 'pass' });
    }
    // anchor 셋이 전부 통행 가능한 자리다 — 강도 능선도 문을 파묻지 않았다
    const world = compiled(domain()).world;
    for (const p of pointsOf(domain(), ANCHOR_LAYER)) {
      expect({ tag: p.tag, traversable: isTraversableAt(world, p.position.x, p.position.z) }).toEqual({
        tag: p.tag,
        traversable: true,
      });
      expect({ tag: p.tag, status: move(w, p.position.x, p.position.z).status }).toEqual({
        tag: p.tag,
        status: 'success',
      });
    }
  });

  it('R-003 (C002 · C003) 건너기의 사유 코드가 그대로다 — 땅의 사유가 여기 섞이지 않는다', () => {
    const reasons = new Set<string>();
    const a = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    reasons.add(askTransit(a, 'NO_SUCH_PATH')!.reason!);
    reasons.add(askTransit(a, DEEP_TRAIL)!.reason!);
    reasons.add(askTransit(a, FOREST_PATH)!.reason!);
    const b = driveWorld(solo);
    walkTo(b, 18, 0);
    reasons.add(askTransit(b, RED_WASTE_PASS)!.reason!);
    expect([...reasons].sort()).toEqual(
      ['unknown-connector', 'wrong-region', 'out-of-range', 'region-not-built'].sort(),
    );
    expect([...reasons]).not.toContain(BLOCK_STEEP);
    expect([...reasons]).not.toContain(BLOCK_WATER);
  });

  it('R-004 (C003 SPEC-006) 추락은 그대로다 — 큰 방 끝에 서면 Tick 하나로 심장 호수다', () => {
    const w = standing(TREE_INNER_WORLD, { x: 0, z: 36.5 });
    w.tick(TICK_INTERVAL);
    expect(body(w).regionId).toBe(HEART_LAKE);
    expect(w.observe().scene).toBe(HEART_LAKE);
  });

  it('R-005 (C003 SPEC-008) 물길은 그대로다 — 심장 호수에서 숲 안쪽으로 나온다', () => {
    const w = standing(HEART_LAKE, { x: 0, z: 0 });
    crossFrom(w, HEART_LAKE, 'RIVER', HEART_RIVER);
    expect(body(w).regionId).toBe(FOREST_DEEP);
    expect(body(w).position).toEqual({ x: 14, z: -8 });
  });

  it('R-006 (C001) 채광이 그대로다 — 걸어서 광맥에 닿으면 Mine 이 가용해진다', () => {
    const w = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    const mine = () => w.observe().interactions.find((i) => i.id === 'mine');
    expect(mine()?.reason).toBe('out-of-range');
    walkTo(w, 8, -6);
    w.tick(TICK_INTERVAL); // 걸음이 끝난 다음 Tick 부터 다음 행동을 받는다
    expect(mine()?.available).toBe(true);
    expect(
      w.dispatch({ interactionId: 'mine', targetEntityId: mine()!.targetEntityId }).status,
    ).toBe('success');
  });

  it('R-007 (C004) 전투가 그대로다 — 휘두르면 받아들여진다', () => {
    const w = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    expect(w.dispatch({ interactionId: 'attack' }).status).toBe('success');
    for (let i = 0; i < 30; i++) w.tick(TICK_INTERVAL);
    expect(body(w).regionId).toBe(START_REGION_ID);
  });
});
