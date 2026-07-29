// Phase 6 완료 조건 점검 도구 (verify.ts 와 테스트가 **같은 함수**를 쓴다 — Phase 3~5 와 같은 규약)
//
// 여기 있는 위반 픽스처는 "검사기가 실제로 잡는가"를 증명한다.
// 수동 세계(Phase 1~4 완성본)를 한 군데씩 망가뜨려 놓고, 그 항목의 검사기가 error 를 내는지 본다.
// 통과 세계로는 검사기가 살아 있는지 알 수 없다 — 통과는 "검사하지 않았다"와 구별되지 않기 때문이다.
import { buildManualWorld } from "../content/manual-world";
import type { AbilityDefinition, GoalGraph, WorldDefinition } from "../core/world/types";
import type { RuleEffect } from "../core/rules/RuleTypes";
import { SEMANTIC_CODES, validateWorld, type SemanticCode } from "./WorldValidator";

/** 항상 참인 조건 — "이미 이룬 목적"을 만들 때 쓴다 */
const ALWAYS_TRUE = {
  left: { kind: "const" as const, value: 1 },
  operator: "==" as const,
  right: { kind: "const" as const, value: 1 },
};

function contentedGraph(): GoalGraph {
  return {
    id: "goal_graph.contented",
    nodes: [
      {
        id: "goal.already_done",
        description: "이미 이룬 목적",
        targetConditions: [ALWAYS_TRUE],
        baseImportance: 40,
        urgencyPolicy: { type: "constant", value: 0 },
        desiredChanges: [{ stateKey: "energy", direction: "increase", weight: 1 }],
        abandonmentConditions: [],
        allowedActionTags: ["rest"],
      },
    ],
    edges: [],
  };
}

function treadmillGraph(): GoalGraph {
  const node = (id: string, description: string): GoalGraph["nodes"][number] => ({
    id,
    description,
    targetConditions: [],
    baseImportance: 30,
    urgencyPolicy: { type: "constant", value: 10 },
    desiredChanges: [{ stateKey: "energy", direction: "increase", weight: 1 }],
    abandonmentConditions: [],
    allowedActionTags: ["rest"],
  });
  return {
    id: "goal_graph.treadmill",
    nodes: [node("goal.loop_a", "끝나지 않는 앞일"), node("goal.loop_b", "끝나지 않는 뒷일")],
    edges: [
      { from: "goal.loop_a", to: "goal.loop_b", relation: "requires", weight: 1 },
      { from: "goal.loop_b", to: "goal.loop_a", relation: "requires", weight: 1 },
    ],
  };
}

function ability(id: string, output: number, severity: number, cost: number): AbilityDefinition {
  return {
    id,
    ownerId: "agent.kael",
    purpose: "픽스처",
    targetTypes: ["agent"],
    operation: "강화",
    medium: "말",
    activationConditions: [],
    maintenanceConditions: [],
    restrictions: [{ description: "픽스처 제약", severity }],
    costs: [{ stateKey: "energy", amount: cost }],
    failureEffects: [{ stateKey: "health", operation: "add", value: -10 }],
    observableSignals: [],
    knownBy: ["agent.kael"],
    mastery: 50,
    outputRange: { min: 0, max: output },
    inferableWeakness: "픽스처",
    actionIds: [],
    ruleIds: [],
    derivedFrom: { coreDesire: "픽스처", acceptedCost: "픽스처" },
  };
}

export interface ViolationFixture {
  code: SemanticCode;
  /** 무엇을 망가뜨렸는가 */
  title: string;
  break(definition: WorldDefinition): void;
}

