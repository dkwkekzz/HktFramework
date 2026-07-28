// 세계 정의 정합성 (§34 부분집합) — 수동 세계 자신이 첫 번째 검증 대상이다.
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { RuleEngine } from "../rules/RuleEngine";
import { validateWorldDefinition } from "./WorldValidation";
import type { WorldDefinition } from "./types";

const MANUAL_RULES = buildManualWorld(1).ruleDefinitions;
const rules = new RuleEngine(MANUAL_RULES);

function clone(): WorldDefinition {
  return structuredClone(buildManualWorld(1));
}

describe("수동 세계 정의", () => {
  it("검증을 통과한다", () => {
    expect(validateWorldDefinition(buildManualWorld(1), rules)).toEqual([]);
  });

  it("§40 초기 프로토타입 규모 안에 있다 (Phase 3 확장 후)", () => {
    const definition = buildManualWorld(1);
    // §40: 세계 규칙 40~60 / 행동 20종 / 종족 4 / 조직 5 / 주요 개인 20명
    expect(MANUAL_RULES.length).toBeGreaterThanOrEqual(40);
    expect(MANUAL_RULES.length).toBeLessThanOrEqual(60);
    // 행동은 §21 예시 21종을 전부 담기 위해 §40 의 20 을 넘는다 (G-2 — §21 이 §40 규모표보다 우선)
    expect(definition.actionDefinitions.length).toBeLessThanOrEqual(25);
    expect(definition.species).toHaveLength(2);
    expect(definition.bootstrap.entities.filter((e) => e.type === "faction").length).toBeLessThanOrEqual(5);
    expect(definition.bootstrap.entities.filter((e) => e.type === "agent").length).toBeLessThanOrEqual(20);
    // §8 생존 압력과 조직·위임 목적 그래프가 함께 들어왔다 (Phase 3)
    expect(definition.survivalPressures.length).toBeGreaterThan(0);
    expect(definition.goalTemplates.map((g) => g.id)).toContain("goal_graph.delegated");
  });

  it("모든 규칙 id 가 고유하고 트리거를 가진다", () => {
    const ids = new Set(MANUAL_RULES.map((rule) => rule.id));
    expect(ids.size).toBe(MANUAL_RULES.length);
    for (const rule of MANUAL_RULES) expect(rule.triggers.length).toBeGreaterThan(0);
  });

  it("관찰 불가 상태를 신호로 주장하면 오류다 (§10 믿음 분리의 데이터 근거)", () => {
    const definition = clone();
    const attack = definition.actionDefinitions.find((a) => a.id === "action.attack")!;
    // offspring_threat 은 observable=false — 어떤 신호로도 노출되어서는 안 된다
    attack.visibleSignals[0]!.claim!.stateKey = "offspring_threat";
    expect(validateWorldDefinition(definition, rules).join()).toMatch(/관찰 불가 상태/);
  });

  it("신호 채널이 스키마 선언과 다르면 오류다", () => {
    const definition = clone();
    const attack = definition.actionDefinitions.find((a) => a.id === "action.attack")!;
    attack.visibleSignals[0]!.channels = ["smell"]; // aggression 은 sight/sound 로만 드러난다
    expect(validateWorldDefinition(definition, rules).join()).toMatch(/채널 불일치/);
  });

  it("행동의 executionRules 와 규칙의 action_executed 트리거가 어긋나면 오류다 (Phase 2 이관 전제)", () => {
    const definition = clone();
    definition.actionDefinitions.find((a) => a.id === "action.eat")!.executionRules = [];
    expect(validateWorldDefinition(definition, rules).join()).toMatch(/불일치/);
  });

  it("비용도 위험도 없는 행동은 오류다 (§34)", () => {
    const definition = clone();
    const rest = definition.actionDefinitions.find((a) => a.id === "action.rest")!;
    rest.costs = [];
    rest.risk = 0;
    expect(validateWorldDefinition(definition, rules).join()).toMatch(/비용도 위험도 없다/);
  });

  it("초기 배치가 등록되지 않은 상태를 쓰면 오류다", () => {
    const definition = clone();
    definition.bootstrap.entities.find((e) => e.id === "agent.kael")!.states["mana"] = 3;
    expect(validateWorldDefinition(definition, rules).join()).toMatch(/등록되지 않은 상태/);
  });

  it("어떤 행동도 갖지 않은 목적 태그는 오류다", () => {
    const definition = clone();
    definition.goalTemplates[0]!.nodes[0]!.allowedActionTags = ["teleport"];
    expect(validateWorldDefinition(definition, rules).join()).toMatch(/어떤 행동도 갖지 않은 태그/);
  });
});
