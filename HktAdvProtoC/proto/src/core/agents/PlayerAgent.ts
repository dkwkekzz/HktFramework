// 플레이어 = 하나의 주체 (기획서 §30, §31, §21 / Phase-7 §7.1~§7.4)
//
// **이 파일에는 플레이어 전용 세계 조작이 한 줄도 없다.**
// 믿음·인식·기억·관계·비용·행동 예약은 전부 NPC 와 같은 함수를 부른다(§21 비분리).
// 다른 것은 두 가지뿐이다.
//   ① 판단 분기 : ActionPlanner 가 고르는 대신 후보를 **전부** 게시하고 사용자의 요청을 기다린다(§31).
//   ② 지식 필터 : 화면으로 나가는 데이터가 믿음·감각·발견 집합을 넘지 못한다(§30, §36.3).
import { resolveDuration, startAction, type PlannedAction } from "../actions/ActionSystem";
import type { AgentRuntimeState } from "../../shared/beliefs";
import type { WorldEvent } from "../../shared/events";
import {
  isPlayerState,
  type PlayerActionOption,
  type PlayerActionOutcome,
  type PlayerEventBrief,
  type PlayerJournalEntry,
  type PlayerKnownEntity,
  type PlayerKnownFact,
  type PlayerKnowledgeView,
  type PlayerRuntimeState,
} from "../../shared/player";
import type { PlayerActionRequest } from "../../shared/protocol";
import { buildInterventionOpportunity, getEventViewFor } from "../events/EventViews";
import { SIGNIFICANCE_THRESHOLD } from "../events/EventDetector";
import type { WorldRuntime } from "../world/WorldRuntime";
import type { GoalNode } from "../world/types";
import { generateActionCandidates, sortCandidates, type ActionCandidate } from "./ActionPlanner";
import { BeliefView } from "./BeliefView";
import { findGoalNode, rankGoals } from "./GoalSystem";

/** 저널 상한 — §24 기억과 같은 이유로 무한히 자라지 않는다 (UI 전용이므로 판단에는 영향이 없다) */
export const JOURNAL_CAPACITY = 240;

/**
 * §31 "모든 행동 버튼을 표시해서는 안 된다"의 반대편 —
 * 목적에 매인 후보만 보여 주면 플레이어는 자기 목적 밖의 일을 할 수 없다.
 * 그래서 후보 생성기를 한 번 더, **모든 행동 태그를 허용하는 목적**으로 돌린다.
 * 필터는 그대로 남는다(actorRequirements·위치·아는 대상) — 늘어나는 것은 "이 행동이 지금 가능한가"뿐이다.
 */
export const PLAYER_INTENT_GOAL_ID = "goal.player_intent";

function playerIntentGoal(runtime: WorldRuntime): GoalNode {
  const tags = new Set<string>();
  for (const action of runtime.definition.actionDefinitions) {
    for (const tag of action.tags) tags.add(tag);
  }
  return {
    id: PLAYER_INTENT_GOAL_ID,
    description: "사용자의 의지",
    targetConditions: [],
    baseImportance: 0,
    urgencyPolicy: { type: "constant", value: 0 },
    desiredChanges: [],
    abandonmentConditions: [],
    allowedActionTags: [...tags].sort(),
  };
}

// --- 부착·해제 (§31) ---------------------------------------------------------------

export function findPlayerId(runtime: WorldRuntime): string | undefined {
  return runtime.agentIds().find((id) => isPlayerState(runtime.agentRuntime(id)));
}

export function playerStateOf(runtime: WorldRuntime, agentId: string): PlayerRuntimeState | undefined {
  const agent = runtime.state.agentRuntimes[agentId];
  return agent !== undefined && isPlayerState(agent) ? agent : undefined;
}

/**
 * 한 주체를 사용자 조작으로 돌린다.
 * 새 개체를 만들지 않는다 — 이미 세계에 살고 있는 주체가 그대로 플레이어가 된다(§31 "동일한 데이터 구조").
 * 그래서 그가 여태 쌓은 믿음·기억·관계가 곧 플레이어의 출발점이다.
 */
