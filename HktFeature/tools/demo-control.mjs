// ============================================================================
// 제어 데모 서버 (feature-0010) — 시각 검증용 깨끗한 무대.
//
// 라이브 index.js 는 서식지·봇으로 붐빈다. 이 데모는 제어 명제 하나만 또렷이 보인다:
//   접속하면 자기 생명체(금색 고리) 하나를 쥐고, **채집 욕망**이 자동으로 걸린다 →
//   생명체가 결정(옥타) 쪽으로 표적선을 그리며 이동(이동분은 국소장으로 소산)하고,
//   사거리에 닿으면 결정을 흡수해 잔고가 차오른다. "욕망→이동→에너지"가 한눈에 보인다.
//
// 사용:
//   npm run demo         # 브라우저로 http://localhost:8080 열어 눈으로 확인(사람 검증)
//   npm run shot         # 헤드리스 크로미움으로 스크린샷 캡처(자동 시각 검증, tools/shot.mjs)
// ============================================================================

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GameServer } from '../server/game.js';
import { decode, MSG } from '../shared/protocol.js';
import { TICK_RATE, POOL, DESIRE, materialKey } from '../shared/constants.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// 결정 자리와 생명체 시작 자리 — 월드 중심(카메라 표적)을 사이에 두고 대칭. 기본 카메라의 화면 가로축을
//   따라 놓여 이동이 화면 가운데를 가로지르며 또렷이 보인다(≈707px 이동, 감지 반경 900 안). 결정은 복셀
//   중심에 석출되므로 (750,1250)=복셀(1_2_2) 중심에 맞춰 둔다.
const CRYSTAL = { x: 750, y: 1250, z: 625 };
const CREATURE_START = { x: 1250, y: 750, z: 625 };

// 데모 서버를 띄운다 — 깨끗한 무대(결정 하나 + 접속 시 제어 생명체 하나, 채집 욕망 자동).
export function startDemoServer({ port = 8080 } = {}) {
  const httpServer = http.createServer(async (req, res) => {
    const pathname = req.url.split('?')[0];
    if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    const path = normalize(join(ROOT, pathname === '/' ? '/client/index.html' : pathname));
    const allowed = path.startsWith(join(ROOT, 'client')) || path.startsWith(join(ROOT, 'shared'));
    try {
      if (!allowed) throw new Error('forbidden');
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });

  const game = new GameServer();
  // 결정 하나를 석출시킨다 — 적게 시딩 + 짧게(3틱) 돌려 이웃 복셀이 과포화되지 않게(단일 결정). 그 뒤
  //   ① 국소장을 얼리고(남은 필드를 비워 추가 석출·갈구원 제거 = 생명체는 오직 결정만 표적) ② 표적 복셀에서
  //   벗어난 결정은 잔고를 비워(SINK) 유령을 없앤 뒤 ③ 표적 결정만 살찌운다(데모 내내 다 먹히지 않게).
  game.ledger.transfer(POOL.SOURCE, materialKey(CRYSTAL.x, CRYSTAL.y, CRYSTAL.z), 4000, 'seed');
  for (let i = 0; i < 3; i++) game.tick();
  for (const id of game.materialKeys) { const b = game.ledger.balance(id); if (b > 0) game.ledger.transfer(id, POOL.SINK, b, 'freeze'); }
  for (const c of game.crystals.values()) {
    const near = Math.hypot(c.x - CRYSTAL.x, c.y - CRYSTAL.y, c.z - CRYSTAL.z) < 300;
    const b = game.ledger.balance(c.id);
    if (near) game.ledger.transfer(POOL.SOURCE, c.id, 6000, 'seed');        // 표적 결정 — 살찌운다
    else if (b > 0) game.ledger.transfer(c.id, POOL.SINK, b, 'freeze');     // 곁가지 결정 — 비운다(표적 유일)
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
        const cre = game.possessCreature(playerId, CREATURE_START.x, CREATURE_START.y, CREATURE_START.z);
        cre.desire = DESIRE.FORAGE; // 채집 욕망 자동 — 결정으로 이동해 흡수한다(제어 명제)
        return;
      }
      if (playerId !== null) game.onMessage(playerId, msg);
    });
    socket.on('close', () => { if (playerId !== null) game.removePlayer(playerId); });
    socket.on('error', () => {});
  });

  const timer = setInterval(() => game.tick(), 1000 / TICK_RATE);
  return { httpServer, game, close: () => { clearInterval(timer); wss.close(); httpServer.close(); } };
}

// 직접 실행 시: 사람이 브라우저로 확인하는 라이브 데모.
if (process.argv[1] && process.argv[1].endsWith('demo-control.mjs')) {
  const port = process.env.PORT ?? 8080;
  startDemoServer({ port }).httpServer.listen(port, () => {
    console.log(`[HktFeature] 제어 데모 — http://localhost:${port} (접속하면 내 생명체가 결정을 채집하러 간다)`);
  });
}
