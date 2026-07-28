// [이관 커밋 한정] 코드 규칙 ↔ DSL 규칙 동일성 증명 (Phase-2 "Phase 1 규칙 이관").
//
// 이 파일은 HandwrittenRules.ts 가 아직 살아 있는 동안에만 존재한다.
// 여기서 ① 두 실행이 완전히 같다는 것과 ② migration-baseline.json 이 코드 규칙 실행에서
// 정확히 나왔다는 것을 함께 확인한다. 다음 커밋에서 코드 규칙과 이 파일은 지워지고,
// 그 뒤로는 ruleMigration.test.ts 가 기준선만으로 같은 증명을 이어 간다.
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { InlineHost } from "../simulation/InlineHost";
import { SimulationLoop } from "../simulation/SimulationLoop";
import { createWorldSystems } from "../simulation/WorldSystems";
import { hashValue } from "../../shared/hash";
import { TICKS_PER_DAY } from "../../shared/time";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import { HANDWRITTEN_RULES } from "./HandwrittenRules";
import { RuleRegistry } from "./RuleRegistry";
import type { RuleEngine } from "./RuleEngine";
import {
  BASELINE_DAYS,
  BASELINE_SEEDS,
  compareToBaseline,
  summarizeRun,
} from "./migrationBaseline";

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

/** Phase 1 의 배선 그대로 — state_changed 연쇄 8회, entity_entered/schedule_rule 없음 */
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

function runLegacy(seed: number): WorldRuntime {
  const runtime = new WorldRuntime(buildManualWorld(seed));
  const systems = createWorldSystems(legacyEngine(new RuleRegistry(HANDWRITTEN_RULES)));
  const loop = new SimulationLoop(systems.hooks);
  systems.registerHandlers(loop);
  bootstrapWorld(runtime);
  systems.scheduleInitialEvents(runtime);
  loop.advance(runtime, BASELINE_DAYS * TICKS_PER_DAY);
  return runtime;
}

async function runDsl(seed: number): Promise<WorldRuntime> {
  const host = new InlineHost();
  const responses = await host.request({ type: "initialize_world", worldSeed: seed });
  expect(responses.find((r) => r.type === "error")).toBeUndefined();
  await host.request({ type: "advance_time", amount: BASELINE_DAYS * TICKS_PER_DAY });
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");
  return runtime;
}

describe("코드 규칙 → DSL 규칙 이관 (§42-2)", () => {
  it("코드 규칙 20개와 JSON 규칙 20개가 같은 id 집합이다", () => {
    const code = HANDWRITTEN_RULES.map((rule) => rule.id).sort();
    const json = buildManualWorld(1).ruleDefinitions.map((rule) => rule.id).sort();
    expect(json).toEqual(code);
    expect(json).toHaveLength(20);
  });

  for (const seed of BASELINE_SEEDS) {
    it(`시드 ${seed} — ${BASELINE_DAYS}일 change 로그가 완전히 일치한다`, async () => {
      const legacy = runLegacy(seed).state.changeLog;
      const dsl = (await runDsl(seed)).state.changeLog;
      expect(dsl.length).toBe(legacy.length);
      expect(hashValue(dsl)).toBe(hashValue(legacy));
      // 해시가 같아도 어디서 갈렸는지 바로 보이도록 첫 불일치를 직접 찾는다
      const firstDiff = legacy.findIndex((change, i) => hashValue(change) !== hashValue(dsl[i]));
      expect(firstDiff).toBe(-1);
    });

    it(`시드 ${seed} — 기준선이 코드 규칙 실행에서 그대로 나왔다`, () => {
      expect(compareToBaseline(seed, summarizeRun(runLegacy(seed))).differences).toEqual([]);
    });
  }
});
