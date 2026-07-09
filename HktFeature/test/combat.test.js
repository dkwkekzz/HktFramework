// ============================================================================
// feature-0008 step1 — 발산·전투 = 포식(predation): 저항하는 저엔트로피 섬을 뜯어낸다
//
// 직관(물리): forage(국소장)·harvest(결정)는 수동적 저장고를 긁는다. 다른 생명체는 능동적으로 질서를
//   유지하므로 그 에너지를 뺏으려면 (1) 먼저 일을 들여 질서를 무너뜨리고(발산 비용 → 열/SINK),
//   (2) 붕괴로 풀려난 에너지도 전부는 못 붙잡는다(효율<1, 나머지는 국소장으로 흩어짐). 그래서:
//     · 얻는 것(강탈) < 뺏는 것(damage) — 2법칙·생태학 ~10% 법칙의 결(손실적).
//     · 발산은 SINK 를 늘린다(엔트로피 화살). 대상이 없으면 발산하지 않는다.
//     · 큰 개체가 작은 개체를 사냥한다(포식) — 뺏겨 예비 아래로 떨어진 먹이는 죽어 결정을 남긴다(생태 루프).
// 강제: 발산·강탈·흩어짐 전부 ledger.transfer(보존·정수). rng 미사용(순수 클램프) → 확산·성장 결정론 불변.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, WORLD_SOURCE_INITIAL, materialKey, dist3,
  CREATURE_ATTACK_RADIUS, CREATURE_ATTACK_POWER, CREATURE_ATTACK_COST, CREATURE_ATTACK_CAPTURE_PCT,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  game.addPlayer(conn, '관전자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const alive = (c) => game.creatures.has(c.id) && bal(c.id) > 0;
  const sumPrefix = (prefix) => { let s = 0; for (const [id, p] of game.ledger.pools) if (id.startsWith(prefix)) s += p.balance; return s; };
  const attackTxs = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops).filter(op => op.cause === 'attack' || op.cause === 'burst');
  // 생명체를 원하는 스탯·잔고로 세팅(백박스) — 풍요/포식 상황을 직접 재현한다.
  const makeCreature = (x, y, z, size, fill) => {
    const c = game.spawnCreature(x, y, z);
    if (size > 1) { c.size = size; game.ledger.get(c.id).max = 1000 * size; }
    if (fill !== undefined) {
      const cur = bal(c.id);
      if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
      else if (fill < cur) game.ledger.transfer(c.id, POOL.SINK, cur - fill, 'seed');
    }
    return c;
  };
  return { game, bal, total, runTicks, alive, attackTxs, makeCreature, matTotal: () => sumPrefix(POOL.MATERIAL), cryTotal: () => sumPrefix(POOL.CRYSTAL) };
}

test('강탈(포식) — 사거리 안 큰 개체가 작은 개체의 에너지를 뜯는다 (victim↓·attacker↑, 보존)', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 2, 900); // 포식자(size 2)
  const V = s.makeCreature(600, 500, 500, 1, 500); // 먹이(size 1) — 사거리(200) 안
  const a0 = s.bal(A.id), v0 = s.bal(V.id);
  s.runTicks(3); // 발산 판정은 tickCount 2 에서 첫 발화(INTERVAL=2)

  assert.ok(s.bal(V.id) < v0, `먹이가 에너지를 잃었다 (${v0} → ${s.bal(V.id)})`);
  assert.ok(s.bal(A.id) > a0, `포식자가 순증했다 — 강탈이 대사 비용을 넘는다 (${a0} → ${s.bal(A.id)})`);
  // 강탈 tx 는 victim→attacker 로 흐른다(에너지가 먹이에서 포식자로). 발산 비용은 attacker→SINK.
  assert.ok(s.attackTxs().some(op => op.cause === 'attack' && op.from === V.id && op.to === A.id), '강탈(먹이→포식자) tx 가 방송된다');
  assert.ok(s.attackTxs().some(op => op.cause === 'burst' && op.from === A.id && op.to === POOL.SINK), '발산 비용(포식자→심우주) tx 가 방송된다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '전투에도 보존 불변');
});

