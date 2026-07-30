import { sha256Tagged } from '@hkt/v0-module-contract';
import type { ModuleContext, ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import {
  ComponentRegistry,
  EntityStore,
  applyOperations,
  type ComponentDefinition,
  type StoreOperation,
} from '@hkt/k0-entity-state';
import { QueryRejection } from './errors.js';
import { evaluate } from './evaluate.js';
import { runQuery, runQueryByFullScan } from './plan.js';
import type {
  BindingTable,
  PredicateCause,
  PredicateSpec,
  QueryReport,
  QuerySpec,
} from './types.js';

export interface K1World {
  components?: ComponentDefinition[];
  operations: StoreOperation[];
}

export interface K1Input {
  world: K1World;
  /** 대상 목록을 뽑는 질의 */
  queries?: { id: string; spec: QuerySpec }[];
  /** 참·거짓 하나만 묻는 조건 검사 */
  checks?: { id: string; predicate: PredicateSpec; bindings?: BindingTable }[];
}

export interface K1QueryResult {
  id: string;
  report: QueryReport | null;
  /** 계획을 쓰지 않고 전수로 훑은 답. `report.matched` 와 같아야 한다. */
  fullScan: string[] | null;
  rejection: { code: string; path: string; message: string } | null;
}

export interface K1CheckResult {
  id: string;
  passed: boolean;
  causes: PredicateCause[];
  rejection: { code: string; path: string; message: string } | null;
}

export interface K1Output {
  queries: K1QueryResult[];
  checks: K1CheckResult[];
  /** 질의 전후의 세계 해시 — 질의는 세계를 바꾸지 않는다 */
  worldHashBefore: string;
  worldHashAfter: string;
  digest: string;
}

export const K1_VERSION = '0.1.0';

export const K1_PURPOSE =
  '세계 상태를 데이터로 적힌 조건식으로 질의해, 참·거짓과 대상 목록과 조건이 어긋난 위치를 함께 돌려준다.';

export function buildWorld(world: K1World): EntityStore {
  const registry = ComponentRegistry.of(world.components ?? []);
  return applyOperations(EntityStore.empty(registry), world.operations).store;
}

export function executeK1(input: K1Input): K1Output {
  const store = buildWorld(input.world);
  const worldHashBefore = store.hash();

  const queries: K1QueryResult[] = (input.queries ?? []).map((entry) => {
    try {
      return {
        id: entry.id,
        report: runQuery(store, entry.spec),
        fullScan: runQueryByFullScan(store, entry.spec),
        rejection: null,
      };
    } catch (error) {
      if (!(error instanceof QueryRejection)) throw error;
      return { id: entry.id, report: null, fullScan: null, rejection: error.toIssue() };
    }
  });

  const checks: K1CheckResult[] = (input.checks ?? []).map((entry) => {
    try {
      const result = evaluate(store, entry.predicate, entry.bindings ?? {}, `checks/${entry.id}`);
      return { id: entry.id, passed: result.passed, causes: result.causes, rejection: null };
    } catch (error) {
      if (!(error instanceof QueryRejection)) throw error;
      return { id: entry.id, passed: false, causes: [], rejection: error.toIssue() };
    }
  });

  const body = { queries, checks };
  return {
    ...body,
    worldHashBefore,
    worldHashAfter: store.hash(),
    digest: sha256Tagged(JSON.stringify(body)),
  };
}

export function createK1Module(
  scenarios: ModuleDefinition<K1Input, K1Output>['scenarios'],
): ModuleDefinition<K1Input, K1Output> {
  return {
    id: 'K1',
    version: K1_VERSION,
    purpose: K1_PURPOSE,
    dependencies: ['V0', 'K0'],
    validateInput,
    execute: (input: K1Input, _context: ModuleContext) => executeK1(input),
    validateOutput,
    scenarios,
  };
}

export function validateInput(input: unknown): K1Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('K1 입력은 객체여야 한다.');
  }
  const value = input as Record<string, unknown>;
  const world = value['world'];
  if (world === null || typeof world !== 'object' || Array.isArray(world)) {
    throw new TypeError('`world` 는 객체여야 한다.');
  }
  if (!Array.isArray((world as { operations?: unknown }).operations)) {
    throw new TypeError('`world.operations` 는 배열이어야 한다.');
  }
  for (const key of ['queries', 'checks'] as const) {
    const list = value[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) throw new TypeError(`\`${key}\` 는 배열이어야 한다.`);
    for (const [index, entry] of list.entries()) {
      if (entry === null || typeof entry !== 'object') {
        throw new TypeError(`${key}[${index}] 는 객체여야 한다.`);
      }
      if (typeof (entry as { id?: unknown }).id !== 'string') {
        throw new TypeError(`${key}[${index}].id 는 문자열이어야 한다.`);
      }
    }
  }
  return input as K1Input;
}

