// Phase 7 완료 조건의 재현 가능한 측정 (§30 개입, §31 플레이어, §32 성장)
//
// phase3Checks·phase4Checks 와 같은 규약 — **verify 스크립트와 테스트가 같은 함수를 쓴다.**
// 보고에 실린 수치와 테스트가 보는 수치가 갈라질 수 없게 하는 장치다.
import { DEFAULT_PLAYER_AGENT_ID, buildPlayerWorld } from "../../content/player-world";
import type { WorldEvent } from "../../shared/events";
import { hashValue } from "../../shared/hash";
import type {
  GrowthChange,
  GrowthOffer,
  PlayerActionOption,
  PlayerKnowledgeView,
} from "../../shared/player";
import { TICKS_PER_DAY, tickToDay } from "../../shared/time";
import { canCross, travelDuration } from "../actions/ActionSystem";
import { InlineHost } from "../simulation/InlineHost";
import type { WorldRuntime } from "../world/WorldRuntime";
import { acceptGrowthOffer, effectiveAbility, ownAbilityId } from "./GrowthSystem";
import { buildPlayerKnowledgeView, findPlayerId, playerActionOptions } from "./PlayerAgent";

/** §30 "플레이어는 다음 방식으로 참여할 수 있다" 목록을 이 세계의 행동으로 옮긴 것 */
export interface ParticipationMode {
  mode: string;
  label: string;
  actionId: string;
  /** 이 참여 방식이 겨냥하는 대상 (있으면 우선 고른다) */
  preferredTargetId?: string;
}

export const PARTICIPATION_MODES: ParticipationMode[] = [
  { mode: "subjugation", label: "토벌대에 참가한다", actionId: "action.attack", preferredTargetId: "creature.echo_beast_mother" },
  { mode: "investigate", label: "습격 현장을 조사한다", actionId: "action.observe", preferredTargetId: "creature.echo_beast_mother" },
  { mode: "track", label: "생물을 추적한다", actionId: "action.track", preferredTargetId: "creature.echo_beast_mother" },
  { mode: "assist", label: "연구자를 돕는다", actionId: "action.assist", preferredTargetId: "agent.rion" },
  { mode: "sell_info", label: "상인에게 정보를 판매한다", actionId: "action.sell_info", preferredTargetId: "agent.ren" },
];

/** §44-8 "하나의 사건에 여러 개입 방식" — 행동 태그를 네 갈래로 나눈다 */
export const INTERVENTION_CATEGORIES: Record<string, string[]> = {
  전투: ["combat", "attack"],
  협상: ["negotiate", "assist", "social"],
  정보: ["investigate", "information", "report", "rumor", "track"],
  거래: ["trade", "faction_trade"],
};

export interface ParticipationAttempt {
  day: number;
  mode: string;
  label: string;
  actionId: string;
  targetIds: string[];
  accepted: boolean;
  /** 사거리 밖이라 우선 다가간 경우 */
  approach: boolean;
  reason?: string;
}

/** 지식 필터 위반 — 믿음도 감각도 아닌 값이 화면 데이터에 실렸다 */
export interface KnowledgeLeak {
  day: number;
  entityId: string;
  key: string;
  detail: string;
}

