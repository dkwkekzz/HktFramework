// 플레이어와 성장 (기획서 §30 개입 기회, §31 플레이어 구현, §32 성장 시스템 / Phase-7)
//
// 여기 있는 것은 전부 **순수 데이터**다. 두 경계를 넘기 때문이다.
//   ① 스냅샷 : PlayerRuntimeState·GrowthChange 는 WorldState 에 실려 저장·복원된다(§39).
//   ② Worker : PlayerKnowledgeView 가 메인 스레드로 건너간다(§38).
// 그래서 §31 이 Set 으로 적은 discovered* 도 여기서는 **정렬된 배열**이다 —
// Set 은 JSON 직렬화에서 사라지고, 순회 순서가 결정론을 흔든다(§39).
import type { AgentRuntimeState, BeliefRecord } from "./beliefs";
import type { Position } from "./state";

// --- §31 플레이어 -----------------------------------------------------------------

/** §31 PlayerJournalEntry — 판단에 쓰이지 않는 UI 전용 기록. 문장화는 Phase 8 의 몫이다 */
export interface PlayerJournalEntry {
  id: number;
  at: number;
  /** 구조화 종류 — discovery=새 개체를 알게 됨, observation=믿음 갱신, action=행동, event=사건 발견, growth=성장 */
  kind: "discovery" | "observation" | "action" | "action_rejected" | "event" | "growth";
  /** 기계 키 (`action.observe`·`belief:creature.x.aggression` 등) */
  key: string;
  subjectIds: string[];
  /** 표시용 보조 값 — 숫자·상태값의 문자열화까지만 한다 */
  detail: string;
}

/**
 * §31 PlayerRuntimeState — AgentRuntimeState 를 그대로 확장한다.
 * 믿음·기억·관계·압력·비용은 NPC 와 같은 필드를 쓰고, 다른 것은 **행동 선택의 주체**뿐이다.
 */
export interface PlayerRuntimeState extends AgentRuntimeState {
  controlledByUser: true;
  discoveredEntityIds: string[];
  discoveredLocationIds: string[];
  journal: PlayerJournalEntry[];
  journalSeq: number;
  /** 이미 저널에 올린 사건 — 같은 사건을 매 tick 다시 기록하지 않기 위한 표식 */
  seenEventIds: string[];
}

export function isPlayerState(agent: AgentRuntimeState): agent is PlayerRuntimeState {
  return (agent as Partial<PlayerRuntimeState>).controlledByUser === true;
}

// --- §32 성장 ---------------------------------------------------------------------

export type GrowthType =
  | "physical"
  | "skill"
  | "knowledge"
  | "relationship"
  | "authority"
  | "ability"
  | "identity";

/** §32 GrowthChange — sourceEventId 는 필수다. 출처 사건 없는 성장은 존재하지 않는다. */
export interface GrowthChange {
  sourceEventId: string;
  type: GrowthType;
  key: string;
  previousValue: unknown;
  newValue: unknown;
  /** 누구의 성장인가 — NPC 와 플레이어를 가르지 않는다(§21) */
  agentId: string;
  at: number;
  /** 이 성장을 발화시킨 규칙 (§32 발생 조건은 전부 DSL 규칙이다) */
  ruleId: string;
  /** 선택형 성장이면 사용자가(또는 NPC 판단이) 고른 선택지 */
  optionId?: string;
}

/** §32 "사용자의 선택" — 새 제약을 받아들이고 그 대가로 능력이 열린다 */
export interface GrowthOption {
  id: string;
  /** 새로 받아들이는 제약 (§16 restrictions 로 들어간다) */
  restriction: string;
  severity: number;
  /** 제약의 대가로 열리는 것 */
  grants: { type: GrowthType; key: string; amount: number }[];
}

/**
 * 선택형 성장의 제안 (§32 마지막 문장 "수치 증가와 선택 구조를 함께 가진다").
 * 플레이어에게는 §30 개입 기회와 같은 모양으로 게시되고, NPC 는 같은 목록을 점수로 자동 결정한다(§21).
 */
export interface GrowthOffer {
  id: string;
  agentId: string;
  ruleId: string;
  sourceEventId: string;
  type: GrowthType;
  key: string;
  offeredAt: number;
  expiresAt: number;
  options: GrowthOption[];
}

