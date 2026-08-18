// RULE-DAMAGE-CALCULATE-001 — Implements INTENT-DAMAGE-CALCULATE-001 ·
//                              INTENT-DAMAGE-TYPE-001 · INTENT-TYPED-OFFENSE-001 ·
//                              INTENT-TYPED-DEFENSE-001 · INTENT-SKILL-SCALING-001 ·
//                              INTENT-DAMAGE-BREAKDOWN-001
// Input          공격자 Actor, 대상 Actor, SkillKind
// Preconditions  없음 — 이것은 값을 정하는 계산이며 세계를 바꾸지 않는다
// Transition     없음 (World State 를 변경하지 않는다)
// Result         DamageBreakdown
//
//     Step 0 (C012 ADDED) — 타입 대응
//         DamageType  = Skill.DamageType
//         OffenseStat = physical 이면 Attacker.PhysicalAttack · aura 면 Attacker.AuraAttack
//         DefenseStat = physical 이면 Target.Armor        · aura 면 Target.Resistance
//
//     Step 1~2 (C010 그대로 — 한 줄도 바뀌지 않았다)
//         AttackContribution = OffenseStat × Skill.AttackRatio
//         RawDamage          = Skill.BaseDamage + AttackContribution
//         DefenseMultiplier  = DefenseConstant / (DefenseConstant + DefenseStat)
//         FinalDamage        = round(RawDamage × DefenseMultiplier), RawDamage > 0 이면 최소 1
//
// 이것이 세계의 **유일한** 피해 계산이다 (DC-COMBAT-ONE-FORMULA).
// C012 가 더한 것은 새 공식이 아니라 **입력을 고르는 단계 하나**다 —
// 방식마다 다른 계산이 있는 것이 아니라, 하나의 계산이 방식에 따라 다른 값을 받는다.
// 그래서 아래 Step 1~2 에는 damageType 이 등장하지 않는다. 그것이 이 층의 경계다.
//
// 방식이 피해에 배율을 더하거나 빼지 않는다. 타입 보너스도 상성표도 면역도 없다 —
// 결과의 차이는 오직 고른 두 값의 크기에서만 나온다 (DC-COMBAT-MATCHUP-SOFT).
//
// 앞으로의 전투 시스템도 새 공식을 만들지 않고 이 공식의 입력값이나 결과값에
// 한 가지 의미만 더한다 — Critical 은 FinalDamage 를, Guard 는 FinalDamage 를
// (RULE-GUARD-BLOCK-001, 이 함수 밖에서), Penetration 은 고른 DefenseStat 을,
// Aura 는 고른 OffenseStat 을 건드리는 식이다.
//
// 입력에 세계 시각도 난수원도 없다 — 같은 공격자·같은 스킬·같은 대상이면
// 언제나 같은 값이 나온다 (DC-COMBAT-PLAYER-CAUSALITY).
// Resistance 는 막아낼 **확률**이 아니라 Armor 와 같은 감쇄식에 들어가는 값이다.

import type { ActorState } from '../semantic/actor';
import {
  DAMAGE_TYPE_STATS,
  defenseMultiplier,
  defenseStatValue,
  offenseStatValue,
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

  // ── Step 0 — 타입 대응 (C012) ────────────────────────────────────
  // 대응표가 단일 출처다. 여기에 방식별 if 를 늘리지 않는다.
  // 고르지 않은 두 능력은 이 아래에서 한 번도 읽히지 않는다.
  const type = skill.damageType;
  const stats = DAMAGE_TYPE_STATS[type];
  const offenseValue = offenseStatValue(attacker, type);
  const defenseValue = defenseStatValue(target, type);

  // ── Step 1~2 — C010 의 계산 (무변경) ─────────────────────────────
  const attackContribution = offenseValue * skill.attackRatio;
  const raw = skill.baseDamage + attackContribution;

  const multiplier = defenseMultiplier(defenseValue);

  // 하한 1 은 "방어는 줄일 뿐 없애지 못한다" 를 반올림이 깨뜨리지 못하게 하는 것이다
  // (INTENT-TYPED-DEFENSE-001). 애초에 낼 피해가 없으면(raw <= 0) 없는 피해를 만들지 않는다.
  const finalDamage = raw > 0 ? Math.max(1, Math.round(raw * multiplier)) : 0;

  return {
    damageType: type,
    offenseStat: { name: stats.offense, value: offenseValue },
    baseDamage: skill.baseDamage,
    attackContribution,
    rawDamage: raw,
    defenseStat: { name: stats.defense, value: defenseValue },
    defenseMultiplier: multiplier,
    finalDamage,
    // C011 — 이 계산은 막기를 모른다. 막지 않은 타격의 값을 미리 채워 두고,
    // 막힌 타격이면 RULE-STRIKE-DAMAGE-001 이 RULE-GUARD-BLOCK-001 의 결과로 덮는다.
    // C012 — 막기는 방식을 읽지 않는다. 오라 타격도 물리 타격과 똑같이 처리된다.
    appliedDamage: finalDamage,
  };
}
