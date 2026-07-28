// Phase 4 완료 조건 (DoD) — 사건 탐지 (§28, §29, §30)
//
// verify 스크립트와 **같은 측정 함수**(phase4Checks)를 쓴다. 보고의 수치와 테스트의 수치가 갈라지지 않게.
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { hashValue } from "../../shared/hash";
import { TICKS_PER_DAY } from "../../shared/time";
import { RuleEngine } from "../rules/RuleEngine";
import { InlineHost } from "../simulation/InlineHost";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { validateWorldDefinition } from "../world/WorldValidation";
import { WorldRuntime } from "../world/WorldRuntime";
import type { EventPattern } from "../world/types";
import { ChangeCollector } from "./ChangeCollector";
import { detectEmergentEvents, DETECTION_INTERVAL, SIGNIFICANCE_THRESHOLD } from "./EventDetector";
import { updateEventSummaries } from "./EventSummarizer";
import { getEventViewFor, possibleInteractions } from "./EventViews";
import {
  eventCountsByPattern,
  eventsBySignificance,
  findConcludedWithConsequences,
  findEcologicalConflict,
  findGoalConflictEvents,
  findMostDividedEvent,
  measurePromotion,
  participantMix,
  summarizeEvents,
} from "./phase4Checks";

async function run(days: number, worldSeed = 42): Promise<WorldRuntime> {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed });
  await host.request({ type: "advance_time", amount: days * TICKS_PER_DAY });
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");
  return runtime;
}

/** 규칙 없이 change 만 직접 넣어 매처만 시험하는 실험대 */
function bench(patterns: EventPattern[]): WorldRuntime {
  const definition = { ...buildManualWorld(7), eventPatterns: patterns };
  const runtime = new WorldRuntime(definition);
  bootstrapWorld(runtime);
  return runtime;
}

const TEST_PATTERN: EventPattern = {
  id: "pattern.test",
  name: "시험 패턴",
  type: "test_conflict",
  requiredTags: ["threat", "creature"],
  optionalTags: ["fear"],
  minimumParticipants: 3,
  timeWindow: 600,
  locationRadius: 15,
  significanceFormula: "standard",
};

function attack(runtime: WorldRuntime, sourceId: string, targetId: string, damage: number): void {
  runtime.store.withContext(
    { sourceId, targetIds: [targetId], tags: ["rule", "rule.attack_resolution", "threat", "creature", "violence"] },
    () => {
      runtime.store.modify(targetId, "health", "add", -damage);
    },
  );
}

function detect(runtime: WorldRuntime, collector: ChangeCollector): void {
  detectEmergentEvents(runtime, collector);
  updateEventSummaries(runtime);
}

