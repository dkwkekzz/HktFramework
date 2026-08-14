// Client 조립 루트 (C003 · C004) — 여기에는 세계가 없다.
//
// 세계는 다른 프로세스에서 자기 시계로 돈다. 이 파일이 하는 일은 넷뿐이다.
//   1. 내가 누구인지 정해 이어짐에 실어 보낸다 (C004)
//   2. 받은 관찰 결과를 그린다 (마지막으로 받은 것이 화면이다)
//   3. 입력을 Action Request 로 만들어 세계로 보낸다
//   4. 이어짐 상태를 표시한다
//
// world/ 를 import 하지 않는다 — 이제는 규율이 아니라 물리적 사실이다.

import { TRANSPORT_PATH } from '../protocol/transport';
import { createHud, type EntityLabel, type EntityPlate, type StrikeMark } from '../view/hud/hud';
import { attachInput } from '../view/input/input';
import { attachKeyboard } from '../view/input/keyboard';
import { browserIdentityStorage, resolveObserverId } from '../view/net/observer-identity';
import { browserSocketFactory, createWorldLink } from '../view/net/world-link';
import { bindingLines, telemetryLines } from '../view/presentation/link-presentation';
import { resolvePresentation } from '../view/presentation/resolve';
import { sessionPresentation } from '../view/presentation/session-presentation';
import { createRenderer } from '../view/renderer/renderer';
import type { SceneState } from '../view/scene/scene-state';

const container = document.getElementById('game');
if (!container) throw new Error('#game 컨테이너가 없다');

// 내가 누구인지 — 보관해 두었던 것이 있으면 그것을, 없으면 하나 만들어 보관한다.
// 다시 이을 때 같은 것을 밝히므로 같은 몸으로 돌아온다 (C004).
const observerId = resolveObserverId(browserIdentityStorage());

const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const worldAddress = `${wsProtocol}//${location.host}${TRANSPORT_PATH}`;
const link = createWorldLink(
  browserSocketFactory(worldAddress),
  observerId,
  undefined,
  undefined,
  worldAddress, // C005 binding.worldAddress — 어느 세계에 이어져 있는가
);

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
  strikes: [],
  worldTime: 0,
};

let latestScene: SceneState = EMPTY_SCENE;
attachInput(renderer, (action) => link.send(action), () => latestScene);

// WASD 연속 이동 — 진행 방향의 조금 앞 지점을 요청한다. 판정은 세계가 한다.
// C003: 매 프레임이 아니라 일정 간격으로 보낸다 — 요청은 이제 선을 타고 간다.
const KEY_LOOKAHEAD = 1.6;
const MOVE_REQUEST_INTERVAL = 0.1;
let moveRequestCooldown = 0;
let wasKeyMoving = false;

// 충돌체 디버그 관찰 (C006) — 켜고 끄는 것은 관찰자의 선택이다. 기본 off.
// World 에 아무것도 요청하지 않는다 — 이미 와 있는 관찰값을 보일지만 정한다.
const DEBUG_OBSERVE_KEY = 'KeyC';
let debugObserve = false;

// 속성 관찰 (C007 R2 — 04 debugAuthority.inspect) — 세계는 이미 모든 속성을 보내고 있다.
// 이 토글은 그것을 몸 위에 펼쳐 볼지만 정한다. World 에 아무것도 요청하지 않는다.
const INSPECT_KEY = 'KeyV';
let inspect = false;

// 이동 모드 (C007) — 요청은 토글이 아니라 명시값이므로(walk | run),
// 지금 무엇인지를 보고 반대값을 보낸다. 정하는 것은 세계다.
const MOVE_MODE_KEYS = ['ShiftLeft', 'ShiftRight'];

// 타격 결과가 화면에 떠 있는 시간 — 세계의 STRIKE_EVENT_TTL 과 같은 값을 볼 필요는 없다.
// 세계가 보내 주는 동안 그리고, 나이에 따라 옅어질 뿐이다.
const STRIKE_FADE_SECONDS = 1.2;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // 조용히 죽은 이어짐을 걷어낸다 — 관찰 결과가 끊기면 그것이 끊김이다
  link.poll(Date.now());

  // 화면은 마지막으로 받은 관찰 결과다 (04-gameview.spec.yaml delivery: pushed)
  const snapshot = link.latest();
  latestScene = snapshot
    ? resolvePresentation(snapshot, undefined, { debugObserve, inspect })
    : EMPTY_SCENE;

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
    if (code === DEBUG_OBSERVE_KEY) {
      debugObserve = !debugObserve;
      continue;
    }
    if (code === INSPECT_KEY) {
      inspect = !inspect;
      continue;
    }
    // 이동 모드 (C007) — 값을 실어 보내야 하므로 여기서 직접 다룬다.
    // 세계가 지금 무엇이라고 알려 주었는지를 보고 그 반대를 요청한다.
    if (MOVE_MODE_KEYS.includes(code)) {
      const moveMode = latestScene.interactions.find((i) => i.id === 'move-mode');
      if (moveMode) {
        const current = latestScene.self?.moveModeCode ?? 'walk';
        link.send({ interactionId: moveMode.id, mode: current === 'run' ? 'walk' : 'run' });
      }
      continue;
    }
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

  // 존재 HUD (C007) — 이름과 생명을 그 몸 위에 붙인다.
  // 얼마나 띄울지는 결정 Layer 가 그 존재의 그림 크기로 정해 두었다 (nameplate.anchorHeight).
  const plates: EntityPlate[] = [];
  for (const entity of latestScene.entities) {
    if (!entity.nameplate) continue;
    const screen = renderer.worldToScreen(
      entity.position.x,
      entity.position.z,
      entity.nameplate.anchorHeight,
    );
    if (!screen) continue;
    plates.push({
      x: screen.x,
      y: screen.y,
      ...entity.nameplate,
      ...(entity.inspect ? { inspect: entity.inspect } : {}),
    });
  }

  // 타격 결과 (C007) — 맞은 자리에서 떠오르며 옅어진다. 나이는 세계 시각으로 잰다.
  const strikes: StrikeMark[] = [];
  for (const strike of latestScene.strikes) {
    const screen = renderer.worldToScreen(
      strike.position.x,
      strike.position.z,
      strike.anchorHeight,
    );
    if (!screen) continue;
    const age = Math.max(0, Math.min(1, (latestScene.worldTime - strike.since) / STRIKE_FADE_SECONDS));
    strikes.push({ x: screen.x, y: screen.y, text: strike.text, emphasis: strike.emphasis, age });
  }
  // 이어짐의 수치와 신원 (C005) — 세계에서 오는 것은 acknowledgedMark 하나뿐이고
  // 나머지는 link 가 관찰자 쪽 시계로 잰 것이다.
  const nowMs = Date.now();
  hud.render(
    latestScene,
    labels,
    sessionPresentation(
      link.state(),
      link.stale(),
      telemetryLines(link.telemetry(nowMs)),
      bindingLines({
        observerId,
        characterId: snapshot?.observer.characterId ?? '—',
        worldAddress: link.address(),
      }),
    ),
    { plates, strikes },
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
