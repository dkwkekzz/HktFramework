// 완료 조건 자동 점검 (CLAUDE.md — "검토 결과는 직관적으로 확인 가능하게 보고한다")
// 실행: npm run verify [-- --seed=42 --days=30]
//
// 각 Phase 의 DoD 를 여기에 항목으로 더한다. 이 스크립트 한 줄의 출력이 곧 검토 보고다.
import { existsSync, readFileSync } from "node:fs";
import { findBelief } from "../core/agents/BeliefStore";
import { MEMORY_CAPACITY } from "../core/agents/MemorySystem";
import {
  compareHearsayConfidence,
  measureGoalConflict,
  measureGoalEdgeSemantics,
  measureSpeciesStructure,
} from "../core/agents/phase3Checks";
import { measureResourceOveruse } from "../core/world/overuseChecks";
import { measureInitialMemories, measureInventory } from "../core/agents/initialStateChecks";
import { measureSecrets } from "../core/agents/secretChecks";
import { buildPlayerKnowledgeView } from "../core/agents/PlayerAgent";
import {
  PLAYER_FREE_MODULES,
  checkGrowthConditions,
  findPlayerBranches,
  measureConditionalPassage,
  runPlayerScenario,
} from "../core/agents/phase7Checks";
import { SIGNIFICANCE_THRESHOLD } from "../core/events/EventDetector";
import { buildInterventionOpportunity } from "../core/events/EventViews";
import {
  eventCountsByPattern,
  eventsBySignificance,
  findConcludedWithConsequences,
  findEcologicalConflict,
  findGoalConflictEvents,
  findMostDividedEvent,
  measurePromotion,
  participantMix,
  summarizeEvents,
} from "../core/events/phase4Checks";
import { runAbilityChecks } from "../core/rules/abilityChecks";
import {
  auditNarration,
  checkRendererImports,
  checkRendererParity,
  checkScreenItems,
  compareModes,
  evaluateGate44,
  sceneOf,
} from "../viewmodel/phase8Checks";
import { buildScenePayload } from "../viewmodel/ScenePayloadBuilder";
import { runCapabilityChecks } from "../core/rules/capabilities";
import {
  auditChanceUses,
  runChanceUseChecks,
  runChanceViolationFixtures,
  RULE_SITE_USE_LABELS,
} from "../core/rules/chanceChecks";
import {
  BASELINE_SEEDS,
  compareToBaseline,
  MIGRATED_RULE_IDS,
  MIGRATION_BASELINE,
  summarizeRun,
} from "../core/rules/migrationBaseline";
import { validateAgainstSchema } from "../core/rules/RuleSchema";
import { InlineHost } from "../core/simulation/InlineHost";
import { buildManualWorld } from "../content/manual-world";
import { RESIDUE_RIDGE, buildPlayerWorld } from "../content/player-world";
import { buildRuleLabWorld } from "../content/rule-lab";
import {
  FIRST_WORLD_AUDIT_CORPUS,
  FIRST_WORLD_CORPUS,
  FIRST_WORLD_ID,
  FIRST_WORLD_REPAIRS,
  FIRST_WORLD_SEED_INPUT,
} from "../content/first-world";
import { auditWorld } from "../generation/AiAudit";
import { compileWorld } from "../generation/CompilerPipeline";
import { PROTOTYPE_SCALE } from "../generation/GenerationTypes";
import {
  checkFirstWorldItems,
  checkInitialPlacements,
  checkScale,
  costsGrowWithOutput,
  summarizeAbilities,
} from "../generation/phase5Checks";
import { buildObservationNarration } from "../viewmodel/NarrationBuilder";
import { runViolationFixtures, validateManualWorld } from "../generation/phase6Checks";
import { RecordedTextGenerationPort } from "../generation/RecordedTextGenerationPort";
import { compileWithRepair } from "../generation/RepairLoop";
import { compareToSimulationBaseline, SIMULATION_BASELINE } from "../generation/simulationBaseline";
import { runSimulationTest } from "../generation/SimulationTester";
import { SEMANTIC_CODES } from "../generation/WorldValidator";
import { MAX_INPUT_BYTES } from "../generation/TextGenerationPort";
import type { RawWorldChange } from "../shared/change";
import { hashValue } from "../shared/hash";
import { TICKS_PER_DAY, tickToDay } from "../shared/time";
import type { WorldRuntime } from "../core/world/WorldRuntime";

const BEAST = "creature.echo_beast_mother";
const VILLAGE = "faction.silent_village";
const AGENTS = ["agent.kael", "agent.mar", "agent.ren", "agent.rion", BEAST];
/** 개입 시나리오에서 사용자가 조작하는 주체 (§31 — 새 개체가 아니라 살던 사냥꾼) */
const PLAYER_AGENT = "agent.kael";

function arg(name: string, fallback: number): number {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found === undefined ? fallback : Number(found.split("=")[1]);
}

const worldSeed = arg("seed", 42);
const days = arg("days", 30);

async function run(seed: number): Promise<WorldRuntime> {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed: seed });
  await host.request({ type: "advance_time", amount: days * TICKS_PER_DAY });
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");
  return runtime;
}

function changed(change: RawWorldChange, entityId: string, stateKey: string): boolean {
  return change.changedStates.some((s) => s.entityId === entityId && s.stateKey === stateKey);
}

function firstDay(log: RawWorldChange[], match: (c: RawWorldChange) => boolean): number | undefined {
  const found = log.find(match);
  return found === undefined ? undefined : tickToDay(found.time);
}

interface Row {
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  ok: boolean;
  title: string;
  evidence: string;
}
const rows: Row[] = [];
let phase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 = 1;
function check(ok: boolean, title: string, evidence: string): void {
  rows.push({ phase, ok, title, evidence });
}

const runtime = await run(worldSeed);
const log = runtime.state.changeLog;

// --- DoD 1 : 플레이어 없이 5명 전원이 목적에 따라 행동한다 (§35, §44-5) -------------
const actionCounts = AGENTS.map((id) => `${id.split(".")[1]}:${runtime.agentRuntime(id).completedActionCount}`);
check(
  AGENTS.every((id) => runtime.agentRuntime(id).completedActionCount > 0),
  "5명 전원이 목적에 따라 1회 이상 행동",
  actionCounts.join(" "),
);

// --- DoD 2 : 아무도 작성하지 않은 순서로 연쇄가 발생한다 (§44-13) --------------------
const chain: { label: string; day: number | undefined }[] = [
  {
    label: "마을 식량 감소",
    day: firstDay(log, (c) => c.tags.includes("rule.village_food_consumption") && changed(c, VILLAGE, "food_reserve")),
  },
  {
    label: "사냥꾼이 숲으로",
    day: firstDay(
      log,
      (c) =>
        c.sourceId === "agent.kael" &&
        c.tags.includes("action.hunt") &&
        c.targetIds.includes("resource_node.grove_food"),
    ),
  },
  {
    label: "반향수와 접촉",
    day: firstDay(log, (c) => c.sourceId === BEAST && c.tags.includes("action.attack") && changed(c, "agent.kael", "health")),
  },
  {
    label: "공포 상승",
    day: firstDay(log, (c) => c.tags.includes("rule.threat_sighting_fear") && changed(c, "agent.kael", "fear")),
  },
  {
    label: "마을에 보고",
    day: firstDay(log, (c) => c.tags.includes("action.report") && changed(c, VILLAGE, "threat_belief")),
  },
  {
    label: "토벌 소집",
    day: firstDay(log, (c) => c.tags.includes("rule.subjugation_call") && changed(c, VILLAGE, "subjugation_ordered")),
  },
];
// Phase 3 이후 정보는 목격 말고도 소문·조직 보고로 흐른다(§23) — 공포·보고는 직접 목격보다 앞설 수 있다.
// 연쇄의 척추(식량 부족 → 사냥 → 접촉 → 소집)와 "전부 일어났는가"를 본다.
const chainDays = chain.map((step) => step.day);
const spine = [chain[0]!, chain[1]!, chain[2]!, chain[5]!].map((step) => step.day);
const chainOk =
  chainDays.every((day) => day !== undefined) &&
  spine.every((day, i) => i === 0 || day! >= spine[i - 1]!) &&
  chain[3]!.day! <= chain[5]!.day! &&
  chain[4]!.day! <= chain[5]!.day!;
check(
  chainOk,
  "연쇄가 작성하지 않은 순서로 발생",
  chain.map((step) => `${step.label}(${step.day ?? "없음"}일)`).join(" → "),
);

// --- DoD 3 : 실제 상태와 믿음의 분리 (§10) ------------------------------------------
const realAggression = runtime.store.readNumber(BEAST, "aggression");
const villagerBelief = findBelief(runtime.agentRuntime("agent.kael"), BEAST, "aggression");
const researcherBelief = findBelief(runtime.agentRuntime("agent.rion"), BEAST, "protecting_offspring");
const hiddenLeak = AGENTS.some((id) => findBelief(runtime.agentRuntime(id), BEAST, "offspring_threat") !== undefined);
check(
  realAggression < 50 && villagerBelief?.believedValue === 90 && researcherBelief?.believedValue === true && !hiddenLeak,
  "실제 상태와 믿음이 분리 저장",
  `실제 공격성 ${realAggression} / 마을 믿음 ${String(villagerBelief?.believedValue)} / 연구자 믿음 보호중=${String(researcherBelief?.believedValue)} / 관찰불가 상태 누출 ${hiddenLeak ? "있음" : "없음"}`,
);

// --- DoD 4 : 동일 시드 재현성 (§44-12) ----------------------------------------------
const again = await run(worldSeed);
const other = await run(worldSeed + 1);
const sameHash = hashValue(log);
check(
  hashValue(again.state.changeLog) === sameHash && hashValue(other.state.changeLog) !== sameHash,
  "동일 시드 재실행 로그 동일 / 다른 시드는 다름",
  `시드 ${worldSeed} 해시 ${sameHash} (${log.length}건) · 시드 ${worldSeed + 1} 해시 ${hashValue(other.state.changeLog)}`,
);

// --- DoD 5 : 모든 상태 쓰기가 스키마 검증을 통과한다 (§9) ----------------------------
let unregisteredRejected = false;
let derivedRejected = false;
try {
  runtime.store.modify("agent.kael", "mana", "set", 10);
} catch {
  unregisteredRejected = true;
}
try {
  runtime.store.modify("agent.kael", "survivalPressure", "set", 10);
} catch {
  derivedRejected = true;
}
check(
  unregisteredRejected && derivedRejected,
  "미등록 키·파생 상태 쓰기가 거부됨",
  `미등록 키 ${unregisteredRejected ? "거부" : "통과(문제)"} / 파생 상태 ${derivedRejected ? "거부" : "통과(문제)"}`,
);

