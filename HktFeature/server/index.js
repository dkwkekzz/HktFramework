// ============================================================================
// 부트스트랩 — HTTP 정적 서빙(client/, shared/) + WebSocket 수송 + 원장 틱 루프
// 게임 규칙은 전부 game.js(GameServer) 에 있다. 이 파일은 수송·수명만 담당.
// ============================================================================

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GameServer } from './game.js';
import { decode, MSG } from '../shared/protocol.js';
import { TICK_RATE, SPAWN_POS, WORLD_HEIGHT, POOL, materialKey } from '../shared/constants.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const httpServer = http.createServer(async (req, res) => {
  const pathname = req.url.split('?')[0];
  if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const url = pathname === '/' ? '/client/index.html' : pathname;
  const path = normalize(join(ROOT, url));
  const allowed = path.startsWith(join(ROOT, 'client')) || path.startsWith(join(ROOT, 'shared'));
  try {
    if (!allowed) throw new Error('forbidden');
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

const game = new GameServer();

// feature-0006 — 세계에 생명체 몇을 풀어놓는다(스폰 지역 둘레에 결정론적 배치). 각 생명체 자리에
//   국소장 "먹이 웅덩이"를 한 번 부어(SOURCE→국소장, 보존 유지) 갈구할 세계를 준다: 생명체는 그것을 먹고
//   살며, 웅덩이가 확산·복사·대사로 마르면 굶어 죽어 결정(잔해)을 남긴다 — 갈구·질서 유지·죽음의 전 주기를
//   뷰어에서 본다. 풍요롭게 부은 자리는 오래 살고, 얕게 부은 자리는 먼저 죽는다(항상성 대비).
//   봇(유한한 이동 에너지원)이 지나가면 그 자리 국소장을 덧대 수명이 늘기도 한다.
//   (테스트가 쓰는 GameServer 구성자는 생명체도 먹이도 만들지 않는다 — 창세 국소장 0 불변 · 라이브 진입점에서만 푼다.)
const CREATURE_LIVE_COUNT = 6;
for (let i = 0; i < CREATURE_LIVE_COUNT; i++) {
  const a = (i / CREATURE_LIVE_COUNT) * Math.PI * 2;
  const x = SPAWN_POS.x + Math.round(Math.cos(a) * 340);
  const y = SPAWN_POS.y + Math.round(Math.sin(a) * 340);
  const z = Math.round(WORLD_HEIGHT * (0.4 + 0.2 * (i % 2)));
  game.spawnCreature(x, y, z);
  const larder = i % 2 === 0 ? 12_000 : 4_000; // 풍요/얕음을 섞어 사는 놈·먼저 죽는 놈이 갈린다
  game.ledger.transfer(POOL.SOURCE, materialKey(x, y, z), larder, 'seed');
}

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (socket) => {
  let playerId = null;
  socket.on('message', (raw) => {
    const msg = decode(raw.toString());
    if (!msg) return;
    if (msg.t === MSG.HELLO && playerId === null) {
      playerId = game.addPlayer({ send: (s) => socket.readyState === 1 && socket.send(s) }, msg.name).id;
      return;
    }
    if (playerId !== null) game.onMessage(playerId, msg);
  });
  socket.on('close', () => { if (playerId !== null) game.removePlayer(playerId); });
  socket.on('error', () => {});
});

setInterval(() => game.tick(), 1000 / TICK_RATE);

const PORT = process.env.PORT ?? 8080;
httpServer.listen(PORT, () => {
  console.log(`[HktFeature] 원장 서버 가동 — http://localhost:${PORT} (틱 ${TICK_RATE}Hz)`);
});
