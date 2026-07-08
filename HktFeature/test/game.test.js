// ============================================================================
// 게임 통합 테스트 — 수송 계층 없이 GameServer 를 직접 구동한다 (최소 원장 코어).
//
// 검증 축 (feature 가 쌓여도 유지되어야 할 기반 불변식):
//   1. 보존: 어떤 접속·이동 시퀀스에서도 전 풀 합계 = WORLD_SOURCE_INITIAL
//   2. 검증: 비콘 속도 예산(스피드핵) 초과는 TELEPORT 로 기각된다
//   3. 미러: 클라 원장을 서버 메시지만으로 재구축하면 서버 잔고·지역 체크섬과 일치한다
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { ClientState } from '../client/state.js';
import { MSG, decode } from '../shared/protocol.js';
import { mulberry32, randInt } from '../shared/rng.js';
import {
  POOL, WORLD_SOURCE_INITIAL, SPAWN_GRANT, SPAWN_POS, WORLD_SIZE, WORLD_HEIGHT,
  MOVE_COST_STRIDE_PX, dist3,
} from '../shared/constants.js';

function makeConn() {
  return { msgs: [], send(s) { this.msgs.push(typeof s === 'string' ? JSON.parse(s) : decode(s)); } };
}

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const join = (name) => {
    const conn = makeConn();
    const player = game.addPlayer(conn, name);
    return { conn, player };
  };
  // 큰 시간 간격의 비콘 = 속도 예산 안에서의 순간이동 (테스트 배치용).
  const warp = (player, x, y, z = SPAWN_POS.z) => {
    clock.t += 60_000;
    game.onMessage(player.id, { t: MSG.BEACON, x, y, z });
  };
  const total = () => game.ledger.totalSum();
  return { clock, game, join, warp, total };
}

// 클라 미러를 서버가 그 conn 에 보낸 메시지열로 재구축
function mirror(conn) {
  const s = new ClientState();
  for (const m of conn.msgs) s.handle(m);
  return s;
}

test('창세 직후 전 풀 합계 = WORLD_SOURCE_INITIAL', () => {
  const { total } = setup();
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('접속·스폰 — SOURCE→플레이어 인출도 원장 이체 (보존 유지)', () => {
  const { game, join, total } = setup();
  const a = join('A');
  assert.equal(game.ledger.balance(a.player.id), SPAWN_GRANT, '스폰 인출 = SPAWN_GRANT');
  assert.equal(game.ledger.balance(POOL.SOURCE), WORLD_SOURCE_INITIAL - SPAWN_GRANT);
  assert.equal(total(), WORLD_SOURCE_INITIAL, '스폰 후 총합 불변');
});

test('이동 — 비콘 이동은 player→SINK 소산 이체 (보존 유지, feature-0003)', () => {
  const { game, join, warp, total } = setup();
  const a = join('A');
  const before = game.ledger.balance(a.player.id);
  const sinkBefore = game.ledger.balance(POOL.SINK);
  // 스폰(1000,1000,500)에서 500px 이동 → 비용 floor(500/50)=10, SINK 로 소산
  warp(a.player, SPAWN_POS.x + 500, SPAWN_POS.y, SPAWN_POS.z);
  assert.equal(game.ledger.balance(a.player.id), before - 10, '이동 비용 = 거리/50');
  assert.equal(game.ledger.balance(POOL.SINK), sinkBefore + 10, '소산분은 SINK 로');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '이동 후 총합 불변');
});

test('검증 — 속도 예산 초과 비콘은 TELEPORT 로 기각 (지출·이동 없음)', () => {
  const { game, join } = setup();
  const a = join('A');
  a.conn.msgs.length = 0;
  const before = game.ledger.balance(a.player.id);
  // 같은 틱(작은 dt)에 먼 거리 → 예산 초과. 서버는 물리를 몰라도 '불가능'은 안다.
  game.onMessage(a.player.id, { t: MSG.BEACON, x: SPAWN_POS.x + 900, y: SPAWN_POS.y, z: SPAWN_POS.z });
  const teleport = a.conn.msgs.find(m => m.t === MSG.TELEPORT);
  assert.ok(teleport, 'TELEPORT 정정 발신');
  assert.equal(teleport.x, SPAWN_POS.x, '마지막 정합 위치로 되돌림');
  assert.equal(game.ledger.balance(a.player.id), before, '기각 시 지출 없음');
  assert.equal(game.players.get(a.player.id).x, SPAWN_POS.x, '서버 위치 불변');
});

test('접속 종료 — 잔여 에너지는 SOURCE 로 환원, 풀 소멸 (보존 유지)', () => {
  const { game, join, total } = setup();
  const a = join('A');
  assert.equal(game.ledger.balance(a.player.id), SPAWN_GRANT);
  game.removePlayer(a.player.id);
  assert.equal(game.ledger.get(a.player.id), undefined, '풀 제거');
  assert.equal(game.ledger.balance(POOL.SOURCE), WORLD_SOURCE_INITIAL, '전량 SOURCE 환원');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '종료 후 총합 불변');
});

test('미러 정합 — 서버 메시지만으로 재구축한 클라 원장이 서버 잔고·체크섬과 일치', () => {
  const { game, join, warp } = setup();
  const a = join('A');
  const b = join('B'); // 같은 스폰 지역 → 서로 시야 안
  game.tick(); // 플러시: WELCOME·ENTER·OPS(스폰 tx)
  warp(b.player, SPAWN_POS.x + 100, SPAWN_POS.y, SPAWN_POS.z); // B 이동(A 시야 안)
  // 체크섬 틱까지 진행 (30틱 주기)
  while (game.tickCount % 30 !== 0) game.tick();
  game.tick();

  const am = mirror(a.conn);
  // A 미러가 본 B 의 잔고 == 서버 권위 잔고
  assert.equal(am.ledger.balance(b.player.id), game.ledger.balance(b.player.id), 'A 미러의 B 잔고');
  assert.equal(am.ledger.balance(a.player.id), game.ledger.balance(a.player.id), 'A 미러의 자기 잔고');
  assert.equal(am.checksumStatus, 'OK', '지역 체크섬 일치');
  assert.equal(am.worldTotal, WORLD_SOURCE_INITIAL, '전시 총합 = 창세 총량');
});

test('무작위 이동 폭풍 — 다수 플레이어가 배회해도 총합 불변', () => {
  const { game, join, warp, total } = setup();
  const players = [];
  for (let i = 0; i < 6; i++) players.push(join(`P${i}`).player);
  const rng = mulberry32(1234);
  for (let step = 0; step < 400; step++) {
    const p = players[randInt(rng, 0, players.length - 1)];
    warp(p, randInt(rng, 0, WORLD_SIZE), randInt(rng, 0, WORLD_SIZE), randInt(rng, 0, WORLD_HEIGHT));
    if (step % 10 === 0) game.tick();
  }
  assert.equal(total(), WORLD_SOURCE_INITIAL, '이동 폭풍 후 총합 불변');
  // 에너지는 세 곳에만 있다: 자유(플레이어) + 태양(SOURCE) + 소실(SINK) = 창세 총량
  let free = 0;
  for (const p of players) free += game.ledger.balance(p.id);
  assert.equal(free + game.ledger.balance(POOL.SOURCE) + game.ledger.balance(POOL.SINK), WORLD_SOURCE_INITIAL);
});
