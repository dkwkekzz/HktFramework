import type { QueryIssueCode } from './types.js';

/**
 * 조건식·질의 자체가 잘못되었음을 알리는 예외.
 *
 * **세계의 사실과 명세의 잘못을 구분하는 것이 이 예외의 전부다.**
 * "체력이 50 이하가 아니다"는 세계의 사실이므로 거짓이다. 반면 "healt.current" 라고 잘못 적은 것은
 * 세계에 대한 진술이 아니라 명세의 오타다 — 거짓으로 처리하면 조용히 통과하는 조건이 생긴다.
 * 뒤쪽만 여기서 던진다.
 */
export class QueryRejection extends Error {
  readonly code: QueryIssueCode;
  /** 조건식 안의 위치 (`where/items/1/path` 같은 좌표) */
  readonly path: string;

  constructor(code: QueryIssueCode, path: string, message: string) {
    super(message);
    this.name = 'QueryRejection';
    this.code = code;
    this.path = path;
  }

  toIssue(): { code: string; path: string; message: string } {
    return { code: this.code, path: this.path, message: this.message };
  }
}
