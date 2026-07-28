// Phase 4 완료 조건의 재현 가능한 측정 (§28 탐지, §29 중요도, §30 관찰자 시점)
//
// Phase 3 의 phase3Checks 와 같은 규약 — **verify 스크립트와 테스트가 같은 함수를 쓴다**.
// 보고에 실린 수치와 테스트가 보는 수치가 갈라질 수 없게 하는 장치다.
import type { WorldEvent } from "../../shared/events";
import type { WorldRuntime } from "../world/WorldRuntime";
import { SIGNIFICANCE_THRESHOLD } from "./EventDetector";
import { conflictingAgents } from "./EventSummarizer";
import { getEventViewFor } from "./EventViews";

export function allEvents(runtime: WorldRuntime): WorldEvent[] {
  return runtime.state.events.events;
}

/** 중요도 내림차순 (동점은 id 사전순 — 결정론) */
export function eventsBySignificance(runtime: WorldRuntime): WorldEvent[] {
  return [...allEvents(runtime)].sort((a, b) =>
    a.significance === b.significance ? a.id.localeCompare(b.id) : b.significance - a.significance,
  );
}

export interface ParticipantMix {
  species: string[];
  factions: string[];
  individuals: string[];
}

/** 참여자를 종족·조직·개인으로 갈라 본다 — §28 예시 사건의 참여자 구성 */
export function participantMix(runtime: WorldRuntime, event: WorldEvent): ParticipantMix {
  const mix: ParticipantMix = { species: [], factions: [], individuals: [] };
  for (const participantId of event.participants) {
    const entity = runtime.store.findEntity(participantId);
    if (entity === undefined) {
      // 개체가 아닌 참여자는 종족이다 (§15 종족은 개체로 존재하지 않는다)
      mix.species.push(participantId);
      continue;
    }
    if (entity.type === "faction") mix.factions.push(participantId);
    else mix.individuals.push(participantId);
  }
  return mix;
}

/** §28 예시 구조의 사건 — 종족·조직·개인이 섞인 생태 충돌 (중요도 최상위 1건) */
export function findEcologicalConflict(runtime: WorldRuntime): WorldEvent | undefined {
  return eventsBySignificance(runtime).find((event) => {
    if (event.type !== "ecological_conflict") return false;
    const mix = participantMix(runtime, event);
    return mix.species.length > 0 && mix.factions.length > 0 && mix.individuals.length > 0;
  });
}

export interface ConflictReport {
  event: WorldEvent;
  agents: string[];
  lines: string[];
}

/** 목적이 서로 배타적인 주체가 minimumAgents 명 이상인 사건 (§44-7) */
export function findGoalConflictEvents(runtime: WorldRuntime, minimumAgents = 3): ConflictReport[] {
  const reports: ConflictReport[] = [];
  for (const event of eventsBySignificance(runtime)) {
    const conflicts = event.summary?.goalConflicts ?? [];
    const agents = conflictingAgents(conflicts);
    if (agents.length < minimumAgents) continue;
    reports.push({
      event,
      agents,
      lines: conflicts.map(
        (conflict) =>
          `${conflict.left.agentId}(${conflict.left.goalId}) ${conflict.left.demand}` +
          ` ↔ ${conflict.right.agentId}(${conflict.right.goalId}) ${conflict.right.demand}` +
          ` : ${conflict.entityId}.${conflict.stateKey}`,
      ),
    });
  }
  return reports;
}

export interface ObserverComparison {
  eventId: string;
  left: { agentId: string; participants: number; facts: string[] };
  right: { agentId: string; participants: number; facts: string[] };
  /** 한쪽만 아는 사실 */
  onlyLeft: string[];
  onlyRight: string[];
}

/** 같은 사건을 두 주체가 각각 얼마나 아는가 (§30 "플레이어가 아는 것/모르는 것") */
export function compareObservers(
  runtime: WorldRuntime,
  eventId: string,
  leftId: string,
  rightId: string,
): ObserverComparison {
  const left = getEventViewFor(runtime, leftId, eventId);
  const right = getEventViewFor(runtime, rightId, eventId);
  const factKey = (fact: { subjectId: string; stateKey: string; believedValue: unknown }): string =>
    `${fact.subjectId}.${fact.stateKey}=${String(fact.believedValue)}`;
  const leftFacts = left.knownFacts.map(factKey);
  const rightFacts = right.knownFacts.map(factKey);
  return {
    eventId,
    left: { agentId: leftId, participants: left.knownParticipants.length, facts: leftFacts },
    right: { agentId: rightId, participants: right.knownParticipants.length, facts: rightFacts },
    onlyLeft: leftFacts.filter((fact) => !rightFacts.includes(fact)),
    onlyRight: rightFacts.filter((fact) => !leftFacts.includes(fact)),
  };
}

