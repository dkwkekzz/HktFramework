// RULE-SWING-STRIKE-001 — Implements INTENT-ACTION-COLLIDER-001 · INTENT-SWING-IMPACT-001 ·
//                                    INTENT-BODY-FACING-001
// · INTENT-STRIKE-DAMAGE-001 · INTENT-SKILL-BUDGET-001
// Input          ActionCollider 가 Active 인 모든 Actor (Tick 마다)
// Preconditions  대상 = 자신이 아니고, 쓰러지지 않았고,
//                칼끝(Collider.Center)과의 거리 <= Collider.Radius + 대상.Body.Radius 이고
//                CurrentAction.StruckActorIds 에 아직 없는 몸
// Transition     대상마다: StruckActorIds += 대상,
//                RULE-HIT-001 (행동 중단 → hit) + SWING_IMPULSE 충격량 (그대로),
//                RULE-STRIKE-DAMAGE-001 (그 스킬의 고정 피해),
//                이 휘두름의 첫 타격이면 RULE-SKILL-BUDGET-001 (기력 수지 정산)
// Result         Struck(대상 수)
//
// 휘두름은 이제 피해를 실어 나르고, 맞혀야 기력이 돈다.
// 쓰러진 몸은 대상에서 빠진다 — 더 이상 타격의 대상이 아니다 (INTENT-DOWNED-001).

import { actionCollider, CENTER_EPSILON, SWING_IMPULSE } from '../semantic/collision';
import { isDowned, isSkillKind } from '../semantic/combat';
import { distance } from '../semantic/position';
import type { WorldState } from '../semantic/world-state';
import { ruleHit } from '../rules/attack';
import { ruleSkillBudget } from '../rules/skill';
import { ruleStrikeDamage } from '../rules/strike-damage';

export function ruleSwingStrike(state: WorldState): number {
  let struckCount = 0;

  for (const attacker of state.actors) {
    const collider = actionCollider(attacker);
    if (!collider || !collider.active) continue;

    const action = attacker.currentAction; // kind = 스킬 — collider 가 보장한다
    if (!isSkillKind(action.kind)) continue;
    const skill = action.kind;
    const struck = (action.struckActorIds ??= []);

    for (const target of state.actors) {
      if (target.id === attacker.id) continue;
      if (struck.includes(target.id)) continue;
      if (isDowned(target)) continue; // 쓰러진 몸은 대상이 아니다

      const d = distance(collider.center, target.position);
      if (d > collider.radius + target.bodyRadius) continue;

      struck.push(target.id);

      ruleHit(target);

      // 밀쳐냄은 휘두른 몸의 중심에서 멀어지는 방사 방향 (칼끝이 아니라 몸에서)
      const px = target.position.x - attacker.position.x;
      const pz = target.position.z - attacker.position.z;
      const pd = Math.sqrt(px * px + pz * pz);
      const nx = pd > CENTER_EPSILON ? px / pd : 1;
      const nz = pd > CENTER_EPSILON ? pz / pd : 0;
      target.velocity.x += nx * (SWING_IMPULSE / target.bodyMass);
      target.velocity.z += nz * (SWING_IMPULSE / target.bodyMass);

      // 고정 피해가 들어가고, 이 휘두름의 첫 타격이면 기력 수지를 낸다.
      ruleStrikeDamage(state, attacker, target, skill);
      ruleSkillBudget(attacker, skill);

      struckCount++;
    }
  }

  return struckCount;
}
