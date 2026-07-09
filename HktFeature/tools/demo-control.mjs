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
import { TICK_RATE, DESIRE, POOL, CAUSE, CREATURE_MAX_ENERGY } from '../shared/constants.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// 밥 자리와 생명체 시작 자리 — 월드 중심(카메라 표적)을 사이에 두고 대칭. 기본 카메라의 화면 가로축을
//   따라 놓여 이동이 화면 가운데를 가로지르며 또렷이 보인다(≈707px 이동, 감지 반경 900 안).
const FOOD = { x: 750, y: 1250, z: 625 };
const CREATURE_START = { x: 1250, y: 750, z: 625 };
// 우선순위 씬(feature-0012)의 먹이 자리 — 밥(FOOD)의 반대편(생명체 기준). 두 표적이 갈라져 "어느 욕구로 가나"가 보인다.
const PREY = { x: 1750, y: 250, z: 625 };

// 데모 서버를 띄운다 — 깨끗한 무대. 접속하면 제어 생명체 하나(금색 고리)를 쥐고, 욕구가 자동으로 걸린다.
//   scene 'eat'(feature-0011): 날것 밥 하나 → 다가가 요리(변형)한 뒤 먹는다(찾기→요리→먹기, 절차적).
//   scene 'forage'(feature-0010): 먹을 수 있는 결정 하나 → 다가가 바로 먹는다.
//   scene 'priority'(기본, feature-0012): 밥(왼쪽)·먹이(오른쪽)를 두고 **식사·사냥을 동시에 품되(중첩)**,
//     감정이 식사에 실려 우선순위가 높아 → 밥 쪽으로 간다("중첩된 욕구 중 감정이 실린 쪽으로 행동한다").
export function startDemoServer({ port = 8080, scene = 'priority' } = {}) {
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
  const rawFood = scene === 'eat';
  if (scene === 'priority') {
    // 우선순위 씬 — 왼쪽 밥(먹을 수 있는 결정) + 오른쪽 먹이(더 작은 야생 생명체). 두 표적이 갈라져 있어
    //   "생명체가 어느 욕구를 따라 어디로 가나"가 한눈에 보인다.
    const cry = game.spawnRawFood(FOOD.x, FOOD.y, FOOD.z, 3, 9000); cry.raw = false; // 밥 = 먹을 수 있게
    const prey = game.spawnCreature(PREY.x, PREY.y, PREY.z);                          // 먹이(size 1)
    game.ledger.transfer(POOL.SOURCE, prey.id, 900, CAUSE.SPAWN);
  } else {
    // 밥 하나를 그 자리에 둔다 — 식사면 날것(요리 필요), 채집이면 먹을 수 있는 결정. 국소장 없이 밥만이 표적.
    game.spawnRawFood(FOOD.x, FOOD.y, FOOD.z, 0, 9000);          // 날것 밥(raw). 채집 씬은 아래에서 요리 상태로 바꾼다.
    if (!rawFood) for (const c of game.crystals.values()) c.raw = false; // 채집 씬 = 먹을 수 있는 결정
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
        if (scene === 'priority') {
          // 사냥 가능한 큰 몸(size 2)으로 세우고, **식사·사냥을 동시에 품는다(중첩)**. 감정을 식사에 실어
          //   우선순위를 키우면(식사=1+40 > 사냥=1) 밥 쪽으로 간다 — "중첩된 욕구 중 감정이 실린 쪽이 이긴다".
          cre.size = 2; const pool = game.ledger.get(cre.id); if (pool) pool.max = CREATURE_MAX_ENERGY * 2;
          game.ledger.transfer(POOL.SOURCE, cre.id, 1500, CAUSE.SPAWN);
          game.injectDesire(playerId, DESIRE.EAT, 1);
          game.injectDesire(playerId, DESIRE.HUNT, 1);
          game.emote(playerId, DESIRE.EAT, 40); // 감정 증폭 → 식사가 사냥을 이긴다(밥으로 이동)
        } else {
          cre.desire = rawFood ? DESIRE.EAT : DESIRE.FORAGE; // 욕구 자동 — 밥으로 이동해 (요리하고) 먹는다
        }
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
    console.log(`[HktFeature] 우선순위 데모 — http://localhost:${port} (접속하면 내 생명체가 식사·사냥을 품되 감정 실린 식사로 밥을 먹으러 간다)`);
  });
}
