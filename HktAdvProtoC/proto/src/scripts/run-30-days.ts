// 30일 headless 실행 (Phase-1 구현 스텝 7, §35 자동 시뮬레이션 테스트의 전신)
// 실행: npm run sim [-- --seed=42 --days=30 --log]
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

console.log("\n--- 주체 ---");
for (const agentId of runtime.agentIds()) {
  const agent = runtime.agentRuntime(agentId);
  const entity = runtime.store.entity(agentId);
  const goals = (entity.activeGoals ?? [])
    .slice(0, 2)
    .map((goal) => `${goal.goalId}(${goal.activation.toFixed(0)})`)
    .join(" ");
  console.log(
    [
      agentId.padEnd(28),
      `행동 ${String(agent.completedActionCount).padStart(3)}회`,
      `허기 ${runtime.store.readNumber(agentId, "hunger").toFixed(0).padStart(3)}`,
      `체력 ${runtime.store.readNumber(agentId, "health").toFixed(0).padStart(3)}`,
      `공포 ${runtime.store.readNumber(agentId, "fear").toFixed(0).padStart(3)}`,
      `위협인지 ${runtime.store.readNumber(agentId, "known_threat_level").toFixed(0).padStart(3)}`,
      `${entity.position?.regionId ?? "-"}`,
      goals,
    ].join(" | "),
  );
  for (const belief of agent.beliefs) {
    console.log(
      `    믿음 ${belief.subjectId}.${belief.stateKey} = ${String(belief.believedValue)} (확신 ${belief.confidence}, 근거 ${belief.sourceIds.join("/")})`,
    );
  }
}

console.log("\n--- 조직 ---");
for (const factionId of ["faction.silent_village", "faction.research_society"]) {
  console.log(
    `${factionId.padEnd(28)} 식량 ${runtime.store.readNumber(factionId, "food_reserve").toFixed(1)} | 위협믿음 ${runtime.store.readNumber(factionId, "threat_belief").toFixed(0)} | 공포 ${runtime.store.readNumber(factionId, "fear").toFixed(0)} | 토벌 ${String(runtime.store.readBoolean(factionId, "subjugation_ordered"))}`,
  );
}

console.log("\n--- 반향수 실제 상태 (관찰되지 않는 진실) ---");
const beast = "creature.echo_beast_mother";
console.log(
  `공격성 ${runtime.store.readNumber(beast, "aggression")} | 새끼 위협도 ${runtime.store.readNumber(beast, "offspring_threat")} | 보호중 ${String(runtime.store.readBoolean(beast, "protecting_offspring"))}`,
);

// 연쇄 확인용 마커 — 사건 로그에서 굵직한 변화만 뽑는다
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
console.log(`\n--- 사건 로그 ${runtime.state.changeLog.length}건 (주요 ${markers.length}건) ---`);
if (showLog) {
  for (const change of markers) {
    const states = change.changedStates
      .map((s) => `${s.entityId}.${s.stateKey}: ${String(s.before)}→${String(s.after)}`)
      .join(", ");
    console.log(`${String(tickToDay(change.time)).padStart(2)}일 [${change.tags.join(" ")}] ${states}`);
  }
}
