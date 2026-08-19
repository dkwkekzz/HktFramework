// World Base — Actor.CurrentAction · ActionKind · ActionDefinition (C002 ADDED)
//
// 모든 Actor 는 언제나 정확히 하나의 행동 안에 있다 (INTENT-ACTION-STATE-001).
// 행동 종류가 늘어나도 구조는 바뀌지 않는다 — ACTION_DEFINITIONS 에 항목 하나와
// 그 행동을 시작하는 Rule 하나가 추가될 뿐이다.

// C007 ADDED — heavy-attack (고급 스킬) · downed (쓰러짐).
// 쓰러짐은 요청하는 행동이 아니라 생명이 다해 들어가는 상태이며,
// 대체 불가능하므로 행동 시작 관문이 모든 새 행동을 자동으로 막는다.
// C012 ADDED — aura-strike (오라 방식 스킬).
// 항목마다 그 행동을 시작·완료시키는 소유 도메인을 표기한다 (표기 규칙).
export type ActionKind =
  | 'idle' // [base]
  | 'move' // [movement]
  | 'attack' // [combat]
  | 'heavy-attack' // [combat]
  | 'aura-strike' // [combat]
  | 'mine' // [mining]
  | 'hit' // [combat]
  | 'downed'; // [combat]

export interface CurrentAction {
  kind: ActionKind;
  targetPosition?: { x: number; z: number }; // kind = move
  targetActorId?: string; // kind = attack
  targetDepositId?: string; // kind = mine
  struckActorIds?: string[]; // kind = attack | heavy-attack | aura-strike (C006) — 이 휘두름이 이미 타격한 몸들.
  // 같은 몸은 휘두름당 한 번만 맞는다 (INTENT-SWING-IMPACT-001). 행동과 함께 사라진다.
  budgetSettled?: boolean; // 스킬 (C007) — 이 휘두름이 기력 수지를 이미 냈는가.
  // 여러 몸을 때려도 정산은 한 번이다 (RULE-SKILL-BUDGET-001). 행동과 함께 사라진다.
  elapsed: number;
  duration: number | null; // null 이면 스스로 끝나지 않는다
}

export interface ActionDefinition {
  duration: number | null; // 소요 시간 — 없으면 시간으로 끝나지 않는다
  replaceable: boolean; // 진행 중 다른 행동으로 대체 가능한가
}

// Duration 은 결정론 시뮬레이션 값이므로 헤더 상수로 고정한다.
export const ACTION_DEFINITIONS: Readonly<Record<ActionKind, ActionDefinition>> = {
  idle: { duration: null, replaceable: true }, // [base]
  move: { duration: null, replaceable: true }, // [movement] 목적지 도달로 끝난다
  // 스킬의 duration 은 여기 값이 아니라 시작하는 순간의 공격 속도가 정한다 (C007) —
  // 여기 있는 것은 그 기준이 되는 BaseDuration 이다 (SKILL_DEFINITIONS 와 같은 값).
  attack: { duration: 0.6, replaceable: false }, // [combat]
  'heavy-attack': { duration: 0.9, replaceable: false }, // [combat]
  // C012 — 기본 스킬과 같은 길이다. 다른 것은 피해의 방식뿐이다.
  'aura-strike': { duration: 0.6, replaceable: false }, // [combat]
  mine: { duration: 1.2, replaceable: false }, // [mining]
  hit: { duration: 0.35, replaceable: false }, // [combat] 피격 — 스스로 요청하는 행동이 아니다
  // [combat] 쓰러짐 — 스스로 끝나지 않고 대체되지도 않는다 (C007 INTENT-DOWNED-001)
  downed: { duration: null, replaceable: false },
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
