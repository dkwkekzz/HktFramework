// Client 조립 루트 (C003 · C004) — 여기에는 세계가 없다.
//
// 세계는 다른 프로세스에서 자기 시계로 돈다. 이 파일이 하는 일은 넷뿐이다.
//   1. 내가 누구인지 정해 이어짐에 실어 보낸다 (C004)
//   2. 받은 관찰 결과를 그린다 (마지막으로 받은 것이 화면이다)
//   3. 입력을 Action Request 로 만들어 세계로 보낸다
//   4. 이어짐 상태를 표시한다
//
// world/ 를 import 하지 않는다 — 이제는 규율이 아니라 물리적 사실이다.

import { TRANSPORT_PATH } from '../engine/protocol-core/transport';
import { createCommandConsole } from '../engine/view-kernel/hud/command-console';
import { createSurfaceLayer } from '../engine/view-kernel/hud/surface';
import { createHud, type EntityLabel, type EntityPlate, type StrikeMark } from '../engine/view-kernel/hud/hud';
import { createSlotBarLayer } from '../engine/view-kernel/hud/slot-bar';
import { createTouchPad } from '../engine/view-kernel/hud/touch-pad';

import { attachInput } from '../engine/view-kernel/input/input';
import { engineKeyCode } from '../engine/view-kernel/input/engine-keys';
import { attachKeyboard } from '../engine/view-kernel/input/keyboard';
import { attachPointerLook } from '../engine/view-kernel/input/pointer';
import { attachTouchControls } from '../engine/view-kernel/input/touch';
import type { ScreenSide } from '../engine/view-kernel/presentation/facing-presentation';
import { browserIdentityStorage, resolveObserverId } from '../engine/view-kernel/net/observer-identity';
import { browserSocketFactory, createWorldLink } from '../engine/view-kernel/net/world-link';
import { bindingLines, telemetryLines } from '../engine/view-kernel/presentation/link-presentation';

import {
  invocationOf,
  type ObserverCommandId,
} from '../engine/view-kernel/presentation/command-presentation';
import {
  codeText,
  commandActionRequest,
  EFFECT_SET,
  EMPTY_EFFECT_MEMORY,
  closeSurface,
  commitCell,
  forgetPending,
  menuCell,
  pickCell,
  pressRow,
  typeInto,
  KEY_BINDINGS,
  NO_SKILL_ANSWERS,
  rememberForEffects,
  resolvePresentation,
  settleOutcome,
  skillInteractionIds,
  SPRITE_SHEET,
  type EffectMemory,
  type SkillAnswer,
} from '../content/active-view';
import { registerSprites } from '../engine/view-kernel/assets/registry';
import { sessionPresentation } from '../engine/view-kernel/presentation/session-presentation';
import { createRenderer } from '../engine/view-kernel/renderer/renderer';
import type { SceneCommandHistoryLine, SceneState } from '../engine/view-kernel/scene/scene-state';

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

// 팩의 스프라이트 표를 그리기 장치에 등록한다 (P3 — 설계 반전 ⑤)
registerSprites(SPRITE_SHEET);

