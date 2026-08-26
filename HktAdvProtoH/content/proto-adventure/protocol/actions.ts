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
  // C023 — **푸는 요청에만 실린다.** 어느 자리를 푸는가 하나이며, 무엇을 푸는지는
  // 싣지 않는다 (자리가 이미 그것을 안다).
  //
  // C024 CHANGED — **거는 요청도 실을 수 있다.** 형이 아니라 뜻이 넓어진다.
  //
  //     싣지 않은 거는 요청   빈 자리에 건다. 없으면 no-empty-slot — C023 그대로다.
  //                          세계가 슬그머니 무언가를 밀어내지 않는다
  //     실은 거는 요청        그 자리가 비었으면 걸고, **차 있으면 교체가 된다** (IE §16)
  //
  // 무엇을 밀어낼지는 잃을 것을 고르는 일이므로 세계가 대신 고르지 않는다
  // (INTENT-THE-DISPLACED-IS-NAMED-001). 빈 자리들 사이에서 고르는 것은 자리들이
  // 서로 같으므로 여전히 세계의 몫이다.
  equipSlotId?: string;
  // C-COMBAT-001 — 어느 배분으로 갈 것인가 하나. **몫을 싣지 않는다** —
  // 사람이 하는 일은 배분 하나를 고르는 것이며, 몫을 실을 수 있게 하는 순간 이 계약이
  // 실시간 조절 UI 의 문을 연다 (DC-COMBAT-AURA-IS-A-PROFILE-NOT-A-DIAL · UL §41.1).
  // 토글도 "다음 것" 도 아닌 명시값이다 — 같은 요청이 두 번 와도 결과가 같다.
  allocationId?: string;
  // C014 — 살펴봄과 되돌림은 봉투의 targetEntityId 를 그대로 쓴다.
  // 새 파라미터가 필요하지 않다: 살펴볼 대상도, 잊을 대상도 존재 하나를 지목하는 일이며
  // 그것은 이미 봉투가 실을 수 있다 (INTENT-ENTITY-ADDRESSABLE-001).
}