export interface PlayerScenarioResult {
  worldSeed: number;
  days: number;
  playerId: string;
  attempts: ParticipationAttempt[];
  /** 실제로 수행한 §30 참여 방식 */
  performedModes: string[];
  idleDays: number;
  completedActionCount: number;
  /** 마지막 날의 표시 데이터 */
  finalView: PlayerKnowledgeView;
  /** 검사한 사실 수 / 위반 */
  auditedFacts: number;
  leaks: KnowledgeLeak[];
  /** 관찰 불가(§9 observable=false) 상태가 화면에 실렸는지 */
  hiddenLeaks: KnowledgeLeak[];
  undiscoveredAtStart: number;
  undiscoveredAtEnd: number;
  /** 세계에 실재하는 "관찰 불가 상태" 수와, 그중 화면에 실린 수 */
  hiddenStateCount: number;
  hiddenExposedCount: number;
  factsBySource: Record<string, number>;
  /** 화면이 실제 상태가 아니라 믿음을 보여준다는 증거 — 실제값 ≠ 표시값 */
  beliefProbes: { subjectId: string; stateKey: string; real: string; shown: string; confidence: number }[];
  /** §44-8 — 한 사건에 네 갈래 개입이 모두 있는가 */
  intervention?: { eventId: string; type: string; categories: string[]; interactions: string[] };
  /** 플레이어가 참여자로 들어간 사건과 그 결과 (§44-9·10) */
  consequence?: {
    eventId: string;
    type: string;
    netChangedStates: number;
    topDeltas: string[];
    newGoals: string[];
    relationshipShifts: string[];
  };
  growth: GrowthChange[];
  npcGrowth: GrowthChange[];
  offers: GrowthOffer[];
  acceptedOffer?: {
    offerId: string;
    optionId: string;
    restriction: string;
    changes: GrowthChange[];
    abilityBefore: { restrictions: number; outputMax: number };
    abilityAfter: { restrictions: number; outputMax: number };
  };
  journalKinds: Record<string, number>;
  journalSize: number;
  eventCount: number;
  changeCount: number;
  logHash: string;
  /** 플레이어와 NPC 가 같은 행동으로 탄 실행 규칙 (§21 비분리의 실행 증거) */
  executionPaths: SharedExecution[];
  /** §29 playerRelevance — 조작 중인 주체가 있을 때만 0 이 아니다 */
  playerRelevantEvents: number;
  /**
   * 시나리오가 끝난 시점의 런타임.
   * Phase 8 의 화면 검증이 **같은 시나리오**를 다시 돌리지 않고 이 세계를 그대로 그려 보기 위한 것이다 —
   * 보고에 실린 수치와 화면에 실린 수치가 갈라질 수 없게 한다.
   */
  runtime: WorldRuntime;
}

function pickOption(
  options: PlayerActionOption[],
  mode: ParticipationMode,
): { option: PlayerActionOption; approach: boolean } | undefined {
  const wanted = mode.preferredTargetId;
  const matches = (option: PlayerActionOption): boolean =>
    wanted === undefined || option.targetIds.includes(wanted);

  // 참여 방식은 대상까지가 그 방식이다 — "토벌대에 참가한다"가 아무나 때리는 것이 될 수는 없다
  const direct = options.filter((option) => option.actionId === mode.actionId && matches(option));
  if (direct[0] !== undefined) return { option: direct[0], approach: false };
  // 사거리 밖이면 먼저 다가간다 — §27-5 접근 후보를 플레이어도 그대로 쓴다
  const approaching = options.filter((option) => option.approachFor === mode.actionId && matches(option));
  return approaching[0] === undefined ? undefined : { option: approaching[0], approach: true };
}

/** 몸이 버티지 못하면 개입도 없다 — NPC 와 같은 행동으로 자기를 건사한다 */
function maintenanceOption(
  view: PlayerKnowledgeView,
): PlayerActionOption | undefined {
  const number = (key: string): number =>
    Number(view.self.facts.find((fact) => fact.key === key)?.value ?? "0");
  if (number("hunger") > 70) {
    const eat = view.options.find((option) => option.actionId === "action.eat");
    if (eat !== undefined) return eat;
  }
  if (number("energy") < 25) {
    const rest = view.options.find((option) => option.actionId === "action.rest");
    if (rest !== undefined) return rest;
  }
  return undefined;
}

/**
 * 화면 데이터가 믿음·감각을 넘지 않았는지 감사한다 (Phase-7 DoD 3).
 * UI 를 띄우지 않고 판정한다 — 지식 필터가 빌더가 아니라 **코어에서** 끝나기 때문이다.
 */