// 이펙트 (F1) — 어떤 이펙트를 올릴지는 컨텐츠의 예산 결정이므로 여기서 넣어 준다.
// 그리기 능력은 이 목록이 무엇을 뜻하는지 모른다 (engine/view-kernel/fx).
const renderer = createRenderer(container, {
  effects: {
    names: [...EFFECT_SET],
    onUnavailable: (reason) => console.info(`[이펙트] 없이 그린다 — ${reason}`),
  },
});
const hud = createHud(container);
// 명령 표면 (C009) — 타이핑을 받는 동안 이동·시점·행동 입력이 몸에 닿지 않는다
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
// 겹침 표면 (기반 capability) — 무엇이 열려 있는지는 결정 Layer 가 쥐고,
// 여기는 그리는 능력을 붙이고 닫기를 그쪽으로 돌려보낼 뿐이다 (반전 ⑤).
// V-004 — 눌린 칸·줄의 id 를 팩으로 그대로 넘긴다. 조립은 그 칸이 무엇인지도,
// 한 번 누름이 무슨 뜻인지도 알지 못한다 (슬롯 띠가 세운 규칙과 같다).
// 표면이 쓰는 말(닫기·빈 자리·상태)도 팩의 것이다 — 조립은 표를 넘길 뿐이다.
const surfaces = createSurfaceLayer(
  container,
  {
    onClose: (id) => closeSurface(id),
    // 쳐 넣은 글자가 무슨 뜻인지 조립은 알지 못한다 — 그 자리의 id 와 글자를 넘길 뿐이다
    // (눌린 칸·줄을 넘기는 것과 같은 규칙이다).
    onFieldInput: (surfaceId, fieldId, text) => typeInto(surfaceId, fieldId, text),
    onPickCell: (surfaceId, cellId) => pickCell(surfaceId, cellId),
    onCommitCell: (surfaceId, cellId) =>
      commitCell(surfaceId, cellId, (action) => link.sendMarked(action)),
    onMenuCell: (surfaceId, cellId) => menuCell(surfaceId, cellId),
    onPressRow: (surfaceId, rowId) =>
      pressRow(surfaceId, rowId, (action) => link.sendMarked(action)),
  },
  codeText,
);
// 늘 서 있는 칸 띠 (C027) — 눌린 칸은 **키가 부른 것과 같은 요청**이 된다.
// 조립은 그 칸이 무엇인지 모른다 — id 가 곧 interactionId 다.
const slotBars = createSlotBarLayer(
  container,
  { onPress: (cellId) => requestInteraction(cellId) },
  codeText,
);

const keyboard = attachKeyboard();

// 아직 세계로부터 아무것도 받지 못한 동안의 화면 — 빈 세계를 그린다.
const EMPTY_SCENE: SceneState = {
  specId: 'pending',
  terrain: 'mining-field',
  entities: [],
  interactions: [],
  hud: [],
  strikes: [],
  effects: [],
  worldTime: 0,
  surfaces: [],
  slotBars: [],
  commandSurface: {
    open: false,
    // 아직 아무것도 받지 못한 화면 — 표면이 열리지 않으므로 이 말은 쓰이지 않는다.
    // 그래도 팩의 표에서 가져온다: 조립이 사람이 읽을 말을 짓는 자리는 없다
    closeText: codeText('command.close'),
    entries: [],
    composition: { text: '', candidates: [], suggestions: [], submittable: false },
    history: [],
  },
};

let latestScene: SceneState = EMPTY_SCENE;

// 손가락 조작 — 키보드도 마우스 버튼도 없는 기기에서 세계를 만진다.
// 세계로 가는 것은 키보드일 때와 똑같은 요청이다. 세계는 무엇이 자기를 만졌는지 모른다.
const touch = attachTouchControls(renderer.domElement, (dTurn, dTilt) => {
  if (commandConsole.capturing() || surfaces.capturing()) return;
  renderer.turnView(dTurn, dTilt);
});
// 관찰 토글 버튼의 이름도 팩의 것이다 — 조작 안내 줄과 **같은 문구 코드**를 읽는다
const touchPad = createTouchPad(container, codeText);
// 손가락을 쓰는 기기인가 — 기기 이름(UA)을 묻지 않고 무엇으로 가리키는지만 본다.
// 아니어도 손가락이 한 번 닿으면 그때부터 조작 자리가 나타난다 (touch.engaged()).
const COARSE_POINTER = window.matchMedia?.('(pointer: coarse)').matches ?? false;

// C009 — 명령을 쓰는 동안에는 화면을 눌러도 몸이 움직이지 않는다
// (04 commandSurface.inputCapture.suspends: interactions.move · skill).
// 그리고 시점을 끌고 난 손가락은 지목이 아니다 — 끌기 끝에 따라오는 click 을 흘린다.
attachInput(
  renderer,
  (action) =>
    commandConsole.capturing() || surfaces.capturing() || touch.tapSuppressed(performance.now())
      ? false
      : link.send(action),
  () => latestScene,
);

