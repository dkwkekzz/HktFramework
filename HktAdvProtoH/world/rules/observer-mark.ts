// RULE-OBSERVER-MARK-001 — Implements INTENT-OBSERVER-MARK-001
// Input          표식이 도착한 이어짐의 관찰자, 그 관찰자가 붙인 표식 값
// Preconditions  1. 세계가 아는 관찰자다
//                2. 표식이 유한한 수다
//                3. 표식이 지금까지 받아들인 것보다 크다
// Transition     Observer.AcknowledgedMark = 표식
// Result         Success | Failure(unknown-observer) | Failure(stale-mark)
//
// 이 Rule 은 게임 상태를 바꾸지 않는다. 어떤 행동 Rule 에도 위임하지 않는다.
// 표식이 말하는 것은 하나뿐이다 — "너에게서 여기까지 받았다".
// 늦게 도착한 옛 표식은 받아들인 자리를 뒤로 되돌리지 않는다.
//
// 모르는 관찰자의 표식은 아무것도 바꾸지 못한다 — 요청과 같은 규율이다
// (INTENT-REQUEST-ATTRIBUTION-001).

import type { ActionResult } from '../../protocol/actions';
import { RULE_OBSERVER_MARK } from '../../protocol/semantic-id';
import { findObserver, type WorldState } from '../semantic/world-state';

export function ruleObserverMark(
  state: WorldState,
  observerId: string,
  mark: number,
): ActionResult {
  const observer = findObserver(state, observerId);
  if (!observer) {
    return { status: 'failure', rule: RULE_OBSERVER_MARK, reason: 'unknown-observer' };
  }
  if (!Number.isFinite(mark) || mark <= observer.acknowledgedMark) {
    return { status: 'failure', rule: RULE_OBSERVER_MARK, reason: 'stale-mark' };
  }

  observer.acknowledgedMark = mark;
  return { status: 'success', rule: RULE_OBSERVER_MARK };
}