export function auditKnowledgeView(
  runtime: WorldRuntime,
  view: PlayerKnowledgeView,
  day: number,
): { audited: number; leaks: KnowledgeLeak[]; hiddenLeaks: KnowledgeLeak[] } {
  const player = runtime.agentRuntime(view.playerId);
  const discovered = new Set((runtime.agentRuntime(view.playerId) as { discoveredEntityIds?: string[] }).discoveredEntityIds ?? []);
  const leaks: KnowledgeLeak[] = [];
  const hiddenLeaks: KnowledgeLeak[] = [];
  let audited = 0;

  for (const entity of view.known) {
    if (!discovered.has(entity.id)) {
      leaks.push({ day, entityId: entity.id, key: "(개체)", detail: "발견하지 않은 개체가 실렸다" });
      continue;
    }
    const real = runtime.store.findEntity(entity.id);
    if (real === undefined) continue;
    const ownerType = runtime.store.ownerTypeOf(real);
    for (const fact of entity.facts) {
      audited += 1;
      const schema = runtime.schemas.find(ownerType, fact.key);
      const belief = player.beliefs.find(
        (record) => record.subjectId === entity.id && record.stateKey === fact.key,
      );
      if (fact.source === "belief") {
        if (belief === undefined) {
          leaks.push({ day, entityId: entity.id, key: fact.key, detail: "믿음 없이 belief 로 표시" });
        }
        continue;
      }
      // 감각으로 온 값은 §9 observable 이어야 하고, 지금 감각이 닿아야 한다
      if (schema === undefined || !schema.observable) {
        hiddenLeaks.push({
          day,
          entityId: entity.id,
          key: fact.key,
          detail: `관찰 불가 상태가 화면에 실렸다 (실제 ${String(runtime.store.read(entity.id, fact.key))})`,
        });
      }
    }
  }
  return { audited, leaks, hiddenLeaks };
}

/**
 * 지식 필터가 실제로 무엇을 막았는가 (숫자로).
 * "위반 0" 만으로는 필터가 일하고 있다는 증거가 되지 않는다 — 막을 것이 있었다는 것도 함께 센다.
 */
export function probeKnowledge(
  runtime: WorldRuntime,
  view: PlayerKnowledgeView,
): Pick<
  PlayerScenarioResult,
  "hiddenStateCount" | "hiddenExposedCount" | "factsBySource" | "beliefProbes"
> {
  const shownFacts = new Map<string, { value: string; confidence: number }>();
  const factsBySource: Record<string, number> = {};
  for (const entity of [view.self, ...view.known]) {
    for (const fact of entity.facts) {
      shownFacts.set(`${entity.id}|${fact.key}`, { value: fact.value, confidence: fact.confidence });
      factsBySource[fact.source] = (factsBySource[fact.source] ?? 0) + 1;
    }
  }

  let hiddenStateCount = 0;
  let hiddenExposedCount = 0;
  const beliefProbes: PlayerScenarioResult["beliefProbes"] = [];
  for (const entity of Object.values(runtime.state.entities).sort((a, b) => a.id.localeCompare(b.id))) {
    if (entity.id === view.playerId) continue; // 자기 감각은 필터의 대상이 아니다
    const ownerType = runtime.store.ownerTypeOf(entity);
    for (const schema of runtime.definition.stateSchemas) {
      if (schema.ownerType !== ownerType) continue;
      const key = `${entity.id}|${schema.id}`;
      if (!schema.observable) {
        hiddenStateCount += 1;
        if (shownFacts.has(key)) hiddenExposedCount += 1;
        continue;
      }
      const shown = shownFacts.get(key);
      if (shown === undefined || schema.updatePolicy === "derived") continue;
      const real = runtime.store.read(entity.id, schema.id);
      if (String(real) === shown.value) continue;
      beliefProbes.push({
        subjectId: entity.id,
        stateKey: schema.id,
        real: String(real),
        shown: shown.value,
        confidence: shown.confidence,
      });
    }
  }
  beliefProbes.sort((a, b) => `${a.subjectId}.${a.stateKey}`.localeCompare(`${b.subjectId}.${b.stateKey}`));
  return { hiddenStateCount, hiddenExposedCount, factsBySource, beliefProbes };
}

function categorize(runtime: WorldRuntime, actionIds: string[]): string[] {
  const found = new Set<string>();
  for (const actionId of actionIds) {
    const action = runtime.index.actions.get(actionId);
    if (action === undefined) continue;
    for (const [category, tags] of Object.entries(INTERVENTION_CATEGORIES)) {
      if (action.tags.some((tag) => tags.includes(tag))) found.add(category);
    }
  }
  return [...found].sort();
}

