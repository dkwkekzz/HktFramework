// 이 팩의 특수 키 규칙 (P3 CHANGED — 구 app/main.ts 하드코딩의 이주).
//
// interaction 키 매칭(E·F·G·R 등)은 interaction-presentation 의 데이터가 이미 나른다.
// 여기 있는 것은 장면을 읽어 요청을 골라야 하는 둘뿐이다.

import type { KeyBinding } from '../../../engine/view-kernel/input/bindings';
import type { ActionRequest } from '../protocol/actions';
import { inventorySlots } from './inventory-presentation';

// 막기 (C011) — 세계에는 걸기와 놓기가 따로 있다. 화면에서는 한 키로 오간다.
// 세계가 지금 무엇이라고 알려 주었는지를 보고 반대를 요청한다.
// 무너진 동안에는 걸기가 가용하지 않으므로 세계가 사유와 함께 거절한다 (View 가 판정하지 않는다).
const guardToggle: KeyBinding = {
  code: 'KeyQ',
  invoke: (scene, send) => {
    const guarding = scene.self?.guard.guarding ?? false;
    const wanted = guarding ? 'guard-release' : 'guard-begin';
    const guard = scene.interactions.find((i) => i.id === wanted);
    if (guard) send({ interactionId: guard.id });
  },
};

// 이동 모드 (C007) — 요청은 토글이 아니라 명시값이므로(walk | run),
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

// 소지품 칸 쓰기 (C020) — 숫자 키가 몇 번 칸을 부르는가는 **화면의 결정**이다.
// 세계는 순서 있는 목록을 보낼 뿐이고, 그 순서에 손가락 자리를 붙이는 일이 여기다.
//
// 되는지 안 되는지는 판정하지 않는다 — 없는 칸이면 보내지 않고, 있는 칸이면 그대로
// 요청한다. 안 되는 경우 세계가 사유와 함께 거절하며 그 사유는 이미 소지품 자리에
// 떠 있다 (DC-WORLD-OWNS-THE-SURFACE-LIST · view/inventory-presentation.ts).
function useSlot(index: number): KeyBinding {
  return {
    code: `Digit${index + 1}`,
    invoke: (scene, send) => {
      const kind = inventorySlots(scene)[index];
      if (kind === undefined) return;
      const action: ActionRequest = { interactionId: 'use-item', itemKind: kind };
      send(action);
    },
  };
}

export const KEY_BINDINGS: readonly KeyBinding[] = [
  guardToggle,
  moveModeToggle('ShiftLeft'),
  moveModeToggle('ShiftRight'),
  // 첫 아홉 칸. 칸이 그만큼 없으면 아무 일도 일어나지 않는다
  ...Array.from({ length: 9 }, (_, i) => useSlot(i)),
];
