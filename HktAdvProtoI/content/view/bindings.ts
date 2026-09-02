// 이 팩의 특수 키 규칙 (P3 CHANGED — 구 app/main.ts 하드코딩의 이주).
//
// interaction 키 매칭(E·F·G·R 등)은 interaction-presentation 의 데이터가 이미 나른다.
// 여기 있는 것은 장면을 읽어 요청을 골라야 하는 것뿐이다 — 지금은 이동 모드 하나다.

import type { KeyBinding } from '../../engine/view-kernel/input/bindings';
import type { ActionRequest } from '../protocol/actions';

// 이동 모드 — 요청은 토글이 아니라 명시값이므로(walk | run),
// 지금 무엇인지를 보고 반대값을 보낸다. 정하는 것은 세계다.
function moveModeToggle(code: string): KeyBinding {
  return {
    code,
    invoke: (scene, send) => {
      const moveMode = scene.interactions.find((i) => i.id === 'move-mode');
      if (!moveMode) return;
      const current = scene.self?.moveModeCode ?? 'walk';
      const action: ActionRequest = {
        interactionId: moveMode.id,
        mode: current === 'run' ? 'walk' : 'run',
      };
      send(action);
    },
  };
}

export const KEY_BINDINGS: readonly KeyBinding[] = [
  moveModeToggle('ShiftLeft'),
  moveModeToggle('ShiftRight'),
];
