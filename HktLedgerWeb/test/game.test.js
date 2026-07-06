// ============================================================================
// 게임 통합 테스트 — 수송 계층 없이 GameServer 를 직접 구동한다.
//
// 검증 축:
//   1. 보존: 어떤 게임플레이 시퀀스에서도 전 풀 합계 = WORLD_SOURCE_INITIAL
//   2. 중재: 동시 요청은 FIFO 순서로 클램프·선점된다
//   3. 검증: 비콘 예산(스피드핵)·사거리 기각
//   4. 미러: 클라 원장을 서버 메시지만으로 재구축하면 지역 체크섬이 일치한다
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { ClientState } from '../client/state.js';
import { MSG, INTENT } from '../shared/protocol.js';
import { canonicalDamage } from '../shared/audit.js';
import {
  POOL, WORLD_SOURCE_INITIAL, WORLD_SEED, SPAWN_GRANT, SPAWN_POS,
  GATHER_AMOUNT, ATTACK_COOLDOWN_MS, MOB_ENERGY, PLAYER_MAX_ENERGY,
  CRYSTAL_COST, RESPAWN_DELAY_MS, ATTACK_COST,
} from '../shared/constants.js';

function makeConn() {
  return { msgs: [], send(s) { this.msgs.push(JSON.parse(s)); } };
}

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const join = (name) => {
    const conn = makeConn();
    const player = game.addPlayer(conn, name);
    return { conn, player };
  };
  // 큰 시간 간격의 비콘 = 속도 예산 안에서의 순간이동 (테스트 배치용)
  const warp = (player, x, y) => {
    clock.t += 60_000;
    game.onMessage(player.id, { t: MSG.BEACON, x, y });
  };
  const intent = (player, kind, data = {}, iid = `t${Math.floor(clock.t)}`) => {
    game.onMessage(player.id, { t: MSG.INTENT, iid, kind, ...data });
    return iid;
  };
  const total = () => game.ledger.totalSum();
  return { clock, game, join, warp, intent, total };
}

