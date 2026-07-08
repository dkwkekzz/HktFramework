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
import { MonsterController } from '../server/monster.js';
import { ClientState } from '../client/state.js';
import { generateFieldRichness } from '../shared/worldgen.js';
import { MSG, INTENT, decode } from '../shared/protocol.js';
import { canonicalDamage } from '../shared/audit.js';
import { attackBonus, upkeepFor, skillDamage, weaponBonus, gatherBonus, gatherStructBonus } from '../shared/growth.js';
import { SKILLS, WEAPON_COST, ORGANS } from '../shared/constants.js';
import {
  MATERIALS, FORGE_MAT_REQUIRE, FORGE_ATTR_COST, FORGE_ITEM_MAX, FORGE_TAX_NUM, FORGE_TAX_DEN,
  DECAY_INTERVAL_TICKS, ITEM_DECAY_NUM, ITEM_DECAY_DEN, NODE_TAP_NUM, NODE_TAP_DEN,
} from '../shared/constants.js';
import { EnergyLedger } from '../shared/ledger.js';
import { entropicLeak, relaxGradient, nodeTap } from '../shared/entropy.js';
import {
  POOL, WORLD_SOURCE_INITIAL, WORLD_SEED, SPAWN_GRANT, SPAWN_POS,
  GATHER_RANGE, ATTACK_COOLDOWN_MS, MOB_ENERGY, PLAYER_MAX_ENERGY,
  CRYSTAL_COST, RESPAWN_DELAY_MS, ATTACK_COST, BEACON_INTERVAL_MS,
  RECYCLE_INTERVAL_TICKS, UPKEEP_INTERVAL_TICKS, UPKEEP_AMOUNT,
  FIELD_RICH_MIN, FIELD_RICH_MAX, REGEN_INTERVAL_TICKS, NODE_REGEN_AMOUNT,
} from '../shared/constants.js';

function makeConn() {
  // 문자열(JSON) 또는 Uint8Array(A4 바이너리 OPS 프레임) 모두 수신 — 같은 JS 객체로 정규화
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
  // 큰 시간 간격의 비콘 = 속도 예산 안에서의 순간이동 (테스트 배치용). z 는 3D 배치.
  const warp = (player, x, y, z = SPAWN_POS.z) => {
    clock.t += 60_000;
    game.onMessage(player.id, { t: MSG.BEACON, x, y, z });
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
  for (const p of [a, b, c]) { warp(p.player, node.x + 10, node.y, node.z); game.tick(); }

  // 노드를 DEN(20)만 남긴다 (테스트 전용 직접 이체 — 역시 보존). A9-3: 엔트로픽 탭 = floor(잔고/20)
  // → A 가 1(20→19)을 FIFO 로 선점하고, 남은 19 는 탭이 floor(19/20)=0 이라 B·C 는 0 채집 → 고갈 기각.
  // 감소 수익이 클램프가 아니라 법칙: 노드가 완전히 비지 않아도 흐름이 0으로 잦아든다.
  game.ledger.transfer(node.id, POOL.SINK, game.ledger.balance(node.id) - NODE_TAP_DEN, 'test');

  const ia = intent(a.player, INTENT.GATHER, { nodeId: node.id }, 'ia');
  const ib = intent(b.player, INTENT.GATHER, { nodeId: node.id }, 'ib');
  const ic = intent(c.player, INTENT.GATHER, { nodeId: node.id }, 'ic');
  game.tick();

  const balA = game.ledger.balance(a.player.id);
  assert.ok(balA > game.ledger.balance(c.player.id), 'A 가 먼저 채집(FIFO 선점)');
  assert.equal(game.ledger.balance(node.id), NODE_TAP_DEN - 1, 'A 가 1 선점, 잔여(19)는 탭 0 — 흐름 고갈');
  const rejB = b.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'ib');
  const rejC = c.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'ic');
  assert.equal(rejB?.reason, 'depleted-or-full', '흐름 잦아든 노드 채집 = 기각(B)');
  assert.equal(rejC?.reason, 'depleted-or-full', '흐름 잦아든 노드 채집 = 기각(C)');
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

  warp(a.player, mob.x + 50, mob.y, mob.z);
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
  warp(a.player, node.x + 10, node.y, node.z); // 노드 지역 구독
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
  warp(a.player, node.x + 10, node.y, node.z);
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

test('A3 영속화 — 스냅샷 저장→복원 후 지역 체크섬 일치 + 세계 총합 불변', () => {
  const { clock, game, join, warp, intent } = setup();
  const a = join('A');
  const node = game.nodes.values().next().value;

  // 잔고 분포를 흐트러뜨린다: 채집·응축·몬스터 처치(dead 상태도 스냅샷에 실림)
  warp(a.player, node.x + 10, node.y, node.z);
  game.tick();
  for (let i = 0; i < 3; i++) { intent(a.player, INTENT.GATHER, { nodeId: node.id }, `g${i}`); game.tick(); }
  intent(a.player, INTENT.CONDENSE, {}, 'c1');
  game.tick();
  const mob = game.mobs.values().next().value;
  warp(a.player, mob.x + 30, mob.y, mob.z);
  game.tick();
  while (!mob.dead) {
    clock.t += ATTACK_COOLDOWN_MS + 10;
    intent(a.player, INTENT.ATTACK, { targetId: mob.id }, `k${Math.floor(clock.t)}`);
    game.tick();
  }
  for (let i = 0; i < 60; i++) game.tick(); // 재충전 등 진행

  // 저장→(JSON 직렬화)→로드로 새 서버 부팅 (재시작 모사)
  const snap = JSON.parse(JSON.stringify(game.snapshot()));
  const revived = new GameServer({ now: () => clock.t, snapshot: snap });

  assert.equal(revived.ledger.totalSum(), WORLD_SOURCE_INITIAL, '복원 후 세계 총합 불변');
  for (const [key] of game.ledger.regionSums)
    assert.equal(revived.ledger.regionSum(key), game.ledger.regionSum(key), `지역 ${key} 체크섬 일치`);
  for (const p of game.ledger.pools.values())
    assert.equal(revived.ledger.balance(p.id), p.balance, `풀 ${p.id} 잔고 일치`);
  assert.equal(revived.mobs.get(mob.id).dead, game.mobs.get(mob.id).dead, '몬스터 dead 복원');
  assert.equal(revived.items.size, game.items.size, '아이템 메타 복원');

  // 복원된 세계가 계속 굴러가도 보존 유지 (죽은 노드도 필드에서 재충전)
  for (let i = 0; i < 60; i++) revived.tick();
  assert.equal(revived.ledger.totalSum(), WORLD_SOURCE_INITIAL, '복원 후 계속 틱 — 총합 불변');
});

test('A6-0 태양 순환 — 소산(SINK)이 재순환 주기마다 SOURCE 로 되돌아 세계가 영속 (닫힌 루프·보존)', () => {
  const { game, total } = setup();
  const src0 = game.ledger.balance(POOL.SOURCE);

  // (1) 기본: 한 주기 소산이 경계 tick 에서 전량 SOURCE 로 되돌아온다
  game.ledger.transfer(POOL.SOURCE, POOL.SINK, 12345, 'test'); // 소산 모사 (보존 이체)
  while (game.tickCount < RECYCLE_INTERVAL_TICKS) game.tick();  // 경계 직전까지 SINK 유지
  assert.equal(game.ledger.balance(POOL.SINK), 12345, '재순환 전에는 소산이 SINK 에 쌓여 있다');
  game.tick(); // tickCount === RECYCLE_INTERVAL_TICKS → 재순환 실행
  assert.equal(game.ledger.balance(POOL.SINK), 0, '경계 tick 에서 소산 전량 재순환');
  assert.equal(game.ledger.balance(POOL.SOURCE), src0, 'SOURCE 로 온전히 되돌아옴');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '순환도 이체 — 총합 불변');

  // (2) 반복: 여러 주기를 돌려도 SINK 는 유계, SOURCE 는 정상상태 (영속)
  let sinkPeak = 0;
  for (let cycle = 0; cycle < 4; cycle++) {
    game.ledger.transfer(POOL.SOURCE, POOL.SINK, 5000, 'test');
    sinkPeak = Math.max(sinkPeak, game.ledger.balance(POOL.SINK));
    for (let i = 0; i < RECYCLE_INTERVAL_TICKS; i++) game.tick(); // 정확히 한 재순환 경계 통과
    assert.equal(total(), WORLD_SOURCE_INITIAL, `주기 ${cycle} 총합 보존`);
  }
  assert.ok(sinkPeak <= 5000, `SINK 유계 — 무한 성장 없음 (최고 ${sinkPeak})`);
  assert.equal(game.ledger.balance(POOL.SINK), 0, '마지막 주기도 재순환 완료');
  assert.equal(game.ledger.balance(POOL.SOURCE), src0, 'SOURCE 정상상태 — 고갈 없이 순환');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
  console.log(`    [A6-0] 재순환 주기 ${RECYCLE_INTERVAL_TICKS}틱 · SINK 최고 ${sinkPeak}→0 · SOURCE 정상상태 · 총합 ${total()} 불변`);
});

