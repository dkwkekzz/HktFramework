// RULE-GROUND-LAW-APPLY-001 (C-TERRAIN-001 ADDED)
//
// Implements     INTENT-GROUND-LAW-TAKES-WHILE-YOU-STAY-001 ·
//                INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001 ·
//                INTENT-BODY-HOLDS-WHAT-THE-LAND-TAKES-001 ·
//                INTENT-THE-LAND-REACHES-LIFE-WHEN-NOTHING-IS-LEFT-001 ·
//                INTENT-GROUND-EXCEPTION-STOPS-THE-LAW-001 ·
//                INTENT-STANDING-IS-THE-WHOLE-INPUT-001
// Input          모든 Actor, dt
// Preconditions  1. Actor 가 쓰러지지 않았다
//                2. role = law 인 자리 안에 있다
//                3. **같은 법칙의** role = respite 인 자리 안에 있지 않다
// Transition     Warmth > 0 이면   Warmth = max(0, Warmth − Law.rate × dt)
//                Warmth = 0 이면   Hp = max(0, Hp − Law.lifeRate × dt)
//                                  Hp 가 0 이 되면 RULE-DOWNED-001
// Result         Taken(law) | Sheltered(law) | Untouched
//
// 판정이 읽는 것은 **Actor.Position 과 World.GroundZones 뿐이다.** 누구인지도,
// 무엇을 지녔는지도, 무엇을 하는 중인지도 묻지 않는다. 쓰러진 몸을 거르는 것은 유일한
// 예외이며, 그것은 신원이 아니라 **이미 끝에 이른 몸**을 두 번 끝내지 않기 위한 것이다.
//
// **어디에도 적히지 않는다.** 들어갔다는 사실도 겪는 중이라는 사실도 몸에 기록되지 않고
// 매 Tick 위치에서 다시 계산된다. 그래서 나가면 저절로 멎고 멎게 하는 규칙이 따로
// 없다 (DC-CONDITION-OPENS-WITHOUT-RECORDING).
//
// Tick 순서에서 RULE-CP-RUN-DRAIN-001 바로 뒤에 놓인다 — 그 규칙이 물리 뒤에 오는
// 이유와 같다. 이 Tick 에 **실제로 서 있게 된 자리**에 대해 값을 치른다.

import { isDowned } from '../semantic/combat';
import { activeGroundLaws, GROUND_LAWS } from '../semantic/terrain';
import type { WorldState } from '../semantic/world-state';
import { ruleDowned } from '../rules/strike-damage';

export function ruleGroundLawApply(state: WorldState, dt: number): number {
  let takenCount = 0;

  for (const actor of state.actors) {
    if (isDowned(actor)) continue;

    // 겹친 자리가 여럿이면 각각이 자기 몫을 거둔다 — 하나를 고르지 않는다.
    // 고르는 순간 어느 것을 고를지의 판단이 규칙에 들어오고, 그것은 법칙이 아니라 조정이 된다.
    const laws = activeGroundLaws(state.groundZones, actor.position);
    if (laws.length === 0) continue;

    for (const lawId of laws) {
      const law = GROUND_LAWS[lawId];

      if (actor.warmth > 0) {
        // 지닌 것이 먼저 빠진다. 이 동안 몸은 상하지 않는다 (BT §5.2).
        actor.warmth = Math.max(0, actor.warmth - law.rate * dt);
      } else {
        // 다하면 법칙이 몸이 이미 가지고 있던 것에 닿는다.
        // 두 값의 단위가 다르므로 한 Tick 안에서 남은 몫을 넘기지 않는다 —
        // 넘기려면 환산이 필요하고, 환산은 이 Cycle 이 답할 이유가 없는 물음이다
        // (03-world-semantic.md RATIONALE 3).
        actor.hp = Math.max(0, actor.hp - law.lifeRate * dt);
        // 새로운 끝을 만들지 않는다 — 이미 있는 것을 그대로 부른다.
        if (actor.hp === 0) ruleDowned(actor);
      }
      takenCount++;
    }
  }

  return takenCount;
}