// --- G-2 : §21 행동 목록 커버리지 — 사회 행동 10종 + 전 행동 비용/위험 -----------------
const SOCIAL_ACTIONS = [
  "action.negotiate",
  "action.persuade",
  "action.lie",
  "action.threaten",
  "action.hire",
  "action.propose_alliance",
  "action.contract",
  "action.hide_evidence",
  "action.craft",
  "action.research",
];
const definedActionIds = new Set(runtime.definition.actionDefinitions.map((action) => action.id));
const missingSocial = SOCIAL_ACTIONS.filter((id) => !definedActionIds.has(id));
const withoutCostOrRisk = runtime.definition.actionDefinitions
  .filter((action) => action.costs.length === 0 && action.risk <= 0)
  .map((action) => action.id);
check(
  missingSocial.length === 0 && withoutCostOrRisk.length === 0,
  "§21 사회 행동 10종 존재 · 전 행동에 비용 또는 위험 (§34)",
  `행동 ${definedActionIds.size}종 · 사회 행동 누락 ${missingSocial.length} ${missingSocial.join(",")} · 비용/위험 없는 행동 ${withoutCostOrRisk.length}`,
);

// --- G-2 : §21 visibleSignals 자동 발신 — 실행된 행동의 선언 신호는 침묵하지 않는다 -----
const executedActionIds = new Set<string>();
for (const change of log) {
  for (const tag of change.tags) if (tag.startsWith("action.")) executedActionIds.add(tag);
}
const declaredBySignal = new Map<string, string[]>();
for (const action of runtime.definition.actionDefinitions) {
  for (const signal of action.visibleSignals) {
    const owners = declaredBySignal.get(signal.signalId) ?? [];
    owners.push(action.id);
    declaredBySignal.set(signal.signalId, owners);
  }
}
const silentDeclared = [...declaredBySignal]
  .filter(([signalId, owners]) => owners.some((id) => executedActionIds.has(id)) && !runtime.emittedSignalKinds.has(signalId))
  .map(([signalId]) => signalId);
const neverExecuted = [...declaredBySignal]
  .filter(([, owners]) => owners.every((id) => !executedActionIds.has(id)))
  .map(([signalId]) => signalId);
check(
  silentDeclared.length === 0,
  "실행된 행동의 선언 신호가 전부 발신됨 (선언=발신, §21·§23)",
  `선언 신호 ${declaredBySignal.size}종 · 발신 ${runtime.emittedSignalKinds.size}종 · 침묵 위반 ${silentDeclared.length} ${silentDeclared.join(",")} · 미실행 행동의 신호 ${neverExecuted.length}종 [${neverExecuted.join(",")}]`,
);

// =====================================================================================
// Phase 2 완료 조건 — 규칙 DSL (§11, §12, §16, §42-2)
// =====================================================================================
phase = 2;

// --- DoD 1 : Phase 1 규칙 20개가 JSON 으로만 존재한다 --------------------------------
const manualRules = buildManualWorld(worldSeed).ruleDefinitions;
const schemaErrors = manualRules.flatMap((rule) =>
  validateAgainstSchema(rule).map((error) => `${rule.id}: ${error}`),
);
const legacyModule = new URL("../core/rules/HandwrittenRules.ts", import.meta.url);
const legacyExists = existsSync(legacyModule);
const ruleIds = manualRules.map((rule) => rule.id);
const missingMigrated = MIGRATED_RULE_IDS.filter((id) => !ruleIds.includes(id));
check(
  missingMigrated.length === 0 && schemaErrors.length === 0 && !legacyExists && manualRules.length <= 60,
  "규칙이 JSON 정규형으로만 존재 (이관 20개 + Phase 3 확장, §40 40~60)",
  `JSON 규칙 ${manualRules.length}개 (이관분 ${MIGRATED_RULE_IDS.length - missingMigrated.length}/${MIGRATED_RULE_IDS.length} 유지) · 스키마 위반 ${schemaErrors.length}건 · 코드 규칙 모듈 ${legacyExists ? "잔존(문제)" : "없음"}`,
);

// --- DoD 2 : DSL 규칙이 코드 규칙과 같은 change 로그를 낸다 --------------------------
const migrations = [];
for (const seed of BASELINE_SEEDS) {
  migrations.push(compareToBaseline(seed, summarizeRun(await run(seed))));
}
check(
  migrations.every((m) => m.matches),
  "30일 실행이 기준선과 동일 (재현성 회귀)",
  migrations
    .map((m) => `시드 ${m.seed} ${m.matches ? "일치" : `불일치(${m.differences.join("; ")})`} ${m.summary.logHash}/${m.summary.changeCount}건`)
    .join(" · ") + ` — 기준선: ${MIGRATION_BASELINE.source}`,
);

// --- DoD 3 : §12 요구 능력 10항목 + 방어선 ------------------------------------------
const capabilities = runCapabilityChecks();
for (const capability of capabilities) {
  check(capability.ok, `DSL 능력 — ${capability.name}`, capability.evidence);
}

// --- DoD 3-b : §12 "확률은 다음 용도로 제한한다" 5종 (G-1) ----------------------------
const chanceUseChecks = runChanceUseChecks();
check(
  chanceUseChecks.every((row) => row.ok),
  `§12 확률 용도 ${chanceUseChecks.filter((row) => row.ok).length}/5 실현 — 목록 밖의 확률은 없다`,
  chanceUseChecks
    .map(
      (row, i) =>
        `\n      ${row.ok ? "✓" : "✗"} ${i + 1}. ${row.plan} [${row.site === "rule" ? "규칙" : "엔진"}] — ${row.evidence}`,
    )
    .join(""),
);

const chanceAudit = auditChanceUses([
  { name: "수동 세계", rules: buildManualWorld(worldSeed).ruleDefinitions },
  { name: "플레이어 세계", rules: buildPlayerWorld(worldSeed).ruleDefinitions },
  { name: "규칙 실험실", rules: buildRuleLabWorld(7).ruleDefinitions },
]);
check(
  chanceAudit.totalUnlabeled === 0 && chanceAudit.totalViolations === 0,
  `용도를 밝히지 않은 확률 ${chanceAudit.totalUnlabeled}건 · §12 위반 ${chanceAudit.totalViolations}건 (확률 지점 ${chanceAudit.totalSites}개 전수)`,
  chanceAudit.worlds
    .map(
      (world) =>
        `\n      ${world.name}: 규칙 ${world.rules}개 중 확률 지점 ${world.sites}개 — ${Object.entries(world.byUse)
          .map(([use, count]) => `${use} ${count}`)
          .join(" · ")}${world.unlabeled > 0 ? ` · 라벨 없음 ${world.unlabeled}` : ""}`,
    )
    .join("") + `\n      규칙 효과에 허용된 용도: ${RULE_SITE_USE_LABELS} (나머지 3종은 엔진 자리)`,
);

const chanceFixtures = runChanceViolationFixtures();
check(
  chanceFixtures.every((fixture) => fixture.detected && fixture.runnable),
  `확률 위반 픽스처 ${chanceFixtures.filter((f) => f.detected).length}/${chanceFixtures.length} 검출 — 전부 "실행은 되지만 §12 를 어긴" 규칙이다(검증기가 없으면 그냥 지나간다)`,
  chanceFixtures
    .map((fixture) => `\n      ${fixture.detected ? "✓" : "✗"} ${fixture.name}(${fixture.expected}) — ${fixture.message}`)
    .join(""),
);

// --- DoD 4·5 : §11.4 예시 규칙 · §16 능력 픽스처 -------------------------------------
for (const ability of runAbilityChecks()) {
  check(ability.ok, `능력 체계 — ${ability.name}`, ability.evidence);
}


// =====================================================================================
// Phase 3 완료 조건 — 주체 판단 (§8, §10, §19~§25, §42-3)
// =====================================================================================
phase = 3;

// --- DoD 1 : §10 시나리오 재현 — 같은 생물, 상반된 행동 -------------------------------
const villagerReadiness = runtime.store.readBoolean(VILLAGE, "subjugation_ordered");
const researcherActions = log.filter(
  (c) => c.sourceId === "agent.rion" && (c.tags.includes("action.observe") || c.tags.includes("action.track")),
).length;
const beliefAggression = findBelief(runtime.agentRuntime("agent.kael"), BEAST, "aggression");
const researcherProtect = findBelief(runtime.agentRuntime("agent.rion"), BEAST, "protecting_offspring");
check(
  runtime.store.readNumber(BEAST, "aggression") < 50 &&
    beliefAggression?.believedValue === 90 &&
    researcherProtect?.believedValue === true &&
    villagerReadiness &&
    researcherActions > 0,
  "§10 시나리오 — 마을은 토벌 준비, 연구자는 조사 (같은 세계·상반된 행동)",
  `실제 공격성 ${runtime.store.readNumber(BEAST, "aggression")} / 마을 믿음 ${String(beliefAggression?.believedValue)}(확신 ${beliefAggression?.confidence.toFixed(2)}) · 토벌소집 ${villagerReadiness ? "O" : "X"} / 연구자 믿음 보호중=${String(researcherProtect?.believedValue)} · 조사 행동 ${researcherActions}회`,
);

// --- DoD 2 : 잘못된 믿음이 잘못된 행동을 만든다 (§44-6) --------------------------------
// 믿음값 ≠ 실제값인 상태를 근거로 한 행동을 30일 로그에서 찾는다.
interface WrongBeliefAction {
  agentId: string;
  actionId: string;
  subjectId: string;
  stateKey: string;
  believed: unknown;
  actual: unknown;
  day: number;
}
const wrongBeliefActions: WrongBeliefAction[] = [];
for (const agentId of runtime.agentIds()) {
  const agent = runtime.agentRuntime(agentId);
  for (const belief of agent.beliefs) {
    const subject = runtime.store.findEntity(belief.subjectId);
    if (subject === undefined) continue;
    const ownerType = runtime.store.ownerTypeOf(subject);
    if (runtime.schemas.find(ownerType, belief.stateKey) === undefined) continue;
    const actual = runtime.store.read(belief.subjectId, belief.stateKey);
    if (Object.is(actual, belief.believedValue)) continue;
    if (typeof actual === "number" && typeof belief.believedValue === "number") {
      if (Math.abs(actual - belief.believedValue) < 20) continue; // 사소한 오차는 "잘못된 믿음"이 아니다
    }
    // 그 대상을 겨냥한 행동이 실제로 있었는가
    const acted = log.find(
      (c) => c.sourceId === agentId && c.tags.includes("action") && c.targetIds.includes(belief.subjectId),
    );
    if (acted === undefined) continue;
    wrongBeliefActions.push({
      agentId,
      actionId: acted.tags.find((tag) => tag.startsWith("action.")) ?? "?",
      subjectId: belief.subjectId,
      stateKey: belief.stateKey,
      believed: belief.believedValue,
      actual,
      day: tickToDay(acted.time),
    });
  }
}
const wrongSample = wrongBeliefActions[0];
check(
  wrongBeliefActions.length > 0,
  "잘못된 믿음을 근거로 한 행동이 로그에서 검출됨",
  wrongSample === undefined
    ? "없음"
    : `${wrongBeliefActions.length}건 · 예: ${wrongSample.agentId} 가 ${wrongSample.subjectId}.${wrongSample.stateKey}=${String(wrongSample.believed)}(실제 ${String(wrongSample.actual)})라고 믿고 ${wrongSample.actionId} (${wrongSample.day}일)`,
);