// 시점 조작 (C008) — 세계로 나가지 않는다. 관찰자가 자기 방향을 바꿀 뿐이다.
// C009 — 명령을 쓰는 동안에는 시점도 돌아가지 않는다.
attachPointerLook(renderer.domElement, (dTurn, dTilt) => {
  if (commandConsole.capturing() || surfaces.capturing()) return;
  renderer.turnView(dTurn, dTilt);
});
const KEY_TURN_RATE = 1.8; // rad/s — 키로 도는 빠르기
const KEY_TILT_RATE = 1.0;

// 직전 프레임에 각 몸이 어느 쪽으로 읽혔는지 (04 entities.character.facing.ambiguous).
// 정면·정후면을 향해 좌우가 흐려지는 구간에서 그림이 깜빡이지 않게 하는 기준이다.
let facingSides: Record<string, ScreenSide> = {};

// 직전 관찰 결과에서 기억해 둔 값들 (F1) — 세계가 사건으로 보내지 않는 이펙트
// (채굴 · 알게 됨)는 두 관찰 결과의 *차이*로만 읽힌다. facingSides 와 같은 규칙이다.
let effectMemory: EffectMemory = EMPTY_EFFECT_MEMORY;

// WASD 연속 이동 — 진행 방향의 조금 앞 지점을 요청한다. 판정은 세계가 한다.
// C003: 매 프레임이 아니라 일정 간격으로 보낸다 — 요청은 이제 선을 타고 간다.
const KEY_LOOKAHEAD = 1.6;
const MOVE_REQUEST_INTERVAL = 0.1;
let moveRequestCooldown = 0;
let wasDirectionMoving = false;

// 충돌체 디버그 관찰 (C006) — 켜고 끄는 것은 관찰자의 선택이다. 기본 off.
// World 에 아무것도 요청하지 않는다 — 이미 와 있는 관찰값을 보일지만 정한다.
// C009 — 같은 것을 명령으로도 켤 수 있다 (04 observerCommands[collider-observe]).
// 키는 아는 사람의 지름길이고, 명령 목록이 처음 보는 사람의 길이다.
//
// 키 코드는 **기반이 소유한다** (engine-keys.ts) — 조립이 손으로 적어 두면 팩의
// "남이 먼저 가져간 키" 검사가 읽을 원본이 없다.
const DEBUG_OBSERVE_KEY = engineKeyCode('colliderObserve');
let debugObserve = false;

// 속성 관찰 (C007 R2 — 04 debugAuthority.inspect) — 세계는 이미 모든 속성을 보내고 있다.
// 이 토글은 그것을 몸 위에 펼쳐 볼지만 정한다. World 에 아무것도 요청하지 않는다.
const INSPECT_KEY = engineKeyCode('attributeInspect');
let inspect = false;

// ── 명령 표면 (C009 — 04 commandSurface) ────────────────────────────
//
// 관찰자가 쥐는 상태다. 세계는 이것을 알지 못한다 —
// 열려 있는지도, 무엇을 쓰고 있는지도, 무엇을 주고받았는지도.
const COMMAND_OPEN_KEY = engineKeyCode('command'); // 여는 키. 표면 자체가 무엇을 할 수 있는지 알려 준다
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
    codeText, // 거절의 말도 팩의 것이다 (문구 반전 ⑤)
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

// ── 내가 건 기술 요청 (C027) ────────────────────────────────
//
// 세계는 도착한 **모든** 요청에 대답한다 (RULE-REQUEST-REPLY-001 — Precondition 없음).
// 그런데 지금까지 그 대답을 받아 갈 자리를 가진 것은 명령뿐이었고, 기술은 표식 없이
// 나갔다. 그래서 기술이 거절되어도 화면에서는 아무 일도 일어나지 않았다 —
// 눌렀는데 몸이 안 움직인 것과 세계가 거절한 것이 같아 보였다.
//
// 표식이 그 둘을 가른다. 세계는 표식을 해석하지 않고 되돌릴 뿐이므로
// (04 requestOutcome), 어느 대답이 어느 요청의 것인지 짚는 것은 이쪽의 일이다.

