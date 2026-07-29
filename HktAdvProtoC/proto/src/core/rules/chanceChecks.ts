// §12 "확률은 다음 용도로 제한한다" 5종의 실행 증명 + 세계 전수 감사 (G-1).
//
// 주장이 아니라 실행 결과를 남긴다 — 다섯 용도마다 실제로 굴려 본 수치를 근거로 붙이고,
// 세계가 쓰는 확률 지점을 하나도 빠짐없이 훑어 "용도를 밝히지 않은 확률 0건"을 판정한다.
// vitest 와 `npm run verify` 가 같은 함수를 쓴다.
import { buildManualWorld } from "../../content/manual-world";
import { buildRuleLabWorld, LAB_AGENTS } from "../../content/rule-lab";
import type { ObservationEffect, WorldDefinition } from "../world/types";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { emitObservationEffect } from "../world/Signals";
import { WorldRuntime } from "../world/WorldRuntime";
import { validateWorldDefinition } from "../world/WorldValidation";
import { beliefViewOf } from "../agents/BeliefView";
import { selectAction, type ActionCandidate } from "../agents/ActionPlanner";
import {
  OBSERVATION_MARGIN,
  OBSERVATION_THRESHOLD,
  observationScore,
  observationSuccessChance,
  processObservationSignals,
} from "../agents/PerceptionSystem";
import {
  CHANCE_USES,
  CHANCE_USE_SPECS,
  collectChanceSites,
  findChanceViolations,
  RULE_SITE_USES,
  type ChanceUse,
} from "./ChanceUse";
import { RuleEngine } from "./RuleEngine";
import type { RuleDefinition } from "./RuleTypes";

export interface ChanceUseCheck {
  use: ChanceUse;
  /** 기획서 §12 문구 */
  plan: string;
  site: "rule" | "engine";
  ok: boolean;
  evidence: string;
}

const MANUAL_SEED = 42;
const OBSERVER = "agent.kael";
const SOURCE = "creature.echo_beast_mother";

function manualRuntime(seed = MANUAL_SEED): WorldRuntime {
  const runtime = new WorldRuntime(buildManualWorld(seed));
  bootstrapWorld(runtime);
  return runtime;
}

// --- 엔진 자리 ① 성향 차이 / ② 행동 선택 -----------------------------------------

/** 점수만 다른 가짜 후보 4개 — 선택이 성향에만 좌우되게 만든다 */
function candidates(goalId: string): ActionCandidate[] {
  return ["action.hunt", "action.forage", "action.trade", "action.talk"].map((actionId, i) => ({
    actionId,
    targetIds: [],
    expectedGoalProgress: 0,
    expectedCost: 0,
    expectedRisk: 0,
    valueAlignment: 0,
    confidence: 1,
    // 1등과 4등의 차이가 6점 — softmax 온도가 낮으면 1등만, 높으면 아래 후보도 뽑힌다
    score: 40 - i * 2,
    duration: 10,
    goalId,
  }));
}

/** 같은 후보를 시각을 바꿔 가며 100번 고르게 하고 선택 분포를 센다 */
function selectionSpread(
  runtime: WorldRuntime,
  agentId: string,
  mood: { impulsiveness: number; fear: number; hunger: number; health: number },
  rounds = 100,
): { picks: Map<string, number>; sequence: string; stress: number } {
  const agent = runtime.agentRuntime(agentId);
  agent.traits["impulsiveness"] = mood.impulsiveness;
  // stress 는 파생 상태다(§9) — 원천인 공포·허기·체력을 놓아 스트레스를 만든다
  runtime.store.modify(agentId, "fear", "set", mood.fear);
  runtime.store.modify(agentId, "hunger", "set", mood.hunger);
  runtime.store.modify(agentId, "health", "set", mood.health);
  const picks = new Map<string, number>();
  const sequence: string[] = [];
  for (let step = 0; step < rounds; step++) {
    runtime.state.simulationTime = step * 10;
    const view = beliefViewOf(runtime, agentId);
    const chosen = selectAction(view, candidates("goal.survive"));
    const key = chosen?.actionId ?? "(없음)";
    picks.set(key, (picks.get(key) ?? 0) + 1);
    sequence.push(key);
  }
  return { picks, sequence: sequence.join(","), stress: runtime.store.readNumber(agentId, "stress") };
}

// --- 엔진 자리 ③ 관찰 실패 --------------------------------------------------------

interface ObservationTrial {
  score: number;
  chance: number;
  observed: number;
  rounds: number;
}

/**
 * 관찰자를 신호원에서 distance 만큼 떼어 놓고 같은 신호를 rounds 번 보낸다.
 * 임계에 붙은 점수에서는 성공/실패가 갈리고, 임계+여유를 넘으면 반드시 관찰된다.
 */
