// 주체 판단의 계약 (§19, §20, §22, §26, §27) — Phase 3 전체 모델
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import type { GoalNode } from "../world/types";
import { BeliefView } from "./BeliefView";
import {
  calculateGoalActivation,
  generateActionCandidates,
  rankGoals,
  replanAgent,
  selectAction,
  shouldReplan,
} from "./AgentRuntime";

function newRuntime(): WorldRuntime {
  const runtime = new WorldRuntime(buildManualWorld(1));
  bootstrapWorld(runtime);
  return runtime;
}

function goalOf(runtime: WorldRuntime, graphId: string, goalId: string): GoalNode {
  const node = runtime.index.goalGraphs.get(graphId)?.nodes.find((n) => n.id === goalId);
  if (node === undefined) throw new Error(`목적 없음: ${goalId}`);
  return node;
}

describe("목적 활성도 (§20 — 11항)", () => {
  it("11항이 모두 산출 근거로 남고, 합이 활성도다", () => {
    const runtime = newRuntime();
    const survive = goalOf(runtime, "goal_graph.hunter", "goal.survive");
    runtime.store.modify("agent.kael", "hunger", "set", 65); // 임계 45 를 20 초과

    const state = calculateGoalActivation(runtime, "agent.kael", survive);
    expect(state.urgency).toBeCloseTo(30); // 20 * weight 1.5
    const b = state.breakdown!;
    expect(Object.keys(b).sort()).toEqual(
      [
        "baseImportance",
        "conflict",
        "cost",
        "emotionalBias",
        "expectedUtility",
        "feasibility",
        "needPressure",
        "relationshipImpact",
        "risk",
        "urgency",
        "valueAlignment",
      ].sort(),
    );
    const sum =
      b.baseImportance + b.needPressure + b.urgency + b.valueAlignment + b.relationshipImpact +
      b.emotionalBias + b.feasibility + b.expectedUtility - b.cost - b.risk - b.conflict;
    expect(state.activation).toBeCloseTo(sum);
    expect(b.baseImportance).toBe(survive.baseImportance);
  });

  it("이미 이룬 목적은 활성화되지 않는다 (§19 targetConditions)", () => {
    const runtime = newRuntime();
    const survive = goalOf(runtime, "goal_graph.hunter", "goal.survive");
    runtime.store.modify("agent.kael", "hunger", "set", 5); // targetCondition: hunger < 30
    expect(calculateGoalActivation(runtime, "agent.kael", survive).activation).toBe(
      Number.NEGATIVE_INFINITY,
    );
  });

  it("다른 개체의 상태도 긴급도의 근거가 된다 (조직의 식량 → 사냥꾼의 긴급함)", () => {
    const runtime = newRuntime();
    const secure = goalOf(runtime, "goal_graph.hunter", "goal.secure_food");
    runtime.store.modify("faction.silent_village", "food_reserve", "set", 20); // 임계 70 미만
    expect(calculateGoalActivation(runtime, "agent.kael", secure).urgency).toBeCloseTo(50); // max 로 고정
  });

  it("활성도 순위는 결정론이다 (동점은 목적 id 사전순)", () => {
    const runtime = newRuntime();
    const first = rankGoals(runtime, "agent.kael").map((g) => g.goalId);
    const second = rankGoals(runtime, "agent.kael").map((g) => g.goalId);
    expect(first).toEqual(second);
  });
});

