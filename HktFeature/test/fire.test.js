// ============================================================================
// feature-0013 step1 — 연소(불 번짐): 가연성 물질이 열을 받아 발화점을 넘으면 점화되고,
//   스스로 내구도(잔고)를 태워 이웃 결정을 데우며 번진다. 온도 = 결정 열(H:) 풀 잔고.
//
// 직관: "불=열 방출", "나무=열 흡수→발화점 넘으면 스스로 방출"만 정의하면 불의 번짐은 창발한다.
// 강제: 자극·연소·냉각 전부 ledger.transfer(보존·정수). 결정론(rng 미사용) — 같은 시드면 같은 불.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import {
  POOL, CAUSE, WORLD_SOURCE_INITIAL, MATERIAL_FLAMMABLE,
  isFlammable, ignitionHeat, BURN_EMIT_RADIUS,
} from '../shared/constants.js';

function setup() {
  const clock = { t: 1_000_000 };
  const game = new GameServer({ now: () => clock.t });
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const heatOf = (c) => game.ledger.balance(`${POOL.HEAT}${c.seq}`);
  const cryList = () => [...game.crystals.values()].filter(c => bal(c.id) > 0);
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const FLAM = MATERIAL_FLAMMABLE.findIndex(Boolean);      // 첫 가연성 종
  const INERT = MATERIAL_FLAMMABLE.findIndex(v => !v);     // 첫 비가연성 종
  const spawnFlam = (x, y, z, amount) => game.spawnRawFood(x, y, z, FLAM, amount);
  const spawnInert = (x, y, z, amount) => game.spawnRawFood(x, y, z, INERT, amount);
  // 열원 자극 — SOURCE 에서 결정 열(H:)로 이체(보존). "불이 나무를 데운다"의 최소형.
  const heat = (c, amt) => game.ledger.transfer(POOL.SOURCE, `${POOL.HEAT}${c.seq}`, amt, CAUSE.HEAT);
  return { game, bal, total, heatOf, cryList, runTicks, spawnFlam, spawnInert, heat };
}

test('발화점 — 열이 발화점 미만이면 미점화, 넘으면 점화된다', () => {
  const s = setup();
  const c = s.spawnFlam(1000, 1000, 500, 5000);
  const ign = ignitionHeat(c.species);
  s.heat(c, ign - 10);
  s.runTicks(1);
  assert.equal(c.burning, false, '발화점 미만 → 미점화');
  s.heat(c, ign * 2);
  s.runTicks(1);
  assert.equal(c.burning, true, '발화점 초과 → 점화');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '자극·점화에 보존 불변');
});

test('가연성 태그 필터 — 비가연성 결정은 아무리 뜨거워도 점화(연소)되지 않는다', () => {
  const s = setup();
  const c = s.spawnInert(1000, 1000, 500, 5000);
  const before = s.bal(c.id);
  s.heat(c, 100000);
  s.runTicks(5);
  assert.equal(c.burning, false, '비가연성은 점화(연소)되지 않는다 — 태그로 걸러진다');
  // 주의: 비가연성은 대신 규칙 B(용해)로 녹는다(feature-0013 step2) — 그 검증은 melt.test.js. 여기선 '점화 안 됨'만 본다.
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('연소·전소 — 점화된 결정은 내구도를 태워 방출하며 전소해 소멸한다 (보존)', () => {
  const s = setup();
  const c = s.spawnFlam(1000, 1000, 500, 300);
  const id = c.id;
  const sinkBefore = s.bal(POOL.SINK);
  s.heat(c, ignitionHeat(c.species) + 50);
  s.runTicks(40);
  assert.equal(s.game.crystals.has(id), false, '전소로 소멸(잔해 결정 없음)');
  assert.ok(s.bal(POOL.SINK) > sinkBefore, '태운 열의 일부는 심우주로 복사(엔트로피)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '태운 에너지는 심우주·국소장으로 — 총합 불변');
});

test('연쇄 — 한쪽을 점화하면 반경 안 이웃으로 불이 번진다 (창발)', () => {
  const s = setup();
  const gap = Math.floor(BURN_EMIT_RADIUS * 0.7); // 이웃 반경 안, a-d 는 밖(중계로만 번짐)
  const a = s.spawnFlam(600, 1000, 500, 6000);
  const b = s.spawnFlam(600 + gap, 1000, 500, 6000);
  const d = s.spawnFlam(600 + gap * 2, 1000, 500, 6000);
  s.heat(a, ignitionHeat(a.species) + 300); // a 만 직접 점화
  s.runTicks(2);
  assert.equal(a.burning, true, 'a 점화');
  assert.equal(b.burning, false, '아직 b 는 미점화');
  s.runTicks(120);
  const gone = (c) => !s.game.crystals.has(c.id);
  assert.ok(b.burning || gone(b), 'b 로 번졌다(점화 또는 이미 전소)');
  assert.ok(d.burning || gone(d), 'd 까지 연쇄로 번졌다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '연쇄 연소에도 보존 불변');
});

test('냉각(자기제한) — 점화에 못 미친 열은 식어 사라진다', () => {
  const s = setup();
  const c = s.spawnFlam(1000, 1000, 500, 5000);
  const ign = ignitionHeat(c.species);
  s.heat(c, ign - 20);
  s.runTicks(30);
  assert.equal(c.burning, false, '발화점 아래 열은 점화 못 시킨다');
  assert.ok(s.heatOf(c) < ign - 20, '열이 식어(국소장으로 소산) 줄었다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '냉각(열→국소장)도 보존');
});

test('결정론 — 같은 시드/이벤트열이면 연소 결과가 비트 단위로 동일', () => {
  const run = () => {
    const s = setup();
    const cs = [];
    for (let i = 0; i < 4; i++) cs.push(s.spawnFlam(700 + i * 120, 1000, 500, 3000));
    s.heat(cs[0], ignitionHeat(cs[0].species) + 400);
    s.runTicks(60);
    return s.cryList().sort((a, b) => a.seq - b.seq).map(c => [c.seq, s.bal(c.id), c.burning ? 1 : 0, s.heatOf(c)]);
  };
  assert.deepEqual(run(), run(), '동일 시드 → 비트 단위 동일 연소');
});
