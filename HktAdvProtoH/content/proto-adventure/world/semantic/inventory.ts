// World Semantic — Inventory.Items (C001 ADDED / C020 CHANGED)
// World Authority — 변경은 World Rule 의 Transition 에서만 일어난다.
//
// C020 CHANGED — 이 파일에서 판정이 사라졌다. `hasMiningTool` 이 여기 있었고, 그것이
// "곡괭이면 캘 수 있다" 를 소지품 쪽 코드가 소유한 형태였다. 이제 이 파일은 **구조와
// 조회**만 지닌다 — 무엇을 할 수 있는지는 정의가 답하고(semantic/item.ts),
// 그 답을 모으는 것은 RULE-BODY-USES-001 이다(rules/body-uses.ts).
//
// 수량을 바꾸는 것은 RULE-INVENTORY-ADD-001 / RULE-INVENTORY-REMOVE-001 뿐이다
// (INTENT-INVENTORY-SINGLE-CHANNEL-001). 다른 어떤 규칙도 이 Map 을 직접 고치지 않는다.

import { ITEM_KINDS, type ItemKind } from './item';

export interface Inventory {
  items: Map<ItemKind, number>; // Item.Kind 별 Count
}

export function createInventory(initial: Partial<Record<ItemKind, number>> = {}): Inventory {
  const items = new Map<ItemKind, number>();
  for (const [kind, count] of Object.entries(initial)) {
    if (count && count > 0) items.set(kind as ItemKind, count);
  }
  return { items };
}

export function itemCount(inventory: Inventory, kind: ItemKind): number {
  return inventory.items.get(kind) ?? 0;
}

/**
 * 지닌 것들 — 종류와 수량. 지니지 않은 종류는 나오지 않는다.
 *
 * 순서는 세계가 아는 종류의 순서다 (ITEM_KINDS). 얻은 차례가 아니라 정의의 차례이므로
 * 같은 세계 상태면 언제나 같은 순서가 나온다 — 관찰이 흔들리지 않는다.
 */
export function inventoryEntries(inventory: Inventory): Array<{ kind: ItemKind; count: number }> {
  const entries: Array<{ kind: ItemKind; count: number }> = [];
  for (const kind of ITEM_KINDS) {
    const count = inventory.items.get(kind) ?? 0;
    if (count > 0) entries.push({ kind, count });
  }
  return entries;
}