describe("행동 후보와 선택 (§22)", () => {
  it("사거리 안의 대상은 직접 후보, 밖의 대상은 '다가가기' 후보가 된다 (§27-5)", () => {
    const runtime = newRuntime();
    const secure = goalOf(runtime, "goal_graph.hunter", "goal.secure_food");
    // 사냥꾼은 마을에 있고 숲 채집지는 다른 지역이다
    const candidates = generateActionCandidates(runtime, "agent.kael", secure);
    const approach = candidates.find((c) => c.approachFor === "action.hunt");
    expect(approach?.actionId).toBe("action.move");
    expect(approach?.confidence).toBeLessThan(0.8); // 다가가기는 확신이 낮다
  });

  it("행동 조건을 만족하지 않으면 후보가 되지 않는다", () => {
    const runtime = newRuntime();
    const survive = goalOf(runtime, "goal_graph.hunter", "goal.survive");
    runtime.store.modify("agent.kael", "carried_food", "set", 0); // 식사는 식량 10 이 필요하다
    expect(generateActionCandidates(runtime, "agent.kael", survive).map((c) => c.actionId)).not.toContain(
      "action.eat",
    );
    runtime.store.modify("agent.kael", "carried_food", "set", 30);
    expect(generateActionCandidates(runtime, "agent.kael", survive).map((c) => c.actionId)).toContain(
      "action.eat",
    );
  });

  it("성향이 다르면 같은 상황에서 점수가 달라진다 (§18 판단 변수)", () => {
    const runtime = newRuntime();
    const survive = goalOf(runtime, "goal_graph.hunter", "goal.survive");
    const cautious = () => {
      runtime.agentRuntime("agent.kael").traits["riskTolerance"] = 0;
      return generateActionCandidates(runtime, "agent.kael", survive).find(
        (c) => c.actionId === "action.move",
      )!.score;
    };
    const bold = () => {
      runtime.agentRuntime("agent.kael").traits["riskTolerance"] = 100;
      return generateActionCandidates(runtime, "agent.kael", survive).find(
        (c) => c.actionId === "action.move",
      )!.score;
    };
    expect(bold()).toBeGreaterThan(cautious());
  });

  it("동점 후보는 사전순으로 결정론이다", () => {
    const runtime = newRuntime();
    const view = new BeliefView(runtime, "agent.kael");
    // 확률 선택을 끄면(충동 0·스트레스 0) 언제나 최고 점수 — 동점은 사전순이다
    runtime.agentRuntime("agent.kael").traits["impulsiveness"] = 0;
    runtime.store.modify("agent.kael", "fear", "set", 0);
    runtime.store.modify("agent.kael", "hunger", "set", 0);
    runtime.store.modify("agent.kael", "health", "set", 100);
    const base = {
      targetIds: [] as string[],
      expectedGoalProgress: 0,
      expectedCost: 0,
      expectedRisk: 0,
      valueAlignment: 0,
      confidence: 0,
      duration: 10,
      goalId: "goal.x",
    };
    expect(
      selectAction(view, [
        { ...base, actionId: "action.b", score: 5 },
        { ...base, actionId: "action.a", score: 5 },
        { ...base, actionId: "action.c", score: 4 },
      ])?.actionId,
    ).toBe("action.a");
    expect(selectAction(view, [])).toBeUndefined();
  });

  it("충동적인 주체는 최고 점수가 아닌 후보도 고른다 (§22 확률적 선택)", () => {
    const runtime = newRuntime();
    const view = new BeliefView(runtime, "agent.kael");
    const base = {
      targetIds: [] as string[],
      expectedGoalProgress: 0,
      expectedCost: 0,
      expectedRisk: 0,
      valueAlignment: 0,
      confidence: 0,
      duration: 10,
      goalId: "goal.x",
    };
    const candidates = [
      { ...base, actionId: "action.top", score: 10 },
      { ...base, actionId: "action.second", score: 9.6 },
    ];
    const picks = new Set<string>();
    for (let t = 0; t < 400; t++) {
      runtime.state.simulationTime = t; // 난수 스트림은 (시드·시각·개체)
      runtime.agentRuntime("agent.kael").traits["impulsiveness"] = 90;
      picks.add(selectAction(view, candidates)!.actionId);
    }
    expect(picks.size).toBe(2);

    // 차분한 주체는 언제나 최고 점수를 고른다
    const calm = new Set<string>();
    for (let t = 0; t < 50; t++) {
      runtime.state.simulationTime = t;
      runtime.agentRuntime("agent.kael").traits["impulsiveness"] = 0;
      runtime.store.modify("agent.kael", "fear", "set", 0);
      runtime.store.modify("agent.kael", "hunger", "set", 0);
      runtime.store.modify("agent.kael", "health", "set", 100);
      calm.add(selectAction(view, candidates)!.actionId);
    }
    expect([...calm]).toEqual(["action.top"]);
  });
});

describe("재판단 (§26, §27)", () => {
  it("행동이 없으면 재판단 대상이다", () => {
    const runtime = newRuntime();
    expect(shouldReplan(runtime, "agent.kael")).toBe(true);
  });

  it("생존 압력이 높으면 행동 중에도 재판단 대상이다 (§26 shouldReplan)", () => {
    const runtime = newRuntime();
    replanAgent(runtime, "agent.kael");
    expect(runtime.agentRuntime("agent.kael").currentAction).not.toBeNull();
    expect(shouldReplan(runtime, "agent.kael")).toBe(false);

    runtime.store.modify("agent.kael", "hunger", "set", 100);
    runtime.store.modify("agent.kael", "health", "set", 10);
    expect(runtime.store.readNumber("agent.kael", "survivalPressure")).toBeGreaterThan(70);
    expect(shouldReplan(runtime, "agent.kael")).toBe(true);
  });

  it("재판단 결과가 같으면 진행 중인 행동을 그대로 둔다 (계획 갈아엎기 방지)", () => {
    const runtime = newRuntime();
    replanAgent(runtime, "agent.kael");
    const first = runtime.agentRuntime("agent.kael").currentAction!;
    replanAgent(runtime, "agent.kael");
    expect(runtime.agentRuntime("agent.kael").currentAction).toEqual(first);
  });

  it("행동은 비용을 먼저 지불하고 완료 이벤트를 예약한다 (§27-7·8)", () => {
    const runtime = newRuntime();
    const energyBefore = runtime.store.readNumber("agent.kael", "energy");
    replanAgent(runtime, "agent.kael");
    const action = runtime.agentRuntime("agent.kael").currentAction!;
    expect(action.completesAt).toBeGreaterThan(runtime.state.simulationTime);
    expect(runtime.store.readNumber("agent.kael", "energy")).toBeLessThanOrEqual(energyBefore);
    expect(runtime.scheduler.pendingCount()).toBe(1);
    expect(runtime.store.read("agent.kael", "current_action")).toBe(action.actionId);
  });
});
