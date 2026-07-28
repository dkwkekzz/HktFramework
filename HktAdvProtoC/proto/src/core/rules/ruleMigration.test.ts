// 실행 기준선 회귀 (Phase 2 이관 증명 → Phase 3 재고정)
//
// Phase 2 는 "코드 규칙 == DSL 규칙"을 30일 로그 동일성으로 증명했고, 그 기록은 기준선 문서의
// previous 에 남아 있다. Phase 3 이 주체 판단을 교체하면서 실행 흐름 자체가 바뀌었으므로
// 기준선을 재고정했다(npx vite-node src/scripts/rebaseline.ts).
// 지금 이 파일이 지키는 것은 두 가지다.
//   ① 같은 시드의 30일은 언제 실행해도 같은 로그다 (§39, §44-12)
//   ② Phase 2 가 이관한 규칙 20개가 여전히 세계에 살아 있다
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
  MIGRATED_RULE_IDS,
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

describe("실행 기준선 회귀 (§42-2, §44-12)", () => {
  for (const seed of BASELINE_SEEDS) {
    it(`시드 ${seed} — ${BASELINE_DAYS}일 실행이 기준선과 같다`, async () => {
      const comparison = compareToBaseline(seed, summarizeRun(await run(seed)));
      expect(comparison.differences.join("\n")).toBe("");
      expect(comparison.summary.changeCount).toBeGreaterThan(1000);
    });
  }

  it("Phase 2 의 이관 증명 기록이 보존되어 있다", () => {
    // 기준선은 Phase 3·4 에서 재고정됐지만, "코드 규칙 == DSL 규칙" 이었던 사실은 previous 에 남는다
    expect(MIGRATION_BASELINE.source).toMatch(/Phase [34]/);
    expect(MIGRATION_BASELINE.previous?.source).toMatch(/HandwrittenRules/);
    expect(Object.keys(MIGRATION_BASELINE.previous?.runs ?? {})).toHaveLength(BASELINE_SEEDS.length);
    expect(Object.keys(MIGRATION_BASELINE.runs)).toHaveLength(BASELINE_SEEDS.length);
    expect(MIGRATED_RULE_IDS).toHaveLength(20);
  });

  it("규칙은 JSON 에만 존재한다 — 코드 규칙 모듈이 남아 있지 않다", () => {
    const legacy = new URL("./HandwrittenRules.ts", import.meta.url);
    expect(existsSync(legacy), "HandwrittenRules.ts 가 아직 있다 (이관 미완)").toBe(false);
    // Phase 2 가 이관한 20개는 그대로 살아 있고, Phase 3 이 관계·조직·생태 규칙을 더했다
    const ids = buildManualWorld(1).ruleDefinitions.map((rule) => rule.id);
    for (const migrated of MIGRATED_RULE_IDS) expect(ids).toContain(migrated);
    expect(ids.length).toBeGreaterThanOrEqual(MIGRATED_RULE_IDS.length);
  });
});
