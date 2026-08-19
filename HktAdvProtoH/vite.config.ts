// Vite 설정 — 클라이언트를 띄운다. 세계는 두 가지 방식으로 붙을 수 있다 (C003).
//
//   기본 (HKT_WORLD_URL 없음)   세계를 이 dev 서버 프로세스 안에서 돌린다.
//                                한 번에 실행하고 싶을 때 — run.bat
//   HKT_WORLD_URL 이 있으면     세계는 다른 프로세스에 있다. /world 를 그쪽으로 넘긴다.
//                                서버와 클라를 따로 띄울 때 — run-world.bat + run-client.bat
//
// 어느 쪽이든 클라이언트 코드는 같다. 클라이언트는 세계가 어디 있는지 모른다.

import type { Server as HttpServer } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { motionAtlasPlugin } from './tools/motion-atlas/vite-plugin';
import { TRANSPORT_PATH } from './engine/protocol-core/transport';
import { attachWorldServer } from './server/attach';
import { createWorldHost } from './server/world-host';

const externalWorld = process.env.HKT_WORLD_URL;

function worldServerPlugin(): Plugin {
  return {
    name: 'hkt-world-server',
    configureServer(server) {
      if (!server.httpServer) return;
      const host = createWorldHost();
      attachWorldServer(server.httpServer as HttpServer, host);
      server.httpServer.on('close', () => host.stop());
      server.config.logger.info(`  ➜  세계:     이 프로세스 안에서 돌고 있음 (ws ${TRANSPORT_PATH})`);
    },
  };
}

export default defineConfig({
  // 모션 아틀라스는 세계가 어디 있든 필요하다 — 시트를 놓기만 하면 되는 규약을 지킨다.
  plugins: externalWorld ? [motionAtlasPlugin()] : [motionAtlasPlugin(), worldServerPlugin()],
  server: externalWorld
    ? {
        proxy: {
          [TRANSPORT_PATH]: { target: externalWorld, ws: true, changeOrigin: true },
        },
      }
    : {},
});
