// RULE-MOVE-MODE-001 — Implements INTENT-RUN-001
// Input          Actor, 요청한 MoveMode (walk | run)
// Preconditions  run 으로 바꾸려면 Cp > 0 이고 쓰러지지 않았다
// Transition     MoveMode = 요청값
//                요청값이 run 이고 판정을 통과했으면 Guarding = false (C011 ADDED)
// Result         Success | Failure(downed | insufficient-cp | unknown-move-mode)
//
// 요청은 토글이 아니라 명시값이다 — 같은 요청이 두 번 와도 결과가 같다.
// 걷기로 돌아오는 것은 언제나 가능하다. 힘이 빠져 걷는 것을 막을 이유가 없다.
//
// C011 — 막고 있는 중에 달리기를 걸면 거절하지 않고 막기를 놓는다.
// 같은 기력을 두 곳에 동시에 걸 수 없기 때문이고 (INTENT-GUARD-RESTRICT-001),
// 요청한 것이 달리기이므로 요청한 쪽이 이긴다. RULE-GUARD-BEGIN-001 의
// 반대 방향(막기를 걸면 걷기로 내려온다)과 짝을 이룬다.

import type { ActionResult } from '../../../protocol/actions';
import { RULE_MOVE_MODE } from '../../../protocol/semantic-id';
import type { ActorState } from '../../base/actor';
import { actorModifiers, isDowned } from '../combat/combat';

// Actor.MoveMode — 걷는가 달리는가 (INTENT-RUN-001).
// 이 도메인이 소유하는 Actor 필드의 값 타입이다 — 바꾸는 함수는 이 파일에만 있다.
export type MoveMode = 'walk' | 'run';

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
    actor.guarding = false; // C011 — 달리기를 시작하면 막기가 풀린다
  }

  actor.moveMode = mode;
  return { status: 'success', rule: RULE_MOVE_MODE };
}

// 이 Actor 가 지금 실제로 나아가는 빠르기 (INTENT-TEMPO-MOVE-001 · INTENT-RUN-001).
// 이동 배율은 전투 도메인이 합성한 Modifiers 에서 읽는다 — 읽기는 자유다.
export function effectiveMoveSpeed(actor: ActorState): number {
  const modifiers = actorModifiers(actor);
  const run = actor.moveMode === 'run' ? actor.runSpeedMultiplier : 1;
  return actor.moveSpeed * modifiers.moveSpeed * run;
}
