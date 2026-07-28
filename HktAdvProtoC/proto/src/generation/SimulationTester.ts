// 자동 시뮬레이션 테스트 (기획서 §35 / Phase-6 §6.2)
//
// "생성된 세계는 플레이어에게 공개하기 전에 자동으로 실행한다"(§35).
// 플레이어 없이 30일을 돌리고, §35 의 최소 테스트 8항목을 판정하고, 다양성·깊이 점수를 낸다.
//
// 판정은 전부 **실행에서 나온 수치**다. 이 모듈은 세계를 고치지 않는다 — 고치는 것은 RepairLoop 의 몫이다.
import { compareObservers } from "../core/events/phase4Checks";
import { InlineHost } from "../core/simulation/InlineHost";
import type { WorldRuntime } from "../core/world/WorldRuntime";
import type { WorldDefinition } from "../core/world/types";
import { hashValue } from "../shared/hash";
import { TICKS_PER_DAY, tickToDay } from "../shared/time";
import type { ValidationIssue } from "./CompilerPipeline";

/** §35 최소 테스트 8항목의 고정 코드 — 수정 루프(§42-6)가 이 코드로 재생성 단계를 찾는다 */
export const SIMULATION_CODES = [
  "sim.run",
  "sim.all-agents-act",
  "sim.dominant-action",
  "sim.resource-collapse",
  "sim.resource-explosion",
  "sim.faction-collapse",
  "sim.event-variety",
  "sim.no-stagnation",
] as const;

export type SimulationCode = (typeof SIMULATION_CODES)[number];

/** §35 "한 행동이 전체 행동의 70% 이상을 차지하는지 확인한다" — 기획서가 준 유일한 상수 */
export const DOMINANCE_LIMIT = 0.7;

export interface TestVerdict {
  code: string;
  title: string;
  ok: boolean;
  evidence: string;
}

/** 하루 끝의 표본 — 추세(자원 증감·정체)는 이 표본열로 판정한다 */
export interface DailySample {
  day: number;
  /** 그날 발급된 change 수 (로그 상한과 무관하게 발급 순번으로 센다) */
  changes: number;
  /** 자원 id → 세계 총 재고 */
  resourceStocks: Record<string, number>;
  events: number;
}

export interface SimulationMetrics {
  /** §35 다양성 공식의 입력 */
  uniqueActionTypes: number;
  uniqueEventTypes: number;
  uniqueParticipantCombinations: number;
  changedStateCategories: number;
  /** §35 깊이 공식의 입력 */
  averageGoalsPerEvent: number;
  averageAffectedSystemsPerEvent: number;
  informationAsymmetryRate: number;
  consequenceDurationScore: number;
  /** 정체 판정의 입력 */
  changesPerDay: number;
  quietDays: number;
  /** 자원 추세 — 처음/끝/상한 */
  resourceTrends: { resourceId: string; first: number; last: number; capacity: number; nodes: number }[];
  /** 재고를 셀 노드가 없는 자원 (판정 대상 밖) */
  unmeasuredResources: string[];
}

/** §35 SimulationTestResult — 기획서 필드 그대로 + 판정·점수·재현성 해시 */
export interface SimulationTestResult {
  worldId: string;
  worldSeed: number;
  /** 실행한 날 수 (§35 는 30일) */
  duration: number;
  totalActions: number;
  totalEvents: number;
  activeAgents: number;
  deadlockedAgents: string[];
  dominantActionRatios: Record<string, number>;
  resourceCollapse: string[];
  factionCollapse: string[];
  warnings: ValidationIssue[];
  /** §35 다양성 점수 */
  diversityScore: number;
  /** §35 깊이 점수 */
  depthScore: number;
  metrics: SimulationMetrics;
  verdicts: TestVerdict[];
  samples: DailySample[];
  logHash: string;
  eventHash: string;
  /** 판정 전체의 해시 — 같은 입력이면 같아야 한다(§44-12) */
  resultHash: string;
  ok: boolean;
}

