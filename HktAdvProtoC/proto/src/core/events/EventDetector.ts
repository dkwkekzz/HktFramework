// 사건 탐지 — 패턴 매칭·생성·병합·수명 (기획서 §28, §29 / Phase-4 §4.2·§4.3)
//
// 규약 세 가지.
//  ① 사건은 세계를 바꾸지 않는다. change 로그를 읽고 사건 목록만 쓴다 — 사건이 다시 사건을 낳는 되먹임이 없다.
//  ② 탐지는 매 tick 이 아니라 주기(기본 반 일)로 돈다. 같은 시각에는 항상 같은 결과가 나온다(§39).
//  ③ 진행 중인 사건은 새 change 를 계속 흡수해 자란다(§28 status: "ongoing"). 조용해지면 스스로 종결한다.
import type { RawWorldChange } from "../../shared/change";
import {
  MAX_EVENT_CHANGES,
  MAX_EVENTS,
  type SignificanceBreakdown,
  type WorldEvent,
} from "../../shared/events";
import { distance3d } from "../../shared/state";
import { TICKS_PER_DAY } from "../../shared/time";
import { CROSS_REGION_DISTANCE } from "../world/Conditions";
import type { EventPattern } from "../world/types";
import type { WorldRuntime } from "../world/WorldRuntime";
import { ChangeCollector } from "./ChangeCollector";
import { absorbIntoSummary } from "./EventSummarizer";

/** 탐지 주기 — 반 일 (§28 "일정 시간 동안 발생한 관련 상태 변화") */
export const DETECTION_INTERVAL = TICKS_PER_DAY / 2;
/** change 보관 기간 — 가장 긴 timeWindow 의 3배를 넘겨 잡는다 */
export const CHANGE_RETENTION_FACTOR = 3;
/**
 * 기본 뷰에 올릴 중요도 하한 (§29 "모든 상태 변화를 플레이어에게 보여줄 필요는 없다").
 * 미만 사건도 저장은 된다 — 숨길 뿐이다.
 */
export const SIGNIFICANCE_THRESHOLD = 200;

// --- 참여자·위치 ------------------------------------------------------------------

