// RULE-STANCE-001 — Implements INTENT-RELATION-STANCE-001 ·
//                              INTENT-STANCE-FROM-GUARDED-GROUND-001 ·
//                              INTENT-WITHDRAWAL-ENDS-IT-001
// Input          Actor A (보는 쪽), Actor B (보이는 쪽)
// Preconditions  없음 — 어느 두 존재 사이에도 언제나 답이 있다
// Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
// Result         hostile | neutral | friendly
//
// 태도는 저장되지 않으므로 **푸는 규칙이 없다.** 지키는 자리 밖으로 나가면 이 판정의
// 결과가 달라지고, 그것이 곧 "물러나면 풀린다" 의 구현이다
// (MG-HOLD-HUNTING-GROUND.world_shape — "나가면 더 쫓지 않아야 한다").
//
// friendly 는 갈래로 서 있으나 그것을 낳는 사정이 아직 없어 지금 이 값은 나오지 않는다.
// 없는 사정을 지어내지 않는다.
//
// RULE-HARM-GATE-001 — Implements INTENT-HARM-GATE-001
// Input          공격자 Actor, 대상 Actor
// Preconditions  둘 중 어느 한쪽이라도 상대를 사냥감으로 대한다
// Transition     없음 — 판정만 한다
// Result         Allowed | Refused(not-hostile)
//
// 양방향인 이유: 한 방향만 보면 사냥감이 사냥꾼을 되받아칠 수 없다.
// 양쪽에 똑같이 선다 — 자율 존재의 휘두름도 이 관문을 지난다 (MA-HOSTILE-COMBATANT:
// "이 존재는 플레이어와 같은 전투 규칙 아래 있다. 예외를 갖지 않는다").

import type { ActorState } from '../semantic/actor';
import {
  HOSTILITY_REASONS,
  type Stance,
  type UnharmedReason,
} from '../semantic/relation';

/** RULE-STANCE-001 — A 가 B 를 어떻게 대하는가. 주체의 종류를 묻지 않는다 */
export function ruleStance(a: ActorState, b: ActorState): Stance {
  // 자기 자리 안의 자기 자신은 침입자가 아니다
  if (a.id === b.id) return 'neutral';
  // 사정 중 **하나라도** 적대를 내면 적대다. 늘어나는 것은 목록이지 이 판정이 아니다.
  for (const reason of HOSTILITY_REASONS) {
    if (reason.holds(a, b)) return 'hostile';
  }
  return 'neutral';
}

export type HarmGateResult = { status: 'allowed' } | { status: 'refused'; reason: UnharmedReason };

/** RULE-HARM-GATE-001 — 이 둘 사이에 해가 성립하는가 */
export function ruleHarmGate(attacker: ActorState, target: ActorState): HarmGateResult {
  const hostile =
    ruleStance(attacker, target) === 'hostile' || ruleStance(target, attacker) === 'hostile';
  return hostile ? { status: 'allowed' } : { status: 'refused', reason: 'not-hostile' };
}
