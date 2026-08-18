// Action Request 수용 경로 — Interaction Registry (P1 CHANGED, 설계 반전 ①)
//
// 예전에는 interactionId switch 에 컨텐츠 분기가 직접 나열되었다.
// 이제 컨텐츠 팩이 InteractionHandler 를 등록하고, 여기는 두 가지 불변식만 지킨다:
//
//   1. 세계가 모르는 관찰자의 요청은 아무것도 바꾸지 못한다 (INTENT-REQUEST-ATTRIBUTION-001)
//   2. 등록되지 않은 interaction 은 unknown-interaction 으로 거절된다
//
// 요청의 주체가 누구의 몸인지 푸는 일은 팩의 몫이다 — 몸(Actor)은 Engine 의 개념이 아니다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { InteractionHandler } from './content';
import { findObserver, type CoreWorldState } from './state';

const DISPATCH = 'DISPATCH';

export function dispatchAction<S extends CoreWorldState>(
  state: S,
  observerId: string,
  action: ActionRequest,
  handlers: ReadonlyMap<string, InteractionHandler<S>>,
): ActionResult {
  if (!findObserver(state, observerId))
    return { status: 'failure', rule: DISPATCH, reason: 'unknown-observer' };

  const handler = handlers.get(action.interactionId);
  if (!handler) return { status: 'failure', rule: DISPATCH, reason: 'unknown-interaction' };

  return handler.handle(state, observerId, action);
}
