// RULE-MINE-001 — Implements INTENT-MINING-001 ·
//                            INTENT-TARGET-DIRECTS-THE-ACT-001 (C017) ·
//                            INTENT-ACTION-STATE-001
// Input          Actor, 요청한 ObserverId
//                C017 CHANGED — 요청이 대상을 싣지 않는다. 대상은 그 관찰자가 고른 것이다
//                (World.TargetSelections). 살펴봄과 같은 변화이며 이유도 같다 (TG §1).
// Preconditions  1. 그 관찰자가 고른 것이 있다      (no-target-selected)   ← C017 ADDED
//                2. 고른 것이 광맥이다             (target-kind-mismatch) ← C017 ADDED
//                   1·2 가 옛 unknown-deposit 을 대신한다
//                3. Mining Capability Item 보유    (no-mining-tool)
//                4. InteractionRange 이내          (out-of-range)
//                5. ResourceAmount > 0             (deposit-depleted)
//                6. 현재 행동이 대체 가능하다        (action-busy)
// Transition     CurrentAction = mine(Deposit)          ← C002 CHANGED (즉시 획득이 아니다)
// Result         Success | Failure(reason)
//
// C017 — 시작한 뒤에 다른 것을 고르면 진행 중인 채집은 원래 광맥을 끝까지 지닌다
// (CurrentAction.targetDepositId). 살펴봄과 같은 판단이다.
//
// RULE-MINE-COMPLETE-001 — Implements INTENT-MINING-001 (C020 CHANGED) ·
//                            INTENT-ACTION-PROGRESS-001
// Input          채굴 행동이 Duration 을 채운 Actor
// Preconditions  1. 대상 Deposit 의 ResourceAmount > 0     (deposit-depleted)
//                2. 그 자원 하나를 받을 자리가 있다          (carry-full)  ← C020 ADDED
// Transition     ResourceAmount -= 1 · RULE-CARRY-ADD-001 실행
// Result         Success | Failure(reason)
//
// C020 — 둘은 **함께 일어나거나 함께 일어나지 않는다.** 받지 못하면 광맥도 줄지 않는다.
// 받지 못한 자원이 세계에서 사라지면 "건네지 못한 것은 남는다" 가 깨진다
// (INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001).

import type { ActionResult } from '../../protocol/actions';
import { RULE_MINE, RULE_MINE_COMPLETE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import type { DepositState } from '../semantic/deposit';
import { carriedUses } from '../semantic/inventory';
import { evaluateCarryAdd, ruleCarryAdd } from './carry';
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
  | 'carry-full' // C020 — 받을 자리가 없다
  | 'action-busy';

// Precondition 평가 — Observable(Mine.Availability / Mine.FailureReason)과 Rule 이 같은 판정을 공유한다
export function evaluateMinePreconditions(
  actor: ActorState,
  deposit: DepositState,
): MineFailureReason | null {
  // C020 CHANGED — "든 것이 곡괭이인가" 가 아니라 "이 몸에 캐는 용도가 지금 있는가".
  // 캘 수 있는 새 도구가 생겨도 이 줄은 바뀌지 않는다
  // (INTENT-USE-COMES-FROM-DECLARATION-001 · DC-ITEM-CAPABILITY-COMES-FROM-GRANTS).
  if (!carriedUses(actor.inventory).has('mining')) return 'no-mining-tool';
  if (distance(actor.position, deposit.position) > INTERACTION_RANGE) return 'out-of-range';
  if (deposit.resourceAmount <= 0) return 'deposit-depleted';
  // C020 ADDED — 자리가 없으면 **캐기 시작하지도 않는다.** 1.2 초를 쓰고 나서 받지
  // 못하는 것보다 시작 전에 사유와 함께 거절되는 편이 관찰로도 플레이로도 낫다.
  // 고갈 판정 뒤에 온다 — 고갈된 광맥에서는 자리 이야기가 나오지 않는다.
  if (evaluateCarryAdd(actor.inventory, deposit.resourceKind, 1) === 'carry-full') {
    return 'carry-full';
  }
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
  // C020 — 시작 판정(P6)과 **같은 함수**를 쓴다. 두 곳이 각자 세면 갈린다.
  // 여기서 또 검사하는 이유는 캐는 1.2 초 사이에 자리가 찰 수 있기 때문이다.
  const noRoom = evaluateCarryAdd(actor.inventory, deposit.resourceKind, 1);
  if (noRoom) return { status: 'failure', rule: RULE_MINE_COMPLETE, reason: noRoom };

  // 받은 뒤에 광맥을 줄인다 — 받기가 실패하면 광맥도 그대로다.
  const added = ruleCarryAdd(actor, deposit.resourceKind, 1);
  if (added.status === 'failure') {
    return { status: 'failure', rule: RULE_MINE_COMPLETE, reason: added.reason };
  }
  deposit.resourceAmount -= 1;
  return { status: 'success', rule: RULE_MINE_COMPLETE };
}
