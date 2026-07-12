// ============================================================================
// 구 feature-0010(현 0018) step2 — 제조(craft): 재료 결정을 조합해 새 산물을 만드는 새 욕구
//
// 직관: 구 feature-0010(현 0018) step1 은 채집·사냥 욕구를 세웠고, "욕망은 확장의 근간"이라 했다. 구 feature-0011(현 0018) 은 욕구를
//   절차 레지스트리(registerDesire)로 일반화했다. 이 step 은 그 위에 **새 욕구(제조)**를 실제로 얹어 근간을
//   증명한다: 제조 욕구를 가진 생명체가 가까이 놓인 두 재료 결정(조합 지점)으로 이동해 하나의 **산물**로 조합한다.
//   조합은 만드는 일이라 에너지를 방출하고(열+연기, 순수 지출), 산물은 재료와 다른 종(craftedSpecies)에 crafted 표식.
// 강제: 모든 행동이 ledger.transfer(보존·정수). rng 미사용 → 결정론 불변. 엔진(game.js)은 'craft' 를 모른다(ctx 만).
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { DESIRE_PROCEDURES } from '../shared/desires.js';
import { POOL, WORLD_SOURCE_INITIAL, DESIRE, CREATURE_MAX_ENERGY, craftedSpecies } from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  const player = game.addPlayer(conn, '장인');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const txByCause = (cause) => msgs.filter(m => m.t === MSG.OPS).flatMap(m => m.ops).filter(op => op.cause === cause);
  return { game, player, msgs, bal, total, runTicks, txByCause };
}
// 재료 결정(raw, 미가공) 하나 — 제조의 원료. 재료는 수동 반응에 면역(안정 유지).
function material(game, x, y, z, species, amt = 2000) { return game.spawnRawFood(x, y, z, species, amt); }
function bigCreature(game, playerId, x, y, z, size = 2, energy = 1200) {
  const cre = game.possessCreature(playerId, x, y, z);
  cre.size = size; const pool = game.ledger.get(cre.id); if (pool) pool.max = CREATURE_MAX_ENERGY * size;
  game.ledger.transfer(POOL.SOURCE, cre.id, energy, 'seed');
  return cre;
}

test('레지스트리 — 새 욕구 "제조"가 절차로 등록돼 있고 인텐트로 부여된다', () => {
  assert.ok(DESIRE_PROCEDURES[DESIRE.CRAFT], '제조 절차가 등록돼 있다(구 feature-0011(현 0018) 개방 레지스트리에 얹음)');
  assert.ok(DESIRE_PROCEDURES[DESIRE.CRAFT].steps.length >= 2, '제조는 단계(다가가기·조합)가 있다');
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  const applied = s.game.setDesire(s.player.id, DESIRE.CRAFT);
  assert.equal(applied, DESIRE.CRAFT, '엔진 무수정으로 제조 욕구를 받아들인다');
  assert.equal(cre.desire, DESIRE.CRAFT);
});

