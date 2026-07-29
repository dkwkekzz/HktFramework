// 단계별 출력 JSON Schema (Phase-5 §5.2 "모든 단계 출력은 outputSchema 로 즉시 검증")
//
// 여기 있는 스키마가 곧 생성 AI 와의 계약이다. 규칙(§11)만은 이미 Phase 2 가 계약을 갖고 있으므로
// RULE_JSON_SCHEMA 를 그대로 쓴다 — "Phase 1~4 의 실행 포맷이 곧 생성기의 출력 계약"(Phase-5 목표).
import { RULE_JSON_SCHEMA } from "../core/rules/RuleSchema";
import type { JsonSchema } from "./TextGenerationPort";

const STRING_ARRAY = { type: "array", items: { type: "string" } } as const;
const NUMBER = { type: "number" } as const;

/** 여러 스키마가 공유하는 조각 — 조건식(§11.2)과 관찰 신호(§21) */
const COMMON_DEFS: Record<string, JsonSchema> = {
  valueRef: {
    type: "object",
    required: ["kind"],
    properties: {
      kind: { enum: ["const", "state", "belief", "entity_state", "entity_ref", "distance"] },
      owner: { enum: ["actor", "target"] },
      subject: { enum: ["target"] },
      key: { type: "string" },
      entityId: { type: "string" },
      from: { enum: ["actor"] },
      to: { enum: ["target"] },
      value: {},
    },
  },
  condition: {
    type: "object",
    required: ["left", "operator", "right"],
    additionalProperties: false,
    properties: {
      left: { $ref: "#/$defs/valueRef" },
      operator: { enum: [">", ">=", "<", "<=", "==", "!=", "contains"] },
      right: { $ref: "#/$defs/valueRef" },
    },
  },
  observation: {
    type: "object",
    required: ["signalId", "channels", "strength", "tags"],
    properties: {
      signalId: { type: "string" },
      channels: STRING_ARRAY,
      strength: NUMBER,
      tags: STRING_ARRAY,
      origin: { enum: ["actor", "target"] },
      claim: {
        type: "object",
        required: ["subject", "stateKey"],
        properties: {
          subject: { enum: ["actor", "target", "entity"] },
          entityId: { type: "string" },
          stateKey: { type: "string" },
          value: {},
          confidence: NUMBER,
          observerStateKey: { type: "string" },
          relayBelief: { type: "boolean" },
        },
      },
    },
  },
};

function arrayOf(item: JsonSchema, extraDefs = false): JsonSchema {
  return {
    type: "array",
    items: item,
    ...(extraDefs ? { $defs: COMMON_DEFS } : {}),
  };
}

// --- 1 주제 정규화 (§6) ---------------------------------------------------------

export const NORMALIZED_THEME_SCHEMA = arrayOf({
  type: "object",
  required: ["id", "source", "subject", "scope"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    source: { type: "string" },
    subject: { type: "string" },
    condition: { type: "string" },
    behavior: { type: "string" },
    desiredState: { type: "string" },
    cost: { type: "string" },
    threat: { type: "string" },
    scope: { enum: ["world", "species", "society", "individual"] },
  },
});

// --- 2 핵심 명제 (§7) -----------------------------------------------------------

export const AXIOM_SCHEMA = arrayOf({
  type: "object",
  required: ["id", "statement", "category", "immutable", "derivedFrom"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    statement: { type: "string" },
    category: {
      enum: ["existence", "survival", "power", "cost", "ecology", "society", "information"],
    },
    immutable: { type: "boolean" },
    derivedFrom: STRING_ARRAY,
  },
});

// --- 3 생존 압력 (§8) -----------------------------------------------------------

export const PRESSURE_SCHEMA = arrayOf(
  {
    type: "object",
    required: [
      "id",
      "targetState",
      "failureState",
      "urgencyGrowth",
      "applicableSpeciesTags",
      "relatedResources",
      "goalId",
      "relievedWhen",
      "maxUrgency",
    ],
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      targetState: { type: "string" },
      failureState: { type: "string" },
      urgencyGrowth: NUMBER,
      applicableSpeciesTags: STRING_ARRAY,
      relatedResources: STRING_ARRAY,
      goalId: { type: "string" },
      relievedWhen: arrayOf({ $ref: "#/$defs/condition" }),
      maxUrgency: NUMBER,
    },
  },
  true,
);

