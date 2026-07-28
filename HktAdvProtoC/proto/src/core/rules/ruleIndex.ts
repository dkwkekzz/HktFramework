// 행동 ↔ 실행 규칙의 정적 색인 (기획서 §21, §31, §9 / Phase-8 후속 수정)
//
// 정의는 실행 중에 바뀌지 않으므로(§39 저장의 세 축) 이 색인도 세계당 한 번만 만들면 된다.
// 매 판단마다 규칙을 훑지 않게 하는 캐시이며, 캐시 키는 (행동, 주체 유형) 이다.
import type { ActionDefinition, StateOwnerType, WorldDefinition } from "../world/types";
import type { WorldRuntime } from "../world/WorldRuntime";
import { collectActionStateNeeds, ownerTypeHasAll, type ActionStateNeeds } from "./actionFeasibility";

interface FeasibilityIndex {
  needs: Map<string, ActionStateNeeds>;
  /** `actionId|ownerType|actor|target` → 실행 가능한가 */
  verdicts: Map<string, boolean>;
}

const indexes = new WeakMap<WorldDefinition, FeasibilityIndex>();

function indexOf(definition: WorldDefinition): FeasibilityIndex {
  const found = indexes.get(definition);
  if (found !== undefined) return found;
  const created: FeasibilityIndex = { needs: new Map(), verdicts: new Map() };
  indexes.set(definition, created);
  return created;
}

function needsOf(definition: WorldDefinition, action: ActionDefinition): ActionStateNeeds {
  const index = indexOf(definition);
  const found = index.needs.get(action.id);
  if (found !== undefined) return found;
  const needs = collectActionStateNeeds(definition.ruleDefinitions, action.executionRules);
  index.needs.set(action.id, needs);
  return needs;
}

/** 이 행동의 실행 규칙이 요구하는 상태를 이 주체 유형이 갖고 있는가 */
function ownerCan(
  runtime: WorldRuntime,
  action: ActionDefinition,
  role: "actor" | "target",
  ownerType: StateOwnerType,
): boolean {
  const index = indexOf(runtime.definition);
  const key = `${action.id}|${ownerType}|${role}`;
  const cached = index.verdicts.get(key);
  if (cached !== undefined) return cached;
  const needs = needsOf(runtime.definition, action)[role];
  const missing = ownerTypeHasAll(
    (owner, stateKey) => runtime.schemas.find(owner, stateKey) !== undefined,
    ownerType,
    needs,
  );
  const verdict = missing.length === 0;
  index.verdicts.set(key, verdict);
  return verdict;
}

/**
 * 이 주체가 이 행동을 **끝까지** 수행할 수 있는가 (§31 "실행 가능한 행동만 표시한다").
 *
 * 판정 대상은 **행위자뿐이다.** 규칙이 `actor.X` 를 읽으면 그 규칙이 도는 이유가 곧
 * "이 주체가 그 행동을 했다"이므로 그 읽기는 피할 수 없다. 반면 대상 쪽 상태는 규칙이
 * `entity_type(target)` 같은 조건으로 스스로 거르는 경우가 많아 정적으로 단정할 수 없다 —
 * 그래서 대상은 걸러내지 않는다(과잉 차단은 세계를 조용하게 만든다).
 */
export function actionFeasibleFor(
  runtime: WorldRuntime,
  action: ActionDefinition,
  actorId: string,
): boolean {
  const actor = runtime.store.findEntity(actorId);
  if (actor === undefined) return false;
  return ownerCan(runtime, action, "actor", runtime.store.ownerTypeOf(actor));
}

/** 어떤 주체 유형이 이 행동을 수행할 수 있는가 — 보고·정적 검증용 */
export function feasibleOwnerTypes(
  runtime: WorldRuntime,
  action: ActionDefinition,
  role: "actor" | "target",
  candidates: readonly StateOwnerType[] = ["agent", "faction", "resource", "location", "region"],
): StateOwnerType[] {
  return candidates.filter((ownerType) => ownerCan(runtime, action, role, ownerType));
}

export { collectActionStateNeeds } from "./actionFeasibility";
