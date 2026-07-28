// 믿음·기억·관계와 주체 런타임 상태 (기획서 §10, §19, §20, §24, §25, §26)
// 스냅샷에 실려야 복원 후에도 같은 판단이 나오므로 shared(순수 데이터)에 둔다.

export interface BeliefRecord {
  subjectId: string;
  stateKey: string;
  believedValue: unknown;
  confidence: number;
  sourceIds: string[];
  lastUpdatedAt: number;
}

/** §24 MemoryDefinition — 기억은 사건의 복사본이 아니라 "중요도를 가진 흔적"이다 */
export interface MemoryRecord {
  id: string;
  type:
    | "observation"
    | "interaction"
    | "success"
    | "failure"
    | "trauma"
    | "promise"
    | "betrayal"
    | "discovery";
  participants: string[];
  tags: string[];
  emotionalIntensity: number;
  relevance: number;
  confidence: number;
  createdAt: number;
  decayRate: number;
  /** 사람이 읽는 문장은 Presentation(Phase 8)의 몫 — 여기서는 태그 조합의 기계 요약이다 */
  summary: string;
  /**
   * 이 기억이 지지하는 해석 — 인식 파이프라인의 "기억 대조" 단계가 원인 후보로 꺼내 쓴다(§23).
   * 예: 반향수의 흔적을 봤을 때 "새끼를 지키는 중"이라는 과거 해석이 후보로 올라온다.
   */
  interpretation?: { subjectId: string; stateKey: string; value: unknown };
}

/** §25 약속 — 지키지 않으면 신뢰가 무너지는 미래 조건 */
export interface PromiseState {
  id: string;
  /** 약속을 이행했는지 판정할 상태 키 (약속한 쪽 개체의 상태) */
  stateKey: string;
  comparison: ">" | "<";
  threshold: number;
  createdAt: number;
  dueAt: number;
  status: "open" | "kept" | "broken";
  /** 약속의 계기 — 위임(조직 명령)인지 개인 간 약속인지 */
  tags: string[];
}

/** §25 RelationshipState — 관계는 호감도 하나가 아니다 */
export interface RelationshipState {
  fromId: string;
  toId: string;
  trust: number;
  fear: number;
  respect: number;
  affection: number;
  resentment: number;
  dependency: number;
  debt: number;
  familiarity: number;
  knownSecrets: string[];
  promises: PromiseState[];
}

/** §20 활성도 11항의 산출 근거 — Phase 6 진단·Phase 8 §36.3 주체 관찰 화면의 입력 */
export interface GoalActivationBreakdown {
  baseImportance: number;
  needPressure: number;
  urgency: number;
  valueAlignment: number;
  relationshipImpact: number;
  emotionalBias: number;
  feasibility: number;
  expectedUtility: number;
  cost: number;
  risk: number;
  conflict: number;
}

/** 목적 활성도 계산 결과 (§19, §20) */
export interface ActiveGoalState {
  goalId: string;
  activation: number;
  urgency: number;
  /** 11항 각각의 값 — "왜 이 목적을 골랐는가"의 근거 */
  breakdown?: GoalActivationBreakdown;
  /** graph=자기 목적 그래프, delegated=조직이 위임한 목적(§17, §21) */
  source?: "graph" | "delegated";
}

/** 조직이 개인에게 주입한 목적 (§17 위임, §21 "다른 주체에게 행동을 위임한다") */
export interface DelegatedGoal {
  goalId: string;
  /** 위임한 조직 */
  fromId: string;
  /** 조직이 부여한 중요도 — 개인은 여기에 자기 충성도·관계를 곱해 받아들인다 */
  importance: number;
  issuedAt: number;
  expiresAt: number;
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
 * 개인과 조직이 같은 구조를 쓴다 — 조직도 목적과 믿음을 가진 주체다(§17, Phase-3 §3.7).
 */
export interface AgentRuntimeState {
  agentId: string;
  /** individual=개인·생물, faction=조직(재판단 주기가 느리고 믿음이 보고로만 들어온다) */
  kind: "individual" | "faction";
  currentAction: ScheduledActionState | null;
  flags: string[];
  beliefs: BeliefRecord[];
  /** §24 기억 — 중요도 순으로 상한을 지킨다 */
  memories: MemoryRecord[];
  memorySeq: number;
  /** 개인 판단 변수 (§18) — 같은 상황에서 다른 선택이 나오는 이유 */
  traits: Record<string, number>;
  /** §8 생존 압력의 누적 긴급도 (pressureId → urgency) */
  pressures: Record<string, number>;
  /** 실행 수단이 없어 잠시 접어 둔 목적 (§27 handleNoAvailableAction) — goalId → 해제 시각 */
  goalCooldowns: Record<string, number>;
  /** 조직이 위임한 목적 (§17) */
  delegations: DelegatedGoal[];
  /** creates/reveals 엣지로 열린 후속 목적 (§19, §44-10) */
  unlockedGoals: string[];
  /** completionEffects 를 이미 적용한 목적 (§19 — 효과는 1회만) */
  completedGoals: string[];
  lastReplanAt: number;
  /** 완료한 행동 수 — "5명 전원이 1회 이상 행동" DoD 의 관측점 */
  completedActionCount: number;
}

export function createAgentRuntimeState(
  agentId: string,
  traits: Record<string, number> = {},
  kind: "individual" | "faction" = "individual",
): AgentRuntimeState {
  return {
    agentId,
    kind,
    currentAction: null,
    flags: [],
    beliefs: [],
    memories: [],
    memorySeq: 0,
    traits,
    pressures: {},
    goalCooldowns: {},
    delegations: [],
    unlockedGoals: [],
    completedGoals: [],
    lastReplanAt: -1,
    completedActionCount: 0,
  };
}

export function relationshipKey(fromId: string, toId: string): string {
  return `${fromId}|${toId}`;
}

export function createRelationshipState(fromId: string, toId: string): RelationshipState {
  return {
    fromId,
    toId,
    trust: 0,
    fear: 0,
    respect: 0,
    affection: 0,
    resentment: 0,
    dependency: 0,
    debt: 0,
    familiarity: 0,
    knownSecrets: [],
    promises: [],
  };
}
