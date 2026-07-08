// ============================================================================
// feature-0006 step1 — 생명체(creature): 스스로 에너지 질서를 유지한다
//
// 직관: 생명체는 능동적 저엔트로피 섬이다. 살아있음 자체가 비용(물질대사 → 심우주)이고, 그 비용을
//   대기 위해 세계(국소장)로부터 에너지를 갈구(forage)하며, 대지 못하면(최소 예비 아래로 떨어지면)
//   질서가 붕괴해 죽는다(분해 → 결정+국소장). 그래서:
//     · 풍요로운 국소장 → 생명체는 무한히 산다(잔고가 용량 근처에서 안정).
//     · 고갈된 국소장 → 생명체는 유한 틱에 굶어 죽는다.
//   이 둘이 한눈에 갈린다 — 항상성이 곧 검증 명제다.
// 강제: 갈구·대사·스폰·죽음 전부 ledger.transfer(보존·정수). 생명체도 결국 태양에서 온 에너지 → 전 풀 합 = 10⁹.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import {
  POOL, WORLD_SOURCE_INITIAL, CREATURE_SPAWN_GRANT, CREATURE_MAX_ENERGY,
  CREATURE_BASAL_COST, CREATURE_FORAGE_RATE, CREATURE_DEATH_THRESHOLD, materialKey,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  game.addPlayer(conn, '관전자');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const sumPrefix = (prefix) => {
    let s = 0;
    for (const [id, p] of game.ledger.pools) if (id.startsWith(prefix)) s += p.balance;
    return s;
  };
  // 한 복셀에 에너지를 즉시 주입(테스트 시딩) — 풍요/고갈 환경을 만든다
  const seed = (voxel, amount) => game.ledger.transfer(POOL.SOURCE, `${POOL.MATERIAL}${voxel}`, amount, 'seed');
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const alive = (cre) => game.creatures.has(cre.id) && bal(cre.id) > 0;
  const lastCreatureSnapshot = () => {
    const f = msgs.filter(m => m.t === MSG.CREATURE);
    const last = f[f.length - 1];
    const map = new Map();
    if (last) for (const [seq, x, y, z, b] of last.cells) map.set(seq, { x, y, z, balance: b });
    return map;
  };
  return {
    game, bal, total, seed, runTicks, alive, lastCreatureSnapshot,
    matTotal: () => sumPrefix(POOL.MATERIAL),
    cryTotal: () => sumPrefix(POOL.CRYSTAL),
    creTotal: () => sumPrefix(POOL.CREATURE),
  };
}

