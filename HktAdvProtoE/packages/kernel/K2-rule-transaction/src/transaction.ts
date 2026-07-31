import { EntityStore } from '@hkt/k0-entity-state';
import type { ComponentRegistry, JsonValue } from '@hkt/k0-entity-state';
import { evaluate, type BindingTable, type PredicateCause } from '@hkt/k1-predicate-query';
import { applyEffects } from './effects.js';
import { TransactionRejected } from './errors.js';
import type { RuleBook } from './rulebook.js';
import {
  TRANSACTION_ISSUE,
  scopeRank,
  type Intent,
  type RuleMatch,
  type RuleSpec,
  type StateDelta,
  type TransactionOutcome,
} from './types.js';

/**
 * 의도를 담아 두는 임시 실체.
 *
 * 규칙의 `when` 은 `PredicateSpec` 이고, `PredicateSpec` 은 **세계 상태에 대한 조건**이다.
 * 그런데 "이 의도가 공격인가"는 세계 어디에도 없다. 규칙 AST 에 `verb` 칸을 새로 파면
 * 상위 계약(원본 15.3)을 바꾸는 일이 되므로, 반대로 **의도를 세계에 잠깐 올린다.**
 *
 * ```text
 * when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'attack' }
 * ```
 *
 * 원본 19.4 의 사건 해결도 "제출된 Intent" 를 세계의 일부로 다룬다. 임시 실체는 트랜잭션이
 * 끝나기 전에 반드시 지운다 — 남으면 세계 해시가 흔들려 재생이 깨진다.
 */
export const INTENT_COMPONENT = 'intent_spec';
export const INTENT_BINDING = 'intent';
const INTENT_ENTITY_ID = 'transient_intent';

const INTENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verb', 'actor'],
  properties: {
    verb: { type: 'string', minLength: 1 },
    actor: { type: 'string' },
    targets: { type: 'array', items: { type: 'string' } },
  },
} as const;

export interface TransactionResult {
  /** 트랜잭션 뒤의 세계. 거부되었고 실패 효과도 없다면 **입력과 같은 객체**다. */
  store: EntityStore;
  outcome: TransactionOutcome;
}

/**
 * 의도 하나를 규칙에 따라 원자적으로 처리한다 (원문 「9」 K2).
 *
 * ```text
 * Intent → Rule 조건·비용 검사 → StateDelta
 * ```
 *
 * 원자성은 예외 처리 규약이 아니라 **K0 의 불변 저장소**가 보장한다. 작업용 저장소를 그냥 버리면
 * 원본이 그대로 남으므로, "절반만 적용" 이라는 상태가 존재할 수 없다.
 */
