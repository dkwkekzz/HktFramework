// 손가락 조작 자리 — 버튼 지시를 만드는 규칙만 검사한다. 브라우저 없이, 게임의 명사 없이.
//
// 요점은 하나다: 자판 사용자가 자기 패널에서 읽는 판정(된다 · 안 된다 · 사유)이
// 손가락 사용자에게도 같은 자리(버튼)에서 읽혀야 한다. 사유를 지어내지 않는다 —
// 결정 Layer 가 형식화해 실어 온 문구(unavailableText)를 그대로 비출 뿐이다.

import { describe, expect, it } from 'vitest';
import { touchActionViews } from '../hud/touch-pad';
import type { SceneInteraction, SceneState } from '../scene/scene-state';

function scene(interactions: Partial<SceneInteraction>[]): SceneState {
  return {
    interactions: interactions.map(
      (partial, index) =>
        ({ id: `i${index}`, available: true, ...partial }) as SceneInteraction,
    ),
  } as SceneState;
}

describe('touchActionViews — 상호작용을 버튼 지시로 옮긴다', () => {
  it('키와 이름이 있는 것만 버튼이 된다 — 지형 지목(탭)은 버튼이 아니다', () => {
    const views = touchActionViews(
      scene([
        { key: 'KeyE', prompt: '첫째' },
        { key: 'KeyF', prompt: '지형', terrainTarget: true },
        { prompt: '키 없음' },
        { key: 'KeyG' },
      ]),
    );
    expect(views).toEqual([{ code: 'KeyE', label: '첫째', available: true }]);
  });

  it('안 되는 버튼도 사라지지 않는다 — 사유가 그 버튼에 붙는다', () => {
    const views = touchActionViews(
      scene([{ key: 'KeyF', prompt: '둘째', available: false, unavailableText: '막는 중' }]),
    );
    expect(views).toEqual([
      { code: 'KeyF', label: '둘째', available: false, reason: '막는 중' },
    ]);
  });

  it('되는 버튼에는 사유가 없다 — 지난 사유가 현재를 가리지 않는다', () => {
    const views = touchActionViews(
      scene([{ key: 'KeyF', prompt: '둘째', available: true, unavailableText: '막는 중' }]),
    );
    expect(views[0]!.reason).toBeUndefined();
  });

  it('사유 없이 안 되는 것은 흐림만 남는다 — 빈 문구를 지어내지 않는다', () => {
    const views = touchActionViews(scene([{ key: 'KeyF', prompt: '둘째', available: false }]));
    expect(views[0]).toEqual({ code: 'KeyF', label: '둘째', available: false });
  });

  it('결정 Layer 가 준 순서를 그대로 지킨다', () => {
    const views = touchActionViews(
      scene([
        { key: 'KeyZ2', prompt: '뒤' },
        { key: 'KeyA2', prompt: '앞' },
      ]),
    );
    expect(views.map((v) => v.label)).toEqual(['뒤', '앞']);
  });
});
