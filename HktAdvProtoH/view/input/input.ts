// Input → Action Request 발신 (범용 엔진) — Client 는 상태를 직접 바꾸지 않는다.
//
// 클릭한 entity 가 어떤 interaction 의 대상이면 그 interaction 을,
// 지형이면 terrainTarget interaction 을 요청한다. 특정 게임 의미를 알지 못한다.

import type { ActionRequest } from '../../protocol/actions';
import { interactionTraits } from '../engine/interaction-registry';
import type { GameRenderer } from '../renderer/renderer';
import type { SceneState } from '../scene/scene-state';

export type ActionSink = (action: ActionRequest) => void;

export function attachInput(
  renderer: GameRenderer,
  send: ActionSink,
  latestScene: () => SceneState,
): void {
  renderer.domElement.addEventListener('click', (ev) => {
    const scene = latestScene();

    const entityId = renderer.pickEntity(ev.clientX, ev.clientY);
    if (entityId) {
      const interaction = scene.interactions.find((i) => i.targetEntityId === entityId);
      if (interaction) {
        send({ interactionId: interaction.id, targetEntityId: entityId });
        return;
      }
    }

    const point = renderer.pickGround(ev.clientX, ev.clientY);
    if (point) {
      const terrain = scene.interactions.find((i) => interactionTraits(i.role).terrainTarget);
      if (terrain) send({ interactionId: terrain.id, position: point });
    }
  });
}
