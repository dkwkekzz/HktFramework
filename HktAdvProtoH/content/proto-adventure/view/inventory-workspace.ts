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
import { moveFocus } from '../../../engine/view-kernel/input/focus';
import type { ActionRequest } from '../protocol/actions';
import type { GameViewSnapshot, InventoryItemView, ItemActionView } from '../protocol/gameview';
import { keyLabel } from './key-registry';
import { openSurface, surfaceIsOpen } from './surface-state';

/** 이 표면의 이름 — 여는 손짓과 닫는 길이 같은 것을 가리키게 하는 열쇠 */
export const INVENTORY_SURFACE_ID = 'inventory';

/** 격자를 몇 칸씩 놓는가 — **표현이며 계약에서 오지 않는다** */
const COLUMNS = 4;

/**
 * 이 표면에서 **실행하지 않는** 역할 (04 unexecutable_actions).
 *
 * 바꿔 걸기는 자리를 지목해야 성립하는데, 자리를 고르는 일이 곧 장비 패널이고 그것은
 * 다음 Cycle 의 몫이다. **감추지 않는다** — 세계는 된다고 말했고 그 사실은 관찰의
 * 내용이다. 여기서 그 길이 아직 없을 뿐이며, 기존 손가락 자리가 그대로 그 길이다.
 */
const NOT_EXECUTABLE_HERE: Readonly<Record<string, string>> = {
  'exchange-item': '이 자리에서는 아직 — , 로',
};

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
const CONFIRM_COMMIT_ID = 'confirm.commit';
const CONFIRM_CANCEL_ID = 'confirm.cancel';

// ── 겪는 사람 쪽 상태 — **세계의 상태가 아니다** ──────────────────────
//
// 고르는 것도 초점을 옮기는 것도 세계로 아무것도 보내지 않는다. 그래서 아무리
// 움직여도 세계에는 흔적이 남지 않는다.

/** 지금 고른 종류. 관찰에서 사라지면 지운다 — 다른 것을 대신 고르지 않는다 */
let selectedKind: string | null = null;
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

/** 보냈고 아직 대답이 오지 않은 요청들 — 표식으로 짚는다 (C009) */
const pending = createPendingRequests<{ kind: string; actionId: string }>();

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

/** 검증용 — 지금 어느 줄에 초점이 있는가 */
export function workspaceFocus(): string | null {
  return focusedActionId;
}

