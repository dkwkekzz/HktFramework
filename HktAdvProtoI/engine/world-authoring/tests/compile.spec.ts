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

// ── 막힘 · 덮음 · area · instance ────────────────────────────────────
//
// 여전히 게임 명사를 모른다 — reason 도 layer 도 아무 문자열이다.

import type { AreaOp, CurveOp, PointOp } from '../description';

const smallExtent = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const DEG45 = Math.PI / 4;

const cliff: StampOp = {
  id: 'cliff',
  kind: 'stamp',
  stamp: 'ridge',
  center: { x: -6, z: 0 },
  radius: 3,
  height: 12,
};

const stream: CurveOp = {
  id: 'stream',
  kind: 'curve',
  layer: 'F',
  tag: 'R',
  points: [
    { x: -10, z: 5 },
    { x: 10, z: 5 },
  ],
  width: 4,
  profile: 'carve',
  depth: 0.5,
};

const crossing: PointOp = { id: 'x', kind: 'point', layer: 'F', tag: 'X', position: { x: 0, z: 5 } };
const mark: PointOp = { id: 'm', kind: 'point', layer: 'M', tag: 'T', position: { x: -6, z: 0 } };
const areaA: AreaOp = {
  id: 'a1',
  kind: 'area',
  layer: 'S',
  tag: 'one',
  shape: { kind: 'circle', center: { x: 4, z: -4 }, radius: 3 },
};
const areaB: AreaOp = {
  id: 'a2',
  kind: 'area',
  layer: 'S',
  tag: 'two',
  shape: {
    kind: 'polygon',
    points: [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 4 },
    ],
  },
};

const land: RegionDescription = {
  id: 'land',
  extent: smallExtent,
  seed: 5,
  ops: [cliff, stream, crossing, mark, areaA, areaB],
};

const landRules: CompileRules = {
  resolution: 1,
  surface: [{ tag: 'flat', maxSlope: DEG45 }, { tag: 'steep' }],
  blocked: [
    { minSlope: DEG45, reason: 'A' },
    { nearCurve: { layer: 'F', tag: 'R', maxDistance: 2 }, reason: 'B' },
  ],
  passages: [{ layer: 'F', tag: 'X', radius: 2 }],
  instanceLayers: ['M'],
};

/** 자리(x, z) 의 격자 색인 — 칸이 1 이고 extent 가 -10 부터다 */
const cell = (x: number, z: number) => (z + 10) * 21 + (x + 10);

describe('막는 규칙', () => {
  const compiled = compileRegion(land, landRules);
  const world = compiled.world;

  it('사유 목록의 0 은 언제나 빈 문자열이다', () => {
    expect(world.blockedTags[0]).toBe('');
    expect(world.blockedTags).toEqual(['', 'A', 'B']);
    expect(world.traversable).toHaveLength(21 * 21);
    expect(world.blocked).toHaveLength(21 * 21);
  });

  it('경사가 임계 이상이면 막는다', () => {
    expect(world.traversable[cell(-5, 0)]).toBe(0);
    expect(world.blockedTags[world.blocked[cell(-5, 0)] ?? 0]).toBe('A');
  });

  it('curve 폭 안이면 막는다 — 경사와 다른 사유다', () => {
    expect(world.traversable[cell(6, 5)]).toBe(0);
    expect(world.blockedTags[world.blocked[cell(6, 5)] ?? 0]).toBe('B');
    expect(world.traversable[cell(6, 8)]).toBe(1); // 폭 밖
  });

  it('통과 point 둘레는 덮인다 — 놓은 것이 규칙을 이긴다', () => {
    expect(world.traversable[cell(0, 5)]).toBe(1);
    expect(world.blocked[cell(0, 5)]).toBe(0);
    expect(world.traversable[cell(1, 5)]).toBe(1);
    expect(world.traversable[cell(3, 5)]).toBe(0); // 반경 밖은 그대로 막힌다
  });

  it('아무 규칙도 맞지 않는 자리는 통행 가능이다', () => {
    expect(world.traversable[cell(8, -8)]).toBe(1);
    expect(world.blocked[cell(8, -8)]).toBe(0);
  });

  it('배열 순서로 첫 승리 — 둘 다 맞으면 앞선 사유가 붙는다', () => {
    const first = compileRegion(land, {
      ...landRules,
      blocked: [
        { nearCurve: { layer: 'F', tag: 'R', maxDistance: 2 }, reason: 'B' },
        { nearCurve: { layer: 'F', tag: 'R', maxDistance: 4 }, reason: 'C' },
      ],
      passages: [],
    });
    expect(first.world.blockedTags).toEqual(['', 'B', 'C']);
    expect(first.world.blockedTags[first.world.blocked[cell(6, 5)] ?? 0]).toBe('B');
    expect(first.world.blockedTags[first.world.blocked[cell(6, 8)] ?? 0]).toBe('C');
  });

  it('막는 규칙이 없으면 격자 전체가 통행 가능이다 — C005 까지의 땅', () => {
    const open = compileRegion(land, { resolution: 1, surface: landRules.surface });
    expect(open.world.blockedTags).toEqual(['']);
    expect(Array.from(open.world.traversable).every((v) => v === 1)).toBe(true);
    expect(Array.from(open.world.blocked).every((v) => v === 0)).toBe(true);
  });

  it('같은 입력 두 번 → 같은 격자', () => {
    const two = compileRegion(land, landRules);
    expect(Array.from(compiled.world.traversable)).toEqual(Array.from(two.world.traversable));
    expect(Array.from(compiled.world.blocked)).toEqual(Array.from(two.world.blocked));
    expect(compiled.world.blockedTags).toEqual(two.world.blockedTags);
    expect(compiled.hash).toBe(two.hash);
  });
});

