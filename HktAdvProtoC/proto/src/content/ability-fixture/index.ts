// §16 능력 픽스처 — `ability.contract_truth` 예시를 행동 + 규칙으로 분해해 실행한다 (Phase-2 §2.7).
//
// §16 AbilityDefinition 은 전용 실행기를 갖지 않는다. 아래 매핑대로 이미 있는 체계로 흩어져 실행된다:
//
//  | §16 필드                | 여기서의 실행 주체                                                   |
//  |------------------------|--------------------------------------------------------------------|
//  | activationConditions   | action.use_ability 의 actorRequirements (contract_accepted == true) |
//  | costs                  | action.use_ability 의 costs (mental_fatigue 12 → mental_stamina -12)|
//  | restrictions + 증폭     | §11.4 규칙 rule.ability_restriction_amplification (그대로 로드한다)  |
//  | restrictions 위반 검사  | action.lie 의 action_executed 트리거 규칙                            |
//  | maintenanceConditions  | interval 감시 규칙 rule.ability_maintenance_watch                    |
//  | failureEffects         | 그 감시 규칙의 effects (memory_integrity -15 · 능력 정지)             |
//  | observableSignals      | action.use_ability 의 visibleSignals (§23 채널명은 sight)            |
//  | knownBy                | 초기 믿음(§10) — agent.sera 는 자기 능력을 안다                       |
//  | mastery                | Phase 7 성장 체계 (여기서는 상태로만 둔다)                             |
import { loadRuleDocument, loadRuleDocuments } from "../../core/rules/RuleSchema";
import type { RuleDefinition } from "../../core/rules/RuleTypes";
import type {
  AbilityDefinition,
  ActionDefinition,
  StateSchema,
  WorldDefinition,
} from "../../core/world/types";
import amplificationDocument from "./rule-11-4.json";
import ruleDocuments from "./rules.json";

export const ABILITY_OWNER = "agent.sera";
export const ABILITY_ID = "ability.contract_truth";
/** 능력자 곁에 서 있는 사람 — 반동이 자기 밖으로 나가는지 보는 대조군 (F-7) */
export const BYSTANDER = "agent.witness";
const REGION = "region.contract_hall";

