// World Semantic — Actor.CurrentAction · ActionKind · ActionDefinition (C002 ADDED)
//
// 모든 Actor 는 언제나 정확히 하나의 행동 안에 있다 (INTENT-ACTION-STATE-001).
// 행동 종류가 늘어나도 구조는 바뀌지 않는다 — ACTION_DEFINITIONS 에 항목 하나와
// 그 행동을 시작하는 Rule 하나가 추가될 뿐이다.

export type ActionKind = 'idle' | 'move' | 'attack' | 'mine' | 'hit';

export interface CurrentAction {
  kind: ActionKind;
  targetPosition?: { x: number; z: number }; // kind = move
  targetActorId?: string; // kind = attack
  targetDepositId?: string; // kind = mine
  elapsed: number;
  duration: number | null; // null 이면 스스로 끝나지 않는다
}

export interface ActionDefinition {
  duration: number | null; // 소요 시간 — 없으면 시간으로 끝나지 않는다
  replaceable: boolean; // 진행 중 다른 행동으로 대체 가능한가
}

// Duration 은 결정론 시뮬레이션 값이므로 헤더 상수로 고정한다.
export const ACTION_DEFINITIONS: Readonly<Record<ActionKind, ActionDefinition>> = {
  idle: { duration: null, replaceable: true },
  move: { duration: null, replaceable: true }, // 목적지 도달로 끝난다
  attack: { duration: 0.6, replaceable: false },
  mine: { duration: 1.2, replaceable: false },
  hit: { duration: 0.35, replaceable: false }, // 피격 — 스스로 요청하는 행동이 아니다
};

export function actionDefinition(kind: ActionKind): ActionDefinition {
  return ACTION_DEFINITIONS[kind];
}

export function idleAction(): CurrentAction {
  return { kind: 'idle', elapsed: 0, duration: null };
}

// Actor.ActionProgress (Observable) — Duration 이 있는 행동에서만 존재한다.
export function actionProgress(action: CurrentAction): number | null {
  if (action.duration === null || action.duration <= 0) return null;
  const p = action.elapsed / action.duration;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

// Actor.ActionTargetId (Observable) — 현재 행동의 대상 (없을 수 있음)
export function actionTargetId(action: CurrentAction): string | undefined {
  return action.targetActorId ?? action.targetDepositId;
}
