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

/**
 * §13 ResourceSpawnProfile — "이 지역에서 무엇이 얼마나 나는가".
 * 자원을 직접 배치하지 않는다(§13) — 지역의 위험·접근성·안정성에서 파생된 희귀도가
 * 어떤 자원이 얼마나 나올지를 정하고, 그 결과가 이 프로필로 지역 정의에 남는다.
 */
export interface ResourceSpawnProfile {
  /** 자원 태그 또는 자원 id */
  resourceTag: string;
  /** §13 calculateResourceRarity 의 결과 (0~100) */
  rarity: number;
  /** 이 지역에 실제로 놓인 자원 노드 수 */
  nodeCount: number;
}

export interface RegionDefinition {
  id: string;
  name: string;
  bounds: { width: number; height: number; depth: number };
  tags: string[];
  baseStates: Record<string, unknown>;
  /** §13 — 런타임이 "이 지역에 무엇이 나는가"를 답할 수 있게 정의에 남는다 (G-5) */
  resourceProfiles?: ResourceSpawnProfile[];
  /** §13 — 종족 id → 이 지역이 그 종에게 얼마나 살 만한가 (0~100). 초기 배치와 지도가 읽는다 (G-5) */
  speciesSuitability?: Record<string, number>;
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
  /**
   * §13 requirements — 이 길을 건너기 위한 조건. 조건은 **건너려는 주체**를 actor 로 평가한다.
   * 만족하지 못하면 그 주체에게 이 연결은 없는 것이다("능력이 있어야 건너는 길", G-5).
   */
  requirements?: ConditionDefinition[];
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
  /**
   * §14 여섯 번째 질문 "과도하게 사용하면 무엇이 발생하는가"의 답 — 과용 반동을 실행하는 규칙.
   * 반동에는 원인이 있어야 한다: 이 규칙은 조건(과잉 상태)을 갖고 이 자원을 실제로 가리켜야 한다
   * (§34 resource.overuse 검사기 — G-6). 없으면 여섯 질문 중 하나가 빈칸이라는 경고가 남는다.
   */
  overuseRules?: string[];
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
  /**
   * §15 번식 — 어떻게 수가 늘어나는가. 문장(reproduction)과 **그것을 실행하는 규칙**을 함께 갖는다.
   * 규칙이 없으면 선언은 이야기일 뿐이다 — §34 검사기가 그 연결을 요구한다 (G-4).
   */
  reproduction?: string;
  reproductionRuleIds?: string[];
  /** §15 사회 구조 — survivalUnit 이 관계의 출발선을 정하고, 이 문장이 그 이유를 남긴다 */
  socialStructure?: string;
  /** §15 abilityAccess — 이 종이 §16 능력을 가질 수 있는가 (없으면 가질 수 없다) */
  abilityAccess?: SpeciesAbilityAccess;
}

/** §15 abilityAccess — 종족과 능력 체계의 연결 (G-4) */
export interface SpeciesAbilityAccess {
  /** 이 종의 개체가 능력을 가질 수 있는가 */
  canHold: boolean;
  /** 능력이 드러나는 매개 (§16 medium) — 비면 제한 없음 */
  media?: string[];
  /** 왜 그런가 (생성 근거 문장) */
  rationale?: string;
}

// --- §17 조직 -----------------------------------------------------------------

/** §17 internalGroups — 조직 산하의 소주체. 같은 판단 파이프라인을 재귀 적용한다(Phase-3 §3.7) */
export interface InternalGroupDefinition {
  id: string;
  name: string;
  /** 제도에서 이익을 얻는 집단인가, 손해를 보는 집단인가 (§17 절차 4·5) */
  stance: "benefits" | "harmed";
}

export interface FactionDefinition {
  id: string;
  name: string;
  publicPurpose: string;
  hiddenPurposes: string[];
  /**
   * §17 hiddenPurposes 의 **실행 연결** — 은닉 목적이 좇는 목적 그래프 노드 id.
   * 은닉 목적은 선언 문자열이 아니라 이 목적들로 실제 행동한다(G-3).
   * 관찰자 시점 표현에서는 금지 사실이 된다(§30 "플레이어가 모르는 것", §33.3 누출 검사).
   */
  hiddenGoalIds?: string[];
  requiredStates: { stateKey: string; comparison: ConditionOperator; value: number }[];
  controlledResources: string[];
  relationshipDefaults: Record<string, number>;
  collapseConditions: ConditionDefinition[];
  internalGroups?: InternalGroupDefinition[];
}

// --- §8 생존 압력 --------------------------------------------------------------

/**
 * 생존 압력 (§8). "왜 움직여야 하는가"의 원천.
 * 해소되지 않으면 urgencyGrowth 만큼 매일 긴급도가 쌓이고, 대응 목적(goalId)의 활성도로 들어간다(§20 needPressure).
 */
