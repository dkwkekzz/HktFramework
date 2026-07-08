// ============================================================================
// feature-0002 — 에너지는 전부 정수 (부동소수 에너지는 존재하지 않는다)
//
// 직관: 화면·tx 스트림·원장 어디에도 소수점 에너지는 나타나지 않는다.
// 강제: 원장 이체가 비정수 want 를 구조적으로 기각하고, 이동 비용은 floor 정수.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnergyLedger } from '../shared/ledger.js';
import { GameServer } from '../server/game.js';
import { mulberry32, randInt } from '../shared/rng.js';
import { MSG } from '../shared/protocol.js';
import {
  WORLD_SOURCE_INITIAL, SPAWN_GRANT, MOVE_COST_STRIDE_PX, SPAWN_POS,
  WORLD_SIZE, WORLD_HEIGHT, moveCost,
} from '../shared/constants.js';

test('비정수 이체는 원장에서 기각된다 (잔고 불변)', () => {
  const l = new EnergyLedger();
  l.createPool('a', 100, 100);
  l.createPool('b', 0, 100);
  assert.equal(l.transfer('a', 'b', 10.5, 't'), 0, '소수 want 기각');
  assert.equal(l.transfer('a', 'b', 3.0000001, 't'), 0, '근사 정수도 기각');
  assert.equal(l.balance('a'), 100, '기각 시 출금 잔고 불변');
  assert.equal(l.balance('b'), 0, '기각 시 입금 잔고 불변');
  assert.equal(l.transfer('a', 'b', 10, 't'), 10, '정수는 성립');
});

test('이동 비용은 항상 정수다 (floor 양자화) — 임의 실수 거리에서도', () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 1000; i++) {
    const debt = rng() * MOVE_COST_STRIDE_PX;   // 실수 잔여 거리
    const dist = rng() * 3000;                  // 실수 이동 거리
    const { cost, debt: nextDebt } = moveCost(debt, dist);
    assert.ok(Number.isInteger(cost), `비용 정수 (${cost})`);
    assert.ok(cost >= 0, '비용 음수 아님');
    assert.ok(nextDebt >= 0 && nextDebt < MOVE_COST_STRIDE_PX, '잔여 거리 범위');
  }
});

test('창세·스폰 상수는 정수 — 부동소수 에너지 없음', () => {
  assert.ok(Number.isInteger(WORLD_SOURCE_INITIAL));
  assert.ok(Number.isInteger(SPAWN_GRANT));
  assert.ok(Number.isInteger(MOVE_COST_STRIDE_PX));
});

test('접속·이동 시퀀스 후에도 모든 풀 잔고가 정수', () => {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const conns = [];
  for (let i = 0; i < 5; i++) {
    const conn = { send() {} };
    conns.push(game.addPlayer(conn, `P${i}`));
  }
  const rng = mulberry32(7);
  for (let step = 0; step < 300; step++) {
    const p = conns[randInt(rng, 0, conns.length - 1)];
    clock.t += 60_000;
    game.onMessage(p.id, {
      t: MSG.BEACON,
      x: randInt(rng, 0, WORLD_SIZE), y: randInt(rng, 0, WORLD_SIZE), z: randInt(rng, 0, WORLD_HEIGHT),
    });
    if (step % 10 === 0) game.tick();
  }
  for (const pool of game.ledger.pools.values()) {
    assert.ok(Number.isInteger(pool.balance), `풀 ${pool.id} 잔고 정수 (${pool.balance})`);
  }
});
