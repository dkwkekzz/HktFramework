// 소지품 작업 공간 (C026) — 지닌 것에 대한 답을 **한 자리에** 모은다.
//
// 지금까지 한 물건에 대한 답이 화면 두 곳에 흩어져 있었다: 무엇을 얼마나 지녔는지는
// 가로 띠에, 그것으로 무엇이 되는지는 self 패널 아래 세로 목록에. 그리고 무엇을 고르는
// 중인지는 어디에도 없었다 (bindings.ts 의 `armed` 는 화면에 나타나지 않는다).
//
// 이 파일이 그 셋을 한 표면에 세운다. **판정은 하나도 하지 않는다** — 되는지도 왜 안
// 되는지도 계약이 실어 온 것을 옮길 뿐이다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
//
// 그리고 **종류 이름이 이 파일의 규칙이 되지 않는다.** 아래에 `stone` 도 `pickaxe` 도
// 없다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH). 세계가 새 아이템을 정의해도 이 파일은
// 바뀌지 않는다.
//
// ── 두 축을 한 격자에 섞지 않는다 (04 surface_rule CORRECTED) ────────
//
// 지닌 것은 **종류별 목록**이고 자리는 **수**다. 겹침 한도가 계약에 실리지 않으므로
// (C022 가 일부러 뺐다) 화면은 한 항목이 자리를 몇 개 쓰는지 알 수 없다 — 돌 넷은
// 항목 하나에 자리 둘이다. 그래서 둘을 나란한 두 구획으로 둔다. 한 격자에 섞으면
// 칸을 세는 사람에게 거짓을 말하게 된다.

import type {
  SceneSurface,
  SceneSurfaceCell,
  SceneSurfaceRow,
} from '../../../engine/view-kernel/scene/scene-state';
import { createPendingRequests } from '../../../engine/view-kernel/net/pending';
import { waitStage, waitText } from './request-timing';
import { moveFocus } from '../../../engine/view-kernel/input/focus';
import { EXECUTION_LOG_SURFACE_ID, pickLogEntry } from './execution-log';
import type { ActionRequest } from '../protocol/actions';
import type {
  EquipmentSlotView,
  GameViewSnapshot,
  InventoryItemView,
  ItemActionView,
} from '../protocol/gameview';
// 걸린 자리가 보태는 값 — 띠·패널이 쓰는 그 함수다 (V-012). 같은 값을 두 곳에서 짓지 않는다
import { contributionText, equipmentSlotKeys } from './equipment-presentation';
import {
  applyViewCell,
  categoryLabel,
  filterCells,
  itemName,
  narrowedBy,
  orderCells,
  resetView,
  searchField,
  SEARCH_FIELD_ID,
  setSearch,
  visibleItems,
} from './inventory-view';
import { inventorySlotKeys } from './inventory-presentation';
import { isFresh, markSeen, noteObserved, resetFresh } from './inventory-new';
import { keyLabel } from './key-registry';
import { openSurface, surfaceIsOpen } from './surface-state';

/** 이 표면의 이름 — 여는 손짓과 닫는 길이 같은 것을 가리키게 하는 열쇠 */
export const INVENTORY_SURFACE_ID = 'inventory';

/** 격자를 몇 칸씩 놓는가 — **표현이며 계약에서 오지 않는다** */
const COLUMNS = 4;

/**
 * 장비 자리를 몇 칸씩 놓는가 — 이것도 **표현이다** (V-012).
 *
 * 지금 세계의 자리가 여섯이라 한 줄에 선다. 세계가 자리를 늘리면 줄이 접힐 뿐,
 * 화면이 자리 수를 세거나 정하지 않는다.
 */
const EQUIPMENT_COLUMNS = 6;

// 작업 공간의 좌우 두 열 (문서 §2.2 · §2.3) — **넓이는 청함이고 문턱은 이 수다.**
//
// 문서는 `≥ 1100px` 을 말하지만 그것은 창의 너비이고, 나란히 놓을 자리를 지니는 것은
// 표면 자신이다. 그래서 문턱을 **한 열의 가장 좁은 너비**로 적는다 — 표면이 두 열을
// 담을 만큼 넓으면 서고, 아니면 목록의 차례 그대로 다시 쌓인다.
const WORKSPACE_WIDTH = 1100;
const WORKSPACE_GROUP = 'workspace';
const WORKSPACE_COLUMN_MIN = 470;

/**
 * 이 표면에서 **실행하지 않는** 역할 (04 unexecutable_actions).
 *
 * **지금은 비어 있다** (V-012). 바꿔 걸기가 여기 있던 이유는 하나였다 — 자리를
 * 지목해야 성립하는데 자리를 고를 곳이 화면에 없었다. 장비 구획이 서면서 그 자리가
 * 생겼으므로, 그 손도 이 표면 안에서 끝까지 간다 (아래 `exchanging`).
 *
 * 표는 남긴다. 세계가 실어 오는 역할 중 이 표면이 아직 끝까지 데려가지 못하는 것이
 * 다시 생길 수 있고, 그때 **감추지 않고 사유와 함께 세우는** 자리가 여기다.
 */
const NOT_EXECUTABLE_HERE: Readonly<Record<string, string>> = {};

/** 분류가 정하는 아이콘. **모르는 분류는 아이콘 없이 나온다** — 화면이 멈추지 않는다 */
const CATEGORY_ICON: Record<string, string> = {
  material: '🪨',
  tool: '⛏',
  consumable: '🧪',
  gear: '🛡',
};

/** 의미 역할 → 사람이 읽는 이름. **표에 없는 역할은 코드 그대로 보인다** */
const ACTION_LABEL: Record<string, string> = {
  'use-item': '쓰기',
  'discard-item': '덜어내기',
  'equip-item': '걸기',
  'exchange-item': '바꿔 걸기',
  // V-012 — 장비 구획이 이 표면 안에 서면서 푸는 손도 여기로 들어왔다.
  // `equipment-presentation.ts` 의 표와 **같은 문구**여야 한다 — 겪는 일이 하나다
  'unequip-item': '풀기',
};

/**
 * 확인을 거쳐야 하는 역할 (UX 문서 §7 · V-002).
 *
 * **세계의 판정이 아니라 화면의 신중함이다.** 세계는 이 요청을 다른 요청과 똑같이
 * 받으며, 되는지 안 되는지도 이미 `available` 로 말해 두었다. 여기서 한 걸음을 더
 * 두는 이유는 하나뿐이다 — 이 요청이 받아들여지면 **되돌릴 길이 없다**.
 *
 * 그래서 이 표에 있는 역할은 Enter 한 번으로 나가지 않는다. 무엇이 얼마나 사라지는지
 * 먼저 뜨고, 그만두면 세계로 아무것도 나가지 않는다.
 *
 * **수량을 고르는 자리는 여기 없다** — 세계가 부분 수량 덜어내기를 모른다
 * (world/rules/item-discard.ts 는 종류를 통째로 지운다). 없는 개념의 자리를 만들면
 * 그것이 곧 화면이 지어낸 규칙이 된다.
 */
const CONFIRM_REQUIRED: ReadonlySet<string> = new Set(['discard-item']);

/** 확인 구획의 두 줄 — 어느 쪽에 초점이 있는가가 곧 Enter 가 할 일이다 */
/** 바꿔 걸 자리를 고르는 줄들의 앞머리 · 그만두는 줄 (V-012) */
const EXCHANGE_ROW_PREFIX = 'exchange.';
const EXCHANGE_CANCEL_ID = 'exchange.cancel';
const CONFIRM_COMMIT_ID = 'confirm.commit';
const CONFIRM_CANCEL_ID = 'confirm.cancel';

// ── 겪는 사람 쪽 상태 — **세계의 상태가 아니다** ──────────────────────
//
// 고르는 것도 초점을 옮기는 것도 세계로 아무것도 보내지 않는다. 그래서 아무리
// 움직여도 세계에는 흔적이 남지 않는다.

/** 지금 고른 종류. 관찰에서 사라지면 지운다 — 다른 것을 대신 고르지 않는다 */
let selectedKind: string | null = null;

/**
 * 지금 고른 **장비 자리** (V-012) — 가방의 고르기와 **동시에 서지 않는다.**
 *
 * 상세 구획이 하나이기 때문이다. 둘을 동시에 고를 수 있게 하면 "지금 무엇의 행동을
 * 보고 있는가" 가 화면에서 사라지고, 실행 키 하나가 어느 쪽을 가리키는지 알 수 없게 된다
 * (UX 문서 §2.2 의 `SELECTED ITEM` 도 하나다).
 */
