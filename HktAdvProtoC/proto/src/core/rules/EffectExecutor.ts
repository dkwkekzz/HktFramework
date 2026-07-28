// 효과 실행기 (기획서 §11.3 6종 + §12 요구 능력 / Phase-2 §2.4)
//
// 모든 상태 쓰기는 StateStore 를 지난다 — 스키마 검증·patch·change 로그·state_changed 트리거가
// 여기서 자동으로 따라온다. 효과 실행기가 entity.states 를 직접 만지는 일은 없다.
import { createAgentRuntimeState } from "../../shared/beliefs";
import type { EntityState } from "../../shared/state";
import { requestGrowth } from "../agents/GrowthSystem";
import {
  applyRelationshipChange,
  ensureRelationship,
  isRelationshipKey,
} from "../agents/RelationshipSystem";
import {
  bindingEntityId,
  evaluateRuleConditions,
  resolveRuleValue,
  withEach,
  type RuleContext,
} from "./ConditionEvaluator";
import { emitRuleSignal } from "./ObservationEmitter";
import type { RuleEffect, RuleTargetSelector, RuleValue, StateOperation } from "./RuleTypes";
import { resolveSingleTarget, resolveTargets } from "./TargetSelector";

/** schedule_rule(§11.3) 이 만드는 예약 이벤트 */
export const RULE_SCHEDULED_EVENT = "rule_scheduled";

/** 관계 변경이 relationship_changed 트리거로 이어지는 통로 (Phase 3 RelationshipStore 가 실체화한다) */
export interface EffectHooks {
  onRelationshipChanged(ctx: RuleContext, key: string, fromId: string, toId: string): void;
}

function resolveAmount(
  ctx: RuleContext,
  literal: number | boolean | string | undefined,
  ref: RuleValue | undefined,
): unknown {
  return ref === undefined ? literal : resolveRuleValue(ref, ctx);
}

/**
 * §12 확률적 효과.
 * 난수 스트림은 (worldSeed, simulationStep, "대상id#규칙id#효과번호") — 같은 tick·같은 대상에
 * 여러 확률 효과가 걸려도 서로 다른 값을 얻는다. 시드가 같으면 결과도 같다(§39).
 */
function passesChance(ctx: RuleContext, chance: number, entityId: string | undefined): boolean {
  if (chance >= 1) return true;
  if (chance <= 0) return false;
  const stream = `${entityId ?? "world"}#${ctx.rule.id}#${ctx.effectIndex}`;
  return ctx.runtime.rngFor(stream).next() < chance;
}

function applyOperation(before: unknown, operation: StateOperation, value: unknown): unknown {
  if (operation === "set") return value;
  if (typeof before !== "number" || typeof value !== "number") {
    throw new Error(`${operation} 연산은 숫자에만 쓸 수 있다`);
  }
  return operation === "add" ? before + value : before * value;
}

function modifyGlobal(ctx: RuleContext, stateKey: string, operation: StateOperation, value: unknown): void {
  const before = ctx.runtime.store.readGlobal(stateKey);
  ctx.runtime.store.setGlobal(stateKey, applyOperation(before, operation, value));
}

function createEntity(ctx: RuleContext, templateId: string, location: RuleTargetSelector): void {
  const template = (ctx.runtime.definition.entityTemplates ?? []).find((t) => t.id === templateId);
  if (template === undefined) throw new Error(`없는 개체 템플릿: ${templateId} (${ctx.rule.id})`);

  const anchor = resolveSingleTarget(ctx, location);
  const ownerType =
    template.type === "location"
      ? template.tags.includes("region")
        ? "region"
        : "location"
      : template.type;
  const states = ctx.runtime.schemas.defaultsFor(ownerType);
  for (const [key, value] of Object.entries(template.states)) {
    states[key] = ctx.runtime.schemas.coerce(ctx.runtime.schemas.require(ownerType, key), value);
  }

  const id = `${templateId}#${ctx.runtime.state.entitySeq++}`;
  const entity: EntityState = {
    id,
    type: template.type,
    states,
    tags: [...template.tags],
    ...(anchor?.position !== undefined ? { position: { ...anchor.position } } : {}),
  };
  ctx.runtime.store.insertEntity(entity);
  // 태어난 것도 주체다 — 목적 그래프를 가지고 있으면 판단 사이클에 들어온다 (§15 번식·성장)
  if (template.type === "agent") {
    ctx.runtime.state.agentRuntimes[id] = createAgentRuntimeState(id, {}, "individual");
  }
  ctx.runtime.store.noteChange({ entityId: id, stateKey: "exists", before: false, after: true });
}