export interface SimulationTestOptions {
  /** 없으면 수동 세계(Phase 1)로 돈다 */
  definition?: WorldDefinition;
  worldSeed: number;
  days?: number;
}

// --- 실행 --------------------------------------------------------------------------

function lastChangeId(runtime: WorldRuntime): number {
  const log = runtime.state.changeLog;
  return log.length === 0 ? 0 : log[log.length - 1]!.id;
}

/** 자원 id → 세계 총 재고. 재고는 자원 노드(type="resource")의 amount 합이다 */
function resourceStocks(runtime: WorldRuntime): Map<string, { total: number; nodes: number; capacity: number }> {
  const stocks = new Map<string, { total: number; nodes: number; capacity: number }>();
  const schema = runtime.schemas.find("resource", "amount");
  const cap = schema?.max ?? 0;
  for (const id of Object.keys(runtime.state.entities).sort()) {
    const entity = runtime.state.entities[id]!;
    if (entity.type !== "resource") continue;
    const resourceId = String(entity.states["resource_id"] ?? "");
    if (resourceId === "") continue;
    const amount = Number(entity.states["amount"] ?? 0);
    const entry = stocks.get(resourceId) ?? { total: 0, nodes: 0, capacity: 0 };
    entry.total += amount;
    entry.nodes += 1;
    entry.capacity += cap;
    stocks.set(resourceId, entry);
  }
  return stocks;
}

/**
 * 누적 집계기.
 * change 로그는 상한(MAX_CHANGE_LOG)에서 오래된 것부터 잘린다 — 30일치를 끝에서 한 번에 세면
 * 큰 세계일수록 **마지막 며칠만** 세게 된다. 그래서 하루마다 새 change 만 훑어 누적한다.
 */
interface Accumulator {
  actionMix: Map<string, number>;
  stateCategories: Set<string>;
  lastSeenId: number;
}

function accumulate(runtime: WorldRuntime, acc: Accumulator): void {
  for (const change of runtime.state.changeLog) {
    if (change.id <= acc.lastSeenId) continue;
    acc.lastSeenId = change.id;
    for (const state of change.changedStates) {
      acc.stateCategories.add(`${stateCategory(runtime, state.entityId, state.stateKey)}.${state.stateKey}`);
    }
    if (!change.tags.includes("action")) continue;
    const actionId = change.tags.find((tag) => tag.startsWith("action."));
    if (actionId === undefined) continue;
    acc.actionMix.set(actionId, (acc.actionMix.get(actionId) ?? 0) + 1);
  }
}

/** 상태 키의 갈래 — §35 changedStateCategories 와 깊이의 "영향 시스템" 을 같은 잣대로 센다 */
function stateCategory(runtime: WorldRuntime, entityId: string, stateKey: string): string {
  if (stateKey.startsWith("relationship:")) return "relationship";
  if (stateKey.startsWith("belief:")) return "belief";
  if (stateKey.startsWith("goal_unlocked:")) return "goal";
  const entity = runtime.store.findEntity(entityId);
  return entity === undefined ? "world" : entity.type;
}

// --- §35 판정 ----------------------------------------------------------------------

function verdict(code: SimulationCode, title: string, ok: boolean, evidence: string): TestVerdict {
  return { code, title, ok, evidence };
}

/**
 * 무개입 자동 실행 (§35).
 * 하루씩 나눠 진행하며 표본을 남긴다 — 이벤트 시각으로 점프하는 루프(§26)라 30×1일과 1×30일은 같은 세계다.
 * (그 동일성은 verify 의 Phase 6 재현성 항목이 로그 해시로 확인한다.)
 */
