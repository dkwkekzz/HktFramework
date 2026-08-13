// WebSocket 부착 — World Host 를 실제 전송 위에 올린다 (C003).
//
// 관찰자 하나가 붙을 때마다 소켓 하나. 소켓으로 나가는 것은 관찰 결과뿐이고,
// 들어오는 것은 Action Request 뿐이다 (protocol/transport.ts).
// 판정 결과는 되돌려 보내지 않는다 — 요청이 받아들여졌는지는 관찰 결과로 드러난다.

import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  parseClientMessage,
  TRANSPORT_PATH,
  type ObservationMessage,
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
    const detach = host.attach((snapshot) => {
      if (socket.readyState !== socket.OPEN) return;
      const message: ObservationMessage = { type: 'observation', snapshot };
      socket.send(JSON.stringify(message));
    });

    socket.on('message', (raw) => {
      const message = parseClientMessage(String(raw));
      if (!message) return; // 알 수 없는 것은 무시한다 — 세계를 흔들 수 없다
      host.receive(message.action);
    });

    socket.on('close', detach);
    socket.on('error', detach);
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
