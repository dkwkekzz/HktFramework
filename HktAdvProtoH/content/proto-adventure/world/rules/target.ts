// RULE-TARGET-SELECT-001 — Implements INTENT-TARGET-SELECT-001 · INTENT-TARGET-ELIGIBLE-001 ·
//                                     INTENT-TARGET-PER-OBSERVER-001
// Input          요청한 ObserverId, TargetEntityId
// Preconditions  1. 세계가 그 관찰자를 안다                     (unknown-observer)
//                2. 그 Id 의 존재가 그 관찰자의 관찰에 실린다     (no-such-target)
//                3. 그 존재가 그 관찰자의 몸이 아니다            (target-is-self)
// Transition     그 관찰자의 TargetSelection.TargetEntityId = TargetEntityId
// Result         Success | Failure(reason)
//
// RULE-TARGET-CLEAR-001 — Implements INTENT-TARGET-RELEASE-001
// Input          요청한 ObserverId
// Preconditions  1. 세계가 그 관찰자를 안다                     (unknown-observer)
// Transition     그 관찰자의 TargetSelection 을 없앤다
// Result         Success
//
// 고르는 일은 **행동이 아니다.** 이 파일의 어떤 Transition 에도 Actor.CurrentAction 이
// 없고 RULE-ACTION-BEGIN-001 을 지나지 않는다 — 그래서 다른 행동 중에도 고를 수 있고,
// 골라도 하던 행동이 끊기지 않는다 (INTENT-TARGET-SELECT-001).
// 고르기를 행동으로 두면 action-busy 에 걸려 싸우는 중에 대상을 바꿀 수 없게 되고,
// 그러면 지목은 의도를 밝히는 일이 아니라 대가를 치르는 수가 된다 (03 NOTE ①).
//
// 대상에게는 아무 일도 하지 않는다 — Transition 에 대상의 State 가 없다.
// 고른다고 명중도 피해도 앎도 위협도 생기지 않는다 (DC-TARGET-IS-INTENT-NOT-AIM).

import type { ActionResult } from '../../protocol/actions';
import { RULE_TARGET_CLEAR, RULE_TARGET_SELECT } from '../../protocol/semantic-id';
import {
  clearTarget,
  selectTarget,
  type TargetSelectFailureReason,
} from '../semantic/target-selection';
import { actorOfObserver, findActor, findObserver, type WorldState } from '../semantic/world-state';

/**
 * 그 Id 의 존재가 **그 관찰자의 관찰에 실리는가** (INTENT-TARGET-ELIGIBLE-001).
 *
 * 지금 이 세계에는 관찰 범위 제한이 없어 "세계에 있는가" 와 같은 값이지만,
 * 판정의 근거를 관찰 쪽에 두어야 나중에 범위가 생겨도 규칙이 바뀌지 않는다 (TG §4.1).
 * 그래서 이 함수는 투영이 무엇을 entities 로 싣는지와 **같은 집합**을 본다
 * (projection/observer-view.ts — state.actors + state.deposits).
 */
export function isAddressableEntity(state: WorldState, entityId: string): boolean {
  if (findActor(state, entityId)) return true;
  return state.deposits.some((deposit) => deposit.id === entityId);
}

// Observable(TargetSelect.Availability / TargetSelect.FailureReason)과 Rule 이 같은 판정을
// 공유한다. 사유 순서는 위 Precondition 순서 그대로다 — 화면에 뜨는 사유가 판정 순서와
// 어긋나면 플레이어가 배우는 규칙이 세계의 규칙과 달라진다.
export function evaluateTargetSelect(
  state: WorldState,
  observerId: string,
  targetEntityId: string,
): TargetSelectFailureReason | null {
  if (!findObserver(state, observerId)) return 'unknown-observer';
  if (!isAddressableEntity(state, targetEntityId)) return 'no-such-target';
  if (actorOfObserver(state, observerId)?.id === targetEntityId) return 'target-is-self';
  return null;
}

export function ruleTargetSelect(
  state: WorldState,
  observerId: string,
  targetEntityId: string,
): ActionResult {
  const failure = evaluateTargetSelect(state, observerId, targetEntityId);
  if (failure) return { status: 'failure', rule: RULE_TARGET_SELECT, reason: failure };

  selectTarget(state.targetSelections, observerId, targetEntityId);
  return { status: 'success', rule: RULE_TARGET_SELECT };
}

// 놓는 데에는 조건이 없다 — RULE-GUARD-RELEASE-001 의 선례 그대로.
// 고른 것이 없어도 성공이다: 같은 요청이 두 번 와도 결과가 같아야 한다.
export function ruleTargetClear(state: WorldState, observerId: string): ActionResult {
  if (!findObserver(state, observerId)) {
    return { status: 'failure', rule: RULE_TARGET_CLEAR, reason: 'unknown-observer' };
  }
  clearTarget(state.targetSelections, observerId);
  return { status: 'success', rule: RULE_TARGET_CLEAR };
}
