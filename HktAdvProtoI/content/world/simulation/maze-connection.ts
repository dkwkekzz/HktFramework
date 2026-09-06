// RULE-MAZE-CONNECTION-001 — Implements C008 spec R1 (Core · Region Rule)
// Scope          그 방의 State 를 가진 Region 안의 **모든 몸** (관찰자 · 자율 존재 구분 없음)
// Trigger        이동으로 몸의 자리가 바뀐다 (RULE-MOVE-PROGRESS-001 이 적은 movedThisTick)
// Condition      항상 — 그 방 안에 있으면
// Transition     pressure += 움직인 거리 × k.  pressure ≥ P 이면
//                pattern = 순환의 다음 하나 · pressure = 0 · rearrangedAt = 지금
// Result         (없음 — 세계가 기억할 뿐이다. 무엇이 바뀌었는지는 관찰 결과가 말한다)
//
// **규칙은 방의 이름을 알지 못한다.** 여기가 아는 것은 "State 를 가진 방" 뿐이고 그 방이
// 미로인지 무엇인지는 데이터(content/regions)에만 있다 (spec R1 비고 · C004 가 세운 규율).
// 압력의 상수(P · k)도 그 방의 규칙 데이터에서 온다 — 방마다 다를 수 있는 값이다.
//
// 재배열이 바꾸는 것은 통로의 **열림/닫힘뿐**이다 (spec R3 RULE-STABLE-PLANT-CLUE-001) —
// 컴파일 결과도 clue point 도 cell area 도 Region hash 도 한 값도 바뀌지 않는다.

import { nextPatternName, regionRuleOf } from '../semantic/region-state';
import type { WorldState } from '../semantic/world-state';

export function ruleMazeConnection(state: WorldState): void {
  // 이 tick 에 각 방에 쌓인 걸음 — 몸을 한 번만 훑는다 (배열 순서 = 결정론).
  // 몸이 선 방에 State 가 없으면 그 걸음은 아무 데도 쌓이지 않는다 (미로 밖은 그대로다 · SPEC-010).
  for (const actor of state.actors) {
    // C012 CHANGED — 방의 State 에서 규칙 쪽만 읽는다. 원천 State 는 이 규칙과 무관하다.
    const regionState = state.regionStates[actor.regionId]?.rule;
    if (!regionState) continue;
    const rule = regionRuleOf(actor.regionId);
    if (!rule) continue;
    if (!(actor.movedThisTick > 0)) continue;
    regionState.pressure += actor.movedThisTick * rule.pressurePerDistance;
  }

  // 넘친 방은 패턴이 **한 칸** 넘어간다 — 크게 넘겨도 한 tick 에 여러 칸 가지 않는다
  // (SPEC-004 경계. 여러 칸을 넘기면 관찰자가 인과를 볼 수 없다).
  for (const [regionId, entry] of Object.entries(state.regionStates)) {
    const regionState = entry.rule;
    const rule = regionRuleOf(regionId);
    if (!regionState || !rule) continue;
    if (regionState.pressure < rule.pressureLimit) continue;
    regionState.pattern = nextPatternName(rule, regionState.pattern);
    regionState.pressure = 0;
    regionState.rearrangedAt = state.time;
  }
}
