// 지목 표식 — **어디에 그릴 것인가**의 규칙만 검사한다 (그리기는 화면이 있어야 한다).
//
// 이 층은 무엇을 골랐는지 모른다. 몸에 걸린 표식은 그 몸이 지금 그려지고 있는 자리를 따르고,
// 자리에 걸린 표식은 그 좌표에 선다. 지시가 없으면 그릴 자리도 없다.

import { describe, expect, it } from 'vitest';
import { highlightCenter } from '../renderer/renderer';
import type { SceneHighlight } from '../scene/scene-state';

const MARK: Omit<SceneHighlight, 'entityId' | 'ground'> = {
  color: 0xffffff,
  opacity: 0.8,
  radius: 1,
};

const drawn = (at: Record<string, { x: number; z: number }>) => (id: string) => at[id] ?? null;

describe('지목 표식 — 어디에 서는가', () => {
  it('지시가 없으면 그릴 자리가 없다 — 아무것도 그리지 않는다', () => {
    expect(highlightCenter(undefined, drawn({}))).toBeNull();
  });

  it('자리를 골랐으면 그 자리에 선다', () => {
    expect(highlightCenter({ ...MARK, ground: { x: 5, z: -2 } }, drawn({}))).toEqual({
      x: 5,
      z: -2,
    });
  });

  it('몸을 골랐으면 그 몸이 **지금 그려지고 있는** 자리에 선다', () => {
    expect(
      highlightCenter({ ...MARK, entityId: 'a' }, drawn({ a: { x: 1, z: 2 } })),
    ).toEqual({ x: 1, z: 2 });
  });

  it('아직 한 번도 그려지지 않은 몸이면 그리지 않는다 — 없는 자리에 표식을 세우지 않는다', () => {
    expect(highlightCenter({ ...MARK, entityId: 'ghost' }, drawn({}))).toBeNull();
  });

  it('몸과 자리가 함께 오면 몸이 이긴다 — 표식은 언제나 하나다', () => {
    expect(
      highlightCenter(
        { ...MARK, entityId: 'a', ground: { x: 9, z: 9 } },
        drawn({ a: { x: 1, z: 2 } }),
      ),
    ).toEqual({ x: 1, z: 2 });
  });
});
