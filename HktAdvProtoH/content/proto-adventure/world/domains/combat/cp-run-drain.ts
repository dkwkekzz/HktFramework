// RULE-CP-RUN-DRAIN-001 — Implements INTENT-RUN-001
// Input          모든 Actor, dt
// Preconditions  MoveMode = run 이고 실제로 이동 중이다 (CurrentAction.kind = move)
// Transition     Cp = max(0, Cp - RUN_CP_DRAIN × Modifiers.CpConsume × dt)
//                Cp 가 0 이 되면 MoveMode = walk (더 달릴 수 없다)
// Result         Drained | Exhausted
//
// 멈춰 있거나 걷는 동안에는 흘러나가지 않는다 — 달리는 값을 치르는 것이지
// 달리기로 두었다는 이유로 치르는 것이 아니다.
// Tick 순서에서 물리 뒤에 놓인다: 이 Tick 에 실제로 달려 움직인 결과에 대해 값을 치른다.

import { actorModifiers, RUN_CP_DRAIN } from './combat';
import type { WorldState } from '../../base/world-state';

export function ruleCpRunDrain(state: WorldState, dt: number): number {
  let drainedCount = 0;

  for (const actor of state.actors) {
    if (actor.moveMode !== 'run') continue;
    if (actor.currentAction.kind !== 'move') continue;

    const drain = RUN_CP_DRAIN * actorModifiers(actor).cpConsume * dt;
    actor.cp = Math.max(0, actor.cp - drain);
    drainedCount++;

    if (actor.cp === 0) actor.moveMode = 'walk';
  }

  return drainedCount;
}
