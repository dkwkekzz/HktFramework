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
import type { GameViewSnapshot, InventoryItemView } from '../protocol/gameview';
import { surfaceIsOpen } from './surface-state';

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

// ── 겪는 사람 쪽 상태 — **세계의 상태가 아니다** ──────────────────────
//
// 고르는 것도 초점을 옮기는 것도 세계로 아무것도 보내지 않는다. 그래서 아무리
// 움직여도 세계에는 흔적이 남지 않는다.

/** 지금 고른 종류. 관찰에서 사라지면 지운다 — 다른 것을 대신 고르지 않는다 */
let selectedKind: string | null = null;
/** 지금 자판이 가리키는 행동 줄 */
let focusedActionId: string | null = null;

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

/** 검증용 — 지금 기다리는 요청이 몇인가 */
export function workspacePendingCount(): number {
  return pending.size();
}

/** 검증용·이어짐 끊김용 — 전부 비운다 */
export function resetWorkspace(): void {
  selectedKind = null;
  focusedActionId = null;
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
  if (selectedKind !== null && selectedItem(snapshot) === undefined) {
    selectedKind = null;
    focusedActionId = null;
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
  const kinds = items(snapshot).map((entry) => entry.kind);
  const next = moveFocus(kinds, selectedKind ?? undefined, delta);
  if (next === undefined) {
    selectedKind = null;
    focusedActionId = null;
    return;
  }
  if (next !== selectedKind) {
    selectedKind = next;
    // 물건을 바꾸면 초점은 그 물건의 첫 줄로 간다 — 남아 있으면 다른 물건의 줄을 가리킨다
    focusedActionId = items(snapshot).find((e) => e.kind === next)?.actions[0]?.id ?? null;
  }
}

/** 고른 것의 행동 줄 사이에서 초점을 옮긴다 */
export function moveActionFocus(snapshot: GameViewSnapshot, delta: number): void {
  const entry = selectedItem(snapshot);
  if (!entry) return;
  const ids = entry.actions.map((a) => a.id);
  focusedActionId = moveFocus(ids, focusedActionId ?? undefined, delta) ?? null;
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
export function invokeFocusedAction(
  snapshot: GameViewSnapshot,
  send: (action: ActionRequest) => number | null,
): void {
  const entry = selectedItem(snapshot);
  if (!entry || focusedActionId === null) return;
  const action = entry.actions.find((a) => a.id === focusedActionId);
  if (!action || !action.available) return;
  // 이 표면이 실행하지 않기로 한 역할은 보내지 않는다 (감추지는 않는다)
  if (NOT_EXECUTABLE_HERE[action.role] !== undefined) return;
  if (pending.waiting((w) => w.kind === entry.kind && w.actionId === action.id)) return;

  const mark = send({ interactionId: action.id, itemKind: entry.kind });
  pending.add(mark, { kind: entry.kind, actionId: action.id });
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
    return {
      id: action.id,
      text: label,
      state: 'available' as const,
      ...(here ? { hint: here } : {}),
    };
  });
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

  const room = snapshot.inventoryRoom;
  const left = room ? Math.max(0, room.capacity - room.used) : 0;
  const full = room ? room.used >= room.capacity : false;
  const entry = selectedItem(snapshot);

  return {
    id: INVENTORY_SURFACE_ID,
    open: surfaceIsOpen(INVENTORY_SURFACE_ID),
    title: '가진 것',
    ...(focusedActionId === null ? {} : { focusId: focusedActionId }),
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
        emptyText: '← → 로 고른다',
      },
    ],
    footer: ['닫기 Esc', '고르기 ← →', '행동 ↑ ↓', '실행 Enter'],
  };
}
