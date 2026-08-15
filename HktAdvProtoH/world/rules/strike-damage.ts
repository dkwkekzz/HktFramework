// RULE-STRIKE-DAMAGE-001 — Implements INTENT-STRIKE-DAMAGE-001(C010 CHANGED) ·
//                                    INTENT-DAMAGE-APPLY-001(C010 CHANGED) ·
//                                    INTENT-DEFENSE-MITIGATION-001 ·
//                                    INTENT-GUARD-DIRECTION-001 · INTENT-GUARD-ABSORB-001 ·
//                                    INTENT-STRIKE-BREAKDOWN-001
// Input          공격자 Actor, 대상 Actor, SkillKind, World
// Preconditions  대상이 쓰러지지 않았다 (쓰러진 몸은 더 이상 타격 대상이 아니다)
// Transition     1  Base      = SkillDefinition.Damage                    (본래 피해)
//                2  Mitigated = max(Base × MIN_DAMAGE_RATIO, Base - Defense)
//                               방어력은 막든 안 막든 언제나 걷어내되 0 으로 만들지 못한다
//                3  Blocked   = Stance = guard 이고 정면에서 들어왔는가   (isGuardBlocking)
//                4-A Blocked & 치를 기력 있음 → Hp -= Mitigated × 0.15, Cp -= 나머지 × 0.8
//                4-B Blocked & 기력 모자람    → RULE-GUARD-BREAK-001, Hp -= Mitigated 전부
//                4-C Blocked 아님             → Hp -= Mitigated          (C007 그대로)
//                5  World.StrikeEvents += 내역 전부, Hp = 0 이면 RULE-DOWNED-001
// Result         Struck { amount, guarded, cpPaid, guardBroken }
//
// C010 — 결과가 네 갈래로 갈리지만 어디에도 우연이 없다.
// 같은 위치·같은 방향·같은 자세·같은 기력이면 언제나 같은 내역이 나온다
// (DC-COMBAT-PLAYER-CAUSALITY). 무너지는 타격이 본래 피해를 그대로 받는 이유는
// "막을 기력이 다하면 그대로 얻어맞는다" 가 이 Cycle 의 Goal 이기 때문이다.
//
// RULE-DOWNED-001 — Implements INTENT-DOWNED-001 · INTENT-GUARD-EXCLUSIVE-001
// Input          Hp 가 0 이 된 Actor
// Preconditions  없음 — 생명이 다하면 반드시 일어난다
// Transition     CurrentAction = downed (Duration 없음, 대체 불가능) + Stance = open (C010)
// Result         Downed
//
// downed 가 대체 불가능하므로 모든 행동 시작이 자동으로 막힌다 —
// RULE-ACTION-BEGIN-001 에 예외를 더하지 않는다.

import {
  isDowned,
  MIN_DAMAGE_RATIO,
  skillDefinition,
  type SkillKind,
} from '../semantic/combat';
import type { ActorState } from '../semantic/actor';
import type { WorldState } from '../semantic/world-state';
import { beginAction } from './action-begin';
import { guardCost, isGuardBlocking, ruleGuardBreak } from './guard';

export function ruleDowned(actor: ActorState): void {
  // 쓰러진 몸에는 자세가 남지 않는다 (C010).
  actor.stance = 'open';
  if (actor.currentAction.kind === 'downed') return;
  beginAction(actor, 'downed');
}

/** 한 번의 타격이 낳은 결과. 부르는 쪽이 guarded 를 보고 피격 반응 여부를 정한다. */
export interface StrikeOutcome {
  amount: number; // 실제로 생명에서 나간 몫
  guarded: boolean; // 막아 냈는가 (무너진 타격은 막아 낸 것이 아니다)
  cpPaid: number; // 막느라 치른 기력
  guardBroken: boolean; // 이 타격이 방어를 무너뜨렸는가
}

/** 타격이 실제로 들어갔으면 그 결과를, 대상이 이미 쓰러졌으면 null 을 돌려준다. */
export function ruleStrikeDamage(
  state: WorldState,
  attacker: ActorState,
  target: ActorState,
  kind: SkillKind,
): StrikeOutcome | null {
  if (isDowned(target)) return null;

  // 1 — 본래 피해. 스킬이 정한 값이며 여전히 흔들리지 않는다.
  const base = skillDefinition(kind).damage;

  // 2 — 방어력 감쇄 (INTENT-DEFENSE-MITIGATION-001).
  // 막힘 판정보다 먼저 온다 — 방어력은 막든 안 막든 언제나 작동하기 때문이다.
  // 아무리 두꺼워도 최소한의 몫은 반드시 통과한다.
  const mitigated = Math.max(base * MIN_DAMAGE_RATIO, base - target.defense);

  // 3 — 막힘 판정 (INTENT-GUARD-DIRECTION-001). 앞쪽만 막힌다.
  const blocked = isGuardBlocking(target, attacker.position);

  let hpLoss = mitigated;
  let cpPaid = 0;
  let guarded = false;
  let guardBroken = false;

  if (blocked) {
    const cost = guardCost(mitigated);
    if (target.cp >= cost.cpPaid) {
      // 4-A — 생명 대신 기력으로 받는다 (RULE-GUARD-ABSORB-001).
      target.cp -= cost.cpPaid;
      hpLoss = cost.hpLoss;
      cpPaid = cost.cpPaid;
      guarded = true;
    } else {
      // 4-B — 치를 것이 없다. 방어가 무너지고 그 타격은 막지 못한 것이 된다.
      cpPaid = target.cp; // 남아 있던 것을 마지막 대가로 다 쓴다 (ruleGuardBreak 가 0 으로 만든다)
      ruleGuardBreak(target, state.time);
      hpLoss = mitigated;
      guardBroken = true;
    }
  }
  // 4-C — 막지 못했으면 감쇄된 피해가 그대로 생명에서 나간다 (C007 그대로).

  target.hp = Math.max(0, target.hp - hpLoss);

  // 5 — 결과를 만든 내역 전부가 실린다 (INTENT-STRIKE-BREAKDOWN-001).
  state.strikeEvents.push({
    attackerId: attacker.id,
    targetId: target.id,
    skill: kind,
    baseAmount: base,
    mitigated,
    guarded,
    cpPaid,
    amount: hpLoss,
    guardBroken,
    position: { x: target.position.x, z: target.position.z },
    time: state.time,
  });

  if (target.hp === 0) ruleDowned(target);

  return { amount: hpLoss, guarded, cpPaid, guardBroken };
}
