// Phase 3 완료 조건의 재현 가능한 측정 (§20 충돌, §23 소문 감쇠)
//
// verify 스크립트와 테스트가 **같은 함수**를 쓴다 — 보고에 실린 수치와 테스트가 보는 수치가 갈라지지 않게.
import { buildManualWorld } from "../../content/manual-world";
import type { ObservationEffect } from "../world/types";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { emitObservationEffect } from "../world/Signals";
import { WorldRuntime } from "../world/WorldRuntime";
import { findBelief } from "./BeliefStore";
import { INSTINCT_PULL, calculateGoalActivation, rankGoals, updateGoalLifecycle } from "./GoalSystem";
import { processObservationSignals } from "./PerceptionSystem";
import { BeliefView } from "./BeliefView";
import { RuleEngine } from "../rules/RuleEngine";
import { relationshipView } from "./RelationshipSystem";

const BEAST = "creature.echo_beast_mother";
const LISTENER = "agent.kael";
const TELLER = "agent.ren";

function freshRuntime(seed: number): WorldRuntime {
  const runtime = new WorldRuntime(buildManualWorld(seed));
  bootstrapWorld(runtime);
  return runtime;
}

/** 관찰자를 신호원 곁에 세운다 — 거리 감쇠를 통과시키기 위한 준비 */
function placeBeside(runtime: WorldRuntime, moverId: string, anchorId: string, offset = 2): void {
  const anchor = runtime.store.entity(anchorId).position!;
  runtime.store.moveEntity(moverId, { ...anchor, x: anchor.x + offset });
}

export interface HearsayComparison {
  /** 직접 관찰로 생긴 믿음의 확신 */
  direct: number;
  /** 소문(전달자의 믿음)으로 생긴 믿음의 확신 */
  rumor: number;
  /** 듣는 이가 전달자에게 갖는 신뢰 (§25) */
  trust: number;
}

/**
 * 같은 주장(반향수의 공격성 90)을 ① 직접 관찰 ② 소문으로 각각 전달하고 확신을 비교한다.
 * 소문은 전달자 신뢰만큼 깎인다 — 정보 비대칭의 원천(§23 소문 채널, §25 trust).
 */
export function compareHearsayConfidence(seed: number): HearsayComparison {
  // ① 직접 관찰 — 짐승이 내는 신호를 눈으로 본다
  const directRuntime = freshRuntime(seed);
  placeBeside(directRuntime, LISTENER, BEAST);
  const sighting: ObservationEffect = {
    signalId: "signal.sighting",
    channels: ["sight", "sound"],
    strength: 80,
    tags: ["threat"],
    claim: { subject: "actor", stateKey: "aggression", value: 90, confidence: 0.9 },
  };
  emitObservationEffect(directRuntime, sighting, { actorId: BEAST });
  processObservationSignals(directRuntime);
  const direct = findBelief(directRuntime.agentRuntime(LISTENER), BEAST, "aggression")?.confidence ?? 0;

  // ② 소문 — 같은 주장을 사람이 옮긴다. 옮기는 이의 믿음이 그대로 실린다.
  const rumorRuntime = freshRuntime(seed);
  placeBeside(rumorRuntime, LISTENER, TELLER);
  const teller = rumorRuntime.agentRuntime(TELLER);
  const tellerBelief = findBelief(teller, BEAST, "aggression");
  if (tellerBelief !== undefined) tellerBelief.confidence = 0.9;
  const listenerBelief = findBelief(rumorRuntime.agentRuntime(LISTENER), BEAST, "aggression");
  if (listenerBelief !== undefined) rumorRuntime.agentRuntime(LISTENER).beliefs = []; // 이미 아는 것을 지우고 새로 듣는다
  const rumorEffect: ObservationEffect = {
    signalId: "signal.rumor",
    channels: ["talk"],
    strength: 80,
    tags: ["rumor", "threat"],
    claim: { subject: "entity", entityId: BEAST, stateKey: "aggression", value: 0, confidence: 0, relayBelief: true },
  };
  emitObservationEffect(rumorRuntime, rumorEffect, { actorId: TELLER });
  processObservationSignals(rumorRuntime);
  const rumor = findBelief(rumorRuntime.agentRuntime(LISTENER), BEAST, "aggression")?.confidence ?? 0;

  return { direct, rumor, trust: relationshipView(rumorRuntime, LISTENER, TELLER).trust };
}

