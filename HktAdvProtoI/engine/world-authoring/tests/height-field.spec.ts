// World Authoring — 높이 격자 테스트 (ENGINE A).
//
// 게임 명사 없이 격자의 성질만 본다 — stamp 는 그저 지면을 들었다 놓는 편집이다.

import { describe, expect, it } from 'vitest';
import {
  buildHeightField,
  heightAtVertex,
  sampleHeight,
  sampleSlope,
  slopeAtVertex,
  vertexX,
  vertexZ,
} from '../height-field';
import type { RegionDescription, StampOp } from '../description';

const extent = { minX: -8, maxX: 8, minZ: -8, maxZ: 8 };

function description(ops: RegionDescription['ops']): RegionDescription {
  return { id: 'r', extent, seed: 3, ops };
}

function stamp(op: Partial<StampOp> & Pick<StampOp, 'id' | 'stamp'>): StampOp {
  return {
    kind: 'stamp',
    center: { x: 0, z: 0 },
    radius: 4,
    height: 10,
    ...op,
  } as StampOp;
}

describe('격자의 형태', () => {
  it('칸 수 + 1 개의 vertex — extent 를 덮는다', () => {
    const field = buildHeightField(description([]), 2);
    expect(field.cols).toBe(9); // 16 / 2 = 8 칸
    expect(field.rows).toBe(9);
    expect(field.height).toHaveLength(81);
    expect(vertexX(field, 0)).toBe(-8);
    expect(vertexX(field, 8)).toBe(8);
    expect(vertexZ(field, 8)).toBe(8);
  });

  it('폭이 칸의 배수가 아니면 격자가 넘어서 덮는다', () => {
    const field = buildHeightField({ ...description([]), extent: { minX: 0, maxX: 5, minZ: 0, maxZ: 5 } }, 2);
    expect(field.cols).toBe(4); // ceil(5 / 2) = 3 칸
    expect(vertexX(field, 3)).toBe(6);
  });

  it('편집이 없으면 전부 0 이다', () => {
    const field = buildHeightField(description([]), 1);
    expect(Array.from(field.height).every((h) => h === 0)).toBe(true);
  });

  it('resolution 이 0 이하면 격자를 만들지 않는다', () => {
    expect(() => buildHeightField(description([]), 0)).toThrow();
    expect(() => buildHeightField(description([]), -1)).toThrow();
  });
});

describe('stamp 합성', () => {
  it('반경 밖은 0 이다', () => {
    const field = buildHeightField(description([stamp({ id: 'a', stamp: 'hill', radius: 3 })]), 1);
    // 중심에서 4 떨어진 자리 — 반경 3 밖
    expect(sampleHeight(field, 4, 0)).toBe(0);
    expect(sampleHeight(field, 0, -5)).toBe(0);
    expect(sampleHeight(field, 0, 0)).toBeGreaterThan(0);
  });

  it('두 stamp 가 겹치면 순서대로 쌓인다', () => {
    const a = stamp({ id: 'a', stamp: 'hill', center: { x: 0, z: 0 }, radius: 4, height: 10 });
    const b = stamp({ id: 'b', stamp: 'basin', center: { x: 1, z: 0 }, radius: 4, height: 6 });
    const only = buildHeightField(description([a]), 1);
    const both = buildHeightField(description([a, b]), 1);
    const onlyB = buildHeightField(description([b]), 1);
    // 겹친 자리의 값은 두 편집의 합이다
    for (let i = 0; i < both.height.length; i++) {
      expect(both.height[i]).toBeCloseTo((only.height[i] ?? 0) + (onlyB.height[i] ?? 0), 5);
    }
    // basin 은 부호가 반대다 — 겹친 자리는 hill 혼자보다 낮다
    expect(sampleHeight(both, 1, 0)).toBeLessThan(sampleHeight(only, 1, 0));
  });

  it('세 종류는 부호와 감쇠 모양으로만 갈린다', () => {
    const at = (kind: StampOp['stamp'], x: number): number =>
      sampleHeight(buildHeightField(description([stamp({ id: 's', stamp: kind })]), 1), x, 0);
    expect(at('hill', 0)).toBeCloseTo(10, 5);
    expect(at('ridge', 0)).toBeCloseTo(10, 5);
    expect(at('basin', 0)).toBeCloseTo(-10, 5);
    // 중심에서 절반 나간 자리 — 원뿔(ridge)이 돔(hill)보다 낮다
    expect(at('ridge', 2)).toBeLessThan(at('hill', 2));
  });

  it('falloff 가 크면 가장자리가 빨리 떨어진다', () => {
    const soft = buildHeightField(description([stamp({ id: 's', stamp: 'hill' })]), 1);
    const sharp = buildHeightField(description([stamp({ id: 's', stamp: 'hill', falloff: 3 })]), 1);
    expect(sampleHeight(sharp, 3, 0)).toBeLessThan(sampleHeight(soft, 3, 0));
    expect(sampleHeight(sharp, 0, 0)).toBeCloseTo(sampleHeight(soft, 0, 0), 5);
  });
});