/** 표식 → 그 표식을 달고 나간 기술의 interactionId */
const pendingSkills = new Map<number, string>();
/** 기술 id → 그 기술에 마지막으로 일어난 일. resolvePresentation 으로 내려간다 */
const skillAnswers = new Map<string, SkillAnswer>();
/**
 * 받아들여진 것이 칸에 남아 있는 시간 (ms).
 *
 * 받아들여진 요청은 곧 세계의 관찰 결과가 스스로 말한다 — 몸이 움직이고 기력이 준다.
 * 그러므로 이 표시는 잠깐이면 된다. **가장 긴 기술의 행동 길이(0.9초)보다 조금 길게**
 * 잡는다 — 나가는 동안 "나갔다" 가 떠 있고, 끝나면 세계의 지금이 자리를 돌려받는다.
 *
 * **거절은 시간으로 걷지 않는다.** 거절이 물러나는 것은 시간이 아니라 세계가 다시
 * 다른 말을 할 때다 (skill-presentation 의 `rejectionStillHolds`).
 */
const SKILL_ACCEPTED_MS = 1200;
const acceptedUntil = new Map<string, number>();

/** 기술 요청을 표식과 함께 보낸다 — 닿지 못한 것도 거절과 다른 사정으로 남긴다 */
function sendSkill(action: { interactionId: string; targetEntityId?: string }): void {
  const mark = link.sendMarked(action);
  acceptedUntil.delete(action.interactionId);
  if (mark === null) {
    skillAnswers.set(action.interactionId, { state: 'unsent' });
    return;
  }
  pendingSkills.set(mark, action.interactionId);
  skillAnswers.set(action.interactionId, { state: 'pending' });
}

/**
 * 끊겼을 때 기다리던 기술 요청을 잊는다 (C027).
 *
 * 오지 않을 대답을 기다리면 그 칸은 영영 `요청 중` 이다 — 그것은 **일어나지 않은 것을
 * 관찰하는 것**이며 INTENT-NOTHING-BEFORE-THE-WORLD-SAYS-SO-001 이 막는 상태다.
 * 대신 닿지 못했음을 남긴다 — 거절과 다른 사정이기 때문이다.
 */
function forgetPendingSkills(): void {
  for (const skillId of pendingSkills.values()) skillAnswers.set(skillId, { state: 'unsent' });
  pendingSkills.clear();
}

/** 지금 관찰된 것 중 무엇이 기술인가 — 프레임마다 갱신된다 (C027) */
let skillIds = new Set<string>();

/**
 * 하나의 요청이 나가는 **유일한 자리** (C027).
 *
 * 키가 불렀든, 손가락 버튼이 불렀든, 띠의 칸이 눌렸든 전부 여기로 온다.
 * 그래서 입력 수단마다 다른 규칙이 생길 길 자체가 없다
 * (INTENT-SKILL-INPUT-CONVERGES-001 · VUX-SK-V-02).
 *
 * 조립은 그 id 가 무엇인지 모른다 — 기술인지 아닌지는 팩이 답한다.
 */
function requestInteraction(interactionId: string): void {
  const interaction = latestScene.interactions.find((i) => i.id === interactionId);
  if (!interaction) return;
  const action = {
    interactionId: interaction.id,
    ...(interaction.targetEntityId ? { targetEntityId: interaction.targetEntityId } : {}),
  };
  // 기술이면 표식을 달고 나간다 — 그래야 그 대답이 그 칸으로 돌아온다.
  if (skillIds.has(interaction.id)) sendSkill(action);
  else link.send(action);
}

/** 잠깐만 머무는 표시를 걷는다 — 거절은 걷지 않는다 */
function ageSkillAnswers(nowMs: number): void {
  for (const [id, until] of acceptedUntil) {
    if (nowMs < until) continue;
    acceptedUntil.delete(id);
    if (skillAnswers.get(id)?.state === 'accepted') skillAnswers.delete(id);
  }
}

