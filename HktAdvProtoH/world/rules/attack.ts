// RULE-ATTACK-001 — Implements INTENT-ATTACK-001
// Input          Actor, TargetActorId
// Preconditions  1. 대상이 세계에 존재하고 자기 자신이 아니다
//                2. distance <= Actor.AttackRange
//                3. 현재 행동이 대체 가능하다
// Transition     CurrentAction = attack(TargetActorId)
// Result         Success | Failure(no-target | out-of-range | action-busy)
//
// 공격이 대상에게 미치는 효과는 C002 에 정의되지 않는다 (01-cycle.md EXCLUDED).
// 행동이 Duration 을 채우면 RULE-ACTION-PROGRESS-001 이 idle 로 되돌린다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_ATTACK } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { distance } from '../semantic/position';
import { findActor, type WorldState } from '../semantic/world-state';
import { beginAction, evaluateActionBegin } from './action-begin';

export type AttackFailureReason = 'no-target' | 'out-of-range' | 'action-busy';

// Precondition 평가 — Observable(Attack.Availability / Attack.FailureReason)과 공유한다.
export function evaluateAttackPreconditions(
  actor: ActorState,
  target: ActorState | undefined,
): AttackFailureReason | null {
  if (!target || target.id === actor.id) return 'no-target';
  if (distance(actor.position, target.position) > actor.attackRange) return 'out-of-range';
  return evaluateActionBegin(actor);
}

export function ruleAttack(
  state: WorldState,
  actor: ActorState,
  targetActorId: string,
): ActionResult {
  const target = findActor(state, targetActorId);
  const failure = evaluateAttackPreconditions(actor, target);
  if (failure) return { status: 'failure', rule: RULE_ATTACK, reason: failure };

  beginAction(actor, 'attack', { targetActorId });
  return { status: 'success', rule: RULE_ATTACK };
}