test('제조 = 조합 지점으로 이동 → 산출: 두 재료가 하나의 산물로 조합된다', () => {
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  cre.desire = DESIRE.CRAFT;
  material(s.game, 1000, 1400, 500, 2); // 재료 A (감지 반경 안, 제조 사거리 밖 → 다가가야 한다)
  material(s.game, 1050, 1400, 500, 5); // 재료 B (A 와 붙어 있음 = 조합 가능한 쌍)
  assert.equal(s.game.crystals.size, 2, '처음엔 재료 둘');
  s.runTicks(45); // 다가가 → 조합
  assert.equal(s.game.crystals.size, 1, '두 재료가 하나의 산물로 묶인다(개수 감소)');
  const product = [...s.game.crystals.values()][0];
  assert.ok(product.crafted, '남은 결정은 제조 산물이다(crafted 표식)');
  assert.ok(!product.raw, '산물은 사용 가능하다(raw=false)');
  assert.equal(product.species, craftedSpecies(2, 5), '산물 종 = craftedSpecies(재료 종) — 재료와 다르다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '조합 전 과정에서 보존 불변');
});

test('제조는 에너지를 방출한다 — 열(심우주)+연기(국소장), 순수 지출(만드는 일의 대가)', () => {
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  cre.desire = DESIRE.CRAFT;
  material(s.game, 1000, 1050, 500, 2); // 곁(제조 사거리 안) → 바로 조합
  material(s.game, 1040, 1050, 500, 5);
  const sink0 = s.bal(POOL.SINK);
  s.runTicks(3);
  const crafts = s.txByCause('craft').filter(op => op.from === cre.id);
  assert.ok(crafts.some(op => op.to === POOL.SINK), '제조 방출 일부가 심우주로(열)');
  assert.ok(crafts.some(op => op.to.startsWith(POOL.MATERIAL)), '제조 방출 나머지가 국소장으로(연기)');
  assert.ok(s.bal(POOL.SINK) > sink0, '심우주가 늘었다 — 제조는 회수 없는 방출');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('산물은 재료로 재선택되지 않는다 — 산물 하나만 남으면 더는 조합하지 않는다(무한 재조합 없음)', () => {
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  cre.desire = DESIRE.CRAFT;
  material(s.game, 1000, 1050, 500, 2);
  material(s.game, 1040, 1050, 500, 5);
  s.runTicks(6); // 조합 완료 → 산물 하나
  assert.equal(s.game.crystals.size, 1, '산물 하나만 남는다');
  const product = [...s.game.crystals.values()][0];
  const sp = product.species;
  s.runTicks(20); // 더 돌려도 산물 혼자서는 조합 안 됨(쌍이 없다)
  assert.equal(s.game.crystals.size, 1, '산물은 재료로 다시 쓰이지 않는다(쌍 없음 → 제조 불가)');
  assert.equal([...s.game.crystals.values()][0].species, sp, '산물 종이 그대로다(재조합 없음)');
});

test('제조 욕구도 우선순위 스택에 든다(구 feature-0012(현 0018) 정합) — 우선순위가 행동을 정한다', () => {
  // 제조가 사냥보다 우선이면, 곁에 먹이가 있어도 제조를 한다(재료 조합).
  const s = setup();
  const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
  material(s.game, 1000, 1050, 500, 2);
  material(s.game, 1040, 1050, 500, 5);
  const prey = s.game.spawnCreature(1000, 940, 500); // 사거리 안 더 작은 먹이(size1)
  s.game.ledger.transfer(POOL.SOURCE, prey.id, 500, 'seed');
  s.game.injectDesire(s.player.id, DESIRE.CRAFT, 3); // 제조 우선
  s.game.injectDesire(s.player.id, DESIRE.HUNT, 1);
  s.runTicks(2); // 재료·먹이 둘 다 사거리 안(둘 다 수행 가능) — 우선순위 높은 제조가 이 틱을 차지한다
  assert.ok(s.txByCause('craft').some(op => op.from === cre.id), '제조가 우선이면 재료를 조합한다(사냥 대신)');
  assert.equal(s.txByCause('burst').filter(op => op.from === cre.id).length, 0, '둘 다 가능한 순간엔 우선순위 높은 제조가 이긴다(사냥 발산 없음)');
});

test('결정론 — 같은 배치/욕구면 제조 궤적이 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    const cre = bigCreature(s.game, s.player.id, 1000, 1000, 500);
    cre.desire = DESIRE.CRAFT;
    material(s.game, 1000, 1400, 500, 2);
    material(s.game, 1050, 1400, 500, 5);
    s.runTicks(50);
    const c = [...s.game.crystals.values()][0];
    return [cre.x, cre.y, cre.z, s.bal(cre.id), c ? [c.species, c.crafted, s.bal(c.id)] : null];
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 제조 궤적');
});

test('보존 폭풍 — 다수 개체가 제조·채집·사냥을 뒤섞어도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let i = 0; i < 6; i++) { material(s.game, 400 + i * 120, 800, 500, i % 12); material(s.game, 440 + i * 120, 800, 500, (i + 3) % 12); }
  for (let i = 0; i < 6; i++) {
    const c = bigCreature(s.game, s.player.id, 420 + i * 120, 700, 500, 2, 900);
    c.desire = i % 2 === 0 ? DESIRE.CRAFT : DESIRE.EAT;
  }
  s.runTicks(300);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '제조·식사·소산이 뒤섞여도 총합 불변');
});
