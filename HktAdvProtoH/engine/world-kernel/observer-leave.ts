// RULE-OBSERVER-LEAVE-001 — Implements INTENT-OBSERVER-LEAVE-001
// Input          이어짐을 잃은 관찰자의 Id
// Preconditions  세계가 아는 관찰자다
// Transition     1. Observer.Present = false
//                2. 몸은 그대로 둔다 — 자리에서 사라지지 않는다
//                3. 하고 있던 행동은 취소하지 않는다 — RULE-ACTION-PROGRESS-001 이
//                   세계의 시간대로 끝까지 진행시킨다
// Result         Success(Id) | Failure(unknown-observer)
//
// 몸은 세계에서 사라지지 않는다. 세계는 보는 이가 있는지에 따라 달라지지 않기 때문이다.
// 이 Rule 은 몸을 자율 존재로 바꾸지도 않는다 — Control 은 player 그대로이며
// RULE-NPC-DECIDE-001 의 대상이 되지 않는다. 보는 이가 없는 몸은 스스로 새 행동을
// 시작하지 않는다 (INTENT-OBSERVER-LEAVE-001).

import type { ActionResult } from '../../protocol/actions';
import { RULE_OBSERVER_LEAVE } from '../../protocol/semantic-id';
import { findObserver, type CoreWorldState } from './state';

export function ruleObserverLeave(state: CoreWorldState, observerId: string): ActionResult {
  const observer = findObserver(state, observerId);
  if (!observer) {
    return { status: 'failure', rule: RULE_OBSERVER_LEAVE, reason: 'unknown-observer' };
  }

  observer.present = false;
  return { status: 'success', rule: RULE_OBSERVER_LEAVE };
}