// --- 4 상태 스키마 (§9) ---------------------------------------------------------

export const STATE_SCHEMA_SCHEMA = arrayOf({
  type: "object",
  required: ["id", "ownerType", "dataType", "defaultValue", "observable", "updatePolicy"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    ownerType: {
      enum: ["world", "region", "location", "species", "faction", "agent", "relationship", "resource"],
    },
    dataType: { enum: ["number", "boolean", "string", "enum", "set", "map"] },
    defaultValue: {},
    min: NUMBER,
    max: NUMBER,
    observable: { type: "boolean" },
    observationChannels: STRING_ARRAY,
    updatePolicy: { enum: ["continuous", "event", "derived"] },
  },
});

// --- 5 규칙 (§11) — Phase 2 의 계약을 그대로 쓴다 ---------------------------------

export const RULE_LIST_SCHEMA: JsonSchema = {
  type: "array",
  items: RULE_JSON_SCHEMA as unknown as JsonSchema,
  // $ref 는 검증에 넘긴 루트에서 풀린다 — 배열이 루트이므로 규칙의 $defs 를 여기로 끌어올린다
  $defs: (RULE_JSON_SCHEMA as unknown as { $defs: Record<string, JsonSchema> })["$defs"],
};

/** 분할 호출 1단계 — 후보 목록(이름 + 한 줄 전략) (§5.2) */
export const OUTLINE_SCHEMA = arrayOf({
  type: "object",
  required: ["id", "name", "summary"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    summary: { type: "string" },
    group: { type: "string" },
    tags: STRING_ARRAY,
  },
});

// --- 6 자원·공간 (§13, §14) ------------------------------------------------------

/** 공간은 AI 가 조건·프로필만 만들고 좌표는 코드가 계산한다(Phase-5 §5.1 각주) */
export const SPACE_DRAFT_SCHEMA: JsonSchema = {
  type: "object",
  required: ["regions", "locations", "connections"],
  additionalProperties: false,
  properties: {
    regions: arrayOf({
      type: "object",
      required: ["id", "name", "bounds", "tags", "baseStates", "danger", "accessibility", "environmentalStability"],
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        bounds: {
          type: "object",
          required: ["width", "height", "depth"],
          additionalProperties: false,
          properties: { width: NUMBER, height: NUMBER, depth: NUMBER },
        },
        tags: STRING_ARRAY,
        baseStates: { type: "object" },
        danger: NUMBER,
        accessibility: NUMBER,
        environmentalStability: NUMBER,
        speciesSuitability: { type: "object" },
      },
    }),
    locations: arrayOf({
      type: "object",
      required: ["id", "name", "regionId", "tags", "baseStates"],
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        regionId: { type: "string" },
        tags: STRING_ARRAY,
        baseStates: { type: "object" },
        /** 좌표는 코드가 채운다 — AI 가 지정하면 그 값을 존중한다(고정 지형지물) */
        position: {
          type: "object",
          required: ["x", "y", "z"],
          properties: { x: NUMBER, y: NUMBER, z: NUMBER },
        },
      },
    }),
    connections: arrayOf({
      type: "object",
      required: ["from", "to", "travelCost", "danger", "capacity"],
      additionalProperties: false,
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        travelCost: NUMBER,
        danger: NUMBER,
        capacity: NUMBER,
        /** §13 requirements — 조건을 갖춘 주체에게만 열리는 길 (G-5) */
        requirements: arrayOf({ $ref: "#/$defs/condition" }),
      },
    }),
  },
  $defs: COMMON_DEFS,
};

export const RESOURCE_SCHEMA = arrayOf({
  type: "object",
  required: [
    "id",
    "name",
    "tags",
    "properties",
    "productionRules",
    "consumptionRules",
    "transformationRules",
    "desiredBy",
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    tags: STRING_ARRAY,
    properties: { type: "object" },
    productionRules: STRING_ARRAY,
    consumptionRules: STRING_ARRAY,
    transformationRules: STRING_ARRAY,
    desiredBy: arrayOf({
      type: "object",
      required: ["agentTag", "utility"],
      additionalProperties: false,
      properties: { agentTag: { type: "string" }, utility: NUMBER },
    }),
    /** 어느 지역에서 나는가 — 배치 수치는 코드가 계산한다(§13) */
    sourceRegions: STRING_ARRAY,
  },
});