/** §34 필수 규칙 10개 ↔ 그 규칙을 어기는 세계 하나씩 */
export const VIOLATION_FIXTURES: ViolationFixture[] = [
  {
    code: "state.schema",
    title: "규칙이 등록되지 않은 상태에 값을 쓴다",
    break(definition) {
      const rule = definition.ruleDefinitions[0]!;
      const effect = rule.effects.find((entry): entry is Extract<RuleEffect, { type: "modify_state" }> =>
        entry.type === "modify_state",
      );
      if (effect === undefined) throw new Error("픽스처: modify_state 효과가 있는 규칙이 필요하다");
      effect.stateKey = "unregistered_mana";
    },
  },
  {
    code: "rule.target-exists",
    title: "조직이 존재하지 않는 종족과의 기본 관계를 선언한다",
    break(definition) {
      definition.factions[0]!.relationshipDefaults["species.ghost"] = 40;
    },
  },
  {
    code: "resource.source",
    title: "생성 경로도 초기 배치도 없는 자원이 있다",
    break(definition) {
      definition.resources.push({
        id: "resource.phantom_salt",
        name: "유령 소금",
        tags: ["mineral"],
        properties: {},
        productionRules: [],
        consumptionRules: [],
        transformationRules: [],
        desiredBy: [{ agentTag: "villager", utility: 50 }],
      });
    },
  },
  {
    code: "species.need",
    title: "생존 자원이 하나도 없는 종족이 있다",
    break(definition) {
      definition.species[0]!.requiredResources = [];
    },
  },
  {
    code: "faction.lifecycle",
    title: "붕괴 조건이 없는 조직이 있다",
    break(definition) {
      definition.factions[0]!.collapseConditions = [];
    },
  },
  {
    code: "faction.hidden",
    title: "은닉 목적이 실행 목적에 연결되지 않은 조직이 있다 (G-3)",
    break(definition) {
      const faction = definition.factions.find((entry) => entry.hiddenPurposes.length > 0);
      if (faction === undefined) throw new Error("픽스처: 은닉 목적을 가진 조직이 필요하다");
      delete faction.hiddenGoalIds;
    },
  },
  {
    code: "agent.goal",
    title: "초기 상태에서 이미 모든 목적을 이룬 개인이 있다",
    break(definition) {
      definition.goalTemplates.push(contentedGraph());
      const agent = definition.bootstrap.entities.find((entity) => entity.id === "agent.mar");
      if (agent === undefined) throw new Error("픽스처: agent.mar 가 필요하다");
      agent.goalGraphId = "goal_graph.contented";
    },
  },
  {
    code: "action.cost",
    title: "비용도 위험도 없는 공짜 행동이 있다",
    break(definition) {
      const action = definition.actionDefinitions[0]!;
      action.costs = [];
      action.risk = 0;
    },
  },
  {
    code: "ability.cost-scaling",
    title: "더 강한 능력이 더 싼 대가를 갖는다",
    break(definition) {
      definition.abilitySystem = {
        abilities: [ability("ability.weak_but_costly", 40, 80, 40), ability("ability.strong_and_cheap", 90, 5, 2)],
      };
    },
  },
  {
    code: "event.multi-agent",
    title: "혼자서 벌어지는 사건 패턴이 있다",
    break(definition) {
      definition.eventPatterns[0]!.minimumParticipants = 1;
    },
  },
  {
    code: "goal.no-infinite",
    title: "완료·포기 조건 없는 순환 목적 그래프가 있다",
    break(definition) {
      definition.goalTemplates.push(treadmillGraph());
    },
  },
];

export interface FixtureResult {
  code: SemanticCode;
  title: string;
  /** 해당 검사기가 error 를 냈는가 */
  detected: boolean;
  /** 검출된 메시지 (첫 건) */
  message: string;
  /** 같이 걸린 다른 검사기 — 숨기지 않는다 */
  alsoFailed: string[];
}

/**
 * 위반 픽스처 11종을 전부 돌린다.
 * 반환값이 곧 DoD 1 의 근거다 — verify 와 테스트가 이 함수를 함께 쓴다.
 */
export function runViolationFixtures(worldSeed = 42): FixtureResult[] {
  return VIOLATION_FIXTURES.map((fixture) => {
    const definition = structuredClone(buildManualWorld(worldSeed));
    fixture.break(definition);
    const report = validateWorld(definition);
    const hits = report.issues.filter((issue) => issue.level === "error" && issue.code === fixture.code);
    const alsoFailed = report.checks
      .filter((check) => !check.ok && check.code !== fixture.code)
      .map((check) => check.code);
    return {
      code: fixture.code,
      title: fixture.title,
      detected: hits.length > 0,
      message: hits[0]?.message ?? "검출되지 않음",
      alsoFailed,
    };
  });
}

/** 통과 세계(수동 세계)에서는 11종 전부 조용해야 한다 — 픽스처의 대조군 */
export function validateManualWorld(worldSeed = 42): ReturnType<typeof validateWorld> {
  return validateWorld(buildManualWorld(worldSeed));
}

export { SEMANTIC_CODES };