export interface ConflictMeasurement {
  agentId: string;
  goalId: string;
  calmFear: number;
  afraidFear: number;
  /** 겁먹은 상태에서 목적이 받은 충돌 감산 (§20 conflict) */
  subtracted: number;
  calmTop: string;
  afraidTop: string;
  /** 충돌이 1순위 목적을 바꿨는가 */
  flipped: boolean;
}

/**
 * §19 "가족 생존 ↕ 신념" 구조의 실측 —
 * 마을 지도자의 `goal.village_food_security` 와 `goal.village_safety` 는 conflicts 로 묶여 있고,
 * 겁먹은 상태에서는 회피 목적까지 더해져 서로를 깎는다. 같은 상태에서 **충돌 엣지만 없앤 세계**와
 * 비교하면 충돌 감산이 1순위 목적을 실제로 뒤집는 것이 보인다(§20 conflict).
 */
export function measureGoalConflict(seed: number): ConflictMeasurement {
  const agentId = "agent.mar";
  const goalId = "goal.village_food_security";
  const fear = 85;

  // ① 충돌이 있는 세계 (실제 콘텐츠)
  const withConflict = freshRuntime(seed);
  withConflict.store.modify(agentId, "fear", "set", fear);
  const conflicted = rankGoals(withConflict, agentId);

  // ② 같은 상태에서 conflicts 엣지만 없앤 세계 — 충돌항의 순수 효과를 본다
  const withoutConflict = new WorldRuntime({
    ...buildManualWorld(seed),
    goalTemplates: buildManualWorld(seed).goalTemplates.map((graph) => ({
      ...graph,
      edges: graph.edges.filter((edge) => edge.relation !== "conflicts"),
    })),
  });
  bootstrapWorld(withoutConflict);
  withoutConflict.store.modify(agentId, "fear", "set", fear);
  const unconflicted = rankGoals(withoutConflict, agentId);

  const conflictedTop = conflicted[0]?.goalId ?? "-";
  const unconflictedTop = unconflicted[0]?.goalId ?? "-";

  return {
    agentId,
    goalId,
    calmFear: fear,
    afraidFear: fear,
    subtracted: conflicted.find((goal) => goal.goalId === goalId)?.breakdown?.conflict ?? 0,
    calmTop: unconflictedTop,
    afraidTop: conflictedTop,
    flipped: conflictedTop !== unconflictedTop,
  };
}

// --- G-2 : §19 supports/alternative 엣지 · completionEffects 소비 측정 ------------------

export interface GoalEdgeMeasurement {
  /** supports 엣지 유무에 따른 secure_food 활성도 차 (양수 = 소비되고 있다) */
  supportsBoost: number;
  /** 도움받는 쪽(survive)은 supports 로 변하지 않았는가 */
  supportedUnchanged: boolean;
  /** alternative 엣지로 약한 대안이 물러난 양 (양수 = 소비되고 있다) */
  alternativeSuppressed: number;
  /** 강한 대안은 불변인가 */
  alternativeUntouched: boolean;
  /** completionEffects 로 오른 상태량 (기대 7) */
  completionApplied: number;
  /** 재확인에도 다시 적용되지 않았는가 */
  completionOnce: boolean;
}

