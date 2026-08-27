// 이 팩의 특수 키 규칙 (P3 CHANGED — 구 app/main.ts 하드코딩의 이주).
//
// interaction 키 매칭(E·F·G·R 등)은 interaction-presentation 의 데이터가 이미 나른다.
// 여기 있는 것은 장면을 읽어 요청을 골라야 하는 둘뿐이다.

import type { KeyBinding } from '../../../engine/view-kernel/input/bindings';
import type { ActionRequest } from '../protocol/actions';
import type { GameViewSnapshot } from '../protocol/gameview';
import { allocationSlots } from './allocation-presentation';
import { equipmentSlotIds } from './equipment-presentation';
import { inventorySlots } from './inventory-presentation';
import { claimSearchFocus, cycleFilter, cycleOrder } from './inventory-view';
import {
  INVENTORY_SURFACE_ID,
  armDiscardConfirm,
  invokeFocusedAction,
  moveActionFocus,
  moveSelection,
  observedNow,
} from './inventory-workspace';
import { keyCode, SLOT_KEY_IDS } from './key-registry';
import { surfaceIsOpen, toggleSurface } from './surface-state';

// 막기 (C011) — 세계에는 걸기와 놓기가 따로 있다. 화면에서는 한 키로 오간다.
// 세계가 지금 무엇이라고 알려 주었는지를 보고 반대를 요청한다.
// 무너진 동안에는 걸기가 가용하지 않으므로 세계가 사유와 함께 거절한다 (View 가 판정하지 않는다).
const guardToggle: KeyBinding = {
  code: keyCode('guard'),
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
// C023 — 같은 사정으로 두 걸음이 둘 더 늘었다. 걸기는 **소지품 칸**을 가리키고
// 풀기는 **자리**를 가리키므로, 열린 것이 무엇이냐에 따라 같은 숫자 키가 다른 목록을
// 읽는다. 셋 중 하나만 열려 있다 — 열면 나머지는 닫힌다.
// **아래줄 세 칸이 나란하다** — B 덜어내기 · N 걸기 · M 풀기. 셋이 같은 형태의
// 두 걸음이므로 손가락 자리도 나란한 것이 맞다.
//
// V 와 C 는 쓸 수 없다 — 이미 속성 관찰 · 충돌체 관찰이고(app/main.ts · 기반의 터치 패드),
// Z 와 X 도 카메라 회전이 쓴다(engine/view-kernel/input/keyboard.ts).
// **이것은 실제 브라우저로 눌러 보고 알았다** (08-verification.md PLAYABLE).
//
// C024 — 네 번째가 는다. 아래줄 세 칸 옆의 **쉼표**이므로 B·N·M·, 가 나란히 선다.
// 바꿔 걸기만 **세 걸음**인 것은 그것이 "무엇을" 과 "어디에" 를 둘 다 요구하기
// 때문이다 (04 inventory.actions.exchange-item.request). 자리를 고르는 것은
// 판정이 아니라 **선택**이며, 그 선택이 세계가 대신 할 수 없는 것이다
// (INTENT-THE-DISPLACED-IS-NAMED-001).
//
// V-003 — **코드는 여기서 정해지지 않는다.** 네 키도, 아래의 가방 여닫기도 표기와
// 함께 `view/key-registry.ts` 가 쥔다. 화면 안내가 읽는 것도 그 표이므로 둘이
// 갈라질 자리가 없다 (UX 문서 §4.1).
const DISCARD_ARM_KEY = keyCode('discard');
const EQUIP_ARM_KEY = keyCode('equip');
const UNEQUIP_ARM_KEY = keyCode('unequip');
const EXCHANGE_ARM_KEY = keyCode('exchange');
// C-COMBAT-001 — 배분도 같은 두 걸음이다. 넷을 각각 한 키에 두려면 손가락 자리가 넷
// 더 필요한데 남은 자리가 그만큼 없고, 무엇보다 **화면이 배분 이름마다 키를 적어 두면**
// 세계가 배분을 하나 더 지을 때 조작 코드가 열린다. 순서로 짚으면 열리지 않는다.
const ALLOCATION_ARM_KEY = keyCode('allocation');

/** 다음 숫자 키가 무엇인가. **화면의 조작 상태이지 세계의 상태가 아니다** */
type ArmedRole =
  | 'discard-item'
  | 'equip-item'
  | 'unequip-item'
  | 'exchange-item'
  | 'set-allocation'
  | null;
let armed: ArmedRole = null;

/**
 * 바꿔 걸기가 고른 물건 (C024) — 자리를 마저 고를 때까지만 남는다.
 *
 * **화면의 조작 상태이지 세계의 상태가 아니다.** 고르는 동안 세계로 아무것도 나가지
 * 않으므로, 도중에 그만두어도 세계는 흔들리지 않는다.
 */
let exchangeKind: string | null = null;

/** 검증용 — 지금 무엇이 열려 있는가 */
export function armedAction(): ArmedRole {
  return armed;
}

/** 검증용 — 바꿔 걸기가 지금 무엇을 골라 두었는가 */
export function armedExchangeKind(): string | null {
  return exchangeKind;
}

/** 검증용 (C022 호환) — 지금 덜어내기가 열려 있는가 */
export function isDiscardArmed(): boolean {
  return armed === 'discard-item';
}

/** 같은 키를 다시 누르면 닫히고, 다른 키를 누르면 그쪽으로 옮긴다.
 *  아무것도 보내지 않으므로 잘못 눌러도 세계는 흔들리지 않는다. */
function armKey(code: string, role: Exclude<ArmedRole, null>): KeyBinding {
  return {
    code,
    invoke: () => {
      armed = armed === role ? null : role;
      // C024 — 무엇이 열리든 골라 두었던 물건은 버린다. 열린 것이 바뀌었는데 반쯤
      // 고른 것이 남아 있으면 다음 숫자 키가 무엇을 뜻하는지 사람이 알 수 없다.
      exchangeKind = null;
    },
  };
}

// 소지품 칸 (C020 쓰기 · C022 덜어내기) — 숫자 키가 몇 번 칸을 부르는가는
// **화면의 결정**이다. 세계는 순서 있는 목록을 보낼 뿐이고, 그 순서에 손가락 자리를
// 붙이는 일이 여기다.
//
// 되는지 안 되는지는 판정하지 않는다 — 없는 칸이면 보내지 않고, 있는 칸이면 그대로
// 요청한다. 안 되는 경우 세계가 사유와 함께 거절하며 그 사유는 이미 소지품 자리에
// 떠 있다 (DC-WORLD-OWNS-THE-SURFACE-LIST · view/inventory-presentation.ts).
function slotKey(index: number): KeyBinding {
  return {
    // V-003 — 칸 번호의 코드도 표에서 온다 (`slot1` … `slot9`)
    code: keyCode(SLOT_KEY_IDS[index]!),
    invoke: (scene, send) => {
      const role = armed;

      // C024 — 바꿔 걸기는 **세 걸음**이다. 첫 숫자는 물건을, 둘째 숫자는 자리를
      // 가리킨다. 첫 걸음에서는 아무것도 보내지 않으므로 도중에 그만두어도 세계는
      // 흔들리지 않는다.
      if (role === 'exchange-item') {
        if (exchangeKind === null) {
          const kind = inventorySlots(scene)[index];
          // 없는 칸을 짚었으면 닫는다 — 열린 채로 두면 다음 숫자가 자리로 읽힌다
          if (kind === undefined) armed = null;
          else exchangeKind = kind;
          return;
        }
        armed = null;
        const kind = exchangeKind;
        exchangeKind = null;
        // 자리 번호는 **걸린 자리**의 번호다 — 풀기와 같은 번호이며, 바꿔 낄 대상이
        // 걸린 것이기 때문이다 (view/equipment-presentation.ts).
        const slotId = equipmentSlotIds(scene)[index];
        if (slotId === undefined) return;
        const request: ActionRequest = {
          interactionId: 'equip-item',
          itemKind: kind,
          equipSlotId: slotId,
        };
        send(request);
        return;
      }

      // 열려 있었으면 이 한 번으로 닫힌다 — 열린 채로 남지 않는다.
      armed = null;

      // C-COMBAT-001 — 배분은 **순서로** 짚는다. 이름을 적어 두지 않으므로 세계가
      // 배분을 하나 더 지어도 이 줄이 열리지 않는다. 되는지 안 되는지는 판정하지
      // 않는다 — 안 되면 세계가 사유와 함께 거절하고 그 사유는 이미 배분 자리에
      // 떠 있다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
      if (role === 'set-allocation') {
        const allocationId = allocationSlots(scene)[index];
        if (allocationId === undefined) return;
        const request: ActionRequest = { interactionId: 'set-allocation', allocationId };
        send(request);
        return;
      }

      // C023 — 풀기만 **자리**를 가리킨다. 요청이 싣는 것도 자리 하나뿐이며
      // 무엇을 푸는지는 싣지 않는다 (04 equipment.actions.unequip-item).
      if (role === 'unequip-item') {
        const slotId = equipmentSlotIds(scene)[index];
        if (slotId === undefined) return;
        const unequip: ActionRequest = { interactionId: 'unequip-item', equipSlotId: slotId };
        send(unequip);
        return;
      }

      const kind = inventorySlots(scene)[index];
      if (kind === undefined) return;

      // V-002 — 되돌릴 수 없는 손은 이 지름길로도 곧바로 나가지 않는다.
      // 작업 공간이 열리며 무엇이 얼마나 사라지는지 보이고, 답은 거기서 받는다.
      // **이 파일이 그것을 판정하지 않는다** — 어떤 역할이 확인을 요구하는지도,
      // 세계가 그 손을 지금 허락하는지도 작업 공간이 관찰을 보고 정한다
      if (role === 'discard-item') {
        armDiscardConfirm(kind);
        return;
      }

      const action: ActionRequest = {
        interactionId: role ?? 'use-item',
        itemKind: kind,
      };
      send(action);
    },
  };
}

// ── 소지품 작업 공간 (C026) ──────────────────────────────────────────
//
// 지금까지 소지품은 손가락 자리로만 닿을 수 있었다 — 무엇을 고르는 중인지가 화면에
// 남지 않으므로(위 `armed`) 사람이 기억해야 했다. 이 표면은 그 기억을 화면으로 옮긴다.
//
// **두·세 걸음 조작을 대체하지 않는다.** 위의 B·N·M·, 는 그대로 남는다 —
// 아는 사람은 열지 않고 바로 치고, 모르는 사람은 열어서 읽고 고른다.
// C009 의 명령 표면이 세운 태도와 같다 (목록 우선 + 지름길 유지).
//
// 조작은 세 축이다. 어느 것도 세계로 나가지 않는다 — 마지막 Enter 하나만 나간다.
//
//     I            여닫는다
//     ← →          **화면에 선 차례대로** 지닌 것 사이에서 고른다 (V-008)
//     ↑ ↓          고른 것의 행동 줄 사이에서 초점을 옮긴다
//     Enter        초점이 있는 행동을 요청한다
//     J · K · L    분류를 거르고, 보기 차례를 바꾸고, 글자 자리로 간다
//                  (V-008 · V-009 — 어느 것도 세계로 나가지 않는다)
//     Esc · ✕      닫는다 (기반의 표면 능력이 받아 조립을 거쳐 closeSurface 로 온다)
//
// 방향키가 여기까지 오는 것은 표면이 열린 동안 이동이 멈추기 때문이다
// (engine/view-kernel/input/keyboard.ts 의 suspendMovement — 조립 루트가 켠다).

const INVENTORY_OPEN_KEY = keyCode('inventory');

const inventoryToggle: KeyBinding = {
  code: INVENTORY_OPEN_KEY,
  invoke: () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    // 다른 두 걸음이 반쯤 열려 있었다면 닫는다 — 열린 것이 둘이면 다음 키가 무엇을
    // 뜻하는지 사람이 알 수 없다 (위 armKey 와 같은 사유)
    armed = null;
    exchangeKind = null;
  },
};

