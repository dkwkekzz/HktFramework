// 수동 세계 로더 (Phase-1 구현 스텝 2)
// 데이터는 TS 상수가 아니라 JSON 이다 — Phase 5 의 생성 출력이 정확히 이 자리에 들어오기 때문이다.
// JSON 은 구조 타입을 스스로 보증하지 못하므로, 실행 전 검사는 WorldValidation(§34 부분집합)이 맡는다.
import type {
  ActionDefinition,
  EventPattern,
  FactionDefinition,
  GoalGraph,
  ResourceDefinition,
  SpaceDefinition,
  SpeciesDefinition,
  StateSchema,
  SurvivalPressureDefinition,
  WorldAxiom,
  WorldBootstrap,
  WorldDefinition,
} from "../../core/world/types";
import type { EntityTemplate } from "../../core/rules/RuleTypes";
import { buildManualWorldRules } from "./rules";
import actions from "./actions.json";
import axioms from "./axioms.json";
import bootstrap from "./bootstrap.json";
import eventPatterns from "./event-patterns.json";
import factions from "./factions.json";
import goals from "./goals.json";
import pressures from "./pressures.json";
import resources from "./resources.json";
import schemas from "./state-schemas.json";
import space from "./space.json";
import species from "./species.json";
import templates from "./templates.json";
import { linkReproductionRules } from "../../core/world/SpeciesLinks";

export const MANUAL_WORLD_ID = "world.silent_forest_edge";

/** 수동 세계 정의 (§41 첫 번째 세계의 부분집합) */
export function buildManualWorld(worldSeed: number): WorldDefinition {
  return {
    metadata: { id: MANUAL_WORLD_ID, title: "침묵림 변두리", worldSeed },
    // §7 WorldAxiom — 규칙이 derivedFromAxioms 로 가리키는 상위 제약 (§41 초기 입력에서 왔다)
    axioms: axioms as unknown as WorldAxiom[],
    stateSchemas: schemas as unknown as StateSchema[],
    ruleDefinitions: buildManualWorldRules(), // §11 — 규칙 전부 JSON (Phase 2 이관 완료 + Phase 3 확장)
    entityTemplates: templates as unknown as EntityTemplate[], // §11.3 create_entity (§15 번식)
    spaces: space as unknown as SpaceDefinition,
    resources: resources as unknown as ResourceDefinition[],
    // §15 번식 선언 → 실행 규칙 연결은 코드가 실물에서 찾는다 (G-4 — 개체 템플릿의 species_id)
    species: linkReproductionRules(
      species as unknown as SpeciesDefinition[],
      buildManualWorldRules(),
      templates as unknown as EntityTemplate[],
    ),
    survivalPressures: pressures as unknown as SurvivalPressureDefinition[], // §8
    factions: factions as unknown as FactionDefinition[],
    agentArchetypes: [],
    abilitySystem: null,
    goalTemplates: goals as unknown as GoalGraph[],
    actionDefinitions: actions as unknown as ActionDefinition[],
    eventPatterns: eventPatterns as unknown as EventPattern[], // §28 — Phase 4 사건 탐지
    bootstrap: bootstrap as unknown as WorldBootstrap,
  };
}
