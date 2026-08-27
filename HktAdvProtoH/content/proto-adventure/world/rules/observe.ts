// RULE-OBSERVE-BEGIN-001 — Implements INTENT-OBSERVE-001 ·
//                                     INTENT-TARGET-DIRECTS-THE-ACT-001 (C017) ·
//                                     INTENT-ACTION-STATE-001
// Input          요청한 ObserverId
//                C017 CHANGED — 요청이 대상을 싣지 않는다. 대상은 그 관찰자가 고른 것이다
//                (World.TargetSelections). 두 곳에서 대상이 정해질 수 있으면 같은 존재를
//                보고 있으면서 행동마다 다른 상대로 나가는 일이 남는다 (TG §1).
// Preconditions  1. 그 관찰자의 몸이 세계에 있다        (no-body)
//                2. 그 관찰자가 고른 것이 있다           (no-target-selected)   ← C017 ADDED
//                3. 고른 것이 존재다 (광맥이 아니다)     (target-kind-mismatch) ← C017 ADDED
//                   2·3 이 옛 no-such-target · target-is-self 를 대신한다 —
//                   자기 몸은 고를 수 없으므로 살펴봄이 자기를 대상으로 오지 않는다
//                   (RULE-TARGET-SELECT-001 P2 · P3).
//                4. 두 몸 중심 거리 ≤ OBSERVE_RANGE     (out-of-range)
//                5. 아직 열 자리가 남아 있다            (already-known)
//                   C016 CHANGED — "그 존재를 아는가" 가 아니라 "가려진 자리가
//                   남았는가" 다. 통찰로 일부만 열린 상대는 살펴볼 수 있고,
//                   통찰이 세 문턱을 모두 넘은 상대는 처음부터 거절된다.
//                   사유 코드는 그대로다 — 뜻이 "더 열 자리가 없다" 로 읽힌다.
//                6. 현재 행동이 대체 가능하다            (action-busy)
// Transition     CurrentAction = observe(대상)
// Result         Success | Failure(reason)
//
// RULE-OBSERVE-COMPLETE-001 — Implements INTENT-OBSERVE-001 · INTENT-OBSERVE-KNOWLEDGE-001
// Input          살펴봄이 Duration 을 채운 Actor
// Preconditions  그 몸을 조종하는 관찰자가 있다 (없으면 앎이 갈 곳이 없다)
// Transition     그 관찰자의 Acquaintances 에 대상 ActorId 를 더한다
// Result         Learned | Failure(no-observer | no-target)
//
// RULE-OBSERVE-FORGET-001 — Implements INTENT-OBSERVE-FORGET-001
// Input          요청한 ObserverId, (선택) 대상 ActorId
// Preconditions  1. World.DebugAuthority.Open 이 참이다  (debug-closed)
//                2. 그 관찰자를 세계가 안다               (no-observer)
// Transition     대상 하나를 지우거나, 알고 있는 전부를 비운다
// Result         Success | Failure(reason)
//
// 살펴봄은 대상에게 아무 일도 하지 않는다 — 이 파일의 어떤 Transition 에도
// 대상의 State 가 없다. 대상은 자기가 살펴봐졌음을 알지 못한다.
//
// C017 — 시작한 뒤에 다른 것을 고르면 새 고른 것은 **다음 행동**의 대상이 되고,
// 진행 중인 살펴봄은 시작할 때 적어 둔 대상을 끝까지 지닌다 (CurrentAction.targetActorId).
// 진행 중인 행동이 지목을 따라다니면 그것은 자동 추적이다 (DC-TARGET-IS-INTENT-NOT-AIM).
//
// 중단은 이 파일이 만들지 않는다. 맞으면 RULE-HIT-001 이 CurrentAction 을 hit 으로
// 갈아 버리고, 완료 효과가 도는 자리에 오지 못하므로 앎이 남지 않는다 —
// "끝까지 가지 못하면 아무것도 알게 되지 않는다" 가 그렇게 성립한다 (03 NOTE ②).
// 완료 조건은 시간뿐이다: 거리는 시작 관문이 본다.

import type { ActionResult } from '../../protocol/actions';
import {
  RULE_OBSERVE_BEGIN,
  RULE_OBSERVE_COMPLETE,
  RULE_OBSERVE_FORGET,
} from '../../protocol/semantic-id';
import { ruleDeedsAdd } from './deeds-add';
import { concealedKeys, forgetActor, isAcquainted, learnActor } from '../semantic/acquaintance';
import type { ActorState } from '../semantic/actor';
import { distance } from '../semantic/position';
import { selectedEntityId } from '../semantic/target-selection';
import {
  OBSERVE_RANGE,
  actorOfObserver,
  findActor,
  findObserver,
  type WorldState,
} from '../semantic/world-state';
import { beginAction, evaluateActionBegin } from './action-begin';

export type ObserveFailureReason =
  | 'no-body'
  | 'no-target-selected' // C017 — 아무것도 고르지 않았다
  | 'target-kind-mismatch' // C017 — 고른 것이 살펴볼 수 있는 존재가 아니다
  | 'out-of-range'
  | 'already-known'
  | 'action-busy';

