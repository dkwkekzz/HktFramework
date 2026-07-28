// 세계 정의 정합성 검사 (기획서 §34 의 Phase 1 부분집합, Phase-1 §1.1)
// Phase 6 이 이 검사를 10종 의미 검증으로 확장한다. 지금 확인하는 것은 "실행 가능한가"에 직결되는 것들뿐이다.
import type { RuleRegistry } from "../rules/RuleRegistry";
import { StateSchemaRegistry } from "./StateSchema";
import type { ObservationEffect, StateOwnerType, WorldDefinition } from "./types";

function ownerTypeOfBootstrap(type: string, tags: string[]): StateOwnerType {
  if (type === "location") return tags.includes("region") ? "region" : "location";
  return type as StateOwnerType;
}

/**
 * 관찰 효과의 주장이 상태 스키마와 어긋나지 않는지 검사한다.
 * "비관찰 상태는 어떤 신호로도 노출되지 않는다" — 믿음 분리(§10)의 데이터 근거를 지키는 검사다.
 */
function validateObservationEffect(
  schemas: StateSchemaRegistry,
  effect: ObservationEffect,
  where: string,
  errors: string[],
): void {
  const claim = effect.claim;
  if (claim === undefined) return;
  // 주장 대상은 주체(actor/target) — Phase 1 의 신호 주체는 모두 agent 다
  const schema = schemas.find("agent", claim.stateKey);
  if (schema === undefined) {
    errors.push(`${where}: 등록되지 않은 상태를 주장한다 — ${claim.stateKey}`);
    return;
  }
  if (!schema.observable) {
    errors.push(`${where}: 관찰 불가 상태를 신호로 노출한다 — ${claim.stateKey} (§9 observable=false)`);
    return;
  }
  const declared = schema.observationChannels ?? [];
  if (!effect.channels.some((channel) => declared.includes(channel))) {
    errors.push(
      `${where}: 채널 불일치 — 신호 [${effect.channels.join(",")}] vs 스키마 [${declared.join(",")}]`,
    );
  }
  if (claim.observerStateKey !== undefined && schemas.find("agent", claim.observerStateKey) === undefined) {
    errors.push(`${where}: 등록되지 않은 관찰자 상태 — ${claim.observerStateKey}`);
  }
}

export function validateWorldDefinition(definition: WorldDefinition, rules: RuleRegistry): string[] {
  const errors: string[] = [];
  const schemas = new StateSchemaRegistry(definition.stateSchemas);
  const actionTags = new Set<string>();
  for (const action of definition.actionDefinitions) {
    for (const tag of action.tags) actionTags.add(tag);
  }

  for (const action of definition.actionDefinitions) {
    // §34 "모든 행동은 비용 또는 위험을 가진다"
    if (action.costs.length === 0 && action.risk <= 0) {
      errors.push(`행동 ${action.id}: 비용도 위험도 없다 (§34)`);
    }
    // executionRules ↔ action_executed 트리거 1:1 (Phase 2 DSL 이관의 전제)
    const triggered = rules
      .rulesForAction(action.id)
      .map((rule) => rule.id)
      .sort();
    const declared = [...action.executionRules].sort();
    for (const ruleId of declared) {
      if (rules.find(ruleId) === undefined) {
        errors.push(`행동 ${action.id}: 없는 규칙을 실행한다 — ${ruleId}`);
      }
    }
    if (triggered.join(",") !== declared.join(",")) {
      errors.push(
        `행동 ${action.id}: executionRules[${declared.join(",")}] 와 action_executed 트리거[${triggered.join(",")}] 불일치`,
      );
    }
    for (const effect of action.visibleSignals) {
      validateObservationEffect(schemas, effect, `행동 ${action.id} 신호 ${effect.signalId}`, errors);
    }
  }

  for (const graph of definition.goalTemplates) {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    for (const node of graph.nodes) {
      for (const tag of node.allowedActionTags) {
        if (!actionTags.has(tag)) {
          errors.push(`목적 ${graph.id}/${node.id}: 어떤 행동도 갖지 않은 태그 — ${tag}`);
        }
      }
      for (const desired of node.desiredChanges) {
        const known =
          schemas.find("agent", desired.stateKey) !== undefined ||
          schemas.find("faction", desired.stateKey) !== undefined ||
          schemas.find("resource", desired.stateKey) !== undefined;
        if (!known) errors.push(`목적 ${graph.id}/${node.id}: 등록되지 않은 상태 — ${desired.stateKey}`);
      }
    }
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        errors.push(`목적 그래프 ${graph.id}: 연결이 없는 노드를 가리킨다 — ${edge.from}→${edge.to}`);
      }
    }
  }

  for (const resource of definition.resources) {
    for (const ruleId of [
      ...resource.productionRules,
      ...resource.consumptionRules,
      ...resource.transformationRules,
    ]) {
      if (rules.find(ruleId) === undefined) {
        errors.push(`자원 ${resource.id}: 없는 규칙을 참조한다 — ${ruleId}`);
      }
    }
    // §14 "어떻게 만들어지는가 / 누가 필요로 하는가"가 비어 있으면 자원이 아니다
    if (resource.productionRules.length === 0) errors.push(`자원 ${resource.id}: 생산 규칙이 없다 (§14)`);
    if (resource.desiredBy.length === 0) errors.push(`자원 ${resource.id}: 원하는 주체가 없다 (§14)`);
  }

  const graphIds = new Set(definition.goalTemplates.map((graph) => graph.id));
  const speciesIds = new Set(definition.species.map((species) => species.id));
  const factionIds = new Set(definition.factions.map((faction) => faction.id));
  for (const entity of definition.bootstrap.entities) {
    const ownerType = ownerTypeOfBootstrap(entity.type, entity.tags);
    for (const stateKey of Object.keys(entity.states)) {
      if (schemas.find(ownerType, stateKey) === undefined) {
        errors.push(`초기 배치 ${entity.id}: 등록되지 않은 상태 — ${ownerType}.${stateKey}`);
      }
    }
    if (entity.speciesId !== undefined && !speciesIds.has(entity.speciesId)) {
      errors.push(`초기 배치 ${entity.id}: 없는 종족 — ${entity.speciesId}`);
    }
    if (entity.goalGraphId !== undefined && !graphIds.has(entity.goalGraphId)) {
      errors.push(`초기 배치 ${entity.id}: 없는 목적 그래프 — ${entity.goalGraphId}`);
    }
    for (const factionId of entity.factionIds ?? []) {
      if (!factionIds.has(factionId)) errors.push(`초기 배치 ${entity.id}: 없는 조직 — ${factionId}`);
    }
  }

  for (const rule of rules.intervalRules) {
    if (rule.interval <= 0) errors.push(`규칙 ${rule.rule.id}: interval 은 양수여야 한다`);
  }
  for (const species of definition.species) {
    if (species.senses.length === 0) errors.push(`종족 ${species.id}: 감각이 없다 (§15)`);
  }

  return errors;
}