// --- DoD 3 : 소문으로 온 믿음의 확신이 직접 관찰보다 낮다 (§23, §25) ---------------------
const hearsay = compareHearsayConfidence(worldSeed);
check(
  hearsay.rumor < hearsay.direct,
  "소문 경로의 확신 < 직접 관찰의 확신",
  `직접 관찰 ${hearsay.direct.toFixed(3)} / 소문(전달자 신뢰 ${hearsay.trust}) ${hearsay.rumor.toFixed(3)} — 같은 신호·같은 관찰자`,
);

// --- DoD 4 : 기억이 요약 믿음으로 접히고 상한을 지킨다 (§24) ----------------------------
const memoryCounts = runtime.agentIds().map((id) => runtime.agentRuntime(id).memories.length);
const summaryBeliefs = runtime
  .agentIds()
  .flatMap((id) => runtime.agentRuntime(id).beliefs.filter((b) => b.stateKey.startsWith("tendency:")));
check(
  Math.max(...memoryCounts) <= MEMORY_CAPACITY && summaryBeliefs.length > 0,
  "저중요도 기억이 요약 믿음으로 통합되고 상한을 지킨다",
  `기억 수 최대 ${Math.max(...memoryCounts)}/${MEMORY_CAPACITY} · 요약 믿음 ${summaryBeliefs.length}건 (예: ${summaryBeliefs[0]?.subjectId}.${summaryBeliefs[0]?.stateKey}=${String(summaryBeliefs[0]?.believedValue)})`,
);

// --- DoD 5 : 목적 충돌(conflict)이 선택을 바꾼다 (§19, §20) -----------------------------
const conflict = measureGoalConflict(worldSeed);
check(
  conflict.subtracted > 0 && conflict.flipped,
  "목적 충돌의 감산이 선택을 바꾼다",
  `${conflict.agentId}: 공포 ${conflict.calmFear}→${conflict.afraidFear} · ${conflict.goalId} 감산 ${conflict.subtracted.toFixed(1)} · 1순위 ${conflict.calmTop} → ${conflict.afraidTop}`,
);

// --- DoD 6 : 조직이 판단 주체로 행동한다 — 위임 (§17, §21) ------------------------------
const delegations = log.filter((c) => c.tags.includes("delegation"));
const delegatedGoalUse = log.filter(
  (c) => c.tags.includes("action") && c.tags.some((tag) => tag === "goal.subjugate_beast" || tag === "goal.gather_for_village"),
);
const factionActions = runtime
  .agentIds()
  .filter((id) => runtime.agentRuntime(id).kind === "faction")
  .map((id) => `${id.split(".")[1]}:${runtime.agentRuntime(id).completedActionCount}`);
const acceptedDelegation = delegatedGoalUse[0];
check(
  delegations.length > 0 && delegatedGoalUse.length > 0,
  "조직이 주체로 판단하고 개인에게 위임한다",
  `조직 행동 ${factionActions.join(" ")} · 위임 ${delegations.length}건 → 개인이 위임 목적으로 행동 ${delegatedGoalUse.length}회 (예: ${acceptedDelegation?.sourceId} ${acceptedDelegation?.tags.find((t) => t.startsWith("action."))} @${tickToDay(acceptedDelegation?.time ?? 0)}일)`,
);

// --- DoD 7 : 교착 주체 0 (§35 deadlockedAgents) ----------------------------------------
// 교착 = 아무 행동도 하지 않은 채, 계획조차 세우지 못하고 멈춰 있는 주체.
// (행동을 해도 상태가 안 바뀌면 로그에 남지 않으므로 판정은 주체 런타임으로 한다.)
const deadlocked = runtime.agentIds().filter((id) => {
  const agent = runtime.agentRuntime(id);
  if (agent.completedActionCount === 0) return true;
  if (agent.currentAction !== null) return false;
  return runtime.state.simulationTime - agent.lastReplanAt > 2 * TICKS_PER_DAY;
});
const idleAgents = runtime.agentIds().filter((id) => runtime.agentRuntime(id).currentAction === null);
check(
  deadlocked.length === 0,
  "30일 실행에서 교착 주체 0 (§35)",
  `주체 ${runtime.agentIds().length}명 · 전원 행동 완료(최소 ${Math.min(...runtime.agentIds().map((id) => runtime.agentRuntime(id).completedActionCount))}회) · 계획 없는 주체 ${idleAgents.length} · 교착 ${deadlocked.length}`,
);

// --- DoD 8 : 판단 코드는 WorldState 를 직접 읽지 않는다 (Phase-3 §3.1 규약) --------------
// 금지하는 것은 "세계 상태 읽기"다 — 판단은 BeliefView 로만 세계를 본다.
// (기록 남기기(noteChange)는 읽기가 아니므로 허용한다.)
const judgementModules = ["../core/agents/GoalSystem.ts", "../core/agents/ActionPlanner.ts"];
const forbidden = /runtime\.store\.read|runtime\.store\.entity|state\.entities|findEntity\(/;
const violations = judgementModules
  .map((relative) => ({ relative, source: readFileSync(new URL(relative, import.meta.url), "utf8") }))
  .filter((entry) => forbidden.test(entry.source))
  .map((entry) => entry.relative);
check(
  violations.length === 0,
  "판단 코드가 WorldState 를 직접 참조하지 않는다 (믿음만 본다)",
  `검사 ${judgementModules.length}개 모듈 · 위반 ${violations.length}건 ${violations.join(",")} — 판단의 유일한 창은 BeliefView`,
);

// --- 참고 지표 : §35 자동 시뮬레이션 테스트 --------------------------------------------
const actionMix = new Map<string, number>();
for (const change of log) {
  if (!change.tags.includes("action")) continue;
  const actionId = change.tags.find((tag) => tag.startsWith("action."));
  if (actionId === undefined) continue;
  actionMix.set(actionId, (actionMix.get(actionId) ?? 0) + 1);
}
const totalActions = [...actionMix.values()].reduce((sum, count) => sum + count, 0);
const dominant = [...actionMix].sort((a, b) => b[1] - a[1])[0];
const collapsedFactions = runtime
  .agentIds()
  .filter((id) => runtime.agentRuntime(id).kind === "faction")
  .filter((id) => runtime.store.readBoolean(id, "collapsed"));
check(
  dominant !== undefined && dominant[1] / totalActions < 0.7 && collapsedFactions.length === 0,
  "행동 편중 70% 미만 · 즉시 붕괴한 조직 없음 (§35)",
  `행동 ${totalActions}회 · 종류 ${actionMix.size} · 최다 ${dominant?.[0]} ${((dominant?.[1] ?? 0) / totalActions * 100).toFixed(0)}% · 붕괴 조직 ${collapsedFactions.length}`,
);

// --- G-2 : §19 엣지 6관계 전부가 런타임에 소비된다 ------------------------------------
// requires/conflicts/creates/reveals 는 Phase 3 부터 소비됐고, supports/alternative 와
// completionEffects 가 G-2 에서 살아났다 — 유무 비교의 활성도 차가 그 증거다.
const edgeSemantics = measureGoalEdgeSemantics(worldSeed);
check(
  edgeSemantics.supportsBoost > 0 &&
    edgeSemantics.supportedUnchanged &&
    edgeSemantics.alternativeSuppressed > 0 &&
    edgeSemantics.alternativeUntouched &&
    edgeSemantics.completionApplied === 7 &&
    edgeSemantics.completionOnce,
  "§19 supports·alternative 엣지 + completionEffects 가 소비된다",
  `supports 견인 +${edgeSemantics.supportsBoost.toFixed(1)} (도움받는 쪽 불변 ${edgeSemantics.supportedUnchanged ? "✓" : "✗"}) · ` +
    `alternative 억제 -${edgeSemantics.alternativeSuppressed.toFixed(1)} (강한 쪽 불변 ${edgeSemantics.alternativeUntouched ? "✓" : "✗"}) · ` +
    `완료 효과 +${edgeSemantics.completionApplied} (1회만 ${edgeSemantics.completionOnce ? "✓" : "✗"})`,
);

// =====================================================================================
// Phase 4 완료 조건 — 사건 탐지 (§28, §29, §30, §42-4)
// =====================================================================================
phase = 4;

const events = eventsBySignificance(runtime);
const patternCounts = eventCountsByPattern(runtime);

// --- DoD 1 : §28 예시 구조의 사건이 자동 검출된다 --------------------------------------
const ecological = findEcologicalConflict(runtime);
const mix = ecological === undefined ? undefined : participantMix(runtime, ecological);
check(
  ecological !== undefined && patternCounts.every((entry) => entry.count > 0),
  "§28 구조의 사건이 자동 검출 (종족·조직·개인이 섞인 생태 충돌)",
  ecological === undefined
    ? `사건 ${events.length}건 · 생태 충돌 없음`
    : `사건 ${events.length}건 (${patternCounts.map((e) => `${e.patternId.split(".")[1]}:${e.count}`).join(" ")}) · ` +
      `${ecological.id} "${ecological.type}" ${tickToDay(ecological.startedAt)}~${tickToDay(ecological.lastChangeAt)}일 @${ecological.locationId} ` +
      `중요도 ${ecological.significance.toFixed(0)} · 참여자 종족[${mix!.species.join(",")}] 조직[${mix!.factions.join(",")}] 개인[${mix!.individuals.join(",")}] · ` +
      `change ${ecological.summary?.totalChangeCount}건 · 영향 상태 ${ecological.affectedStates.length}개`,
);

// --- DoD 2 : 세 주체 이상의 목적이 충돌하는 사건 (§44-7) --------------------------------
const conflicts = findGoalConflictEvents(runtime, 3);
const topConflict = conflicts[0];
check(
  conflicts.length > 0,
  "세 주체 이상의 목적이 충돌하는 사건 (targetConditions 상호 배타 자동 판정)",
  topConflict === undefined
    ? "없음"
    : `${conflicts.length}건 · 예: ${topConflict.event.id}(${topConflict.event.type}) 충돌 주체 ${topConflict.agents.length}명 — ${topConflict.lines.slice(0, 2).join(" / ")}`,
);

// --- DoD 3 : 관찰자별로 아는 사실이 다르다 (§30) -----------------------------------------
// 두 관찰자의 앎이 가장 크게 갈리는 사건을 스스로 고른다 (§30)
const comparison = findMostDividedEvent(runtime, "agent.kael", "agent.rion");
const dividedEvent = events.find((event) => event.id === comparison?.eventId);
// 개입 기회는 아직 진행 중인 사건에서 본다 — 종결된 사건에는 시급도가 남지 않는다(§30 timeSensitivity)
const ongoingTop = events.find((event) => event.status === "ongoing") ?? dividedEvent;
const opportunity =
  ongoingTop === undefined ? undefined : buildInterventionOpportunity(runtime, "agent.kael", ongoingTop.id);
check(
  comparison !== undefined &&
    (comparison.onlyLeft.length > 0 || comparison.onlyRight.length > 0) &&
    (opportunity?.possibleInteractions.length ?? 0) > 0,
  "같은 사건에 대해 관찰자별 knownFacts 가 다르다 (마을사람 vs 연구자)",
  comparison === undefined
    ? "사건 없음"
    : `${comparison.eventId}(${dividedEvent?.type}): 마을사람 kael 은 참여자 ${comparison.left.participants}명·사실 ${comparison.left.facts.length}건, ` +
      `연구자 rion 은 참여자 ${comparison.right.participants}명·사실 ${comparison.right.facts.length}건 · ` +
      `kael 만 아는 것 [${comparison.onlyLeft.slice(0, 2).join(", ") || "없음"}] / rion 만 아는 것 [${comparison.onlyRight.slice(0, 2).join(", ") || "없음"}] · ` +
      `진행 중 사건 ${ongoingTop?.id}(${ongoingTop?.type})에 대한 kael 의 개입 후보 ${opportunity?.possibleInteractions.length}종 ` +
      `[${(opportunity?.possibleInteractions ?? []).slice(0, 4).join(",")}…] 시급도 ${opportunity?.timeSensitivity.toFixed(2)}`,
);

// --- DoD 4 : 종결된 사건이 세계에 흔적을 남기고 새 목적을 연다 (§44-9, §44-10) -----------
const consequences = findConcludedWithConsequences(runtime);
const topConsequence = consequences[0];
check(
  consequences.length > 0,
  "종결 사건의 순변화 ≠ 0 이고 참여자에게 새 목적이 활성화됨",
  topConsequence === undefined
    ? "없음"
    : `${consequences.length}건 · 예: ${topConsequence.event.id}(${topConsequence.event.type}, ${tickToDay(topConsequence.event.concludedAt ?? 0)}일 종결) ` +
      `순변화 ${topConsequence.netChangedStates}개 — ${topConsequence.topDeltas.join(" | ")} · 새 목적 ${topConsequence.newGoals.slice(0, 3).join(" ")}`,
);

// --- DoD 5 : 저중요도 변화가 사건으로 승격되지 않는다 (§29) ------------------------------
const promotion = measurePromotion(runtime, [
  "action.rest",
  "action.eat",
  "action.move",
  "action.trade",
  "action.attack",
  "action.gossip",
]);
const routine = promotion.byAction.filter((entry) => ["action.rest", "action.eat", "action.move", "action.trade"].includes(entry.actionId));
const dramatic = promotion.byAction.filter((entry) => ["action.attack", "action.gossip"].includes(entry.actionId));
const routineRate =
  routine.reduce((sum, e) => sum + e.assigned, 0) / Math.max(1, routine.reduce((sum, e) => sum + e.total, 0));
const dramaticRate =
  dramatic.reduce((sum, e) => sum + e.assigned, 0) / Math.max(1, dramatic.reduce((sum, e) => sum + e.total, 0));
check(
  routineRate < 0.25 && dramaticRate > routineRate * 2 && promotion.assignedChanges < promotion.totalChanges * 0.5,
  "평시 변화는 사건이 되지 않는다 (§29 중요도 하한)",
  `전체 change ${promotion.totalChanges}건 중 사건 소속 ${promotion.assignedChanges}건(${(promotion.assignedChanges / promotion.totalChanges * 100).toFixed(0)}%) · ` +
    `평시 ${promotion.byAction.filter((e) => routine.includes(e)).map((e) => `${e.actionId.split(".")[1]} ${e.assigned}/${e.total}`).join(" ")} → ${(routineRate * 100).toFixed(0)}% · ` +
    `사건성 ${dramatic.map((e) => `${e.actionId.split(".")[1]} ${e.assigned}/${e.total}`).join(" ")} → ${(dramaticRate * 100).toFixed(0)}% · ` +
    `중요도 ${promotion.lowestSignificance.toFixed(0)}~${promotion.highestSignificance.toFixed(0)} 중 임계 ${SIGNIFICANCE_THRESHOLD} 미만 ${promotion.hiddenEvents}건 숨김 / ${promotion.shownEvents}건 표시`,
);

// --- DoD 6 : 동일 시드 재실행 시 동일 사건 목록 (§44-12) ---------------------------------
const eventsAgain = summarizeEvents(again);
const eventsOther = summarizeEvents(other);
const eventHash = hashValue(summarizeEvents(runtime));
check(
  hashValue(eventsAgain) === eventHash && hashValue(eventsOther) !== eventHash,
  "동일 시드 재실행 시 동일 사건 목록 / 다른 시드는 다름",
  `시드 ${worldSeed} 사건 ${events.length}건 해시 ${eventHash} · 재실행 ${eventsAgain.length}건 ${hashValue(eventsAgain)} · 시드 ${worldSeed + 1} ${eventsOther.length}건 ${hashValue(eventsOther)}`,
);

// =====================================================================================
// Phase 5 — 세계 생성 컴파일러 (§42-5)
// =====================================================================================
phase = 5;

const generationPort = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS);
const compiled = await compileWorld({
  port: generationPort,
  seedInput: FIRST_WORLD_SEED_INPUT,
  worldSeed,
  worldId: FIRST_WORLD_ID,
});
const generated = compiled.definition;

