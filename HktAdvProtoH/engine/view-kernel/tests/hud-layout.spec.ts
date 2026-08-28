// HUD 자리 배치 — 브라우저 없이 확인할 수 있는 것만 여기서 본다.
//
// 겹치지 않는다는 것 자체는 브라우저가 배치를 해 봐야 알 수 있으므로 도구가 잰다
// (`npm run hud:shot` — 자리판에 놓인 것들의 사각형을 재어 둘씩 겹쳐 본다).
// 여기서 보는 것은 그 앞의 결정 하나다: **지금 어느 자리에 놓느냐**.

import { describe, expect, it } from 'vitest';
import { HUD_REGIONS, resolveRegion, type HudRegion } from '../hud/hud-layout';

describe('resolveRegion — 지금 놓일 자리', () => {
  it('비켜 줄 자리를 밝히지 않았으면 기기가 무엇이든 제자리에 남는다', () => {
    expect(resolveRegion('top-left', undefined, false)).toBe('top-left');
    expect(resolveRegion('top-left', undefined, true)).toBe('top-left');
  });

  it('밝혔더라도 자판 기기에서는 제자리다', () => {
    expect(resolveRegion('bottom-right', 'top-left', false)).toBe('bottom-right');
  });

  it('손가락 기기에서는 비켜 준다 — 오른쪽 아래는 조작 버튼의 자리이기 때문이다', () => {
    expect(resolveRegion('bottom-right', 'top-left', true)).toBe('top-left');
  });
});

describe('자리 어휘', () => {
  it('여섯이다 — 열 셋 × 위아래', () => {
    expect([...HUD_REGIONS].sort()).toEqual(
      (
        [
          'bottom-center',
          'bottom-left',
          'bottom-right',
          'top-center',
          'top-left',
          'top-right',
        ] as HudRegion[]
      ).sort(),
    );
  });
});
