// 늘어난 것을 축하하는 말 (문구 반전 ⑤) — **기반은 문장을 짓지 않는다.**
//
// 이 자리는 지금까지 `+N ${label} 획득!` 을 기반 안에서 지었다. 팩을 갈아 끼워도
// 그 한 줄만은 이 세계의 말로 떴다는 뜻이다. 이제 문장은 실려 오고, 기반이 하는 일은
// `{}` 자리에 늘어난 만큼을 끼우는 셈뿐이다.

import { describe, expect, it } from 'vitest';
import { celebrationText } from '../hud/hud';

describe('celebrationText — 셈은 기반의 것이고 말은 팩의 것이다', () => {
  it('늘어난 만큼이 실려 온 문장의 `{}` 자리에 든다', () => {
    expect(celebrationText({ celebrateText: '+{} 돌 획득!' }, 2, 5)).toBe('+3 돌 획득!');
  });

  it('문장이 없으면 아무것도 뜨지 않는다 — 무엇이 축하할 일인지는 팩이 정한다', () => {
    expect(celebrationText({}, 2, 5)).toBeUndefined();
  });

  it('처음 본 값에는 뜨지 않는다 — 이어 붙은 순간 지닌 것 전부가 쏟아지지 않는다', () => {
    expect(celebrationText({ celebrateText: '+{} 돌 획득!' }, undefined, 5)).toBeUndefined();
  });

  it('줄거나 그대로면 뜨지 않는다 — 덜어낸 것은 얻은 것이 아니다', () => {
    expect(celebrationText({ celebrateText: '+{} 돌 획득!' }, 5, 5)).toBeUndefined();
    expect(celebrationText({ celebrateText: '+{} 돌 획득!' }, 5, 2)).toBeUndefined();
  });

  it('말을 짓지 않는다 — `{}` 가 없는 문장은 그대로 뜬다', () => {
    expect(celebrationText({ celebrateText: '무언가 늘었다' }, 1, 2)).toBe('무언가 늘었다');
  });
});
