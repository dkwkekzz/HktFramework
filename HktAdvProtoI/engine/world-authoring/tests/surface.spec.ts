// World Authoring — 표면 규칙 표 테스트 (ENGINE A).
//
// 태그는 아무 문자열이다 — 이 파일도 그 뜻을 모른다.

import { describe, expect, it } from 'vitest';
import { buildHeightField } from '../height-field';
import { DEFAULT_SURFACE_TAG, evaluateSurface } from '../surface';
import type { RegionDescription, StampOp } from '../description';
import type { SurfaceRule } from '../compiled';

const extent = { minX: -8, maxX: 8, minZ: -8, maxZ: 8 };

const slope: StampOp = {
  id: 's',
  kind: 'stamp',
  stamp: 'hill',
  center: { x: 0, z: 0 },
  radius: 6,
  height: 12,
};

function field(ops: RegionDescription['ops']) {
  return buildHeightField({ id: 'r', extent, seed: 1, ops }, 1);
}

describe('규칙 표 평가', () => {
  it('규칙이 비어도 터지지 않는다 — 태그 하나로 채운다', () => {
    const { surface, surfaceTags } = evaluateSurface(field([slope]), []);
    expect(surfaceTags).toEqual([DEFAULT_SURFACE_TAG]);
    expect(surfaceTags[0]).not.toBe('');
    expect(surface).toHaveLength(17 * 17);
    expect(Array.from(surface).every((v) => v === 0)).toBe(true);
  });

  it('평지에는 첫 규칙이 붙는다', () => {
    const rules: SurfaceRule[] = [{ tag: 'A', maxSlope: 0.1 }, { tag: 'B' }];
    const { surface, surfaceTags } = evaluateSurface(field([]), rules);
    expect(surfaceTags).toEqual(['A', 'B']);
    expect(Array.from(surface).every((v) => v === 0)).toBe(true);
  });

  it('경사가 커지면 뒤의 규칙이 받는다', () => {
    const rules: SurfaceRule[] = [{ tag: 'A', maxSlope: 0.2 }, { tag: 'B', maxSlope: 0.8 }, { tag: 'C' }];
    const { surface, surfaceTags } = evaluateSurface(field([slope]), rules);
    expect(surfaceTags).toEqual(['A', 'B', 'C']);
    const used = new Set(Array.from(surface));
    expect(used.size).toBeGreaterThan(1);
    // 봉우리 꼭대기(vertex 8,8)는 평평하므로 첫 규칙이다
    expect(surface[8 * 17 + 8]).toBe(0);
    // 가장 가파른 자리는 첫 규칙이 아니다
    expect(Math.max(...Array.from(surface))).toBeGreaterThan(0);
  });

  it('규칙 순서가 이긴다 — 같은 표를 뒤집으면 결과가 달라진다', () => {
    const f = field([slope]);
    const forward = evaluateSurface(f, [{ tag: 'A', maxSlope: 0.2 }, { tag: 'B', maxSlope: 2 }]);
    const backward = evaluateSurface(f, [{ tag: 'B', maxSlope: 2 }, { tag: 'A', maxSlope: 0.2 }]);
    // 뒤집으면 넓은 규칙이 먼저 맞아 전부 그것이 된다
    expect(new Set(Array.from(forward.surface)).size).toBe(2);
    expect(new Set(Array.from(backward.surface))).toEqual(new Set([0]));
    expect(backward.surfaceTags[0]).toBe('B');
  });

  it('아무 규칙도 맞지 않으면 마지막 규칙이다', () => {
    // 어떤 경사도 통과하지 못하는 표 — 마지막 줄이 전부를 받는다
    const { surface, surfaceTags } = evaluateSurface(field([slope]), [
      { tag: 'A', maxSlope: -1 },
      { tag: 'B', maxSlope: -1 },
    ]);
    expect(surfaceTags).toEqual(['A', 'B']);
    expect(new Set(Array.from(surface))).toEqual(new Set([1]));
  });

  it('같은 태그를 여러 규칙이 써도 목록에는 한 번이다', () => {
    const { surfaceTags } = evaluateSurface(field([]), [
      { tag: 'A', maxSlope: 0.1 },
      { tag: 'B', maxSlope: 0.5 },
      { tag: 'A' },
    ]);
    expect(surfaceTags).toEqual(['A', 'B']);
  });

  it('같은 입력 두 번 → 같은 Uint8Array', () => {
    const rules: SurfaceRule[] = [{ tag: 'A', maxSlope: 0.3 }, { tag: 'B' }];
    const one = evaluateSurface(field([slope]), rules);
    const two = evaluateSurface(field([slope]), rules);
    expect(Array.from(one.surface)).toEqual(Array.from(two.surface));
    expect(one.surfaceTags).toEqual(two.surfaceTags);
  });
});

