// World Semantic — Inventory.Items (C001 ADDED)
// World Authority — 변경은 World Rule 의 Transition 에서만 일어난다.

import { hasMiningCapability, type ItemKind } from './item';

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

export function hasMiningTool(inventory: Inventory): boolean {
  for (const [kind, count] of inventory.items) {
    if (count > 0 && hasMiningCapability(kind)) return true;
  }
  return false;
}
