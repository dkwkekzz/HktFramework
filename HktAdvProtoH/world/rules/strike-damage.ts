// RULE-STRIKE-DAMAGE-001 — Implements INTENT-STRIKE-DAMAGE-001(C011 CHANGED) ·
//                                    INTENT-DAMAGE-APPLY-001(C011 CHANGED) ·
//                                    INTENT-COUNTER-001 · INTENT-PERFECT-GUARD-001 ·
//                                    INTENT-DEFENSE-MITIGATION-001 ·
//                                    INTENT-GUARD-DIRECTION-001 · INTENT-GUARD-ABSORB-001 ·
//                                    INTENT-TIMING-BREAKDOWN-001
// Input          공격자 Actor, 대상 Actor, SkillKind, World
// Preconditions  대상이 쓰러지지 않았다 (쓰러진 몸은 더 이상 타격 대상이 아니다)
// Transition     1  Raw       = SkillDefinition.Damage                    (증폭 전 본래 피해)
//                2  Counter   = 맞은 자가 열려 있는가                     (C011, isExposed)
//                   Base      = Counter ? Raw × (1 + COUNTER_DAMAGE_BONUS) : Raw
//                3  Mitigated = max(Base × MIN_DAMAGE_RATIO, Base - Defense)
//                               방어력은 막든 안 막든 언제나 걷어내되 0 으로 만들지 못한다
//                4  Blocked   = Stance = guard 이고 정면에서 들어왔는가   (isGuardBlocking)
//                5  Perfect   = Blocked 이고 자세를 세운 뒤 창 안인가     (C011)
//                6-A Perfect                 → Hp 그대로, Cp += 10, 공격자 → RULE-EXPOSE-001
//                6-B Blocked & 치를 기력 있음 → Hp -= Mitigated × 0.15, Cp -= 나머지 × 0.8
//                6-C Blocked & 기력 모자람    → RULE-GUARD-BREAK-001, Hp -= Mitigated 전부
//                6-D Blocked 아님             → Hp -= Mitigated          (C007 그대로)
//                7  World.StrikeEvents += 내역 전부, Hp = 0 이면 RULE-DOWNED-001
// Result         Struck { amount, guarded, cpPaid, guardBroken, perfectGuard }
//
// C011 — 결과가 다섯 갈래로 갈리지만 어디에도 우연이 없다.
// 같은 위치·방향·자세·기력·**두 시각**이면 언제나 같은 내역이 나온다
// (DC-COMBAT-PLAYER-CAUSALITY).
//
// 증폭(2)이 감쇄(3)보다 앞에 오는 이유는 되받아침이 "본래 피해를 키우는" 것이기
// 때문이다 — 그래서 열린 상대가 막고 있어도 커진 몫이 그대로 계산에 실린다.
// 완벽 갈래(6-A)가 보통 막기(6-B) 앞에 서는 이유는 완벽한 막기가 기력을 치르지 않아
// 무너짐 조건에 닿지 않기 때문이다 — 완벽하게 막는 몸은 무너뜨릴 수 없다.
//
// RULE-DOWNED-001 — Implements INTENT-DOWNED-001 · INTENT-GUARD-EXCLUSIVE-001 ·
//                              INTENT-EXPOSED-EXPIRES-001 (C011)
// Input          Hp 가 0 이 된 Actor
// Preconditions  없음 — 생명이 다하면 반드시 일어난다
// Transition     CurrentAction = downed (Duration 없음, 대체 불가능) + Stance = open (C010)
//                + ExposedUntil = 0 (C011 — 쓰러진 몸에는 열림이 남지 않는다)
// Result         Downed
//
// downed 가 대체 불가능하므로 모든 행동 시작이 자동으로 막힌다 —
// RULE-ACTION-BEGIN-001 에 예외를 더하지 않는다.

import {
  COUNTER_DAMAGE_BONUS,
  isDowned,
  isExposed,
  MIN_DAMAGE_RATIO,
  skillDefinition,
  type SkillKind,
} from '../semantic/combat';
import type { ActorState } from '../semantic/actor';
import type { WorldState } from '../semantic/world-state';
import { beginAction } from './action-begin';
import {
  guardCost,
  guardElapsed,
  isGuardBlocking,
  isPerfectGuard,
  perfectGuardGain,
  ruleExpose,
  ruleGuardBreak,
} from './guard';

export function ruleDowned(actor: ActorState): void {
  // 쓰러진 몸에는 자세가 남지 않는다 (C010).
  actor.stance = 'open';
  // 쓰러진 몸에는 열림도 남지 않는다 (C011).
  actor.exposedUntil = 0;
  if (actor.currentAction.kind === 'downed') return;
  beginAction(actor, 'downed');
}