/**
 * 표면이 열려 있을 때만 듣는 키.
 *
 * 열려 있지 않으면 **아무 일도 하지 않는다** — 그래야 같은 방향키가 표면 밖에서
 * 이동으로 남는다 (표면이 닫히면 이동이 다시 돌아온다).
 */
function workspaceKey(
  code: string,
  act: (snapshot: GameViewSnapshot, send: (a: ActionRequest) => number | null) => void,
): KeyBinding {
  return {
    code,
    invoke: (_scene, send) => {
      if (!surfaceIsOpen(INVENTORY_SURFACE_ID)) return;
      // 표면을 지은 그 관찰을 읽는다 — SceneState 는 이미 표시 지시라 원래의 관찰을
      // 담고 있지 않다 (inventory-workspace.ts 의 observedNow 주석)
      const snapshot = observedNow();
      if (!snapshot) return;
      act(snapshot, send);
    },
  };
}

export const KEY_BINDINGS: readonly KeyBinding[] = [
  guardToggle,
  moveModeToggle(keyCode('moveModeLeft')),
  moveModeToggle(keyCode('moveModeRight')),
  armKey(DISCARD_ARM_KEY, 'discard-item'),
  armKey(EQUIP_ARM_KEY, 'equip-item'),
  armKey(UNEQUIP_ARM_KEY, 'unequip-item'),
  armKey(EXCHANGE_ARM_KEY, 'exchange-item'),
  // C-COMBAT-001 — 배분. 같은 두 걸음이며 다음 숫자가 배분의 차례를 가리킨다
  armKey(ALLOCATION_ARM_KEY, 'set-allocation'),
  // C026 — 소지품 작업 공간. 방향키·Enter 는 열려 있을 때만 듣는다
  inventoryToggle,
  workspaceKey(keyCode('pickLeft'), (snapshot) => moveSelection(snapshot, -1)),
  workspaceKey(keyCode('pickRight'), (snapshot) => moveSelection(snapshot, 1)),
  workspaceKey(keyCode('actionUp'), (snapshot) => moveActionFocus(snapshot, -1)),
  workspaceKey(keyCode('actionDown'), (snapshot) => moveActionFocus(snapshot, 1)),
  workspaceKey(keyCode('invoke'), (snapshot, send) => invokeFocusedAction(snapshot, send)),
  // V-008 — 많은 것 중에서 찾는 자리. 세계로 나가지 않는다: 무엇을 볼지가 바뀔 뿐이다
  workspaceKey(keyCode('viewFilter'), () => cycleFilter()),
  workspaceKey(keyCode('viewOrder'), () => cycleOrder()),
  workspaceKey(keyCode('viewSearch'), () => claimSearchFocus()),
  // Escape 는 여기 없다 — 기반의 표면 능력이 붙잡아 조립을 거쳐 closeSurface 로 온다
  // (engine/view-kernel/hud/surface.ts · app/main.ts). 두 곳에서 받으면 두 번 닫힌다
  // 첫 아홉 칸. 칸이 그만큼 없으면 아무 일도 일어나지 않는다
  ...Array.from({ length: 9 }, (_, i) => slotKey(i)),
];
