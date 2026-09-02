// World Semantic — Inventory.Items
// World Authority — 변경은 World Rule 의 Transition 에서만 일어난다.
//
// **담는 형은 plain object 다 — Map 이 아니다.** 팩 State 는 그대로 스냅샷에 담기고
// 그 스냅샷은 JSON 으로 저장되므로(server/world-store.ts), State 에 Map 이 있으면
// 저장될 때 `{}` 로 납작해지고 복구된 세계가 첫 Tick 에 죽는다.
// 이것은 이 파일의 취향이 아니라 기반이 팩에게 요구하는 계약이다
// (engine/world-kernel/persistence.ts — "함수·클래스·Map 금지").

import { hasMiningCapability, type ItemKind } from './item';

export interface Inventory {
  items: Partial<Record<ItemKind, number>>; // Item.Kind 별 Count
}

export function createInventory(initial: Partial<Record<ItemKind, number>> = {}): Inventory {
  const items: Partial<Record<ItemKind, number>> = {};
  for (const [kind, count] of Object.entries(initial)) {
    if (count && count > 0) items[kind as ItemKind] = count;
  }
  return { items };
}

export function itemCount(inventory: Inventory, kind: ItemKind): number {
  return inventory.items[kind] ?? 0;
}

/** 수량을 정한다 — 0 이하면 자리를 지운다 (지니지 않은 것은 실리지 않는다) */
export function setItemCount(inventory: Inventory, kind: ItemKind, count: number): void {
  if (count > 0) inventory.items[kind] = count;
  else delete inventory.items[kind];
}

export function hasMiningTool(inventory: Inventory): boolean {
  for (const [kind, count] of Object.entries(inventory.items)) {
    if (count && count > 0 && hasMiningCapability(kind as ItemKind)) return true;
  }
  return false;
}
