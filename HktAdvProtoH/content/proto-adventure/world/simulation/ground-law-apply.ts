// RULE-GROUND-LAW-APPLY-001 (C-TERRAIN-001 ADDED · C-TERRAIN-002 CHANGED)
//
// Implements     INTENT-GROUND-LAW-TAKES-WHILE-YOU-STAY-001 ·
//                INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001 ·
//                INTENT-BODY-HOLDS-WHAT-THE-LAND-TAKES-001 ·
//                INTENT-THE-LAND-REACHES-LIFE-WHEN-NOTHING-IS-LEFT-001 ·
//                INTENT-GROUND-EXCEPTION-STOPS-THE-LAW-001 ·
//                INTENT-STANDING-IS-THE-WHOLE-INPUT-001 ·
//                INTENT-THE-LAND-KEEPS-WHAT-IT-TAKES-001        (C-TERRAIN-002) ·
//                INTENT-ONE-PLACE-RECEIVES-WHAT-IS-TAKEN-001    (C-TERRAIN-002) ·
//                INTENT-VENTING-STOPS-THE-LAW-THERE-001         (C-TERRAIN-002)
// Input          모든 Actor, dt
// Preconditions  1. Actor 가 쓰러지지 않았다
//                2. `phase = 'binding'` 인 자리 안에 있다
//                3. **같은 법칙의** `phase = 'venting'` 인 자리 안에 있지 않다
// Transition     Warmth > 0 이면   taken = min(Warmth, Law.rate × dt)
//                                  Warmth −= taken
//                                  **ReceivingZone.kept += taken** (saturation 을 넘지 않는다)
//                Warmth = 0 이면   Hp = max(0, Hp − Law.lifeRate × dt)
//                                  Hp 가 0 이 되면 RULE-DOWNED-001
//                                  **kept 는 늘지 않는다**
// Result         Taken(law, zone, amount) | Sheltered(law) | Untouched
//
// ── C-TERRAIN-002 가 더하는 한 줄 ────────────────────────────────────
//
// **뺀 만큼을 거두어 간 자리에 더한다.** 그 한 줄이 이 Cycle 의 전부이고, 넘침도
// 뿜음도 예외가 옮겨 다니는 일도 전부 그 결과다 (RULE-GROUND-VENT-001).
//
// 받는 자리는 `bindingZonesAt` 이 지목한 **바로 그 자리**다 — 거두는 일이 법칙당 한 번
// 이므로 받는 자리도 하나여야 하고, 둘에 나누어 넣으면 없던 열을 만들게 된다.
//
// 판정이 읽는 것은 **Actor.Position 과 World.GroundZones 뿐이다.** 누구인지도,
// 무엇을 지녔는지도, 무엇을 하는 중인지도 묻지 않는다. 쓰러진 몸을 거르는 것은 유일한
// 예외이며, 그것은 신원이 아니라 **이미 끝에 이른 몸**을 두 번 끝내지 않기 위한 것이다.
//
// **어디에도 적히지 않는다 — 몸에는.** 들어갔다는 사실도 겪는 중이라는 사실도 몸에
// 기록되지 않고 매 Tick 위치에서 다시 계산된다 (DC-CONDITION-OPENS-WITHOUT-RECORDING).
// 쌓이는 곳은 **땅**이며, 땅의 State 는 판정을 위한 기록이 아니라 세계가 겪은 일의
// 결과다 — 광맥의 남은 자원(C001)과 같은 종류다.
//
// Tick 순서에서 RULE-CP-RUN-DRAIN-001 바로 뒤에 놓인다 — 그 규칙이 물리 뒤에 오는
// 이유와 같다. 이 Tick 에 **실제로 서 있게 된 자리**에 대해 값을 치른다.

import { isDowned } from '../semantic/combat';
import { bindingZonesAt, GROUND_LAWS } from '../semantic/terrain';
import type { WorldState } from '../semantic/world-state';
import { ruleDowned } from '../rules/strike-damage';

export function ruleGroundLawApply(state: WorldState, dt: number): number {
  let takenCount = 0;

  for (const actor of state.actors) {
    if (isDowned(actor)) continue;

    // 법칙당 한 자리 — 그 자리가 거두고 그 자리가 받는다.
    const zones = bindingZonesAt(state.groundZones, actor.position);
    if (zones.length === 0) continue;

    for (const zone of zones) {
      const law = GROUND_LAWS[zone.law];

      if (actor.warmth > 0) {
        // 지닌 것이 먼저 빠진다. 이 동안 몸은 상하지 않는다 (BT §5.2).
        const taken = Math.min(actor.warmth, law.rate * dt);
        actor.warmth -= taken;

        // ── 보존 — 이 세 줄이 C-TERRAIN-002 다 ────────────────────
        // 넘치는 몫은 그릇 밖으로 간다. 자르지 않으면 kept 가 무한히 자라
        // 한 번 크게 찬 자리가 영영 닫히지 않는 분출구가 되고, 그것은 상수로
        // 놓인 예외가 다른 이름으로 돌아온 것이다 (03 RATIONALE 2).
        zone.kept = Math.min(law.saturation, zone.kept + taken);
      } else {
        // 다하면 법칙이 몸이 이미 가지고 있던 것에 닿는다.
        // **그 몫은 자리에 쌓이지 않는다** — 법칙이 거두는 것은 열이고, 생명에 닿는
        // 것은 거둘 것이 없어진 뒤의 결과이며 두 값의 단위가 다르다. 쌓으려면 환산이
        // 필요하고 환산은 이 Cycle 이 답할 이유가 없는 물음이다 (03 RATIONALE 1).
        // 그래서 세계의 열은 몸이 얼어 죽는 자리에서만 준다.
        actor.hp = Math.max(0, actor.hp - law.lifeRate * dt);
        // 새로운 끝을 만들지 않는다 — 이미 있는 것을 그대로 부른다.
        if (actor.hp === 0) ruleDowned(actor);
      }
      takenCount++;
    }
  }

  return takenCount;
}
