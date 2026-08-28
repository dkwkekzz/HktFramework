// 겹침 표면의 손짓이 **어느 표면의 것인지** 갈라 보내는 자리 (V-018 REPORT ① 의 답).
//
// 기반은 눌린 자리의 id 와 **어느 표면인지**를 함께 돌려준다 — 무슨 뜻인지는 묻지
// 않는다 (설계 반전 ⑤). 조립은 그것을 팩에게 그대로 넘긴다. 그래서 팩에는 "표면
// 손짓을 받는 자리" 가 하나 있어야 하고, 그 자리가 여기다.
//
// ── 왜 이 파일이 생겼는가 ────────────────────────────────────────
//
// 조립(`content/active-view.ts`)이 이 다섯을 **`inventory-workspace` 에서** 재수출하고
// 있었다. 표면이 하나뿐인 동안에는 참이던 이름이고, 둘이 되자 소지품 모듈이 남의
// 표면까지 갈라 보내야 했다 (V-018 이 그 자리에서 갈랐다).
//
// 이제 조립은 **표면 이름이 없는 자리 하나**를 부른다. 표면이 셋째가 되어도 조립은
// 바뀌지 않는다 — 이 파일에 한 줄이 늘 뿐이다.
//
// **여기에는 판단이 없다.** 어느 표면의 것인지만 보고 그 표면의 모듈로 넘긴다.

import type { ActionRequest } from '../../../engine/protocol-core/actions';
import { EXECUTION_LOG_SURFACE_ID, pickLogEntry } from './execution-log';
import {
  INVENTORY_SURFACE_ID,
  commitCell as commitInventoryCell,
  menuCell as menuInventoryCell,
  pickCell as pickInventoryCell,
  pressRow as pressInventoryRow,
  typeInto as typeIntoInventory,
} from './inventory-workspace';

type Send = (action: ActionRequest) => number | null;

/** 칸이 한 번 눌렸다 */
export function pickCell(surfaceId: string, cellId: string): void {
  if (surfaceId === INVENTORY_SURFACE_ID) pickInventoryCell(surfaceId, cellId);
}

/** 칸이 두 번 눌렸다 */
export function commitCell(surfaceId: string, cellId: string, send: Send): void {
  if (surfaceId === INVENTORY_SURFACE_ID) commitInventoryCell(surfaceId, cellId, send);
}

/** 칸에서 목록을 청했다 (오른 단추) */
export function menuCell(surfaceId: string, cellId: string): void {
  if (surfaceId === INVENTORY_SURFACE_ID) menuInventoryCell(surfaceId, cellId);
}

/** 줄이 눌렸다 */
export function pressRow(surfaceId: string, rowId: string, send: Send): void {
  if (surfaceId === INVENTORY_SURFACE_ID) {
    pressInventoryRow(surfaceId, rowId, send);
    return;
  }
  // 되짚는 자리 (V-018) — 눌린 줄이 곧 고른 줄이다. 세계로 아무것도 나가지 않는다
  if (surfaceId === EXECUTION_LOG_SURFACE_ID) pickLogEntry(rowId);
}

/** 글자 자리에 쳐 넣었다 */
export function typeInto(surfaceId: string, fieldId: string, text: string): void {
  if (surfaceId === INVENTORY_SURFACE_ID) typeIntoInventory(surfaceId, fieldId, text);
}
