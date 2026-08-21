// RULE-WORLD-ACQUIRABLE-KINDS-001 — Implements INTENT-NO-SELF-INFLICTED-DEAD-END-001
// Input          World
// Preconditions  없음
// Transition     없음 (읽기 판정)
// Result         { d.ResourceKind | d ∈ Deposits, d.ResourceAmount > 0 }
//
// C022 ADDED — **"세계가 지금 다시 내어줄 수 있는가" 의 유일한 답이다.**
//
// 마른 광맥은 세지 않는다. "지금" 이 중요한 이유는 이 판정이 되돌릴 수 없는 막힘을
// 막는 데 쓰이기 때문이다 — 다시 낼 수 없게 된 것을 낼 수 있다고 답하면 그 막힘이
// 그대로 통과한다.
//
// 새 획득 경로(제작 · 전리품 · 주고받기)가 세계에 생기면 이 함수에 줄이 하나 늘고,
// 이것을 읽는 쪽(RULE-ITEM-DISCARD-001)은 열리지 않는다.

import type { WorldState } from '../semantic/world-state';
import { itemDefinition, type ItemUseTag } from '../semantic/item';

export function ruleWorldAcquirableKinds(state: WorldState): ReadonlySet<string> {
  const kinds = new Set<string>();
  for (const deposit of state.deposits) {
    if (deposit.resourceAmount > 0) kinds.add(deposit.resourceKind);
  }
  return kinds;
}

/** 세계가 이 용도를 다시 지니게 해 줄 수 있는가 — 종류 이름을 묻지 않는다 */
export function worldCanRestoreUse(state: WorldState, use: ItemUseTag): boolean {
  for (const kind of ruleWorldAcquirableKinds(state)) {
    if (itemDefinition(kind)?.uses.includes(use)) return true;
  }
  return false;
}
