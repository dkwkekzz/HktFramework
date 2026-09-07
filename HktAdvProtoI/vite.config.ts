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
  regionPatterns?: Record<string, string>;
  npcRegion?: string;
  sourcePhases?: Record<string, string>;
} {
  const setup: {
    actorPosition?: { x: number; z: number };
    actorRegion?: string;
    npcs?: [];
    regionPatterns?: Record<string, string>;
    npcRegion?: string;
    sourcePhases?: Record<string, string>;
  } = {};
  // HKT_REGION_PATTERN="REGION:PATTERN" — 규칙을 품은 방이 어느 패턴으로 서는가 (C009).
  // 같은 갈래의 검증용 손잡이다 — 걸어서 닿을 수 있는 State 를 걸어가지 않고 시작한다.
  // 심장 쪽 문이 열리는 패턴은 임계를 두 번 넘겨야 오는데, 프레임이 수 초씩 걸리는 촬영에서
  // 그것은 몇 분의 걷기이고 한 번 더 넘기면 문이 도로 잠긴다. 규칙이 그 문을 연다는 것은
  // 시나리오 테스트가 증명하고, 그림은 그 State 에서 무엇이 보이는가를 보인다.
  const pattern = process.env.HKT_REGION_PATTERN;
  if (pattern) {
    const [regionId, name] = pattern.split(':');
    if (regionId && name) setup.regionPatterns = { [regionId]: name };
  }
  // HKT_NPCS="none" — 자율 존재 없이 띄운다. 촬영에서 관찰자가 맞아 쓰러지면 건너기 같은
  // 조작이 이어지지 않는다 (tools/cycle-shot). 같은 검증용 손잡이 — 초기 배치만 비운다.
  if (process.env.HKT_NPCS === 'none') setup.npcs = [];
  // HKT_NPC_REGION — 자율 존재를 **어느 방에** 놓을 것인가 (C010).
  // 기본 자율 존재의 자리와 순회 경로는 그대로 두고 방만 옮긴다 — 여기서 게임 값을 짓지 않는다.
  // "세계는 플레이어 없이도 돈다"(Concept W9)를 그 방 안에서 보려면 그 방에 몸이 하나 있어야 한다.
  // npcs: "none" 과 함께 주면 none 이 이긴다 (아무도 놓지 않는다).
  const npcRegion = process.env.HKT_NPC_REGION;
  if (npcRegion && setup.npcs === undefined) setup.npcRegion = npcRegion;
  // HKT_SOURCE_PHASE="SOURCE:PHASE" 또는 "A:phase,B:phase" — 원천들이 어느 phase 로 서는가
  // (C012 · C013 CHANGED — 쉼표로 여럿을 한 번에 세운다).
  //
  // HKT_REGION_PATTERN 과 같은 갈래의 검증용 손잡이다 — 캐서·기다려서 닿을 수 있는 State 를
  // 캐지도 기다리지도 않고 시작한다. 노두는 세 번 캐야 고갈되고 촬영 하네스의 요청 왕복은
  // 10초를 넘으며, 되돌아오는 중(recovering)은 거기서 다시 90초의 세계 시간을 기다려야 온다.
  // 규칙이 그 State 로 데려간다는 것은 시나리오 테스트가 증명하고, 그림은 그 State 에서
  // 무엇이 보이는가를 보인다.
  //
  // 여럿을 받는 이유 — 사슬이 멎는 장면(뿌리혹이 고갈된 채 노두가 멎어 있다)은 원천 **둘**을
  // 함께 세워야 서는 그림이다 (C013 SPEC-005). 세계가 받는 값은 그대로 phase 문자열이고,
  // 모르는 원천 · 모르는 phase 는 세계가 조용히 무시한다.
  const sourcePhase = process.env.HKT_SOURCE_PHASE;
  if (sourcePhase) {
    const phases: Record<string, string> = {};
    for (const entry of sourcePhase.split(',')) {
      const [sourceId, phase] = entry.trim().split(':');
      if (sourceId && phase) phases[sourceId] = phase;
    }
    if (Object.keys(phases).length > 0) setup.sourcePhases = phases;
  }
  // HKT_SPAWN_REGION — 어느 **방**에서 시작할 것인가. 방이 여럿이 되면서 자리만으로는
  // 모자란다 (C002): 걷기가 이어지지 않는 촬영에서 백왕령 밖의 방을 보려면 거기서 시작해야 한다.
  if (process.env.HKT_SPAWN_REGION) setup.actorRegion = process.env.HKT_SPAWN_REGION;
  const raw = process.env.HKT_SPAWN;
  if (!raw) return setup;
  const [x, z] = raw.split(',').map(Number);
  if (x === undefined || z === undefined) return setup;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return setup;
  setup.actorPosition = { x, z };
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
