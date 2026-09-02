// 이 세계의 Action Request 확장 — 봉투(engine/protocol-core)가 모르는 요청 갈래.
//
// 요청 봉투(interactionId·지형/존재 지목·mark)는 engine/protocol-core 가 소유하고,
// 이 세계의 요청 파라미터(이동 모드·속성 변경)는 여기가 더한다.
// 팩 interaction 핸들러가 이 형으로 좁혀 읽는다 — 봉투는 팩 필드를 모른다.

import type { ActionRequest as CoreActionRequest } from '../../engine/protocol-core/actions';

export type { ActionResult } from '../../engine/protocol-core/actions';

export interface ActionRequest extends CoreActionRequest {
  mode?: 'walk' | 'run'; // 이동 모드 전환. 토글이 아니라 명시값이다
  // 속성 변경 (디버그 조작의 기반). 무엇을 어떤 값으로 바꿀지가 실린다.
  // 요청일 뿐이다 — 받아들일지는 World Rule 이 정한다 (RULE-ATTRIBUTE-SET-001).
  attribute?: { id: string; value: number | string };
}
