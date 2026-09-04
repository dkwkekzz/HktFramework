// World Authoring — 관찰(래스터·요약) 테스트 (ENGINE A).
//
// 판이 격자와 1:1 인가 · 눈금이 그 격자의 최소~최대인가 · 값이 태그 색인인가 ·
// 겹침의 우선순위가 ops 순서인가 · 수를 세는 자리가 하나인가를 본다.

import { describe, expect, it } from 'vitest';
import { compileRegion } from '../compile';
import type { CompileRules } from '../compiled';
import type { RegionDescription } from '../description';
import { vertexX, vertexZ } from '../height-field';
import { tagsAt } from '../query';
import { rasterHeight, rasterSemantic, rasterSurface, rasterTraversable, summarize } from '../observe';

const extent = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

/** 언덕 하나 · 겹치는 area 둘 · 다른 layer 하나 · point 둘 — ops 순서가 곧 우선순위다 */
const description: RegionDescription = {
  id: 'r',
  extent,
  seed: 7,
  ops: [
    { id: 'a1', kind: 'area', layer: 'L', tag: 'A', shape: { kind: 'circle', center: { x: 0, z: 0 }, radius: 8 } },
    { id: 'a2', kind: 'area', layer: 'L', tag: 'B', shape: { kind: 'circle', center: { x: 4, z: 0 }, radius: 8 } },
    { id: 'p1', kind: 'point', layer: 'P', tag: 'one', position: { x: -3, z: 2 } },
    { id: 'h', kind: 'stamp', stamp: 'hill', center: { x: -6, z: -6 }, radius: 10, height: 14 },
    { id: 'a3', kind: 'area', layer: 'M', tag: 'other', shape: { kind: 'circle', center: { x: -12, z: 9 }, radius: 4 } },
    { id: 'p2', kind: 'point', layer: 'P', tag: 'two', position: { x: 7, z: -1 } },
    // 같은 layer 에 같은 태그가 또 온다 — legend 는 한 번만 담는다
    { id: 'a4', kind: 'area', layer: 'L', tag: 'A', shape: { kind: 'circle', center: { x: -15, z: 15 }, radius: 3 } },
  ],
};

const rules: CompileRules = {
  resolution: 1,
  surface: [
    { tag: 'flat', maxSlope: 0.2 },
    // 경사가 0 미만인 자리는 없다 — 이 태그는 아무 칸도 받지 않지만 목록에는 남는다
    { tag: 'unused', maxSlope: 0 },
    { tag: 'tilted', maxSlope: 0.7 },
    { tag: 'steep' },
  ],
  blocked: [
    { minSlope: 0.6, reason: 'slope' },
    // 앞의 규칙이 먼저 이기므로 이 사유는 아무 칸도 받지 않는다
    { minSlope: 1.5, reason: 'never' },
  ],
};

const flatDescription: RegionDescription = { id: 'flat', extent, seed: 1, ops: [] };

const compiled = compileRegion(description, rules);
const world = compiled.world;

describe('판의 크기', () => {
  it('격자 vertex 하나가 픽셀 하나다', () => {
    for (const map of [rasterHeight(world), rasterSurface(world), rasterTraversable(world), rasterSemantic(world, 'L')]) {
      expect(map.width).toBe(world.cols);
      expect(map.height).toBe(world.rows);
      expect(map.values).toHaveLength(world.cols * world.rows);
    }
    expect(world.cols).toBe(41);
    expect(world.rows).toBe(41);
  });
});

describe('결정론', () => {
  it('같은 입력을 두 번 래스터하면 바이트까지 같다', () => {
    const again = compileRegion(description, rules);
    expect(again.hash).toBe(compiled.hash);
    const pairs: [Uint8Array, Uint8Array][] = [
      [rasterHeight(world).values, rasterHeight(again.world).values],
      [rasterSurface(world).values, rasterSurface(again.world).values],
      [rasterTraversable(world).values, rasterTraversable(again.world).values],
      [rasterSemantic(world, 'L').values, rasterSemantic(again.world, 'L').values],
    ];
    for (const [a, b] of pairs) {
      expect(Array.from(b)).toEqual(Array.from(a));
    }
    expect(summarize(again)).toEqual(summarize(compiled));
  });
});