function observationTrial(strength: number, rounds = 40, seed = MANUAL_SEED): ObservationTrial {
  let observed = 0;
  let score = 0;
  let chance = 0;
  for (let step = 0; step < rounds; step++) {
    const runtime = manualRuntime(seed);
    runtime.state.simulationTime = step * 7;
    const anchor = runtime.store.entity(SOURCE).position!;
    runtime.store.moveEntity(OBSERVER, { ...anchor, x: anchor.x + 2 });
    const effect: ObservationEffect = {
      signalId: "signal.sighting",
      channels: ["sight"],
      strength,
      tags: ["threat"],
      claim: { subject: "actor", stateKey: "aggression", value: 90, confidence: 0.9 },
    };
    emitObservationEffect(runtime, effect, { actorId: SOURCE });
    const signal = runtime.state.pendingSignals[runtime.state.pendingSignals.length - 1]!;
    score = observationScore(runtime, OBSERVER, signal) ?? 0;
    chance = observationSuccessChance(score);
    const outcomes = processObservationSignals(runtime);
    if (outcomes.some((outcome) => outcome.observerId === OBSERVER)) observed += 1;
  }
  return { score, chance, observed, rounds };
}

// --- 규칙 자리 ④ 불완전한 행동 결과 / ⑤ 돌연변이 ---------------------------------

/** 규칙 자리의 확률이 실제로 갈리는지 — 같은 규칙을 시드만 바꿔 돌려 본다 */
function labMutationSpread(): { hitsBySeed: Map<number, number>; total: number } {
  const hitsBySeed = new Map<number, number>();
  let total = 0;
  for (const seed of [7, 8, 9]) {
    const definition = buildRuleLabWorld(seed);
    const engine = new RuleEngine(definition.ruleDefinitions);
    const runtime = new WorldRuntime(definition);
    bootstrapWorld(runtime);
    const before = new Map(LAB_AGENTS.map((id) => [id, runtime.store.readNumber(id, "stock")]));
    engine.runInterval(runtime, "rule.lab_luck");
    total = LAB_AGENTS.length;
    hitsBySeed.set(
      seed,
      LAB_AGENTS.filter((id) => runtime.store.readNumber(id, "stock") !== before.get(id)).length,
    );
  }
  return { hitsBySeed, total };
}

/** 거짓말 발각(§21 action.lie → rule.lie_discovery_risk) 을 같은 조건에서 여러 번 실행한다 */
function lieDiscoverySpread(rounds = 60): { discovered: number; rounds: number; chance: number } {
  let discovered = 0;
  for (let step = 0; step < rounds; step++) {
    const definition = buildManualWorld(MANUAL_SEED);
    const engine = new RuleEngine(definition.ruleDefinitions);
    const runtime = new WorldRuntime(definition);
    bootstrapWorld(runtime);
    runtime.state.simulationTime = step * 13;
    const before = runtime.state.relationships["agent.ren|agent.kael"] as Record<string, unknown> | undefined;
    const trustBefore = typeof before?.["trust"] === "number" ? (before["trust"] as number) : 0;
    engine.dispatchAction(runtime, "action.lie", "agent.kael", ["agent.ren"]);
    const after = runtime.state.relationships["agent.ren|agent.kael"] as Record<string, unknown> | undefined;
    const trustAfter = typeof after?.["trust"] === "number" ? (after["trust"] as number) : 0;
    if (trustAfter < trustBefore) discovered += 1;
  }
  const rule = buildManualWorld(MANUAL_SEED).ruleDefinitions.find((r) => r.id === "rule.lie_discovery_risk");
  const chance = rule?.effects.find((effect) => effect.chance !== undefined)?.chance ?? 0;
  return { discovered, rounds, chance };
}

// --- 5용도 실행 증명 ---------------------------------------------------------------

