// Key Binding — 컨텐츠 팩이 등록하는 특수 키 규칙의 계약 (P3 ADDED, 설계 반전 ⑤)
//
// 대부분의 interaction 키는 SceneState.interactions[].key 가 이미 데이터로 나른다 —
// 조립 루트는 그 키를 그대로 요청으로 바꾼다. 여기의 바인딩은 그것으로 표현할 수
// 없는 팩 고유 규칙을 위한 자리다: "지금 상태를 보고 반대값을 요청한다"(막기 토글,
// 이동 모드 전환)처럼 장면을 읽고 요청을 고르는 로직.
//
// 조립 루트는 code 가 맞으면 invoke 를 부를 뿐, 그 안에서 무엇이 골라지는지 모른다.
//
// ── 한 코드에 여럿, 그리고 사양하는 길 ──────────────────────────────
//
// 같은 코드에 바인딩이 **여럿 있을 수 있다.** 표면이 둘이면 `↑` 는 열려 있는 쪽의
// 것이고, 아무것도 열려 있지 않으면 그 눌림은 세계의 interaction 으로 흘러야 한다.
// 그래서 바인딩은 **사양할 수 있어야 한다** — 사양하면 같은 코드의 다음 바인딩으로,
// 그래도 아무도 가져가지 않으면 세계로 흐른다.
//
// 이것이 없던 동안 팩은 두 가지를 할 수 없었다.
//   · 같은 코드에 바인딩을 둘 이상 두는 일 (앞의 것이 언제나 이겼다)
//   · 세계가 이미 쓰는 코드(`Escape` = 지목 해제)에 자기 규칙을 얹는 일 —
//     얹는 순간 그 interaction 이 죽었다

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
  /** KeyboardEvent.code — 같은 code 를 가진 바인딩이 **여럿 있을 수 있다** (등록 차례대로 묻는다) */
  code: string;
  /**
   * 지금 장면을 읽고 보낼 요청을 고른다. 보내지 않을 수도 있다.
   *
   * 돌려주는 값이 곧 **이 눌림을 가져갔는가** 다.
   *
   *     아무것도 돌려주지 않거나 true   가져갔다 — 여기서 멈춘다 (예전과 같다)
   *     false                          사양한다 — 같은 코드의 다음 바인딩으로,
   *                                    그래도 아무도 안 가져가면 세계로 흐른다
   *
   * 기본이 "가져갔다" 인 이유: 사양은 드물고 가져가는 것이 예사다. 그리고 이 값이
   * 생기기 전에 쓰인 바인딩들이 전부 그 뜻이었다 — 기본을 반대로 두면 그것들이
   * 조용히 흘려보내는 바인딩이 된다.
   */
  invoke(scene: SceneState, send: BindingSend): boolean | void;
}

/**
 * 이 눌림을 팩의 규칙에게 묻는다 — **가져간 것이 있으면 참**이다.
 *
 * 같은 코드의 바인딩을 등록 차례대로 묻고, 사양하지 않은 첫 바인딩에서 멈춘다.
 * 아무도 가져가지 않으면 거짓이며, 그때 조립 루트는 그 눌림을 세계의 interaction 으로
 * 흘려보낸다.
 *
 * **묻는 일이 여기 있는 이유**는 조립 루트가 이 규칙을 두 자리에서 쓰기 때문이다
 * (표면이 열려 있을 때와 아닐 때). 두 자리에 같은 산수를 적으면 한쪽만 고쳐지는 날이 온다.
 */
export function dispatchKey(
  bindings: readonly KeyBinding[],
  code: string,
  scene: SceneState,
  send: BindingSend,
): boolean {
  for (const binding of bindings) {
    if (binding.code !== code) continue;
    if (binding.invoke(scene, send) !== false) return true;
  }
  return false;
}
