// ============================================================================
// feature-0020 — 동면 생명체 저해상도 갱신 (거시가 예측하고, 관측자는 해석한다)
//
// 직관: 관측 밖 생명체는 개체 단위로 시뮬되지 않는다. 대신 지역별 **군집 통계(거시 변수 N·E·S)** 가
//   보존 하에 느리게 갱신되고, 재관측 시 개체는 그 거시 상태와 정합하는 미시 상태로 해석(복원)된다.
//   개체별 궤적은 관측 밖에서 "무관한 세부"고 살아남는 관련 변수가 군집의 에너지 흐름이다(재규격화 —
//   features/feature-0020-dormant-lowres.md).
// 강제 (step 1 — 군집 통계 계층, 읽기 전용):
//   (1) 집계 합 = 개체 합 — 지역별 n/e/s 가 그 지역 동면 개체들의 수/잔고 합/size 합과 일치(회계 대조)
//   (2) 관측 지역의 개체·소유 생명체(아바타)는 군집에 들지 않는다(동면이 아니므로)
//   (3) 게이트 OFF 면 군집이 없다(동면 자체가 없음 — 규칙 검증은 전 세계 시뮬 그대로)
//   (4) 집계는 순수 읽기 — 호출해도 세계(원장·개체)가 변하지 않는다
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import { POOL, CREATURE_SPAWN_GRANT, regionNeighbors } from '../shared/constants.js';

function setup({ gate = true } = {}) {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t, gateByObservation: gate });
  const conn = { send() {} };
  const player = game.addPlayer(conn, '관측자'); // 스폰(1000,1000) → 지역 1_1..3_3 관측
  const setView = (x, y) => { player.regions = new Set(regionNeighbors(x, y)); };
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const total = () => game.ledger.totalSum();
  const bal = (id) => game.ledger.balance(id);
  return { game, player, setView, runTicks, total, bal };
}

test('군집 집계 — 지역별 n/e/s 가 그 지역 동면 개체들의 합과 일치한다(회계 대조)', () => {
  const s = setup();
  const w1 = s.game.spawnCreature(200, 200, 500);  // 지역 0_0 (관측 밖)
  const w2 = s.game.spawnCreature(300, 250, 500);  // 지역 0_0 (관측 밖) — 같은 군집
  s.game.ledger.transfer(POOL.SOURCE, w2.id, 100, 'seed'); // 잔고를 달리해 e 합이 자명하지 않게
  w2.size = 2;                                     // size 합도 자명하지 않게
  const w3 = s.game.spawnCreature(200, 1200, 500); // 지역 0_2 (관측 밖) — 다른 군집
  s.runTicks(1);                                   // 관측 지역 확정(#refreshActiveRegions)

  const clusters = s.game.dormantClusters();
  assert.equal(clusters.size, 2, '관측 밖 두 지역 = 두 군집');
  const c00 = clusters.get('0_0');
  assert.equal(c00.n, 2, '0_0 군집 개체 수');
  assert.equal(c00.e, s.bal(w1.id) + s.bal(w2.id), '0_0 군집 잔고 합 = 개체 잔고 합');
  assert.equal(c00.s, w1.size + w2.size, '0_0 군집 size 합 = 개체 size 합');
  assert.deepEqual(c00.creatures.map(c => c.seq), [w1.seq, w2.seq].sort((a, b) => a - b), '개체 목록은 seq 오름차순(결정론)');
  const c02 = clusters.get('0_2');
  assert.equal(c02.n, 1);
  assert.equal(c02.e, s.bal(w3.id));
});

test('관측 지역의 개체·소유 생명체는 군집에 들지 않는다 — 동면이 아니므로', () => {
  const s = setup();
  s.game.spawnCreature(1000, 1000, 500);                    // 지역 2_2 (관측 안) — 활성
  const mine = s.game.possessCreature(s.player.id, 200, 200, 500); // 소유(아바타), 관측 밖이어도 늘 산다
  s.runTicks(1);
  const clusters = s.game.dormantClusters();
  assert.ok(!clusters.has('2_2'), '관측 지역 개체는 군집이 아니다(활성 시뮬)');
  for (const cl of clusters.values())
    assert.ok(!cl.creatures.some(c => c.id === mine.id), '소유 생명체는 어떤 군집에도 없다(동면 예외)');
});

test('게이트 OFF — 동면이 없으므로 군집도 없다(규칙 검증은 전 세계 시뮬 그대로)', () => {
  const s = setup({ gate: false });
  s.game.spawnCreature(200, 200, 500); // 게이트 있었다면 관측 밖
  s.runTicks(1);
  assert.equal(s.game.dormantClusters().size, 0, '게이트 OFF 면 빈 Map');
});

test('집계는 순수 읽기 — 호출해도 원장·개체가 변하지 않는다', () => {
  const s = setup();
  const wild = s.game.spawnCreature(200, 200, 500);
  s.runTicks(1);
  const before = s.total(), b0 = s.bal(wild.id);
  s.game.dormantClusters();
  s.game.dormantClusters();
  assert.equal(s.total(), before, '총합 불변');
  assert.equal(s.bal(wild.id), b0, '개체 잔고 불변');
  assert.equal(s.bal(wild.id), CREATURE_SPAWN_GRANT, '스폰 잔고 그대로(동면 = 아직 완전 정지, step 2 전)');
});