// --- 7 종족 (§15) ---------------------------------------------------------------

export const SPECIES_SCHEMA: JsonSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "survivalUnit",
    "requiredResources",
    "senses",
    "instincts",
    "adaptationRules",
    "growthRules",
    "strategy",
    "strengths",
    "weaknesses",
    "socialStructure",
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    survivalUnit: { enum: ["individual", "family", "pack", "hive", "lineage", "host", "memory"] },
    requiredResources: arrayOf({
      type: "object",
      required: ["resourceTag", "amountPerDay"],
      additionalProperties: false,
      properties: { resourceTag: { type: "string" }, amountPerDay: NUMBER },
    }),
    senses: arrayOf({
      type: "object",
      required: ["channel", "range", "accuracy"],
      additionalProperties: false,
      properties: { channel: { type: "string" }, range: NUMBER, accuracy: NUMBER },
    }),
    instincts: STRING_ARRAY,
    adaptationRules: STRING_ARRAY,
    growthRules: STRING_ARRAY,
    /** §15 절차 — 어느 생존 전략에서 나온 종인가 */
    strategy: { type: "string" },
    derivedFromPressures: STRING_ARRAY,
    strengths: STRING_ARRAY,
    weaknesses: STRING_ARRAY,
    socialStructure: { type: "string" },
    reproduction: { type: "string" },
    /** §15 — 번식 선언을 실행하는 규칙 (G-4). 비우면 growthRules 에서 이름으로 찾는다 */
    reproductionRuleIds: STRING_ARRAY,
    /** §15 abilityAccess — 이 종이 §16 능력을 가질 수 있는가 (G-4) */
    abilityAccess: {
      type: "object",
      required: ["canHold"],
      additionalProperties: false,
      properties: { canHold: { type: "boolean" }, media: STRING_ARRAY, rationale: { type: "string" } },
    },
  },
};

// --- 8 조직 (§17) ---------------------------------------------------------------

export const FACTION_SCHEMA: JsonSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "publicPurpose",
    "hiddenPurposes",
    "requiredStates",
    "controlledResources",
    "relationshipDefaults",
    "collapseConditions",
    "derivedFromResource",
    "externalRivals",
  ],
  additionalProperties: false,
  $defs: COMMON_DEFS,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    publicPurpose: { type: "string" },
    hiddenPurposes: STRING_ARRAY,
    /** §17 은닉 목적의 실행 연결 (G-3) — 조직 목적 그래프의 노드 id */
    hiddenGoalIds: STRING_ARRAY,
    requiredStates: arrayOf({
      type: "object",
      required: ["stateKey", "comparison", "value"],
      additionalProperties: false,
      properties: {
        stateKey: { type: "string" },
        comparison: { enum: [">", ">=", "<", "<=", "==", "!=", "contains"] },
        value: NUMBER,
      },
    }),
    controlledResources: STRING_ARRAY,
    relationshipDefaults: { type: "object" },
    collapseConditions: arrayOf({ $ref: "#/$defs/condition" }),
    internalGroups: arrayOf({
      type: "object",
      required: ["id", "name", "stance"],
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        stance: { enum: ["benefits", "harmed"] },
      },
    }),
    /** §17 마지막 문단 — 조직은 하나의 자원 이용 전략에서 파생된다 */
    derivedFromResource: { type: "string" },
    institution: { type: "string" },
    externalRivals: STRING_ARRAY,
  },
};

// --- 9 능력 (§16) ---------------------------------------------------------------