test('창세 직후 전 풀 합계 = WORLD_SOURCE_INITIAL', () => {
  const { total } = setup();
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('접속·스폰·이동 — 인출과 지출 모두 원장 이체 (보존 유지)', () => {
  const { game, join, warp, total } = setup();
  const a = join('A');
  game.tick();
  assert.equal(game.ledger.balance(a.player.id), SPAWN_GRANT);

  warp(a.player, SPAWN_POS.x + 500, SPAWN_POS.y); // 500px → 에너지 10 지출
  game.tick();
  assert.equal(game.ledger.balance(a.player.id), SPAWN_GRANT - 10);
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('스피드핵 기각 — 속도 예산 초과 비콘은 TELEPORT 정정', () => {
  const { clock, game, join } = setup();
  const a = join('A');
  clock.t += 100; // 0.1초 만에
  game.onMessage(a.player.id, { t: MSG.BEACON, x: SPAWN_POS.x + 500, y: SPAWN_POS.y });
  const tp = a.conn.msgs.find(m => m.t === MSG.TELEPORT);
  assert.ok(tp, '정정 메시지 수신');
  assert.equal(tp.x, SPAWN_POS.x);
  assert.equal(a.player.x, SPAWN_POS.x, '위치 불변');
});

test('동시 채집 중재 — FIFO 클램프, Got<Want, 고갈 기각', () => {
  const { game, join, warp, intent, total } = setup();
  const [a, b, c] = [join('A'), join('B'), join('C')];
  const node = game.nodes.values().next().value;
  for (const p of [a, b, c]) { warp(p.player, node.x + 10, node.y); game.tick(); }

  // 노드를 30 만 남기고 비운다 (테스트 전용 직접 이체 — 역시 보존)
  game.ledger.transfer(node.id, POOL.SINK, game.ledger.balance(node.id) - 30, 'test');

  const ia = intent(a.player, INTENT.GATHER, { nodeId: node.id }, 'ia');
  const ib = intent(b.player, INTENT.GATHER, { nodeId: node.id }, 'ib');
  const ic = intent(c.player, INTENT.GATHER, { nodeId: node.id }, 'ic');
  game.tick();

  const balA = game.ledger.balance(a.player.id);
  const balB = game.ledger.balance(b.player.id);
  assert.ok(balA > game.ledger.balance(c.player.id), 'A 가 먼저 채집');
  const gotA = 25, gotB = 5; // 30 잔고 → A 25, B 5 (Got<Want), C 0
  assert.equal(game.ledger.balance(node.id), 0);
  const rejC = c.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'ic');
  assert.equal(rejC?.reason, 'depleted-or-full');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  // 재충전 루프: REGEN 틱까지 진행하면 SOURCE 에서 다시 채워진다
  for (let i = 0; i < 60; i++) game.tick();
  assert.ok(game.ledger.balance(node.id) > 0, '고갈→회복');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('전투 — 데미지 = 흡수+소각 이체, 사거리 기각, 몬스터 처치', () => {
  const { clock, game, join, warp, intent, total } = setup();
  const a = join('A');
  game.tick();

  // 사거리 밖 공격 기각
  const mob = game.mobs.values().next().value;
  intent(a.player, INTENT.ATTACK, { targetId: mob.id }, 'far');
  game.tick();
  assert.equal(a.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'far')?.reason, 'out-of-range');

  warp(a.player, mob.x + 50, mob.y);
  game.tick();

  const before = game.ledger.balance(a.player.id);
  let hits = 0;
  while (!mob.dead && hits < 20) {
    clock.t += ATTACK_COOLDOWN_MS + 50;
    intent(a.player, INTENT.ATTACK, { targetId: mob.id }, `hit${hits}`);
    game.tick();
    hits++;
  }
  assert.ok(mob.dead, '몬스터 사망');
  assert.equal(game.ledger.balance(mob.id), 0);
  // 흡수 순수익 = (leech 15 - cost 5) × 타격 수 (마지막 타격은 잔여 클램프)
  assert.ok(game.ledger.balance(a.player.id) > before, '흡수로 순증가');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  // 몬스터 리스폰 — SOURCE 인출
  clock.t += 11_000;
  game.tick();
  assert.ok(!mob.dead);
  assert.equal(game.ledger.balance(mob.id), MOB_ENERGY);
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('PvP 사망 — 전리품 드랍·리스폰 인출, 픽업 선점 중재', () => {
  const { clock, game, join, warp, intent, total } = setup();
  const [a, b, c] = [join('A'), join('B'), join('C')];
  game.tick();

  // B 가 결정을 응축해 소지
  intent(b.player, INTENT.CONDENSE, {}, 'bc');
  game.tick();
  const crystal = [...game.items.values()][0];
  assert.equal(crystal.owner, b.player.id);
  assert.equal(game.ledger.balance(crystal.id), CRYSTAL_COST);

  // B 를 빈사로 (테스트 전용 직접 이체)
  game.ledger.transfer(b.player.id, POOL.SINK,
    game.ledger.balance(b.player.id) - 40, 'test');

  for (let i = 0; i < 2; i++) {
    clock.t += ATTACK_COOLDOWN_MS + 50;
    intent(a.player, INTENT.ATTACK, { targetId: b.player.id }, `pk${i}`);
    game.tick();
  }
  assert.ok(b.player.dead, 'B 사망');
  assert.equal(game.ledger.balance(b.player.id), 0);
  assert.equal(crystal.owner, null, '전리품이 땅에 떨어짐');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  // A 와 C 가 같은 틱에 줍기 — 먼저 온 인텐트가 선점
  intent(a.player, INTENT.PICKUP, { itemId: crystal.id }, 'pa');
  intent(c.player, INTENT.PICKUP, { itemId: crystal.id }, 'pc');
  game.tick();
  assert.equal(crystal.owner, a.player.id);
  assert.equal(c.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'pc')?.reason, 'gone');

  // B 리스폰
  clock.t += RESPAWN_DELAY_MS + 100;
  game.tick();
  assert.ok(!b.player.dead);
  assert.equal(game.ledger.balance(b.player.id), SPAWN_GRANT);
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('아이템 수명 — 응축·용해·잔여 보존', () => {
  const { game, join, intent, total } = setup();
  const a = join('A');
  game.tick();

  intent(a.player, INTENT.CONDENSE, {}, 'c1'); // 300 → 200 + 결정(100)
  game.tick();
  const crystal = [...game.items.values()][0];
  assert.equal(game.ledger.balance(a.player.id), SPAWN_GRANT - CRYSTAL_COST);

  intent(a.player, INTENT.USE, { itemId: crystal.id }, 'u1'); // 전량 복원
  game.tick();
  assert.equal(game.ledger.balance(a.player.id), SPAWN_GRANT);
  assert.equal(game.items.size, 0, '소진된 아이템은 소멸');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('접속 종료 — 소지 에너지는 SINK 로 환원 (원장에서 소멸 없음)', () => {
  const { game, join, intent, total } = setup();
  const a = join('A');
  game.tick();
  intent(a.player, INTENT.CONDENSE, {}, 'c1');
  game.tick();
  game.removePlayer(a.player.id);
  assert.equal(game.players.size, 0);
  assert.equal(game.items.size, 0);
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('A1 필드 확산 — 노드 재충전이 세계→노드 주입이 아니라 필드(셀)에서 흐른다', () => {
  const { game, join, warp, total } = setup();
  const a = join('A');
  const node = game.nodes.values().next().value;
  warp(a.player, node.x + 10, node.y); // 노드 지역 구독
  game.tick();

  // 노드와 그 지역 셀을 모두 고갈 — 재충전이 두 홉(SOURCE→셀→노드)을 거치는지 본다
  game.ledger.transfer(node.id, POOL.SINK, game.ledger.balance(node.id), 'test');
  game.ledger.transfer(node.cell, POOL.SINK, game.ledger.balance(node.cell), 'test');
  assert.equal(game.ledger.balance(node.id), 0);
  assert.equal(game.ledger.balance(node.cell), 0);

  a.conn.msgs.length = 0; // 이후 방송만 관찰
  for (let i = 0; i < 120; i++) game.tick();

  assert.ok(game.ledger.balance(node.id) > 0, '고갈→회복');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '재충전 내내 총합 불변');

  // 방송된 노드 재충전 tx 는 전부 필드 셀에서 나온다 — SOURCE→노드 직접 주입 없음
  const regenTxs = a.conn.msgs
    .filter(m => m.t === MSG.OPS).flatMap(m => m.ops)
    .filter(op => op.op === 'tx' && op.to === node.id && op.cause === 'regen');
  assert.ok(regenTxs.length > 0, '셀→노드 재충전 tx 관찰됨');
  assert.ok(regenTxs.every(tx => tx.from.startsWith(POOL.CELL)), '재충전은 필드 셀에서만');
  assert.ok(regenTxs.every(tx => tx.from !== POOL.SOURCE), 'SOURCE→노드 직접 주입 없음');
});

test('A1 미러 정합 — 필드 재충전(셀→노드)을 클라 미러가 재생한다', () => {
  const { game, join, warp } = setup();
  const a = join('A');
  const node = game.nodes.values().next().value;
  // 시야 진입(ENTER) 전에 고갈시켜 ENTER 가 고갈 잔고를 싣게 한다 (실제 채집과 동형)
  game.ledger.transfer(node.id, POOL.SINK, game.ledger.balance(node.id), 'test');
  warp(a.player, node.x + 10, node.y);
  game.tick();

  while (game.tickCount % 30 !== 1 || game.tickCount < 60) game.tick(); // 재충전·체크섬 틱 포함

  const client = new ClientState();
  const resyncs = [];
  client.onResync = (k) => resyncs.push(...k);
  for (const m of a.conn.msgs) client.handle(m);

  assert.equal(client.ledger.balance(node.id), game.ledger.balance(node.id), '노드 잔고 정합');
  assert.equal(resyncs.length, 0, '재동기화 불필요');
  assert.equal(client.checksumStatus, 'OK');
});

test('A2 판정 감사 — 정직 봇 무경보, 조작 봇 탐지 (탐지율 실측)', () => {
  // 위임 데미지 판정을 N회 쏘고 감사 집계를 본다. tamper 로 조작 여부를 준다.
  function run(tamper) {
    const clock = { t: 1_000_000 };
    const game = new GameServer({ now: () => clock.t });
    const atkConn = makeConn(), tgtConn = makeConn();
    const atk = game.addPlayer(atkConn, 'ATK');
    const tgt = game.addPlayer(tgtConn, 'TGT');
    game.tick();
    // 공격자를 대상 사거리 안으로 (큰 시간 간격 = 예산 내 순간이동)
    clock.t += 60_000; game.onMessage(atk.id, { t: MSG.BEACON, x: tgt.x + 30, y: tgt.y });
    game.tick();

    const N = 40;
    for (let seq = 1; seq <= N; seq++) {
      // 대상을 매번 만충으로 유지 (오래 생존 — 감사 표본 확보). 테스트 전용 이체(보존).
      const deficit = PLAYER_MAX_ENERGY - game.ledger.balance(tgt.id);
      if (deficit > 0) game.ledger.transfer(POOL.SOURCE, tgt.id, deficit, 'test');
      clock.t += ATTACK_COOLDOWN_MS + 10;
      const honest = canonicalDamage(WORLD_SEED, atk.id, seq);
      const dmg = tamper ? honest + 50 : honest; // 조작 봇은 데미지 부풀림
      game.onMessage(atk.id, { t: MSG.INTENT, iid: `a${seq}`, kind: INTENT.ATTACK, targetId: tgt.id, seq, dmg });
      game.tick();
    }
    assert.equal(game.ledger.totalSum(), WORLD_SOURCE_INITIAL, '조작 여부와 무관하게 총합 보존');
    return game.audit;
  }

  const honest = run(false);
  assert.equal(honest.delegated, 40, '위임 판정 40건');
  assert.ok(honest.sampled > 0, '표본 감사 발생');
  assert.equal(honest.caught, 0, '정직 봇은 무경보');

  const cheat = run(true);
  assert.equal(cheat.delegated, 40);
  assert.ok(cheat.sampled > 0, '표본 감사 발생');
  assert.equal(cheat.caught, cheat.sampled, '감사된 조작은 전부 적발');
  assert.ok(cheat.cheaters.size === 1, '적발자 식별');
  // 실측 탐지율 = 표본율 (감사된 공격은 100% 적발). 조작 봇은 곧 확실히 걸린다.
  const rate = (cheat.sampled / cheat.delegated * 100).toFixed(0);
  console.log(`    [A2] 위임 ${cheat.delegated} · 감사표본 ${cheat.sampled}(${rate}%) · 적발 ${cheat.caught} · 정직봇 오경보 ${honest.caught}`);
});

test('미러 정합 — 서버 메시지 재생만으로 클라 원장이 체크섬과 일치', () => {
  const { clock, game, join, warp, intent } = setup();
  const a = join('A');
  const b = join('B');
  game.tick();

  // 실전 유사 시퀀스: 이동 → 채집 → 응축 → 용해 → 드랍 → 픽업 → 전투
  const node = game.nodes.values().next().value;
  warp(a.player, node.x + 10, node.y);
  game.tick();
  for (let i = 0; i < 3; i++) { intent(a.player, INTENT.GATHER, { nodeId: node.id }, `g${i}`); game.tick(); }
  intent(a.player, INTENT.CONDENSE, {}, 'c1');
  game.tick();
  const crystal = [...game.items.values()][0];
  intent(a.player, INTENT.DROP, { itemId: crystal.id }, 'd1');
  game.tick();
  intent(a.player, INTENT.PICKUP, { itemId: crystal.id }, 'p1');
  game.tick();
  intent(a.player, INTENT.USE, { itemId: crystal.id }, 'u1');
  game.tick();
  warp(a.player, SPAWN_POS.x, SPAWN_POS.y);
  game.tick();
  clock.t += ATTACK_COOLDOWN_MS + 50;
  intent(a.player, INTENT.ATTACK, { targetId: b.player.id }, 'atk');
  game.tick();

  // 다음 체크섬 틱까지 진행 (재충전 tx 포함)
  while (game.tickCount % 30 !== 1) game.tick();

  // A 가 받은 메시지를 순서대로 재생해 미러 원장 재구축
  const client = new ClientState();
  const resyncs = [];
  client.onResync = (keys) => resyncs.push(...keys);
  for (const msg of a.conn.msgs) client.handle(msg);

  assert.equal(client.playerId, a.player.id);
  assert.equal(client.ledger.balance(a.player.id), game.ledger.balance(a.player.id),
    '자기 풀 잔고 정합');
  for (const key of a.player.regions) {
    assert.equal(client.ledger.regionSum(key), game.ledger.regionSum(key),
      `지역 ${key} 체크섬 정합`);
  }
  assert.equal(resyncs.length, 0, '재동기화 불필요');
  assert.equal(client.checksumStatus, 'OK');
});
