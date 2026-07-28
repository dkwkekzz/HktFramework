// [임시] 규칙 이관 동일성 검사 — 코드 규칙(Phase 1) vs DSL 규칙(Phase 2) 의 30일 change 로그 diff.
// 이관이 끝나면 이 스크립트와 HandwrittenRules 는 삭제되고, migration-baseline.json 이 그 자리를 지킨다.
import { buildManualWorld } from "../content/manual-world";
import { InlineHost } from "../core/simulation/InlineHost";
import { SimulationLoop } from "../core/simulation/SimulationLoop";
import { createWorldSystems } from "../core/simulation/WorldSystems";
import { HANDWRITTEN_RULES } from "../core/rules/HandwrittenRules";
import { RuleRegistry } from "../core/rules/RuleRegistry";
import type { RuleEngine } from "../core/rules/RuleEngine";
import { bootstrapWorld } from "../core/world/WorldBootstrap";
import { WorldRuntime } from "../core/world/WorldRuntime";
import type { RawWorldChange } from "../shared/change";
import { hashValue } from "../shared/hash";
import { TICKS_PER_DAY } from "../shared/time";

const DAYS = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 30);
const SEED = Number(process.argv.find((a) => a.startsWith("--seed="))?.split("=")[1] ?? 42);

/** Phase 1 의 배선 그대로 — state_changed 연쇄 8회, entity_entered/schedule_rule 없음 */
type LegacyWiring = Pick<
  RuleEngine,
  | "intervalRules"
  | "runInterval"
  | "dispatchStateChange"
  | "dispatchAction"
  | "dispatchEntityEntered"
  | "runScheduled"
  | "drainStateChanges"
>;

function legacyEngine(rules: RuleRegistry): RuleEngine {
  const wiring: LegacyWiring = {
    intervalRules: rules.intervalRules as unknown as RuleEngine["intervalRules"],
    runInterval: (runtime, ruleId) => rules.runInterval(runtime, ruleId),
    dispatchStateChange: (runtime, change) => rules.dispatchStateChange(runtime, change),
    dispatchAction: (runtime, actionId, actorId, targetIds) =>
      rules.dispatchAction(runtime, actionId, actorId, targetIds),
    dispatchEntityEntered: () => undefined,
    runScheduled: () => undefined,
    drainStateChanges: (runtime) => {
      for (let round = 0; round < 8; round++) {
        const changes = runtime.store.takeStateChanges();
        if (changes.length === 0) return round;
        for (const change of changes) rules.dispatchStateChange(runtime, change);
      }
      return 8;
    },
  };
  return wiring as unknown as RuleEngine;
}

function runLegacy(seed: number, days: number): WorldRuntime {
  const definition = buildManualWorld(seed);
  const runtime = new WorldRuntime(definition);
  const systems = createWorldSystems(legacyEngine(new RuleRegistry(HANDWRITTEN_RULES)));
  const loop = new SimulationLoop(systems.hooks);
  systems.registerHandlers(loop);
  bootstrapWorld(runtime);
  systems.scheduleInitialEvents(runtime);
  loop.advance(runtime, days * TICKS_PER_DAY);
  return runtime;
}

async function runDsl(seed: number, days: number): Promise<WorldRuntime> {
  const host = new InlineHost();
  const responses = await host.request({ type: "initialize_world", worldSeed: seed });
  const error = responses.find((r) => r.type === "error");
  if (error !== undefined) throw new Error(JSON.stringify(error));
  await host.request({ type: "advance_time", amount: days * TICKS_PER_DAY });
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");
  return runtime;
}

function describe(change: RawWorldChange): string {
  const states = change.changedStates
    .map((s) => `${s.entityId}.${s.stateKey}: ${JSON.stringify(s.before)}→${JSON.stringify(s.after)}`)
    .join(" | ");
  return `t=${change.time} src=${change.sourceId ?? "-"} tgt=[${change.targetIds.join(",")}] tags=[${change.tags.join(",")}] ${states}`;
}

const legacy = runLegacy(SEED, DAYS);
const dsl = await runDsl(SEED, DAYS);
const a = legacy.state.changeLog;
const b = dsl.state.changeLog;

console.log(`코드 규칙 : ${a.length}건 hash=${hashValue(a)}`);
console.log(`DSL 규칙  : ${b.length}건 hash=${hashValue(b)}`);

let diffs = 0;
for (let i = 0; i < Math.max(a.length, b.length) && diffs < 5; i++) {
  const left = a[i];
  const right = b[i];
  if (left !== undefined && right !== undefined && hashValue(left) === hashValue(right)) continue;
  diffs++;
  console.log(`\n--- 첫 불일치 #${i} ---`);
  console.log(`  코드: ${left === undefined ? "(없음)" : describe(left)}`);
  console.log(`  DSL : ${right === undefined ? "(없음)" : describe(right)}`);
}
console.log(diffs === 0 ? "\n✓ 완전 일치" : `\n✗ 불일치 ${diffs}건 이상`);
