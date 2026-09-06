// RULE-MOVE-001 — Implements INTENT-MOVE-001 · INTENT-ACTION-STATE-001
// Input          Actor, TargetPosition
// Preconditions  1. TargetPosition 이 그 몸이 선 Region 의 extent 안에 있다 (C001 CHANGED — 구 World.Bounds)
//                2. TargetPosition 이 그 방의 땅에서 통행 가능하다 (C006 ADDED — 급경사도 물도 아니다).
//                   땅이 없는 방은 이 전제가 없는 것과 같다 (C006 SPEC-009)
//                3. TargetPosition 이 그 방의 **닫힌 통로 area** 안이 아니다 (C008 ADDED).
//                   규칙 State 가 없는 방은 이 전제가 없는 것과 같다
//                4. TargetPosition 이 **무너진 원천의 자리**가 아니다 (C012 ADDED).
//                   고갈되지 않았거나 무너지지 않는 원천은 이 전제가 없는 것과 같다
//                5. 현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001)
// Transition     CurrentAction = move(TargetPosition)
// Result         Success | Failure(out-of-bounds | too-steep | deep-water | passage-closed | collapsed | action-busy)
//
// MoveTarget 설정이 아니라 "이동 행동에 진입" 이다.
//
// C006 CHANGED — 땅이 처음으로 몸에 닿는 자리가 여기다 (spec R1). 순서가 의미다:
// extent 판정이 **먼저** 오고(C005 까지의 out-of-bounds 는 한 글자도 바뀌지 않는다),
// 그 다음이 땅이다 — 방 밖은 애초에 땅이 없으므로 물어도 답이 없다.
//
// C008 CHANGED — 세 번째로 통로가 온다 (spec R2). 앞의 둘은 한 글자도 바뀌지 않았다:
// 컴파일 결과(traversable)를 고치는 것이 아니라 State 가 그 위에 덧씌워지는 것이므로
// 순서상 맨 뒤여야 한다. 판정은 **목표 자리만** 본다 — 그래서 재배열로 발밑이 닫혀도
// 열린 자리로 걸어 나갈 수 있다. 갇히지 않는다 (SPEC-005 경계).
//
// C012 CHANGED — 네 번째로 붕괴가 온다 (spec R4). 앞의 셋은 한 글자도 바뀌지 않았다:
// 무너진 노두도 컴파일 결과를 고치지 않고 그 위에 덧씌워지는 State 이므로, 닫힌 통로와
// 같은 자리(땅 판정 뒤)에 선다. 여기도 **목표 자리만** 본다 — 무너진 자리 위에 서 있게
// 되어도 걸어 나갈 수 있다.

import type { ActionResult } from '../../protocol/actions';
import { BLOCK_COLLAPSED, BLOCK_STEEP, BLOCK_WATER } from '../../regions';
import { RULE_MOVE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { extentContains } from '../../../engine/world-authoring/description';
import type { WorldPosition } from '../semantic/position';
import { regionExtent } from '../semantic/region';
import { isClosedPassageAt, PASSAGE_CLOSED } from '../semantic/region-state';
import { isCollapsedAt } from '../semantic/resource';
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
  | typeof BLOCK_WATER
  | typeof PASSAGE_CLOSED
  | typeof BLOCK_COLLAPSED;

// Precondition 평가 — Observable(Move.Availability / Move.FailureReason)과 공유한다.
// 목적지는 요청 시점에만 알 수 있으므로 Availability 는 행동 대체 가능성만 판정한다.
export function evaluateMoveAvailability(actor: ActorState): MoveFailureReason | null {
  return evaluateActionBegin(actor);
}

export function ruleMove(
  state: WorldState,
  actor: ActorState,
  target: WorldPosition,
): ActionResult {
  if (!extentContains(regionExtent(actor.regionId), target)) {
    return { status: 'failure', rule: RULE_MOVE, reason: 'out-of-bounds' };
  }
  // 땅이 막는가 — 막혔으면 그 칸의 사유 태그가 그대로 사유 코드다 (세계는 "왜" 를 지어내지 않는다).
  const blocked = blockedReason(actor.regionId, target);
  if (blocked) return { status: 'failure', rule: RULE_MOVE, reason: blocked };

  // 지금 패턴이 열지 않은 통로인가 — 땅은 그대로이고 열림/닫힘만 State 가 정한다 (C008 R2).
  if (isClosedPassageAt(state.regionStates, actor.regionId, target)) {
    return { status: 'failure', rule: RULE_MOVE, reason: PASSAGE_CLOSED };
  }

  // 무너진 원천의 자리인가 — 땅은 그대로이고 고갈이 그 위에 덧씌워질 뿐이다
  // (RULE-SOURCE-COLLAPSE-001 · C012 R4).
  if (isCollapsedAt(state.regionStates, actor.regionId, target)) {
    return { status: 'failure', rule: RULE_MOVE, reason: BLOCK_COLLAPSED };
  }

  const busy = evaluateActionBegin(actor);
  if (busy) return { status: 'failure', rule: RULE_MOVE, reason: busy };

  beginAction(actor, 'move', { targetPosition: { x: target.x, z: target.z } });
  return { status: 'success', rule: RULE_MOVE };
}
