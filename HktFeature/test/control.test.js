// ============================================================================
// 구 feature-0010(현 0018) step1 — 제어·욕망: 플레이어/봇이 하나의 생명체를 제어한다
//
// 직관: 제어의 핵심은 "욕망(desire)"이다 — 생명체에 부여하는 동기(채집·사냥·…). 욕망은 표적(에너지원)을
//   정하고, 생명체는 그 표적으로 **이동**한다. 이동은 활동 에너지를 그 자리 국소장으로 흩는 소산이다
//   (생명체→국소장, feature-0004 의 MOVE). 표적에 도달하면 기존 획득 규칙(채집 0007·사냥 0008)이 수입을
//   만든다. 그래서 "이동은 욕망을 이루기 위한 수단이고, 그 수단은 에너지로 지불된다" — 제어의 전 과정이
//   에너지 흐름으로 닫힌다. 욕망 없는 소유 생명체는 주인 곁을 따른다(방향키 = 수동 이동).
// 강제: 이동·획득 전부 ledger.transfer(보존·정수). rng 미사용(순수 클램프) → 확산·성장 결정론 불변.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, WORLD_SOURCE_INITIAL, CREATURE_SPAWN_GRANT, CREATURE_DEATH_THRESHOLD,
  CREATURE_HARVEST_RADIUS, CREATURE_ATTACK_RADIUS, DESIRE, materialKey, dist3,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  const player = game.addPlayer(conn, '조종자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const alive = (c) => game.creatures.has(c.id) && bal(c.id) > 0;
  const txByCause = (cause) => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops).filter(op => op.cause === cause);
  const lastCreatureSnapshot = () => {
    const f = msgs.filter(m => m.t === MSG.CREATURE);
    const last = f[f.length - 1];
    const map = new Map();
    if (last) for (const [seq, x, y, z, b, size, desire, owner] of last.cells) map.set(seq, { x, y, z, balance: b, size, desire, owner });
    return map;
  };
  // 백박스 — 생명체를 원하는 스탯·잔고로 세팅(풍요/포식 상황 재현, combat.test.js 결)
  const fill = (c, amount) => {
    const cur = bal(c.id);
    if (amount > cur) game.ledger.transfer(POOL.SOURCE, c.id, amount - cur, 'seed');
    else if (amount < cur) game.ledger.transfer(c.id, POOL.SINK, cur - amount, 'seed');
  };
  const grow = (c, size) => { c.size = size; game.ledger.get(c.id).max = 1000 * size; };
  // 알려진 자리 근처에 결정을 석출시킨 뒤 **국소장을 얼린다**(남은 국소장을 비워 이웃 석출을 멈춘다).
  //   결정은 확산·복사 면역이라 그대로 선다 → 표적이 고정돼 이동 검증이 결정론적이다(실제 결정화 경로를 탐).
  //   반환: 그 자리에 남은 결정들(잔고>0). 국소장이 비어 채집 욕망 생명체는 오직 결정만을 표적으로 삼는다.
  const seedCrystal = (vx, vy, vz) => {
    game.ledger.transfer(POOL.SOURCE, `${POOL.MATERIAL}${vx}_${vy}_${vz}`, 4000, 'seed');
    for (let i = 0; i < 5; i++) game.tick();
    for (const id of game.materialKeys) { const b = bal(id); if (b > 0) game.ledger.transfer(id, POOL.SINK, b, 'freeze'); }
    const crys = [...game.crystals.values()].filter(c => bal(c.id) > 0);
    for (const c of crys) game.ledger.transfer(POOL.SOURCE, c.id, 3000, 'seed'); // 검증 창 동안 다 먹히지 않게 살찌운다
    return crys;
  };
  const nearestCrystalTo = (x, y, z) => {
    let best = null, bestD = Infinity;
    for (const c of game.crystals.values()) {
      if (bal(c.id) <= 0) continue;
      const d = dist3(x, y, z, c.x, c.y, c.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best ? { c: best, d: bestD } : null;
  };
  return {
    game, player, bal, total, runTicks, alive, txByCause, lastCreatureSnapshot, fill, grow, seedCrystal, nearestCrystalTo,
    matTotal: () => { let s = 0; for (const [id, p] of game.ledger.pools) if (id.startsWith(POOL.MATERIAL)) s += p.balance; return s; },
  };
}

test('창세 — 제어 없이 시작한다(소유 생명체 없음), 보존 불변', () => {
  const { game, total } = setup();
  assert.equal(game.creatures.size, 0, 'addPlayer 만으로는 생명체가 생기지 않는다(라이브 진입점에서만 possess)');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('제어 결선 — possess 는 SOURCE→생명체 이체로 소유 생명체를 쥐어준다(보존, owner 설정)', () => {
  const { game, player, bal, total } = setup();
  const src0 = bal(POOL.SOURCE);
  const cre = game.possessCreature(player.id, 1000, 1000, 500);
  assert.equal(cre.owner, player.id, '소유자가 나로 설정된다');
  assert.equal(cre.desire, DESIRE.NONE, '기본 욕망은 대기');
  assert.equal(bal(cre.id), CREATURE_SPAWN_GRANT, '스폰 인출 = SPAWN_GRANT(태양이 유일한 원점)');
  assert.equal(bal(POOL.SOURCE), src0 - CREATURE_SPAWN_GRANT);
  assert.equal(total(), WORLD_SOURCE_INITIAL, 'possess 후 총합 불변');
});

test('욕망(채집)이 이동을 부른다 — 생명체가 결정 쪽으로 다가간다', () => {
  const s = setup();
  s.seedCrystal(2, 2, 2); // 스폰 지역(관전자 시야 안) 근처에 결정
  const cre = s.game.possessCreature(s.player.id, 500, 1250, 625); // 결정에서 떨어진(감지 반경 안) 자리
  cre.desire = DESIRE.FORAGE;
  const n0 = s.nearestCrystalTo(cre.x, cre.y, cre.z);
  assert.ok(n0 && n0.d > CREATURE_HARVEST_RADIUS, '처음엔 채집 사거리 밖에서 시작한다');
  s.runTicks(40);
  const n1 = s.nearestCrystalTo(cre.x, cre.y, cre.z);
  assert.ok(n1 && n1.d < n0.d, `채집 욕망이 생명체를 결정 쪽으로 이동시켰다 (${Math.round(n0.d)} → ${Math.round(n1.d)})`);
  assert.ok(n1.d <= CREATURE_HARVEST_RADIUS + 40, '결정 채집 사거리 안까지 접근한다(도달하면 멈춤)');
});

test('이동은 에너지로 지불된다 — 이동분이 그 자리 국소장으로 소산된다(생명체→국소장 MOVE, 보존)', () => {
  const s = setup();
  s.seedCrystal(2, 2, 2);
  const cre = s.game.possessCreature(s.player.id, 500, 1250, 625);
  cre.desire = DESIRE.FORAGE;
  const mat0 = s.matTotal();
  s.runTicks(20);
  const moves = s.txByCause('move').filter(op => op.from === cre.id);
  assert.ok(moves.length > 0, '생명체 이동이 MOVE tx(생명체→국소장)로 방송된다');
  assert.ok(moves.every(op => op.to.startsWith(POOL.MATERIAL)), '이동 소산은 국소장으로 간다(플레이어 이동과 같은 회계)');
  assert.ok(s.matTotal() >= mat0, '소산으로 국소장이 늘었다(에너지는 사라지지 않고 흩어질 뿐)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '이동에도 보존 불변');
});

test('욕망을 이룬다 — 채집 욕망 생명체가 결정에 도달해 흡수한다(이동=수단, 획득=목적)', () => {
  const s = setup();
  s.seedCrystal(2, 2, 2);
  const cre = s.game.possessCreature(s.player.id, 550, 1250, 625);
  cre.desire = DESIRE.FORAGE;
  s.fill(cre, 300); // 여정 동안 살아있게
  s.runTicks(60);   // 접근 + 채집
  const harvests = s.txByCause('harvest').filter(op => op.to === cre.id);
  assert.ok(harvests.length > 0, '결정에 도달해 채집(결정→생명체) tx 가 일어났다 — 욕망이 이뤄진다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '채집에도 보존 불변');
});

test('욕망(사냥) — 포식자가 더 작은 먹이로 다가가 사거리 안에서 강탈한다', () => {
  const s = setup();
  const A = s.game.possessCreature(s.player.id, 700, 1000, 500); // 포식자(제어) — 스폰 지역 시야 안
  s.grow(A, 2); s.fill(A, 1600);
  A.desire = DESIRE.HUNT;
  const V = s.game.spawnCreature(700 + 820, 1000, 500);         // 먹이(size1) — 감지 반경 안, 사거리 밖
  s.fill(V, 600);
  const d0 = dist3(A.x, A.y, A.z, V.x, V.y, V.z);
  const v0 = s.bal(V.id);
  s.runTicks(60);
  const d1 = dist3(A.x, A.y, A.z, V.x, V.y, V.z);
  assert.ok(d1 < d0, `사냥 욕망이 포식자를 먹이 쪽으로 이동시켰다 (${Math.round(d0)} → ${Math.round(d1)})`);
  assert.ok(s.txByCause('attack').some(op => op.from === V.id && op.to === A.id), '사거리 안에서 강탈(먹이→포식자) tx 가 일어났다');
  assert.ok(s.bal(V.id) < v0, '먹이가 사냥당해 에너지를 잃었다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '사냥에도 보존 불변');
});

test('굶주리면 못 쫓는다 — 예비 이하 생명체는 이동하지 않는다(이동도 에너지가 필요하다)', () => {
  const s = setup();
  s.seedCrystal(2, 2, 2);
  const cre = s.game.possessCreature(s.player.id, 500, 1250, 625);
  cre.desire = DESIRE.FORAGE;
  s.fill(cre, CREATURE_DEATH_THRESHOLD); // 최소 예비만 남긴다(=가드 경계)
  const x0 = cre.x, y0 = cre.y;
  s.runTicks(2); // 첫 실동작 틱(tickCount 1)에서 pursue 가드가 이동을 막는다
  assert.equal(cre.x, x0, '굶주린 생명체는 x 로 움직이지 못한다');
  assert.equal(cre.y, y0, '굶주린 생명체는 y 로 움직이지 못한다');
  assert.equal(s.txByCause('move').filter(op => op.from === cre.id).length, 0, '이동 MOVE tx 도 없다');
});

test('수동 추종 — 욕망 없는 소유 생명체는 주인(방향키)의 위치로 따라온다', () => {
  const s = setup();
  const cre = s.game.possessCreature(s.player.id, 500, 500, 500);
  cre.desire = DESIRE.NONE;
  // 주인이 멀리 이동한다(방향키 = 서버 플레이어 위치 변경). 생명체가 그 자리로 향한다.
  s.player.x = 1300; s.player.y = 500; s.player.z = 500;
  const d0 = dist3(cre.x, cre.y, cre.z, s.player.x, s.player.y, s.player.z);
  s.runTicks(30);
  const d1 = dist3(cre.x, cre.y, cre.z, s.player.x, s.player.y, s.player.z);
  assert.ok(d1 < d0, `대기 욕망 생명체가 주인 쪽으로 따라왔다 (${Math.round(d0)} → ${Math.round(d1)})`);
});

test('표적 없으면 제자리 — 욕망은 있으나 감지 반경 안 표적이 없으면 움직이지 않는다', () => {
  const s = setup();
  const cre = s.game.possessCreature(s.player.id, 300, 1700, 500); // 결정 없는 외딴 자리
  cre.desire = DESIRE.FORAGE;
  const x0 = cre.x, y0 = cre.y;
  s.runTicks(10);
  assert.equal(cre.x, x0, '표적이 없으면 x 불변');
  assert.equal(cre.y, y0, '표적이 없으면 y 불변(무한 배회하지 않는다)');
});

test('야생 정지성 — owner·desire 없는 생명체는 움직이지 않는다(기존 feature 불변)', () => {
  const s = setup();
  const cre = s.game.spawnCreature(1000, 1000, 500); // possess 아님 = 야생
  s.game.ledger.transfer(POOL.SOURCE, materialKey(cre.x, cre.y, cre.z), 5_000_000, 'seed');
  const x0 = cre.x, y0 = cre.y, z0 = cre.z;
  s.runTicks(50);
  assert.equal(cre.x, x0, '야생 생명체는 이동하지 않는다 — 정지성(기존 생태·테스트 불변의 근거)');
  assert.equal(cre.y, y0);
  assert.equal(cre.z, z0);
});

test('욕망 부여 — DESIRE 인텐트/ setDesire 가 내 생명체의 desire 를 바꾼다(잘못된 값은 대기)', () => {
  const s = setup();
  const cre = s.game.possessCreature(s.player.id, 500, 500, 500);
  s.game.onMessage(s.player.id, { t: MSG.DESIRE, desire: 'hunt' });
  assert.equal(cre.desire, DESIRE.HUNT, 'DESIRE 인텐트로 사냥 부여');
  s.game.onMessage(s.player.id, { t: MSG.DESIRE, desire: 'forage' });
  assert.equal(cre.desire, DESIRE.FORAGE, '채집으로 전환');
  s.game.onMessage(s.player.id, { t: MSG.DESIRE, desire: '제조없음' });
  assert.equal(cre.desire, DESIRE.NONE, '유효하지 않은 욕망은 대기로 클램프');
});

test('제어 해제 — 주인이 떠나면 생명체는 야생으로 돌아간다(owner·desire 해제, 에너지 보존)', () => {
  const s = setup();
  const cre = s.game.possessCreature(s.player.id, 500, 500, 500);
  cre.desire = DESIRE.FORAGE;
  const bal0 = s.bal(cre.id);
  s.game.removePlayer(s.player.id);
  assert.equal(cre.owner, null, '떠난 주인의 생명체는 소유가 풀린다');
  assert.equal(cre.desire, DESIRE.NONE, '욕망도 풀려 정지(야생)');
  assert.ok(s.game.creatures.has(cre.id) && s.bal(cre.id) === bal0, '생명체·에너지는 그대로(소멸이 아니라 통제만 놓는다)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('CREATURE 방송 — desire·owner 가 스냅샷에 실린다(뷰어가 욕망 라벨·내 생명체 강조)', () => {
  const s = setup();
  const cre = s.game.possessCreature(s.player.id, 1000, 1000, 500);
  cre.desire = DESIRE.HUNT;
  s.runTicks(10);
  const snap = s.lastCreatureSnapshot();
  const one = snap.get(cre.seq);
  assert.ok(one, '내 생명체가 스냅샷에 실린다');
  assert.equal(one.desire, DESIRE.HUNT, 'desire 가 실린다');
  assert.equal(one.owner, s.player.id, 'owner 가 실린다(내 아바타 식별)');
});

test('결정론 — 같은 배치/욕망/이벤트열이면 위치·잔고가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    s.seedCrystal(2, 2, 2);
    const A = s.game.possessCreature(s.player.id, 500, 1250, 625); A.desire = DESIRE.FORAGE;
    const B = s.game.possessCreature(s.player.id, 900, 900, 500); s.grow(B, 2); s.fill(B, 1200); B.desire = DESIRE.HUNT;
    const C = s.game.spawnCreature(1060, 900, 500); s.fill(C, 500); // B 의 먹이
    s.runTicks(80);
    return [A, B, C].map(c => (s.game.creatures.has(c.id) ? [c.x, c.y, c.z, s.bal(c.id)] : [-1, -1, -1, -1]));
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 제어 궤적');
});

test('보존 폭풍 — 다수 제어 생명체가 이동·채집·사냥해도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 4; i++) s.seedCrystal(i % 4, i % 3, 2);
  for (let i = 0; i < 10; i++) {
    const c = s.game.possessCreature(s.player.id, 300 + i * 130, 500 + (i % 3) * 200, 500);
    if (i % 2 === 0) { c.desire = DESIRE.FORAGE; }
    else { s.grow(c, 2); s.fill(c, 900); c.desire = DESIRE.HUNT; }
  }
  s.runTicks(400);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '이동·채집·사냥·소산이 뒤섞여도 총합 불변');
});
