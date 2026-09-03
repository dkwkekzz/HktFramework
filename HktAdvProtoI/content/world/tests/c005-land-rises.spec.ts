// C005 — 땅이 솟는다 · 검증 시나리오 (spec SPEC-001 ~ SPEC-009 + 회귀)
//
// 이 Cycle 은 세계의 규칙도 State 도 하나도 늘리지 않는다. 땅은 데이터로 생긴다.
// 그래서 여기 있는 것의 절반은 "무엇이 생겼나" 가 아니라 **"무엇이 안 바뀌었나"** 다.
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고, dispatch / dispatchForOutcome 으로 요청하고,
// observe() 의 관찰 결과와 world.snapshot() 으로 확인한다. 이 Cycle 이 새로 쓴 구현
// (content/view/biome-rules.ts · terrain-presentation.ts · 배선 · 백왕령의 새 op)은 읽지 않았다.
// 기대값의 출처는 cycles/C005-land-rises/spec.md 의 표뿐이다.
//
// **태그 이름을 하드코딩하지 않는다.** 표면 태그의 이름은 View 의 표가 짓는 것이고 spec 이 못박은
// 것은 임계(45° · 15°)뿐이다. 그래서 이 파일은 규칙 표를 **값으로** 세워 (임계는 spec 의 것,
// 이름은 이 파일 안에서만 사는 것) 컴파일한 뒤, 단언은 언제나 결과의 surfaceTags 순서와
// 경사에서 **유도**한다. 컨텐츠가 실제로 쓰는 표는 content/view/tests/c005-terrain-view.spec.ts 가 잰다.
//
// 총량 단언을 두지 않는다 — 예외는 spec 이 못박은 자리(stamp 하나 · 태그 셋 · 한 방의 출구 수)뿐이다.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  descriptionHash,
  findPoint,
  pointsOf,
  type RegionDescription,
  type StampOp,
} from '../../../engine/world-authoring/description';
import {
  buildHeightField,
  slopeAtVertex,
  vertexX,
  vertexZ,
} from '../../../engine/world-authoring/height-field';
import { compileRegion, regionHash } from '../../../engine/world-authoring/compile';
import type { CompileRules, CompiledRegion } from '../../../engine/world-authoring/compiled';
import { terrainHeightSampler } from '../../../engine/view-kernel/terrain/terrain';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { ANCHOR_LAYER, REGION_GRAPH, REGION_SPECS, START_REGION_ID, regionSpec } from '../../regions';
import { regionZones } from '../../view/region-presentation';
import { STATE_VERSION, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

// ── spec 이 못박은 값들 ────────────────────────────────────────
const DEG = Math.PI / 180;
/** 확정 1 — 급경사가 시작되는 각 (그 각이 C006 에서 몸을 막는다) */
const STEEP_SLOPE = 45 * DEG;
/** spec UNRESOLVED 의 기본형 — 평지와 비탈을 가르는 각 */
const WALK_SLOPE = 15 * DEG;
/** 확정 4 — TERRAIN_RESOLUTION (결정론 상수) */
const RESOLUTION = 1;

// ── 이 파일 안에서만 사는 태그 이름 ────────────────────────────
//
// 기반은 태그의 뜻을 모르고(compiled.ts), 컨텐츠의 이름은 다른 자리에서 지어진다.
// 그래서 이름을 빌려 오지 않고 여기서 짓되, **단언에는 이 이름을 쓰지 않는다** —
// 언제나 surfaceTags 의 순서(0 = 가장 평평한 것 … 2 = 가장 가파른 것)로만 가리킨다.
const RULES: CompileRules = {
  resolution: RESOLUTION,
  surface: [
    { tag: 'c005-test:0', maxSlope: WALK_SLOPE },
    { tag: 'c005-test:1', maxSlope: STEEP_SLOPE },
    { tag: 'c005-test:2' },
  ],
};

/** C004 까지의 백왕령 Description hash — 그때의 데이터로 잰 값이다 (SPEC-008 경계) */
const WHITE_KING_HASH_AT_C004 = '2226cbb8';

/**
 * C004 까지의 anchor 표 — 아홉 방 전부 (SPEC-001 경계 "anchor point 는 그대로다").
 * 이 Cycle 이 더하는 것은 stamp 하나뿐이므로 이 표는 한 줄도 달라지지 않는다.
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
const RED_EYE_TREE = 'RED_EYE_TREE';
const TREE_INNER_WORLD = 'TREE_INNER_WORLD';
const HEART_LAKE = 'HEART_LAKE';
const FOREST_PATH = 'FOREST_PATH';
const DEEP_TRAIL = 'DEEP_TRAIL';
const ANCIENT_GATE = 'ANCIENT_GATE';
const RED_WASTE_PASS = 'RED_WASTE_PASS';
const ICE_CANYON_PASS = 'ICE_CANYON_PASS';
const TREE_INNER_DOOR = 'TREE_INNER_DOOR';
const HEART_RIVER = 'HEART_RIVER';

// ── 하네스 (c003 · c004 의 선례 그대로) ────────────────────────
const solo = { npcs: [] };

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const body = (w: WorldDriver) => state(w).actors.find((a) => a.id === PLAYER)!;
const exits = (v: GameViewSnapshot) => v.entities.filter((e) => e.role === 'region-exit');
const exitOf = (v: GameViewSnapshot, id: string) => exits(v).find((e) => e.id === id);
const transits = (v: GameViewSnapshot) => v.interactions.filter((i) => i.id === 'transit');
const anchorAt = (region: string, tag: string) =>
  findPoint(regionSpec(region)!.space, ANCHOR_LAYER, tag)?.position;

const askTransit = (w: WorldDriver, connector: string) =>
  w.dispatchForOutcome({ interactionId: 'transit', targetEntityId: connector })[0];
const cross = (w: WorldDriver, connector: string) =>
  w.dispatch({ interactionId: 'transit', targetEntityId: connector });

/** 그 방 그 자리에 바로 세운 세계 */
const standing = (region: string, at: { x: number; z: number }) =>
  driveWorld({ ...solo, actorRegion: region, actorPosition: at });

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

/** 그 방의 anchor 자리에 서서 그 Connector 로 건넌다 */
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

// ── 땅을 재는 하네스 ───────────────────────────────────────────

const spaceOf = (id: string): RegionDescription => regionSpec(id)!.space;
const stampsOf = (d: RegionDescription): StampOp[] =>
  d.ops.filter((op): op is StampOp => op.kind === 'stamp');
const compile = (d: RegionDescription, chunkSize?: number): CompiledRegion =>
  compileRegion(d, RULES, chunkSize === undefined ? undefined : { chunkSize });

/** 한 방의 vertex 를 전부 — 자리 · 높이 · 경사 · 붙은 태그 */
interface Vertex {
  ix: number;
  iz: number;
  x: number;
  z: number;
  y: number;
  slope: number;
  tag: string;
}

function verticesOf(d: RegionDescription): Vertex[] {
  const compiled = compile(d);
  const field = buildHeightField(d, RULES.resolution);
  const { cols, rows, height, surface, surfaceTags } = compiled.world;
  const out: Vertex[] = [];
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const i = iz * cols + ix;
      out.push({
        ix,
        iz,
        x: vertexX(field, ix),
        z: vertexZ(field, iz),
        y: height[i] ?? 0,
        slope: slopeAtVertex(field, ix, iz),
        tag: surfaceTags[surface[i] ?? 0] ?? '?',
      });
    }
  }
  return out;
}

