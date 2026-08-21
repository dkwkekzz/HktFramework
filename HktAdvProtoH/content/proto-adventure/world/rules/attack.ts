// RULE-HIT-001 — Implements INTENT-HIT-REACTION-001
// Input          타격받은 Actor
// Preconditions  없음 — 피격은 상대의 사정을 묻지 않는다
// Transition     CurrentAction = hit (하던 행동을 중단시킨다)
// Result         Struck
//
// C002 의 RULE-ATTACK-001 은 C007 에서 RULE-SKILL-BEGIN-001 (rules/skill.ts) 로
// 일반화됐다 — 휘두름은 종류를 가진 스킬이며, 각 스킬은 자기 기력 수지와 고정 피해량과
// 행동 길이를 가진다. 기본 스킬(attack)의 행동 종류 이름은 그대로다.
//
// C006 CHANGED — RULE-ATTACK-COMPLETE-001(완료 순간 일괄 판정)은 폐지됐다.
// 판정은 RULE-SWING-STRIKE-001 (simulation/swing-strike.ts) 이 휘두름 구간의
// 접촉 시점마다 한다. 무엇이 맞는지는 완료 순간이 아니라 접촉이 정한다.
//
// C007 — 피격은 그 직후 잠시 기력 충전을 억누르는 배율 원천이기도 하다
// (semantic/combat.ts 의 HIT_CHARGE_FACTOR). "직후 잠시" 는 이 hit 행동이 이어지는 동안이다.

import type { ActorState } from '../semantic/actor';
import { skillPhase } from '../semantic/combat';
import type { WorldState } from '../semantic/world-state';
import { beginAction } from './action-begin';

/** 이 피격이 대상의 행동에 한 일 (C019 ADDED) */
export type HitOutcome = 'cancelled' | 'uninterrupted' | 'struck';

// RULE-HIT-001 — RULE-ACTION-BEGIN-001 을 거치지 않는 유일한 행동 진입이다.
// 피격은 그 캐릭터가 요청한 행동이 아니라 밖에서 일어난 일이기 때문이다.
// 이 예외는 여기 한 곳에만 있다.
//
// C019 CHANGED — 피격이 처음으로 **시점을 묻는다**. 세 갈래이며 갈리는 기준은 하나다:
// 대상이 지금 기술의 어느 구간에 있는가 (RULE-SKILL-PHASE-001).
export function ruleHit(state: WorldState, target: ActorState, attacker: ActorState): HitOutcome {
  const phase = skillPhase(target);

  // 기술이 아닌 행동 중이다 — 지금까지와 같다. 하던 일이 끊긴다.
  if (phase === null) {
    beginAction(target, 'hit');
    return 'struck';
  }

  // 이미 나간 칼은 멈추지 않는다 (INTENT-HIT-REACTION-001 CHANGED).
  // 아무것도 하지 않는 것이 이 갈래의 전부다 — 맞은 사실도 피해도 밀려남도
  // 이 Rule 밖에서 그대로 일어난다 (RULE-SWING-STRIKE-001).
  if (phase !== 'startup') return 'uninterrupted';

  ruleSkillCancel(state, target, attacker);
  return 'cancelled';
}

// RULE-SKILL-CANCEL-001 — Implements INTENT-CANCEL-IN-STARTUP-001 ·
//                                    INTENT-CANCEL-COSTS-THE-CHANCE-001 ·
//                                    INTENT-CANCEL-IS-OBSERVABLE-001 (C019 ADDED)
// Input          해를 입은 Actor (끊긴 자), 해를 입힌 Actor (끊은 자)
// Preconditions  RULE-SKILL-PHASE-001(끊긴 자) = startup
// Transition     CurrentAction = hit (그 기술은 사라진다) · World.CancelEvents += 항목
// Result         Cancelled(기술)
//
// 캔슬된 기술은 판정 구간에 이르지 못하므로 **그 기술의 피해 산정이 한 번도 일어나지
// 않는다.** 피해 0 을 만드는 것이 아니라 사건 자체가 없다 (DC-COMBAT-ONE-FORMULA).
//
// 기력 수지도 정산되지 않는다 — 여기서 되돌리는 것이 아니라, RULE-SKILL-BUDGET-001 이
// **첫 타격에서만** 정산하므로 타격이 없었던 기술은 애초에 정산된 적이 없다.
// 끊긴 쪽이 잃는 것은 치른 값이 아니라 **벌지 못한 몫과 쓴 시간**이다.
//
// 이 Rule 은 해가 성립한 뒤에만 불린다 — RULE-HARM-GATE-001 이 거절한 접촉은 여기까지
// 오지 않는다 (C018). 닿았으나 아무 일도 없었던 접촉은 아무것도 끊지 못한다.
export function ruleSkillCancel(
  state: WorldState,
  target: ActorState,
  attacker: ActorState,
): void {
  const cancelled = target.currentAction.kind;
  if (cancelled !== 'attack' && cancelled !== 'heavy-attack' && cancelled !== 'aura-strike') {
    return; // 도달하지 않는다 — skillPhase 가 이미 기술임을 보장한다
  }

  beginAction(target, 'hit');
  state.cancelEvents.push({
    attackerId: attacker.id,
    targetId: target.id,
    skill: cancelled,
    position: { x: target.position.x, z: target.position.z },
    time: state.time,
  });
}