function readString(runtime: WorldRuntime, entityId: string, key: string): string | undefined {
  const entity = runtime.store.findEntity(entityId);
  if (entity === undefined) return undefined;
  if (runtime.schemas.find(runtime.store.ownerTypeOf(entity), key) === undefined) return undefined;
  const value = runtime.store.read(entityId, key);
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * §28 participants — change 의 sourceId∪targetIds 를 **상위 주체·조직·종족**으로 올린다.
 * (원인·대상이 비어 있는 규칙 변화는 변한 개체를 대신 쓴다 — 조직의 비축이 줄어든 것도 그 조직의 일이다.)
 */
export function participantsOf(runtime: WorldRuntime, changes: RawWorldChange[]): string[] {
  const participants = new Set<string>();
  const add = (entityId: string | undefined): void => {
    if (entityId === undefined) return;
    const entity = runtime.store.findEntity(entityId);
    if (entity === undefined) return;
    if (entity.type !== "agent" && entity.type !== "faction") return;
    participants.add(entity.id);
    const factionId = readString(runtime, entityId, "faction_id");
    if (factionId !== undefined) participants.add(factionId);
    const speciesId = readString(runtime, entityId, "species_id");
    if (speciesId !== undefined) participants.add(speciesId);
  };
  for (const change of changes) {
    const direct = [change.sourceId, ...change.targetIds];
    if (direct.every((id) => id === undefined)) {
      for (const state of change.changedStates) add(state.entityId);
      continue;
    }
    for (const id of direct) add(id);
  }
  return [...participants].sort();
}

/** change 가 일어난 자리 — 명시된 위치가 없으면 원인·대상의 지역으로 본다 (§13) */
export function locationOf(runtime: WorldRuntime, change: RawWorldChange): string | undefined {
  if (change.locationId !== undefined) return change.locationId;
  const candidates = [change.sourceId, ...change.targetIds, ...change.changedStates.map((s) => s.entityId)];
  for (const id of candidates) {
    if (id === undefined) continue;
    const position = runtime.store.findEntity(id)?.position;
    if (position !== undefined) return position.regionId;
  }
  return undefined;
}

/** 두 자리 사이의 거리 — 위치를 모르면 "먼 곳"으로 본다 (§13 지역 간은 연결 그래프) */
export function locationDistance(
  runtime: WorldRuntime,
  from: string | undefined,
  to: string | undefined,
): number {
  if (from === to) return 0;
  if (from === undefined || to === undefined) return CROSS_REGION_DISTANCE;
  const a = runtime.store.findEntity(from)?.position;
  const b = runtime.store.findEntity(to)?.position;
  if (a === undefined || b === undefined) return CROSS_REGION_DISTANCE;
  return distance3d(a, b);
}

// --- §29 중요도 -------------------------------------------------------------------

/**
 * 영향 상태 하나가 속한 "시스템" — §29 countAffectedSystems.
 * 개체 상태는 그 개체의 §9 ownerType(agent/faction/region/resource…)이,
 * 개체 상태가 아닌 것(믿음·관계·목적)은 그 종류 자체가 하나의 시스템이다.
 */
function systemOf(runtime: WorldRuntime, entityId: string, stateKey: string): string {
  const marker = stateKey.indexOf(":");
  if (marker >= 0) return stateKey.slice(0, marker);
  const entity = runtime.store.findEntity(entityId);
  if (entity === undefined) return "unknown";
  return runtime.store.ownerTypeOf(entity);
}

/**
 * §29 calculateEventSignificance — 6항과 계수를 그대로 쓴다.
 * 원본 change 는 보관 기간이 지나면 사라지므로, 누적된 요약(summary)에서 계산한다.
 */
export function calculateEventSignificance(
  runtime: WorldRuntime,
  event: WorldEvent,
): SignificanceBreakdown {
  // 집계는 누적 요약에서 한다 — `entityId.stateKey` 문자열을 되쪼개지 않는다(개체 id 에도 점이 있다)
  const summaries = event.summary?.affectedStateSummaries ?? [];
  const systems = new Set(summaries.map((entry) => systemOf(runtime, entry.entityId, entry.stateKey)));

  let magnitude = 0;
  let relationshipImpact = 0;
  for (const state of summaries) {
    const delta = Math.abs(state.delta ?? 0);
    if (state.stateKey.startsWith("relationship:")) relationshipImpact += delta;
    else magnitude += delta;
  }

  // 미래 잠재력 — 참여자들의 활성 목적 중 이 사건이 건드린 상태를 달성 조건으로 삼는 목적 수
  const affectedKeys = new Set(summaries.map((entry) => entry.stateKey));
  let futurePotential = 0;
  for (const participantId of event.participants) {
    const agent = runtime.state.agentRuntimes[participantId];
    if (agent === undefined) continue;
    const entity = runtime.store.findEntity(participantId);
    if (entity === undefined) continue;
    for (const goal of entity.activeGoals ?? []) {
      const node = findGoalNodeById(runtime, goal.goalId);
      if (node === undefined) continue;
      const touched = node.targetConditions.some((condition) => {
        for (const ref of [condition.left, condition.right]) {
          if (ref.kind === "state" && affectedKeys.has(ref.key)) return true;
          if (ref.kind === "entity_state" && affectedKeys.has(ref.key)) return true;
        }
        return false;
      });
      if (touched) futurePotential += 1;
    }
  }

  return {
    participants: event.participants.length * 8,
    affectedSystems: systems.size * 12,
    magnitude: magnitude * 0.5,
    relationshipImpact: relationshipImpact * 0.7,
    // 플레이어는 Phase 7 에서 등장한다 — 그전까지 이 항은 0 이다(§29 calculatePlayerRelevance)
    playerRelevance: 0,
    futurePotential,
  };
}

function findGoalNodeById(runtime: WorldRuntime, goalId: string) {
  for (const graph of runtime.definition.goalTemplates) {
    const node = graph.nodes.find((candidate) => candidate.id === goalId);
    if (node !== undefined) return node;
  }
  return undefined;
}

export function sumSignificance(breakdown: SignificanceBreakdown): number {
  return (
    breakdown.participants +
    breakdown.affectedSystems +
    breakdown.magnitude +
    breakdown.relationshipImpact +
    breakdown.playerRelevance +
    breakdown.futurePotential
  );
}

export function refreshSignificance(runtime: WorldRuntime, event: WorldEvent): void {
  event.significanceBreakdown = calculateEventSignificance(runtime, event);
  event.significance = sumSignificance(event.significanceBreakdown);
}

// --- 클러스터링 --------------------------------------------------------------------

/** 사건 시작 시점의 참여자 활성 목적 — §44-10 "새 목적이 생겼는가"의 기준선 */
function snapshotGoals(runtime: WorldRuntime, participants: string[]): { agentId: string; goalId: string }[] {
  const goals: { agentId: string; goalId: string }[] = [];
  for (const participantId of participants) {
    const entity = runtime.store.findEntity(participantId);
    for (const goal of entity?.activeGoals ?? []) goals.push({ agentId: participantId, goalId: goal.goalId });
  }
  return goals;
}

function absorbChanges(runtime: WorldRuntime, event: WorldEvent, cluster: RawWorldChange[]): void {
  for (const change of cluster) {
    if (!event.changes.includes(change.id)) event.changes.push(change.id);
    if (change.time > event.lastChangeAt) event.lastChangeAt = change.time;
  }
  if (event.changes.length > MAX_EVENT_CHANGES) {
    event.changes = event.changes.slice(event.changes.length - MAX_EVENT_CHANGES);
  }
  for (const participant of participantsOf(runtime, cluster)) {
    if (!event.participants.includes(participant)) event.participants.push(participant);
  }
  event.participants.sort();
  absorbIntoSummary(runtime, event, cluster);
  // 중요도는 병합할 때마다 다시 계산한다 (§29 / Phase-4 §4.3)
  refreshSignificance(runtime, event);
}

function createEvent(
  runtime: WorldRuntime,
  pattern: EventPattern,
  cluster: RawWorldChange[],
): WorldEvent {
  const store = runtime.state.events;
  const seed = cluster[0]!;
  const locationId = locationOf(runtime, seed);
  const participants = participantsOf(runtime, cluster);
  const event: WorldEvent = {
    id: `event.${store.eventSeq++}`,
    patternId: pattern.id,
    type: pattern.type,
    // 구조화 키 — 문장은 Phase 8 Event Interpreter 가 만든다
    title: `${pattern.type}@${locationId ?? "world"}#${seed.time}`,
    participants: [],
    affectedStates: [],
    changes: [],
    status: "ongoing",
    startedAt: seed.time,
    lastChangeAt: seed.time,
    ...(locationId !== undefined ? { locationId } : {}),
    significance: 0,
    significanceBreakdown: {
      participants: 0,
      affectedSystems: 0,
      magnitude: 0,
      relationshipImpact: 0,
      playerRelevance: 0,
      futurePotential: 0,
    },
    baselineGoals: snapshotGoals(runtime, participants),
  };
  store.events.push(event);
  absorbChanges(runtime, event, cluster);
  return event;
}

/** 이미 진행 중인 같은 성격의 사건인가 — 참여자가 겹치거나 같은 자리에서 이어지는가 (§28 병합) */
function findMergeTarget(
  runtime: WorldRuntime,
  pattern: EventPattern,
  cluster: RawWorldChange[],
  participants: string[],
): WorldEvent | undefined {
  const seed = cluster[0]!;
  const locationId = locationOf(runtime, seed);
  for (const event of runtime.state.events.events) {
    if (event.status !== "ongoing") continue;
    if (event.patternId !== pattern.id) continue;
    if (seed.time - event.lastChangeAt > pattern.timeWindow) continue;
    const sharesParticipant = participants.some((id) => event.participants.includes(id));
    const sameLocation = locationDistance(runtime, event.locationId, locationId) <= pattern.locationRadius;
    if (sharesParticipant || sameLocation) return event;
  }
  return undefined;
}

/**
 * 패턴 하나로 최근 change 를 묶는다.
 * 시간순으로 씨앗을 잡고, timeWindow·locationRadius 안의 같은 패턴 change 를 흡수하는 그리디 방식이다.
 */
function detectForPattern(
  runtime: WorldRuntime,
  collector: ChangeCollector,
  pattern: EventPattern,
  assigned: Set<number>,
): void {
  const now = runtime.state.simulationTime;
  // 씨앗 후보는 "지난 탐지 이후 + 한 창"까지 본다 — 탐지 주기가 창보다 길어도 놓치는 변화가 없게.
  const since = now - pattern.timeWindow - DETECTION_INTERVAL;
  const candidates = collector
    .matching(pattern.requiredTags, since)
    .filter((change) => !assigned.has(change.id));
  if (candidates.length === 0) return;

  // §28 optionalTags — 필수 태그를 갖지 않아도 같은 창·같은 자리에서 벌어진 곁가지 변화는 사건에 딸려 온다.
  // (습격 그 자체는 threat+creature 지만, 뒤따르는 마을의 식량 감소·연구자의 조사는 그렇지 않다.)
  const supporting =
    pattern.optionalTags.length === 0
      ? []
      : collector.all().filter((change) => change.tags.some((tag) => pattern.optionalTags.includes(tag)));

  const consumed = new Set<number>();
  for (const seed of candidates) {
    if (consumed.has(seed.id)) continue;
    const seedLocation = locationOf(runtime, seed);
    const inCluster = (change: RawWorldChange): boolean =>
      !consumed.has(change.id) &&
      change.time >= seed.time &&
      change.time <= seed.time + pattern.timeWindow &&
      locationDistance(runtime, seedLocation, locationOf(runtime, change)) <= pattern.locationRadius;

    const core = candidates.filter(inCluster);
    // 참여자 수는 **필수 태그를 가진 변화**로만 센다 — 곁가지가 사건 성립을 대신 결정하지 않게.
    const participants = participantsOf(runtime, core);
    if (participants.length < pattern.minimumParticipants) {
      // 아직 사건이 아니다 — 씨앗만 넘기고 나머지는 다음 통과에서 더 모일 수 있게 남겨 둔다
      consumed.add(seed.id);
      continue;
    }
    const cluster = [...core, ...supporting.filter((change) => !assigned.has(change.id) && inCluster(change))].sort(
      (a, b) => a.id - b.id,
    );
    for (const change of cluster) {
      consumed.add(change.id);
      assigned.add(change.id);
    }
    const target = findMergeTarget(runtime, pattern, cluster, participants);
    if (target === undefined) createEvent(runtime, pattern, cluster);
    else absorbChanges(runtime, target, cluster);
  }
}

/** 조용해진 사건을 닫는다 — timeWindow 의 2배 동안 새 change 가 없으면 종결 (Phase-4 §4.2) */
function concludeStaleEvents(runtime: WorldRuntime): void {
  const now = runtime.state.simulationTime;
  const patterns = new Map(runtime.definition.eventPatterns.map((pattern) => [pattern.id, pattern]));
  for (const event of runtime.state.events.events) {
    if (event.status !== "ongoing") continue;
    const pattern = patterns.get(event.patternId);
    if (pattern === undefined) continue;
    if (now - event.lastChangeAt <= pattern.timeWindow * 2) continue;
    event.status = "concluded";
    event.concludedAt = now;
    refreshSignificance(runtime, event);
  }
}

/** 보관 상한 — 넘치면 종결된 사건 중 오래된 것부터 버린다 */
function pruneEvents(runtime: WorldRuntime): void {
  const store = runtime.state.events;
  if (store.events.length <= MAX_EVENTS) return;
  const excess = store.events.length - MAX_EVENTS;
  const dropped = new Set<string>();
  for (const event of store.events) {
    if (dropped.size >= excess) break;
    if (event.status === "concluded") dropped.add(event.id);
  }
  store.events = store.events.filter((event) => !dropped.has(event.id));
}

/**
 * §26 ⑥ detectEmergentEvents.
 * 탐지 주기가 되지 않았으면 아무 일도 하지 않는다 — 호출 빈도가 결과를 바꾸지 않게 하는 장치다.
 */
export function detectEmergentEvents(runtime: WorldRuntime, collector: ChangeCollector): boolean {
  const store = runtime.state.events;
  const now = runtime.state.simulationTime;
  if (store.lastDetectionAt >= 0 && now - store.lastDetectionAt < DETECTION_INTERVAL) return false;

  collector.collect(runtime);

  // 이미 어떤 사건에 속한 change 는 같은 패턴에서 다시 쓰이지 않는다.
  // (패턴이 다르면 같은 change 가 다른 관점의 사건에 함께 속할 수 있다 — 하나의 습격은 생태 충돌이자 소집의 계기다.)
  for (const pattern of runtime.definition.eventPatterns) {
    const assigned = new Set(
      runtime.state.events.events
        .filter((event) => event.patternId === pattern.id)
        .flatMap((event) => event.changes),
    );
    detectForPattern(runtime, collector, pattern, assigned);
  }

  // 종결 판정은 흡수 뒤에 한다 — 방금 들어온 변화를 못 본 채로 "조용해졌다"고 닫지 않기 위해서다
  concludeStaleEvents(runtime);
  pruneEvents(runtime);
  store.lastDetectionAt = now;
  return true;
}

/** 세계 정의에 선언된 패턴 중 가장 긴 timeWindow 로 보관 기간을 정한다 */
export function createChangeCollector(runtime: WorldRuntime): ChangeCollector {
  const longest = runtime.definition.eventPatterns.reduce(
    (max, pattern) => Math.max(max, pattern.timeWindow),
    DETECTION_INTERVAL,
  );
  return new ChangeCollector(longest * CHANGE_RETENTION_FACTOR);
}
