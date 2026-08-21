// proto-adventure 팩의 Action Request 확장 (P2 ADDED).
//
// 요청 봉투(interactionId·지형/존재 지목·mark)는 engine/protocol-core 가 소유하고,
// 이 세계의 요청 파라미터(이동 모드·속성 변경)는 여기가 더한다.
// 팩 interaction 핸들러가 이 형으로 좁혀 읽는다 — 봉투는 팩 필드를 모른다.

import type { ActionRequest as CoreActionRequest } from '../../../engine/protocol-core/actions';

export type { ActionResult } from '../../../engine/protocol-core/actions';

export interface ActionRequest extends CoreActionRequest {
  mode?: 'walk' | 'run'; // C007 — 이동 모드 전환. 토글이 아니라 명시값이다
  // C007 R2 — 속성 변경 (디버그 조작의 기반). 무엇을 어떤 값으로 바꿀지가 실린다.
  // 요청일 뿐이다 — 받아들일지는 World Rule 이 정한다 (RULE-ATTRIBUTE-SET-001).
  attribute?: { id: string; value: number | string };
  // C020 — 무엇을 쓸 것인가. 대상은 싣지 않는다 — 그것은 고른 것이다
  // (INTENT-TARGET-DIRECTS-THE-ACT-001). 요청이 싣는 것은 **내 소지품 중 무엇인가** 하나다.
  itemKind?: string;
  // C014 — 살펴봄과 되돌림은 봉투의 targetEntityId 를 그대로 쓴다.
  // 새 파라미터가 필요하지 않다: 살펴볼 대상도, 잊을 대상도 존재 하나를 지목하는 일이며
  // 그것은 이미 봉투가 실을 수 있다 (INTENT-ENTITY-ADDRESSABLE-001).
}