export function runTransaction(store: EntityStore, rules: RuleBook, intent: Intent): TransactionResult {
  const matches: RuleMatch[] = [];

  const fail = (rejection: TransactionRejected, rule: RuleSpec | null): TransactionResult => {
    // 규칙이 실패 효과를 선언했다면 그것만 적용한다. 선언하지 않았으면 세계는 한 글자도 바뀌지 않는다.
    const failure =
      rule?.failureEffects && rule.failureEffects.length > 0
        ? applyEffects(store, rule.failureEffects, bindingsFor(intent, null), {
            at: `rule/${rule.id}/failureEffects`,
          })
        : null;
    return {
      store: failure?.store ?? store,
      outcome: {
        intentId: intent.id,
        ok: false,
        appliedRuleId: null,
        matches,
        costDelta: [],
        effectDelta: [],
        delta: failure?.delta ?? [],
        emitted: [],
        scheduled: failure?.scheduled ?? [],
        rejection: rejection.toRejection(),
      },
    };
  };

  if (!store.has(intent.actor)) {
    return fail(
      new TransactionRejected(
        TRANSACTION_ISSUE.UNKNOWN_ACTOR,
        `intent/${intent.id}/actor`,
        `행위자가 세계에 없다: ${intent.actor}`,
      ),
      null,
    );
  }

  // 의도를 세계에 잠깐 올린다.
  const scratch = withIntent(store, intent);
  const bindings = bindingsFor(intent, INTENT_ENTITY_ID);

  // ── 1. 규칙 대조 ──────────────────────────────────────────────────────────
  for (const rule of rules.all()) {
    let matched = false;
    let allowed: boolean | null = null;
    let causes: PredicateCause[] = [];
    try {
      const when = evaluate(scratch, rule.when, bindings, `rule/${rule.id}/when`);
      matched = when.passed;
      if (matched && rule.requires !== undefined) {
        const requires = evaluate(scratch, rule.requires, bindings, `rule/${rule.id}/requires`);
        allowed = requires.passed;
        causes = requires.causes;
      } else if (matched) {
        allowed = true;
      }
    } catch (error) {
      // 조건식 자체가 잘못된 규칙은 조용히 넘어가지 않는다.
      return fail(
        new TransactionRejected(
          TRANSACTION_ISSUE.BAD_RULE,
          `rule/${rule.id}`,
          `규칙의 조건식이 잘못되었다: ${(error as Error).message}`,
        ),
        null,
      );
    }
    matches.push({ ruleId: rule.id, scope: rule.scope, priority: rule.priority, matched, allowed, causes });
  }

  const matchedRules = rules.all().filter((rule) => matches.find((entry) => entry.ruleId === rule.id)?.matched === true);
  if (matchedRules.length === 0) {
    return fail(
      new TransactionRejected(
        TRANSACTION_ISSUE.NO_RULE,
        `intent/${intent.id}/verb`,
        `이 의도를 다루는 규칙이 없다: ${intent.verb}`,
      ),
      null,
    );
  }

  // ── 2. 규칙 선택 — 가장 국소적인(scope 번호가 큰) 예외를 고른다 ──────────────
  //
  // 비용도 효과도 흔적도 없는 규칙은 **제약 규칙**이다. 그런 규칙은 "행동을 수행하는" 규칙이 아니라
  // 선을 긋는 규칙이므로, 골라서 적용해서는 안 된다 — 그러면 아무 일도 하지 않는 성공이 나온다.
  const actionable = matchedRules.filter((rule) => !isConstraint(rule));
  const allowedRules = actionable.filter(
    (rule) => matches.find((entry) => entry.ruleId === rule.id)?.allowed === true,
  );
  const chosen = allowedRules.reduce<RuleSpec | null>((best, rule) => {
    if (!best) return rule;
    const byScope = scopeRank(rule.scope) - scopeRank(best.scope);
    if (byScope !== 0) return byScope > 0 ? rule : best;
    if (rule.priority !== best.priority) return rule.priority > best.priority ? rule : best;
    return rule.id < best.id ? rule : best;
  }, null);

  // ── 3. 조건이 어긋난 규칙이 막고 있으면 행동은 성립하지 않는다 ────────────────
  //
  // 원본 15.1: "낮은 단계의 규칙은 높은 단계의 규칙이 허용하는 범위 안에서만 예외를 만들 수 있다."
  //
  // | 막는 규칙 | 언제 막는가 |
  // |---|---|
  // | 제약 규칙 (비용·효과·흔적이 없는 규칙) | 계층과 무관하게 언제나 — 선을 긋는 것이 그 규칙의 전부다 |
  // | 행동 규칙 | 고른 규칙보다 권위가 높을 때(scope 번호가 작을 때), 또는 고를 것이 없을 때 |
  const blocker = matchedRules.find((rule) => {
    const entry = matches.find((match) => match.ruleId === rule.id);
    if (entry?.allowed !== false) return false;
    if (isConstraint(rule)) return true;
    return chosen === null || scopeRank(rule.scope) < scopeRank(chosen.scope);
  });

  if (blocker) {
    const entry = matches.find((match) => match.ruleId === blocker.id);
    return fail(
      new TransactionRejected(
        chosen === null ? TRANSACTION_ISSUE.REQUIRES_UNMET : TRANSACTION_ISSUE.FORBIDDEN,
        `rule/${blocker.id}/requires`,
        chosen === null
          ? `\`${blocker.id}\` 의 조건이 어긋났다.`
          : `\`${blocker.id}\`(${blocker.scope}) 가 허용하는 범위 밖이라 \`${chosen.id}\`(${chosen.scope}) 의 예외가 성립하지 않는다.`,
        entry?.causes ?? [],
      ),
      blocker,
    );
  }

  if (!chosen) {
    return fail(
      new TransactionRejected(
        TRANSACTION_ISSUE.NO_RULE,
        `intent/${intent.id}/verb`,
        `이 의도를 실제로 수행하는 규칙이 없다 — 선을 긋는 제약 규칙만 맞았다: ${intent.verb}`,
      ),
      null,
    );
  }

  // ── 4. 비용 → 효과. 하나라도 어긋나면 작업용 저장소를 버린다 ─────────────────
  try {
    const paid = applyEffects(scratch, chosen.costs, bindings, { at: `rule/${chosen.id}/costs` });
    const done = applyEffects(paid.store, chosen.effects, bindings, { at: `rule/${chosen.id}/effects` });

    const delta: StateDelta[] = [...paid.delta, ...done.delta];
    return {
      store: withoutIntent(done.store),
      outcome: {
        intentId: intent.id,
        ok: true,
        appliedRuleId: chosen.id,
        matches,
        costDelta: paid.delta,
        effectDelta: done.delta,
        delta,
        emitted: chosen.emits.map((phenomenon) => ({ ...phenomenon })),
        scheduled: [...paid.scheduled, ...done.scheduled],
        rejection: null,
      },
    };
  } catch (error) {
    if (!(error instanceof TransactionRejected)) throw error;
    return fail(error, chosen);
  }
}

