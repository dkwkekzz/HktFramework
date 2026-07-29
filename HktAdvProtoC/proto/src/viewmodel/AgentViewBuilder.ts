// 주체 관찰 화면 빌더 (기획서 §36.3 / Phase-8 §8.1)
//
// §36.3 목록 8항목을 그대로 옮긴다: 실제 상태 / 믿음 상태 / 활성 목적 / 목적 그래프(활성도 포함) /
// 현재 행동 / 기억 / 관계 / 능력과 제약.
//
// **개발자 모드와 플레이어 모드의 차이는 이 파일 안에서 끝난다.**
//   개발자 = 실제 + 믿음 병렬,  플레이어 = Phase 7 지식 필터를 통과한 것만.
// 렌더러에는 모드 분기가 없다 — 애초에 자기가 어느 모드인지 모른다(§8.0).
import { BeliefView } from "../core/agents/BeliefView";
import { effectiveAbility, ownAbilityId } from "../core/agents/GrowthSystem";
import { findGoalNode, goalGraphOf, pressuresFor, rankGoals } from "../core/agents/GoalSystem";
import { findPlayerId, playerStateOf } from "../core/agents/PlayerAgent";
import type { WorldRuntime } from "../core/world/WorldRuntime";
import type { AbilityDefinition, GoalGraph } from "../core/world/types";
import type { EntityState } from "../shared/state";
import { tickToDay, tickToMinuteOfDay } from "../shared/time";
import { EventInterpreter } from "../presentation/EventInterpreter";
import { buildObservationNarration } from "./NarrationBuilder";
import { symbolKeyOf } from "./MapViewBuilder";
import type { SceneViewContext } from "./MapViewBuilder";
import type {
  SceneAbilityRow,
  SceneAgentPanel,
  SceneBadge,
  SceneGoalNode,
  SceneMemoryRow,
  SceneRelationRow,
  SceneStateRow,
} from "./SceneViewModel";