export function attachPlayer(runtime: WorldRuntime, agentId: string): PlayerRuntimeState {
  const previous = findPlayerId(runtime);
  if (previous !== undefined && previous !== agentId) detachPlayer(runtime);

  const agent = runtime.state.agentRuntimes[agentId];
  if (agent === undefined) throw new Error(`주체 런타임 없음: ${agentId}`);
  if (agent.kind === "faction") {
    throw new Error(`조직은 조작할 수 없다: ${agentId} (§17 조직은 구성원의 보고로만 세계를 본다)`);
  }
  if (isPlayerState(agent)) return agent;

  const player = agent as AgentRuntimeState & Partial<PlayerRuntimeState>;
  player.controlledByUser = true;
  player.discoveredEntityIds = [];
  player.discoveredLocationIds = [];
  player.journal = [];
  player.journalSeq = 0;
  player.seenEventIds = [];
  const attached = player as PlayerRuntimeState;

  // 지금 아는 것이 출발점이다 — 장소·자원·조직은 지도 지식이고(BeliefView), 살아 있는 주체는 아는 것만.
  seedDiscoveries(runtime, attached);
  appendJournal(runtime, attached, {
    kind: "discovery",
    key: "player_attached",
    subjectIds: [agentId],
    detail: `아는 개체 ${attached.discoveredEntityIds.length}개로 시작`,
  });
  return attached;
}

export function detachPlayer(runtime: WorldRuntime): string | undefined {
  const playerId = findPlayerId(runtime);
  if (playerId === undefined) return undefined;
  const agent = runtime.agentRuntime(playerId) as Partial<PlayerRuntimeState>;
  delete agent.controlledByUser;
  delete agent.discoveredEntityIds;
  delete agent.discoveredLocationIds;
  delete agent.journal;
  delete agent.journalSeq;
  delete agent.seenEventIds;
  return playerId;
}

function seedDiscoveries(runtime: WorldRuntime, player: PlayerRuntimeState): void {
  const view = new BeliefView(runtime, player.agentId);
  for (const entity of Object.values(runtime.state.entities).sort((a, b) => a.id.localeCompare(b.id))) {
    if (entity.type === "location") player.discoveredLocationIds.push(entity.id);
    // 살아 있는 주체만 지식으로 잠긴다 — 나머지는 §22 findPossibleTargets 와 같은 지도 지식이다
    if (entity.type === "agent" && !view.knowsAgent(entity.id)) continue;
    player.discoveredEntityIds.push(entity.id);
  }
}

// --- 저널 (§31) --------------------------------------------------------------------

export function appendJournal(
  runtime: WorldRuntime,
  player: PlayerRuntimeState,
  draft: Omit<PlayerJournalEntry, "id" | "at">,
): void {
  const at = runtime.state.simulationTime;
  // 같은 tick 에 루프가 여러 번 돌 수 있다 — 같은 내용을 두 번 적지 않는다
  const duplicate = player.journal.some(
    (entry) =>
      entry.at === at &&
      entry.kind === draft.kind &&
      entry.key === draft.key &&
      entry.subjectIds.join(",") === draft.subjectIds.join(","),
  );
  if (duplicate) return;
  player.journal.push({ id: player.journalSeq++, at, ...draft });
  if (player.journal.length > JOURNAL_CAPACITY) {
    player.journal.splice(0, player.journal.length - JOURNAL_CAPACITY);
  }
}

// --- 지식 갱신 (§7.2) ---------------------------------------------------------------

/**
 * 인식 파이프라인이 지나간 뒤 발견 집합과 저널을 따라 붙인다.
 * **인식 자체는 건드리지 않는다** — NPC 와 같은 PerceptionSystem 이 만든 결과를 읽기만 한다.
 */
