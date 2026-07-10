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
import { TICK_RATE, SPAWN_POS, WORLD_HEIGHT, POOL, materialKey, dist3, isFlammable, ignitionHeat, CRYSTAL_DETONATE_THRESHOLD, CREATURE_MAX_ENERGY } from '../shared/constants.js';

// feature-0010 step3 — 제어 아레나 시드. 접속 시 내 생명체를 사냥 가능한 몸(size 2)으로 세우고, 둘레에 **욕구별
//   표적**을 둔다: 오른쪽=먹을 결정 둘(채집·식사), 왼쪽=붙은 재료 쌍(제조), 아래=작은 먹이(사냥). 표적은 자동
//   채집 반경(300) **밖**(~450px)·감지 반경(900) **안**이라 "누르기 전엔 그대로, 누르면 걸어가 수행"이 또렷하다.
//   전부 SOURCE 와 주고받아 보존. 접속 1회만 시드한다(재소환 때는 아래 서식지 재가열로 유지).
function seedControlArena(game, cre, x, y, z) {
  cre.size = 2;                                        // 사냥(포식=강자→약자) 가능한 큰 몸 — 눈에 띈다
  const pool = game.ledger.get(cre.id);
  if (pool) pool.max = CREATURE_MAX_ENERGY * 2;
  const cur = game.ledger.balance(cre.id);
  if (cur < 1_600) game.ledger.transfer(POOL.SOURCE, cre.id, 1_600 - cur, 'seed'); // 굶주림 0(회피·굶주림 감정 배제)
  game.spawnFood(x + 450, y - 80, z, 4, 2_600);       // 채집·식사 표적 A(먹을 수 있는 결정)
  game.spawnFood(x + 380, y + 150, z, 9, 2_400);      // 채집·식사 표적 B(다른 종=다른 색)
  game.spawnRawFood(x - 450, y + 70, z, 2, 3_000);    // 제조 재료 쌍 — 서로 140px(CRAFT_PAIR_RADIUS 안), raw=반응 면역
  game.spawnRawFood(x - 450, y - 70, z, 7, 3_000);
  const prey = game.spawnCreature(x + 40, y + 470, z);// 사냥 표적 — 작은 먹이(size1)
  game.ledger.transfer(POOL.SOURCE, prey.id, 800, 'seed'); // 넉넉히 채워 잠시 살아있다(다가가 타격 가능)
}

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
      const mine = game.possessCreature(playerId, px, py, SPAWN_POS.z);
      // 스폰 자리는 원래 텅 빈 곳(먹을 국소장·결정 없음) → 생명체가 갈구할 게 없어 ~12초 만에 아사했다.
      //   접속하면 그 자리에 **서식지 웅덩이**를 쥐어준다(SOURCE→국소장, 보존): 갈구 + 석출·채집이 즉시 돌아
      //   생명체가 살아 성장한다. 이후 유지는 아래 틱 루프가 소유 생명체의 현재 자리를 재가열해 이어간다.
      game.ledger.transfer(POOL.SOURCE, materialKey(px, py, SPAWN_POS.z), 6_000, 'seed');
      // feature-0010 step3 — **표적 보장 아레나**. 욕구를 눌렀을 때 눈에 보이는 표적이 늘 있도록 내 생명체 둘레에
      //   먹을 결정(채집·식사)·재료 쌍(제조)·작은 먹이(사냥)를 시드한다(모두 SOURCE→…, 보존). 자동 채집 반경(300)
      //   **밖**(~450px)에 둬 누르기 전엔 안 먹히고, 감지 반경(900) 안이라 누르면 걸어가 수행한다. 접속 1회만.
      seedControlArena(game, mine, px, py, SPAWN_POS.z);
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
  warmTick++;
  // 재소유 — 소유 생명체가 죽었으면(아사·전소·피식) 그 자리에 새 생명체를 쥐어준다. "한 사람 = 한 생명체"가
  //   끊기지 않게(뷰어의 "내 생명체 (없음)" 상태를 곧바로 회복). 플레이어 현재 위치에 스폰 + 서식지 웅덩이 시드.
  const owned = new Set();
  for (const cre of game.creatures.values()) if (cre.owner) owned.add(cre.owner);
  for (const player of game.players.values()) {
    if (owned.has(player.id)) continue;
    game.possessCreature(player.id, player.x, player.y, player.z);
    game.ledger.transfer(POOL.SOURCE, materialKey(player.x, player.y, player.z), 6_000, 'seed');
  }
  // 소유 생명체(플레이어가 쥔 것) 재가열 — 어디에 있든 그 자리 국소장을 조금씩 채워 갈구가 마르지 않게 한다.
  //   "한 사람 = 한 생명체"가 활동 중에는 굶어 사라지지 않도록 보장(SOURCE→국소장, 보존 유지). 야생(owner=null)은
  //   대상이 아니다 — 기존 생태(자기유지·아사)는 그대로 돈다. 갈구(5×size)>대사(3×size)라 순유입이 성장을 부른다.
  if (warmTick % 20 === 0) {
    for (const cre of game.creatures.values())
      if (cre.owner) game.ledger.transfer(POOL.SOURCE, materialKey(cre.x, cre.y, cre.z), 800, 'seed');
  }
  if (warmTick % 50 === 0) {
    for (const [cx, cy, cz] of dens) game.ledger.transfer(POOL.SOURCE, materialKey(cx, cy, cz), 9_000, 'seed');
    const [cx, cy, cz] = dens[preyNo % dens.length]; preyNo++;                 // 한 서식지 곁에 먹이 하나
    game.spawnCreature(cx + 120, cy + 40, cz);                                 // 강탈 200·방출 500 안 → 포식/방출 무대
    game.ledger.transfer(POOL.SOURCE, materialKey(cx + 120, cy + 40, cz), 1_500, 'seed');
    game.spawnRawFood(cx + 160, cy - 60, cz, preyNo % 12, 2_500);              // 날것 밥 보충 — 식사 봇이 계속 요리·섭취(feature-0011)
  }
  // feature-0013 연소 무대 — 이따금 서식지 근처 가연성 결정에 불씨를 놓는다(SOURCE→결정 열, 발화점 초과).
  //   불이 붙어 이웃 가연성 결정으로 번지다 전소한다(라이브에서 눈으로 보는 상태전이). 전부 원장 이체 → 보존.
  if (warmTick % 150 === 0) {
    for (const [cx, cy, cz] of dens) {
      let best = null, bestD = Infinity;
      for (const c of game.crystals.values()) {
        if (c.burning || !isFlammable(c.species) || game.ledger.balance(c.id) <= 0) continue;
        const d = dist3(cx, cy, cz, c.x, c.y, c.z);
        if (d <= 420 && d < bestD) { best = c; bestD = d; }
      }
      if (best) game.ledger.transfer(POOL.SOURCE, `${POOL.HEAT}${best.seq}`, ignitionHeat(best.species) + 200, 'heat');
    }
  }
  // feature-0013 규칙 D(자폭) 무대 — 이따금 서식지 근처 자연 결정 하나를 임계 이상으로 **과충전**한다(SOURCE→결정 잔고).
  //   에너지가 물질에 과하게 쌓이면 불안정해져 스스로 터진다(폭탄·과충전 결정) — 생명 없이도 폭발이 일어남을 라이브로
  //   보인다. 결정화는 자기제한적이라 자연히는 임계에 못 닿으므로, 태양이 이따금 한 결정을 벼랑 너머로 민다. 보존 유지.
  if (warmTick % 220 === 0) {
    let best = null, bestD = Infinity;
    for (const [cx, cy, cz] of dens) {
      for (const c of game.crystals.values()) {
        if (c.raw || c.crafted || game.ledger.balance(c.id) <= 0) continue; // 자연 결정만(안정 물질 제외)
        const d = dist3(cx, cy, cz, c.x, c.y, c.z);
        if (d <= 300 && d < bestD) { best = c; bestD = d; }
      }
    }
    if (best) game.ledger.transfer(POOL.SOURCE, best.id, CRYSTAL_DETONATE_THRESHOLD + 2_000, 'seed'); // 과충전 → 다음 틱 자폭
  }
}, 1000 / TICK_RATE);

const PORT = process.env.PORT ?? 8080;
httpServer.listen(PORT, () => {
  console.log(`[HktFeature] 원장 서버 가동 — http://localhost:${PORT} (틱 ${TICK_RATE}Hz)`);
});