test('손실적 — 포식자가 얻는 것은 먹이가 잃는 것보다 적다 (효율<1, 2법칙·10% 법칙의 결)', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 2, 900);
  const V = s.makeCreature(600, 500, 500, 1, 500);
  const sink0 = s.bal(POOL.SINK);
  s.runTicks(3); // 한 번의 발산(tickCount 2)만 발화

  // 전투 회계는 tx 피드에서 직접 읽는다(대사와 섞이지 않게) — 세 갈래: 강탈·흩어짐·발산 비용.
  const txs = s.attackTxs();
  const capture = txs.filter(o => o.cause === 'attack' && o.to === A.id).reduce((a, o) => a + o.amount, 0);      // 붙잡은 몫
  const scatter = txs.filter(o => o.cause === 'attack' && o.from === V.id && o.to !== A.id).reduce((a, o) => a + o.amount, 0); // 국소장으로 흩어진 몫
  const cost = txs.filter(o => o.cause === 'burst').reduce((a, o) => a + o.amount, 0);                            // 발산 비용→SINK
  const damage = capture + scatter; // 먹이가 잃은 전부

  assert.ok(capture > 0 && scatter > 0 && cost > 0, '강탈·흩어짐·발산 비용이 모두 일어났다');
  assert.ok(capture < damage, `얻는 것 < 뺏는 것 — 손실적 회수 (강탈 ${capture} < 붕괴 ${damage})`);
  assert.equal(capture, Math.floor(damage * CREATURE_ATTACK_CAPTURE_PCT / 100), '강탈량 = damage×효율(나머지는 세계로)');
  assert.ok(s.bal(POOL.SINK) > sink0, '발산 비용이 심우주로 나갔다(엔트로피 화살)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('포식 창발 — 작은 개체는 큰 개체를 치지 못한다 (강자→약자 일방)', () => {
  const s = setup();
  const big = s.makeCreature(500, 500, 500, 3, 1500);
  const small = s.makeCreature(560, 500, 500, 1, 500);
  const small0 = s.bal(small.id);
  s.runTicks(6); // 여러 전투 판정(tickCount 2·4)

  assert.ok(s.bal(small.id) < small0, '작은 개체는 사냥당해 잃는다');
  // 강탈은 victim→attacker 로 흐른다. 작은 개체가 무언가를 강탈했다면 그 tx 의 to 는 small.id 여야 한다 —
  //   size< 규칙(약자는 강자를 못 침)이라 그런 tx 는 없어야 한다.
  const smallCaptured = s.attackTxs().some(op => op.cause === 'attack' && op.to === small.id);
  assert.ok(!smallCaptured, '작은 개체가 강탈한 tx 는 없다(포식은 강자→약자 일방)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('전투사 → 생태 루프 — 사냥당해 예비 아래로 떨어진 먹이는 죽어 결정을 남긴다', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 3, 2000); // 강한 포식자(계속 사냥)
  const V = s.makeCreature(560, 500, 500, 1, 300);  // 얕은 먹이 — 곧 뜯겨 죽는다
  const cry0 = s.cryTotal();
  for (let i = 0; i < 200 && s.alive(V); i++) s.game.tick();

  assert.ok(!s.alive(V), '먹이는 전투로 예비가 말라 죽었다');
  assert.ok(s.cryTotal() > cry0, '전투사한 먹이가 결정(잔해)을 남겼다 — 다른 생명이 채집할 씨앗(생태 루프)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '전투사·분해 전 과정에서 보존 불변');
});

test('사거리 — 사거리 밖의 먹이는 공격하지 않는다', () => {
  const s = setup();
  const A = s.makeCreature(300, 300, 500, 2, 900);
  const V = s.makeCreature(300, 300, 500, 1, 500);
  // 먹이를 사거리 밖으로 옮긴다
  V.x = 300 + CREATURE_ATTACK_RADIUS + 400;
  assert.ok(dist3(A.x, A.y, A.z, V.x, V.y, V.z) > CREATURE_ATTACK_RADIUS, '먹이는 사거리 밖');
  s.runTicks(6);
  assert.equal(s.attackTxs().length, 0, '사거리 밖이면 발산·강탈 tx 가 전혀 없다(공격 없음)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('결정론 — 같은 배치/이벤트열이면 전투 결과가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    const A = s.makeCreature(1000, 1000, 500, 3, 1800);
    const B = s.makeCreature(1080, 1000, 500, 2, 900);
    const C = s.makeCreature(1000, 1080, 500, 1, 500);
    s.runTicks(40);
    return [A, B, C].map(c => (s.game.creatures.has(c.id) ? [c.size, s.bal(c.id)] : [-1, -1]));
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 전투 궤적');
});

test('보존 폭풍 — 다수 난전(발산·강탈·흩어짐·전투사)에도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 12; i++) {
    const size = 1 + (i % 3); // size 1·2·3 섞어 포식 위계를 만든다
    s.makeCreature(800 + (i % 4) * 120, 900 + Math.floor(i / 4) * 120, 500, size, 300 + size * 300);
  }
  s.runTicks(300);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '발산·강탈·흩어짐·전투사·분해가 뒤섞여도 총합 불변');
});
