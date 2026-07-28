// 규칙 실행기 (기획서 §11.1 트리거 색인 · §11 실행 파이프라인 / Phase-2 §2.2)
//
// 발화된 규칙은 즉시 재귀 실행하지 않고 **규칙 큐**에 쌓아 순차 실행한다.
// 한 번의 발화(트리거 하나)로 여러 규칙이 걸리면 그 묶음을 (priority desc, ruleId asc) 로 정렬해 넣는다.
// 규칙 효과가 다시 트리거를 발화하면 같은 큐 뒤에 깊이+1 로 붙고, 상한(기본 16)을 넘으면 실행하지 않고 보고한다.
import type { StateChangeSignal } from "../world/StateStore";
import type { WorldRuntime } from "../world/WorldRuntime";
import { createRuleContext, evaluateRuleConditions, type RuleContext } from "./ConditionEvaluator";
import { executeEffect, type EffectHooks } from "./EffectExecutor";
import { emitObservation } from "./ObservationEmitter";
import type { RuleDefinition } from "./RuleTypes";
import { resolveTargets } from "./TargetSelector";

/** tick 당 규칙 연쇄 깊이 상한 — §34 "무한 순환" 의 런타임 방어선 */
export const DEFAULT_MAX_CASCADE_DEPTH = 16;

interface FiringContext {
  actorId?: string;
  targetId?: string;
  actionId?: string;
  targetIds: string[];
  payload?: Record<string, unknown>;
}

interface QueuedFiring {
  rule: RuleDefinition;
  firing: FiringContext;
  depth: number;
}

function byPriority(a: RuleDefinition, b: RuleDefinition): number {
  return a.priority === b.priority ? a.id.localeCompare(b.id) : b.priority - a.priority;
}

function push(map: Map<string, RuleDefinition[]>, key: string, rule: RuleDefinition): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [rule]);
  else list.push(rule);
}

export class RuleEngine implements EffectHooks {
  private readonly byId = new Map<string, RuleDefinition>();
  private readonly byStateKey = new Map<string, RuleDefinition[]>();
  private readonly byActionId = new Map<string, RuleDefinition[]>();
  private readonly byLocationTag = new Map<string, RuleDefinition[]>();
  private readonly byRelationshipKey = new Map<string, RuleDefinition[]>();
  readonly intervalRules: { rule: RuleDefinition; interval: number }[] = [];

  private readonly queue: QueuedFiring[] = [];
  private draining = false;
  private currentDepth = 0;

  /** 연쇄 상한 초과 등 실행 중 감지한 문제 — verify/테스트가 그대로 읽어 보고한다 */
  readonly diagnostics: string[] = [];

  constructor(
    rules: RuleDefinition[],
    readonly maxCascadeDepth: number = DEFAULT_MAX_CASCADE_DEPTH,
  ) {
    for (const rule of rules) {
      if (this.byId.has(rule.id)) throw new Error(`규칙 중복 등록: ${rule.id}`);
      this.byId.set(rule.id, rule);
      for (const trigger of rule.triggers) {
        switch (trigger.type) {
          case "interval":
            this.intervalRules.push({ rule, interval: trigger.interval });
            break;
          case "state_changed":
            push(this.byStateKey, trigger.stateKey, rule);
            break;
          case "action_executed":
            push(this.byActionId, trigger.actionId, rule);
            break;
          case "entity_entered":
            push(this.byLocationTag, trigger.locationTag, rule);
            break;
          case "relationship_changed":
            push(this.byRelationshipKey, trigger.relationshipKey, rule);
            break;
        }
      }
    }
    for (const list of this.byStateKey.values()) list.sort(byPriority);
    for (const list of this.byActionId.values()) list.sort(byPriority);
    for (const list of this.byLocationTag.values()) list.sort(byPriority);
    for (const list of this.byRelationshipKey.values()) list.sort(byPriority);
    this.intervalRules.sort((a, b) => byPriority(a.rule, b.rule));
  }

  all(): RuleDefinition[] {
    return [...this.byId.values()];
  }

  find(ruleId: string): RuleDefinition | undefined {
    return this.byId.get(ruleId);
  }

