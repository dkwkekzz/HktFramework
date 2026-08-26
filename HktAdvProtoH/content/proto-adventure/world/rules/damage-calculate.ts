// RULE-DAMAGE-CALCULATE-001 — Implements INTENT-DAMAGE-CALCULATE-001 ·
//                              INTENT-DAMAGE-TYPE-001 · INTENT-TYPED-OFFENSE-001 ·
//                              INTENT-TYPED-DEFENSE-001 · INTENT-SKILL-SCALING-001 ·
//                              INTENT-DAMAGE-BREAKDOWN-001 · INTENT-PENETRATION-001 ·
//                              INTENT-PENETRATION-MATCH-001 · INTENT-EFFECTIVE-DEFENSE-001
// Input          공격자 Actor, 대상 Actor, **Force**(BaseDamage · AttackRatio · DamageType)
//                C020 CHANGED — 입력이 SkillKind 에서 위력 정의로 넓어졌다. 스킬은 자기
//                정의가 지닌 값을 넘겨 주고(forceOfSkill), 물건은 자기 정의가 지닌 값을
//                넘겨 준다. **식은 한 글자도 바뀌지 않는다** — 같은 입력이면 이 Cycle
//                전후로 같은 값이 나온다 (DC-COMBAT-ONE-FORMULA).
// Preconditions  없음 — 이것은 값을 정하는 계산이며 세계를 바꾸지 않는다
// Transition     없음 (World State 를 변경하지 않는다)
// Result         DamageCalculation — 흔들림도 막기도 모르는, 판정 이전의 값
//
//     Step 0 (C012 ADDED) — 타입 대응
//         DamageType  = Skill.DamageType
//         OffenseStat = physical 이면 Attacker.PhysicalAttack · aura 면 Attacker.AuraAttack
//         DefenseStat = physical 이면 Target.Armor        · aura 면 Target.Resistance
//
//     Step 1 (C013 ADDED) — 관통 대응과 걷어내기
//         PenetrationStat  = physical 이면 Attacker.ArmorPenetration
//                            aura 면      Attacker.ResistancePenetration
//         EffectiveDefense = DefenseStat × PenetrationConstant /
//                            (PenetrationConstant + PenetrationStat)
//
//     Step 2~3 (C010 식 그대로 — 입력만 바뀐다)
//         AttackContribution = OffenseStat × Skill.AttackRatio
//         RawDamage          = Skill.BaseDamage + AttackContribution
//         DefenseMultiplier  = DefenseConstant / (DefenseConstant + EffectiveDefense)
//         FinalDamage        = round(RawDamage × DefenseMultiplier), RawDamage > 0 이면 최소 1
//
// 이것이 세계의 **유일한** 피해 계산이다 (DC-COMBAT-ONE-FORMULA).
// C012 가 더한 것은 새 공식이 아니라 **입력을 고르는 단계 하나**다 —
// 방식마다 다른 계산이 있는 것이 아니라, 하나의 계산이 방식에 따라 다른 값을 받는다.
// 그래서 아래 Step 2~3 에는 damageType 이 등장하지 않는다. 그것이 이 층의 경계다.
//
// C013 이 더한 것도 새 공식이 아니라 **그 방어 값에 얹힌 의미 하나**다 —
// 고른 방어가 감쇄식에 들어가기 전에 관통이 자기 몫을 걷어낸다. 걷는 데 쓰는 곡선은
// 세계에 이미 있는 그 곡선이며(100/(100+x)), 여기서는 피해가 아니라 방어 값에 걸린다.
// 그래서 아래 Step 2~3 에는 penetrationStat 이 등장하지 않는다.
// 관통은 RawDamage 를 한 톨도 키우지 않는다 — 때리는 힘이 아니라
// 상대 방어의 값어치를 떨어뜨리는 값이다 (INTENT-DAMAGE-CALCULATE-001).
//
// 방식이 피해에 배율을 더하거나 빼지 않는다. 타입 보너스도 상성표도 면역도 없다 —
// 결과의 차이는 오직 고른 두 값의 크기에서만 나온다 (DC-COMBAT-MATCHUP-SOFT).
//
// 앞으로의 전투 시스템도 새 공식을 만들지 않고 이 공식의 입력값이나 결과값에
// 한 가지 의미만 더한다 — Critical 은 FinalDamage 를 (C015 —
// RULE-CRITICAL-STRIKE-001, 이 함수 밖에서), Guard 는 FinalDamage 를
// (RULE-GUARD-BLOCK-001, 이 함수 밖에서), Penetration 은 고른 DefenseStat 을 (C013 — Step 1),
// Aura 는 고른 OffenseStat 을 건드리는 식이다.
//
// 입력에 세계 시각도 난수원도 없다 — 같은 공격자·같은 스킬·같은 대상이면
// 언제나 같은 값이 나온다. C015 가 세계에 흔들림을 들인 뒤에도 **이 계산만은
// 그대로다** — 흔들리는 것은 이 값이 아니라 이 값에 얹히는 판정이다
// (DC-COMBAT-PLAYER-CAUSALITY · INTENT-DAMAGE-CALCULATE-001 CHANGED).
// Resistance 는 막아낼 **확률**이 아니라 Armor 와 같은 감쇄식에 들어가는 값이다.

