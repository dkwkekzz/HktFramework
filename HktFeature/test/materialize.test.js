// ============================================================================
// 구 feature-0017(현 0016 step2) — 관측 시 구체화 (materialize on observation)
//
// 직관: 아무도 안 보는 세계는 서버에서 **에너지로만** 흐른다(국소장 확산·복사). 결정(정적 섬)은
//   관측이 없으면 에너지로 환원(탈구체화)되고, 다시 시야에 들면 석출로 **구체화**된다. 생명체(능동 섬)는
//   정체성을 지녀 환원하지 않고 **동면**(시뮬 정지)한다. 그래서 서버 부하가 세계 크기가 아니라 관측 규모에
//   상한을 갖는다. 관측 게이트는 라이브 기본(gateByObservation:true) — 규칙 검증 테스트는 이 게이트를 끈
//   채 전 세계를 시뮬한다(규칙은 관측에 독립).
// 강제: (1) 관측 밖 결정은 에너지로 환원(보존) (2) 관측 밖 국소장은 석출 안 함, 관측하면 구체화
//   (3) 관측 밖 야생 생명체는 동면 — 개체 단위 매 틱 시뮬은 정지하되, 에너지는 feature-0020 저해상도
//   갱신(군집 대사)으로 느리게 흐른다 (4) 소유 생명체는 관측 밖이어도 시뮬(동면 아님)
//   (5) 관측 지역 결정은 유지(대조) (6) 탈구체화·재구체화를 거쳐도 총합 불변.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import {
  POOL, CRYSTAL_INTERVAL_TICKS, CREATURE_SPAWN_GRANT,
  CREATURE_BASAL_COST, DORMANT_LOWRES_INTERVAL_TICKS,
  regionKey, regionNeighbors, materialKey,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t, gateByObservation: true }); // 관측 게이트 ON (라이브 모드)
  const conn = { send() {} };
  const player = game.addPlayer(conn, '관측자'); // 스폰(1000,1000) → 지역 1_1..3_3 관측
  const setView = (x, y) => { player.regions = new Set(regionNeighbors(x, y)); };
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const total = () => game.ledger.totalSum();
  const bal = (id) => game.ledger.balance(id);
  const crystalsInRegion = (rk) => [...game.crystals.values()].filter(c => regionKey(c.x, c.y) === rk);
  return { game, player, setView, runTicks, total, bal, crystalsInRegion };
}

test('탈구체화 — 관측 없는 지역의 결정은 에너지로 환원된다(보존)', () => {
  const s = setup();
  const far = s.game.spawnFood(200, 200, 500, 3, 5_000); // 지역 0_0 (관측 밖)
  const before = s.total();
  const cryBal = s.bal(far.id);
  assert.ok(cryBal > 0, '스폰 직후 결정에 잔고가 있다');
  s.runTicks(1); // tick 0 — 탈구체화 스윕(확산은 tick>0 이라 아직 안 돎)
  assert.ok(!s.game.crystals.has(far.id), '관측 없는 결정은 탈구체화(소멸)');
  assert.equal(s.total(), before, '보존 — 에너지는 사라지지 않고 국소장으로 환원');
  assert.ok(s.bal(materialKey(200, 200, 500)) >= cryBal, '결정 잔고가 그 자리 국소장으로 환원됐다');
});

test('구체화 — 관측 밖 국소장은 석출 안 하고, 관측하면 그때 구체화된다', () => {
  const s = setup();
  s.game.ledger.transfer(POOL.SOURCE, materialKey(200, 200, 500), 2_000_000, 'seed'); // 지역 0_0 과포화(관측 밖)
  s.runTicks(CRYSTAL_INTERVAL_TICKS + 3);
  assert.equal(s.crystalsInRegion('0_0').length, 0, '관측 없으면 석출 없음 — 에너지로만 남는다');

  s.setView(200, 200); // 이제 그 지역을 관측
  s.runTicks(CRYSTAL_INTERVAL_TICKS + 3);
  assert.ok(s.crystalsInRegion('0_0').length > 0, '관측하면 국소장이 결정으로 석출된다(구체화)');
});

test('동면 — 개체 단위 매 틱 시뮬은 정지하되, 저해상도 갱신으로 시간은 흐른다(feature-0020)', () => {
  const s = setup();
  const wild = s.game.spawnCreature(200, 300, 500); // 지역 0_0 (관측 밖), 갈구할 국소장 없음
  const b0 = s.bal(wild.id);
  assert.equal(b0, CREATURE_SPAWN_GRANT);
  s.runTicks(DORMANT_LOWRES_INTERVAL_TICKS); // 저해상도 패스 직전까지 (관측이면 매 틱 대사로 진작 잔고가 줄었다)
  assert.equal(s.bal(wild.id), b0, '패스 사이엔 잔고 동결 — 개체 단위 갈구·대사·성장·욕구 정지(동면)');
  s.runTicks(1); // 저해상도 패스 1회 — 군집 대사(feature-0020 step 2)
  assert.ok(s.game.creatures.has(wild.id), '예비가 넉넉하면 산다(즉사 아님)');
  assert.equal(s.bal(wild.id), b0 - CREATURE_BASAL_COST * DORMANT_LOWRES_INTERVAL_TICKS,
    '군집 대사만큼 잔고가 줄었다(시간 등가) — 관측 밖에도 시간이 흐른다');
});

test('소유 생명체는 관측 밖이어도 동면하지 않는다 — 아바타는 늘 산다', () => {
  const s = setup();
  const mine = s.game.possessCreature(s.player.id, 200, 300, 500); // owner 설정, 지역 0_0(관측 밖), 국소장 빔
  const b0 = s.bal(mine.id);
  s.runTicks(20);
  // 소유 개체는 동면 예외 → 대사가 돈다. 갈구할 국소장이 없으니 순감소(또는 아사).
  assert.ok(s.bal(mine.id) < b0, '소유 생명체는 관측 밖이어도 시뮬된다(대사로 잔고 변화 = 동면 아님)');
});

test('대조 — 관측 지역의 결정은 탈구체화되지 않고 유지된다', () => {
  const s = setup();
  const near = s.game.spawnFood(1000, 1000, 500, 3, 5_000); // 지역 2_2 (관측 안)
  s.runTicks(5);
  assert.ok(s.game.crystals.has(near.id), '관측 지역의 결정은 유지된다');
  assert.ok(s.bal(near.id) > 0, '잔고도 그대로');
});

test('보존 — 관측 안/밖이 섞이고 탈구체화가 일어나도 총합 불변', () => {
  const s = setup();
  s.game.spawnFood(200, 200, 500, 3, 5_000);   // 관측 밖(0_0) — 곧 탈구체화
  s.game.spawnFood(1900, 200, 500, 5, 5_000);  // 관측 밖(3_0) — 곧 탈구체화
  s.game.spawnFood(1000, 1000, 500, 3, 5_000); // 관측 안(2_2) — 유지
  s.game.spawnCreature(200, 300, 500);         // 관측 밖 — 동면
  const before = s.total();
  s.runTicks(40);
  assert.equal(s.total(), before, '탈구체화·동면·확산·복사를 거쳐도 전 풀 합계 불변');
});