function findConsequence(
  runtime: WorldRuntime,
  playerId: string,
): PlayerScenarioResult["consequence"] {
  const candidates = runtime.state.events.events
    .filter((event) => event.participants.includes(playerId))
    .filter((event) => (event.summary?.netChangedStateCount ?? 0) > 0)
    .sort((a, b) => (a.significance === b.significance ? a.id.localeCompare(b.id) : b.significance - a.significance));
  const event: WorldEvent | undefined = candidates[0];
  if (event === undefined) return undefined;

  const deltas = (event.summary?.affectedStateSummaries ?? [])
    .filter((entry) => (entry.delta ?? 0) !== 0)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, 3)
    .map((entry) => `${entry.entityId}.${entry.stateKey} ${String(entry.before)}→${String(entry.after)}`);
  const newGoals = (event.summary?.newlyActivatedGoals ?? [])
    .map((entry) => `${entry.agentId}:${entry.goalId}`)
    .sort();
  const shifts = Object.values(runtime.state.relationships)
    .filter((relation) => relation.fromId === playerId || relation.toId === playerId)
    .filter((relation) => relation.trust !== 0 || relation.fear !== 0 || relation.familiarity !== 0)
    .sort((a, b) => `${a.fromId}|${a.toId}`.localeCompare(`${b.fromId}|${b.toId}`))
    .slice(0, 3)
    .map(
      (relation) =>
        `${relation.fromId}→${relation.toId} 신뢰 ${relation.trust.toFixed(0)}/공포 ${relation.fear.toFixed(0)}/친숙 ${relation.familiarity.toFixed(0)}`,
    );

  return {
    eventId: event.id,
    type: event.type,
    netChangedStates: event.summary?.netChangedStateCount ?? 0,
    topDeltas: deltas,
    newGoals,
    relationshipShifts: shifts,
  };
}

export interface PlayerScenarioOptions {
  worldSeed: number;
  days: number;
  playerId?: string;
  /** 참여를 시도하지 않는다 — §30 "아무것도 하지 않는다" */
  passive?: boolean;
  /** 성장 선택지가 올라오면 이 선택지를 수락한다 */
  acceptOptionId?: string;
}

/**
 * §30 참여 방식을 실제 조작으로 재현한다.
 * 하루에 한 번, 아직 해 보지 않은 참여 방식 중 **지금 가능한 것**을 고른다 —
 * 가능 여부의 판정은 전부 ActionPlanner 의 후보 생성기가 한다(§31).
 */