const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);
const minBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  maxBy(items, (item) => -score(item));

/** 백왕령 — 이 Cycle 이 땅을 세우는 그 방 */
const domain = () => spaceOf(START_REGION_ID);
/** stamp 가 없는 나머지 여덟 방 */
const flatRooms = () => REGION_SPECS.filter((s) => s.id !== START_REGION_ID);

// ─────────────────────────────────────────────────────────────
describe('SPEC-001 — 백왕령에 능선이 선다', () => {
  it('S-001 백왕령의 ops 에 stamp 가 하나 있고 그것이 ridge 다', () => {
    // Given 세계가 만들어진다 (컨텐츠 데이터가 그대로 온다)
    const stamps = stampsOf(domain());
    // Then stamp 는 하나뿐이고 (spec 이 못박은 수) 갈래는 ridge 다
    expect(stamps.length).toBe(1);
    expect(stamps[0]!.stamp).toBe('ridge');
    // 그 값들은 데이터다 — 유한하고 반경도 높이도 0 이 아니다
    expect(stamps[0]!.radius).toBeGreaterThan(0);
    expect(Number.isFinite(stamps[0]!.height)).toBe(true);
    expect(stamps[0]!.height).not.toBe(0);
  });

  it('S-002 그 능선이 북쪽(+z) 쪽이다 — 중심의 z 가 양수이고 솟은 자리가 북쪽 절반에 있다', () => {
    const stamp = stampsOf(domain())[0]!;
    // Then 중심이 북쪽이다
    expect(stamp.center.z).toBeGreaterThan(0);
    // 그리고 실제로 솟은 자리(가장 높은 vertex)가 북쪽 절반이다 — 값이 아니라 결과로 잰다
    const highest = maxBy(verticesOf(domain()), (v) => v.y);
    expect(highest.y).toBeGreaterThan(0);
    expect(highest.z).toBeGreaterThan(0);
  });

  it('S-003 extent 는 −20..20 그대로다 · 방을 다 덮지 않는다 (남쪽 변은 평평하다)', () => {
    const space = domain();
    expect(space.extent).toEqual({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
    // 남쪽 변(minZ)의 vertex 는 하나도 솟지 않았다 — 올라가 볼 자리가 남아 있다
    const south = verticesOf(space).filter((v) => v.z === space.extent.minZ);
    expect(south.length).toBeGreaterThan(0);
    expect(south.filter((v) => v.y !== 0)).toEqual([]);
  });

  it('S-004 (경계) 나머지 여덟 방의 ops 에는 stamp 가 없다', () => {
    for (const spec of flatRooms()) {
      expect({ region: spec.id, stamps: stampsOf(spec.space).length }).toEqual({
        region: spec.id,
        stamps: 0,
      });
    }
  });

  it('S-005 (경계) anchor point 는 아홉 방 모두 C004 의 표 그대로다', () => {
    // Given 방 아홉의 anchor layer 를 읽는다
    const now: Record<string, Record<string, [number, number]>> = {};
    for (const spec of REGION_SPECS) {
      now[spec.id] = Object.fromEntries(
        pointsOf(spec.space, ANCHOR_LAYER).map((p) => [p.tag, [p.position.x, p.position.z]]),
      );
    }
    // Then 한 줄도 달라지지 않았다 — 이 Cycle 이 더한 것은 stamp 하나뿐이다
    expect(now).toEqual(ANCHORS_AT_C004);
  });
});

describe('SPEC-002 — 같은 Description 은 같은 땅을 준다', () => {
  it('S-006 같은 Description·규칙으로 두 번 컴파일하면 hash · height 격자 · surface 가 전부 같다', () => {
    // When 같은 입력으로 두 번 컴파일한다
    const a = compile(domain());
    const b = compile(domain());
    // Then 셋 다 같다
    expect(b.hash).toBe(a.hash);
    expect([...b.world.height]).toEqual([...a.world.height]);
    expect([...b.world.surface]).toEqual([...a.world.surface]);
    expect(b.world.surfaceTags).toEqual(a.world.surfaceTags);
    expect({ cols: b.world.cols, rows: b.world.rows }).toEqual({ cols: a.world.cols, rows: a.world.rows });
  });

  it('S-007 여덟 방도 마찬가지다 — 컴파일은 순수하다', () => {
    for (const spec of flatRooms()) {
      const a = compile(spec.space);
      const b = compile(spec.space);
      expect({ region: spec.id, hash: b.hash, height: [...b.world.height] }).toEqual({
        region: spec.id,
        hash: a.hash,
        height: [...a.world.height],
      });
    }
  });

  it('S-008 (경계) stamp 의 값 하나를 바꾸면 hash 가 달라진다 — 넷 다 그렇다', () => {
    // Given 지금 데이터의 stamp 하나 (파일은 손대지 않는다 — 변형은 **값으로** 짓는다)
    const space = domain();
    const stamp = stampsOf(space)[0]!;
    const variantOf = (patch: Partial<StampOp>): RegionDescription => ({
      ...space,
      ops: space.ops.map((op) => (op.id === stamp.id ? { ...stamp, ...patch } : op)),
    });
    const variants: [string, RegionDescription][] = [
      ['중심', variantOf({ center: { x: stamp.center.x + 1, z: stamp.center.z } })],
      ['반경', variantOf({ radius: stamp.radius + 1 })],
      ['높이', variantOf({ height: stamp.height + 1 })],
      ['falloff', variantOf({ falloff: (stamp.falloff ?? 1) + 1 })],
    ];
    const base = descriptionHash(space);
    // Then 값 하나가 달라질 때마다 Description hash 도 컴파일 hash 도 달라진다
    for (const [what, variant] of variants) {
      expect({ what, same: descriptionHash(variant) === base }).toEqual({ what, same: false });
      expect({ what, same: compile(variant).hash === compile(space).hash }).toEqual({
        what,
        same: false,
      });
    }
    // 그리고 땅도 실제로 달라진다 — hash 만 흔들린 것이 아니다
    expect([...compile(variants[1]![1]).world.height]).not.toEqual([...compile(space).world.height]);
  });

  it('S-009 (경계) 변형은 세계의 데이터를 하나도 바꾸지 않는다', () => {
    const before = JSON.stringify(REGION_SPECS);
    compile({ ...domain(), ops: [] });
    expect(JSON.stringify(REGION_SPECS)).toBe(before);
  });
});

describe('SPEC-003 — 화면의 땅이 그 격자다', () => {
  it('S-010 그려진 chunk 의 vertex 높이와 샘플러로 잰 높이가 같다', () => {
    // Given 백왕령을 컴파일해 땅을 얻는다
    const compiled = compile(domain());
    const sample = terrainHeightSampler(compiled.world);
    // When chunk 의 vertex 를 하나씩 다시 잰다
    let checked = 0;
    for (const chunk of compiled.view.chunks) {
      for (let i = 0; i < chunk.cols * chunk.rows; i++) {
        const x = chunk.positions[i * 3]!;
        const y = chunk.positions[i * 3 + 1]!;
        const z = chunk.positions[i * 3 + 2]!;
        // Then 그린 높이와 잰 높이가 같다
        expect(sample(x, z)).toBeCloseTo(y, 6);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('S-011 chunk 경계에서도 같다 — 이웃이 같은 자리에 같은 높이를 적는다', () => {
    const compiled = compile(domain());
    const sample = terrainHeightSampler(compiled.world);
    // Given 자리(x, z)마다 그 자리를 적어 온 chunk 들을 모은다
    const byPlace = new Map<string, { y: number; chunk: string }[]>();
    for (const chunk of compiled.view.chunks) {
      for (let i = 0; i < chunk.cols * chunk.rows; i++) {
        const key = `${chunk.positions[i * 3]!.toFixed(4)}|${chunk.positions[i * 3 + 2]!.toFixed(4)}`;
        const list = byPlace.get(key) ?? [];
        list.push({ y: chunk.positions[i * 3 + 1]!, chunk: `${chunk.ix},${chunk.iz}` });
        byPlace.set(key, list);
      }
    }
    // 두 chunk 이상이 적어 온 자리가 실제로 있다 (경계가 있다는 뜻 — 검사가 헛돌지 않는다)
    const shared = [...byPlace.entries()].filter(([, list]) => list.length > 1);
    expect(shared.length).toBeGreaterThan(0);
    // Then 그 자리들은 값이 하나고 샘플러와도 같다
    for (const [key, list] of shared) {
      const ys = new Set(list.map((v) => v.y));
      expect({ key, values: ys.size }).toEqual({ key, values: 1 });
      const [x, z] = key.split('|').map(Number) as [number, number];
      expect(sample(x, z)).toBeCloseTo(list[0]!.y, 6);
    }
  });

  it('S-012 (경계) 격자 밖을 재면 0 이다 — 없는 땅을 지어내지 않는다', () => {
    const compiled = compile(domain());
    const sample = terrainHeightSampler(compiled.world);
    const { minX, maxX, minZ, maxZ } = compiled.world.extent;
    for (const p of [
      { x: minX - 0.5, z: 0 },
      { x: maxX + 0.5, z: 0 },
      { x: 0, z: minZ - 0.5 },
      { x: 0, z: maxZ + 0.5 },
      { x: 1e6, z: 1e6 },
    ]) {
      expect({ p, y: sample(p.x, p.z) }).toEqual({ p, y: 0 });
    }
    // 능선의 마루 위는 0 이 아니다 — 안과 밖이 실제로 갈린다
    const highest = maxBy(verticesOf(domain()), (v) => v.y);
    expect(sample(highest.x, highest.z)).not.toBe(0);
  });
});

describe('SPEC-004 — 표면이 경사로 갈린다', () => {
  // 태그의 **이름**은 이 Cycle 의 View 가 짓는다. 여기서는 언제나 surfaceTags 의 순서로만 가리킨다:
  //   [0] 가장 평평한 것 · [1] 그 사이 · [2] 가장 가파른 것 (규칙 표의 순서 그대로)
  const tagAt = (i: number) => compile(domain()).world.surfaceTags[i]!;

  it('S-013 surface 태그가 셋이고 서로 다르다', () => {
    const tags = compile(domain()).world.surfaceTags;
    expect(tags.length).toBe(3); // spec 이 못박은 수 (평지 · 비탈 · 급경사)
    expect(new Set(tags).size).toBe(3);
  });

  it('S-014 평평한 남쪽에는 첫째 태그가 붙는다', () => {
    // Given 백왕령의 컴파일 결과
    const space = domain();
    const south = verticesOf(space).filter((v) => v.z === space.extent.minZ);
    // Then 남쪽 변은 전부 평지 태그다 (그 자리의 경사가 0 이다)
    for (const v of south) expect({ z: v.z, tag: v.tag, slope: v.slope }).toEqual({ z: v.z, tag: tagAt(0), slope: 0 });
  });

  it('S-015 능선의 허리(임계 둘 사이)에는 둘째 태그가 붙고 그 자리는 북쪽이다', () => {
    // Given 경사가 15° 이상 45° 미만인 vertex 들 — "걸어 오를 수 있지만 평평하지 않은" 자리
    const waist = verticesOf(domain()).filter((v) => v.slope >= WALK_SLOPE && v.slope < STEEP_SLOPE);
    // Then 그런 자리가 실제로 있다 (Observable Result ②)
    expect(waist.length).toBeGreaterThan(0);
    // 전부 둘째 태그다
    for (const v of waist) expect({ at: [v.x, v.z], tag: v.tag }).toEqual({ at: [v.x, v.z], tag: tagAt(1) });
    // 그리고 그 허리는 북쪽에 있다 — 능선이 북쪽에 섰기 때문이다
    expect(waist.filter((v) => v.z > 0).length).toBeGreaterThan(0);
  });

  it('S-016 가장 평평한 자리와 가장 가파른 자리의 태그가 다르다 · 셋이 다 쓰인다', () => {
    const vs = verticesOf(domain());
    const flattest = minBy(vs, (v) => v.slope);
    const steepest = maxBy(vs, (v) => v.slope);
    expect(flattest.tag).toBe(tagAt(0));
    expect(steepest.tag).not.toBe(flattest.tag);
    // 발밑 색이 셋으로 갈린다 (Observable Result ② · SPEC-006 이 급경사 자리를 요구한다)
    expect([...new Set(vs.map((v) => v.tag))].sort()).toEqual([tagAt(0), tagAt(1), tagAt(2)].sort());
  });

  it('S-017 규칙은 배열 순서로 첫 번째가 이긴다 — 위가 열린 규칙을 맨 앞에 두면 전부 그 태그다', () => {
    // Given 같은 땅에 규칙 표만 뒤집어 먹인다 (값으로 짓는다 — 표 파일은 손대지 않는다)
    const reversed: CompileRules = {
      resolution: RESOLUTION,
      surface: [{ tag: 'c005-test:catchall' }, { tag: 'c005-test:flat', maxSlope: WALK_SLOPE }],
    };
    const compiled = compileRegion(domain(), reversed);
    // Then 경사가 얼마든 첫 줄이 이긴다 — 색인이 전부 0 이다
    expect([...new Set(compiled.world.surface)]).toEqual([0]);
    expect(compiled.world.surfaceTags[0]).toBe('c005-test:catchall');
    // 그리고 순서가 hash 에 섞인다 — 표의 순서는 Description 의 일부처럼 다뤄진다
    expect(regionHash(domain(), reversed)).not.toBe(regionHash(domain(), RULES));
  });

  it('S-018 (경계) 젖음(wet)은 아직 없다 — 세계의 어떤 방에도 강을 낼 op 가 없다', () => {
    // 표면을 젖게 할 것(curve · area)이 Description 에 하나도 없다. 지금 op 는 point 와 stamp 둘뿐이다
    for (const spec of REGION_SPECS) {
      const kinds = [...new Set(spec.space.ops.map((op) => op.kind))].sort();
      expect({ region: spec.id, kinds }).toEqual({
        region: spec.id,
        kinds: kinds.filter((k) => k === 'point' || k === 'stamp'),
      });
    }
  });
});

describe('SPEC-005 — 색은 표가 정한다', () => {
  // 이 SPEC 은 View 의 표(surface 태그 → 색)와 그리기의 일이다 — 세계의 공개 경로로는 재지 못한다.
  // 표 자체(태그 셋이 서로 다른 색인가 · 그린 vertex 색이 표의 색인가 · 표에 없는 태그의 폴백)는
  // content/view/tests/c005-terrain-view.spec.ts 가 잰다. 여기서는 그 표에 넘어가는
  // **재료**가 컴파일 결과에 실려 있는지까지만 본다.

  it('S-019 태그가 서로 구별된다 — 색을 다르게 줄 수 있는 재료가 결과에 있다', () => {
    // Given 컴파일 결과가 그리는 쪽에 넘기는 것
    const compiled = compile(domain());
    // Then chunk 마다 surface 색인이 실려 있고, 그 색인이 전부 태그 표 안이다
    for (const chunk of compiled.view.chunks) {
      expect(chunk.surface.length).toBe(chunk.cols * chunk.rows);
      for (const index of chunk.surface) expect(index).toBeLessThan(compiled.view.surfaceTags.length);
    }
    expect(compiled.view.surfaceTags).toEqual(compiled.world.surfaceTags);
  });

  it.todo(
    'GAP: 관찰자가 방을 옮길 때 한 번만 컴파일해 다시 쓰는가(spec UNRESOLVED "컴파일을 언제 하는가")는 배선의 일이라 world 테스트에서 재지 못한다',
  );
});

describe('SPEC-006 — 급경사는 아직 막지 않는다', () => {
  /** 능선에서 가장 가파른 자리 — 데이터에서 고른다 (좌표를 손으로 적지 않는다) */
  const steepest = () => maxBy(verticesOf(domain()), (v) => v.slope);

  it('S-020 능선에 45° 이상의 자리가 실제로 있다 (그 자리가 C006 에서 몸을 세운다)', () => {
    const v = steepest();
    expect(v.slope).toBeGreaterThanOrEqual(STEEP_SLOPE);
    expect(v.z).toBeGreaterThan(0); // 북쪽 능선의 자리다
  });

  it('S-021 그 급경사 자리로 이동을 요청하면 받아들여진다', () => {
    // Given 백왕령에 선 몸
    const w = driveWorld(solo);
    const v = steepest();
    // When 능선의 급경사 자리로 간다고 한다
    const result = w.dispatch({ interactionId: 'move', position: { x: v.x, z: v.z } });
    // Then 받아들여진다 — 높이는 판정에 끼어들지 않는다
    expect(result).toMatchObject({ status: 'success', rule: 'RULE-MOVE-001' });
    // 그리고 실제로 걸어가 그 자리에 선다 (아직 아무것도 막지 않는다)
    walkTo(w, v.x, v.z);
    expect(body(w).regionId).toBe(START_REGION_ID);
  });

  it('S-022 능선 위 어느 자리로 가도 마찬가지다 — extent 안이면 전부 받아들여진다', () => {
    // Given 경사가 급한 자리 여럿 (데이터에서 고른다)
    const steep = verticesOf(domain())
      .filter((v) => v.slope >= STEEP_SLOPE)
      .slice(0, 8);
    expect(steep.length).toBeGreaterThan(0);
    for (const v of steep) {
      const w = driveWorld(solo);
      expect({ at: [v.x, v.z], status: w.dispatch({ interactionId: 'move', position: { x: v.x, z: v.z } }).status }).toEqual({
        at: [v.x, v.z],
        status: 'success',
      });
    }
  });

  it('S-023 (경계) extent 밖은 여전히 out-of-bounds 다 — 사유 코드가 C004 까지와 같다', () => {
    const w = driveWorld(solo);
    const { maxX, maxZ } = spaceOf(START_REGION_ID).extent;
    expect(w.dispatch({ interactionId: 'move', position: { x: maxX + 0.5, z: 0 } })).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'out-of-bounds',
    });
    // 능선의 마루 바로 위(방 안)는 받아들여지고 그 너머(방 밖)는 거절된다 — 가르는 것은 오직 extent 다
    expect(w.dispatch({ interactionId: 'move', position: { x: 0, z: maxZ } }).status).toBe('success');
    expect(w.dispatch({ interactionId: 'move', position: { x: 0, z: maxZ + 0.5 } })).toMatchObject({
      reason: 'out-of-bounds',
    });
  });

  it('S-024 (경계) 높이가 판정에 끼어들지 않는다 — 급경사 자리와 평지 자리의 대답이 같다', () => {
    const vs = verticesOf(domain());
    const flat = minBy(vs, (v) => v.slope);
    const steep = maxBy(vs, (v) => v.slope);
    const answer = (v: Vertex) =>
      driveWorld(solo).dispatch({ interactionId: 'move', position: { x: v.x, z: v.z } });
    expect(answer(steep)).toEqual(answer(flat));
  });
});

describe('SPEC-007 — 데이터가 없는 방은 평평하다', () => {
  it('S-025 stamp 가 없는 여덟 방은 height 격자가 전부 0 이다', () => {
    for (const spec of flatRooms()) {
      const compiled = compile(spec.space);
      expect({ region: spec.id, nonZero: [...compiled.world.height].filter((h) => h !== 0) }).toEqual({
        region: spec.id,
        nonZero: [],
      });
    }
  });

  it('S-026 그 방들의 surface 는 한 종류뿐이다 — 첫째(평지) 태그다', () => {
    for (const spec of flatRooms()) {
      const compiled = compile(spec.space);
      expect({ region: spec.id, used: [...new Set(compiled.world.surface)] }).toEqual({
        region: spec.id,
        used: [0],
      });
      // 태그 표 자체는 규칙에서 오므로 셋 그대로다 — 쓰이는 것이 하나일 뿐이다
      expect(compiled.world.surfaceTags.length).toBe(3);
    }
  });

  it('S-027 그래도 땅은 그려진다 — 평면 chunk 가 나온다', () => {
    for (const spec of flatRooms()) {
      const compiled = compile(spec.space);
      expect(compiled.view.chunks.length).toBeGreaterThan(0);
      for (const chunk of compiled.view.chunks) {
        for (let i = 0; i < chunk.cols * chunk.rows; i++) expect(chunk.positions[i * 3 + 1]).toBe(0);
      }
    }
  });

  it('S-028 (경계) Description 을 모르는 region id 면 땅을 그리지 않는다 — 바닥 없이도 게임은 돈다', () => {
    // Given 세계가 아직 짓지 않은 이름 (경계 목록에서 온다 — 손으로 적지 않는다)
    const frontier = (REGION_GRAPH as unknown as { frontiers?: string[] }).frontiers?.[0] ?? 'NO_SUCH_REGION';
    expect(regionSpec(frontier)).toBeUndefined();
    // Then 그릴 근거가 없다 — 바닥 polygon 도 나오지 않는다 (C001 부터의 폴백 규칙)
    expect(regionZones({ id: frontier, hash: '00000000' })).toEqual([]);
    expect(regionZones(undefined)).toEqual([]);
  });
});

describe('SPEC-008 — 세계는 땅을 싣지 않는다', () => {
  it('S-029 봉투의 키 집합이 그대로다 · region 은 { id, hash } 둘뿐이다', () => {
    const v = driveWorld(solo).observe();
    expect(Object.keys(v).sort()).toEqual(
      ['specId', 'scene', 'region', 'observer', 'entities', 'interactions', 'hud', 'strikes', 'debug', 'commands'].sort(),
    );
    expect(Object.keys(v.region).sort()).toEqual(['hash', 'id']);
  });

  it('S-030 STATE_VERSION 이 올라가지 않았다 — hkt-adv-proto-i/2', () => {
    expect(STATE_VERSION).toBe('hkt-adv-proto-i/2');
    expect(driveWorld(solo).world.snapshot().version).toBe('hkt-adv-proto-i/2');
  });

  it('S-031 스냅샷에도 관찰 결과에도 height · surface · chunk 가 없다', () => {
    const w = driveWorld(solo);
    walkTo(w, 0, 10); // 능선 쪽으로 걸어 본 뒤에도 그대로다
    const saved = JSON.parse(JSON.stringify(w.world.snapshot()));
    for (const key of ['height', 'surface', 'terrain', 'chunks', 'heightField', 'surfaceTags']) {
      expect(saved.state).not.toHaveProperty(key);
    }
    const texts = [JSON.stringify(saved.state), JSON.stringify(w.observe())];
    for (const text of texts) {
      for (const word of ['surface', 'chunk', 'terrain', 'slope', 'stamp', 'ridge', 'resolution']) {
        expect({ word, found: text.includes(word) }).toEqual({ word, found: false });
      }
    }
    // 'height' 는 C001 부터 **몸의 키**(body.height)로 있었다 — 땅의 격자가 아니다.
    // 그래서 낱말을 금하는 대신 "격자가 실려 있지 않은가" 를 잰다: height 라는 이름의 값은
    // 언제나 수 하나이고, 봉투 어디에도 격자만 한 배열이 없다.
    const heights: unknown[] = [];
    let longestArray = 0;
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        longestArray = Math.max(longestArray, value.length);
        for (const item of value) walk(item);
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
          if (key === 'height') heights.push(item);
          walk(item);
        }
      }
    };
    walk(saved.state);
    walk(JSON.parse(JSON.stringify(w.observe())));
    for (const value of heights) expect(typeof value).toBe('number');
    // 백왕령의 격자는 vertex 41×41 이다 — 그만 한 배열이 봉투에 실릴 자리가 없다
    expect(longestArray).toBeLessThan(compile(domain()).world.height.length);
  });

  it('S-032 region.hash 는 여전히 Description 에서 나온 그 값이다', () => {
    const w = driveWorld(solo);
    expect(w.observe().region).toEqual({
      id: START_REGION_ID,
      hash: descriptionHash(spaceOf(START_REGION_ID)),
    });
    // 방을 옮겨도 마찬가지다
    toForestDeep(w);
    expect(w.observe().region).toEqual({ id: FOREST_DEEP, hash: descriptionHash(spaceOf(FOREST_DEEP)) });
  });

  it('S-033 (경계) 백왕령의 hash 는 C004 때와 다르다 — 형이 아니라 데이터가 바뀌었다', () => {
    const space = spaceOf(START_REGION_ID);
    // Then 값이 달라졌다
    expect(descriptionHash(space)).not.toBe(WHITE_KING_HASH_AT_C004);
    // 그리고 달라진 이유가 **stamp 하나**다 — 그것만 빼면 C004 의 값으로 돌아온다
    const withoutStamp: RegionDescription = { ...space, ops: space.ops.filter((op) => op.kind !== 'stamp') };
    expect(descriptionHash(withoutStamp)).toBe(WHITE_KING_HASH_AT_C004);
    // 나머지 여덟 방의 hash 는 손대지 않았다 — 관찰 결과의 값이 Description 그대로다
    for (const spec of flatRooms()) {
      expect({ region: spec.id, hash: descriptionHash(spec.space) }).toEqual({
        region: spec.id,
        hash: standing(spec.id, pointsOf(spec.space, ANCHOR_LAYER)[0]!.position).observe().region.hash,
      });
    }
  });

  it('S-034 (경계) 저장하고 되살려도 형이 같다 — 되살린 세계의 hash 도 같은 값이다', () => {
    const w = driveWorld(solo);
    const saved = JSON.parse(JSON.stringify(w.world.snapshot()));
    const keys = Object.keys(saved).sort();
    expect(keys).toEqual(['state', 'version'].sort());
    expect(saved.state.actors.length).toBeGreaterThan(0);
    // 컴파일 결과는 저장되지 않는다 — 되살림은 같은 Description 을 다시 읽을 뿐이다
    expect(driveWorld(solo).observe().region.hash).toBe(w.observe().region.hash);
  });
});

describe('SPEC-009 — 방이 커져도 같은 코드다', () => {
  const sideOf = (d: RegionDescription) => d.extent.maxX - d.extent.minX;
  /** 한 변 40 인 방 · 한 변 80 인 방 — 이름이 아니라 크기로 고른다 */
  const room40 = () => REGION_SPECS.find((s) => sideOf(s.space) === 40)!.space;
  const room80 = () => REGION_SPECS.find((s) => sideOf(s.space) === 80)!.space;

  it('S-035 두 크기의 방이 데이터에 있다 (검사가 헛돌지 않는다)', () => {
    expect(sideOf(room40())).toBe(40);
    expect(sideOf(room80())).toBe(80);
  });

  it('S-036 두 방 다 chunk 가 여럿이다 — Region 하나 ≠ chunk 하나', () => {
    for (const space of [room40(), room80()]) {
      const compiled = compile(space);
      expect({ region: space.id, many: compiled.view.chunks.length > 1 }).toEqual({
        region: space.id,
        many: true,
      });
    }
    // 큰 방이 더 잘게 나뉜다 — 같은 코드가 크기만 따라간다
    expect(compile(room80()).view.chunks.length).toBeGreaterThan(compile(room40()).view.chunks.length);
  });

  it('S-037 두 방 다 seam 이 없다 — 이웃 chunk 의 경계 vertex 가 같은 자리·같은 높이다', () => {
    for (const space of [room40(), room80()]) {
      const compiled = compile(space);
      const byIndex = new Map<string, (typeof compiled.view.chunks)[number]>();
      for (const chunk of compiled.view.chunks) byIndex.set(`${chunk.ix},${chunk.iz}`, chunk);

      let seams = 0;
      for (const chunk of compiled.view.chunks) {
        // x 로 이웃한 chunk — 내 마지막 열이 그의 첫 열이다
        const right = byIndex.get(`${chunk.ix + 1},${chunk.iz}`);
        if (right) {
          expect(right.rows).toBe(chunk.rows);
          for (let iz = 0; iz < chunk.rows; iz++) {
            const mine = (iz * chunk.cols + (chunk.cols - 1)) * 3;
            const theirs = iz * right.cols * 3;
            expect({
              region: space.id,
              x: chunk.positions[mine],
              y: chunk.positions[mine + 1],
              z: chunk.positions[mine + 2],
            }).toEqual({
              region: space.id,
              x: right.positions[theirs],
              y: right.positions[theirs + 1],
              z: right.positions[theirs + 2],
            });
            seams++;
          }
        }
        // z 로 이웃한 chunk — 내 마지막 행이 그의 첫 행이다
        const below = byIndex.get(`${chunk.ix},${chunk.iz + 1}`);
        if (below) {
          expect(below.cols).toBe(chunk.cols);
          for (let ix = 0; ix < chunk.cols; ix++) {
            const mine = ((chunk.rows - 1) * chunk.cols + ix) * 3;
            const theirs = ix * 3;
            expect({
              region: space.id,
              x: chunk.positions[mine],
              y: chunk.positions[mine + 1],
              z: chunk.positions[mine + 2],
            }).toEqual({
              region: space.id,
              x: below.positions[theirs],
              y: below.positions[theirs + 1],
              z: below.positions[theirs + 2],
            });
            seams++;
          }
        }
      }
      // 실제로 이웃한 자리를 쟀다 (chunk 가 하나면 이 검사는 아무 말도 하지 않는다)
      expect({ region: space.id, seams: seams > 0 }).toEqual({ region: space.id, seams: true });
    }
  });

  it('S-038 (경계) chunk 나누는 값을 바꿔도 height 격자와 hash 가 바뀌지 않는다', () => {
    for (const space of [room40(), room80()]) {
      const base = compile(space);
      for (const chunkSize of [4, 8, 16, 64, 1000]) {
        const other = compile(space, chunkSize);
        expect({ region: space.id, chunkSize, hash: other.hash }).toEqual({
          region: space.id,
          chunkSize,
          hash: base.hash,
        });
        expect([...other.world.height]).toEqual([...base.world.height]);
        expect([...other.world.surface]).toEqual([...base.world.surface]);
      }
      // 그리는 쪽만 달라진다 — 잘게 나누면 chunk 가 는다
      expect(compile(space, 4).view.chunks.length).toBeGreaterThan(compile(space, 64).view.chunks.length);
    }
  });

  it('S-039 (경계) 잘게 나눈 땅도 seam 이 없다 — 자르기는 값을 다시 만들지 않는다', () => {
    const compiled = compile(domain(), 4);
    const sample = terrainHeightSampler(compiled.world);
    for (const chunk of compiled.view.chunks) {
      for (let i = 0; i < chunk.cols * chunk.rows; i++) {
        expect(sample(chunk.positions[i * 3]!, chunk.positions[i * 3 + 2]!)).toBeCloseTo(
          chunk.positions[i * 3 + 1]!,
          6,
        );
      }
    }
  });
});

// ── 회귀 — C001~C004 의 행동이 그대로인가 ─────────────────────

describe('회귀', () => {
  it('R-001 (C002 SPEC-006 · C003 R-001) 건너기의 사유 다섯이 이 세계의 데이터에서 그대로 관측된다', () => {
    const reasons = new Set<string>();

    const a = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    reasons.add(askTransit(a, 'NO_SUCH_PATH')!.reason!);
    reasons.add(askTransit(a, DEEP_TRAIL)!.reason!);
    reasons.add(askTransit(a, FOREST_PATH)!.reason!);

    const b = driveWorld(solo);
    walkTo(b, 18, 0);
    reasons.add(askTransit(b, RED_WASTE_PASS)!.reason!);

    const c = driveWorld(solo);
    toForestDeep(c);
    walkTo(c, -13, 13);
    reasons.add(askTransit(c, ANCIENT_GATE)!.reason!);
    walkTo(c, 0, -18);
    c.dispatch({ interactionId: 'attack' });
    reasons.add(askTransit(c, DEEP_TRAIL)!.reason!);

    expect([...reasons].sort()).toEqual(
      ['unknown-connector', 'wrong-region', 'out-of-range', 'region-not-built', 'action-busy'].sort(),
    );
    // 땅이 생겼다고 새 사유가 늘지 않았다 — 급경사는 아직 색일 뿐이다
    expect([...reasons]).not.toContain('too-steep');
  });

  it('R-002 (C003 R-002) 숲 안쪽의 출구는 다섯이고 다섯이 전부 열려 있다', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    const v = w.observe();
    expect(exits(v).length).toBe(5);
    expect(transits(v).length).toBe(5);
    expect(exits(v).filter((e) => e.state === 'locked')).toEqual([]);
  });

  it('R-003 (C003 R-003) 백왕령의 출구는 셋이고 고개 둘이 그대로 남는다 — 능선이 서도 그대로다', () => {
    const w = driveWorld(solo);
    const v = w.observe();
    expect(exits(v).length).toBe(3);
    for (const id of [RED_WASTE_PASS, ICE_CANYON_PASS]) {
      expect(exitOf(v, id)).toMatchObject({ state: 'open', kind: 'pass' });
    }
    // 출구 표식의 자리는 anchor 그대로다 (표식이 땅을 타고 오르는 것은 그리기의 일이다)
    expect(exitOf(v, FOREST_PATH)?.position).toEqual(anchorAt(START_REGION_ID, FOREST_PATH));
  });

  it('R-004 (C003 SPEC-006) 추락은 요청 없이 일어난다 — 큰 방 끝에 서면 Tick 하나로 심장 호수다', () => {
    const w = standing(TREE_INNER_WORLD, { x: 0, z: 36.5 });
    w.tick(TICK_INTERVAL);
    expect(body(w).regionId).toBe(HEART_LAKE);
    expect(w.observe().scene).toBe(HEART_LAKE);
  });

  it('R-005 (C003 SPEC-008) 물길은 다른 자리로 낸다 — 심장 호수에서 숲 안쪽 RIVER_MOUTH 로 나온다', () => {
    const w = standing(HEART_LAKE, { x: 0, z: 0 });
    crossFrom(w, HEART_LAKE, 'RIVER', HEART_RIVER);
    expect(body(w).regionId).toBe(FOREST_DEEP);
    expect(body(w).position).toEqual({ x: 14, z: -8 });
    // 되건너기는 여전히 wrong-region 이다 (one-way)
    expect(askTransit(w, HEART_RIVER)).toMatchObject({ accepted: false, reason: 'wrong-region' });
  });

  it('R-006 (C003 R-008) 이동의 경계는 그 몸이 선 방의 extent 다 — 작은 방은 그대로 −20..20', () => {
    const w = driveWorld(solo);
    toForestDeep(w);
    crossFrom(w, FOREST_DEEP, 'TREE_APPROACH', 'TREE_APPROACH');
    expect(body(w).regionId).toBe(RED_EYE_TREE);
    expect(w.dispatch({ interactionId: 'move', position: { x: 20, z: -20 } }).status).toBe('success');
    expect(w.dispatch({ interactionId: 'move', position: { x: 20.5, z: 0 } })).toMatchObject({
      status: 'failure',
      reason: 'out-of-bounds',
    });
  });

  it('R-007 (C003 R-009) 봉투의 region { id, hash } 는 방마다 다르다', () => {
    const w = driveWorld(solo);
    const home = w.observe().region;
    toForestDeep(w);
    crossFrom(w, FOREST_DEEP, 'TREE_APPROACH', 'TREE_APPROACH');
    const tree = w.observe().region;
    crossFrom(w, RED_EYE_TREE, 'INNER_DOOR', TREE_INNER_DOOR);
    const inner = w.observe().region;
    expect(new Set([home.hash, tree.hash, inner.hash]).size).toBe(3);
    expect(inner.id).toBe(TREE_INNER_WORLD);
  });

  // ── C004 SPEC-003 의 검사가 여전히 통과하는가 ────────────────
  //
  // 이름 목록은 content/regions 에서 온다 — 손으로 적으면 방이 늘 때 조용히 낡는다.
  // 훑는 자리도 C004 그대로다: content/world 와 engine (tests/ 는 뺀다).
  const HERE = dirname(fileURLToPath(import.meta.url));
  const ROOT = resolve(HERE, '..', '..', '..');
  const CONTENT_WORLD = resolve(HERE, '..');
  const ENGINE = join(ROOT, 'engine');
  const WORLD_NOUNS = [
    ...new Set([
      ...REGION_SPECS.map((r) => r.id),
      ...((REGION_GRAPH as unknown as { frontiers?: string[] }).frontiers ?? []),
      ...REGION_GRAPH.connectors.map((c) => c.id),
    ]),
  ];

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry === 'tests' || entry === 'node_modules') continue;
        sourceFiles(path, out);
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        out.push(path);
      }
    }
    return out;
  }

  function nameHits(dir: string): string[] {
    const patterns = WORLD_NOUNS.map((name) => ({ name, re: new RegExp(`\\b${name}\\b`) }));
    const hits: string[] = [];
    for (const file of sourceFiles(dir)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((text, index) => {
          for (const { name, re } of patterns) {
            if (re.test(text)) hits.push(`${relative(ROOT, file)}:${index + 1}  ${name}  │ ${text.trim()}`);
          }
        });
    }
    return hits;
  }

  it('R-008 (C004 SPEC-003) 규칙 코드도 기반도 방·연결의 이름을 모른다 — 땅이 생겨도 그대로다', () => {
    expect(WORLD_NOUNS.length).toBeGreaterThan(0);
    expect(sourceFiles(CONTENT_WORLD).length).toBeGreaterThan(0);
    expect(nameHits(CONTENT_WORLD).join('\n')).toBe('');
    expect(nameHits(ENGINE).join('\n')).toBe('');
  });

  it('R-009 (C005 R4) 이 Cycle 이 세계의 규칙을 하나도 더하지 않았다 — 규칙 파일에 경사·높이가 없다', () => {
    // 이 Cycle 의 주장 그대로다: 땅은 데이터로 생겼고 판정은 한 글자도 늘지 않았다
    const forbidden = ['slopeAtVertex', 'sampleSlope', 'sampleHeight', 'buildHeightField', 'compileRegion', 'terrainHeightSampler'];
    for (const file of sourceFiles(CONTENT_WORLD)) {
      const text = readFileSync(file, 'utf8');
      for (const word of forbidden) {
        expect({ file: relative(ROOT, file), word, found: text.includes(word) }).toEqual({
          file: relative(ROOT, file),
          word,
          found: false,
        });
      }
    }
  });
});
