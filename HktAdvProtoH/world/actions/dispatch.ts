// Action Request 수용 경로 — interactionId 를 World Rule 로 위임한다.
// Cycle 이 interaction 을 추가하면 여기에 분기가 늘어난다 (World 측 확장).
//
// Client 의 요청은 언제나 Control = player 인 Actor 를 주체로 한다 (World Authority).

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import { ruleAttack } from '../rules/attack';
import { ruleMine } from '../rules/mine';
import { ruleMove } from '../rules/move';
import { playerActor, type WorldState } from '../semantic/world-state';

const DISPATCH = 'DISPATCH';

export function dispatchAction(state: WorldState, action: ActionRequest): ActionResult {
  const actor = playerActor(state);

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
