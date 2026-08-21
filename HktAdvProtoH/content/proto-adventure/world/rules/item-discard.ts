// RULE-ITEM-DISCARD-001 — Implements INTENT-DISCARD-ITEM-001 ·
//                                    INTENT-DISCARD-LEAVES-NOTHING-BEHIND-001 ·
//                                    INTENT-NO-SELF-INFLICTED-DEAD-END-001
// Input          World, Actor, ItemKind
// Preconditions  1. 그 종류의 정의가 있다                           (unknown-item)
//                2. Items[kind] > 0                                (not-enough)
//                3. 덜어내면 사라지는 용도 중, 세계가 되돌려줄 수
//                   없는 것이 하나도 없다                            (no-way-back)
// Transition     RULE-INVENTORY-REMOVE-001(kind, Items[kind])
// Result         Success | Failure(reason)
//
// C022 ADDED — **플레이어가 조건 없이 스스로 줄이는 첫 경로다.**
//
// 쓰는 것(C020)은 고른 대상이 있어야 하고 사거리 안이어야 하고 대상 종류가 맞아야
// 한다 — 그래서 자리를 비우려 할 때 기댈 수 있는 수단이 아니다. 덜어내기는 몸 밖의
// 무엇도 요구하지 않으며, 그것이 이 규칙이 있어야 하는 이유의 전부다.
//
// **그 종류를 전부 덜어낸다.** 자리 하나 아래로 내려가면 자리가 비지 않으며, 수량을
// 나누어 다루는 것은 배치 조작(01-cycle.md EXCLUDED)이다. 고르는 것은 수가 아니라
// 무엇을 놓을 것인가다.
//
// **시간을 쓰지 않는다.** Action 얼개를 지나지 않고 하던 행동을 끊지도 않는다.
// 자리를 비우는 일에 시간을 주면 "비우려다 끊겨서 못 비운다" 는 새 막힘이 생긴다 —
// 덜어내기는 막힘의 출구이므로 그 자신이 막힐 수 있어서는 안 된다.
//
// **덜어낸 것은 세계에 놓이지 않는다.** 위치를 가진 아이템이 세계에 생기면 이 Transition
// 에 한 줄이 더해질 뿐, 덜어낸다는 행동 자체는 그대로 선다 (IS §6 Cycle 4).

import type { ActionResult } from '../../protocol/actions';
import { RULE_ITEM_DISCARD } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { itemCount } from '../semantic/inventory';
import { itemDefinition, type ItemKind } from '../semantic/item';
import type { WorldState } from '../semantic/world-state';
import { worldCanRestoreUse } from './acquirable-kinds';
import { ruleBodyUses } from './body-uses';
import { ruleInventoryRemove } from './inventory';

export type ItemDiscardFailureReason = 'unknown-item' | 'not-enough' | 'no-way-back';

/**
 * 이것을 전부 덜어내면 이 몸에서 사라지는 용도들.
 *
 * 남은 것들이 같은 용도를 주면 사라지지 않는다 — 곡괭이 둘 중 하나를 덜어내는 것은
 * 아무 용도도 잃지 않는 일이다. 그래서 규칙이 "곡괭이인가" 를 묻지 않아도 옳게 답한다.
 */
function usesLostByDiscarding(actor: ActorState, kind: string): string[] {
  const before = ruleBodyUses(actor);
  const remaining = new Set<string>();
  for (const [other, count] of actor.inventory.items) {
    if (other === kind || count <= 0) continue;
    for (const use of itemDefinition(other)?.uses ?? []) remaining.add(use);
  }
  return [...before].filter((use) => !remaining.has(use));
}

/**
 * Observable(소지품 항목의 덜어내기 가능/사유)과 Rule 이 **같은 판정을 공유한다.**
 * 화면에서 불가로 보이는 것을 억지로 요청해도 같은 사유로 거절된다.
 */
export function evaluateItemDiscard(
  state: WorldState,
  actor: ActorState,
  kind: string,
): ItemDiscardFailureReason | null {
  if (!itemDefinition(kind)) return 'unknown-item';
  if (itemCount(actor.inventory, kind as ItemKind) <= 0) return 'not-enough';

  // 되돌릴 수 없는 막힘을 스스로 만들 수 없다.
  //
  // **종류 이름이 여기 한 번도 나오지 않는다.** 곡괭이를 막는 것이 아니라 "돌아올 길이
  // 없어지는 것" 을 막는다. 곡괭이를 내는 광맥이 세계에 생기면 그날부터 곡괭이는
  // 저절로 덜어낼 수 있게 되고, 이 규칙은 한 줄도 열리지 않는다.
  for (const use of usesLostByDiscarding(actor, kind)) {
    if (!worldCanRestoreUse(state, use as never)) return 'no-way-back';
  }
  return null;
}

export function ruleItemDiscard(
  state: WorldState,
  actor: ActorState,
  kind: string,
): ActionResult {
  const failure = evaluateItemDiscard(state, actor, kind);
  if (failure) return { status: 'failure', rule: RULE_ITEM_DISCARD, reason: failure };

  // 줄이는 것은 단일 통로를 지난다 (INTENT-INVENTORY-SINGLE-CHANNEL-001).
  // 이 규칙이 Map 을 직접 고치지 않는다.
  const removal = ruleInventoryRemove(actor, kind, itemCount(actor.inventory, kind as ItemKind));
  if (removal.status === 'failure') {
    return { status: 'failure', rule: RULE_ITEM_DISCARD, reason: removal.reason };
  }
  return { status: 'success', rule: RULE_ITEM_DISCARD };
}
