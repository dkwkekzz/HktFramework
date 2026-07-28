// 행동의 실행 가능성 정적 판정 (기획서 §31 "실행 가능한 행동만 표시한다", §21, §9)
//
// 왜 필요한가: 행동 정의(§21)와 실행 규칙(§11)은 따로 쓰인다. 규칙이 **조직의 상태**를 읽는데
// 행동의 actorRequirements 가 비어 있으면, 개인도 그 행동의 후보를 얻고 실행 순간 §9 스키마 검증에 부딪힌다.
// 그것은 "지금 할 수 있는 것"이 아니다 — 그래서 후보 생성 단계에서 걸러야 한다.
//
// 판정은 **정적**이다: 규칙이 actor/target 의 어떤 상태 키를 건드리는지 훑고,
// 그 키가 그 주체의 ownerType(§9) 에 등록되어 있는지만 본다. 값도 시각도 보지 않으므로
// 같은 세계·같은 시드에서 항상 같은 답이 나온다(§39).
import type { StateOwnerType } from "../world/types";
import type {
  RuleCondition,
  RuleDefinition,
  RuleEffect,
  RuleTargetSelector,
  RuleValue,
} from "./RuleTypes";

/** 한 행동의 실행 규칙이 행위자·대상에게 요구하는 상태 키 */
export interface ActionStateNeeds {
  actor: string[];
  target: string[];
}

function addPath(needs: ActionStateNeeds, path: string): void {
  const dot = path.indexOf(".");
  if (dot < 0) return;
  const owner = path.slice(0, dot);
  const key = path.slice(dot + 1);
  if (key.length === 0 || key.includes(".")) return;
  if (owner === "actor") needs.actor.push(key);
  else if (owner === "target") needs.target.push(key);
}

function walkValue(needs: ActionStateNeeds, value: RuleValue): void {
  switch (value.type) {
    case "actor_state":
      needs.actor.push(value.key);
      return;
    case "target_state":
      needs.target.push(value.key);
      return;
    case "path":
      addPath(needs, value.path);
      return;
    case "expr":
      for (const operand of value.operands) walkValue(needs, operand);
      return;
    case "query_value":
      // 검색 결과의 상태는 `each` 에 걸린다 — 행위자·대상의 소유와 무관하므로 보지 않는다
      for (const condition of value.query.where ?? []) walkCondition(needs, condition);
      return;
    default:
      return;
  }
}

function walkCondition(needs: ActionStateNeeds, condition: RuleCondition): void {
  walkValue(needs, condition.left);
  walkValue(needs, condition.right);
}

function pushSelector(needs: ActionStateNeeds, selector: RuleTargetSelector, stateKey: string): void {
  if (selector.type === "actor") needs.actor.push(stateKey);
  else if (selector.type === "target") needs.target.push(stateKey);
}

function walkEffect(needs: ActionStateNeeds, effect: RuleEffect): void {
  for (const condition of effect.conditions ?? []) walkCondition(needs, condition);
  switch (effect.type) {
    case "modify_state":
      pushSelector(needs, effect.target, effect.stateKey);
      if (effect.valueRef !== undefined) walkValue(needs, effect.valueRef);
      return;
    case "transfer_resource":
      pushSelector(needs, effect.from, effect.fromStateKey ?? effect.resourceId);
      pushSelector(needs, effect.to, effect.toStateKey ?? effect.resourceId);
      if (effect.amountRef !== undefined) walkValue(needs, effect.amountRef);
      return;
    case "record_growth":
      // 성장 키는 §9 상태가 아닐 수도 있다(능력 원장) — 소유 판정의 근거로 쓰지 않는다
      if (effect.amountRef !== undefined) walkValue(needs, effect.amountRef);
      return;
    case "modify_relationship":
      if (effect.valueRef !== undefined) walkValue(needs, effect.valueRef);
      return;
    default:
      return;
  }
}

/**
 * 규칙이 스스로 "나는 이 종류의 주체에게만 적용된다"고 밝히는가 (§12 entity_type 비교).
 * 그런 규칙의 요구는 조건이 붙은 요구이므로 **정적 판정의 근거로 쓸 수 없다** —
 * 조건이 거짓이면 그 상태는 읽히지도 않는다.
 */
function guardsBinding(rule: RuleDefinition, binding: "actor" | "target"): boolean {
  const guarded = (value: RuleValue): boolean =>
    value.type === "entity_type" && value.of === binding;
  return rule.conditions.some(
    (condition) => guarded(condition.left) || guarded(condition.right),
  );
}

/** 이 행동을 완료하면 실행되는 규칙들이 행위자·대상에게 요구하는 상태 키 (§21 executionRules) */
export function collectActionStateNeeds(
  rules: readonly RuleDefinition[],
  executionRuleIds: readonly string[],
): ActionStateNeeds {
  const needs: ActionStateNeeds = { actor: [], target: [] };
  for (const ruleId of executionRuleIds) {
    const rule = rules.find((candidate) => candidate.id === ruleId);
    if (rule === undefined) continue;
    // forEach 가 있는 규칙의 target 은 이 행동의 대상이 아니라 검색 결과다 — 대상 요구로 세지 않는다
    const scoped: ActionStateNeeds = { actor: [], target: [] };
    for (const binding of rule.bindings ?? []) walkValue(scoped, binding.value);
    for (const condition of rule.conditions) walkCondition(scoped, condition);
    for (const effect of rule.effects) walkEffect(scoped, effect);
    if (!guardsBinding(rule, "actor")) needs.actor.push(...scoped.actor);
    // forEach 가 있는 규칙의 target 은 이 행동의 대상이 아니라 검색 결과다
    if (rule.forEach === undefined && !guardsBinding(rule, "target")) needs.target.push(...scoped.target);
  }
  return {
    actor: [...new Set(needs.actor)].sort(),
    target: [...new Set(needs.target)].sort(),
  };
}

/** ownerType 이 이 상태 키들을 전부 갖는가 (§9 등록되지 않은 키는 읽기도 쓰기도 오류다) */
export function ownerTypeHasAll(
  has: (ownerType: StateOwnerType, stateKey: string) => boolean,
  ownerType: StateOwnerType,
  stateKeys: readonly string[],
): string[] {
  return stateKeys.filter((stateKey) => !has(ownerType, stateKey));
}
