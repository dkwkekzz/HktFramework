// Input → Action Request 발신 — Client 는 상태를 직접 바꾸지 않는다.
//
// View 는 어떤 Action 이 있는지 알지 못한다. Snapshot 의 interactions 가 "무엇을 집으면
// 무엇을 보낸다" 를 들고 있고, 여기서는 지목한 대상에 맞는 상호작용을 찾아 그대로 보낼 뿐이다.

import type { ActionRequest } from '../../protocol/actions';
import type { GameViewInteraction } from '../../protocol/gameview';
import type { GameRenderer } from '../renderer/renderer';

export type ActionSink = (action: ActionRequest) => void;

/** 지면 지시형 상호작용의 request 에 지점을 채워 완성한다 */
export function requestWithPoint(
  interaction: GameViewInteraction,
  point: { x: number; z: number },
): ActionRequest {
  if (!interaction.pointField) return interaction.request;
  return { ...interaction.request, [interaction.pointField]: point } as ActionRequest;
}

/** 지면을 지목했을 때 보낼 상호작용 */
export function groundInteraction(
  interactions: readonly GameViewInteraction[],
): GameViewInteraction | undefined {
  return interactions.find((i) => i.pointField && i.available);
}

/** 특정 Entity 를 지목했을 때 보낼 상호작용 */
export function entityInteraction(
  interactions: readonly GameViewInteraction[],
  entityId: string,
): GameViewInteraction | undefined {
  return interactions.find((i) => i.targetEntityId === entityId);
}

/** 키 입력에 대응하는 상호작용 */
export function keyInteraction(
  interactions: readonly GameViewInteraction[],
  key: string,
): GameViewInteraction | undefined {
  return interactions.find((i) => i.key?.toLowerCase() === key.toLowerCase());
}

export function attachInput(
  renderer: GameRenderer,
  send: ActionSink,
  currentInteractions: () => readonly GameViewInteraction[],
): void {
  renderer.domElement.addEventListener('click', (ev) => {
    const interactions = currentInteractions();

    const entityId = renderer.pickEntity(ev.clientX, ev.clientY);
    if (entityId) {
      const onEntity = entityInteraction(interactions, entityId);
      if (onEntity) {
        send(onEntity.request);
        return;
      }
    }

    const point = renderer.pickGround(ev.clientX, ev.clientY);
    const onGround = point && groundInteraction(interactions);
    if (point && onGround) send(requestWithPoint(onGround, point));
  });
}
