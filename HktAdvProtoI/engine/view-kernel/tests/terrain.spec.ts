// 지형 — 컴파일 결과를 그리고 그 높이를 잰다.
//
// 컴파일러(engine/world-authoring/compile)는 부르지 않는다. 형만 빌려 **손으로 적은 작은 값**을
// 넣는다 — 이 층이 검사할 것은 "주어진 격자를 그대로 그리고 그대로 샘플하는가" 뿐이다.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type {
  CompiledViewTerrain,
  CompiledWorldTerrain,
} from '../../world-authoring/compiled';
import { createTerrain, terrainHeightSampler, type TerrainPalette } from '../terrain/terrain';

/** h(x, z) = x + 2z 인 3×3 격자 — 값이 눈으로 확인된다 */
function grid3(): CompiledWorldTerrain {
  const height = new Float32Array([0, 1, 2, 2, 3, 4, 4, 5, 6]);
  return {
    extent: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 },
    resolution: 1,
    cols: 3,
    rows: 3,
    height,
    surface: new Uint8Array(9),
    surfaceTags: ['a'],
    areas: [],
    points: [],
  };
}

const palette = (table: Record<string, number>, fallback = 0x000000): TerrainPalette => ({
  colorOf: (tag) => table[tag] ?? fallback,
});

describe('terrainHeightSampler — 격자를 bilinear 로 샘플한다', () => {
  it('격자점 위에서는 격자 값 그대로다', () => {
    const at = terrainHeightSampler(grid3());
    expect(at(0, 0)).toBeCloseTo(0);
    expect(at(2, 0)).toBeCloseTo(2);
    expect(at(0, 2)).toBeCloseTo(4);
    expect(at(2, 2)).toBeCloseTo(6);
  });

  it('격자점 사이는 네 값을 섞는다', () => {
    const at = terrainHeightSampler(grid3());
    expect(at(0.5, 0)).toBeCloseTo(0.5);
    expect(at(0, 0.5)).toBeCloseTo(1);
    expect(at(0.5, 0.5)).toBeCloseTo(1.5);
    expect(at(1.25, 1.75)).toBeCloseTo(1.25 + 3.5);
  });

  it('격자 밖과 숫자가 아닌 자리는 0 이다', () => {
    const at = terrainHeightSampler(grid3());
    expect(at(-0.001, 0)).toBe(0);
    expect(at(2.001, 0)).toBe(0);
    expect(at(0, -5)).toBe(0);
    expect(at(0, 2.5)).toBe(0);
    expect(at(Number.NaN, 0)).toBe(0);
  });

  it('extent 의 원점과 격자 칸 크기를 따른다 — (0,0) 을 전제하지 않는다', () => {
    const world = grid3();
    const shifted: CompiledWorldTerrain = {
      ...world,
      extent: { minX: -10, maxX: -6, minZ: 4, maxZ: 8 },
      resolution: 2,
    };
    const at = terrainHeightSampler(shifted);
    expect(at(-10, 4)).toBeCloseTo(0); // 격자 (0,0)
    expect(at(-6, 8)).toBeCloseTo(6); // 격자 (2,2)
    expect(at(-9, 4)).toBeCloseTo(0.5); // 칸의 절반 = 0.5 칸
    expect(at(-11, 4)).toBe(0); // 밖
  });
});

/** 2×2 vertex 짜리 chunk 하나 — positions 는 세계 좌표 (x, y, z) 셋씩 */
function oneChunkView(): CompiledViewTerrain {
  return {
    chunkSize: 1,
    chunks: [
      {
        ix: 0,
        iz: 0,
        cols: 2,
        rows: 2,
        // row-major: (0,0) (1,0) / (0,1) (1,1)
        positions: new Float32Array([0, 0, 0, 1, 1, 0, 0, 2, 1, 1, 3, 1]),
        surface: new Uint8Array([0, 1, 1, 0]),
      },
    ],
    surfaceTags: ['low', 'high'],
  };
}

