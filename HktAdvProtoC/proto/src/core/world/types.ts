// WorldDefinition — 변하지 않는 세계 구조 (기획서 §5, §39)
// Phase 1 이 실제로 쓰는 필드는 실체 타입으로, 담당 Phase 가 오지 않은 필드는 placeholder(unknown[]) 로 둔다.
import type { ObservationChannel } from "../../shared/observation";
import type { Position } from "../../shared/state";
import type { EntityTemplate, RuleDefinition } from "../rules/RuleTypes";

export type { EntityState, EntityType, Position, WorldState } from "../../shared/state";

export interface WorldMetadata {
  id: string;
  title: string;
  worldSeed: number;
}

// --- §9 상태 스키마 -----------------------------------------------------------

export type StateOwnerType =
  | "world"
  | "region"
  | "location"
  | "species"
  | "faction"
  | "agent"
  | "relationship"
  | "resource";

export interface StateSchema {
  id: string;
  ownerType: StateOwnerType;
  dataType: "number" | "boolean" | "string" | "enum" | "set" | "map";
  defaultValue: unknown;
  min?: number;
  max?: number;
  observable: boolean;
  observationChannels?: string[];
  updatePolicy: "continuous" | "event" | "derived";
}

// --- 조건 표현 (§11.2) --------------------------------------------------------
// Phase 2 의 규칙 DSL 이 이 표현을 확장해 가져간다. Phase 1 은 JSON 콘텐츠(행동·목적)가
// 조건을 선언하는 데 필요한 최소 형태만 둔다.

export type ValueReference =
  | { kind: "const"; value: number | boolean | string }
  | { kind: "state"; owner: "actor" | "target"; key: string }
  | { kind: "belief"; subject: "target"; key: string }
  | { kind: "entity_state"; entityId: string; key: string }
  /** 개체 자신의 id — "내 조직에게만 보고한다" 같은 소속 조건을 표현한다 */
  | { kind: "entity_ref"; owner: "actor" | "target" }
  | { kind: "distance"; from: "actor"; to: "target" };

export type ConditionOperator = ">" | ">=" | "<" | "<=" | "==" | "!=" | "contains";

export interface ConditionDefinition {
  left: ValueReference;
  operator: ConditionOperator;
  right: ValueReference;
}

// --- §13 공간 -----------------------------------------------------------------

export interface RegionDefinition {
  id: string;
  name: string;
  bounds: { width: number; height: number; depth: number };
  tags: string[];
  baseStates: Record<string, unknown>;
}

export interface LocationDefinition {
  id: string;
  name: string;
  regionId: string;
  position: Position;
  tags: string[];
  baseStates: Record<string, unknown>;
}

export interface SpaceConnection {
  from: string;
  to: string;
  travelCost: number;
  danger: number;
  capacity: number;
}

export interface SpaceDefinition {
  regions: RegionDefinition[];
  locations: LocationDefinition[];
  connections: SpaceConnection[];
}

// --- §14 자원 -----------------------------------------------------------------

export interface DesireMapping {
  agentTag: string;
  utility: number;
}

export interface ResourceDefinition {
  id: string;
  name: string;
  tags: string[];
  properties: Record<string, number | boolean | string>;
  productionRules: string[];
  consumptionRules: string[];
  transformationRules: string[];
  desiredBy: DesireMapping[];
}

// --- §15 종족 -----------------------------------------------------------------

export interface SenseDefinition {
  channel: ObservationChannel;
  range: number;
  accuracy: number;
}

export interface ResourceNeed {
  resourceTag: string;
  amountPerDay: number;
}

export interface SpeciesDefinition {
  id: string;
  name: string;
  survivalUnit: "individual" | "family" | "pack" | "hive" | "lineage" | "host" | "memory";
  requiredResources: ResourceNeed[];
  senses: SenseDefinition[];
  instincts: string[];
  adaptationRules: string[];
  growthRules: string[];
}