/**
 * 두 관찰자의 앎이 가장 크게 갈리는 사건을 고른다 (§30).
 * "누가 무엇을 아는가"는 사건마다 다르므로, 가장 벌어진 한 건을 근거로 든다.
 */
export function findMostDividedEvent(
  runtime: WorldRuntime,
  leftId: string,
  rightId: string,
): ObserverComparison | undefined {
  let best: ObserverComparison | undefined;
  let bestScore = 0;
  for (const event of eventsBySignificance(runtime)) {
    const comparison = compareObservers(runtime, event.id, leftId, rightId);
    const score =
      comparison.onlyLeft.length +
      comparison.onlyRight.length +
      Math.abs(comparison.left.participants - comparison.right.participants);
    if (score <= bestScore) continue;
    bestScore = score;
    best = comparison;
  }
  return best;
}

export interface ConclusionReport {
  event: WorldEvent;
  netChangedStates: number;
  topDeltas: string[];
  newGoals: string[];
}

/** 종결된 사건 중 세계에 흔적을 남기고(§44-9) 새 목적을 연(§44-10) 것들 */
export function findConcludedWithConsequences(runtime: WorldRuntime): ConclusionReport[] {
  const reports: ConclusionReport[] = [];
  for (const event of eventsBySignificance(runtime)) {
    if (event.status !== "concluded") continue;
    const summary = event.summary;
    if (summary === undefined) continue;
    if (summary.netChangedStateCount === 0) continue;
    if (summary.newlyActivatedGoals.length === 0) continue;
    const topDeltas = [...summary.affectedStateSummaries]
      .filter((entry) => (entry.delta ?? 0) !== 0)
      .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
      .slice(0, 3)
      .map((entry) => `${entry.entityId}.${entry.stateKey} ${String(entry.before)}→${String(entry.after)}`);
    reports.push({
      event,
      netChangedStates: summary.netChangedStateCount,
      topDeltas,
      newGoals: summary.newlyActivatedGoals.map((goal) => `${goal.agentId}:${goal.goalId}`),
    });
  }
  return reports;
}

export interface PromotionStats {
  totalChanges: number;
  assignedChanges: number;
  /** 행동별 "사건에 소속된 change / 전체 change" — 평시 행동일수록 낮아야 한다 (§29) */
  byAction: { actionId: string; assigned: number; total: number }[];
  hiddenEvents: number;
  shownEvents: number;
  lowestSignificance: number;
  highestSignificance: number;
}

/** §29 — 어떤 변화가 사건으로 승격되고 어떤 변화가 그대로 묻히는가 */
export function measurePromotion(runtime: WorldRuntime, actionIds: string[]): PromotionStats {
  const events = allEvents(runtime);
  const assigned = new Set(events.flatMap((event) => event.changes));
  const log = runtime.state.changeLog;
  const byAction = actionIds.map((actionId) => {
    const changes = log.filter((change) => change.tags.includes(actionId));
    return {
      actionId,
      assigned: changes.filter((change) => assigned.has(change.id)).length,
      total: changes.length,
    };
  });
  const significances = events.map((event) => event.significance);
  return {
    totalChanges: log.length,
    assignedChanges: log.filter((change) => assigned.has(change.id)).length,
    byAction,
    hiddenEvents: events.filter((event) => event.significance < SIGNIFICANCE_THRESHOLD).length,
    shownEvents: events.filter((event) => event.significance >= SIGNIFICANCE_THRESHOLD).length,
    lowestSignificance: significances.length === 0 ? 0 : Math.min(...significances),
    highestSignificance: significances.length === 0 ? 0 : Math.max(...significances),
  };
}

/** 사건 목록을 재현성 비교용으로 줄인다 — 같은 시드면 같은 문자열이 나와야 한다(§39·§44-12) */
export function summarizeEvents(runtime: WorldRuntime): string[] {
  return allEvents(runtime).map(
    (event) =>
      `${event.id}|${event.patternId}|${event.status}|${event.startedAt}|${event.lastChangeAt}` +
      `|${event.participants.join(",")}|${event.changes.length}|${event.significance.toFixed(3)}`,
  );
}

/** 패턴별 사건 수 — §35 다양성 지표의 씨앗 (Phase 6 이 그대로 가져다 쓴다) */
export function eventCountsByPattern(runtime: WorldRuntime): { patternId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const pattern of runtime.definition.eventPatterns) counts.set(pattern.id, 0);
  for (const event of allEvents(runtime)) counts.set(event.patternId, (counts.get(event.patternId) ?? 0) + 1);
  return [...counts].map(([patternId, count]) => ({ patternId, count }));
}
