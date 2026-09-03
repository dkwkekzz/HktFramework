// World Authoring — 컴파일 테스트 (ENGINE A).
//
// 두 산출물이 같은 격자에서 나온다는 것과, 같은 입력이 같은 값을 준다는 것 둘을 본다.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CHUNK_SIZE, compileRegion } from '../compile';
import type { CompileRules } from '../compiled';
import type { RegionDescription, StampOp } from '../description';

const extent = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };

const hill: StampOp = {
  id: 'h',
  kind: 'stamp',
  stamp: 'hill',
  center: { x: -10, z: 12 },
  radius: 20,
  height: 18,
};

const basin: StampOp = {
  id: 'b',
  kind: 'stamp',
  stamp: 'basin',
  center: { x: 14, z: -6 },
  radius: 12,
  height: 5,
  falloff: 2,
};

const description: RegionDescription = {
  id: 'r',
  extent,
  seed: 11,
  ops: [
    { id: 'p1', kind: 'point', layer: 'L', tag: 'A', position: { x: 0, z: 0 } },
    hill,
    { id: 'p2', kind: 'point', layer: 'L', tag: 'B', position: { x: 3, z: -4 } },
    basin,
  ],
};

const rules: CompileRules = {
  resolution: 1,
  surface: [{ tag: 'flat', maxSlope: 0.2 }, { tag: 'tilted', maxSlope: 0.7 }, { tag: 'steep' }],
};

describe('산출물', () => {
  const compiled = compileRegion(description, rules);

  it('world 는 chunk 없는 격자 하나다', () => {
    expect(compiled.world.cols).toBe(81);
    expect(compiled.world.rows).toBe(81);
    expect(compiled.world.height).toHaveLength(81 * 81);
    expect(compiled.world.surface).toHaveLength(81 * 81);
    expect(compiled.world.surfaceTags).toEqual(['flat', 'tilted', 'steep']);
    expect(compiled.world.resolution).toBe(1);
  });

  it('point op 는 ops 순서 그대로 옮겨진다 — area 는 아직 없다', () => {
    expect(compiled.world.points).toEqual([
      { layer: 'L', tag: 'A', position: { x: 0, z: 0 } },
      { layer: 'L', tag: 'B', position: { x: 3, z: -4 } },
    ]);
    expect(compiled.world.areas).toEqual([]);
  });

  it('Region 하나가 chunk 하나가 아니다', () => {
    // 기본값 32 칸 → 80 칸은 3×3 으로 나뉜다
    expect(compiled.view.chunkSize).toBe(DEFAULT_CHUNK_SIZE);
    expect(compiled.view.chunks).toHaveLength(9);
    expect(compiled.view.chunks.map((c) => `${c.ix},${c.iz}`)).toContain('2,2');
    expect(compiled.view.surfaceTags).toBe(compiled.world.surfaceTags);
  });

  it('chunk 의 vertex 는 world 격자의 같은 자리다', () => {
    const world = compiled.world;
    for (const chunk of compiled.view.chunks) {
      expect(chunk.positions).toHaveLength(chunk.cols * chunk.rows * 3);
      for (let iz = 0; iz < chunk.rows; iz++) {
        for (let ix = 0; ix < chunk.cols; ix++) {
          const gx = chunk.ix * compiled.view.chunkSize + ix;
          const gz = chunk.iz * compiled.view.chunkSize + iz;
          const t = (iz * chunk.cols + ix) * 3;
          expect(chunk.positions[t]).toBeCloseTo(extent.minX + gx * world.resolution, 4);
          expect(chunk.positions[t + 1]).toBeCloseTo(world.height[gz * world.cols + gx] ?? 0, 4);
          expect(chunk.positions[t + 2]).toBeCloseTo(extent.minZ + gz * world.resolution, 4);
          expect(chunk.surface[iz * chunk.cols + ix]).toBe(world.surface[gz * world.cols + gx]);
        }
      }
    }
  });
});

