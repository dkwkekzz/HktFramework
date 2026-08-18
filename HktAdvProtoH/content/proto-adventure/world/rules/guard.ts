// RULE-GUARD-BEGIN-001 — Implements INTENT-GUARD-STANCE-001 · INTENT-GUARD-GATE-001
// Input          Actor
// Preconditions  1. 쓰러지지 않았다
//                2. Cp > 0                          (치를 것이 하나도 없으면 못 든다)
//                3. World.Time >= GuardBrokenUntil  (무너진 직후가 아니다)
// Transition     Guarding = true
//                MoveMode = walk                    (달리는 중이었으면 걷기로 내린다)
// Result         Success | Failure(downed | insufficient-cp | guard-broken)
//
// 이미 막고 있는 Actor 가 다시 요청하면 Success 이고 아무것도 달라지지 않는다 —
// 요청은 토글이 아니라 명시값이다 (RULE-MOVE-MODE-001 과 같은 판단).
//
// RULE-GUARD-RELEASE-001 — Implements INTENT-GUARD-STANCE-001
// Input          Actor
// Preconditions  없음 — 놓는 것은 언제나 가능하다.
//                힘이 빠져 손을 내리는 것을 막을 이유가 없다.
// Transition     Guarding = false
// Result         Success
//
// RULE-GUARD-BLOCK-001 — Implements INTENT-GUARD-DIRECTION-001 · INTENT-GUARD-MITIGATE-001 ·
//                                   INTENT-GUARD-COST-001 · INTENT-GUARD-COLLAPSE-001
// Input          대상 Actor, 공격자 Actor, FinalDamage, World.Time
// Preconditions  없음 — 언제나 돌고 스스로 막혔는지 아닌지를 정한다
// Transition     막힘   Cp -= ceil(FinalDamage × GuardCpPerDamage)
//                무너짐 Guarding = false · GuardBrokenUntil = Time + GuardBreakRecovery
// Result         GuardOutcome + AppliedDamage
//
// 막기는 **Final Damage 에 걸린다** — DefenseMultiplier 가 아니다.
// 설계 원본이 그렇다 (R1 핵심 원칙 `Guard → Final Damage 를 감소시킨다`, §14
// `Guard → Damage Taken × 0.5`). DefenseMultiplier 에 걸면 방어 능력과 곱해져
// 방어가 높은 존재일수록 막기의 절대 효과가 작아지는데, 그것은 원본의 의미가 아니다.
// 피해 공식(RULE-DAMAGE-CALCULATE-001)은 이 규칙 때문에 한 줄도 바뀌지 않는다 —
// 막기는 그 결과값 뒤에 붙는 별도 규칙이다 (DC-COMBAT-ONE-FORMULA).
//
// 입력에 난수원이 없다. World.Time 은 결과를 정하는 데 쓰이지 않고
// 무너진 뒤의 회복 시점을 세우는 데만 쓰인다 (DC-COMBAT-PLAYER-CAUSALITY).