/** MODULE.yaml 의 invariants 중 출력만 보고 판정할 수 있는 것들. */
export function validateOutput(output: K1Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `K1 출력/${path}`, message });
  };

  if (output.worldHashBefore !== output.worldHashAfter) {
    at(
      'worldHash',
      'E_INVARIANT_query_must_not_change_world_state',
      `질의 전후의 세계가 다르다: ${output.worldHashBefore} → ${output.worldHashAfter}`,
    );
  }

  for (const query of output.queries) {
    if (query.rejection) {
      if (query.report !== null) {
        at(`queries/${query.id}`, 'E_INVARIANT_planned_result_must_equal_full_scan', '거부되었는데 보고가 있다.');
      }
      continue;
    }
    const report = query.report;
    if (!report) {
      at(`queries/${query.id}`, 'E_INVARIANT_planned_result_must_equal_full_scan', '보고도 거부도 없다.');
      continue;
    }
    if (JSON.stringify(report.matched) !== JSON.stringify([...report.matched].sort())) {
      at(
        `queries/${query.id}/matched`,
        'E_INVARIANT_result_must_be_ordered_by_entity_id',
        `오름차순이 아니다: ${report.matched.join(', ')}`,
      );
    }
    if (JSON.stringify(report.matched) !== JSON.stringify(query.fullScan)) {
      at(
        `queries/${query.id}/matched`,
        'E_INVARIANT_planned_result_must_equal_full_scan',
        `계획 ${JSON.stringify(report.matched)} · 전수 ${JSON.stringify(query.fullScan)}`,
      );
    }
    if (report.plan.scanned > report.plan.total) {
      at(
        `queries/${query.id}/plan`,
        'E_INVARIANT_planned_result_must_equal_full_scan',
        `훑은 수 ${report.plan.scanned} 가 세계 전체 ${report.plan.total} 보다 많다.`,
      );
    }
    for (const candidate of report.candidates) {
      if (candidate.passed && candidate.causes.length > 0) {
        at(
          `queries/${query.id}/candidates/${candidate.id}`,
          'E_INVARIANT_failure_cause_must_point_at_the_failing_condition',
          '통과했는데 실패 원인이 붙어 있다.',
        );
      }
      if (!candidate.passed && candidate.causes.length === 0) {
        at(
          `queries/${query.id}/candidates/${candidate.id}`,
          'E_INVARIANT_failure_cause_must_point_at_the_failing_condition',
          '떨어졌는데 원인이 없다 — 왜 빠졌는지 짚을 수 없다.',
        );
      }
      for (const cause of candidate.causes) {
        if (cause.at === '' || cause.reason === '') {
          at(
            `queries/${query.id}/candidates/${candidate.id}`,
            'E_INVARIANT_failure_cause_must_point_at_the_failing_condition',
            '원인에 위치나 이유가 없다.',
          );
        }
      }
    }
  }

  for (const check of output.checks) {
    if (check.passed && check.causes.length > 0) {
      at(
        `checks/${check.id}`,
        'E_INVARIANT_failure_cause_must_point_at_the_failing_condition',
        '참인데 실패 원인이 붙어 있다.',
      );
    }
    if (!check.passed && check.causes.length === 0 && check.rejection === null) {
      at(
        `checks/${check.id}`,
        'E_INVARIANT_failure_cause_must_point_at_the_failing_condition',
        '거짓인데 원인도 거부도 없다.',
      );
    }
  }

  return issues;
}
