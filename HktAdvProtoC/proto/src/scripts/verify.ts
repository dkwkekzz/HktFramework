// 완료 조건 자동 점검 (CLAUDE.md — "검토 결과는 직관적으로 확인 가능하게 보고한다")
// 실행: npm run verify [-- --seed=42 --days=30]
//
// 각 Phase 의 DoD 를 여기에 항목으로 더한다. 이 스크립트 한 줄의 출력이 곧 검토 보고다.
import { existsSync, readFileSync } from "node:fs";
import { findBelief } from "../core/agents/BeliefStore";
import { MEMORY_CAPACITY } from "../core/agents/MemorySystem";
import { compareHearsayConfidence, measureGoalConflict } from "../core/agents/phase3Checks";
import { runAbilityChecks } from "../core/rules/abilityChecks";
import { runCapabilityChecks } from "../core/rules/capabilities";
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
import type { RawWorldChange } from "../shared/change";
import { hashValue } from "../shared/hash";
import { TICKS_PER_DAY, tickToDay } from "../shared/time";
import type { WorldRuntime } from "../core/world/WorldRuntime";

const BEAST = "creature.echo_beast_mother";
const VILLAGE = "faction.silent_village";
const AGENTS = ["agent.kael", "agent.mar", "agent.ren", "agent.rion", BEAST];

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
  phase: 1 | 2 | 3;
  ok: boolean;
  title: string;
  evidence: string;
}
const rows: Row[] = [];
let phase: 1 | 2 | 3 = 1;
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

// --- 출력 ---------------------------------------------------------------------------
for (const current of [1, 2, 3] as const) {
  const section = rows.filter((row) => row.phase === current);
  const label =
    current === 1
      ? "Phase 1 완료 조건"
      : current === 2
        ? "Phase 2 완료 조건 — 규칙 DSL"
        : "Phase 3 완료 조건 — 주체 판단";
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
