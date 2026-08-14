// RULE-ACTION-PROGRESS-001 — Implements INTENT-ACTION-PROGRESS-001 (시간 진행 법칙)
// Input          경과 시간 dt, 모든 Actor
// Preconditions  CurrentAction.Duration 이 존재한다
// Transition     Elapsed += dt
//                Elapsed >= Duration 이면 완료 효과 Rule 적용 후 CurrentAction = idle
// Result         Progress | Completed
//
// 완료 효과 Rule   mine   → RULE-MINE-COMPLETE-001
//                  attack → 없음 (C006 CHANGED — 타격은 완료가 아니라 휘두름 구간의
//                           접촉이 정한다. RULE-SWING-STRIKE-001, simulation/swing-strike.ts)
//                  hit    → 없음 (그냥 끝나고 대기로 돌아간다)
//
// 진행 대상은 Tick 이 시작될 때의 행동으로 고정한다. 이 Tick 안에서 새로 시작된 행동
// (예: 타격받아 들어간 피격)까지 같은 dt 로 밀면, 시작하자마자 끝나 버린다.

import { idleAction, type CurrentAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import type { WorldState } from '../semantic/world-state';
import { ruleMineComplete } from '../rules/mine';

export function ruleActionProgress(state: WorldState, dt: number): void {
  const advancing: Array<{ actor: ActorState; action: CurrentAction }> = state.actors.map(
    (actor) => ({ actor, action: actor.currentAction }),
  );

  for (const { actor, action } of advancing) {
    if (action.duration === null) continue;
    if (actor.currentAction !== action) continue; // 이 Tick 중에 다른 행동으로 바뀌었다

    action.elapsed += dt;
    if (action.elapsed < action.duration) continue;

    if (action.kind === 'mine') ruleMineComplete(state, actor);

    // 완료 효과가 이 Actor 의 행동을 바꿨다면(스스로 맞은 경우 등) 덮지 않는다.
    if (actor.currentAction === action) actor.currentAction = idleAction();
  }
}
