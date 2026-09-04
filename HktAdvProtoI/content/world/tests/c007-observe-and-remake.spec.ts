// C007 — 보고 다시 만든다 · 세계 쪽 검증 시나리오 (spec SPEC-003 · SPEC-009 · SPEC-010 + 회귀)
//
// 이 Cycle 은 **세계의 규칙을 하나도 더하지 않는다.** 그래서 여기서 재는 것은 둘뿐이다:
//   ① 도구가 그리는 격자(래스터)와 세계가 내리는 판정이 **같은 땅**인가 (SPEC-003)
//   ② 데이터 한 덩이(숲 가장자리의 stamp basin)가 새 땅을 만들고, 그 땅을 C006 의 규칙이
//      **그대로** 판정하는가 (SPEC-009 · SPEC-010)
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 구현(engine/world-authoring/observe.ts 의 속 · tools/world-editor 의 새 길)은
// 읽지 않았다. 기대값의 출처는 cycles/C007-observe-and-remake/spec.md 와 확정된 기구 API 뿐이다.
//
// **좌표를 손으로 적지 않는다.** 분지가 어디에 얼마나 파였는지는 데이터다 — 자리는 언제나
// Description 의 op 와 컴파일 결과에서 **골라** 쓴다. 임계(45°)도 값을 적지 않고
// content/regions 의 규칙 표에서 읽는다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것(basin stamp 하나)의 존재와 행동만 본다.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  descriptionHash,
  pointsOf,
  type RegionDescription,
  type StampOp,
} from '../../../engine/world-authoring/description';
import { buildHeightField, slopeAtVertex, vertexX, vertexZ } from '../../../engine/world-authoring/height-field';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledRegion } from '../../../engine/world-authoring/compiled';
import { blockedReasonAt, isTraversableAt } from '../../../engine/world-authoring/query';
// 이 Cycle 이 세운 기구 — 컴파일 결과를 숫자 판으로 래스터한다 (§1 확정 API).
// 도구가 그리는 그림의 재료가 이것이다: 여기서 막혔다고 한 칸이 곧 그림의 막힌 칸이다.
import { rasterHeight, rasterSurface, rasterTraversable } from '../../../engine/world-authoring/observe';
import { ANCHOR_LAYER, REGION_SPECS, START_REGION_ID, regionSpec } from '../../regions';
import {
  BLOCK_STEEP,
  BLOCK_WATER,
  COMPILE_RULES,
  SLOPE_DEGREES,
  SURFACE_FLAT,
  SURFACE_STEEP,
} from '../../regions/terrain-rules';
import type { ActionResult } from '../../protocol/actions';
import { TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

const DEG = Math.PI / 180;
/** C006 의 통행 임계 — 이 Cycle 은 이 값을 한 글자도 바꾸지 않는다 */
const STEEP_SLOPE = SLOPE_DEGREES.steep * DEG;
const SLOPED = SLOPE_DEGREES.sloped * DEG;

const FOREST_EDGE = 'FOREST_EDGE';
const FOREST_DEEP = 'FOREST_DEEP';
const FOREST_PATH = 'FOREST_PATH';
const DEEP_TRAIL = 'DEEP_TRAIL';

const solo = { npcs: [] };

// ── 하네스 (c005 · c006 의 선례 그대로) ───────────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const body = (w: WorldDriver) => state(w).actors.find((a) => a.id === PLAYER)!;
const here = (w: WorldDriver) => ({ x: body(w).position.x, z: body(w).position.z });
const move = (w: WorldDriver, x: number, z: number): ActionResult =>
  w.dispatch({ interactionId: 'move', position: { x, z } });
const standing = (region: string, at: { x: number; z: number }) =>
  driveWorld({ ...solo, actorRegion: region, actorPosition: at });

const spaceOf = (id: string): RegionDescription => regionSpec(id)!.space;
const stampsOf = (d: RegionDescription): StampOp[] =>
  d.ops.filter((op): op is StampOp => op.kind === 'stamp');

const compiledMemo = new Map<string, CompiledRegion>();
function compiled(id: string): CompiledRegion {
  const hit = compiledMemo.get(id);
  if (hit) return hit;
  const made = compileRegion(spaceOf(id), COMPILE_RULES);
  compiledMemo.set(id, made);
  return made;
}

/** 격자 vertex 하나 — 색인 · 자리 · 높이 · 경사 · 표면 · 통행 · 사유 */
interface Cell {
  i: number;
  ix: number;
  iz: number;
  x: number;
  z: number;
  y: number;
  slope: number;
  surfaceTag: string;
  traversable: boolean;
  reason: string;
}

const cellsMemo = new Map<string, Cell[]>();
function cellsOf(id: string): Cell[] {
  const hit = cellsMemo.get(id);
  if (hit) return hit;
  const world = compiled(id).world;
  const field = buildHeightField(spaceOf(id), world.resolution);
  const out: Cell[] = [];
  for (let iz = 0; iz < world.rows; iz++) {
    for (let ix = 0; ix < world.cols; ix++) {
      const i = iz * world.cols + ix;
      out.push({
        i,
        ix,
        iz,
        x: vertexX(field, ix),
        z: vertexZ(field, iz),
        y: world.height[i] ?? 0,
        slope: slopeAtVertex(field, ix, iz),
        surfaceTag: world.surfaceTags[world.surface[i] ?? 0] ?? '?',
        traversable: (world.traversable[i] ?? 1) === 1,
        reason: world.blockedTags[world.blocked[i] ?? 0] ?? '',
      });
    }
  }
  cellsMemo.set(id, out);
  return out;
}

const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);
const minBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  maxBy(items, (item) => -score(item));