export async function runPlayerScenario(
  options: PlayerScenarioOptions,
): Promise<PlayerScenarioResult> {
  const { worldSeed, days } = options;
  const playerId = options.playerId ?? DEFAULT_PLAYER_AGENT_ID;
  const host = new InlineHost();
  await host.request({
    type: "initialize_world",
    worldSeed,
    definition: buildPlayerWorld(worldSeed),
  });
  await host.request({ type: "attach_player", agentId: playerId });
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");

  const undiscoveredAtStart = buildPlayerKnowledgeView(runtime, playerId).undiscoveredCount;
  const attempts: ParticipationAttempt[] = [];
  const performed = new Set<string>();
  const leaks: KnowledgeLeak[] = [];
  const hiddenLeaks: KnowledgeLeak[] = [];
  let audited = 0;
  let idleDays = 0;
  let acceptedOffer: PlayerScenarioResult["acceptedOffer"];
  let intervention: PlayerScenarioResult["intervention"];

  for (let day = 1; day <= days; day++) {
    await host.request({ type: "advance_time", amount: TICKS_PER_DAY });
    const view = buildPlayerKnowledgeView(runtime, playerId);
    const audit = auditKnowledgeView(runtime, view, day);
    audited += audit.audited;
    leaks.push(...audit.leaks);
    hiddenLeaks.push(...audit.hiddenLeaks);

    // §44-8 — 아는 사건 중 네 갈래 개입이 모두 열린 것을 한 번만 붙잡아 둔다
    if (intervention === undefined) {
      for (const brief of view.events) {
        const categories = categorize(runtime, brief.possibleInteractions);
        if (categories.length < 4) continue;
        intervention = {
          eventId: brief.eventId,
          type: brief.type,
          categories,
          interactions: brief.possibleInteractions,
        };
        break;
      }
    }

    // §32 선택형 성장 — 사용자가 답한다 (NPC 는 같은 목록을 점수로 자동 결정한다)
    const offer = view.growthOffers[0];
    if (acceptedOffer === undefined && offer !== undefined) {
      const abilityId = ownAbilityId(runtime, playerId);
      const before = abilityId === undefined ? undefined : effectiveAbility(runtime, abilityId, playerId);
      const optionId = options.acceptOptionId ?? offer.options[0]?.id ?? "";
      const chosen = offer.options.find((entry) => entry.id === optionId);
      const result = acceptGrowthOffer(runtime, offer.id, optionId);
      const after = abilityId === undefined ? undefined : effectiveAbility(runtime, abilityId, playerId);
      if (result.ok) {
        acceptedOffer = {
          offerId: offer.id,
          optionId,
          restriction: chosen?.restriction ?? "",
          changes: result.changes,
          abilityBefore: {
            restrictions: before?.restrictions.length ?? 0,
            outputMax: before?.outputRange.max ?? 0,
          },
          abilityAfter: {
            restrictions: after?.restrictions.length ?? 0,
            outputMax: after?.outputRange.max ?? 0,
          },
        };
      }
    }

    if (options.passive === true) {
      idleDays += 1;
      continue;
    }

    // 아직 해 보지 않은 참여 방식 중 **지금 길이 열린 것**을 목록 순서대로 고른다
    const maintenance = maintenanceOption(view);
    let mode: ParticipationMode | undefined;
    let chosen: ReturnType<typeof pickOption>;
    for (const candidate of PARTICIPATION_MODES) {
      if (performed.has(candidate.mode)) continue;
      const picked = pickOption(view.options, candidate);
      if (picked === undefined) continue;
      mode = candidate;
      chosen = picked;
      break;
    }

    if (maintenance !== undefined && chosen === undefined) {
      await host.request({
        type: "execute_player_action",
        action: { actionId: maintenance.actionId, targetIds: maintenance.targetIds },
      });
      continue;
    }
    if (mode === undefined || chosen === undefined) {
      idleDays += 1;
      continue;
    }

    const responses = await host.request({
      type: "execute_player_action",
      action: { actionId: chosen.option.actionId, targetIds: chosen.option.targetIds },
    });
    const result = responses.find((response) => response.type === "player_action_result");
    const outcome = result?.type === "player_action_result" ? result.outcome : undefined;
    const attempt: ParticipationAttempt = {
      day,
      mode: mode.mode,
      label: mode.label,
      actionId: chosen.option.actionId,
      targetIds: chosen.option.targetIds,
      accepted: outcome?.accepted ?? false,
      approach: chosen.approach,
    };
    if (outcome?.reason !== undefined) attempt.reason = outcome.reason;
    attempts.push(attempt);
    if (attempt.accepted && !attempt.approach) performed.add(mode.mode);
  }

  const finalView = buildPlayerKnowledgeView(runtime, playerId);
  const journalKinds: Record<string, number> = {};
  for (const entry of finalView.journal) {
    journalKinds[entry.kind] = (journalKinds[entry.kind] ?? 0) + 1;
  }

  const result: PlayerScenarioResult = {
    worldSeed,
    days,
    playerId,
    attempts,
    performedModes: [...performed].sort(),
    idleDays,
    completedActionCount: runtime.agentRuntime(playerId).completedActionCount,
    finalView,
    auditedFacts: audited,
    leaks,
    hiddenLeaks,
    undiscoveredAtStart,
    undiscoveredAtEnd: finalView.undiscoveredCount,
    ...probeKnowledge(runtime, finalView),
    growth: runtime.state.growth.filter((change) => change.agentId === playerId),
    npcGrowth: runtime.state.growth.filter((change) => change.agentId !== playerId),
    offers: [...runtime.state.growthOffers],
    journalKinds,
    journalSize: finalView.journal.length,
    eventCount: runtime.state.events.events.length,
    changeCount: runtime.state.changeLog.length,
    logHash: hashValue(runtime.state.changeLog),
    executionPaths: compareExecutionPaths(runtime, playerId),
    playerRelevantEvents: runtime.state.events.events.filter(
      (event) => event.significanceBreakdown.playerRelevance > 0,
    ).length,
    runtime,
  };
  if (intervention !== undefined) result.intervention = intervention;
  const consequence = findConsequence(runtime, playerId);
  if (consequence !== undefined) result.consequence = consequence;
  if (acceptedOffer !== undefined) result.acceptedOffer = acceptedOffer;
  return result;
}

