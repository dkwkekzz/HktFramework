// RULE-MOVE-MODE-001 — Implements INTENT-RUN-001
// Input          Actor, 요청한 MoveMode (walk | run)
// Preconditions  run 으로 바꾸려면 Cp > 0 이고 쓰러지지 않았다
// Transition     MoveMode = 요청값. 요청값이 run 이면 Stance = open (C010)
// Result         Success | Failure(downed | insufficient-cp | unknown-move-mode)
//
// C010 CHANGED — 달리기로 옮겨 가는 것은 막기를 놓는 것이다.
// 두 자세를 동시에 가질 수 없다 (INTENT-RUN-001 CHANGED). walk 는 자세를 건드리지 않는다 —
// 막은 채로 걷는 것이 이 Cycle 이 허용하는 유일한 겸행이기 때문이다.
//
// 요청은 토글이 아니라 명시값이다 — 같은 요청이 두 번 와도 결과가 같다.
// 걷기로 돌아오는 것은 언제나 가능하다. 힘이 빠져 걷는 것을 막을 이유가 없다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_MOVE_MODE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { isDowned, type MoveMode } from '../semantic/combat';

export type MoveModeFailureReason = 'downed' | 'insufficient-cp' | 'unknown-move-mode';

// Observable(MoveMode.Availability) 과 Rule 이 같은 판정을 공유한다 —
// "지금 달릴 수 있는가" 를 묻는 것이므로 run 기준으로 본다.
export function evaluateMoveModeRun(actor: ActorState): MoveModeFailureReason | null {
  if (isDowned(actor)) return 'downed';
  if (actor.cp <= 0) return 'insufficient-cp';
  return null;
}

export function ruleMoveMode(actor: ActorState, mode: MoveMode): ActionResult {
  if (mode !== 'walk' && mode !== 'run')
    return { status: 'failure', rule: RULE_MOVE_MODE, reason: 'unknown-move-mode' };

  if (mode === 'run') {
    const failure = evaluateMoveModeRun(actor);
    if (failure) return { status: 'failure', rule: RULE_MOVE_MODE, reason: failure };
  }

  actor.moveMode = mode;
  // C010 — 달리기는 막기를 놓는 것이다.
  if (mode === 'run') actor.stance = 'open';
  return { status: 'success', rule: RULE_MOVE_MODE };
}