/** 한 번의 타격이 낳은 결과. 부르는 쪽이 guarded 를 보고 피격 반응 여부를 정한다. */
export interface StrikeOutcome {
  amount: number; // 실제로 생명에서 나간 몫
  guarded: boolean; // 막아 냈는가 (무너진 타격은 막아 낸 것이 아니다. 완벽한 막기는 참이다)
  cpPaid: number; // 막느라 치른 기력
  guardBroken: boolean; // 이 타격이 방어를 무너뜨렸는가
  perfectGuard: boolean; // C011 — 완벽하게 막아 냈는가
}

/** 타격이 실제로 들어갔으면 그 결과를, 대상이 이미 쓰러졌으면 null 을 돌려준다. */
export function ruleStrikeDamage(
  state: WorldState,
  attacker: ActorState,
  target: ActorState,
  kind: SkillKind,
): StrikeOutcome | null {
  if (isDowned(target)) return null;

  // 1 — 증폭 전 본래 피해. 스킬이 정한 값이며 여전히 흔들리지 않는다.
  const raw = skillDefinition(kind).damage;

  // 2 — 되받아침 판정 (RULE-COUNTER-001 · INTENT-COUNTER-001).
  // 조건은 "맞은 자가 열려 있는가" 하나다 — 때린 자가 누구인지, 어느 방향인지,
  // 열림을 누가 만들었는지는 따지지 않는다. 열린 몸은 그 자리의 누구에게든 열려 있다.
  // 감쇄보다 먼저 온다: 되받아침은 본래 피해 자체를 키운다.
  const counter = isExposed(target, state.time);
  const base = counter ? raw * (1 + COUNTER_DAMAGE_BONUS) : raw;
  const counterBonus = base - raw;

  // 3 — 방어력 감쇄 (INTENT-DEFENSE-MITIGATION-001).
  // 막힘 판정보다 먼저 온다 — 방어력은 막든 안 막든 언제나 작동하기 때문이다.
  // 아무리 두꺼워도 최소한의 몫은 반드시 통과한다.
  const mitigated = Math.max(base * MIN_DAMAGE_RATIO, base - target.defense);

  // 4 — 막힘 판정 (INTENT-GUARD-DIRECTION-001). 앞쪽만 막힌다.
  const blocked = isGuardBlocking(target, attacker.position);
  // 막힌 타격에만 잴 것이 있다 — 막지 않은 몸에는 "세운 지 얼마" 가 의미를 갖지 않는다.
  const elapsed = blocked ? guardElapsed(target, state.time) : null;

  let hpLoss = mitigated;
  let cpPaid = 0;
  let cpGained = 0;
  let guarded = false;
  let perfectGuard = false;
  let guardBroken = false;

  if (blocked && elapsed !== null && isPerfectGuard(elapsed)) {
    // 6-A — 완벽하게 막아 냈다 (RULE-PERFECT-GUARD-001).
    // 생명도 기력도 치르지 않고 오히려 번다. 그리고 때린 자가 열린다.
    cpGained = perfectGuardGain(target);
    target.cp += cpGained;
    hpLoss = 0;
    guarded = true;
    perfectGuard = true;
    ruleExpose(attacker, state.time); // RULE-EXPOSE-001
  } else if (blocked) {
    const cost = guardCost(mitigated);
    if (target.cp >= cost.cpPaid) {
      // 6-B — 생명 대신 기력으로 받는다 (RULE-GUARD-ABSORB-001).
      target.cp -= cost.cpPaid;
      hpLoss = cost.hpLoss;
      cpPaid = cost.cpPaid;
      guarded = true;
    } else {
      // 6-C — 치를 것이 없다. 방어가 무너지고 그 타격은 막지 못한 것이 된다.
      cpPaid = target.cp; // 남아 있던 것을 마지막 대가로 다 쓴다 (ruleGuardBreak 가 0 으로 만든다)
      ruleGuardBreak(target, state.time);
      hpLoss = mitigated;
      guardBroken = true;
    }
  }
  // 6-D — 막지 못했으면 감쇄된 피해가 그대로 생명에서 나간다 (C007 그대로).

  target.hp = Math.max(0, target.hp - hpLoss);

  // 7 — 결과를 만든 내역 전부가 실린다
  // (INTENT-STRIKE-BREAKDOWN-001 · INTENT-TIMING-BREAKDOWN-001).
  state.strikeEvents.push({
    attackerId: attacker.id,
    targetId: target.id,
    skill: kind,
    baseAmount: base,
    counterBonus,
    counter,
    mitigated,
    guarded,
    perfectGuard,
    guardElapsed: elapsed,
    cpPaid,
    cpGained,
    amount: hpLoss,
    guardBroken,
    position: { x: target.position.x, z: target.position.z },
    time: state.time,
  });

  if (target.hp === 0) ruleDowned(target);

  return { amount: hpLoss, guarded, cpPaid, guardBroken, perfectGuard };
}
