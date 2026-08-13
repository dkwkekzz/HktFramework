// 조립 루트 — World(Server 역할)와 View(Client)를 protocol 경계로만 연결한다.
// view/ 는 world/ 를 import 하지 않는다. 이 파일만 양쪽을 안다.
// 게임 의미를 알지 못한다 — Snapshot 의 지시(키·대상·라벨)만으로 배선한다.

import { createWorld } from '../world/index';
import { CYCLE_IDS } from '../world/cycles/index';
import { resolvePresentation } from '../view/presentation/resolve';
import { createHud, type EntityLabel } from '../view/hud/hud';
import { attachInput } from '../view/input/input';
import { attachKeyboard } from '../view/input/keyboard';
import { createRenderer } from '../view/renderer/renderer';
import type { SceneState } from '../view/scene/scene-state';

const container = document.getElementById('game');
if (!container) throw new Error('#game 컨테이너가 없다');

// 특정 Cycle 까지의 게임 재생 — ?cycle=<CycleId> (생략 시 전체 = 최신 게임)
const requestedCycle = new URLSearchParams(location.search).get('cycle') ?? undefined;
const world = createWorld({ upToCycle: requestedCycle });

// Cycle 선택 UI — 게임의 역사를 임의 시점까지 되감아 실행한다
{
  const picker = document.createElement('select');
  picker.className = 'cycle-picker';
  for (const id of CYCLE_IDS) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id;
    picker.appendChild(option);
  }
  picker.value = world.cycles[world.cycles.length - 1] ?? '';
  picker.addEventListener('change', () => {
    const latest = CYCLE_IDS[CYCLE_IDS.length - 1];
    location.search = picker.value === latest ? '' : `?cycle=${picker.value}`;
  });
  container.appendChild(picker);
}

const renderer = createRenderer(container);
const hud = createHud(container);
const keyboard = attachKeyboard();

let latestScene: SceneState = resolvePresentation(world.projectPlayerView());
attachInput(renderer, (action) => world.dispatch(action), () => latestScene);

// WASD 연속 이동 — 매 프레임 진행 방향의 조금 앞 지점을 terrainTarget interaction 으로
// 요청한다. 판정은 World Rule 이 한다 (Bounds 밖이면 World 가 거부).
const KEY_LOOKAHEAD = 1.6;
let wasKeyMoving = false;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1); // 탭 복귀 시 급점프 방지
  last = now;

  const terrain = latestScene.interactions.find((i) => i.terrainTarget);
  const self = latestScene.entities.find((e) => e.cameraFollow);

  const dir = keyboard.direction();
  if (dir && terrain && self) {
    wasKeyMoving = true;
    world.dispatch({
      interactionId: terrain.id,
      position: {
        x: self.position.x + dir.x * KEY_LOOKAHEAD,
        z: self.position.z + dir.z * KEY_LOOKAHEAD,
      },
    });
  } else if (!dir && wasKeyMoving && terrain && self) {
    wasKeyMoving = false;
    world.dispatch({ interactionId: terrain.id, position: self.position }); // 제자리 = 정지
  }

  for (const code of keyboard.consumeKeyPresses()) {
    const interaction = latestScene.interactions.find((i) => i.key === code);
    if (interaction) {
      world.dispatch({
        interactionId: interaction.id,
        ...(interaction.targetEntityId ? { targetEntityId: interaction.targetEntityId } : {}),
      });
    }
  }

  world.tick(dt);
  latestScene = resolvePresentation(world.projectPlayerView());

  renderer.render(latestScene);

  const labels: EntityLabel[] = [];
  for (const entity of latestScene.entities) {
    if (entity.label === undefined) continue;
    const screen = renderer.worldToScreen(entity.position.x, entity.position.z, 4.2);
    if (screen) labels.push({ x: screen.x, y: screen.y, text: entity.label });
  }
  hud.render(latestScene, labels);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
