// Client 조립 루트 — 여기에는 세계가 없다.
//
// 세계는 다른 프로세스에서 자기 시계로 돈다. 이 파일이 하는 일은 넷뿐이다.
//   1. 내가 누구인지 정해 이어짐에 실어 보낸다
//   2. 받은 관찰 결과를 그린다 (마지막으로 받은 것이 화면이다)
//   3. 입력을 Action Request 로 만들어 세계로 보낸다
//   4. 이어짐 상태를 표시한다
//
// world/ 를 import 하지 않는다 — 이제는 규율이 아니라 물리적 사실이다.
// 컨텐츠는 content/active-view 하나로만 닿는다 (경계 규칙 3) —
// 이 파일은 어느 팩이 실렸는지 알지 못한다.

import { TRANSPORT_PATH } from '../engine/protocol-core/transport';
import { registerSprites } from '../engine/view-kernel/assets/registry';
import { createCommandConsole } from '../engine/view-kernel/hud/command-console';
import { createHud, type EntityLabel, type EntityPlate, type StrikeMark } from '../engine/view-kernel/hud/hud';
import { dispatchKey } from '../engine/view-kernel/input/bindings';
import { attachInput } from '../engine/view-kernel/input/input';
import { attachKeyboard } from '../engine/view-kernel/input/keyboard';
import { attachPointerLook } from '../engine/view-kernel/input/pointer';
import type { ScreenSide } from '../engine/view-kernel/presentation/facing-presentation';
import { browserIdentityStorage, resolveObserverId } from '../engine/view-kernel/net/observer-identity';
import { browserSocketFactory, createWorldLink } from '../engine/view-kernel/net/world-link';
import { bindingLines, telemetryLines } from '../engine/view-kernel/presentation/link-presentation';
import {
  invocationOf,
  type ObserverCommandId,
} from '../engine/view-kernel/presentation/command-presentation';
import { sessionPresentation } from '../engine/view-kernel/presentation/session-presentation';
import { createRenderer } from '../engine/view-kernel/renderer/renderer';
import type { SceneCommandHistoryLine, SceneState } from '../engine/view-kernel/scene/scene-state';
import {
  KEY_BINDINGS,
  SPRITE_SHEET,
  codeText,
  commandActionRequest,
  resolvePresentation,
} from '../content/active-view';

const container = document.getElementById('game');
if (!container) throw new Error('#game 컨테이너가 없다');

// 내가 누구인지 — 보관해 두었던 것이 있으면 그것을, 없으면 하나 만들어 보관한다.
// 다시 이을 때 같은 것을 밝히므로 같은 몸으로 돌아온다.
const observerId = resolveObserverId(browserIdentityStorage());

const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const worldAddress = `${wsProtocol}//${location.host}${TRANSPORT_PATH}`;
const link = createWorldLink(
  browserSocketFactory(worldAddress),
  observerId,
  undefined,
  undefined,
  worldAddress, // binding.worldAddress — 어느 세계에 이어져 있는가
);

// 그림표는 컨텐츠의 것이다 — 기반은 등록된 것을 그릴 뿐이다 (P3).
registerSprites(SPRITE_SHEET);

const renderer = createRenderer(container);
const hud = createHud(container);
// 명령 표면 — 타이핑을 받는 동안 이동·시점·행동 입력이 몸에 닿지 않는다
// (04 commandSurface.inputCapture).
const commandConsole = createCommandConsole(container, {
  onText: (text) => {
    commandText = text;
  },
  onSubmit: () => submitCommand(),
  onClose: () => {
    commandOpen = false;
    commandText = '';
  },
});
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
  commandSurface: {
    open: false,
    closeText: codeText('command.close'),
    entries: [],
    composition: { text: '', candidates: [], suggestions: [], submittable: false },
    history: [],
  },
  // 기반의 범용 capability 자리들 — 이 세계는 아직 아무것도 올리지 않는다
  effects: [],
  surfaces: [],
  slotBars: [],
  zones: [],
};

