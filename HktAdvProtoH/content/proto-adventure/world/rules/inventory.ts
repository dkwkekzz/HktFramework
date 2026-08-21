// RULE-INVENTORY-ADD-001 — Implements INTENT-INVENTORY-SINGLE-CHANNEL-001 ·
//                                      INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001
// Input          Actor, ItemKind, Count(> 0)
// Preconditions  1. 그 종류의 정의가 있다                  (unknown-item)
//                2. 담은 뒤의 UsedSlots <= Capacity        (no-room)    ← C022 ADDED
// Transition     Items[kind] += Count
// Result         Success | Failure(reason)
//
// C022 — **전부가 들어가지 못하면 하나도 넣지 않는다.** 검증이 변경보다 먼저이므로
// 부분 담기가 일어날 수 있는 순간 자체가 없다 (DC-ITEM-CHANGE-IS-ONE-UNIT · IE §6.1).
// 거절은 이 통로 하나에서만 일어나므로 이후 제작·전리품·주고받기가 저마다의 거절을
// 갖지 않는다.
//
// RULE-INVENTORY-REMOVE-001 — Implements INTENT-INVENTORY-SINGLE-CHANNEL-001 ·
//                                        INTENT-ITEM-CONSUME-001
// Input          Actor, ItemKind, Count(> 0)
// Preconditions  1. 그 종류의 정의가 있다                  (unknown-item)
//                2. Items[kind] >= Count                  (not-enough)
// Transition     Items[kind] -= Count. 0 이 되면 항목이 사라진다
// Result         Success | Failure(reason)
//
// C020 ADDED — 소지품이 변하는 **유일한 문**이다. 규칙마다 제 손으로 고치면
// 이후 제작·전리품·주고받기가 서로 다른 규칙을 갖게 된다 (IS §5.2).
//
// **검증이 변경보다 먼저다.** 모자란 채로 줄이기 시작하는 경로가 없으므로
// 수량이 음수가 되는 상태는 이 세계에 존재하지 않는다 (DC-ITEM-CHANGE-IS-ONE-UNIT).

import type { ActionResult } from '../../protocol/actions';
import { RULE_INVENTORY_ADD, RULE_INVENTORY_REMOVE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { itemCount } from '../semantic/inventory';
import { itemDefinition, type ItemKind } from '../semantic/item';
import { INVENTORY_CAPACITY } from '../semantic/world-state';
import { roomAfterAdd } from './inventory-room';

export type InventoryFailureReason = 'unknown-item' | 'not-enough' | 'no-room';

/**
 * Observable(채집의 가능/사유 · 소지품 항목)과 Rule 이 **같은 판정을 공유한다** (C022).
 *
 * 담을 수 있는지를 묻는 곳이 여기 하나뿐이므로, 화면에 불가로 보이는 것을 억지로
 * 요청해도 같은 사유로 거절된다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
export function evaluateInventoryAdd(
  actor: ActorState,
  kind: string,
  count: number,
): InventoryFailureReason | null {
  if (!itemDefinition(kind)) return 'unknown-item';
  if (count <= 0) return null;
  if (roomAfterAdd(actor.inventory, kind, count) > INVENTORY_CAPACITY) return 'no-room';
  return null;
}

/** Observable 과 Rule 이 같은 판정을 공유한다 */
export function evaluateInventoryRemove(
  actor: ActorState,
  kind: string,
  count: number,
): InventoryFailureReason | null {
  if (!itemDefinition(kind)) return 'unknown-item';
  if (itemCount(actor.inventory, kind as ItemKind) < count) return 'not-enough';
  return null;
}

export function ruleInventoryAdd(actor: ActorState, kind: string, count: number): ActionResult {
  const failure = evaluateInventoryAdd(actor, kind, count);
  if (failure) return { status: 'failure', rule: RULE_INVENTORY_ADD, reason: failure };
  if (count <= 0) return { status: 'success', rule: RULE_INVENTORY_ADD };

  const key = kind as ItemKind;
  actor.inventory.items.set(key, itemCount(actor.inventory, key) + count);
  return { status: 'success', rule: RULE_INVENTORY_ADD };
}

export function ruleInventoryRemove(actor: ActorState, kind: string, count: number): ActionResult {
  if (count <= 0) return { status: 'success', rule: RULE_INVENTORY_REMOVE };

  const failure = evaluateInventoryRemove(actor, kind, count);
  if (failure) return { status: 'failure', rule: RULE_INVENTORY_REMOVE, reason: failure };

  const key = kind as ItemKind;
  const left = itemCount(actor.inventory, key) - count;
  // 0 이 되면 항목이 사라진다 — 지니지 않은 종류는 관찰에도 나오지 않는다
  if (left > 0) actor.inventory.items.set(key, left);
  else actor.inventory.items.delete(key);
  return { status: 'success', rule: RULE_INVENTORY_REMOVE };
}