function destroyEntities(ctx: RuleContext, targets: EntityState[]): void {
  for (const entity of targets) {
    ctx.runtime.store.noteChange({ entityId: entity.id, stateKey: "exists", before: true, after: false });
    delete ctx.runtime.state.agentRuntimes[entity.id];
    ctx.runtime.removeEntity(entity.id);
  }
}

/**
 * §11.3 transfer_resource — 잔량이 모자라면 **가능한 만큼만** 옮기고 부족분을 change 로그에 남긴다.
 * 자원 총량이 이동으로 늘거나 줄지 않는다는 것이 §14 자원 순환 폐쇄성의 최소 보증이다.
 */
function transferResource(
  ctx: RuleContext,
  effect: Extract<RuleEffect, { type: "transfer_resource" }>,
): void {
  const from = resolveSingleTarget(ctx, effect.from);
  const to = resolveSingleTarget(ctx, effect.to);
  if (from === undefined || to === undefined) return;
  const requested = resolveAmount(ctx, effect.amount, effect.amountRef);
  if (typeof requested !== "number" || requested <= 0) return;

  const fromKey = effect.fromStateKey ?? effect.resourceId;
  const toKey = effect.toStateKey ?? effect.resourceId;
  const available = ctx.runtime.store.readNumber(from.id, fromKey);
  const moved = Math.min(requested, Math.max(0, available));
  if (moved > 0) {
    ctx.runtime.store.modify(from.id, fromKey, "add", -moved);
    ctx.runtime.store.modify(to.id, toKey, "add", moved);
  }
  if (moved < requested) {
    ctx.runtime.store.noteChange({
      entityId: from.id,
      stateKey: `shortfall:${effect.resourceId}`,
      before: requested,
      after: requested - moved,
    });
  }
}

function modifyRelationship(
  ctx: RuleContext,
  effect: Extract<RuleEffect, { type: "modify_relationship" }>,
  hooks: EffectHooks,
): void {
  const from = resolveSingleTarget(ctx, effect.from);
  const to = resolveSingleTarget(ctx, effect.to);
  if (from === undefined || to === undefined) return;
  const value = resolveAmount(ctx, effect.value, effect.valueRef);
  if (!isRelationshipKey(effect.key)) {
    throw new Error(`알 수 없는 관계 항목: ${effect.key} (${ctx.rule.id}) — §25 RelationshipState 필드만 쓸 수 있다`);
  }

  const relation = ensureRelationship(ctx.runtime, from.id, to.id);
  const after = applyOperation(relation[effect.key], effect.operation, value);
  if (typeof after !== "number") throw new Error(`관계 수치가 숫자가 아니다: ${effect.key}`);
  const changed = applyRelationshipChange(ctx.runtime, from.id, to.id, effect.key, after);
  if (changed === undefined) return;

  // 관계가 크게 흔들리면 다시 판단할 이유가 된다 (§26 "관계가 크게 변화했다")
  if (Math.abs(changed.after - changed.before) >= 15) {
    const agent = ctx.runtime.state.agentRuntimes[from.id];
    if (agent !== undefined && !agent.flags.includes("relationship_shift")) {
      agent.flags.push("relationship_shift");
    }
  }
  hooks.onRelationshipChanged(ctx, effect.key, from.id, to.id);
}