// ---------------------------------------------------------------------------

/** 비용도 효과도 흔적도 없는 규칙 — 행동을 수행하지 않고 선만 긋는다. */
function isConstraint(rule: RuleSpec): boolean {
  return rule.costs.length === 0 && rule.effects.length === 0 && rule.emits.length === 0;
}

function withIntent(store: EntityStore, intent: Intent): EntityStore {
  const registry: ComponentRegistry = store.registry.has(INTENT_COMPONENT)
    ? store.registry
    : store.registry.extend([{ type: INTENT_COMPONENT, title: '의도', schema: INTENT_SCHEMA }]);

  // 레지스트리를 넓힌 저장소는 스냅샷에서 다시 세운다 — K0 은 불변이라 레지스트리만 갈아 끼울 수 없다.
  const widened = store.registry.has(INTENT_COMPONENT) ? store : EntityStore.restore(store.snapshot(), registry);
  return widened.spawn({
    id: INTENT_ENTITY_ID,
    kind: 'intent',
    tags: ['transient'],
    components: {
      [INTENT_COMPONENT]: {
        verb: intent.verb,
        actor: intent.actor,
        targets: [...(intent.targets ?? [])],
      } as unknown as Record<string, JsonValue>,
    },
  });
}

function withoutIntent(store: EntityStore): EntityStore {
  return store.has(INTENT_ENTITY_ID) ? store.despawn(INTENT_ENTITY_ID) : store;
}

function bindingsFor(intent: Intent, intentEntityId: string | null): BindingTable {
  const table: Record<string, string> = {
    actor: intent.actor,
    ...(intent.bindings ?? {}),
  };
  (intent.targets ?? []).forEach((id, index) => {
    if (index === 0) table['target'] = id;
    table[`target_${index}`] = id;
  });
  if (intentEntityId !== null) table[INTENT_BINDING] = intentEntityId;
  return table;
}