/** 검증용 — 지금 어느 칸에 초점이 있는가 */
export function workspaceCellFocus(): string | null {
  return focusedCellId;
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
  focusedActionId = null;
  focusedCellId = null;
  confirming = null;
  confirmChoice = 'cancel';
  observed = null;
  pending.clear();
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
  if (selectedKind !== null && selectedItem(snapshot) === undefined) {
    selectedKind = null;
    focusedActionId = null;
    confirming = null;
    return;
  }
  const entry = selectedItem(snapshot);
  if (!entry) return;
  // 초점이 가리키던 줄이 사라졌으면(행동 목록이 바뀌었으면) 첫 줄로 되돌린다
  if (focusedActionId !== null && !entry.actions.some((a) => a.id === focusedActionId)) {
    focusedActionId = entry.actions[0]?.id ?? null;
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
  const kinds = items(snapshot).map((entry) => entry.kind);
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
  const entry = selectedItem(snapshot);
  if (!entry) return;
  const ids = entry.actions.map((a) => a.id);
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
function firstExecutable(entry: InventoryItemView): ItemActionView | undefined {
  return entry.actions.find((a) => a.available && NOT_EXECUTABLE_HERE[a.role] === undefined);
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
    if (pending.waiting((w) => w.kind === target.kind && w.actionId === action.id)) return;
    const commit = send({ interactionId: action.id, itemKind: target.kind });
    pending.add(commit, { kind: target.kind, actionId: action.id });
    return;
  }

  const entry = selectedItem(snapshot);
  if (!entry) return;
  // 줄에 초점이 있으면 그 줄이고, **칸에 초점이 있으면 첫 되는 행동**이다 (V-004).
  // 손가락으로 골라 두고 자판으로 실행하는 손이 여기서 끊기지 않는다 —
  // 두 번 누름이 지나는 길도 바로 이 자리다 (UX 문서 §4.1 하나의 의미, 여러 입력).
  const action =
    focusedActionId === null
      ? firstExecutable(entry)
      : entry.actions.find((a) => a.id === focusedActionId);
  if (!action || !action.available) return;
  // 실행한 줄로 초점이 옮겨 간다 — 기다림도 사유도 그 줄에 뜬다
  focusedActionId = action.id;
  focusedCellId = null;
  // 이 표면이 실행하지 않기로 한 역할은 보내지 않는다 (감추지는 않는다)
  if (NOT_EXECUTABLE_HERE[action.role] !== undefined) return;
  if (pending.waiting((w) => w.kind === entry.kind && w.actionId === action.id)) return;

  // 되돌릴 수 없는 것은 여기서 나가지 않는다 — 확인을 세우고 멈춘다 (UX 문서 §7)
  if (CONFIRM_REQUIRED.has(action.role)) {
    confirming = { kind: entry.kind, actionId: action.id };
    confirmChoice = 'cancel';
    return;
  }

  const mark = send({ interactionId: action.id, itemKind: entry.kind });
  pending.add(mark, { kind: entry.kind, actionId: action.id });
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
  const kind = cellKind(cellId);
  if (kind === undefined) return false;
  if (!items(snapshot).some((e) => e.kind === kind)) return false;
  // 다른 것을 고르는 것은 그만두는 것이다 — 방향키와 같은 규칙이다 (V-002)
  confirming = null;
  selectedKind = kind;
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
  const entry = selectedItem(snapshot);
  if (!entry) return;
  focusedActionId = entry.actions[0]?.id ?? null;
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
  const snapshot = mine(surfaceId);
  if (!snapshot) return;
  if (confirming !== null) {
    if (rowId === CONFIRM_COMMIT_ID) confirmChoice = 'commit';
    else if (rowId === CONFIRM_CANCEL_ID) confirmChoice = 'cancel';
    else return; // 확인이 떠 있는 동안 다른 줄은 듣지 않는다
    invokeFocusedAction(snapshot, send);
    return;
  }
  const entry = selectedItem(snapshot);
  if (!entry || !entry.actions.some((a) => a.id === rowId)) return;
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
  focusedCellId = null;
  const action = entry.actions.find((a) => CONFIRM_REQUIRED.has(a.role));
  focusedActionId = action?.id ?? entry.actions[0]?.id ?? null;
  confirming =
    action && action.available && !pending.waiting((w) => w.kind === kind && w.actionId === action.id)
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

function itemName(kind: string, text: (code: string) => string): string {
  const code = `item.${kind}`;
  const named = text(code);
  return named === code ? kind : named;
}

function itemCells(snapshot: GameViewSnapshot, text: (code: string) => string): SceneSurfaceCell[] {
  return items(snapshot).map((entry) => {
    const icon = CATEGORY_ICON[entry.category];
    return {
      id: `item.${entry.kind}`,
      text: icon ? `${icon} ${itemName(entry.kind, text)}` : itemName(entry.kind, text),
      detail: `×${entry.count}`,
      empty: false,
      selected: entry.kind === selectedKind,
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

function actionRows(
  snapshot: GameViewSnapshot,
  shortText: (code: string) => string,
): SceneSurfaceRow[] {
  const entry = selectedItem(snapshot);
  if (!entry) return [];
  return entry.actions.map((action) => {
    const label = ACTION_LABEL[action.role] ?? action.role;
    // 안 되는 것도 목록에서 빠지지 않는다 — 사유를 읽는 것이 이 자리의 값어치다
    if (!action.available) {
      const reason = action.unavailableReason ? shortText(action.unavailableReason) : '안 됨';
      return { id: action.id, text: `${label} — ${reason}`, state: 'blocked' as const };
    }
    if (pending.waiting((w) => w.kind === entry.kind && w.actionId === action.id)) {
      return { id: action.id, text: `${label} — 보냈다`, state: 'pending' as const };
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
): SceneSurface {
  observed = snapshot;
  reconcileSelection(snapshot);

  const open = surfaceIsOpen(INVENTORY_SURFACE_ID);
  // 닫히면 확인도 사라진다 — 보이지 않는 확인은 확인이 아니다. 닫는 길(Esc · ✕)이
  // 곧 그만두는 길이며, 그 길로도 세계에는 아무것도 나가지 않는다
  if (!open) confirming = null;

  const room = snapshot.inventoryRoom;
  const left = room ? Math.max(0, room.capacity - room.used) : 0;
  const full = room ? room.used >= room.capacity : false;
  const entry = selectedItem(snapshot);
  const confirm = confirmRows(snapshot, text);
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
    ...(focusId === null ? {} : { focusId }),
    sections: [
      {
        id: 'items',
        title: `지닌 것 — ${items(snapshot).length} 종류`,
        columns: COLUMNS,
        cells: itemCells(snapshot, text),
        emptyText: '소지품 없음',
      },
      {
        id: 'room',
        // 두 수를 글자로도 함께 보인다 — 자리로만 보이면 얼마가 전부인지 읽히지 않는다
        title: room
          ? `자리 ${room.used} / ${room.capacity}${full ? ' · 가득' : ` · 남은 자리 ${left}`}`
          : '자리',
        columns: COLUMNS,
        cells: roomCells(snapshot),
        emptyText: '남은 자리 없음',
      },
      {
        id: 'detail',
        title: entry
          ? `고른 것 — ${itemName(entry.kind, text)} ×${entry.count}`
          : '고른 것',
        rows: actionRows(snapshot, shortText),
        emptyText: `${keyLabel('pickLeft')} ${keyLabel('pickRight')} 로 고른다`,
      },
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
          ],
  };
}