// --- DoD 1 : §41 의 5개 주제 입력에서 §41 의 10항목이 생성된다 --------------------------
const firstWorldItems = checkFirstWorldItems(generated);
check(
  firstWorldItems.every((item) => item.ok),
  `§41 다섯 문장 → 10항목 자동 생성 (${firstWorldItems.filter((i) => i.ok).length}/${firstWorldItems.length})`,
  firstWorldItems.map((item) => `\n      ${item.ok ? "✓" : "✗"} ${item.item}: ${item.evidence}`).join(""),
);

// --- DoD 2 : §40 규모 표 --------------------------------------------------------------
const scaleRows = checkScale(generated, PROTOTYPE_SCALE);
check(
  scaleRows.every((row) => row.ok),
  `§40 규모 표 충족 (${scaleRows.filter((r) => r.ok).length}/${scaleRows.length})`,
  scaleRows.map((row) => `${row.ok ? "" : "✗"}${row.item} ${row.actual}/${row.target}`).join(" · "),
);

// --- DoD 3 : 생성된 세계가 사람 손질 없이 로드되어 30일 실행된다 -------------------------
// 수정 라운드(§42-6)는 사람의 손질이 아니라 생성 기계의 일부다 — 올리는 것은 그 통과본이다.
// 1라운드 원본은 §34 가 이미 잡아 둔 결함(파생 상태에 값을 쓰는 규칙)을 안고 있어 실행 중에 멈출 수 있다.
// 그 사실을 감추지 않고 같은 줄에 남긴다.
const repairPort = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS, undefined, FIRST_WORLD_REPAIRS);
const repaired = await compileWithRepair({
  port: repairPort,
  seedInput: FIRST_WORLD_SEED_INPUT,
  worldSeed,
  worldId: FIRST_WORLD_ID,
  days,
});

interface DefinitionRun {
  host: InlineHost;
  /** 로드나 실행이 멈춘 이유 (없으면 완주) */
  error: string | undefined;
}

async function runDefinitionForDays(definition: typeof generated): Promise<DefinitionRun> {
  const host = new InlineHost();
  try {
    const responses = await host.request({ type: "initialize_world", worldSeed, definition });
    const failed = responses.find((response) => response.type === "error");
    if (failed !== undefined && failed.type === "error") return { host, error: failed.message.split("\n")[0] };
    await host.request({ type: "advance_time", amount: days * TICKS_PER_DAY });
    return { host, error: undefined };
  } catch (error) {
    return { host, error: error instanceof Error ? error.message.split("\n")[0] : String(error) };
  }
}

const rawRun = await runDefinitionForDays(generated);
const repairedRun = await runDefinitionForDays(repaired.definition);
const generatedHost = repairedRun.host;
const initError = repairedRun.error;
const generatedRuntime = generatedHost.server.inspectRuntime();
const generatedEvents = generatedRuntime === undefined ? [] : eventsBySignificance(generatedRuntime);
const generatedPatterns =
  generatedRuntime === undefined ? [] : eventCountsByPattern(generatedRuntime).filter((entry) => entry.count > 0);
const generatedActors = new Set(
  (generatedRuntime?.state.changeLog ?? []).map((change) => change.sourceId).filter((id) => id !== undefined),
);
check(
  initError === undefined && generatedRuntime !== undefined && generatedEvents.length > 0,
  `생성 정의를 사람이 손대지 않고 런타임에 올려 ${days}일 실행 (수정 라운드 ${repaired.rounds.length}회 통과본 · 1라운드 원본의 검증 이슈 ${compiled.issues.length}건)`,
  generatedRuntime === undefined
    ? `초기화 실패: ${initError ?? "런타임 없음"}`
    : `개체 ${Object.keys(generatedRuntime.state.entities).length}개 · 행동 주체 ${generatedActors.size}명 · change ${generatedRuntime.state.changeLog.length}건 · ` +
      `사건 ${generatedEvents.length}건 [${generatedPatterns.map((p) => `${p.patternId.replace("pattern.", "")}:${p.count}`).join(" ")}]` +
      `\n      1라운드 원본(수정 전): ${rawRun.error === undefined ? "30일 완주" : `실행 중 중단 — ${rawRun.error}`} (§34 가 미리 보고한 결함이다)`,
);

// --- DoD 4 : 능력이 개인의 욕망·경험·제약에서 파생되고 대가를 갖는다 (§16, §44-11) -------
const abilityRows = summarizeAbilities(generated.abilitySystem?.abilities ?? []);
check(
  abilityRows.length === PROTOTYPE_SCALE.abilityUsers &&
    abilityRows.every((row) => row.restrictions > 0 && row.hasBacklash) &&
    costsGrowWithOutput(abilityRows),
  "능력 5개가 욕망에서 파생 · 전부 제약과 실패 반동을 가짐 · 출력이 클수록 대가가 큼",
  abilityRows
    .map((row) => `${row.id.replace("ability.", "")}(${row.owner.replace("agent.", "")}) 출력 ${row.output}/대가 ${row.costWeight}/제약 ${row.restrictions}종 ← "${row.derivedFrom}"`)
    .join("\n      "),
);

// --- DoD 5 : 모든 생성 호출이 구조화 입력만 받는다 (§33) ---------------------------------
check(
  compiled.telemetry.violations.length === 0 && generationPort.maxInputBytes < MAX_INPUT_BYTES,
  "생성 호출에 월드 상태 전체가 실리지 않는다 (구조화 입력 계약)",
  `호출 ${generationPort.calls.length}회 · 최대 입력 ${generationPort.maxInputBytes}B (상한 ${MAX_INPUT_BYTES}B) · 위반 ${compiled.telemetry.violations.length}건 · ` +
    `평균 ${Math.round(generationPort.calls.reduce((sum, call) => sum + call.inputBytes, 0) / generationPort.calls.length)}B`,
);

