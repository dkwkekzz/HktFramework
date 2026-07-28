// 완료 조건 자동 점검 (CLAUDE.md — "검토 결과는 직관적으로 확인 가능하게 보고한다")
// 실행: npm run verify [-- --seed=42 --days=30]
//
// 각 Phase 의 DoD 를 여기에 항목으로 더한다. 이 스크립트 한 줄의 출력이 곧 검토 보고다.
import { findBelief } from "../core/agents/BeliefStore";
import { InlineHost } from "../core/simulation/InlineHost";
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

const rows: { ok: boolean; title: string; evidence: string }[] = [];
function check(ok: boolean, title: string, evidence: string): void {
  rows.push({ ok, title, evidence });
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
const chainDays = chain.map((step) => step.day);
const chainOk =
  chainDays.every((day) => day !== undefined) &&
  chainDays.every((day, i) => i === 0 || day! >= chainDays[i - 1]!);
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

// --- 출력 ---------------------------------------------------------------------------
console.log(`\n=== Phase 1 완료 조건 점검 — 시드 ${worldSeed}, ${days}일 ===\n`);
for (const row of rows) {
  console.log(`${row.ok ? "✓" : "✗"} ${row.title}`);
  console.log(`    ${row.evidence}`);
}

const failed = rows.filter((row) => !row.ok).length;
console.log(`\n${rows.length - failed}/${rows.length} 통과${failed > 0 ? ` — ${failed}항 실패` : ""}`);
if (failed > 0) process.exitCode = 1;