let latestScene: SceneState = EMPTY_SCENE;
// 명령을 쓰는 동안에는 화면을 눌러도 몸이 움직이지 않는다
// (04 commandSurface.inputCapture.suspends: interactions.move · skill).
attachInput(
  renderer,
  (action) => (commandConsole.capturing() ? false : link.send(action)),
  () => latestScene,
);

// 시점 조작 — 세계로 나가지 않는다. 관찰자가 자기 방향을 바꿀 뿐이다.
// 명령을 쓰는 동안에는 시점도 돌아가지 않는다.
attachPointerLook(renderer.domElement, (dTurn, dTilt) => {
  if (commandConsole.capturing()) return;
  renderer.turnView(dTurn, dTilt);
});
const KEY_TURN_RATE = 1.8; // rad/s — 키로 도는 빠르기
const KEY_TILT_RATE = 1.0;

// 직전 프레임에 각 몸이 어느 쪽으로 읽혔는지 (04 entities.character.facing.ambiguous).
// 정면·정후면을 향해 좌우가 흐려지는 구간에서 그림이 깜빡이지 않게 하는 기준이다.
let facingSides: Record<string, ScreenSide> = {};

// WASD 연속 이동 — 진행 방향의 조금 앞 지점을 요청한다. 판정은 세계가 한다.
// 매 프레임이 아니라 일정 간격으로 보낸다 — 요청은 이제 선을 타고 간다.
const KEY_LOOKAHEAD = 1.6;
const MOVE_REQUEST_INTERVAL = 0.1;
let moveRequestCooldown = 0;
let wasKeyMoving = false;

// 충돌체 디버그 관찰 — 켜고 끄는 것은 관찰자의 선택이다. 기본 off.
// World 에 아무것도 요청하지 않는다 — 이미 와 있는 관찰값을 보일지만 정한다.
// 같은 것을 명령으로도 켤 수 있다 (04 observerCommands[collider-observe]).
// 키는 아는 사람의 지름길이고, 명령 목록이 처음 보는 사람의 길이다.
const DEBUG_OBSERVE_KEY = 'KeyC';
let debugObserve = false;

// 속성 관찰 (04 debugAuthority.inspect) — 세계는 이미 모든 속성을 보내고 있다.
// 이 토글은 그것을 몸 위에 펼쳐 볼지만 정한다. World 에 아무것도 요청하지 않는다.
const INSPECT_KEY = 'KeyV';
let inspect = false;

// ── 명령 표면 (04 commandSurface) ────────────────────────────
//
// 관찰자가 쥐는 상태다. 세계는 이것을 알지 못한다 —
// 열려 있는지도, 무엇을 쓰고 있는지도, 무엇을 주고받았는지도.
const COMMAND_OPEN_KEY = 'Slash'; // 여는 키. 표면 자체가 무엇을 할 수 있는지 알려 준다
const COMMAND_HISTORY_LIMIT = 40;
let commandOpen = false;
let commandText = '';
const commandHistory: SceneCommandHistoryLine[] = [];
// 어느 기록 줄이 어느 요청의 대답을 기다리는가 (04 requestOutcome.mark).
const awaitingOutcome = new Map<number, SceneCommandHistoryLine>();

function pushHistory(line: SceneCommandHistoryLine): SceneCommandHistoryLine {
  commandHistory.push(line);
  if (commandHistory.length > COMMAND_HISTORY_LIMIT) commandHistory.shift();
  return line;
}

function setObserverCommand(id: ObserverCommandId): string {
  // 세계로 나가지 않는다 (04 observerCommands.worldKnows: false).
  if (id === 'collider-observe') {
    debugObserve = !debugObserve;
    return debugObserve ? '켰다' : '껐다';
  }
  inspect = !inspect;
  return inspect ? '켰다' : '껐다';
}