export function runChanceUseChecks(): ChanceUseCheck[] {
  const checks: ChanceUseCheck[] = [];
  const add = (use: ChanceUse, ok: boolean, evidence: string): void => {
    const spec = CHANCE_USE_SPECS[use];
    checks.push({ use, plan: spec.plan, site: spec.site, ok, evidence });
  };

  // ① 개체별 성향 차이 — 같은 후보·같은 시각인데 성향이 다르면 선택 폭이 다르다
  const CALM = { impulsiveness: 0, fear: 0, hunger: 0, health: 100 };
  const IMPULSIVE = { impulsiveness: 90, fear: 90, hunger: 60, health: 60 };
  const calm = selectionSpread(manualRuntime(), OBSERVER, CALM);
  const impulsive = selectionSpread(manualRuntime(), OBSERVER, IMPULSIVE);
  const calmTop = calm.picks.get("action.hunt") ?? 0;
  const impulsiveTop = impulsive.picks.get("action.hunt") ?? 0;
  add(
    "trait_variation",
    calmTop === 100 && impulsiveTop < 100 && impulsive.picks.size > calm.picks.size,
    `침착한 주체(impulsiveness 0 · stress ${calm.stress.toFixed(0)})는 100/100 최고점 고정 · 충동적 주체(90 · stress ${impulsive.stress.toFixed(0)})는 최고점 ${impulsiveTop}/100 · 고른 행동 ${calm.picks.size}종 → ${impulsive.picks.size}종`,
  );

  // ② 여러 가능한 행동 중 선택 — 같은 시드면 같은 순서, 시드가 다르면 다른 순서
  const impulsiveAgain = selectionSpread(manualRuntime(), OBSERVER, IMPULSIVE);
  const otherSeed = selectionSpread(manualRuntime(43), OBSERVER, IMPULSIVE);
  add(
    "action_choice",
    impulsive.picks.size >= 2 &&
      impulsive.sequence === impulsiveAgain.sequence &&
      otherSeed.sequence !== impulsive.sequence,
    `상위 후보 4개 중 ${impulsive.picks.size}종이 실제로 뽑힘(${[...impulsive.picks].map(([k, v]) => `${k.replace("action.", "")} ${v}`).join(" · ")}) — 재실행 동일, 시드 43 은 다름`,
  );

  // ③ 관찰 실패 — 임계에 붙은 신호는 놓칠 수 있고, 여유를 넘으면 반드시 본다
  // 신호 세기 15 → 점수가 임계 50 바로 위에 놓인다(간신히 보이는 신호) · 80 → 여유를 훌쩍 넘는다
  const marginal = observationTrial(15);
  const clear = observationTrial(80);
  const marginalAgain = observationTrial(15);
  add(
    "observation_failure",
    marginal.chance > 0 &&
      marginal.chance < 1 &&
      marginal.observed > 0 &&
      marginal.observed < marginal.rounds &&
      marginal.observed === marginalAgain.observed &&
      clear.chance === 1 &&
      clear.observed === clear.rounds,
    `임계 근처(점수 ${marginal.score.toFixed(1)} — 임계 ${OBSERVATION_THRESHOLD}+여유 ${OBSERVATION_MARGIN}) 성공률 ${(marginal.chance * 100).toFixed(0)}% → 실제 ${marginal.observed}/${marginal.rounds} 관찰(재실행 동일) · 뚜렷한 신호(점수 ${clear.score.toFixed(1)})는 ${clear.observed}/${clear.rounds}`,
  );

  // ④ 불완전한 행동 결과 — 같은 거짓말이 때때로 들킨다
  const lie = lieDiscoverySpread();
  add(
    "partial_outcome",
    lie.discovered > 0 && lie.discovered < lie.rounds,
    `rule.lie_discovery_risk(chance ${lie.chance}) — 같은 거짓말 ${lie.rounds}회 중 ${lie.discovered}회 발각(신뢰 하락)`,
  );

  // ⑤ 돌연변이 — 같은 규칙이 개체마다 다르게 걸리고 시드가 바뀌면 대상도 바뀐다
  const mutation = labMutationSpread();
  const hits = [...mutation.hitsBySeed.values()];
  add(
    "mutation",
    hits.every((hit) => hit > 0 && hit < mutation.total) && new Set(hits).size > 1,
    `rule.lab_luck(chance 0.5) — 시드별 적중 ${[...mutation.hitsBySeed].map(([seed, hit]) => `${seed}:${hit}/${mutation.total}`).join(" · ")}`,
  );

  // 기획서 목록 순서로 되돌린다 (§12 5용도)
  return CHANCE_USES.map((use) => checks.find((check) => check.use === use)!);
}

// --- 전수 감사 --------------------------------------------------------------------

export interface ChanceAudit {
  worlds: {
    name: string;
    rules: number;
    sites: number;
    unlabeled: number;
    byUse: Record<string, number>;
    violations: number;
  }[];
  totalSites: number;
  totalUnlabeled: number;
  totalViolations: number;
}

/** 세계들이 실제로 쓰는 확률 지점 전수 — "용도 없는 확률 0건" 의 근거 */
export function auditChanceUses(worlds: { name: string; rules: readonly RuleDefinition[] }[]): ChanceAudit {
  const rows = worlds.map(({ name, rules }) => {
    const sites = collectChanceSites(rules);
    const byUse: Record<string, number> = {};
    for (const site of sites) {
      const key = site.use ?? "(없음)";
      byUse[key] = (byUse[key] ?? 0) + 1;
    }
    return {
      name,
      rules: rules.length,
      sites: sites.length,
      unlabeled: sites.filter((site) => site.use === undefined).length,
      byUse,
      violations: findChanceViolations(rules).length,
    };
  });
  return {
    worlds: rows,
    totalSites: rows.reduce((sum, row) => sum + row.sites, 0),
    totalUnlabeled: rows.reduce((sum, row) => sum + row.unlabeled, 0),
    totalViolations: rows.reduce((sum, row) => sum + row.violations, 0),
  };
}

