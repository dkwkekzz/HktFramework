// RULE-REQUEST-REPLY-001 — Implements INTENT-REQUEST-REPLY-001 · INTENT-REPLY-CORRESPONDENCE-001
//
// Input          요청한 Observer.Id, 요청 하나, 그 요청에 실려 온 Request.Mark (있으면)
// Preconditions  없음 — 도착한 모든 요청이 대답을 받는다.
//                세계가 모르는 관찰자의 요청도 "모르는 관찰자다" 라는 대답을 받는다.
//                걸 수 없는 명령을 건 것도 "그런 명령이 없다" 라는 대답을 받는다.
// Transition     없음 — 세계의 상태는 이 Rule 로 바뀌지 않는다.
//                세계는 누가 무엇을 걸었는지 기억하지 않는다 (INTENT-COMMAND-HISTORY-001).
// Result         그 요청을 판정한 Rule 의 결과를 그대로 낸다 —
//                받아들임(어느 Rule 이) | 거절(어느 Rule 이, 무슨 사유로).
//                요청에 실려 온 Mark 를 그대로 붙여 낸다. 요청한 Observer 에게만 간다.
//
// 대답이 왜 World State 가 아닌가 (03 RATIONALE 2):
//   요청은 도착 즉시 판정되지 않고 받아 두었다가 Tick 에 판정된다.
//   따라서 대답이 나오는 자리는 그 Tick 이며, 관찰자별 관찰 결과가 나오는 자리와 같다.
//   관찰 결과가 State 가 아니라 Tick 의 산출물이듯 대답도 그렇다.
//
// 이 Rule 은 없던 판정을 만들지 않는다. 각 Rule 은 지금까지도 사유를 담은 Result 를
// 내고 있었고, 그것을 받아 갈 곳이 없어 버려졌을 뿐이다 (R2 의 "그 이유를 남긴다"
// 와 "그 이유가 닿는다" 사이에 없던 길).

import type { ActionRequest, ActionResult } from '../protocol-core/actions';
import type { RequestOutcomeView } from '../protocol-core/gameview';

/** 대답 하나와 그것이 갈 관찰자 */
export interface AddressedOutcome {
  observerId: string;
  outcome: RequestOutcomeView;
}

export function ruleRequestReply(
  observerId: string,
  action: ActionRequest,
  result: ActionResult,
): AddressedOutcome {
  return {
    observerId,
    outcome: {
      accepted: result.status === 'success',
      rule: result.rule,
      ...(result.status === 'failure' ? { reason: result.reason } : {}),
      // 세계는 표식을 해석하지 않는다 — 받은 그대로 되돌린다.
      ...(action.mark === undefined ? {} : { mark: action.mark }),
    },
  };
}

/** 한 Tick 이 판정한 요청들의 대답을 관찰자별로 모은다 — 순서는 판정 순서 그대로다. */
export function groupOutcomesByObserver(
  addressed: readonly AddressedOutcome[],
): Map<string, RequestOutcomeView[]> {
  const byObserver = new Map<string, RequestOutcomeView[]>();
  for (const { observerId, outcome } of addressed) {
    const existing = byObserver.get(observerId);
    if (existing) existing.push(outcome);
    else byObserver.set(observerId, [outcome]);
  }
  return byObserver;
}
