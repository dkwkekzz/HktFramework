// World Link — 관찰자와 세계 사이의 이어짐 (C003).
//
// INTENT-OBSERVER-LINK-001 을 구현한다. 이것은 세계의 상태가 아니라 관찰자 쪽 상태다.
//
//   이어짐    관찰 결과가 들어오는 중
//   잇는 중   아직 잇지 못했거나 다시 잇는 중
//   끊김      끊겼고 아직 잇지 못한 상태 — 마지막으로 받은 세계를 계속 보되 stale 로 표시
//
// 소켓 자체는 주입받는다 — 전송 수단 없이 검증할 수 있어야 하기 때문이다.

import type { ActionRequest } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { parseServerMessage, type ActionMessage, type LinkState } from '../../protocol/transport';

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

export interface WorldLink {
  /** 요청을 세계로 보낸다. 이어져 있지 않으면 보내지 못하고 false */
  send(action: ActionRequest): boolean;
  /** 마지막으로 받은 관찰 결과 (아직 하나도 못 받았으면 null) */
  latest(): GameViewSnapshot | null;
  state(): LinkState;
  /** 흐른 시간을 알려준다 — 조용히 죽은 이어짐을 여기서 걷어낸다 */
  poll(nowMs: number): void;
  /** 보고 있는 세계가 현재가 아닐 수 있는가 */
  stale(): boolean;
  close(): void;
}

// 다시 잇기까지 기다리는 시간 — 점점 늘리되 상한을 둔다
export const RETRY_DELAYS_MS = [300, 600, 1200, 2400, 5000];

export function createWorldLink(
  connect: SocketFactory,
  schedule: Scheduler = (fn, ms) => setTimeout(fn, ms),
  now: () => number = () => Date.now(),
): WorldLink {
  let state: LinkState = 'connecting';
  let socket: LinkSocket | null = null;
  let latest: GameViewSnapshot | null = null;
  let attempt = 0;
  let closed = false;
  let lastReceived = now();

  function open(): void {
    if (closed) return;
    state = 'connecting';
    socket = connect({
      onOpen() {
        state = 'connected';
        attempt = 0;
        lastReceived = now();
      },
      onMessage(raw) {
        const message = parseServerMessage(raw);
        if (!message) return;
        latest = message.snapshot; // 늦게 온 것이 앞선 것을 대체한다
        state = 'connected';
        lastReceived = now();
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
  }
  open();

  function dropSilentLink(): void {
    const dead = socket;
    socket = null;
    state = 'disconnected';
    dead?.close(); // 재접속은 onClose 가 예약한다
  }

  return {
    poll(nowMs) {
      if (closed || state !== 'connected') return;
      if (nowMs - lastReceived > OBSERVATION_TIMEOUT_MS) dropSilentLink();
    },
    send(action) {
      if (state !== 'connected' || !socket) return false;
      const message: ActionMessage = { type: 'action', action };
      socket.send(JSON.stringify(message));
      return true;
    },
    latest: () => latest,
    state: () => state,
    // 이어져 있지 않으면 지금 보는 세계는 현재가 아닐 수 있다
    stale: () => state !== 'connected' && latest !== null,
    close() {
      closed = true;
      state = 'disconnected';
      socket?.close();
      socket = null;
    },
  };
}

// 브라우저 WebSocket 어댑터 — 위 순수 로직에 실제 전송을 끼운다.
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
