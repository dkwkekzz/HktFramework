// ============================================================================
// 제어 데모 서버 (구 feature-0010(현 0018)) — 시각 검증용 깨끗한 무대.
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
import { TICK_RATE, DESIRE, MOTIVE, POOL, CAUSE, CREATURE_MAX_ENERGY } from '../shared/constants.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// 밥 자리와 생명체 시작 자리 — 월드 중심(카메라 표적)을 사이에 두고 대칭. 기본 카메라의 화면 가로축을
//   따라 놓여 이동이 화면 가운데를 가로지르며 또렷이 보인다(≈707px 이동, 감지 반경 900 안).
const FOOD = { x: 750, y: 1250, z: 625 };
const CREATURE_START = { x: 1250, y: 750, z: 625 };
// 우선순위 씬(구 feature-0012(현 0018) step1)의 먹이 자리 — 밥(FOOD)의 반대편. 두 표적이 갈라져 "어느 욕구로 가나"가 보인다.
const PREY = { x: 1500, y: 700, z: 625 };
// 자율감정 씬(구 feature-0012(현 0018) step2) — 화면 가로축(y=1250)에 밥(왼쪽)·먹이(오른쪽)를 벌려 놓고, 그 사이에 **같은
//   스택을 품은 두 생명체**를 둔다: 굶주린 개체(왼쪽)와 포만한 개체(오른쪽). 상황(차이)만 다를 뿐 스택은 같은데
//   굶주린 쪽은 식사로 밥을 향하고 포만한 쪽은 사냥으로 먹이를 향한다 — "차이가 감정을 만들어 행동을 가른다"가 한눈에.
const APPRAISE = {
  food:   { x: 200,  y: 1250, z: 625 }, // 밥(왼쪽 끝) — 굶주린 개체만 감지(반경 900 안), 포만 개체는 못 봄
  prey:   { x: 1800, y: 1250, z: 625 }, // 먹이(오른쪽 끝) — 포만 개체만 감지
  hungry: { x: 850,  y: 1250, z: 625 }, // 굶주린 개체 시작(왼쪽 밥으로 간다)
  full:   { x: 1150, y: 1250, z: 625 }, // 포만한 개체 시작(오른쪽 먹이로 간다)
};
// 폭발 씬(feature-0009) — 야생 캐스터가 사거리(500) 안 '먹을 수 없는' 표적(size≥)에게 파이어볼을 쏜다. 투사체가
//   캐스터 자리에서 표적으로 **날아가**(비행) 착탄해 **터진다**(폭발=0013 규칙 D). 화면 가로축(y=1250)을 따라 450px
//   벌려 놓아 불덩이가 화면을 가로지르는 게 또렷이 보인다. 관전자는 이 발산·비행·폭발을 지켜보기만 한다(possess 없음).
const BLAST = {
  caster: { x: 800,  y: 1250, z: 625 }, // 야생 캐스터(자율 발산)
  target: { x: 1250, y: 1250, z: 625 }, // 먹을 수 없는 표적(size≥, 사거리 안) — 소유라 반격·이동 안 함, 넉넉히 채워 계속 표적이 된다
};
// 자폭 씬(feature-0013 규칙 D) — **생명 없이** 물질이 터진다. 관전자 곁(반경 안)에 이따금 **과충전 결정**(임계 초과)이
//   나타나 스스로 폭발하며, blind AoE 로 곁의 생명을 친다. "폭발의 주인은 물질"이 눈으로 보인다(캐스터 없음).
const DETONATE = {
  watcher: { x: 1050, y: 1250, z: 625 }, // 관전 대상 생명체(소유, 계속 채워 폭발을 여러 번 견딘다)
  bomb:    { x: 1150, y: 1250, z: 625 }, // 과충전 결정이 나타나는 자리(생명 반경 안 → blind AoE 로 얻어맞는다)
};
// 위협·회피 씬(구 feature-0012(현 0018) step3) — 큰 포식자(위협)를 곁에 두면 내 생명체가 회피 감정을 스스로 만들어 **도망친다**.
//   위협이 가까울수록 회피가 이기고, 멀어지면(감지 반경 밖) 감정이 감쇠해 멈춘다. 감정이 상황에서 자율 생성됨을 본다.
const THREAT = {
  predator: { x: 1250, y: 950, z: 625 }, // 큰 포식자(size4) — 내 생명체 시작(1250,750) 근처(200px), 제자리 위협
};
// 동기 씬(feature-0018 step1) — **동기(허기)만** 주고 전략(채집/사냥)은 주지 않는다. 굶주린 한 생명체 곁에 밥과 먹이를
//   둘 다 두되 **먹이를 더 가까이** 놓는다: 같은 허기라도 값어치(수입−비용≈−거리)가 큰 가까운 기회를 골라 → 스스로
//   **사냥 전략**을 택해 강탈한다("사냥은 욕구가 아니라 허기의 전략 · 기회는 감정이 아니라 전략 선택"). 밥이 더 가까웠다면
//   같은 허기가 채집을 골랐을 것(단위 테스트가 대칭·포만 잠듦까지 증명). 모두 관측 창(스폰 중심 둘레) 안에 둬 렌더 안정.
const MOTIVE_SCENE = {
  start: { x: 1000, y: 1000, z: 625 }, // 굶주린 생명체 시작(스폰 중심)
  prey:  { x: 1000, y: 1300, z: 625 }, // 먹이(size1, 가까이 거리 300) → 사냥 전략의 표적(더 값어치)
  food:  { x: 620,  y: 1000, z: 625 }, // 밥(먹을 수 있는 결정, 멀리 거리 380) → 채집 전략의 표적(덜 값어치라 이번엔 안 고른다)
};

