// World Semantic — World.EquipSlots · Actor.Equipment (C023 ADDED)
//
// **적용이라는 자리가 세계에 처음 생긴다.**
//
// 지금까지 몸은 지닌 것과 자기 값 사이에 아무 관계도 없었다 — 곡괭이를 가지고만 있어도
// 캐졌고, 무엇을 지녔든 능력치는 한 톨도 달라지지 않았다. 이 파일이 그 사이에 자리를
// 놓는다: 가진 것 중 몇이 **걸리고**, 걸린 것만이 몸을 바꾼다
// (DC-ITEM-HOLDING-IS-NOT-APPLYING).
//
// **자리는 여섯이고 서로 완전히 같다** (IE §10). 받는 성격도 전용 용도도 지니지 않는다.
// 제한은 **물건이 스스로 선언할 때만** 생기는 예외이며(IE §11), 선언하지 않으면
// 어느 자리에나 걸린다. 그러므로 이 파일에도 규칙에도 "이 자리는 무엇을 받는가" 를
// 묻는 곳이 없다.
//
// **자리가 물건을 직접 담는다** — 소지품을 가리키는 표를 들지 않는다 (IE §13.1).
// 그래서 "한 물건은 한 곳에만" 이 검사가 아니라 구조로 성립하고, 개체 식별자도
// 필요하지 않다 (DC-GROWTH-DEFINITION-INSTANCE-SPLIT · IS §2.1).

import { itemDefinition, type ItemKind, type StatContributions } from './item';

export type EquipSlotId = string;

/**
 * 이 세계의 적용 자리들 (C023 — 값이다).
 *
 * 여섯은 서로 같으므로 이름은 순서표일 뿐이다. 판정은 "빈 자리가 있는가" 를 물을 뿐
 * 그 자리가 무엇이라 불리는지를 조건으로 삼지 않는다 — 이 배열이 길어지거나 짧아져도
 * 규칙 코드는 한 줄도 열리지 않는다 (03-world-semantic.md BALANCE).
 */
export const EQUIP_SLOTS: readonly EquipSlotId[] = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];

export interface Equipment {
  /** 자리 → 담긴 종류. **없는 자리는 비어 있다** (빈 값을 넣지 않는다) */
  slots: Map<EquipSlotId, ItemKind>;
}

export function createEquipment(initial: Partial<Record<EquipSlotId, ItemKind>> = {}): Equipment {
  const slots = new Map<EquipSlotId, ItemKind>();
  for (const slotId of EQUIP_SLOTS) {
    const kind = initial[slotId];
    if (kind) slots.set(slotId, kind);
  }
  return { slots };
}

export function isEquipSlot(slotId: string): boolean {
  return EQUIP_SLOTS.includes(slotId);
}

export function equippedAt(equipment: Equipment, slotId: string): ItemKind | undefined {
  return equipment.slots.get(slotId);
}

/**
 * 자리들 — **비어 있는 자리도 전부 나온다.** 비었다는 것이 관찰의 내용이다.
 *
 * 순서는 EQUIP_SLOTS 의 차례다. 같은 세계 상태면 언제나 같은 순서가 나온다.
 */
export function equipmentSlots(
  equipment: Equipment,
): Array<{ slotId: EquipSlotId; kind?: ItemKind }> {
  return EQUIP_SLOTS.map((slotId) => {
    const kind = equipment.slots.get(slotId);
    return kind ? { slotId, kind } : { slotId };
  });
}

/** 지금 걸려 있는 종류들 — 같은 종류가 여러 자리에 있으면 그 수만큼 나온다 */
export function equippedKinds(equipment: Equipment): ItemKind[] {
  return EQUIP_SLOTS.flatMap((slotId) => {
    const kind = equipment.slots.get(slotId);
    return kind ? [kind] : [];
  });
}

/**
 * RULE-EQUIP-SLOT-FITS-001 — Implements INTENT-FITNESS-COMES-FROM-THE-DEFINITION-001
 * Input          SlotId, ItemKind
 * Preconditions  없음 — 언제나 답할 수 있다
 * Transition     없음 (읽기 판정)
 * Result         Equip.Targets 가 비어 있으면 참 · 아니면 SlotId ∈ Equip.Targets
 *
 * **자리는 아무것도 묻지 않는다.** 묻는 것은 물건의 정의뿐이며, 그것도 스스로 제한을
 * 선언했을 때만이다. 기본은 제한 없음이다 (IE §10 · §11).
 *
 * 지금 세계에서 이 함수는 걸 수 있는 물건에 대해 언제나 참을 낸다 — 제한을 선언한
 * 물건이 하나도 없기 때문이다. 그런 물건이 생겨도 이 함수도 이것을 읽는 곳도 열리지
 * 않는다: 정의에 줄이 하나 늘 뿐이다.
 */
export function slotFits(slotId: string, kind: string): boolean {
  const equip = itemDefinition(kind)?.equip;
  if (!equip) return false;
  const targets = equip.targets;
  return !targets || targets.length === 0 || targets.includes(slotId);
}

/**
 * RULE-EFFECTIVE-STATS-001 의 기여 항 — Implements
 * INTENT-CONTRIBUTION-COMES-FROM-THE-DEFINITION-001
 *
 * 지금 걸린 것들이 몸의 값에 보태는 것의 합. **종류 이름을 묻지 않는다** —
 * 정의가 답한 것을 더할 뿐이다.
 *
 * **같은 종류가 여러 자리에 걸리면 그 수만큼 더해진다.** 소지 제한이 없다는 것이
 * 그 뜻이며(IE §10), 이것이 "재계산이지 가감이 아니다" 의 가장 강한 관찰을 만든다 —
 * 둘을 걸면 두 번 더해지고 하나만 풀면 정확히 한 번어치가 남는다.
 */
export function equipmentContributions(equipment: Equipment): StatContributions {
  const total: Record<string, number> = {};
  for (const kind of equippedKinds(equipment)) {
    const contributions = itemDefinition(kind)?.equip?.contributions;
    if (!contributions) continue;
    for (const [stat, value] of Object.entries(contributions)) {
      total[stat] = (total[stat] ?? 0) + (value ?? 0);
    }
  }
  return total as StatContributions;
}