describe('높이 눈금', () => {
  const map = rasterHeight(world);

  it('그 격자의 최소~최대를 0..255 로 편다', () => {
    expect(map.legend).toEqual([]);
    expect(map.range).toBeDefined();
    const { min, max } = map.range ?? { min: 0, max: 0 };
    expect(max).toBeGreaterThan(min);

    let lowest = 0;
    let highest = 0;
    for (let i = 1; i < world.height.length; i++) {
      if ((world.height[i] ?? 0) < (world.height[lowest] ?? 0)) lowest = i;
      if ((world.height[i] ?? 0) > (world.height[highest] ?? 0)) highest = i;
    }
    expect(world.height[lowest]).toBeCloseTo(min, 6);
    expect(world.height[highest]).toBeCloseTo(max, 6);
    expect(map.values[lowest]).toBe(0);
    expect(map.values[highest]).toBe(255);
  });

  it('가운데 값도 같은 눈금 위에 있다', () => {
    const { min, max } = map.range ?? { min: 0, max: 1 };
    for (let i = 0; i < map.values.length; i++) {
      const expected = Math.round((((world.height[i] ?? 0) - min) / (max - min)) * 255);
      expect(map.values[i]).toBe(expected);
    }
  });

  it('평평한 격자는 전부 0 이고 range 의 양 끝이 같다', () => {
    const flat = compileRegion(flatDescription, rules);
    const flatMap = rasterHeight(flat.world);
    expect(flatMap.range).toEqual({ min: 0, max: 0 });
    expect(Array.from(flatMap.values).every((v) => v === 0)).toBe(true);
    expect(summarize(flat).height).toEqual({ min: 0, max: 0 });
  });
});

describe('표면 판', () => {
  const map = rasterSurface(world);

  it('값이 surfaceTags 의 색인이고 legend 가 그 목록이다', () => {
    expect(map.legend).toEqual(world.surfaceTags);
    expect(map.legend).toEqual(['flat', 'unused', 'tilted', 'steep']);
    expect(map.range).toBeUndefined();
    for (let i = 0; i < map.values.length; i++) expect(map.values[i]).toBe(world.surface[i]);
  });

  it('legend 를 거쳐 읽은 태그가 그 칸의 태그다', () => {
    const seen = new Set<string>();
    for (let i = 0; i < map.values.length; i++) seen.add(map.legend[map.values[i] ?? 0] ?? '');
    expect(seen.has('flat')).toBe(true);
    expect(seen.has('unused')).toBe(false);
  });
});

describe('통행 판', () => {
  const map = rasterTraversable(world);

  it('legend 는 blockedTags 이고 색인 0 은 빈 문자열이다', () => {
    expect(map.legend).toEqual(world.blockedTags);
    expect(map.legend[0]).toBe('');
  });

  it('0 은 통행 가능이고 그 밖은 막힘 사유의 색인이다', () => {
    let blockedSeen = 0;
    for (let i = 0; i < map.values.length; i++) {
      const value = map.values[i] ?? 0;
      const traversable = (world.traversable[i] ?? 1) !== 0;
      expect(value === 0).toBe(traversable);
      if (!traversable) {
        blockedSeen++;
        expect(value).toBe(world.blocked[i]);
        expect(map.legend[value]).toBe('slope');
      }
    }
    expect(blockedSeen).toBeGreaterThan(0);
  });

  it('아무것도 막지 않는 방의 판은 전부 0 이다', () => {
    const open = compileRegion(flatDescription, { resolution: 1, surface: rules.surface });
    const openMap = rasterTraversable(open.world);
    expect(openMap.legend).toEqual(['']);
    expect(Array.from(openMap.values).every((v) => v === 0)).toBe(true);
  });
});