function agentNumber(id: string, defaultValue: number, max = 100): StateSchema {
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

function agentBoolean(id: string, observable = false): StateSchema {
  return {
    id,
    ownerType: "agent",
    dataType: "boolean",
    defaultValue: false,
    observable,
    ...(observable ? { observationChannels: ["sight"] } : {}),
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
  agentNumber("mental_stamina", 100),
  agentNumber("memory_integrity", 100),
  agentNumber("ability_output", 0, 1000),
  agentNumber("failure_penalty_risk", 0),
  agentNumber("mastery", 42),
  agentBoolean("contract_accepted"),
  agentBoolean("ability_active", true),
  agentBoolean("restriction_valid"),
  agentBoolean("lied_since_activation"),
  agentString("species_id"),
  agentString("faction_id"),
  agentString("goal_graph_id"),
  agentString("current_action"),
  agentString("active_goal"),
];

const ACTIONS: ActionDefinition[] = [
  {
    id: "action.use_ability",
    name: "능력을 사용한다",
    tags: ["ability"],
    // §16 activationConditions — `contract.acceptedByBoth == true`
    actorRequirements: [
      {
        left: { kind: "state", owner: "actor", key: "contract_accepted" },
        operator: "==",
        right: { kind: "const", value: true },
      },
    ],
    targetQuery: { kind: "self" },
    worldRequirements: [],
    // §16 costs — mental_fatigue baseAmount 12
    costs: [{ stateKey: "mental_stamina", amount: 12 }],
    duration: 10,
    expectedEffects: [],
    executionRules: ["rule.ability_activation", "rule.ability_restriction_amplification"],
    // §16 observableSignals — contract_symbols_appear_on_skin
    visibleSignals: [
      {
        signalId: "signal.contract_symbols",
        channels: ["sight"],
        strength: 55,
        tags: ["ability", "contract"],
        claim: { subject: "actor", stateKey: "ability_active", value: true, confidence: 0.7 },
      },
    ],
    risk: 10,
  },
  {
    id: "action.lie",
    name: "거짓을 말한다",
    tags: ["deceive", "social"],
    actorRequirements: [],
    targetQuery: { kind: "self" },
    worldRequirements: [],
    costs: [{ stateKey: "mental_stamina", amount: 1 }],
    duration: 5,
    expectedEffects: [],
    executionRules: ["rule.ability_restriction_violation"],
    visibleSignals: [],
    risk: 5,
  },
];

/**
 * §16 출력 예시 `ability.contract_truth` — 문서의 능력 정의를 정규형 필드로 옮긴 것.
 * 위 표(파일 머리말)가 이 정의의 각 필드가 어느 실행 체계로 내려갔는지 말해 준다.
 */
export const CONTRACT_TRUTH: AbilityDefinition = {
  id: ABILITY_ID,
  ownerId: ABILITY_OWNER,
  purpose: "거짓 계약으로부터 자신과 동료를 보호한다.",
  targetTypes: ["agent", "contract"],
  operation: "detect_contract_violation",
  medium: "spoken_mutual_declaration",
  activationConditions: [
    {
      left: { kind: "state", owner: "actor", key: "contract_accepted" },
      operator: "==",
      right: { kind: "const", value: true },
    },
  ],
  maintenanceConditions: [
    {
      left: { kind: "state", owner: "actor", key: "lied_since_activation" },
      operator: "==",
      right: { kind: "const", value: false },
    },
  ],
  restrictions: [{ description: "사용자는 계약 기간 동안 고의적인 거짓말을 할 수 없다.", severity: 78 }],
  costs: [{ stateKey: "mental_stamina", amount: 12 }],
  failureEffects: [
    { type: "modify_state", target: { type: "actor" }, stateKey: "memory_integrity", operation: "add", value: -15 },
    // §16 절차 8 — 반동이 능력자 자신에게만 걸릴 이유는 없다 (§11.3 TargetSelector, F-7).
    // 계약의 진실이 깨지는 순간, 같은 계약을 맺고 있던 곁의 사람도 함께 다친다.
    {
      type: "modify_state",
      target: { type: "query", query: { entityType: "agent", withinRadius: { of: "actor", r: 10 } } },
      stateKey: "memory_integrity",
      operation: "add",
      value: -5,
    },
  ],
  observableSignals: ACTIONS[0]!.visibleSignals,
  knownBy: [ABILITY_OWNER],
  mastery: 42,
  outputRange: { min: 0, max: 78 },
  inferableWeakness: "계약자가 거짓을 말하는 순간 능력이 스스로 꺼진다 — 거짓을 유도하면 무력화된다.",
  actionIds: ["action.use_ability"],
  ruleIds: [
    "rule.ability_activation",
    "rule.ability_restriction_amplification",
    "rule.ability_restriction_violation",
    "rule.ability_maintenance_watch",
  ],
  derivedFrom: {
    coreDesire: "동료가 계약에 속아 잃는 것을 막는다",
    traumaticExperience: "거짓 계약으로 동료를 잃었다",
    acceptedCost: "스스로 거짓을 말하지 않는다",
  },
};

/** §11.4 예시 규칙 — 문서의 JSON 을 손대지 않고 그대로 읽는다 */
export function loadAmplificationRule(): RuleDefinition {
  return loadRuleDocument(amplificationDocument);
}

export function buildAbilityFixtureWorld(worldSeed: number): WorldDefinition {
  return {
    metadata: { id: "world.ability_fixture", title: "계약의 진실", worldSeed },
    // §7 — 이 픽스처가 기대는 두 명제 (§16 능력 체계의 상위 제약)
    axioms: [
      {
        id: "axiom.power_restriction",
        statement: "인간의 특수 능력은 스스로 받아들인 제약에 의해 증폭된다.",
        category: "power",
        immutable: true,
        derivedFrom: [],
      },
      {
        id: "axiom.power_cost",
        statement: "강한 능력은 강한 조건이나 손실 가능성을 요구한다.",
        category: "cost",
        immutable: true,
        derivedFrom: [],
      },
    ],
    stateSchemas: STATE_SCHEMAS,
    ruleDefinitions: [...loadRuleDocuments(ruleDocuments as unknown[]), loadAmplificationRule()],
    spaces: {
      regions: [
        {
          id: REGION,
          name: "계약의 방",
          bounds: { width: 50, height: 50, depth: 10 },
          tags: [],
          baseStates: {},
        },
      ],
      locations: [],
      connections: [],
    },
    resources: [],
    species: [],
    survivalPressures: [],
    factions: [],
    agentArchetypes: [],
    abilitySystem: { abilities: [CONTRACT_TRUTH] },
    goalTemplates: [],
    actionDefinitions: ACTIONS,
    eventPatterns: [],
    bootstrap: {
      entities: [
        {
          id: REGION,
          type: "location",
          name: "계약의 방",
          position: { regionId: REGION, x: 0, y: 0, z: 0 },
          tags: ["region"],
          states: {},
        },
        {
          id: ABILITY_OWNER,
          type: "agent",
          name: "세라",
          position: { regionId: REGION, x: 0, y: 0, z: 0 },
          tags: ["living", "ability_user"],
          states: { contract_accepted: true },
          // §16 knownBy: ["agent.sera"] — 자기 능력을 아는 것도 믿음이다(§10)
          beliefs: [
            {
              subjectId: ABILITY_OWNER,
              stateKey: "ability_active",
              believedValue: false,
              confidence: 1,
              sourceIds: [ABILITY_ID],
            },
          ],
        },
        {
          id: "agent.witness",
          type: "agent",
          name: "목격자",
          position: { regionId: REGION, x: 5, y: 0, z: 0 },
          tags: ["living"],
          states: {},
        },
      ],
    },
  };
}
