// ============================================================================
// feature-0009 step1 — 발산·파괴 = 방출형: 표적의 질서를 세계로 흩어버린다
//
// 직관(물리): 강탈(feature-0008)이 표적 에너지를 커플링해 일부 포획(수입)하는 것이라면, 방출은 표적의
//   질서를 *파괴만* 한다 — 붕괴 에너지가 캐스터가 아니라 세계(심우주 열 + 국소장 연기)로 흩어진다. 그래서:
//     · 회수 없음 — 표적이 잃은 것은 그 어떤 tx 로도 캐스터에게 가지 않는다(강탈=내가 큼 / 방출=내가 줌).
//     · 크기 무관 — 약자도 강자를 태운다(포식의 한계를 뚫는 값비싼 반격).
//     · 완전 연소 — 세게 맞아 예비가 무너진 표적은 잔해 결정조차 없이 전소해 사라진다.
// 강제: 발산·파괴 전부 ledger.transfer(보존·정수). "사라진다"는 엔티티 소멸일 뿐 — 총합 = 10⁹ 불변.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, WORLD_SOURCE_INITIAL, dist3,
  CREATURE_ATTACK_RADIUS, DISCHARGE_RADIUS, DISCHARGE_BURN_PCT,
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
  const ops = () => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops);
  const dischargeTxs = () => ops().filter(o => o.cause === 'discharge');
  const burstTxs = () => ops().filter(o => o.cause === 'burst');
  // 생명체를 원하는 스탯·잔고로 세팅(백박스).
  const makeCreature = (x, y, z, size, fill) => {
    const c = game.spawnCreature(x, y, z);
    if (size > 1) { c.size = size; game.ledger.get(c.id).max = 1000 * size; }
    const cur = bal(c.id);
    if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
    else if (fill < cur) game.ledger.transfer(c.id, POOL.SINK, cur - fill, 'seed');
    return c;
  };
  return { game, bal, total, runTicks, alive, makeCreature, dischargeTxs, burstTxs, cryTotal: () => sumPrefix(POOL.CRYSTAL) };
}

test('회수 없음 — 방출로 흩어진 에너지는 절대 생명체(캐스터)로 가지 않는다 (강탈과의 결정적 대비)', () => {
  const s = setup();
  // 동급(size 1) 두 개체 — 강탈(size< )은 안 일어나고 방출만 일어나 회수 여부를 순수 관측.
  const A = s.makeCreature(500, 500, 500, 1, 700);
  const B = s.makeCreature(700, 500, 500, 1, 700);
  s.runTicks(5); // 방출 판정은 tickCount 4 에서 첫 발화(INTERVAL=4)

  const txs = s.dischargeTxs();
  assert.ok(txs.length > 0, '방출(파괴) tx 가 방송된다');
  // 파괴 흐름의 종착은 심우주(SINK)·국소장(M:)뿐 — 생명체(C:)로 가는 discharge tx 는 하나도 없다.
  const toCreature = txs.filter(o => o.to.startsWith(POOL.CREATURE));
  assert.equal(toCreature.length, 0, '방출은 회수가 없다 — 표적 에너지가 캐스터로 흐르지 않는다');
  assert.ok(txs.every(o => o.to === POOL.SINK || o.to.startsWith(POOL.MATERIAL)), '종착은 심우주(열)·국소장(연기)뿐');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '방출에도 보존 불변(사라진 건 없다 — 세계로 흩어졌을 뿐)');
});