/**
 * 격자를 통째로 훑어 세계에 물어본다 — 표본이 아니라 **모든 칸**이다.
 *
 * 거절은 몸을 움직이지 않고, 받아들여진 요청도 Tick 을 돌리지 않으면 몸을 옮기지 않는다
 * (dispatch 는 tick(0) 만 부른다). 그래서 세계 하나로 격자 전체를 물어도 서로를 어지럽히지 않는다.
 */
function sweep(regionId: string): { cell: Cell; accepted: boolean; reason: string | null }[] {
  const start = pointsOf(spaceOf(regionId), ANCHOR_LAYER)[0]!.position;
  const w = standing(regionId, start);
  return cellsOf(regionId).map((cell) => {
    const result = move(w, cell.x, cell.z);
    return {
      cell,
      accepted: result.status === 'success',
      reason: result.status === 'success' ? null : (result.reason ?? null),
    };
  });
}

// ─────────────────────────────────────────────────────────────
describe('SPEC-003 — 막힌 자리가 걸어서 막힌 그 자리다', () => {
  it('S-001 통행 래스터가 컴파일 결과와 칸마다 같다 — 그림과 세계는 같은 컴파일에서 나온다', () => {
    // Given 방 아홉을 전부 (도구가 어느 방을 보든 같은 주장이어야 한다)
    for (const spec of REGION_SPECS) {
      const world = compiled(spec.id).world;
      const raster = rasterTraversable(world);
      // Then 판의 크기가 격자다 — vertex 하나가 픽셀 하나다
      expect({ region: spec.id, w: raster.width, h: raster.height }).toEqual({
        region: spec.id,
        w: world.cols,
        h: world.rows,
      });
      // 그리고 legend 가 컴파일의 사유 표 그대로다 (색인 0 은 '막힘 없음')
      expect({ region: spec.id, legend: raster.legend }).toEqual({
        region: spec.id,
        legend: world.blockedTags,
      });
      expect(raster.legend[0]).toBe('');
      // 값은 칸마다 "통행이면 0, 아니면 사유 색인" 이다 — 하나도 어긋나지 않는다
      const wrong: number[] = [];
      for (let i = 0; i < world.cols * world.rows; i++) {
        const want = (world.traversable[i] ?? 1) === 1 ? 0 : (world.blocked[i] ?? 0);
        if (raster.values[i] !== want) wrong.push(i);
      }
      expect({ region: spec.id, wrong }).toEqual({ region: spec.id, wrong: [] });
    }
  });

  it('S-002 래스터의 막힌 칸으로 이동을 요청하면 세계가 거절한다 — 사유까지 같다 (백왕령 격자 전부)', () => {
    // Given 백왕령의 통행 래스터와 그 격자 전부
    const world = compiled(START_REGION_ID).world;
    const raster = rasterTraversable(world);
    // When 격자의 모든 칸을 세계에 물어본다 (표본이 아니다)
    const answers = sweep(START_REGION_ID);
    expect(answers.length).toBe(world.cols * world.rows);

    // Then 그림이 막혔다고 한 칸은 전부 거절되고, 사유가 legend 의 그 글자다
    const mismatched: unknown[] = [];
    for (const { cell, accepted, reason } of answers) {
      const value = raster.values[cell.i] ?? 0;
      const drawn = value === 0 ? null : (raster.legend[value] ?? '?');
      if (accepted !== (drawn === null) || reason !== drawn) {
        mismatched.push({ at: [cell.x, cell.z], drawn, accepted, reason });
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('S-003 (경계) 두 갈래가 다 있다 — 막힘 사유 둘(급경사 · 물)이 그림에도 세계에도 나온다', () => {
    const world = compiled(START_REGION_ID).world;
    const raster = rasterTraversable(world);
    const answers = sweep(START_REGION_ID);
    // Given 그림에 통행 칸과 막힌 칸이 둘 다 있다 (검사가 헛돌지 않는다)
    const blocked = answers.filter(({ cell }) => (raster.values[cell.i] ?? 0) !== 0);
    const open = answers.filter(({ cell }) => (raster.values[cell.i] ?? 0) === 0);
    expect(blocked.length).toBeGreaterThan(0);
    expect(open.length).toBeGreaterThan(0);
    // Then 통행 칸으로는 전부 받아들여진다
    expect(open.filter((a) => !a.accepted)).toEqual([]);
    // 그리고 사유는 C006 의 둘뿐이다 — 이 Cycle 은 사유를 하나도 더하지 않았다
    const reasons = new Set(blocked.map((a) => a.reason));
    expect([...reasons].sort()).toEqual([BLOCK_STEEP, BLOCK_WATER].sort());
  });

  it('S-004 (경계) 높이·표면 래스터도 같은 격자다 — 픽셀과 vertex 가 1:1 이다', () => {
    for (const spec of REGION_SPECS) {
      const world = compiled(spec.id).world;
      for (const [what, raster] of [
        ['height', rasterHeight(world)],
        ['surface', rasterSurface(world)],
      ] as const) {
        expect({ region: spec.id, what, w: raster.width, h: raster.height }).toEqual({
          region: spec.id,
          what,
          w: world.cols,
          h: world.rows,
        });
        expect({ region: spec.id, what, len: raster.values.length }).toEqual({
          region: spec.id,
          what,
          len: world.cols * world.rows,
        });
      }
      // 표면 판의 값은 그 칸의 태그 색인 그대로다
      const surface = rasterSurface(world);
      expect({ region: spec.id, legend: surface.legend }).toEqual({
        region: spec.id,
        legend: world.surfaceTags,
      });
      expect({ region: spec.id, same: [...surface.values].every((v, i) => v === world.surface[i]) }).toEqual({
        region: spec.id,
        same: true,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-009 — 데이터 하나가 새 땅을 만든다', () => {
  const edge = () => spaceOf(FOREST_EDGE);
  const basin = (): StampOp => {
    const found = stampsOf(edge()).filter((op) => op.stamp === 'basin');
    if (found.length !== 1) throw new Error(`숲 가장자리에 basin stamp 가 하나여야 한다 — 지금 ${found.length}`);
    return found[0]!;
  };

  it('S-005 숲 가장자리의 space 에 stamp(basin) 이 하나 있다 — 값은 데이터다', () => {
    // Given 컨텐츠 데이터가 그대로 온다
    const op = basin();
    // Then 반경도 깊이도 0 이 아니고 유한하다 (자리는 데이터가 정한다 — 여기서 적지 않는다)
    expect(op.radius).toBeGreaterThan(0);
    expect(Number.isFinite(op.height)).toBe(true);
    expect(op.height).not.toBe(0);
    // 그리고 방 안이다
    const { minX, maxX, minZ, maxZ } = edge().extent;
    expect({
      inside: op.center.x >= minX && op.center.x <= maxX && op.center.z >= minZ && op.center.z <= maxZ,
    }).toEqual({ inside: true });
  });

  it('S-006 그 방이 더 이상 평평하지 않다 — 파인 자리가 stamp 둘레에 있다', () => {
    // Given 숲 가장자리의 컴파일 결과
    const grid = cellsOf(FOREST_EDGE);
    // Then 높이가 0 이 아닌 vertex 가 있다 (C005 SPEC-007 이 이 방을 두고 "평평하다" 고 했던 자리다)
    expect(grid.filter((c) => c.y !== 0).length).toBeGreaterThan(0);
    // 그리고 **파여** 있다 — 가장 낮은 자리가 0 아래이고 stamp 반경 안이다 (분지지 언덕이 아니다)
    const op = basin();
    const lowest = minBy(grid, (c) => c.y);
    expect(lowest.y).toBeLessThan(0);
    expect(Math.hypot(lowest.x - op.center.x, lowest.z - op.center.z)).toBeLessThanOrEqual(op.radius);
    // 방 전체가 파인 것은 아니다 — stamp 밖은 그대로 0 이다 (Play 의 "다음 방을 채운다" 가 남아 있다)
    const outside = grid.filter((c) => Math.hypot(c.x - op.center.x, c.z - op.center.z) >= op.radius);
    expect(outside.length).toBeGreaterThan(0);
    expect(outside.filter((c) => c.y !== 0)).toEqual([]);
  });

  it('S-007 표면 태그가 경사를 따라 갈린다 — 같은 규칙 표, 새 데이터', () => {
    const grid = cellsOf(FOREST_EDGE);
    // Given 이 방의 표면 색인이 이제 한 종류가 아니다
    const used = new Set(grid.map((c) => c.surfaceTag));
    expect(used.size).toBeGreaterThan(1);
    // Then 갈리는 자리는 규칙 표의 임계 그대로다 — 도구도 세계도 값을 지어내지 않는다
    // (숲 가장자리에는 curve 가 없으므로 젖음 규칙은 아무 일도 하지 않고 경사만 남는다)
    for (const c of grid) {
      const want = c.slope < SLOPED ? SURFACE_FLAT : c.slope >= STEEP_SLOPE ? SURFACE_STEEP : null;
      if (want === null) continue; // 가운데 구간(비탈)은 표의 셋째 줄 — 이름을 여기서 적지 않는다
      expect({ at: [c.x, c.z], tag: c.surfaceTag }).toEqual({ at: [c.x, c.z], tag: want });
    }
    // 급경사가 실제로 생겼다 — 확정 임계에서 갈린다
    expect(grid.filter((c) => c.surfaceTag === SURFACE_STEEP).length).toBeGreaterThan(0);
  });

  it('S-008 그 방의 hash 가 바뀐다 — stamp 를 빼면 되돌아온다. 관찰 봉투도 그 값을 싣는다', () => {
    const space = edge();
    const op = basin();
    // Given 그 stamp 만 뺀 같은 Description (값으로 짓는다 — 세계의 데이터를 건드리지 않는다)
    const without: RegionDescription = { ...space, ops: space.ops.filter((each) => each.id !== op.id) };
    // Then hash 가 다르다 — 데이터 한 덩이가 방의 정체를 바꾼다
    expect(descriptionHash(space)).not.toBe(descriptionHash(without));
    // 그리고 땅도 실제로 다르다 (hash 만 흔들린 것이 아니다)
    expect([...compileRegion(space, COMPILE_RULES).world.height]).not.toEqual([
      ...compileRegion(without, COMPILE_RULES).world.height,
    ]);
    // 세계가 관찰자에게 내보내는 값이 그 hash 다 — 서버와 클라이언트가 같은 방을 본다
    const at = pointsOf(space, ANCHOR_LAYER)[0]!.position;
    expect(standing(FOREST_EDGE, at).observe().region).toEqual({
      id: FOREST_EDGE,
      hash: descriptionHash(space),
    });
  });

  it('S-009 (경계) 코드가 한 줄도 바뀌지 않았다 — 변한 것은 content/regions 하나다', () => {
    // Given 이 Cycle 이 시작한 자리 (C007 명세를 동결한 커밋의 부모 = C006 마감)
    const base = cycleBase();
    // When 그 뒤로 engine · content/world · content/view 에서 무엇이 달라졌는지 본다
    const changed = changesSince(base, ['engine', 'content/world', 'content/view']);

    // 시나리오 테스트는 이 Cycle 이 쓰고 좁힌다 — 재는 자가 재는 자를 세지 않는다.
    // 세계·화면의 **코드**만 남긴다 (세는 자리는 아래 주석의 판정 방식 그대로다)
    const code = changed.filter((c) => !/(^|\/)tests?\//.test(c.path));

    // Then 기존 코드가 고쳐지거나 지워진 것이 하나도 없다 (CHANGED 없음 — spec 의 주장 그 자체다)
    expect(code.filter((c) => c.status !== 'A' && c.status !== '??')).toEqual([]);
    // content/world · content/view 에는 새로 서는 코드도 없다 — 세계도 화면도 한 줄 늘지 않았다
    expect(code.map((c) => c.path).filter((p) => p.startsWith('content/'))).toEqual([]);
    // engine 에 새로 는 것은 이 Cycle 이 세운 관찰 기구(읽기 전용) 하나뿐이다
    expect(
      code.map((c) => c.path).filter((p) => p !== 'engine/world-authoring/observe.ts'),
    ).toEqual([]);
    // 그리고 데이터로 바뀐 방은 숲 가장자리 하나다
    const data = changesSince(base, ['content/regions']).map((c) => c.path);
    expect(data).toEqual(['content/regions/forest-edge.ts']);

    // 코드에서 빼 둔 것이 무엇인지 여기서 밝힌다 — 조용히 빼면 그 사실이 사라진다.
    // 고쳐진 것은 **앞선 Cycle 의 시나리오 테스트뿐**이고, 고친 이유는 하나다:
    // 그 테스트들이 "여덟 방은 평평하다" 처럼 방의 **수**를 단언에 박아 두었기 때문이다.
    // 데이터 하나를 더하면 그 수가 틀린다 — 코드가 아니라 테스트가 데이터를 알고 있었던 것이다.
    // (이 Cycle 의 부채다. 앞으로의 테스트는 방의 수를 박지 않는다)
    const touched = changed.filter((c) => c.status !== 'A' && c.status !== '??').map((c) => c.path);
    expect(touched.filter((p) => !/(^|\/)tests?\//.test(p))).toEqual([]);
    expect(touched.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('SPEC-010 — 새 땅에 새 규칙이 필요하지 않다', () => {
  const basinOf = () => stampsOf(spaceOf(FOREST_EDGE)).find((op) => op.stamp === 'basin')!;
  /** 분지 안(그 stamp 반경 안)의 칸들 */
  const inBasin = () => {
    const op = basinOf();
    return cellsOf(FOREST_EDGE).filter((c) => Math.hypot(c.x - op.center.x, c.z - op.center.z) < op.radius);
  };

  it('S-010 분지의 급경사 자리로 이동을 요청하면 C006 의 규칙 그대로 거절된다 — 사유가 같다', () => {
    // Given 숲 가장자리에 선 몸 (anchor 자리에서 시작한다)
    const at = pointsOf(spaceOf(FOREST_EDGE), ANCHOR_LAYER)[0]!.position;
    const w = standing(FOREST_EDGE, at);
    const before = here(w);
    // 그리고 분지 가장자리의 가장 가파른 자리
    const steep = inBasin().filter((c) => c.slope >= STEEP_SLOPE);
    expect(steep.length).toBeGreaterThan(0);
    const target = maxBy(steep, (c) => c.slope);

    // When 거기로 간다고 한다
    const result = move(w, target.x, target.z);
    // Then 거절된다 — 규칙 id 도 사유 코드도 C006 의 것 그대로다 (규칙이 한 글자도 늘지 않았다)
    expect(result).toEqual({ status: 'failure', rule: 'RULE-MOVE-001', reason: BLOCK_STEEP });
    // 그리고 몸이 실제로 선다 — 시간이 흘러도 그대로다
    expect(here(w)).toEqual(before);
    for (let i = 0; i < 30; i++) w.tick(TICK_INTERVAL);
    expect(here(w)).toEqual(before);
    // 요청한 이에게도 같은 대답이 간다
    expect(
      w.dispatchForOutcome({ interactionId: 'move', position: { x: target.x, z: target.z } })[0],
    ).toMatchObject({ accepted: false, reason: BLOCK_STEEP });
  });

  it('S-011 (경계) 분지의 완만한 자리로는 받아들여진다', () => {
    // Given 분지 안에서 45° 미만이고 막히지 않은 자리 — 바닥과 완만한 비탈
    const gentle = inBasin().filter((c) => c.slope < STEEP_SLOPE && c.traversable);
    expect(gentle.length).toBeGreaterThan(0);
    const at = pointsOf(spaceOf(FOREST_EDGE), ANCHOR_LAYER)[0]!.position;
    const w = standing(FOREST_EDGE, at);
    // Then 전부 받아들여진다
    const rejected = gentle
      .map((c) => ({ at: [c.x, c.z], status: move(w, c.x, c.z).status }))
      .filter((r) => r.status !== 'success');
    expect(rejected).toEqual([]);
    // 그리고 파인 바닥에도 실제로 설 수 있다 — 분지는 함정이 아니다
    const bottom = minBy(inBasin(), (c) => c.y);
    expect(bottom.y).toBeLessThan(0);
    expect(move(w, bottom.x, bottom.z).status).toBe('success');
  });

  it('S-012 (경계) 나머지 일곱 방은 여전히 평평하다 — 이 Cycle 은 그 방들을 건드리지 않았다', () => {
    const rest = REGION_SPECS.filter((s) => s.id !== START_REGION_ID && s.id !== FOREST_EDGE);
    for (const spec of rest) {
      const world = compiled(spec.id).world;
      expect({ region: spec.id, risen: [...world.height].filter((h) => h !== 0).length }).toEqual({
        region: spec.id,
        risen: 0,
      });
      expect({ region: spec.id, blocked: [...world.traversable].filter((v) => v !== 1).length }).toEqual({
        region: spec.id,
        blocked: 0,
      });
      expect({ region: spec.id, stamps: stampsOf(spec.space).length }).toEqual({ region: spec.id, stamps: 0 });
    }
  });

  it('S-013 (경계) 사유 코드가 늘지 않았다 — 숲 가장자리가 막는 사유는 급경사 하나다', () => {
    const world = compiled(FOREST_EDGE).world;
    const used = new Set(
      [...world.blocked].filter((_, i) => (world.traversable[i] ?? 1) === 0).map((v) => world.blockedTags[v] ?? ''),
    );
    expect([...used]).toEqual([BLOCK_STEEP]);
    // 물은 없다 — 이 방에는 curve 가 없으므로 규칙이 아무 일도 하지 않는다 (데이터가 정한다)
    expect([...used]).not.toContain(BLOCK_WATER);
  });

  it('S-014 그림과 세계가 새 방에서도 어긋나지 않는다 — 격자 전부를 훑는다', () => {
    // Given 숲 가장자리의 통행 래스터
    const world = compiled(FOREST_EDGE).world;
    const raster = rasterTraversable(world);
    // When 격자의 모든 칸을 세계에 물어본다
    const mismatched: unknown[] = [];
    for (const { cell, accepted, reason } of sweep(FOREST_EDGE)) {
      const value = raster.values[cell.i] ?? 0;
      const drawn = value === 0 ? null : (raster.legend[value] ?? '?');
      if (accepted !== (drawn === null) || reason !== drawn) {
        mismatched.push({ at: [cell.x, cell.z], drawn, accepted, reason });
      }
      // 조회 기구도 같은 말을 한다
      expect({ at: [cell.x, cell.z], t: isTraversableAt(world, cell.x, cell.z) }).toEqual({
        at: [cell.x, cell.z],
        t: drawn === null,
      });
      expect(blockedReasonAt(world, cell.x, cell.z)).toBe(drawn);
    }
    // Then 어긋난 칸이 하나도 없다
    expect(mismatched).toEqual([]);
  });
});

// ── 회귀 — C001~C006 의 행동이 그대로인가 ─────────────────────
describe('회귀', () => {
  it('R-001 (C002~C003) 숲 가장자리를 지나는 건너기가 살아 있다 — 백왕령에서 숲 안쪽까지 걸어간다', () => {
    const w = driveWorld(solo);
    crossFrom(w, START_REGION_ID, FOREST_PATH, FOREST_PATH);
    expect(body(w).regionId).toBe(FOREST_EDGE);
    // 분지가 방을 가로지르는 길을 끊지 않았다 — 남쪽 문에서 북쪽 문까지 걸어간다
    crossFrom(w, FOREST_EDGE, DEEP_TRAIL, DEEP_TRAIL);
    expect(body(w).regionId).toBe(FOREST_DEEP);
  });

  it('R-002 숲 가장자리의 anchor 셋이 전부 통행 가능하다 — 분지가 문을 파묻지 않았다', () => {
    const world = compiled(FOREST_EDGE).world;
    const at = pointsOf(spaceOf(FOREST_EDGE), ANCHOR_LAYER)[0]!.position;
    const w = standing(FOREST_EDGE, at);
    for (const p of pointsOf(spaceOf(FOREST_EDGE), ANCHOR_LAYER)) {
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

  it('R-003 (C006) 백왕령은 그대로다 — 급경사도 물도 다리도 C006 의 대답 그대로다', () => {
    const grid = cellsOf(START_REGION_ID);
    const w = driveWorld(solo);
    const steep = maxBy(
      grid.filter((c) => !c.traversable && c.reason === BLOCK_STEEP),
      (c) => c.slope,
    );
    expect(move(w, steep.x, steep.z)).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: BLOCK_STEEP,
    });
    const water = grid.find((c) => !c.traversable && c.reason === BLOCK_WATER)!;
    expect(move(w, water.x, water.z)).toMatchObject({ status: 'failure', reason: BLOCK_WATER });
    // 방 밖 판정도 그대로다 — 사유가 섞이지 않는다
    const { maxX } = spaceOf(START_REGION_ID).extent;
    expect(move(w, maxX + 0.5, 0)).toMatchObject({ reason: 'out-of-bounds' });
  });

  it('R-004 (C006 SPEC-010) 땅은 여전히 저장되지 않는다 — 새 방에도 격자가 실리지 않는다', () => {
    const at = pointsOf(spaceOf(FOREST_EDGE), ANCHOR_LAYER)[0]!.position;
    const w = standing(FOREST_EDGE, at);
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
    expect(longestArray).toBeLessThan(compiled(FOREST_EDGE).world.height.length);
  });

  it('R-005 관찰 계약이 그대로다 — 봉투의 region 은 { id, hash } 둘뿐이고 STATE_VERSION 도 그대로다', () => {
    const w = driveWorld(solo);
    expect(Object.keys(w.observe().region).sort()).toEqual(['hash', 'id']);
    // 이 Cycle 은 봉투도 STATE_VERSION 도 손대지 않는다 (spec Observable 절)
    expect(w.world.snapshot().version).toBe('hkt-adv-proto-i/2');
  });
});

// ── git 으로 재는 것 (SPEC-009 경계) ───────────────────────────
//
// spec 은 `git diff --stat -- engine content/world content/view` 가 비어 있어야 한다고 적었으나,
// 이 Cycle 은 engine 에 **새 파일 하나**(읽기 전용 관찰 기구)를 세우고 시나리오 테스트도 더한다.
// 그래서 주장을 이렇게 읽는다 — **기존 코드는 한 줄도 바뀌지 않았다**:
//   ① engine · content/world · content/view 의 **코드**에서 고쳐지거나 지워진 파일이 하나도 없다
//   ② content/world · content/view 에는 새로 서는 코드도 없다 (세계도 화면도 한 줄 늘지 않았다)
//   ③ engine 에 새로 서는 코드는 이 Cycle 이 밝힌 관찰 기구 하나뿐이다
// 시나리오 테스트(**/tests/**)는 이 셈에서 뺀다 — 이 Cycle 이 검증을 쓰고, C007 이 뒤집은 옛 주장
// ("여덟 방은 평평하다")을 **좁히기** 때문이다. 재는 자를 재는 것은 이 SPEC 의 뜻이 아니다.
// 판정 범위는 "C007 명세를 동결한 커밋의 부모" 부터다 — 그 자리가 C006 마감이다.

const REPO_DIR = fileURLToPath(new URL('../../../', import.meta.url));

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: REPO_DIR, encoding: 'utf8' });
}

/** 저장소 뿌리에서 이 트랙까지의 접두사 (`HktAdvProtoI/`) — porcelain 의 자리는 뿌리 기준이다 */
const prefix = () => git(['rev-parse', '--show-prefix']).trim();

/** 이 Cycle 이 시작한 커밋 — C007 spec.md 를 처음 더한 커밋의 부모 */
function cycleBase(): string {
  const added = git([
    'log',
    '--format=%H',
    '--diff-filter=A',
    '--',
    'cycles/C007-observe-and-remake/spec.md',
  ])
    .trim()
    .split('\n')
    .filter(Boolean);
  const freeze = added[added.length - 1];
  if (!freeze) throw new Error('C007 명세를 동결한 커밋을 찾지 못했다');
  return `${freeze}^`;
}

interface Change {
  status: string;
  path: string;
}

/** base 이후로 그 자리들에서 달라진 것 — 커밋된 것과 아직 커밋되지 않은 것을 함께 본다 */
function changesSince(base: string, paths: readonly string[]): Change[] {
  const at = prefix();
  const strip = (p: string) => (p.startsWith(at) ? p.slice(at.length) : p);
  const out: Change[] = [];
  const tracked = git(['diff', '--name-status', base, '--', ...paths]).trim();
  for (const line of tracked ? tracked.split('\n') : []) {
    const [status, ...rest] = line.split('\t');
    out.push({ status: (status ?? '').trim()[0] ?? '?', path: strip(rest[rest.length - 1] ?? '') });
  }
  const untracked = git(['status', '--porcelain', '-uall', '--', ...paths]).trim();
  for (const line of untracked ? untracked.split('\n') : []) {
    if (!line.startsWith('??')) continue;
    out.push({ status: '??', path: strip(line.slice(3).trim()) });
  }
  return out.filter((c) => c.path).sort((a, b) => (a.path < b.path ? -1 : 1));
}

// ── 걷기 하네스 (c006 의 선례 그대로) ─────────────────────────
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
  const at = pointsOf(spaceOf(region), ANCHOR_LAYER).find((p) => p.tag === tag)?.position;
  if (!at) throw new Error(`${region} 에 anchor ${tag} 가 없다`);
  walkTo(w, at.x, at.z);
  expect(w.dispatch({ interactionId: 'transit', targetEntityId: connector })).toMatchObject({
    status: 'success',
  });
}
