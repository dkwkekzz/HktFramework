// Action Request 수용 경로 — 모든 상태 변화는 여기서 World Rule 로만 위임된다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import { ruleMine } from '../rules/mine';
import { ruleMove } from '../rules/move';
import type { WorldState } from '../semantic/world-state';

export function dispatchAction(state: WorldState, action: ActionRequest): ActionResult {
  switch (action.type) {
    case 'move':
      return ruleMove(state, action.target);
    case 'mine':
      return ruleMine(state, action.depositId);
  }
}