describe("사건 탐지 매처 (§28)", () => {
  it("참여자가 최소 인원에 못 미치면 사건이 되지 않는다", () => {
    const runtime = bench([TEST_PATTERN]);
    const collector = new ChangeCollector(TEST_PATTERN.timeWindow * 3);
    // 짐승 → 사냥꾼 하나뿐: 참여자는 짐승·사냥꾼·종족 둘… 최소 인원을 넉넉히 올려 못 미치게 만든다
    const strict = { ...TEST_PATTERN, minimumParticipants: 12 };
    runtime.definition.eventPatterns[0] = strict;
    attack(runtime, "creature.echo_beast_mother", "agent.kael", 10);
    runtime.state.simulationTime = 500;
    detect(runtime, collector);
    expect(runtime.state.events.events).toHaveLength(0);
  });

  it("같은 창·같은 자리의 변화가 하나의 사건으로 묶이고 참여자가 종족까지 올라간다", () => {
    const runtime = bench([TEST_PATTERN]);
    const collector = new ChangeCollector(TEST_PATTERN.timeWindow * 3);
    attack(runtime, "creature.echo_beast_mother", "agent.kael", 10);
    runtime.state.simulationTime = 100;
    attack(runtime, "creature.echo_beast_mother", "agent.ren", 12);
    runtime.state.simulationTime = 500;
    detect(runtime, collector);

    const events = runtime.state.events.events;
    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.type).toBe("test_conflict");
    expect(event.status).toBe("ongoing");
    const mix = participantMix(runtime, event);
    expect(mix.species).toContain("species.echo_beast");
    expect(mix.species).toContain("species.human");
    expect(mix.individuals).toContain("agent.kael");
    expect(event.summary?.totalChangeCount).toBe(2);
  });

  it("진행 중 사건은 새 변화를 흡수해 자라고, 조용해지면 종결된다 (§28 status)", () => {
    const runtime = bench([TEST_PATTERN]);
    const collector = new ChangeCollector(TEST_PATTERN.timeWindow * 3);
    attack(runtime, "creature.echo_beast_mother", "agent.kael", 10);
    runtime.state.simulationTime = 500;
    detect(runtime, collector);
    const event = runtime.state.events.events[0]!;
    const firstCount = event.summary!.totalChangeCount;

    // 같은 사건이 이어진다 — 새 사건이 생기지 않고 기존 사건이 자란다
    runtime.state.simulationTime = 600;
    attack(runtime, "creature.echo_beast_mother", "agent.mar", 20);
    runtime.state.simulationTime = 600 + DETECTION_INTERVAL;
    detect(runtime, collector);
    expect(runtime.state.events.events).toHaveLength(1);
    expect(event.summary!.totalChangeCount).toBeGreaterThan(firstCount);
    expect(event.status).toBe("ongoing");

    // timeWindow 의 2배 동안 아무 일도 없으면 닫힌다
    runtime.state.simulationTime = event.lastChangeAt + TEST_PATTERN.timeWindow * 2 + DETECTION_INTERVAL;
    detect(runtime, collector);
    expect(event.status).toBe("concluded");
    expect(event.concludedAt).toBe(runtime.state.simulationTime);
    // 종결된 사건은 세계에 흔적을 남긴다 (§44-9)
    const health = event.summary!.affectedStateSummaries.find(
      (entry) => entry.entityId === "agent.kael" && entry.stateKey === "health",
    );
    expect(health?.delta).toBeLessThan(0);
    expect(event.summary!.netChangedStateCount).toBeGreaterThan(0);
  });

  it("탐지는 주기로만 돈다 — 호출 횟수가 결과를 바꾸지 않는다 (§39)", () => {
    const runtime = bench([TEST_PATTERN]);
    const collector = new ChangeCollector(TEST_PATTERN.timeWindow * 3);
    attack(runtime, "creature.echo_beast_mother", "agent.kael", 10);
    runtime.state.simulationTime = 500;
    expect(detectEmergentEvents(runtime, collector)).toBe(true);
    expect(detectEmergentEvents(runtime, collector)).toBe(false);
    expect(runtime.state.events.events).toHaveLength(1);
  });

  it("중요도는 §29 의 6항 합이고 병합할 때마다 다시 계산된다", () => {
    const runtime = bench([TEST_PATTERN]);
    const collector = new ChangeCollector(TEST_PATTERN.timeWindow * 3);
    attack(runtime, "creature.echo_beast_mother", "agent.kael", 10);
    runtime.state.simulationTime = 500;
    detect(runtime, collector);
    const event = runtime.state.events.events[0]!;
    const breakdown = event.significanceBreakdown;
    expect(breakdown.participants).toBe(event.participants.length * 8);
    // 조작 중인 주체가 없으면 이 항은 0 이다 (§29 — 플레이어 없는 세계의 중요도는 변하지 않는다)
    expect(breakdown.playerRelevance).toBe(0);
    const total =
      breakdown.participants +
      breakdown.affectedSystems +
      breakdown.magnitude +
      breakdown.relationshipImpact +
      breakdown.playerRelevance +
      breakdown.futurePotential;
    expect(event.significance).toBeCloseTo(total, 6);

    const before = event.significance;
    runtime.state.simulationTime = 600;
    attack(runtime, "creature.echo_beast_mother", "agent.mar", 40);
    runtime.state.simulationTime = 600 + DETECTION_INTERVAL;
    detect(runtime, collector);
    expect(event.significance).toBeGreaterThan(before);
  });
});

describe("세계 정의 검증 — 사건 패턴 (§34)", () => {
  const definition = buildManualWorld(1);
  const rules = new RuleEngine(definition.ruleDefinitions);

  it("수동 세계의 패턴은 검증을 통과한다", () => {
    expect(validateWorldDefinition(definition, rules)).toEqual([]);
    expect(definition.eventPatterns.length).toBeGreaterThanOrEqual(4);
    expect(definition.eventPatterns.length).toBeLessThanOrEqual(10); // §40 한도
  });

  it("세계에 없는 태그·한 주체 패턴·모르는 계산식은 거부된다", () => {
    const broken = {
      ...definition,
      eventPatterns: [
        { ...TEST_PATTERN, requiredTags: ["존재하지_않는_태그"], minimumParticipants: 1, significanceFormula: "magic" },
      ],
    };
    const errors = validateWorldDefinition(broken, rules);
    expect(errors.some((error) => error.includes("어떤 규칙·행동·개체도 갖지 않은 태그"))).toBe(true);
    expect(errors.some((error) => error.includes("minimumParticipants"))).toBe(true);
    expect(errors.some((error) => error.includes("중요도 계산식"))).toBe(true);
  });
});

