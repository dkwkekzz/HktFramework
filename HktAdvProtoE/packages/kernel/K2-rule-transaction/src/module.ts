import { sha256Tagged } from '@hkt/v0-module-contract';
import type { ModuleContext, ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import {
  ComponentRegistry,
  EntityStore,
  applyOperations,
  type ComponentDefinition,
  type StoreOperation,
} from '@hkt/k0-entity-state';
import { RuleBook } from './rulebook.js';
import { runTransaction } from './transaction.js';
import type { Intent, RuleSpec, StateDelta, TransactionOutcome } from './types.js';

export interface K2World {
  components?: ComponentDefinition[];
  operations: StoreOperation[];
}

export interface K2Input {
  world: K2World;
  rules: RuleSpec[];
  /** 차례로 처리할 의도들 */
  intents: Intent[];
}

export interface K2Output {
  outcomes: TransactionOutcome[];
  /** 각 의도 직후의 세계 해시 — 거부된 의도 앞뒤로 값이 같아야 한다 */
  hashes: { intentId: string; before: string; after: string; changed: boolean }[];
  worldHashBefore: string;
  worldHashAfter: string;
  ruleBookHash: string;
  digest: string;
}

export const K2_VERSION = '0.1.0';

export const K2_PURPOSE =
  '행동 의도를 규칙의 조건·비용·효과에 따라 원자적으로 처리해, 성공이면 비용과 효과가 함께 적용되고 실패면 아무것도 적용되지 않게 한다.';

export function buildWorld(world: K2World): EntityStore {
  const registry = ComponentRegistry.of(world.components ?? []);
  return applyOperations(EntityStore.empty(registry), world.operations).store;
}

export function executeK2(input: K2Input): K2Output {
  const rules = RuleBook.of(input.rules);
  let store = buildWorld(input.world);
  const worldHashBefore = store.hash();

  const outcomes: TransactionOutcome[] = [];
  const hashes: K2Output['hashes'] = [];

  for (const intent of input.intents) {
    const before = store.hash();
    const result = runTransaction(store, rules, intent);
    store = result.store;
    const after = store.hash();
    outcomes.push(result.outcome);
    hashes.push({ intentId: intent.id, before, after, changed: before !== after });
  }

  const body = { outcomes, hashes };
  return {
    ...body,
    worldHashBefore,
    worldHashAfter: store.hash(),
    ruleBookHash: rules.hash(),
    digest: sha256Tagged(JSON.stringify(body)),
  };
}

export function createK2Module(
  scenarios: ModuleDefinition<K2Input, K2Output>['scenarios'],
): ModuleDefinition<K2Input, K2Output> {
  return {
    id: 'K2',
    version: K2_VERSION,
    purpose: K2_PURPOSE,
    dependencies: ['V0', 'K0', 'K1'],
    validateInput,
    execute: (input: K2Input, _context: ModuleContext) => executeK2(input),
    validateOutput,
    scenarios,
  };
}

export function validateInput(input: unknown): K2Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('K2 입력은 객체여야 한다.');
  }
  const value = input as Record<string, unknown>;
  const world = value['world'];
  if (world === null || typeof world !== 'object' || Array.isArray(world)) {
    throw new TypeError('`world` 는 객체여야 한다.');
  }
  if (!Array.isArray((world as { operations?: unknown }).operations)) {
    throw new TypeError('`world.operations` 는 배열이어야 한다.');
  }
  if (!Array.isArray(value['rules'])) throw new TypeError('`rules` 는 배열이어야 한다.');
  if (!Array.isArray(value['intents'])) throw new TypeError('`intents` 는 배열이어야 한다.');
  for (const [index, intent] of (value['intents'] as unknown[]).entries()) {
    if (intent === null || typeof intent !== 'object') {
      throw new TypeError(`intents[${index}] 는 객체여야 한다.`);
    }
    const record = intent as Record<string, unknown>;
    for (const key of ['id', 'actor', 'verb'] as const) {
      if (typeof record[key] !== 'string' || record[key] === '') {
        throw new TypeError(`intents[${index}].${key} 는 비어 있지 않은 문자열이어야 한다.`);
      }
    }
  }
  return input as K2Input;
}