test('A6-1 대사 — 생명은 매 주기 upkeep 를 지불하고, 못 채우면 굶어 죽는다 (아사도 보존)', () => {
  const { clock, game, join, total } = setup();
  const a = join('A');
  game.tick(); // 스폰 grant
  assert.equal(game.ledger.balance(a.player.id), SPAWN_GRANT);

  // 대사 1주기 = upkeep 1회 (player→SINK)
  const before = game.ledger.balance(a.player.id);
  while (game.tickCount < UPKEEP_INTERVAL_TICKS) game.tick();
  assert.equal(game.ledger.balance(a.player.id), before, '주기 경계 전에는 소모 없음');
  game.tick(); // tickCount === UPKEEP_INTERVAL_TICKS → 대사
  assert.equal(game.ledger.balance(a.player.id), before - UPKEEP_AMOUNT, '대사 1주기 = upkeep 1회');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '대사도 이체 — 총합 불변');

  // 빈사로 만든 뒤(테스트 전용 이체) 유지 실패 → 아사
  game.ledger.transfer(a.player.id, POOL.SINK, game.ledger.balance(a.player.id) - UPKEEP_AMOUNT, 'test');
  assert.equal(game.ledger.balance(a.player.id), UPKEEP_AMOUNT, '잔고 = upkeep 1회분');
  while (!a.player.dead && game.tickCount < UPKEEP_INTERVAL_TICKS * 100) game.tick();
  assert.ok(a.player.dead, '대사 유지 실패 = 아사');
  assert.equal(game.ledger.balance(a.player.id), 0, '사망 시 잔고 0 (전량 SINK)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '아사도 보존 (에너지는 SINK 로)');

  // 리스폰 — SOURCE 인출로 다시 산다
  clock.t += RESPAWN_DELAY_MS + 100;
  game.tick();
  assert.ok(!a.player.dead, '리스폰');
  assert.equal(game.ledger.balance(a.player.id), SPAWN_GRANT);
  assert.equal(total(), WORLD_SOURCE_INITIAL);
  console.log(`    [A6-1] upkeep ${UPKEEP_AMOUNT}/${UPKEEP_INTERVAL_TICKS}틱 · 유지 실패=아사(잔고0)·리스폰 SOURCE 인출·총합 ${total()} 불변`);
});

test('A6-2 구조 예치 — 성장 = 자유 에너지의 질서화(창조 아님), 사망 지속·이탈 환원 (보존)', () => {
  const { clock, game, join, intent, total } = setup();
  const a = join('A');
  game.tick(); // 스폰 grant 300
  const structId = POOL.STRUCT + a.player.id + '#atk'; // A7-1: GROW 기본 조직 = 발산(atk)
  assert.equal(game.ledger.balance(structId), 0, '구조 풀은 빈 채로 생성');

  // 성장: 자유 에너지를 구조로 예치 (player→STRUCT) — 창조가 아니라 재분배
  intent(a.player, INTENT.GROW, { amount: 120 }, 'g1');
  game.tick();
  assert.equal(game.ledger.balance(a.player.id), SPAWN_GRANT - 120, '자유 잔고 감소');
  assert.equal(game.ledger.balance(structId), 120, '구조로 예치 (질서화)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '창조 아님 — 재분배라 총합 불변');

  // 미러 정합: 소유자 클라가 GROW tx 를 재생해 자유 잔고가 일치 (구조 풀 물질화 검증)
  const client = new ClientState();
  for (const m of a.conn.msgs) client.handle(m);
  assert.equal(client.ledger.balance(a.player.id), game.ledger.balance(a.player.id),
    '미러 자유 잔고 정합 (GROW 재생)');

  // 사망해도 성장은 지속된다 (영구 성장) — 전투사(戰死)는 잠긴 질서를 건드리지 않는다.
  // (굶주림은 구조를 태우지만[A6-6], 전투 사망은 자유 풀만 인출하므로 구조는 불가침)
  const b = join('B'); // 공격자 (스폰 위치 동일 = 사거리 안)
  game.ledger.transfer(a.player.id, POOL.SINK, game.ledger.balance(a.player.id) - 15, 'test'); // A 빈사
  clock.t += ATTACK_COOLDOWN_MS + 50;
  intent(b.player, INTENT.ATTACK, { targetId: a.player.id }, 'pk');
  game.tick();
  assert.ok(a.player.dead, '전투 사망');
  assert.equal(game.ledger.balance(structId), 120, '사망해도 구조 지속 (영구 성장)');

  // 리스폰 후에도 구조 유지
  clock.t += RESPAWN_DELAY_MS + 100;
  game.tick();
  assert.ok(!a.player.dead, '리스폰');
  assert.equal(game.ledger.balance(structId), 120, '리스폰 후에도 구조 유지');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  // 접속 종료 시 구조 에너지는 SINK 로 환원 (원장에서 소멸 없음)
  game.removePlayer(a.player.id);
  assert.equal(game.ledger.get(structId), undefined, '구조 풀 제거');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '이탈 환원도 보존');
  console.log(`    [A6-2] 성장 player→STRUCT 120 · 사망/리스폰 지속(영구)·이탈 환원 SINK · 총합 ${total()} 불변`);
});

test('A6-3 스탯 = 흐름 계수 — 구조가 공격력·대사를 키운다 (구조의 함수·보존)', () => {
  // 순수 함수: 단조 증가·결정론
  assert.ok(attackBonus(1000) > attackBonus(0), '구조↑ → 공격 보너스↑');
  assert.ok(upkeepFor(1000) > upkeepFor(0), '구조↑ → 대사 비용↑');
  assert.equal(attackBonus(500), attackBonus(500), '결정론');

  const { clock, game, join, warp, intent, total } = setup();
  const atk = join('ATK');
  const tgt = join('TGT');
  game.tick();
  const bal = (id) => game.ledger.balance(id);
  const refill = (id) => game.ledger.transfer(POOL.SOURCE, id, PLAYER_MAX_ENERGY - bal(id), 'test');

  // 공격자를 구조 800 으로 성장 (만충 후 예치 → 자유 200 남김)
  refill(atk.player.id);
  intent(atk.player, INTENT.GROW, { amount: 800 }, 'grow');
  game.tick();
  const structId = POOL.STRUCT + atk.player.id + '#atk'; // A7-1: 발산 조직에 예치(기본 조직)
  assert.equal(bal(structId), 800);

  // (1) 공격력 = 구조의 함수 — 데미지 = canonical + 구조 보너스 (피격자 클램프 내)
  warp(atk.player, tgt.player.x + 30, tgt.player.y, tgt.player.z);
  game.tick();
  refill(tgt.player.id);
  const before = bal(tgt.player.id);
  clock.t += ATTACK_COOLDOWN_MS + 10;
  intent(atk.player, INTENT.ATTACK, { targetId: tgt.player.id, seq: 1 }, 'a1'); // 위임 없음 = 서버 canonical
  game.tick();
  const dealt = before - bal(tgt.player.id);
  assert.equal(dealt, canonicalDamage(WORLD_SEED, atk.player.id, 1) + attackBonus(800),
    '데미지 = canonical + 구조 공격 보너스');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  // (2) 대사 비용 = 구조의 함수 — 구조 큰 ATK 가 구조 0 TGT 보다 더 많이 지불
  while (game.tickCount % UPKEEP_INTERVAL_TICKS !== 0) game.tick(); // upkeep 경계 직전(tickCount 배수)
  refill(atk.player.id); refill(tgt.player.id);
  const atkB = bal(atk.player.id), tgtB = bal(tgt.player.id);
  game.tick(); // upkeep 발생
  assert.equal(atkB - bal(atk.player.id), upkeepFor(800), '구조 큰 쪽 대사 = upkeepFor(800)');
  assert.equal(tgtB - bal(tgt.player.id), upkeepFor(0), '구조 0 쪽 = 기본 대사');
  assert.ok(upkeepFor(800) > upkeepFor(0), '성장은 공짜가 아니다 — 큰 몸일수록 유지비↑');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
  console.log(`    [A6-3] 구조 800 → 공격 +${attackBonus(800)}·대사 ${upkeepFor(0)}→${upkeepFor(800)} · 데미지 클램프·총합 ${total()} 불변`);
});

