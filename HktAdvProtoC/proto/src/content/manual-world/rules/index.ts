// 수동 세계의 규칙 20개 — 전부 JSON 이다 (Phase-2 "Phase 1 규칙 이관").
//
//  신진대사 4 : hunger_growth / hunger_health_decay / eat_effect / rest_recovery
//  자원 순환 4 : forest_resource_regrowth / village_food_consumption / hunt_yield / trade_transfer
//  생태     4 : echo_beast_feeding / offspring_threat_change / territory_pressure / attack_resolution
//  사회     4 : trade_price / report_propagation / threat_sighting_fear / subjugation_call
//  관찰 신호 4 : movement_trace / attack_noise / carcass_discovery / residue_trace
//
// 로더가 정규형 검증까지 해 준다 — 스키마를 벗어난 규칙은 여기서 즉시 예외가 된다.
import { loadRuleDocuments } from "../../../core/rules/RuleSchema";
import type { RuleDefinition } from "../../../core/rules/RuleTypes";
import ecology from "./ecology.json";
import metabolism from "./metabolism.json";
import observation from "./observation.json";
import resources from "./resources.json";
import society from "./society.json";

export function buildManualWorldRules(): RuleDefinition[] {
  return loadRuleDocuments([
    ...(metabolism as unknown[]),
    ...(resources as unknown[]),
    ...(ecology as unknown[]),
    ...(society as unknown[]),
    ...(observation as unknown[]),
  ]);
}
