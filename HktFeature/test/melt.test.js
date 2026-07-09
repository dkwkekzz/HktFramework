// ============================================================================
// feature-0013 step2 — 상전이(용해): 비가연성 결정이 녹는점(heat)을 넘으면 고체→액체로 녹아
//   국소장으로 흘러든다(결정 → 국소장). 가연성은 규칙 A(연소)로 타고, 비가연성은 규칙 B(용해)로 녹는다
//   — 같은 열 자극, 태그로 다른 상태전이. 불이 이웃 비가연성 결정을 녹이기도 한다(열은 다 데운다).
//
// 강제: 용해도 전부 ledger.transfer(보존·정수) — 태운 게 아니라 녹은 것이라 심우주 손실 없이 국소장으로 간다.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import {
  POOL, CAUSE, WORLD_SOURCE_INITIAL, MATERIAL_FLAMMABLE,
  isFlammable, meltHeat, materialKey, BURN_EMIT_RADIUS,
} from '../shared/constants.js';

function setup() {
  const game = new GameServer({ now: () => 1_000_000 });
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const heatOf = (c) => game.ledger.balance(`${POOL.HEAT}${c.seq}`);
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  const FLAM = MATERIAL_FLAMMABLE.findIndex(Boolean);
  const INERT = MATERIAL_FLAMMABLE.findIndex(v => !v);
  const spawnFlam = (x, y, z, amt) => game.spawnRawFood(x, y, z, FLAM, amt);
  const spawnInert = (x, y, z, amt) => game.spawnRawFood(x, y, z, INERT, amt);
  const heat = (c, amt) => game.ledger.transfer(POOL.SOURCE, `${POOL.HEAT}${c.seq}`, amt, CAUSE.HEAT);
  // melt 원인 이체 총량 계측
  let melted = 0;
  const orig = game.ledger.transfer.bind(game.ledger);
  game.ledger.transfer = (f, t, a, c) => { const r = orig(f, t, a, c); if (c === CAUSE.MELT) melted += r; return r; };
  return { game, bal, total, heatOf, runTicks, spawnFlam, spawnInert, heat, INERT, meltedGetter: () => melted };
}

test('녹는점 게이트 — 열이 녹는점 미만이면 안 녹고, 넘으면 녹기 시작한다', () => {
  const s = setup();
  const c = s.spawnInert(1000, 1000, 500, 5000);
  const mp = meltHeat(c.species);
  assert.ok(Number.isFinite(mp), '비가연성은 유한한 녹는점을 가진다');
  const d0 = s.bal(c.id);
  s.heat(c, mp - 20);
  s.runTicks(3);
  assert.equal(s.bal(c.id), d0, '녹는점 미만 → 내구도 그대로(안 녹음)');
  s.heat(c, mp * 2);
  s.runTicks(3);
  assert.ok(s.bal(c.id) < d0, '녹는점 초과 → 내구도가 국소장으로 녹아 줄었다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '용해에 보존 불변');
});

test('용해 — 비가연성 결정은 녹으면 내구도가 국소장으로 가고(심우주 아님) 다 녹으면 소멸한다', () => {
  const s = setup();
  const c = s.spawnInert(1000, 1000, 500, 300);
  const id = c.id;
  const sinkBefore = s.bal(POOL.SINK);
  s.heat(c, meltHeat(c.species) + 400); // 넉넉히 뜨겁게 (계속 녹게)
  s.runTicks(40);
  assert.equal(s.game.crystals.has(id), false, '다 녹아 소멸');
  assert.ok(s.meltedGetter() > 0, '용해(MELT) 이체가 실제로 일어났다');
  // 용해는 상전이라 심우주(복사 손실)로 태우지 않는다 — 연소와 구분되는 지점. (국소장 자체 복사분만 미미)
  assert.ok(s.bal(POOL.SINK) - sinkBefore < 300, '녹은 에너지는 국소장으로 — 심우주로 태워 없어지지 않는다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '용해 전 과정 보존 불변');
});

test('태그 분기 — 가연성은 녹지 않고 탄다(규칙 A), 비가연성은 타지 않고 녹는다(규칙 B)', () => {
  const s = setup();
  const flam = s.spawnFlam(600, 1000, 500, 4000);
  const inert = s.spawnInert(1400, 1000, 500, 4000); // 서로 멀리(상호 열 없음)
  s.heat(flam, 100000);
  s.heat(inert, 100000);
  s.runTicks(10);
  assert.equal(flam.burning, true, '가연성 → 연소(burning)');
  assert.equal(inert.burning, false, '비가연성 → 연소 안 함');
  assert.ok(s.meltedGetter() > 0, '비가연성 → 용해(MELT) 발생');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('연소→용해 상호작용 — 불이 이웃 비가연성 결정을 녹인다 (열은 다 데운다)', () => {
  const s = setup();
  const gap = Math.floor(BURN_EMIT_RADIUS * 0.6);
  const fire = s.spawnFlam(700, 1000, 500, 8000);   // 오래 타는 불
  const ice = s.spawnInert(700 + gap, 1000, 500, 4000); // 곁의 비가연성(안 탐)
  const d0 = s.bal(ice.id);
  s.heat(fire, 5000); // 불 점화(넉넉히)
  s.runTicks(120);
  assert.ok(s.bal(ice.id) < d0 || !s.game.crystals.has(ice.id), '불의 열이 번져 이웃 비가연성이 녹았다(내구도↓ 또는 소멸)');
  assert.equal(ice.burning ?? false, false, '이웃은 타지 않았다(비가연성) — 녹았을 뿐');
  assert.ok(s.meltedGetter() > 0, '용해 이체 발생');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '연소+용해가 뒤섞여도 보존 불변');
});

test('결정론 — 같은 시드/이벤트열이면 용해 결과가 비트 단위로 동일', () => {
  const run = () => {
    const s = setup();
    const cs = [];
    for (let i = 0; i < 3; i++) cs.push(s.spawnInert(700 + i * 100, 1000, 500, 2000));
    for (const c of cs) s.heat(c, meltHeat(c.species) + 300);
    s.runTicks(40);
    return [...s.game.crystals.values()].filter(c => s.bal(c.id) > 0).sort((a, b) => a.seq - b.seq).map(c => [c.seq, s.bal(c.id)]);
  };
  assert.deepEqual(run(), run(), '동일 시드 → 비트 동일 용해');
});
