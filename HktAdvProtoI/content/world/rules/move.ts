// RULE-MOVE-001 — Implements INTENT-MOVE-001 · INTENT-ACTION-STATE-001
// Input          Actor, TargetPosition
// Preconditions  1. TargetPosition 이 그 몸이 선 Region 의 extent 안에 있다 (C001 CHANGED — 구 World.Bounds)
//                2. 현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001)
// Transition     CurrentAction = move(TargetPosition)
// Result         Success | Failure(out-of-bounds | action-busy)
//
// MoveTarget 설정이 아니라 "이동 행동에 진입" 이다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_MOVE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { extentContains } from '../../../engine/world-authoring/description';
import type { WorldPosition } from '../semantic/position';
import { regionExtent } from '../semantic/region';
import type { WorldState } from '../semantic/world-state';
import { beginAction, evaluateActionBegin } from './action-begin';

export type MoveFailureReason = 'out-of-bounds' | 'action-busy';

// Precondition 평가 — Observable(Move.Availability / Move.FailureReason)과 공유한다.
// 목적지는 요청 시점에만 알 수 있으므로 Availability 는 행동 대체 가능성만 판정한다.
export function evaluateMoveAvailability(actor: ActorState): MoveFailureReason | null {
  return evaluateActionBegin(actor);
}

export function ruleMove(
  _state: WorldState,
  actor: ActorState,
  target: WorldPosition,
): ActionResult {
  if (!extentContains(regionExtent(actor.regionId), target)) {
    return { status: 'failure', rule: RULE_MOVE, reason: 'out-of-bounds' };
  }
  const busy = evaluateActionBegin(actor);
  if (busy) return { status: 'failure', rule: RULE_MOVE, reason: busy };

  beginAction(actor, 'move', { targetPosition: { x: target.x, z: target.z } });
  return { status: 'success', rule: RULE_MOVE };
}
