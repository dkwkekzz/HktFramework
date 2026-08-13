// Client 조립 루트 (C003) — 여기에는 세계가 없다.
//
// 세계는 다른 프로세스에서 자기 시계로 돈다. 이 파일이 하는 일은 셋뿐이다.
//   1. 받은 관찰 결과를 그린다 (마지막으로 받은 것이 화면이다)
//   2. 입력을 Action Request 로 만들어 세계로 보낸다
//   3. 이어짐 상태를 표시한다
//
// world/ 를 import 하지 않는다 — 이제는 규율이 아니라 물리적 사실이다.

import { TRANSPORT_PATH } from '../protocol/transport';
import { createHud, type EntityLabel } from '../view/hud/hud';
import { attachInput } from '../view/input/input';
import { attachKeyboard } from '../view/input/keyboard';
import { browserSocketFactory, createWorldLink } from '../view/net/world-link';
import { resolvePresentation } from '../view/presentation/resolve';
import { sessionPresentation } from '../view/presentation/session-presentation';
import { createRenderer } from '../view/renderer/renderer';
import type { SceneState } from '../view/scene/scene-state';

const container = document.getElementById('game');
if (!container) throw new Error('#game 컨테이너가 없다');

const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const link = createWorldLink(browserSocketFactory(`${wsProtocol}//${location.host}${TRANSPORT_PATH}`));

const renderer = createRenderer(container);
const hud = createHud(container);
const keyboard = attachKeyboard();

// 아직 세계로부터 아무것도 받지 못한 동안의 화면 — 빈 세계를 그린다.
const EMPTY_SCENE: SceneState = {
  specId: 'pending',
  terrain: 'mining-field',
  entities: [],
  interactions: [],
  hud: [],
};

let latestScene: SceneState = EMPTY_SCENE;
attachInput(renderer, (action) => link.send(action), () => latestScene);

// WASD 연속 이동 — 진행 방향의 조금 앞 지점을 요청한다. 판정은 세계가 한다.
// C003: 매 프레임이 아니라 일정 간격으로 보낸다 — 요청은 이제 선을 타고 간다.
const KEY_LOOKAHEAD = 1.6;
const MOVE_REQUEST_INTERVAL = 0.1;
let moveRequestCooldown = 0;
let wasKeyMoving = false;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // 조용히 죽은 이어짐을 걷어낸다 — 관찰 결과가 끊기면 그것이 끊김이다
  link.poll(Date.now());

  // 화면은 마지막으로 받은 관찰 결과다 (04-gameview.spec.yaml delivery: pushed)
  const snapshot = link.latest();
  latestScene = snapshot ? resolvePresentation(snapshot) : EMPTY_SCENE;

  const terrain = latestScene.interactions.find((i) => i.terrainTarget);
  const self = latestScene.entities.find((e) => e.cameraFollow);

  moveRequestCooldown -= dt;
  const dir = keyboard.direction();
  if (dir && terrain && self) {
    wasKeyMoving = true;
    if (moveRequestCooldown <= 0) {
      moveRequestCooldown = MOVE_REQUEST_INTERVAL;
      link.send({
        interactionId: terrain.id,
        position: {
          x: self.position.x + dir.x * KEY_LOOKAHEAD,
          z: self.position.z + dir.z * KEY_LOOKAHEAD,
        },
      });
    }
  } else if (!dir && wasKeyMoving && terrain && self) {
    wasKeyMoving = false;
    moveRequestCooldown = 0;
    link.send({ interactionId: terrain.id, position: self.position }); // 제자리 = 정지
  }

  for (const code of keyboard.consumeKeyPresses()) {
    const keyed = latestScene.interactions.filter((i) => i.key === code);
    const interaction = keyed.find((i) => i.available) ?? keyed[0];
    if (interaction) {
      link.send({
        interactionId: interaction.id,
        ...(interaction.targetEntityId ? { targetEntityId: interaction.targetEntityId } : {}),
      });
    }
  }

  renderer.render(latestScene, dt);

  const labels: EntityLabel[] = [];
  for (const entity of latestScene.entities) {
    if (entity.label === undefined) continue;
    const screen = renderer.worldToScreen(entity.position.x, entity.position.z, 4.2);
    if (screen) labels.push({ x: screen.x, y: screen.y, text: entity.label });
  }
  hud.render(latestScene, labels, sessionPresentation(link.state(), link.stale()));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
