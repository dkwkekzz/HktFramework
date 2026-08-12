// Input → Action Request 발신 — Client 는 상태를 직접 바꾸지 않는다.
// 클릭: deposit 스프라이트 → Mine 요청, 지형 → Move 요청.

import type { ActionRequest } from '../../protocol/actions';
import type { GameRenderer } from '../renderer/renderer';

export type ActionSink = (action: ActionRequest) => void;

export function attachInput(
  renderer: GameRenderer,
  send: ActionSink,
  currentDepositId: () => string,
): void {
  renderer.domElement.addEventListener('click', (ev) => {
    if (renderer.pickDeposit(ev.clientX, ev.clientY)) {
      send({ type: 'mine', depositId: currentDepositId() });
      return;
    }
    const point = renderer.pickGround(ev.clientX, ev.clientY);
    if (point) send({ type: 'move', target: point });
  });
}
