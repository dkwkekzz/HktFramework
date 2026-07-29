// 표현 생성 입력 빌더 (기획서 §33.3 / Phase-8 §8.2)
//
// 런타임을 아는 마지막 지점이다. 여기서 **순수 데이터**(NarrationRequest)를 뽑아내고,
// Event Interpreter 는 그것만 받는다 — 그래서 Interpreter 에게는 세계를 바꿀 손잡이가 없다(§33 마지막 문단).
//
// knownFacts / unknownFacts 는 관찰자 시점 API(§30 getEventViewFor)의 산출을 그대로 쓴다.
// "누가 무엇을 아는가"를 여기서 새로 판단하지 않는 것이 정보 비대칭이 새지 않는 이유다.
import { BeliefView } from "../core/agents/BeliefView";
import { rankGoals } from "../core/agents/GoalSystem";
import { getEventViewFor } from "../core/events/EventViews";
import type { WorldRuntime } from "../core/world/WorldRuntime";
import type { WorldEvent } from "../shared/events";
import type {
  ForbiddenFact,
  NarrationKind,
  NarrationRequest,
  NarrationSpeaker,
} from "../shared/narration";

function labelOf(runtime: WorldRuntime, entityId: string): string {
  return runtime.definition.bootstrap.entities.find((entry) => entry.id === entityId)?.name ?? entityId;
}

