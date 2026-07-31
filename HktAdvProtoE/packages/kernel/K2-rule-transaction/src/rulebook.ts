import { sha256Tagged } from '@hkt/v0-module-contract';
import { TransactionRejected } from './errors.js';
import { RULE_SCOPES, TRANSACTION_ISSUE, scopeRank, type RuleSpec } from './types.js';

/**
 * 규칙집 — K2 가 소유하는 유일한 상태.
 *
 * 규칙은 데이터이므로 규칙집도 데이터다. 순서를 **여기서 한 번** 고정한다 —
 * 선언 순서가 결과를 바꾸면 같은 세계가 서버마다 다르게 굴러간다(GI-12).
 *
 * ```text
 * 권위가 높은 것부터: scope 오름차순 (L0 → L6)
 * 같은 scope 안에서: priority 내림차순
 * 그래도 같으면: id 오름차순
 * ```
 */
export class RuleBook {
  readonly #rules: readonly RuleSpec[];

  private constructor(rules: readonly RuleSpec[]) {
    this.#rules = rules;
  }

  static of(rules: readonly RuleSpec[]): RuleBook {
    const seen = new Set<string>();
    for (const rule of rules) {
      if (typeof rule.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(rule.id)) {
        throw new TransactionRejected(
          TRANSACTION_ISSUE.BAD_RULE,
          `rule/${String(rule.id)}`,
          `규칙 id 는 소문자 snake_case 여야 한다: ${JSON.stringify(rule.id)}`,
        );
      }
      if (seen.has(rule.id)) {
        throw new TransactionRejected(TRANSACTION_ISSUE.BAD_RULE, `rule/${rule.id}`, `규칙 id 가 겹친다: ${rule.id}`);
      }
      seen.add(rule.id);
      if (!(RULE_SCOPES as readonly string[]).includes(rule.scope)) {
        throw new TransactionRejected(
          TRANSACTION_ISSUE.BAD_RULE,
          `rule/${rule.id}/scope`,
          `규칙 계층은 L0~L6 이어야 한다: ${JSON.stringify(rule.scope)}`,
        );
      }
      if (!Number.isFinite(rule.priority)) {
        throw new TransactionRejected(
          TRANSACTION_ISSUE.BAD_RULE,
          `rule/${rule.id}/priority`,
          `우선순위는 유한한 수여야 한다: ${rule.priority}`,
        );
      }
      for (const key of ['costs', 'effects', 'emits'] as const) {
        if (!Array.isArray(rule[key])) {
          throw new TransactionRejected(
            TRANSACTION_ISSUE.BAD_RULE,
            `rule/${rule.id}/${key}`,
            `\`${key}\` 는 배열이어야 한다 — 없으면 빈 배열로 적는다.`,
          );
        }
      }
      // 원본 15.3 이 규칙을 "임의 JavaScript 실행 코드가 아니라 데이터 AST" 로 못박는다.
      for (const [field, value] of Object.entries(rule)) {
        if (typeof value === 'function') {
          throw new TransactionRejected(
            TRANSACTION_ISSUE.BAD_RULE,
            `rule/${rule.id}/${field}`,
            '규칙에는 실행 코드를 넣을 수 없다 (원본 15.3 · 원문 「23」).',
          );
        }
      }
    }

    return new RuleBook(
      [...rules].sort((a, b) => {
        const byScope = scopeRank(a.scope) - scopeRank(b.scope);
        if (byScope !== 0) return byScope;
        const byPriority = b.priority - a.priority;
        if (byPriority !== 0) return byPriority;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      }),
    );
  }

  /** 권위 순서로 고정된 목록. */
  all(): readonly RuleSpec[] {
    return this.#rules;
  }

  get(id: string): RuleSpec | null {
    return this.#rules.find((rule) => rule.id === id) ?? null;
  }

  get size(): number {
    return this.#rules.length;
  }

  /** 같은 규칙집이면 같은 해시. 선언 순서에 매달리지 않는다. */
  hash(): string {
    return sha256Tagged(JSON.stringify(this.#rules));
  }
}