let selectedSlotId: string | null = null;

/** 지금 자판이 가리키는 행동 줄 */
let focusedActionId: string | null = null;

/**
 * 지금 초점이 가 있는 **칸** (V-004) — 줄에 초점이 있으면 없다.
 *
 * 칸을 한 번 눌러 고른 사람은 아직 행동을 고른 것이 아니다. 그때 초점을 첫 행동
 * 줄로 옮겨 버리면 "고르기" 와 "행동 목록에 들어가기" 가 한 손짓이 되고, 오른
 * 단추가 할 일이 사라진다 (UX 문서 §4.1 은 그 둘을 다른 손짓으로 둔다).
 */
let focusedCellId: string | null = null;

/**
 * 확인을 기다리는 되돌릴 수 없는 요청 (V-002) — **아직 아무것도 보내지 않았다.**
 *
 * 이것이 있는 동안 표면에 확인 구획이 서고, Enter 는 그 구획의 답을 실행한다.
 * 그만두면 이 값만 사라지고 세계에는 흔적이 남지 않는다.
 */
let confirming: { kind: string; actionId: string } | null = null;

/** 확인 구획에서 지금 고른 답. **기본은 그만두기다** — 되돌릴 수 없는 것의 기본값은 하지 않는 것이다 */
let confirmChoice: 'commit' | 'cancel' = 'cancel';

/**
 * 바꿔 걸 물건을 짚어 두고 **자리를 기다리는 중** (V-012) — 아직 아무것도 보내지 않았다.
 *
 * 바꿔 걸기는 세 걸음이다: 무엇을 → 어느 자리에 → 건다. 두 걸음째가 화면에 없어서
 * 이 표면이 그 손을 미뤄 두고 있었다 (기존 `NOT_EXECUTABLE_HERE`). 장비 구획이
 * 서면서 그 걸음이 생겼고, 도중에 그만두어도 세계는 흔들리지 않는다.
 */
let exchanging: string | null = null;

/**
 * 보냈고 아직 대답이 오지 않은 요청들 — 표식으로 짚는다 (C009).
 *
 * `since` 는 **보낸 그 순간**이다 (V-007). 기다림을 곧바로 그리지 않고 늦을 때만
 * 그리려면 언제부터 기다렸는지를 알아야 하며, 이 자리는 자기가 보냈으므로 그것을
 * 정확히 안다 (기술 쪽은 결과만 내려와서 처음 본 순간으로 대신한다).
 *
 * `target` 은 **그 칸의 id** 다 (`item.<종류>` · `slot.<자리>`). 종류 하나로는 장비 자리를
 * 가리킬 수 없고(자리는 종류가 아니다), 칸 id 는 이미 둘을 가르는 열쇠다 (V-012).
 */
const pending = createPendingRequests<{ target: string; actionId: string; since: number }>();

/**
 * 마지막으로 이 표면을 지은 관찰 — **겪는 사람이 지금 보고 있는 바로 그것**이다.
 *
 * 손가락 규칙(bindings.ts)은 SceneState 만 받는데, 그것은 이미 표시 지시로 옮겨진
 * 뒤라 원래의 관찰을 담고 있지 않다. 그래서 여기서 쥔다 — 조립 루트가 프레임마다
 * 표면을 먼저 짓고 그 다음에 키를 처리하므로, 이 값은 언제나 그 프레임의 것이다.
 *
 * 관찰을 **읽기만** 한다. 여기에 쌓이는 상태는 없다.
 */
let observed: GameViewSnapshot | null = null;

/** 지금 보고 있는 관찰 — 손가락 규칙이 요청을 고를 때 읽는다 */
export function observedNow(): GameViewSnapshot | null {
  return observed;
}

/** 검증용 — 지금 무엇을 골라 두었는가 */
export function workspaceSelection(): string | null {
  return selectedKind;
}

/** 검증용 — 지금 고른 장비 자리 (V-012). 가방을 골랐으면 null */
export function workspaceSlotSelection(): string | null {
  return selectedSlotId;
}

/** 검증용 — 지금 어느 줄에 초점이 있는가 */
export function workspaceFocus(): string | null {
  return focusedActionId;
}

/** 검증용 — 지금 어느 칸에 초점이 있는가 */
export function workspaceCellFocus(): string | null {
  return focusedCellId;
}

/** 검증용 — 지금 무엇을 바꿔 걸 자리를 고르는 중인가 (종류). 아니면 null */
export function workspaceExchanging(): string | null {
  return exchanging;
}

/** 검증용 — 지금 무엇의 확인을 기다리는가 (종류). 기다리는 것이 없으면 null */
export function workspaceConfirming(): string | null {
  return confirming?.kind ?? null;
}

/** 검증용 — 확인 구획에서 지금 고른 답 */
export function workspaceConfirmChoice(): 'commit' | 'cancel' {
  return confirmChoice;
}

/** 검증용 — 지금 기다리는 요청이 몇인가 */
export function workspacePendingCount(): number {
  return pending.size();
}

/** 검증용·이어짐 끊김용 — 전부 비운다 */
export function resetWorkspace(): void {
  selectedKind = null;
  selectedSlotId = null;
  focusedActionId = null;
  focusedCellId = null;
  confirming = null;
  exchanging = null;
  confirmChoice = 'cancel';
  observed = null;
  pending.clear();
  resetView();
  resetFresh();
}

// ── 조작 ─────────────────────────────────────────────────────────────

function items(snapshot: GameViewSnapshot): InventoryItemView[] {
  return snapshot.inventory ?? [];
}

/** 고른 항목 — 관찰에 없으면 없다 (고르기가 관찰을 따라간다) */
function selectedItem(snapshot: GameViewSnapshot): InventoryItemView | undefined {
  if (selectedKind === null) return undefined;
  return items(snapshot).find((entry) => entry.kind === selectedKind);
}

/** 걸어 둔 자리 전부 — **빈 자리도 실려 온다** (04 equipment) */
function slots(snapshot: GameViewSnapshot): EquipmentSlotView[] {
  return snapshot.equipment ?? [];
}

/** 고른 장비 자리 — 관찰에 없으면 없다 (가방과 같은 규칙이다) */
function selectedSlot(snapshot: GameViewSnapshot): EquipmentSlotView | undefined {
  if (selectedSlotId === null) return undefined;
  return slots(snapshot).find((slot) => slot.slotId === selectedSlotId);
}

/**
 * 지금 고른 것의 **행동 줄들** — 가방의 항목이든 장비의 자리든 하나로 본다.
 *
 * 둘을 가르는 것은 무엇을 골랐는가뿐이고, 그 뒤의 일(초점 옮기기 · 실행 · 기다림)은
 * 전부 같다. 그래서 이 아래로는 갈래가 없다.
 */
function selectedActions(snapshot: GameViewSnapshot): readonly ItemActionView[] {
  return selectedItem(snapshot)?.actions ?? selectedSlot(snapshot)?.actions ?? [];
}

/** 지금 고른 것을 가리키는 **칸 id** — 기다림의 열쇠이자 초점의 자리다 */
function selectedTarget(): string | null {
  if (selectedKind !== null) return `item.${selectedKind}`;
  if (selectedSlotId !== null) return `slot.${selectedSlotId}`;
  return null;
}

/**
 * 고른 것이 관찰에서 사라졌으면 지운다. **다른 것을 대신 고르지 않는다** —
 * 그것은 겪는 사람이 고르지 않은 것을 고른 것으로 만드는 일이다 (04 workspace.selection).
 */
