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
// 우선순위 씬(feature-0012 step1)의 먹이 자리 — 밥(FOOD)의 반대편. 두 표적이 갈라져 "어느 욕구로 가나"가 보인다.
const PREY = { x: 1500, y: 700, z: 625 };
// 자율감정 씬(feature-0012 step2) — 화면 가로축(y=1250)에 밥(왼쪽)·먹이(오른쪽)를 벌려 놓고, 그 사이에 **같은
//   스택을 품은 두 생명체**를 둔다: 굶주린 개체(왼쪽)와 포만한 개체(오른쪽). 상황(차이)만 다를 뿐 스택은 같은데
//   굶주린 쪽은 식사로 밥을 향하고 포만한 쪽은 사냥으로 먹이를 향한다 — "차이가 감정을 만들어 행동을 가른다"가 한눈에.
const APPRAISE = {
  food:   { x: 200,  y: 1250, z: 625 }, // 밥(왼쪽 끝) — 굶주린 개체만 감지(반경 900 안), 포만 개체는 못 봄
  prey:   { x: 1800, y: 1250, z: 625 }, // 먹이(오른쪽 끝) — 포만 개체만 감지
  hungry: { x: 850,  y: 1250, z: 625 }, // 굶주린 개체 시작(왼쪽 밥으로 간다)
  full:   { x: 1150, y: 1250, z: 625 }, // 포만한 개체 시작(오른쪽 먹이로 간다)
};

