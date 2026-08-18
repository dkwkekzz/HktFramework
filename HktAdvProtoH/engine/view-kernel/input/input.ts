// Input → Action Request 발신 (Capability 엔진) — Client 는 상태를 직접 바꾸지 않는다.
// 어떤 interaction 이 entity/지형 대상인지는 Snapshot 의 지시(targetEntityId /
// terrainTarget)가 정하고, 여기는 그 지시대로 요청을 보낼 뿐이다.

import type { ActionRequest } from '../../../protocol/actions';
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
      const terrain = scene.interactions.find((i) => i.terrainTarget);
      if (terrain) send({ interactionId: terrain.id, position: point });
    }
  });
}