function reconcileSelection(snapshot: GameViewSnapshot): void {
  // 확인을 기다리던 것이 관찰에서 사라졌거나 세계가 더는 된다고 하지 않으면 확인도 사라진다.
  // 남겨 두면 Enter 하나가 **세계가 지금 거절하는 것**을 보내게 된다 (V-002).
  if (confirming !== null) {
    const armed = items(snapshot).find((entry) => entry.kind === confirming!.kind);
    const action = armed?.actions.find((a) => a.id === confirming!.actionId);
    if (!action || !action.available) confirming = null;
  }
  // 바꿔 걸 물건이 관찰에서 사라졌거나 세계가 더는 된다고 하지 않으면 자리 고르기도
  // 사라진다 — 남겨 두면 줄 하나가 **세계가 지금 거절하는 것**을 보내게 된다 (V-002 와 같은 규칙)
  if (exchanging !== null) {
    const held = items(snapshot).find((entry) => entry.kind === exchanging);
    const action = held?.actions.find((a) => a.role === 'exchange-item');
    if (!action || !action.available) exchanging = null;
  }
  if (selectedKind !== null && selectedItem(snapshot) === undefined) {
    selectedKind = null;
    focusedActionId = null;
    confirming = null;
    return;
  }
  // 장비 자리도 같은 규칙이다 — 세계가 자리를 거두면 고르기도 사라진다.
  // 자리가 **비는 것**은 사라지는 것이 아니다: 빈 자리도 관찰에 실려 오므로
  // 풀고 난 뒤에도 그 자리를 계속 보고 있게 된다 (V-012)
  if (selectedSlotId !== null && selectedSlot(snapshot) === undefined) {
    selectedSlotId = null;
    focusedActionId = null;
    return;
  }
  const actions = selectedActions(snapshot);
  if (actions.length === 0) return;
  // 초점이 가리키던 줄이 사라졌으면(행동 목록이 바뀌었으면) 첫 줄로 되돌린다
  if (focusedActionId !== null && !actions.some((a) => a.id === focusedActionId)) {
    focusedActionId = actions[0]?.id ?? null;
  }
}

/** 지닌 것 사이에서 고르기를 옮긴다 — 세계로 아무것도 나가지 않는다 */
export function moveSelection(snapshot: GameViewSnapshot, delta: number): void {
  // 확인이 떠 있는 동안 이 축은 **그만두기**다 (안내 줄이 그렇게 말한다). 고르기가
  // 함께 움직이면 그만둔 자리와 서 있는 자리가 달라져 무엇을 그만두었는지 흐려진다
  if (confirming !== null) {
    confirming = null;
    return;
  }
  // 자리를 고르는 중이면 이 축도 **그만두기**다 — 확인과 같은 규칙이다
  if (exchanging !== null) {
    exchanging = null;
    return;
  }
  // 장비 자리를 골라 두었으면 **그 축 안에서** 걷는다 (V-012). 두 축을 한 줄로
  // 이으면 가방 끝에서 장비로 넘어가는데, 그 순간 ← → 가 "지닌 것 사이를 고른다" 가
  // 아니게 되고 자리 여섯이 목록 뒤에 매달린 것처럼 읽힌다. 축을 옮기는 것은
  // 고르는 일이지 걷는 일이 아니다 — 칸을 눌러 옮긴다
  if (selectedSlotId !== null) {
    const ids = slots(snapshot).map((slot) => slot.slotId);
    const nextSlot = moveFocus(ids, selectedSlotId, delta);
    if (nextSlot === undefined || nextSlot === selectedSlotId) return;
    selectedSlotId = nextSlot;
    focusedCellId = null;
    focusedActionId =
      slots(snapshot).find((s) => s.slotId === nextSlot)?.actions[0]?.id ?? null;
    return;
  }
  // **화면에 선 차례대로** 걷는다 (V-008) — 걸러진 것은 지나가지 않는다.
  // 칸을 그리는 자리와 같은 함수를 부르므로 둘이 어긋날 자리가 없다
  const kinds = visibleItems(items(snapshot)).map((entry) => entry.kind);
  const next = moveFocus(kinds, selectedKind ?? undefined, delta);
  if (next === undefined) {
    selectedKind = null;
    focusedActionId = null;
    return;
  }
  focusedCellId = null;
  if (next !== selectedKind) {
    selectedKind = next;
    // 물건을 바꾸면 초점은 그 물건의 첫 줄로 간다 — 남아 있으면 다른 물건의 줄을 가리킨다
    focusedActionId = items(snapshot).find((e) => e.kind === next)?.actions[0]?.id ?? null;
  }
}

/** 고른 것의 행동 줄 사이에서 초점을 옮긴다 */
export function moveActionFocus(snapshot: GameViewSnapshot, delta: number): void {
  // 확인이 떠 있는 동안 이 축은 두 답 사이를 오간다 — 줄이 둘뿐이므로 어느 쪽으로 밀든
  // 반대편으로 간다
  if (confirming !== null) {
    if (delta !== 0) confirmChoice = confirmChoice === 'commit' ? 'cancel' : 'commit';
    return;
  }
  // 자리를 고르는 중이면 이 축은 **자리들 사이**를 걷는다 — 그만두는 줄도 그 목록에 있다
  if (exchanging !== null) {
    const ids = exchangeRowIds(snapshot);
    focusedActionId = moveFocus(ids, focusedActionId ?? undefined, delta) ?? null;
    focusedCellId = null;
    return;
  }
  const actions = selectedActions(snapshot);
  if (actions.length === 0) return;
  const ids = actions.map((a) => a.id);
  focusedActionId = moveFocus(ids, focusedActionId ?? undefined, delta) ?? null;
  focusedCellId = null;
}

/**
 * 지금 초점이 있는 행동을 요청한다.
 *
 * **되는지 안 되는지를 여기서 판정하지 않는다** — 계약이 불가로 실어 온 것은 보내지
 * 않을 뿐이고, 그 판단은 세계가 이미 내린 것이다. 보낸 뒤에는 아무것도 미리 바꾸지
 * 않는다 (INTENT-OBSERVATION-IS-THE-ONLY-TRUTH-001).
 *
 * 대답을 기다리는 동안 같은 요청을 다시 보내지 않는다. 두 번 보내면 세계는 두 번
 * 판정하고, 그것이 겪는 사람의 뜻이었던 적이 없다.
 */
/**
 * 이 표면이 지금 실행할 수 있는 **첫 되는 행동** (V-004).
 *
 * 무엇이 그 하나인가는 **세계가 보낸 차례**가 정한다. 화면이 "이 물건은 쓰는 것" 이라고
 * 고르면 그것이 곧 화면이 지어낸 규칙이 된다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH).
 */
function firstExecutable(actions: readonly ItemActionView[]): ItemActionView | undefined {
  return actions.find((a) => a.available && NOT_EXECUTABLE_HERE[a.role] === undefined);
}

/**
 * 이 손이 세계로 나갈 때의 **모양** — 무엇을 싣는지는 역할이 정한다 (04).
 *
 * 여기서 판정하는 것은 하나도 없다. 자리를 가리키는 손과 종류를 가리키는 손이
 * 서로 다른 것을 싣는다는 사실만 옮긴다 — 푸는 요청은 **자리 하나**뿐이고 무엇을
 * 푸는지는 싣지 않으며(04 equipment.actions.unequip-item), 쓰는 손은 걸린 것이든
 * 지닌 것이든 **같은 요청**이다 (겪는 일이 하나이기 때문이다).
 */
function requestFor(
  snapshot: GameViewSnapshot,
  action: ItemActionView,
): ActionRequest | null {
  const slot = selectedSlot(snapshot);
  if (slot) {
    if (action.role === 'unequip-item') {
      return { interactionId: action.id, equipSlotId: slot.slotId };
    }
    return slot.item ? { interactionId: action.id, itemKind: slot.item.kind } : null;
  }
  const entry = selectedItem(snapshot);
  return entry ? { interactionId: action.id, itemKind: entry.kind } : null;
}

