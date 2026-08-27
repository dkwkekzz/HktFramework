// RULE-STRIKE-DAMAGE-001 — Implements INTENT-STRIKE-DAMAGE-001 · INTENT-DAMAGE-APPLY-001
// Input          공격자 Actor, 대상 Actor, **Force**, 이름표(무엇으로), World
//                C020 CHANGED — 위력의 출처가 스킬 하나가 아니게 되었다. 판정 순서
//                (계산 → 치명 → 막기 → 적용 → 사건 기록 → 쓰러짐)는 그대로다.
// Preconditions  대상이 쓰러지지 않았다 (쓰러진 몸은 더 이상 타격 대상이 아니다)
// Transition     Breakdown = RULE-DAMAGE-CALCULATE-001(공격자, 대상, 스킬)
//                Critical  = RULE-CRITICAL-STRIKE-001(World, 공격자, Breakdown.FinalDamage)
//                Breakdown.Critical    = Critical.Outcome
//                Breakdown.FinalDamage = Critical.Amplified
//                Guard     = RULE-GUARD-BLOCK-001(대상, 공격자, Breakdown.FinalDamage)
//                Breakdown.AppliedDamage = Guard.AppliedDamage
//                대상.Hp = max(0, Hp - Breakdown.AppliedDamage)
//                World.StrikeEvents += { 공격자, 대상, 스킬, Amount, Breakdown, 위치, 시각 }
//                Hp 가 0 이면 RULE-DOWNED-001
// Result         Damaged(AppliedDamage)
//
// C015 CHANGED — 계산과 막기 사이에 판정 하나가 놓인다. 터진 타격은 계산이 낸 값이
// 커진 채로 막기를 마주한다. 그래서 크게 터진 한 방은 막아도 더 아프고(같은 비율의 더 큰
// 몫이 남는다) 막는 데 더 든다(대가는 덜어내기 전 값으로 매겨지며 그 값이 커졌다).
// **막기의 규칙은 한 줄도 바뀌지 않았다** — 마주하는 크기만 달라졌다.
// 터지지 않은 타격의 값은 이 층이 생기기 전과 완전히 같다.
// 한 휘두름이 여럿에게 닿으면 이 규칙이 몸마다 따로 도는 것도 그대로이므로 판정도 몸마다
// 따로다 — 한 사람에게 터졌다고 옆 사람에게도 터지지 않는다. 대상의 순서가 정해져 있으므로
// 흔들림이 소비되는 순서도 정해져 있다.
//
// C011 CHANGED — 공식이 내놓은 값을 그대로 덜어내지 않고 막기 판정을 한 번 거친다.
// 막지 않았으면 AppliedDamage = FinalDamage 로 C010 과 완전히 같다.
// 한 휘두름이 여럿에게 닿으면 이 규칙이 몸마다 따로 도는 것도 그대로다 —
// 각자의 방향과 각자의 기력으로 각자 막거나 무너진다.
//
// C010 CHANGED — 스킬이 정한 고정값을 하나의 피해 공식이 대신한다.
// 한 번의 휘두름이 여럿에게 닿으면 이 규칙이 맞은 몸마다 따로 돌아간다 —
// 각자의 방어 능력으로 각자의 값이 나온다.
//
// R1/C010 — 계산 자체에는 흔들림이 없다. RULE-DAMAGE-CALCULATE-001 은 이 Cycle 뒤에도
// 같은 입력이면 언제나 같은 값을 내놓는다. 우연을 소비하는 것은 이 함수가 부르는
// RULE-CRITICAL-STRIKE-001 하나뿐이다 (C015).
//
// RULE-DOWNED-001 — Implements INTENT-DOWNED-001
// Input          Hp 가 0 이 된 Actor
// Preconditions  없음 — 생명이 다하면 반드시 일어난다
// Transition     CurrentAction = downed (Duration 없음, 대체 불가능)
// Result         Downed
//
// downed 가 대체 불가능하므로 모든 행동 시작이 자동으로 막힌다 —
// RULE-ACTION-BEGIN-001 에 예외를 더하지 않는다.

import { isDowned, type DamageBreakdown } from '../semantic/combat';
import type { Force } from '../semantic/item';
import type { ActorState } from '../semantic/actor';
import type { WorldState } from '../semantic/world-state';
import { beginAction } from './action-begin';
import { ruleCriticalStrike } from './critical-strike';
import { ruleDamageCalculate } from './damage-calculate';
import { ruleDeedsAdd } from './deeds-add';
import { ruleGuardBlock } from './guard';

export function ruleDowned(actor: ActorState): void {
  if (actor.currentAction.kind === 'downed') return;
  beginAction(actor, 'downed');
}

/** 타격이 실제로 들어갔으면 덜어낸 값을, 대상이 이미 쓰러졌으면 null 을 돌려준다. */
export function ruleStrikeDamage(
  state: WorldState,
  attacker: ActorState,
  target: ActorState,
  force: Force,
  label: string,
): number | null {
  if (isDowned(target)) return null;

  const calculation = ruleDamageCalculate(attacker, target, force);

  // C015 — 증폭도 공식 밖에서 그 결과값에 작용한다 (DC-COMBAT-ONE-FORMULA).
  // 막기보다 **먼저**다: 두 값 모두 FinalDamage 에 걸리므로 순서가 막기의 기력 대가를
  // 가르며(대가는 덜어내기 전 값으로 매겨진다 — C011), 커진 값을 막기가 마주하는 것이
  // R1 핵심 원칙의 `Critical → 증폭` · `Guard → 감소` 순서다.
  const critical = ruleCriticalStrike(state, attacker, calculation.finalDamage);
  const breakdown: DamageBreakdown = {
    ...calculation,
    critical: critical.outcome,
    finalDamage: critical.amplified,
    appliedDamage: critical.amplified,
  };

  // C011 — 막기는 공식 밖에서 그 결과값에 작용한다 (DC-COMBAT-ONE-FORMULA).
  const block = ruleGuardBlock(target, attacker, breakdown.finalDamage, state.time);
  breakdown.appliedDamage = block.appliedDamage;
  if (block.outcome) breakdown.guard = block.outcome;

  const amount = breakdown.appliedDamage;
  target.hp = Math.max(0, target.hp - amount);

  state.strikeEvents.push({
    attackerId: attacker.id,
    targetId: target.id,
    skill: label,
    amount,
    breakdown,
    position: { x: target.position.x, z: target.position.z },
    time: state.time,
  });

  // C-GROWTH-001 — 한 일이 몸에 남는다 (RULE-DEEDS-ADD-001).
  // **닿아서 해가 성립했다는 사실**이 쌓임의 조건이다 — 얼마나 아팠는지는 묻지 않는다
  // (막혀서 0 이 들어가도 친 것은 친 것이다). 같은 일은 같은 양을 쌓는다.
  ruleDeedsAdd(state, attacker, 'strike');

  if (target.hp === 0) {
    ruleDowned(target);
    // **쓰러뜨림은 여기서 쌓는다 — RULE-DOWNED-001 안이 아니다.**
    // 그 규칙은 쓰러진 몸만 알고 쓰러뜨린 몸을 모르며, 세계 밖의 손이 생명을 0 으로
    // 만들 때도 불린다 (RULE-ATTRIBUTE-SET-001). 밖의 손이 만든 쓰러짐은 **아무의
    // 일도 아니다** — 일을 한 몸이 있어야 쌓임이 성립한다.
    ruleDeedsAdd(state, attacker, 'down');
  }

  return amount;
}
