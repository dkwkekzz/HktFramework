// Vite 설정 — 개발 서버에 세계를 붙인다 (C003).
//
// 세계는 Node 프로세스(= Vite dev 서버 프로세스)에서 자기 시계로 돌고,
// 브라우저는 WebSocket 으로 접속한다. 실행 명령은 여전히 `npm run dev` 하나다.
//
// 빌드된 결과를 띄울 때는 server/main.ts 가 같은 Host 를 독립 프로세스로 올린다.

import type { Server as HttpServer } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { attachWorldServer } from './server/attach';
import { createWorldHost } from './server/world-host';

function worldServerPlugin(): Plugin {
  return {
    name: 'hkt-world-server',
    configureServer(server) {
      if (!server.httpServer) return;
      const host = createWorldHost();
      attachWorldServer(server.httpServer as HttpServer, host);
      server.httpServer.on('close', () => host.stop());
    },
  };
}

export default defineConfig({
  plugins: [worldServerPlugin()],
});