/** MODULE.yaml 의 invariants 중 출력만 보고 판정할 수 있는 것들. */
export function validateOutput(output: K2Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `K2 출력/${path}`, message });
  };

  output.outcomes.forEach((outcome, index) => {
    const hash = output.hashes[index];
    const where = `outcomes/${index} (${outcome.intentId})`;

    if (!outcome.ok) {
      if (outcome.costDelta.length > 0 || outcome.effectDelta.length > 0) {
        at(
          where,
          'E_INVARIANT_rejected_intent_must_not_apply_costs_or_effects',
          `거부되었는데 비용 ${outcome.costDelta.length}건 · 효과 ${outcome.effectDelta.length}건이 적용되었다.`,
        );
      }
      if (outcome.rejection === null) {
        at(where, 'E_INVARIANT_rejected_intent_must_not_apply_costs_or_effects', '실패인데 거부 사유가 없다.');
      }
      if (outcome.appliedRuleId !== null) {
        at(where, 'E_INVARIANT_rejected_intent_must_not_apply_costs_or_effects', '실패인데 적용된 규칙이 있다.');
      }
      // 실패 효과를 선언하지 않은 규칙이 상태를 바꿨다면 원자성이 깨진 것이다.
      if (outcome.delta.length === 0 && hash?.changed === true) {
        at(
          where,
          'E_INVARIANT_failure_effect_must_be_declared_by_the_matched_rule',
          '델타가 비었는데 세계가 바뀌었다 — 기록 없는 상태 변경이다 (GI-01).',
        );
      }
    } else {
      if (outcome.rejection !== null) {
        at(where, 'E_INVARIANT_cost_and_effect_must_apply_together', '성공인데 거부 사유가 있다.');
      }
      if (outcome.appliedRuleId === null) {
        at(where, 'E_INVARIANT_cost_and_effect_must_apply_together', '성공인데 적용된 규칙이 없다.');
      }
      if (
        JSON.stringify(outcome.delta) !== JSON.stringify([...outcome.costDelta, ...outcome.effectDelta])
      ) {
        at(
          where,
          'E_INVARIANT_every_state_change_must_be_listed_in_the_delta',
          '델타가 비용+효과와 다르다 — 어딘가에 기록되지 않은 변화가 있다.',
        );
      }
      if (outcome.delta.length > 0 && hash?.changed === false) {
        at(
          where,
          'E_INVARIANT_every_state_change_must_be_listed_in_the_delta',
          '델타는 있는데 세계 해시가 그대로다.',
        );
      }
    }

    for (const change of outcome.delta) {
      if (change.path === '' || !change.path.startsWith('entity/')) {
        at(
          `${where}/delta`,
          'E_INVARIANT_every_state_change_must_be_listed_in_the_delta',
          `변화의 위치가 세계 좌표가 아니다: ${JSON.stringify(change.path)}`,
        );
      }
    }

    if (!isDeterministicOrder(outcome)) {
      at(where, 'E_INVARIANT_rule_matching_must_be_deterministic', '규칙 검토 순서가 권위 순서가 아니다.');
    }
  });

  return issues;
}

/** 규칙 검토 기록이 언제나 권위 순서(scope 오름차순 · priority 내림차순 · id 오름차순)인지. */
function isDeterministicOrder(outcome: TransactionOutcome): boolean {
  for (let index = 1; index < outcome.matches.length; index += 1) {
    const previous = outcome.matches[index - 1] as TransactionOutcome['matches'][number];
    const current = outcome.matches[index] as TransactionOutcome['matches'][number];
    if (previous.scope > current.scope) return false;
    if (previous.scope === current.scope) {
      if (previous.priority < current.priority) return false;
      if (previous.priority === current.priority && previous.ruleId > current.ruleId) return false;
    }
  }
  return true;
}

/** 자원 총량 — `transfer` 가 총량을 지키는지 보는 데 쓴다. */
export function totalOf(store: EntityStore, component: string, field: string): number {
  return store
    .withComponent(component)
    .reduce((sum, id) => {
      const value = (store.component(id, component) ?? {})[field];
      return typeof value === 'number' ? sum + value : sum;
    }, 0);
}

export type { StateDelta };
