// 수동 세계의 규칙 — 전부 JSON 이다 (Phase-2 "Phase 1 규칙 이관" 20개 + Phase 3 추가 19개).
//
//  신진대사 4 : hunger_growth / hunger_health_decay / eat_effect / rest_recovery
//  자원 순환 4 : forest_resource_regrowth / village_food_consumption / hunt_yield / trade_transfer
//  생태     4 : echo_beast_feeding / offspring_threat_change / territory_pressure / attack_resolution
//  사회     4 : trade_price / report_propagation / threat_sighting_fear / subjugation_call
//  관찰 신호 4 : movement_trace / attack_noise / carcass_discovery / residue_trace
//
// Phase 3 이 더한 규칙 (§25 관계 · §17 조직 · §15 번식/성장/적응):
//  관계 9 : help_builds_trust / threat_breeds_fear / power_earns_respect / report_builds_trust /
//           delegation_creates_dependency / gossip_builds_familiarity / promise_broken_trust /
//           promise_broken_rumor / fear_of_the_feared
//  조직 7 : delegation_order / delegated_task_progress / rumor_spread / faction_trade_transfer /
//           faction_collapse_shock / threat_belief_spreads_fear / researcher_insight
//  생태 3 : echo_beast_reproduction / echo_beast_cub_growth / residue_adaptation
//
// 로더가 정규형 검증까지 해 준다 — 스키마를 벗어난 규칙은 여기서 즉시 예외가 된다.
import { loadRuleDocuments } from "../../../core/rules/RuleSchema";
import type { RuleDefinition } from "../../../core/rules/RuleTypes";
import ecology from "./ecology.json";
import metabolism from "./metabolism.json";
import observation from "./observation.json";
import organization from "./organization.json";
import relationships from "./relationships.json";
import resources from "./resources.json";
import society from "./society.json";

export function buildManualWorldRules(): RuleDefinition[] {
  return loadRuleDocuments([
    ...(metabolism as unknown[]),
    ...(resources as unknown[]),
    ...(ecology as unknown[]),
    ...(society as unknown[]),
    ...(observation as unknown[]),
    ...(relationships as unknown[]),
    ...(organization as unknown[]),
  ]);
}
