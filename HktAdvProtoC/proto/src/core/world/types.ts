// WorldDefinition — 변하지 않는 세계 구조 (기획서 §5, §39)
// Phase 0 은 필드 골격만 선언한다. placeholder(unknown[]) 필드는 담당 Phase 에서 실체 타입으로 교체된다.
export type { EntityState, EntityType, Position, WorldState } from "../../shared/state";

export interface WorldMetadata {
  id: string;
  title: string;
  worldSeed: number;
}

// 상태 스키마 (기획서 §9) — Phase 1 에서 검증기와 함께 실체화되지만 타입은 지금 확정한다.
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

export interface WorldDefinition {
  metadata: WorldMetadata;
  axioms: unknown[]; // §7 WorldAxiom — Phase 5
  stateSchemas: StateSchema[]; // §9 — Phase 1
  ruleDefinitions: unknown[]; // §11 RuleDefinition — Phase 2
  spaces: unknown[]; // §13 SpaceDefinition — Phase 1
  resources: unknown[]; // §14 ResourceDefinition — Phase 1
  species: unknown[]; // §15 SpeciesDefinition — Phase 1
  factions: unknown[]; // §17 FactionDefinition — Phase 1
  agentArchetypes: unknown[]; // §18 — Phase 5
  abilitySystem: unknown; // §16 — Phase 5 (실행 매핑은 Phase 2 §2.7)
  goalTemplates: unknown[]; // §19 GoalTemplate — Phase 3
  actionDefinitions: unknown[]; // §21 ActionDefinition — Phase 1
  eventPatterns: unknown[]; // §28 EventPattern — Phase 4
  bootstrap: unknown; // 초기 배치 — Phase 1(수동)/Phase 5(생성)
}

export function createEmptyWorldDefinition(worldSeed: number): WorldDefinition {
  return {
    metadata: { id: `world.${worldSeed}`, title: "빈 세계", worldSeed },
    axioms: [],
    stateSchemas: [],
    ruleDefinitions: [],
    spaces: [],
    resources: [],
    species: [],
    factions: [],
    agentArchetypes: [],
    abilitySystem: null,
    goalTemplates: [],
    actionDefinitions: [],
    eventPatterns: [],
    bootstrap: null,
  };
}