function scheduleRule(
  ctx: RuleContext,
  effect: Extract<RuleEffect, { type: "schedule_rule" }>,
): void {
  const seq = ctx.runtime.state.ruleEventSeq++;
  ctx.runtime.scheduler.schedule({
    id: `scheduled.${effect.ruleId}.${seq}`,
    executeAt: ctx.runtime.state.simulationTime + Math.max(0, effect.delay),
    type: RULE_SCHEDULED_EVENT,
    targetIds: ctx.targetId === undefined ? [] : [ctx.targetId],
    payload: {
      ruleId: effect.ruleId,
      ...(ctx.actorId !== undefined ? { actorId: ctx.actorId } : {}),
      ...(ctx.targetId !== undefined ? { targetId: ctx.targetId } : {}),
    },
    priority: ctx.rule.priority,
  });
}

/** 대상이 여럿인 효과는 id 사전순으로 하나씩 — 각 대상은 `each` 로 바인딩된다 */
export function executeEffect(
  ctx: RuleContext,
  effect: RuleEffect,
  effectIndex: number,
  hooks: EffectHooks,
): void {
  const base: RuleContext = { ...ctx, effectIndex };

  switch (effect.type) {
    case "modify_state": {
      const targets = effect.target.type === "world" ? [undefined] : resolveTargets(base, effect.target);
      for (const entity of targets) {
        const scoped = withEach(base, entity?.id);
        if (effect.conditions !== undefined && !evaluateRuleConditions(effect.conditions, scoped)) continue;
        if (effect.chance !== undefined && !passesChance(scoped, effect.chance, entity?.id)) continue;
        const value = resolveAmount(scoped, effect.value, effect.valueRef);
        if (entity === undefined) modifyGlobal(scoped, effect.stateKey, effect.operation, value);
        else scoped.runtime.store.modify(entity.id, effect.stateKey, effect.operation, value);
      }
      return;
    }
    case "record_growth": {
      // 성장은 여기서 값을 바꾸지 않는다 — 출처 사건이 정해진 뒤에 확정된다 (§32 sourceEventId 필수)
      for (const entity of resolveTargets(base, effect.target)) {
        const scoped = withEach(base, entity.id);
        if (effect.conditions !== undefined && !evaluateRuleConditions(effect.conditions, scoped)) continue;
        if (effect.chance !== undefined && !passesChance(scoped, effect.chance, entity.id)) continue;
        const amount = resolveAmount(scoped, effect.amount, effect.amountRef);
        requestGrowth(scoped.runtime, {
          agentId: entity.id,
          ruleId: scoped.rule.id,
          type: effect.growthType,
          key: effect.key,
          amount: typeof amount === "number" ? amount : 0,
          options: effect.options ?? [],
        });
      }
      return;
    }
    case "destroy_entity": {
      const targets = resolveTargets(base, effect.target).filter((entity) => {
        const scoped = withEach(base, entity.id);
        if (effect.conditions !== undefined && !evaluateRuleConditions(effect.conditions, scoped)) return false;
        return effect.chance === undefined || passesChance(scoped, effect.chance, entity.id);
      });
      destroyEntities(base, targets);
      return;
    }
    default: {
      // 대상이 개체 목록이 아닌 효과 — 조건·확률은 규칙 맥락에서 한 번만 본다
      const scoped = withEach(base, base.eachId ?? base.targetId ?? base.actorId);
      if (effect.conditions !== undefined && !evaluateRuleConditions(effect.conditions, scoped)) return;
      if (effect.chance !== undefined && !passesChance(scoped, effect.chance, bindingEntityId(scoped, "each"))) {
        return;
      }
      switch (effect.type) {
        case "transfer_resource":
          transferResource(scoped, effect);
          return;
        case "create_entity":
          createEntity(scoped, effect.templateId, effect.location);
          return;
        case "emit_signal":
          emitRuleSignal(scoped, effect.signalId, effect.intensity);
          return;
        case "schedule_rule":
          scheduleRule(scoped, effect);
          return;
        case "modify_relationship":
          modifyRelationship(scoped, effect, hooks);
          return;
      }
    }
  }
}
