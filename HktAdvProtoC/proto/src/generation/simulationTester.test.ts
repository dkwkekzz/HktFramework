// §35 자동 시뮬레이션 테스트 (Phase-6 DoD 2·4·5)
//
// 수동 세계가 §35 판정 8종을 통과하는지, 판정이 결정론적인지, AI 보조 검사를 꺼도 완결되는지 본다.
import { describe, expect, it } from "vitest";
import { FIRST_WORLD_AUDIT_CORPUS, FIRST_WORLD_CORPUS, FIRST_WORLD_ID, FIRST_WORLD_SEED_INPUT } from "../content/first-world";
import { InlineHost } from "../core/simulation/InlineHost";
import { hashValue } from "../shared/hash";
import { TICKS_PER_DAY } from "../shared/time";
import { auditWorld, AUDIT_CODES } from "./AiAudit";
import { compileWorld } from "./CompilerPipeline";
import { RecordedTextGenerationPort } from "./RecordedTextGenerationPort";
import { compareToSimulationBaseline, SIMULATION_BASELINE } from "./simulationBaseline";
import { runSimulationTest, SIMULATION_CODES } from "./SimulationTester";

describe("§35 자동 시뮬레이션 테스트", () => {
  it("수동 세계가 무개입 30일 실행에서 최소 테스트 8항목을 전부 통과한다", async () => {
    const result = await runSimulationTest({ worldSeed: 42 });
    expect(result.verdicts.map((verdict) => verdict.code)).toEqual([...SIMULATION_CODES]);
    for (const verdict of result.verdicts) {
      expect(verdict.ok, `${verdict.code}: ${verdict.evidence}`).toBe(true);
    }
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.deadlockedAgents).toEqual([]);
    expect(result.duration).toBe(30);
    expect(result.samples).toHaveLength(30);
  }, 60_000);

  it("§35 두 점수가 기준선(수동 세계 측정치)과 어긋나지 않는다", async () => {
    const result = await runSimulationTest({ worldSeed: 42 });
    expect(SIMULATION_BASELINE.worldId).toBe(result.worldId);
    for (const row of compareToSimulationBaseline(result)) {
      expect(row.ok, `${row.item} ${row.actual} < ${row.baseline}`).toBe(true);
    }
    // 점수는 §35 공식 그대로 — 입력 지표에서 다시 계산해도 같아야 한다
    const m = result.metrics;
    expect(result.diversityScore).toBeCloseTo(
      m.uniqueActionTypes * 0.2 + m.uniqueEventTypes * 0.3 + m.uniqueParticipantCombinations * 0.3 + m.changedStateCategories * 0.2,
      6,
    );
    expect(result.depthScore).toBeCloseTo(
      m.averageGoalsPerEvent * 0.25 +
        m.averageAffectedSystemsPerEvent * 0.25 +
        m.informationAsymmetryRate * 0.2 +
        m.consequenceDurationScore * 0.3,
      6,
    );
  }, 60_000);

  it("같은 입력이면 같은 SimulationTestResult (§44-12)", async () => {
    const first = await runSimulationTest({ worldSeed: 42, days: 10 });
    const second = await runSimulationTest({ worldSeed: 42, days: 10 });
    const other = await runSimulationTest({ worldSeed: 43, days: 10 });
    expect(second.resultHash).toBe(first.resultHash);
    expect(other.resultHash).not.toBe(first.resultHash);
  }, 60_000);

  it("하루씩 나눠 진행해도 한 번에 진행한 세계와 같다 (표본이 세계를 흔들지 않는다)", async () => {
    const sampled = await runSimulationTest({ worldSeed: 42, days: 10 });
    const host = new InlineHost();
    await host.request({ type: "initialize_world", worldSeed: 42 });
    await host.request({ type: "advance_time", amount: 10 * TICKS_PER_DAY });
    const runtime = host.server.inspectRuntime();
    expect(hashValue(runtime?.state.changeLog)).toBe(sampled.logHash);
  }, 60_000);
});

describe("§33.2 AI 보조 검사", () => {
  it("포트가 없으면 전부 건너뛰고 이슈를 만들지 않는다 (오프라인 완결)", async () => {
    const report = await auditWorld((await compiledWorld()).definition);
    expect(report.enabled).toBe(false);
    expect(report.checks.map((check) => check.code)).toEqual([...AUDIT_CODES]);
    expect(report.checks.every((check) => check.skipped)).toBe(true);
    expect(report.issues).toEqual([]);
  }, 60_000);

  it("녹화 포트로 5종을 물어보고 결과를 warning 으로만 낸다 (게이트가 아니다)", async () => {
    const report = await auditWorld(
      (await compiledWorld()).definition,
      new RecordedTextGenerationPort(FIRST_WORLD_AUDIT_CORPUS),
    );
    expect(report.enabled).toBe(true);
    expect(report.checks.every((check) => !check.skipped)).toBe(true);
    expect(report.checks.every((check) => check.asked > 0)).toBe(true);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.issues.every((issue) => issue.level === "warning")).toBe(true);
  }, 60_000);

  it("녹화되지 않은 항목은 파이프라인을 멈추지 않고 skipped 로 남는다", async () => {
    const report = await auditWorld((await compiledWorld()).definition, new RecordedTextGenerationPort({}));
    expect(report.checks.every((check) => check.skipped)).toBe(true);
    expect(report.checks.every((check) => check.error !== undefined)).toBe(true);
    expect(report.issues).toEqual([]);
  }, 60_000);
});

async function compiledWorld() {
  return compileWorld({
    port: new RecordedTextGenerationPort(FIRST_WORLD_CORPUS),
    seedInput: FIRST_WORLD_SEED_INPUT,
    worldSeed: 42,
    worldId: FIRST_WORLD_ID,
  });
}