export function invokeFocusedAction(
  snapshot: GameViewSnapshot,
  send: (action: ActionRequest) => number | null,
): void {
  // 확인이 떠 있으면 Enter 는 **그 구획의 답**을 실행한다 (V-002).
  // 그만두기는 아무것도 보내지 않는다 — 보내지 않았다는 것이 이 자리의 값어치다
  if (confirming !== null) {
    const armed = confirming;
    const choice = confirmChoice;
    confirming = null;
    confirmChoice = 'cancel';
    if (choice !== 'commit') return;
    // 확인을 누른 그 순간의 관찰로 다시 본다 — 사이에 세계가 바뀌었을 수 있다
    const target = items(snapshot).find((e) => e.kind === armed.kind);
    const action = target?.actions.find((a) => a.id === armed.actionId);
    if (!target || !action || !action.available) return;
    const armedTarget = `item.${target.kind}`;
    if (pending.waiting((w) => w.target === armedTarget && w.actionId === action.id)) return;
    const commit = send({ interactionId: action.id, itemKind: target.kind });
    pending.add(commit, { target: armedTarget, actionId: action.id, since: performance.now() });
    return;
  }

  // 자리를 고르는 중이면 Enter 는 **초점이 가리키는 자리**를 고른다 (V-012)
  if (exchanging !== null) {
    const rowId = focusedActionId;
    if (rowId === EXCHANGE_CANCEL_ID || rowId === null) {
      exchanging = null;
      return;
    }
    if (!rowId.startsWith(EXCHANGE_ROW_PREFIX)) return;
    commitExchange(snapshot, rowId.slice(EXCHANGE_ROW_PREFIX.length), send);
    return;
  }

  const actions = selectedActions(snapshot);
  const target = selectedTarget();
  if (actions.length === 0 || target === null) return;
  // 줄에 초점이 있으면 그 줄이고, **칸에 초점이 있으면 첫 되는 행동**이다 (V-004).
  // 손가락으로 골라 두고 자판으로 실행하는 손이 여기서 끊기지 않는다 —
  // 두 번 누름이 지나는 길도 바로 이 자리다 (UX 문서 §4.1 하나의 의미, 여러 입력).
  const action =
    focusedActionId === null
      ? firstExecutable(actions)
      : actions.find((a) => a.id === focusedActionId);
  if (!action || !action.available) return;
  // 실행한 줄로 초점이 옮겨 간다 — 기다림도 사유도 그 줄에 뜬다
  focusedActionId = action.id;
  focusedCellId = null;
  // 이 표면이 실행하지 않기로 한 역할은 보내지 않는다 (감추지는 않는다)
  if (NOT_EXECUTABLE_HERE[action.role] !== undefined) return;
  if (pending.waiting((w) => w.target === target && w.actionId === action.id)) return;

  // 바꿔 걸기는 **자리를 받아야 성립한다** (V-012) — 여기서 나가지 않고 자리 고르는
  // 구획을 세운다. 아직 아무것도 보내지 않았으므로 그만두어도 세계는 흔들리지 않는다
  if (action.role === 'exchange-item' && selectedKind !== null) {
    exchanging = selectedKind;
    return;
  }

  // 되돌릴 수 없는 것은 여기서 나가지 않는다 — 확인을 세우고 멈춘다 (UX 문서 §7).
  // 지금 그 역할은 가방에만 있다 (덜어내기) — 자리를 골라 둔 채로는 설 일이 없다
  if (CONFIRM_REQUIRED.has(action.role) && selectedKind !== null) {
    confirming = { kind: selectedKind, actionId: action.id };
    confirmChoice = 'cancel';
    return;
  }

  const request = requestFor(snapshot, action);
  if (!request) return;
  const mark = send(request);
  pending.add(mark, { target, actionId: action.id, since: performance.now() });
}

// ── 손가락 (V-004) ───────────────────────────────────────────────────
//
// 기반은 눌린 것의 id 만 돌려준다 (`engine/view-kernel/hud/surface.ts`). 그 소식들이
// 무슨 뜻인지는 여기서 정한다 — UX 문서 §4.1 의 세 손짓이 그 뜻이다.
//
//     한 번 누름    고른다 (그것뿐이다 — 행동 목록으로 들어가지 않는다)
//     두 번 누름    되는 행동 하나를 실행한다
//     오른 단추     그 물건의 행동 목록을 연다 (초점이 줄로 들어간다)
//
// **되는지 안 되는지는 여전히 판정하지 않는다.** 실행은 자판의 Enter 와 **같은 길**을
// 지나므로 되돌릴 수 없는 것에는 확인이 그대로 선다 (V-002).

/** 그 칸이 무엇의 칸인가 — 빈 자리는 종류가 없다 (세계에 번호 붙은 빈 자리가 없다) */
function cellKind(cellId: string): string | undefined {
  return cellId.startsWith('item.') ? cellId.slice('item.'.length) : undefined;
}

/**
 * 그 칸이 어느 **장비 자리**의 칸인가 (V-012).
 *
 * 가방의 빈 칸과 다르다 — 장비의 빈 자리는 세계가 준 이름(`slotId`)을 지니므로
 * 비어 있어도 짚을 수 있다. 화면이 주소를 지어내는 것이 아니라 세계의 것을 그대로 쓴다.
 */
function cellSlot(cellId: string): string | undefined {
  return cellId.startsWith('slot.') ? cellId.slice('slot.'.length) : undefined;
}

/** 이 표면의 것인가 — 다른 표면의 눌림은 이 파일의 것이 아니다 */
function mine(surfaceId: string): GameViewSnapshot | null {
  if (surfaceId !== INVENTORY_SURFACE_ID) return null;
  return observed;
}

/**
 * 칸을 한 번 눌렀다 — **고른다.**
 *
 * 빈 자리를 눌러도 아무 일이 없다. 그 칸들은 서로 구별되지 않고 요청의 대상이
 * 되지 않는다 (INTENT-EMPTY-ROOM-HAS-NO-ADDRESS-001) — 화면이 그 자리에 뜻을
 * 만들어 내면 세계에 없는 주소가 생긴다.
 *
 * **고른 것이 바뀌었는지를 낸다.** 두 번 누름과 목록 청함이 이 값을 보고 멈춘다 —
 * 거절된 칸에서 그냥 지나가면 직전에 고른 것이 그 손짓의 대상이 되어 버린다.
 */
export function pickCell(surfaceId: string, cellId: string): boolean {
  const snapshot = mine(surfaceId);
  if (!snapshot) return false;
  // 도구 띠의 칸은 **고르는 칸이 아니다** (V-008) — 무엇을 볼지를 바꿀 뿐이므로
  // 고른 것도 초점도 건드리지 않고, 거짓을 내어 두 번 누름·목록 청함이 여기서 멈춘다
  if (applyViewCell(cellId)) return false;

  // 장비 자리 — **비어 있어도 고른다** (V-012). 빈 자리를 고르면 "여기에 왜 아무것도
  // 걸 수 없는가" 를 세계가 준 사유로 읽는다. 가방의 빈 칸과 다른 것은 이 자리에
  // 세계가 준 이름이 있기 때문이다
  const slotId = cellSlot(cellId);
  if (slotId !== undefined) {
    if (!slots(snapshot).some((slot) => slot.slotId === slotId)) return false;
    confirming = null;
    selectedKind = null;
    selectedSlotId = slotId;
    focusedActionId = null;
    focusedCellId = cellId;
    return true;
  }

  const kind = cellKind(cellId);
  if (kind === undefined) return false;
  if (!items(snapshot).some((e) => e.kind === kind)) return false;
  // 다른 것을 고르는 것은 그만두는 것이다 — 방향키와 같은 규칙이다 (V-002)
  confirming = null;
  selectedKind = kind;
  selectedSlotId = null;
  focusedActionId = null;
  focusedCellId = cellId;
  return true;
}

/**
 * 칸을 두 번 눌렀다 — **되는 행동 하나를 실행한다.**
 *
 * 무엇이 그 하나인가는 **세계가 보낸 차례**가 정한다. 화면이 "이 물건은 쓰는 것"
 * 이라고 고르면 그것이 곧 화면이 지어낸 규칙이 된다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH).
 * 되는 것이 하나도 없으면 아무 일도 일어나지 않는다 — 사유는 줄에 이미 서 있다.
 */
export function commitCell(
  surfaceId: string,
  cellId: string,
  send: (action: ActionRequest) => number | null,
): void {
  const snapshot = mine(surfaceId);
  if (!snapshot) return;
  // **고르지 못한 칸에서는 아무 일도 일어나지 않는다.** 여기서 그냥 지나가면 고른 것이
  // 직전 것으로 남아, 빈 자리를 두 번 누른 손이 **다른 물건의 행동**을 실행한다
  if (!pickCell(surfaceId, cellId)) return;
  // **자판의 Enter 와 같은 함수다.** 고른 칸에 초점이 있으므로 첫 되는 행동이 나가고,
  // 되돌릴 수 없는 것에는 확인이 그대로 선다 (V-002). 되는 것이 하나도 없으면
  // 아무 일도 일어나지 않는다 — 사유는 줄에 이미 서 있다
  invokeFocusedAction(snapshot, send);
}

/**
 * 글자 받는 자리에 쳐 넣었다 — **찾는 말이 된다.**
 *
 * 조립은 이 글자가 무엇인지 모르고 (`app/main.ts` 는 id 와 글자를 넘길 뿐이다),
 * 기반은 그것을 쥐지도 않는다. 무엇이 될지 정하는 자리가 여기 하나다.
 */
