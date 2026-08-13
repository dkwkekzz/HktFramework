// Action Request 수용 경로 — interactionId 를 World Rule 로 위임한다.
// Cycle 이 interaction 을 추가하면 여기에 분기가 늘어난다 (World 측 확장).
//
// C004 CHANGED — 요청의 주체는 그 요청이 도착한 이어짐의 관찰자의 몸이다
// (INTENT-REQUEST-ATTRIBUTION-001). 요청 자체는 주체를 지정하지 않는다 —
// 지정할 수단이 없다. 세계가 모르는 관찰자의 요청은 아무것도 바꾸지 못한다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import { ruleAttack } from '../rules/attack';
import { ruleMine } from '../rules/mine';
import { ruleMove } from '../rules/move';
import { actorOfObserver, type WorldState } from '../semantic/world-state';

const DISPATCH = 'DISPATCH';

export function dispatchAction(
  state: WorldState,
  observerId: string,
  action: ActionRequest,
): ActionResult {
  const actor = actorOfObserver(state, observerId);
  if (!actor) return { status: 'failure', rule: DISPATCH, reason: 'unknown-observer' };

  switch (action.interactionId) {
    case 'move':
      if (!action.position) return { status: 'failure', rule: DISPATCH, reason: 'missing-position' };
      return ruleMove(state, actor, action.position);
    case 'mine':
      if (!action.targetEntityId)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-target' };
      return ruleMine(state, actor, action.targetEntityId);
    case 'attack':
      return ruleAttack(actor); // 대상을 받지 않는다 (C002 — 휘두르는 행위다)
    default:
      return { status: 'failure', rule: DISPATCH, reason: 'unknown-interaction' };
  }
}
