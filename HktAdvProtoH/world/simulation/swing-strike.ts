// RULE-SWING-STRIKE-001 — Implements INTENT-ACTION-COLLIDER-001 · INTENT-SWING-IMPACT-001 ·
//                                    INTENT-ATTACK-HIT-001(C006 CHANGED) · INTENT-BODY-FACING-001
// Input          ActionCollider 가 Active 인 모든 Actor (Tick 마다)
// Preconditions  대상 = 자신이 아닌 Actor 중
//                칼끝(Collider.Center)과의 거리 <= Collider.Radius + 대상.Body.Radius 이고
//                CurrentAction.StruckActorIds 에 아직 없는 몸
// Transition     대상마다: RULE-HIT-001 적용 (행동 중단 → hit),
//                Owner 몸 중심 → 대상 중심 방향으로 SWING_IMPULSE 충격량 —
//                대상.Velocity += 충격량 / 대상.Mass, StruckActorIds += 대상
// Result         Struck(대상 수)
//
// C002 의 "완료 순간 일괄 판정"(RULE-ATTACK-COMPLETE-001)을 대체한다 —
// 무엇이 맞는지는 완료 순간이 아니라 휘두름 구간의 접촉이 정한다.
// R1 — 접촉 기준은 몸 주위 반경이 아니라 Facing 방향 칼끝이 쓸고 지나가는 충돌 구다.

import { actionCollider, CENTER_EPSILON, SWING_IMPULSE } from '../semantic/collision';
import { distance } from '../semantic/position';
import type { WorldState } from '../semantic/world-state';
import { ruleHit } from '../rules/attack';

export function ruleSwingStrike(state: WorldState): number {
  let struckCount = 0;

  for (const attacker of state.actors) {
    const collider = actionCollider(attacker);
    if (!collider || !collider.active) continue;

    const action = attacker.currentAction; // kind = attack — collider 가 보장한다
    const struck = (action.struckActorIds ??= []);

    for (const target of state.actors) {
      if (target.id === attacker.id) continue;
      if (struck.includes(target.id)) continue;

      const d = distance(collider.center, target.position);
      if (d > collider.radius + target.bodyRadius) continue;

      ruleHit(target);

      // 밀쳐냄은 휘두른 몸의 중심에서 멀어지는 방사 방향 (칼끝이 아니라 몸에서)
      const px = target.position.x - attacker.position.x;
      const pz = target.position.z - attacker.position.z;
      const pd = Math.sqrt(px * px + pz * pz);
      const nx = pd > CENTER_EPSILON ? px / pd : 1;
      const nz = pd > CENTER_EPSILON ? pz / pd : 0;
      target.velocity.x += nx * (SWING_IMPULSE / target.bodyMass);
      target.velocity.z += nz * (SWING_IMPULSE / target.bodyMass);

      struck.push(target.id);
      struckCount++;
    }
  }

  return struckCount;
}
