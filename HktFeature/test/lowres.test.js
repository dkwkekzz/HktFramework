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
// 강제 (step 2 — 군집 갈구·대사·생사, 저해상도 갱신):
//   (5) 풍요 복셀의 동면 개체는 군집 갈구로 순증한다(갈구>대사 — 활성과 같은 항상성, 시간 등가)
//   (6) 부족한 공급은 size 비례로 배분된다(D-5 — 거시가 총량을 정하고 배분이 개체를 해석한다)
//   (7) 동면 중에도 굶주림은 죽음이다(D-2 — 죽음은 기존 분해 경로, 보존)
//   (8) 정체성 연속 — 저해상도로 흐르는 것은 잔고뿐, 위치·size·desires 는 동결
//   (9) 저해상도 갱신·아사·확산이 뒤섞여도 총합 10⁹ 불변(보존)
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import {
  POOL, CREATURE_SPAWN_GRANT, CREATURE_FORAGE_RATE, CREATURE_BASAL_COST,
  DORMANT_LOWRES_INTERVAL_TICKS, regionNeighbors, materialKey,
} from '../shared/constants.js';

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
  assert.equal(s.bal(wild.id), CREATURE_SPAWN_GRANT, '스폰 잔고 그대로(저해상도 패스 전 = 동결)');
});

// --- step 2 — 군집 갈구·대사·생사 (저해상도 갱신) ---

const K = DORMANT_LOWRES_INTERVAL_TICKS;

test('군집 갈구 — 풍요 복셀의 동면 개체는 순증한다(갈구>대사, 시간 등가)', () => {
  const s = setup();
  const wild = s.game.spawnCreature(200, 200, 500); // 지역 0_0 (관측 밖)
  s.game.ledger.transfer(POOL.SOURCE, materialKey(200, 200, 500), 50_000, 'seed'); // 풍요 웅덩이(수요 160 ≪ 공급)
  const b0 = s.bal(wild.id);
  s.runTicks(K + 1); // 저해상도 패스 1회
  assert.equal(s.bal(wild.id), b0 + (CREATURE_FORAGE_RATE - CREATURE_BASAL_COST) * K,
    '갈구(5×K) − 대사(3×K) = 순증 — 활성 대사와 같은 항상성이 군집 단위로 흐른다');
});

test('군집 갈구 배분 — 부족한 공급은 size 비례로 나뉜다(D-5)', () => {
  const s = setup();
  const w1 = s.game.spawnCreature(200, 200, 500); // 같은 복셀의 두 동면 개체
  const w2 = s.game.spawnCreature(210, 210, 500);
  w2.size = 2; s.game.ledger.get(w2.id).max = 2_000;
  s.runTicks(K); // 패스 직전까지 굴리고 —
  s.game.ledger.transfer(POOL.SOURCE, materialKey(200, 200, 500), 60, 'seed'); // 공급 60 ≪ 수요 480(=5×3×K)
  const b1 = s.bal(w1.id), b2 = s.bal(w2.id);
  s.runTicks(1); // 저해상도 패스 — 갈구 배분 + 대사
  const r1 = s.bal(w1.id) - b1 + CREATURE_BASAL_COST * 1 * K; // 받은 몫 = 잔고 변화 + 낸 대사
  const r2 = s.bal(w2.id) - b2 + CREATURE_BASAL_COST * 2 * K;
  assert.ok(r1 > 0 && r2 > 0, '둘 다 나눠 받는다(선착순 독식 아님)');
  assert.ok(Math.abs(r2 - 2 * r1) <= 2, `size 비례 배분(내림 오차 허용): r1=${r1} r2=${r2}`);
  assert.ok(r1 + r2 <= 60, '받은 합이 공급을 넘지 않는다');
});

test('동면 중에도 굶주림은 죽음이다(D-2) — 죽음은 분해(보존)로 남는다', () => {
  const s = setup();
  const wild = s.game.spawnCreature(200, 200, 500); // 관측 밖, 갈구할 국소장 없음
  s.game.ledger.transfer(wild.id, POOL.SINK, 350, 'drain'); // 잔고 50 < 임계 60
  const before = s.total();
  s.runTicks(K + 1); // 저해상도 패스 — 갈구 0 → 생사판정
  assert.ok(!s.game.creatures.has(wild.id), '예비 아래로 굶주린 동면 개체는 죽는다 — 관측 없는 질서는 흩어진다');
  assert.equal(s.total(), before, '죽음 = 분해(결정+국소장) — 보존');
});

test('정체성 연속 — 저해상도로 흐르는 것은 잔고뿐, 위치·size·desires 는 동결', () => {
  const s = setup();
  const wild = s.game.spawnCreature(200, 200, 500);
  wild.size = 2; s.game.ledger.get(wild.id).max = 2_000;
  const { x, y, z, seq } = wild;
  s.runTicks(K + 1); // 저해상도 패스 1회(대사로 잔고만 변한다)
  const after = s.game.creatures.get(wild.id);
  assert.ok(after, '같은 개체가 살아 있다');
  assert.deepEqual([after.x, after.y, after.z, after.seq, after.size], [x, y, z, seq, 2],
    '위치·seq·size 동결 — 나갔다 온 봇은 딴 봇이 아니다');
  assert.equal(after.desires.size, 0, '욕구도 동결(개체의 사건은 정지)');
});

test('보존 — 저해상도 갱신·아사·확산이 뒤섞여도 총합 불변', () => {
  const s = setup();
  s.game.ledger.transfer(POOL.SOURCE, materialKey(200, 200, 500), 10_000, 'seed'); // 관측 밖 풍요
  s.game.spawnCreature(200, 200, 500);   // 먹고 사는 놈
  s.game.spawnCreature(200, 1200, 500);  // 굶는 놈(0_2, 국소장 없음) — 언젠가 아사
  s.game.spawnCreature(1000, 1000, 500); // 관측 안 활성 개체(대조)
  const before = s.total();
  s.runTicks(K * 4 + 1); // 저해상도 패스 4회 + 확산·복사·아사
  assert.equal(s.total(), before, '군집 갈구·대사·아사·확산을 거쳐도 전 풀 합계 불변');
});
