// RULE-INVENTORY-ROOM-001 — Implements INTENT-CARRY-ROOM-IS-FINITE-001 ·
//                                      INTENT-ROOM-COST-COMES-FROM-THE-DEFINITION-001
// Input          Inventory
// Preconditions  없음 — 언제나 답할 수 있다
// Transition     없음 (읽기 판정)
// Result         UsedSlots = Σ_kind ⌈Count(kind) / StackLimit(kind)⌉
//
// C022 ADDED — **자리를 세는 유일한 자리다.**
//
// 분기가 하나도 없다. 겹치는 것과 겹치지 않는 것이 같은 식을 지난다 — StackLimit 이
// 1 이면 ⌈n/1⌉ = n 이고 그것이 곧 "하나가 자리 하나를 쓴다" 다. 규칙에 "겹치는가" 를
// 묻는 자리가 없으므로 정의가 답을 바꿔도 이 파일은 열리지 않는다.
//
// **UsedSlots 를 저장하지 않는다.** 저장하면 Items 와 UsedSlots 라는 두 개의 진실이
// 생기고 둘을 맞추는 책임이 모든 변경 지점에 흩어진다 — 그것이 정확히 변경 단일 통로가
// 없애려던 것이다 (03-world-semantic.md RATIONALE 1). 세는 비용은 지닌 종류 수에
// 비례하고 그 수는 자리 수를 넘지 못하므로 상수다.

import type { Inventory } from '../semantic/inventory';
import { itemDefinition, type ItemKind } from '../semantic/item';

/** 이 수량이 차지하는 자리 — 종류를 묻지 않는다. 정의가 한도를 답할 뿐이다 */
function slotsFor(kind: string, count: number): number {
  if (count <= 0) return 0;
  const definition = itemDefinition(kind);
  // 세계가 모르는 종류는 지닐 수 없다 — 담는 통로가 이미 막는다 (RULE-INVENTORY-ADD-001).
  // 그래도 세는 쪽이 무너지지 않도록 하나가 한 자리를 쓰는 것으로 본다.
  return Math.ceil(count / (definition?.stackLimit ?? 1));
}

/** 지금 쓰고 있는 자리 */
export function ruleInventoryRoom(inventory: Inventory): number {
  let used = 0;
  for (const [kind, count] of inventory.items) used += slotsFor(kind, count);
  return used;
}

/**
 * 그 종류를 그만큼 더 담았을 때의 자리.
 *
 * **더해 보고 세는 것이 아니라 그 종류의 자리만 다시 센다** — 겹침 한도 때문에
 * 이미 있는 수량과 합쳐야 정확한 값이 나오기 때문이다. 3 을 지닌 자리에 1 을 더하는
 * 것과 0 을 지닌 자리에 1 을 더하는 것은 드는 자리가 다르다.
 */
export function roomAfterAdd(inventory: Inventory, kind: string, count: number): number {
  const current = inventory.items.get(kind as ItemKind) ?? 0;
  return ruleInventoryRoom(inventory) - slotsFor(kind, current) + slotsFor(kind, current + count);
}