describe('createTerrain — chunk 마다 mesh 하나', () => {
  it('격자를 그대로 그린다 — 자리 · 삼각형 · 위를 향한 앞면', () => {
    const object = createTerrain(oneChunkView(), palette({ low: 0xff0000, high: 0x00ff00 }));
    expect(object.name).toBe('terrain-ground');
    expect(object.children).toHaveLength(1);

    const mesh = object.children[0] as THREE.Mesh;
    expect(mesh.name).toBe('terrain-chunk-0-0');
    const position = mesh.geometry.getAttribute('position');
    expect(position.count).toBe(4);
    expect(position.getY(3)).toBeCloseTo(3); // 높이는 컴파일 결과의 것

    const index = mesh.geometry.getIndex();
    expect(index?.count).toBe(6); // 칸 하나 = 삼각형 둘

    // 첫 삼각형의 법선이 위를 향한다 (감는 방향)
    const p = (i: number) =>
      new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
    const [i0, i1, i2] = [index!.getX(0), index!.getX(1), index!.getX(2)];
    const normal = p(i1)
      .sub(p(i0))
      .cross(p(i2).sub(p(i0)));
    expect(normal.y).toBeGreaterThan(0);
  });

  it('색은 palette 가 정한다 — 기반은 태그의 뜻을 모른다', () => {
    const asked: string[] = [];
    const object = createTerrain(oneChunkView(), {
      colorOf: (tag) => {
        asked.push(tag);
        return tag === 'low' ? 0xff0000 : 0x00ff00;
      },
    });
    expect(asked).toEqual(['low', 'high']); // 태그마다 한 번만 묻는다

    const color = (object.children[0] as THREE.Mesh).geometry.getAttribute('color');
    const low = new THREE.Color(0xff0000);
    const high = new THREE.Color(0x00ff00);
    expect(color.getX(0)).toBeCloseTo(low.r);
    expect(color.getY(1)).toBeCloseTo(high.g);
    expect(color.getY(2)).toBeCloseTo(high.g);
    expect(color.getX(3)).toBeCloseTo(low.r);
  });

  it('모르는 태그도 그린다 — palette 의 기본색으로', () => {
    const view = oneChunkView();
    view.surfaceTags = ['모르는것', '모르는것2'];
    const object = createTerrain(view, palette({}, 0x123456));
    const color = (object.children[0] as THREE.Mesh).geometry.getAttribute('color');
    const fallback = new THREE.Color(0x123456);
    expect(color.getX(0)).toBeCloseTo(fallback.r);
    expect(color.getZ(1)).toBeCloseTo(fallback.b);
  });

  it('chunk 가 여럿이어도 Region 하나를 통째로 그린다', () => {
    const view = oneChunkView();
    view.chunks.push({
      ...view.chunks[0]!,
      ix: 1,
      iz: 0,
      positions: new Float32Array([1, 1, 0, 2, 4, 0, 1, 3, 1, 2, 5, 1]),
    });
    const object = createTerrain(view, palette({ low: 0x111111, high: 0x222222 }));
    expect(object.children.map((c) => c.name)).toEqual([
      'terrain-chunk-0-0',
      'terrain-chunk-1-0',
    ]);
  });

  it('빈 chunk 목록이면 아무것도 그리지 않는다 — 화면은 그대로 돈다', () => {
    const object = createTerrain(
      { chunkSize: 1, chunks: [], surfaceTags: [] },
      palette({}),
    );
    expect(object.children).toHaveLength(0);
  });
});

describe('그리는 격자와 재는 격자는 같은 높이다', () => {
  it('chunk 경계 vertex 는 자리를 공유하고, 샘플러도 같은 값을 낸다', () => {
    const world = grid3();
    const at = terrainHeightSampler(world);
    // 3×3 격자를 2×2 vertex 짜리 chunk 넷으로 나눈다 — 경계 vertex 를 공유한다
    const chunkAt = (ix: number, iz: number) => {
      const positions = new Float32Array(4 * 3);
      const surface = new Uint8Array(4);
      let n = 0;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const x = ix + c;
          const z = iz + r;
          positions[n++] = x;
          positions[n++] = world.height[z * world.cols + x]!;
          positions[n++] = z;
        }
      }
      return { ix, iz, cols: 2, rows: 2, positions, surface };
    };
    const view: CompiledViewTerrain = {
      chunkSize: 1,
      chunks: [chunkAt(0, 0), chunkAt(1, 0), chunkAt(0, 1), chunkAt(1, 1)],
      surfaceTags: ['a'],
    };

    const object = createTerrain(view, palette({ a: 0x445533 }));
    for (const child of object.children) {
      const position = (child as THREE.Mesh).geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        // 그려진 vertex 의 높이 = 그 자리를 샘플한 높이 → chunk 경계에서 틈이 없다
        expect(position.getY(i)).toBeCloseTo(at(position.getX(i), position.getZ(i)));
      }
    }
  });
});

/** 높이 함수로 chunk 하나를 적는다 — 격자점은 정수 자리 */
function chunkFrom(
  ix: number,
  iz: number,
  x0: number,
  z0: number,
  cols: number,
  rows: number,
  h: (x: number, z: number) => number,
) {
  const positions = new Float32Array(cols * rows * 3);
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c;
      const z = z0 + r;
      positions[n++] = x;
      positions[n++] = h(x, z);
      positions[n++] = z;
    }
  }
  return { ix, iz, cols, rows, positions, surface: new Uint8Array(cols * rows) };
}

const plain = palette({});

/** 경계에서 꺾이는 지형 — x < 2 는 평평하고 그 뒤로 올라간다 */
const kinked = (x: number) => (x < 2 ? 0 : (x - 2) * 1.5);