// 데모 서버를 띄운다 — 깨끗한 무대. 접속하면 제어 생명체 하나(금색 고리)를 쥐고, 욕구가 자동으로 걸린다.
//   scene 'eat'(feature-0011): 날것 밥 하나 → 다가가 요리(변형)한 뒤 먹는다(찾기→요리→먹기, 절차적).
//   scene 'forage'(feature-0010): 먹을 수 있는 결정 하나 → 다가가 바로 먹는다.
//   scene 'priority'(feature-0012 step1): 밥(왼쪽)·먹이(오른쪽)를 두고 **식사·사냥을 동시에 품되(중첩)**,
//     감정이 식사에 실려 우선순위가 높아 → 밥 쪽으로 간다("중첩된 욕구 중 감정이 실린 쪽으로 행동한다").
//   scene 'appraise'(기본, feature-0012 step2): 같은 무대에 **감정을 밖에서 싣지 않고** 굶주리게 시작한다 →
//     굶주림(차이)이 식사의 감정을 **스스로** 만들어 밥으로 가고, 배부르면 감쇠해 사냥으로 넘어간다.
export function startDemoServer({ port = 8080, scene = 'appraise' } = {}) {
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
  if (scene === 'appraise') {
    // 자율감정 씬 — 밥(왼쪽·넉넉)·먹이(오른쪽). 생명체 둘은 접속 시 possess 한다(아래).
    const cry = game.spawnRawFood(APPRAISE.food.x, APPRAISE.food.y, APPRAISE.food.z, 3, 9000); cry.raw = false;
    const prey = game.spawnCreature(APPRAISE.prey.x, APPRAISE.prey.y, APPRAISE.prey.z);
    game.ledger.transfer(POOL.SOURCE, prey.id, 1200, CAUSE.SPAWN);
  } else if (scene === 'priority') {
    // 우선순위 씬 — 왼쪽 밥 + 오른쪽 먹이. 감정을 밥에 실어 밥으로 간다(step1).
    const cry = game.spawnRawFood(FOOD.x, FOOD.y, FOOD.z, 3, 9000); cry.raw = false;
    const prey = game.spawnCreature(PREY.x, PREY.y, PREY.z);
    game.ledger.transfer(POOL.SOURCE, prey.id, 900, CAUSE.SPAWN);
  } else if (scene === 'craft') {
    // 제조 씬(feature-0010 step2) — 붙어 놓인 두 재료(raw, 미가공 = 회색 점선 옥타). 제조 욕구를 가진 생명체가
    //   다가가 하나의 **산물**(✦제조, 선명·굵은 외곽)로 조합한다. 재료는 수동 반응에 면역이라 흩어지지 않는다.
    game.spawnRawFood(FOOD.x - 60, FOOD.y, FOOD.z, 2, 4500); // 재료 A (raw 유지)
    game.spawnRawFood(FOOD.x + 60, FOOD.y, FOOD.z, 7, 4500); // 재료 B (raw 유지, A 와 붙어 있음 = 조합 쌍)
  } else if (scene === 'craftchain') {
    // 다단계 제조 씬(feature-0011 step2) — 붙어 놓인 **재료 넷**. 제조 욕구가 재료 둘씩 합쳐 **중간물 둘**을,
    //   다시 그 둘을 합쳐 **완성물 하나**로 만든다(tier 0→1→2). 재료·산물 모두 수동 반응에 면역(안정 유지).
    game.spawnRawFood(FOOD.x - 75, FOOD.y - 75, FOOD.z, 2, 3000);
    game.spawnRawFood(FOOD.x + 75, FOOD.y - 75, FOOD.z, 5, 3000);
    game.spawnRawFood(FOOD.x - 75, FOOD.y + 75, FOOD.z, 3, 3000);
    game.spawnRawFood(FOOD.x + 75, FOOD.y + 75, FOOD.z, 8, 3000);
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
        // size 2 로 세우고 잔고를 목표치로 맞추는 헬퍼(보존 — SOURCE 와 주고받는다).
        const rear = (c, targetBal) => {
          c.size = 2; const pl = game.ledger.get(c.id); if (pl) pl.max = CREATURE_MAX_ENERGY * 2;
          const cur = game.ledger.balance(c.id);
          if (cur > targetBal) game.ledger.transfer(c.id, POOL.SOURCE, cur - targetBal, CAUSE.METABOLIZE);
          else if (cur < targetBal) game.ledger.transfer(POOL.SOURCE, c.id, targetBal - cur, CAUSE.SPAWN);
        };
        if (scene === 'appraise') {
          // 자율 감정 씬(step2) — **감정을 밖에서 싣지 않는다**. 두 생명체에 **같은 스택**(식사1·사냥2, 평소엔
          //   사냥 우선)을 주되 상황만 다르게 둔다: 하나는 굶주림·하나는 포만. 굶주린 쪽은 굶주림(차이)이 식사
          //   감정을 스스로 만들어 밥으로 가고, 포만한 쪽은 그 감정이 없어 사냥으로 먹이를 향한다 — 같은 스택,
          //   다른 상황 = 다른 행동. "차이는 신호: 상황이 감정을 만들고 감정이 행동을 정한다"가 나란히 보인다.
          const hungry = game.possessCreature(playerId, APPRAISE.hungry.x, APPRAISE.hungry.y, APPRAISE.hungry.z);
          const full   = game.possessCreature(playerId, APPRAISE.full.x, APPRAISE.full.y, APPRAISE.full.z);
          rear(hungry, 300);    // 굶주림(편안 임계 1000 아래) → 식사 감정 자율 상승
          rear(full, 1900);     // 포만(임계 위) → 식사 감정 0 → 사냥이 이긴다
          game.injectDesire(playerId, DESIRE.EAT, 1);
          game.injectDesire(playerId, DESIRE.HUNT, 2); // 두 개체 공통 스택
          return;
        }
        const cre = game.possessCreature(playerId, CREATURE_START.x, CREATURE_START.y, CREATURE_START.z);
        if (scene === 'craft' || scene === 'craftchain') {
          // 제조 욕구 하나 — 재료로 다가가 조합한다(찾기→조합, 다단계면 완성까지). 조합의 일은 열+연기로 방출.
          rear(cre, 1800); // 넉넉한 예비(여러 번의 제조 비용 지불)
          game.setDesire(playerId, DESIRE.CRAFT);
          return;
        }
        if (scene === 'priority') {
          // 사냥 가능한 큰 몸(size 2)으로 세우고, **식사·사냥을 동시에 품는다(중첩)**. 감정을 식사에 실어
          //   우선순위를 키우면(식사=1+40 > 사냥=1) 밥 쪽으로 간다 — "중첩된 욕구 중 감정이 실린 쪽이 이긴다".
          rear(cre, 1900);
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
    console.log(`[HktFeature] 자율 감정 데모 — http://localhost:${port} (접속하면 굶주린 생명체가 스스로 식사 감정을 키워 밥으로 가고, 배부르면 사냥으로 넘어간다)`);
  });
}
