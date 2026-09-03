// Vite 설정 — 클라이언트를 띄운다. 세계는 두 가지 방식으로 붙을 수 있다 (C003).
//
//   기본 (HKT_WORLD_URL 없음)   세계를 이 dev 서버 프로세스 안에서 돌린다.
//                                한 번에 실행하고 싶을 때 — scripts/run.bat
//   HKT_WORLD_URL 이 있으면     세계는 다른 프로세스에 있다. /world 를 그쪽으로 넘긴다.
//                                서버와 클라를 따로 띄울 때 — scripts/run-world.bat + scripts/run-client.bat
//
// 어느 쪽이든 클라이언트 코드는 같다. 클라이언트는 세계가 어디 있는지 모른다.

import type { Server as HttpServer } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { motionAtlasPlugin } from './tools/motion-atlas/vite-plugin';
import { TRANSPORT_PATH } from './engine/protocol-core/transport';
import { attachWorldServer } from './server/attach';
import { createWorldHost } from './server/world-host';

const externalWorld = process.env.HKT_WORLD_URL;

/**
 * HKT_SPAWN="x,z" — 이 프로세스 안에서 도는 세계에서 관찰자의 몸이 처음 놓일 자리.
 *
 * **검증용 손잡이다.** 걸어서 갈 수 있는 자리를 걸어가지 않고 시작하기 위한 것이며,
 * 세계의 규칙을 바꾸지 않는다 (WorldSetup.actorPosition 은 이미 있는 자리다).
 * 밝히지 않으면 평소대로 SPAWN_POINTS 가 정한다.
 *
 * 소프트웨어 GPU 로 도는 촬영 하네스에서는 프레임이 수 초씩 걸려 **걷는 조작이
 * 이어지지 않는다** — 그래서 먼 자리를 찍으려면 거기서 시작해야 한다
 * (tools/fx-lab/test/terrain-shot.js).
 */
function spawnFromEnv(): {
  actorPosition?: { x: number; z: number };
  actorRegion?: string;
  npcs?: [];
} {
  const setup: { actorPosition?: { x: number; z: number }; actorRegion?: string; npcs?: [] } = {};

  const raw = process.env.HKT_SPAWN;
  if (raw) {
    const [x, z] = raw.split(',').map(Number);
    if (x !== undefined && z !== undefined && Number.isFinite(x) && Number.isFinite(z)) {
      setup.actorPosition = { x, z };
    }
  }

  // 어느 **방**에서 시작할 것인가 (C002). 방이 여럿이 되면서 자리만으로는 모자란다 —
  // 걷는 조작이 이어지지 않는 촬영 하네스에서 백왕령 밖의 방을 보려면 거기서 시작해야 한다.
  if (process.env.HKT_SPAWN_REGION) setup.actorRegion = process.env.HKT_SPAWN_REGION;

  // 자율 존재 없이 띄운다 — 촬영은 조작 없이 여러 세계 초를 서 있으므로, 그대로 두면
  // 다가온 존재에게 맞아 쓰러진 그림만 남는다. 세계의 규칙이 아니라 **초기 배치**만 바꾼다.
  if (process.env.HKT_NO_NPC) setup.npcs = [];

  return setup;
}

function worldServerPlugin(): Plugin {
  return {
    name: 'hkt-world-server',
    configureServer(server) {
      if (!server.httpServer) return;
      const host = createWorldHost(spawnFromEnv());
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
