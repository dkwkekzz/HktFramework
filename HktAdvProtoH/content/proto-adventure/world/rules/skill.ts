// RULE-SKILL-BEGIN-001 — Implements INTENT-ATTACK-001(C007 CHANGED) ·
//                                   INTENT-SKILL-COST-GATE-001 · INTENT-DOWNED-001 ·
//                                   INTENT-TEMPO-ACTION-001
// Input          Actor, SkillKind, Now, 지금 노리는 상대
//                (C-COMBAT-003 CHANGED — 사정이 세계를 읽는다 ·
//                 C-COMBAT-004 CHANGED — 사정이 상대도 읽는다)
// Preconditions  1. Actor 가 쓰러지지 않았다
//                2. 막고 있지 않다 (C011 ADDED — 버티는 몸으로는 휘두르지 못한다)
//                3. 현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001 의 관문)
//                4. 그 기술의 요구 사정이 전부 참이다
//                   (C-COMBAT-003 ADDED — RULE-ABILITY-REQUIREMENT-001)
//                5. Cp >= SkillDefinition.CpCost × Modifiers.CpConsume
// Transition     CurrentAction = SkillKind (대상을 담지 않는다), StruckActorIds = [],
//                Duration = 공격 속도가 정한 길이
// Result         Success | Failure(downed | guarding | action-busy |
//                사정의 UnmetReason | insufficient-cp)
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
  EMPTY_NOW,
  type CircumstanceNow,
  type CircumstanceUnmetReason,
} from '../semantic/circumstance';
import {
  actorModifiers,
  clamp,
  isDowned,
  skillDefinition,
  skillDuration,
  type SkillKind,
} from '../semantic/combat';
import type { TargetDirectedFailureReason } from '../semantic/target-selection';
import { ruleAbilityRequirement } from './ability-circumstance';
import { beginAction, evaluateActionBegin, type ActionBusyReason } from './action-begin';

// C-COMBAT-003 CHANGED — 사유의 갈래가 넓어진다. 지금까지의 넷은 전부 **자기 몸의
// 사정**이었고, 이제 세계의 사실을 가리키는 코드가 실릴 수 있다. 그 코드의 단일 출처는
// 사정 목록이다 (semantic/circumstance.ts 의 unmetReason) — 여기에 열거하지 않는다
// (DC-WORLD-OWNS-THE-SURFACE-LIST).
export type SkillFailureReason =
  | ActionBusyReason
  | 'downed'
  | 'guarding'
  | 'insufficient-cp'
  | CircumstanceUnmetReason
  // C-COMBAT-004 — 상대를 읽는 요구인데 아무도 고르지 않았다. C017 이 세운 코드를
  // 그대로 쓴다 (새 말을 만들지 않는다).
  | TargetDirectedFailureReason;

// Precondition 평가 — Observable(Skill.Availability / Skill.FailureReason)과 공유한다.
// 판정이 한 곳에만 있어야 "왜 안 되는가"와 실제 거절 사유가 어긋나지 않는다.
export function evaluateSkillPreconditions(
  actor: ActorState,
  kind: SkillKind,
  now: CircumstanceNow = EMPTY_NOW,
  // C-COMBAT-004 — 지금 노리는 상대. 부르는 쪽이 찾아 넘긴다 (World.TargetSelections).
  // 자율 존재는 그 장부를 읽지 않으므로 언제나 없다 — 규칙이 조종 주체를 묻는 것이
  // 아니라 자율 존재가 아직 고르지 않기 때문이다 (03 JUDGEMENT ①).
  chosen: ActorState | null = null,
): SkillFailureReason | null {
  if (isDowned(actor)) return 'downed';

  // C011 — 막기 판정을 행동 관문보다 **앞에** 둔다. 막고 있는 동안의 현재 행동은
  // 대체 가능한 idle 이나 move 인 경우가 대부분이라, 뒤에 두면 실제 사유가 드러나지 않고
  // "왜 안 나가는지" 를 알 수 없게 된다 (INTENT-GUARD-RESTRICT-001).
  if (actor.guarding) return 'guarding';

  const busy = evaluateActionBegin(actor);
  if (busy) return busy;

  // C-COMBAT-003 — 사정을 **대가보다 앞에** 둔다 (RULE-ABILITY-REQUIREMENT-001).
  // 기력은 기다리면 차므로 "지금은 안 되지만 곧 된다" 이고, 사정은 만들러 가야 하므로
  // "지금 이 세계에서 이 기술은 성립하지 않는다" 이다. 뒤에 두면 힘을 잘못 몰아 둔 채
  // 기력만 모으는 사람에게 세계가 insufficient-cp 만 계속 말하게 되고, 그러면 관문이
  // 있다는 사실 자체가 보이지 않는다 (DC-COMBAT-UNAVAILABLE-HAS-A-REASON).
  // C011 이 막기를 행동 관문 앞에 둔 것과 같은 종류의 판단이다.
  const unmet = ruleAbilityRequirement(actor, kind, now, chosen);
  if (unmet) return unmet;

  const cost = skillDefinition(kind).cpCost * actorModifiers(actor).cpConsume;
  if (actor.cp < cost) return 'insufficient-cp';

  return null;
}

export function ruleSkillBegin(
  actor: ActorState,
  kind: SkillKind,
  now: CircumstanceNow = EMPTY_NOW,
  chosen: ActorState | null = null,
): ActionResult {
  const failure = evaluateSkillPreconditions(actor, kind, now, chosen);
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
