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

// feature-0006~0009 — 생명체의 전 주기(자기유지·채집·포식·방출)를 뷰어에서 보이게 세계를 구성한다.
//   스폰 둘레 세 곳에 "군집"을 둔다. 각 군집 = 풍요 웅덩이 위 **성장형 1기**(포식자 후보) + 곁(근접)의
//   **얕은 먹이 2기**. 풍요 개체는 석출된 결정을 채집(feature-0007)해 성장(size↑, feature-0006)하고, 커지면
//   곁의 작은 먹이를 강탈(포식, feature-0008)한다. 먹이는 못 먹는 큰 개체를 방출로 태우고(feature-0009),
//   예비가 무너지면 완전 연소로 사라진다. 군집 간격(>방출 사거리 500)이라 각 군집이 독립된 드라마로 읽힌다.
//   갈구·대사·아사·결정화·반응도 그 안에서 자연히 돈다. (테스트가 쓰는 GameServer 구성자는 생명체·먹이를
//   만들지 않는다 — 창세 국소장 0 불변 · 라이브 진입점에서만 푼다.)
const dens = []; // 군집 중심(포식자 서식지) — 태양이 이따금 다시 데우고 먹이가 이따금 나타나는 자리
const CLUSTERS = 3;
for (let k = 0; k < CLUSTERS; k++) {
  const a = (k / CLUSTERS) * Math.PI * 2;
  const cx = SPAWN_POS.x + Math.round(Math.cos(a) * 320); // 군집 간 554px(>방출 500) → 독립된 드라마
  const cy = SPAWN_POS.y + Math.round(Math.sin(a) * 320);
  const cz = Math.round(WORLD_HEIGHT * 0.5);
  const pred = game.spawnCreature(cx, cy, cz);                                 // 자리 잡은 포식자(size2 선점)
  pred.size = 2; game.ledger.get(pred.id).max = 2_000;                         // 먹이(size1)보다 커야 강탈 성립
  game.ledger.transfer(POOL.SOURCE, materialKey(cx, cy, cz), 24_000, 'seed');  // 풍요 웅덩이 → 결정 석출 → 채집 → 성장(size↑)
  game.spawnRawFood(cx + 160, cy - 60, cz, k % 12, 3_000);                     // 곁에 날것 밥(재료) — 식사 욕구가 요리해 먹는다(feature-0011)
  dens.push([cx, cy, cz]);
}

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (socket) => {
  let playerId = null;
  socket.on('message', (raw) => {
    const msg = decode(raw.toString());
    if (!msg) return;
    if (msg.t === MSG.HELLO && playerId === null) {
      const player = game.addPlayer({ send: (s) => socket.readyState === 1 && socket.send(s) }, msg.name);
      playerId = player.id;
      // feature-0010 제어 — 접속하면 스폰 곁에 자기 생명체 하나를 쥐어준다(한 사람=한 생명체). 겹치지 않게
      //   생성 순번으로 둘레에 흩는다. 기본 욕망은 대기(수동) — 방향키로 곁에 데려가거나 1·2 로 채집·사냥을 건다.
      const a = game.creatureSeq * 2.399963; // 황금각 근사 — 둘레 고른 분포(결정론)
      const px = SPAWN_POS.x + Math.round(Math.cos(a) * 90);
      const py = SPAWN_POS.y + Math.round(Math.sin(a) * 90);
      game.possessCreature(playerId, px, py, SPAWN_POS.z);
      return;
    }
    if (playerId !== null) game.onMessage(playerId, msg);
  });
  socket.on('close', () => { if (playerId !== null) game.removePlayer(playerId); });
  socket.on('error', () => {});
});

// 틱 루프. 주기적으로 ① 태양이 서식지를 다시 데우고(포식자가 채집·성장·생존을 이어감) ② 곁에 먹이(size1)를
//   풀어 포식·방출의 무대를 계속 살린다(SOURCE→국소장·생명체, 보존 유지). 그래서 뷰어가 오래 봐도 강탈·방출·
//   완전연소·채집·성장이 끊임없이 벌어진다. 결정론: 먹이 투입 자리는 순번(preyNo)으로 돈다.
let warmTick = 0, preyNo = 0;
setInterval(() => {
  game.tick();
  if (++warmTick % 50 === 0) {
    for (const [cx, cy, cz] of dens) game.ledger.transfer(POOL.SOURCE, materialKey(cx, cy, cz), 9_000, 'seed');
    const [cx, cy, cz] = dens[preyNo % dens.length]; preyNo++;                 // 한 서식지 곁에 먹이 하나
    game.spawnCreature(cx + 120, cy + 40, cz);                                 // 강탈 200·방출 500 안 → 포식/방출 무대
    game.ledger.transfer(POOL.SOURCE, materialKey(cx + 120, cy + 40, cz), 1_500, 'seed');
    game.spawnRawFood(cx + 160, cy - 60, cz, preyNo % 12, 2_500);              // 날것 밥 보충 — 식사 봇이 계속 요리·섭취(feature-0011)
  }
}, 1000 / TICK_RATE);

const PORT = process.env.PORT ?? 8080;
httpServer.listen(PORT, () => {
  console.log(`[HktFeature] 원장 서버 가동 — http://localhost:${PORT} (틱 ${TICK_RATE}Hz)`);
});