import type { ActorState } from '../semantic/actor';
import { allocationContribution } from '../semantic/allocation';
import {
  DAMAGE_TYPE_STATS,
  defenseMultiplier,
  defenseStatValue,
  effectiveDefense,
  offenseStatValue,
  penetrationStatValue,
  type DamageCalculation,
} from '../semantic/combat';
import type { Force } from '../semantic/item';

export function ruleDamageCalculate(
  attacker: ActorState,
  target: ActorState,
  skill: Force,
): DamageCalculation {

  // ── Step 0 — 타입 대응 (C012) ────────────────────────────────────
  // 대응표가 단일 출처다. 여기에 방식별 if 를 늘리지 않는다.
  // 고르지 않은 두 능력은 이 아래에서 한 번도 읽히지 않는다.
  const type = skill.damageType;
  const stats = DAMAGE_TYPE_STATS[type];
  const offenseValue = offenseStatValue(attacker, type);
  const defenseValue = defenseStatValue(target, type);

  // ── Step 1 — 관통 대응과 걷어내기 (C013) ─────────────────────────
  // 같은 대응표가 관통도 고른다. 고르지 않은 관통은 여기서 한 번도 읽히지 않으며,
  // 마주하지 않은 방어에는 닿지 않는다 (INTENT-PENETRATION-MATCH-001).
  // 걷힘은 이 계산 안에서만 일어난다 — target.armor / target.resistance 는 그대로 남는다
  // (INTENT-EFFECTIVE-DEFENSE-001).
  const penetrationValue = penetrationStatValue(attacker, type);
  const effective = effectiveDefense(defenseValue, penetrationValue);

  // ── Step 2~3 — C010 의 계산 (식 무변경 · 방어 입력만 걷힌 값으로) ──
  const attackContribution = offenseValue * skill.attackRatio;
  const raw = skill.baseDamage + attackContribution;

  const multiplier = defenseMultiplier(effective);

  // 하한 1 은 "방어는 줄일 뿐 없애지 못한다" 를 반올림이 깨뜨리지 못하게 하는 것이다
  // (INTENT-TYPED-DEFENSE-001). 애초에 낼 피해가 없으면(raw <= 0) 없는 피해를 만들지 않는다.
  const finalDamage = raw > 0 ? Math.max(1, Math.round(raw * multiplier)) : 0;

  return {
    damageType: type,
    // C-COMBAT-001 — 두 몸이 이 순간 어디에 몰아 두었는가. 아래 fromAllocation 셋과
    // 함께 "같은 기술이 왜 다른 값을 냈는가" 를 경위 하나로 읽게 한다
    // (INTENT-DAMAGE-BREAKDOWN-001 CHANGED).
    attackerAllocation: attacker.allocation,
    targetAllocation: target.allocation,
    offenseStat: {
      name: stats.offense,
      value: offenseValue,
      fromAllocation: allocationContribution(attacker.allocation, stats.offense),
    },
    baseDamage: skill.baseDamage,
    attackContribution,
    rawDamage: raw,
    // C013 — value 는 **걷히기 전** 방어다 (상대가 지닌 값과 같다).
    // 감쇄식에 실제로 들어간 값은 effectiveDefense 가 가진다.
    defenseStat: {
      name: stats.defense,
      value: defenseValue,
      fromAllocation: allocationContribution(target.allocation, stats.defense),
    },
    penetrationStat: {
      name: stats.penetration,
      value: penetrationValue,
      // 관통은 어느 축에도 들지 않으므로 언제나 0 이다. 그래도 싣는다 — 0 이라는 것이
      // "배분으로는 이 값을 움직일 수 없다" 의 관찰이다.
      fromAllocation: allocationContribution(attacker.allocation, stats.penetration),
    },
    effectiveDefense: effective,
    defenseMultiplier: multiplier,
    finalDamage,
    // C011 — 이 계산은 막기를 모른다. 막지 않은 타격의 값을 미리 채워 두고,
    // 막힌 타격이면 RULE-STRIKE-DAMAGE-001 이 RULE-GUARD-BLOCK-001 의 결과로 덮는다.
    // C012 — 막기는 방식을 읽지 않는다. 오라 타격도 물리 타격과 똑같이 처리된다.
    // C015 — 이 계산은 흔들림도 모른다. 터진 타격이면 같은 자리에서
    // RULE-CRITICAL-STRIKE-001 의 결과로 덮인다.
    appliedDamage: finalDamage,
  };
}