export async function runSimulationTest(options: SimulationTestOptions): Promise<SimulationTestResult> {
  const days = options.days ?? 30;
  const host = new InlineHost();
  const initResponses = await host.request({
    type: "initialize_world",
    worldSeed: options.worldSeed,
    ...(options.definition === undefined ? {} : { definition: options.definition }),
  });
  const initError = initResponses.find((response) => response.type === "error");
  if (initError !== undefined && initError.type === "error") {
    throw new Error(`세계를 올릴 수 없다 — ${initError.message.split("\n")[0]}`);
  }
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");

  const samples: DailySample[] = [];
  const acc: Accumulator = { actionMix: new Map(), stateCategories: new Set(), lastSeenId: 0 };
  accumulate(runtime, acc);
  let previousId = lastChangeId(runtime);
  for (let day = 1; day <= days; day++) {
    await host.request({ type: "advance_time", amount: TICKS_PER_DAY });
    accumulate(runtime, acc);
    const currentId = lastChangeId(runtime);
    const stocks = resourceStocks(runtime);
    samples.push({
      day,
      changes: currentId - previousId,
      resourceStocks: Object.fromEntries([...stocks].map(([id, entry]) => [id, entry.total]).sort()),
      events: runtime.state.events.events.length,
    });
    previousId = currentId;
  }

  return judge(runtime, options, days, samples, acc);
}

