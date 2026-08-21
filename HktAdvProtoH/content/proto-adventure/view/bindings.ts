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

// 덜어내기를 여는 키 (C022). 손가락 자리가 하나 더 필요한 이유는 조작 계층의 사정이다 —
// 숫자 키는 이미 "쓰기" 가 쓰고 있고, 입력 계층이 조합 키(Shift·Ctrl)를 팩에 전달하지
// 않는다 (engine/view-kernel/input/bindings.ts 는 `code` 하나만 나른다).
//
// 그래서 **두 걸음**이다: B 를 누르면 다음 숫자 키가 쓰기가 아니라 덜어내기가 된다.
// 이것은 조작의 결정일 뿐 게임의 판정이 아니다 — 무엇이 되고 안 되는지는 여전히
// 세계만 답하며, 잘못 눌러 보낸 요청도 세계가 사유와 함께 거절한다.
const DISCARD_ARM_KEY = 'KeyB';

/** 다음 숫자 키가 덜어내기인가. **화면의 조작 상태이지 세계의 상태가 아니다** */
let discardArmed = false;

/** 검증용 — 지금 덜어내기가 열려 있는가 */
export function isDiscardArmed(): boolean {
  return discardArmed;
}

const armDiscard: KeyBinding = {
  code: DISCARD_ARM_KEY,
  // 다시 누르면 닫힌다. 아무것도 보내지 않으므로 잘못 눌러도 세계는 흔들리지 않는다.
  invoke: () => {
    discardArmed = !discardArmed;
  },
};

// 소지품 칸 (C020 쓰기 · C022 덜어내기) — 숫자 키가 몇 번 칸을 부르는가는
// **화면의 결정**이다. 세계는 순서 있는 목록을 보낼 뿐이고, 그 순서에 손가락 자리를
// 붙이는 일이 여기다.
//
// 되는지 안 되는지는 판정하지 않는다 — 없는 칸이면 보내지 않고, 있는 칸이면 그대로
// 요청한다. 안 되는 경우 세계가 사유와 함께 거절하며 그 사유는 이미 소지품 자리에
// 떠 있다 (DC-WORLD-OWNS-THE-SURFACE-LIST · view/inventory-presentation.ts).
function slotKey(index: number): KeyBinding {
  return {
    code: `Digit${index + 1}`,
    invoke: (scene, send) => {
      // 열려 있었으면 이 한 번으로 닫힌다 — 덜어내기가 계속 켜진 채로 남지 않는다.
      const discarding = discardArmed;
      discardArmed = false;

      const kind = inventorySlots(scene)[index];
      if (kind === undefined) return;
      const action: ActionRequest = {
        interactionId: discarding ? 'discard-item' : 'use-item',
        itemKind: kind,
      };
      send(action);
    },
  };
}

export const KEY_BINDINGS: readonly KeyBinding[] = [
  guardToggle,
  moveModeToggle('ShiftLeft'),
  moveModeToggle('ShiftRight'),
  armDiscard,
  // 첫 아홉 칸. 칸이 그만큼 없으면 아무 일도 일어나지 않는다
  ...Array.from({ length: 9 }, (_, i) => slotKey(i)),
];
