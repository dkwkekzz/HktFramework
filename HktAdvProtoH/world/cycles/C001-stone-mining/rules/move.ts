// RULE-MOVE-001 — Implements INTENT-MOVE-001
// Input          Actor, TargetPosition
// Preconditions  TargetPosition 이 World.Bounds 안에 있다
// Transition     Actor.MoveTarget = TargetPosition
// Result         Success | Failure(out-of-bounds)

import type { ActionResult } from '../../../../protocol/actions';
import { RULE_MOVE } from '../../../../protocol/semantic-id';
import { inBounds, type WorldPosition } from '../semantic/position';
import type { WorldState } from '../../../kernel/state';

export function ruleMove(state: WorldState, target: WorldPosition): ActionResult {
  if (!inBounds(target, state.bounds)) {
    return { status: 'failure', rule: RULE_MOVE, reason: 'out-of-bounds' };
  }
  state.actor.moveTarget = { x: target.x, z: target.z };
  return { status: 'success', rule: RULE_MOVE };
}