/** AI 가 만드는 부분. 출력 범위(절차 7)는 코드가 계산해 붙인다 */
export const ABILITY_DRAFT_SCHEMA: JsonSchema = {
  type: "object",
  required: [
    "id",
    "ownerId",
    "purpose",
    "targetTypes",
    "operation",
    "medium",
    "activationConditions",
    "maintenanceConditions",
    "restrictions",
    "costs",
    "failureEffects",
    "observableSignals",
    "knownBy",
    "mastery",
    "inferableWeakness",
    "actionIds",
    "ruleIds",
    "derivedFrom",
  ],
  additionalProperties: false,
  $defs: COMMON_DEFS,
  properties: {
    id: { type: "string" },
    ownerId: { type: "string" },
    purpose: { type: "string" },
    targetTypes: STRING_ARRAY,
    operation: { type: "string" },
    medium: { type: "string" },
    activationConditions: arrayOf({ $ref: "#/$defs/condition" }),
    maintenanceConditions: arrayOf({ $ref: "#/$defs/condition" }),
    restrictions: arrayOf({
      type: "object",
      required: ["description", "severity"],
      additionalProperties: false,
      properties: { description: { type: "string" }, severity: NUMBER },
    }),
    costs: arrayOf({
      type: "object",
      required: ["stateKey", "amount"],
      additionalProperties: false,
      properties: { stateKey: { type: "string" }, amount: NUMBER },
    }),
    failureEffects: arrayOf({
      type: "object",
      required: ["stateKey", "operation", "value"],
      additionalProperties: false,
      properties: {
        stateKey: { type: "string" },
        operation: { enum: ["set", "add"] },
        value: {},
      },
    }),
    observableSignals: arrayOf({ $ref: "#/$defs/observation" }),
    knownBy: STRING_ARRAY,
    mastery: NUMBER,
    inferableWeakness: { type: "string" },
    actionIds: STRING_ARRAY,
    ruleIds: STRING_ARRAY,
    derivedFrom: {
      type: "object",
      required: ["coreDesire", "acceptedCost"],
      additionalProperties: false,
      properties: {
        coreDesire: { type: "string" },
        traumaticExperience: { type: "string" },
        acceptedCost: { type: "string" },
      },
    },
  },
};

// --- 10 목적 그래프 (§19) --------------------------------------------------------

export const GOAL_GRAPH_SCHEMA: JsonSchema = {
  type: "object",
  required: ["id", "nodes", "edges"],
  additionalProperties: false,
  $defs: COMMON_DEFS,
  properties: {
    id: { type: "string" },
    nodes: arrayOf({
      type: "object",
      required: [
        "id",
        "description",
        "targetConditions",
        "baseImportance",
        "urgencyPolicy",
        "desiredChanges",
        "abandonmentConditions",
        "allowedActionTags",
      ],
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        description: { type: "string" },
        targetConditions: arrayOf({ $ref: "#/$defs/condition" }),
        baseImportance: NUMBER,
        urgencyPolicy: { type: "object", required: ["type"] },
        desiredChanges: arrayOf({
          type: "object",
          required: ["stateKey", "direction", "weight"],
          additionalProperties: false,
          properties: {
            stateKey: { type: "string" },
            direction: { enum: ["increase", "decrease"] },
            weight: NUMBER,
          },
        }),
        abandonmentConditions: arrayOf({ $ref: "#/$defs/condition" }),
        allowedActionTags: STRING_ARRAY,
        utilityFactors: { type: "array" },
        focusIds: STRING_ARRAY,
        emotionKeys: { type: "array" },
        completionEffects: arrayOf({
          type: "object",
          required: ["stateKey", "operation", "value"],
          additionalProperties: false,
          properties: {
            targetId: { type: "string" },
            stateKey: { type: "string" },
            operation: { enum: ["add", "multiply", "set"] },
            value: {},
          },
        }),
      },
    }),
    edges: arrayOf({
      type: "object",
      required: ["from", "to", "relation", "weight"],
      additionalProperties: false,
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        relation: { enum: ["requires", "supports", "conflicts", "alternative", "reveals", "creates"] },
        weight: NUMBER,
      },
    }),
  },
};

// --- 11 행동 (§21) ---------------------------------------------------------------

