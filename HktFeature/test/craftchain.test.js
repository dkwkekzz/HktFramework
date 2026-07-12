// ============================================================================
// 구 feature-0011(현 0018) step2 — 다단계 제조: 재료 → 중간물 → 완성물 (절차 깊이 확장)
//
// 직관: 구 feature-0010(현 0018) step2 의 제조는 한 번(재료 둘 → 산물)으로 끝났다. 이 step 은 그 절차를 **다단계**로
//   깊게 한다: 결정에 단계(tier)를 두어 같은 단계 둘을 합쳐 한 단계 올린다 — 재료(tier0) → 중간물(tier1) →
//   완성물(tier2). 절차(shared/desires.js)에 단계를 더 얹어(완성 먼저·중간 나중) 상황에 맞게 다단계로 수행한다.
//   이것이 구 feature-0011(현 0018) 의 "절차 깊이 확장"이다 — 엔진은 여전히 첫 적용 단계만 실행하되 단계가 깊어졌다.
// 강제: 모든 행동이 ledger.transfer(보존·정수). rng 미사용 → 결정론 불변.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { MSG } from '../shared/protocol.js';
import { POOL, WORLD_SOURCE_INITIAL, DESIRE, CREATURE_MAX_ENERGY, CRAFT_MAX_TIER } from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const msgs = [];
  const conn = { send(s) { msgs.push(typeof s === 'string' ? JSON.parse(s) : s); } };
  const player = game.addPlayer(conn, '장인');
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const tiers = () => [...game.crystals.values()].map(c => c.tier).sort();
  return { game, player, bal, total, runTicks, tiers };
}
function material(game, x, y, z, species, amt = 1500) { return game.spawnRawFood(x, y, z, species, amt); }
function crafter(game, playerId, x, y, z) {
  const cre = game.possessCreature(playerId, x, y, z);
  cre.size = 2; const pool = game.ledger.get(cre.id); if (pool) pool.max = CREATURE_MAX_ENERGY * 2;
  game.ledger.transfer(POOL.SOURCE, cre.id, 1500, 'seed');
  cre.desire = DESIRE.CRAFT;
  return cre;
}
// 붙어 있는 네 재료(모두 서로 조합 반경 안) — 다단계 제조의 원료.
function fourMaterials(game) {
  material(game, 1000, 1050, 500, 2);
  material(game, 1080, 1050, 500, 5);
  material(game, 1000, 1130, 500, 3);
  material(game, 1080, 1130, 500, 8);
}

test('다단계 — 재료 넷이 중간물 둘을 거쳐 완성물 하나로 오른다(tier 0→1→2)', () => {
  const s = setup();
  crafter(s.game, s.player.id, 1000, 1000, 500);
  fourMaterials(s.game);
  assert.equal(s.game.crystals.size, 4, '처음엔 재료 넷(tier 0)');
  // 중간 단계: 재료를 합쳐 중간물(tier1)이 생긴다
  s.runTicks(3);
  assert.ok([...s.game.crystals.values()].some(c => c.tier === 1), '재료 둘을 합쳐 중간물(tier1)이 나타난다');
  // 완성 단계까지: 중간물 둘을 합쳐 완성물(tier2) 하나로
  s.runTicks(10);
  assert.equal(s.game.crystals.size, 1, '넷이 결국 하나로 묶인다');
  const product = [...s.game.crystals.values()][0];
  assert.equal(product.tier, CRAFT_MAX_TIER, '최종 산물은 완성물(tier2)이다');
  assert.ok(product.crafted, '완성물은 제조 산물 표식을 가진다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '다단계 전 과정에서 보존 불변');
});

test('완성물은 더 못 만든다(터미널) — tier==MAX 는 조합 대상이 아니다', () => {
  const s = setup();
  crafter(s.game, s.player.id, 1000, 1000, 500);
  fourMaterials(s.game);
  s.runTicks(20); // 완성물 하나까지
  assert.equal(s.game.crystals.size, 1);
  const before = [...s.game.crystals.values()][0].tier;
  assert.equal(before, CRAFT_MAX_TIER, '완성물(tier2)');
  s.runTicks(15); // 더 돌려도 완성물은 그대로(재조합 없음)
  assert.equal(s.game.crystals.size, 1, '완성물은 재료로 다시 안 쓰인다');
  assert.equal([...s.game.crystals.values()][0].tier, CRAFT_MAX_TIER, '단계가 그대로(터미널)');
});

test('완성 먼저 — 중간물 쌍이 생기면 재료보다 먼저 완성 단계를 수행한다(절차 우선순위)', () => {
  // 재료 넷 + 이미 만들어진 중간물 둘(붙여 놓음) → 다음 조합은 중간물→완성(재료 조합보다 먼저).
  const s = setup();
  crafter(s.game, s.player.id, 1000, 1000, 500);
  fourMaterials(s.game);
  // 중간물 둘을 미리 심는다(조합 반경 안, 재료와 겹치지 않는 자리)
  const i1 = material(s.game, 1000, 970, 500, 4); i1.raw = false; i1.crafted = true; i1.tier = 1;
  const i2 = material(s.game, 1080, 970, 500, 6); i2.raw = false; i2.crafted = true; i2.tier = 1;
  s.runTicks(2);
  assert.ok([...s.game.crystals.values()].some(c => c.tier === CRAFT_MAX_TIER), '중간물 둘이 먼저 완성물(tier2)로 조합된다');
});

test('결정론 — 같은 배치면 다단계 제조가 비트 단위로 동일하다', () => {
  const run = () => {
    const s = setup();
    crafter(s.game, s.player.id, 1000, 1000, 500);
    fourMaterials(s.game);
    s.runTicks(25);
    const c = [...s.game.crystals.values()];
    return [s.game.crystals.size, c.map(x => [x.tier, x.species, s.bal(x.id)]).sort()];
  };
  assert.deepEqual(run(), run(), '동일 조건 → 비트 단위 동일 다단계 궤적');
});

test('보존 폭풍 — 여러 장인이 다단계 제조를 동시에 돌려도 전 풀 합계 = 10⁹', () => {
  const s = setup();
  for (let k = 0; k < 4; k++) {
    const bx = 400 + k * 350;
    material(s.game, bx, 800, 500, k); material(s.game, bx + 80, 800, 500, k + 2);
    material(s.game, bx, 880, 500, k + 4); material(s.game, bx + 80, 880, 500, k + 6);
    crafter(s.game, s.player.id, bx, 750, 500);
  }
  s.runTicks(200);
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '다단계 제조가 뒤섞여도 총합 불변');
});
