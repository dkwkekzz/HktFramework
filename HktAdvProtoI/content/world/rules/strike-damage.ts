// RULE-STRIKE-DAMAGE-001 — Implements INTENT-STRIKE-DAMAGE-001 · INTENT-DAMAGE-APPLY-001
//                          (C017 CHANGED — 닿은 타격이 그 방의 소란이 된다)
// Input          공격자 Actor, 대상 Actor, SkillKind, World
// Preconditions  대상이 쓰러지지 않았다 (쓰러진 몸은 더 이상 타격 대상이 아니다)
// Transition     Amount = SkillDefinition.Damage (고정 — 판정도 흔들림도 없다)
//                대상.Hp = max(0, Hp - Amount)
//                World.StrikeEvents += { 공격자, 대상, 스킬, Amount, 위치, 시각 }
//                그 방의 소란 += DISTURBANCE_PER_STRIKE (C017 ADDED · RULE-DISTURBANCE-001)
//                Hp 가 0 이면 RULE-DOWNED-001
// Result         Damaged(Amount)
//
// R1 — 피해에 흔들림이 없으므로 우연을 소비하지 않는다. 같은 입력이면 언제나 같은 결과다.
//
// RULE-DOWNED-001 — Implements INTENT-DOWNED-001
// Input          Hp 가 0 이 된 Actor
// Preconditions  없음 — 생명이 다하면 반드시 일어난다
// Transition     CurrentAction = downed (Duration 없음, 대체 불가능)
// Result         Downed
//
// downed 가 대체 불가능하므로 모든 행동 시작이 자동으로 막힌다 —
// RULE-ACTION-BEGIN-001 에 예외를 더하지 않는다.

import { isDowned, skillDefinition, type SkillKind } from '../semantic/combat';
import type { ActorState } from '../semantic/actor';
import { addDisturbance } from '../semantic/region-state';
import { DISTURBANCE_PER_STRIKE, type WorldState } from '../semantic/world-state';
import { beginAction } from './action-begin';

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

  const amount = skillDefinition(kind).damage;
  target.hp = Math.max(0, target.hp - amount);

  state.strikeEvents.push({
    attackerId: attacker.id,
    targetId: target.id,
    skill: kind,
    amount,
    position: { x: target.position.x, z: target.position.z },
    time: state.time,
  });

  // RULE-DISTURBANCE-001 (C017 ADDED · spec R1 · R11) — **닿은 타격이 그 방의 소란이 된다.**
  // 위 판정과 결과는 한 값도 바뀌지 않았다: 이 한 줄이 더해졌을 뿐이다. 빗나간 휘두름은
  // 여기까지 오지 않으므로 한 값도 오르지 않는다 — **닿은** 것만이 방을 흔든다.
  // 오르는 방은 맞은 몸이 선 방이다 (때린 몸과 같은 방이다 — 다른 방의 몸은 맞지 않는다 · C001 R5).
  addDisturbance(state.regionStates, target.regionId, DISTURBANCE_PER_STRIKE);

  if (target.hp === 0) ruleDowned(target);

  return amount;
}
