// 요청의 주체 해석 — 몸(Actor)은 이 팩의 개념이므로 요청을 몸에 붙이는 일도 팩의 몫이다.
// Engine 은 관찰자 장부만 확인한다 (engine/world-kernel/dispatch.ts).
//
// C004 CHANGED — 요청의 주체는 그 요청이 도착한 이어짐의 관찰자의 몸이다
// (INTENT-REQUEST-ATTRIBUTION-001). 요청 자체는 주체를 지정하지 않는다 —
// 지정할 수단이 없다. 세계가 모르는 관찰자의 요청은 아무것도 바꾸지 못한다.
//
// 모든 도메인의 interaction 이 이 관문을 함께 쓴다 — 주체 판정이 한 곳에만 있어야
// 도메인마다 다른 귀속 규칙이 생기지 않는다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { InteractionHandler } from '../../../../engine/world-kernel/content';
import type { ActorState } from './actor';
import { actorOfObserver, type WorldState } from './world-state';

export const DISPATCH = 'DISPATCH';

export function withActor(
  handle: (state: WorldState, actor: ActorState, action: ActionRequest) => ActionResult,
): InteractionHandler<WorldState>['handle'] {
  return (state, observerId, action) => {
    const actor = actorOfObserver(state, observerId);
    if (!actor) return { status: 'failure', rule: DISPATCH, reason: 'unknown-observer' };
    return handle(state, actor, action);
  };
}
