// RULE-MINE-001 — Implements INTENT-MINING-001
// Input          Actor, Deposit
// Preconditions  1. Mining Capability Item 보유  2. InteractionRange 이내  3. ResourceAmount > 0
// Transition     ResourceAmount -= 1, Inventory.Items[stone].Count += 1
// Result         Success | Failure(no-mining-tool | out-of-range | deposit-depleted)

import type { ActionResult } from '../../protocol/actions';
import { RULE_MINE } from '../../protocol/semantic-id';
import type { DepositState } from '../semantic/deposit';
import { hasMiningTool, itemCount } from '../semantic/inventory';
import { distance } from '../semantic/position';
import { INTERACTION_RANGE, type WorldState } from '../semantic/world-state';

// 실패 사유 코드 — Rule 이 소유하며 protocol 로는 문자열 코드로 흐른다
export type MineFailureReason = 'no-mining-tool' | 'out-of-range' | 'deposit-depleted';

// Precondition 평가 — Observable(Mine.Availability / Mine.FailureReason)과 Rule 이 같은 판정을 공유한다
export function evaluateMinePreconditions(
  state: WorldState,
  deposit: DepositState,
): MineFailureReason | null {
  if (!hasMiningTool(state.actor.inventory)) return 'no-mining-tool';
  if (distance(state.actor.position, deposit.position) > INTERACTION_RANGE) return 'out-of-range';
  if (deposit.resourceAmount <= 0) return 'deposit-depleted';
  return null;
}

export function ruleMine(state: WorldState, depositId: string): ActionResult {
  const deposit = state.deposits.find((d) => d.id === depositId);
  if (!deposit) return { status: 'failure', rule: RULE_MINE, reason: 'unknown-deposit' };

  const failure = evaluateMinePreconditions(state, deposit);
  if (failure) return { status: 'failure', rule: RULE_MINE, reason: failure };

  deposit.resourceAmount -= 1;
  state.actor.inventory.items.set('stone', itemCount(state.actor.inventory, 'stone') + 1);
  return { status: 'success', rule: RULE_MINE };
}