// 데모 서버를 띄운다 — 깨끗한 무대. 접속하면 제어 생명체 하나(금색 고리)를 쥐고, 욕구가 자동으로 걸린다.
//   scene 'eat'(구 feature-0011(현 0018)): 날것 밥 하나 → 다가가 요리(변형)한 뒤 먹는다(찾기→요리→먹기, 절차적).
//   scene 'forage'(구 feature-0010(현 0018)): 먹을 수 있는 결정 하나 → 다가가 바로 먹는다.
//   scene 'priority'(구 feature-0012(현 0018) step1): 밥(왼쪽)·먹이(오른쪽)를 두고 **식사·사냥을 동시에 품되(중첩)**,
//     감정이 식사에 실려 우선순위가 높아 → 밥 쪽으로 간다("중첩된 욕구 중 감정이 실린 쪽으로 행동한다").
//   scene 'appraise'(기본, 구 feature-0012(현 0018) step2): 같은 무대에 **감정을 밖에서 싣지 않고** 굶주리게 시작한다 →
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
    // 제조 씬(구 feature-0010(현 0018) step2) — 붙어 놓인 두 재료(raw, 미가공 = 회색 점선 옥타). 제조 욕구를 가진 생명체가
    //   다가가 하나의 **산물**(✦제조, 선명·굵은 외곽)로 조합한다. 재료는 수동 반응에 면역이라 흩어지지 않는다.
    game.spawnRawFood(FOOD.x - 60, FOOD.y, FOOD.z, 2, 4500); // 재료 A (raw 유지)
    game.spawnRawFood(FOOD.x + 60, FOOD.y, FOOD.z, 7, 4500); // 재료 B (raw 유지, A 와 붙어 있음 = 조합 쌍)
  } else if (scene === 'craftchain') {
    // 다단계 제조 씬(구 feature-0011(현 0018) step2) — 붙어 놓인 **재료 넷**. 제조 욕구가 재료 둘씩 합쳐 **중간물 둘**을,
    //   다시 그 둘을 합쳐 **완성물 하나**로 만든다(tier 0→1→2). 재료·산물 모두 수동 반응에 면역(안정 유지).
    game.spawnRawFood(FOOD.x - 75, FOOD.y - 75, FOOD.z, 2, 3000);
    game.spawnRawFood(FOOD.x + 75, FOOD.y - 75, FOOD.z, 5, 3000);
    game.spawnRawFood(FOOD.x - 75, FOOD.y + 75, FOOD.z, 3, 3000);
    game.spawnRawFood(FOOD.x + 75, FOOD.y + 75, FOOD.z, 8, 3000);
  } else if (scene === 'blast') {
    // 폭발 씬 — 야생 캐스터(자율 발산) + 먹을 수 없는 표적(size≥, 소유라 반격·이동 안 함). 캐스터가 파이어볼을
    //   쏘면 표적으로 날아가 착탄·폭발한다. 관전자는 지켜보기만(possess 없음). 잔고는 아래 틱 루프가 계속 채워 폭발이 끊기지 않게.
    const caster = game.spawnCreature(BLAST.caster.x, BLAST.caster.y, BLAST.caster.z);
    caster.size = 2; game.ledger.get(caster.id).max = CREATURE_MAX_ENERGY * 2;
    game.ledger.transfer(POOL.SOURCE, caster.id, CREATURE_MAX_ENERGY * 2, CAUSE.SPAWN);
    const target = game.spawnCreature(BLAST.target.x, BLAST.target.y, BLAST.target.z);
    target.size = 2; target.owner = 'P:demo'; game.ledger.get(target.id).max = CREATURE_MAX_ENERGY * 40;
    game.ledger.transfer(POOL.SOURCE, target.id, CREATURE_MAX_ENERGY * 40, CAUSE.SPAWN);
  } else if (scene === 'detonate') {
    // 자폭 씬 — 지켜볼 생명체 하나(소유·넉넉). 과충전 결정은 아래 틱 루프가 주기적으로 만든다(생명 없이 터진다).
    const watcher = game.spawnCreature(DETONATE.watcher.x, DETONATE.watcher.y, DETONATE.watcher.z);
    watcher.size = 2; watcher.owner = 'P:demo'; game.ledger.get(watcher.id).max = CREATURE_MAX_ENERGY * 60;
    game.ledger.transfer(POOL.SOURCE, watcher.id, CREATURE_MAX_ENERGY * 60, CAUSE.SPAWN);
  } else if (scene === 'threat') {
    // 위협 씬 — 큰 포식자(size4) 제자리 위협. 소유로 둬 자율 추적/전투 안 함(생명체가 도망치는 것만 또렷이 보인다).
    const pred = game.spawnCreature(THREAT.predator.x, THREAT.predator.y, THREAT.predator.z);
    pred.size = 4; pred.owner = 'P:demo'; game.ledger.get(pred.id).max = CREATURE_MAX_ENERGY * 4;
    game.ledger.transfer(POOL.SOURCE, pred.id, 3000, CAUSE.SPAWN);
  } else if (scene === 'motive') {
    // 동기 씬(feature-0018 step1) — 밥(멀리)·먹이(가까이, 소유 더미라 반격·이동 없음). 생명체는 접속 시 possess.
    game.spawnFood(MOTIVE_SCENE.food.x, MOTIVE_SCENE.food.y, MOTIVE_SCENE.food.z, 3, 9000); // 먹을 수 있는 밥(채집 표적)
    const prey = game.spawnCreature(MOTIVE_SCENE.prey.x, MOTIVE_SCENE.prey.y, MOTIVE_SCENE.prey.z); // size1 = 먹이(강탈 대상)
    prey.owner = 'P:demo'; game.ledger.get(prey.id).max = CREATURE_MAX_ENERGY * 8;
    game.ledger.transfer(POOL.SOURCE, prey.id, CREATURE_MAX_ENERGY * 8, CAUSE.SPAWN); // 넉넉히 채워 계속 표적이 된다
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
        if (scene === 'blast' || scene === 'detonate') return; // 관전자 — NPC 의 발산·비행·폭발/자폭을 지켜보기만 한다(possess 없음)
        // size 2 로 세우고 잔고를 목표치로 맞추는 헬퍼(보존 — SOURCE 와 주고받는다).
        const rear = (c, targetBal) => {
          c.size = 2; const pl = game.ledger.get(c.id); if (pl) pl.max = CREATURE_MAX_ENERGY * 2;
          const cur = game.ledger.balance(c.id);
          if (cur > targetBal) game.ledger.transfer(c.id, POOL.SOURCE, cur - targetBal, CAUSE.METABOLIZE);
          else if (cur < targetBal) game.ledger.transfer(POOL.SOURCE, c.id, targetBal - cur, CAUSE.SPAWN);
        };
        if (scene === 'motive') {
          // 동기 씬(feature-0018 step1) — 굶주린 생명체 하나에 **동기(허기)만** 준다(전략 채집/사냥은 주입하지 않는다).
          //   곁에 밥(멀리)·먹이(가까이)가 있으면, 같은 허기가 값어치 큰 가까운 기회(먹이)를 골라 **스스로 사냥한다**
          //   — HUNT 를 주입하지 않았는데도. "사냥은 욕구가 아니라 허기를 채우는 전략"이 눈으로 확인된다.
          const cre = game.possessCreature(playerId, MOTIVE_SCENE.start.x, MOTIVE_SCENE.start.y, MOTIVE_SCENE.start.z);
          rear(cre, 500); // 굶주림(편안 임계 1000 아래) — 헤드룸이 넉넉해 강탈로 편안해질 때까지 계속 사냥한다(예비는 아사선 120 위)
          game.injectDesire(playerId, MOTIVE.HUNGER, 1); // 동기 허기 하나만 — 전략은 상황이 고른다
          return;
        }
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
        if (scene === 'control') {
          // 제어 씬(구 feature-0010(현 0018) step3) — 카메라가 **내 생명체**를 태우고(아바타 통합), 둘레에 욕구별 표적을 둔다.
          //   오른쪽=먹을 결정(채집), 왼쪽=재료 쌍(제조), 아래=작은 먹이(사냥). 기본 욕구=채집 → 생명체가 굵은
          //   표적선(마칭앤츠)을 그리며 결정으로 걸어가 오라를 번뜩이며 먹는다. "누르면 저게 벌어진다"가 또렷하다.
          rear(cre, 1800);
          const { x, y, z } = CREATURE_START;
          game.spawnFood(x + 450, y - 80, z, 4, 2_600);
          game.spawnFood(x + 380, y + 150, z, 9, 2_400);
          game.spawnRawFood(x - 450, y + 70, z, 2, 3_000);
          game.spawnRawFood(x - 450, y - 70, z, 7, 3_000);
          const prey = game.spawnCreature(x + 40, y + 470, z);
          game.ledger.transfer(POOL.SOURCE, prey.id, 800, CAUSE.SPAWN);
          game.setDesire(playerId, DESIRE.FORAGE);
          return;
        }
        if (scene === 'threat') {
          // 위협·회피 — 곁의 큰 포식자에서 도망친다(회피 감정 자율 상승). 넉넉히 채워(굶주림 0) 회피 감정만 작용.
          rear(cre, 1800);
          game.injectDesire(playerId, DESIRE.FLEE, 1);
          return;
        }
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

  let demoTick = 0;
  const timer = setInterval(() => {
    if (scene === 'blast' || scene === 'detonate') { // 데모 지속용 — 생명체를 절반 아래로 마르면 다시 채운다(SOURCE→생명체, 보존).
      for (const c of game.creatures.values()) {
        const pl = game.ledger.get(c.id); if (!pl) continue;
        const cur = game.ledger.balance(c.id);
        if (cur < pl.max / 2) game.ledger.transfer(POOL.SOURCE, c.id, pl.max - cur, CAUSE.SPAWN);
      }
    }
    if (scene === 'detonate' && demoTick % 12 === 0) { // 주기적으로 과충전 결정을 만든다 → 다음 틱 자폭(생명 없이 터진다)
      const cry = game.spawnRawFood(DETONATE.bomb.x, DETONATE.bomb.y, DETONATE.bomb.z, 6, 15000);
      cry.raw = false; // 자연 결정 = 자폭 대상
    }
    demoTick++;
    game.tick();
  }, 1000 / TICK_RATE);
  return { httpServer, game, close: () => { clearInterval(timer); wss.close(); httpServer.close(); } };
}

// 직접 실행 시: 사람이 브라우저로 확인하는 라이브 데모.
if (process.argv[1] && process.argv[1].endsWith('demo-control.mjs')) {
  const port = process.env.PORT ?? 8080;
  startDemoServer({ port }).httpServer.listen(port, () => {
    console.log(`[HktFeature] 자율 감정 데모 — http://localhost:${port} (접속하면 굶주린 생명체가 스스로 식사 감정을 키워 밥으로 가고, 배부르면 사냥으로 넘어간다)`);
  });
}
