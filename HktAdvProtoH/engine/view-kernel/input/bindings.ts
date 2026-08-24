// Key Binding — 컨텐츠 팩이 등록하는 특수 키 규칙의 계약 (P3 ADDED, 설계 반전 ⑤)
//
// 대부분의 interaction 키는 SceneState.interactions[].key 가 이미 데이터로 나른다 —
// 조립 루트는 그 키를 그대로 요청으로 바꾼다. 여기의 바인딩은 그것으로 표현할 수
// 없는 팩 고유 규칙을 위한 자리다: "지금 상태를 보고 반대값을 요청한다"(막기 토글,
// 이동 모드 전환)처럼 장면을 읽고 요청을 고르는 로직.
//
// 조립 루트는 code 가 맞으면 invoke 를 부를 뿐, 그 안에서 무엇이 골라지는지 모른다.

import type { ActionRequest } from '../../protocol-core/actions';
import type { SceneState } from '../scene/scene-state';

/**
 * 요청을 보내고 **그 요청의 표식**을 돌려준다. 보내지 못했으면 null 이다.
 *
 * 표식을 돌려주는 이유는 하나다 — 세계의 대답에 같은 표식이 붙어 오므로
 * (INTENT-REPLY-CORRESPONDENCE-001), 그것을 받아야 팩이 "내가 보낸 그 요청이
 * 어떻게 되었는가" 를 짚을 수 있다. 되고 안 되고를 참·거짓으로만 돌려주면 팩은
 * 자기 요청의 대답을 영영 짚지 못하고, 그러면 기다림을 화면에 그릴 수 없다
 * (engine/view-kernel/net/pending.ts).
 *
 * 표식이 필요 없는 바인딩은 그냥 무시하면 된다 — 되돌린 값을 쓰지 않아도 된다.
 */
export type BindingSend = (action: ActionRequest) => number | null;

export interface KeyBinding {
  /** KeyboardEvent.code — 같은 code 를 가진 바인딩이 여럿이면 앞의 것이 이긴다 */
  code: string;
  /** 지금 장면을 읽고 보낼 요청을 고른다. 보내지 않을 수도 있다 */
  invoke(scene: SceneState, send: BindingSend): void;
}
