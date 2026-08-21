// RULE-MINE-001 — Implements INTENT-MINING-001 ·
//                            INTENT-TARGET-DIRECTS-THE-ACT-001 (C017) ·
//                            INTENT-ACTION-STATE-001
// Input          Actor, 요청한 ObserverId
//                C017 CHANGED — 요청이 대상을 싣지 않는다. 대상은 그 관찰자가 고른 것이다
//                (World.TargetSelections). 살펴봄과 같은 변화이며 이유도 같다 (TG §1).
// Preconditions  1. 그 관찰자가 고른 것이 있다      (no-target-selected)   ← C017 ADDED
//                2. 고른 것이 광맥이다             (target-kind-mismatch) ← C017 ADDED
//                   1·2 가 옛 unknown-deposit 을 대신한다
//                3. 이 몸에 채집 용도가 지금 있다   (no-mining-tool)   ← C020 CHANGED
//                   "곡괭이를 지녔는가" 가 아니라 "그 용도가 있는가" 를 묻는다.
//                   무엇이 그 용도를 주는지는 아이템 정의가 답한다 (RULE-BODY-USES-001).
//                   사유 코드는 **그대로 둔다** — 사람이 겪는 일이 달라지지 않았다
//                4. InteractionRange 이내          (out-of-range)
//                5. ResourceAmount > 0             (deposit-depleted)
//                6. 현재 행동이 대체 가능하다        (action-busy)
// Transition     CurrentAction = mine(Deposit)          ← C002 CHANGED (즉시 획득이 아니다)
// Result         Success | Failure(reason)
//
// C017 — 시작한 뒤에 다른 것을 고르면 진행 중인 채집은 원래 광맥을 끝까지 지닌다
// (CurrentAction.targetDepositId). 살펴봄과 같은 판단이다.
//
// RULE-MINE-COMPLETE-001 — Implements INTENT-MINING-001 · INTENT-ACTION-PROGRESS-001
// Input          채굴 행동이 Duration 을 채운 Actor
// Preconditions  대상 Deposit 의 ResourceAmount > 0
// Transition     ResourceAmount -= 1, RULE-INVENTORY-ADD-001(stone, 1)   ← C020 CHANGED
// Result         Success | Failure(deposit-depleted)

import type { ActionResult } from '../../protocol/actions';
import { RULE_MINE, RULE_MINE_COMPLETE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import type { DepositState } from '../semantic/deposit';
import { bodyHasUse } from './body-uses';
import { ruleInventoryAdd } from './inventory';
import { distance } from '../semantic/position';
import { selectedEntityId } from '../semantic/target-selection';
import { INTERACTION_RANGE, type WorldState } from '../semantic/world-state';
import { beginAction, evaluateActionBegin } from './action-begin';

// 실패 사유 코드 — Rule 이 소유하며 protocol 로는 문자열 코드로 흐른다
export type MineFailureReason =
  | 'no-target-selected' // C017 — 아무것도 고르지 않았다
  | 'target-kind-mismatch' // C017 — 고른 것이 캘 수 있는 것이 아니다
  | 'no-mining-tool'
  | 'out-of-range'
  | 'deposit-depleted'
  | 'action-busy';

// Precondition 평가 — Observable(Mine.Availability / Mine.FailureReason)과 Rule 이 같은 판정을 공유한다
export function evaluateMinePreconditions(
  actor: ActorState,
  deposit: DepositState,
): MineFailureReason | null {
  if (!bodyHasUse(actor, 'mine')) return 'no-mining-tool';
  if (distance(actor.position, deposit.position) > INTERACTION_RANGE) return 'out-of-range';
  if (deposit.resourceAmount <= 0) return 'deposit-depleted';
  return evaluateActionBegin(actor);
}

// C017 — 고른 것으로 캘 수 있는가. Observable(Mine.Availability / Mine.FailureReason)과
// Rule 이 같은 판정을 공유한다. 대상을 찾는 앞의 두 줄까지가 이 Cycle 이 더한 것이며,
// 그 뒤는 C001 이 세운 판정 그대로다.
export function evaluateMineTargeted(
  state: WorldState,
  actor: ActorState,
  observerId: string,
): MineFailureReason | null {
  const targetId = selectedEntityId(state.targetSelections, observerId);
  if (targetId === undefined) return 'no-target-selected';

  const deposit = state.deposits.find((d) => d.id === targetId);
  // 고른 것이 존재(character)면 캘 수 없다. "없는 광맥" 이 아니라 **종류가 맞지 않는** 것이다 —
  // 고르기 관문이 이미 그 존재가 세계에 있음을 보장했다 (RULE-TARGET-SELECT-001 P2).
  if (!deposit) return 'target-kind-mismatch';

  return evaluateMinePreconditions(actor, deposit);
}

export function ruleMine(
  state: WorldState,
  actor: ActorState,
  observerId: string,
): ActionResult {
  const failure = evaluateMineTargeted(state, actor, observerId);
  if (failure) return { status: 'failure', rule: RULE_MINE, reason: failure };

  const depositId = selectedEntityId(state.targetSelections, observerId)!;
  beginAction(actor, 'mine', { targetDepositId: depositId });
  return { status: 'success', rule: RULE_MINE };
}

// 채굴 행동의 완료 효과 — RULE-ACTION-PROGRESS-001 이 Duration 을 채운 시점에 호출한다.
// 실패해도 행동은 종료된다 (획득만 일어나지 않는다).
export function ruleMineComplete(state: WorldState, actor: ActorState): ActionResult {
  const depositId = actor.currentAction.targetDepositId;
  const deposit = state.deposits.find((d) => d.id === depositId);
  if (!deposit) return { status: 'failure', rule: RULE_MINE_COMPLETE, reason: 'unknown-deposit' };
  if (deposit.resourceAmount <= 0) {
    return { status: 'failure', rule: RULE_MINE_COMPLETE, reason: 'deposit-depleted' };
  }

  deposit.resourceAmount -= 1;
  // C020 CHANGED — 획득이 변경 단일 통로를 지난다 (INTENT-INVENTORY-SINGLE-CHANNEL-001).
  // 얻는 양도 시점도 그대로다.
  ruleInventoryAdd(actor, 'stone', 1);
  return { status: 'success', rule: RULE_MINE_COMPLETE };
}