  require(ruleId: string): RuleDefinition {
    const rule = this.byId.get(ruleId);
    if (rule === undefined) throw new Error(`등록되지 않은 규칙: ${ruleId}`);
    return rule;
  }

  /** 어떤 행동이 실행됐을 때 도는 규칙들 — 콘텐츠 검증(executionRules 와의 1:1 대응)에도 쓴다 */
  rulesForAction(actionId: string): RuleDefinition[] {
    return this.byActionId.get(actionId) ?? [];
  }

  // --- 디스패치 ---------------------------------------------------------------

  runInterval(runtime: WorldRuntime, ruleId: string): void {
    this.fire(runtime, [this.require(ruleId)], { targetIds: [] });
  }

  /** schedule_rule(§11.3) 로 예약된 실행 */
  runScheduled(
    runtime: WorldRuntime,
    ruleId: string,
    actorId: string | undefined,
    targetId: string | undefined,
  ): void {
    this.fire(runtime, [this.require(ruleId)], {
      ...(actorId !== undefined ? { actorId } : {}),
      ...(targetId !== undefined ? { targetId } : {}),
      targetIds: targetId === undefined ? [] : [targetId],
    });
  }

  dispatchStateChange(runtime: WorldRuntime, change: StateChangeSignal): void {
    const rules = this.byStateKey.get(change.stateKey);
    if (rules === undefined) return;
    this.fire(runtime, rules, {
      actorId: change.entityId,
      targetIds: [],
      payload: { stateKey: change.stateKey, before: change.before, after: change.after },
    });
  }

  dispatchAction(
    runtime: WorldRuntime,
    actionId: string,
    actorId: string,
    targetIds: string[],
  ): void {
    const rules = this.rulesForAction(actionId);
    if (rules.length === 0) return;
    this.fire(runtime, rules, {
      actorId,
      actionId,
      ...(targetIds[0] !== undefined ? { targetId: targetIds[0] } : {}),
      targetIds,
    });
  }

  /** §11.1 entity_entered — 이동 완료로 개체가 새 지역에 들어섰을 때 (Phase-2 §2.2) */
  dispatchEntityEntered(runtime: WorldRuntime, entityId: string, locationTags: string[]): void {
    for (const tag of locationTags) {
      const rules = this.byLocationTag.get(tag);
      if (rules === undefined) continue;
      this.fire(runtime, rules, { actorId: entityId, targetIds: [], payload: { locationTag: tag } });
    }
  }

  /** §11.1 relationship_changed — modify_relationship 효과가 부른다 (Phase 3 이 관계 저장소로 확장) */
  onRelationshipChanged(ctx: RuleContext, key: string, fromId: string, toId: string): void {
    const rules = this.byRelationshipKey.get(key);
    if (rules === undefined) return;
    this.fire(ctx.runtime, rules, {
      actorId: fromId,
      targetId: toId,
      targetIds: [toId],
      payload: { relationshipKey: key },
    });
  }

  /**
   * §26 processChangedStateRules — 상태 변화가 더 나오지 않을 때까지 돌린다.
   * 상한에 도달했는데도 처리할 변화가 남아 있으면 폭주로 보고 보고한다.
   */
  drainStateChanges(runtime: WorldRuntime): number {
    let rounds = 0;
    for (; rounds < this.maxCascadeDepth; rounds++) {
      const changes = runtime.store.takeStateChanges();
      if (changes.length === 0) return rounds;
      for (const change of changes) this.dispatchStateChange(runtime, change);
    }
    if (runtime.store.pendingStateChangeCount() > 0) {
      this.report(
        `state_changed 연쇄가 상한 ${this.maxCascadeDepth} 회를 넘었다 (t=${runtime.state.simulationTime}) — 남은 변화 ${runtime.store.pendingStateChangeCount()}건`,
      );
    }
    return rounds;
  }

  // --- 규칙 큐 -----------------------------------------------------------------

  private fire(runtime: WorldRuntime, rules: RuleDefinition[], firing: FiringContext): void {
    const depth = this.draining ? this.currentDepth + 1 : 0;
    const batch = [...rules].sort(byPriority);
    for (const rule of batch) this.queue.push({ rule, firing, depth });
    this.drain(runtime);
  }