export const ACTION_SCHEMA = {
  type: "array",
  $defs: COMMON_DEFS,
  items: {
    type: "object",
    required: [
      "id",
      "name",
      "tags",
      "actorRequirements",
      "targetQuery",
      "worldRequirements",
      "costs",
      "duration",
      "expectedEffects",
      "executionRules",
      "visibleSignals",
      "risk",
    ],
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      tags: STRING_ARRAY,
      actorRequirements: arrayOf({ $ref: "#/$defs/condition" }),
      targetQuery: {
        type: "object",
        required: ["kind"],
        additionalProperties: false,
        properties: {
          kind: { enum: ["self", "entity_tag", "none"] },
          tag: { type: "string" },
          sameRegion: { type: "boolean" },
          maxDistance: NUMBER,
          approachMaxDistance: NUMBER,
          excludeSelf: { type: "boolean" },
          crossRegionApproach: { type: "boolean" },
        },
      },
      worldRequirements: arrayOf({ $ref: "#/$defs/condition" }),
      costs: arrayOf({
        type: "object",
        required: ["stateKey", "amount"],
        additionalProperties: false,
        properties: { stateKey: { type: "string" }, amount: NUMBER },
      }),
      duration: NUMBER,
      durationPolicy: { enum: ["fixed", "travel"] },
      movement: { enum: ["to_target", "away_from_target"] },
      expectedEffects: arrayOf({
        type: "object",
        required: ["stateKey", "direction", "magnitude", "on"],
        additionalProperties: false,
        properties: {
          stateKey: { type: "string" },
          direction: { enum: ["increase", "decrease"] },
          magnitude: NUMBER,
          on: { enum: ["actor", "target"] },
        },
      }),
      executionRules: STRING_ARRAY,
      visibleSignals: arrayOf({ $ref: "#/$defs/observation" }),
      risk: NUMBER,
    },
  },
} as unknown as JsonSchema;

// --- 12 사건 패턴 (§28) ----------------------------------------------------------

export const EVENT_PATTERN_SCHEMA = arrayOf({
  type: "object",
  required: [
    "id",
    "name",
    "type",
    "requiredTags",
    "optionalTags",
    "minimumParticipants",
    "timeWindow",
    "locationRadius",
    "significanceFormula",
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    type: { type: "string" },
    requiredTags: STRING_ARRAY,
    optionalTags: STRING_ARRAY,
    minimumParticipants: NUMBER,
    timeWindow: NUMBER,
    locationRadius: NUMBER,
    significanceFormula: { type: "string" },
  },
});

// --- 13 초기 배치 (§18 개인 + 일반 개체) ------------------------------------------

/** 개인 한 명 — §18 의 10절차 산출. 좌표·초기 수치 일부는 코드가 채운다 */
export const AGENT_SCHEMA: JsonSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "speciesId",
    "factionIds",
    "role",
    "origin",
    "formativeEvent",
    "values",
    "fears",
    "innerConflict",
    "currentProblem",
    "traits",
    "goalGraphId",
    "abilityIds",
    "homeLocationId",
    "tags",
    "states",
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    speciesId: { type: "string" },
    factionIds: STRING_ARRAY,
    role: { type: "string" },
    origin: { type: "string" },
    formativeEvent: { type: "string" },
    values: STRING_ARRAY,
    fears: STRING_ARRAY,
    innerConflict: { type: "string" },
    currentProblem: { type: "string" },
    traits: { type: "object" },
    goalGraphId: { type: "string" },
    abilityIds: STRING_ARRAY,
    homeLocationId: { type: "string" },
    tags: STRING_ARRAY,
    states: { type: "object" },
    relationships: { type: "array" },
    beliefs: { type: "array" },
  },
};

/** 일반 개체 무리 — "몇 종류를 어디에 얼마나" 만 AI 가 정하고 배치는 코드가 한다 */
export const POPULATION_SCHEMA = arrayOf({
  type: "object",
  required: ["id", "type", "namePrefix", "count", "regionId", "tags", "states"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    type: { enum: ["agent", "resource"] },
    namePrefix: { type: "string" },
    count: { type: "number", minimum: 1 },
    regionId: { type: "string" },
    aroundLocationId: { type: "string" },
    spreadRadius: NUMBER,
    speciesId: { type: "string" },
    goalGraphId: { type: "string" },
    tags: STRING_ARRAY,
    states: { type: "object" },
  },
});

/** §11.3 create_entity 템플릿 */
export const TEMPLATE_SCHEMA = arrayOf({
  type: "object",
  required: ["id", "type", "tags", "states"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    type: { enum: ["agent", "resource", "location", "faction"] },
    tags: STRING_ARRAY,
    states: { type: "object" },
  },
});
