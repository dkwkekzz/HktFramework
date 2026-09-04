// World Authoring — 자리로 묻는 조회 (ENGINE).
//
// 컴파일 결과의 형만 빌려 **손으로 적은 작은 격자**를 넣는다 — 여기서 볼 것은 판정 규약뿐이다.
// 태그도 사유도 아무 문자열이고, 이 파일도 그 뜻을 모른다.

import { describe, expect, it } from 'vitest';
import type { CompiledWorldTerrain } from '../compiled';
import { blockedReasonAt, isTraversableAt, tagsAt } from '../query';
import { compileRegion } from '../compile';
import type { RegionDescription } from '../description';

/** 5×5 격자 (칸 1, 원점 0) — 가운데 세로줄 하나가 막혀 있다 */
function world(over: Partial<CompiledWorldTerrain> = {}): CompiledWorldTerrain {
  const traversable = new Uint8Array(25).fill(1);
  const blocked = new Uint8Array(25);
  for (let iz = 0; iz < 5; iz++) {
    traversable[iz * 5 + 2] = 0;
    blocked[iz * 5 + 2] = 1;
  }
  return {
    extent: { minX: 0, maxX: 4, minZ: 0, maxZ: 4 },
    resolution: 1,
    cols: 5,
    rows: 5,
    height: new Float32Array(25),
    surface: new Uint8Array(25),
    surfaceTags: ['s'],
    traversable,
    blocked,
    blockedTags: ['', '막힘'],
    areas: [],
    points: [],
    ...over,
  };
}

describe('isTraversableAt · blockedReasonAt', () => {
  it('막힌 칸과 열린 칸을 가른다', () => {
    const w = world();
    expect(isTraversableAt(w, 2, 1)).toBe(false);
    expect(blockedReasonAt(w, 2, 1)).toBe('막힘');
    expect(isTraversableAt(w, 1, 1)).toBe(true);
    expect(blockedReasonAt(w, 1, 1)).toBeNull();
  });

  it('가장 가까운 vertex 하나로 판정한다 — 칸 안에서 섞지 않는다', () => {
    const w = world();
    expect(isTraversableAt(w, 1.6, 1)).toBe(false); // 2 로 반올림
    expect(isTraversableAt(w, 1.4, 1)).toBe(true); // 1 로 반올림
    expect(blockedReasonAt(w, 2.49, 3)).toBe('막힘');
    expect(blockedReasonAt(w, 2.51, 3)).toBeNull();
  });

  it('격자 밖은 막지 않는다 — 땅이 없는 것은 막는 것이 아니다', () => {
    const w = world();
    expect(isTraversableAt(w, -5, 0)).toBe(true);
    expect(isTraversableAt(w, 100, 100)).toBe(true);
    expect(isTraversableAt(w, Number.NaN, 0)).toBe(true);
    expect(blockedReasonAt(w, -5, 0)).toBeNull();
    expect(blockedReasonAt(w, Number.NaN, 0)).toBeNull();
  });

  it('사유 색인이 빈 문자열이면 사유가 없다', () => {
    const w = world({ blockedTags: [''] }); // 색인 1 이 표 밖이다
    expect(isTraversableAt(w, 2, 1)).toBe(false);
    expect(blockedReasonAt(w, 2, 1)).toBeNull();
  });

  it('같은 자리는 언제나 같은 답이다', () => {
    const w = world();
    for (let i = 0; i < 3; i++) {
      expect(isTraversableAt(w, 2.2, 3.7)).toBe(false);
      expect(blockedReasonAt(w, 2.2, 3.7)).toBe('막힘');
    }
  });
});

const areas: CompiledWorldTerrain['areas'] = [
  {
    layer: 'L',
    tag: 'square',
    shape: {
      kind: 'polygon',
      points: [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 4 },
        { x: 0, z: 4 },
      ],
    },
  },
  { layer: 'L', tag: 'circle', shape: { kind: 'circle', center: { x: 4, z: 4 }, radius: 2 } },
  { layer: '다른층', tag: 'square', shape: { kind: 'circle', center: { x: 0, z: 0 }, radius: 10 } },
];