// --- §17 조직 -----------------------------------------------------------------

export interface FactionDefinition {
  id: string;
  name: string;
  publicPurpose: string;
  hiddenPurposes: string[];
  requiredStates: { stateKey: string; comparison: ConditionOperator; value: number }[];
  controlledResources: string[];
  relationshipDefaults: Record<string, number>;
  collapseConditions: ConditionDefinition[];
}

// --- §19 목적 그래프 ----------------------------------------------------------

/**
 * 긴급도 정책 (§19 UrgencyPolicy).
 * Phase 1 은 "어떤 상태가 임계치를 넘은 만큼 긴급하다" 한 종류만 쓴다 — 활성도 전체 계산식은 Phase 3(§20).
 */
export type UrgencyPolicy =
  | { type: "constant"; value: number }
  | {
      type: "state_threshold";
      /** self=주체 자신의 상태, entity=지정 개체의 상태, belief=주체가 믿는 대상의 상태 */
      source: "self" | "entity" | "belief";
      entityId?: string;
      /** source=belief 일 때 믿음의 대상 */
      subjectId?: string;
      stateKey: string;
      comparison: ">" | "<";
      threshold: number;
      weight: number;
      max: number;
    };

export interface GoalNode {
  id: string;
  description: string;
  targetConditions: ConditionDefinition[];
  baseImportance: number;
  urgencyPolicy: UrgencyPolicy;
  /** 이 목적이 원하는 상태 변화 방향 — 행동 후보의 기대 진척도 계산에 쓴다 (§22) */
  desiredChanges: { stateKey: string; direction: "increase" | "decrease"; weight: number }[];
  abandonmentConditions: ConditionDefinition[];
  allowedActionTags: string[];
}

export interface GoalEdge {
  from: string;
  to: string;
  relation: "requires" | "supports" | "conflicts" | "alternative" | "reveals" | "creates";
  weight: number;
}

export interface GoalGraph {
  id: string;
  nodes: GoalNode[];
  edges: GoalEdge[];
}

// --- §21 행동 -----------------------------------------------------------------

/** 규칙·행동이 만들어 내는 관찰 신호 (§11 observations, §21 visibleSignals) */
export interface ObservationEffect {
  signalId: string;
  channels: ObservationChannel[];
  strength: number;
  tags: string[];
  /** 신호가 주장하는 값 — 실제 상태와 다를 수 있다(§10) */
  claim?: {
    subject: "actor" | "target";
    stateKey: string;
    value: number | boolean | string;
    confidence: number;
    /** 관찰자 자신의 상태 갱신 — 관찰이 판단으로 이어지는 연결점 */
    observerStateKey?: string;
  };
}

export interface TargetQuery {
  /** self=자기 자신, entity_tag=태그로 개체 검색, none=대상 없음 */
  kind: "self" | "entity_tag" | "none";
  tag?: string;
  /** 같은 지역만 대상으로 삼는다 */
  sameRegion?: boolean;
  /** 3D 유클리드 거리 상한 (Phase-1 §1.4 공간 거리 규약) */
  maxDistance?: number;
  /**
   * "다가가서 하겠다"고 판단할 수 있는 최대 거리 — 추격 반경.
   * 없으면 같은 지역(또는 crossRegionApproach) 안의 모든 대상이 후보다.
   */
  approachMaxDistance?: number;
  /** 자기 자신 제외 */
  excludeSelf?: boolean;
  /**
   * 사거리 밖 대상에게 "다가가는" 후보를 만들 때 지역 경계를 넘을 수 있는가.
   * false 면 같은 지역 안에서만 접근한다 — 짐승이 마을까지 쫓아오지 않는 이유가 이 플래그다.
   */
  crossRegionApproach?: boolean;
}

export interface CostDefinition {
  stateKey: string;
  amount: number;
}