test('창세 — 생명체는 없이 시작하고 보존은 불변', () => {
  const { game, creTotal, total } = setup();
  assert.equal(game.creatures.size, 0, '창세에 생명체는 없다(라이브 진입점에서만 푼다)');
  assert.equal(creTotal(), 0);
  assert.equal(total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('스폰 — SOURCE→생명체 인출도 원장 이체 (저엔트로피 주입, 보존 유지)', () => {
  const { game, bal, total } = setup();
  const src0 = bal(POOL.SOURCE);
  const cre = game.spawnCreature(1000, 1000, 500);
  assert.equal(bal(cre.id), CREATURE_SPAWN_GRANT, '스폰 인출 = SPAWN_GRANT');
  assert.equal(bal(POOL.SOURCE), src0 - CREATURE_SPAWN_GRANT, '태양이 유일한 원점');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '스폰 후 총합 불변');
});

test('갈구 — 생명체는 그 자리 국소장에서 에너지를 흡수해 내부 질서를 보충한다', () => {
  const { game, bal, seed, runTicks } = setup();
  const cre = game.spawnCreature(1000, 1000, 500);
  const matId = materialKey(cre.x, cre.y, cre.z);
  game.ledger.transfer(POOL.SOURCE, matId, 500, 'seed'); // 그 자리 국소장을 풍요롭게
  const cre0 = bal(cre.id), mat0 = bal(matId);
  runTicks(2); // 첫 tick(tickCount 0)은 guard로 무동작 → 두 번째 tick에서 대사 1회: 갈구(+RATE) 후 대사(−BASAL)
  assert.ok(bal(cre.id) > cre0, `갈구로 생명체 잔고가 늘었다 (${cre0} → ${bal(cre.id)})`);
  assert.equal(bal(cre.id) - cre0, CREATURE_FORAGE_RATE - CREATURE_BASAL_COST, '순 변화 = 갈구 − 대사');
  assert.ok(bal(matId) < mat0, '흡수한 만큼 국소장이 줄었다(세계로부터 갈구)');
});

test('물질대사 = 지속 소모 → 심우주(SINK) 단조 증가 · 갈구 없으면 굶어 죽는다', () => {
  const { game, bal, total, runTicks, alive } = setup();
  const cre = game.spawnCreature(300, 1700, 500); // 외딴 자리 — 국소장이 비어 갈구할 게 없다
  const sink0 = bal(POOL.SINK);
  // 대사가 매 틱 BASAL 을 심우주로 방출 → 잔고가 마르고 임계 아래로 떨어지면 죽는다.
  const ticksToDeath = Math.ceil((CREATURE_SPAWN_GRANT - CREATURE_DEATH_THRESHOLD) / CREATURE_BASAL_COST) + 2;
  let diedBy = null;
  for (let i = 1; i <= ticksToDeath + 20; i++) {
    game.tick();
    if (!alive(cre) && diedBy === null) diedBy = i;
  }
  assert.ok(diedBy !== null, '갈구할 세계가 없으면 생명체는 반드시 굶어 죽는다');
  assert.ok(diedBy <= ticksToDeath, `유한하고 예측된 틱 안에 죽는다 (${diedBy} ≤ ${ticksToDeath})`);
  assert.ok(bal(POOL.SINK) > sink0, '죽기 전까지 대사가 심우주로 지속 방출했다(엔트로피의 화살)');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '아사·분해에도 보존 불변');
});

test('항상성 — 풍요로운 국소장에서는 산다(용량 근처 안정), 고갈되면 죽는다 (한눈에 갈림)', () => {
  const rich = setup();
  const richCre = rich.game.spawnCreature(1000, 1000, 500);
  rich.game.ledger.transfer(POOL.SOURCE, materialKey(1000, 1000, 500), 200_000_000, 'seed'); // 마르지 않는 풍요
  rich.runTicks(2000);
  assert.ok(rich.alive(richCre), '풍요로운 국소장의 생명체는 오래 살아남는다');
  assert.ok(rich.bal(richCre.id) >= CREATURE_DEATH_THRESHOLD, '잔고가 임계 위에서 유지된다');
  assert.ok(rich.bal(richCre.id) > CREATURE_MAX_ENERGY * 0.7, `잔고가 용량 근처에서 안정된다 (${rich.bal(richCre.id)}/${CREATURE_MAX_ENERGY})`);
  assert.ok(rich.bal(POOL.SINK) > 0, '살아있는 동안 대사로 심우주에 계속 지불한다(공짜 생존 없음)');
  assert.equal(rich.total(), WORLD_SOURCE_INITIAL, '보존 불변');

  const poor = setup();
  const poorCre = poor.game.spawnCreature(1000, 1000, 500); // 국소장 시딩 없음 — 고갈
  poor.runTicks(2000);
  assert.ok(!poor.alive(poorCre), '고갈된 국소장의 생명체는 굶어 죽는다');
  assert.equal(poor.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('죽음의 분해 — 굶어 죽은 생명체의 잔해는 결정+국소장으로 흩어진다 (feature-0005 정합)', () => {
  const { game, bal, total, runTicks, alive, cryTotal, matTotal } = setup();
  const cre = game.spawnCreature(300, 1700, 500); // 외딴 자리(다른 결정과 반경 밖) — 순수 분해만 관측
  const cry0 = cryTotal(), mat0 = matTotal();
  // 죽는 순간의 잔고를 포착한다 — 임계(>0) 근처에서 붕괴하므로 잔해가 남는다.
  let balAtDeath = null;
  for (let i = 0; i < 300 && alive(cre); i++) {
    const before = bal(cre.id);
    game.tick();
    if (!alive(cre)) balAtDeath = before; // 이 틱에서 죽었다 — 직전 잔고가 분해 재료의 상한
  }
  assert.ok(balAtDeath !== null, '생명체가 죽었다');
  const cryAdded = cryTotal() - cry0, matAdded = matTotal() - mat0;
  assert.ok(cryAdded > 0, '잔해가 결정으로 응결됐다 — "파괴되면 결정체가 나타난다"');
  assert.ok(cryAdded + matAdded > 0, '분해된 잔해가 결정·국소장 두 갈래로 흩어졌다');
  assert.equal(total(), WORLD_SOURCE_INITIAL, '아사·분해 전 과정에서 보존 불변');
});

test('결정론 — 같은 시드/배치/이벤트열이면 생명체 상태가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    s.game.spawnCreature(1000, 1000, 500);
    s.game.spawnCreature(700, 1200, 400);
    s.game.ledger.transfer(POOL.SOURCE, materialKey(1000, 1000, 500), 1_000_000, 'seed');
    s.runTicks(500);
    return [...s.game.creatures.values()].map(c => [c.seq, s.bal(c.id)]);
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 생명체 분포(잔고)');
});

test('CREATURE 방송 — 살아있는 생명체가 [seq,x,y,z,잔고] 스냅샷으로 실린다(뷰어가 마커로 그린다)', () => {
  const { game, seed, runTicks, lastCreatureSnapshot } = setup();
  const cre = game.spawnCreature(1000, 1000, 500);
  game.ledger.transfer(POOL.SOURCE, materialKey(cre.x, cre.y, cre.z), 5_000_000, 'seed');
  runTicks(20);
  const snap = lastCreatureSnapshot();
  assert.ok(snap.size >= 1, '생명체 스냅샷에 최소 하나의 살아있는 생명체가 실린다');
  const one = snap.get(cre.seq);
  assert.ok(one && one.balance > 0, '실린 생명체의 잔고가 0 보다 크다');
  assert.equal(one.x, cre.x, '생명체는 제 위치로 실린다');
});

test('보존 — 다수 생명체가 갈구·대사·아사를 반복해도 전 풀 합계 = 10⁹', () => {
  const { game, total, runTicks } = setup();
  for (let i = 0; i < 10; i++) game.spawnCreature(400 + i * 120, 900 + (i % 3) * 200, 300 + (i % 4) * 150);
  // 일부 자리엔 풍요를, 일부는 고갈로 둔다 — 사는 놈·죽는 놈이 섞인다
  game.ledger.transfer(POOL.SOURCE, materialKey(400, 900, 300), 2_000_000, 'seed');
  game.ledger.transfer(POOL.SOURCE, materialKey(880, 1300, 450), 2_000_000, 'seed');
  runTicks(1000);
  assert.equal(total(), WORLD_SOURCE_INITIAL, '갈구·대사·아사·분해가 뒤섞여도 총합 불변');
});