/** 개입하지 않은 세계와 개입한 세계의 대조 — "아무것도 하지 않는다"도 하나의 선택이다 (§30) */
export interface PassiveComparison {
  passive: PlayerScenarioResult;
  active: PlayerScenarioResult;
  /** 방관해도 세계가 움직였는가 */
  worldMovedWhilePassive: boolean;
  /** 개입이 세계를 갈랐는가 */
  divergedFromPassive: boolean;
}

export async function comparePassiveAndActive(
  worldSeed: number,
  days: number,
): Promise<PassiveComparison> {
  const passive = await runPlayerScenario({ worldSeed, days, passive: true });
  const active = await runPlayerScenario({ worldSeed, days });
  return {
    passive,
    active,
    worldMovedWhilePassive: passive.changeCount > 0 && passive.eventCount > 0,
    divergedFromPassive: passive.logHash !== active.logHash,
  };
}

// --- 플레이어 특권이 없다는 증거 (Phase-7 DoD 4) -----------------------------------

/**
 * 플레이어 분기를 가져서는 안 되는 모듈들.
 * 규칙·효과·행동·판단 계층 전부다. 유일하게 허용된 분기는 AgentRuntime.shouldReplan 한 줄 —
 * §31 이 말하는 "행동 선택을 시스템이 아니라 사용자가 한다"가 그 한 줄이다.
 */
export const PLAYER_FREE_MODULES = [
  "../rules/RuleEngine.ts",
  "../rules/EffectExecutor.ts",
  "../rules/ConditionEvaluator.ts",
  "../rules/TargetSelector.ts",
  "../rules/ObservationEmitter.ts",
  "../actions/ActionSystem.ts",
  "./ActionPlanner.ts",
  "./GoalSystem.ts",
  "./PerceptionSystem.ts",
  "./RelationshipSystem.ts",
  "./MemorySystem.ts",
];

const PLAYER_BRANCH = /controlledByUser|isPlayerState|PlayerRuntimeState|PlayerAgent/;

export function findPlayerBranches(sources: { path: string; source: string }[]): string[] {
  return sources.filter((entry) => PLAYER_BRANCH.test(entry.source)).map((entry) => entry.path);
}

/** 어떤 행동이 어떤 실행 규칙을 태웠는가 — 플레이어와 NPC 를 갈라 센다 */
export interface SharedExecution {
  actionId: string;
  playerRules: string[];
  npcRules: string[];
  same: boolean;
}

export function compareExecutionPaths(runtime: WorldRuntime, playerId: string): SharedExecution[] {
  const byActor = new Map<string, { player: Set<string>; npc: Set<string> }>();
  for (const change of runtime.state.changeLog) {
    if (!change.tags.includes("action")) continue;
    const actionId = change.tags.find((tag) => tag.startsWith("action."));
    if (actionId === undefined) continue;
    const rules = change.tags.filter((tag) => tag.startsWith("rule."));
    if (rules.length === 0) continue;
    const bucket = byActor.get(actionId) ?? { player: new Set<string>(), npc: new Set<string>() };
    for (const rule of rules) {
      if (change.sourceId === playerId) bucket.player.add(rule);
      else bucket.npc.add(rule);
    }
    byActor.set(actionId, bucket);
  }
  return [...byActor.entries()]
    .filter(([, bucket]) => bucket.player.size > 0 && bucket.npc.size > 0)
    .map(([actionId, bucket]) => {
      const playerRules = [...bucket.player].sort();
      const npcRules = [...bucket.npc].sort();
      return {
        actionId,
        playerRules,
        npcRules,
        // NPC 는 더 많은 상황을 겪으므로 규칙 집합이 더 넓을 수 있다. 문제는 **플레이어만 타는 규칙**이다.
        same: playerRules.every((rule) => npcRules.includes(rule)),
      };
    })
    .sort((a, b) => a.actionId.localeCompare(b.actionId));
}

