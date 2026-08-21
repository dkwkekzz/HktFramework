// RULE-ACTION-BEGIN-001 — Implements INTENT-ACTION-STATE-001 · INTENT-ACTION-EXCLUSIVE-001
// Input          Actor, 시작하려는 Action(Kind + Target)
// Preconditions  현재 행동이 대체 가능하다 (ActionDefinition.Replaceable)
// Transition     Actor.CurrentAction = { Kind, Target, Elapsed: 0, Duration }
// Result         Success | Failure(action-busy)
//
// 모든 행동 시작 Rule 은 자기 고유 Precondition 을 먼저 판정한 뒤 이 관문을 통과한다.

import { actionDefinition, type ActionKind, type CurrentAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';

export type ActionBusyReason = 'action-busy';

// Observable(Availability) 과 Rule 이 같은 판정을 공유한다.
export function evaluateActionBegin(actor: ActorState): ActionBusyReason | null {
  return actionDefinition(actor.currentAction.kind).replaceable ? null : 'action-busy';
}

// C020 — 행동이 지니는 '무엇을 향한/무엇으로' 자리. 종류가 늘면 이 Pick 에 이름이 하나 는다.
type ActionTarget = Pick<
  CurrentAction,
  'targetPosition' | 'targetActorId' | 'targetDepositId' | 'usedItemKind' | 'usedItemTargetId'
>;

// duration 을 넘기면 그 길이로 시작한다 (C007) — 스킬 행동의 길이는 ActionDefinition 의
// 고정값이 아니라 시작하는 순간의 공격 속도가 정하기 때문이다 (INTENT-TEMPO-ACTION-001).
// 길이는 시작할 때 확정되고 진행 중에 바뀌지 않는다 — 진행도의 기준이 흔들리면 안 된다.
export function beginAction(
  actor: ActorState,
  kind: ActionKind,
  target: ActionTarget = {},
  duration?: number,
): void {
  actor.currentAction = {
    kind,
    ...target,
    elapsed: 0,
    duration: duration ?? actionDefinition(kind).duration,
  };
}

// 같은 행동을 같은 대상으로 다시 시작하려는가 — RULE-NPC-DECIDE-001 의 Unchanged 판정용.
// 진행 중인 행동을 매 Tick 재시작하지 않기 위해 필요하다.
export function isSameAction(action: CurrentAction, kind: ActionKind, target: ActionTarget): boolean {
  if (action.kind !== kind) return false;
  if (action.targetActorId !== target.targetActorId) return false;
  if (action.targetDepositId !== target.targetDepositId) return false;
  const a = action.targetPosition;
  const b = target.targetPosition;
  if (!a || !b) return a === b;
  return a.x === b.x && a.z === b.z;
}
