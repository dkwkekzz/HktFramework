// §14 자원 과용 반동 (G-6) — 실측 대조와 검사기 판정
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { validateWorld } from "../../generation/WorldValidator";
import { measureResourceOveruse } from "./overuseChecks";

describe("§14 자원 과용 반동 (G-6)", () => {
  it("자원 3종 전부 과잉/정상 대조에서 반동이 실행된다", () => {
    const rows = measureResourceOveruse(42);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.ok, `${row.resourceId}: ${row.evidence}`).toBe(true);
  });

  it("수동 세계의 모든 자원이 §14 여섯 번째 질문에 답한다", () => {
    const definition = buildManualWorld(42);
    for (const resource of definition.resources) {
      expect((resource.overuseRules ?? []).length, resource.id).toBeGreaterThan(0);
    }
    const report = validateWorld(definition);
    const overuse = report.checks.find((check) => check.code === "resource.overuse")!;
    expect(overuse.ok).toBe(true);
    expect(overuse.issues.filter((issue) => issue.level === "error")).toHaveLength(0);
  });

  it("과용 반동이 빈칸인 자원은 경고로 남는다 — 오류가 아니라 사라지지 않는 사실이다", () => {
    const definition = structuredClone(buildManualWorld(42));
    delete definition.resources[0]!.overuseRules;
    const report = validateWorld(definition);
    const overuse = report.checks.find((check) => check.code === "resource.overuse")!;
    expect(overuse.ok).toBe(true);
    expect(overuse.issues.some((issue) => issue.level === "warning")).toBe(true);
  });

  it("조건 없는 과용 반동은 원인 없는 벌이다 — error 로 잡는다", () => {
    const definition = structuredClone(buildManualWorld(42));
    const rule = definition.ruleDefinitions.find((entry) => entry.id === "rule.market_glut")!;
    rule.conditions = [];
    for (const effect of rule.effects) delete effect.conditions;
    const report = validateWorld(definition);
    const overuse = report.checks.find((check) => check.code === "resource.overuse")!;
    expect(overuse.ok).toBe(false);
    expect(overuse.issues.some((issue) => issue.message.includes("조건이 없다"))).toBe(true);
  });
});
