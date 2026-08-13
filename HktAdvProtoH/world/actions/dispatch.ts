// Action Request 수용 경로 — interactionId 를 World Rule 로 위임한다.
// Cycle 이 interaction 을 추가하면 여기에 분기가 늘어난다 (World 측 확장).

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import { ruleMine } from '../rules/mine';
import { ruleMove } from '../rules/move';
import type { WorldState } from '../semantic/world-state';

const DISPATCH = 'DISPATCH';

export function dispatchAction(state: WorldState, action: ActionRequest): ActionResult {
  switch (action.interactionId) {
    case 'move':
      if (!action.position) return { status: 'failure', rule: DISPATCH, reason: 'missing-position' };
      return ruleMove(state, action.position);
    case 'mine':
      if (!action.targetEntityId)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-target' };
      return ruleMine(state, action.targetEntityId);
    default:
      return { status: 'failure', rule: DISPATCH, reason: 'unknown-interaction' };
  }
}
