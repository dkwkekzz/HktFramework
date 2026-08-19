// RULE-STRIKE-EVENT-EXPIRE-001 — Implements INTENT-STRIKE-OBSERVE-001
// Input          World.StrikeEvents, World.Time
// Preconditions  World.Time - Event.Time > STRIKE_EVENT_TTL
// Transition     해당 Event 를 World.StrikeEvents 에서 제거한다
// Result         Expired(count)
//
// Tick 순서에서 시간 진행 뒤에 놓인다: 방금 일어난 결과가 최소 한 번은 관찰되어야 한다.

import { STRIKE_EVENT_TTL } from './combat';
import type { WorldState } from '../../base/world-state';

export function ruleStrikeEventExpire(state: WorldState): number {
  const before = state.strikeEvents.length;
  state.strikeEvents = state.strikeEvents.filter(
    (event) => state.time - event.time <= STRIKE_EVENT_TTL,
  );
  return before - state.strikeEvents.length;
}
