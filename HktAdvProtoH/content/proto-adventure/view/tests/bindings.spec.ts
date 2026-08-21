// 키가 겹치지 않는가 (C020 ADDED)
//
// C020 이 덜어내기 키를 더하면서 **엔진이 이미 쓰는 키를 골랐다** (KeyX — 시점 회전).
// 그 키는 `consumeKeyPresses` 에서 제외되므로 팩 바인딩까지 오지 않는다. 단위 테스트가
// `binding.invoke` 를 직접 부르고 있었으므로 아무것도 잡히지 않았고, 게임을 실제로
// 띄워 보고서야 드러났다.
//
// 그 구멍을 이 파일이 막는다. 아래 목록은 엔진과 팩 두 곳에 있는 사실의 사본이므로
// **원본이 바뀌면 여기도 바뀌어야 한다** — 그것이 이 테스트가 지불하는 값이다.
// 사본을 두지 않는 길은 엔진이 예약 키를 내보내는 것인데, 그것은 기반 트랙의 일이다.

import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS } from '../bindings';
import { interactionPresentation } from '../interaction-presentation';

/** engine/view-kernel/input/keyboard.ts — MOVE_KEYS · TURN_KEYS */
const ENGINE_RESERVED = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyZ', 'KeyX', 'KeyR', 'KeyT',
];

/** app/main.ts — 조립 루트가 바인딩보다 **먼저** 가로채는 키들 */
const APP_RESERVED = ['KeyC', 'KeyV', 'Slash'];

describe('팩이 등록한 키는 이미 쓰이는 키와 겹치지 않는다', () => {
  it('엔진이 이동·시점에 쓰는 키를 고르지 않는다', () => {
    for (const binding of KEY_BINDINGS) {
      expect(ENGINE_RESERVED, `${binding.code} 는 엔진이 먼저 가져간다`).not.toContain(
        binding.code,
      );
    }
  });

  it('조립 루트가 먼저 가로채는 키를 고르지 않는다', () => {
    for (const binding of KEY_BINDINGS) {
      // 이동 모드(Shift)는 엔진의 이동 키가 아니라 팩의 것이므로 여기 대상이 아니다
      expect(APP_RESERVED, `${binding.code} 는 조립 루트가 먼저 가져간다`).not.toContain(
        binding.code,
      );
    }
  });

  it('같은 키를 두 바인딩이 가져가지 않는다', () => {
    const codes = KEY_BINDINGS.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('덜어내기 키는 상호작용 키와도 겹치지 않는다', () => {
    // 지금 이 팩이 키를 배정한 상호작용 전부 (view/interaction-presentation.ts)
    const ROLES = [
      'mine-deposit', 'attack-swing', 'skill-basic', 'skill-heavy', 'skill-aura',
      'guard-begin', 'guard-release', 'set-move-mode', 'observe-character',
      'clear-target', 'select-target', 'move-to',
    ];
    const interactionKeys = ROLES.map((r) => interactionPresentation(r).key).filter(
      (k): k is string => k !== undefined,
    );
    const letGo = KEY_BINDINGS.find((b) => b.code === 'KeyB');
    expect(letGo, '덜어내기 바인딩이 있어야 한다').toBeDefined();
    expect(interactionKeys).not.toContain(letGo!.code);
  });
});
