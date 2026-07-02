// ============================================================================
// 원장 단위 테스트 — 보존 불변식이 자료구조 수준에서 성립하는지 확인
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnergyLedger } from '../shared/ledger.js';
import { mulberry32, randInt } from '../shared/rng.js';

function bruteRegionSums(ledger) {
  const sums = new Map();
  for (const p of ledger.pools.values()) {
    if (p.region !== null) sums.set(p.region, (sums.get(p.region) ?? 0) + p.balance);
  }
  return sums;
}

test('이체는 잔고·수용량으로 클램프되고 총합을 보존한다', () => {
  const l = new EnergyLedger();
  l.createPool('a', 100, 100);
  l.createPool('b', 50, 80);

  assert.equal(l.transfer('a', 'b', 999, 't'), 30);  // b 수용량 클램프 (80-50)
  assert.equal(l.balance('a'), 70);
  assert.equal(l.balance('b'), 80);

  assert.equal(l.transfer('b', 'a', 999, 't'), 30);  // a 수용량 클램프 (100-70)
  assert.equal(l.transfer('a', 'b', 0, 't'), 0);     // 무효 이체
  assert.equal(l.transfer('a', 'a', 10, 't'), 0);    // 자기 이체 금지
  assert.equal(l.transfer('a', 'x', 10, 't'), 0);    // 미존재 풀
  assert.equal(l.totalSum(), 150);
});

test('잔고가 남은 풀은 소멸할 수 없다 (에너지 소멸 금지)', () => {
  const l = new EnergyLedger();
  l.createPool('a', 10, 10);
  assert.throws(() => l.removePool('a'));
  l.createPool('sink', 0, 100);
  l.transfer('a', 'sink', 10, 't');
  l.removePool('a'); // 잔고 0 → 허용
  assert.equal(l.get('a'), undefined);
});

test('무작위 이체 폭풍에서도 총합·지역 합계 불변식 유지', () => {
  const rng = mulberry32(42);
  const l = new EnergyLedger();
  const ids = [];
  let genesis = 0;
  for (let i = 0; i < 50; i++) {
    const balance = randInt(rng, 0, 500);
    const region = rng() < 0.7 ? `r${randInt(rng, 0, 4)}` : null;
    l.createPool(`p${i}`, balance, balance + randInt(rng, 0, 500), region);
    ids.push(`p${i}`);
    genesis += balance;
  }

  for (let i = 0; i < 5000; i++) {
    const from = ids[randInt(rng, 0, ids.length - 1)];
    const to = ids[randInt(rng, 0, ids.length - 1)];
    l.transfer(from, to, randInt(rng, 1, 200), 'fuzz');
    if (rng() < 0.05) { // 무작위 지역 이주도 섞는다
      l.setRegion(ids[randInt(rng, 0, ids.length - 1)],
                  rng() < 0.5 ? null : `r${randInt(rng, 0, 4)}`);
    }
  }

  assert.equal(l.totalSum(), genesis, '총합 보존');
  const brute = bruteRegionSums(l);
  for (const [key, sum] of brute) {
    assert.equal(l.regionSum(key), sum, `지역 ${key} 증분 합계 = 실측 합계`);
  }
});

test('미러 연산(mirrorSet/forget)도 지역 합계를 정확히 유지한다', () => {
  const l = new EnergyLedger();
  l.mirrorSet('a', 100, 200, 'r1');
  l.mirrorSet('b', 50, 100, 'r1');
  assert.equal(l.regionSum('r1'), 150);

  l.mirrorSet('a', 70, 200, 'r2');  // 지역 이동 + 잔고 갱신
  assert.equal(l.regionSum('r1'), 50);
  assert.equal(l.regionSum('r2'), 70);

  l.forget('b');                     // 관측 중단
  assert.equal(l.regionSum('r1'), 0);
  assert.equal(l.get('b'), undefined);

  const brute = bruteRegionSums(l);
  for (const [key, sum] of brute) assert.equal(l.regionSum(key), sum);
});
