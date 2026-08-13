// 조립 루트 — World(Server 역할)와 View(Client)를 protocol 경계로만 연결한다.
// view/ 는 world/ 를 import 하지 않는다. 이 파일만 양쪽을 안다.
//
// 여기에도 게임 의미는 없다 — 어떤 존재를 무엇으로 조작하는지는 Snapshot 의 interactions 가 정한다.

import { createWorld, listCycles } from '../world/index';
import { interpretGameView } from '../view/gameview/interpret';
import { createHud } from '../view/hud/hud';
import {
  attachInput,
  groundInteraction,
  keyInteraction,
  requestWithPoint,
} from '../view/input/input';
import { attachKeyboard } from '../view/input/keyboard';
import { createRenderer } from '../view/renderer/renderer';
import { createCycleBadge, showCycleError } from './cycle-banner';

const container = document.getElementById('game');
if (!container) throw new Error('#game 컨테이너가 없다');

// 실행 범위 — ?cycle=C001 로 "그 Cycle 까지의 게임" 을 굴린다 (미지정이면 최신 = 현재 게임).
// run.sh / run.bat 의 인자가 이 Query 로 전달된다.
const requestedCycle = new URLSearchParams(location.search).get('cycle');

let world: ReturnType<typeof createWorld>;
try {
  world = createWorld({ upToCycle: requestedCycle });
} catch (error) {
  showCycleError(container, error, listCycles());
  throw error;
}
createCycleBadge(container, world.scope, listCycles());

const renderer = createRenderer(container);
const hud = createHud(container);
const keyboard = attachKeyboard();

let scene = interpretGameView(world.projectPlayerView());
attachInput(renderer, (action) => world.dispatch(action), () => scene.interactions);

// WASD 연속 이동 — 매 프레임 진행 방향의 조금 앞 지점을 지면 상호작용으로 요청한다.
// 판정은 여전히 World 가 한다.
const KEY_LOOKAHEAD = 1.6;
const clamp = (v: number) => Math.max(-20, Math.min(20, v));
let wasKeyMoving = false;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1); // 탭 복귀 시 급점프 방지
  last = now;

  const focus = scene.entities.find((e) => e.focus);
  const ground = groundInteraction(scene.interactions);
  const dir = keyboard.direction();
  if (dir && ground && focus) {
    wasKeyMoving = true;
    world.dispatch(
      requestWithPoint(ground, {
        x: clamp(focus.position.x + dir.x * KEY_LOOKAHEAD),
        z: clamp(focus.position.z + dir.z * KEY_LOOKAHEAD),
      }),
    );
  } else if (wasKeyMoving && ground && focus) {
    wasKeyMoving = false;
    world.dispatch(requestWithPoint(ground, focus.position)); // 제자리 = 정지
  }

  for (const key of keyboard.consumeKeys()) {
    const interaction = keyInteraction(scene.interactions, key);
    if (interaction) world.dispatch(interaction.request);
  }

  world.tick(dt);
  scene = interpretGameView(world.projectPlayerView());

  renderer.render(scene);

  // 라벨을 가진 존재의 화면 좌표를 모아 HUD 에 넘긴다 (어느 존재든 동일하게)
  const labelScreen = new Map<string, { x: number; y: number }>();
  for (const entity of scene.entities) {
    if (!entity.label) continue;
    const screen = renderer.worldToScreen(entity.position.x, entity.position.z, 4.2);
    if (screen) labelScreen.set(entity.id, screen);
  }
  hud.render(scene, labelScreen);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