test('A6-4 스킬 = 발산 패턴 — 비용 있는 증폭 이체, 흡수/소각 형태 차별·쿨다운·보존', () => {
  const { clock, game, join, warp, intent, total } = setup();
  const atk = join('ATK');
  const tgt = join('TGT');
  game.tick();
  const bal = (id) => game.ledger.balance(id);
  // 잔고를 목표값으로 설정 (테스트 전용 이체 — 보존). 공격자는 흡수 여유를 위해 중간값.
  const setBal = (id, v) => {
    const cur = bal(id);
    if (v > cur) game.ledger.transfer(POOL.SOURCE, id, v - cur, 'test');
    else if (v < cur) game.ledger.transfer(id, POOL.SINK, cur - v, 'test');
  };

  // 순수 함수: 구조가 스킬 위력을 키운다
  assert.ok(skillDamage(SKILLS.smash, 600) > skillDamage(SKILLS.smash, 0), '구조↑ → 스킬 위력↑');
  assert.ok(SKILLS.drain.leechPct > SKILLS.smash.leechPct, '스킬마다 흡수/소각 형태가 다르다');

  warp(atk.player, tgt.player.x + 30, tgt.player.y, tgt.player.z);
  game.tick();

  // 흡정(drain): 높은 흡수 — 공격자가 크게 흡수, 소각 적음
  setBal(atk.player.id, 500); setBal(tgt.player.id, PLAYER_MAX_ENERGY); // 공격자 흡수 여유 확보
  const atkB = bal(atk.player.id), tgtB = bal(tgt.player.id);
  clock.t += 3000;
  intent(atk.player, INTENT.SKILL, { skillId: 'drain', targetId: tgt.player.id }, 'd1');
  game.tick();
  const dDmg = skillDamage(SKILLS.drain, 0);
  const dLeech = Math.floor(dDmg * SKILLS.drain.leechPct / 100);
  assert.equal(tgtB - bal(tgt.player.id), dDmg, '흡정 데미지 = skillDamage (피격자 인출)');
  assert.equal(bal(atk.player.id) - atkB, dLeech - SKILLS.drain.cost, '흡정 = 큰 흡수 − 시전비');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  // 쿨다운: 즉시 재시전 기각
  intent(atk.player, INTENT.SKILL, { skillId: 'drain', targetId: tgt.player.id }, 'd2');
  game.tick();
  assert.equal(atk.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'd2')?.reason, 'cooldown');

  // 강타(smash): 높은 소각 — SINK 로 큰 소각, 흡수 적음
  setBal(atk.player.id, 500); setBal(tgt.player.id, PLAYER_MAX_ENERGY);
  const sinkB = bal(POOL.SINK);
  clock.t += 3000;
  intent(atk.player, INTENT.SKILL, { skillId: 'smash', targetId: tgt.player.id }, 's1');
  game.tick();
  const sDmg = skillDamage(SKILLS.smash, 0);
  const sBurn = sDmg - Math.floor(sDmg * SKILLS.smash.leechPct / 100);
  assert.equal(bal(POOL.SINK) - sinkB, SKILLS.smash.cost + sBurn, '강타 = 시전비 + 큰 소각 (SINK↑)');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
  console.log(`    [A6-4] 흡정 흡수 ${dLeech}/${dDmg}(cost ${SKILLS.drain.cost}) · 강타 소각 ${sBurn}/${sDmg}(cost ${SKILLS.smash.cost}) · 쿨다운 강제 · 총합 ${total()} 불변`);
});

test('A6-5 아이템 = 결정체 장착 — 아이템 잔고가 스탯을 증폭(민팅 없음), 획득·발산·해제 (보존)', () => {
  // 순수 함수: 아이템 잔고↑ → 증폭↑
  assert.ok(weaponBonus(250) > weaponBonus(50), '무기 잔고↑ → 공격 증폭↑');
  assert.ok(gatherBonus(100) > gatherBonus(0), '결정 잔고↑ → 채집 증폭↑');

  const { clock, game, join, warp, intent, total } = setup();
  const a = join('A');
  const tgt = join('TGT');
  game.tick();
  const bal = (id) => game.ledger.balance(id);
  const setBal = (id, v) => {
    const cur = bal(id);
    if (v > cur) game.ledger.transfer(POOL.SOURCE, id, v - cur, 'test');
    else if (v < cur) game.ledger.transfer(id, POOL.SINK, cur - v, 'test');
  };

  // (1) 무기 발산 증폭 — 데미지 = canonical + weaponBonus(무기 잔고). 여전히 피격자 클램프.
  setBal(a.player.id, PLAYER_MAX_ENERGY);
  intent(a.player, INTENT.CRAFT, {}, 'craft'); // 무기 250
  game.tick();
  const weapon = [...game.items.values()].find(i => i.itemType === 'weapon');
  assert.equal(bal(weapon.id), WEAPON_COST);

  warp(a.player, tgt.player.x + 30, tgt.player.y, tgt.player.z);
  game.tick();
  setBal(a.player.id, 500); setBal(tgt.player.id, PLAYER_MAX_ENERGY);
  const before = bal(tgt.player.id);
  clock.t += ATTACK_COOLDOWN_MS + 10;
  intent(a.player, INTENT.ATTACK, { targetId: tgt.player.id, seq: 1 }, 'a1'); // 위임 없음 = 서버 canonical
  game.tick();
  const dealt = before - bal(tgt.player.id);
  assert.equal(dealt, canonicalDamage(WORLD_SEED, a.player.id, 1) + weaponBonus(WEAPON_COST),
    '데미지 = canonical + 무기 잔고 증폭(마모 전 잔고)');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  // (2) 결정 획득 증폭 — 결정 소지 시 채집량 = 기본 + gatherBonus(결정 잔고). 노드가 제공(민팅 아님).
  const node = game.nodes.values().next().value;
  setBal(a.player.id, PLAYER_MAX_ENERGY);
  intent(a.player, INTENT.CONDENSE, {}, 'cond'); // 결정 100
  game.tick();
  const crystal = [...game.items.values()].find(i => i.itemType === 'crystal');
  warp(a.player, node.x + 10, node.y, node.z);
  game.tick();
  setBal(a.player.id, 500);
  const pBefore = bal(a.player.id);
  const nodeBal = bal(node.id); // A9-3: 채집량은 노드 집중도에서 창발
  intent(a.player, INTENT.GATHER, { nodeId: node.id }, 'g1');
  game.tick();
  assert.equal(bal(a.player.id) - pBefore, nodeTap(nodeBal, NODE_TAP_NUM, NODE_TAP_DEN) + gatherBonus(bal(crystal.id)),
    '채집량 = 노드 탭(창발) + 결정 잔고 증폭');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  // (3) 드랍 시 증폭 제거 — 무기를 버리면 발산 증폭이 사라진다 (같은 틱: 드랍 FIFO 먼저 → 공격)
  warp(a.player, tgt.player.x + 30, tgt.player.y, tgt.player.z); // TGT 사거리로 복귀 (beacon)
  setBal(a.player.id, 500); setBal(tgt.player.id, PLAYER_MAX_ENERGY);
  const before2 = bal(tgt.player.id);
  clock.t += ATTACK_COOLDOWN_MS + 10;
  intent(a.player, INTENT.DROP, { itemId: weapon.id }, 'drop');
  intent(a.player, INTENT.ATTACK, { targetId: tgt.player.id, seq: 2 }, 'a2');
  game.tick();
  const dealt2 = before2 - bal(tgt.player.id);
  assert.equal(dealt2, canonicalDamage(WORLD_SEED, a.player.id, 2), '무기 드랍 후 = 증폭 없는 기본 데미지');
  assert.ok(dealt2 < dealt, '드랍으로 발산 증폭 사라짐');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
  console.log(`    [A6-5] 무기 발산 +${weaponBonus(WEAPON_COST)}(드랍 시 0) · 결정 획득 +${gatherBonus(100)} · 민팅 없음(클램프)·총합 ${total()} 불변`);
});