export function typeInto(surfaceId: string, fieldId: string, text: string): void {
  // 관찰을 묻지 않는다 — 찾는 말은 **겪는 사람 쪽 상태**이고, 세계가 아직 아무것도
  // 보내지 않았어도 칠 수는 있다 (다른 손짓들은 관찰의 칸을 짚으므로 관찰이 필요하다)
  if (surfaceId !== INVENTORY_SURFACE_ID) return;
  if (fieldId !== SEARCH_FIELD_ID) return;
  setSearch(text);
  // 찾는 말이 바뀌면 고른 것이 목록 밖으로 나갈 수 있다. **그래도 지우지 않는다** —
  // 고른 것은 겪는 사람이 고른 것이고, 보이지 않게 되었다는 것과 고르기를 그만두었다는
  // 것은 다른 일이다 (04 workspace.selection 과 같은 자세).
}

/**
 * 칸에서 목록을 청했다 (오른 단추) — **행동 목록을 연다.**
 *
 * 줄은 이미 상세 구획에 서 있으므로 새로 여는 창이 없다. 여는 것은 **초점**이다 —
 * 이 손짓 뒤에는 ↑ ↓ 로 곧바로 행동을 고를 수 있다.
 */
export function menuCell(surfaceId: string, cellId: string): void {
  const snapshot = mine(surfaceId);
  if (!snapshot) return;
  // 고르지 못한 칸에는 열 목록도 없다 (위와 같은 사유)
  if (!pickCell(surfaceId, cellId)) return;
  focusedActionId = selectedActions(snapshot)[0]?.id ?? null;
  focusedCellId = null;
}

/**
 * 줄을 눌렀다 — **그 줄을 실행한다.**
 *
 * 확인이 떠 있으면 눌린 줄이 곧 답이다. 안 되는 줄을 눌러도 아무것도 나가지 않는다
 * (`invokeFocusedAction` 이 그것을 이미 안다 — 여기서 다시 판정하지 않는다).
 */
export function pressRow(
  surfaceId: string,
  rowId: string,
  send: (action: ActionRequest) => number | null,
): void {
  // **다른 표면의 줄도 이 문으로 들어온다.** 조립(`content/active-view.ts`)이 표면
  // 손짓의 수신자로 이 모듈 하나를 이름 지어 두었기 때문이다 — 표면이 둘이 된 지금
  // 그 이름이 좁다 (V-018 REPORT ①). 여기서는 갈라 보내는 일만 한다
  if (surfaceId === EXECUTION_LOG_SURFACE_ID) {
    pickLogEntry(rowId);
    return;
  }
  const snapshot = mine(surfaceId);
  if (!snapshot) return;
  if (confirming !== null) {
    if (rowId === CONFIRM_COMMIT_ID) confirmChoice = 'commit';
    else if (rowId === CONFIRM_CANCEL_ID) confirmChoice = 'cancel';
    else return; // 확인이 떠 있는 동안 다른 줄은 듣지 않는다
    invokeFocusedAction(snapshot, send);
    return;
  }
  // 자리를 고르는 중이면 **눌린 줄이 곧 그 자리**다 (V-012)
  if (exchanging !== null) {
    if (rowId === EXCHANGE_CANCEL_ID) {
      exchanging = null;
      return;
    }
    if (!rowId.startsWith(EXCHANGE_ROW_PREFIX)) return;
    commitExchange(snapshot, rowId.slice(EXCHANGE_ROW_PREFIX.length), send);
    return;
  }
  if (!selectedActions(snapshot).some((a) => a.id === rowId)) return;
  focusedActionId = rowId;
  focusedCellId = null;
  invokeFocusedAction(snapshot, send);
}

/**
 * 지름길이 되돌릴 수 없는 것을 짚었다 (V-002) — 곧바로 보내지 않고 **여기로 데려온다.**
 *
 * 두 걸음 지름길(B → 숫자)은 무엇을 짚었는지 화면에 남기지 않는다. 그래서 잘못 누른
 * 숫자 하나가 되돌릴 수 없는 요청이 되어 나갔다. 이제 그 걸음은 작업 공간을 열어
 * 그 물건을 짚고, 무엇이 얼마나 사라지는지 보인 다음 답을 기다린다.
 *
 * **판정하지 않는다.** 세계가 그 손을 불가로 실어 왔으면 확인을 세우지 않는다 —
 * 그 자리에는 세계가 준 사유가 이미 줄로 서 있고, 사람은 그것을 읽는다.
 */
export function armDiscardConfirm(kind: string): void {
  const snapshot = observed;
  if (!snapshot) return;
  const entry = items(snapshot).find((e) => e.kind === kind);
  if (!entry) return;

  selectedKind = kind;
  selectedSlotId = null;
  focusedCellId = null;
  const action = entry.actions.find((a) => CONFIRM_REQUIRED.has(a.role));
  focusedActionId = action?.id ?? entry.actions[0]?.id ?? null;
  confirming =
    action &&
    action.available &&
    !pending.waiting((w) => w.target === `item.${kind}` && w.actionId === action.id)
      ? { kind, actionId: action.id }
      : null;
  confirmChoice = 'cancel';
  openSurface(INVENTORY_SURFACE_ID);
}

/**
 * 세계의 대답 하나를 받아 그 기다림을 푼다 (C009 Request.Outcome).
 *
 * **표식 없는 대답은 건드리지 않는다.** 이 표면의 요청은 언제나 표식을 달고 나가므로,
 * 표식 없는 대답은 다른 자리(명령 표면)의 것이다. 여기서 집어 가면 그쪽 기록이
 * 영영 대답을 못 받는다.
 *
 * 이 표면의 것이었으면 참을 낸다 — 조립 루트가 그것으로 대답을 나눈다.
 */
export function settleOutcome(mark: number | undefined): boolean {
  if (mark === undefined) return false;
  return pending.resolve(mark) !== undefined;
}

/**
 * 기다리던 것을 전부 잊는다 — 이어짐이 끊겨 대답이 영영 오지 않게 된 자리.
 *
 * 잊지 않으면 "보냈다" 가 화면에 영영 남고, 그 줄은 다시 눌러도 아무 일이 일어나지
 * 않는다 (같은 요청을 두 번 보내지 않기 때문이다).
 */
export function forgetPending(): void {
  pending.clear();
}

// ── 표면 짓기 ────────────────────────────────────────────────────────

/**
 * 칸의 곁말 — **고르지 않고도 읽는 것** (UX 문서 §8 · V-011).
 *
 * 지어내는 것이 하나도 없다. 분류는 거르는 칸이 쓰는 그 이름이고, 되는지 안 되는지는
 * 세계가 이미 `available` 로 말해 둔 것이며, 사유도 세계가 보낸 코드의 짧은 말이다
 * (DC-WORLD-OWNS-THE-SURFACE-LIST).
 *
 * 아래 행동 줄과 겹치지 않는가 — 겹치지 않는다. 그 줄들은 **고른 뒤**에 서고,
 * 이 곁말은 고르기 전에 선다. 무엇을 고를지 정하는 자리가 바로 여기다.
 */
function itemTip(
  entry: InventoryItemView,
  shortText: (code: string) => string,
): readonly string[] {
  const lines = [categoryLabel(entry.category)];
  const doable = entry.actions
    .filter((action) => action.available)
    .map((action) => ACTION_LABEL[action.role] ?? action.role);
  if (doable.length > 0) {
    lines.push(`할 수 있다: ${doable.join(' · ')}`);
    return lines;
  }
  // 아무것도 되지 않는다면 **왜 안 되는지**가 이 자리의 값어치다.
  // 같은 사유가 여러 줄에 되풀이되지 않게 한 번씩만 세운다
  const reasons: string[] = [];
  for (const action of entry.actions) {
    const reason = action.unavailableReason ? shortText(action.unavailableReason) : '안 됨';
    const label = ACTION_LABEL[action.role] ?? action.role;
    const line = `${label} — ${reason}`;
    if (!reasons.includes(line)) reasons.push(line);
  }
  lines.push(...reasons);
  return lines;
}