// --- DoD 6 : mock 포트로 파이프라인 전체가 오프라인 실행된다 ------------------------------
const stepsOk = compiled.steps.filter((step) => step.status !== "failed").length;
const resumed = await compileWorld({
  port: new RecordedTextGenerationPort({}), // 녹화 없는 포트 — 전부 아티팩트에서 재개된다
  seedInput: FIRST_WORLD_SEED_INPUT,
  worldSeed,
  worldId: FIRST_WORLD_ID,
  resumeFrom: compiled.artifacts,
});
check(
  // 재개본은 원본과 **같은 세계**여야 한다 — 이슈까지 같다(원본이 안고 있던 §12 라벨 누락도 그대로 재현된다)
  stepsOk === 15 &&
    hashValue(resumed.issues) === hashValue(compiled.issues) &&
    hashValue(resumed.definition) === hashValue(generated),
  "15단계 전부 오프라인 실행 · 아티팩트에서 재개하면 같은 세계",
  `단계 ${stepsOk}/15 · 생성 호출 ${generationPort.calls.length}회(재시도 ${generationPort.calls.filter((c) => c.hadPreviousErrors).length}회) · ` +
    `아티팩트 ${compiled.artifacts.list().length}개 · 재개 시 호출 0회, 정의 해시 ${hashValue(resumed.definition)} 동일 · 검증 이슈 ${resumed.issues.length}건 동일`,
);

// =====================================================================================
// Phase 6 — 자동 검증과 수정 (§34, §35, §42-6)
// =====================================================================================
phase = 6;

// --- DoD 1 : §34 필수 규칙 10개가 각각 위반 픽스처를 error 로 검출한다 --------------------
const fixtures = runViolationFixtures(worldSeed);
check(
  fixtures.every((fixture) => fixture.detected) && fixtures.length === SEMANTIC_CODES.length,
  `§34 필수 규칙 ${SEMANTIC_CODES.length}종이 각각 위반 세계를 잡는다 (${fixtures.filter((f) => f.detected).length}/${fixtures.length})`,
  fixtures
    .map(
      (fixture) =>
        `\n      ${fixture.detected ? "✓" : "✗"} ${fixture.code} — ${fixture.title}\n        → ${fixture.message.slice(0, 130)}`,
    )
    .join(""),
);

// --- DoD 2 : 수동 세계가 정적 검증 + §35 테스트를 통과한다 -------------------------------
const manualValidation = validateManualWorld(worldSeed);
check(
  manualValidation.ok,
  `수동 세계가 §34 정적 검증을 통과 (의미 검사 ${manualValidation.checks.filter((c) => c.ok).length}/${manualValidation.checks.length} · 오류 ${manualValidation.errorCount})`,
  `${manualValidation.schema.ok ? "✓" : "✗"} 스키마 층 — ${manualValidation.schema.evidence}` +
    manualValidation.checks.map((c) => `\n      ${c.ok ? "✓" : "✗"} ${c.code} — ${c.evidence}`).join(""),
);

const manualSim = await runSimulationTest({ worldSeed, days });
const manualBaseline = compareToSimulationBaseline(manualSim);
check(
  manualSim.ok && manualBaseline.every((row) => row.ok),
  `수동 세계가 §35 최소 테스트 ${manualSim.verdicts.length}항을 통과 (${manualSim.verdicts.filter((v) => v.ok).length}/${manualSim.verdicts.length})`,
  manualSim.verdicts.map((v) => `\n      ${v.ok ? "✓" : "✗"} ${v.code} ${v.title} — ${v.evidence}`).join("") +
    `\n      다양성 ${manualSim.diversityScore.toFixed(2)} = 행동 ${manualSim.metrics.uniqueActionTypes}×0.2 + 사건종류 ${manualSim.metrics.uniqueEventTypes}×0.3 + ` +
    `참여조합 ${manualSim.metrics.uniqueParticipantCombinations}×0.3 + 상태갈래 ${manualSim.metrics.changedStateCategories}×0.2` +
    `\n      깊이 ${manualSim.depthScore.toFixed(2)} = 목적/사건 ${manualSim.metrics.averageGoalsPerEvent.toFixed(2)}×0.25 + 시스템/사건 ${manualSim.metrics.averageAffectedSystemsPerEvent.toFixed(2)}×0.25 + ` +
    `정보비대칭 ${manualSim.metrics.informationAsymmetryRate.toFixed(2)}×0.2 + 지속 ${manualSim.metrics.consequenceDurationScore.toFixed(2)}×0.3` +
    `\n      기준선(${SIMULATION_BASELINE.worldId}) 대비 — ${manualBaseline.map((r) => `${r.ok ? "✓" : "✗"}${r.item} ${r.actual.toFixed(2)}/${r.baseline.toFixed(2)}`).join(" · ")}`,
);

// --- DoD 3 : §41 생성 세계가 수정 루프를 거쳐 합격한다 (repaired 는 Phase 5 DoD 3 에서 만든다) ---
const generatedSim = repaired.finalSimulation;
const generatedBaseline = generatedSim === undefined ? [] : compareToSimulationBaseline(generatedSim);
check(
  repaired.accepted && generatedBaseline.every((row) => row.ok),
  `§41 생성 세계가 ${repaired.rounds.length}라운드 만에 합격 (상한 3)`,
  repaired.rounds
    .map(
      (round) =>
        `\n      라운드 ${round.round}: 정적 오류 ${round.validation.errorCount} · 시뮬 ${round.simulation === undefined ? "미실행" : round.simulation.ok ? "합격" : `불합격(${round.simulation.verdicts.filter((v) => !v.ok).map((v) => v.code).join(",")})`}` +
        (round.accepted
          ? " → 공개 가능"
          : `\n        ✗ ${round.issues.map((issue) => `${issue.code}:${issue.targetId}`).join(" ")}` +
            `\n        → ${round.restartFrom ?? "-"}단계부터 재생성 (원인 단계 ${round.targetSteps.join(",")}) · 수정 ${round.applied.map((a) => a.taskId).join(", ") || "없음"}` +
            round.applied.map((a) => `\n          · ${a.note}`).join("")),
    )
    .join("") +
    (generatedSim === undefined
      ? ""
      : `\n      최종: 주체 ${generatedSim.activeAgents}명 전원 행동 · 사건 ${generatedSim.totalEvents}건(${generatedSim.metrics.uniqueEventTypes}종) · ` +
        `다양성 ${generatedSim.diversityScore.toFixed(2)} 깊이 ${generatedSim.depthScore.toFixed(2)} — 기준선 대비 ${generatedBaseline.map((r) => `${r.ok ? "✓" : "✗"}${r.item}`).join(" ")}`),
);

// --- G-1 : 생성 세계의 확률도 §12 5용도 안에 있다 -----------------------------------------
const generatedChance = auditChanceUses([
  { name: "첫 세계(생성)", rules: repaired.definition.ruleDefinitions },
]);
const chanceRepairRounds = repaired.rounds.filter((round) =>
  round.applied.some((entry) => entry.note.includes("§12 용도 라벨")),
);
check(
  generatedChance.totalUnlabeled === 0 && generatedChance.totalViolations === 0,
  `생성 세계의 확률 지점 ${generatedChance.totalSites}개 전부 용도 보유 — 라벨 없음 ${generatedChance.totalUnlabeled}건 · 위반 ${generatedChance.totalViolations}건`,
  `용도별 ${Object.entries(generatedChance.worlds[0]?.byUse ?? {})
    .map(([use, count]) => `${use} ${count}`)
    .join(" · ")} — 생성 AI 의 첫 응답에는 라벨이 없었고 ${chanceRepairRounds.map((round) => `${round.round}라운드`).join("·") || "(없음)"}의 수정 녹화가 채웠다(§42-6)`,
);

// --- G-3 : §41 초기 상태 6항이 실행 데이터로 배치됐다 -------------------------------------
const placements = checkInitialPlacements(repaired.definition);
check(
  placements.every((entry) => entry.ok),
  `§41 초기 상태 6항이 실행 데이터로 배치 (${placements.filter((entry) => entry.ok).length}/6 — 은닉 동기 2건은 hiddenGoalIds 연결)`,
  placements.map((entry) => `\n      ${entry.ok ? "✓" : "✗"} ${entry.item}: ${entry.evidence}`).join(""),
);

// --- G-3 : 은닉 목적이 관찰자 시점 금지 사실이 된다 (§17, §30, §33.3) ---------------------
const outsiderRequest = buildObservationNarration(runtime, "agent.kael", "faction.research_society");
const outsiderForbidden = outsiderRequest.unknownFacts.filter(
  (fact) => fact.sentence.includes("실제 목적") || fact.sentence.includes("몰래 좇는 목적"),
);
const insiderRequest = buildObservationNarration(runtime, "agent.mar", "faction.silent_village");
const insiderForbidden = insiderRequest.unknownFacts.filter((fact) => fact.sentence.includes("실제 목적"));
check(
  outsiderForbidden.length >= 2 && insiderForbidden.length === 0,
  "조직 은닉 목적이 외부 관찰자에게 금지 사실이 된다 · 내부자는 제외 (누출 시 §33.3 검사가 문장을 폐기)",
  `외부(사냥꾼→연구회) 금지 ${outsiderForbidden.length}건 — "${outsiderForbidden[0]?.sentence ?? ""}" · 내부(지도자→마을) 금지 ${insiderForbidden.length}건`,
);

// --- DoD 4 : 시뮬레이션 판정이 결정론적이다 ----------------------------------------------
const simAgain = await runSimulationTest({ worldSeed, days });
const simOther = await runSimulationTest({ worldSeed: worldSeed + 1, days });
const oneShot = new InlineHost();
await oneShot.request({ type: "initialize_world", worldSeed });
await oneShot.request({ type: "advance_time", amount: days * TICKS_PER_DAY });
const oneShotHash = hashValue(oneShot.server.inspectRuntime()?.state.changeLog);
check(
  simAgain.resultHash === manualSim.resultHash &&
    simOther.resultHash !== manualSim.resultHash &&
    oneShotHash === manualSim.logHash,
  "같은 입력 → 같은 SimulationTestResult · 하루씩 나눈 실행이 한 번에 진행한 세계와 동일",
  `시드 ${worldSeed} 판정 해시 ${manualSim.resultHash} · 재실행 ${simAgain.resultHash} · 시드 ${worldSeed + 1} ${simOther.resultHash} · ` +
    `30×1일 로그 ${manualSim.logHash} = 1×${days}일 로그 ${oneShotHash}`,
);

// --- DoD 5 : AI 보조 검사가 꺼져 있어도 파이프라인이 완결된다 (§33.2) ----------------------
const auditOff = await auditWorld(repaired.definition);
const auditOn = await auditWorld(repaired.definition, new RecordedTextGenerationPort(FIRST_WORLD_AUDIT_CORPUS));
check(
  !auditOff.enabled &&
    auditOff.issues.length === 0 &&
    auditOff.checks.every((entry) => entry.skipped) &&
    auditOn.checks.every((entry) => !entry.skipped) &&
    auditOn.issues.every((issue) => issue.level === "warning"),
  `§33.2 AI 보조 검사 ${auditOn.checks.length}종 — 켜면 경고만 내고, 꺼도 파이프라인이 완결된다`,
  `꺼짐: 검사 ${auditOff.checks.length}종 전부 건너뜀 · 이슈 ${auditOff.issues.length}건 (게이트 영향 없음)` +
    auditOn.checks
      .map((entry) => `\n      ✓ ${entry.code} 대상 ${entry.asked}건 → 지적 ${entry.findings.length}건`)
      .join("") +
    (auditOn.issues.length === 0
      ? ""
      : `\n      경고(error 로 승격하지 않음): ${auditOn.issues.map((issue) => `${issue.targetId}`).join(", ")}`),
);

