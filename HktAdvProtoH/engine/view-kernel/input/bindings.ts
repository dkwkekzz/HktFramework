// Key Binding — 컨텐츠 팩이 등록하는 특수 키 규칙의 계약 (P3 ADDED, 설계 반전 ⑤)
//
// 대부분의 interaction 키는 SceneState.interactions[].key 가 이미 데이터로 나른다 —
// 조립 루트는 그 키를 그대로 요청으로 바꾼다. 여기의 바인딩은 그것으로 표현할 수
// 없는 팩 고유 규칙을 위한 자리다: "지금 상태를 보고 반대값을 요청한다"(막기 토글,
// 이동 모드 전환)처럼 장면을 읽고 요청을 고르는 로직.
//
// 조립 루트는 code 가 맞으면 invoke 를 부를 뿐, 그 안에서 무엇이 골라지는지 모른다.

import type { ActionRequest } from '../../../protocol/actions';
import type { SceneState } from '../scene/scene-state';

export interface KeyBinding {
  /** KeyboardEvent.code — 같은 code 를 가진 바인딩이 여럿이면 앞의 것이 이긴다 */
  code: string;
  /** 지금 장면을 읽고 보낼 요청을 고른다. 보내지 않을 수도 있다 */
  invoke(scene: SceneState, send: (action: ActionRequest) => boolean): void;
}
