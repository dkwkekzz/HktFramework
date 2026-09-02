// World Link — 관찰자와 세계 사이의 이어짐.
//
// INTENT-OBSERVER-LINK-001 을 구현한다. 이것은 세계의 상태가 아니라 관찰자 쪽 상태다.
//
//   이어짐    관찰 결과가 들어오는 중
//   잇는 중   아직 잇지 못했거나 다시 잇는 중
//   끊김      끊겼고 아직 잇지 못한 상태 — 마지막으로 받은 세계를 계속 보되 stale 로 표시
//
// 이어짐이 열리면 가장 먼저 자신을 밝힌다 (identity.declaredOn: link-established).
// 다시 이을 때도 같은 것을 밝히므로 같은 몸으로 돌아온다 (onReconnect.regains: same-character).
//
// 소켓 자체는 주입받는다 — 전송 수단 없이 검증할 수 있어야 하기 때문이다.

import type { ActionRequest } from '../../protocol-core/actions';
import type { GameViewSnapshot, RequestOutcomeView } from '../../protocol-core/gameview';
import {
  parseServerMessage,
  type ActionMessage,
  type JoinMessage,
  type LinkState,
  type MarkMessage,
} from '../../protocol-core/transport';
import { createLinkTelemetry, type LinkTelemetry } from './link-telemetry';

export interface LinkSocket {
  send(data: string): void;
  close(): void;
}

export interface LinkHandlers {
  onOpen(): void;
  onMessage(raw: string): void;
  onClose(): void;
}

export type SocketFactory = (handlers: LinkHandlers) => LinkSocket;
export type Scheduler = (fn: () => void, ms: number) => void;

// 세계는 자기 Tick 마다 관찰 결과를 보낸다. 이만큼 아무것도 오지 않으면
// 이어져 있다고 볼 수 없다 — 소켓이 close 를 알리지 못하고 조용히 죽는 경우가 있다.
export const OBSERVATION_TIMEOUT_MS = 1500;

// 표식을 스스로 붙여 보내는 간격 — 게임 요청이 없어도 왕복을 잴 수 있어야 한다
// (INTENT-LINK-ROUNDTRIP-001).
export const MARK_INTERVAL_MS = 500;

export interface WorldLink {
  /** 요청을 세계로 보낸다. 이어져 있지 않으면 보내지 못하고 false */
  send(action: ActionRequest): boolean;
  /**
   * 요청을 보내고 그 요청에 붙인 표식을 돌려준다 (Request.Mark).
   * 돌아온 대답이 어느 요청의 것인지 이 표식으로 짚는다
   * (04 requestOutcome.mark / INTENT-REPLY-CORRESPONDENCE-001).
   * 보내지 못했으면 null.
   */
  sendMarked(action: ActionRequest): number | null;
  /**
   * 세계가 내 요청들에 내놓은 대답을 가져간다. 가져가면 비워진다 —
   * 기록은 관찰자가 쥔다 (04 commandSurface.history.owner: observer).
   */
  takeOutcomes(): RequestOutcomeView[];
  /** 마지막으로 받은 관찰 결과 (아직 하나도 못 받았으면 null) */
  latest(): GameViewSnapshot | null;
  state(): LinkState;
  /** 흐른 시간을 알려준다 — 조용히 죽은 이어짐을 걷어내고, 때가 되면 표식을 보낸다 */
  poll(nowMs: number): void;
  /** 보고 있는 세계가 현재가 아닐 수 있는가 */
  stale(): boolean;
  /** 이어짐이 얼마나 잘 통하는가 — 전부 관찰자 쪽에서 잰 값이다 */
  telemetry(nowMs: number): LinkTelemetry;
  /** 붙어 있는 세계의 주소 (binding) */
  address(): string;
  close(): void;
}

// 다시 잇기까지 기다리는 시간 — 점점 늘리되 상한을 둔다
export const RETRY_DELAYS_MS = [300, 600, 1200, 2400, 5000];

