// RULE-ATTACK-001 — Implements INTENT-ATTACK-001
// Input          Actor
// Preconditions  현재 행동이 대체 가능하다
// Transition     CurrentAction = attack (대상을 담지 않는다)
// Result         Success | Failure(action-busy)
//
// 공격은 대상을 향하지 않는다. 곁에 아무도 없어도, 아무리 멀리 있어도 휘두를 수 있다 —
// 휘두르는 것은 세계에 대고 하는 일이지 누구에게 하는 일이 아니다.
//
// RULE-ATTACK-COMPLETE-001 — Implements INTENT-ATTACK-HIT-001
// Input          Actor (attack 이 Duration 을 채운 시점)
// Preconditions  없음 — 판정 자체는 언제나 일어난다
// Transition     AttackRange 안의 자신이 아닌 모든 Actor 에 RULE-HIT-001 을 적용
// Result         Struck(대상 수)
//
// 무엇이 맞는지는 휘두름이 끝나는 순간의 위치가 정한다. 시작 시점이 아니다.
//
// RULE-HIT-001 — Implements INTENT-HIT-REACTION-001
// Input          타격받은 Actor
// Preconditions  없음 — 피격은 상대의 사정을 묻지 않는다
// Transition     CurrentAction = hit (하던 행동을 중단시킨다)
// Result         Struck

import type { ActionResult } from '../../protocol/actions';
import { RULE_ATTACK } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { distance } from '../semantic/position';
import type { WorldState } from '../semantic/world-state';
import { beginAction, evaluateActionBegin, type ActionBusyReason } from './action-begin';

export type AttackFailureReason = ActionBusyReason;

// Precondition 평가 — Observable(Attack.Availability / Attack.FailureReason)과 공유한다.
// 남은 조건은 "지금 다른 행동에 묶여 있지 않은가" 하나뿐이다.
export function evaluateAttackPreconditions(actor: ActorState): AttackFailureReason | null {
  return evaluateActionBegin(actor);
}

export function ruleAttack(actor: ActorState): ActionResult {
  const failure = evaluateAttackPreconditions(actor);
  if (failure) return { status: 'failure', rule: RULE_ATTACK, reason: failure };

  beginAction(actor, 'attack');
  return { status: 'success', rule: RULE_ATTACK };
}

// 타격 범위 안의 대상들 — 관찰용·검증용으로도 쓰인다 (Rule 과 같은 판정을 공유).
// 순서는 World.Actors 순서를 따른다 (결정론).
export function struckActors(state: WorldState, attacker: ActorState): ActorState[] {
  return state.actors.filter(
    (other) =>
      other.id !== attacker.id &&
      distance(attacker.position, other.position) <= attacker.attackRange,
  );
}

// RULE-HIT-001 — RULE-ACTION-BEGIN-001 을 거치지 않는 유일한 행동 진입이다.
// 피격은 그 캐릭터가 요청한 행동이 아니라 밖에서 일어난 일이기 때문이다.
// 이 예외는 여기 한 곳에만 있다.
export function ruleHit(target: ActorState): void {
  beginAction(target, 'hit');
}

// 휘두름의 완료 효과 — RULE-ACTION-PROGRESS-001 이 Duration 을 채운 시점에 호출한다.
export function ruleAttackComplete(state: WorldState, attacker: ActorState): ActorState[] {
  const struck = struckActors(state, attacker);
  for (const target of struck) ruleHit(target);
  return struck;
}
