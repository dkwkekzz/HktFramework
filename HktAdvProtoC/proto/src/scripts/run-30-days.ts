// 30일 headless 실행 (Phase-1 구현 스텝 7, §35 자동 시뮬레이션 테스트의 전신)
// 실행: npm run sim [-- --seed=42 --days=30 --log]
import { eventCountsByPattern, eventsBySignificance } from "../core/events/phase4Checks";
import { InlineHost } from "../core/simulation/InlineHost";
import type { WorldSnapshotDocument } from "../core/simulation/RuntimeServer";
import { hashValue } from "../shared/hash";
import type { WorkerResponse } from "../shared/protocol";
import { TICKS_PER_DAY, tickToDay } from "../shared/time";

function arg(name: string, fallback: number): number {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found === undefined ? fallback : Number(found.split("=")[1]);
}

const worldSeed = arg("seed", 42);
const days = arg("days", 30);
const showLog = process.argv.includes("--log");

const host = new InlineHost();
await host.request({ type: "initialize_world", worldSeed });
for (let day = 0; day < days; day++) {
  await host.request({ type: "advance_time", amount: TICKS_PER_DAY });
}

const runtime = host.server.inspectRuntime()!;
const responses = await host.request({ type: "request_snapshot" });
const snapshot = responses.find(
  (r): r is Extract<WorkerResponse, { type: "snapshot" }> => r.type === "snapshot",
)!;

console.log(`=== ${worldSeed} 시드 / ${days}일 ===`);
console.log(`상태 해시: ${hashValue((snapshot.snapshot as WorldSnapshotDocument).snapshot)}`);

function num(agentId: string, key: string): number {
  const entity = runtime.store.entity(agentId);
  if (runtime.schemas.find(runtime.store.ownerTypeOf(entity), key) === undefined) return Number.NaN;
  return runtime.store.readNumber(agentId, key);
}

console.log("\n--- 주체 (개인·생물) ---");
for (const agentId of runtime.agentIds()) {
  const agent = runtime.agentRuntime(agentId);
  if (agent.kind === "faction") continue;
  const entity = runtime.store.entity(agentId);
  const goals = (entity.activeGoals ?? [])
    .slice(0, 2)
    .map((goal) => `${goal.goalId}(${goal.activation.toFixed(0)})`)
    .join(" ");
  console.log(
    [
      agentId.padEnd(28),
      `행동 ${String(agent.completedActionCount).padStart(3)}회`,
      `허기 ${num(agentId, "hunger").toFixed(0).padStart(3)}`,
      `체력 ${num(agentId, "health").toFixed(0).padStart(3)}`,
      `공포 ${num(agentId, "fear").toFixed(0).padStart(3)}`,
      `기억 ${String(agent.memories.length).padStart(2)}`,
      `${entity.position?.regionId ?? "-"}`,
      goals,
    ].join(" | "),
  );
  for (const belief of agent.beliefs.slice(0, 4)) {
    console.log(
      `    믿음 ${belief.subjectId}.${belief.stateKey} = ${String(belief.believedValue)} (확신 ${belief.confidence}, 근거 ${belief.sourceIds.join("/")})`,
    );
  }
}

console.log("\n--- 조직 (조직도 판단 주체다 §17) ---");
for (const factionId of runtime.agentIds().filter((id) => runtime.agentRuntime(id).kind === "faction")) {
  const factionRuntime = runtime.agentRuntime(factionId);
  const top = (runtime.store.entity(factionId).activeGoals ?? [])[0];
  console.log(
    `${factionId.padEnd(28)} 행동 ${String(factionRuntime.completedActionCount).padStart(3)}회 | 목적 ${top?.goalId ?? "-"}(${top?.activation.toFixed(0) ?? "-"}) | 믿음 ${factionRuntime.beliefs.length}건 | 식량 ${runtime.store.readNumber(factionId, "food_reserve").toFixed(1)} | 위협믿음 ${runtime.store.readNumber(factionId, "threat_belief").toFixed(0)} | 공포 ${runtime.store.readNumber(factionId, "fear").toFixed(0)} | 토벌 ${String(runtime.store.readBoolean(factionId, "subjugation_ordered"))}`,
  );
}

console.log("\n--- 반향수 실제 상태 (관찰되지 않는 진실) ---");
const beast = "creature.echo_beast_mother";
console.log(
  `공격성 ${runtime.store.readNumber(beast, "aggression")} | 새끼 위협도 ${runtime.store.readNumber(beast, "offspring_threat")} | 보호중 ${String(runtime.store.readBoolean(beast, "protecting_offspring"))}`,
);

// --- 탐지된 사건 (§28) — 아무도 작성하지 않은 사건 목록 ---
const events = eventsBySignificance(runtime);
console.log(`\n--- 탐지된 사건 ${events.length}건 (${eventCountsByPattern(runtime).map((e) => `${e.patternId.split(".")[1]}:${e.count}`).join(" ")}) ---`);
for (const event of events.slice(0, 10)) {
  const summary = event.summary;
  const conflictAgents = new Set(
    (summary?.goalConflicts ?? []).flatMap((conflict) => [conflict.left.agentId, conflict.right.agentId]),
  );
  console.log(
    [
      `${String(tickToDay(event.startedAt)).padStart(2)}~${String(tickToDay(event.lastChangeAt)).padStart(2)}일`,
      event.type.padEnd(20),
      event.status.padEnd(9),
      `중요도 ${String(Math.round(event.significance)).padStart(4)}`,
      `참여 ${String(event.participants.length).padStart(2)}`,
      `충돌주체 ${conflictAgents.size}`,
      `새목적 ${summary?.newlyActivatedGoals.length ?? 0}`,
      `변화 ${summary?.totalChangeCount ?? 0}건`,
    ].join(" | "),
  );
}

// 연쇄 확인용 마커 — 상태 변화 로그에서 굵직한 변화만 뽑는다
const markers = runtime.state.changeLog.filter((change) =>
  change.tags.some((tag) =>
    [
      "action.hunt",
      "action.trade",
      "action.report",
      "action.attack",
      "rule.village_food_consumption",
      "rule.subjugation_call",
      "observation",
    ].includes(tag),
  ),
);
console.log(`\n--- 상태 변화 로그 ${runtime.state.changeLog.length}건 (주요 ${markers.length}건) ---`);
if (showLog) {
  for (const change of markers) {
    const states = change.changedStates
      .map((s) => `${s.entityId}.${s.stateKey}: ${String(s.before)}→${String(s.after)}`)
      .join(", ");
    console.log(`${String(tickToDay(change.time)).padStart(2)}일 [${change.tags.join(" ")}] ${states}`);
  }
}
