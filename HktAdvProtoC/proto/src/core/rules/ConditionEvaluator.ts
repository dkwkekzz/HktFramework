// 조건 평가기 · 값 참조 해석 (기획서 §11.2, Phase-2 §2.3)
//
// 원칙 하나: **존재하지 않는 경로는 조건 실패가 아니라 오류다**.
// 상태 읽기는 StateStore 를 통과하므로 등록되지 않은 stateKey 는 여기서 즉시 예외가 된다
// (§34 "모든 규칙의 대상이 실제로 존재한다" 의 런타임 방어선).
import { distance3d } from "../../shared/state";
import type { WorldRuntime } from "../world/WorldRuntime";
import type {
  RuleBinding,
  RuleCondition,
  RuleConditionOperator,
  RuleDefinition,
  RuleValue,
} from "./RuleTypes";
import { runTargetQuery } from "./TargetSelector";

/** 지역이 다르면 거리는 무한대 — 지역 간 이동은 연결 그래프의 몫(§13) */
export const CROSS_REGION_DISTANCE = Number.POSITIVE_INFINITY;

/** 규칙 한 번의 실행 맥락 — 바인딩 세 개(actor/target/each)와 지연 계산 값들 */
export interface RuleContext {
  runtime: WorldRuntime;
  rule: RuleDefinition;
  actorId?: string | undefined;
  targetId?: string | undefined;
  eachId?: string | undefined;
  actionId?: string | undefined;
  payload?: Record<string, unknown> | undefined;
  /** bindings 정의 — 처음 참조될 때 계산한다 */
  bindingDefs: Map<string, RuleValue>;
  bindingValues: Map<string, unknown>;
  bindingResolving: Set<string>;
  /** 효과 번호 — chance 난수 스트림을 효과마다 갈라 놓는다 */
  effectIndex: number;
}

export function createRuleContext(
  runtime: WorldRuntime,
  rule: RuleDefinition,
  partial: {
    actorId?: string;
    targetId?: string;
    actionId?: string;
    payload?: Record<string, unknown>;
  },
): RuleContext {
  const bindingDefs = new Map<string, RuleValue>();
  for (const binding of rule.bindings ?? []) bindingDefs.set(binding.name, binding.value);
  return {
    runtime,
    rule,
    ...partial,
    bindingDefs,
    bindingValues: new Map(),
    bindingResolving: new Set(),
    effectIndex: 0,
  };
}

/** 같은 규칙 실행 안에서 대상만 바꿔 평가할 때 — 바인딩 캐시는 공유한다 */
export function withEach(ctx: RuleContext, eachId: string | undefined): RuleContext {
  return { ...ctx, eachId };
}

export function withTarget(ctx: RuleContext, targetId: string | undefined): RuleContext {
  return { ...ctx, targetId, eachId: targetId };
}

export function bindingEntityId(ctx: RuleContext, binding: RuleBinding): string | undefined {
  switch (binding) {
    case "actor":
      return ctx.actorId;
    case "target":
      return ctx.targetId;
    case "each":
      return ctx.eachId;
  }
}

/** §12 점 표기 `owner.stateKey` — owner 는 예약어이거나 개체 id 다. 마지막 점에서 자른다. */
export function splitPath(path: string): { owner: string; key: string } {
  const cut = path.lastIndexOf(".");
  if (cut < 0) return { owner: "each", key: path };
  return { owner: path.slice(0, cut), key: path.slice(cut + 1) };
}

function readState(ctx: RuleContext, entityId: string | undefined, key: string): unknown {
  if (entityId === undefined) return undefined;
  return ctx.runtime.store.read(entityId, key);
}

function numeric(value: unknown): number {
  return typeof value === "number" ? value : Number.NaN;
}

function applyExpr(op: string, operands: number[]): number {
  switch (op) {
    case "add":
      return operands.reduce((a, b) => a + b, 0);
    case "sub":
      return operands.length === 0 ? 0 : operands.slice(1).reduce((a, b) => a - b, operands[0]!);
    case "mul":
      return operands.reduce((a, b) => a * b, 1);
    case "div": {
      const [head, ...rest] = operands;
      // 0 으로 나누기는 0 — 조건이 막아 주지 못한 경우에도 NaN 이 상태로 새지 않게 한다
      return rest.reduce((a, b) => (b === 0 ? 0 : a / b), head ?? 0);
    }
    case "neg":
      return -(operands[0] ?? 0);
    case "min":
      return Math.min(...operands);
    case "max":
      return Math.max(...operands);
    case "floor":
      return Math.floor(operands[0] ?? 0);
    case "ceil":
      return Math.ceil(operands[0] ?? 0);
    case "round":
      return Math.round(operands[0] ?? 0);
    case "abs":
      return Math.abs(operands[0] ?? 0);
    default:
      throw new Error(`알 수 없는 연산: ${op}`);
  }
}

function rngStreamId(ctx: RuleContext, stream: RuleBinding | undefined): string | undefined {
  return bindingEntityId(ctx, stream ?? "actor") ?? ctx.actorId ?? ctx.targetId ?? ctx.eachId;
}

