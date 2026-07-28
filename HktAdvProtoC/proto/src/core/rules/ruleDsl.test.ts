// Phase 2 DoD — 규칙 DSL (§11, §12, §16)
// 여기서 확인하는 것은 "무엇을 지원한다고 썼는가"가 아니라 "무엇이 실행됐는가"다.
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { buildRuleLabWorld, LAB_AGENTS, LAB_PARTNER } from "../../content/rule-lab";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import { runAbilityChecks } from "./abilityChecks";
import { runCapabilityChecks, type CapabilityCheck } from "./capabilities";
import {
  createRuleContext,
  evaluateRuleCondition,
  resolveRuleValue,
  splitPath,
  type RuleContext,
} from "./ConditionEvaluator";
import { loadRuleDocument, RULE_JSON_SCHEMA, validateAgainstSchema } from "./RuleSchema";
import type { RuleConditionOperator, RuleValue } from "./RuleTypes";

function report(checks: CapabilityCheck[]): string {
  return checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.name} — ${c.evidence}`).join("\n");
}

/** 조건·값 평가만 떼어 보기 위한 최소 맥락 */
function labContext(): RuleContext {
  const definition = buildRuleLabWorld(1);
  const runtime = new WorldRuntime(definition);
  bootstrapWorld(runtime);
  const rule = loadRuleDocument({
    id: "rule.probe",
    name: "probe",
    scope: "global",
    priority: 1,
    triggers: [{ type: "interval", interval: 1 }],
    conditions: [],
    effects: [
      {
        type: "modify_state",
        target: { type: "actor" },
        stateKey: "health",
        operation: "add",
        value: 0,
      },
    ],
  });
  return createRuleContext(runtime, rule, { actorId: LAB_AGENTS[0]!, targetId: LAB_PARTNER });
}

const constant = (value: number | boolean | string): RuleValue => ({ type: "constant", value });

describe("§12 규칙 DSL 요구 능력", () => {
  const checks = runCapabilityChecks();

  it("10항목 + Phase-2 방어선 3항목이 전부 실행으로 증명된다", () => {
    expect(report(checks)).not.toMatch(/✗/);
    expect(checks).toHaveLength(13);
  });

  for (const check of checks) {
    it(`${check.name}`, () => {
      expect(check.ok, `${check.name} — ${check.evidence}`).toBe(true);
    });
  }
});

describe("§16 능력 체계의 실행 매핑 (Phase-2 §2.7)", () => {
  const checks = runAbilityChecks();

  it("§11.4 예시 규칙 로드·실행 + 능력 픽스처의 발동·유지 위반·반동", () => {
    expect(report(checks)).not.toMatch(/✗/);
  });

  for (const check of checks) {
    it(`${check.name}`, () => {
      expect(check.ok, `${check.name} — ${check.evidence}`).toBe(true);
    });
  }
});

describe("규칙 로더 — 축약형과 정규형 (§12, Phase-2 §2.1)", () => {
  it("§12 예시의 when/if/then 축약형을 정규형으로 옮긴다", () => {
    // 기획서 §12 의 JSON 그대로
    const rule = loadRuleDocument({
      id: "rule.freeze",
      name: "결빙",
      scope: "region",
      priority: 50,
      when: { event: "region.temperature.changed" },
      if: [
        { path: "region.temperature", operator: "<", value: -10 },
        { path: "region.durationBelowFreezing", operator: ">", value: 72 },
      ],
      then: [
        {
          effect: "multiply",
          targetQuery: "entities[tag=plant]",
          path: "states.health",
          value: 0.8,
        },
        { effect: "emit", signal: "frozen_vegetation" },
      ],
    });

    expect(rule.triggers).toEqual([{ type: "state_changed", stateKey: "temperature" }]);
    expect(rule.conditions[0]).toEqual({
      left: { type: "path", path: "region.temperature" },
      operator: "<",
      right: { type: "constant", value: -10 },
    });
    const modify = rule.effects[0]!;
    expect(modify.type).toBe("modify_state");
    if (modify.type !== "modify_state") throw new Error("modify_state 가 아니다");
    expect(modify.target).toEqual({ type: "query", query: { tags: ["plant"] } });
    expect(modify.stateKey).toBe("health");
    expect(modify.operation).toBe("multiply");
    expect(rule.effects[1]).toEqual({ type: "emit_signal", signalId: "frozen_vegetation" });
  });

  it("점 표기는 마지막 마디에서 owner 와 stateKey 로 갈린다", () => {
    expect(splitPath("actor.hunger")).toEqual({ owner: "actor", key: "hunger" });
    expect(splitPath("region.tundra.temperature")).toEqual({
      owner: "region.tundra",
      key: "temperature",
    });
  });

  it("스키마를 벗어난 규칙은 로드 시점에 거부된다", () => {
    expect(() =>
      loadRuleDocument({
        id: "rule.bad",
        name: "bad",
        scope: "global",
        priority: 1,
        triggers: [{ type: "interval", interval: 1 }],
        conditions: [],
        effects: [],
        엉뚱한필드: 1,
      }),
    ).toThrow(/알 수 없는 항목/);

    expect(() =>
      loadRuleDocument({
        id: "rule.bad2",
        name: "bad2",
        scope: "존재하지않는범위",
        priority: 1,
        triggers: [],
        conditions: [],
        effects: [],
      }),
    ).toThrow(/허용되지 않은 값/);
  });

  it("수동 세계의 규칙이 전부 정규형 스키마를 통과한다 (Phase 5 출력 계약)", () => {
    const rules = buildManualWorld(1).ruleDefinitions;
    expect(rules.length).toBeGreaterThanOrEqual(40); // §40 세계 규칙 40~60
    for (const rule of rules) {
      expect(validateAgainstSchema(rule), `규칙 ${rule.id}`).toEqual([]);
    }
    expect(RULE_JSON_SCHEMA.$id).toBe("hkt-adv-proto-c/rule-definition");
  });
});

describe("조건 평가기 (§11.2)", () => {
  const ctx = labContext();

  const cases: [RuleValue, RuleConditionOperator, RuleValue, boolean][] = [
    [constant(5), ">", constant(3), true],
    [constant(3), ">", constant(5), false],
    [constant(5), ">=", constant(5), true],
    [constant(3), "<", constant(5), true],
    [constant(5), "<=", constant(5), true],
    [constant("a"), "==", constant("a"), true],
    [constant("a"), "!=", constant("b"), true],
    [constant("abcd"), "contains", constant("bc"), true],
  ];

  for (const [left, operator, right, expected] of cases) {
    it(`${JSON.stringify(left)} ${operator} ${JSON.stringify(right)} → ${expected}`, () => {
      expect(evaluateRuleCondition({ left, operator, right }, ctx)).toBe(expected);
    });
  }

  it("set 상태에 contains 가 걸린다", () => {
    ctx.runtime.store.modify(LAB_AGENTS[0]!, "marks", "set", ["alpha", "beta"]);
    expect(
      evaluateRuleCondition(
        { left: { type: "actor_state", key: "marks" }, operator: "contains", right: constant("beta") },
        ctx,
      ),
    ).toBe(true);
  });

  it("등록되지 않은 경로는 조건 실패가 아니라 오류다 (Phase-2 §2.3)", () => {
    expect(() => resolveRuleValue({ type: "actor_state", key: "없는상태" }, ctx)).toThrow(
      /등록되지 않은 상태/,
    );
    expect(() => resolveRuleValue({ type: "path", path: "actor.없는상태" }, ctx)).toThrow(
      /등록되지 않은 상태/,
    );
  });

  it("산술식은 중첩된다 — (100 - 30) × 0.4 + 20", () => {
    const value = resolveRuleValue(
      {
        type: "expr",
        op: "add",
        operands: [
          constant(20),
          {
            type: "expr",
            op: "mul",
            operands: [
              { type: "expr", op: "sub", operands: [constant(100), constant(30)] },
              constant(0.4),
            ],
          },
        ],
      },
      ctx,
    );
    expect(value).toBeCloseTo(48);
  });

  it("0 으로 나누면 NaN 이 아니라 0 이다 — 상태로 NaN 이 새지 않는다", () => {
    expect(resolveRuleValue({ type: "expr", op: "div", operands: [constant(5), constant(0)] }, ctx)).toBe(0);
  });

  it("난수는 (시드·시각·개체) 로만 결정된다 (§39)", () => {
    const draw = (): unknown => resolveRuleValue({ type: "random_int", max: 100, stream: "actor" }, ctx);
    const first = draw();
    expect(draw()).toBe(first); // 같은 시각·같은 개체 → 같은 값
    ctx.runtime.state.simulationTime += 1;
    expect(draw()).not.toBe(first);
  });
});
