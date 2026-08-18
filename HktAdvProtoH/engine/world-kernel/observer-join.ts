// RULE-OBSERVER-JOIN-001 — Implements INTENT-OBSERVER-IDENTITY-001 ·
//                                     INTENT-OBSERVER-JOIN-001 · INTENT-OBSERVER-REJOIN-001
// Input          관찰자가 밝힌 Id
// Preconditions  1. Id 가 비어 있지 않다   2. Id 의 길이가 한계 이내다
// Transition     이미 아는 Id  → Present = true. 몸은 만들지 않는다 (이전 몸을 그대로 쓴다)
//                처음 보는 Id  → 컨텐츠가 새 몸을 만들고 (spawnBody — 어떤 몸인지는 팩이 정한다)
//                                Observer{Id, ActorId, Present} 를 World.Observers 에 더한다
// Result         Success(Id, ActorId) | Failure(invalid-observer-id)
//
// 세계는 밝힌 바가 참인지 따지지 않는다 — 자신이 누구인지 말할 수 있는 자는
// 그 관찰자로 인정된다 (INTENT-OBSERVER-IDENTITY-001). 자격 증명은 이 Cycle 의 밖이다.
//
// P1 CHANGED — 몸의 내용(종류·자리·소지품)은 컨텐츠 팩의 spawnObserverBody 가 정한다.
// 이 Rule 이 소유하는 것은 참여의 인과다: 언제 몸이 생기고, 재참여면 왜 안 생기는가.

import type { ActionResult } from '../protocol-core/actions';
import { RULE_OBSERVER_JOIN } from '../protocol-core/semantic-id';
import { MAX_OBSERVER_ID_LENGTH } from './observer';
import { findObserver, type CoreWorldState } from './state';

export function evaluateObserverIdentity(observerId: string): string | null {
  if (typeof observerId !== 'string' || observerId.length === 0) return 'invalid-observer-id';
  if (observerId.length > MAX_OBSERVER_ID_LENGTH) return 'invalid-observer-id';
  return null;
}

export function ruleObserverJoin<S extends CoreWorldState>(
  state: S,
  observerId: string,
  spawnBody: (state: S, ordinal: number) => string,
): ActionResult {
  const failure = evaluateObserverIdentity(observerId);
  if (failure) return { status: 'failure', rule: RULE_OBSERVER_JOIN, reason: failure };

  const known = findObserver(state, observerId);
  if (known) {
    // 재참여 — 몸은 그대로다. 자리 · 가진 것 · 하던 행동이 이어진다.
    // 같은 Id 로 다른 이어짐이 보고 있었다면 그 이어짐은 떨어진다.
    // 몸 하나에 조종하는 이는 하나이며, 그 떼어냄은 이어짐을 쥔 쪽(server)이 수행한다.
    // AcknowledgedMark 는 되돌리지 않는다 (C005) — 같은 관찰자가 이어 온 것이므로
    // 세계가 받아들인 자리도 이어진다.
    known.present = true;
    return { status: 'success', rule: RULE_OBSERVER_JOIN };
  }

  // 첫 참여 — 컨텐츠가 새 몸을 만든다. 몇 번째 관찰자인지(ordinal)만 Engine 이 준다.
  const ordinal = state.observers.length;
  const actorId = spawnBody(state, ordinal);

  // AcknowledgedMark 는 0 에서 시작한다 (C005) — 아직 이 관찰자에게서 받은 표식이 없다.
  state.observers.push({ id: observerId, actorId, present: true, acknowledgedMark: 0 });

  return { status: 'success', rule: RULE_OBSERVER_JOIN };
}
