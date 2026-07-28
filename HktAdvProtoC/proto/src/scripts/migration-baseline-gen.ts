// [임시] 이관 기준선 생성기 — 코드 규칙(HandwrittenRules.ts)이 살아 있는 동안 한 번만 돌린다.
//
// 왜 필요한가: Phase-2 는 "코드 규칙 30일 vs DSL 규칙 30일 change 로그 완전 일치"를 완료 조건으로 두고,
// 이관이 끝나면 HandwrittenRules.ts 를 삭제한다(설계 "Phase 1 규칙 이관"). 코드가 사라지면 diff 를
// 다시 돌릴 수 없으므로, 삭제 직전의 코드 규칙 실행 결과를 여기서 데이터로 굳혀 둔다.
// 이후 `npm run verify` 는 DSL 실행 결과를 이 기준선과 맞춰 본다 — 증명은 영구히 재현된다.
//
// 실행: npx vite-node src/scripts/migration-baseline-gen.ts > src/content/manual-world/migration-baseline.json
import { writeFileSync } from "node:fs";
import { buildManualWorld } from "../content/manual-world";
import { HANDWRITTEN_RULES } from "../core/rules/HandwrittenRules";
import { RuleRegistry } from "../core/rules/RuleRegistry";
import type { RuleEngine } from "../core/rules/RuleEngine";
import { SimulationLoop } from "../core/simulation/SimulationLoop";
import { createWorldSystems } from "../core/simulation/WorldSystems";
import { bootstrapWorld } from "../core/world/WorldBootstrap";
import { WorldRuntime } from "../core/world/WorldRuntime";
import { summarizeRun, BASELINE_DAYS, BASELINE_SEEDS } from "../core/rules/migrationBaseline";
import { TICKS_PER_DAY } from "../shared/time";

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
  const runtime = new WorldRuntime(buildManualWorld(seed));
  const systems = createWorldSystems(legacyEngine(new RuleRegistry(HANDWRITTEN_RULES)));
  const loop = new SimulationLoop(systems.hooks);
  systems.registerHandlers(loop);
  bootstrapWorld(runtime);
  systems.scheduleInitialEvents(runtime);
  loop.advance(runtime, days * TICKS_PER_DAY);
  return runtime;
}

const baseline = {
  source: "HandwrittenRules.ts (Phase 1 코드 규칙) — 삭제 직전 실행 결과",
  days: BASELINE_DAYS,
  runs: Object.fromEntries(
    BASELINE_SEEDS.map((seed) => [String(seed), summarizeRun(runLegacy(seed, BASELINE_DAYS))]),
  ),
};

writeFileSync(
  new URL("../content/manual-world/migration-baseline.json", import.meta.url),
  `${JSON.stringify(baseline, null, 2)}\n`,
);
console.log(`기준선 기록 완료 — 시드 ${BASELINE_SEEDS.join(", ")} / ${BASELINE_DAYS}일`);