function judge(
  runtime: WorldRuntime,
  options: SimulationTestOptions,
  days: number,
  samples: DailySample[],
  acc: Accumulator,
): SimulationTestResult {
  const definition = runtime.definition;
  const log = runtime.state.changeLog;
  const events = runtime.state.events.events;
  const warnings: ValidationIssue[] = [];
  const verdicts: TestVerdict[] = [];

  // --- 주체 ------------------------------------------------------------------------
  const agentIds = runtime.agentIds();
  const activeAgents = agentIds.filter((id) => runtime.agentRuntime(id).completedActionCount > 0);
  const deadlockedAgents = agentIds.filter((id) => {
    const agent = runtime.agentRuntime(id);
    if (agent.completedActionCount === 0) return true;
    if (agent.currentAction !== null) return false;
    return runtime.state.simulationTime - agent.lastReplanAt > 2 * TICKS_PER_DAY;
  });
  const totalActions = agentIds.reduce((sum, id) => sum + runtime.agentRuntime(id).completedActionCount, 0);

  // --- 행동 편중 --------------------------------------------------------------------
  const mix = acc.actionMix;
  const loggedActions = [...mix.values()].reduce((sum, count) => sum + count, 0);
  const dominantActionRatios: Record<string, number> = {};
  for (const [actionId, count] of [...mix].sort(([a], [b]) => a.localeCompare(b))) {
    dominantActionRatios[actionId] = loggedActions === 0 ? 0 : count / loggedActions;
  }
  const dominant = [...mix].sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))[0];
  const dominantRatio = dominant === undefined || loggedActions === 0 ? 0 : dominant[1] / loggedActions;

  // --- 자원 -------------------------------------------------------------------------
  const finalStocks = resourceStocks(runtime);
  const firstSample = samples[0];
  const resourceTrends = [...finalStocks]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resourceId, entry]) => ({
      resourceId,
      first: firstSample?.resourceStocks[resourceId] ?? entry.total,
      last: entry.total,
      capacity: entry.capacity,
      nodes: entry.nodes,
    }));
  const unmeasuredResources = definition.resources
    .map((resource) => resource.id)
    .filter((id) => !finalStocks.has(id));
  const resourceCollapse = resourceTrends.filter((trend) => trend.last === 0 && trend.first > 0).map((t) => t.resourceId);
  // 상한이 있는 세계에서 "무한 증가"는 포화로 나타난다 — 전 노드가 스키마 상한에 붙어 있으면 소비 경로가 죽은 것이다
  const saturated = resourceTrends
    .filter((trend) => trend.capacity > 0 && trend.last >= trend.capacity * 0.99 && trend.last > trend.first)
    .map((trend) => trend.resourceId);

  // --- 조직 -------------------------------------------------------------------------
  const factionIds = agentIds.filter((id) => runtime.agentRuntime(id).kind === "faction");
  const factionCollapse = factionIds.filter((id) => runtime.store.readBoolean(id, "collapsed"));
  const firstCollapse = log.find((change) => change.tags.includes("faction_collapse"));
  const firstCollapseDay = firstCollapse === undefined ? undefined : tickToDay(firstCollapse.time);

  // --- 사건 -------------------------------------------------------------------------
  const eventTypes = new Map<string, number>();
  for (const event of events) eventTypes.set(event.type, (eventTypes.get(event.type) ?? 0) + 1);
  const topEventType = [...eventTypes].sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))[0];
  const topEventRatio = events.length === 0 ? 1 : (topEventType?.[1] ?? 0) / events.length;

  // --- 정체 -------------------------------------------------------------------------
  const quietDays = samples.filter((sample) => sample.changes === 0).length;
  const totalSampledChanges = samples.reduce((sum, sample) => sum + sample.changes, 0);
  const changesPerDay = samples.length === 0 ? 0 : totalSampledChanges / samples.length;

  // --- §35 다양성 -------------------------------------------------------------------
  const participantCombinations = new Set(events.map((event) => [...event.participants].sort().join("+")));
  const stateCategories = acc.stateCategories;
  const diversityScore =
    mix.size * 0.2 + eventTypes.size * 0.3 + participantCombinations.size * 0.3 + stateCategories.size * 0.2;

  // --- §35 깊이 ---------------------------------------------------------------------
  let goalTotal = 0;
  let systemTotal = 0;
  let durationTotal = 0;
  let asymmetryComparable = 0;
  let asymmetryDifferent = 0;
  for (const event of events) {
    const goals = new Set<string>();
    for (const entry of event.baselineGoals) goals.add(`${entry.agentId}:${entry.goalId}`);
    for (const entry of event.summary?.newlyActivatedGoals ?? []) goals.add(`${entry.agentId}:${entry.goalId}`);
    goalTotal += goals.size;

    const systems = new Set<string>();
    for (const affected of event.affectedStates) {
      const split = affected.lastIndexOf(".");
      if (split <= 0) continue;
      systems.add(stateCategory(runtime, affected.slice(0, split), affected.slice(split + 1)));
    }
    systemTotal += systems.size;

    const end = event.concludedAt ?? event.lastChangeAt;
    durationTotal += Math.max(0, end - event.startedAt) / TICKS_PER_DAY;

    // 정보 비대칭 — 같은 사건을 두 참여 주체가 서로 다르게 아는가 (§30)
    const observers = event.participants.filter((id) => runtime.state.agentRuntimes[id] !== undefined).sort();
    if (observers.length < 2) continue;
    asymmetryComparable += 1;
    const comparison = compareObservers(runtime, event.id, observers[0]!, observers[1]!);
    if (comparison.onlyLeft.length > 0 || comparison.onlyRight.length > 0) asymmetryDifferent += 1;
  }
  const eventCount = Math.max(1, events.length);
  const averageGoalsPerEvent = goalTotal / eventCount;
  const averageAffectedSystemsPerEvent = systemTotal / eventCount;
  const informationAsymmetryRate = asymmetryComparable === 0 ? 0 : asymmetryDifferent / asymmetryComparable;
  const consequenceDurationScore = durationTotal / eventCount;
  const depthScore =
    averageGoalsPerEvent * 0.25 +
    averageAffectedSystemsPerEvent * 0.25 +
    informationAsymmetryRate * 0.2 +
    consequenceDurationScore * 0.3;

  // --- 판정 8종 ---------------------------------------------------------------------
  verdicts.push(
    verdict(
      "sim.run",
      `무개입 ${days}일 실행`,
      tickToDay(runtime.state.simulationTime) >= days && samples.length === days,
      `${tickToDay(runtime.state.simulationTime)}일 · 표본 ${samples.length}일 · 플레이어 개입 0회 · change ${totalSampledChanges}건`,
    ),
    verdict(
      "sim.all-agents-act",
      "모든 주체가 최소 1회 목적에 따라 행동",
      deadlockedAgents.length === 0 && activeAgents.length === agentIds.length,
      `주체 ${agentIds.length}명 · 행동한 주체 ${activeAgents.length} · 교착 ${deadlockedAgents.length}` +
        (deadlockedAgents.length === 0 ? "" : ` [${deadlockedAgents.slice(0, 4).join(",")}]`) +
        ` · 총 행동 ${totalActions}회`,
    ),
    verdict(
      "sim.dominant-action",
      `한 행동이 전체의 ${Math.round(DOMINANCE_LIMIT * 100)}% 미만`,
      dominantRatio < DOMINANCE_LIMIT,
      `행동 종류 ${mix.size} · 최다 ${dominant?.[0] ?? "없음"} ${(dominantRatio * 100).toFixed(0)}% (기록 ${loggedActions}건)`,
    ),
    verdict(
      "sim.resource-collapse",
      "완전히 소멸한 자원 없음",
      resourceCollapse.length === 0,
      `측정 자원 ${resourceTrends.length}종 — ${resourceTrends.map((t) => `${t.resourceId.replace("resource.", "")} ${t.first}→${t.last}`).join(" ")}` +
        (unmeasuredResources.length === 0 ? "" : ` · 노드 없는 자원 ${unmeasuredResources.length}종(판정 밖)`),
    ),
    verdict(
      "sim.resource-explosion",
      "무한히 증가한(포화) 자원 없음",
      saturated.length === 0,
      `상한 대비 최종 재고 — ${resourceTrends.map((t) => `${t.resourceId.replace("resource.", "")} ${t.last}/${t.capacity}`).join(" ")}` +
        (saturated.length === 0 ? "" : ` · 포화 ${saturated.join(",")}`),
    ),
    verdict(
      "sim.faction-collapse",
      "즉시 붕괴한 조직 없음",
      factionCollapse.length < Math.max(1, factionIds.length) && (firstCollapseDay === undefined || firstCollapseDay > 1),
      `조직 ${factionIds.length} · 붕괴 ${factionCollapse.length}` +
        (firstCollapseDay === undefined ? "" : ` (최초 ${firstCollapseDay}일)`),
    ),
    verdict(
      "sim.event-variety",
      "사건이 한 종류만 반복되지 않음",
      eventTypes.size >= 2 && topEventRatio < DOMINANCE_LIMIT,
      `사건 ${events.length}건 · 종류 ${eventTypes.size} · 최다 ${topEventType?.[0] ?? "없음"} ${(topEventRatio * 100).toFixed(0)}%`,
    ),
    verdict(
      "sim.no-stagnation",
      "변화가 멈춘 날 없음",
      quietDays === 0,
      `일평균 change ${changesPerDay.toFixed(0)}건 · 무변화 일수 ${quietDays}/${samples.length} · ` +
        `최소 ${Math.min(...samples.map((s) => s.changes))} 최대 ${Math.max(...samples.map((s) => s.changes))}`,
    ),
  );

  for (const failed of verdicts.filter((entry) => !entry.ok)) {
    warnings.push({
      level: "error",
      code: failed.code,
      targetId: definition.metadata.id,
      message: `${failed.title} — ${failed.evidence}`,
    });
  }

  const metrics: SimulationMetrics = {
    uniqueActionTypes: mix.size,
    uniqueEventTypes: eventTypes.size,
    uniqueParticipantCombinations: participantCombinations.size,
    changedStateCategories: stateCategories.size,
    averageGoalsPerEvent,
    averageAffectedSystemsPerEvent,
    informationAsymmetryRate,
    consequenceDurationScore,
    changesPerDay,
    quietDays,
    resourceTrends,
    unmeasuredResources,
  };

  const result: SimulationTestResult = {
    worldId: definition.metadata.id,
    worldSeed: options.worldSeed,
    duration: days,
    totalActions,
    totalEvents: events.length,
    activeAgents: activeAgents.length,
    deadlockedAgents,
    dominantActionRatios,
    resourceCollapse,
    factionCollapse,
    warnings,
    diversityScore,
    depthScore,
    metrics,
    verdicts,
    samples,
    logHash: hashValue(log),
    eventHash: hashValue(events),
    resultHash: "",
    ok: verdicts.every((entry) => entry.ok),
  };
  // 판정 전체의 해시 — 표본·점수·판정까지 같은지 본다(§44-12). 해시 자신은 제외한다.
  result.resultHash = hashValue({ ...result, resultHash: "" });
  return result;
}
