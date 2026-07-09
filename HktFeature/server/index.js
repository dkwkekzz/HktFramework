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
  const pred = game.spawnCreature(cx, cy, cz);                                 // 자리 잡은 포식자(size2 선점, melee=bite=흡수)
  pred.size = 2; game.ledger.get(pred.id).max = 2_000;                         // 먹이(size1)보다 커야 강탈 성립
  game.ledger.transfer(POOL.SOURCE, materialKey(cx, cy, cz), 24_000, 'seed');  // 풍요 웅덩이 → 결정 석출 → 채집 → 성장(size↑)
  dens.push([cx, cy, cz]);
}

// feature-0010 — 참격(파괴 근접) 무대. 전사(melee=slash)를 포식자 군집에서 >500px(방출 사거리 밖) 떨어진 별도
//   자리에 둔다: 서로 파이어볼로 태우지 않게(같은 size2 둘이 방출 사거리 안이면 상호 전소) 격리하고, 곁에 이따금
//   허수아비(size1)를 풀어 전사가 칼로 벤다. 뷰어 tx 피드에서 [참격] 생명체→심우주·국소장 만 흐르고 생명체(전사)로
//   되돌아오는 엣지가 하나도 없다 — 포식자 군집의 [강탈] 생명체→생명체(먹는다)와 나란히 놓여 "종착이 위상을
//   정한다"(칼=파괴, 물어뜯기=흡수)가 한눈에 갈린다. 결정론·보존은 창세 그대로.
const ARENA = { x: 1100, y: 1800, z: Math.round(WORLD_HEIGHT * 0.5) }; // 관전 시야(구역 2_3) 안 · 모든 포식자와 >500px
const warrior = game.spawnCreature(ARENA.x, ARENA.y, ARENA.z, { melee: 'slash' });
warrior.size = 2; game.ledger.get(warrior.id).max = 2_000;
game.ledger.transfer(POOL.SOURCE, warrior.id, 1_800, 'seed');

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
    // feature-0010 — 참격 무대 유지: 전사 예비 보충 + 곁에 허수아비(size1) 하나 → 전사가 벤다(참격).
    if (game.creatures.has(warrior.id)) {
      game.ledger.transfer(POOL.SOURCE, warrior.id, 700, 'seed');
      game.spawnCreature(ARENA.x + 120, ARENA.y, ARENA.z);                     // 참격 사거리(200) 안 허수아비
      game.ledger.transfer(POOL.SOURCE, materialKey(ARENA.x + 120, ARENA.y, ARENA.z), 800, 'seed');
    }
  }
}, 1000 / TICK_RATE);

const PORT = process.env.PORT ?? 8080;
httpServer.listen(PORT, () => {
  console.log(`[HktFeature] 원장 서버 가동 — http://localhost:${PORT} (틱 ${TICK_RATE}Hz)`);
});
