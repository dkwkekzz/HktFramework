// RULE-DAMAGE-CALCULATE-001 — Implements INTENT-DAMAGE-CALCULATE-001 ·
//                              INTENT-ATTACK-POWER-001 · INTENT-DEFENSE-001 ·
//                              INTENT-SKILL-SCALING-001
// Input          공격자 Actor, 대상 Actor, SkillKind
// Preconditions  없음 — 이것은 값을 정하는 계산이며 세계를 바꾸지 않는다
// Transition     없음 (World State 를 변경하지 않는다)
// Result         DamageBreakdown
//
//     AttackContribution = Attacker.Attack × Skill.AttackRatio
//     RawDamage          = Skill.BaseDamage + AttackContribution
//     DefenseMultiplier  = DefenseConstant / (DefenseConstant + Target.Defense)
//     FinalDamage        = round(RawDamage × DefenseMultiplier), RawDamage > 0 이면 최소 1
//
// 이것이 세계의 **유일한** 피해 계산이다 (DC-COMBAT-ONE-FORMULA).
// 앞으로의 전투 시스템은 새 공식을 만들지 않고 이 공식의 입력값이나 결과값에
// 한 가지 의미만 더한다 — Critical 은 FinalDamage 를, Guard 는 FinalDamage 를,
// Penetration 은 Target.Defense 를, Aura 는 Attack/Defense 를 건드리는 식이다.
//
// C011 정정 — 위 목록의 Guard 자리를 고쳤다. C010 은 "Guard 는 DefenseMultiplier 를"
// 이라고 앞을 내다보며 적었지만 설계 원본은 그렇지 않다
// (R1 핵심 원칙 `Guard → Final Damage 를 감소시킨다`, §14 `Guard → Damage Taken × 0.5`).
// 실제 구현은 RULE-GUARD-BLOCK-001 (rules/guard.ts) 이며 이 함수 밖에서 결과값에 작용한다 —
// 그래서 이 계산은 C011 에서도 한 줄도 바뀌지 않았다.
//
// 입력에 세계 시각도 난수원도 없다 — 같은 공격자·같은 스킬·같은 대상이면
// 언제나 같은 값이 나온다 (DC-COMBAT-PLAYER-CAUSALITY).

import type { ActorState } from '../semantic/actor';
import {
  defenseMultiplier,
  skillDefinition,
  type DamageBreakdown,
  type SkillKind,
} from '../semantic/combat';

export function ruleDamageCalculate(
  attacker: ActorState,
  target: ActorState,
  kind: SkillKind,
): DamageBreakdown {
  const skill = skillDefinition(kind);

  const attackContribution = attacker.attack * skill.attackRatio;
  const raw = skill.baseDamage + attackContribution;

  const multiplier = defenseMultiplier(target);

  // 하한 1 은 "방어는 줄일 뿐 없애지 못한다" 를 반올림이 깨뜨리지 못하게 하는 것이다
  // (INTENT-DEFENSE-001). 애초에 낼 피해가 없으면(raw <= 0) 없는 피해를 만들지 않는다.
  const finalDamage = raw > 0 ? Math.max(1, Math.round(raw * multiplier)) : 0;

  return {
    baseDamage: skill.baseDamage,
    attackContribution,
    rawDamage: raw,
    targetDefense: target.defense,
    defenseMultiplier: multiplier,
    finalDamage,
    // C011 — 이 계산은 막기를 모른다. 막지 않은 타격의 값을 미리 채워 두고,
    // 막힌 타격이면 RULE-STRIKE-DAMAGE-001 이 RULE-GUARD-BLOCK-001 의 결과로 덮는다.
    appliedDamage: finalDamage,
  };
}