/**
 * 아직 출처 사건을 찾지 못한 성장.
 * 규칙은 행동 직후에 발화하지만 사건 탐지(§28)는 같은 반복의 뒤쪽에서 돈다 —
 * 그래서 성장은 **일단 여기 머물다가** 자기를 낳은 사건이 탐지되면 그때 기록된다.
 * 기한 안에 사건이 생기지 않으면 그 성장은 없던 일이 된다(§32 sourceEventId 필수).
 */
export interface PendingGrowth {
  id: string;
  agentId: string;
  ruleId: string;
  type: GrowthType;
  key: string;
  /** 수치 성장분 — 선택형이면 0 */
  amount: number;
  createdAt: number;
  expiresAt: number;
  /** 비어 있으면 즉시 적용형, 있으면 선택형 */
  options: GrowthOption[];
}

// --- §31 행동 제시 ----------------------------------------------------------------

/**
 * 플레이어에게 보이는 행동 후보 (§31 "실행 가능한 행동만 표시한다").
 * ActionPlanner 의 후보를 그대로 옮긴 것이다 — 점수순으로 정렬만 하고 잘라내지 않는다.
 */
export interface PlayerActionOption {
  actionId: string;
  name: string;
  tags: string[];
  targetIds: string[];
  targetLabels: string[];
  /** 이 후보가 가장 크게 기여하는 목적 */
  goalId: string;
  score: number;
  duration: number;
  expectedGoalProgress: number;
  expectedCost: number;
  expectedRisk: number;
  confidence: number;
  /** 이 후보가 "다가가기"라면 도착해서 하려던 행동 */
  approachFor?: string;
}

/** execute_player_action 의 결과 — 실패해도 사유가 남는다(§7.3 요청 검증) */
export interface PlayerActionOutcome {
  accepted: boolean;
  actionId: string;
  targetIds: string[];
  /** 거절 사유 (accepted=false 일 때만) */
  reason?: string;
  startedAt?: number;
  completesAt?: number;
  /** 취소하고 갈아탄 이전 행동 */
  replacedActionId?: string;
}

// --- 지식 필터를 통과한 표시 데이터 (§30, §31, Phase-7 §7.2) -----------------------

/** 플레이어가 이 개체에 대해 아는 것 하나 — 실제 상태가 아니라 **믿음 또는 지금의 감각**이다 */
export interface PlayerKnownFact {
  key: string;
  value: string;
  confidence: number;
  /** self=자기 감각, belief=믿음, sense=지금 보이는 것 */
  source: "self" | "belief" | "sense";
}

export interface PlayerKnownEntity {
  id: string;
  kind: string;
  label: string;
  tags: string[];
  position?: Position;
  facts: PlayerKnownFact[];
}

/** §30 InterventionOpportunity 를 표시 속성으로 옮긴 것 */
export interface PlayerEventBrief {
  eventId: string;
  /** 사건 종류·제목은 사건의 존재를 알 때만 실린다 */
  type: string;
  title: string;
  knownParticipants: string[];
  /** 아직 모르는 참여자의 **수**만 준다 — 정체는 알려주지 않는다(§30) */
  unknownParticipantCount: number;
  knownFacts: BeliefRecord[];
  possibleInteractions: string[];
  timeSensitivity: number;
}

/**
 * 플레이어 화면이 볼 수 있는 전부 (§36.3 플레이어 모드의 선행 구현).
 * 이 구조에 담기지 않은 것은 UI 로 건너가지 않는다 — "숨길지 말지"의 판단이 UI 에 존재하지 않는 이유다.
 */
export interface PlayerKnowledgeView {
  playerId: string;
  time: number;
  self: PlayerKnownEntity;
  /** 발견한 개체만 (§31 discoveredEntityIds) */
  known: PlayerKnownEntity[];
  discoveredLocationIds: string[];
  /** 아직 모르는 개체가 몇인지까지만 안다 */
  undiscoveredCount: number;
  goals: { id: string; activation: number }[];
  options: PlayerActionOption[];
  currentAction?: { actionId: string; targetIds: string[]; completesAt: number };
  events: PlayerEventBrief[];
  /** §29 저중요도 필터 (G-9) — 알지만 중요도 미달이라 접힌 사건 수 (참여한 사건은 접지 않는다) */
  suppressedEventCount: number;
  journal: PlayerJournalEntry[];
  growthOffers: GrowthOffer[];
  growthLog: GrowthChange[];
}