// --- 위반 픽스처 (검증기가 살아 있음을 증명) ---------------------------------------

export interface ChanceFixtureResult {
  name: string;
  /** 이 위반이 걸려야 하는 코드 */
  expected: string;
  detected: boolean;
  /** 이 규칙을 그대로 실행할 수는 있다 — 막는 것은 §34 생성 검증이다 */
  runnable: boolean;
  message: string;
}

/** 규칙 하나만 갈아 끼운 실험실 세계 — 나머지는 정상이므로 걸리는 것은 확률 위반뿐이다 */
function labWith(mutate: (rule: RuleDefinition) => void): { definition: WorldDefinition; rule: RuleDefinition } {
  const definition = buildRuleLabWorld(7);
  const rule = definition.ruleDefinitions.find((entry) => entry.id === "rule.lab_luck")!;
  const clone = structuredClone(rule);
  mutate(clone);
  definition.ruleDefinitions = definition.ruleDefinitions.map((entry) =>
    entry.id === clone.id ? clone : entry,
  );
  return { definition, rule: clone };
}

export function runChanceViolationFixtures(): ChanceFixtureResult[] {
  const fixtures: { name: string; expected: string; mutate: (rule: RuleDefinition) => void }[] = [
    {
      name: "용도를 밝히지 않은 확률",
      expected: "unlabeled",
      mutate: (rule) => {
        delete rule.effects[0]!.chanceUse;
      },
    },
    {
      name: "§12 목록 밖의 용도",
      expected: "unknown-use",
      mutate: (rule) => {
        rule.effects[0]!.chanceUse = "dramatic_tension" as ChanceUse;
      },
    },
    {
      name: "엔진 전용 용도를 규칙에 붙임",
      expected: "engine-use",
      mutate: (rule) => {
        rule.effects[0]!.chanceUse = "observation_failure";
      },
    },
    {
      name: "원인 없이 굴리는 주사위",
      expected: "no-cause",
      mutate: (rule) => {
        delete rule.effects[0]!.conditions;
      },
    },
    {
      name: "행동이 없는데 불완전한 행동 결과",
      expected: "context",
      mutate: (rule) => {
        rule.effects[0]!.chanceUse = "partial_outcome";
      },
    },
    {
      name: "전역 상태에 돌연변이",
      expected: "context",
      mutate: (rule) => {
        rule.effects[0] = {
          type: "modify_state",
          target: { type: "world" },
          stateKey: "lab_price",
          operation: "add",
          value: 1,
          chance: 0.5,
          chanceUse: "mutation",
          conditions: rule.effects[0]!.conditions ?? [],
        };
      },
    },
    {
      name: "확률이 아닌 확률값(chance=1)",
      expected: "deterministic",
      mutate: (rule) => {
        rule.effects[0]!.chance = 1;
      },
    },
    {
      name: "조건에 굴린 주사위 (인과 대체)",
      expected: "in-condition",
      mutate: (rule) => {
        rule.conditions = [
          { left: { type: "random" }, operator: "<", right: { type: "constant", value: 0.5 } },
        ];
      },
    },
    {
      name: "확률 없는 효과에 붙은 용도 라벨",
      expected: "label-without-chance",
      mutate: (rule) => {
        delete rule.effects[0]!.chance;
      },
    },
  ];

  return fixtures.map(({ name, expected, mutate }) => {
    const { definition, rule } = labWith(mutate);
    const violations = findChanceViolations([rule]);
    const detected = violations.some((violation) => violation.code === expected);
    // 확률 용도는 "실행 가능한가"가 아니라 "기획 원칙을 지키는가"의 문제다 —
    // 위반 규칙도 로드 계약(§9·§11 실행 계약)은 통과한다는 것을 함께 남긴다.
    const engine = new RuleEngine(definition.ruleDefinitions);
    const runnable = validateWorldDefinition(definition, engine).length === 0;
    return {
      name,
      expected,
      detected,
      runnable,
      message: violations[0]?.message ?? "(검출 없음)",
    };
  });
}

/** 규칙 효과에 붙일 수 있는 용도 목록 — 보고용 */
export const RULE_SITE_USE_LABELS = RULE_SITE_USES.map(
  (use) => `${use}(${CHANCE_USE_SPECS[use].plan})`,
).join(" · ");
