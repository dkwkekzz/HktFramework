// 세계 정의 정합성 검사 (기획서 §34 의 Phase 1 부분집합, Phase-1 §1.1)
// Phase 6 이 이 검사를 10종 의미 검증으로 확장한다. 지금 확인하는 것은 "실행 가능한가"에 직결되는 것들뿐이다.
import type { RuleEngine } from "../rules/RuleEngine";
import type {
  RuleCondition,
  RuleDefinition,
  RuleEffect,
  RuleTargetQuery,
  RuleTargetSelector,
  RuleValue,
} from "../rules/RuleTypes";
import { splitPath } from "../rules/ConditionEvaluator";
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
  if (claim.relayBelief !== true && (claim.value === undefined || claim.confidence === undefined)) {
    errors.push(`${where}: 주장에 value/confidence 가 없다 (relayBelief 가 아니면 필수)`);
    return;
  }
  if (claim.subject === "entity" && claim.entityId === undefined) {
    errors.push(`${where}: subject="entity" 인데 entityId 가 없다`);
    return;
  }
  // 주장 대상은 주체(actor/target/entity) — 신호의 주체는 개인·생물(agent) 또는 조직(faction)이다
  const schema = schemas.find("agent", claim.stateKey) ?? schemas.find("faction", claim.stateKey);
  if (schema === undefined) {
    errors.push(`${where}: 등록되지 않은 상태를 주장한다 — ${claim.stateKey}`);
    return;
  }
  if (!schema.observable) {
    errors.push(`${where}: 관찰 불가 상태를 신호로 노출한다 — ${claim.stateKey} (§9 observable=false)`);
    return;
  }
  const declared = schema.observationChannels ?? [];
  // 소문·보고(§23)는 감각이 아니라 말이다 — 전달되는 믿음에는 감각 채널 제약을 걸지 않는다.
  // 다만 observable=false 인 상태는 여전히 옮길 수 없다(§10 믿음 분리의 데이터 보증).
  if (claim.relayBelief !== true && !effect.channels.some((channel) => declared.includes(channel))) {
    errors.push(
      `${where}: 채널 불일치 — 신호 [${effect.channels.join(",")}] vs 스키마 [${declared.join(",")}]`,
    );
  }
  if (claim.observerStateKey !== undefined && schemas.find("agent", claim.observerStateKey) === undefined) {
    errors.push(`${where}: 등록되지 않은 관찰자 상태 — ${claim.observerStateKey}`);
  }
}

// --- 규칙 DSL 검증 (Phase-2 §2.3 — "존재하지 않는 경로는 조건 실패가 아니라 검증 오류") -------

/** 어떤 ownerType 에도 없는 상태 키는 규칙이 참조할 수 없다 */
function requireKnownStateKey(
  schemas: StateSchemaRegistry,
  stateKey: string,
  where: string,
  errors: string[],
): void {
  if (schemas.all().some((schema) => schema.id === stateKey)) return;
  errors.push(`${where}: 등록되지 않은 상태를 참조한다 — ${stateKey} (§9)`);
}

function walkValue(
  schemas: StateSchemaRegistry,
  value: RuleValue,
  where: string,
  errors: string[],
): void {
  switch (value.type) {
    case "actor_state":
    case "target_state":
    case "each_state":
    case "world_state":
    case "entity_state":
      requireKnownStateKey(schemas, value.key, where, errors);
      return;
    case "path": {
      const { key } = splitPath(value.path);
      requireKnownStateKey(schemas, key, where, errors);
      return;
    }
    case "query_value":
      if (value.key !== undefined) requireKnownStateKey(schemas, value.key, where, errors);
      walkQuery(schemas, value.query, where, errors);
      return;
    case "expr":
      for (const operand of value.operands) walkValue(schemas, operand, where, errors);
      return;
    default:
      return;
  }
}

function walkConditions(
  schemas: StateSchemaRegistry,
  conditions: RuleCondition[],
  where: string,
  errors: string[],
): void {
  for (const condition of conditions) {
    walkValue(schemas, condition.left, where, errors);
    walkValue(schemas, condition.right, where, errors);
  }
}

function walkQuery(
  schemas: StateSchemaRegistry,
  query: RuleTargetQuery,
  where: string,
  errors: string[],
): void {
  if (query.where !== undefined) walkConditions(schemas, query.where, where, errors);
}

function walkSelector(
  schemas: StateSchemaRegistry,
  selector: RuleTargetSelector,
  where: string,
  errors: string[],
): void {
  if (selector.type === "query") walkQuery(schemas, selector.query, where, errors);
}