export function refreshPlayerKnowledge(runtime: WorldRuntime): void {
  const playerId = findPlayerId(runtime);
  if (playerId === undefined) return;
  const player = runtime.agentRuntime(playerId) as PlayerRuntimeState;
  const view = new BeliefView(runtime, playerId);
  const now = runtime.state.simulationTime;

  const discovered = new Set(player.discoveredEntityIds);
  for (const entity of Object.values(runtime.state.entities).sort((a, b) => a.id.localeCompare(b.id))) {
    if (discovered.has(entity.id)) continue;
    if (entity.type === "agent" && !view.knowsAgent(entity.id)) continue;
    player.discoveredEntityIds.push(entity.id);
    discovered.add(entity.id);
    if (entity.type === "location" && !player.discoveredLocationIds.includes(entity.id)) {
      player.discoveredLocationIds.push(entity.id);
    }
    appendJournal(runtime, player, {
      kind: "discovery",
      key: entity.type,
      subjectIds: [entity.id],
      detail: entity.tags.join(","),
    });
  }

  // 이번 tick 에 갱신된 믿음 — "무엇을 알게 되었는가"의 기록 (판단에는 쓰이지 않는다)
  for (const belief of player.beliefs) {
    if (belief.lastUpdatedAt !== now) continue;
    appendJournal(runtime, player, {
      kind: "observation",
      key: `${belief.subjectId}.${belief.stateKey}`,
      subjectIds: [belief.subjectId],
      detail: `${String(belief.believedValue)} (확신 ${belief.confidence.toFixed(2)})`,
    });
  }

  // 알게 된 사건 (§30) — 아는 사건만 저널에 오른다
  const seen = new Set(player.seenEventIds);
  for (const event of runtime.state.events.events) {
    if (seen.has(event.id)) continue;
    if (!getEventViewFor(runtime, playerId, event.id).known) continue;
    player.seenEventIds.push(event.id);
    seen.add(event.id);
    appendJournal(runtime, player, {
      kind: "event",
      key: event.type,
      subjectIds: [event.id],
      detail: event.title,
    });
  }
}

// --- 행동 제시 (§31, §7.3) ------------------------------------------------------------

/** 표시 이름 — 초기 배치에 적힌 이름이 있으면 그것을, 없으면 id 를 쓴다 */
function entityLabel(runtime: WorldRuntime, entityId: string): string {
  return runtime.definition.bootstrap.entities.find((entry) => entry.id === entityId)?.name ?? entityId;
}

function candidateKey(candidate: ActionCandidate): string {
  // approachFor 가 다르면 다른 선택지다 — "관찰하러 다가간다"와 "연구하러 다가간다"가
  // 같은 (move, 대상) 키로 합쳐지면 한쪽 참여 방식이 화면에서 사라진다 (§30)
  return `${candidate.actionId}|${candidate.targetIds.join(",")}|${candidate.approachFor ?? ""}`;
}

/**
 * §31 표시 목록 — ActionPlanner 의 후보 생성기를 플레이어에게 그대로 적용한 결과.
 * NPC 와 다른 점은 단 하나: **점수순으로 정렬만 하고 잘라내지 않는다**(선택은 사용자 몫).
 */
export function playerActionOptions(runtime: WorldRuntime, playerId: string): PlayerActionOption[] {
  const view = new BeliefView(runtime, playerId);
  const best = new Map<string, ActionCandidate>();

  const consider = (candidates: ActionCandidate[]): void => {
    for (const candidate of candidates) {
      const key = candidateKey(candidate);
      const previous = best.get(key);
      if (
        previous === undefined ||
        candidate.score > previous.score ||
        (candidate.score === previous.score && candidate.goalId.localeCompare(previous.goalId) < 0)
      ) {
        best.set(key, candidate);
      }
    }
  };

  for (const goalState of rankGoals(runtime, playerId)) {
    const goal = findGoalNode(runtime, view, goalState.goalId);
    if (goal === undefined) continue;
    consider(generateActionCandidates(runtime, playerId, goal, view));
  }
  consider(generateActionCandidates(runtime, playerId, playerIntentGoal(runtime), view));

  return sortCandidates([...best.values()]).map((candidate) => {
    const action = runtime.index.actions.get(candidate.actionId);
    const option: PlayerActionOption = {
      actionId: candidate.actionId,
      name: action?.name ?? candidate.actionId,
      tags: [...(action?.tags ?? [])],
      targetIds: [...candidate.targetIds],
      targetLabels: candidate.targetIds.map((id) => entityLabel(runtime, id)),
      goalId: candidate.goalId,
      score: candidate.score,
      duration: candidate.duration,
      expectedGoalProgress: candidate.expectedGoalProgress,
      expectedCost: candidate.expectedCost,
      expectedRisk: candidate.expectedRisk,
      confidence: candidate.confidence,
    };
    if (candidate.approachFor !== undefined) option.approachFor = candidate.approachFor;
    return option;
  });
}