describe("Phase 4 DoD — 수동 세계 30일", () => {
  it("§28 구조의 사건(종족·조직·개인 혼합)이 자동 검출되고 모든 패턴이 발화한다", async () => {
    const runtime = await run(30);
    const conflict = findEcologicalConflict(runtime);
    expect(conflict, "생태 충돌 사건이 검출되지 않았다").toBeDefined();
    const mix = participantMix(runtime, conflict!);
    expect(mix.species.length).toBeGreaterThan(0);
    expect(mix.factions.length).toBeGreaterThan(0);
    expect(mix.individuals.length).toBeGreaterThan(0);
    for (const entry of eventCountsByPattern(runtime)) {
      expect(entry.count, `${entry.patternId} 이 한 번도 발화하지 않았다`).toBeGreaterThan(0);
    }
  });

  it("세 주체 이상의 목적이 충돌하는 사건이 존재한다 (§44-7)", async () => {
    const runtime = await run(30);
    const reports = findGoalConflictEvents(runtime, 3);
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[0]!.agents.length).toBeGreaterThanOrEqual(3);
    // 충돌은 "같은 개체의 같은 상태를 반대 방향으로 요구"로만 성립한다
    for (const conflict of reports[0]!.event.summary!.goalConflicts) {
      expect(conflict.left.demand).not.toBe(conflict.right.demand);
      expect(conflict.left.agentId).not.toBe(conflict.right.agentId);
    }
  });

  it("같은 사건이라도 관찰자마다 아는 사실이 다르다 (§30)", async () => {
    const runtime = await run(30);
    const comparison = findMostDividedEvent(runtime, "agent.kael", "agent.rion");
    expect(comparison).toBeDefined();
    expect(comparison!.onlyLeft.length + comparison!.onlyRight.length).toBeGreaterThan(0);

    // 사건을 전혀 모르는 관찰자도 있어야 한다 — 아는 것이 곧 세계 전체가 아니다
    const event = eventsBySignificance(runtime)[0]!;
    const cub = runtime.agentIds().find((id) => id.startsWith("creature.echo_beast_cub"));
    if (cub !== undefined) {
      const cubView = getEventViewFor(runtime, cub, event.id);
      expect(cubView.knownParticipants.length).toBeLessThan(event.participants.length);
    }
    // 개입 방식은 미리 정해지지 않는다 — 행동 체계에서 역산된다 (§30)
    const interactions = possibleInteractions(runtime, "agent.kael", event);
    expect(interactions.length).toBeGreaterThan(0);
    for (const actionId of interactions) {
      expect(runtime.index.actions.has(actionId)).toBe(true);
    }
  });

  it("종결 사건은 순변화를 남기고 참여자에게 새 목적을 연다 (§44-9, §44-10)", async () => {
    const runtime = await run(30);
    const reports = findConcludedWithConsequences(runtime);
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[0]!.netChangedStates).toBeGreaterThan(0);
    expect(reports[0]!.newGoals.length).toBeGreaterThan(0);
  });

  it("평시 변화는 사건으로 승격되지 않는다 (§29)", async () => {
    const runtime = await run(30);
    const promotion = measurePromotion(runtime, ["action.rest", "action.eat", "action.move", "action.attack"]);
    const routine = promotion.byAction.filter((entry) => entry.actionId !== "action.attack");
    const routineRate =
      routine.reduce((sum, entry) => sum + entry.assigned, 0) /
      routine.reduce((sum, entry) => sum + entry.total, 0);
    const attack = promotion.byAction.find((entry) => entry.actionId === "action.attack")!;
    expect(routineRate).toBeLessThan(0.25);
    expect(attack.assigned / attack.total).toBeGreaterThan(routineRate * 2);
    expect(promotion.assignedChanges).toBeLessThan(promotion.totalChanges * 0.5);
    // 임계 미만 사건은 저장되되 기본 뷰에서 숨는다
    expect(promotion.lowestSignificance).toBeLessThan(SIGNIFICANCE_THRESHOLD);
  });

  it("같은 시드는 같은 사건 목록을 만든다 (§44-12)", async () => {
    const first = await run(20, 42);
    const second = await run(20, 42);
    const other = await run(20, 43);
    expect(hashValue(summarizeEvents(first))).toBe(hashValue(summarizeEvents(second)));
    expect(hashValue(summarizeEvents(first))).not.toBe(hashValue(summarizeEvents(other)));
  });
});
