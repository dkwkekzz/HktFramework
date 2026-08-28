// 한 코드에 여럿, 그리고 사양하는 길 (V-021).
//
// 지키는 것 넷.
//   · 아무것도 돌려주지 않으면 가져간 것이다 — 이 값이 생기기 전의 바인딩이 전부 그 뜻이었다
//   · false 면 사양한다 — 같은 코드의 다음 바인딩이 묻는다
//   · 아무도 가져가지 않으면 거짓 — 조립이 그 눌림을 세계로 흘린다
//   · 코드가 다른 바인딩은 아예 묻지 않는다

import { describe, expect, it } from 'vitest';
import { dispatchKey, type KeyBinding } from '../input/bindings';
import type { SceneState } from '../scene/scene-state';

const SCENE = {} as SceneState;
const SEND = () => null;

function binding(code: string, log: string[], answer: boolean | void, name = code): KeyBinding {
  return {
    code,
    invoke: () => {
      log.push(name);
      return answer;
    },
  };
}

describe('dispatchKey — 이 눌림을 누가 가져가는가', () => {
  it('아무것도 돌려주지 않으면 가져간 것이다 — 예전 바인딩이 전부 그 뜻이었다', () => {
    const log: string[] = [];
    expect(dispatchKey([binding('KeyA', log, undefined)], 'KeyA', SCENE, SEND)).toBe(true);
    expect(log).toEqual(['KeyA']);
  });

  it('사양하면 같은 코드의 다음 바인딩이 묻는다 — 등록 차례대로', () => {
    const log: string[] = [];
    const bindings = [
      binding('KeyA', log, false, '첫째'),
      binding('KeyA', log, false, '둘째'),
      binding('KeyA', log, true, '셋째'),
      binding('KeyA', log, true, '넷째'),
    ];
    expect(dispatchKey(bindings, 'KeyA', SCENE, SEND)).toBe(true);
    // 가져간 데서 멈춘다 — 넷째는 묻지 않는다
    expect(log).toEqual(['첫째', '둘째', '셋째']);
  });

  it('전부 사양하면 거짓이다 — 그때 그 눌림은 세계로 흐른다', () => {
    const log: string[] = [];
    const bindings = [binding('KeyA', log, false, '첫째'), binding('KeyA', log, false, '둘째')];
    expect(dispatchKey(bindings, 'KeyA', SCENE, SEND)).toBe(false);
    expect(log).toEqual(['첫째', '둘째']);
  });

  it('코드가 다르면 아예 묻지 않는다', () => {
    const log: string[] = [];
    expect(dispatchKey([binding('KeyB', log, true)], 'KeyA', SCENE, SEND)).toBe(false);
    expect(log).toEqual([]);
  });

  it('바인딩이 하나도 없으면 거짓이다', () => {
    expect(dispatchKey([], 'KeyA', SCENE, SEND)).toBe(false);
  });
});