describe('bilinear 표본', () => {
  const field = buildHeightField(description([stamp({ id: 's', stamp: 'hill', radius: 6, height: 12 })]), 2);

  it('vertex 자리에서는 격자 값 그대로다', () => {
    for (let iz = 0; iz < field.rows; iz++) {
      for (let ix = 0; ix < field.cols; ix++) {
        expect(sampleHeight(field, vertexX(field, ix), vertexZ(field, iz))).toBeCloseTo(
          heightAtVertex(field, ix, iz),
          5,
        );
      }
    }
  });

  it('칸 가운데는 네 값의 사이다', () => {
    const ix = 3;
    const iz = 4;
    const corners = [
      heightAtVertex(field, ix, iz),
      heightAtVertex(field, ix + 1, iz),
      heightAtVertex(field, ix, iz + 1),
      heightAtVertex(field, ix + 1, iz + 1),
    ];
    const middle = sampleHeight(field, vertexX(field, ix) + 1, vertexZ(field, iz) + 1);
    expect(middle).toBeGreaterThanOrEqual(Math.min(...corners) - 1e-6);
    expect(middle).toBeLessThanOrEqual(Math.max(...corners) + 1e-6);
    // 네 값의 평균이다 (칸의 한가운데)
    expect(middle).toBeCloseTo(corners.reduce((s, h) => s + h, 0) / 4, 5);
  });

  it('격자 밖은 가장자리 값으로 친다', () => {
    expect(sampleHeight(field, -100, 0)).toBeCloseTo(sampleHeight(field, extent.minX, 0), 5);
    expect(sampleHeight(field, 0, 100)).toBeCloseTo(sampleHeight(field, 0, vertexZ(field, field.rows - 1)), 5);
  });
});

describe('경사', () => {
  it('평지는 0 이다', () => {
    const field = buildHeightField(description([]), 1);
    expect(slopeAtVertex(field, 0, 0)).toBe(0);
    expect(sampleSlope(field, 3.5, -2.5)).toBe(0);
  });

  it('기울면 커진다 — 더 높은 stamp 가 더 가파르다', () => {
    const low = buildHeightField(description([stamp({ id: 's', stamp: 'hill', radius: 6, height: 2 })]), 1);
    const high = buildHeightField(description([stamp({ id: 's', stamp: 'hill', radius: 6, height: 20 })]), 1);
    const x = 3;
    expect(sampleSlope(low, x, 0)).toBeGreaterThan(0);
    expect(sampleSlope(high, x, 0)).toBeGreaterThan(sampleSlope(low, x, 0));
    // 봉우리 꼭대기는 다시 평평하다
    expect(sampleSlope(high, 0, 0)).toBeLessThan(sampleSlope(high, x, 0));
  });

  it('경계에서도 값이 나온다 — 한쪽만 보고 잰다', () => {
    // 가장자리를 걸치는 stamp — 격자 끝 vertex 도 기울어 있다
    const field = buildHeightField(description([stamp({ id: 's', stamp: 'ridge', center: { x: -8, z: 0 }, radius: 5, height: 10 })]), 1);
    const corner = slopeAtVertex(field, 0, 0);
    expect(Number.isFinite(corner)).toBe(true);
    expect(slopeAtVertex(field, 0, 8)).toBeGreaterThan(0);
    expect(Number.isFinite(sampleSlope(field, extent.minX, extent.maxZ))).toBe(true);
    // 격자 밖을 물어도 값이 나온다
    expect(Number.isFinite(sampleSlope(field, -50, 50))).toBe(true);
  });

  it('45° 비탈은 45° 로 잰다', () => {
    // 손으로 만든 비탈 — 칸마다 1 씩 오른다 (칸 크기 1)
    const field = buildHeightField(description([]), 1);
    for (let iz = 0; iz < field.rows; iz++) {
      for (let ix = 0; ix < field.cols; ix++) field.height[iz * field.cols + ix] = ix;
    }
    expect(slopeAtVertex(field, 4, 4)).toBeCloseTo(Math.PI / 4, 6);
    expect(slopeAtVertex(field, 0, 0)).toBeCloseTo(Math.PI / 4, 6); // 가장자리도 같다
  });
});

describe('결정론', () => {
  it('같은 입력 두 번 → 같은 Float32Array', () => {
    const ops = [
      stamp({ id: 'a', stamp: 'hill', center: { x: -3, z: 2 }, radius: 5, height: 7 }),
      stamp({ id: 'b', stamp: 'basin', center: { x: 2, z: -1 }, radius: 3, height: 4, falloff: 2 }),
    ];
    const one = buildHeightField(description(ops), 1);
    const two = buildHeightField(description(ops), 1);
    expect(Array.from(one.height)).toEqual(Array.from(two.height));
  });

  it('편집 순서가 달라도 더하기는 같다 — 그러나 Description 은 다른 것이다', () => {
    // 지금의 stamp 는 더하기뿐이라 값은 같다. 순서가 뜻을 갖는 것은 Description 의 hash 다.
    const a = stamp({ id: 'a', stamp: 'hill', center: { x: -2, z: 0 }, radius: 4, height: 5 });
    const b = stamp({ id: 'b', stamp: 'ridge', center: { x: 2, z: 0 }, radius: 4, height: 3 });
    const ab = buildHeightField(description([a, b]), 1);
    const ba = buildHeightField(description([b, a]), 1);
    for (let i = 0; i < ab.height.length; i++) expect(ab.height[i]).toBeCloseTo(ba.height[i] ?? 0, 5);
  });
});

