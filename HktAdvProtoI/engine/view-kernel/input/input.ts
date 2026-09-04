// Input → Action Request 발신 (Capability 엔진) — Client 는 상태를 직접 바꾸지 않는다.
//
// 이 기구가 하는 일은 **집는 것**뿐이다: 누른 화면 자리에 무엇이 있는지(존재 · 지면)를
// renderer 에게 물어 한 벌로 모은다. 그것을 무엇으로 옮길지는 주입된 정책이 답한다
// (input/pointer-intent.ts) — 기구는 게임의 뜻을 하나도 쥐고 있지 않다.
//
// 예전에는 "집힌 존재의 첫 interaction 을 즉시 보낸다 / 아니면 지형 대상으로 보낸다" 가
// 여기 박혀 있었다. 그 판단은 이 세계가 클릭에 붙인 뜻이지 기구의 성질이 아니다.

import type { ActionRequest } from '../../protocol-core/actions';
import type { GameRenderer } from '../renderer/renderer';
import type { SceneState } from '../scene/scene-state';
import type { PointerIntent, PointerPick } from './pointer-intent';

export type ActionSink = (action: ActionRequest) => void;

/** 눌린 자리에서 집을 수 있는 것을 전부 집는다 — 순서도 우선도 없다 */
export function pickAt(
  renderer: GameRenderer,
  clientX: number,
  clientY: number,
  modifiers: PointerPick['modifiers'],
): PointerPick {
  return {
    entityId: renderer.pickEntity(clientX, clientY),
    ground: renderer.pickGround(clientX, clientY),
    modifiers,
  };
}

export function attachInput(
  renderer: GameRenderer,
  send: ActionSink,
  // 무엇을 요청할지는 **정책이 정한다.** 기구는 장면을 읽지 않는다 —
  // 정책이 장면을 봐야 하면 조립이 클로저로 쥐고 넘긴다 (정책은 pick 하나만 받는다).
  intent: PointerIntent,
): void {
  renderer.domElement.addEventListener('click', (ev) => {
    const pick = pickAt(renderer, ev.clientX, ev.clientY, {
      alt: ev.altKey,
      shift: ev.shiftKey,
      ctrl: ev.ctrlKey,
      meta: ev.metaKey,
    });
    // 정책이 아무것도 주지 않으면 아무 일도 없다 — 숨겨 둔 기본 요청은 없다
    const action = intent(pick);
    if (action) send(action);
  });
}
