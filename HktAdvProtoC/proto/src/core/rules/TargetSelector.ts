// 대상 선택기 (기획서 §11.3 TargetSelector, §12 "주변 개체 검색 / 태그 기반 대상 선택", Phase-2 §2.5)
//
// 검색 결과는 항상 id 사전순이다 — 순회 순서가 결과를 바꾸지 않게 하는 결정론 규약(Phase 1 Queries 와 동일).
// 개체 수는 §40 규모(수백)이므로 선형 스캔으로 충분하다. 공간 색인은 도입하지 않는다.
import { distance3d, type EntityState } from "../../shared/state";
import { allEntities } from "../world/Queries";
import { bindingEntityId, evaluateRuleConditions, withEach, type RuleContext } from "./ConditionEvaluator";
import type { RuleBinding, RuleTargetQuery, RuleTargetSelector } from "./RuleTypes";

function isBinding(value: string): value is RuleBinding {
  return value === "actor" || value === "target" || value === "each";
}

/** §12 `entities[tag=plant]` 형 검색 */
export function runTargetQuery(ctx: RuleContext, query: RuleTargetQuery): EntityState[] {
  const store = ctx.runtime.store;

  let originId: string | undefined;
  let origin: EntityState | undefined;
  if (query.withinRadius !== undefined) {
    const of = query.withinRadius.of;
    originId = isBinding(of) ? bindingEntityId(ctx, of) : of;
    if (originId === undefined) return [];
    origin = store.findEntity(originId);
    if (origin?.position === undefined) return [];
  }

  const found: EntityState[] = [];
  for (const candidate of allEntities(ctx.runtime)) {
    if (query.entityType !== undefined && candidate.type !== query.entityType) continue;
    if (query.ownerType !== undefined && store.ownerTypeOf(candidate) !== query.ownerType) continue;
    if (query.tags !== undefined && !query.tags.every((tag) => candidate.tags.includes(tag))) continue;
    if (query.withinRadius !== undefined) {
      if (candidate.id === originId) continue; // 기준 개체 자신은 후보가 아니다
      if (candidate.position === undefined) continue;
      if (candidate.position.regionId !== origin!.position!.regionId) continue;
      if (distance3d(origin!.position!, candidate.position) > query.withinRadius.r) continue;
    }
    if (query.where !== undefined && !evaluateRuleConditions(query.where, withEach(ctx, candidate.id))) {
      continue;
    }
    found.push(candidate);
    if (query.limit !== undefined && found.length >= query.limit) break;
  }
  return found;
}

/** §11.3 TargetSelector 해석 — 결과는 "이 효과가 건드릴 개체 목록" */
export function resolveTargets(ctx: RuleContext, selector: RuleTargetSelector): EntityState[] {
  switch (selector.type) {
    case "world":
      return [];
    case "actor":
    case "target":
    case "each": {
      const id = bindingEntityId(ctx, selector.type);
      if (id === undefined) return [];
      const entity = ctx.runtime.store.findEntity(id);
      return entity === undefined ? [] : [entity];
    }
    case "entity": {
      const entity = ctx.runtime.store.findEntity(selector.entityId);
      return entity === undefined ? [] : [entity];
    }
    case "query":
      return runTargetQuery(ctx, selector.query);
  }
}

/** 대상이 하나뿐인 자리(자원 이동의 출발·도착 등) */
export function resolveSingleTarget(
  ctx: RuleContext,
  selector: RuleTargetSelector,
): EntityState | undefined {
  return resolveTargets(ctx, selector)[0];
}
