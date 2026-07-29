// §12 확률 5용도 제한 (G-1) — 용도 라벨·문맥 검증기와 다섯 용도의 실행 증명
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { buildPlayerWorld } from "../../content/player-world";
import { buildRuleLabWorld } from "../../content/rule-lab";
import { CHANCE_USES, collectChanceSites, findChanceViolations } from "./ChanceUse";
import { auditChanceUses, runChanceUseChecks, runChanceViolationFixtures } from "./chanceChecks";

describe("§12 확률 5용도", () => {
  it("다섯 용도가 전부 실행으로 증명된다", () => {
    const checks = runChanceUseChecks();
    expect(checks.map((check) => check.use)).toEqual([...CHANCE_USES]);
    for (const check of checks) {
      expect(check.ok, `${check.use}: ${check.evidence}`).toBe(true);
    }
    // 규칙에 붙는 용도 2종 · 엔진이 갖는 용도 3종
    expect(checks.filter((check) => check.site === "rule")).toHaveLength(2);
    expect(checks.filter((check) => check.site === "engine")).toHaveLength(3);
  });

  it("수동 세계·플레이어 세계·실험실의 확률에는 빠짐없이 용도가 있다", () => {
    const audit = auditChanceUses([
      { name: "manual", rules: buildManualWorld(42).ruleDefinitions },
      { name: "player", rules: buildPlayerWorld(42).ruleDefinitions },
      { name: "lab", rules: buildRuleLabWorld(7).ruleDefinitions },
    ]);
    expect(audit.totalSites).toBeGreaterThan(0);
    expect(audit.totalUnlabeled).toBe(0);
    expect(audit.totalViolations).toBe(0);
  });

  it("위반 9종을 전부 잡는다 — 실행은 되지만 §12 원칙을 어긴 규칙들이다", () => {
    const results = runChanceViolationFixtures();
    expect(results).toHaveLength(9);
    for (const result of results) {
      expect(result.detected, `${result.name} → ${result.message}`).toBe(true);
      // 확률 용도는 실행 계약이 아니라 기획 원칙이다 — 로드 계약(§9·§11)은 통과한다
      expect(result.runnable, `${result.name} → 로드 계약이 다른 이유로 막혔다`).toBe(true);
    }
  });

  it("바인딩을 타고 들어온 난수도 확률 지점으로 센다", () => {
    // 수확량(rule.hunt_yield)은 chance 가 아니라 바인딩의 random_int 로 흔들린다
    const rules = buildManualWorld(42).ruleDefinitions;
    const site = collectChanceSites(rules).find((entry) => entry.ruleId === "rule.hunt_yield");
    expect(site?.sites).toContain("valueRef.random");
    expect(site?.use).toBe("partial_outcome");
  });

  it("확률이 조건을 대신하면 인과 대체로 잡는다", () => {
    const definition = buildManualWorld(42);
    const rule = structuredClone(definition.ruleDefinitions.find((r) => r.id === "rule.lie_discovery_risk")!);
    // 원인(행동 트리거·조건)을 지우고 주기만 남기면 "그냥 굴리는 주사위"가 된다
    rule.triggers = [{ type: "interval", interval: 100 }];
    rule.conditions = [];
    rule.effects = rule.effects.map((effect) => ({ ...effect, chanceUse: "mutation" as const }));
    const codes = findChanceViolations([rule]).map((violation) => violation.code);
    expect(codes).toContain("no-cause");
  });
});
