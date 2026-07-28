// 규칙 실험실 — §12 가 규칙 DSL 에 요구하는 능력 10항목을 하나씩 실행해 보이기 위한 최소 세계.
//
// 세계 콘텐츠가 아니라 **DSL 의 시험대**다. 검사 대상(규칙)은 JSON(rules.json)이고,
// 그 규칙이 돌아갈 무대(스키마·행동·배치)만 여기서 코드로 세운다.
import { loadRuleDocuments } from "../../core/rules/RuleSchema";
import type { EntityTemplate } from "../../core/rules/RuleTypes";
import type { ActionDefinition, StateSchema, WorldDefinition } from "../../core/world/types";
import ruleDocuments from "./rules.json";

const REGION = "region.lab";

function agentNumber(id: string, defaultValue = 0, max = 500): StateSchema {
  return {
    id,
    ownerType: "agent",
    dataType: "number",
    defaultValue,
    min: 0,
    max,
    observable: false,
    updatePolicy: "event",
  };
}

function agentString(id: string): StateSchema {
  return {
    id,
    ownerType: "agent",
    dataType: "string",
    defaultValue: "",
    observable: false,
    updatePolicy: "event",
  };
}

const STATE_SCHEMAS: StateSchema[] = [
  {
    id: "lab_price",
    ownerType: "world",
    dataType: "number",
    defaultValue: 0,
    min: 0,
    max: 1000,
    observable: false,
    updatePolicy: "event",
  },
  agentNumber("health", 50, 100),
  agentNumber("energy", 50, 100),
  agentNumber("stock", 0),
  agentNumber("nearby_count"),
  agentNumber("trust_echo"),
  agentNumber("delayed_mark"),
  agentNumber("entered_mark"),
  agentNumber("ping_a", 0, 1000000),
  agentNumber("ping_b", 0, 1000000),
  {
    id: "marked",
    ownerType: "agent",
    dataType: "boolean",
    defaultValue: false,
    observable: true,
    observationChannels: ["sight"],
    updatePolicy: "event",
  },
  {
    id: "marks",
    ownerType: "agent",
    dataType: "set",
    defaultValue: [],
    observable: false,
    updatePolicy: "event",
  },
  agentString("species_id"),
  agentString("faction_id"),
  agentString("goal_graph_id"),
  agentString("current_action"),
  agentString("active_goal"),
  // §26 shouldReplan 이 읽는 파생 상태 — 실험실도 같은 런타임 배선을 쓴다
  {
    id: "survivalPressure",
    ownerType: "agent",
    dataType: "number",
    defaultValue: 0,
    min: 0,
    max: 100,
    observable: false,
    updatePolicy: "derived",
  },
  {
    id: "stress",
    ownerType: "agent",
    dataType: "number",
    defaultValue: 0,
    min: 0,
    max: 100,
    observable: false,
    updatePolicy: "derived",
  },
  {
    id: "amount",
    ownerType: "resource",
    dataType: "number",
    defaultValue: 0,
    min: 0,
    max: 500,
    observable: true,
    observationChannels: ["sight"],
    updatePolicy: "continuous",
  },
];

const ACTIONS: ActionDefinition[] = [
  {
    id: "action.lab_use",
    name: "실험 행동",
    tags: ["lab"],
    actorRequirements: [],
    targetQuery: { kind: "entity_tag", tag: "lab_partner", excludeSelf: true },
    worldRequirements: [],
    costs: [{ stateKey: "energy", amount: 1 }],
    duration: 1,
    movement: "to_target",
    expectedEffects: [],
    executionRules: [
      "rule.lab_transfer",
      "rule.lab_relationship",
      "rule.lab_signal",
      "rule.lab_schedule",
    ],
    visibleSignals: [
      {
        signalId: "signal.lab_ping",
        channels: ["sight"],
        strength: 80,
        tags: ["lab"],
        claim: { subject: "actor", stateKey: "marked", value: true, confidence: 0.9 },
      },
    ],
    risk: 1,
  },
];

const TEMPLATES: EntityTemplate[] = [
  { id: "template.sprout", type: "resource", tags: ["plant", "spawned"], states: { amount: 5 } },
];

export const LAB_AGENTS = ["lab.a0", "lab.a1", "lab.a2", "lab.a3", "lab.a4", "lab.a5"];
export const LAB_PARTNER = "lab.partner";
export const LAB_OUTSIDER = "lab.outsider";
export const LAB_PLANT = "lab.plant";
export const LAB_REGION = REGION;

/** §12 능력 시험용 세계 정의 */
export function buildRuleLabWorld(worldSeed: number): WorldDefinition {
  return {
    metadata: { id: "world.rule_lab", title: "규칙 실험실", worldSeed },
    axioms: [],
    stateSchemas: STATE_SCHEMAS,
    ruleDefinitions: loadRuleDocuments(ruleDocuments as unknown[]),
    entityTemplates: TEMPLATES,
    spaces: {
      regions: [
        {
          id: REGION,
          name: "실험 구역",
          bounds: { width: 200, height: 200, depth: 50 },
          tags: ["lab_zone"],
          baseStates: {},
        },
        {
          id: "region.outside",
          name: "바깥",
          bounds: { width: 200, height: 200, depth: 50 },
          tags: [],
          baseStates: {},
        },
      ],
      locations: [],
      connections: [{ from: REGION, to: "region.outside", travelCost: 10, danger: 0, capacity: 10 }],
    },
    resources: [],
    species: [],
    factions: [],
    agentArchetypes: [],
    abilitySystem: null,
    goalTemplates: [],
    actionDefinitions: ACTIONS,
    eventPatterns: [],
    bootstrap: {
      entities: [
        {
          id: REGION,
          type: "location",
          name: "실험 구역",
          position: { regionId: REGION, x: 0, y: 0, z: 0 },
          tags: ["region", "lab_zone"],
          states: {},
        },
        {
          id: "region.outside",
          type: "location",
          name: "바깥",
          position: { regionId: "region.outside", x: 0, y: 0, z: 0 },
          tags: ["region"],
          states: {},
        },
        ...LAB_AGENTS.map((id, i) => ({
          id,
          type: "agent" as const,
          name: id,
          position: { regionId: REGION, x: i * 30, y: 0, z: 0 },
          tags: ["living"],
          states: { health: i === 0 ? 20 : 60, stock: 20 },
        })),
        {
          id: LAB_PARTNER,
          type: "agent",
          name: "실험 상대",
          position: { regionId: REGION, x: 5, y: 0, z: 0 },
          tags: ["living", "lab_partner"],
          states: { stock: 0 },
        },
        {
          id: LAB_OUTSIDER,
          type: "agent",
          name: "바깥 사람",
          position: { regionId: "region.outside", x: 0, y: 0, z: 0 },
          tags: ["living"],
          states: {},
        },
        {
          id: LAB_PLANT,
          type: "resource",
          name: "실험 식물",
          position: { regionId: REGION, x: 10, y: 0, z: 0 },
          tags: ["plant"],
          states: { amount: 40 },
        },
      ],
    },
  };
}
