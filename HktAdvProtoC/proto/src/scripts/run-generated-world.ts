// 생성된 세계를 그대로 런타임에 올려 돌린다 (Phase-5 구현 스텝 6 · DoD 3)
// 실행: npm run sim:generated [-- --days=30 --seed=42]
//
// verify 는 이 경로를 한 줄로 판정한다. 이 스크립트는 그 안을 들여다보기 위한 것이다.
import { FIRST_WORLD_CORPUS, FIRST_WORLD_ID, FIRST_WORLD_SEED_INPUT } from "../content/first-world";
import { eventCountsByPattern, eventsBySignificance } from "../core/events/phase4Checks";
import { InlineHost } from "../core/simulation/InlineHost";
import { compileWorld } from "../generation/CompilerPipeline";
import { RecordedTextGenerationPort } from "../generation/RecordedTextGenerationPort";
import { TICKS_PER_DAY, tickToDay } from "../shared/time";

function arg(name: string, fallback: number): number {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found === undefined ? fallback : Number(found.split("=")[1]);
}

const worldSeed = arg("seed", 42);
const days = arg("days", 30);

const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS);
const compiled = await compileWorld({
  port,
  seedInput: FIRST_WORLD_SEED_INPUT,
  worldSeed,
  worldId: FIRST_WORLD_ID,
});
console.log(`생성 호출 ${port.calls.length}회 · 검증 이슈 ${compiled.issues.length}건`);
for (const issue of compiled.issues) {
  console.log(`  [${issue.level}] ${issue.targetId}: ${issue.message}`);
}
if (compiled.issues.length > 0) process.exit(1);

const host = new InlineHost();
const initResponses = await host.request({
  type: "initialize_world",
  worldSeed,
  definition: compiled.definition,
});
const initError = initResponses.find((response) => response.type === "error");
if (initError !== undefined && initError.type === "error") {
  console.log(`초기화 실패:\n${initError.message}`);
  process.exit(1);
}

await host.request({ type: "advance_time", amount: days * TICKS_PER_DAY });
const runtime = host.server.inspectRuntime();
if (runtime === undefined) throw new Error("런타임 없음");

const events = eventsBySignificance(runtime);
console.log(
  `\n${days}일 · 개체 ${Object.keys(runtime.state.entities).length}개 · ` +
    `change ${runtime.state.changeLog.length}건 · 사건 ${events.length}건`,
);
console.log(
  eventCountsByPattern(runtime)
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.patternId.replace("pattern.", "")}:${entry.count}`)
    .join(" "),
);
console.log("");
for (const event of events) {
  console.log(
    `${String(tickToDay(event.startedAt)).padStart(2)}~${String(tickToDay(event.lastChangeAt)).padStart(2)}일 ` +
      `${event.type.padEnd(22)} ${event.status.padEnd(9)} 중요도 ${event.significance.toFixed(0).padStart(5)} ` +
      `참여 ${String(event.participants.length).padStart(2)}`,
  );
}