function itemCells(
  shown: readonly InventoryItemView[],
  /** 지닌 것 **전부** — 번호는 걸러지기 전의 차례에서 온다 (아래) */
  all: readonly InventoryItemView[],
  text: (code: string) => string,
  shortText: (code: string) => string,
): SceneSurfaceCell[] {
  // 명암이 견주는 기준은 **지금 목록 안에서 가장 많은 것**이다 (V-010).
  // "몇 개부터 많은 것인가" 를 화면이 정하면, 세계가 겹침 한도를 바꿀 때마다 화면이
  // 거짓말을 하게 된다 (기술 띠의 넓이 막대가 같은 규칙으로 선다 — skill-presentation).
  const most = Math.max(0, ...shown.map((entry) => entry.count));
  // 부르는 번호 (V-013) — **보이는 차례가 아니라 세계가 준 차례**다.
  //
  // 이 구분이 이 작업의 전부다. 거르고 정렬하면 칸이 서는 자리는 바뀌지만 지름길이
  // 세는 차례는 그대로다 (지름길은 이 표면을 보지 않는다). 보이는 자리로 번호를
  // 매기면 걸러진 화면에서 `B → 2` 가 눈에 보이는 둘째가 아닌 것을 짚는다 —
  // 그리고 그것을 아는 방법은 눌러 보는 것뿐이다.
  const slotKeys = inventorySlotKeys(all);
  return shown.map((entry) => {
    const icon = CATEGORY_ICON[entry.category];
    const key = slotKeys.get(entry.kind);
    const name = itemName(entry.kind, text);
    return {
      id: `item.${entry.kind}`,
      // 번호가 이름 앞에 선다 — 위쪽 소지품 띠가 이미 `1. 곡괭이` 로 적는 그 꼴이다.
      // 아홉을 넘는 것에는 번호가 없고, 그때는 이름만 선다 (없는 자리를 짓지 않는다)
      text: [key ? `${key}.` : '', icon, name].filter(Boolean).join(' '),
      // 수량은 **숫자와 명암을 함께** 쓴다 — 색만으로 구분하지 않는다 (문서 §3)
      detail: `×${entry.count}`,
      ...(most > 0 ? { level: entry.count / most } : {}),
      // 새로 온 것 — 상세를 보면(고르면) 사라지는 화면의 상태다
      ...(isFresh(entry.kind) ? { badge: 'NEW' } : {}),
      // 고르기 전에 읽는 곁말 — 손을 얹어도, 초점이 닿아도 같은 것이 열린다
      tip: itemTip(entry, shortText),
      empty: false,
      selected: entry.kind === selectedKind,
    };
  });
}

/**
 * 장비 자리의 곁말 — 걸린 것이 무엇을 주고 있는지, 지금 무엇이 되는지 (V-011 과 같은 꼴).
 *
 * 빈 자리에는 곁말이 없다. 없는 것이 스스로를 말할 수는 없고, 그 자리의 사유는
 * 골랐을 때 행동 줄이 말한다.
 */
function slotTip(
  slot: EquipmentSlotView,
  text: (code: string) => string,
  shortText: (code: string) => string,
): readonly string[] | undefined {
  if (!slot.item) return undefined;
  const lines: string[] = [];
  // 보태고 있는 값은 **여기 없다** — 같은 글자가 이미 곁글자로 서 있고, 같은 것을 두 번
  // 읽어 주면 목록이 길어지기만 한다 (V-010 이 명암에 내린 것과 같은 판단이다)
  //
  // 걸어서 몸에 생긴 용도 — "왜 캘 수 있게 되었는가" 를 읽는 자리다
  if (slot.grants.length > 0) lines.push(slot.grants.map((g) => text(`use.${g}`)).join(' · '));
  const doable = slot.actions
    .filter((action) => action.available)
    .map((action) => ACTION_LABEL[action.role] ?? action.role);
  if (doable.length > 0) lines.push(`할 수 있다: ${doable.join(' · ')}`);
  else {
    for (const action of slot.actions) {
      const reason = action.unavailableReason ? shortText(action.unavailableReason) : '안 됨';
      lines.push(`${ACTION_LABEL[action.role] ?? action.role} — ${reason}`);
    }
  }
  return lines.length > 0 ? lines : undefined;
}

/**
 * 걸어 둔 자리들 — **여섯 전부, 빈 자리도** (V-012).
 *
 * 빈 자리를 감추면 "여기 걸 수 있다" 를 사람이 알 길이 없다 (self 패널이 같은 이유로
 * 같은 판단을 했다). 자리의 차례도 이름도 화면이 만들지 않는다 — 세계가 준 목록
 * 그대로이며, 세계가 자리를 늘리면 칸이 늘 뿐 이 함수는 바뀌지 않는다.
 */
function slotCells(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
  shortText: (code: string) => string,
): SceneSurfaceCell[] {
  // 부르는 번호는 **걸린 자리에만** 있다 (V-014) — 빈 자리는 푸는 일이 없으므로
  // 부를 일도 없다. 번호를 매기는 자리는 하나다 (equipment-presentation)
  const keys = equipmentSlotKeys(slots(snapshot));
  return slots(snapshot).map((slot) => {
    const id = `slot.${slot.slotId}`;
    const selected = slot.slotId === selectedSlotId;
    if (!slot.item) return { id, text: '', empty: true, selected };
    const icon = CATEGORY_ICON[slot.item.category];
    const name = itemName(slot.item.kind, text);
    const gain = contributionText(slot, text);
    const key = keys.get(slot.slotId);
    return {
      id,
      text: [key ? `${key}.` : '', icon, name].filter(Boolean).join(' '),
      // 곁글자는 **지금 몸에 보태고 있는 것**이다 — 예측이 아니라 일어나 있는 일이다
      ...(gain ? { detail: gain } : {}),
      ...(slotTip(slot, text, shortText) ? { tip: slotTip(slot, text, shortText)! } : {}),
      empty: false,
      selected,
    };
  });
}

/**
 * 남은 자리 — 세계가 준 두 수의 차만큼이다. **화면이 세지 않는다.**
 *
 * 이 칸들은 서로 구별되지 않고 요청의 대상이 되지 않는다 — 세계에 번호 붙은 빈 자리가
 * 없기 때문이다 (INTENT-EMPTY-ROOM-HAS-NO-ADDRESS-001).
 */
function roomCells(snapshot: GameViewSnapshot): SceneSurfaceCell[] {
  const room = snapshot.inventoryRoom;
  if (!room) return [];
  const left = Math.max(0, room.capacity - room.used);
  return Array.from({ length: left }, (_, i) => ({
    id: `room.${i}`,
    text: '',
    empty: true,
    selected: false,
  }));
}

/**
 * 상세 구획의 제목 — **지금 무엇을 보고 있는가.**
 *
 * 자리를 부르는 번호는 **푸는 지름길이 세는 그 번호**다 (V-014). 화면에 뜨는 자리
 * 번호는 이제 이것 하나뿐이며, 빈 자리에는 번호가 없다 — 부를 일이 없기 때문이다.
 * 빈 자리가 여럿이어도 지금 고른 것은 칸의 테두리가 말한다.
 */
function detailTitle(snapshot: GameViewSnapshot, text: (code: string) => string): string {
  const entry = selectedItem(snapshot);
  if (entry) return `고른 것 — ${itemName(entry.kind, text)} ×${entry.count}`;
  const slot = selectedSlot(snapshot);
  if (!slot) return '고른 것';
  if (!slot.item) return '고른 것 — 빈 자리';
  const key = equipmentSlotKeys(slots(snapshot)).get(slot.slotId);
  const name = itemName(slot.item.kind, text);
  return key ? `고른 것 — 자리 ${key} · ${name}` : `고른 것 — ${name}`;
}

function actionRows(
  snapshot: GameViewSnapshot,
  shortText: (code: string) => string,
  now: number,
): SceneSurfaceRow[] {
  // 가방의 항목이든 장비의 자리든 **같은 줄**이 선다 (V-012) — 겪는 사람에게
  // "고른 것으로 지금 무엇을 할 수 있는가" 는 하나의 물음이다
  const actions = selectedActions(snapshot);
  const target = selectedTarget();
  if (actions.length === 0 || target === null) return [];
  return actions.map((action) => {
    const label = ACTION_LABEL[action.role] ?? action.role;
    // 안 되는 것도 목록에서 빠지지 않는다 — 사유를 읽는 것이 이 자리의 값어치다
    if (!action.available) {
      const reason = action.unavailableReason ? shortText(action.unavailableReason) : '안 됨';
      return { id: action.id, text: `${label} — ${reason}`, state: 'blocked' as const };
    }
    // 기다림은 **늦을 때만** 보인다 (V-007 · UX 문서 §7 응답 지연).
    // 늦지 않은 기다림 동안 줄은 그대로 서 있고, 곧 오는 답이 값을 옮기거나 사유를 붙인다.
    // 그동안 다시 눌러도 두 번 나가지 않는다 — 막는 것은 이 표시가 아니라 아래 기다림 표다
    const waiting = pending.values().find((w) => w.target === target && w.actionId === action.id);
    const stage = waitStage(waiting?.since, now);
    if (waiting && stage !== 'silent') {
      return { id: action.id, text: `${label} — ${waitText(stage)}`, state: 'pending' as const };
    }
    // **세계가 된다고 말한 것을 안 된다고 그리지 않는다.** 이 자리에서 그 길이 아직
    // 없을 뿐이며, 그 사정은 화면의 것이지 세계의 판정이 아니다
    const here = NOT_EXECUTABLE_HERE[action.role];
    // 되돌릴 수 없는 손은 누르기 **전에** 그렇다고 말한다 (V-002) — 확인이 뜨고 나서야
    // 알게 되면, 그 확인은 놀람이지 신중함이 아니다
    const hint = here ?? (CONFIRM_REQUIRED.has(action.role) ? '확인이 뜬다' : undefined);
    return {
      id: action.id,
      text: label,
      state: 'available' as const,
      ...(hint ? { hint } : {}),
    };
  });
}

