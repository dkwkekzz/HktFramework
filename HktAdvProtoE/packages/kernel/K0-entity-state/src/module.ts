import type { ModuleContext, ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import { sha256Tagged } from '@hkt/v0-module-contract';
import { canonicalJson } from '@hkt/v1-schema';
import { ComponentRegistry } from './components.js';
import { applyOperations, type AppliedOperation } from './operations.js';
import { EntityStore } from './store.js';
import type {
  ComponentDefinition,
  ComponentSnapshot,
  EntityId,
  EntityState,
  JsonValue,
  StoreOperation,
} from './types.js';

export interface K0Input {
  /** 저장소가 담을 수 있는 컴포넌트 종류 선언 */
  components?: ComponentDefinition[];
  /** 데이터로 적힌 상태 변경 요청 */
  operations: StoreOperation[];
  /** 실행 후 따로 꺼내 볼 실체 id */
  reads?: EntityId[];
}

export interface K0Output {
  applied: number;
  rejected: number;
  log: AppliedOperation[];
  reads: { id: EntityId; state: EntityState | null }[];
  snapshot: ComponentSnapshot;
  /** 저장소 스스로에 대한 감사 결과 (인덱스 정합 · GI-11) */
  audit: VerificationIssue[];
}

export const K0_VERSION = '0.1.0';

export const K0_PURPOSE =
  '세계의 모든 실체와 상태를 고유 ID로 저장하고, 다른 모듈이 내부 저장소를 직접 고칠 수 없게 읽기 전용 사본으로만 내보낸다.';

export function executeK0(input: K0Input): K0Output {
  const registry = ComponentRegistry.of(input.components ?? []);
  const { store, log } = applyOperations(EntityStore.empty(registry), input.operations);

  return {
    applied: log.filter((entry) => entry.applied).length,
    rejected: log.filter((entry) => !entry.applied).length,
    log,
    reads: (input.reads ?? []).map((id) => ({ id, state: store.get(id) })),
    snapshot: store.snapshot(),
    audit: store.audit(),
  };
}

export function createK0Module(
  scenarios: ModuleDefinition<K0Input, K0Output>['scenarios'],
): ModuleDefinition<K0Input, K0Output> {
  return {
    id: 'K0',
    version: K0_VERSION,
    purpose: K0_PURPOSE,
    dependencies: ['V0', 'V1'],
    validateInput,
    execute: (input: K0Input, _context: ModuleContext) => executeK0(input),
    validateOutput,
    scenarios,
  };
}

export function validateInput(input: unknown): K0Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('K0 입력은 객체여야 한다.');
  }
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value['operations'])) {
    throw new TypeError('`operations` 는 배열이어야 한다.');
  }
  for (const [index, operation] of (value['operations'] as unknown[]).entries()) {
    if (operation === null || typeof operation !== 'object' || Array.isArray(operation)) {
      throw new TypeError(`operations[${index}] 는 객체여야 한다.`);
    }
    if (typeof (operation as { op?: unknown }).op !== 'string') {
      throw new TypeError(`operations[${index}].op 는 문자열이어야 한다.`);
    }
  }
  if (value['components'] !== undefined && !Array.isArray(value['components'])) {
    throw new TypeError('`components` 는 배열이어야 한다.');
  }
  if (value['reads'] !== undefined) {
    const reads = value['reads'];
    if (!Array.isArray(reads) || !reads.every((id) => typeof id === 'string' && id !== '')) {
      throw new TypeError('`reads` 는 비어 있지 않은 문자열 배열이어야 한다.');
    }
  }
  return input as K0Input;
}

/** MODULE.yaml 의 invariants 중 출력만 보고 판정할 수 있는 것들. */
export function validateOutput(output: K0Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [...output.audit];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `K0 출력/${path}`, message });
  };

  const { snapshot } = output;

  const ids = snapshot.entities.map((entity) => entity.id);
  if (new Set(ids).size !== ids.length) {
    at('snapshot/entities', 'E_INVARIANT_entity_id_must_be_unique', `중복 id 가 있다: ${ids.join(', ')}`);
  }
  if (JSON.stringify(ids) !== JSON.stringify([...ids].sort())) {
    at('snapshot/entities', 'E_INVARIANT_type_index_must_agree_with_store', '실체 목록이 id 오름차순이 아니다.');
  }

  for (const entity of snapshot.entities) {
    if (!Object.isFrozen(entity)) {
      at(
        `snapshot/entities/${entity.id}`,
        'E_INVARIANT_read_must_not_expose_mutable_internal_state',
        '읽기 결과가 동결되어 있지 않다 — 밖에서 고칠 수 있다.',
      );
    }
    for (const [type, data] of Object.entries(entity.components)) {
      if (!Object.isFrozen(data)) {
        at(
          `snapshot/entities/${entity.id}/components/${type}`,
          'E_INVARIANT_read_must_not_expose_mutable_internal_state',
          '컴포넌트 값이 동결되어 있지 않다.',
        );
      }
    }
  }

  const recomputed = sha256Tagged(
    canonicalJson({
      entities: snapshot.entities,
      byKind: snapshot.byKind,
      byComponent: snapshot.byComponent,
    } as unknown as JsonValue),
  );
  if (recomputed !== snapshot.hash) {
    at(
      'snapshot/hash',
      'E_INVARIANT_identical_store_must_produce_identical_hash',
      `저장 ${snapshot.hash} / 재계산 ${recomputed}`,
    );
  }

  for (const entry of output.log) {
    if (entry.applied === (entry.rejection !== null)) {
      at(
        `log/${entry.index}`,
        'E_INVARIANT_rejected_operation_must_not_change_store',
        '적용 여부와 거부 기록이 어긋난다.',
      );
    }
    if (entry.rejection && (entry.rejection.code === '' || entry.rejection.path === '')) {
      at(
        `log/${entry.index}/rejection`,
        'E_INVARIANT_rejected_operation_must_not_change_store',
        '거부에 코드나 위치가 없다 — 원인을 짚을 수 없다.',
      );
    }
  }

  return issues;
}
