// RULE-ABILITY-REQUIREMENT-001 — Implements INTENT-ABILITY-HAS-CIRCUMSTANCES-001 ·
//                                           INTENT-CIRCUMSTANCES-ARE-A-LIST-001 ·
//                                           INTENT-CIRCUMSTANCE-IS-DERIVED-NOT-RECORDED-001 ·
//                                           INTENT-REQUIREMENT-GATES-THE-ABILITY-001 ·
//                                           INTENT-REFUSAL-NAMES-THE-WORLD-001 ·
//                                           INTENT-ALLOCATION-OPENS-WHAT-IS-POSSIBLE-001 ·
//                                           INTENT-THE-GATE-DOES-NOT-ASK-WHO-DRIVES-001
// Input          Actor, SkillKind, Now, **지금 노리는 상대 (없을 수 있다)**
//                C-COMBAT-004 CHANGED — 관문이 상대를 받는다.
// Preconditions  없음 — 모든 기술에 답이 있다
// Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
// Result         Met(null) | Unmet(UnmetReason)
//
// 그 기술의 requires 를 **선언된 차례대로** 묻고 처음 거짓인 것의 사유를 돌려준다.
// 차례가 정해져 있으므로 둘이 함께 거짓이어도 사유는 언제나 같다
// (DC-COMBAT-PLAYER-CAUSALITY — 같은 상태면 같은 답).
//
// `other` 는 **지금 노리는 상대**다 (World.TargetSelections · C017). 부르는 쪽이 찾아
// 넘기며, 이 규칙도 사정도 "누가 고르고 있는가" 를 모른다. 아무도 고르지 않았으면
// 없고, 그때 상대를 읽는 사정은 갖춰지지 않은 것이다 — 모름을 참으로 두지 않는다.
//
// **관문이 본 상대와 실제로 닿는 몸은 다를 수 있다.** 관문은 걸 수 있는가만 답하며,
// 닿은 몸에 무슨 일이 일어나는지는 닿은 뒤에 정해진다
// (INTENT-THE-GATE-SEES-THE-CHOSEN-ONE-001).
//
// 이 규칙은 조종 주체를 묻지 않는다 — Input 에 누가 움직이는 몸인지가 없다.
//
// RULE-ABILITY-CONDITION-001 — Implements INTENT-CONDITION-AMPLIFIES-WITHOUT-GATING-001 ·
//                                         INTENT-CONDITION-CHOOSES-THE-FORCE-001 ·
//                                         INTENT-EACH-CIRCUMSTANCE-STANDS-ALONE-001 ·
//                                         INTENT-CONDITION-IN-THE-CAUSE-READING-001
// Input          공격자 Actor, 대상 Actor(없을 수 있다), SkillKind, Now
// Preconditions  없음 — 모든 기술에 답이 있다
// Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
// Result         Force(그 한 방의 위력 정의) · Met(참인 사정과 각자의 몫)
//
// 참인 조건들의 몫을 **위력 정의의 계수에** 더한다. 피해를 세는 식은 한 글자도 바뀌지
// 않는다 — 그 식이 받는 값이 달라질 뿐이다 (DC-COMBAT-ONE-FORMULA).
//
//     AttackRatio = 정의의 AttackRatio + Σ (참인 사정의 몫)
//
// 참인 사정이 없으면 `forceOfSkill(기술)` 과 **완전히 같은 값**이다.
// 사정마다 자기 몫이 있고 서로 곱해지지 않는다 — 겹침을 다루는 규칙이 이 세계에 없다.
//
// **대상마다 따로 돈다.** 한 휘두름이 둘에게 닿으면 "그 상대가 나를 먼저 쳤다" 는 몸마다
// 다른 답이고, 그래서 같은 휘두름이 한쪽에는 크게 다른 쪽에는 본래 크기로 들어간다 —
// C015 의 터짐이 몸마다 따로 도는 것과 같은 자리, 같은 이유다.

import type { ActorState } from '../semantic/actor';
import {
  abilityCircumstance,
  type CircumstanceNow,
  type CircumstanceUnmetReason,
} from '../semantic/circumstance';
import type { TargetDirectedFailureReason } from '../semantic/target-selection';
import { forceOfSkill, skillDefinition, type MetCondition, type SkillKind } from '../semantic/combat';
import type { Force } from '../semantic/item';

/** 갖춰졌으면 null, 아니면 처음 거짓인 사정의 사유 코드 */
export function ruleAbilityRequirement(
  actor: ActorState,
  kind: SkillKind,
  now: CircumstanceNow,
  other: ActorState | null = null,
): CircumstanceUnmetReason | TargetDirectedFailureReason | null {
  for (const id of skillDefinition(kind).requires) {
    const circumstance = abilityCircumstance(id);
    // C-COMBAT-004 — 상대를 읽는 사정인데 고른 상대가 없으면, 그 사정의 사유가 아니라
    // **고르지 않았다는 사유**를 낸다. 그러지 않으면 아무도 고르지 않았는데
    // "이미 표식을 남겨 두었다" 처럼 참이 아닌 말이 나간다
    // (DC-COMBAT-UNAVAILABLE-HAS-A-REASON — 사유는 읽을 수 있어야 한다).
    // 코드는 C017 이 이미 세운 것을 그대로 쓴다 — 새 말을 만들지 않는다.
    if (circumstance.readsOther && other === null) return 'no-target-selected';
    if (!circumstance.holds(actor, other, now)) return circumstance.unmetReason;
  }
  return null;
}

/** 그 기술의 조건 중 지금 참인 것들과 각자의 몫 (파생 — 저장하지 않는다) */
export function metConditions(
  actor: ActorState,
  other: ActorState | null,
  kind: SkillKind,
  now: CircumstanceNow,
): MetCondition[] {
  const met: MetCondition[] = [];
  for (const share of skillDefinition(kind).amplifiedBy) {
    if (!abilityCircumstance(share.circumstance).holds(actor, other, now)) continue;
    met.push({ id: share.circumstance, attackRatioShare: share.attackRatioShare });
  }
  return met;
}

export interface ConditionedForce {
  force: Force;
  conditions: MetCondition[];
}

export function ruleAbilityCondition(
  attacker: ActorState,
  target: ActorState | null,
  kind: SkillKind,
  now: CircumstanceNow,
): ConditionedForce {
  const conditions = metConditions(attacker, target, kind, now);
  const bonus = conditions.reduce((sum, c) => sum + c.attackRatioShare, 0);
  return { force: forceOfSkill(kind, bonus), conditions };
}