function formatValue(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

function factSentence(runtime: WorldRuntime, subjectId: string, stateKey: string, value: unknown): string {
  return `${labelOf(runtime, subjectId)}의 ${stateKey}는 ${formatValue(value)}`;
}

/** 모르는 상태 하나 — 비밀의 정체는 "대상 + 상태 + 값" 세 쪽이다 (§8.2) */
function forbiddenState(
  runtime: WorldRuntime,
  subjectId: string,
  stateKey: string,
  value: unknown,
): ForbiddenFact {
  return {
    sentence: factSentence(runtime, subjectId, stateKey, value),
    subjectLabel: labelOf(runtime, subjectId),
    stateKey,
    value: formatValue(value),
  };
}

/**
 * §17 은닉 목적 — 조직 내부자가 아닌 관찰자의 화면에 절대 오를 수 없는 사실 (G-3, §30).
 * 조직의 이름은 공개 정보이므로 identityLabel 을 쓰지 않는다 — 문장 자체가 비밀이다.
 */
function hiddenAgendaFacts(
  runtime: WorldRuntime,
  observerId: string,
  factionIds: Iterable<string>,
): ForbiddenFact[] {
  const facts: ForbiddenFact[] = [];
  const observerFaction = runtime.store.findEntity(observerId)?.states["faction_id"];
  for (const factionId of new Set(factionIds)) {
    const faction = runtime.definition.factions.find((entry) => entry.id === factionId);
    if (faction === undefined || faction.hiddenPurposes.length === 0) continue;
    // 내부자는 자기 조직의 은닉 목적을 안다 — 금지 사실이 아니다
    if (observerId === factionId || observerFaction === factionId) continue;
    const label = labelOf(runtime, factionId);
    for (const purpose of faction.hiddenPurposes) {
      facts.push({ sentence: `${label}의 실제 목적: ${purpose}` });
    }
    const graphId = runtime.definition.bootstrap.entities.find((entry) => entry.id === factionId)?.goalGraphId;
    const graph = runtime.definition.goalTemplates.find((entry) => entry.id === graphId);
    for (const goalId of faction.hiddenGoalIds ?? []) {
      const node = graph?.nodes.find((entry) => entry.id === goalId);
      if (node !== undefined) {
        facts.push({ sentence: `${label}이(가) 몰래 좇는 목적: ${node.description}` });
      }
    }
  }
  return facts;
}

function locationLabel(runtime: WorldRuntime, locationId: string | undefined): string {
  if (locationId === undefined) return "어딘가";
  return runtime.index.regions.get(locationId)?.name ?? labelOf(runtime, locationId);
}

/** §18 개인 원형에서 화자의 가치관·두려움을 가져온다 (없으면 태그로 대신한다) */
function speakerOf(
  runtime: WorldRuntime,
  speakerId: string,
  observerId: string,
): NarrationSpeaker | undefined {
  const entity = runtime.store.findEntity(speakerId);
  if (entity === undefined) return undefined;
  const archetype = runtime.definition.agentArchetypes.find((entry) => entry.id === speakerId);
  const goals = runtime.state.agentRuntimes[speakerId] === undefined ? [] : rankGoals(runtime, speakerId);
  const relation = runtime.state.relationships[`${speakerId}|${observerId}`];
  const speaker: NarrationSpeaker = {
    id: speakerId,
    name: labelOf(runtime, speakerId),
    values: archetype?.values ?? entity.tags.filter((tag) => tag !== "agent"),
    fear: archetype?.fears[0] ?? "",
    currentGoal: goals[0]?.goalId ?? "",
  };
  if (relation !== undefined) {
    speaker.relationshipToObserver = {
      trust: Math.round(relation.trust),
      respect: Math.round(relation.respect),
      fear: Math.round(relation.fear),
    };
  }
  return speaker;
}

/**
 * 사건 하나에 대한 생성 입력.
 * unknownFacts 는 "사건이 실제로 건드렸지만 이 관찰자에게 믿음이 없는 상태"다 —
 * 즉 **화면에 절대 나타나서는 안 되는 것**의 목록이고, 그래서 검사에도 이 목록이 쓰인다(§8.2).
 */
export function buildEventNarration(
  runtime: WorldRuntime,
  observerId: string,
  event: WorldEvent,
  kind: NarrationKind,
  options: { speakerId?: string; conversationPurpose?: string } = {},
): NarrationRequest {
  const view = getEventViewFor(runtime, observerId, event.id);
  const beliefs = new Set(
    (runtime.state.agentRuntimes[observerId]?.beliefs ?? []).map(
      (belief) => `${belief.subjectId}|${belief.stateKey}`,
    ),
  );

  const knownFacts = view.knownFacts.map((fact) =>
    factSentence(runtime, fact.subjectId, fact.stateKey, fact.believedValue),
  );

  const unknownFacts: ForbiddenFact[] = [];
  for (const entry of event.summary?.affectedStateSummaries ?? []) {
    if (entry.stateKey.startsWith("belief:")) continue;
    if (beliefs.has(`${entry.entityId}|${entry.stateKey}`)) continue;
    if (entry.entityId === observerId) continue;
    unknownFacts.push(forbiddenState(runtime, entry.entityId, entry.stateKey, entry.after));
  }
  for (const participantId of view.unknownParticipants) {
    // 정체를 모르는 참여자는 이름 자체가 비밀이다 (§30 "아직 모르는 것")
    unknownFacts.push({
      sentence: `${labelOf(runtime, participantId)}가 이 일에 관여했다`,
      identityLabel: labelOf(runtime, participantId),
    });
  }
  // §17 은닉 목적 — 참여 조직의 숨은 동기는 내부자가 아니면 말할 수 없다 (G-3, §30)
  unknownFacts.push(
    ...hiddenAgendaFacts(
      runtime,
      observerId,
      event.participants.filter((id) => runtime.state.agentRuntimes[id]?.kind === "faction"),
    ),
  );

  const speakerId =
    options.speakerId ??
    view.knownParticipants.find(
      (id) => id !== observerId && runtime.state.agentRuntimes[id]?.kind === "individual",
    );
  const speaker = speakerId === undefined ? undefined : speakerOf(runtime, speakerId, observerId);

  const request: NarrationRequest = {
    kind,
    eventId: event.id,
    at: event.lastChangeAt,
    observerId,
    eventType: event.type,
    locationLabel: locationLabel(runtime, event.locationId),
    participantLabels: view.knownParticipants.map((id) => labelOf(runtime, id)),
    knownFacts,
    unknownFacts,
    metrics: [
      { key: "significance", value: String(Math.round(event.significance)) },
      { key: "netChangedStates", value: String(event.summary?.netChangedStateCount ?? 0) },
      { key: "knownParticipants", value: String(view.knownParticipants.length) },
      { key: "unknownParticipants", value: String(view.unknownParticipants.length) },
    ],
    tags: [event.type, event.status],
  };
  if (speaker !== undefined) request.speaker = speaker;
  if (options.conversationPurpose !== undefined) {
    request.conversationPurpose = options.conversationPurpose;
  } else if (kind === "dialogue" && speaker !== undefined) {
    // 대화의 목적은 화자의 목적에서 나온다 — 플레이어에게 무엇을 요청하려는지가 곧 그의 목적이다(§33.3)
    request.conversationPurpose =
      speaker.currentGoal.length > 0 ? `${speaker.currentGoal}에 협력을 구한다` : "정보를 구한다";
  }
  return request;
}

/** 관찰 묘사 (§33.3) — 지금 이 주체를 보고 있는 관찰자가 무엇을 보는가 */
export function buildObservationNarration(
  runtime: WorldRuntime,
  observerId: string,
  subjectId: string,
): NarrationRequest {
  const observer = new BeliefView(runtime, observerId);
  const subject = runtime.store.findEntity(subjectId);
  const ownerType = subject === undefined ? undefined : runtime.store.ownerTypeOf(subject);
  const knownFacts: string[] = [];
  const unknownFacts: ForbiddenFact[] = [];

  for (const schema of runtime.definition.stateSchemas) {
    if (ownerType === undefined || schema.ownerType !== ownerType) continue;
    const perceived = observer.perceive(subjectId, schema.id);
    if (perceived.source === "unknown" || perceived.value === undefined) {
      const actual = subject === undefined ? undefined : runtime.store.read(subjectId, schema.id);
      if (actual !== undefined) unknownFacts.push(forbiddenState(runtime, subjectId, schema.id, actual));
      continue;
    }
    knownFacts.push(factSentence(runtime, subjectId, schema.id, perceived.value));
  }
  // 관찰 대상이 조직이면 은닉 목적도 금지 사실이다 (G-3, §17)
  if (runtime.state.agentRuntimes[subjectId]?.kind === "faction") {
    unknownFacts.push(...hiddenAgendaFacts(runtime, observerId, [subjectId]));
  }

  return {
    kind: "observation",
    eventId: `observe.${subjectId}`,
    at: runtime.state.simulationTime,
    observerId,
    eventType: "observation",
    locationLabel: locationLabel(runtime, subject?.position?.regionId),
    participantLabels: [labelOf(runtime, subjectId)],
    knownFacts,
    unknownFacts,
    metrics: [
      { key: "knownStates", value: String(knownFacts.length) },
      { key: "hiddenStates", value: String(unknownFacts.length) },
    ],
    tags: subject?.tags ?? [],
  };
}
