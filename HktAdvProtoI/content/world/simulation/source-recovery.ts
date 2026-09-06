// RULE-SOURCE-RECOVERY-001 — Implements C013 spec R1 (ADDED · 세계 과정)
// Scope          모든 방의, phase 가 available 이 아닌 원천 전부
// Trigger        세계의 Tick (dt)
// Condition      그 원천에 걸린 조건이 없다 (매달린 원천이 available 이거나 매달린 것이 없다)
// Transition     progress += dt.
//                progress ≥ recoverySeconds × RECOVERY_VISIBLE_FRACTION 이고 depleted 면
//                    phase = recovering · 자리를 옮기는 원천이면 siteIndex = 무너지지 않은 다음 마디
//                progress ≥ recoverySeconds 면 phase = available · taken = 0 · progress = 0
// Result         (없음 — 세계가 되돌릴 뿐이다. 무엇이 달라졌는지는 관찰 결과가 말한다)
//
// **관찰자와 무관하다** (spec R1 경계 ①). 그 방에 몸이 없어도, 세계 어디에도 관찰자가 없어도
// 돈다 — 미로의 재배열(RULE-MAZE-CONNECTION-001)이 세운 선례 그대로 세계 과정이다.
//
// **규칙은 방의 이름도 재료의 이름도 알지 못한다** (spec R13 · L2-World-Region R13). 여기가
// 아는 것은 "State 를 가진 원천" 뿐이고, 그것이 노두인지 허물인지 · 얼마나 걸리는지 · 무엇에
// 매달렸는지는 전부 데이터(content/regions)와 세계 사실(semantic/resource.ts)에서 온다.
//
// 걸린 조건은 여기서 다시 판정하지 않는다 — RULE-SOURCE-CONDITION-001(sourceConditions)이
// 답하는 그것을 그대로 읽는다. 그래서 관찰 결과에 실리는 `recovery-stalled` 와 실제로 멎는
// 것이 **같은 판정**이다 (spec R2 — 표시가 아니라 원인이다).

import { nextStandableSite, sourceConditions, sourcesInRegion } from '../semantic/resource';
import { RECOVERY_VISIBLE_FRACTION, type WorldState } from '../semantic/world-state';

export function ruleSourceRecovery(state: WorldState, dt: number): void {
  // 방의 State 를 훑는다 — 원천 State 가 없는 방은 되돌릴 것도 없다 (백왕령 · 미로).
  // Object.entries 의 순서는 삽입 순서이고 State 는 REGION_SPECS 순서로 세워졌다 (결정론).
  for (const [regionId, regionState] of Object.entries(state.regionStates)) {
    if (!regionState.sources) continue;
    // 데이터의 원천 순서로 돈다 — State 의 키 순서에 기대지 않는다 (결정론).
    for (const source of sourcesInRegion(regionId)) {
      const sourceState = regionState.sources[source.id];
      if (!sourceState) continue;
      // 되돌아올 것이 없는 원천은 지나간다 — 되돌아옴은 **고갈된 것의 일**이다 (SPEC-010 경계).
      if (sourceState.phase === 'available') continue;
      // 매달린 것이 available 이 아니면 진행이 오르지 않는다 (spec R1 ELSE · R2).
      if (sourceConditions(state.regionStates, source).length > 0) continue;

      sourceState.progress += dt;

      // 눈에 보이기 시작하는 문턱 — 그림이 갈리고 흙이 다시 짙어지며, 자리를 옮기는 원천은
      // **여기서** 옮겨 선다. 예보가 서려면 자리가 먼저 서야 하기 때문이다 (spec 기본형 ②).
      if (
        sourceState.phase === 'depleted' &&
        sourceState.progress >= source.recoverySeconds * RECOVERY_VISIBLE_FRACTION
      ) {
        sourceState.phase = 'recovering';
        // 마디가 하나뿐인 원천도 · 무너지지 않은 마디가 하나도 없는 원천도 옮기지 않는다
        // (spec R1 경계 ③ — 지날 수 없는 자리에 세우지 않는다).
        const next = nextStandableSite(source, sourceState.siteIndex, sourceState.collapsedSites);
        if (next !== null) sourceState.siteIndex = next;
      }

      // 다 돌아온 문턱 — 다시 캘 수 있다. 캔 횟수가 0 으로 돌아가지 않으면 돌아온 것이
      // 아니다 (spec 기본형 ⑥). 한 Tick 에 두 문턱을 함께 넘어도 자리 이동은 위에서 한 번뿐이다
      // (경계 ②) — 두 if 가 같은 Tick 에 차례로 성립할 뿐이다.
      if (sourceState.progress >= source.recoverySeconds) {
        sourceState.phase = 'available';
        sourceState.taken = 0;
        sourceState.progress = 0;
      }
    }
  }
}
