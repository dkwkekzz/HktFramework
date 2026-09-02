// World Authoring — Description 단독 테스트 (C001 ADDED).
//
// 게임 명사 없이 형의 성질만 검증한다 — layer · tag 는 아무 문자열이다.

import { describe, expect, it } from 'vitest';
import {
  descriptionHash,
  extentCenter,
  extentContains,
  extentPolygon,
  findPoint,
  pointsOf,
  type RegionDescription,
} from '../description';

const extent = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

function description(ops: RegionDescription['ops']): RegionDescription {
  return { id: 'r', extent, seed: 7, ops };
}

describe('extent — 범위', () => {
  it('경계를 포함한다', () => {
    expect(extentContains(extent, { x: 20, z: -20 })).toBe(true);
    expect(extentContains(extent, { x: -20, z: 20 })).toBe(true);
    expect(extentContains(extent, { x: 0, z: 0 })).toBe(true);
    expect(extentContains(extent, { x: 20.01, z: 0 })).toBe(false);
    expect(extentContains(extent, { x: 0, z: -20.01 })).toBe(false);
  });

  it('네 꼭짓점과 중심', () => {
    const polygon = extentPolygon({ minX: 0, maxX: 4, minZ: 1, maxZ: 3 });
    expect(polygon).toHaveLength(4);
    expect(polygon).toEqual([
      { x: 0, z: 1 },
      { x: 4, z: 1 },
      { x: 4, z: 3 },
      { x: 0, z: 3 },
    ]);
    expect(extentCenter({ minX: 0, maxX: 4, minZ: 1, maxZ: 3 })).toEqual({ x: 2, z: 2 });
  });
});

describe('point 조회', () => {
  const d = description([
    { id: 'a', kind: 'point', layer: 'L1', tag: 'T1', position: { x: 0, z: 18 } },
    { id: 'b', kind: 'point', layer: 'L2', tag: 'T1', position: { x: 1, z: 1 } },
    { id: 'c', kind: 'point', layer: 'L1', tag: 'T2', position: { x: 2, z: 2 } },
  ]);

  it('pointsOf 는 그 layer 만 ops 순서로 준다', () => {
    expect(pointsOf(d, 'L1').map((p) => p.id)).toEqual(['a', 'c']);
    expect(pointsOf(d, 'none')).toEqual([]);
  });

  it('findPoint 는 (layer, tag) 로 찾는다', () => {
    expect(findPoint(d, 'L1', 'T1')?.position).toEqual({ x: 0, z: 18 });
    expect(findPoint(d, 'L2', 'T1')?.id).toBe('b');
    expect(findPoint(d, 'L1', 'T9')).toBeUndefined();
    expect(findPoint(d, 'L9', 'T1')).toBeUndefined();
  });
});

describe('descriptionHash — 결정론', () => {
  const opA = { id: 'a', kind: 'point', layer: 'L', tag: 'A', position: { x: 0, z: 18 } } as const;
  const opB = { id: 'b', kind: 'point', layer: 'L', tag: 'B', position: { x: 0, z: -18 } } as const;

  it('같은 입력 두 번 → 같은 값 (8자리 hex)', () => {
    const h1 = descriptionHash(description([opA, opB]));
    const h2 = descriptionHash(description([opA, opB]));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('ops 순서가 다르면 다른 값', () => {
    expect(descriptionHash(description([opA, opB]))).not.toBe(descriptionHash(description([opB, opA])));
  });

  it('키 순서만 다른 객체는 같은 값', () => {
    const shuffled: RegionDescription = {
      ops: [{ position: { z: 18, x: 0 }, tag: 'A', layer: 'L', kind: 'point', id: 'a' }],
      seed: 7,
      extent: { maxZ: 20, minZ: -20, maxX: 20, minX: -20 },
      id: 'r',
    };
    expect(descriptionHash(shuffled)).toBe(descriptionHash(description([opA])));
  });

  it('내용이 다르면 다른 값', () => {
    expect(descriptionHash(description([opA]))).not.toBe(descriptionHash({ ...description([opA]), seed: 8 }));
    expect(descriptionHash(description([opA]))).not.toBe(
      descriptionHash(description([{ ...opA, position: { x: 0, z: 17 } }])),
    );
  });
});