function validateRuleEffect(
  definition: WorldDefinition,
  rules: RuleEngine,
  schemas: StateSchemaRegistry,
  rule: RuleDefinition,
  effect: RuleEffect,
  where: string,
  errors: string[],
): void {
  if (effect.conditions !== undefined) walkConditions(schemas, effect.conditions, where, errors);
  if (effect.chance !== undefined && (effect.chance < 0 || effect.chance > 1)) {
    errors.push(`${where}: chance 는 0~1 이어야 한다 — ${effect.chance}`);
  }
  switch (effect.type) {
    case "modify_state":
      walkSelector(schemas, effect.target, where, errors);
      requireKnownStateKey(schemas, effect.stateKey, where, errors);
      if (effect.valueRef !== undefined) walkValue(schemas, effect.valueRef, where, errors);
      if (effect.value === undefined && effect.valueRef === undefined) {
        errors.push(`${where}: modify_state 에 value 도 valueRef 도 없다`);
      }
      return;
    case "transfer_resource":
      walkSelector(schemas, effect.from, where, errors);
      walkSelector(schemas, effect.to, where, errors);
      requireKnownStateKey(schemas, effect.fromStateKey ?? effect.resourceId, where, errors);
      requireKnownStateKey(schemas, effect.toStateKey ?? effect.resourceId, where, errors);
      if (effect.amountRef !== undefined) walkValue(schemas, effect.amountRef, where, errors);
      return;
    case "create_entity":
      walkSelector(schemas, effect.location, where, errors);
      if (!(definition.entityTemplates ?? []).some((t) => t.id === effect.templateId)) {
        errors.push(`${where}: 없는 개체 템플릿 — ${effect.templateId}`);
      }
      return;
    case "destroy_entity":
      walkSelector(schemas, effect.target, where, errors);
      return;
    case "emit_signal": {
      // 신호는 규칙 자신이 선언했거나, 이 규칙을 깨우는 행동이 선언했어야 한다 (§11 observations / §21 visibleSignals)
      const fromRule = rule.observations.some((o) => o.signalId === effect.signalId);
      const triggerActionIds = rule.triggers
        .filter((t): t is Extract<typeof t, { type: "action_executed" }> => t.type === "action_executed")
        .map((t) => t.actionId);
      const fromAction = definition.actionDefinitions
        .filter((action) => triggerActionIds.includes(action.id))
        .some((action) => action.visibleSignals.some((s) => s.signalId === effect.signalId));
      if (!fromRule && !fromAction) {
        errors.push(`${where}: 어디에도 선언되지 않은 신호를 내보낸다 — ${effect.signalId}`);
      }
      return;
    }
    case "schedule_rule":
      if (rules.find(effect.ruleId) === undefined) {
        errors.push(`${where}: 없는 규칙을 예약한다 — ${effect.ruleId}`);
      }
      if (effect.delay < 0) errors.push(`${where}: delay 는 0 이상이어야 한다`);
      return;
    case "modify_relationship":
      walkSelector(schemas, effect.from, where, errors);
      walkSelector(schemas, effect.to, where, errors);
      return;
  }
}

function validateRules(
  definition: WorldDefinition,
  rules: RuleEngine,
  schemas: StateSchemaRegistry,
  errors: string[],
): void {
  // 트리거가 없어도 다른 규칙이 예약(schedule_rule)한다면 깨어날 길이 있다
  const scheduledRuleIds = new Set<string>();
  for (const rule of rules.all()) {
    for (const effect of rule.effects) {
      if (effect.type === "schedule_rule") scheduledRuleIds.add(effect.ruleId);
    }
  }

  for (const rule of rules.all()) {
    const where = `규칙 ${rule.id}`;
    if (rule.triggers.length === 0 && !scheduledRuleIds.has(rule.id)) {
      errors.push(`${where}: 아무도 깨우지 않는다 — 트리거도 없고 예약하는 규칙도 없다 (§11.1)`);
    }
    if (rule.cooldown !== undefined && rule.cooldown < 0) {
      errors.push(`${where}: cooldown 은 0 이상이어야 한다`);
    }
    if (rule.effects.length === 0 && rule.observations.length === 0) {
      errors.push(`${where}: 아무 효과도 없다 (§11.3)`);
    }
    if (rule.forEach !== undefined) walkSelector(schemas, rule.forEach, where, errors);
    for (const binding of rule.bindings ?? []) {
      walkValue(schemas, binding.value, `${where} 바인딩 ${binding.name}`, errors);
    }
    walkConditions(schemas, rule.conditions, where, errors);
    for (const effect of rule.effects) {
      validateRuleEffect(definition, rules, schemas, rule, effect, where, errors);
    }
    for (const effect of rule.observations) {
      validateObservationEffect(schemas, effect, `${where} 신호 ${effect.signalId}`, errors);
    }
  }
}

export function validateWorldDefinition(definition: WorldDefinition, rules: RuleEngine): string[] {
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

  validateRules(definition, rules, schemas, errors);

  return errors;
}