export interface SurvivalPressureDefinition {
  id: string;
  targetState: string;
  failureState: string;
  urgencyGrowth: number;
  applicableSpeciesTags: string[];
  relatedResources: string[];
  /** 이 압력이 밀어 올리는 목적 */
  goalId: string;
  /** 이 조건이 참이면 압력이 해소되어 누적이 0 으로 돌아간다 */
  relievedWhen: ConditionDefinition[];
  /** 누적 상한 — 하나의 압력이 세계를 지배하지 않게 한다 */
  maxUrgency: number;
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

/** §19 UtilityFactor — 이 목적을 이루면 무엇이 좋아지는가 (§20 expectedUtility) */
export interface UtilityFactor {
  /** actor=자기 상태, entity=지정 개체의 상태(믿음으로 읽는다) */
  owner: "actor" | "entity";
  entityId?: string;
  stateKey: string;
  direction: "increase" | "decrease";
  weight: number;
}

/**
 * §19 completionEffects — 목적 달성이 확인되는 순간 1회 적용되는 상태 효과.
 * 상태 변경은 다른 규칙의 state_changed 트리거로 이어지므로(§26 processChangedStateRules),
 * 별도 실행기 없이도 완료가 세계에 파문을 남긴다.
 */
export interface GoalCompletionEffect {
  /** 대상 개체 — 없으면 목적을 이룬 주체 자신 */
  targetId?: string;
  stateKey: string;
  operation: "add" | "multiply" | "set";
  value: number | boolean | string;
}

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
  /** §19 completionEffects — 달성 시 1회 적용 */
  completionEffects?: GoalCompletionEffect[];
  /** §19 utilityFactors — 없으면 desiredChanges 로 대신한다 */
  utilityFactors?: UtilityFactor[];
  /** 이 목적이 마음 쓰는 대상 — §20 relationshipImpact 의 근거 (가족·조직·적) */
  focusIds?: string[];
  /** 이 목적이 기대는 감정 상태 — §20 emotionalBias (예: 공포가 클수록 회피 목적이 커진다) */
  emotionKeys?: { stateKey: string; weight: number }[];
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
  /**
   * 신호를 낸 것이 누구인가 (기본 actor).
   * "관찰하니 대상의 흔적이 드러났다" 처럼 **대상**이 신호원인 경우가 있다 —
   * 이때 행위자 자신도 그 신호를 읽는 관찰자가 된다(§23: 자기가 낸 신호는 관찰하지 않는다).
   */
  origin?: "actor" | "target";
  /** 신호가 주장하는 값 — 실제 상태와 다를 수 있다(§10) */
  claim?: {
    subject: "actor" | "target" | "entity";
    /** subject="entity" 일 때 주장 대상 — 제3자에 대한 소문이 이 형태다 */
    entityId?: string;
    stateKey: string;
    value: number | boolean | string;
    confidence: number;
    /** 관찰자 자신의 상태 갱신 — 관찰이 판단으로 이어지는 연결점 */
    observerStateKey?: string;
    /**
     * 소문·보고 채널 (§23): 신호를 내는 주체의 **믿음**을 그대로 실어 나른다.
     * value/confidence 선언은 무시되고, 전달자의 믿음이 없으면 주장 없는 신호가 된다.
     * 수신자는 전달자 신뢰(§25 trust)로 confidence 를 깎는다 — 정보 비대칭의 원천.
     */
    relayBelief?: boolean;
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

// --- §28 사건 패턴 --------------------------------------------------------------

/**
 * 사건 패턴 (§28 EventPattern). 기획서 필드 전부 + 탐지 결과에 실을 사건 종류(type).
 * 개별 사건을 저작하지 않는다 — 패턴은 "이런 모양의 변화 묶음을 사건으로 본다"는 선언일 뿐이다.
 */
export interface EventPattern {
  id: string;
  name: string;
  /** 탐지된 사건의 §28 "type" (ecological_conflict 등) */
  type: string;
  requiredTags: string[];
  optionalTags: string[];
  minimumParticipants: number;
  /** 한 묶음으로 볼 시간 폭(tick) */
  timeWindow: number;
  /** 한 묶음으로 볼 공간 반경 (3D 거리, §13) */
  locationRadius: number;
  /** 중요도 계산식 — "standard" 는 §29 의 6항 그대로 */
  significanceFormula: string;
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
  /** 초기 관계 (§25) — "이미 서로 아는 사이"도 초기 상태다 */
  relationships?: {
    toId: string;
    trust?: number;
    fear?: number;
    respect?: number;
    affection?: number;
    resentment?: number;
    dependency?: number;
    debt?: number;
    familiarity?: number;
  }[];
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

// --- §7 세계 핵심 명제 ----------------------------------------------------------

/**
 * 세계 명제 (§7). 이후 생성되는 모든 규칙·콘텐츠의 상위 제약이다 —
 * 규칙은 `derivedFromAxioms` 로 자기가 어느 명제에서 왔는지 밝힌다.
 */
export interface WorldAxiom {
  id: string;
  statement: string;
  category: "existence" | "survival" | "power" | "cost" | "ecology" | "society" | "information";
  immutable: boolean;
  /** 근거가 된 정규화 주제 id (§6) */
  derivedFrom: string[];
}

// --- §16 능력 체계 --------------------------------------------------------------

/** §16 restrictions — 스스로 받아들인 제약. severity 가 높을수록 출력이 커진다(§11.4) */
export interface RestrictionDefinition {
  description: string;
  severity: number;
}

/**
 * 능력 정의 (§16).
 * 전용 실행기는 없다 — 행동(§21)과 규칙(§11)으로 분해되어 실행된다(Phase-2 §2.7).
 * 이 구조는 "무엇이 어디로 분해되었는가"의 원본이자 §44-11 의 증거다.
 */
export interface AbilityDefinition {
  id: string;
  ownerId: string;
  purpose: string;
  targetTypes: string[];
  operation: string;
  medium: string;
  activationConditions: ConditionDefinition[];
  maintenanceConditions: ConditionDefinition[];
  restrictions: RestrictionDefinition[];
  costs: CostDefinition[];
  /** 실패 반동 — 실행은 규칙이 한다(failureRuleId) */
  failureEffects: { stateKey: string; operation: "set" | "add"; value: number | boolean }[];
  observableSignals: ObservationEffect[];
  knownBy: string[];
  mastery: number;
  /** 코드가 계산한 출력 범위 (§16 절차 7 — 제약 강도 → 출력) */
  outputRange: { min: number; max: number };
  /** 상대가 추론할 수 있는 약점 (§16 절차 10) */
  inferableWeakness: string;
  /** 이 능력을 실행하는 행동·규칙 (Phase-2 §2.7 매핑) */
  actionIds: string[];
  ruleIds: string[];
  /** 생성 근거 — 어떤 욕망·경험·제약에서 파생됐는가 (§44-11) */
  derivedFrom: { coreDesire: string; traumaticExperience?: string; acceptedCost: string };
}

export interface AbilitySystemDefinition {
  abilities: AbilityDefinition[];
}

// --- §18 개인 원형 --------------------------------------------------------------

/** §18 개인 생성 절차의 산출 — 배치(BootstrapEntity)로 실체화되기 전의 인물 원형 */
export interface AgentArchetype {
  id: string;
  name: string;
  speciesId: string;
  factionIds: string[];
  role: string;
  origin: string;
  /** §18 절차 3~4 — 과거 생존 사건과 그것이 남긴 가치관·두려움 */
  formativeEvent: string;
  values: string[];
  fears: string[];
  /** §18 절차 6 — 조직 목적과 개인 가치관의 갈등 */
  innerConflict: string;
  /** §18 절차 8 — 지금 해결해야 하는 문제 */
  currentProblem: string;
  traits: Record<string, number>;
  goalGraphId: string;
  abilityIds: string[];
}

// --- WorldDefinition ----------------------------------------------------------

export interface WorldDefinition {
  metadata: WorldMetadata;
  axioms: WorldAxiom[]; // §7 — Phase 5
  stateSchemas: StateSchema[]; // §9 — Phase 1
  ruleDefinitions: RuleDefinition[]; // §11 — Phase 2 (규칙은 전부 JSON 이다)
  /** §11.3 create_entity 가 가리키는 템플릿 — Phase 5 생성기가 채운다 */
  entityTemplates?: EntityTemplate[];
  spaces: SpaceDefinition; // §13 — Phase 1
  resources: ResourceDefinition[]; // §14 — Phase 1
  species: SpeciesDefinition[]; // §15 — Phase 1
  survivalPressures: SurvivalPressureDefinition[]; // §8 — Phase 3
  factions: FactionDefinition[]; // §17 — Phase 1
  agentArchetypes: AgentArchetype[]; // §18 — Phase 5
  abilitySystem: AbilitySystemDefinition | null; // §16 — Phase 5 (실행 매핑은 Phase 2 §2.7)
  goalTemplates: GoalGraph[]; // §19 — Phase 1(수동) / Phase 3(활성도 전체 모델)
  actionDefinitions: ActionDefinition[]; // §21 — Phase 1
  eventPatterns: EventPattern[]; // §28 — Phase 4
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
    survivalPressures: [],
    factions: [],
    agentArchetypes: [],
    abilitySystem: null,
    goalTemplates: [],
    actionDefinitions: [],
    eventPatterns: [],
    bootstrap: { entities: [] },
  };
}