/**
 * 자리 고르기 구획의 줄 id 들 (V-012) — 초점이 걷는 차례이며 그리는 차례와 같다.
 * 그만두기가 **맨 앞**이다: 되돌릴 수 있는 걸음이라 해도 기본 초점은 하지 않는 쪽에 둔다.
 */
function exchangeRowIds(snapshot: GameViewSnapshot): string[] {
  return [EXCHANGE_CANCEL_ID, ...exchangeTargets(snapshot).map((slot) => `${EXCHANGE_ROW_PREFIX}${slot.slotId}`)];
}

/**
 * 바꿔 걸 수 있는 자리 — **걸린 자리만** (V-014).
 *
 * 빈 자리는 여기 없다. 빈 자리에 거는 것은 바꿔 거는 것이 아니라 그냥 **걸기**이고,
 * 그 줄은 이미 상세 구획에 따로 서 있다 (세계도 자리를 싣지 않은 걸기를 받는다).
 * 빈 자리를 여기 세우면 목록이 `빈 자리` 다섯 줄로 채워지는데, 여섯 자리가 서로
 * 완전히 같으므로(04 C023) 그 다섯은 **서로 구별되지 않는 같은 선택**이다.
 *
 * 세계가 판정하는 것도 이것이다 — "이 물건을 **어떤 찬 자리와** 바꿔 걸 수 있는가"
 * (04 C024 available).
 */
function exchangeTargets(snapshot: GameViewSnapshot): EquipmentSlotView[] {
  return slots(snapshot).filter((slot) => slot.item);
}

/**
 * 자리를 골랐다 — **여기서 비로소 세계로 나간다** (V-012).
 *
 * 요청이 싣는 것은 무엇을과 어느 자리 둘이다 (04 — 바꿔 걸기만 자리를 싣는다).
 * 되는지 안 되는지는 여전히 판정하지 않는다: 세계가 짚어 둘 때 된다고 말했고,
 * 그 사이에 바뀌었다면 세계가 사유를 붙여 거절한다.
 */
function commitExchange(
  snapshot: GameViewSnapshot,
  slotId: string,
  send: (action: ActionRequest) => number | null,
): void {
  const kind = exchanging;
  exchanging = null;
  if (kind === null) return;
  if (!slots(snapshot).some((slot) => slot.slotId === slotId)) return;
  const entry = items(snapshot).find((e) => e.kind === kind);
  const action = entry?.actions.find((a) => a.role === 'exchange-item');
  if (!action || !action.available) return;
  // **요청 id 는 걸기의 것이다.** 바꿔 걸기의 `actions[].id` 는 세계에 그 이름의
  // interaction 이 없다 (V-012 REPORT ①) — 자리를 싣는 것이 걸기와 바꿔 걸기를
  // 가르는 전부이므로(04 C024) 걸기의 id 를 그대로 쓰고 자리를 얹는다.
  // 두 걸음 지름길(`view/bindings.ts`)이 이미 같은 자리에서 같은 판단을 했다.
  // **화면이 이름을 짓지 않는다** — 계약이 실어 온 걸기의 id 를 읽어 쓴다
  const equipId = entry?.actions.find((a) => a.role === 'equip-item')?.id;
  if (equipId === undefined) return;
  const target = `item.${kind}`;
  if (pending.waiting((w) => w.target === target && w.actionId === action.id)) return;
  const mark = send({ interactionId: equipId, itemKind: kind, equipSlotId: slotId });
  pending.add(mark, { target, actionId: action.id, since: performance.now() });
}

/**
 * 자리 고르기 구획 (V-012) — **어느 자리에 걸 것인가.**
 *
 * 자리 여섯 전부가 선다. 빈 자리도 고를 수 있다 — 그 자리에 거는 것이 곧 걸기이며,
 * 세계는 두 경우를 같은 요청으로 받는다 (04 equip-item 의 equipSlotId).
 */
function exchangeRows(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
): SceneSurfaceRow[] {
  if (exchanging === null) return [];
  const keys = equipmentSlotKeys(slots(snapshot));
  return [
    { id: EXCHANGE_CANCEL_ID, text: '그만두기', state: 'available' as const },
    ...exchangeTargets(snapshot).map((slot) => {
      const key = keys.get(slot.slotId);
      const name = itemName(slot.item!.kind, text);
      return {
        id: `${EXCHANGE_ROW_PREFIX}${slot.slotId}`,
        // 번호는 푸는 지름길이 세는 그 번호다 (V-014) — 화면의 자리 번호는 하나뿐이다
        text: key ? `자리 ${key} · ${name}` : name,
        state: 'available' as const,
        // 넣기와 빼내기가 한 번에 일어난다 (C024) — 그 사실을 미리 말한다
        hint: '걸린 것과 바뀐다',
      };
    }),
  ];
}

/**
 * 확인 구획 (V-002) — **무엇이 얼마나 사라지는지**를 그 자리에서 말한다.
 *
 * 수량은 지금 관찰의 수량이다. 확인을 세운 순간의 수를 기억해 두지 않는다 — 기다리는
 * 사이에 캐서 늘어났다면 사라지는 것도 늘어난 그만큼이고, 화면은 지금 참인 것만 말한다
 * (INTENT-OBSERVATION-IS-THE-ONLY-TRUTH-001).
 */
function confirmRows(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
): SceneSurfaceRow[] {
  if (confirming === null) return [];
  const entry = items(snapshot).find((e) => e.kind === confirming!.kind);
  if (!entry) return [];
  const label = ACTION_LABEL[
    entry.actions.find((a) => a.id === confirming!.actionId)?.role ?? ''
  ] ?? '실행';
  return [
    {
      id: CONFIRM_COMMIT_ID,
      text: `${label} — ${itemName(entry.kind, text)} ×${entry.count} · 모두 사라진다`,
      state: 'available' as const,
    },
    {
      // 그만두기에는 상태 표식을 달지 않는다 — 하지 않는 것은 되고 안 되고의 일이
      // 아니다. 표식이 둘 다 ✓ 면 어느 쪽이 무엇을 하는 줄인지 흐려진다
      id: CONFIRM_CANCEL_ID,
      text: '그만둔다 — 세계로 아무것도 나가지 않는다',
    },
  ];
}

/**
 * 지금 이 순간의 소지품 작업 공간.
 *
 * 열려 있지 않아도 만든다 — 열림은 표면 자신이 지닌 값이고, 그리는 쪽이 그것을 보고
 * 감춘다 (engine/view-kernel/hud/surface.ts).
 */
