// RULE-BODY-USES-001 — Implements INTENT-CAPABILITY-FROM-DECLARED-USE-001
// Input          Actor
// Preconditions  없음 — 언제나 답할 수 있다
// Transition     없음 (읽기 판정)
// Result         Uses = ⋃ { 정의(kind).Uses | Items[kind] > 0 }
//
// C020 ADDED — **"이 몸에 그 용도가 지금 있는가" 의 유일한 답이다.**
//
// 지금까지 채집은 "곡괭이를 지녔는가" 를 물었다. 그것은 아이템 하나가 늘 때마다
// 규칙이 함께 늘어나는 형태다. 이제 규칙은 용도를 묻고, 무엇이 그 용도를 주는지는
// 아이템 정의가 답한다 (DC-ITEM-CAPABILITY-COMES-FROM-GRANTS · HISTORY Q30).
//
// 그러므로 두 번째 채집 도구가 생기는 일은 ITEM_CATALOG 에 항목이 하나 늘어나는 일이며,
// 채집 규칙도 화면 계약도 채집의 시험도 열리지 않는다.

import type { ActorState } from '../semantic/actor';
import { itemDefinition, type ItemUseTag } from '../semantic/item';

export function ruleBodyUses(actor: ActorState): ReadonlySet<ItemUseTag> {
  const uses = new Set<ItemUseTag>();
  for (const [kind, count] of actor.inventory.items) {
    if (count <= 0) continue;
    for (const use of itemDefinition(kind)?.uses ?? []) uses.add(use);
  }
  return uses;
}

/** 지금 이 몸에 그 용도가 있는가 */
export function bodyHasUse(actor: ActorState, use: ItemUseTag): boolean {
  return ruleBodyUses(actor).has(use);
}