import type { ActionResult } from '../../protocol/actions';
import { RULE_GUARD_BEGIN, RULE_GUARD_RELEASE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import {
  GUARD_ARC_COS,
  GUARD_BREAK_RECOVERY,
  GUARD_CP_PER_DAMAGE,
  GUARD_DAMAGE_FACTOR,
  isDowned,
  isGuardBroken,
  type GuardOutcome,
} from '../semantic/combat';
import { CENTER_EPSILON } from '../semantic/collision';

export type GuardBeginFailureReason = 'downed' | 'insufficient-cp' | 'guard-broken';

// Precondition 평가 — Observable(Guard.BeginAvailability / BeginFailureReason)과 공유한다.
// 판정이 한 곳에만 있어야 "왜 안 되는가" 와 실제 거절 사유가 어긋나지 않는다 (C007 의 규율 그대로).
export function evaluateGuardBegin(
  actor: ActorState,
  worldTime: number,
): GuardBeginFailureReason | null {
  if (isDowned(actor)) return 'downed';
  if (actor.cp <= 0) return 'insufficient-cp';
  if (isGuardBroken(actor, worldTime)) return 'guard-broken';
  return null;
}

export function ruleGuardBegin(actor: ActorState, worldTime: number): ActionResult {
  const failure = evaluateGuardBegin(actor, worldTime);
  if (failure) return { status: 'failure', rule: RULE_GUARD_BEGIN, reason: failure };

  actor.guarding = true;
  // 같은 기력을 달리기와 막기에 동시에 걸 수 없다 (INTENT-GUARD-RESTRICT-001).
  // 거절이 아니라 달리기를 내려놓는 것으로 본다 — 요청한 것은 막기다.
  actor.moveMode = 'walk';
  return { status: 'success', rule: RULE_GUARD_BEGIN };
}

export function ruleGuardRelease(actor: ActorState): ActionResult {
  actor.guarding = false;
  return { status: 'success', rule: RULE_GUARD_RELEASE };
}

export interface GuardBlockResult {
  outcome: GuardOutcome | null; // 막지도 무너지지도 않았으면 null — 경위에 싣지 않는다
  appliedDamage: number;
}

/**
 * 이 타격이 정면에서 들어왔는가 (INTENT-GUARD-DIRECTION-001).
 * 기준은 칼끝이 아니라 공격자의 몸 중심이다 — 밀어냄(RULE-SWING-STRIKE-001)이 쓰는
 * 기준과 같게 둔다. 두 곳이 다른 방향을 쓰면 "막았는데 엉뚱하게 밀린다" 가 된다.
 */
function isFrontal(target: ActorState, attacker: ActorState): boolean {
  const dx = attacker.position.x - target.position.x;
  const dz = attacker.position.z - target.position.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  // 정확히 겹쳐 선 경우 방향을 정할 수 없다. 막아 주는 쪽으로 판정한다 —
  // 겹친 것은 파고든 것이고, 그때 등 뒤로 치는 것과 구분할 근거가 없다.
  if (d <= CENTER_EPSILON) return true;
  return (target.facing.x * dx + target.facing.z * dz) / d >= GUARD_ARC_COS;
}

export function ruleGuardBlock(
  target: ActorState,
  attacker: ActorState,
  finalDamage: number,
  worldTime: number,
): GuardBlockResult {
  // 막지 않음 — 상태를 아무것도 바꾸지 않는다. 이 타격은 C010 과 완전히 같다.
  if (!target.guarding || !isFrontal(target, attacker)) {
    return { outcome: null, appliedDamage: finalDamage };
  }

  const cost = Math.ceil(finalDamage * GUARD_CP_PER_DAMAGE);

  // 무너짐 — 부분적으로 막아 주지 않는다. 막았거나 무너졌거나 둘 중 하나다
  // (INTENT-GUARD-COLLAPSE-001). 부분 감쇄를 허용하면 기력 0 에 붙은 채로
  // 영원히 조금씩 막게 되어 "자원이 마르면 무너진다" 가 사라진다.
  if (target.cp < cost) {
    target.guarding = false;
    target.guardBrokenUntil = worldTime + GUARD_BREAK_RECOVERY;
    return {
      outcome: { blocked: false, broken: true, cpPaid: 0, prevented: 0 },
      appliedDamage: finalDamage,
    };
  }

  // 막힘 — 생명 대신 기력을 치른다.
  target.cp -= cost;
  // 하한 1 은 "막기는 아프지 않게 할 뿐 없던 일로 만들지 못한다" 를 반올림이
  // 깨뜨리지 못하게 하는 것이다 (INTENT-GUARD-MITIGATE-001).
  // 애초에 낼 피해가 없으면 없는 피해를 만들지 않는다 — C010 의 방어 하한과 같은 판단이다.
  const applied =
    finalDamage > 0 ? Math.max(1, Math.round(finalDamage * GUARD_DAMAGE_FACTOR)) : 0;

  return {
    outcome: { blocked: true, broken: false, cpPaid: cost, prevented: finalDamage - applied },
    appliedDamage: applied,
  };
}
