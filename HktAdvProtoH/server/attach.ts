// WebSocket 부착 — World Host 를 실제 전송 위에 올린다 (C003).
//
// 관찰자 하나가 붙을 때마다 소켓 하나. 들어오는 것은 자기 식별(join)과
// Action Request 뿐이다 (protocol/transport.ts).
//
// C009 CHANGED — 나가는 것이 둘이 된다: 관찰 결과와, 이 관찰자의 요청에 대한 대답.
// 대답은 관찰 결과를 대신하지 않는다 — 세계가 어떻게 되었는지는 지금까지대로
// 관찰 결과로 드러나고, 대답은 "그 요청이 어떻게 되었는가" 만 말한다.
//
// C004 — 소켓이 열렸다고 관찰자가 된 것이 아니다. 자신을 밝히기 전까지는
// 세계에 아무것도 도착하지 않는다. 밝힌 뒤에는 그 소켓으로 오는 모든 요청이
// 그 관찰자의 것으로 도착한다 — 요청에 주체를 적을 자리는 없다.

import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  parseClientMessage,
  TRANSPORT_PATH,
  type ObservationMessage,
  type OutcomeMessage,
} from '../protocol/transport';
import type { WorldHost } from './world-host';

export interface AttachedServer {
  close(): void;
  host: WorldHost;
}

export function attachWorldServer(httpServer: HttpServer, host: WorldHost): AttachedServer {
  // noServer — upgrade 요청을 직접 가른다. server 옵션을 쓰면 ws 가 이 서버의 모든
  // upgrade 를 가로채 다른 WebSocket(예: Vite HMR)을 끊어 버린다.
  const wss = new WebSocketServer({ noServer: true });

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== TRANSPORT_PATH) return; // 우리 것이 아니면 건드리지 않는다
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  };
  httpServer.on('upgrade', onUpgrade);

  wss.on('connection', (socket: WebSocket) => {
    let observerId: string | null = null;
    let detach: (() => void) | null = null;

    const close = (): void => {
      detach?.();
      detach = null;
    };

    socket.on('message', (raw) => {
      const message = parseClientMessage(String(raw));
      if (!message) return; // 알 수 없는 것은 무시한다 — 세계를 흔들 수 없다

      if (message.type === 'join') {
        if (observerId !== null) return; // 이어짐당 한 번만 밝힌다
        observerId = message.observerId;
        detach = host.attach(
          observerId,
          (snapshot) => {
            if (socket.readyState !== socket.OPEN) return;
            const observation: ObservationMessage = { type: 'observation', snapshot };
            socket.send(JSON.stringify(observation));
          },
          // 같은 관찰자가 다른 곳에서 들어왔다 — 이 이어짐은 몸을 잃었으므로 닫는다.
          () => socket.close(),
          // C009 — 이 관찰자의 요청에 대한 세계의 대답.
          (outcomes) => {
            if (socket.readyState !== socket.OPEN) return;
            const message: OutcomeMessage = { type: 'outcome', outcomes };
            socket.send(JSON.stringify(message));
          },
        );
        return;
      }

      if (observerId === null) return; // 밝히기 전의 것은 세계에 도착하지 않는다

      if (message.type === 'mark') {
        host.receiveMark(observerId, message.mark); // 게임 요청이 아니다 (C005)
        return;
      }
      host.receive(observerId, message.action);
    });

    socket.on('close', close);
    socket.on('error', close);
  });

  host.startClock(); // 관찰자가 없어도 세계는 돈다

  return {
    host,
    close() {
      httpServer.off('upgrade', onUpgrade);
      wss.close();
      host.stop();
    },
  };
}