// =====================================================================================
// Phase 7 — 플레이어 개입 (§30, §31, §32, §42-7)
// =====================================================================================
phase = 7;

// 개입은 수동 세계 위에 플레이어 층을 얹은 세계에서 본다 (§35 무개입 판정의 기준선을 건드리지 않는다)
const active = await runPlayerScenario({ worldSeed, days });
const passive = await runPlayerScenario({ worldSeed, days, passive: true });
// §29 6번째 항 — 조작 주체가 없는 수동 세계에서는 0 이어야 한다 (Phase 4 기준선이 움직이지 않는 이유)
const noPlayerRelevance = events.filter((event) => event.significanceBreakdown.playerRelevance > 0).length;

// --- DoD 1 : §30 참여 방식 4개 이상 + "아무것도 하지 않는다" --------------------------
check(
  active.performedModes.length >= 4 && passive.completedActionCount === 0 && passive.changeCount > 0 && passive.eventCount > 0,
  `§30 참여 방식 ${active.performedModes.length}종을 실제 조작으로 수행 · 방관도 유효`,
  active.attempts
    .map(
      (attempt) =>
        `\n      ${attempt.accepted ? "✓" : "✗"} ${attempt.day}일 ${attempt.label} → ${attempt.actionId}` +
        `${attempt.targetIds.length > 0 ? `(${attempt.targetIds.join(",")})` : ""}` +
        `${attempt.approach ? " — 사거리 밖이라 먼저 다가감" : ""}${attempt.reason === undefined ? "" : ` — ${attempt.reason}`}`,
    )
    .join("") +
    `\n      개입: 행동 ${active.completedActionCount}회 · change ${active.changeCount}건 · 사건 ${active.eventCount}건` +
    `\n      방관: 행동 ${passive.completedActionCount}회인데도 change ${passive.changeCount}건 · 사건 ${passive.eventCount}건 · NPC 성장 ${passive.npcGrowth.length}건 — 세계는 플레이어를 기다리지 않는다` +
    `\n      두 세계의 로그 해시 ${active.logHash} ≠ ${passive.logHash} — 개입이 세계를 갈랐다`,
);

// --- DoD 2 : 같은 사건에 전투·협상·정보·거래 개입이 모두 있다 (§44-8) -------------------
check(
  (active.intervention?.categories.length ?? 0) >= 4,
  "같은 사건에 전투·협상·정보·거래 개입이 모두 존재 (§44-8)",
  active.intervention === undefined
    ? "네 갈래가 모두 열린 사건 없음"
    : `${active.intervention.eventId}(${active.intervention.type}) — ${active.intervention.categories.join(" / ")}\n      개입 후보 ${active.intervention.interactions.length}종 [${active.intervention.interactions.join(" ")}]`,
);

// --- DoD 3 : 미발견 개체·미관찰 사실이 화면에 실리지 않는다 (§36.3) ----------------------
const beastProbe = active.beliefProbes.find(
  (probe) => probe.subjectId === BEAST && probe.stateKey === "aggression",
);
check(
  active.leaks.length === 0 &&
    active.hiddenLeaks.length === 0 &&
    active.hiddenStateCount > 0 &&
    beastProbe !== undefined,
  "플레이어 화면 데이터가 믿음·감각을 넘지 않는다 (UI 없이 판정)",
  `${days}일 동안 표시 사실 ${active.auditedFacts}건 감사 · 위반 ${active.leaks.length}건 · ` +
    `관찰 불가 상태 ${active.hiddenStateCount}종 중 노출 ${active.hiddenExposedCount}종\n` +
    `      마지막 화면의 출처별 사실 — ${Object.entries(active.factsBySource).map(([source, count]) => `${source} ${count}`).join(" · ")}\n` +
    `      실제 ≠ 표시 ${active.beliefProbes.length}건 (화면은 세계가 아니라 믿음을 보여준다): ` +
    active.beliefProbes
      .slice(0, 3)
      .map((probe) => `${probe.subjectId}.${probe.stateKey} 실제 ${probe.real} → 표시 ${probe.shown}(확신 ${probe.confidence.toFixed(2)})`)
      .join(" / "),
);

// --- DoD 4 : 플레이어 전용 실행 경로가 없다 (§21) -----------------------------------------
const playerFreeSources = PLAYER_FREE_MODULES.map((relative) => ({
  path: relative,
  source: readFileSync(new URL(`../core/agents/${relative}`.replace("/./", "/"), import.meta.url), "utf8"),
}));
const playerBranches = findPlayerBranches(playerFreeSources);
check(
  playerBranches.length === 0 && active.executionPaths.length > 0 && active.executionPaths.every((entry) => entry.same),
  "플레이어 행동이 NPC 와 같은 규칙 경로로 처리된다 (전용 효과 코드 없음)",
  `규칙·행동·판단 ${playerFreeSources.length}개 모듈에 플레이어 분기 ${playerBranches.length}건 ${playerBranches.join(",")}\n` +
    `      (§31 이 허용한 유일한 분기는 AgentRuntime.shouldReplan 한 줄 — "행동 선택을 시스템이 아니라 사용자가 한다")\n` +
    active.executionPaths
      .map(
        (entry) =>
          `      ${entry.same ? "✓" : "✗"} ${entry.actionId}: 플레이어 [${entry.playerRules.map((r) => r.replace("rule.", "")).join(",")}] ⊆ NPC [${entry.npcRules.map((r) => r.replace("rule.", "")).join(",")}]`,
      )
      .join("\n"),
);

// --- DoD 5 : 개입이 사건 결과·관계·후속 목적으로 남는다 (§44-9·10) --------------------------
check(
  active.consequence !== undefined &&
    active.consequence.netChangedStates > 0 &&
    active.consequence.newGoals.length > 0 &&
    active.consequence.relationshipShifts.length > 0 &&
    active.playerRelevantEvents > 0 &&
    noPlayerRelevance === 0,
  "플레이어가 참여한 사건이 세계 상태·관계·후속 목적을 바꿨다",
  active.consequence === undefined
    ? "플레이어가 참여자로 들어간 사건 없음"
    : `${active.consequence.eventId}(${active.consequence.type}) 순변화 ${active.consequence.netChangedStates}개\n` +
      `      상태 — ${active.consequence.topDeltas.join(" | ")}\n` +
      `      관계 — ${active.consequence.relationshipShifts.join(" | ")}\n` +
      `      새 목적 ${active.consequence.newGoals.length}건 — ${active.consequence.newGoals.slice(0, 4).join(" ")}\n` +
      `      §29 playerRelevance — 조작 세계에서 ${active.playerRelevantEvents}/${active.eventCount}건에 가산 · 조작 주체가 없는 수동 세계에서는 ${noPlayerRelevance}/${events.length}건 (기준선 불변의 근거)`,
);

// --- DoD 6 : 성장이 수치 증가 + 선택 구조로 발생하고 GrowthChange 로 기록된다 (§32) ----------
const numericGrowth = active.growth.filter((change) => typeof change.newValue === "number");
const accepted = active.acceptedOffer;
check(
  numericGrowth.length > 0 &&
    accepted !== undefined &&
    accepted.abilityAfter.restrictions > accepted.abilityBefore.restrictions &&
    accepted.abilityAfter.outputMax > accepted.abilityBefore.outputMax &&
    active.growth.every((change) => change.sourceEventId.length > 0) &&
    active.npcGrowth.length > 0,
  `§32 성장 — 플레이어 ${active.growth.length}건 · NPC ${active.npcGrowth.length}건 (같은 규칙, §21)`,
  active.growth
    .map(
      (change) =>
        `\n      ${tickToDay(change.at)}일 [${change.type}] ${change.key} ${String(change.previousValue)} → ${String(change.newValue)}` +
        ` ← ${change.ruleId.replace("rule.", "")} @${change.sourceEventId}${change.optionId === undefined ? "" : ` (선택 ${change.optionId})`}`,
    )
    .join("") +
    (accepted === undefined
      ? "\n      선택형 성장 없음"
      : `\n      선택 구조 — "${accepted.restriction}" 를 받아들여 능력 제약 ${accepted.abilityBefore.restrictions}→${accepted.abilityAfter.restrictions}종, ` +
        `출력 상한 ${accepted.abilityBefore.outputMax}→${accepted.abilityAfter.outputMax} (§11.4 제약이 무거울수록 출력이 크다)`) +
    `\n      출처 사건 없는 성장 ${active.growth.filter((c) => c.sourceEventId.length === 0).length}건 · 저널 ${active.journalSize}줄 ` +
    `(${Object.entries(active.journalKinds).map(([kind, count]) => `${kind} ${count}`).join(" · ")})`,
);

// --- G-4 : §15 종족 생존 구조가 세계를 움직인다 -------------------------------------------
const speciesStructure = measureSpeciesStructure(worldSeed);
check(
  speciesStructure.every((row) => row.ok),
  `§15 종족 생존 구조 ${speciesStructure.filter((row) => row.ok).length}/${speciesStructure.length} 항이 실행에 소비된다 (선언이 아니라 차이로 증명)`,
  speciesStructure
    .map((row) => `\n      ${row.ok ? "✓" : "✗"} ${row.field} [${row.consumer}] — ${row.evidence}`)
    .join(""),
);

// --- G-5 : §13 조건부 통행 — 같은 두 지역, 사람에 따라 다른 길 ---------------------------
const RIDGE_THRESHOLD = Number((RESIDUE_RIDGE.requirements?.[0]?.right as { value?: unknown } | undefined)?.value ?? 0);
const passage = measureConditionalPassage(active.runtime, "creature.echo_beast_mother");
const opened = passage.filter((row) => row.open);
const closed = passage.filter((row) => !row.open);
check(
  opened.length > 0 && closed.length > 0 && opened.every((row) => row.knownThreatLevel >= RIDGE_THRESHOLD),
  `§13 조건부 통행 — 잔재 능선이 ${opened.length}명에게 열리고 ${closed.length}명에게 닫힌다 (통행 조건 ${RESIDUE_RIDGE.requirements?.length ?? 0}개: known_threat_level ≥ ${String((RESIDUE_RIDGE.requirements?.[0]?.right as { value?: unknown } | undefined)?.value ?? "?")})`,
  passage
    .map(
      (row) =>
        `\n      ${row.open ? "열림" : "닫힘"} ${row.agentId.replace(/^(agent|creature)\./, "")} — 아는 위협 ${row.knownThreatLevel} · 숲까지 ${row.travelTicks ?? "-"}틱`,
    )
    .join("") + `\n      길은 둘이다: 큰길(이동 120) · 잔재 능선(이동 ${RESIDUE_RIDGE.travelCost}, 조건부) — 조건을 갖춘 주체만 싼 길을 쓴다`,
);

