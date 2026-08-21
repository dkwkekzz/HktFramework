// RULE-BODY-USES-001           — Implements INTENT-CAPABILITY-FROM-DECLARED-USE-001 ·
//                                           INTENT-ONLY-THE-APPLIED-GIVES-001
// Input          Actor
// Preconditions  없음 — 언제나 답할 수 있다
// Transition     없음 (읽기 판정)
// Result         Uses = ⋃ { 정의(Equipment[slot]).Uses | slot ∈ Equipment }
//
// RULE-BODY-GRANTABLE-USES-001 — Implements INTENT-NO-SELF-INFLICTED-DEAD-END-001
// Result         Grantable = ⋃ { 정의(k).Uses | k ∈ Items ∪ Equipment }
//
// C020 ADDED — **"이 몸에 그 용도가 지금 있는가" 의 유일한 답이다.**
// C023 CHANGED — **묻는 문장도 부르는 쪽도 열리지 않았다. 훑는 곳만 바뀌었다.**
//
// 지금까지 채집은 "곡괭이를 지녔는가" 를 물었고, C020 이 그것을 "이 몸에 채집 용도가
// 있는가" 로 옮겼다. 그러나 그 답은 여전히 **소지품**에서 나왔다 — 가지고만 있어도
// 캐졌다는 뜻이며, 그것이 DC-ITEM-HOLDING-IS-NOT-APPLYING 이 금지하는 형태다.
// 이제 답은 **걸린 것**에서 나온다. 곡괭이는 걸어야 캘 수 있다.
//
// 아래 둘을 가르는 것이 이 Cycle 의 핵심이다.
//
//     지금 있는 용도      걸린 것들이 준다        — 할 수 있는 일을 정한다
//     지닐 수 있는 용도    가방과 자리 양쪽이 준다  — 막힘 판정에만 쓴다
//
// **가르지 않으면 막힘 판정이 무너진다.** 용도가 걸린 것에서만 오면, 가방의 곡괭이를
// 덜어내는 일은 "지금 있는 용도" 를 하나도 잃지 않는다 — 아무것도 걸지 않았다면 애초에
// 잃을 것이 없기 때문이다. 그러면 곡괭이를 풀어 가방에 두고 덜어내는 순간 세계에서
// 채집이 영영 사라진다 (03-world-semantic.md RATIONALE 3).

import type { ActorState } from '../semantic/actor';
import { equippedKinds } from '../semantic/equipment';
import { itemDefinition, type ItemUseTag } from '../semantic/item';

/** 지금 이 몸이 지닌 용도 — **걸린 것만이 준다** */
export function ruleBodyUses(actor: ActorState): ReadonlySet<ItemUseTag> {
  const uses = new Set<ItemUseTag>();
  for (const kind of equippedKinds(actor.equipment)) {
    for (const use of itemDefinition(kind)?.uses ?? []) uses.add(use);
  }
  return uses;
}

/**
 * 이 몸이 **지닐 수 있는** 용도 — 가방과 자리 양쪽을 본다.
 *
 * 지금 쓸 수 있는가가 아니라 "이 몸이 이 용도로 돌아갈 길이 있는가" 를 답한다.
 * 막힘 판정(RULE-ITEM-DISCARD-001)만이 읽는다 — 할 수 있는 일을 정하지 않는다.
 */
export function ruleBodyGrantableUses(actor: ActorState): ReadonlySet<ItemUseTag> {
  const uses = new Set<ItemUseTag>();
  for (const [kind, count] of actor.inventory.items) {
    if (count <= 0) continue;
    for (const use of itemDefinition(kind)?.uses ?? []) uses.add(use);
  }
  for (const kind of equippedKinds(actor.equipment)) {
    for (const use of itemDefinition(kind)?.uses ?? []) uses.add(use);
  }
  return uses;
}

/** 지금 이 몸에 그 용도가 있는가 */
export function bodyHasUse(actor: ActorState, use: ItemUseTag): boolean {
  return ruleBodyUses(actor).has(use);
}