export type ForgetAcquaintanceFailureReason = 'debug-closed' | 'no-observer' | 'not-known';

// Observable(Observe.Availability / Observe.FailureReason)과 Rule 이 같은 판정을 공유한다.
// 사유 순서는 위 Precondition 순서 그대로다 — 화면에 뜨는 사유가 판정 순서와 어긋나면
// 플레이어가 배우는 규칙이 세계의 규칙과 달라진다.
export function evaluateObserveBegin(
  state: WorldState,
  observerId: string,
): ObserveFailureReason | null {
  const self = actorOfObserver(state, observerId);
  if (!self) return 'no-body';

  // C017 — 대상은 고른 것이다. 요청에서 오지 않는다.
  const targetId = selectedEntityId(state.targetSelections, observerId);
  if (targetId === undefined) return 'no-target-selected';

  const target = findActor(state, targetId);
  // 고른 것이 광맥이면 살펴볼 수 없다. "없는 대상" 이 아니라 **종류가 맞지 않는** 것이다 —
  // 고르기 관문이 이미 그 존재가 세계에 있음을 보장했다 (RULE-TARGET-SELECT-001 P2).
  if (!target) return 'target-kind-mismatch';

  if (distance(self.position, target.position) > OBSERVE_RANGE) return 'out-of-range';
  // C016 — 더 열 자리가 없을 때만 거절한다 (RULE-INSIGHT-REVEAL-001 의 결과를 그대로 쓴다).
  // 통찰과 문턱을 여기서 다시 비교하지 않는다 — 판정은 한 곳에만 있어야 한다.
  const acquainted = isAcquainted(state.acquaintances, observerId, target.id, self.id);
  if (concealedKeys(acquainted, self.insight).length === 0) return 'already-known';

  return evaluateActionBegin(self);
}

export function ruleObserveBegin(state: WorldState, observerId: string): ActionResult {
  const failure = evaluateObserveBegin(state, observerId);
  if (failure) return { status: 'failure', rule: RULE_OBSERVE_BEGIN, reason: failure };

  const self = actorOfObserver(state, observerId)!;
  const targetId = selectedEntityId(state.targetSelections, observerId)!;
  beginAction(self, 'observe', { targetActorId: targetId });
  return { status: 'success', rule: RULE_OBSERVE_BEGIN };
}

// 살펴봄의 완료 효과 — RULE-ACTION-PROGRESS-001 이 Duration 을 채운 시점에 호출한다.
// 앎은 몸이 아니라 그 몸을 조종하는 관찰자의 것이므로 여기서 되짚어 찾는다.
// 조종자가 없는 몸(자율 존재)이 이 자리에 오는 일은 없지만, 와도 앎이 갈 곳이 없다.
export function ruleObserveComplete(state: WorldState, actor: ActorState): ActionResult {
  const targetId = actor.currentAction.targetActorId;
  if (!targetId) return { status: 'failure', rule: RULE_OBSERVE_COMPLETE, reason: 'no-target' };

  const observer = state.observers.find((entry) => entry.actorId === actor.id);
  if (!observer) return { status: 'failure', rule: RULE_OBSERVE_COMPLETE, reason: 'no-observer' };

  learnActor(state.acquaintances, observer.id, targetId);
  // C-GROWTH-001 — 살펴본 일이 몸에 남는다 (RULE-DEEDS-ADD-001).
  // 이미 다 아는 상대는 살펴봄 자체가 거절되므로 (RULE-OBSERVE-BEGIN-001 · C016),
  // 같은 상대를 되풀이해 살펴 무한히 쌓는 길은 세계에 없다.
  ruleDeedsAdd(state, actor, 'observe');
  return { status: 'success', rule: RULE_OBSERVE_COMPLETE };
}

// Observable(ForgetAcquaintance.Availability) — 세계가 권한을 닫아 두면 가용하지 않다.
// set-attribute 와 같은 관문이다 (C007 R2): 이것은 세계 안의 행동이 아니라
// 살펴보기 전과 후를 견주기 위해 세계 밖에서 손대는 자리다.
export function evaluateForgetAcquaintance(
  state: WorldState,
): ForgetAcquaintanceFailureReason | null {
  return state.debugAuthority.open ? null : 'debug-closed';
}

export function ruleObserveForget(
  state: WorldState,
  observerId: string,
  targetId?: string,
): ActionResult {
  const closed = evaluateForgetAcquaintance(state);
  if (closed) return { status: 'failure', rule: RULE_OBSERVE_FORGET, reason: closed };

  if (!findObserver(state, observerId)) {
    return { status: 'failure', rule: RULE_OBSERVE_FORGET, reason: 'no-observer' };
  }

  if (!forgetActor(state.acquaintances, observerId, targetId)) {
    return { status: 'failure', rule: RULE_OBSERVE_FORGET, reason: 'not-known' };
  }
  return { status: 'success', rule: RULE_OBSERVE_FORGET };
}