// --- G-5 : §13 지역 프로필이 지도 재료로 나온다 -------------------------------------------
const ecologyScene = buildScenePayload(active.runtime, { mode: "developer" });
const ecologyRegions = ecologyScene.map.regions.filter((region) => region.ecology.resources.length > 0);
const gatedConnections = ecologyScene.map.connections.filter((connection) => connection.gated);
check(
  ecologyRegions.length === ecologyScene.map.regions.length &&
    ecologyRegions.every((region) => region.ecology.species.length > 0) &&
    gatedConnections.length > 0,
  `§13 지역 프로필이 지도 ViewModel 로 나온다 — 자원 프로필 ${ecologyRegions.length}/${ecologyScene.map.regions.length} 지역 · 조건부 연결 ${gatedConnections.length}`,
  ecologyRegions
    .map(
      (region) =>
        `\n      ${region.label} — 자원 ${region.ecology.resources.map((r) => `${r.label}×${r.nodeCount}(희귀도 ${r.rarity})`).join(" ")} · 종 적합도 ${region.ecology.species.map((s) => `${s.label} ${s.suitability}`).join(" ")}`,
    )
    .join(""),
);

// --- G-7 : §18 초기 기억·소지품이 실행 상태로 시작한다 -------------------------------------
const memoryRows = measureInitialMemories(worldSeed);
const inventoryRows = measureInventory(worldSeed);
check(
  memoryRows.length > 0 &&
    memoryRows.every((row) => row.ok) &&
    inventoryRows.length > 0 &&
    inventoryRows.every((row) => row.ok),
  `§18 초기 기억 ${memoryRows.filter((r) => r.ok).length}/${memoryRows.length}명 · 소지품 ${inventoryRows.filter((r) => r.ok).length}/${inventoryRows.length}건이 실행 데이터로 시작한다`,
  memoryRows
    .map((row) => `\n      ${row.ok ? "✓" : "✗"} ${row.agentId.replace(/^(agent|creature)\./, "")} — ${row.evidence}`)
    .join("") +
    `\n      소지품 — ${inventoryRows.map((row) => `${row.agentId.replace(/^(agent|creature)\./, "")}:${row.resourceId.replace("resource.", "")}→${row.stateKey} ${row.stored}`).join(" · ")}` +
    `\n      (소지 상태 직접 지정 0건 — 선언은 inventory, 변환은 부트스트랩, 읽는 쪽은 거래·소비 규칙 그대로)`,
);

// --- G-11 : §4 사용자 입력 4필드가 결과에 책임진다 -----------------------------------------
const seedMeta = repaired.definition.metadata;
const seedContract = auditOn.checks.find((entry) => entry.code === "audit.seed-contract");
const seedDesired = FIRST_WORLD_SEED_INPUT.desiredExperiences ?? [];
const seedProhibited = FIRST_WORLD_SEED_INPUT.prohibitedElements ?? [];
check(
  seedMeta.title === FIRST_WORLD_SEED_INPUT.title &&
    seedMeta.seedInput?.themes.length === FIRST_WORLD_SEED_INPUT.themes.length &&
    seedContract !== undefined &&
    !seedContract.skipped &&
    seedContract.asked === seedDesired.length + seedProhibited.length,
  `§4 사용자 입력 4필드 책임 — title 반영 · 주제 ${seedMeta.seedInput?.themes.length ?? 0}문장 정규화 강제 · 경험/금지 ${seedContract?.asked ?? 0}문장 감사`,
  `title "${FIRST_WORLD_SEED_INPUT.title}" → metadata.title "${seedMeta.title}" (하드코딩 제거 — 다른 제목을 넣으면 다른 이름의 세계가 나온다, 테스트 증명)\n` +
    `      themes ${FIRST_WORLD_SEED_INPUT.themes.length}문장 — 1단계가 수·원문 일치를 오류로 강제 (기존)\n` +
    `      desiredExperiences ${seedDesired.length} + prohibitedElements ${seedProhibited.length} → audit.seed-contract 가 문장 단위로 되물음 — 위반 ${seedContract?.findings.length ?? 0}건 (경고 전용, §33.2 규약)`,
);

// --- G-9 : §29 저중요도 필터 — 사소한 사건은 플레이어 화면에서 접힌다 -----------------------
const filterDevScene = buildScenePayload(active.runtime, { mode: "developer" });
const filterPlayerScene = buildScenePayload(active.runtime, { mode: "player", observerId: active.playerId });
const filterKnowledge = buildPlayerKnowledgeView(active.runtime, active.playerId);
const lowShown = filterPlayerScene.events.filter((item) => item.significance < SIGNIFICANCE_THRESHOLD);
const lowShownAreMine = lowShown.every((item) =>
  active.runtime.state.events.events.find((event) => event.id === item.eventId)?.participants.includes(active.playerId),
);
check(
  filterDevScene.suppressedEventCount === 0 &&
    filterPlayerScene.suppressedEventCount > 0 &&
    filterPlayerScene.events.length + filterPlayerScene.suppressedEventCount <= filterDevScene.events.length &&
    lowShownAreMine &&
    filterKnowledge.suppressedEventCount > 0,
  `§29 저중요도 필터 — 플레이어 사건 목록 ${filterPlayerScene.events.length}건 표시 · ${filterPlayerScene.suppressedEventCount}건 접힘 (임계 ${SIGNIFICANCE_THRESHOLD})`,
  `개발자 화면 ${filterDevScene.events.length}건 전부 표시(접힘 0 — 디버그 진실) / 플레이어 화면 ${filterPlayerScene.events.length}건 + 접힘 ${filterPlayerScene.suppressedEventCount}건\n` +
    `      임계 미만인데 보이는 사건 ${lowShown.length}건 — 전부 플레이어가 참여한 사건(내 일은 사소해도 남는다)\n` +
    `      개입 브리핑(§30)도 같은 필터 — 표시 ${filterKnowledge.events.length}건 · 접힘 ${filterKnowledge.suppressedEventCount}건, 접힌 사실은 수로 남아 화면이 숨김을 숨기지 않는다`,
);

// --- G-8 : §25 비밀이 기록되고 소비된다 ---------------------------------------------------
const secretMeasures = measureSecrets(worldSeed);
check(
  secretMeasures.ok,
  `§25 knownSecrets — 초기 ${secretMeasures.initialSecrets.length}건 · 발각의 기록 · 협박의 지렛대 (같은 협박이 비밀 유무로 갈린다)`,
  secretMeasures.initialSecrets
    .map((entry) => `\n      초기 비밀 — ${entry.fromId.replace(/^agent\./, "")} → ${entry.toId}: "${entry.secret}"`)
    .join("") +
    `\n      같은 거짓말 ${secretMeasures.lieAttempts}회 → 발각이 남긴 비밀 ${secretMeasures.secretsFromLies}건 (record_secret, §12 partial_outcome)` +
    `\n      같은 협박 — 비밀 없이 공포 +${secretMeasures.fearWithoutSecret} / 비밀을 쥐고 +${secretMeasures.fearWithSecret} (rule.blackmail_leverage — known_secrets 조건)`,
);

// --- G-6 : §14 자원의 과도 사용에는 결과가 있다 -------------------------------------------
const manualWorld = buildManualWorld(worldSeed);
const overuseRows = measureResourceOveruse(worldSeed);
const overuseCheck = manualValidation.checks.find((entry) => entry.code === "resource.overuse");
check(
  overuseRows.every((row) => row.ok) &&
    overuseCheck !== undefined &&
    overuseCheck.ok &&
    manualWorld.resources.every((resource) => (resource.overuseRules ?? []).length > 0),
  `§14 자원 ${overuseRows.filter((row) => row.ok).length}/${manualWorld.resources.length}종의 과용 반동이 실행된다 (과잉/정상 대조로 증명)`,
  overuseRows
    .map((row) => `\n      ${row.ok ? "✓" : "✗"} ${row.resourceId.replace("resource.", "")} [${row.ruleId.replace("rule.", "")}] — ${row.evidence}`)
    .join("") +
    `\n      §34 resource.overuse — ${overuseCheck?.evidence ?? "검사기 없음"}`,
);

// --- G-10 : §32 성장 발생 조건 7종이 전부 규칙으로 존재한다 ------------------------------
const growthConditions = checkGrowthConditions([...active.growth, ...active.npcGrowth], worldSeed);
check(
  growthConditions.every((row) => row.declared),
  `§32 성장 발생 조건 ${growthConditions.filter((row) => row.declared).length}/7 이 규칙으로 존재 · 30일 조작에서 발화한 조건 ${growthConditions.filter((row) => row.fired > 0).length}종`,
  growthConditions
    .map(
      (row) =>
        `\n      ${row.declared ? "✓" : "✗"} ${row.plan} — ${row.ruleId.replace("rule.growth_", "")}` +
        ` (${row.fired > 0 ? `${row.fired}회 발화` : "이 시드에서는 미발화"})`,
    )
    .join(""),
);

// --- DoD 7 : 개입이 있어도 같은 시드면 같은 세계다 (§44-12) ---------------------------------
const activeAgain = await runPlayerScenario({ worldSeed, days });
const activeOther = await runPlayerScenario({ worldSeed: worldSeed + 1, days });
check(
  activeAgain.logHash === active.logHash && activeOther.logHash !== active.logHash,
  "같은 시드·같은 조작 → 같은 로그 / 다른 시드는 다름",
  `시드 ${worldSeed} 해시 ${active.logHash}(${active.changeCount}건) · 재실행 ${activeAgain.logHash} · 시드 ${worldSeed + 1} ${activeOther.logHash}`,
);

// =====================================================================================
// Phase 8 — 표현 고도화 (§36 4개 화면, §33.3 Event Interpreter, §42-8, §44 최종 게이트)
// =====================================================================================
phase = 8;

// 화면은 개입 시나리오가 끝난 그 세계를 그린다 — 보고에 실린 수치와 화면의 수치가 같은 출처를 갖는다
const sceneRuntime = active.runtime;
const topEvent = eventsBySignificance(sceneRuntime)[0];
const sceneFocus = {
  agentId: PLAYER_AGENT,
  ...(topEvent === undefined ? {} : { eventId: topEvent.id }),
};
const developerScene = buildScenePayload(sceneRuntime, { mode: "developer", ...sceneFocus });
const playerScene = buildScenePayload(sceneRuntime, { mode: "player", ...sceneFocus });
// "현재 행동" 표시는 지금 무언가를 하고 있는 주체로 판정한다 (쉬는 주체에게 행동이 없는 것은 정상이다)
const actingId = sceneRuntime.agentIds().find((id) => sceneRuntime.agentRuntime(id).currentAction !== null);
const actingScene =
  actingId === undefined
    ? undefined
    : buildScenePayload(sceneRuntime, { mode: "developer", agentId: actingId });

