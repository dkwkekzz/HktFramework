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
