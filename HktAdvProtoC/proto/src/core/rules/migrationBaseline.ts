// 규칙 이관 기준선 (Phase-2 "Phase 1 규칙 이관" — 동일성 증명)
//
// 코드 규칙(HandwrittenRules.ts)은 이관과 함께 삭제됐다. 삭제 직전의 실행 결과를
// migration-baseline.json 에 굳혀 두고, DSL 실행이 그와 같은지 여기서 언제든 다시 확인한다.
// 기준선 재생성은 코드 규칙이 살아 있던 커밋에서만 가능하다 — 그래서 이 파일은 "읽고 맞춰 보기"만 한다.
import baselineDocument from "../../content/manual-world/migration-baseline.json";
import { hashValue } from "../../shared/hash";
import type { WorldRuntime } from "../world/WorldRuntime";

export const BASELINE_DAYS = 30;
export const BASELINE_SEEDS = [1, 42, 43];

const OBSERVED_AGENTS = ["agent.kael", "agent.mar", "agent.ren", "agent.rion", "creature.echo_beast_mother"];
const OBSERVED_AGENT_KEYS = [
  "health",
  "hunger",
  "energy",
  "fear",
  "aggression",
  "carried_food",
  "carried_residue",
  "wealth",
  "known_threat_level",
];
const VILLAGE = "faction.silent_village";
const VILLAGE_KEYS = ["food_reserve", "threat_belief", "subjugation_ordered", "fear"];

export interface RunSummary {
  changeCount: number;
  logHash: string;
  entityHash: string;
  /** 규칙별 변경 기록 수 — 어떤 규칙이 몇 번 세계를 바꿨는가 */
  ruleChangeCounts: Record<string, number>;
  agents: Record<string, Record<string, unknown>>;
  village: Record<string, unknown>;
  globals: Record<string, unknown>;
}

export interface MigrationBaseline {
  source: string;
  days: number;
  runs: Record<string, RunSummary>;
}

export const MIGRATION_BASELINE = baselineDocument as unknown as MigrationBaseline;

function readAll(runtime: WorldRuntime, entityId: string, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) result[key] = runtime.store.read(entityId, key);
  return result;
}

/** 30일 실행 하나를 비교 가능한 요약으로 줄인다 — 로그 해시 + 규칙별 횟수 + 최종 상태 */
export function summarizeRun(runtime: WorldRuntime): RunSummary {
  const log = runtime.state.changeLog;
  const ruleChangeCounts: Record<string, number> = {};
  for (const change of log) {
    for (const tag of change.tags) {
      if (!tag.startsWith("rule.")) continue;
      ruleChangeCounts[tag] = (ruleChangeCounts[tag] ?? 0) + 1;
    }
  }
  const sortedCounts = Object.fromEntries(
    Object.entries(ruleChangeCounts).sort(([a], [b]) => a.localeCompare(b)),
  );

  return {
    changeCount: log.length,
    logHash: hashValue(log),
    entityHash: hashValue(
      Object.keys(runtime.state.entities)
        .sort()
        .map((id) => runtime.state.entities[id]),
    ),
    ruleChangeCounts: sortedCounts,
    agents: Object.fromEntries(
      OBSERVED_AGENTS.map((id) => [id, readAll(runtime, id, OBSERVED_AGENT_KEYS)]),
    ),
    village: readAll(runtime, VILLAGE, VILLAGE_KEYS),
    globals: { food_price: runtime.store.readGlobal("food_price") },
  };
}

export interface BaselineComparison {
  seed: number;
  matches: boolean;
  differences: string[];
  summary: RunSummary;
  expected: RunSummary | undefined;
}

/** 실행 요약을 기준선과 맞춰 본다 — 어긋난 항목을 그대로 돌려준다(숨기지 않는다) */
export function compareToBaseline(seed: number, summary: RunSummary): BaselineComparison {
  const expected = MIGRATION_BASELINE.runs[String(seed)];
  if (expected === undefined) {
    return { seed, matches: false, differences: [`기준선에 시드 ${seed} 가 없다`], summary, expected };
  }
  const differences: string[] = [];
  if (expected.logHash !== summary.logHash) {
    differences.push(`change 로그 해시 ${expected.logHash} → ${summary.logHash}`);
  }
  if (expected.changeCount !== summary.changeCount) {
    differences.push(`변경 기록 수 ${expected.changeCount} → ${summary.changeCount}`);
  }
  if (expected.entityHash !== summary.entityHash) {
    differences.push(`최종 개체 상태 해시 ${expected.entityHash} → ${summary.entityHash}`);
  }
  for (const ruleId of new Set([
    ...Object.keys(expected.ruleChangeCounts),
    ...Object.keys(summary.ruleChangeCounts),
  ])) {
    const before = expected.ruleChangeCounts[ruleId] ?? 0;
    const after = summary.ruleChangeCounts[ruleId] ?? 0;
    if (before !== after) differences.push(`${ruleId} 발동 ${before} → ${after}`);
  }
  return { seed, matches: differences.length === 0, differences, summary, expected };
}
