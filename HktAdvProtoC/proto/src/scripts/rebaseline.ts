// 실행 기준선 재고정 (Phase 3 — 판단 교체로 실행 흐름이 바뀐 시점)
// 실행: npx vite-node src/scripts/rebaseline.ts
//
// Phase 2 의 기준선은 "코드 규칙 → DSL 규칙" 이관이 세계를 바꾸지 않았음을 증명했다(그 기록은 previous 에 보존한다).
// Phase 3 은 주체 판단 자체를 교체했으므로 같은 로그가 나올 수 없다 — 기준선을 여기서 다시 고정하고,
// 이후로는 "같은 시드에서 같은 30일이 재현되는가"(§39·§44-12)를 지키는 회귀 기준선으로 쓴다.
import { writeFileSync } from "node:fs";
import { InlineHost } from "../core/simulation/InlineHost";
import { BASELINE_DAYS, BASELINE_SEEDS, MIGRATION_BASELINE, summarizeRun } from "../core/rules/migrationBaseline";
import { TICKS_PER_DAY } from "../shared/time";

const runs: Record<string, unknown> = {};
for (const seed of BASELINE_SEEDS) {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed: seed });
  await host.request({ type: "advance_time", amount: BASELINE_DAYS * TICKS_PER_DAY });
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");
  runs[String(seed)] = summarizeRun(runtime);
  console.log(`시드 ${seed} 재고정 완료`);
}

const document = {
  source: "Phase 3 주체 판단(§20·§22·§23) 교체 후 재고정 — 이후 회귀 기준선",
  previous: MIGRATION_BASELINE.previous ?? {
    source: MIGRATION_BASELINE.source,
    runs: Object.fromEntries(
      Object.entries(MIGRATION_BASELINE.runs).map(([seed, run]) => [
        seed,
        { logHash: run.logHash, changeCount: run.changeCount, entityHash: run.entityHash },
      ]),
    ),
  },
  migratedRuleIds: MIGRATION_BASELINE.migratedRuleIds ?? Object.keys(MIGRATION_BASELINE.runs["42"]?.ruleChangeCounts ?? {}),
  days: BASELINE_DAYS,
  runs,
};

const target = new URL("../content/manual-world/migration-baseline.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
console.log(`기준선 갱신: ${target.pathname}`);
