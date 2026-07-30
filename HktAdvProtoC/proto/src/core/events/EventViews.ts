// 관찰자 시점의 사건과 개입 기회 (기획서 §30 / Phase-4 §4.4·§4.5)
//
// 사건 자체는 세계의 것이지만, **아는 사건**은 주체마다 다르다.
// 여기서 사건과 주체의 믿음·기억을 교집합해 "그가 아는 만큼의 사건"을 만든다.
// Phase 7 의 플레이어는 다른 경로가 아니라 이 API 를 그대로 쓴다 — 플레이어도 하나의 주체이기 때문이다(§31).
import type { BeliefRecord } from "../../shared/beliefs";
import type { InterventionOpportunity, WorldEvent } from "../../shared/events";
import { BeliefView } from "../agents/BeliefView";
import type { WorldRuntime } from "../world/WorldRuntime";
import type { EventPattern } from "../world/types";
import { locationDistance } from "./EventDetector";

export interface EventView {
  eventId: string;
  /** 이 관찰자가 사건의 존재를 아는가 — 참여자나 사실 중 하나라도 알아야 한다 */
  known: boolean;
  knownParticipants: string[];
  /** 사건이 건드린 상태에 대해 이 관찰자가 가진 믿음 (§30 knownFacts) */
  knownFacts: BeliefRecord[];
  /** 아직 모르는 참여자 — "플레이어가 아직 모르는 것"(§30)의 데이터 형태 */
  unknownParticipants: string[];
}

function patternOf(runtime: WorldRuntime, event: WorldEvent): EventPattern | undefined {
  return runtime.definition.eventPatterns.find((pattern) => pattern.id === event.patternId);
}

/**
 * 사건이 건드린 "주제 → 상태" 쌍 (`subjectId|stateKey`).
 * 두 갈래를 함께 담는다 — ① 실제로 바뀐 개체 상태 ② 사건 중에 누군가의 믿음이 바뀐 대상(`belief:주제.상태`).
 * ②가 있어야 "마을 사람은 공격성 90 을, 연구자는 새끼 보호를 안다"(§10)가 관찰자별 knownFacts 로 갈린다.
 */
function touchedSubjects(event: WorldEvent): Set<string> {
  const touched = new Set<string>();
  for (const entry of event.summary?.affectedStateSummaries ?? []) {
    if (!entry.stateKey.startsWith("belief:")) {
      touched.add(`${entry.entityId}|${entry.stateKey}`);
      continue;
    }
    const body = entry.stateKey.slice("belief:".length);
    // 주제 id 에는 점이 있고 상태 키에는 없다 — 마지막 점에서 가른다
    const split = body.lastIndexOf(".");
    if (split < 0) continue;
    touched.add(`${body.slice(0, split)}|${body.slice(split + 1)}`);
  }
  return touched;
}

/**
 * 관찰자 한 명이 아는 만큼의 사건 (§30).
 * 아는 조건은 두 갈래다 — ① 참여자를 안다(지각·믿음·기억·소속, §22 knowsAgent)
 * ② 사건이 건드린 상태에 대한 믿음을 갖고 있다(관찰이든 소문이든 어떤 경로로든 들었다).
 */
export function getEventViewFor(runtime: WorldRuntime, agentId: string, eventId: string): EventView {
  const event = runtime.state.events.events.find((candidate) => candidate.id === eventId);
  if (event === undefined) {
    return { eventId, known: false, knownParticipants: [], knownFacts: [], unknownParticipants: [] };
  }
  const view = new BeliefView(runtime, agentId);
  const agent = runtime.state.agentRuntimes[agentId];

  const knownParticipants: string[] = [];
  const unknownParticipants: string[] = [];
  for (const participantId of event.participants) {
    const entity = runtime.store.findEntity(participantId);
    // 종족처럼 개체가 아닌 참여자는 그 종족에 속한 개체를 알면 아는 것으로 본다
    const known =
      entity === undefined
        ? (agent?.beliefs.some((belief) => belief.subjectId === participantId) ?? false)
        : view.knowsAgent(participantId);
    if (known) knownParticipants.push(participantId);
    else unknownParticipants.push(participantId);
  }

  const touched = touchedSubjects(event);
  const knownFacts = (agent?.beliefs ?? []).filter((belief) =>
    touched.has(`${belief.subjectId}|${belief.stateKey}`),
  );

  return {
    eventId,
    known: knownParticipants.length > 0 || knownFacts.length > 0,
    knownParticipants,
    knownFacts,
    unknownParticipants,
  };
}

/**
 * §30 possibleInteractions — 지금 이 주체가 사건을 향해 실제로 할 수 있는 행동.
 * 고정된 정답은 없다. 행동 체계에서 **역산**할 뿐이므로 새 행동이 생기면 개입 방식도 저절로 늘어난다.
 */
export function possibleInteractions(runtime: WorldRuntime, agentId: string, event: WorldEvent): string[] {
  const view = new BeliefView(runtime, agentId);
  const targets = new Set(event.participants);
  const interactions: string[] = [];

  for (const action of runtime.definition.actionDefinitions) {
    if (!view.evaluateConditions(action.actorRequirements).ok) continue;
    const query = action.targetQuery;
    if (query.kind === "none" || query.kind === "self") {
      // 대상이 필요 없는 행동은 이 주체가 사건 안에 있을 때만 개입이 된다
      if (targets.has(agentId)) interactions.push(action.id);
      continue;
    }
    const reachable = view
      .findTargets(query, { ignoreDistance: true })
      .some((entity) => targets.has(entity.id) || entity.position?.regionId === event.locationId);
    if (reachable) interactions.push(action.id);
  }
  return interactions.sort();
}

/**
 * §30 InterventionOpportunity — 사건 하나를 한 주체의 시점으로 옮긴 것.
 * discoveredByPlayer 는 Phase 7 에서 플레이어가 생기면 그때 참이 된다(지금은 관찰자가 아는지 여부를 그대로 쓴다).
 */
export function buildInterventionOpportunity(
  runtime: WorldRuntime,
  agentId: string,
  eventId: string,
): InterventionOpportunity | undefined {
  const event = runtime.state.events.events.find((candidate) => candidate.id === eventId);
  if (event === undefined) return undefined;
  const view = getEventViewFor(runtime, agentId, eventId);
  const pattern = patternOf(runtime, event);
  const now = runtime.state.simulationTime;

  // 남은 활동 여력 — 패턴의 timeWindow 대비 마지막 변화 이후 흐른 시간 (Phase-4 §4.4)
  const window = pattern?.timeWindow ?? 1;
  const timeSensitivity =
    event.status === "concluded" ? 0 : Math.max(0, 1 - (now - event.lastChangeAt) / (window * 2));

  return {
    eventId,
    discoveredByPlayer: view.known,
    knownParticipants: view.knownParticipants,
    knownFacts: view.knownFacts,
    possibleInteractions: possibleInteractions(runtime, agentId, event),
    timeSensitivity,
  };
}

/** 사건이 벌어진 자리에서 이 주체까지의 거리 — 개입 가능성의 공간 조건 (§13) */
export function distanceToEvent(runtime: WorldRuntime, agentId: string, event: WorldEvent): number {
  const position = runtime.store.findEntity(agentId)?.position;
  return locationDistance(runtime, position?.regionId, event.locationId);
}