// 세계의 대답을 그것을 부른 자리에 붙인다 (04 requestOutcome).
//
// **표식 없는 대답은 아무 자리에도 붙이지 않는다.** 짚을 수 없는 대답을 마지막 줄에
// 붙이던 예전 방식은, 기술이 표식 없이 나가던 탓에 남의 요청의 결과를 명령 기록이
// 자기 것처럼 말하게 만들었다 (02 AFFECTED).
function drainOutcomes(nowMs: number): void {
  for (const outcome of link.takeOutcomes()) {
    // C026 — 소지품 작업 공간의 요청이면 그 기다림을 푼다.
    if (settleOutcome(outcome.mark)) continue;

    // **표식 없는 대답은 아무 자리에도 붙이지 않는다** (C027).
    // 예전에는 명령 기록의 마지막 줄에 붙였는데, 명령은 언제나 표식을 달고 나가므로
    // 그 갈래가 잡아내던 것은 처음부터 **남의 요청의 대답**뿐이었다. 기술이 표식 없이
    // 나가던 동안, 명령을 한 번 쓴 뒤 기술이 거절되면 그 사유가 명령 줄에 붙었다.
    if (outcome.mark === undefined) continue;

    // C027 — 기술 요청의 대답이면 그 기술의 칸으로 간다.
    const skillId = pendingSkills.get(outcome.mark);
    if (skillId !== undefined) {
      pendingSkills.delete(outcome.mark);
      if (outcome.accepted) {
        skillAnswers.set(skillId, { state: 'accepted' });
        acceptedUntil.set(skillId, nowMs + SKILL_ACCEPTED_MS);
      } else {
        skillAnswers.set(skillId, {
          state: 'rejected',
          ...(outcome.reason ? { reason: outcome.reason } : {}),
        });
      }
      continue;
    }

    const line = awaitingOutcome.get(outcome.mark);
    awaitingOutcome.delete(outcome.mark);
    if (!line) continue;
    line.accepted = outcome.accepted;
    line.answer = outcome.accepted
      ? '받아들여졌다'
      : codeText(outcome.reason ?? 'unknown-interaction');
  }
}

// 팩 고유 특수 키(막기 토글·이동 모드 전환)는 KEY_BINDINGS 가 나른다 (P3).

// 타격 결과가 화면에 떠 있는 시간 — 세계의 STRIKE_EVENT_TTL 과 같은 값을 볼 필요는 없다.
// 세계가 보내 주는 동안 그리고, 나이에 따라 옅어질 뿐이다.
const STRIKE_FADE_SECONDS = 1.2;

/**
 * 몸 위 높이 height 지점의 화면 좌표.
 *
 * 투영 기준은 **그려지고 있는 자리**다. 관찰 결과의 위치를 쓰면 몸은 부드럽게 따라가는데
 * (renderer 의 SMOOTHING) 몸에 붙은 표시만 세계 Tick(1/30초) 간격으로 튀어, 움직이는 동안
 * 이름표가 몸에서 떨어졌다 붙었다 하며 떤다. 아직 한 번도 그리지 않은 몸만 관찰 위치로 문다.
 */
