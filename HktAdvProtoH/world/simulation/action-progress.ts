// RULE-ACTION-PROGRESS-001 — Implements INTENT-ACTION-PROGRESS-001 (시간 진행 법칙)
// Input          경과 시간 dt, 모든 Actor
// Preconditions  CurrentAction.Duration 이 존재한다
// Transition     Elapsed += dt
//                Elapsed >= Duration 이면 완료 효과 Rule 적용 후 CurrentAction = idle
// Result         Progress | Completed
//
// 완료 효과 Rule   mine   → RULE-MINE-COMPLETE-001
//                  attack → 없음 (C002 에서 공격의 결과는 정의되지 않는다)

import { idleAction } from '../semantic/action';
import type { WorldState } from '../semantic/world-state';
import { ruleMineComplete } from '../rules/mine';

export function ruleActionProgress(state: WorldState, dt: number): void {
  for (const actor of state.actors) {
    const action = actor.currentAction;
    if (action.duration === null) continue;

    action.elapsed += dt;
    if (action.elapsed < action.duration) continue;

    if (action.kind === 'mine') ruleMineComplete(state, actor);
    actor.currentAction = idleAction();
  }
}