describe('seam 없음', () => {
  it('chunk 경계 vertex 의 값이 양쪽에서 같다', () => {
    const compiled = compileRegion(description, rules, { chunkSize: 16 });
    const byIndex = new Map<string, typeof compiled.view.chunks[number]>();
    for (const chunk of compiled.view.chunks) byIndex.set(`${chunk.ix},${chunk.iz}`, chunk);
    expect(byIndex.size).toBe(25); // 80 칸 / 16 = 5×5

    const at = (c: (typeof compiled.view.chunks)[number], ix: number, iz: number): number[] => {
      const t = (iz * c.cols + ix) * 3;
      return [c.positions[t] ?? 0, c.positions[t + 1] ?? 0, c.positions[t + 2] ?? 0];
    };

    for (const chunk of compiled.view.chunks) {
      const right = byIndex.get(`${chunk.ix + 1},${chunk.iz}`);
      if (right) {
        for (let iz = 0; iz < chunk.rows; iz++) {
          expect(at(chunk, chunk.cols - 1, iz)).toEqual(at(right, 0, iz));
          expect(chunk.surface[iz * chunk.cols + (chunk.cols - 1)]).toBe(right.surface[iz * right.cols]);
        }
      }
      const below = byIndex.get(`${chunk.ix},${chunk.iz + 1}`);
      if (below) {
        for (let ix = 0; ix < chunk.cols; ix++) {
          expect(at(chunk, ix, chunk.rows - 1)).toEqual(at(below, ix, 0));
        }
      }
    }
  });

  it('chunkSize 를 바꿔도 world 도 hash 도 그대로다', () => {
    const a = compileRegion(description, rules, { chunkSize: 8 });
    const b = compileRegion(description, rules, { chunkSize: 40 });
    expect(a.hash).toBe(b.hash);
    expect(Array.from(a.world.height)).toEqual(Array.from(b.world.height));
    expect(a.view.chunks.length).not.toBe(b.view.chunks.length);
  });

  it('격자를 다 덮는다 — 마지막 chunk 가 남은 칸을 받는다', () => {
    const compiled = compileRegion(description, rules, { chunkSize: 30 });
    const last = compiled.view.chunks[compiled.view.chunks.length - 1];
    expect(last?.ix).toBe(2);
    expect(last?.cols).toBe(21); // 80 - 60 + 1
  });
});

describe('결정론', () => {
  it('같은 입력 두 번 → 같은 hash · 같은 Float32Array', () => {
    const one = compileRegion(description, rules);
    const two = compileRegion(description, rules);
    expect(one.hash).toBe(two.hash);
    expect(one.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(Array.from(one.world.height)).toEqual(Array.from(two.world.height));
    expect(Array.from(one.world.surface)).toEqual(Array.from(two.world.surface));
  });

  it('Description 이 하나라도 다르면 hash 가 다르다', () => {
    const base = compileRegion(description, rules).hash;
    const moved: RegionDescription = {
      ...description,
      ops: description.ops.map((op) => (op.id === 'h' ? { ...hill, center: { x: -9, z: 12 } } : op)),
    };
    expect(compileRegion(moved, rules).hash).not.toBe(base);
    expect(compileRegion({ ...description, seed: 12 }, rules).hash).not.toBe(base);
    expect(compileRegion({ ...description, ops: [...description.ops].reverse() }, rules).hash).not.toBe(base);
    expect(
      compileRegion({ ...description, extent: { ...extent, maxX: 41 } }, rules).hash,
    ).not.toBe(base);
  });

  it('규칙이 하나라도 다르면 hash 가 다르다', () => {
    const base = compileRegion(description, rules).hash;
    expect(compileRegion(description, { ...rules, resolution: 2 }).hash).not.toBe(base);
    expect(
      compileRegion(description, { ...rules, surface: [{ tag: 'flat', maxSlope: 0.3 }, { tag: 'tilted', maxSlope: 0.7 }, { tag: 'steep' }] }).hash,
    ).not.toBe(base);
    expect(
      compileRegion(description, { ...rules, surface: [{ tag: 'other', maxSlope: 0.2 }, { tag: 'tilted', maxSlope: 0.7 }, { tag: 'steep' }] }).hash,
    ).not.toBe(base);
    // 표의 순서도 규칙의 일부다
    expect(compileRegion(description, { ...rules, surface: [...rules.surface].reverse() }).hash).not.toBe(base);
  });

  it('없는 필드(maxSlope)와 빈 표를 구별한다', () => {
    const open = compileRegion(description, { resolution: 1, surface: [{ tag: 'A' }] }).hash;
    const bounded = compileRegion(description, { resolution: 1, surface: [{ tag: 'A', maxSlope: 1 }] }).hash;
    const empty = compileRegion(description, { resolution: 1, surface: [] }).hash;
    expect(new Set([open, bounded, empty]).size).toBe(3);
  });
});
