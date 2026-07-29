// 사건 화면 빌더 (기획서 §36.4, §28~§30 / Phase-8 §8.1)
//
// §36.4 목록 8항목 그대로: 참여자 / 참여자별 목적 / 알려진 정보 / 실제 원인 /
// 시간순 상태 변화 / 플레이어 개입 기록 / 결과 / 후속 가능성.
//
// 이 화면의 핵심은 **"알려진 정보"와 "실제 원인"의 분리**다 —
// 앞은 `getEventViewFor(observer)` 의 산출이고 뒤는 원본 사건이다. 같은 사건의 두 판본을 나란히 놓는다(§30).
import { rankGoals } from "../core/agents/GoalSystem";
import { findPlayerId, playerStateOf } from "../core/agents/PlayerAgent";
import { getEventViewFor } from "../core/events/EventViews";
import { SIGNIFICANCE_THRESHOLD } from "../core/events/EventDetector";
import type { WorldRuntime } from "../core/world/WorldRuntime";
import type { WorldEvent } from "../shared/events";
import type { RawWorldChange } from "../shared/change";
import { tickToDay, tickToMinuteOfDay } from "../shared/time";
import { EventInterpreter } from "../presentation/EventInterpreter";
import { buildEventNarration } from "./NarrationBuilder";
import { dangerKey, symbolKeyOf } from "./MapViewBuilder";
import type { SceneViewContext } from "./MapViewBuilder";
import type {
  SceneBadge,
  SceneEventDetail,
  SceneEventListItem,
  SceneTimelineRow,
} from "./SceneViewModel";

/** 타임라인에 싣는 change 상한 — 사건이 오래 살아도 화면이 무한히 자라지 않는다 */
export const TIMELINE_LIMIT = 60;

