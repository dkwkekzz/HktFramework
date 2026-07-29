// §34 정적 검증 테스트 (Phase-6 DoD 1 — "필수 규칙 10개+faction.hidden(G-3)이 각각 위반 픽스처를 error 로 검출한다")
//
// 검사기는 통과 세계로 증명되지 않는다. 한 군데씩 망가뜨린 세계로만 "정말 보고 있는가"를 말할 수 있다.
import { describe, expect, it } from "vitest";
import { FIRST_WORLD_CORPUS, FIRST_WORLD_ID, FIRST_WORLD_SEED_INPUT } from "../content/first-world";
import { buildManualWorld } from "../content/manual-world";
import { compileWorld } from "./CompilerPipeline";
import { runViolationFixtures, validateManualWorld, VIOLATION_FIXTURES } from "./phase6Checks";
import { RecordedTextGenerationPort } from "./RecordedTextGenerationPort";
import { findGoalCycles, SEMANTIC_CODES, validateWorld } from "./WorldValidator";

describe("§34 정적 검증", () => {
  it("§34 필수 규칙 10개 + G-1·G-3·G-4·G-5·G-6·G-12 가 더한 7종을 각각 독립 검사기로 갖는다", () => {
    expect(SEMANTIC_CODES).toHaveLength(17);
    const report = validateManualWorld();
    expect(report.checks.map((check) => check.code)).toEqual([...SEMANTIC_CODES]);
    // 픽스처도 17개 — 검사기 하나에 위반 세계 하나
    expect(VIOLATION_FIXTURES.map((fixture) => fixture.code).sort()).toEqual([...SEMANTIC_CODES].sort());
  });

  it("수동 세계는 스키마 층·의미 층 전부를 통과한다 (대조군)", () => {
    const report = validateManualWorld();
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.schema.ok).toBe(true);
    // 검사기가 실제로 무언가를 들여다봤는가 — 대상 0 은 "검사하지 않았다"와 같다
    for (const check of report.checks) {
      if (check.code === "ability.cost-scaling") continue; // 수동 세계에는 능력이 없다
      expect(check.inspected, check.code).toBeGreaterThan(0);
    }
  });

  it("위반 픽스처 17종을 각각 해당 코드의 error 로 검출한다", () => {
    const results = runViolationFixtures();
    expect(results).toHaveLength(17);
    for (const result of results) {
      expect(result.detected, `${result.code}: ${result.message}`).toBe(true);
    }
  });

  it("위반은 그 검사기 하나만 깨뜨린다 (검사기끼리 새지 않는다)", () => {
    for (const result of runViolationFixtures()) {
      expect(result.alsoFailed, result.code).toEqual([]);
    }
  });

  it("목적 그래프의 순환을 찾아낸다 — 탈출구가 있으면 통과, 없으면 오류", () => {
    const definition = structuredClone(buildManualWorld(42));
    const graph = definition.goalTemplates[0]!;
    expect(findGoalCycles(graph)).toEqual([]);

    // 순환을 만들되 완료 조건이 있는 목적을 하나 끼워 두면 무한 행동이 아니다
    const [first, second] = graph.nodes;
    if (first === undefined || second === undefined) throw new Error("픽스처: 목적 2개가 필요하다");
    graph.edges.push({ from: first.id, to: second.id, relation: "requires", weight: 1 });
    graph.edges.push({ from: second.id, to: first.id, relation: "requires", weight: 1 });
    expect(findGoalCycles(graph).length).toBeGreaterThan(0);
    expect(validateWorld(definition).issues.filter((issue) => issue.code === "goal.no-infinite")).toEqual([]);
  });

  it("생성된 세계(§41)의 실제 결함을 잡는다 — 수정 전 상태", async () => {
    const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS);
    const compiled = await compileWorld({
      port,
      seedInput: FIRST_WORLD_SEED_INPUT,
      worldSeed: 42,
      worldId: FIRST_WORLD_ID,
    });
    // Phase 5 의 14단계 검증(참조 무결성·로드 가능성)은 통과한 세계다
    expect(compiled.issues).toEqual([]);

    // 그 세계에 Phase 6 의 의미 검증을 걸면 세 가지가 남는다:
    //  ① 파생 상태에 값을 쓰는 규칙 ② 초기 상태에서 이미 모든 목적을 이룬 인물 ③ 용도 없는 확률(§12)
    const report = validateWorld(compiled.definition);
    const codes = report.issues.filter((issue) => issue.level === "error").map((issue) => issue.code);
    expect(codes).toContain("state.schema");
    expect(codes).toContain("agent.goal");
    expect(
      report.issues.filter((issue) => issue.message.includes("chanceUse") && issue.suggestedFix !== undefined),
    ).not.toHaveLength(0);
    expect(report.issues.some((issue) => issue.message.includes("rule.healing_care"))).toBe(true);
    expect(report.issues.some((issue) => issue.targetId === "agent.noa")).toBe(true);
  });
});
