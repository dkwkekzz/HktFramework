// §19 엣지 의미론(supports/alternative)·completionEffects + §21 visibleSignals 자동 발신 (G-2)
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { completeAction } from "../actions/ActionSystem";
import { RuleEngine } from "../rules/RuleEngine";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import type { WorldDefinition } from "../world/types";
import { rankGoals, updateGoalLifecycle } from "./GoalSystem";

function newRuntime(mutate?: (definition: WorldDefinition) => void): WorldRuntime {
  // buildManualWorld 는 import 된 JSON 모듈 참조를 공유한다 — 테스트 간 오염을 막으려면 깊은 복사
  const definition = structuredClone(buildManualWorld(1));
  mutate?.(definition);
  const runtime = new WorldRuntime(definition);
  bootstrapWorld(runtime);
  return runtime;
}

/** 달성 조건이 이미 충족된 목적은 랭킹에서 빠진다 — 네 목적 전부를 미달성 상태로 만든다 */
function makeGoalsPending(runtime: WorldRuntime): void {
  runtime.store.modify("agent.kael", "hunger", "set", 60); // survive: hunger < 30 미충족
  runtime.store.modify("agent.kael", "fear", "set", 40); // avoid_threat: fear < 25 미충족
  runtime.store.modify("faction.silent_village", "food_reserve", "set", 50); // secure_food: > 70 미충족
}

function activationOf(runtime: WorldRuntime, agentId: string, goalId: string): number {
  const entry = rankGoals(runtime, agentId).find((result) => result.goalId === goalId);
  if (entry === undefined) throw new Error(`목적 없음: ${goalId}`);
  return entry.activation;
}

describe("§19 supports 엣지 — 도움받는 목적의 힘이 돕는 목적으로 흐른다", () => {
  it("secure_food supports survive 엣지가 있으면 secure_food 활성도가 커진다", () => {
    const withEdge = newRuntime();
    const withoutEdge = newRuntime((definition) => {
      const graph = definition.goalTemplates.find((g) => g.id === "goal_graph.hunter");
      if (graph !== undefined) {
        graph.edges = graph.edges.filter((edge) => edge.relation !== "supports");
      }
    });
    makeGoalsPending(withEdge);
    makeGoalsPending(withoutEdge);
    const boosted = activationOf(withEdge, "agent.kael", "goal.secure_food");
    const plain = activationOf(withoutEdge, "agent.kael", "goal.secure_food");
    expect(boosted).toBeGreaterThan(plain);
    // 도움받는 쪽(survive)은 supports 로 변하지 않는다
    expect(activationOf(withEdge, "agent.kael", "goal.survive")).toBeCloseTo(
      activationOf(withoutEdge, "agent.kael", "goal.survive"),
      6,
    );
  });
});

describe("§19 alternative 엣지 — 더 유망한 대안이 남고 다른 쪽은 물러난다", () => {
  it("약한 쪽 하나만 활성도가 깎인다", () => {
    const addEdge = (definition: WorldDefinition): void => {
      const graph = definition.goalTemplates.find((g) => g.id === "goal_graph.hunter");
      graph?.edges.push({
        from: "goal.secure_food",
        to: "goal.report_danger",
        relation: "alternative",
        weight: 1,
      });
    };
    const baseline = newRuntime();
    const alternative = newRuntime(addEdge);
    makeGoalsPending(baseline);
    makeGoalsPending(alternative);

    const pairs = (["goal.secure_food", "goal.report_danger"] as const).map((goalId) => ({
      goalId,
      before: activationOf(baseline, "agent.kael", goalId),
      after: activationOf(alternative, "agent.kael", goalId),
    }));
    const suppressed = pairs.filter((pair) => pair.after < pair.before - 1e-9);
    const untouched = pairs.filter((pair) => Math.abs(pair.after - pair.before) <= 1e-9);
    expect(suppressed).toHaveLength(1);
    expect(untouched).toHaveLength(1);
    // 물러난 쪽은 애초에 약했던 쪽이다
    expect(suppressed[0]!.before).toBeLessThanOrEqual(untouched[0]!.before);
  });
});

describe("§19 completionEffects — 달성이 확인되는 순간 1회 적용", () => {
  const mutate = (definition: WorldDefinition): void => {
    const graph = definition.goalTemplates.find((g) => g.id === "goal_graph.hunter");
    const node = graph?.nodes.find((n) => n.id === "goal.avoid_threat");
    if (node !== undefined) {
      node.completionEffects = [{ stateKey: "known_threat_level", operation: "add", value: 7 }];
    }
  };

  it("조건 충족 시 상태 효과가 적용되고, 재확인돼도 다시 적용되지 않는다", () => {
    const runtime = newRuntime(mutate);
    runtime.store.modify("agent.kael", "fear", "set", 0); // avoid_threat 의 달성 조건 (fear < 25)
    const before = runtime.store.readNumber("agent.kael", "known_threat_level");

    updateGoalLifecycle(runtime, "agent.kael");
    expect(runtime.store.readNumber("agent.kael", "known_threat_level")).toBe(before + 7);
    expect(runtime.agentRuntime("agent.kael").completedGoals).toContain("goal.avoid_threat");

    updateGoalLifecycle(runtime, "agent.kael"); // 1회만 — 두 번째 확인은 무효과
    expect(runtime.store.readNumber("agent.kael", "known_threat_level")).toBe(before + 7);
  });

  it("완료 효과의 상태 변화가 change 로 남는다 (state_changed 규칙의 재료, §26)", () => {
    const runtime = newRuntime(mutate);
    runtime.store.modify("agent.kael", "fear", "set", 0);
    const logBefore = runtime.state.changeLog.length;
    updateGoalLifecycle(runtime, "agent.kael");
    const changes = runtime.state.changeLog.slice(logBefore);
    expect(
      changes.some(
        (change) =>
          change.tags.includes("goal_completed") && change.tags.includes("goal.avoid_threat"),
      ),
    ).toBe(true);
  });
});

describe("§21 visibleSignals 자동 발신 — 선언한 신호는 규칙 없이도 나간다", () => {
  function completeDirect(runtime: WorldRuntime, actorId: string, actionId: string, targetId: string): void {
    const rules = new RuleEngine(runtime.definition.ruleDefinitions);
    completeAction(runtime, rules, actorId, {
      actionId,
      targetIds: [targetId],
      startedAt: runtime.state.simulationTime,
      completesAt: runtime.state.simulationTime,
      eventId: "test.event",
      goalId: "goal.profit",
    });
  }

  it("emit_signal 규칙이 없는 trade_talk 도 완료 시 발신된다", () => {
    const runtime = newRuntime();
    completeDirect(runtime, "agent.mar", "action.trade", "agent.ren");
    const emitted = runtime.state.pendingSignals.filter((signal) =>
      signal.id.startsWith("signal.trade_talk."),
    );
    expect(emitted.length).toBeGreaterThanOrEqual(1);
  });

  it("규칙이 이미 발신한 신호(movement_trace)는 중복 발신하지 않는다", () => {
    const runtime = newRuntime();
    completeDirect(runtime, "agent.mar", "action.move", "agent.ren");
    const emitted = runtime.state.pendingSignals.filter((signal) =>
      signal.id.startsWith("signal.movement_trace."),
    );
    expect(emitted).toHaveLength(1);
  });
});