describe('tagsAt', () => {
  const w = world({ areas });

  it('polygon 안의 자리에 그 태그가 걸린다', () => {
    expect(tagsAt(w, 2, 2, 'L')).toEqual(['square']);
    expect(tagsAt(w, 4.5, 1, 'L')).toEqual([]);
  });

  it('circle 은 반지름 이하가 안이다', () => {
    expect(tagsAt(w, 5.5, 4, 'L')).toEqual(['circle']);
    expect(tagsAt(w, 6, 4, 'L')).toEqual(['circle']); // 정확히 반지름
    expect(tagsAt(w, 6.001, 4, 'L')).toEqual([]);
  });

  it('변 위와 꼭짓점은 안으로 친다', () => {
    expect(tagsAt(w, 0, 2, 'L')).toContain('square'); // 변 위
    expect(tagsAt(w, 2, 0, 'L')).toContain('square');
    expect(tagsAt(w, 0, 0, 'L')).toContain('square'); // 꼭짓점
    expect(tagsAt(w, 4, 4, 'L')).toContain('square');
  });

  it('겹치면 전부 낸다 — 순서는 areas(= ops) 순서다', () => {
    expect(tagsAt(w, 3.5, 3.5, 'L')).toEqual(['square', 'circle']);
  });

  it('layer 로 거른다 — 다른 층은 세지 않는다', () => {
    expect(tagsAt(w, 2, 2, '다른층')).toEqual(['square']);
    expect(tagsAt(w, 2, 2, '없는층')).toEqual([]);
    expect(tagsAt(world(), 2, 2, 'L')).toEqual([]);
  });

  it('오목한 polygon 도 even-odd 로 판정한다', () => {
    const concave = world({
      areas: [
        {
          layer: 'L',
          tag: 'C',
          shape: {
            kind: 'polygon',
            points: [
              { x: 0, z: 0 },
              { x: 6, z: 0 },
              { x: 6, z: 6 },
              { x: 3, z: 1 },
              { x: 0, z: 6 },
            ],
          },
        },
      ],
    });
    expect(tagsAt(concave, 1, 1, 'L')).toEqual(['C']);
    expect(tagsAt(concave, 3, 4, 'L')).toEqual([]); // 파인 곳 — 밖이다
  });
});

describe('컴파일 결과를 그대로 묻는다', () => {
  const description: RegionDescription = {
    id: 'r',
    extent: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 },
    seed: 2,
    ops: [
      {
        id: 'c',
        kind: 'curve',
        layer: 'F',
        tag: 'R',
        points: [
          { x: -6, z: 0 },
          { x: 6, z: 0 },
        ],
        width: 4,
        profile: 'carve',
        depth: 0.5,
      },
      { id: 'x', kind: 'point', layer: 'F', tag: 'X', position: { x: 0, z: 0 } },
      {
        id: 'a',
        kind: 'area',
        layer: 'S',
        tag: 'here',
        shape: { kind: 'circle', center: { x: -4, z: -4 }, radius: 2 },
      },
    ],
  };

  it('막는 규칙과 덮는 자리가 조회로 그대로 읽힌다', () => {
    const compiled = compileRegion(description, {
      resolution: 1,
      surface: [{ tag: 'g' }],
      blocked: [{ nearCurve: { layer: 'F', tag: 'R', maxDistance: 2 }, reason: '물' }],
      passages: [{ layer: 'F', tag: 'X', radius: 1 }],
    });
    expect(isTraversableAt(compiled.world, 4, 0)).toBe(false);
    expect(blockedReasonAt(compiled.world, 4, 0)).toBe('물');
    expect(isTraversableAt(compiled.world, 0, 0)).toBe(true); // 덮인 자리
    expect(isTraversableAt(compiled.world, 4, 5)).toBe(true); // 폭 밖
    expect(tagsAt(compiled.world, -4, -4, 'S')).toEqual(['here']);
    expect(tagsAt(compiled.world, 4, 4, 'S')).toEqual([]);
  });
});
