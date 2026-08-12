// 조립 루트 — World(Server 역할)와 View(Client)를 protocol 경계로만 연결한다.
// view/ 는 world/ 를 import 하지 않는다. 이 파일만 양쪽을 안다.

import { createWorld } from '../world/index';
import { interpretGameView } from '../view/gameview/interpret';
import { createHud } from '../view/hud/hud';
import { attachInput } from '../view/input/input';
import { createRenderer } from '../view/renderer/renderer';

const container = document.getElementById('game');
if (!container) throw new Error('#game 컨테이너가 없다');

const world = createWorld();
const renderer = createRenderer(container);
const hud = createHud(container);

let latestDepositId = 'deposit-1';
attachInput(renderer, (action) => world.dispatch(action), () => latestDepositId);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1); // 탭 복귀 시 급점프 방지
  last = now;

  world.tick(dt);
  const snapshot = world.projectPlayerView();
  const scene = interpretGameView(snapshot);
  latestDepositId = scene.mineTargetDepositId;

  renderer.render(scene);
  hud.render(scene.hud);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