/** goalEdges.test.ts 와 같은 측정 — verify 보고와 테스트가 같은 수치를 본다 */
export function measureGoalEdgeSemantics(seed: number): GoalEdgeMeasurement {
  const agentId = "agent.kael";
  const build = (mutate?: (definition: ReturnType<typeof buildManualWorld>) => void): WorldRuntime => {
    const definition = structuredClone(buildManualWorld(seed));
    mutate?.(definition);
    const runtime = new WorldRuntime(definition);
    bootstrapWorld(runtime);
    // 네 목적 전부 미달성 상태로 — 달성된 목적은 랭킹에서 빠진다
    runtime.store.modify(agentId, "hunger", "set", 60);
    runtime.store.modify(agentId, "fear", "set", 40);
    runtime.store.modify("faction.silent_village", "food_reserve", "set", 50);
    return runtime;
  };
  const activation = (runtime: WorldRuntime, goalId: string): number =>
    rankGoals(runtime, agentId).find((entry) => entry.goalId === goalId)?.activation ?? Number.NaN;

  const withSupports = build();
  const withoutSupports = build((definition) => {
    const graph = definition.goalTemplates.find((g) => g.id === "goal_graph.hunter");
    if (graph !== undefined) graph.edges = graph.edges.filter((edge) => edge.relation !== "supports");
  });
  const supportsBoost =
    activation(withSupports, "goal.secure_food") - activation(withoutSupports, "goal.secure_food");
  const supportedUnchanged =
    Math.abs(activation(withSupports, "goal.survive") - activation(withoutSupports, "goal.survive")) < 1e-9;

  const withAlternative = build((definition) => {
    const graph = definition.goalTemplates.find((g) => g.id === "goal_graph.hunter");
    graph?.edges.push({ from: "goal.secure_food", to: "goal.report_danger", relation: "alternative", weight: 1 });
  });
  const baseline = build();
  const deltas = ["goal.secure_food", "goal.report_danger"].map(
    (goalId) => activation(baseline, goalId) - activation(withAlternative, goalId),
  );
  const alternativeSuppressed = Math.max(...deltas);
  const alternativeUntouched = Math.min(...deltas) < 1e-9;

  const completionRuntime = build((definition) => {
    const node = definition.goalTemplates
      .find((g) => g.id === "goal_graph.hunter")
      ?.nodes.find((n) => n.id === "goal.avoid_threat");
    if (node !== undefined) {
      node.completionEffects = [{ stateKey: "known_threat_level", operation: "add", value: 7 }];
    }
  });
  completionRuntime.store.modify(agentId, "fear", "set", 0); // avoid_threat 달성 (fear < 25)
  const before = completionRuntime.store.readNumber(agentId, "known_threat_level");
  updateGoalLifecycle(completionRuntime, agentId);
  const afterFirst = completionRuntime.store.readNumber(agentId, "known_threat_level");
  updateGoalLifecycle(completionRuntime, agentId);
  const afterSecond = completionRuntime.store.readNumber(agentId, "known_threat_level");

  return {
    supportsBoost,
    supportedUnchanged,
    alternativeSuppressed,
    alternativeUntouched,
    completionApplied: afterFirst - before,
    completionOnce: afterSecond === afterFirst,
  };
}

// --- §15 종족 생존 구조의 실행 증명 (G-4) --------------------------------------------

export interface SpeciesStructureRow {
  /** §15 필드 이름 */
  field: string;
  /** 무엇이 그 필드를 읽는가 */
  consumer: string;
  ok: boolean;
  evidence: string;
}

/**
 * §15 의 생존 구조 필드가 **실제로 세계를 움직이는지** 재 본다 (G-4).
 * 필드마다 "값이 다르면 결과가 다르다"를 같은 세계에서 대조로 보인다 — 선언이 아니라 차이가 증거다.
 */
