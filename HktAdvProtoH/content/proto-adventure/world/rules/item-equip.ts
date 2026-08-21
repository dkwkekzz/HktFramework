// RULE-ITEM-EQUIP-001   — Implements INTENT-APPLY-ITEM-001 ·
//                                    INTENT-FITNESS-COMES-FROM-THE-DEFINITION-001 ·
//                                    INTENT-APPLY-NEEDS-AN-EMPTY-PLACE-001 ·
//                                    INTENT-A-THING-IS-IN-EXACTLY-ONE-PLACE-001
// RULE-ITEM-UNEQUIP-001 — Implements INTENT-RELEASE-ITEM-001 ·
//                                    INTENT-RELEASE-ASKS-FOR-ROOM-001 ·
//                                    INTENT-A-THING-IS-IN-EXACTLY-ONE-PLACE-001
//
// C023 ADDED — **가진 것과 적용된 것이 갈리는 자리다.**
//
// 두 규칙 어디에도 종류 이름이 없다. 걸 수 있는지는 정의가 답하고(equip 이 있는가),
// 어느 자리에 걸리는지도 정의가 답한다(targets — 비면 제한 없음). 그래서 새 장비가
// 생기는 일은 ITEM_CATALOG 에 줄이 늘어나는 일이며 이 파일은 열리지 않는다
// (DC-ITEM-KIND-IS-DATA-NOT-BRANCH).
//
// **요청은 자리를 싣지 않는다.** 여섯 자리가 서로 완전히 같으므로 어디에 걸리는지는
// 고를 것이 아니다 — 세계가 조건을 만족하는 빈 자리 중 차례가 가장 앞선 것을 고른다
// (IE §10 · §20 "우선순위는 [WORLD]").
//
// **수량을 바꾸는 것은 단일 통로를 지난다** (INTENT-INVENTORY-SINGLE-CHANNEL-001).
// 이 파일이 Inventory 의 Map 을 직접 고치지 않는다 — 걸기는 RULE-INVENTORY-REMOVE-001
// 로 나가고 풀기는 RULE-INVENTORY-ADD-001 로 들어온다. 그래서 자리 계산도 막힘 판정도
// 저절로 맞는다.
//
// **시간을 쓰지 않는다.** 행동 얼개를 지나지 않고 하던 행동을 끊지도 않는다.
// 푸는 것은 덜어내기와 나란히 막힘의 출구이므로 그 자신이 끊겨 막힐 수 있어서는 안 된다
// (03-world-semantic.md RATIONALE 6).

import type { ActionResult } from '../../protocol/actions';
import { RULE_ITEM_EQUIP, RULE_ITEM_UNEQUIP } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { EQUIP_SLOTS, isEquipSlot, slotFits, type EquipSlotId } from '../semantic/equipment';
import { itemCount } from '../semantic/inventory';
import { itemDefinition, type ItemKind } from '../semantic/item';
import { evaluateInventoryAdd, ruleInventoryAdd, ruleInventoryRemove } from './inventory';

export type ItemEquipFailureReason =
  | 'unknown-item'
  | 'not-enough'
  | 'not-equippable'
  | 'no-empty-slot';

export type ItemUnequipFailureReason = 'unknown-slot' | 'slot-empty' | 'no-room';

/**
 * 이 물건이 지금 걸릴 수 있는 빈 자리 — 없으면 undefined.
 *
 * **차례가 가장 앞선 것을 고른다.** 같은 세계 상태면 언제나 같은 자리가 나오므로
 * 관찰도 결과도 흔들리지 않는다.
 */
function firstOpenSlot(actor: ActorState, kind: string): EquipSlotId | undefined {
  return EQUIP_SLOTS.find((slotId) => !actor.equipment.slots.has(slotId) && slotFits(slotId, kind));
}

/**
 * Observable(소지품 항목의 걸기 가능/사유)과 Rule 이 **같은 판정을 공유한다.**
 * 화면에 불가로 보이는 것을 억지로 요청해도 같은 사유로 거절된다
 * (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
export function evaluateItemEquip(
  actor: ActorState,
  kind: string,
): ItemEquipFailureReason | null {
  const definition = itemDefinition(kind);
  if (!definition) return 'unknown-item';
  if (itemCount(actor.inventory, kind as ItemKind) <= 0) return 'not-enough';
  // **자리 탓이 아니다** — 걸 수 있는 물건이 아니라는 뜻이며, 자리가 여섯이든 하나든
  // 같은 답이 나온다 (03-world-semantic.md JUDGEMENT ②).
  if (!definition.equip) return 'not-equippable';
  if (!firstOpenSlot(actor, kind)) return 'no-empty-slot';
  return null;
}

export function ruleItemEquip(actor: ActorState, kind: string): ActionResult {
  const failure = evaluateItemEquip(actor, kind);
  if (failure) return { status: 'failure', rule: RULE_ITEM_EQUIP, reason: failure };

  const slotId = firstOpenSlot(actor, kind)!;

  // 하나의 성공 단위다 — 빠지지 않으면 걸리지도 않는다.
  const removal = ruleInventoryRemove(actor, kind, 1);
  if (removal.status === 'failure') {
    return { status: 'failure', rule: RULE_ITEM_EQUIP, reason: removal.reason };
  }
  actor.equipment.slots.set(slotId, kind as ItemKind);
  return { status: 'success', rule: RULE_ITEM_EQUIP };
}

/**
 * Observable(자리의 풀기 가능/사유)과 Rule 이 같은 판정을 공유한다.
 *
 * `no-room` 은 소지품 통로·채집이 쓰는 것과 **같은 코드**다 — 겪는 일이 하나이므로
 * 사유도 하나여야 한다 (C022 가 세운 관계 그대로).
 */
export function evaluateItemUnequip(
  actor: ActorState,
  slotId: string,
): ItemUnequipFailureReason | null {
  if (!isEquipSlot(slotId)) return 'unknown-slot';
  const kind = actor.equipment.slots.get(slotId);
  if (!kind) return 'slot-empty';
  // 세계는 풀린 물건을 바닥에 떨어뜨리지 않는다 — 의도하지 않은 잃음을 만들지 않기
  // 위해서이고, 세계에 놓인 아이템이라는 것이 아직 없기 때문이기도 하다 (IE §15).
  return evaluateInventoryAdd(actor, kind, 1) === 'no-room' ? 'no-room' : null;
}

export function ruleItemUnequip(actor: ActorState, slotId: string): ActionResult {
  const failure = evaluateItemUnequip(actor, slotId);
  if (failure) return { status: 'failure', rule: RULE_ITEM_UNEQUIP, reason: failure };

  const kind = actor.equipment.slots.get(slotId)!;

  // 하나의 성공 단위다 — 담기지 않으면 자리도 비지 않는다.
  const addition = ruleInventoryAdd(actor, kind, 1);
  if (addition.status === 'failure') {
    return { status: 'failure', rule: RULE_ITEM_UNEQUIP, reason: addition.reason };
  }
  actor.equipment.slots.delete(slotId);
  return { status: 'success', rule: RULE_ITEM_UNEQUIP };
}
