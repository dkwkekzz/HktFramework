// ============================================================================
// feature-0013 step3 — 파괴(규칙 C): 물리력(방출·강탈 damage)이 결정의 파괴강도를 넘으면
//   고체가 파편으로 부서진다(내구도 → 파편 결정들 + 국소장 먼지). 열(연소·용해)이 온도 임계라면
//   파괴는 단일 판정 물리력 임계 — 강탈/방출을 그 자극으로 정합(feature-0008·0009).
//
// 강제: 파괴도 전부 ledger.transfer(보존·정수). 결정론(rng 미사용) — 파편 위치는 결정론적 방사 배치.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../server/game.js';
import {
  POOL, CAUSE, WORLD_SOURCE_INITIAL, DESIRE,
  breakStrength, SHATTER_DEBRIS_COUNT, DISCHARGE_POWER, DISCHARGE_RADIUS,
} from '../shared/constants.js';

// 종 고르기: 파괴강도 낮은(잘 깨지는)·높은(단단한) 종
function fragileSpecies() { let s=0,b=Infinity; for(let i=0;i<12;i++){const v=breakStrength(i); if(v<b){b=v;s=i;}} return s; }
function toughSpecies()  { let s=0,b=-1;      for(let i=0;i<12;i++){const v=breakStrength(i); if(v>b){b=v;s=i;}} return s; }

function setup() {
  const game = new GameServer({ now: () => 1_000_000 });
  const bal = (id) => game.ledger.balance(id);
  const total = () => game.ledger.totalSum();
  const runTicks = (n) => { for (let i = 0; i < n; i++) game.tick(); };
  // 방출자(야생·NONE) — 표적을 향해 자율 방출한다. size2.
  const caster = game.spawnCreature(1000, 1000, 500); caster.size = 2; game.ledger.get(caster.id).max = 2000;
  // 표적(방출 대상) — size2(≥caster)라 방출 대상이 된다. **소유로 만들어 자율 발산·전투를 끈다**(재파괴 방지, 단일
  //   자극원). 소유(owner) 개체는 #discharge·#combat 이 건너뛰고, 실제 주인이 없어 욕구 절차도 무행동 = 순수 표적 더미.
  const target = game.spawnCreature(1000, 1490, 500); target.size = 2; game.ledger.get(target.id).max = 2000; target.owner = 'P:ghost';
  let shattered = 0;
  const orig = game.ledger.transfer.bind(game.ledger);
  game.ledger.transfer = (f, t, a, c) => { const r = orig(f, t, a, c); if (c === CAUSE.SHATTER) shattered += r; return r; };
  const spawnCry = (x, y, sp, amt) => game.spawnRawFood(x, y, 500, sp, amt);
  return { game, bal, total, runTicks, caster, target, spawnCry, shatteredGetter: () => shattered };
}

test('파괴강도 게이트 — 물리력이 파괴강도를 넘는 결정만 부서진다', () => {
  const s = setup();
  const FR = fragileSpecies(), TO = toughSpecies();
  const force = DISCHARGE_POWER * 2; // 방출 힘(caster size2)
  assert.ok(force >= breakStrength(FR), '설정 확인: 힘 ≥ 약한 종 파괴강도');
  assert.ok(force < breakStrength(TO), '설정 확인: 힘 < 단단한 종 파괴강도');
  const fragile = s.spawnCry(1100, 1490, FR, 3000);  // 착탄점(표적) 옆(100), 잘 깨짐 — 폭발은 캐스터가 아니라 착탄점에서 터진다(feature-0009 step2)
  const tough = s.spawnCry(900, 1490, TO, 3000);     // 착탄점 옆(100), 단단
  const fid = fragile.id, tid = tough.id;
  s.runTicks(8); // 발산(tick4) → 파이어볼이 착탄점(490px)까지 몇 틱 날아가 터진다(feature-0009 비행)
  assert.equal(s.game.crystals.has(fid), false, '약한 결정은 부서져 사라졌다');
  assert.equal(s.game.crystals.has(tid), true, '단단한 결정은 힘을 견뎌 남았다');
  assert.ok(s.shatteredGetter() > 0, '파괴(SHATTER) 이체가 일어났다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '파괴에 보존 불변');
});

test('파편 분해 — 부서진 결정은 파편 결정들 + 국소장(먼지)으로 나뉜다 (보존)', () => {
  const s = setup();
  const FR = fragileSpecies();
  const fragile = s.spawnCry(1100, 1490, FR, 3000); // 착탄점(표적) 옆 — 폭발이 그 자리에서 터진다
  const fid = fragile.id;
  const cryBefore = s.game.crystals.size;
  s.runTicks(8); // 파이어볼 비행 후 착탄·폭발(feature-0009)
  assert.equal(s.game.crystals.has(fid), false, '원본 소멸');
  // 같은 종(FR) 파편이 원래 자리 근처에 생겼다
  const debris = [...s.game.crystals.values()].filter(c => c.species === FR && s.bal(c.id) > 0);
  assert.equal(debris.length, SHATTER_DEBRIS_COUNT, `파편 ${SHATTER_DEBRIS_COUNT}개로 쪼개졌다`);
  for (const d of debris) assert.ok(s.bal(d.id) > 0 && s.bal(d.id) < 3000, '각 파편은 원본보다 작다');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '파편+먼지 합 = 원본(보존)');
});

test('단단한 결정만 — 힘이 모자라면 아무것도 안 부서진다', () => {
  const s = setup();
  const TO = toughSpecies();
  const tough = s.spawnCry(1100, 1490, TO, 3000); // 착탄점 옆 — 힘은 닿되(임계 미달) 안 부서진다
  const tid = tough.id;
  s.runTicks(8); // 방출 두 번
  assert.equal(s.game.crystals.has(tid), true, '단단한 결정은 여러 번 맞아도 안 부서진다');
  assert.equal(s.shatteredGetter(), 0, '파괴 이체 없음(임계 미달)');
  assert.equal(s.total(), WORLD_SOURCE_INITIAL, '보존 불변');
});

test('결정론 — 같은 시드/이벤트열이면 파괴 결과가 비트 단위로 동일', () => {
  const run = () => {
    const s = setup();
    const FR = fragileSpecies();
    s.spawnCry(1100, 1490, FR, 3000); // 착탄점 둘레(폭발 반경 안)
    s.spawnCry(950, 1450, FR, 2500);
    s.runTicks(6);
    return [...s.game.crystals.values()].filter(c => s.bal(c.id) > 0)
      .map(c => [c.x, c.y, c.species, s.bal(c.id)]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[3] - b[3]);
  };
  assert.deepEqual(run(), run(), '동일 시드 → 비트 동일 파괴·파편');
});
