// RULE-CARRY-ADD-001 — Implements INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001 · INTENT-CARRY-ROOM-001
// Input          Actor, 종류, 수량
// Preconditions  1. 그 종류가 ItemCatalog 에 있다        (unknown-item)
//                2. 수량 >= 1                            (invalid-quantity)
//                3. 요청 수량 **전부**를 받을 수 있다     (carry-full)
// Transition     쌓을 수 있는 자리부터 채우고, 남으면 빈 자리를 순서대로 쓴다
// Result         Success | Failure(reason)
//
// RULE-CARRY-LET-GO-001 — Implements INTENT-LET-GO-001 · INTENT-NO-DEAD-END-001
// Input          Actor, 자리 번호
// Preconditions  1. 그 자리가 존재하고 비어 있지 않다      (carried-not-found)
//                2. 그 자리가 여는 용도 중 어느 것도
//                   LastWayUses 에 없다                   (last-way-locked)
// Transition     그 자리를 비운다 — 담겨 있던 수량 전부가 사라진다
// Result         Success | Failure(reason)
//
// C020 — 세계에 처음으로 **가진 것이 사라지는 경로**가 생긴다. 지금까지는 늘어나는
// 길만 있었다 (RULE-MINE-COMPLETE-001 의 += 1 하나).
//
// 덜어낸 것은 세계 어디에도 놓이지 않는다 — 위치를 가진 물건이라는 개념이 아직 없기
// 때문이다 (01 SCOPE NOTE ③). 그 개념이 오면 이 Rule 의 Transition 에 "세계에 놓는다"
// 가 더해지고 나머지는 그대로다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_CARRY_ADD, RULE_CARRY_LET_GO } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { itemDefinition, usesOf, type ItemKind } from '../semantic/item';
import {
  canAccept,
  clearSlot,
  fillSlots,
  lastWayUses,
  slotAt,
  type Inventory,
} from '../semantic/inventory';

// 실패 사유 코드 — Rule 이 소유하며 protocol 로는 문자열 코드로 흐른다.
// IE §29 의 표와의 대응은 03 OBSERVABLE SEMANTIC 이 소유한다
// (carry-full = INVENTORY_FULL · carried-not-found = ITEM_NOT_FOUND ·
//  last-way-locked = LOCKED_ITEM · invalid-quantity = INVALID_QUANTITY).
export type CarryAddFailureReason = 'unknown-item' | 'invalid-quantity' | 'carry-full';
export type CarryLetGoFailureReason = 'carried-not-found' | 'last-way-locked';

// Precondition 평가 — 관찰(Carried[].actions)과 Rule 이 **같은 판정을 공유한다.**
// 표시용 판정과 실행 판정이 갈리면 화면이 허락한 것을 세계가 거절한다.
export function evaluateCarryAdd(
  inventory: Inventory,
  kind: ItemKind,
  amount: number,
): CarryAddFailureReason | null {
  if (itemDefinition(kind) === undefined) return 'unknown-item';
  if (!Number.isInteger(amount) || amount < 1) return 'invalid-quantity';
  if (!canAccept(inventory, kind, amount)) return 'carry-full';
  return null;
}

export function ruleCarryAdd(actor: ActorState, kind: ItemKind, amount: number): ActionResult {
  const reason = evaluateCarryAdd(actor.inventory, kind, amount);
  if (reason) return { status: 'failure', rule: RULE_CARRY_ADD, reason };

  // 판정이 끝난 뒤에만 담는다. 담으면서 세지 않는다 (DC-ITEM-CHANGE-IS-ONE-UNIT).
  fillSlots(actor.inventory, kind, amount);
  return { status: 'success', rule: RULE_CARRY_ADD };
}

export function evaluateCarryLetGo(
  inventory: Inventory,
  slot: number,
): CarryLetGoFailureReason | null {
  const held = Number.isInteger(slot) ? slotAt(inventory, slot) : null;
  if (held === null) return 'carried-not-found';

  // 이 자리를 비우면 지금 열려 있는 길이 영영 닫히는가.
  // 물건의 종류를 묻지 않는다 — **그것이 마지막인가**를 묻는다.
  const last = lastWayUses(inventory);
  for (const use of usesOf(held.kind)) {
    if (last.has(use)) return 'last-way-locked';
  }
  return null;
}

export function ruleCarryLetGo(actor: ActorState, slot: number): ActionResult {
  const reason = evaluateCarryLetGo(actor.inventory, slot);
  if (reason) return { status: 'failure', rule: RULE_CARRY_LET_GO, reason };

  clearSlot(actor.inventory, slot);
  return { status: 'success', rule: RULE_CARRY_LET_GO };
}