test('A6-6 항상성 — 자유가 마르면 구조를 태워 연명하고, 구조까지 마르면 그때 아사 (구조 이화도 보존)', () => {
  const { clock, game, join, intent, total } = setup();
  const a = join('A');
  game.tick(); // 스폰 grant 300
  const structId = POOL.STRUCT + a.player.id + '#atk'; // A7-1: GROW 기본 조직 = 발산(atk)

  // 큰 구조를 예치 (비상 연료 저장고) 후 자유를 0 으로 — 이제 대사는 구조에서 나와야 한다
  intent(a.player, INTENT.GROW, { amount: 250 }, 'g1');
  game.tick();
  const struct0 = game.ledger.balance(structId);
  assert.equal(struct0, 250, '구조 250 예치');
  const atk0 = attackBonus(struct0);
  game.ledger.transfer(a.player.id, POOL.SINK, game.ledger.balance(a.player.id), 'test'); // 자유 고갈
  assert.equal(game.ledger.balance(a.player.id), 0, '자유 에너지 0');

  // 여러 대사 주기 — 죽지 않고 구조를 태워 연명한다 (가역적 성장)
  for (let i = 0; i < UPKEEP_INTERVAL_TICKS * 5; i++) game.tick();
  assert.ok(!a.player.dead, '구조가 남아 있는 한 아사하지 않는다 (이화로 연명)');
  const struct1 = game.ledger.balance(structId);
  assert.ok(struct1 < struct0, `구조가 줄었다 (이화): ${struct0}→${struct1}`);
  assert.ok(attackBonus(struct1) <= atk0, '굶주릴수록 스탯도 준다 (구조의 함수)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '이화도 이체 — 총합 불변');

  // 미러 정합: 소유자 클라가 이화 tx(구조→플레이어)를 재생해 구조 잔고가 일치
  const client = new ClientState();
  for (const m of a.conn.msgs) client.handle(m);
  assert.equal(client.ledger.balance(structId), game.ledger.balance(structId),
    '미러 구조 잔고 정합 (이화 tx 재생)');

  // 계속 굶기면 구조까지 마르고 그때가 진짜 아사 (태울 몸조차 없음)
  while (!a.player.dead && game.tickCount < UPKEEP_INTERVAL_TICKS * 200) game.tick();
  assert.ok(a.player.dead, '구조까지 고갈 = 진짜 아사');
  assert.equal(game.ledger.balance(structId), 0, '태울 몸조차 없음 (구조 0)');
  assert.equal(game.ledger.balance(a.player.id), 0, '자유도 0');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '아사도 보존');
  console.log(`    [A6-6] 자유0 → 구조 ${struct0}→${struct1} 이화로 연명 · 구조 고갈 시 아사 · 총합 ${total()} 불변`);
});

test('A7-1 구조 분화 — 조직별 예치가 서로 다른 흐름 계수에 결합 (빌드 분화·보존)', () => {
  const { clock, game, join, warp, intent, total } = setup();
  const bruiser = join('BRUISER'); // 발산(atk) 빌드
  const forager = join('FORAGER'); // 대사(meta) 빌드
  const tgtB = join('TB');
  const tgtF = join('TF');
  game.tick();
  const bal = (id) => game.ledger.balance(id);
  const setBal = (id, v) => {
    const cur = bal(id);
    if (v > cur) game.ledger.transfer(POOL.SOURCE, id, v - cur, 'test');
    else if (v < cur) game.ledger.transfer(id, POOL.SINK, cur - v, 'test');
  };
  const organId = (p, o) => POOL.STRUCT + p.id + '#' + o;
  assert.deepEqual(ORGANS, ['atk', 'meta'], '조직 목록');

  // 같은 양(300)을 서로 다른 조직에 예치 → 구조가 구조적으로 분화한다.
  // (자연 스폰 grant 300 범위 내 예치 — setBal 은 방송되지 않아 미러가 재생 못 하므로 GROW 전엔 쓰지 않는다)
  intent(bruiser.player, INTENT.GROW, { organ: 'atk', amount: 300 }, 'gb');
  intent(forager.player, INTENT.GROW, { organ: 'meta', amount: 300 }, 'gf');
  game.tick();
  assert.equal(bal(organId(bruiser.player, 'atk')), 300, 'bruiser 발산 조직 300');
  assert.equal(bal(organId(bruiser.player, 'meta')), 0, 'bruiser 대사 조직 0 (분화)');
  assert.equal(bal(organId(forager.player, 'meta')), 300, 'forager 대사 조직 300');
  assert.equal(bal(organId(forager.player, 'atk')), 0, 'forager 발산 조직 0 (분화)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '예치는 재분배 — 총합 불변');

  // 미러 정합: 소유자 클라가 분화 GROW tx 를 재생해 조직 잔고가 일치
  const client = new ClientState();
  for (const m of bruiser.conn.msgs) client.handle(m);
  assert.equal(client.ledger.balance(organId(bruiser.player, 'atk')), 300, '미러 조직 잔고 정합 (분화 재생)');

  // (1) 발산 조직 → 공격 결합: bruiser = canonical + attackBonus(300), forager = canonical (atk 조직 0)
  warp(bruiser.player, tgtB.player.x + 30, tgtB.player.y, tgtB.player.z);
  warp(forager.player, tgtF.player.x + 30, tgtF.player.y, tgtF.player.z);
  game.tick();
  setBal(bruiser.player.id, 500); setBal(forager.player.id, 500);
  setBal(tgtB.player.id, PLAYER_MAX_ENERGY); setBal(tgtF.player.id, PLAYER_MAX_ENERGY);
  const tbBefore = bal(tgtB.player.id), tfBefore = bal(tgtF.player.id);
  clock.t += ATTACK_COOLDOWN_MS + 10;
  intent(bruiser.player, INTENT.ATTACK, { targetId: tgtB.player.id, seq: 1 }, 'ab');
  intent(forager.player, INTENT.ATTACK, { targetId: tgtF.player.id, seq: 1 }, 'af');
  game.tick();
  const dmgB = tbBefore - bal(tgtB.player.id);
  const dmgF = tfBefore - bal(tgtF.player.id);
  assert.equal(dmgB, canonicalDamage(WORLD_SEED, bruiser.player.id, 1) + attackBonus(300),
    '발산 빌드 데미지 = canonical + attackBonus(발산 조직)');
  assert.equal(dmgF, canonicalDamage(WORLD_SEED, forager.player.id, 1),
    '대사 빌드는 발산 증폭 없음 (발산 조직 0)');
  assert.ok(attackBonus(300) > 0, '발산 조직이 공격을 키운다');

  // (2) 대사 조직 → 채집 결합: forager 채집 = 기본 + gatherStructBonus(400), bruiser 는 기본
  const node = game.nodes.values().next().value;
  setBal(node.id, node.max);
  warp(bruiser.player, node.x + 10, node.y, node.z);
  game.tick();
  setBal(bruiser.player.id, 500);
  let pBefore = bal(bruiser.player.id);
  intent(bruiser.player, INTENT.GATHER, { nodeId: node.id }, 'grb');
  game.tick();
  const gainB = bal(bruiser.player.id) - pBefore;

  setBal(node.id, node.max);
  warp(forager.player, node.x + 10, node.y, node.z);
  game.tick();
  setBal(forager.player.id, 500);
  pBefore = bal(forager.player.id);
  intent(forager.player, INTENT.GATHER, { nodeId: node.id }, 'grf');
  game.tick();
  const gainF = bal(forager.player.id) - pBefore;

  // A9-3: 기본 채집량 = 노드 탭(둘 다 node.max 에서 채집하므로 base 동일). 대사 조직이 채널을 넓힌다.
  const tapBase = nodeTap(node.max, NODE_TAP_NUM, NODE_TAP_DEN);
  assert.equal(gainB, tapBase, '발산 빌드 채집 = 노드 탭 기본 (대사 조직 0)');
  assert.equal(gainF, tapBase + gatherStructBonus(300), '대사 빌드 채집 = 노드 탭 + gatherStructBonus(대사 조직)');
  assert.ok(gainF > gainB, '대사 조직이 획득을 키운다 (분화의 다른 축)');

  // (3) 유지비는 총 구조의 함수 — 빌드가 달라도 총량 같으면 유지비 동일 (분화는 계수만 가른다)
  const totB = bal(organId(bruiser.player, 'atk')) + bal(organId(bruiser.player, 'meta'));
  const totF = bal(organId(forager.player, 'atk')) + bal(organId(forager.player, 'meta'));
  assert.equal(totB, totF, '두 빌드 총 구조 동일 (300)');
  assert.equal(upkeepFor(totB), upkeepFor(totF), '같은 총 구조 → 같은 유지비');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '전 과정 보존');
  console.log(`    [A7-1] 발산빌드 공격+${attackBonus(300)}·채집 ${gainB} | 대사빌드 공격+0·채집 ${gainF}(+${gatherStructBonus(300)}) · 같은 유지비 ${upkeepFor(totB)} · 총합 ${total()} 불변`);
});

