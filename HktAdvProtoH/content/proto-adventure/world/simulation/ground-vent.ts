// RULE-GROUND-VENT-001 (C-TERRAIN-002 ADDED)
//
// Implements     INTENT-A-FULL-PLACE-VENTS-001 ·
//                INTENT-VENTING-SPENDS-WHAT-WAS-KEPT-001 ·
//                INTENT-WHAT-THE-LAND-RETURNS-THE-BODY-RECEIVES-001 ·
//                INTENT-THE-EXCEPTION-IS-NOT-PLACED-001 ·
//                INTENT-WHERE-YOU-STOOD-DECIDES-WHERE-OPENS-001
// Input          모든 GroundZone, 모든 Actor, dt
// Preconditions  없음 — 모든 자리를 훑는다. 자리마다 자기 단계가 무엇을 할지 정한다
// Transition     ① binding 이고 kept ≥ Law.saturation → phase = 'venting'   (넘쳤다)
//                ② venting 이면
//                      그 자리 안의 쓰러지지 않은 몸마다 (actors 순서로)
//                          give = min(Law.ventRate × dt, warmthMax − warmth, 남은 kept)
//                          warmth += give ·  kept −= give
//                      아무 몸도 받지 못했으면 (준 것의 합 = 0)
//                          kept −= min(kept, Law.escapeRate × dt)          (흩어진다)
//                      kept ≤ 0 → kept = 0 · phase = 'binding'             (닫혔다)
// Result         Brimmed | Vented(given) | Escaped | Closed | Filling
//
// ── 이 규칙이 세우는 것 ──────────────────────────────────────────────
//
// **예외 자리가 생겨나고 사라진다.** 어디에 생기는가는 어디서 거두었는가의 결과이며,
// 그래서 이 땅에서 안전한 자리를 아는 방법은 좌표를 외우는 것이 아니라 법칙을 읽는
// 것이 된다. 어제 쉬어 간 자리가 오늘은 닫혀 있을 수 있고, 그것은 세계가 무작위로
// 흔든 것이 아니라 그 사이에 누군가 어딘가에서 열을 빼앗겼기 때문이다.
//
// 그리고 이 세계에 처음으로 **되풀이되는 것**이 생긴다 — 차고, 넘치고, 비고, 다시
// 찬다. 그 되풀이의 길이는 세계가 정한 주기가 아니라 겪은 일의 결과다
// (DC-WORLD-TERRAIN-IS-A-PRINCIPLE 의 requires 가 요구하는 "반복").
//
// ── 왜 뿜는 자리는 거두지 않는가 ─────────────────────────────────────
//
// 동시에 거두면 그 자리는 자기가 준 것을 도로 받아 영영 닫히지 않는다
// (ventRate 6 · rate 4 이므로 순환이 멎지 않는다). 의미로도 그렇다 — 예외의 내용이
// 곧 **그 법칙이 멎는 것**이고, 뿜음이 곧 멎음이다 (03 RATIONALE 3).
// 그 멎음은 RULE-GROUND-LAW-APPLY-001 의 Precondition 이 `bindingZonesAt` 으로
// 이미 강제한다 — 여기서 다시 막지 않는다.
//
// Tick 순서에서 RULE-GROUND-LAW-APPLY-001 **바로 뒤**다. 거두는 일이 이 Tick 의 kept 를
// 먼저 확정하고 그 결과가 넘침인지를 같은 Tick 에서 묻는다 — "찼다" 와 "열린다" 사이에
// 한 Tick 의 틈이 없다.

import { isDowned } from '../semantic/combat';
import { GROUND_LAWS, isInsideGroundZone } from '../semantic/terrain';
import type { WorldState } from '../semantic/world-state';

export function ruleGroundVent(state: WorldState, dt: number): number {
  let ventingCount = 0;

  for (const zone of state.groundZones) {
    const law = GROUND_LAWS[zone.law];

    // ① 넘쳤다 — 이 자리에서 그 법칙이 멎기 시작한다.
    if (zone.phase === 'binding' && zone.kept >= law.saturation) {
      zone.phase = 'venting';
    }

    if (zone.phase !== 'venting') continue;
    ventingCount++;

    // ② 뿜는다 — 그 자리 안의 몸이 받고, 나간 만큼 지닌 것이 준다.
    //
    // 몸마다 ventRate 를 준다. 셋이 서 있으면 셋 다 받고 그만큼 자리가 빨리 빈다 —
    // 뿜는 일은 몸을 세지 않으므로 나누지 않는다. 나가는 총량이 kept 로 잘리므로
    // 보존은 어느 쪽이든 참이다.
    let given = 0;
    for (const actor of state.actors) {
      if (isDowned(actor)) continue;
      if (!isInsideGroundZone(zone, actor.position)) continue;

      const room = actor.warmthMax - actor.warmth;
      const give = Math.min(law.ventRate * dt, room, zone.kept - given);
      if (give <= 0) continue; // 가득한 몸은 분출구를 소모하지 않는다

      actor.warmth += give;
      given += give;
    }

    if (given > 0) {
      zone.kept -= given;
    } else {
      // 받는 몸이 없으면 하늘로 흩어진다 — 아무도 없는 분출구도 언젠가는 빈다.
      // 이 값이 없으면 아무도 쓰지 않은 자리가 영영 열려 있고, 예외는 다시 상수가 된다.
      zone.kept -= Math.min(zone.kept, law.escapeRate * dt);
    }

    // ③ 다 쓰면 닫히고 도로 거두기 시작한다 — 이것이 반복이다.
    if (zone.kept <= 0) {
      zone.kept = 0;
      zone.phase = 'binding';
    }
  }

  return ventingCount;
}
