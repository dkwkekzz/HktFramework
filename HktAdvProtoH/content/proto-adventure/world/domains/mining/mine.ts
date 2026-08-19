// RULE-MINE-001 — Implements INTENT-MINING-001 · INTENT-ACTION-STATE-001
// Input          Actor, Deposit
// Preconditions  1. Mining Capability Item 보유  2. InteractionRange 이내
//                3. ResourceAmount > 0          4. 현재 행동이 대체 가능하다
// Transition     CurrentAction = mine(Deposit)          ← C002 CHANGED (즉시 획득이 아니다)
// Result         Success | Failure(no-mining-tool | out-of-range | deposit-depleted | action-busy)
//
// RULE-MINE-COMPLETE-001 — Implements INTENT-MINING-001 · INTENT-ACTION-PROGRESS-001
// Input          채굴 행동이 Duration 을 채운 Actor
// Preconditions  대상 Deposit 의 ResourceAmount > 0
// Transition     ResourceAmount -= 1, Inventory.Items[stone].Count += 1
// Result         Success | Failure(deposit-depleted)

import type { ActionResult } from '../../../protocol/actions';
import { RULE_MINE, RULE_MINE_COMPLETE } from '../../../protocol/semantic-id';
import type { ActorState } from '../../base/actor';
import type { DepositState } from './deposit';
import { hasMiningTool, itemCount } from './inventory';
import { distance } from '../../base/position';
import { INTERACTION_RANGE, type WorldState } from '../../base/world-state';
import { beginAction, evaluateActionBegin } from '../../base/action-begin';

// 실패 사유 코드 — Rule 이 소유하며 protocol 로는 문자열 코드로 흐른다
export type MineFailureReason =
  | 'no-mining-tool'
  | 'out-of-range'
  | 'deposit-depleted'
  | 'action-busy';

// Precondition 평가 — Observable(Mine.Availability / Mine.FailureReason)과 Rule 이 같은 판정을 공유한다
export function evaluateMinePreconditions(
  actor: ActorState,
  deposit: DepositState,
): MineFailureReason | null {
  if (!hasMiningTool(actor.inventory)) return 'no-mining-tool';
  if (distance(actor.position, deposit.position) > INTERACTION_RANGE) return 'out-of-range';
  if (deposit.resourceAmount <= 0) return 'deposit-depleted';
  return evaluateActionBegin(actor);
}

export function ruleMine(state: WorldState, actor: ActorState, depositId: string): ActionResult {
  const deposit = state.deposits.find((d) => d.id === depositId);
  if (!deposit) return { status: 'failure', rule: RULE_MINE, reason: 'unknown-deposit' };

  const failure = evaluateMinePreconditions(actor, deposit);
  if (failure) return { status: 'failure', rule: RULE_MINE, reason: failure };

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
  actor.inventory.items.set('stone', itemCount(actor.inventory, 'stone') + 1);
  return { status: 'success', rule: RULE_MINE_COMPLETE };
}
