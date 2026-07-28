// 수동 세계 로더 (Phase-1 구현 스텝 2)
// 데이터는 TS 상수가 아니라 JSON 이다 — Phase 5 의 생성 출력이 정확히 이 자리에 들어오기 때문이다.
// JSON 은 구조 타입을 스스로 보증하지 못하므로, 실행 전 검사는 WorldValidation(§34 부분집합)이 맡는다.
import type {
  ActionDefinition,
  FactionDefinition,
  GoalGraph,
  ResourceDefinition,
  SpaceDefinition,
  SpeciesDefinition,
  StateSchema,
  WorldBootstrap,
  WorldDefinition,
} from "../../core/world/types";
import actions from "./actions.json";
import bootstrap from "./bootstrap.json";
import factions from "./factions.json";
import goals from "./goals.json";
import resources from "./resources.json";
import schemas from "./state-schemas.json";
import space from "./space.json";
import species from "./species.json";

export const MANUAL_WORLD_ID = "world.silent_forest_edge";

/** 수동 세계 정의 (§41 첫 번째 세계의 부분집합) */
export function buildManualWorld(worldSeed: number): WorldDefinition {
  return {
    metadata: { id: MANUAL_WORLD_ID, title: "침묵림 변두리", worldSeed },
    axioms: [
      // §7 WorldAxiom 의 실체화는 Phase 5. Phase 1 은 규칙이 참조하는 명제 id 만 남긴다(§41 초기 입력).
      "axiom.life_must_be_sustained",
      "axiom.life_protects_what_it_values",
      "axiom.dangerous_places_are_rich",
      "axiom.creatures_absorb_ability_residue",
      "axiom.scarcity_creates_exchange",
      "axiom.organizations_act_on_reports",
      "axiom.belief_drives_behavior",
      "axiom.actions_leave_signs",
    ],
    stateSchemas: schemas as unknown as StateSchema[],
    ruleDefinitions: [], // Phase 1 의 규칙은 코드(HandwrittenRules) — Phase 2 에서 이 배열로 이관된다
    spaces: space as unknown as SpaceDefinition,
    resources: resources as unknown as ResourceDefinition[],
    species: species as unknown as SpeciesDefinition[],
    factions: factions as unknown as FactionDefinition[],
    agentArchetypes: [],
    abilitySystem: null,
    goalTemplates: goals as unknown as GoalGraph[],
    actionDefinitions: actions as unknown as ActionDefinition[],
    eventPatterns: [],
    bootstrap: bootstrap as unknown as WorldBootstrap,
  };
}