function submitCommand(): void {
  const text = commandText.trim();
  if (text.length === 0) return;

  const snapshot = link.latest();
  const invocation = invocationOf(
    text,
    latestScene.commandSurface.entries,
    snapshot,
    { 'collider-observe': debugObserve, 'attribute-inspect': inspect },
    codeText,
  );

  if (invocation.kind === 'rejected') {
    // 잘못 걸린 것이 아무 일 없이 사라지지 않는다 (04 commandSurface.guide.onMistake).
    pushHistory({ text, answer: invocation.problem, accepted: false });
  } else if (invocation.kind === 'observer') {
    pushHistory({ text, answer: setObserverCommand(invocation.commandId), accepted: true });
  } else {
    const action = commandActionRequest(invocation.commandId, invocation.values);
    const mark = action ? link.sendMarked(action) : null;
    // 대답이 올 때까지 기다리는 줄로 남는다 — 세계가 판정해야 answer 가 채워진다.
    const line = pushHistory({ text });
    if (mark === null) line.answer = '세계에 이어져 있지 않다';
    else awaitingOutcome.set(mark, line);
  }

  commandText = '';
}

// 세계의 대답을 기록에 붙인다 (04 requestOutcome).
// 표식이 없는 대답도 버리지 않는다 — 마지막 줄에 붙인다.
function drainOutcomes(): void {
  for (const outcome of link.takeOutcomes()) {
    const line =
      outcome.mark !== undefined
        ? awaitingOutcome.get(outcome.mark)
        : commandHistory[commandHistory.length - 1];
    if (outcome.mark !== undefined) awaitingOutcome.delete(outcome.mark);
    if (!line) continue;
    line.accepted = outcome.accepted;
    line.answer = outcome.accepted
      ? '받아들여졌다'
      : codeText(outcome.reason ?? 'unknown-interaction');
  }
}

