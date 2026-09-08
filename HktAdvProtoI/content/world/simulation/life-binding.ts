// RULE-LIFE-BINDING-001 — Implements C022 spec R3 (ADDED · 세계 과정)
// Scope          모든 방의, 밝혀진 탄생지 전부
// Trigger        세계의 Tick (dt)
// Condition      그 탄생지의 요구가 **다 차 있다** (RULE-LIFE-CONDITION-001 이 답한다) AND
//                phase 가 DORMANT 또는 BINDING 이다
// Transition     phase = BINDING · progress += dt / 결속의 길이 (1 을 넘지 않는다)
//                ELSE phase = DORMANT · **진행은 그 자리에 멎는다** (지워지지 않는다)
// Result         (없음 — 세계가 맺을 뿐이다. 무엇이 달라졌는지는 흔적과 조건 코드가 말한다)
//
// **관찰자와 무관하다** (spec SPEC-004 경계 ③) — 그 방에 몸이 없어도, 세계 어디에도 관찰자가
// 없어도 돈다. 되돌아옴(RULE-SOURCE-RECOVERY-001)이 세운 그 선례 그대로 세계 과정이다.
//
// **다 차도 아무 일이 일어나지 않는다** (spec R3 경계 ① · SPEC-005 경계 ②) — 진행이 1 에
// 닿아도 phase 는 BINDING 그대로이고, 뿌리혹도 균사도 개체군도 한 값 달라지지 않는다.
// 태어남(BORN)과 소비는 C023 이다. 여기서 데이터의 `transition` 도 `consumes` 도 읽지 않는다.
//
// **규칙은 어떤 탄생지도 어떤 조건도 이름으로 알지 못한다** (Life F13 · R13 · C004 가 세운
// 규율). 여기가 아는 것은 "State 를 가진 탄생지" 와 "그 요구가 지금 차 있는가" 뿐이고,
// 그것이 알집인지 · 무엇을 요구하는지 · 무엇이 모자랄 때 어느 글자가 걸리는지는 전부
// 데이터(content/regions)와 세계 사실(semantic/life.ts)에서 온다.
//
// 요구는 여기서 다시 판정하지 않는다 — RULE-LIFE-CONDITION-001(lifeUnmetCodes)이 답하는
// 그것을 그대로 읽는다. 그래서 관찰 결과에 실리는 **모자람의 코드**와 실제로 멎는 것이
// **같은 판정**이다 (C013 이 되돌아옴에 세운 그 규율 — 표시가 아니라 원인이다).
//
// 이 규칙은 **새 layer 도 새 Rule 문법도 만들지 않는다** (F13 · Life §3.1) — 되돌아옴 곁에
// 나란히 서는 세계 과정 하나일 뿐이다.

import { isBindablePhase, lifeSitesInRegion, lifeUnmetCodes } from '../semantic/life';
import type { WorldState } from '../semantic/world-state';

export function ruleLifeBinding(state: WorldState, dt: number): void {
  // 방의 State 를 훑는다 — 탄생지 State 가 없는 방은 맺을 것도 없다 (지금은 거목의 방 하나뿐이다).
  // Object.entries 의 순서는 삽입 순서이고 State 는 REGION_SPECS 순서로 세워졌다 (결정론).
  for (const [regionId, regionState] of Object.entries(state.regionStates)) {
    if (!regionState.lifeSites) continue;
    // 데이터의 탄생지 순서로 돈다 — State 의 키 순서에 기대지 않는다 (결정론).
    for (const site of lifeSitesInRegion(regionId)) {
      const siteState = regionState.lifeSites[site.id];
      if (!siteState) continue;
      // 이미 태어났거나 빈 자리는 지나간다 — 이 Cycle 이 오가는 것은 앞의 둘뿐이다
      // (규칙이 스스로 도달할 수 없는 자리를 여기서 되돌리지 않는다).
      if (!isBindablePhase(siteState.phase)) continue;

      // 요구가 하나라도 모자라면 **그 Tick 에** 맺힘이 풀린다 (spec SPEC-004 경계 ①).
      // 진행은 지우지 않는다 — 늦어지는 것이지 처음부터 다시가 아니다 (spec 기본형 ③ ·
      // C013 이 매달린 원천에 준 "되돌아옴이 멎었다" 와 같은 어법).
      if (lifeUnmetCodes(state.regionStates, site, state.time).length > 0) {
        siteState.phase = 'DORMANT';
        continue;
      }

      siteState.phase = 'BINDING';
      // 세계 시간으로 오른다. 길이가 0 이하인 탄생지는 오르지 않는다 — 나눌 수 없는 것을
      // 나누어 없는 답을 짓지 않는다 (isFlowActive 가 주기 0 에 하는 그대로).
      if (site.bindingSeconds > 0) {
        siteState.progress = Math.min(1, siteState.progress + dt / site.bindingSeconds);
      }
    }
  }
}
