import type { PredicateCause } from '@hkt/k1-predicate-query';
import type { TransactionIssueCode } from './types.js';

/**
 * 규칙 처리를 멈추는 거부.
 *
 * 이 예외가 오르면 그 트랜잭션은 **아무것도 적용하지 않는다.** 원자성은 예외 처리 규약이 아니라
 * K0 의 불변 저장소가 보장한다 — 작업용 저장소를 그냥 버리면 원본이 그대로 남는다.
 */
export class TransactionRejected extends Error {
  readonly code: TransactionIssueCode;
  readonly path: string;
  readonly causes: PredicateCause[];

  constructor(code: TransactionIssueCode, path: string, message: string, causes: PredicateCause[] = []) {
    super(message);
    this.name = 'TransactionRejected';
    this.code = code;
    this.path = path;
    this.causes = causes;
  }

  toRejection(): { code: string; path: string; message: string; causes: PredicateCause[] } {
    return { code: this.code, path: this.path, message: this.message, causes: this.causes };
  }
}
