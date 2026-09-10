// World Semantic — **기회가 지금 열려 있는가** (C037 ADDED · spec R1 · SPEC-002 · SPEC-003 ·
// L2-World-Foundation §4.5 · G4).
//
// C036 이 기회를 세우며 미룬 자리가 여기다: 그때 availability 는 **형으로 적힐 뿐** 아무도
// 평가하지 않았다. 이 파일이 그것을 평가한다 — C035 의 평가기(evaluateCondition)와 이 세계의
// 읽기(worldConditionReader)를 그대로 쓴다. 새 평가기도 새 어휘도 짓지 않는다.
//
// 지키는 것.
//   ① **아무것도 저장하지 않는다** (spec 기본형 ②) — 열림 · 닫힘 · 완료는 전부 유도다.
//      원천의 phase 와 방의 기억이 이미 그것을 들고 있고, 여기는 그 둘을 조건의 형으로 읽는다.
//   ② **아무것도 판정을 바꾸지 않는다** — Interaction 의 available 도 reason 도 원천의 phase 도
//      한 값 달라지지 않는다 (RULE-MINE-COMPLETE-001 · RULE-SOURCE-RECOVERY-001 은 이 파일을
//      읽지 않는다). 기회는 여전히 판정하지 않는다 (C036 기본형 ①).
//   ③ **판정 불가는 열지 않되 닫힘으로도 말하지 않는다** (spec 기본형 ③ · SPEC-003) — 이 파일이
//      내는 것은 "열려 있는가" 하나이고 그 답은 참·거짓뿐이다. 왜 열려 있지 않은가는 말하지
//      않는다: 「지금은 없다」 는 Event 에만 붙고(그것은 화면의 일이다), 판정 불가 잎을 가진
//      기회(문의 요구)는 Event 가 아니다.
//   ④ **이름을 모른다** — 방도 원천도 경로도 이름으로 알지 못한다. 어느 기회가 무엇을 읽는지는
//      데이터(content/regions)에만 있다.

import {
  isEventOpportunity,
  type Opportunity,
} from '../../../engine/world-authoring/opportunity';
import { worldConditionVerdict } from './condition';
import type { WorldState } from './world-state';

/**
 * RULE-OPPORTUNITY-OPEN-001 (C037 ADDED · spec R1 · SPEC-002 · SPEC-003) —
 * **기회의 availability 를 평가해 열림을 유도한다.**
 *
 * IF availability 가 참(met) THEN 열려 있다 (op 표의 opportunity OPEN)
 * ELSE IF 거짓(unmet) THEN 열려 있지 않다 (CLOSE)
 * ELSE (판정 불가) THEN 열려 있지 않다 — **닫혔다고 말하는 것이 아니라 열지 않는 것이다**.
 * availability 를 밝히지 않은 기회는 **늘 있는 기회**이므로 언제나 열려 있다 (빈 all 이 참인
 * 그 어법 · Opportunity 형의 약속).
 *
 * 저장하지 않는다 — 부를 때마다 지금의 세계에서 다시 판정한다 (결정론: 같은 State · 같은
 * 시각이면 같은 답이다).
 */
export function isOpportunityOpen(state: WorldState, opportunity: Opportunity): boolean {
  const { availability } = opportunity;
  if (availability === undefined) return true;
  return worldConditionVerdict(state, availability) === 'met';
}

/**
 * 관찰이 그 기회에 대해 싣는 것 둘 — **때가 있는가**(event)와 **지금 열려 있는가**(open).
 *
 * 둘 다 유도다: event 는 데이터(availability 에 시간 qualifier 가 있는가)에서, open 은 위
 * 규칙에서 온다. 언제 열리는가 · 무엇이 여는가 · 남은 시간은 어느 쪽에도 없다 (spec Observable).
 */
export function opportunityStanding(
  state: WorldState,
  opportunity: Opportunity,
): { event: boolean; open: boolean } {
  return {
    event: isEventOpportunity(opportunity),
    open: isOpportunityOpen(state, opportunity),
  };
}
