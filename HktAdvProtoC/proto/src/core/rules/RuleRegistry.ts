// 규칙 등록기와 트리거 디스패치 (기획서 §11.1, Phase-1 구현 스텝 4)
// Phase 1 의 규칙은 TS 함수지만 트리거 체계는 Phase 2 의 RuleDefinition 과 동일하다.
// 따라서 DSL 이관은 "run 함수를 conditions/effects 데이터로 바꾸는 것" 하나로 끝난다.
import type { ObservationEffect } from "../world/types";
import type { StateChangeSignal } from "../world/StateStore";
import type { WorldRuntime } from "../world/WorldRuntime";

export type RuleTrigger =
  | { type: "interval"; interval: number }
  | { type: "state_changed"; stateKey: string }
  | { type: "action_executed"; actionId: string };

export interface RuleContext {
  runtime: WorldRuntime;
  time: number;
  /** action_executed = 행동 주체, state_changed = 상태가 바뀐 개체 */
  subjectId?: string;
  /** action_executed 트리거를 발생시킨 행동 */
  actionId?: string;
  targetIds: string[];
  /** state_changed 트리거의 변경 내용 */
  change?: StateChangeSignal;
  /** 규칙 자신의 정의 — 선언된 관찰 효과(§11 observations)를 꺼내 쓴다 */
  rule: HandwrittenRule;
}

export interface HandwrittenRule {
  id: string;
  name: string;
  scope: "global" | "region" | "entity" | "relationship";
  priority: number;
  triggers: RuleTrigger[];
  /** §11 derivedFromAxioms — 어떤 세계 명제에서 나온 규칙인가 */
  derivedFromAxioms: string[];
  /** §11 observations — 이 규칙이 만들어 내는 관찰 신호 */
  observations?: ObservationEffect[];
  run: (ctx: RuleContext) => void;
}

function byPriority(a: HandwrittenRule, b: HandwrittenRule): number {
  return a.priority === b.priority ? a.id.localeCompare(b.id) : b.priority - a.priority;
}

export class RuleRegistry {
  private readonly byId = new Map<string, HandwrittenRule>();
  private readonly byStateKey = new Map<string, HandwrittenRule[]>();
  private readonly byActionId = new Map<string, HandwrittenRule[]>();
  readonly intervalRules: { rule: HandwrittenRule; interval: number }[] = [];

  constructor(rules: HandwrittenRule[]) {
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
        }
      }
    }
    for (const list of this.byStateKey.values()) list.sort(byPriority);
    for (const list of this.byActionId.values()) list.sort(byPriority);
    this.intervalRules.sort((a, b) => byPriority(a.rule, b.rule));
  }

  find(ruleId: string): HandwrittenRule | undefined {
    return this.byId.get(ruleId);
  }

  require(ruleId: string): HandwrittenRule {
    const rule = this.byId.get(ruleId);
    if (rule === undefined) throw new Error(`등록되지 않은 규칙: ${ruleId}`);
    return rule;
  }

  /** 어떤 행동이 실행됐을 때 도는 규칙들 — 콘텐츠 검증(executionRules 와의 1:1 대응)에도 쓴다 */
  rulesForAction(actionId: string): HandwrittenRule[] {
    return this.byActionId.get(actionId) ?? [];
  }

  // --- 디스패치 ---------------------------------------------------------------

  runInterval(runtime: WorldRuntime, ruleId: string): void {
    const rule = this.require(ruleId);
    this.execute(runtime, rule, { targetIds: [] });
  }

  dispatchStateChange(runtime: WorldRuntime, change: StateChangeSignal): void {
    for (const rule of this.byStateKey.get(change.stateKey) ?? []) {
      this.execute(runtime, rule, { subjectId: change.entityId, targetIds: [], change });
    }
  }

  dispatchAction(
    runtime: WorldRuntime,
    actionId: string,
    actorId: string,
    targetIds: string[],
  ): void {
    for (const rule of this.rulesForAction(actionId)) {
      this.execute(runtime, rule, { subjectId: actorId, actionId, targetIds });
    }
  }

  /** 규칙 실행은 항상 변경 맥락 안에서 — 어떤 규칙이 만든 변화인지 §28 로그에 남는다 */
  private execute(
    runtime: WorldRuntime,
    rule: HandwrittenRule,
    partial: {
      subjectId?: string;
      actionId?: string;
      targetIds: string[];
      change?: StateChangeSignal;
    },
  ): void {
    runtime.store.withContext(
      {
        ...(partial.subjectId !== undefined ? { sourceId: partial.subjectId } : {}),
        targetIds: partial.targetIds,
        tags: ["rule", rule.id],
      },
      () => {
        rule.run({
          runtime,
          time: runtime.state.simulationTime,
          ...(partial.subjectId !== undefined ? { subjectId: partial.subjectId } : {}),
          ...(partial.actionId !== undefined ? { actionId: partial.actionId } : {}),
          targetIds: partial.targetIds,
          ...(partial.change !== undefined ? { change: partial.change } : {}),
          rule,
        });
      },
    );
  }
}

function push(map: Map<string, HandwrittenRule[]>, key: string, rule: HandwrittenRule): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [rule]);
  else list.push(rule);
}
