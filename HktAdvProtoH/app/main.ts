// 조립 루트 — World(Server 역할)와 View(Client)를 protocol 경계로만 연결한다.
// view/ 는 world/ 를 import 하지 않는다. 이 파일만 양쪽을 안다.

import { createWorld, listCycles } from '../world/index';
import { interpretGameView } from '../view/gameview/interpret';
import { createHud } from '../view/hud/hud';
import { attachInput } from '../view/input/input';
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

let latestDepositId = 'deposit-1';
attachInput(renderer, (action) => world.dispatch(action), () => latestDepositId);

// WASD 연속 이동 — 매 프레임 진행 방향의 조금 앞 지점을 Move 요청한다.
// 판정은 여전히 World(RULE-MOVE-001/PROGRESS)가 한다.
const KEY_LOOKAHEAD = 1.6;
const clamp = (v: number) => Math.max(-20, Math.min(20, v));
let wasKeyMoving = false;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1); // 탭 복귀 시 급점프 방지
  last = now;

  const before = world.projectPlayerView();

  const dir = keyboard.direction();
  if (dir) {
    wasKeyMoving = true;
    world.dispatch({
      type: 'move',
      target: {
        x: clamp(before.entities.player.position.x + dir.x * KEY_LOOKAHEAD),
        z: clamp(before.entities.player.position.z + dir.z * KEY_LOOKAHEAD),
      },
    });
  } else if (wasKeyMoving) {
    wasKeyMoving = false;
    world.dispatch({ type: 'move', target: before.entities.player.position }); // 제자리 = 정지
  }

  if (keyboard.consumeMinePressed()) {
    world.dispatch({ type: 'mine', depositId: latestDepositId });
  }

  world.tick(dt);
  const snapshot = world.projectPlayerView();
  const scene = interpretGameView(snapshot);
  latestDepositId = scene.mineTargetDepositId;

  renderer.render(scene);
  const deposit = scene.entities.find((e) => e.key === 'deposit');
  const depositScreen = deposit
    ? renderer.worldToScreen(deposit.position.x, deposit.position.z, 4.2)
    : null;
  hud.render(scene.hud, depositScreen);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
