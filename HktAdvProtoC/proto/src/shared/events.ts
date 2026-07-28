// 사건 — 상태 변화 묶음의 해석 (기획서 §28 자동 탐지, §29 중요도, §30 개입 기회)
//
// 사건은 세계를 바꾸지 않는다. change 로그를 **읽어** 묶을 뿐이다(Phase-4).
// 그래서 이 데이터는 시뮬레이션의 결과이지 입력이 아니며, 스냅샷에 실려야 복원 후에도 같은 사건 목록이 된다.
import type { BeliefRecord } from "./beliefs";

/** §29 calculateEventSignificance 의 6항 — 합이 significance 다 */
export interface SignificanceBreakdown {
  /** 참여자 수 × 8 */
  participants: number;
  /** 영향 시스템 수 × 12 */
  affectedSystems: number;
  /** 상태 변화량 × 0.5 */
  magnitude: number;
  /** 관계 영향 × 0.7 */
  relationshipImpact: number;
  /** 플레이어 관련도 — Phase 7 전까지 0 */
  playerRelevance: number;
  /** 미래 잠재력 — 이 사건의 영향 상태를 달성 조건으로 삼는 활성 목적 수 */
  futurePotential: number;
}

/** 사건이 건드린 상태 하나의 순변화 (§44-9 "사건 결과가 세계 상태를 변화시킨다"의 증거) */
export interface AffectedStateSummary {
  entityId: string;
  stateKey: string;
  /** 사건 첫 변화 직전 값 */
  before: unknown;
  /** 마지막으로 관측된 값 */
  after: unknown;
  /** 숫자 상태의 순변화 (after - before). 숫자가 아니면 undefined */
  delta?: number;
  /** 이 상태를 건드린 change 수 */
  changeCount: number;
}

/** 사건 요약 (§26 updateEventSummaries) — 구조화까지만. 문장화는 Phase 8 */
export interface EventSummary {
  /** 영향 상태별 순변화 — entityId·stateKey 사전순 */
  affectedStateSummaries: AffectedStateSummary[];
  /** 0 이 아닌 순변화를 남긴 상태 수 */
  netChangedStateCount: number;
  /** 사건 시작 시점에 참여자들이 갖고 있지 않다가 새로 활성화된 목적 (§44-10) */
  newlyActivatedGoals: { agentId: string; goalId: string }[];
  /** 참여자들의 활성 목적이 서로 배타적인 쌍 (§44-7) */
  goalConflicts: GoalConflict[];
  /** 사건에 흡수된 change 수 (changes 배열이 잘려도 총량은 남는다) */
  totalChangeCount: number;
  lastUpdatedAt: number;
}

/** 두 주체의 활성 목적이 같은 상태를 반대 방향으로 요구한다 (§19 conflicts 의 사건 단위 관측) */
export interface GoalConflict {
  entityId: string;
  stateKey: string;
  left: { agentId: string; goalId: string; demand: string };
  right: { agentId: string; goalId: string; demand: string };
}

/** §28 의 사건 — 예시 JSON 의 필드를 그대로 따르고 수명·중요도 필드를 더한다 */
export interface WorldEvent {
  id: string;
  patternId: string;
  /** §28 "type": 사건 종류 (ecological_conflict 등) */
  type: string;
  /** 구조화 키 — 사람이 읽는 문장은 Phase 8 Event Interpreter 의 몫 */
  title: string;
  participants: string[];
  /** `entityId.stateKey` 목록 (§28 affectedStates) */
  affectedStates: string[];
  /** 이 사건에 흡수된 RawWorldChange 의 id (최근 것부터 상한을 지킨다) */
  changes: number[];
  status: "ongoing" | "concluded";
  startedAt: number;
  /** 마지막으로 change 를 흡수한 시각 — 종결 판정의 기준 */
  lastChangeAt: number;
  concludedAt?: number;
  /** 사건이 벌어진 지역 (첫 change 의 위치) */
  locationId?: string;
  significance: number;
  significanceBreakdown: SignificanceBreakdown;
  /** 사건 시작 시점 참여자들의 활성 목적 — newlyActivatedGoals 의 기준선 */
  baselineGoals: { agentId: string; goalId: string }[];
  summary?: EventSummary;
}

/** §30 InterventionOpportunity — 관찰자 한 명에게 보이는 사건 */
export interface InterventionOpportunity {
  eventId: string;
  discoveredByPlayer: boolean;
  knownParticipants: string[];
  knownFacts: BeliefRecord[];
  possibleInteractions: string[];
  timeSensitivity: number;
}

/** 사건 저장소 — WorldState 의 일부 (스냅샷·결정론) */
export interface EventsState {
  events: WorldEvent[];
  eventSeq: number;
  /** 마지막 탐지 통과 시각 — 탐지는 매 tick 이 아니라 주기적으로 돈다 (§28) */
  lastDetectionAt: number;
  /** 마지막 요약 갱신 시각 — 탐지보다 뒤면 요약이 밀린 것이다 (§26 ⑦) */
  lastSummaryAt: number;
}

/** 사건 하나가 들고 있는 change id 상한 — §24 와 같은 이유로 무한히 자라지 않는다 */
export const MAX_EVENT_CHANGES = 400;
/** 보관하는 사건 수 상한 — 넘으면 종결된 오래된 사건부터 버린다 */
export const MAX_EVENTS = 200;

export function createEmptyEventsState(): EventsState {
  return { events: [], eventSeq: 0, lastDetectionAt: -1, lastSummaryAt: -1 };
}