function clockOf(tick: number): string {
  const minute = tickToMinuteOfDay(tick);
  return `${tickToDay(tick)}일 ${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function labelOf(runtime: WorldRuntime, entityId: string): string {
  return runtime.definition.bootstrap.entities.find((entry) => entry.id === entityId)?.name ?? entityId;
}

function formatValue(value: unknown): string {
  if (value === undefined) return "-";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

function eventOf(runtime: WorldRuntime, eventId: string): WorldEvent | undefined {
  return runtime.state.events.events.find((event) => event.id === eventId);
}

/** 이 사건의 재료가 된 change 들 — 사건은 change 로그의 해석이므로 원본을 되짚을 수 있다 */
function changesOf(runtime: WorldRuntime, event: WorldEvent): RawWorldChange[] {
  const wanted = new Set(event.changes);
  return runtime.state.changeLog.filter((change) => wanted.has(change.id)).sort((a, b) => a.id - b.id);
}

// --- 목록 (§36.4 진입점) ---------------------------------------------------------------

export interface SceneEventList {
  items: SceneEventListItem[];
  /** §29 저중요도 필터 (G-9) — 플레이어 시점에서 중요도 미달로 접힌 사건 수. 개발자 시점은 항상 0 */
  suppressed: number;
}

/**
 * 사건 목록.
 * 플레이어 모드에서는 **아는 사건만** 실린다 — 모르는 사건은 목록에 존재하지 않는다(§30).
 * §29 "모든 상태 변화를 플레이어에게 보여줄 필요는 없다" — 아는 사건이라도 중요도가 임계(200) 미만이면
 * 목록에서 접는다(G-9). 자기가 참여한 사건은 예외다 — 내 일은 사소해도 내 화면에 남는다.
 * 접힌 수는 suppressed 로 남아 화면이 "숨겼다"는 사실 자체는 감추지 않는다.
 */
export function buildEventList(
  runtime: WorldRuntime,
  context: SceneViewContext,
  interpreter: EventInterpreter = new EventInterpreter(),
): SceneEventList {
  const observerId =
    context.mode === "player" ? (context.observerId ?? findPlayerId(runtime)) : undefined;
  // 플레이어 시점에 관찰자가 없으면 아는 사건도 없다 (지도와 같은 규약)
  if (context.mode === "player" && (observerId === undefined || playerStateOf(runtime, observerId) === undefined)) {
    return { items: [], suppressed: 0 };
  }
  const now = runtime.state.simulationTime;
  const items: SceneEventListItem[] = [];
  let suppressed = 0;

  for (const event of [...runtime.state.events.events].sort((a, b) =>
    a.significance === b.significance ? a.id.localeCompare(b.id) : b.significance - a.significance,
  )) {
    const known = observerId === undefined ? true : getEventViewFor(runtime, observerId, event.id).known;
    if (observerId !== undefined && !known) continue;
    if (
      observerId !== undefined &&
      event.significance < SIGNIFICANCE_THRESHOLD &&
      !event.participants.includes(observerId)
    ) {
      suppressed += 1;
      continue;
    }
    const pattern = runtime.definition.eventPatterns.find((entry) => entry.id === event.patternId);
    const window = pattern?.timeWindow ?? 1;
    const urgency =
      event.status === "concluded" ? 0 : Math.max(0, 1 - (now - event.lastChangeAt) / (window * 2));
    // 제목은 Interpreter 가 만든다 — 구조화 title 은 기계 키이고 화면에는 문장이 오른다(§33.3)
    const title = interpreter.interpret(
      buildEventNarration(runtime, observerId ?? event.participants[0] ?? "", event, "event_title"),
    ).text;
    items.push({
      eventId: event.id,
      type: event.type,
      title,
      status: event.status,
      startedAt: clockOf(event.startedAt),
      significance: Math.round(event.significance),
      participantCount: event.participants.length,
      known,
      ...(event.locationId === undefined ? {} : { regionId: event.locationId }),
      urgency: Number(urgency.toFixed(2)),
      colorKey: event.status === "concluded" ? "event-closed" : dangerKey(Math.min(100, event.significance / 5)),
    });
  }
  return { items, suppressed };
}

// --- 상세 (§36.4 8항목) ----------------------------------------------------------------

export function buildEventDetail(
  runtime: WorldRuntime,
  eventId: string,
  context: SceneViewContext,
  interpreter: EventInterpreter = new EventInterpreter(),
): SceneEventDetail | undefined {
  const event = eventOf(runtime, eventId);
  if (event === undefined) return undefined;

  const observerId =
    context.mode === "player" ? (context.observerId ?? findPlayerId(runtime)) : undefined;
  if (context.mode === "player" && (observerId === undefined || playerStateOf(runtime, observerId) === undefined)) {
    return undefined;
  }
  const narrationObserver = observerId ?? event.participants[0] ?? "";
  const view = getEventViewFor(runtime, narrationObserver, event.id);
  // 플레이어 모드에서 모르는 사건은 열 수도 없다
  if (observerId !== undefined && !view.known) return undefined;

  const known = new Set(view.knownParticipants);
  const changes = changesOf(runtime, event);

  // ⑥ 플레이어 개입 기록 — 저널과 사건을 교차한다 (§36.4)
  const playerId = findPlayerId(runtime);
  const player = playerId === undefined ? undefined : playerStateOf(runtime, playerId);
  const participantSet = new Set(event.participants);
  const interventions = (player?.journal ?? [])
    .filter(
      (entry) =>
        (entry.kind === "action" || entry.kind === "action_rejected" || entry.kind === "growth") &&
        entry.at >= event.startedAt &&
        entry.at <= (event.concludedAt ?? runtime.state.simulationTime) &&
        (entry.subjectIds.some((id) => participantSet.has(id)) || entry.subjectIds.length === 0),
    )
    .map((entry) => ({ at: clockOf(entry.at), kind: entry.kind, detail: `${entry.key} ${entry.detail}` }));

  const playerActions = new Set(
    (player?.journal ?? []).filter((entry) => entry.kind === "action").map((entry) => `${entry.at}|${entry.key}`),
  );

  // ⑤ 시간순 상태 변화
  const timeline: SceneTimelineRow[] = changes.slice(-TIMELINE_LIMIT).map((change) => ({
    at: clockOf(change.time),
    tick: change.time,
    label:
      (change.sourceId === undefined ? "" : `${labelOf(runtime, change.sourceId)} `) +
      (change.tags[1] ?? change.tags[0] ?? "변화"),
    tags: [...change.tags],
    states: change.changedStates.map(
      (state) => `${labelOf(runtime, state.entityId)}.${state.stateKey} ${formatValue(state.before)}→${formatValue(state.after)}`,
    ),
    byPlayer:
      change.sourceId !== undefined &&
      change.sourceId === playerId &&
      change.tags.some((tag) => playerActions.has(`${change.time}|${tag}`)),
  }));

  // ④ 실제 원인 — 사건을 열게 한 첫 변화들. 플레이어 모드에서는 실리지 않는다(§30 "아직 모르는 것")
  const causeVisible = observerId === undefined;
  const actualCauses = causeVisible
    ? changes.slice(0, 3).flatMap((change) =>
        change.changedStates.map(
          (state) =>
            `${clockOf(change.time)} ${labelOf(runtime, state.entityId)}.${state.stateKey} ` +
            `${formatValue(state.before)}→${formatValue(state.after)}` +
            (change.sourceId === undefined ? "" : ` ← ${labelOf(runtime, change.sourceId)} ${change.tags[1] ?? ""}`),
        ),
      )
    : [];

  const significanceRows: SceneBadge[] = Object.entries(event.significanceBreakdown).map(([key, value]) => ({
    key,
    value: typeof value === "number" ? value.toFixed(1) : String(value),
  }));

  const detail: SceneEventDetail = {
    eventId: event.id,
    type: event.type,
    title: interpreter.interpret(
      buildEventNarration(runtime, narrationObserver, event, "event_title"),
    ).text,
    summarySentence: interpreter.interpret(
      buildEventNarration(runtime, narrationObserver, event, "event_summary"),
    ).text,
    modeKey: context.mode,
    status: event.status,
    startedAt: clockOf(event.startedAt),
    ...(event.concludedAt === undefined ? {} : { concludedAt: clockOf(event.concludedAt) }),
    significance: Math.round(event.significance),
    significanceRows,
    participants: event.participants.map((participantId) => {
      const entity = runtime.store.findEntity(participantId);
      const speciesId = entity?.states["species_id"];
      const isKnown = observerId === undefined || known.has(participantId);
      return {
        id: isKnown ? participantId : "(모르는 참여자)",
        label: isKnown ? labelOf(runtime, participantId) : "정체를 모른다",
        symbolKey:
          entity === undefined || !isKnown
            ? "symbol-unknown"
            : symbolKeyOf(entity, typeof speciesId === "string" ? speciesId : undefined),
        known: isKnown,
        // ② 참여자별 목적 — 남의 목적은 개발자 모드에서만 보인다(믿음으로 읽히는 것이 아니다)
        goals:
          isKnown && observerId === undefined && runtime.state.agentRuntimes[participantId] !== undefined
            ? rankGoals(runtime, participantId)
                .slice(0, 3)
                .map((goal) => ({ id: goal.goalId, activation: Math.round(goal.activation) }))
            : [],
      };
    }),
    knownFacts: view.knownFacts.map(
      (fact) =>
        `${labelOf(runtime, fact.subjectId)}.${fact.stateKey} = ${formatValue(fact.believedValue)} (확신 ${fact.confidence.toFixed(2)})`,
    ),
    knownParticipantCount: view.knownParticipants.length,
    unknownParticipantCount: view.unknownParticipants.length,
    actualCauses,
    causeVisible,
    timeline,
    interventions,
    // ⑦ 결과 — 사건 요약의 순변화 그대로 (§44-9)
    results: (event.summary?.affectedStateSummaries ?? [])
      .filter((entry) => entry.delta === undefined || entry.delta !== 0)
      .map((entry) => ({
        entityId: entry.entityId,
        stateKey: entry.stateKey,
        before: formatValue(entry.before),
        after: formatValue(entry.after),
        delta: entry.delta === undefined ? "-" : `${entry.delta > 0 ? "+" : ""}${entry.delta.toFixed(1)}`,
      })),
    // ⑧ 후속 가능성 — 사건 뒤에 새로 활성화된 목적 (§44-10)
    followUps: (event.summary?.newlyActivatedGoals ?? []).map((goal) => ({
      agentId: goal.agentId,
      goalId: goal.goalId,
      label: `${labelOf(runtime, goal.agentId)} → ${goal.goalId}`,
    })),
    goalConflicts: (event.summary?.goalConflicts ?? []).map(
      (conflict) =>
        `${labelOf(runtime, conflict.entityId)}.${conflict.stateKey}: ` +
        `${labelOf(runtime, conflict.left.agentId)}(${conflict.left.goalId} ${conflict.left.demand}) ↕ ` +
        `${labelOf(runtime, conflict.right.agentId)}(${conflict.right.goalId} ${conflict.right.demand})`,
    ),
    rumor: interpreter.interpret(buildEventNarration(runtime, narrationObserver, event, "rumor")).text,
    document: interpreter.interpret(buildEventNarration(runtime, narrationObserver, event, "document")).text,
    dialogue: [],
    narrationSourceKey: "template",
  };

  // 대화 (§33.3) — 아는 참여자가 관찰자에게 건네는 한 마디. unknownFacts 는 말하지 않는다(§8.2)
  for (const speakerId of view.knownParticipants.slice(0, 3)) {
    if (speakerId === narrationObserver) continue;
    if (runtime.state.agentRuntimes[speakerId]?.kind !== "individual") continue;
    const request = buildEventNarration(runtime, narrationObserver, event, "dialogue", { speakerId });
    const result = interpreter.interpret(request);
    detail.dialogue.push({ speakerId, label: labelOf(runtime, speakerId), line: result.text });
    if (result.source === "generated") detail.narrationSourceKey = "generated";
  }
  return detail;
}
