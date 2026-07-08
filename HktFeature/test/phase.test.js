// ============================================================================
// feature-0005 step4 — 물질 상태(기체·액체·고체)는 국소장 에너지의 밀도 regime 이다
//
// 직관: 같은 국소장 에너지가 밀도에 따라 다르게 행동한다 — 저밀도는 기체처럼 등방으로 퍼지고,
//   중밀도는 액체처럼 중력에 따라 아래로 흐르고 고여 수면을 이루며, 고밀도는 굳어 결정(고체)로 석출한다.
//   상태는 농도 임계로 갈리고(fieldPhase), 상전이는 임계 통과로 창발한다.
// 강제: 침강도 전부 ledger.transfer(보존·정수). 결정론(중력은 rng 미사용).
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import {
  POOL, WORLD_SOURCE_INITIAL, fieldPhase,
  LIQUID_CONDENSE, LIQUID_CAPACITY, CRYSTAL_SATURATION,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const bal = (id) => game.ledger.balance(id);
  const col = (cx, cy) => [0, 1, 2, 3].map(cz => bal(`${POOL.MATERIAL}${cx}_${cy}_${cz}`)); // [바닥…꼭대기]
  const seed = (cx, cy, cz, amount) => game.ledger.transfer(POOL.SOURCE, `${POOL.MATERIAL}${cx}_${cy}_${cz}`, amount, 'seed');
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const total = () => game.ledger.totalSum();
  return { game, bal, col, seed, runTicks, total };
}

test('fieldPhase — 농도로 상태가 갈린다 (기체 < 응축 ≤ 액체 < 포화 ≤ 고밀도)', () => {
  assert.equal(fieldPhase(0), 'empty');
  assert.equal(fieldPhase(LIQUID_CONDENSE - 1), 'gas');
  assert.equal(fieldPhase(LIQUID_CONDENSE), 'liquid');
  assert.equal(fieldPhase(CRYSTAL_SATURATION - 1), 'liquid');
  assert.equal(fieldPhase(CRYSTAL_SATURATION), 'dense'); // 과포화 → 석출(고체)로
});

test('중력 — 위에 부은 액체는 아래로 옮겨 앉는다 (기체는 등방이라 안 그렇다)', () => {
  const half = (c) => [c[0] + c[1], c[2] + c[3]]; // [아래 절반, 위 절반]

  // 액체: 위 두 층(액체 밴드)에 부으면 중력으로 아래 절반으로 옮겨 앉는다
  const L = setup();
  L.seed(0, 0, 3, LIQUID_CONDENSE + 70); // 꼭대기
  L.seed(0, 0, 2, LIQUID_CONDENSE + 70); // 그 아래 — 처음엔 위 절반이 전부
  L.runTicks(100);
  const [lo, hi] = half(L.col(0, 0));
  assert.ok(lo > hi, `액체는 아래로 가라앉는다 (아래 절반 ${lo} > 위 절반 ${hi})`);
  assert.equal(L.total(), WORLD_SOURCE_INITIAL, '보존 불변');

  // 기체 대조: 위에 부어도 등방 확산이라 아래가 위를 넘어서지 않는다(중력 없음)
  const G = setup();
  G.seed(0, 0, 3, LIQUID_CONDENSE - 40); // 기체 밴드
  G.seed(0, 0, 2, LIQUID_CONDENSE - 40);
  G.runTicks(100);
  const [glo, ghi] = half(G.col(0, 0));
  assert.ok(glo <= ghi, `기체는 가라앉지 않는다(등방): 아래 절반 ${glo} ≤ 위 절반 ${ghi}`);
});

test('수면 — 부은 액체가 바닥부터 고여 아래가 무거운 기둥(수면)을 이룬다', () => {
  const { seed, col, runTicks, total } = setup();
  // 한 기둥의 위 세 층에 액체를 부으면(각 <포화) 아래로 흘러 바닥부터 찬다
  seed(1, 1, 1, LIQUID_CONDENSE + 80);
  seed(1, 1, 2, LIQUID_CONDENSE + 80);
  seed(1, 1, 3, LIQUID_CONDENSE + 80);
  runTicks(120);
  const c = col(1, 1); // [바닥, …, 꼭대기]
  assert.ok(c[0] > c[3], `바닥이 꼭대기보다 확연히 무겁다(가라앉음): 바닥 ${c[0]} > 꼭대기 ${c[3]}`);
  assert.ok(c[0] + c[1] > c[2] + c[3], `아래 절반이 위 절반보다 무겁다(바닥부터 고임): ${c.join(',')}`);
  assert.ok(c[0] <= LIQUID_CAPACITY + 20, `한 복셀은 용량 근처까지만 고이고 넘치면 위로(수면 상승): 바닥 ${c[0]}`);
  assert.equal(total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('결정론 — 같은 시드/이벤트열이면 침강 결과가 비트 단위로 동일', () => {
  const run = () => {
    const s = setup();
    s.seed(2, 2, 3, LIQUID_CONDENSE + 90);
    s.seed(2, 2, 2, LIQUID_CONDENSE + 50);
    s.runTicks(100);
    return [s.col(2, 2), s.col(1, 2), s.col(2, 1)];
  };
  assert.deepEqual(run(), run(), '동일 시드 → 비트 단위 동일 침강 분포');
});
