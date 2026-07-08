// ============================================================================
// feature-0003 — 닫힌 열역학 루프 (SOURCE=태양, SINK=소산, 세계는 영속한다)
//
// 직관: 이동하면 에너지가 소실(SINK)로 흩어져 쌓이고, 태양 순환이 주기적으로
//   그 전부를 태양(SOURCE)으로 되돌린다. 총합은 늘 창세 총량 — 세계는 마르지 않는다.
// 강제: SINK→SOURCE 재순환도 이체(보존). 어느 순간에도 자유+태양+소실 = 창세 총량.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { mulberry32, randInt } from '../shared/rng.js';
import {
  POOL, WORLD_SOURCE_INITIAL, SPAWN_POS, RECYCLE_INTERVAL_TICKS,
  WORLD_SIZE, WORLD_HEIGHT,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const join = (name) => game.addPlayer({ send() {} }, name);
  const warp = (p, x, y, z = SPAWN_POS.z) => { clock.t += 60_000; game.onMessage(p.id, { t: MSG.BEACON, x, y, z }); };
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  return { game, join, warp, bal, total };
}

test('창세에 태양(SOURCE)·소실(SINK)이 함께 열린다 — SINK 는 0에서 시작', () => {
  const { bal, total } = setup();
  assert.equal(bal(POOL.SOURCE), WORLD_SOURCE_INITIAL, '태양이 전 에너지를 쥔다');
  assert.equal(bal(POOL.SINK), 0, '소실은 비어 시작');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('방출→소산→순환 — 이동은 SINK로 흩어지고 태양 순환이 SOURCE로 되돌린다', () => {
  const { game, join, warp, bal, total } = setup();
  const a = join('A');
  warp(a, SPAWN_POS.x + 800, SPAWN_POS.y); // 800px 이동 → 소산 floor(800/50)=16
  const dissipated = bal(POOL.SINK);
  assert.ok(dissipated > 0, '이동이 SINK 로 소산');
  const srcBefore = bal(POOL.SOURCE);

  for (let i = 0; i <= RECYCLE_INTERVAL_TICKS; i++) game.tick(); // 태양 순환 주기 통과
  assert.equal(bal(POOL.SINK), 0, '태양 순환이 소실을 비운다');
  assert.equal(bal(POOL.SOURCE), srcBefore + dissipated, 'SINK→SOURCE 복귀(전량)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '순환 내내 총합 불변');
});

test('세계는 영속한다 — 이동↔순환을 반복해도 태양은 마르지 않고 총합 불변', () => {
  const { game, join, warp, bal, total } = setup();
  const players = [];
  for (let i = 0; i < 6; i++) players.push(join(`P${i}`));
  const rng = mulberry32(2026);
  const floor = WORLD_SOURCE_INITIAL - players.length * 1000; // 태양 하한(전원이 만충이어도 이 아래로 안 감)

  for (let cycle = 0; cycle < 8; cycle++) {
    for (let m = 0; m < 40; m++) {
      const p = players[randInt(rng, 0, players.length - 1)];
      warp(p, randInt(rng, 0, WORLD_SIZE), randInt(rng, 0, WORLD_SIZE), randInt(rng, 0, WORLD_HEIGHT));
    }
    for (let i = 0; i < RECYCLE_INTERVAL_TICKS; i++) game.tick(); // 순환 한 바퀴
    assert.equal(total(), WORLD_SOURCE_INITIAL, `cycle ${cycle} 총합 불변`);
    assert.ok(bal(POOL.SOURCE) > floor, `cycle ${cycle} 태양이 마르지 않음`);
  }
  // 어느 순간에도 에너지는 세 곳에만: 자유 + 태양 + 소실 = 창세 총량
  let free = 0;
  for (const p of players) free += bal(p.id);
  assert.equal(free + bal(POOL.SOURCE) + bal(POOL.SINK), WORLD_SOURCE_INITIAL);
});
