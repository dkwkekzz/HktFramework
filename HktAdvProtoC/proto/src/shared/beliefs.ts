// 믿음과 주체 런타임 상태 (기획서 §10, §19, §26)
// 스냅샷에 실려야 복원 후에도 같은 판단이 나오므로 shared(순수 데이터)에 둔다.

export interface BeliefRecord {
  subjectId: string;
  stateKey: string;
  believedValue: unknown;
  confidence: number;
  sourceIds: string[];
  lastUpdatedAt: number;
}

/** 목적 활성도 계산 결과 (§19, §20 — Phase 1 은 baseImportance + urgency 두 항만) */
export interface ActiveGoalState {
  goalId: string;
  activation: number;
  urgency: number;
}

/** 진행 중인 행동 (§21 duration 만큼 시간을 점유한다) */
export interface ScheduledActionState {
  actionId: string;
  targetIds: string[];
  startedAt: number;
  completesAt: number;
  /** 완료 이벤트 id — 재판단으로 취소할 때 쓴다 */
  eventId: string;
  goalId: string;
}

/**
 * 주체 런타임 상태 (§20 AgentRuntimeState, §26 shouldReplan 이 읽는 대상).
 * Phase 1 은 믿음·플래그·현재 행동만 담고, 기억(§24)·관계(§25)는 Phase 3 이 채운다.
 */
export interface AgentRuntimeState {
  agentId: string;
  currentAction: ScheduledActionState | null;
  flags: string[];
  beliefs: BeliefRecord[];
  /** 개인 판단 변수 (§18) — 같은 상황에서 다른 선택이 나오는 이유 */
  traits: Record<string, number>;
  lastReplanAt: number;
  /** 완료한 행동 수 — "5명 전원이 1회 이상 행동" DoD 의 관측점 */
  completedActionCount: number;
}

export function createAgentRuntimeState(
  agentId: string,
  traits: Record<string, number> = {},
): AgentRuntimeState {
  return {
    agentId,
    currentAction: null,
    flags: [],
    beliefs: [],
    traits,
    lastReplanAt: -1,
    completedActionCount: 0,
  };
}
