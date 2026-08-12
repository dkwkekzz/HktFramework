// Action Request 수용 경로 — 모든 상태 변화는 여기서 World Rule 로만 위임된다.
// Cycle Scope 밖의 Rule 은 아직 존재하지 않는 가능성이므로 실행하지 않고 실패로 돌려준다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import { RULE_MINE, RULE_MOVE } from '../../protocol/semantic-id';
import { OUT_OF_CYCLE_SCOPE, type CycleScope } from '../cycle/scope';
import { ruleMine } from '../rules/mine';
import { ruleMove } from '../rules/move';
import type { WorldState } from '../semantic/world-state';

function gated(scope: CycleScope, rule: string, run: () => ActionResult): ActionResult {
  if (!scope.allowsRule(rule)) return { status: 'failure', rule, reason: OUT_OF_CYCLE_SCOPE };
  return run();
}

export function dispatchAction(
  state: WorldState,
  action: ActionRequest,
  scope: CycleScope,
): ActionResult {
  switch (action.type) {
    case 'move':
      return gated(scope, RULE_MOVE, () => ruleMove(state, action.target));
    case 'mine':
      return gated(scope, RULE_MINE, () => ruleMine(state, action.depositId));
  }
}