export interface ExpectedEffect {
  stateKey: string;
  direction: "increase" | "decrease";
  magnitude: number;
  /** 효과가 걸리는 대상 — 목적의 desiredChanges 와 맞춰 기대 진척도를 만든다 */
  on: "actor" | "target";
}

export interface ActionDefinition {
  id: string;
  name: string;
  tags: string[];
  actorRequirements: ConditionDefinition[];
  targetQuery: TargetQuery;
  worldRequirements: ConditionDefinition[];
  costs: CostDefinition[];
  duration: number;
  /** travel = §13 SpaceConnection.travelCost + 지역 내 3D 거리로 계산 (Phase-1 §1.4) */
  durationPolicy?: "fixed" | "travel";
  /**
   * 공간 이동은 규칙이 아니라 행동 체계의 내장 효과다 (§13 공간 원시 연산).
   * to_target=대상 위치로, away_from_target=대상 반대 방향으로 물러난다.
   */
  movement?: "to_target" | "away_from_target";
  expectedEffects: ExpectedEffect[];
  /** 완료 시 실행되는 규칙 id (§21 executionRules) */
  executionRules: string[];
  visibleSignals: ObservationEffect[];
  /** 기대 위험도 — 행동 점수의 risk 항 (§22) */
  risk: number;
}

// --- 초기 배치 ----------------------------------------------------------------

export interface BootstrapEntity {
  id: string;
  type: "agent" | "resource" | "location" | "faction";
  name: string;
  speciesId?: string;
  factionIds?: string[];
  goalGraphId?: string;
  position?: Position;
  tags: string[];
  states: Record<string, unknown>;
  /** 개인 판단 변수 (§18) */
  traits?: Record<string, number>;
  /** 초기 믿음 (§41 "초기 상태만 배치한다" — 소문·선입견도 초기 상태다) */
  beliefs?: {
    subjectId: string;
    stateKey: string;
    believedValue: number | boolean | string;
    confidence: number;
    sourceIds: string[];
  }[];
}

export interface WorldBootstrap {
  entities: BootstrapEntity[];
}

// --- WorldDefinition ----------------------------------------------------------

export interface WorldDefinition {
  metadata: WorldMetadata;
  axioms: unknown[]; // §7 WorldAxiom — Phase 5
  stateSchemas: StateSchema[]; // §9 — Phase 1
  ruleDefinitions: RuleDefinition[]; // §11 — Phase 2 (규칙은 전부 JSON 이다)
  /** §11.3 create_entity 가 가리키는 템플릿 — Phase 5 생성기가 채운다 */
  entityTemplates?: EntityTemplate[];
  spaces: SpaceDefinition; // §13 — Phase 1
  resources: ResourceDefinition[]; // §14 — Phase 1
  species: SpeciesDefinition[]; // §15 — Phase 1
  factions: FactionDefinition[]; // §17 — Phase 1
  agentArchetypes: unknown[]; // §18 — Phase 5
  abilitySystem: unknown; // §16 — Phase 5 (실행 매핑은 Phase 2 §2.7)
  goalTemplates: GoalGraph[]; // §19 — Phase 1(수동) / Phase 3(활성도 전체 모델)
  actionDefinitions: ActionDefinition[]; // §21 — Phase 1
  eventPatterns: unknown[]; // §28 EventPattern — Phase 4
  bootstrap: WorldBootstrap; // 초기 배치 — Phase 1(수동)/Phase 5(생성)
}

export function createEmptyWorldDefinition(worldSeed: number): WorldDefinition {
  return {
    metadata: { id: `world.${worldSeed}`, title: "빈 세계", worldSeed },
    axioms: [],
    stateSchemas: [],
    ruleDefinitions: [],
    spaces: { regions: [], locations: [], connections: [] },
    resources: [],
    species: [],
    factions: [],
    agentArchetypes: [],
    abilitySystem: null,
    goalTemplates: [],
    actionDefinitions: [],
    eventPatterns: [],
    bootstrap: { entities: [] },
  };
}