export function inventoryWorkspace(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
  shortText: (code: string) => string,
  now: number = performance.now(),
): SceneSurface {
  observed = snapshot;
  reconcileSelection(snapshot);
  // 무엇이 새로 왔는가 — 표면이 닫혀 있어도 센다. 열었을 때 그동안 얻은 것에
  // 표식이 붙어 있어야 하며, 닫혀 있는 동안 얻은 것이야말로 못 본 것이다
  noteObserved(items(snapshot).map((entry) => entry.kind));

  const open = surfaceIsOpen(INVENTORY_SURFACE_ID);
  // 닫히면 확인도 사라진다 — 보이지 않는 확인은 확인이 아니다. 닫는 길(Esc · ✕)이
  // 곧 그만두는 길이며, 그 길로도 세계에는 아무것도 나가지 않는다
  if (!open) confirming = null;

  const room = snapshot.inventoryRoom;
  const left = room ? Math.max(0, room.capacity - room.used) : 0;
  const full = room ? room.used >= room.capacity : false;
  const entry = selectedItem(snapshot);
  // 고른 것이 곧 **상세를 본 것**이다 — 고르면 그 물건의 행동 줄이 아래에 선다.
  // 열려 있을 때만이다: 닫힌 표면의 남은 고르기는 아무도 보지 않았다
  if (open && entry) markSeen(entry.kind);
  // 보이는 목록과 지닌 것 전부는 **다른 수**다 (V-008 · 문서 §6). 걸러도 지닌 것은
  // 줄지 않으므로 아래 자리 구획은 이 값에 반응하지 않는다
  // 자리 수도 찬 수도 **세계가 준 목록에서 읽는다** — 화면이 세지 않는다
  const worn = slots(snapshot);
  const filledSlots = worn.filter((slot) => slot.item).length;
  const all = items(snapshot);
  const shown = visibleItems(all);
  const filtered = shown.length !== all.length;
  const confirm = confirmRows(snapshot, text);
  const choosing = exchangeRows(snapshot, text);
  // 자리를 고르는 중이면 초점은 그 구획에 있다 — 아직 골라 두지 않았으면 그만두기다
  if (choosing.length > 0 && !exchangeRowIds(snapshot).includes(focusedActionId ?? '')) {
    focusedActionId = EXCHANGE_CANCEL_ID;
  }
  // 확인이 떠 있으면 초점은 그 구획의 답에 있다 — Enter 가 할 일이 곧 초점이다
  const focusId =
    confirm.length > 0
      ? confirmChoice === 'commit'
        ? CONFIRM_COMMIT_ID
        : CONFIRM_CANCEL_ID
      : (focusedActionId ?? focusedCellId);

  return {
    id: INVENTORY_SURFACE_ID,
    open,
    title: '가진 것',
    // 이 표면은 **작업 공간**이다 (문서 §2.2) — 걸어 둔 것과 지닌 것이 나란히 서려면
    // 읽을 것 하나짜리 표면보다 넓어야 한다. 청함이지 명령이 아니므로 화면이 좁으면
    // 기반이 화면에 맞춘다 (SceneSurface.width)
    width: WORKSPACE_WIDTH,
    ...(focusId === null ? {} : { focusId }),
    sections: [
      // 도구 띠 (문서 §2.2 의 `[전체⌄] [정렬⌄]` 자리) — **거는 것은 보기이지 세계가 아니다.**
      // 빈 목록에서도 사라지지 않는다: 사라지면 되돌릴 자리가 화면에서 없어진다
      {
        id: 'filter',
        title: '분류',
        // 고르는 단추이지 자리가 아니다 — 물건 칸과 같은 크기로 그리면 띠가 아니라
        // 또 하나의 격자가 된다 (V-009 · 문서 §2.2 의 한 줄 도구 띠)
        shape: 'chip',
        // 이름으로 찾는 자리 — 문서 §2.2 가 `[검색 /]` 을 이 띠에 둔다
        field: searchField(),
        cells: filterCells(),
      },
      {
        id: 'order',
        // `정렬` 이 아니라 `보기 정렬` 이다 — 세계의 차례를 바꾸지 않는다 (문서 §6)
        title: '보기 정렬',
        shape: 'chip',
        cells: orderCells(),
      },
      // 걸어 둔 것 — **가방 앞**이다 (문서 §8 의 초점 순서 `닫기 → 도구 → 장비 → 가방`).
      // 가방과 함께 보여야 걸고 푸는 일이 **자리 사이의 이동**으로 읽힌다 (문서 §2.2)
      ...(worn.length > 0
        ? [
            {
              id: 'equipment',
              title: `걸어 둔 것 — ${filledSlots} / ${worn.length}`,
              columns: EQUIPMENT_COLUMNS,
              // 지닌 것과 **나란히** 선다 (문서 §2.3) — 넓으면 좌우 두 열, 좁으면
              // 목록의 차례 그대로 다시 쌓인다. 문턱은 묶음의 첫 구획이 준다
              group: WORKSPACE_GROUP,
              groupMin: WORKSPACE_COLUMN_MIN,
              cells: slotCells(snapshot, text, shortText),
            },
          ]
        : []),
      {
        id: 'items',
        // 좁혔으면 **두 수와 그 사유를 함께** 보인다 — 보이는 수만 말하면 지닌 것이
        // 줄어든 것으로 읽히고, 사유가 없으면 왜 줄었는지 알 길이 없다
        title: filtered
          ? `지닌 것 — ${shown.length} / ${all.length} 종류 · ${narrowedBy().join(' · ')}`
          : `지닌 것 — ${all.length} 종류`,
        columns: COLUMNS,
        // 걸어 둔 것과 같은 묶음 — 둘이 한 줄에 선다. 걸어 둔 자리가 하나도 없으면
        // 이 구획만 남고, 그때는 홀로 서므로 묶음이 되지 않는다 (기반이 가른다)
        group: WORKSPACE_GROUP,
        cells: itemCells(shown, all, text, shortText),
        // 지닌 것이 없는 것과 조건에 걸린 것이 없는 것은 다른 일이다 (문서 §6)
        emptyText:
          all.length === 0 ? '소지품 없음' : '조건에 맞는 아이템 없음 · 필터 초기화',
      },
      {
        id: 'room',
        // 두 수를 글자로도 함께 보인다 — 자리로만 보이면 얼마가 전부인지 읽히지 않는다
        title: room
          ? `자리 ${room.used} / ${room.capacity}${full ? ' · 가득' : ` · 남은 자리 ${left}`}`
          : '자리',
        columns: COLUMNS,
        // 남은 자리도 같은 묶음이다 — 밖에 두면 이 구획만 표면 폭 전체로 늘어나고,
        // 그러면 같은 화면의 빈 칸이 물건 칸의 두 배가 된다 (한 칸 265px 대 132px).
        // 자리가 둘뿐이면 한 줄에 둘만 서고 이 구획은 그 아래 줄로 내려간다
        group: WORKSPACE_GROUP,
        cells: roomCells(snapshot),
        emptyText: '남은 자리 없음',
      },
      {
        id: 'detail',
        title: detailTitle(snapshot, text),
        rows: actionRows(snapshot, shortText, now),
        emptyText: `${keyLabel('pickLeft')} ${keyLabel('pickRight')} 로 고른다`,
      },
      // 자리 고르기 구획도 **고르는 중일 때만 선다** (V-012) — 늘 서 있으면 자리
      // 목록이 둘이 되고, 어느 쪽이 지금 답을 기다리는지 알 수 없다
      ...(choosing.length > 0
        ? [
            {
              id: 'exchange',
              title: `무엇과 바꿔 걸까 — ${itemName(exchanging ?? '', text)}`,
              rows: choosing,
            },
          ]
        : []),
      // 확인 구획은 **기다리는 것이 있을 때만 선다.** 늘 서 있으면 되돌릴 수 없다는
      // 말이 배경이 되고, 배경이 된 경고는 읽히지 않는다
      ...(confirm.length > 0
        ? [{ id: 'confirm', title: '되돌릴 수 없다', rows: confirm }]
        : []),
    ],
    // 안내에 뜨는 키는 **실제로 듣는 그 키다** (V-003) — 표기와 코드가 한 자리에서 온다
    footer:
      confirm.length > 0
        ? [
            `고르기 ${keyLabel('actionUp')} ${keyLabel('actionDown')}`,
            `실행 ${keyLabel('invoke')}`,
            `그만두기 ${keyLabel('pickLeft')} ${keyLabel('pickRight')}`,
            `닫기 ${keyLabel('close')}`,
          ]
        : [
            `닫기 ${keyLabel('close')}`,
            `고르기 ${keyLabel('pickLeft')} ${keyLabel('pickRight')}`,
            `행동 ${keyLabel('actionUp')} ${keyLabel('actionDown')}`,
            `실행 ${keyLabel('invoke')}`,
            // V-008 — 늘 떠 있는 안내 패널에는 서지 않는다 (닫혀 있을 때 거짓이 된다).
            // 그 줄이 서는 자리가 여기다
            `분류 ${keyLabel('viewFilter')}`,
            `보기 정렬 ${keyLabel('viewOrder')}`,
            `이름으로 찾기 ${keyLabel('viewSearch')}`,
          ],
  };
}
