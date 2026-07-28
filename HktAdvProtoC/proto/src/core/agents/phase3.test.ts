// Phase 3 DoD — 주체 판단 (§8, §10, §17, §19~§25)
// verify 스크립트가 30일 실행으로 보이는 것을, 여기서는 좁고 빠른 단위로 고정한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { TICKS_PER_DAY } from "../../shared/time";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import { findBelief } from "./BeliefStore";
import { BeliefView } from "./BeliefView";
import { checkFactionCollapse, syncDelegations } from "./FactionRuntime";
import { accumulatePressures, calculateGoalActivation, rankGoals } from "./GoalSystem";
import { maintainMemories, MEMORY_CAPACITY, rememberEvent } from "./MemorySystem";
import { compareHearsayConfidence, measureGoalConflict } from "./phase3Checks";
import { addPromise, relationshipView, resolveDuePromises } from "./RelationshipSystem";

const BEAST = "creature.echo_beast_mother";
const VILLAGE = "faction.silent_village";

function newRuntime(seed = 1): WorldRuntime {
  const runtime = new WorldRuntime(buildManualWorld(seed));
  bootstrapWorld(runtime);
  return runtime;
}

describe("믿음이 판단의 유일한 입력이다 (§10, §20)", () => {
  it("판단 모듈은 WorldState 를 직접 읽지 않는다 (BeliefView 규약)", () => {
    // 판단이 세계 상태를 몰래 읽으면 "믿음으로 판단한다"는 전제가 무너진다.
    const forbidden = /runtime\.store\.read|runtime\.store\.entity|state\.entities|findEntity\(/;
    for (const module of ["./GoalSystem.ts", "./ActionPlanner.ts"]) {
      const source = readFileSync(new URL(module, import.meta.url), "utf8");
      expect(forbidden.test(source), `${module} 이 세계 상태를 직접 읽는다`).toBe(false);
    }
  });

  it("관찰 불가 상태(§9 observable=false)는 지각되지 않는다", () => {
    const runtime = newRuntime();
    const beast = runtime.store.entity(BEAST).position!;
    runtime.store.moveEntity("agent.rion", { ...beast, x: beast.x + 1 });
    const view = new BeliefView(runtime, "agent.rion");

    // 새끼 위협도는 관찰 불가 — 코앞에 서 있어도 알 수 없다
    expect(view.perceive(BEAST, "offspring_threat").source).toBe("unknown");
    // 공격성은 시각·청각으로 관찰 가능 — 다만 믿음이 있으면 믿음이 이긴다
    const perceived = view.perceive(BEAST, "aggression");
    expect(perceived.source).toBe("belief");
    expect(perceived.value).toBe(40); // 연구자의 초기 믿음 (실제는 12)
  });

  it("믿음이 바뀌면 같은 세계에서 활성도가 바뀐다 (§20)", () => {
    const runtime = newRuntime();
    const graph = runtime.index.goalGraphs.get("goal_graph.hunter")!;
    const secureFood = graph.nodes.find((node) => node.id === "goal.secure_food")!;

    const before = calculateGoalActivation(runtime, "agent.kael", secureFood).activation;
    // 실제 마을 식량은 그대로. 사냥꾼의 *믿음*만 바꾼다.
    runtime.agentRuntime("agent.kael").beliefs.push({
      subjectId: VILLAGE,
      stateKey: "food_reserve",
      believedValue: 5,
      confidence: 0.9,
      sourceIds: ["rumor.empty_granary"],
      lastUpdatedAt: 0,
    });
    const after = calculateGoalActivation(runtime, "agent.kael", secureFood).activation;

    expect(runtime.store.readNumber(VILLAGE, "food_reserve")).toBe(80); // 실제는 변하지 않았다
    expect(after).toBeGreaterThan(before);
  });
});

describe("인식 — 소문은 직접 관찰보다 확신이 낮다 (§23, §25)", () => {
  it("같은 주장도 전달 경로에 따라 확신이 갈린다", () => {
    const comparison = compareHearsayConfidence(1);
    expect(comparison.direct).toBeGreaterThan(0);
    expect(comparison.rumor).toBeGreaterThan(0);
    expect(comparison.rumor).toBeLessThan(comparison.direct);
  });
});

describe("기억 — 감쇠·요약 통합·상한 (§24)", () => {
  it("같은 상대에 대한 저중요도 기억 3개 이상은 요약 믿음으로 접힌다", () => {
    const runtime = newRuntime();
    for (let i = 0; i < 4; i++) {
      rememberEvent(runtime, "agent.kael", {
        type: "interaction",
        participants: ["agent.kael", "agent.ren"],
        tags: ["trade"],
        emotionalIntensity: 5,
        relevance: 6,
        confidence: 0.6,
      });
    }
    const result = maintainMemories(runtime, "agent.kael");
    expect(result.consolidated).toBeGreaterThanOrEqual(3);
    const summary = findBelief(runtime.agentRuntime("agent.kael"), "agent.ren", "tendency:trade");
    expect(summary?.believedValue).toBe(4);
  });

  it("기억 수는 상한을 넘지 않는다", () => {
    const runtime = newRuntime();
    for (let i = 0; i < MEMORY_CAPACITY * 2; i++) {
      rememberEvent(runtime, "agent.kael", {
        type: "observation",
        participants: ["agent.kael", `other.${i}`],
        tags: [`tag${i}`],
        emotionalIntensity: 50,
        relevance: 50,
        confidence: 1,
      });
    }
    expect(runtime.agentRuntime("agent.kael").memories.length).toBeLessThanOrEqual(MEMORY_CAPACITY);
  });
});

describe("생존 압력 (§8)", () => {
  it("해소되지 않으면 쌓이고, 해소되면 사라진다", () => {
    const runtime = newRuntime();
    runtime.store.modify("agent.kael", "hunger", "set", 80); // pressure.body_maintenance 미해소
    accumulatePressures(runtime, "agent.kael");
    accumulatePressures(runtime, "agent.kael");
    const accumulated = runtime.agentRuntime("agent.kael").pressures["pressure.body_maintenance"];
    expect(accumulated).toBeGreaterThan(0);

    runtime.store.modify("agent.kael", "hunger", "set", 10);
    runtime.store.modify("agent.kael", "health", "set", 90);
    accumulatePressures(runtime, "agent.kael");
    expect(runtime.agentRuntime("agent.kael").pressures["pressure.body_maintenance"]).toBeUndefined();
  });
});

describe("목적 충돌이 선택을 바꾼다 (§19, §20)", () => {
  it("conflicts 엣지를 빼면 1순위 목적이 달라진다", () => {
    const conflict = measureGoalConflict(1);
    expect(conflict.subtracted).toBeGreaterThan(0);
    expect(conflict.flipped).toBe(true);
  });
});

describe("조직도 주체다 (§17, Phase-3 §3.7)", () => {
  it("조직은 자기 목적 그래프로 판단한다", () => {
    const runtime = newRuntime();
    expect(runtime.agentRuntime(VILLAGE).kind).toBe("faction");
    const ranked = rankGoals(runtime, VILLAGE);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]!.goalId.startsWith("goal.faction_")).toBe(true);
  });

  it("조직의 위임이 개인의 목적 그래프에 주입되고 약속이 된다", () => {
    const runtime = newRuntime();
    runtime.store.modify("agent.kael", "delegated_goal", "set", "goal.subjugate_beast");
    runtime.store.modify("agent.kael", "delegated_by", "set", VILLAGE);
    syncDelegations(runtime);

    const kael = runtime.agentRuntime("agent.kael");
    expect(kael.delegations.map((d) => d.goalId)).toContain("goal.subjugate_beast");
    expect(relationshipView(runtime, "agent.kael", VILLAGE).promises).toHaveLength(1);
    expect(rankGoals(runtime, "agent.kael").map((g) => g.goalId)).toContain("goal.subjugate_beast");
  });

  it("같은 위임도 충성도에 따라 다르게 받아들여진다 (§18-6 조직 목적 ↕ 개인 가치관)", () => {
    const activationFor = (loyalty: number): number => {
      const runtime = newRuntime();
      runtime.agentRuntime("agent.kael").traits["loyalty"] = loyalty;
      runtime.store.modify("agent.kael", "delegated_goal", "set", "goal.subjugate_beast");
      runtime.store.modify("agent.kael", "delegated_by", "set", VILLAGE);
      syncDelegations(runtime);
      const goal = rankGoals(runtime, "agent.kael").find((g) => g.goalId === "goal.subjugate_beast");
      return goal?.activation ?? 0;
    };
    expect(activationFor(95)).toBeGreaterThan(activationFor(5));
  });

  it("약속을 어기면 표식이 서고, 관계 규칙이 신뢰를 깎는다 (§25)", () => {
    const runtime = newRuntime();
    addPromise(runtime, "agent.kael", VILLAGE, {
      id: "promise.test",
      stateKey: "delegation_completed",
      comparison: ">",
      threshold: 0,
      createdAt: 0,
      dueAt: 0,
      status: "open",
      tags: ["delegation"],
    });
    runtime.state.simulationTime = TICKS_PER_DAY;
    const outcomes = resolveDuePromises(runtime);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.status).toBe("broken");
    expect(runtime.store.readBoolean("agent.kael", "promise_broken")).toBe(true);
  });

  it("붕괴 조건을 채운 조직은 무너지고 구성원의 소속이 풀린다 (§17, §35)", () => {
    const runtime = newRuntime();
    expect(checkFactionCollapse(runtime)).toEqual([]); // 시작부터 무너지지 않는다

    runtime.store.modify(VILLAGE, "starving_days", "set", 9);
    expect(checkFactionCollapse(runtime)).toContain(VILLAGE);
    expect(runtime.store.readBoolean(VILLAGE, "collapsed")).toBe(true);
    expect(runtime.store.read("agent.kael", "faction_id")).toBe("");
  });
});