// ── nearCurve ────────────────────────────────────────────────────────

import type { CurveOp } from '../description';

const line: CurveOp = {
  id: 'c',
  kind: 'curve',
  layer: 'F',
  tag: 'R',
  points: [
    { x: -8, z: 0 },
    { x: 8, z: 0 },
  ],
  width: 2, // 표시선이다 — 높이를 건드리지 않으므로 경사는 그대로 0
};

const withLine: RegionDescription = { id: 'r', extent, seed: 1, ops: [line] };
/** 자리(x, z) 의 태그 — 격자 칸이 1 이고 extent 가 -8 부터다 */
const tagAt = (
  result: { surface: Uint8Array; surfaceTags: string[] },
  x: number,
  z: number,
): string | undefined => result.surfaceTags[result.surface[(z + 8) * 17 + (x + 8)] ?? 0];

describe('nearCurve — 중심선까지의 거리로 고른다', () => {
  const rules: SurfaceRule[] = [
    { tag: 'near', nearCurve: { layer: 'F', tag: 'R', maxDistance: 2 } },
    { tag: 'far' },
  ];

  it('maxDistance 이하는 붙고 그보다 멀면 붙지 않는다 — 경계는 안이다', () => {
    const result = evaluateSurface(buildHeightField(withLine, 1), rules, withLine);
    expect(result.surfaceTags).toEqual(['near', 'far']);
    expect(tagAt(result, 0, 0)).toBe('near');
    expect(tagAt(result, 5, 1)).toBe('near');
    expect(tagAt(result, 0, 2)).toBe('near'); // 거리 2 = maxDistance
    expect(tagAt(result, 0, 3)).toBe('far');
    expect(tagAt(result, 0, -3)).toBe('far');
  });

  it('다른 (layer, tag) 의 curve 는 세지 않는다', () => {
    const other: SurfaceRule[] = [
      { tag: 'near', nearCurve: { layer: 'F', tag: '다른것', maxDistance: 2 } },
      { tag: 'far' },
    ];
    const result = evaluateSurface(buildHeightField(withLine, 1), other, withLine);
    expect(tagAt(result, 0, 0)).toBe('far');
  });

  it('Description 을 주지 않으면 curve 를 묻는 규칙은 아무 데서도 맞지 않는다', () => {
    // 인자가 늘기 전의 계약 — 경사만 묻던 표는 값이 한 톨도 달라지지 않는다
    const result = evaluateSurface(buildHeightField(withLine, 1), rules);
    expect(tagAt(result, 0, 0)).toBe('far');
    const slopeOnly: SurfaceRule[] = [{ tag: 'A', maxSlope: 0.3 }, { tag: 'B' }];
    const before = evaluateSurface(field([slope]), slopeOnly);
    const after = evaluateSurface(field([slope]), slopeOnly, { id: 'r', extent, seed: 1, ops: [slope] });
    expect(Array.from(after.surface)).toEqual(Array.from(before.surface));
  });

  it('한 규칙 안의 조건은 AND 다 — 경사도 맞고 거리도 맞아야 한다', () => {
    const hill: RegionDescription = { id: 'r', extent, seed: 1, ops: [slope, line] };
    const both: SurfaceRule[] = [
      { tag: 'wet-flat', maxSlope: 0.1, nearCurve: { layer: 'F', tag: 'R', maxDistance: 2 } },
      { tag: 'rest' },
    ];
    const result = evaluateSurface(buildHeightField(hill, 1), both, hill);
    // 중심선 위지만 언덕 비탈이라 경사 조건이 걸린다
    expect(tagAt(result, 4, 0)).toBe('rest');
    // 중심선 위이면서 평평한 자리 (언덕 반경 6 밖)
    expect(tagAt(result, 8, 0)).toBe('wet-flat');
  });

  it('배열 순서로 첫 승리 — 앞선 규칙이 이긴다', () => {
    const ordered: SurfaceRule[] = [
      { tag: 'first', nearCurve: { layer: 'F', tag: 'R', maxDistance: 2 } },
      { tag: 'second', nearCurve: { layer: 'F', tag: 'R', maxDistance: 4 } },
      { tag: 'rest' },
    ];
    const result = evaluateSurface(buildHeightField(withLine, 1), ordered, withLine);
    expect(tagAt(result, 0, 0)).toBe('first');
    expect(tagAt(result, 0, 3)).toBe('second');
    expect(tagAt(result, 0, 5)).toBe('rest');
  });

  it('같은 입력 두 번 → 같은 Uint8Array', () => {
    const one = evaluateSurface(buildHeightField(withLine, 1), rules, withLine);
    const two = evaluateSurface(buildHeightField(withLine, 1), rules, withLine);
    expect(Array.from(one.surface)).toEqual(Array.from(two.surface));
  });
});