/**
 * §7.3 execute_player_action —
 *   요청 검증(지금도 가능한가) → 실패 시 사유 → 성공 시 **NPC 와 같은 경로**로 비용 지불·행동 예약.
 * 세계는 요청을 기다려 주지 않는다. 후보 목록을 본 뒤 시간이 흘렀다면 그 사이 조건이 무너졌을 수 있다.
 */
export function executePlayerAction(
  runtime: WorldRuntime,
  request: PlayerActionRequest,
): PlayerActionOutcome {
  const reject = (reason: string): PlayerActionOutcome => ({
    accepted: false,
    actionId: request.actionId,
    targetIds: [...request.targetIds],
    reason,
  });

  const playerId = findPlayerId(runtime);
  if (playerId === undefined) return reject("조작 중인 주체가 없다 — attach_player 가 먼저다");
  const action = runtime.index.actions.get(request.actionId);
  if (action === undefined) return reject(`이 세계에 없는 행동이다: ${request.actionId}`);

  const wanted = `${request.actionId}|${request.targetIds.join(",")}`;
  const option = playerActionOptions(runtime, playerId).find(
    (candidate) => `${candidate.actionId}|${candidate.targetIds.join(",")}` === wanted,
  );
  const player = runtime.agentRuntime(playerId) as PlayerRuntimeState;
  if (option === undefined) {
    const outcome = reject("지금은 할 수 없다 — 위치·능력·관계·지식 조건이 맞지 않는다");
    appendJournal(runtime, player, {
      kind: "action_rejected",
      key: request.actionId,
      subjectIds: request.targetIds,
      detail: outcome.reason ?? "",
    });
    return outcome;
  }

  const duration = resolveDuration(runtime, playerId, action, request.targetIds);
  if (duration === undefined) return reject("대상까지 갈 길이 없다 (§13 연결 없음)");

  const previous = player.currentAction;
  if (previous !== null) {
    // 하던 일을 접고 갈아탄다 — NPC 의 재판단(commit)과 같은 취소 경로다
    runtime.scheduler.cancel(previous.eventId);
    player.currentAction = null;
  }

  const planned: PlannedAction = { action, targetIds: [...request.targetIds], goalId: option.goalId };
  const scheduled = startAction(runtime, playerId, planned, duration);
  appendJournal(runtime, player, {
    kind: "action",
    key: action.id,
    subjectIds: request.targetIds,
    detail: `${option.goalId} · ${duration}분`,
  });

  const outcome: PlayerActionOutcome = {
    accepted: true,
    actionId: action.id,
    targetIds: [...request.targetIds],
    startedAt: scheduled.startedAt,
    completesAt: scheduled.completesAt,
  };
  if (previous !== null) outcome.replacedActionId = previous.actionId;
  return outcome;
}

// --- 지식 필터를 통과한 표시 데이터 (§7.2) ---------------------------------------------