// --- DoD 1 : §36 네 화면이 명세 항목을 전부 표시한다 ------------------------------------
const screenItems = checkScreenItems(developerScene, playerScene, {
  steps: compiled.steps.length,
  scaleRows: scaleRows.length,
  artifacts: compiled.artifacts.list().length,
  inputs: 3,
}, actingScene?.agentPanel);
const screensByGroup = new Map<string, { ok: number; total: number }>();
for (const row of screenItems) {
  const group = screensByGroup.get(row.screen) ?? { ok: 0, total: 0 };
  group.total += 1;
  if (row.ok) group.ok += 1;
  screensByGroup.set(row.screen, group);
}
check(
  screenItems.every((row) => row.ok),
  `§36 네 화면 명세 항목 ${screenItems.filter((row) => row.ok).length}/${screenItems.length} 표시 ` +
    `(${[...screensByGroup.entries()].map(([group, stat]) => `${group} ${stat.ok}/${stat.total}`).join(" · ")})`,
  screenItems.map((row) => `\n      ${row.ok ? "✓" : "✗"} ${row.screen} ${row.item} — ${row.evidence}`).join(""),
);

// --- DoD 2 : 렌더러는 SceneViewModel 밖의 타입을 모른다 ---------------------------------
const rendererImports = checkRendererImports("src/rendering");
const rendererViolations = rendererImports.flatMap((report) =>
  report.violations.map((specifier) => `${report.file}→${specifier}`),
);
check(
  rendererViolations.length === 0 && rendererImports.length > 0,
  `rendering/ ${rendererImports.length}개 파일이 SceneViewModel 밖의 타입을 import 하지 않는다 (린트로도 상시 강제)`,
  rendererImports
    .map((report) => `${report.file}(${report.imports.length}건)`)
    .join(" · ") + (rendererViolations.length === 0 ? "" : `\n      위반 ${rendererViolations.join(", ")}`),
);

// --- DoD 3 : 텍스트 덤프 렌더러와 Canvas 렌더러가 같은 ViewModel 로 동작한다 ------------
const parity = checkRendererParity(sceneOf(developerScene));
check(
  parity.missingInCanvas.length === 0 && parity.missingInText.length === 0 && parity.canvasOps > 0,
  "같은 SceneViewModel → Canvas 렌더러 + 텍스트 덤프 렌더러 (표현 교체 시 rendering/ 밖 diff 0)",
  `Canvas 그리기 ${parity.canvasOps}회(문자 ${parity.canvasTexts}) · 텍스트 ${parity.textLines}줄 · ` +
    `두 표현이 함께 실은 표시 대상 ${parity.sharedKeys.length}개 · 누락 Canvas ${parity.missingInCanvas.length} / 텍스트 ${parity.missingInText.length}`,
);

// --- DoD 4 : 개발자 모드 = 실제+믿음 병렬 / 플레이어 모드 = 관찰된 것만 ------------------
const contrast = compareModes(sceneRuntime, BEAST, topEvent?.id);
check(
  contrast.developerActualRows > 0 &&
    contrast.playerActualRows === 0 &&
    contrast.playerHidden > 0 &&
    contrast.leaks.length === 0 &&
    contrast.playerMarkers <= contrast.developerMarkers,
  `§36.3 모드 전환은 빌더의 입력이다 — 같은 세계·같은 주체(${BEAST.split(".")[1]})의 두 시점`,
  `개발자: 상태 ${contrast.developerRows}항(실제값 ${contrast.developerActualRows}) · 어긋남 ${contrast.divergentRows}항 · ` +
    `사건 ${contrast.developerEvents}건 · 지도 주체 ${contrast.developerMarkers}명\n` +
    `      플레이어: 상태 ${contrast.playerRows}항(실제값 ${contrast.playerActualRows}) · 감춰짐 ${contrast.playerHidden}종 · ` +
    `사건 ${contrast.playerEvents}건 · 지도 주체 ${contrast.playerMarkers}명 · 필터 위반 ${contrast.leaks.length}건\n` +
    `      개발자 모드에서만 보이는 어긋남 — ` +
    (contrast.divergences.slice(0, 3).map((entry) => `${entry.key} 실제 ${entry.actual} ≠ 믿음 ${entry.believed}`).join(" / ") || "없음"),
);

// --- DoD 5 : 사건 화면에서 "알려진 정보" 와 "실제 원인" 이 분리된다 ----------------------
const devDetail = developerScene.eventDetail;
const playerDetail = playerScene.eventDetail;
check(
  devDetail !== undefined &&
    devDetail.causeVisible &&
    devDetail.actualCauses.length > 0 &&
    playerDetail !== undefined &&
    !playerDetail.causeVisible &&
    playerDetail.actualCauses.length === 0,
  "§36.4 알려진 정보 ↔ 실제 원인 분리 표시",
  devDetail === undefined
    ? "사건 상세 없음"
    : `${devDetail.eventId}(${devDetail.type}) "${devDetail.title}"\n` +
      `      개발자 — 실제 원인 ${devDetail.actualCauses.length}줄: ${devDetail.actualCauses[0] ?? ""}\n` +
      `      플레이어 — 실제 원인 ${playerDetail?.actualCauses.length ?? 0}줄 (감춰짐) · 아는 사실 ${playerDetail?.knownFacts.length ?? 0}건 · ` +
      `아는 참여자 ${playerDetail?.knownParticipantCount ?? 0} / 모르는 참여자 ${playerDetail?.unknownParticipantCount ?? 0}\n` +
      `      결과 ${devDetail.results.length}항 · 타임라인 ${devDetail.timeline.length}줄 · 개입 기록 ${playerDetail?.interventions.length ?? 0}건 · 후속 ${devDetail.followUps.length}건`,
);

// --- DoD 6·7 : unknownFacts 누출 0 + AI 포트 없이 전 화면 동작 ---------------------------
const narration = await auditNarration(sceneRuntime, PLAYER_AGENT);
check(
  narration.leaks.length === 0 && narration.withForbidden > 0 && narration.rejectedFromPort > 0,
  `§33.3 표현 생성 6종 — 금지 사실 누출 ${narration.leaks.length}건 (검사한 문장 ${narration.sentences}개)`,
  `요청 ${narration.requests}건 중 금지 사실을 가진 요청 ${narration.withForbidden}건 · 금지 사실 총 ${narration.forbiddenFacts}개 ` +
    `(막을 것이 있었다는 증거)\n` +
    `      누출 포트를 붙였을 때 폐기된 문장 ${narration.rejectedFromPort}개 — 새는 문장이 화면에 오르는 경로가 없다\n` +
    `      캐시 적중 ${narration.cacheHits}/${narration.requests} · 예시 제목 ${narration.sampleTitles.map((title) => `"${title}"`).join(" ")}`,
);

const templateOnlyScreens = [
  developerScene.eventDetail?.title,
  developerScene.eventDetail?.summarySentence,
  developerScene.eventDetail?.rumor,
  developerScene.eventDetail?.document,
  developerScene.agentPanel?.narration[0],
  developerScene.events[0]?.title,
];
check(
  templateOnlyScreens.every((text) => text !== undefined && text.length > 0),
  "AI 포트 없이(템플릿 폴백) 전 화면이 문장을 갖는다 (§2.1 표현 계층 분리)",
  templateOnlyScreens
    .map((text, index) => `${["사건 제목", "사건 요약", "소문", "문서", "관찰 묘사", "목록 제목"][index]} ${text === undefined || text.length === 0 ? "✗" : `"${text.slice(0, 34)}…"`}`)
    .join(" · "),
);

// --- DoD 8 : §44 프로토타입 완료 조건 13항 (최종 게이트) --------------------------------
const browserHost = new InlineHost();
const bootResponses = await browserHost.request({ type: "initialize_world", worldSeed, world: "manual" });
const tickResponses = await browserHost.request({ type: "advance_time", amount: TICKS_PER_DAY });
const boundaryOk =
  bootResponses.some((response) => response.type === "world_initialized") &&
  bootResponses.some((response) => response.type === "scene_view") &&
  tickResponses.some((response) => response.type === "state_patch") &&
  tickResponses.some((response) => response.type === "scene_view");

const gate = evaluateGate44({
  manual: runtime,
  player: {
    runtime: sceneRuntime,
    playerId: PLAYER_AGENT,
    logHash: active.logHash,
    repeatLogHash: activeAgain.logHash,
    otherSeedLogHash: activeOther.logHash,
    interventionCategories: active.intervention?.categories ?? [],
    growthCount: active.growth.length,
    performedModes: active.performedModes,
  },
  generated: {
    definition: generated,
    themeCount: FIRST_WORLD_SEED_INPUT.themes.length,
    stepCount: compiled.artifacts.list().length,
    storedBytes: compiled.repository.load(FIRST_WORLD_ID) === undefined ? 0 : JSON.stringify(compiled.repository.load(FIRST_WORLD_ID)).length,
    reloadedId: compiled.repository.load(FIRST_WORLD_ID)?.metadata.id,
    scaleOk: scaleRows.every((row) => row.ok),
    expectationsOk: firstWorldItems.every((entry) => entry.ok),
  },
  scene: { developer: developerScene, player: playerScene },
  browserRoundTrip: {
    ok: boundaryOk,
    evidence:
      `§38 프로토콜 왕복 — initialize_world → state_patch/scene_view, advance_time(+1일) → patch ${
        tickResponses.filter((response) => response.type === "state_patch").length
      }건 · 화면 재료 동봉 (브라우저 실물 왕복은 npm run smoke 가 판정한다)`,
  },
  days,
  agentIds: AGENTS,
});
check(
  gate.every((row) => row.ok),
  `§44 프로토타입 완료 조건 ${gate.filter((row) => row.ok).length}/13 통과 — 최종 게이트`,
  gate.map((row) => `\n      ${row.ok ? "✓" : "✗"} ${String(row.index).padStart(2)}. ${row.title}\n         ${row.evidence}`).join(""),
);

// --- 출력 ---------------------------------------------------------------------------
for (const current of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
  const section = rows.filter((row) => row.phase === current);
  const label =
    current === 1
      ? "Phase 1 완료 조건"
      : current === 2
        ? "Phase 2 완료 조건 — 규칙 DSL"
        : current === 3
          ? "Phase 3 완료 조건 — 주체 판단"
          : current === 4
            ? "Phase 4 완료 조건 — 사건 탐지"
            : current === 5
              ? "Phase 5 완료 조건 — 세계 생성 컴파일러"
              : current === 6
                ? "Phase 6 완료 조건 — 자동 검증과 수정"
                : current === 7
                  ? "Phase 7 완료 조건 — 플레이어 개입"
                  : "Phase 8 완료 조건 — 표현 고도화 + §44 최종 게이트";
  console.log(`\n=== ${label} 점검 — 시드 ${worldSeed}, ${days}일 ===\n`);
  for (const row of section) {
    console.log(`${row.ok ? "✓" : "✗"} ${row.title}`);
    console.log(`    ${row.evidence}`);
  }
  const sectionFailed = section.filter((row) => !row.ok).length;
  console.log(
    `\n  ${section.length - sectionFailed}/${section.length} 통과${sectionFailed > 0 ? ` — ${sectionFailed}항 실패` : ""}`,
  );
}

const failed = rows.filter((row) => !row.ok).length;
console.log(`\n합계 ${rows.length - failed}/${rows.length} 통과${failed > 0 ? ` — ${failed}항 실패` : ""}`);
if (failed > 0) process.exitCode = 1;