test('A7-2 필드 이질화 — 지역별 풍요도가 노드 재충전 속도를 가른다 (영토 가치·시드 유도·보존)', () => {
  // 순수 유도: 풍요도는 결정론·이질적 (같은 시드 → 같은 맵, 범위 내, 부유/빈곤 공존)
  const r1 = generateFieldRichness(WORLD_SEED);
  assert.deepEqual([...r1.entries()], [...generateFieldRichness(WORLD_SEED).entries()], '풍요도는 시드 결정론');
  const vals = [...r1.values()];
  assert.ok(Math.max(...vals) > Math.min(...vals), '이질적 — 부유/빈곤 셀 공존');
  assert.ok(vals.every(v => v >= FIELD_RICH_MIN && v <= FIELD_RICH_MAX), '배수 범위 내');

  const { game, total } = setup();
  // 풍요도가 다른 두 노드 (부유 셀 노드 / 빈곤 셀 노드) — 노드는 자기 셀 풍요도를 물려받는다
  const nodes = [...game.nodes.values()];
  const rich = nodes.reduce((a, b) => (b.richness > a.richness ? b : a));
  const poor = nodes.reduce((a, b) => (b.richness < a.richness ? b : a));
  assert.ok(rich.richness > poor.richness, `부유 노드 풍요도 ${rich.richness} > 빈곤 ${poor.richness}`);

  // 두 노드를 0 으로 비우고 (테스트 전용 이체·보존) 재충전 주기 하나를 통과시킨다
  game.ledger.transfer(rich.id, POOL.SINK, game.ledger.balance(rich.id), 'test');
  game.ledger.transfer(poor.id, POOL.SINK, game.ledger.balance(poor.id), 'test');
  assert.equal(game.ledger.balance(rich.id), 0);
  assert.equal(game.ledger.balance(poor.id), 0);

  // 한 재충전 경계(tickCount=REGEN_INTERVAL_TICKS) 통과 — 노드가 풍요도 배수만큼 회복
  for (let i = 0; i <= REGEN_INTERVAL_TICKS; i++) game.tick();
  const richGain = game.ledger.balance(rich.id);
  const poorGain = game.ledger.balance(poor.id);
  assert.equal(poorGain, NODE_REGEN_AMOUNT * poor.richness, '빈곤 노드 회복 = 기준 × 풍요도');
  assert.equal(richGain, NODE_REGEN_AMOUNT * rich.richness, '부유 노드 회복 = 기준 × 풍요도');
  assert.ok(richGain > poorGain, `부유 지역 노드가 빨리 찬다 (영토 가치): ${richGain} > ${poorGain}`);
  assert.equal(total(), WORLD_SOURCE_INITIAL, '이질화도 이체 — 총합 불변');
  console.log(`    [A7-2] 풍요도 ${poor.richness}~${rich.richness} · 1주기 노드 회복 부유 ${richGain} > 빈곤 ${poorGain} · 총합 ${total()} 불변`);
});

test('A7-3 생명 간 이체 — 플레이어끼리 자유 에너지를 증여한다 (협력·사거리·미러·보존)', () => {
  const { game, join, warp, intent, total } = setup();
  const giver = join('GIVER');
  const taker = join('TAKER');
  game.tick(); // 스폰 grant 300 each (스폰 위치 동일 = 사거리 안)
  const bal = (id) => game.ledger.balance(id);

  // (1) 증여: giver→taker 자유 에너지 이체
  const g0 = bal(giver.player.id), t0 = bal(taker.player.id);
  intent(giver.player, INTENT.GIVE, { targetId: taker.player.id, amount: 120 }, 'gv1');
  game.tick();
  assert.equal(bal(giver.player.id), g0 - 120, '증여자 자유 감소');
  assert.equal(bal(taker.player.id), t0 + 120, '수령자 자유 증가');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '증여도 이체 — 총합 불변');

  // 미러 정합: 양쪽 클라가 증여 tx 를 재생 (giver=from, taker=to 로 relevant, 사거리 안이라 시야 겹침)
  const gc = new ClientState(); for (const m of giver.conn.msgs) gc.handle(m);
  const tc = new ClientState(); for (const m of taker.conn.msgs) tc.handle(m);
  assert.equal(gc.ledger.balance(giver.player.id), bal(giver.player.id), '증여자 미러 정합');
  assert.equal(tc.ledger.balance(taker.player.id), bal(taker.player.id), '수령자 미러 정합');

  // (2) 자기 자신에게는 못 준다
  intent(giver.player, INTENT.GIVE, { targetId: giver.player.id, amount: 10 }, 'gv2');
  game.tick();
  assert.equal(giver.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'gv2')?.reason, 'no-target');

  // (3) 사거리 밖 = 기각
  warp(taker.player, 100, 100, taker.player.z);
  game.tick();
  intent(giver.player, INTENT.GIVE, { targetId: taker.player.id, amount: 10 }, 'gv3');
  game.tick();
  assert.equal(giver.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'gv3')?.reason, 'out-of-range');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  // (4) 협력 = 부양: 굶주린 동료를 증여로 되살린다 (자유 0 → 증여 → 생존)
  warp(taker.player, giver.player.x + 20, giver.player.y, giver.player.z); // 다시 사거리 안
  game.tick();
  game.ledger.transfer(taker.player.id, POOL.SINK, bal(taker.player.id), 'test'); // 굶주림
  intent(giver.player, INTENT.GIVE, { targetId: taker.player.id, amount: 50 }, 'gv4');
  game.tick();
  assert.equal(bal(taker.player.id), 50, '증여로 부양 — 동료가 되살아난다');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '전 과정 보존');
  console.log(`    [A7-3] 증여 giver→taker 120·자기증여/사거리밖 기각·부양 50 · 총합 ${total()} 불변`);
});

test('A7-4 클라 관측 — 노드 풍요도를 시드에서 서버와 동일하게 유도 (영토 색 표시 정합)', () => {
  const { game } = setup();
  const client = new ClientState();
  client.handle({
    t: 'welcome', playerId: 'P:1', name: 'X', seed: WORLD_SEED, tick: 0,
    total: WORLD_SOURCE_INITIAL, src: 0, sink: 0, x: SPAWN_POS.x, y: SPAWN_POS.y, z: SPAWN_POS.z,
  });
  let checked = 0;
  for (const n of game.nodes.values()) {
    assert.equal(client.nodesById.get(n.id).richness, n.richness, `노드 ${n.id} 풍요도 클라=서버`);
    checked++;
  }
  assert.ok(checked > 0, '노드 존재');
  console.log(`    [A7-4] 노드 ${checked}개 풍요도 클라 유도 = 서버 (렌더 영토 색 정합)`);
});

test('A5 몬스터 권위 이관 — 몬스터가 동일 프로토콜로 이동·공격, 불변식 유지', () => {
  const { clock, game, join, warp, total } = setup();
  const prey = join('사냥감');
  warp(prey.player, SPAWN_POS.x + 300, SPAWN_POS.y); // 사거리 밖 → 몬스터가 이동해야 함
  game.tick();

  const mc = new MonsterController(game);
  const mon = mc.spawn('몬스터');
  game.tick(); // 몬스터 미러가 사냥감 ENTER 수신

  const startX = mon.x;
  const preyStart = game.ledger.balance(prey.player.id);
  for (let i = 0; i < 40 && !mon.mirror.dead; i++) {
    clock.t += BEACON_INTERVAL_MS;
    mc.step();       // 몬스터 AI = 비콘/인텐트만 (특권 없음)
    game.tick();
    assert.equal(total(), WORLD_SOURCE_INITIAL, `틱 ${i} 총합 보존`);
  }

  assert.ok(mon.x > startX + 50, '몬스터가 비콘으로 사냥감을 향해 이동');
  assert.ok(game.ledger.balance(prey.player.id) < preyStart, '몬스터 공격으로 사냥감 에너지 감소');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '몬스터 구동 내내 총합 불변');
});

