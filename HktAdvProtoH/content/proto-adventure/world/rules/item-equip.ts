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

// C024 CHANGED — **이미 찬 자리로 가는 길이 열린다.**
//
// 거는 요청이 자리를 실을 수 있게 된다. 실지 않으면 뜻이 한 톨도 바뀌지 않는다 —
// 빈 자리에 걸고, 없으면 `no-empty-slot` 이다. 세계가 슬그머니 무언가를 밀어내지 않는다.
// 실으면 그 자리가 비었을 때 그냥 걸리고, **차 있으면 교체가 된다** (IE §16).
//
// **무엇을 밀어낼지는 세계가 고르지 않는다.** 빈 자리들 사이에서 고르는 것은 자리들이
// 서로 같으므로 손해가 없지만, 찬 자리를 밀어내는 것은 잃을 것을 고르는 일이다
// (INTENT-THE-DISPLACED-IS-NAMED-001).
//
// **요청을 둘로 가르지 않는다.** "걸기" 와 "바꿔 끼기" 를 다른 요청으로 두면 어느 쪽을
// 보낼지 정하기 위해 화면이 "그 자리가 지금 찼는가" 를 판정해야 한다 — 그것은 세계의
// 사실이며 화면이 답할 것이 아니다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
//
// **교체는 담을 자리를 새로 요구하지 않는다.** 걸 수 있는 물건은 반드시 겹치지 않으므로
// (semantic/item.ts 의 카탈로그 불변 조건) 나가는 하나가 정확히 한 칸을 비우고 들어오는
// 하나가 한 칸을 쓴다. 그래서 가방이 가득해도 교체는 되고 해제는 막힌다 (IE §15 · §16.1) —
// 특례가 아니라 **같은 식이 다른 답을 내는 것**이다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_ITEM_EQUIP, RULE_ITEM_UNEQUIP } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { EQUIP_SLOTS, isEquipSlot, slotFits, type EquipSlotId } from '../semantic/equipment';
import { itemCount } from '../semantic/inventory';
import { itemDefinition, type ItemKind } from '../semantic/item';
import { INVENTORY_CAPACITY } from '../semantic/world-state';
import { evaluateInventoryAdd, ruleInventoryAdd, ruleInventoryRemove } from './inventory';
import { ruleInventoryRoom } from './inventory-room';

export type ItemEquipFailureReason =
  | 'unknown-item'
  | 'not-enough'
  | 'not-equippable'
  | 'no-empty-slot' // 자리를 밝히지 않았는데 걸 수 있는 빈 자리가 없다 (C023 그대로)
  // ── 아래 셋은 자리를 밝힌 요청에서만 온다 (C024 ADDED) ──
  | 'unknown-slot' // 세계가 모르는 자리다
  | 'slot-not-fit' // 그 물건이 그 자리에 걸릴 수 없다 (전용 자리를 선언한 물건만 겪는다)
  | 'no-room'; // 바꾼 뒤 가방이 모자란다 — 아래 evaluateItemEquip 의 주석 참조

export type ItemUnequipFailureReason = 'unknown-slot' | 'slot-empty' | 'no-room';

/**
 * 바꿔 걸 수 있는가 (C024 ADDED) — 관찰 전용 사유.
 *
 * 자리를 묻지 않는 판정이므로 자리 쪽 사유(unknown-slot · slot-not-fit)가 없고,
 * 교체가 자리를 요구하지 않으므로 no-room 도 없다.
 */
export type ItemExchangeFailureReason =
  | 'unknown-item'
  | 'not-enough'
  | 'not-equippable'
  | 'no-occupied-slot';

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
  slotId?: string,
): ItemEquipFailureReason | null {
  const definition = itemDefinition(kind);
  if (!definition) return 'unknown-item';
  if (itemCount(actor.inventory, kind as ItemKind) <= 0) return 'not-enough';
  // **자리 탓이 아니다** — 걸 수 있는 물건이 아니라는 뜻이며, 자리가 여섯이든 하나든
  // 같은 답이 나온다 (03-world-semantic.md JUDGEMENT ②).
  if (!definition.equip) return 'not-equippable';

  // ── 자리를 밝히지 않았다 — C023 그대로 ────────────────────────────
  // **뜻이 한 톨도 바뀌지 않는다.** 빈 자리가 없으면 여전히 거절이며, 세계가
  // 아무것도 밀어내지 않는다 (C024 03-world-semantic.md Precondition 4).
  if (slotId === undefined) {
    if (!firstOpenSlot(actor, kind)) return 'no-empty-slot';
    return null;
  }

  // ── 자리를 밝혔다 (C024 ADDED) ───────────────────────────────────
  if (!isEquipSlot(slotId)) return 'unknown-slot';
  // 자리는 아무것도 묻지 않는다 — 묻는 것은 물건의 정의뿐이다 (RULE-EQUIP-SLOT-FITS-001).
  if (!slotFits(slotId, kind)) return 'slot-not-fit';

  const displaced = actor.equipment.slots.get(slotId);
  if (displaced === undefined) return null; // 빈 자리다 — 그냥 걸린다

  // **교체는 담을 자리를 새로 요구하지 않는다** — 나가는 하나가 비운 칸에 밀려나는
  // 하나가 들어오기 때문이다. 그래서 나가는 것을 뺀 **뒤에** 묻는다.
  //
  // 걸 수 있는 물건은 반드시 겹치지 않으므로(카탈로그 불변 조건) 이 물음은 지금 세계에서
  // 결코 실패하지 않는다 — 순 증가가 언제나 0 이다. **그래도 묻는다.** 묻지 않으면 이
  // 규칙이 그 불변 조건에 조용히 기대게 되고, 그것이 언젠가 달라질 때 아무 데서도
  // 걸리지 않는다 (03-world-semantic.md Precondition 7).
  return roomAfterExchange(actor, kind, displaced) > INVENTORY_CAPACITY ? 'no-room' : null;
}