function normalsOf(object: THREE.Object3D, child: number) {
  return (object.children[child] as THREE.Mesh).geometry.getAttribute('normal');
}

function positionsOf(object: THREE.Object3D, child: number) {
  return (object.children[child] as THREE.Mesh).geometry.getAttribute('position');
}

/** 그 자리(x, z)를 그리는 vertex 의 색인 */
function indexAt(object: THREE.Object3D, child: number, x: number, z: number): number {
  const position = positionsOf(object, child);
  for (let i = 0; i < position.count; i++) {
    if (position.getX(i) === x && position.getZ(i) === z) return i;
  }
  throw new Error(`그 자리를 그리는 vertex 가 없다: ${x}, ${z}`);
}

describe('법선 — 자리를 나눠 갖는 vertex 는 법선도 나눠 갖는다', () => {
  const left = chunkFrom(0, 0, 0, 0, 3, 3, kinked);
  const right = chunkFrom(1, 0, 2, 0, 3, 3, kinked);
  const both: CompiledViewTerrain = {
    chunkSize: 2,
    chunks: [left, right],
    surfaceTags: [],
  };

  it('경계 vertex 의 법선이 양쪽 chunk 에서 같다', () => {
    const object = createTerrain(both, plain);
    const [a, b] = [normalsOf(object, 0), normalsOf(object, 1)];
    for (const z of [0, 1, 2]) {
      const ia = indexAt(object, 0, 2, z);
      const ib = indexAt(object, 1, 2, z);
      expect(a.getX(ia)).toBeCloseTo(b.getX(ib), 6);
      expect(a.getY(ia)).toBeCloseTo(b.getY(ib), 6);
      expect(a.getZ(ia)).toBeCloseTo(b.getZ(ib), 6);
    }
  });

  it('그 자리는 잇기 전에는 갈라져 있었다 — 실제로 이은 것이 맞다', () => {
    // 같은 chunk 를 혼자 그리면 자기 안에서만 잰 법선이 남는다
    const alone = createTerrain({ ...both, chunks: [left] }, plain);
    const soloRight = createTerrain({ ...both, chunks: [right] }, plain);
    const la = normalsOf(alone, 0);
    const ra = normalsOf(soloRight, 0);
    const il = indexAt(alone, 0, 2, 1);
    const ir = indexAt(soloRight, 0, 2, 1);
    expect(la.getX(il)).not.toBeCloseTo(ra.getX(ir), 3);
  });

  it('chunk 안쪽 vertex 의 법선은 그대로다 — 잇기가 건드리지 않는다', () => {
    const object = createTerrain(both, plain);
    const alone = createTerrain({ ...both, chunks: [left] }, plain);
    const welded = normalsOf(object, 0);
    const solo = normalsOf(alone, 0);
    // 경계(x = 2) 가 아닌 자리 — 값이 비트까지 같아야 한다
    for (const [x, z] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
    ] as const) {
      const i = indexAt(object, 0, x, z);
      const j = indexAt(alone, 0, x, z);
      expect(welded.getX(i)).toBe(solo.getX(j));
      expect(welded.getY(i)).toBe(solo.getY(j));
      expect(welded.getZ(i)).toBe(solo.getZ(j));
    }
  });

  it('chunk 가 하나면 chunk 안에서 잰 법선 그대로다', () => {
    const object = createTerrain({ ...both, chunks: [right] }, plain);
    const mesh = object.children[0] as THREE.Mesh;
    // 같은 격자로 손수 만든 기하와 비교 — 잇기가 없었을 때의 값
    const bare = new THREE.BufferGeometry();
    bare.setAttribute('position', new THREE.Float32BufferAttribute(right.positions, 3));
    bare.setIndex(Array.from(mesh.geometry.getIndex()!.array as ArrayLike<number>));
    bare.computeVertexNormals();
    const a = mesh.geometry.getAttribute('normal');
    const b = bare.getAttribute('normal');
    for (let i = 0; i < a.count; i++) {
      expect(a.getX(i)).toBe(b.getX(i));
      expect(a.getY(i)).toBe(b.getY(i));
      expect(a.getZ(i)).toBe(b.getZ(i));
    }
  });

  it('서로 닿지 않는 chunk 는 서로에게 영향을 주지 않는다', () => {
    const far = chunkFrom(9, 0, 100, 0, 3, 3, (x) => x * 0.5);
    const object = createTerrain({ ...both, chunks: [left, far] }, plain);
    const alone = createTerrain({ ...both, chunks: [left] }, plain);
    const a = normalsOf(object, 0);
    const b = normalsOf(alone, 0);
    for (let i = 0; i < a.count; i++) {
      expect(a.getX(i)).toBe(b.getX(i));
      expect(a.getY(i)).toBe(b.getY(i));
      expect(a.getZ(i)).toBe(b.getZ(i));
    }
  });
});
