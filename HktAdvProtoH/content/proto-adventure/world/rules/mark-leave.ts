// RULE-MARK-LEAVE-001 — Implements INTENT-A-MARK-RESTS-ON-THE-OTHER-001 ·
//                                  INTENT-MARKS-DO-NOT-PILE-UP-001 ·
//                                  INTENT-THE-MARK-DOES-NOT-ASK-WHO-DRIVES-001
// Input          남기는 Actor, 남는 Actor, 지금 시각
// Preconditions  없음 — 부르는 자리(RULE-SWING-STRIKE-001)가 이미 접촉과 적대를 쟀다
// Transition     남는 Actor.Marks[남기는 Actor.Id] = 지금 시각
// Result         Left
//
// 이미 그 자리에 값이 있으면 **덮는다** — 둘이 되지 않는다. 그래서 표식이 겹쳐
// 커지는 일이 세계에 없다 (MC-CONDITION-STACKING 은 이 Cycle 의 EXCLUDED 다).
//
// Input 에 **누가 조종하는 몸인지가 없다.** 자율 존재가 남긴 표식도 사람이 조종하는
// 몸에 붙고, 그 반대도 같다.

import type { ActorState } from '../semantic/actor';

export function ruleMarkLeave(by: ActorState, on: ActorState, worldTime: number): void {
  on.marks[by.id] = worldTime;
}
