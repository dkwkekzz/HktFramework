// ============================================================================
// feature-0014 step1 — 획득(소유): 소화가 아니라 소유. 아이템을 먹어 없애지 않고 지닌다
//
// 직관(물리): 채집(feature-0007)은 결정을 흡수해 소멸시킨다(소화). 획득은 다르다 — 아이템(결정)을
//   소화하지 않고 **소유**한다: 결정은 잔고 그대로 주인에게 귀속되어(에너지 이동 없음 = 보존 자명)
//   세계 상호작용(채집·반응·용해·파괴) 밖으로 빠지고 주인을 따라다닌다. 죽으면 그 자리 세계로 되돌아온다.
//   소유는 이후 공명(feature-0015)으로 힘을 발휘하는 전제다.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { POOL, WORLD_SOURCE_INITIAL, CREATURE_CARRY_MAX, CREATURE_HARVEST_RADIUS } from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  game.addPlayer({ send() {} }, '관전자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
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
  // 결정 하나를 그 자리에 떨군다(플레이어 죽음 분해 이용) — 종·잔고를 알려진 값으로 고정.
  const dropCrystal = (x, y, z, species, fill) => {
    const pv = game.addPlayer({ send() {} }, 'v');
    const pl = game.players.get(pv.id); pl.x = x; pl.y = y; pl.z = z;
    game.removePlayer(pv.id);
    let c = null;
    for (const k of game.crystals.values()) if (k.x === x && k.y === y && k.z === z && bal(k.id) > 0) c = k;
    c.species = species; c.raw = false;
    const cur = bal(c.id);
    if (fill > cur) game.ledger.transfer(POOL.SOURCE, c.id, fill - cur, 'seed');
    else if (fill < cur) game.ledger.transfer(c.id, POOL.SINK, cur - fill, 'seed');
    return c;
  };
  return { game, bal, total, runTicks, makeCreature, dropCrystal };
}

test('소유 — 아이템을 소화하지 않고 지닌다 (잔고 그대로·주인 슬롯·세계에서 빠짐·보존)', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 1, 800);
  const item = s.dropCrystal(520, 500, 500, 3, 400);
  const itemBal0 = s.bal(item.id);

  assert.ok(s.game.crystals.has(item.id), '획득 전엔 세계 결정이다');
  assert.ok(s.game.acquireItem(A, item), '아이템을 소유했다');

  assert.deepEqual(A.items, [item.id], '주인 슬롯에 들어갔다');
  assert.equal(item.heldBy, A.id, '아이템에 주인 표식이 붙었다');
  assert.ok(!s.game.crystals.has(item.id), '세계 결정 레지스트리에서 빠졌다(채집·반응·용해·파괴 밖)');
  assert.ok(s.game.heldItems.has(item.id), '소유 레지스트리에 있다');
  assert.equal(s.bal(item.id), itemBal0, '에너지 이동 없음 — 소화가 아니다(잔고 그대로)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '소유에도 보존 불변(풀은 원장에 그대로)');
});

test('소유물은 남이 못 먹는다 — 채집(소화) 대상에서 빠진다', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 1, 800);
  const item = s.dropCrystal(520, 500, 500, 3, 400);
  s.game.acquireItem(A, item);
  const itemBal0 = s.bal(item.id);
  // 다른 굶주린 생명체를 결정 바로 곁에 둔다 — 세계 결정이면 채집(harvest)으로 먹혔을 것.
  s.makeCreature(520, 500, 500, 1, 200);
  s.runTicks(5);
  assert.equal(s.bal(item.id), itemBal0, '소유물은 곁의 다른 생명이 채집하지 못한다(세계 밖)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('소유물은 주인을 따라다닌다 — 주인이 움직이면 위치가 갱신된다', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 1, 800);
  const item = s.dropCrystal(520, 500, 500, 3, 400);
  s.game.acquireItem(A, item);
  A.x = 900; A.y = 700; A.z = 300;   // 주인 이동
  s.runTicks(2);                     // 대사(위치 동기화)는 tickCount>0 부터 — 2틱이면 확실히 1회 돈다
  assert.deepEqual([item.x, item.y, item.z], [900, 700, 300], '소유물이 주인 자리로 따라왔다');
});

test('슬롯 한도 — CARRY_MAX 를 넘겨 소유할 수 없다', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 1, 5000);
  for (let i = 0; i < CREATURE_CARRY_MAX; i++) {
    const it = s.dropCrystal(510 + i, 500, 500, 3, 300);
    assert.ok(s.game.acquireItem(A, it), `${i + 1}번째 소유 성공`);
  }
  const extra = s.dropCrystal(600, 500, 500, 3, 300);
  assert.ok(!s.game.acquireItem(A, extra), '슬롯이 차면 더 못 지닌다');
  assert.equal(A.items.length, CREATURE_CARRY_MAX, '슬롯 수만큼만 지닌다');
});

test('죽으면 소유물은 세계로 되돌아온다 (소화 아님 — 잔고 그대로, 보존)', () => {
  const s = setup();
  const A = s.makeCreature(500, 500, 500, 1, 100); // 곧 굶어 죽을 만큼만
  const item = s.dropCrystal(1500, 500, 500, 3, 400); // 아이템은 다른 복셀에 떨군다(분해 국소장이 A 를 먹여 살리지 않게)
  s.game.acquireItem(A, item);
  // 죽기 직전까지 held 상태에서 잔고가 안 변하는지(=소화 안 됨) 확인하며 아사시킨다.
  let bornWorld = false;
  for (let i = 0; i < 30 && s.game.creatures.has(A.id); i++) {
    assert.equal(s.bal(item.id), 400, 'held 인 동안 잔고 그대로 — 소화되지 않는다');
    s.runTicks(1);
  }
  assert.ok(!s.game.creatures.has(A.id), '주인이 굶어 죽었다');
  assert.ok(s.game.crystals.has(item.id) && !s.game.heldItems.has(item.id), '소유물이 세계 결정으로 되돌아왔다(함께 사라지지 않음)');
  assert.equal(item.heldBy, null, '주인 표식이 풀렸다');
  assert.ok(s.bal(item.id) > 0, '되돌아온 아이템이 잔고를 지녔다(소화된 적 없음 — 이후 세계 물리는 별개)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});
