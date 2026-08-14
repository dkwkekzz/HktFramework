// RULE-ATTACK-001 — Implements INTENT-ATTACK-001
// Input          Actor
// Preconditions  현재 행동이 대체 가능하다
// Transition     CurrentAction = attack (대상을 담지 않는다), StruckActorIds = []
// Result         Success | Failure(action-busy)
//
// 공격은 대상을 향하지 않는다. 곁에 아무도 없어도, 아무리 멀리 있어도 휘두를 수 있다 —
// 휘두르는 것은 세계에 대고 하는 일이지 누구에게 하는 일이 아니다.
//
// C006 CHANGED — RULE-ATTACK-COMPLETE-001(완료 순간 일괄 판정)은 폐지됐다.
// 판정은 RULE-SWING-STRIKE-001 (simulation/swing-strike.ts) 이 휘두름 구간의
// 접촉 시점마다 한다. 무엇이 맞는지는 완료 순간이 아니라 접촉이 정한다.
//
// RULE-HIT-001 — Implements INTENT-HIT-REACTION-001
// Input          타격받은 Actor
// Preconditions  없음 — 피격은 상대의 사정을 묻지 않는다
// Transition     CurrentAction = hit (하던 행동을 중단시킨다)
// Result         Struck

import type { ActionResult } from '../../protocol/actions';
import { RULE_ATTACK } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
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
  // 이 휘두름이 타격한 몸들 — 비어 있는 채로 시작한다 (INTENT-SWING-IMPACT-001).
  actor.currentAction.struckActorIds = [];
  return { status: 'success', rule: RULE_ATTACK };
}

// RULE-HIT-001 — RULE-ACTION-BEGIN-001 을 거치지 않는 유일한 행동 진입이다.
// 피격은 그 캐릭터가 요청한 행동이 아니라 밖에서 일어난 일이기 때문이다.
// 이 예외는 여기 한 곳에만 있다.
export function ruleHit(target: ActorState): void {
  beginAction(target, 'hit');
}