test('A5 몬스터도 특권 없음 — 스피드핵 비콘은 플레이어와 똑같이 기각', () => {
  const { clock, game } = setup();
  const mc = new MonsterController(game);
  const mon = mc.spawn('치터몬');
  game.tick();

  clock.t += 100; // 0.1초 만에 500px = 예산 초과
  game.onMessage(mon.id, { t: MSG.BEACON, x: SPAWN_POS.x + 500, y: SPAWN_POS.y });

  // 서버는 몬스터를 플레이어와 구분하지 않는다 — 위치 갱신 거부, TELEPORT 정정
  assert.equal(game.players.get(mon.id).x, SPAWN_POS.x, '치트 비콘 무시 (위치 불변)');
  assert.equal(mon.x, SPAWN_POS.x, '몬스터 미러도 TELEPORT 정정 수용');
  assert.equal(game.ledger.totalSum(), WORLD_SOURCE_INITIAL);
});

test('3D 공간 — 사거리가 z 를 포함한다 (수직 분리 사거리 밖 → z 정렬로 진입)', () => {
  const { game, join, warp, intent, total } = setup();
  const a = join('A');
  const node = game.nodes.values().next().value;

  // 같은 (x,y) 지만 z 를 노드에서 사거리 밖으로 — 3D 거리라면 채집 불가
  warp(a.player, node.x, node.y, node.z + GATHER_RANGE + 40);
  game.tick();
  intent(a.player, INTENT.GATHER, { nodeId: node.id }, 'g-far');
  game.tick();
  assert.equal(a.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'g-far')?.reason,
    'out-of-range', 'z 분리만으로 사거리 밖');

  // z 를 노드 높이에 맞추면 (x,y 동일) 채집 성공 — 거리가 3D 임을 증명
  warp(a.player, node.x, node.y, node.z);
  game.tick();
  const before = game.ledger.balance(a.player.id);
  intent(a.player, INTENT.GATHER, { nodeId: node.id }, 'g-near');
  game.tick();
  assert.ok(game.ledger.balance(a.player.id) > before, 'z 정렬 후 채집 성공');
  assert.equal(total(), WORLD_SOURCE_INITIAL);
});