// ── curve(carve) ─────────────────────────────────────────────────────
//
// curve 도 stamp 와 같은 자리에서 같은 격자를 건드리는 편집이다 — 여기서도 이름의 뜻은 묻지 않는다.

import type { CurveOp } from '../description';

function carve(op: Partial<CurveOp> & Pick<CurveOp, 'id'>): CurveOp {
  return {
    kind: 'curve',
    layer: 'L',
    tag: 'C',
    points: [
      { x: -6, z: 0 },
      { x: 6, z: 0 },
    ],
    width: 4,
    profile: 'carve',
    depth: 3,
    ...op,
  } as CurveOp;
}

/** 자리(x, z) 의 vertex 값 — 격자 칸이 1 이고 extent 가 -8 부터라 색인이 그대로 나온다 */
function at(field: ReturnType<typeof buildHeightField>, x: number, z: number): number {
  return heightAtVertex(field, x - extent.minX, z - extent.minZ);
}

describe('curve — carve 는 폭 안쪽만 판다', () => {
  it('중심선에서 depth 만큼 파이고, 멀어질수록 얕아진다', () => {
    const field = buildHeightField(description([carve({ id: 'c' })]), 1);
    expect(at(field, 0, 0)).toBeCloseTo(-3, 5); // 중심 = 깊이 그대로
    // w(t) = (1 - t²)² · t = 거리 / (폭 / 2)
    expect(at(field, 0, 1)).toBeCloseTo(-3 * (1 - 0.25) ** 2, 5);
    expect(at(field, 0, 1)).toBeGreaterThan(at(field, 0, 0));
  });

  it('폭 밖은 한 톨도 건드리지 않는다 — 경계(t = 1)도 0 이다', () => {
    const field = buildHeightField(description([carve({ id: 'c' })]), 1);
    expect(at(field, 0, 2)).toBe(0); // 폭 4 → 중심에서 2 가 경계
    expect(at(field, 0, 3)).toBe(0);
    expect(at(field, 8, 0)).toBe(0); // 중심선의 끝(x = 6) 너머
    expect(at(field, -8, -8)).toBe(0);
  });

  it('가장자리에서 매끄럽게 잦아든다 — 경계의 기울기가 한가운데보다 완만하다', () => {
    // 절벽이 서지 않는다는 것을 값으로 본다: 같은 폭(0.25)을 걸을 때의 높이 차를 견준다
    const field = buildHeightField(description([carve({ id: 'c' })]), 0.25);
    const depthAt = (d: number) => sampleHeight(field, 0, d);
    const edge = Math.abs(depthAt(2) - depthAt(1.75));
    const middle = Math.abs(depthAt(1.25) - depthAt(1));
    expect(edge).toBeLessThan(middle);
    expect(depthAt(2)).toBe(0);
  });

  it('profile 이 없으면 표시선이다 — 높이를 건드리지 않는다', () => {
    const field = buildHeightField(description([carve({ id: 'c', profile: undefined })]), 1);
    expect(Array.from(field.height).every((h) => h === 0)).toBe(true);
  });

  it('점이 2개 미만이거나 폭이 0 이하면 아무것도 하지 않는다', () => {
    const flat = (op: CurveOp) => Array.from(buildHeightField(description([op]), 1).height);
    expect(flat(carve({ id: 'a', points: [] })).every((h) => h === 0)).toBe(true);
    expect(flat(carve({ id: 'b', points: [{ x: 0, z: 0 }] })).every((h) => h === 0)).toBe(true);
    expect(flat(carve({ id: 'c', width: 0 })).every((h) => h === 0)).toBe(true);
    expect(flat(carve({ id: 'd', width: -4 })).every((h) => h === 0)).toBe(true);
    expect(flat(carve({ id: 'e', depth: undefined })).every((h) => h === 0)).toBe(true);
  });

  it('stamp 와 함께 ops 순서대로 쌓인다', () => {
    const hill = stamp({ id: 'h', stamp: 'hill', center: { x: 0, z: 0 }, radius: 4, height: 6 });
    const both = buildHeightField(description([hill, carve({ id: 'c' })]), 1);
    const onlyHill = buildHeightField(description([hill]), 1);
    expect(at(both, 0, 0)).toBeCloseTo(at(onlyHill, 0, 0) - 3, 5);
    expect(at(both, 0, 3)).toBeCloseTo(at(onlyHill, 0, 3), 5); // 폭 밖은 stamp 만 남는다
  });

  it('같은 입력 두 번 → 같은 Float32Array', () => {
    const ops = [carve({ id: 'c' })];
    const one = buildHeightField(description(ops), 1);
    const two = buildHeightField(description(ops), 1);
    expect(Array.from(one.height)).toEqual(Array.from(two.height));
  });
});
