import { StoreRejection } from './errors.js';
import type { EntityStore } from './store.js';
import { STORE_ISSUE, type StoreOperation } from './types.js';

/**
 * 데이터로 적힌 연산 하나를 저장소에 적용한다.
 *
 * 거부되면 `StoreRejection` 이 오르고 **저장소는 한 글자도 바뀌지 않는다** — 반환값을 쓰지 않으면
 * 원본이 그대로 남기 때문이다. K2 의 원자적 트랜잭션과 K3 의 재생이 이 성질 위에 선다.
 */
export function applyOperation(store: EntityStore, operation: StoreOperation): EntityStore {
  switch (operation.op) {
    case 'spawn':
      return store.spawn({
        id: operation.id,
        kind: operation.kind,
        ...(operation.tags === undefined ? {} : { tags: operation.tags }),
        ...(operation.components === undefined ? {} : { components: operation.components }),
      });
    case 'despawn':
      return store.despawn(operation.id);
    case 'set_component':
      return store.setComponent(operation.id, operation.type, operation.data);
    case 'remove_component':
      return store.removeComponent(operation.id, operation.type);
    case 'attach_tag':
      return store.attachTag(operation.id, operation.tag);
    case 'remove_tag':
      return store.removeTag(operation.id, operation.tag);
    default: {
      const unknown = operation as { op?: unknown };
      throw new StoreRejection(
        STORE_ISSUE.UNKNOWN_OPERATION,
        'operation/op',
        `모르는 연산이다: ${JSON.stringify(unknown.op)}`,
      );
    }
  }
}

export interface AppliedOperation {
  index: number;
  operation: StoreOperation;
  applied: boolean;
  rejection: { code: string; path: string; message: string } | null;
}

/**
 * 연산 목록을 차례로 적용한다.
 *
 * 하나가 거부되어도 나머지는 계속 시도한다 — 거부의 원인이 **그 연산에만** 머무는지를
 * 보이는 것이 K0 의 대표 검증이기 때문이다. 여러 연산을 한 덩어리로 묶는 원자성은 K2 의 몫이다.
 */
export function applyOperations(
  store: EntityStore,
  operations: readonly StoreOperation[],
): { store: EntityStore; log: AppliedOperation[] } {
  let current = store;
  const log: AppliedOperation[] = [];
  operations.forEach((operation, index) => {
    try {
      current = applyOperation(current, operation);
      log.push({ index, operation, applied: true, rejection: null });
    } catch (error) {
      if (!(error instanceof StoreRejection)) throw error;
      log.push({ index, operation, applied: false, rejection: error.toIssue() });
    }
  });
  return { store: current, log };
}