test('A8-1 타입 채집·합성 — 금이 아이템이 된다: 노드→창고 채굴, 창고+생체→결정 (민팅 없음·보존)', () => {
  // (0) 순수: 재료 라벨은 거동(채널)을 고를 뿐 위력 배율이 아니다(A9-1). 금·돌은 발산, 나무·보석은 획득.
  assert.equal(MATERIALS.gold.affinity, 'weapon', '금 = 발산 채널');
  assert.equal(MATERIALS.wood.affinity, 'crystal', '나무 = 획득 채널');

  const { clock, game, join, warp, intent, total } = setup();
  const a = join('A');
  game.tick();
  const bal = (id) => game.ledger.balance(id);
  const setBal = (id, v) => {
    const cur = bal(id);
    if (v > cur) game.ledger.transfer(POOL.SOURCE, id, v - cur, 'test');
    else if (v < cur) game.ledger.transfer(id, POOL.SINK, cur - v, 'test');
  };
  const stashId = (mat) => `${POOL.STASH}${a.player.id}#${mat}`;

  // 발산 계수 재료(무기 친화) 노드 하나를 골라 그 종류를 캔다.
  const wNode = [...game.nodes.values()].find(n => MATERIALS[n.mat].affinity === 'weapon');
  assert.ok(wNode, '발산 친화 재료 노드 존재');
  const mat = wNode.mat;

  // (1) 타입 채집(MINE) — 노드가 발산하는 종류의 결정을 캐서 종류별 창고로 옮긴다(노드→창고).
  warp(a.player, wNode.x + 10, wNode.y, wNode.z);
  game.tick();
  const nodeBefore = bal(wNode.id);
  const expectMine = nodeTap(nodeBefore, NODE_TAP_NUM, NODE_TAP_DEN); // A9-3: 채굴량도 노드 집중도에서 창발
  intent(a.player, INTENT.MINE, { nodeId: wNode.id }, 'm1');
  game.tick();
  assert.equal(bal(stashId(mat)), expectMine, '창고에 재료 적립 = 노드 탭(창발)');
  assert.equal(nodeBefore - bal(wNode.id), expectMine, '노드에서 정확히 그만큼 빠짐(민팅 아님)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '채굴 후 총합 보존');

  // 창고를 합성 요건까지 채운다 (4회 채굴 = 100).
  while (bal(stashId(mat)) < FORGE_MAT_REQUIRE) { intent(a.player, INTENT.MINE, { nodeId: wNode.id }); game.tick(); }
  assert.ok(bal(stashId(mat)) >= FORGE_MAT_REQUIRE, '창고 ≥ 합성 요건');

  // (2) 합성(FORGE) = "금이 아이템이 된다" — 재료 창고 + 생체(속성) 에너지를 한 결정으로 결합.
  setBal(a.player.id, FORGE_ATTR_COST + 10); // 속성 주입분 확보
  const stashBefore = bal(stashId(mat));
  const freeBefore = bal(a.player.id);
  intent(a.player, INTENT.FORGE, { mat }, 'f1');
  game.tick();
  const item = [...game.items.values()].find(i => i.owner === a.player.id);
  assert.ok(item, '결정 아이템 생성됨');
  assert.equal(item.mat, mat, '아이템에 재료 종류 라벨');
  assert.equal(item.itemType, MATERIALS[mat].affinity, '거동(발산/획득)은 종류가 정함');
  // 금은 변환되지 않는다: 투입 = 재료 100 + 생체 50. A9-4: 오르막 집중의 엔트로피 세금만큼 소산 →
  // 아이템은 투입보다 작다(민팅 아님·오히려 손실). 잔고 = 투입 - 세금.
  const forgeTax = entropicLeak(FORGE_ITEM_MAX, FORGE_TAX_NUM, FORGE_TAX_DEN);
  assert.equal(bal(item.id), FORGE_ITEM_MAX - forgeTax, '아이템 잔고 = 투입 - 엔트로피 세금');
  assert.equal(stashBefore - bal(stashId(mat)), FORGE_MAT_REQUIRE, '창고에서 정확히 재료분만 빠짐');
  assert.equal(freeBefore - bal(a.player.id), FORGE_ATTR_COST, '생체에서 정확히 속성분만 빠짐');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '합성 후 총합 보존(세금은 SINK로)');

  // (3) 합성 무기 전투 증폭 = weaponBonus(잔고) — 위력은 오직 에너지(재료 무관·A9-1)·피격자 클램프.
  const tgt = join('TGT');
  game.tick();
  warp(a.player, tgt.player.x + 30, tgt.player.y, tgt.player.z);
  game.tick();
  setBal(a.player.id, 500); setBal(tgt.player.id, PLAYER_MAX_ENERGY);
  const before = bal(tgt.player.id);
  const wBalPreWear = bal(item.id);
  clock.t += ATTACK_COOLDOWN_MS + 10;
  intent(a.player, INTENT.ATTACK, { targetId: tgt.player.id, seq: 1 }, 'a1'); // 위임 없음 = 서버 canonical
  game.tick();
  const dealt = before - bal(tgt.player.id);
  assert.equal(dealt, canonicalDamage(WORLD_SEED, a.player.id, 1) + weaponBonus(wBalPreWear),
    '데미지 = canonical + 잔고 증폭(민팅 아님·피격자 클램프)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '전투 후 총합 보존');

  // (4) 잘못된 요청 기각 — 재료 없는 종류 합성 시도.
  const emptyMat = Object.keys(MATERIALS).find(m => bal(stashId(m)) < FORGE_MAT_REQUIRE);
  intent(a.player, INTENT.FORGE, { mat: emptyMat }, 'fx');
  game.tick();
  assert.ok(a.conn.msgs.find(m => m.t === MSG.REJECT && m.iid === 'fx'), '재료 부족 합성 기각');
  assert.equal(total(), WORLD_SOURCE_INITIAL);

  console.log(`    [A8-1] 채굴 ${mat}(창발량) · 합성 = 재료 ${FORGE_MAT_REQUIRE}+생체 ${FORGE_ATTR_COST}=결정 ${FORGE_ITEM_MAX}(민팅 없음) · 무기 발산 +${weaponBonus(FORGE_ITEM_MAX)}(재료 무관) · 총합 ${total()} 불변`);
});

test('A8-1 미러 정합 — 타입 채집·합성 tx 재생 후 지역 체크섬 일치 (창고 region=null 무해)', () => {
  const { clock, game, join, warp, intent } = setup();
  const a = join('A');
  const b = join('B');
  game.tick();

  const node = [...game.nodes.values()].find(n => MATERIALS[n.mat].affinity === 'weapon');
  const mat = node.mat;
  warp(a.player, node.x + 10, node.y, node.z);
  game.tick();
  // 채굴 4회 → 창고 채우고 → 합성 → 드랍 → 픽업
  for (let i = 0; i < 5; i++) { intent(a.player, INTENT.MINE, { nodeId: node.id }, `m${i}`); game.tick(); }
  // 속성분(생체 에너지)은 스폰 지급분(300)으로 충당 — 직접 주입은 미러가 못 보므로 금지.
  intent(a.player, INTENT.FORGE, { mat }, 'f1');
  game.tick();
  const item = [...game.items.values()].find(i => i.owner === a.player.id);
  intent(a.player, INTENT.DROP, { itemId: item.id }, 'd1');
  game.tick();
  intent(a.player, INTENT.PICKUP, { itemId: item.id }, 'p1');
  game.tick();

  // 다음 체크섬 틱까지 진행
  while (game.tickCount % 30 !== 1) game.tick();

  const client = new ClientState();
  const resyncs = [];
  client.onResync = (keys) => resyncs.push(...keys);
  for (const msg of a.conn.msgs) client.handle(msg);

  assert.equal(client.ledger.balance(a.player.id), game.ledger.balance(a.player.id), '자기 풀 잔고 정합');
  assert.equal(client.ledger.balance(item.id), game.ledger.balance(item.id), '합성 아이템 잔고 정합');
  for (const key of a.player.regions) {
    assert.equal(client.ledger.regionSum(key), game.ledger.regionSum(key), `지역 ${key} 체크섬 정합`);
  }
  assert.equal(resyncs.length, 0, '재동기화 불필요');
  assert.equal(client.checksumStatus, 'OK');
});

test('A9-1 가치 단일화 — 위력은 오직 에너지(재료 라벨 무관)·재료 차이는 분포(희소성)에서 (보존)', () => {
  // (0) 배율 상수(옛 div) 제거 — 재료는 위력에 개입하지 않는다. 위력 함수는 재료를 인자로 안 받는다.
  for (const k of Object.keys(MATERIALS)) assert.equal(MATERIALS[k].div, undefined, `${k}: div 제거됨`);
  assert.equal(weaponBonus.length, 1, 'weaponBonus 는 잔고 하나만 받는다(재료 인자 없음)');
  assert.equal(gatherBonus.length, 1, 'gatherBonus 는 잔고 하나만 받는다');
  // 위력을 키우는 유일한 축은 에너지(잔고) — 더 많은 에너지 = 더 센 위력. 재료는 못 바꾼다.
  assert.ok(weaponBonus(300) > weaponBonus(150), '에너지↑ → 위력↑ (가치=에너지)');

  const { game } = setup();
  // (1) 분포 비균일 = 희소성: 흔한 재료(abundance↑) 노드가 희소 재료보다 많다 — 시드 유도.
  const counts = {};
  for (const n of game.nodes.values()) counts[n.mat] = (counts[n.mat] ?? 0) + 1;
  const common = (counts.wood ?? 0) + (counts.stone ?? 0);
  const rare = (counts.gold ?? 0) + (counts.ember ?? 0);
  assert.ok(common > rare, `흔한 재료(${common}) > 희소 재료(${rare}) — 다양성이 분포(희소성)에서 창발`);
  assert.ok(Object.keys(counts).length >= 3, '재료 종류 다양성 유지');

  // (2) 가치 = 에너지: FORGE 는 재료와 무관하게 같은 에너지(투입-세금)를 담으므로 모든 합성 무기는
  //     같은 위력이다 — 금 무기도 돌 무기도 동일. 희소 재료는 "더 세다"가 아니라 "더 귀하다".
  const forged = FORGE_ITEM_MAX - entropicLeak(FORGE_ITEM_MAX, FORGE_TAX_NUM, FORGE_TAX_DEN);
  assert.equal(weaponBonus(forged), weaponBonus(forged), '같은 에너지 → 같은 위력(재료 무관)');
  assert.equal(game.ledger.totalSum(), WORLD_SOURCE_INITIAL);

  console.log(`    [A9-1] div 제거·weaponBonus(잔고) 재료 무관 +${weaponBonus(FORGE_ITEM_MAX)} · 노드 분포 흔함 ${common} > 희소 ${rare}(희소성=분포) · 총합 ${game.ledger.totalSum()} 불변`);
});

test('A9-2 엔트로픽 누수 — 손 안 댄 질서(아이템)는 SINK로 자발 이완·결국 완전 소산 (커널 통일·보존)', () => {
  // (0) 순수 커널: 누수 = floor(잔고 × num/den) · relaxGradient 는 높은 쪽 → 낮은 쪽(필드 확산과 한 법칙).
  assert.equal(entropicLeak(1000, ITEM_DECAY_NUM, ITEM_DECAY_DEN), 20, '1000의 2% = 20');
  assert.equal(entropicLeak(49, 1, 50), 0, 'sub-1 흐름은 mean-field 에서 0 (양자 바닥은 호출측 책임)');
  const L = new EnergyLedger();
  L.createPool('a', 100, 1000); L.createPool('b', 20, 1000);
  assert.equal(relaxGradient(L, 'a', 'b', 1, 4, 'diffuse'), 20, 'grad 80 → floor(80/4)=20');
  assert.equal(L.balance('a'), 80); assert.equal(L.balance('b'), 40, '높은 쪽 → 낮은 쪽');

  const { game, join, intent, total } = setup();
  const a = join('A');
  game.tick();
  const bal = (id) => game.ledger.balance(id);

  // 결정(잔고 100) 응축 — 이후 아무것도 안 한다(손 안 댐).
  intent(a.player, INTENT.CONDENSE, {}, 'c1');
  game.tick();
  const crystal = [...game.items.values()][0];
  assert.equal(bal(crystal.id), CRYSTAL_COST);

  // (1) 한 감쇠 주기 — 손 안 댄 결정이 SINK로 이완. 누수 = max(floor(100/50),1)=2.
  while (game.tickCount === 0 || game.tickCount % DECAY_INTERVAL_TICKS !== 0) game.tick();
  const before = bal(crystal.id);
  game.tick(); // 진입 tickCount = 50의 배수 → 감쇠 발화
  const leaked = before - bal(crystal.id);
  assert.equal(leaked, Math.max(Math.floor(before / ITEM_DECAY_DEN), 1), '아이템 엔트로픽 누수 = floor(잔고/DEN)(양자 바닥 1)');
  assert.ok(leaked > 0, '손 안 댔는데도 감소(엔트로피)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '누수 후 총합 보존');
  // 소유자에게 누수 tx(decay) 방송 — 미러가 재생할 수 있다.
  const decayTx = a.conn.msgs.flatMap(m => m.t === MSG.OPS ? m.ops : []).find(o => o.op === 'tx' && o.cause === 'decay' && o.from === crystal.id);
  assert.ok(decayTx, '소유자에게 누수 tx(decay) 방송');

  // (2) 결국 완전 소산 — 잔고를 1로 몰아넣고 한 주기 더 돌리면 흩어져 사라진다(소멸).
  game.ledger.transfer(crystal.id, POOL.SINK, bal(crystal.id) - 1, 'test'); // 잔고 1 (SINK로 — 보존)
  while (game.tickCount % DECAY_INTERVAL_TICKS !== 0) game.tick();
  game.tick(); // 감쇠 발화 → leak=max(0,1)=1 → 0 → 소멸
  assert.ok(!game.items.has(crystal.id), '완전 소산한 결정은 소멸(원장에서도 제거)');
  const goneEv = a.conn.msgs.flatMap(m => m.t === MSG.OPS ? m.ops : []).find(o => o.op === 'event' && o.kind === 'item-gone' && o.id === crystal.id);
  assert.ok(goneEv, '소멸 시 소유자에게 item-gone');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '소멸 후에도 총합 보존');

  console.log(`    [A9-2] 아이템 누수 ${before}→${before - leaked}(=${leaked}·감가=엔트로피) · 손 안 댄 질서 결국 소멸 · WEAPON_WEAR 상수 제거 · 총합 ${total()} 불변`);
});

test('A9-2 미러 정합 — 엔트로픽 누수 tx 재생 후 아이템 잔고·지역 체크섬 일치', () => {
  const { game, join, intent } = setup();
  const a = join('A');
  game.tick();
  intent(a.player, INTENT.CONDENSE, {}, 'c1');
  game.tick();
  const crystal = [...game.items.values()][0];

  // 여러 감쇠 주기 경과 (전부 mirrored decay tx) → 체크섬 틱까지 진행
  for (let i = 0; i < 3; i++) { while (game.tickCount % DECAY_INTERVAL_TICKS !== 0) game.tick(); game.tick(); }
  while (game.tickCount % 30 !== 1) game.tick();

  const client = new ClientState();
  const resyncs = [];
  client.onResync = (keys) => resyncs.push(...keys);
  for (const msg of a.conn.msgs) client.handle(msg);

  assert.ok(game.ledger.balance(crystal.id) < CRYSTAL_COST, '누수로 잔고 감소했다');
  assert.equal(client.ledger.balance(crystal.id), game.ledger.balance(crystal.id), '누수 후 아이템 잔고 정합');
  for (const key of a.player.regions) {
    assert.equal(client.ledger.regionSum(key), game.ledger.regionSum(key), `지역 ${key} 체크섬 정합`);
  }
  assert.equal(resyncs.length, 0, '재동기화 불필요');
  assert.equal(client.checksumStatus, 'OK');
});

test('A9-3 흐름 흡수 — 채집량은 상수가 아니라 노드 집중도에서 창발 (풍부>고갈·엔트로픽 탭·보존)', () => {
  // (0) 순수 커널: nodeTap = floor(잔고 × num/den). 풍부한 노드가 더 주고, 거의 빈 노드는 0(로밍 유도).
  assert.equal(nodeTap(1000, NODE_TAP_NUM, NODE_TAP_DEN), Math.floor(1000 * NODE_TAP_NUM / NODE_TAP_DEN), 'floor(잔고 × rate)');
  assert.ok(nodeTap(1000, NODE_TAP_NUM, NODE_TAP_DEN) > nodeTap(200, NODE_TAP_NUM, NODE_TAP_DEN), '풍부 > 고갈');
  assert.equal(nodeTap(NODE_TAP_DEN - 1, NODE_TAP_NUM, NODE_TAP_DEN), 0, '거의 빈 노드(<DEN)는 흐름 0 — 양자 바닥 없음');
  assert.equal(nodeTap(0, NODE_TAP_NUM, NODE_TAP_DEN), 0, '빈 노드는 0');

  const { game, join, warp, intent, total } = setup();
  const a = join('A');
  game.tick();
  const bal = (id) => game.ledger.balance(id);
  const setBal = (id, v) => { const c = bal(id); if (v > c) game.ledger.transfer(POOL.SOURCE, id, v - c, 'test'); else if (v < c) game.ledger.transfer(id, POOL.SINK, c - v, 'test'); };

  const node = game.nodes.values().next().value;
  warp(a.player, node.x + 10, node.y, node.z);
  game.tick();

  // (1) 풍부한 노드에서 채집 = 큰 흐름.
  setBal(node.id, node.max); const nbRich = bal(node.id);
  setBal(a.player.id, 300);
  let p = bal(a.player.id);
  intent(a.player, INTENT.GATHER, { nodeId: node.id }, 'g-rich');
  game.tick();
  const rich = bal(a.player.id) - p;
  assert.equal(rich, nodeTap(nbRich, NODE_TAP_NUM, NODE_TAP_DEN), '풍부 노드 채집량 = 탭(노드 잔고)');

  // (2) 같은 노드를 고갈시키면 채집량이 법칙에 따라 줄어든다 — 감소수익이 클램프가 아니라 법칙.
  setBal(node.id, 100); const nbPoor = bal(node.id);
  setBal(a.player.id, 300);
  p = bal(a.player.id);
  intent(a.player, INTENT.GATHER, { nodeId: node.id }, 'g-poor');
  game.tick();
  const poor = bal(a.player.id) - p;
  assert.equal(poor, nodeTap(nbPoor, NODE_TAP_NUM, NODE_TAP_DEN), '고갈 노드 채집량 = 탭(노드 잔고)');
  assert.ok(rich > poor, '풍부할수록 많이·고갈될수록 적게 (감소수익=법칙·상수 아님)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '채집 창발 후에도 보존');

  console.log(`    [A9-3] 채집 창발 — 풍부(${nbRich})→${rich} · 고갈(${nbPoor})→${poor} · GATHER_AMOUNT/MINE_AMOUNT 상수 제거 · 총합 ${total()} 불변`);
});

test('A9-4 엔트로피 세금 — 합성(질서 집중)은 소산을 낳는다: 아이템 < 투입 (A9-2 누수의 대칭·보존)', () => {
  // (0) 세금 = entropicLeak(집중량) — 오르막(질서 창조)의 대가. 투입 150 → 세금 30.
  const tax = entropicLeak(FORGE_ITEM_MAX, FORGE_TAX_NUM, FORGE_TAX_DEN);
  assert.ok(tax > 0, '집중에는 대가가 있다(열역학 제2법칙)');

  const { game, join, warp, intent, total } = setup();
  const a = join('A');
  game.tick();
  const bal = (id) => game.ledger.balance(id);
  const setBal = (id, v) => { const c = bal(id); if (v > c) game.ledger.transfer(POOL.SOURCE, id, v - c, 'test'); else if (v < c) game.ledger.transfer(id, POOL.SINK, c - v, 'test'); };

  // 무기 친화 노드를 채굴해 재료 창고를 요건까지 채운다.
  const wNode = [...game.nodes.values()].find(n => MATERIALS[n.mat].affinity === 'weapon');
  const mat = wNode.mat;
  const stashId = `${POOL.STASH}${a.player.id}#${mat}`;
  warp(a.player, wNode.x + 10, wNode.y, wNode.z);
  game.tick();
  while (bal(stashId) < FORGE_MAT_REQUIRE) { intent(a.player, INTENT.MINE, { nodeId: wNode.id }); game.tick(); }
  setBal(a.player.id, FORGE_ATTR_COST + 10);

  const inputs = FORGE_MAT_REQUIRE + FORGE_ATTR_COST;
  const sinkBefore = bal(POOL.SINK);
  intent(a.player, INTENT.FORGE, { mat }, 'f1');
  game.tick();
  const item = [...game.items.values()].find(i => i.owner === a.player.id);

  assert.equal(bal(item.id), inputs - tax, '아이템 = 투입 - 세금 (오르막 집중의 소산)');
  assert.ok(bal(item.id) < inputs, '만든 것이 넣은 것보다 작다 — 민팅의 반대(질서 창조의 대가)');
  assert.ok(bal(POOL.SINK) - sinkBefore >= tax, '세금만큼(이상) SINK로 소산');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '세금 포함 총합 보존');

  console.log(`    [A9-4] 합성 세금 — 투입 ${inputs} → 아이템 ${bal(item.id)} + SINK 소산 ${tax}(질서 집중의 대가·A9-2 누수의 대칭) · 총합 ${total()} 불변`);
});

test('3D 속도 예산 — 수직 순간이동 비콘도 기각', () => {
  const { clock, game, join } = setup();
  const a = join('A');
  clock.t += 100; // 0.1초 만에 수직 500px = 예산 초과
  game.onMessage(a.player.id, { t: MSG.BEACON, x: SPAWN_POS.x, y: SPAWN_POS.y, z: SPAWN_POS.z + 500 });
  assert.ok(a.conn.msgs.find(m => m.t === MSG.TELEPORT), '수직 스피드핵 TELEPORT 정정');
  assert.equal(a.player.z, SPAWN_POS.z, 'z 불변');
});

test('미러 정합 — 서버 메시지 재생만으로 클라 원장이 체크섬과 일치', () => {
  const { clock, game, join, warp, intent } = setup();
  const a = join('A');
  const b = join('B');
  game.tick();

  // 실전 유사 시퀀스: 이동 → 채집 → 응축 → 용해 → 드랍 → 픽업 → 전투
  const node = game.nodes.values().next().value;
  warp(a.player, node.x + 10, node.y, node.z);
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