export function resolveRuleValue(ref: RuleValue, ctx: RuleContext): unknown {
  switch (ref.type) {
    case "constant":
      return ref.value;
    case "actor_state":
      return readState(ctx, ctx.actorId, ref.key);
    case "target_state":
      return readState(ctx, ctx.targetId, ref.key);
    case "each_state":
      return readState(ctx, ctx.eachId, ref.key);
    case "world_state":
      return ctx.runtime.store.readGlobal(ref.key);
    case "entity_state":
      return readState(ctx, ref.entityId, ref.key);
    case "event_payload":
      return ctx.payload?.[ref.key];
    case "path": {
      const { owner, key } = splitPath(ref.path);
      if (owner === "world") return ctx.runtime.store.readGlobal(key);
      if (owner === "actor" || owner === "target" || owner === "each") {
        return readState(ctx, bindingEntityId(ctx, owner), key);
      }
      return readState(ctx, owner, key);
    }
    case "entity_ref":
      return bindingEntityId(ctx, ref.of);
    case "entity_type": {
      const id = bindingEntityId(ctx, ref.of);
      return id === undefined ? undefined : ctx.runtime.store.findEntity(id)?.type;
    }
    case "binding":
      return resolveBinding(ctx, ref.name);
    case "distance": {
      const fromId = bindingEntityId(ctx, ref.from);
      const toId = bindingEntityId(ctx, ref.to);
      if (fromId === undefined || toId === undefined) return CROSS_REGION_DISTANCE;
      const from = ctx.runtime.store.entity(fromId).position;
      const to = ctx.runtime.store.entity(toId).position;
      if (from === undefined || to === undefined) return CROSS_REGION_DISTANCE;
      if (from.regionId !== to.regionId) return CROSS_REGION_DISTANCE;
      return distance3d(from, to);
    }
    case "random":
      return ctx.runtime.rngFor(rngStreamId(ctx, ref.stream)).next();
    case "random_int":
      return ctx.runtime.rngFor(rngStreamId(ctx, ref.stream)).nextInt(ref.max);
    case "species_need": {
      // §15 종족 생존 구조를 규칙이 읽는다 (G-4) — 종족이 없거나 그 자원을 필요로 하지 않으면 0
      const id = bindingEntityId(ctx, ref.of ?? "each");
      if (id === undefined) return 0;
      const speciesId = ctx.runtime.store.findEntity(id)?.states["species_id"];
      if (typeof speciesId !== "string" || speciesId === "") return 0;
      const species = ctx.runtime.index.species.get(speciesId);
      const need = species?.requiredResources.find((entry) => entry.resourceTag === ref.resourceTag);
      return need?.amountPerDay ?? 0;
    }
    case "query_value": {
      const found = runTargetQuery(ctx, ref.query);
      if (ref.aggregate === "count") return found.length;
      if (ref.key === undefined) throw new Error(`query_value(${ref.aggregate}) 에는 key 가 필요하다`);
      if (ref.aggregate === "first") {
        const head = found[0];
        return head === undefined ? 0 : ctx.runtime.store.read(head.id, ref.key);
      }
      const values = found.map((entity) => numeric(ctx.runtime.store.read(entity.id, ref.key!)));
      if (values.length === 0) return 0;
      if (ref.aggregate === "sum") return values.reduce((a, b) => a + b, 0);
      return ref.aggregate === "min" ? Math.min(...values) : Math.max(...values);
    }
    case "expr":
      return applyExpr(
        ref.op,
        ref.operands.map((operand) => numeric(resolveRuleValue(operand, ctx))),
      );
  }
}

/** 지연 계산 + 기억. 순환 참조는 오류다. */
export function resolveBinding(ctx: RuleContext, name: string): unknown {
  if (ctx.bindingValues.has(name)) return ctx.bindingValues.get(name);
  const def = ctx.bindingDefs.get(name);
  if (def === undefined) throw new Error(`정의되지 않은 바인딩: ${ctx.rule.id}.${name}`);
  if (ctx.bindingResolving.has(name)) {
    throw new Error(`바인딩 순환 참조: ${ctx.rule.id}.${name}`);
  }
  ctx.bindingResolving.add(name);
  try {
    const value = resolveRuleValue(def, ctx);
    ctx.bindingValues.set(name, value);
    return value;
  } finally {
    ctx.bindingResolving.delete(name);
  }
}

export function compareRuleValues(
  left: unknown,
  operator: RuleConditionOperator,
  right: unknown,
): boolean {
  switch (operator) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "contains":
      if (Array.isArray(left)) return left.includes(right);
      if (typeof left === "string" && typeof right === "string") return left.includes(right);
      return false;
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

export function evaluateRuleCondition(condition: RuleCondition, ctx: RuleContext): boolean {
  return compareRuleValues(
    resolveRuleValue(condition.left, ctx),
    condition.operator,
    resolveRuleValue(condition.right, ctx),
  );
}

/** 조건은 순서대로 평가하고 첫 실패에서 멈춘다 — 앞 조건이 뒤 조건의 전제(개체 종류 등)를 지킨다 */
export function evaluateRuleConditions(conditions: RuleCondition[], ctx: RuleContext): boolean {
  for (const condition of conditions) {
    if (!evaluateRuleCondition(condition, ctx)) return false;
  }
  return true;
}