// 타격 결과가 화면에 떠 있는 시간 — 세계의 STRIKE_EVENT_TTL 과 같은 값을 볼 필요는 없다.
// 세계가 보내 주는 동안 그리고, 나이에 따라 옅어질 뿐이다.
const STRIKE_FADE_SECONDS = 1.2;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // 조용히 죽은 이어짐을 걷어낸다 — 관찰 결과가 끊기면 그것이 끊김이다
  link.poll(Date.now());
  // 세계의 대답을 받아 기록에 붙인다. 관찰 결과와 다른 자리다.
  drainOutcomes();

  // 시점 조작 — 그리기 전에 방향을 먼저 정한다. 이번 프레임의 좌우 읽기가
  // 이 방향을 기준으로 이루어져야 화면과 어긋나지 않는다.
  const capturing = commandConsole.capturing();
  const turning = capturing ? null : keyboard.turn();
  if (turning) {
    renderer.turnView(turning.turn * KEY_TURN_RATE * dt, turning.tilt * KEY_TILT_RATE * dt);
  }

  // 화면은 마지막으로 받은 관찰 결과다 (04-gameview.spec.yaml delivery: pushed)
  const snapshot = link.latest();
  // 아직 세계에서 아무것도 오지 않았어도 명령 표면은 열린다 — 다만 목록은 비어 있다.
  // 세계가 밝히지 않은 명령을 View 가 지어내지 않기 때문이다.
  EMPTY_SCENE.commandSurface.open = commandOpen;
  EMPTY_SCENE.commandSurface.composition.text = commandText;
  latestScene = snapshot
    ? resolvePresentation(snapshot, undefined, {
        debugObserve,
        inspect,
        viewTurn: renderer.viewTurn(),
        facingSides,
        command: { open: commandOpen, text: commandText, history: commandHistory },
      })
    : EMPTY_SCENE;

  // 이번 프레임에 읽힌 좌우를 다음 프레임의 기준으로 남긴다.
  // 사라진 몸은 함께 사라진다 — 다시 나타나면 그림 기준 방향에서 다시 읽는다.
  const readSides: Record<string, ScreenSide> = {};
  for (const entity of latestScene.entities) {
    if (entity.facingSide) readSides[entity.id] = entity.facingSide;
  }
  facingSides = readSides;

  const terrain = latestScene.interactions.find((i) => i.terrainTarget);
  const self = latestScene.entities.find((e) => e.cameraFollow);

  moveRequestCooldown -= dt;
  const dir = capturing ? null : keyboard.direction();
  if (dir && terrain && self) {
    wasKeyMoving = true;
    if (moveRequestCooldown <= 0) {
      moveRequestCooldown = MOVE_REQUEST_INTERVAL;
      // 앞은 세계의 축이 아니라 지금 보고 있는 쪽이다.
      // 세계 좌표로 환산해 보내므로 세계는 무엇을 기준으로 정했는지 알지 못한다.
      const heading = renderer.viewWorldDirection(dir);
      link.send({
        interactionId: terrain.id,
        position: {
          x: self.position.x + heading.x * KEY_LOOKAHEAD,
          z: self.position.z + heading.z * KEY_LOOKAHEAD,
        },
      });
    }
  } else if (!dir && wasKeyMoving) {
    // 멈춤 — 아무것도 보내지 않는다.
    //
    // 예전에는 "마지막으로 관찰한 자리로 가라"를 보내 그 자리에 세웠다. 그런데 그 자리는
    // 이미 지나온 자리다 (관찰은 세계보다 한 걸음 늦게 도착한다). 그래서 몸이 뒤로 한 걸음
    // 돌아왔고, 움직인 방향이 몸 방향이므로(RULE-BODY-FACING-001) 멈출 때마다
    // 뒤를 돌아봤다 — 그림도 휘두름도 함께 뒤를 향했다.
    //
    // 마지막으로 요청한 목적지는 늘 몸보다 앞에 있다. 그리로 가다 도착하면 스스로 멈춘다
    // (RULE-MOVE-PROGRESS-001 Arrived). 가던 쪽을 향한 채 서는 것이 이 Cycle 이 필요로 하는
    // 상태이고, 세계에 새 규칙을 더하지 않고 얻을 수 있는 가장 단순한 방법이다.
    wasKeyMoving = false;
    moveRequestCooldown = 0;
  }

  for (const code of keyboard.consumeKeyPresses()) {
    // 명령 표면을 연다. 열려 있는 동안 다른 키는 몸에 닿지 않는다 —
    // 콘솔이 자기 입력에서 키를 잡아 두므로 여기까지 오지 않는다.
    if (code === COMMAND_OPEN_KEY) {
      commandOpen = !commandOpen;
      if (!commandOpen) commandText = '';
      continue;
    }
    if (capturing) continue;
    if (code === DEBUG_OBSERVE_KEY) {
      debugObserve = !debugObserve;
      continue;
    }
    if (code === INSPECT_KEY) {
      inspect = !inspect;
      continue;
    }
    // 팩의 특수 키 규칙 (P3 — 이동 모드처럼 장면을 읽고 요청을 고르는 것들).
    // 조립은 무엇이 골라지는지 모른다 — 가져갔으면 여기서 멈춘다.
    if (dispatchKey(KEY_BINDINGS, code, latestScene, (action) => link.sendMarked(action))) {
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
  commandConsole.render(latestScene.commandSurface);

  const labels: EntityLabel[] = [];
  for (const entity of latestScene.entities) {
    if (entity.label === undefined) continue;
    const screen = renderer.worldToScreen(entity.position.x, entity.position.z, 4.2);
    if (screen) labels.push({ id: entity.id, x: screen.x, y: screen.y, text: entity.label });
  }

  // 존재 HUD — 이름과 생명을 그 몸 위에 붙인다.
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
      id: entity.id,
      x: screen.x,
      y: screen.y,
      ...entity.nameplate,
      ...(entity.inspect ? { inspect: entity.inspect } : {}),
    });
  }

  // 타격 결과 — 맞은 자리에서 떠오르며 옅어진다. 나이는 세계 시각으로 잰다.
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
  // 이어짐의 수치와 신원 — 세계에서 오는 것은 acknowledgedMark 하나뿐이고
  // 나머지는 link 가 관찰자 쪽 시계로 잰 것이다.
  const nowMs = Date.now();
  hud.render(
    latestScene,
    labels,
    sessionPresentation(
      link.state(),
      link.stale(),
      // 계량과 신원을 부르는 말도 팩의 것이다 (문구 반전 ⑤)
      telemetryLines(link.telemetry(nowMs), codeText),
      bindingLines(
        {
          observerId,
          characterId: snapshot?.observer.characterId ?? '—',
          worldAddress: link.address(),
        },
        codeText,
      ),
      codeText,
    ),
    { plates, strikes },
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