describe('의미 판', () => {
  const map = rasterSemantic(world, 'L');

  it('legend 는 그 layer 의 태그들이다 — areas 순서 · 중복 제거 · 0 은 빈 문자열', () => {
    expect(map.legend).toEqual(['', 'A', 'B']);
    expect(map.range).toBeUndefined();
  });

  it('겹치면 먼저 온 area 가 이긴다', () => {
    const at = (x: number, z: number): number => {
      const ix = Math.round((x - extent.minX) / world.resolution);
      const iz = Math.round((z - extent.minZ) / world.resolution);
      return map.values[iz * world.cols + ix] ?? 0;
    };
    expect(at(2, 0)).toBe(1);   // A ∩ B — 먼저 온 A
    expect(at(-7, 0)).toBe(1);  // A 만
    expect(at(11, 0)).toBe(2);  // B 만
    expect(at(-19, -19)).toBe(0); // 아무 area 도 없다
    expect(at(-15, 15)).toBe(1);  // 같은 태그의 두 번째 area 도 같은 색인이다
  });

  it('자리 판정이 query 의 것과 같다', () => {
    for (let iz = 0; iz < world.rows; iz++) {
      const z = vertexZ(world, iz);
      for (let ix = 0; ix < world.cols; ix++) {
        const first = tagsAt(world, vertexX(world, ix), z, 'L')[0] ?? '';
        expect(map.legend[map.values[iz * world.cols + ix] ?? 0]).toBe(first);
      }
    }
  });

  it('area 가 없는 layer 는 빈 판이다', () => {
    const empty = rasterSemantic(world, 'nothing-here');
    expect(empty.legend).toEqual(['']);
    expect(empty.width).toBe(world.cols);
    expect(empty.height).toBe(world.rows);
    expect(Array.from(empty.values).every((v) => v === 0)).toBe(true);
  });
});

describe('요약', () => {
  const summary = summarize(compiled);

  it('격자의 수를 그대로 옮긴다', () => {
    expect(summary.extent).toEqual(extent);
    expect(summary.resolution).toBe(1);
    expect(summary.cols).toBe(world.cols);
    expect(summary.rows).toBe(world.rows);
    expect(summary.vertices).toBe(world.cols * world.rows);
    expect(summary.chunks).toBe(compiled.view.chunks.length);
    expect(summary.chunkSize).toBe(compiled.view.chunkSize);
    expect(summary.instances).toBe(compiled.view.instances.length);
  });

  it('표면 칸 수의 합이 vertex 수다 — 칸 수 0 인 태그도 적는다', () => {
    expect(summary.surface.map((s) => s.tag)).toEqual(world.surfaceTags);
    expect(summary.surface.reduce((sum, s) => sum + s.cells, 0)).toBe(summary.vertices);
    expect(summary.surface.find((s) => s.tag === 'unused')?.cells).toBe(0);
  });

  it('통행과 막힘의 합이 vertex 수다 — 사유별 합이 막힘 수다', () => {
    expect(summary.traversableCells + summary.blockedCells).toBe(summary.vertices);
    expect(summary.blockedCells).toBeGreaterThan(0);
    expect(summary.blocked.map((b) => b.tag)).toEqual(['slope', 'never']);
    expect(summary.blocked.reduce((sum, b) => sum + b.cells, 0)).toBe(summary.blockedCells);
    expect(summary.blocked.find((b) => b.tag === 'never')?.cells).toBe(0);
  });

  it('area 와 point 는 ops 순서 그대로다', () => {
    expect(summary.areas).toEqual([
      { layer: 'L', tag: 'A' },
      { layer: 'L', tag: 'B' },
      { layer: 'M', tag: 'other' },
      { layer: 'L', tag: 'A' },
    ]);
    expect(summary.points).toEqual([
      { layer: 'P', tag: 'one' },
      { layer: 'P', tag: 'two' },
    ]);
  });

  it('높이의 최소·최대가 격자의 실제 값이다', () => {
    const heights = Array.from(world.height);
    expect(summary.height.min).toBeCloseTo(Math.min(...heights), 6);
    expect(summary.height.max).toBeCloseTo(Math.max(...heights), 6);
  });

  it('데이터가 없는 방도 답을 낸다 — instance 0 · area 0 · 막힘 0', () => {
    const flat = summarize(compileRegion(flatDescription, rules));
    expect(flat.areas).toEqual([]);
    expect(flat.points).toEqual([]);
    expect(flat.instances).toBe(0);
    expect(flat.blockedCells).toBe(0);
    expect(flat.traversableCells).toBe(flat.vertices);
    expect(flat.blocked).toEqual([
      { tag: 'slope', cells: 0 },
      { tag: 'never', cells: 0 },
    ]);
  });
});
