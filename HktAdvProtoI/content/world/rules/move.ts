// RULE-MOVE-001 — Implements INTENT-MOVE-001 · INTENT-ACTION-STATE-001
// Input          Actor, TargetPosition
// Preconditions  1. TargetPosition 이 그 몸이 선 Region 의 extent 안에 있다 (C001 CHANGED — 구 World.Bounds)
//                2. TargetPosition 이 그 방의 땅에서 통행 가능하다 (C006 ADDED — 급경사도 물도 아니다).
//                   땅이 없는 방은 이 전제가 없는 것과 같다 (C006 SPEC-009)
//                3. 현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001)
// Transition     CurrentAction = move(TargetPosition)
// Result         Success | Failure(out-of-bounds | too-steep | deep-water | action-busy)
//
// MoveTarget 설정이 아니라 "이동 행동에 진입" 이다.
//
// C006 CHANGED — 땅이 처음으로 몸에 닿는 자리가 여기다 (spec R1). 순서가 의미다:
// extent 판정이 **먼저** 오고(C005 까지의 out-of-bounds 는 한 글자도 바뀌지 않는다),
// 그 다음이 땅이다 — 방 밖은 애초에 땅이 없으므로 물어도 답이 없다.

import type { ActionResult } from '../../protocol/actions';
import { BLOCK_STEEP, BLOCK_WATER } from '../../regions';
import { RULE_MOVE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { extentContains } from '../../../engine/world-authoring/description';
import type { WorldPosition } from '../semantic/position';
import { regionExtent } from '../semantic/region';
import { blockedReason } from '../semantic/terrain';
import type { WorldState } from '../semantic/world-state';
import { beginAction, evaluateActionBegin } from './action-begin';

// 거절 사유 코드 — 문구는 View 의 표가 옮긴다. C006 에서 땅의 사유 둘이 는다.
// 이름을 다시 적지 않고 규칙 표(content/regions/terrain-rules)의 상수에서 형을 가져온다 —
// 세계가 막는 사유와 표에 적힌 사유가 갈리지 않게.
export type MoveFailureReason =
  | 'out-of-bounds'
  | 'action-busy'
  | typeof BLOCK_STEEP
  | typeof BLOCK_WATER;

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
  // 땅이 막는가 — 막혔으면 그 칸의 사유 태그가 그대로 사유 코드다 (세계는 "왜" 를 지어내지 않는다).
  const blocked = blockedReason(actor.regionId, target);
  if (blocked) return { status: 'failure', rule: RULE_MOVE, reason: blocked };

  const busy = evaluateActionBegin(actor);
  if (busy) return { status: 'failure', rule: RULE_MOVE, reason: busy };

  beginAction(actor, 'move', { targetPosition: { x: target.x, z: target.z } });
  return { status: 'success', rule: RULE_MOVE };
}