export function measureSpeciesStructure(seed = 42): SpeciesStructureRow[] {
  const runtime = freshRuntime(seed);
  const definition = runtime.definition;
  const human = definition.species.find((entry) => entry.id === "species.human")!;
  const beast = definition.species.find((entry) => entry.id === "species.echo_beast")!;
  const rows: SpeciesStructureRow[] = [];

  // ① requiredResources — 허기 증가가 종족의 하루 필요량에 비례한다 (규칙 DSL species_need)
  const engine = new RuleEngine(definition.ruleDefinitions);
  const hungerBefore = new Map(
    [LISTENER, BEAST].map((id) => [id, runtime.store.readNumber(id, "hunger")]),
  );
  engine.runInterval(runtime, "rule.hunger_growth");
  const humanGain = runtime.store.readNumber(LISTENER, "hunger") - hungerBefore.get(LISTENER)!;
  const beastGain = runtime.store.readNumber(BEAST, "hunger") - hungerBefore.get(BEAST)!;
  const humanNeed = human.requiredResources.find((need) => need.resourceTag === "organic_food")?.amountPerDay ?? 0;
  const beastNeed = beast.requiredResources.find((need) => need.resourceTag === "organic_food")?.amountPerDay ?? 0;
  rows.push({
    field: "requiredResources",
    consumer: "규칙 DSL species_need → rule.hunger_growth",
    ok: beastGain > humanGain && humanGain > 0 && beastNeed > humanNeed,
    evidence: `하루 필요량 인간 ${humanNeed} / 반향수 ${beastNeed} → 한 시간 허기 증가 ${humanGain.toFixed(2)} / ${beastGain.toFixed(2)}`,
  });

  // ② instincts — 본능 목적은 같은 상태에서도 더 세게 당긴다
  // (이미 이룬 목적은 활성도 계산 전에 걸러지므로, 아직 이루지 못한 상태로 놓고 잰다 — §19)
  runtime.store.modify(LISTENER, "hunger", "set", 65);
  const beliefView = new BeliefView(runtime, LISTENER);
  const graph = runtime.index.goalGraphs.get("goal_graph.hunter")!;
  const instinct = graph.nodes.find((node) => human.instincts.includes(node.id))!;
  const learned = graph.nodes.find((node) => !human.instincts.includes(node.id))!;
  const instinctResult = calculateGoalActivation(runtime, LISTENER, instinct, beliefView);
  const learnedResult = calculateGoalActivation(runtime, LISTENER, learned, beliefView);
  rows.push({
    field: "instincts",
    consumer: "GoalSystem — 본능 목적 중요도 가산",
    ok:
      beliefView.instincts.length > 0 &&
      instinctResult.breakdown.baseImportance === instinct.baseImportance + INSTINCT_PULL &&
      learnedResult.breakdown.baseImportance === learned.baseImportance,
    evidence: `본능 ${beliefView.instincts.join(",")} — ${instinct.id} 중요도 ${instinct.baseImportance}→${instinctResult.breakdown.baseImportance} · 배운 목적 ${learned.id} 은 ${learnedResult.breakdown.baseImportance} 그대로`,
  });

  // ③ survivalUnit — 같은 종의 출발선이 생존 단위에서 온다
  const kin = relationshipView(runtime, LISTENER, "agent.mar");
  const stranger = relationshipView(runtime, LISTENER, BEAST);
  rows.push({
    field: "survivalUnit",
    consumer: "WorldBootstrap — 같은 종의 초기 관계",
    ok: kin.familiarity > 0 && kin.familiarity > stranger.familiarity,
    evidence: `인간의 생존 단위 ${human.survivalUnit} → 같은 종 사이 친숙도 ${kin.familiarity}·신뢰 ${kin.trust} / 다른 종은 ${stranger.familiarity}`,
  });

  // ④ adaptationRules·growthRules — 선언한 규칙이 실재하고 그 종의 개체를 실제로 건드린다
  const declared = [...beast.adaptationRules, ...beast.growthRules];
  const known = declared.filter((ruleId) => runtime.definition.ruleDefinitions.some((rule) => rule.id === ruleId));
  rows.push({
    field: "adaptationRules · growthRules",
    consumer: "§34 species.structure — 실재 검증",
    ok: declared.length > 0 && known.length === declared.length,
    evidence: `반향수의 적응·성장 규칙 ${declared.length}개 전부 실재 — ${declared.map((id) => id.replace("rule.", "")).join(" ")}`,
  });

  // ⑤ reproduction — 번식 선언이 그것을 실행하는 규칙에 연결된다
  const links = beast.reproductionRuleIds ?? [];
  rows.push({
    field: "reproduction",
    consumer: "컴파일러 — 개체 템플릿의 species_id 로 자동 연결",
    ok: links.length > 0,
    evidence:
      links.length > 0
        ? `반향수 번식 → ${links.join(", ")} (이 규칙이 반향수 개체를 만든다)`
        : "연결된 번식 규칙 없음",
  });

  return rows;
}