export function createWorldLink(
  connect: SocketFactory,
  observerId: string,
  schedule: Scheduler = (fn, ms) => setTimeout(fn, ms),
  now: () => number = () => Date.now(),
  address = '',
): WorldLink {
  let state: LinkState = 'connecting';
  let socket: LinkSocket | null = null;
  let latest: GameViewSnapshot | null = null;
  let attempt = 0;
  let closed = false;
  let lastReceived = now();
  // 세계에서 온 대답들. 가져갈 때까지만 여기 있다.
  let outcomes: RequestOutcomeView[] = [];
  // 요청에 붙이는 표식 — 이어짐 표식과 다른 자리다.
  // 그쪽은 왕복을 재는 것이고 이쪽은 어느 요청의 대답인지 짚는 것이다.
  let nextRequestMark = 1;

  // 표식은 관찰자가 매긴다. 뒤로 가지 않고, 다시 이어도 되돌리지 않는다
  // (marking.value: monotonic · resetOn: never).
  const telemetry = createLinkTelemetry();
  let nextMark = 1;
  let lastMarkAt = 0;
  let everConnected = false;

  // 자신을 밝히는 일. 소켓이 아직 손에 없으면(열림이 동기로 오는 경우) 잡히는 즉시 보낸다.
  let pendingDeclare = false;
  function declareIdentity(): void {
    if (!socket) {
      pendingDeclare = true;
      return;
    }
    pendingDeclare = false;
    const join: JoinMessage = { type: 'join', observerId };
    socket.send(JSON.stringify(join));
    telemetry.recordSent();
  }

  // 표식을 붙여 보낸다. 게임 요청이 아니다 — 세계는 받아들인 자리만 되돌린다.
  // 요청을 보낸 직후에도, 조용할 때도 보낸다 (marking.sentWith).
  function sendMark(atMs: number): void {
    if (state !== 'connected' || !socket) return;
    const mark = nextMark;
    nextMark += 1;
    const message: MarkMessage = { type: 'mark', mark };
    socket.send(JSON.stringify(message));
    lastMarkAt = atMs;
    telemetry.recordSent();
    telemetry.recordMarkSent(mark, atMs);
  }

  function open(): void {
    if (closed) return;
    state = 'connecting';
    socket = connect({
      onOpen() {
        state = 'connected';
        attempt = 0;
        lastReceived = now();
        // 처음 붙는 것은 "다시 이은 것"이 아니다 (telemetry.reconnectCount)
        if (everConnected) telemetry.recordReconnect();
        everConnected = true;
        // 가장 먼저 자신을 밝힌다. 이것이 도착해야 세계가 나를 알고,
        // 그때부터 이 이어짐으로 보내는 요청이 내 몸에 닿는다.
        declareIdentity();
      },
      onMessage(raw) {
        const message = parseServerMessage(raw);
        if (!message) return;
        lastReceived = now();
        if (message.type === 'outcome') {
          // 세계의 대답. 관찰 결과를 대체하지 않는다.
          outcomes.push(...message.outcomes);
          return;
        }
        latest = message.snapshot; // 늦게 온 것이 앞선 것을 대체한다
        state = 'connected';
        // 세계가 받아들인 표식으로 왕복을 닫는다 (INTENT-LINK-ROUNDTRIP-001)
        telemetry.recordObservation(message.snapshot.observer.acknowledgedMark, lastReceived);
      },
      onClose() {
        if (closed) return;
        socket = null;
        state = 'disconnected';
        const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 5000;
        attempt += 1;
        schedule(open, delay);
      },
    });
    if (pendingDeclare) declareIdentity();
  }
  open();

  function sendAction(action: ActionRequest): boolean {
    if (state !== 'connected' || !socket) return false;
    const message: ActionMessage = { type: 'action', action };
    socket.send(JSON.stringify(message));
    telemetry.recordSent();
    // 요청 직후에 표식을 붙인다 — 세계가 이 표식을 받아들인 관찰 결과에는
    // 이 요청의 판정이 이미 들어 있다 (03-world-semantic.md Transition 0).
    sendMark(now());
    return true;
  }

  function dropSilentLink(): void {
    const dead = socket;
    socket = null;
    state = 'disconnected';
    dead?.close(); // 재접속은 onClose 가 예약한다
  }

  return {
    poll(nowMs) {
      if (closed || state !== 'connected') return;
      if (nowMs - lastReceived > OBSERVATION_TIMEOUT_MS) {
        dropSilentLink();
        return;
      }
      // 조용해도 잴 수 있어야 한다 — 일정 간격으로 표식을 보낸다
      if (nowMs - lastMarkAt >= MARK_INTERVAL_MS) sendMark(nowMs);
    },
    send: sendAction,
    sendMarked(action) {
      const mark = nextRequestMark;
      if (!sendAction({ ...action, mark })) return null;
      nextRequestMark += 1;
      return mark;
    },
    takeOutcomes() {
      const taken = outcomes;
      outcomes = [];
      return taken;
    },
    latest: () => latest,
    state: () => state,
    // 이어져 있지 않으면 지금 보는 세계는 현재가 아닐 수 있다
    stale: () => state !== 'connected' && latest !== null,
    telemetry: (nowMs) => telemetry.read(nowMs),
    address: () => address,
    close() {
      closed = true;
      state = 'disconnected';
      socket?.close();
      socket = null;
    },
  };
}

// 브라우저 WebSocket 어댑터 — 위 순수 로직에 실제 전송을 끼운다.
// url 은 binding.worldAddress 로도 쓰인다.
export function browserSocketFactory(url: string): SocketFactory {
  return (handlers) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => handlers.onOpen());
    socket.addEventListener('message', (ev) => handlers.onMessage(String(ev.data)));
    socket.addEventListener('close', () => handlers.onClose());
    socket.addEventListener('error', () => socket.close());
    return {
      send: (data) => socket.send(data),
      close: () => socket.close(),
    };
  };
}