function formatFact(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

/**
 * 이 개체에 대해 플레이어가 아는 사실만 모은다.
 * 값의 출처는 전부 BeliefView 다 — 자기 감각(self) / 믿음(belief) / 지금 보이는 것(sense).
 * "모름"은 아예 실리지 않는다. 여기가 §36.3 플레이어 모드의 경계다.
 */
function knownEntity(runtime: WorldRuntime, view: BeliefView, entityId: string): PlayerKnownEntity | undefined {
  const entity = runtime.store.findEntity(entityId);
  if (entity === undefined) return undefined;
  const ownerType = runtime.store.ownerTypeOf(entity);
  const facts: PlayerKnownFact[] = [];
  for (const schema of runtime.definition.stateSchemas) {
    if (schema.ownerType !== ownerType) continue;
    const perceived = view.perceive(entityId, schema.id);
    if (perceived.source === "unknown" || perceived.value === undefined) continue;
    facts.push({
      key: schema.id,
      value: formatFact(perceived.value),
      confidence: perceived.confidence,
      source: perceived.source,
    });
  }
  facts.sort((a, b) => a.key.localeCompare(b.key));

  const known: PlayerKnownEntity = {
    id: entity.id,
    kind: entity.type,
    label: entityLabel(runtime, entity.id),
    tags: [...entity.tags],
    facts,
  };
  // 위치는 감각이다 — 지금 감각이 닿거나(같은 지역·사거리 안) 지도 지식(장소·자원·조직)일 때만 실린다
  if (entity.position !== undefined && (entity.type !== "agent" || view.inSensoryRange(entityId) || entityId === view.agentId)) {
    known.position = { ...entity.position };
  }
  return known;
}

function eventBrief(runtime: WorldRuntime, playerId: string, event: WorldEvent): PlayerEventBrief | undefined {
  const opportunity = buildInterventionOpportunity(runtime, playerId, event.id);
  if (opportunity === undefined || !opportunity.discoveredByPlayer) return undefined;
  const eventView = getEventViewFor(runtime, playerId, event.id);
  return {
    eventId: event.id,
    type: event.type,
    title: event.title,
    knownParticipants: [...opportunity.knownParticipants],
    unknownParticipantCount: eventView.unknownParticipants.length,
    knownFacts: opportunity.knownFacts.map((fact) => ({ ...fact })),
    possibleInteractions: [...opportunity.possibleInteractions],
    timeSensitivity: opportunity.timeSensitivity,
  };
}

/** 화면으로 건너가는 유일한 데이터 (§31, §36.3) */
export function buildPlayerKnowledgeView(
  runtime: WorldRuntime,
  playerId: string,
): PlayerKnowledgeView {
  const player = playerStateOf(runtime, playerId);
  if (player === undefined) throw new Error(`사용자가 조작 중인 주체가 아니다: ${playerId}`);
  const view = new BeliefView(runtime, playerId);
  const self = knownEntity(runtime, view, playerId);
  if (self === undefined) throw new Error(`조작 중인 주체가 세계에 없다: ${playerId}`);

  const known: PlayerKnownEntity[] = [];
  for (const entityId of [...player.discoveredEntityIds].sort()) {
    if (entityId === playerId) continue;
    const entity = knownEntity(runtime, view, entityId);
    if (entity !== undefined) known.push(entity);
  }

  const events: PlayerEventBrief[] = [];
  let suppressedEventCount = 0;
  const ordered = [...runtime.state.events.events].sort((a, b) =>
    a.significance === b.significance ? a.id.localeCompare(b.id) : b.significance - a.significance,
  );
  for (const event of ordered) {
    const brief = eventBrief(runtime, playerId, event);
    if (brief === undefined) continue;
    // §29 저중요도 필터 (G-9) — 아는 사건이라도 임계 미만이면 브리핑에서 접는다. 참여한 사건은 예외.
    if (event.significance < SIGNIFICANCE_THRESHOLD && !event.participants.includes(playerId)) {
      suppressedEventCount += 1;
      continue;
    }
    events.push(brief);
  }

  const knowledge: PlayerKnowledgeView = {
    playerId,
    time: runtime.state.simulationTime,
    self,
    known,
    discoveredLocationIds: [...player.discoveredLocationIds].sort(),
    undiscoveredCount: Object.keys(runtime.state.entities).length - player.discoveredEntityIds.length,
    goals: rankGoals(runtime, playerId).map((goal) => ({
      id: goal.goalId,
      activation: Math.round(goal.activation),
    })),
    options: playerActionOptions(runtime, playerId),
    events,
    suppressedEventCount,
    journal: player.journal.map((entry) => ({ ...entry })),
    growthOffers: runtime.state.growthOffers
      .filter((offer) => offer.agentId === playerId)
      .map((offer) => ({ ...offer })),
    growthLog: runtime.state.growth.filter((change) => change.agentId === playerId).map((c) => ({ ...c })),
  };
  if (player.currentAction !== null) {
    knowledge.currentAction = {
      actionId: player.currentAction.actionId,
      targetIds: [...player.currentAction.targetIds],
      completesAt: player.currentAction.completesAt,
    };
  }
  return knowledge;
}