function formatValue(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

function clockOf(tick: number): string {
  const minute = tickToMinuteOfDay(tick);
  return `${tickToDay(tick)}일 ${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function labelOf(runtime: WorldRuntime, entityId: string): string {
  return runtime.definition.bootstrap.entities.find((entry) => entry.id === entityId)?.name ?? entityId;
}

// --- ①② 상태 (§36.3 실제 상태 / 믿음 상태) --------------------------------------------

/**
 * 관찰 대상의 상태 표.
 * 개발자 모드는 실제값(actual)과 그 주체 자신의 믿음(believed)을 같은 줄에 세우고,
 * 플레이어 모드는 **관찰자가 감지한 값만** 싣는다 — actual 열은 존재하지 않는다.
 */
function stateRows(
  runtime: WorldRuntime,
  subject: EntityState,
  selfView: BeliefView,
  observer: BeliefView | undefined,
): { rows: SceneStateRow[]; hidden: number } {
  const ownerType = runtime.store.ownerTypeOf(subject);
  const rows: SceneStateRow[] = [];
  let hidden = 0;

  for (const schema of runtime.definition.stateSchemas) {
    if (schema.ownerType !== ownerType) continue;
    const actual = runtime.store.read(subject.id, schema.id);

    if (observer !== undefined) {
      // 플레이어 모드 — 관찰자의 감각·믿음이 닿는 것만 (§36.3 "관찰 가능한 현상만")
      const perceived = observer.perceive(subject.id, schema.id);
      if (perceived.source === "unknown" || perceived.value === undefined) {
        hidden += 1;
        continue;
      }
      rows.push({
        subjectId: subject.id,
        key: schema.id,
        believed: formatValue(perceived.value),
        confidence: perceived.confidence.toFixed(2),
        divergent: false,
        observable: schema.observable,
        sourceKey: perceived.source,
      });
      continue;
    }

    // 개발자 모드 — 실제값과 그 주체가 자기에 대해 갖는 믿음을 나란히
    const believed = selfView.belief(subject.id, schema.id);
    const row: SceneStateRow = {
      subjectId: subject.id,
      key: schema.id,
      actual: formatValue(actual),
      divergent: false,
      observable: schema.observable,
      sourceKey: "actual",
    };
    if (believed !== undefined) {
      row.believed = formatValue(believed.believedValue);
      row.confidence = believed.confidence.toFixed(2);
      row.divergent = formatValue(believed.believedValue) !== formatValue(actual);
      row.sourceKey = "belief";
    }
    rows.push(row);
  }
  return { rows, hidden };
}

/** 이 주체가 **남에 대해** 믿고 있는 것 (§10 실제와 믿음의 분리가 눈에 보이는 자리) */
function beliefsAboutOthers(runtime: WorldRuntime, agentId: string, showActual: boolean): SceneStateRow[] {
  const agent = runtime.state.agentRuntimes[agentId];
  if (agent === undefined) return [];
  const rows: SceneStateRow[] = [];
  for (const belief of [...agent.beliefs].sort((a, b) =>
    a.subjectId === b.subjectId ? a.stateKey.localeCompare(b.stateKey) : a.subjectId.localeCompare(b.subjectId),
  )) {
    if (belief.subjectId === agentId) continue;
    const subject = runtime.store.findEntity(belief.subjectId);
    const schema =
      subject === undefined
        ? undefined
        : runtime.schemas.find(runtime.store.ownerTypeOf(subject), belief.stateKey);
    const believed = formatValue(belief.believedValue);
    const row: SceneStateRow = {
      subjectId: belief.subjectId,
      key: belief.stateKey,
      believed,
      confidence: belief.confidence.toFixed(2),
      divergent: false,
      observable: schema?.observable ?? false,
      sourceKey: "belief",
    };
    if (showActual && subject !== undefined && schema !== undefined) {
      const actual = formatValue(runtime.store.read(belief.subjectId, belief.stateKey));
      row.actual = actual;
      row.divergent = actual !== believed;
    }
    rows.push(row);
  }
  return rows;
}

// --- ③④ 목적 (§36.3 활성 목적 / 목적 그래프) -------------------------------------------

function goalNodes(runtime: WorldRuntime, agentId: string): SceneGoalNode[] {
  const view = new BeliefView(runtime, agentId);
  const ranked = rankGoals(runtime, agentId);
  const activeIds = new Set(
    (runtime.store.findEntity(agentId)?.activeGoals ?? []).map((goal) => goal.goalId),
  );
  const graph: GoalGraph | undefined = goalGraphOf(runtime, view);
  const nodes: SceneGoalNode[] = [];

  for (const result of ranked) {
    const node = findGoalNode(runtime, view, result.goalId);
    const breakdown: SceneBadge[] = Object.entries(result.breakdown ?? {}).map(([key, value]) => ({
      key,
      value: typeof value === "number" ? value.toFixed(1) : String(value),
    }));
    nodes.push({
      id: result.goalId,
      description: node?.description ?? result.goalId,
      activation: Math.round(result.activation),
      urgency: Math.round(result.urgency),
      active: activeIds.has(result.goalId),
      sourceKey: result.source ?? "graph",
      breakdown,
      edges: (graph?.edges ?? [])
        .filter((edge) => edge.from === result.goalId)
        .map((edge) => ({ to: edge.to, relation: edge.relation, weight: edge.weight })),
    });
  }
  return nodes;
}

// --- ⑥⑦ 기억·관계 (§24, §25) ----------------------------------------------------------

function memoryRows(runtime: WorldRuntime, agentId: string): SceneMemoryRow[] {
  const agent = runtime.state.agentRuntimes[agentId];
  return [...(agent?.memories ?? [])]
    .sort((a, b) => (b.relevance === a.relevance ? b.createdAt - a.createdAt : b.relevance - a.relevance))
    .map((memory) => ({
      at: clockOf(memory.createdAt),
      type: memory.type,
      summary: memory.summary,
      intensity: Math.round(memory.emotionalIntensity),
      relevance: Math.round(memory.relevance),
      confidence: Number(memory.confidence.toFixed(2)),
      tags: [...memory.tags],
      participants: [...memory.participants],
    }));
}

function relationRows(runtime: WorldRuntime, agentId: string): SceneRelationRow[] {
  const rows: SceneRelationRow[] = [];
  for (const key of Object.keys(runtime.state.relationships).sort()) {
    const relation = runtime.state.relationships[key];
    if (relation === undefined || relation.fromId !== agentId) continue;
    rows.push({
      toId: relation.toId,
      label: labelOf(runtime, relation.toId),
      axes: [
        { key: "trust", value: String(Math.round(relation.trust)) },
        { key: "fear", value: String(Math.round(relation.fear)) },
        { key: "respect", value: String(Math.round(relation.respect)) },
        { key: "affection", value: String(Math.round(relation.affection)) },
        { key: "resentment", value: String(Math.round(relation.resentment)) },
        { key: "dependency", value: String(Math.round(relation.dependency)) },
        { key: "debt", value: String(Math.round(relation.debt)) },
        { key: "familiarity", value: String(Math.round(relation.familiarity)) },
      ],
      secretCount: relation.knownSecrets.length,
      promises: relation.promises.map((promise) => ({
        status: promise.status,
        detail: `${promise.stateKey} ${promise.comparison} ${promise.threshold} (기한 ${clockOf(promise.dueAt)})`,
      })),
    });
  }
  return rows;
}

// --- ⑧ 능력과 제약 (§16, §32) ----------------------------------------------------------

function abilityRow(ability: AbilityDefinition): SceneAbilityRow {
  return {
    id: ability.id,
    purpose: ability.purpose,
    operation: ability.operation,
    medium: ability.medium,
    mastery: Math.round(ability.mastery),
    outputRange: `${ability.outputRange.min}~${ability.outputRange.max}`,
    restrictions: ability.restrictions.map((entry) => ({
      description: entry.description,
      severity: entry.severity,
    })),
    costs: ability.costs.map((cost) => `${cost.stateKey} ${cost.amount}`),
    weakness: ability.inferableWeakness,
    derivedFrom:
      `욕망 ${ability.derivedFrom.coreDesire}` +
      (ability.derivedFrom.traumaticExperience === undefined
        ? ""
        : ` · 경험 ${ability.derivedFrom.traumaticExperience}`) +
      ` · 대가 ${ability.derivedFrom.acceptedCost}`,
    actionIds: [...ability.actionIds],
    ruleIds: [...ability.ruleIds],
  };
}

/**
 * 이 주체가 가진 능력 — 정의 + 성장 원장의 합성값이다(§32).
 * 플레이어 모드에서는 **관찰자가 아는 능력만** 싣는다(§16 knownBy).
 */
function abilityRows(
  runtime: WorldRuntime,
  agentId: string,
  observerId: string | undefined,
): SceneAbilityRow[] {
  const abilities = runtime.definition.abilitySystem?.abilities ?? [];
  const rows: SceneAbilityRow[] = [];
  for (const base of abilities) {
    if (base.ownerId !== agentId) continue;
    if (observerId !== undefined && observerId !== agentId && !base.knownBy.includes(observerId)) continue;
    const effective = effectiveAbility(runtime, base.id, agentId) ?? base;
    rows.push(abilityRow(effective));
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

// --- 패널 ------------------------------------------------------------------------------

/**
 * §36.3 주체 관찰 화면의 표시 재료 전부.
 * 플레이어 모드는 조작 중인 주체(또는 지정한 관찰자)의 시점으로 걸러진다 — 필터는 Phase 7 의 것을 그대로 쓴다.
 */
/** §8 생존 압력 표 — relatedResources 가 "이 압력은 무엇으로 풀리는가"의 화면 재료가 된다 (G-12) */
function pressureRows(
  runtime: WorldRuntime,
  agentId: string,
  view: BeliefView,
): SceneAgentPanel["pressures"] {
  const agent = runtime.state.agentRuntimes[agentId];
  if (agent === undefined) return [];
  const nameOf = new Map<string, string>();
  for (const resource of runtime.definition.resources) {
    nameOf.set(resource.id, resource.name);
    for (const tag of resource.tags) if (!nameOf.has(tag)) nameOf.set(tag, resource.name);
  }
  return pressuresFor(runtime, view).map((pressure) => ({
    id: pressure.id,
    urgency: Math.round((agent.pressures[pressure.id] ?? 0) * 10) / 10,
    maxUrgency: pressure.maxUrgency,
    relievedBy: pressure.relatedResources.map((entry) => nameOf.get(entry) ?? entry),
  }));
}

export function buildAgentPanel(
  runtime: WorldRuntime,
  agentId: string,
  context: SceneViewContext,
  interpreter: EventInterpreter = new EventInterpreter(),
): SceneAgentPanel | undefined {
  const subject = runtime.store.findEntity(agentId);
  if (subject === undefined) return undefined;

  const observerId =
    context.mode === "player" ? (context.observerId ?? findPlayerId(runtime)) : undefined;
  // 플레이어 모드인데 조작 중인 주체가 없으면 볼 수 있는 것이 없다 — 빈 시점을 만들지 않는다
  if (context.mode === "player" && (observerId === undefined || playerStateOf(runtime, observerId) === undefined)) {
    return undefined;
  }
  /**
   * 플레이어 모드에서는 **자기 자신을 볼 때도** 감각을 통과한다.
   * 조작 중인 주체의 상태라고 해서 실제값 열이 열리면 "플레이어 모드에 실제 상태는 없다"가 깨진다 —
   * 자기 상태는 `self` 출처의 감각으로 실릴 뿐이다(§36.3, Phase-7 §7.2 와 같은 규약).
   */
  const observer = observerId === undefined ? undefined : new BeliefView(runtime, observerId);
  const selfView = new BeliefView(runtime, agentId);
  const hasRuntime = runtime.state.agentRuntimes[agentId] !== undefined;

  // 플레이어 모드에서 남의 속은 보이지 않는다 — 판단 근거(목적·기억·관계)는 자기 것만 실린다
  const introspect = observerId === undefined || observerId === agentId;
  const { rows, hidden } = stateRows(runtime, subject, selfView, observer);

  const speciesId = subject.states["species_id"];
  const panel: SceneAgentPanel = {
    agentId,
    label: labelOf(runtime, agentId),
    modeKey: context.mode,
    symbolKey: symbolKeyOf(subject, typeof speciesId === "string" ? speciesId : undefined),
    states: rows,
    beliefsAboutOthers: introspect ? beliefsAboutOthers(runtime, agentId, context.mode === "developer") : [],
    goalGraph: introspect && hasRuntime ? goalNodes(runtime, agentId) : [],
    memories: introspect && hasRuntime ? memoryRows(runtime, agentId) : [],
    pressures: introspect && hasRuntime ? pressureRows(runtime, agentId, selfView) : [],
    relationships: introspect ? relationRows(runtime, agentId) : [],
    abilities: abilityRows(runtime, agentId, observerId),
    narration: [],
    hiddenCount: hidden,
    badges: [],
  };

  const top = panel.goalGraph.find((node) => node.active) ?? panel.goalGraph[0];
  if (top !== undefined) {
    panel.activeGoal = { id: top.id, description: top.description, activation: top.activation };
  }

  // ⑤ 현재 행동 — 진행률까지 빌더가 계산한다(렌더러는 0~1 을 그리기만 한다)
  const scheduled = hasRuntime ? runtime.agentRuntime(agentId).currentAction : null;
  if (scheduled !== null && scheduled !== undefined) {
    const action = runtime.index.actions.get(scheduled.actionId);
    const span = Math.max(1, scheduled.completesAt - scheduled.startedAt);
    const elapsed = runtime.state.simulationTime - scheduled.startedAt;
    panel.currentAction = {
      actionId: scheduled.actionId,
      label: action?.name ?? scheduled.actionId,
      targets: scheduled.targetIds.map((id) => labelOf(runtime, id)).join(", "),
      startedAt: clockOf(scheduled.startedAt),
      completesAt: clockOf(scheduled.completesAt),
      progress: Math.min(1, Math.max(0, elapsed / span)),
    };
  }

  // 관찰 묘사 (§33.3) — Interpreter 는 구조화 입력만 받고, 문장은 텍스트 필드로만 게시된다
  const narrationObserver = observerId ?? agentId;
  const request = buildObservationNarration(runtime, narrationObserver, agentId);
  panel.narration = [interpreter.interpret(request).text];

  const player = playerStateOf(runtime, agentId);
  panel.badges = [
    { key: "표시 상태", value: String(rows.length) },
    { key: "감춰진 상태", value: String(hidden) },
    { key: "믿음", value: String(runtime.state.agentRuntimes[agentId]?.beliefs.length ?? 0) },
    { key: "기억", value: String(panel.memories.length) },
    { key: "관계", value: String(panel.relationships.length) },
    { key: "능력", value: String(panel.abilities.length) },
    { key: "조작", value: player === undefined ? "아니오" : "사용자" },
    ...(ownAbilityId(runtime, agentId) === undefined
      ? []
      : [{ key: "고유 능력", value: ownAbilityId(runtime, agentId) ?? "" }]),
  ];
  return panel;
}

/** 관찰 대상으로 고를 수 있는 주체 목록 — 플레이어 모드에서는 아는 주체만 (§31 discovered) */
export function agentChoices(
  runtime: WorldRuntime,
  context: SceneViewContext,
): { id: string; label: string; symbolKey: string }[] {
  const observerId =
    context.mode === "player" ? (context.observerId ?? findPlayerId(runtime)) : undefined;
  const player = observerId === undefined ? undefined : playerStateOf(runtime, observerId);
  const allowed = player === undefined ? undefined : new Set(player.discoveredEntityIds);

  const choices: { id: string; label: string; symbolKey: string }[] = [];
  for (const id of runtime.agentIds()) {
    if (allowed !== undefined && !allowed.has(id)) continue;
    const entity = runtime.store.findEntity(id);
    if (entity === undefined) continue;
    const speciesId = entity.states["species_id"];
    choices.push({
      id,
      label: labelOf(runtime, id),
      symbolKey: symbolKeyOf(entity, typeof speciesId === "string" ? speciesId : undefined),
    });
  }
  return choices;
}