test('파괴 = 분산 — 표적은 줄고, 붕괴 에너지는 심우주(열)+국소장(연기)로, 캐스터는 순손실', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 1, 900); // 캐스터(넉넉)
  const B = s.makeCreature(700, 500, 500, 1, 90);  // 표적(발산 예비 없음 → 반격 못 함): cost(20)+예비(60)=80 초과분만 발사 가능
  const sink0 = s.bal(POOL.SINK);
  s.runTicks(5);

  // 표적이 잃은 것을 tx 로 읽는다(대사와 분리): 열(→SINK) + 연기(→국소장).
  const txs = s.dischargeTxs().filter(o => o.from === B.id);
  const burn = txs.filter(o => o.to === POOL.SINK).reduce((a, o) => a + o.amount, 0);
  const smoke = txs.filter(o => o.to.startsWith(POOL.MATERIAL)).reduce((a, o) => a + o.amount, 0);
  assert.ok(burn > 0 && smoke > 0, '붕괴 에너지가 열(심우주)과 연기(국소장) 둘로 흩어졌다');
  assert.equal(burn, Math.floor((burn + smoke) * DISCHARGE_BURN_PCT / 100), '태운 비율 = BURN_PCT(나머지는 연기)');
  assert.ok(s.burstTxs().some(o => o.from === A.id && o.to === POOL.SINK), '캐스터는 발산 비용을 심우주로 지불(순손실)');
  assert.ok(s.bal(POOL.SINK) > sink0, '심우주가 늘었다(파괴는 세계를 데운다 = 엔트로피 주입)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('원거리 — 근접 강탈 사거리 밖의 표적도 방출로 타격한다 (투사체)', () => {
  const s = setup();
  const mid = Math.round((CREATURE_ATTACK_RADIUS + DISCHARGE_RADIUS) / 2); // 강탈 사거리 밖, 방출 사거리 안
  assert.ok(mid > CREATURE_ATTACK_RADIUS && mid < DISCHARGE_RADIUS);
  // 관전자 지역 커버리지(스폰 1000,1000 둘레) 안에 배치해야 tx 가 방송된다.
  const A = s.makeCreature(900, 1000, 500, 1, 900);
  const B = s.makeCreature(900 + mid, 1000, 500, 1, 90);
  const b0 = s.bal(B.id);
  s.runTicks(5);
  assert.ok(s.bal(B.id) < b0 || !s.game.creatures.has(B.id), `강탈 사거리 밖(${mid}px)이라도 방출로 타격했다`);
  assert.ok(s.dischargeTxs().some(o => o.from === B.id), '표적이 방출로 에너지를 잃었다');

  // 방출 사거리 밖은 안 맞는다(대조)
  const s2 = setup();
  s2.makeCreature(900, 1000, 500, 1, 900);
  s2.makeCreature(900 + DISCHARGE_RADIUS + 300, 1000, 500, 1, 900);
  s2.runTicks(5);
  assert.equal(s2.dischargeTxs().length, 0, '방출 사거리 밖이면 발사 없음');
});

test('약자가 강자를 태운다 — 방출은 먹을 수 없는 상대(size ≥)를 친다 (포식의 강자→약자 일방을 뚫는다)', () => {
  const s = setup();
  const small = s.makeCreature(500, 500, 500, 1, 900); // 약자 캐스터
  const big = s.makeCreature(650, 500, 500, 3, 2500);  // 강자 표적(사거리 안)
  s.runTicks(5);
  // 약자(small)가 발산 비용을 냈고, 강자(big)가 방출로 에너지를 잃었다 = 약자가 강자를 태웠다.
  assert.ok(s.burstTxs().some(o => o.from === small.id), '약자가 발산 비용을 냈다(발사)');
  assert.ok(s.dischargeTxs().some(o => o.from === big.id && (o.to === POOL.SINK || o.to.startsWith(POOL.MATERIAL))), '강자가 방출로 질서를 잃었다(약자의 반격)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('완전 연소 — 예비가 무너진 표적은 잔해 결정 없이 전소해 사라진다', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 2, 1800); // 강한 캐스터(damage=70×2=140)
  const B = s.makeCreature(650, 500, 500, 2, 150);  // 동급 표적(size≥ 이라야 방출 대상) — 예비(120) 위지만 한 발에 붕괴
  const cry0 = s.cryTotal();
  s.runTicks(5);
  assert.ok(!s.game.creatures.has(B.id), '표적이 전소해 사라졌다(엔티티 소멸)');
  assert.equal(s.cryTotal(), cry0, '완전 연소 — 잔해 결정을 남기지 않는다(전부 열+연기로)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '전소에도 보존 불변 — 에너지는 세계로 흩어졌을 뿐 소멸 안 함');
});

test('결정론 — 같은 배치/이벤트열이면 방출 결과가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    s.makeCreature(1000, 1000, 500, 2, 1500);
    s.makeCreature(1150, 1000, 500, 1, 400);
    s.makeCreature(1000, 1150, 500, 1, 400);
    s.runTicks(40);
    return [...s.game.creatures.values()].sort((a, b) => a.seq - b.seq).map(c => [c.seq, c.size, s.bal(c.id)]);
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 방출 궤적');
});

test('보존 폭풍 — 다수 난전(발산·방출·완전 연소)에도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 12; i++) {
    const size = 1 + (i % 3);
    s.makeCreature(800 + (i % 4) * 110, 900 + Math.floor(i / 4) * 110, 500, size, 200 + size * 300);
  }
  s.runTicks(300);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '발산·방출·완전 연소가 뒤섞여도 총합 불변(사라진 건 엔티티일 뿐)');
});
