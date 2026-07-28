// Phase 2 DoD — Phase 1 규칙 20개의 DSL 이관 동일성 (Phase-2 "Phase 1 규칙 이관")
//
// 이관 전 코드 규칙의 30일 실행 결과는 migration-baseline.json 에 굳어 있다.
// DSL 규칙이 그와 **완전히** 같은 change 로그를 내는지가 이 파일의 전부다.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { InlineHost } from "../simulation/InlineHost";
import { TICKS_PER_DAY } from "../../shared/time";
import type { WorldRuntime } from "../world/WorldRuntime";
import {
  BASELINE_DAYS,
  BASELINE_SEEDS,
  compareToBaseline,
  MIGRATION_BASELINE,
  summarizeRun,
} from "./migrationBaseline";

async function run(seed: number): Promise<WorldRuntime> {
  const host = new InlineHost();
  const responses = await host.request({ type: "initialize_world", worldSeed: seed });
  const failure = responses.find((r) => r.type === "error");
  expect(failure, JSON.stringify(failure)).toBeUndefined();
  await host.request({ type: "advance_time", amount: BASELINE_DAYS * TICKS_PER_DAY });
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");
  return runtime;
}

describe("규칙 이관 동일성 (§42-2)", () => {
  for (const seed of BASELINE_SEEDS) {
    it(`시드 ${seed} — DSL 규칙 ${BASELINE_DAYS}일이 코드 규칙 기준선과 같다`, async () => {
      const comparison = compareToBaseline(seed, summarizeRun(await run(seed)));
      expect(comparison.differences.join("\n")).toBe("");
      expect(comparison.summary.changeCount).toBeGreaterThan(1000);
    });
  }

  it("기준선은 코드 규칙 실행에서 나왔다", () => {
    expect(MIGRATION_BASELINE.source).toMatch(/HandwrittenRules/);
    expect(Object.keys(MIGRATION_BASELINE.runs)).toHaveLength(BASELINE_SEEDS.length);
  });

  it("규칙은 JSON 에만 존재한다 — 코드 규칙 모듈이 남아 있지 않다", () => {
    const legacy = new URL("./HandwrittenRules.ts", import.meta.url);
    expect(existsSync(legacy), "HandwrittenRules.ts 가 아직 있다 (이관 미완)").toBe(false);
    expect(buildManualWorld(1).ruleDefinitions).toHaveLength(20);
  });
});