/**
 * 나가는 하나를 빼고 밀려나는 하나를 넣은 뒤의 UsedSlots (C024 ADDED).
 *
 * 두 물건이 같은 종류일 수 있으므로 **순서대로** 센다 — 빼고 나서 더한다.
 * 자리를 세는 식 자체는 RULE-INVENTORY-ROOM-001 하나뿐이며 여기서 다시 만들지 않는다.
 */
function roomAfterExchange(actor: ActorState, outgoing: string, incoming: string): number {
  const items = new Map(actor.inventory.items);
  const left = (items.get(outgoing as ItemKind) ?? 0) - 1;
  if (left > 0) items.set(outgoing as ItemKind, left);
  else items.delete(outgoing as ItemKind);
  items.set(incoming as ItemKind, (items.get(incoming as ItemKind) ?? 0) + 1);
  return ruleInventoryRoom({ items });
}

/**
 * RULE-ITEM-EXCHANGEABLE-001 — Implements INTENT-EXCHANGE-IS-OBSERVED-001 ·
 *                                         INTENT-EACH-REFUSAL-HAS-ITS-OWN-REASON-001
 * Input          Actor, ItemKind
 * Preconditions  없음 — 언제나 답할 수 있다
 * Transition     없음 (읽기 판정)
 * Result         null | 사유
 *
 * "이 물건을 **어떤 찬 자리와** 바꿔 걸 수 있는가" (C024 ADDED).
 *
 * **자리를 묻지 않는다.** 어느 자리와 바꿀지는 요청이 밝히므로 이 판정이 답하는 것은
 * "바꿔 걸 자리가 하나라도 있는가" 다. 걸릴 수 있는 찬 자리를 세므로 전용 자리를
 * 선언한 물건이 생겨도 이 관찰은 거짓말을 하지 않는다
 * (03-world-semantic.md RATIONALE 6).
 *
 * **가방의 형편이 이 판정에 들어가지 않는다** — 교체는 담을 자리를 요구하지 않기
 * 때문이다. 그래서 가방이 가득해도 이 판정은 참일 수 있고, 같은 순간 같은 몸의
 * 해제는 `no-room` 으로 막힌다. 그 나란함이 이 Cycle 의 관찰이다.
 */
export function evaluateItemExchange(
  actor: ActorState,
  kind: string,
): ItemExchangeFailureReason | null {
  const definition = itemDefinition(kind);
  if (!definition) return 'unknown-item';
  if (itemCount(actor.inventory, kind as ItemKind) <= 0) return 'not-enough';
  if (!definition.equip) return 'not-equippable';
  const occupied = EQUIP_SLOTS.some(
    (slot) => actor.equipment.slots.has(slot) && slotFits(slot, kind),
  );
  // **가방 탓이 아니다** — 자리가 전부 비어 있다는 뜻이며, 그때 할 일은 덜어내는 것이
  // 아니라 그냥 거는 것이다 (equip-item 이 가능으로 실려 있다).
  return occupied ? null : 'no-occupied-slot';
}

export function ruleItemEquip(actor: ActorState, kind: string, slotId?: string): ActionResult {
  const failure = evaluateItemEquip(actor, kind, slotId);
  if (failure) return { status: 'failure', rule: RULE_ITEM_EQUIP, reason: failure };

  // 밝힌 자리, 또는 조건을 만족하는 빈 자리 중 차례가 가장 앞선 것.
  const target = (slotId ?? firstOpenSlot(actor, kind)) as EquipSlotId;
  const displaced = actor.equipment.slots.get(target);

  // 하나의 성공 단위다 — 빠지지 않으면 걸리지도 않는다.
  //
  // **나가는 것이 먼저다.** 밀려난 것이 들어올 칸을 그것이 비우기 때문이며, 그래서
  // 아래 담기는 결코 실패하지 않는다 — 위 검증이 이미 둘을 합쳐 물었다.
  const removal = ruleInventoryRemove(actor, kind, 1);
  if (removal.status === 'failure') {
    return { status: 'failure', rule: RULE_ITEM_EQUIP, reason: removal.reason };
  }
  actor.equipment.slots.set(target, kind as ItemKind);

  if (displaced !== undefined) {
    const returned = ruleInventoryAdd(actor, displaced, 1);
    if (returned.status === 'failure') {
      // 여기 오면 검증과 변경이 어긋난 것이다 — 되돌리고 사유를 그대로 낸다.
      // 세계가 물건을 삼키는 경로를 남기지 않기 위한 자리이며, 도달하지 않아야 한다.
      actor.equipment.slots.set(target, displaced);
      ruleInventoryAdd(actor, kind, 1);
      return { status: 'failure', rule: RULE_ITEM_EQUIP, reason: returned.reason };
    }
  }
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