function aboveBody(
  entityId: string,
  observed: { x: number; z: number },
  height: number,
): { x: number; y: number } | null {
  const at = renderer.drawnPosition(entityId) ?? observed;
  return renderer.worldToScreen(at.x, at.z, height);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // 조용히 죽은 이어짐을 걷어낸다 — 관찰 결과가 끊기면 그것이 끊김이다
  link.poll(Date.now());
  // 세계의 대답을 받아 그것을 부른 자리에 붙인다 (C009 · C026 · C027).
  drainOutcomes(now);
  ageSkillAnswers(now);
  // 끊겼으면 기다리던 것을 잊는다 — 오지 않을 대답을 기다리면 그 줄은 영영 "보냈다" 다
  if (link.state() !== 'connected') {
    forgetPending();
    forgetPendingSkills();
  }

  // 시점 조작 (C008) — 그리기 전에 방향을 먼저 정한다. 이번 프레임의 좌우 읽기가
  // 이 방향을 기준으로 이루어져야 화면과 어긋나지 않는다.
  // 글자를 쓰는 중인가와 표면이 열려 있는가는 **다른 것**이다.
  //   typing       명령을 쓰는 중 — 어떤 키도 통과하지 않는다 (콘솔이 잡고 있다)
  //   surfaceOpen  겹침 표면이 열림 — 이동·시점·지목은 멈추되 **팩 규칙은 통과한다**
  //                (표면을 자판으로 모는 것이 그 규칙이기 때문이다)
  const typing = commandConsole.capturing();
  const surfaceOpen = surfaces.capturing();
  const capturing = typing || surfaceOpen;
  // 잡혀 있는 동안 방향키·시점키는 이동이 아니라 평범한 키가 된다
  keyboard.suspendMovement(capturing);
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
        effectsSince: effectMemory,
        // C027 — 내가 건 기술 요청이 어떻게 되었는가. 세계가 아니라 이쪽이 쥔 값이다.
        skillAnswers: skillAnswers.size === 0 ? NO_SKILL_ANSWERS : Object.fromEntries(skillAnswers),
      })
    : EMPTY_SCENE;
  // 이번 관찰 결과가 다음 프레임의 기준이 된다 (읽고 나서 갱신한다)
  if (snapshot) effectMemory = rememberForEffects(snapshot);

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
  // 키로 밀고 있으면 그것이 우선이다. 아니면 스틱을 본다 —
  // 둘 다 같은 모양(단위 벡터)이므로 아래 로직은 무엇이 밀었는지 알 필요가 없다.
  const dir = capturing ? null : (keyboard.direction() ?? touch.direction());
  if (dir && terrain && self) {
    wasDirectionMoving = true;
    if (moveRequestCooldown <= 0) {
      moveRequestCooldown = MOVE_REQUEST_INTERVAL;
      // C008 — 앞은 세계의 축이 아니라 지금 보고 있는 쪽이다.
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
  } else if (!dir && wasDirectionMoving) {
    // 멈춤 — 아무것도 보내지 않는다 (C008 CHANGED).
    //
    // 예전에는 "마지막으로 관찰한 자리로 가라"를 보내 그 자리에 세웠다. 그런데 그 자리는
    // 이미 지나온 자리다 (관찰은 세계보다 한 걸음 늦게 도착한다). 그래서 몸이 뒤로 한 걸음
    // 돌아왔고, 움직인 방향이 몸 방향이므로(C006 RULE-BODY-FACING-001) 멈출 때마다
    // 뒤를 돌아봤다 — 그림도 휘두름도 함께 뒤를 향했다.
    //
    // 마지막으로 요청한 목적지는 늘 몸보다 앞에 있다. 그리로 가다 도착하면 스스로 멈춘다
    // (RULE-MOVE-PROGRESS-001 Arrived). 가던 쪽을 향한 채 서는 것이 이 Cycle 이 필요로 하는
    // 상태이고, 세계에 새 규칙을 더하지 않고 얻을 수 있는 가장 단순한 방법이다.
    wasDirectionMoving = false;
    moveRequestCooldown = 0;
  }

  // C027 — 지금 관찰된 것 중 무엇이 기술인가. 계약이 실은 값으로 갈린다
  // (04 skill.identification). 세계가 기술을 하나 더 지니면 이 집합도 하나 는다.
  skillIds = snapshot ? skillInteractionIds(snapshot) : new Set<string>();

  // 손가락으로 누른 버튼은 그 행동에 배정된 키 코드로 도착한다 (view/hud/touch-pad.ts).
  // 여기서 둘을 구분하지 않는 것이 핵심이다 — 손가락과 키가 갈라질 길 자체가 없다.
  for (const code of [...keyboard.consumeKeyPresses(), ...touchPad.consumePresses()]) {
    // 명령 표면을 연다 (C009). 열려 있는 동안 다른 키는 몸에 닿지 않는다 —
    // 콘솔이 자기 입력에서 키를 잡아 두므로 여기까지 오지 않는다.
    if (code === COMMAND_OPEN_KEY) {
      commandOpen = !commandOpen;
      if (!commandOpen) commandText = '';
      continue;
    }
    if (typing) continue;
    if (surfaceOpen) {
      // 표면이 열린 동안에는 팩 규칙만 듣는다 — 세계 안의 몸에 닿는 키는 멈춘다
      const open = KEY_BINDINGS.find((b) => b.code === code);
      if (open) open.invoke(latestScene, (action) => link.sendMarked(action));
      continue;
    }
    if (code === DEBUG_OBSERVE_KEY) {
      debugObserve = !debugObserve;
      continue;
    }
    if (code === INSPECT_KEY) {
      inspect = !inspect;
      continue;
    }
    // 팩 고유 특수 키 (P3) — 장면을 읽어 요청을 고르는 규칙은 팩이 등록한다.
    // 여기서는 code 가 맞는 바인딩을 부를 뿐, 그 안에서 무엇이 골라지는지 모른다.
    const binding = KEY_BINDINGS.find((b) => b.code === code);
    if (binding) {
      binding.invoke(latestScene, (action) => link.sendMarked(action));
      continue;
    }
    const keyed = latestScene.interactions.filter((i) => i.key === code);
    const interaction = keyed.find((i) => i.available) ?? keyed[0];
    // 키가 고른 것을 요청 한 자리로 넘긴다 (C027) — 띠의 칸이 눌렸을 때와 같은 길이다.
    if (interaction) requestInteraction(interaction.id);
  }

  renderer.render(latestScene, dt);
  commandConsole.render(latestScene.commandSurface);
  surfaces.render(latestScene.surfaces);
  slotBars.render(latestScene.slotBars);
  // 조작 자리는 손가락을 쓰는 기기에서만 보인다. 기기 이름을 묻지 않고
  // 무엇으로 가리키는지만 본다 — 마우스뿐인 화면에는 나타나지 않는다.
  touchPad.render(latestScene, touch.stick(), COARSE_POINTER || touch.engaged());

  const labels: EntityLabel[] = [];
  for (const entity of latestScene.entities) {
    if (entity.label === undefined) continue;
    const screen = aboveBody(entity.id, entity.position, 4.2);
    if (screen) labels.push({ id: entity.id, x: screen.x, y: screen.y, text: entity.label });
  }

  // 존재 HUD (C007) — 이름과 생명을 그 몸 위에 붙인다.
  // 얼마나 띄울지는 결정 Layer 가 그 존재의 그림 크기로 정해 두었다 (nameplate.anchorHeight).
  const plates: EntityPlate[] = [];
  for (const entity of latestScene.entities) {
    if (!entity.nameplate) continue;
    const screen = aboveBody(entity.id, entity.position, entity.nameplate.anchorHeight);
    if (!screen) continue;
    plates.push({
      id: entity.id,
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
    strikes.push({
      x: screen.x,
      y: screen.y,
      text: strike.text,
      emphasis: strike.emphasis,
      age,
      // C010·C011 — 경위는 결정 Layer 가 채운 경우에만 있다
      // (속성 관찰이 켜졌을 때, 또는 그 타격이 막히거나 무너졌을 때)
      ...(strike.detail ? { detail: strike.detail } : {}),
      ...(strike.guard ? { guard: strike.guard } : {}),
    });
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
      telemetryLines(link.telemetry(nowMs), codeText),
      bindingLines(
        {
          observerId,
          characterId: snapshot?.observer.characterId ?? '—',
          worldAddress: link.address(),
        },
        codeText,
      ),
      // 이어짐의 상태와 계량 이름도 팩의 것이다 (문구 반전 ⑤)
      codeText,
    ),
    { plates, strikes },
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
