// RULE-SWING-STRIKE-001 — Implements INTENT-ACTION-COLLIDER-001 · INTENT-SWING-IMPACT-001 ·
//                                    INTENT-BODY-FACING-001 (C006)
//                                  · INTENT-STRIKE-DAMAGE-001 · INTENT-SKILL-BUDGET-001 (C007)
// Input          ActionCollider 가 Active 인 모든 Actor (Tick 마다)
// Preconditions  대상 = 자신이 아니고, 쓰러지지 않았고,
//                칼끝(Collider.Center)과의 거리 <= Collider.Radius + 대상.Body.Radius 이고
//                CurrentAction.StruckActorIds 에 아직 없는 몸
// Transition     대상마다: StruckActorIds += 대상,
//                RULE-HIT-001 (C019 CHANGED — 선딜이면 캔슬 · 이미 나갔으면 그대로) +
//                SWING_IMPULSE 충격량 (C006 그대로),
//                RULE-STRIKE-DAMAGE-001 (그 스킬의 고정 피해),
//                이 휘두름의 첫 타격이면 RULE-SKILL-BUDGET-001 (기력 수지 정산)
// Result         Struck(대상 수)
//
// C007 CHANGED — 휘두름은 이제 피해를 실어 나르고, 맞혀야 기력이 돈다.
// 쓰러진 몸은 대상에서 빠진다 — 더 이상 타격의 대상이 아니다 (INTENT-DOWNED-001).
// P6 CHANGED — 접촉 판정과 충격은 엔진 솔버(physics/sweep)가 한다. 이 Rule 이 소유하는
// 것은 접촉의 **의미**다: 누가 대상인가(자신·기격·쓰러진 몸 제외), 닿으면 무슨 일이
// 일어나는가(피격·피해·기력 수지).

import { applyRadialImpulse, circleHits } from '../../../../engine/physics/sweep';
import { actionCollider, SWING_IMPULSE } from '../semantic/collision';
import { forceOfSkill, isDowned, isSkillKind } from '../semantic/combat';
import type { WorldState } from '../semantic/world-state';
import { ruleHarmGate } from '../rules/relation';
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
      if (isDowned(target)) continue; // 쓰러진 몸은 대상이 아니다 (C007)

      if (!circleHits(collider.center, collider.radius, target)) continue;

      // 닿았다는 사실은 성립 여부와 무관하다 (C018 CHANGED) — StruckActorIds 는
      // "맞은 몸들" 이 아니라 **"이 휘두름이 이미 닿은 몸들"** 이다. 성립하지 않은 접촉도
      // 여기 담지 않으면 한 휘두름이 지나가는 동안 같은 무산이 매 Tick 쌓인다.
      struck.push(target.id);

      // RULE-HARM-GATE-001 (C018) — 적대가 성립하지 않으면 아무 일도 일어나지 않는다.
      // 피해도 · 끊김도 · 미는 힘도 · 기력 수지도 없다. 닿았다는 사실과 그 사유만 남는다
      // (INTENT-HARM-GATE-001 · INTENT-UNHARMED-IS-OBSERVABLE-001).
      const gate = ruleHarmGate(attacker, target);
      if (gate.status === 'refused') {
        state.unharmedContacts.push({
          attackerId: attacker.id,
          targetId: target.id,
          skill,
          position: { x: target.position.x, z: target.position.z },
          time: state.time,
          reason: gate.reason,
        });
        continue;
      }

      // C019 CHANGED — 피격이 시점을 묻는다. 선딜이면 그 기술이 캔슬되고,
      // 이미 나갔으면 아무것도 하지 않는다 (RULE-HIT-001). 아래 셋은 결과와 무관하게
      // 그대로 일어난다 — 맞은 사실 · 밀려남 · 피해 · 기력 수지.
      ruleHit(state, target, attacker);

      // 밀쳐냄은 휘두른 몸의 중심에서 멀어지는 방사 방향 (칼끝이 아니라 몸에서) — P6: 엔진 솔버
      applyRadialImpulse(attacker.position, target, SWING_IMPULSE);

      // C007 — 고정 피해가 들어가고, 이 휘두름의 첫 타격이면 기력 수지를 낸다.
      ruleStrikeDamage(state, attacker, target, forceOfSkill(skill), skill);
      ruleSkillBudget(attacker, skill);

      struckCount++;
    }
  }

  return struckCount;
}
