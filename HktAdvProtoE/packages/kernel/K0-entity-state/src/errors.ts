import type { StoreIssueCode } from './types.js';

/**
 * 저장소가 요청을 거부했음을 알리는 예외.
 *
 * 버그(터짐)와 규칙에 따른 거부를 구분한다. 원문 「22」 8단계의 "인과 추적"을 위해
 * **코드와 위치를 반드시 함께** 싣는다 — "실패했다"만으로는 원인을 짚을 수 없다.
 */
export class StoreRejection extends Error {
  readonly code: StoreIssueCode;
  /** 거부 근거의 위치. `entity/<id>/components/<type>` 처럼 저장소 안 좌표를 가리킨다. */
  readonly path: string;

  constructor(code: StoreIssueCode, path: string, message: string) {
    super(message);
    this.name = 'StoreRejection';
    this.code = code;
    this.path = path;
  }

  toIssue(): { code: string; path: string; message: string } {
    return { code: this.code, path: this.path, message: this.message };
  }
}
