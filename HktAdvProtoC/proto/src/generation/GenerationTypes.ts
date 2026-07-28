// 생성 단계의 입력·중간 산출 타입 (기획서 §4, §6, §40)
//
// 최종 산출(WorldDefinition 의 각 필드)은 core/world/types.ts 가 이미 갖고 있다 —
// Phase 1~4 가 실행하고 있는 그 포맷이 곧 생성기의 출력 계약이기 때문이다(Phase-5 목표).
// 여기 있는 것은 아직 실행 포맷이 아닌 것들: 사용자 입력과 파이프라인 중간 산출.
import type { ArtifactStore } from "./ArtifactStore";
import type { SymbolTable } from "./SymbolTable";
import type { GenerationTelemetry, TextGenerationPort } from "./TextGenerationPort";

/** §4 사용자가 입력하는 최소 세계관 데이터 */
export interface WorldSeedInput {
  title?: string;
  themes: string[];
  desiredExperiences?: string[];
  prohibitedElements?: string[];
}

/** §6 1단계 산출 — 자유 문장에서 뽑은 최소 구조 */
export interface NormalizedTheme {
  id: string;
  source: string;
  subject: string;
  condition?: string;
  behavior?: string;
  desiredState?: string;
  cost?: string;
  threat?: string;
  scope: "world" | "species" | "society" | "individual";
}

/** §40 초기 프로토타입의 규모 — 생성 호출의 "개수 목표"이자 완료 조건 */
export interface WorldScale {
  regions: number;
  locations: number;
  species: number;
  factions: number;
  keyAgents: number;
  generalEntities: { min: number; max: number };
  resources: number;
  actions: number;
  rules: { min: number; max: number };
  eventPatterns: number;
  abilityUsers: number;
}

export const PROTOTYPE_SCALE: WorldScale = {
  regions: 3,
  locations: 12,
  species: 4,
  factions: 5,
  keyAgents: 20,
  generalEntities: { min: 80, max: 150 },
  resources: 15,
  actions: 20,
  rules: { min: 40, max: 60 },
  eventPatterns: 10,
  abilityUsers: 5,
};

/** 모든 생성기가 공유하는 문맥 */
export interface GenerationContext {
  port: TextGenerationPort;
  symbols: SymbolTable;
  artifacts: ArtifactStore;
  telemetry: GenerationTelemetry;
  seedInput: WorldSeedInput;
  worldSeed: number;
  scale: WorldScale;
}
