// RULE-STRIKE-EVENT-EXPIRE-001 — Implements INTENT-STRIKE-OBSERVE-001 ·
//                                            INTENT-UNHARMED-IS-OBSERVABLE-001 (C018)
// Input          World.StrikeEvents, World.UnharmedContacts, World.Time
// Preconditions  World.Time - 항목.Time > STRIKE_EVENT_TTL
// Transition     해당 항목을 각자의 목록에서 제거한다
// Result         Expired(count)
//
// C018 CHANGED — 무산된 접촉도 같은 수명을 가진다. 수명 규칙을 둘로 나누지 않는다.
//
// Tick 순서에서 시간 진행 뒤에 놓인다: 방금 일어난 결과가 최소 한 번은 관찰되어야 한다.

import { STRIKE_EVENT_TTL } from '../semantic/combat';
import type { WorldState } from '../semantic/world-state';

export function ruleStrikeEventExpire(state: WorldState): number {
  const before = state.strikeEvents.length + state.unharmedContacts.length;
  state.strikeEvents = state.strikeEvents.filter(
    (event) => state.time - event.time <= STRIKE_EVENT_TTL,
  );
  state.unharmedContacts = state.unharmedContacts.filter(
    (contact) => state.time - contact.time <= STRIKE_EVENT_TTL,
  );
  return before - state.strikeEvents.length - state.unharmedContacts.length;
}
