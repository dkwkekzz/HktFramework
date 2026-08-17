// RULE-STRIKE-DAMAGE-001 — Implements INTENT-STRIKE-DAMAGE-001 · INTENT-DAMAGE-APPLY-001
// Input          공격자 Actor, 대상 Actor, SkillKind, World
// Preconditions  대상이 쓰러지지 않았다 (쓰러진 몸은 더 이상 타격 대상이 아니다)
// Transition     Breakdown = RULE-DAMAGE-CALCULATE-001(공격자, 대상, 스킬)
//                대상.Hp = max(0, Hp - Breakdown.FinalDamage)
//                World.StrikeEvents += { 공격자, 대상, 스킬, Amount, Breakdown, 위치, 시각 }
//                Hp 가 0 이면 RULE-DOWNED-001
// Result         Damaged(FinalDamage)
//
// C010 CHANGED — 스킬이 정한 고정값을 하나의 피해 공식이 대신한다.
// 한 번의 휘두름이 여럿에게 닿으면 이 규칙이 맞은 몸마다 따로 돌아간다 —
// 각자의 방어 능력으로 각자의 값이 나온다.
//
// R1/C010 — 피해에 흔들림이 없으므로 우연을 소비하지 않는다. 같은 입력이면 언제나 같은 결과다.
//
// RULE-DOWNED-001 — Implements INTENT-DOWNED-001
// Input          Hp 가 0 이 된 Actor
// Preconditions  없음 — 생명이 다하면 반드시 일어난다
// Transition     CurrentAction = downed (Duration 없음, 대체 불가능)
// Result         Downed
//
// downed 가 대체 불가능하므로 모든 행동 시작이 자동으로 막힌다 —
// RULE-ACTION-BEGIN-001 에 예외를 더하지 않는다.

import { isDowned, type SkillKind } from '../semantic/combat';
import type { ActorState } from '../semantic/actor';
import type { WorldState } from '../semantic/world-state';
import { beginAction } from './action-begin';
import { ruleDamageCalculate } from './damage-calculate';

export function ruleDowned(actor: ActorState): void {
  if (actor.currentAction.kind === 'downed') return;
  beginAction(actor, 'downed');
}

/** 타격이 실제로 들어갔으면 덜어낸 값을, 대상이 이미 쓰러졌으면 null 을 돌려준다. */
export function ruleStrikeDamage(
  state: WorldState,
  attacker: ActorState,
  target: ActorState,
  kind: SkillKind,
): number | null {
  if (isDowned(target)) return null;

  const breakdown = ruleDamageCalculate(attacker, target, kind);
  const amount = breakdown.finalDamage;
  target.hp = Math.max(0, target.hp - amount);

  state.strikeEvents.push({
    attackerId: attacker.id,
    targetId: target.id,
    skill: kind,
    amount,
    breakdown,
    position: { x: target.position.x, z: target.position.z },
    time: state.time,
  });

  if (target.hp === 0) ruleDowned(target);

  return amount;
}