export interface PassageRow {
  agentId: string;
  /** 통행 조건이 묻는 상태의 현재 값 */
  knownThreatLevel: number;
  /** 이 주체에게 조건부 지름길이 열려 있는가 */
  open: boolean;
  /** 이 주체가 실제로 쓰게 되는 길의 이동 시간 (열려 있으면 지름길, 아니면 큰길) */
  travelTicks: number | undefined;
}

/**
 * §13 조건부 통행의 실측 (G-5).
 * 같은 두 지역 사이에 길이 둘 있고, 하나는 조건이 걸려 있다 —
 * **누가 건너느냐에 따라 실제로 쓰는 길이 달라지는가**를 주체별로 재 본다.
 */
export function measureConditionalPassage(runtime: WorldRuntime, targetId: string): PassageRow[] {
  const ridge = runtime.index.connections.find((connection) => (connection.requirements ?? []).length > 0);
  const threatOf = (agentId: string): number => {
    // 조직처럼 이 상태를 갖지 않는 주체도 있다 — 없으면 "아는 것이 없다"로 읽는다
    try {
      return runtime.store.readNumber(agentId, "known_threat_level");
    } catch {
      return 0;
    }
  };
  return runtime
    .agentIds()
    .map((agentId) => ({
      agentId,
      knownThreatLevel: threatOf(agentId),
      open: ridge !== undefined && canCross(runtime, agentId, ridge),
      travelTicks: travelDuration(runtime, agentId, targetId),
    }))
    .filter((row) => row.travelTicks !== undefined || row.open);
}

/**
 * §32 "성장 발생 조건" 7종 ↔ 그 조건을 실행하는 규칙 (G-10).
 * 목록의 앞쪽만 구현하고 넘어가지 않도록, 조건마다 담당 규칙을 못 박아 두고 verify 가 상시 대조한다.
 */
export const GROWTH_CONDITIONS: { plan: string; ruleId: string }[] = [
  { plan: "위험한 행동을 성공했다", ruleId: "rule.growth_risky_success" },
  { plan: "새로운 현상을 반복적으로 관찰했다", ruleId: "rule.growth_repeated_observation" },
  { plan: "기존 능력을 다른 방식으로 사용했다", ruleId: "rule.growth_ability_reapplied" },
  { plan: "중요한 제약을 선택했다", ruleId: "rule.growth_ability_choice" },
  { plan: "실패와 반동을 경험했다", ruleId: "rule.growth_failure_backlash" },
  { plan: "새로운 관계나 지위를 얻었다", ruleId: "rule.growth_new_standing" },
  { plan: "종이나 환경에 대한 지식을 발견했다", ruleId: "rule.growth_tracking_knowledge" },
];

export interface GrowthConditionRow {
  plan: string;
  ruleId: string;
  /** 규칙이 세계에 실재하는가 */
  declared: boolean;
  /** 이 시나리오에서 실제로 성장을 만든 횟수 (플레이어 + NPC) */
  fired: number;
}

/** 조건 7종이 규칙으로 존재하는가 + 30일 조작에서 몇 번 발화했는가 */
export function checkGrowthConditions(
  changes: readonly GrowthChange[],
  worldSeed: number,
): GrowthConditionRow[] {
  const declared = new Set(buildPlayerWorld(worldSeed).ruleDefinitions.map((rule) => rule.id));
  return GROWTH_CONDITIONS.map(({ plan, ruleId }) => ({
    plan,
    ruleId,
    declared: declared.has(ruleId),
    fired: changes.filter((change) => change.ruleId === ruleId).length,
  }));
}

/** 지금 플레이어가 실행할 수 있는 행동들이 태울 규칙 — 전부 세계 규칙이다 */
export function playerExecutionRules(runtime: WorldRuntime): string[] {
  const playerId = findPlayerId(runtime) ?? DEFAULT_PLAYER_AGENT_ID;
  const shared = new Set<string>();
  for (const option of playerActionOptions(runtime, playerId)) {
    for (const ruleId of runtime.index.actions.get(option.actionId)?.executionRules ?? []) {
      shared.add(ruleId);
    }
  }
  return [...shared].sort();
}

export { tickToDay };
