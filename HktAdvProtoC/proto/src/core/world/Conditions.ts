// 조건·값 참조 평가기 (기획서 §11.2)
// Phase 1 은 행동과 목적이 JSON 으로 조건을 선언하는 데 필요한 최소 평가만 한다.
// Phase 2 의 규칙 DSL 이 이 평가기를 확장해 가져간다(대상 선택기·효과 실행기까지).
import { distance3d } from "../../shared/state";
import type { WorldRuntime } from "./WorldRuntime";
import type { ConditionDefinition, ConditionOperator, ValueReference } from "./types";

export interface EvalScope {
  runtime: WorldRuntime;
  actorId: string;
  targetId?: string;
}

/** 지역이 다르면 거리를 무한대로 본다 — 지역 간 이동은 연결 그래프의 몫(§13) */
export const CROSS_REGION_DISTANCE = Number.POSITIVE_INFINITY;

export function distanceBetween(scope: EvalScope, fromId: string, toId: string): number {
  const from = scope.runtime.store.entity(fromId).position;
  const to = scope.runtime.store.entity(toId).position;
  if (from === undefined || to === undefined) return CROSS_REGION_DISTANCE;
  if (from.regionId !== to.regionId) return CROSS_REGION_DISTANCE;
  return distance3d(from, to);
}

export function resolveValue(ref: ValueReference, scope: EvalScope): unknown {
  switch (ref.kind) {
    case "const":
      return ref.value;
    case "state": {
      const entityId = ref.owner === "actor" ? scope.actorId : scope.targetId;
      if (entityId === undefined) return undefined;
      return scope.runtime.store.read(entityId, ref.key);
    }
    case "entity_state":
      return scope.runtime.store.read(ref.entityId, ref.key);
    case "entity_ref":
      return ref.owner === "actor" ? scope.actorId : scope.targetId;
    case "belief": {
      if (scope.targetId === undefined) return undefined;
      const runtime = scope.runtime.agentRuntime(scope.actorId);
      const belief = runtime.beliefs.find(
        (b) => b.subjectId === scope.targetId && b.stateKey === ref.key,
      );
      return belief?.believedValue;
    }
    case "distance": {
      if (scope.targetId === undefined) return CROSS_REGION_DISTANCE;
      return distanceBetween(scope, scope.actorId, scope.targetId);
    }
  }
}

export function compare(left: unknown, operator: ConditionOperator, right: unknown): boolean {
  switch (operator) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "contains":
      return Array.isArray(left) ? left.includes(right) : false;
    default: {
      if (typeof left !== "number" || typeof right !== "number") return false;
      switch (operator) {
        case ">":
          return left > right;
        case ">=":
          return left >= right;
        case "<":
          return left < right;
        case "<=":
          return left <= right;
      }
    }
  }
}

export function evaluateCondition(condition: ConditionDefinition, scope: EvalScope): boolean {
  return compare(
    resolveValue(condition.left, scope),
    condition.operator,
    resolveValue(condition.right, scope),
  );
}

export function evaluateAll(conditions: ConditionDefinition[], scope: EvalScope): boolean {
  return conditions.every((condition) => evaluateCondition(condition, scope));
}