describe('area 와 instance', () => {
  const compiled = compileRegion(land, landRules);

  it('area op 는 ops 순서 그대로 옮겨진다 — 모양은 복사본이다', () => {
    expect(compiled.world.areas).toEqual([
      { layer: 'S', tag: 'one', shape: areaA.shape },
      { layer: 'S', tag: 'two', shape: areaB.shape },
    ]);
    expect(compiled.world.areas[0]?.shape).not.toBe(areaA.shape);
  });

  it('instanceLayers 의 point 만 instance 가 되고, y 는 그 자리의 지면 높이다', () => {
    expect(compiled.view.instances).toHaveLength(1);
    const instance = compiled.view.instances[0];
    expect(instance?.tag).toBe('T');
    expect(instance?.position).toEqual({ x: -6, z: 0 });
    // mark 는 ridge 의 꼭대기에 있다 — 격자의 그 자리 높이와 같다
    expect(instance?.y).toBeCloseTo(compiled.world.height[cell(-6, 0)] ?? 0, 5);
    expect(instance?.y).toBeGreaterThan(0);
  });

  it('instanceLayers 가 없으면 instance 는 빈 배열이다', () => {
    const none = compileRegion(land, { resolution: 1, surface: landRules.surface });
    expect(none.view.instances).toEqual([]);
  });
});

describe('새 규칙과 hash', () => {
  const bare: CompileRules = { resolution: 1, surface: [{ tag: 'flat', maxSlope: DEG45 }, { tag: 'steep' }] };

  it('막힘 · 덮음 · instance 가 없으면 그것들이 생기기 전과 같은 값이다', () => {
    const empty: CompileRules = { ...bare, blocked: [], passages: [], instanceLayers: [] };
    expect(compileRegion(land, empty).hash).toBe(compileRegion(land, bare).hash);
  });

  it('규칙이 늘거나 달라지면 값이 달라진다 — 규칙이 바뀌면 땅이 바뀐다', () => {
    const base = compileRegion(land, bare).hash;
    const hashes = [
      base,
      compileRegion(land, { ...bare, blocked: [{ minSlope: DEG45, reason: 'A' }] }).hash,
      compileRegion(land, { ...bare, blocked: [{ minSlope: 1, reason: 'A' }] }).hash,
      compileRegion(land, { ...bare, blocked: [{ minSlope: DEG45, reason: '다른사유' }] }).hash,
      compileRegion(land, { ...bare, passages: [{ layer: 'F', tag: 'X', radius: 2 }] }).hash,
      compileRegion(land, { ...bare, passages: [{ layer: 'F', tag: 'X', radius: 3 }] }).hash,
      compileRegion(land, { ...bare, instanceLayers: ['M'] }).hash,
      compileRegion(land, {
        ...bare,
        surface: [{ tag: 'flat', maxSlope: DEG45, nearCurve: { layer: 'F', tag: 'R', maxDistance: 2 } }, { tag: 'steep' }],
      }).hash,
    ];
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('curve 의 값 하나가 달라지면 값이 달라진다', () => {
    const base = compileRegion(land, landRules).hash;
    const changed = (curve: CurveOp) =>
      compileRegion({ ...land, ops: land.ops.map((op) => (op.id === 'stream' ? curve : op)) }, landRules).hash;
    expect(changed({ ...stream, width: 5 })).not.toBe(base);
    expect(changed({ ...stream, depth: 0.6 })).not.toBe(base);
    expect(changed({ ...stream, points: [{ x: -10, z: 5 }, { x: 10, z: 6 }] })).not.toBe(base);
  });

  it('chunkSize 는 여전히 섞이지 않는다', () => {
    const a = compileRegion(land, landRules, { chunkSize: 4 });
    const b = compileRegion(land, landRules, { chunkSize: 64 });
    expect(a.hash).toBe(b.hash);
    expect(Array.from(a.world.traversable)).toEqual(Array.from(b.world.traversable));
    expect(a.view.instances).toEqual(b.view.instances);
  });
});

describe('curve 가 있어도 seam 이 없다', () => {
  it('chunk 경계 vertex 의 자리와 표면이 양쪽에서 같다', () => {
    const compiled = compileRegion(land, landRules, { chunkSize: 4 });
    const byIndex = new Map<string, (typeof compiled.view.chunks)[number]>();
    for (const chunk of compiled.view.chunks) byIndex.set(`${chunk.ix},${chunk.iz}`, chunk);
    expect(byIndex.size).toBe(25); // 20 칸 / 4 = 5×5

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
          expect(chunk.surface[(chunk.rows - 1) * chunk.cols + ix]).toBe(below.surface[ix]);
        }
      }
    }
  });
});