  private drain(runtime: WorldRuntime): void {
    if (this.draining) return; // 상위 drain 이 이미 돌고 있다 — 큐에 붙은 것은 그 루프가 가져간다
    this.draining = true;
    try {
      for (;;) {
        const item = this.queue.shift();
        if (item === undefined) break;
        if (item.depth >= this.maxCascadeDepth) {
          this.report(
            `규칙 연쇄가 상한 ${this.maxCascadeDepth} 을 넘어 ${item.rule.id} 실행을 중단했다 (t=${runtime.state.simulationTime})`,
          );
          continue;
        }
        this.currentDepth = item.depth;
        this.execute(runtime, item.rule, item.firing);
      }
    } finally {
      this.draining = false;
      this.currentDepth = 0;
    }
  }

  private report(message: string): void {
    if (!this.diagnostics.includes(message)) this.diagnostics.push(message);
  }

  // --- 규칙 한 벌 실행 ----------------------------------------------------------

  private cooldownKey(rule: RuleDefinition, firing: FiringContext): string {
    if (rule.scope === "global" || rule.scope === "region") return rule.id;
    return `${rule.id}|${firing.actorId ?? firing.targetId ?? "*"}`;
  }

  /** 규칙 실행은 항상 변경 맥락 안에서 — 어떤 규칙이 만든 변화인지 §28 로그에 남는다 */
  private execute(runtime: WorldRuntime, rule: RuleDefinition, firing: FiringContext): void {
    const now = runtime.state.simulationTime;
    const cooldownKey = this.cooldownKey(rule, firing);
    if (rule.cooldown !== undefined) {
      const last = runtime.state.ruleCooldowns[cooldownKey];
      if (last !== undefined && now - last < rule.cooldown) return;
    }

    let fired = false;
    runtime.store.withContext(
      {
        ...(firing.actorId !== undefined ? { sourceId: firing.actorId } : {}),
        targetIds: firing.targetIds,
        // §28 태그 전파 — 규칙이 선언한 tags 가 사건 패턴의 재료가 된다 (Phase-4 §4.1)
        tags: ["rule", rule.id, ...(rule.tags ?? [])],
      },
      () => {
        const base = createRuleContext(runtime, rule, {
          ...(firing.actorId !== undefined ? { actorId: firing.actorId } : {}),
          ...(firing.targetId !== undefined ? { targetId: firing.targetId } : {}),
          ...(firing.actionId !== undefined ? { actionId: firing.actionId } : {}),
          ...(firing.payload !== undefined ? { payload: firing.payload }: {}),
        });

        // forEach 가 있으면 개체마다 한 벌씩 — 바인딩은 개체마다 새로 계산된다
        const items =
          rule.forEach === undefined
            ? [firing.targetId]
            : resolveTargets(base, rule.forEach).map((entity) => entity.id);

        for (const itemId of items) {
          const ctx = createRuleContext(runtime, rule, {
            ...(firing.actorId !== undefined ? { actorId: firing.actorId } : {}),
            ...(itemId !== undefined ? { targetId: itemId } : {}),
            ...(firing.actionId !== undefined ? { actionId: firing.actionId } : {}),
            ...(firing.payload !== undefined ? { payload: firing.payload } : {}),
          });
          ctx.eachId = itemId ?? firing.actorId;
          if (!evaluateRuleConditions(rule.conditions, ctx)) continue;
          fired = true;
          for (let i = 0; i < rule.effects.length; i++) {
            executeEffect(ctx, rule.effects[i]!, i, this);
          }
          // §11 observations — 규칙이 발동하면 선언한 관찰 신호도 함께 나간다.
          // (행동이 선언한 신호(§21 visibleSignals)는 emit_signal 효과로 꺼내 쓴다)
          for (const observation of rule.observations) emitObservation(ctx, observation);
        }
      },
    );

    if (fired && rule.cooldown !== undefined) runtime.state.ruleCooldowns[cooldownKey] = now;
  }
}
