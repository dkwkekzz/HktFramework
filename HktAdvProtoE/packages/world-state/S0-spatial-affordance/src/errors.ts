import type { AccessIssueCode } from './types.js';

/**
 * 공간 명세 자체가 잘못되었음을 알리는 예외.
 *
 * K1 의 `QueryRejection` 과 같은 선을 긋는다 — **세계의 사실과 명세의 잘못을 구분한다.**
 * "벽이 막아서 못 간다"는 세계의 사실이므로 거절(`AccessRejection`)이지 예외가 아니다.
 * 반면 "칸 크기가 0 이다" · "격자 밖에 서 있다"는 세계에 대한 진술이 아니라 배치의 잘못이다.
 * 뒤쪽만 여기서 던진다. 거짓으로 처리하면 "아무 데도 갈 수 없는 세계"가 조용히 정상으로 보인다.
 */
export class SpatialRejection extends Error {
  readonly code: AccessIssueCode;
  /** 입력 안의 위치 (`layout/cellSize` · `affordance/take_relic/targetEntityId`) */
  readonly path: string;

  constructor(code: AccessIssueCode, path: string, message: string) {
    super(message);
    this.name = 'SpatialRejection';
    this.code = code;
    this.path = path;
  }

  toIssue(): { code: string; path: string; message: string } {
    return { code: this.code, path: this.path, message: this.message };
  }
}
