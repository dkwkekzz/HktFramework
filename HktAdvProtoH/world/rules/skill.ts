// RULE-SKILL-BEGIN-001 — Implements INTENT-ATTACK-001(C007 CHANGED) ·
//                                   INTENT-SKILL-COST-GATE-001 · INTENT-DOWNED-001 ·
//                                   INTENT-TEMPO-ACTION-001
// Input          Actor, SkillKind
// Preconditions  1. Actor 가 쓰러지지 않았다
//                2. 막고 있지 않다 (C011 ADDED — 버티는 몸으로는 휘두르지 못한다)
//                3. 현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001 의 관문)
//                4. Cp >= SkillDefinition.CpCost × Modifiers.CpConsume
// Transition     CurrentAction = SkillKind (대상을 담지 않는다), StruckActorIds = [],
//                Duration = 공격 속도가 정한 길이
// Result         Success | Failure(downed | guarding | action-busy | insufficient-cp)
//
// C002 의 RULE-ATTACK-001 을 일반화한 것이다 — 휘두름은 이제 종류를 가진 스킬이며,
// 각 스킬은 자기 기력 수지와 고정 피해량과 행동 길이를 가진다.
//
// RULE-SKILL-BUDGET-001 — Implements INTENT-SKILL-BUDGET-001
// Input          공격자 Actor, SkillKind
// Preconditions  이 휘두름에서 아직 정산하지 않았다 (첫 타격에서만 정산한다)
// Transition     Cp = clamp(Cp + Charge × Modifiers.CpCharge - Cost × Modifiers.CpConsume, 0, CpMax)
// Result         Settled
//
// 허공을 가른 휘두름은 정산하지 않는다 — 맞아야 기력이 돈다 (붉은보석식 수지).

import type { ActionResult } from '../../protocol/actions';
import { RULE_SKILL_BEGIN, RULE_SKILL_BUDGET } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import {
  actorModifiers,
  clamp,
  isDowned,
  skillDefinition,
  skillDuration,
  type SkillKind,
} from '../semantic/combat';
import { beginAction, evaluateActionBegin, type ActionBusyReason } from './action-begin';

export type SkillFailureReason = ActionBusyReason | 'downed' | 'guarding' | 'insufficient-cp';

// Precondition 평가 — Observable(Skill.Availability / Skill.FailureReason)과 공유한다.
// 판정이 한 곳에만 있어야 "왜 안 되는가"와 실제 거절 사유가 어긋나지 않는다.
export function evaluateSkillPreconditions(
  actor: ActorState,
  kind: SkillKind,
): SkillFailureReason | null {
  if (isDowned(actor)) return 'downed';

  // C011 — 막기 판정을 행동 관문보다 **앞에** 둔다. 막고 있는 동안의 현재 행동은
  // 대체 가능한 idle 이나 move 인 경우가 대부분이라, 뒤에 두면 실제 사유가 드러나지 않고
  // "왜 안 나가는지" 를 알 수 없게 된다 (INTENT-GUARD-RESTRICT-001).
  if (actor.guarding) return 'guarding';

  const busy = evaluateActionBegin(actor);
  if (busy) return busy;

  const cost = skillDefinition(kind).cpCost * actorModifiers(actor).cpConsume;
  if (actor.cp < cost) return 'insufficient-cp';

  return null;
}

export function ruleSkillBegin(actor: ActorState, kind: SkillKind): ActionResult {
  const failure = evaluateSkillPreconditions(actor, kind);
  if (failure) return { status: 'failure', rule: RULE_SKILL_BEGIN, reason: failure };

  // 길이는 지금의 공격 속도가 정한다 (INTENT-TEMPO-ACTION-001).
  beginAction(actor, kind, {}, skillDuration(actor, kind));
  // 이 휘두름이 타격한 몸들 — 비어 있는 채로 시작한다 (C006 INTENT-SWING-IMPACT-001).
  actor.currentAction.struckActorIds = [];
  // 이 휘두름이 기력 수지를 이미 냈는가 — 첫 타격에서 한 번만 낸다 (C007).
  actor.currentAction.budgetSettled = false;
  return { status: 'success', rule: RULE_SKILL_BEGIN };
}

// 한 휘두름은 여러 몸을 때려도 기력 수지를 한 번만 낸다.
// 충전과 소모는 각자의 배율을 받아 같은 순간에 함께 적용된다 — 서로 상쇄하지 않는다.
export function ruleSkillBudget(actor: ActorState, kind: SkillKind): ActionResult | null {
  const action = actor.currentAction;
  if (action.budgetSettled) return null;

  const skill = skillDefinition(kind);
  const modifiers = actorModifiers(actor);
  const charged = skill.cpCharge * modifiers.cpCharge;
  const consumed = skill.cpCost * modifiers.cpConsume;

  actor.cp = clamp(actor.cp + charged - consumed, 0, actor.cpMax);
  action.budgetSettled = true;

  return { status: 'success', rule: RULE_SKILL_BUDGET };
}
