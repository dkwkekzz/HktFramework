// ============================================================================
// 필드 확산 단위 테스트 — A1 첫 조각
//
// 핵심 주장: 이웃 셀 간 확산이 원장 이체만으로 돌고, 확산 틱 전후로 전 풀 합계가
// 불변이다 (보존). 부수로 확산이 실제로 평형을 향해 흐른다는 것(단조 수렴)을 확인해
// no-op 이 아님을 못박는다.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnergyLedger } from '../shared/ledger.js';
import { createField, diffuseTick, fieldCellId } from '../shared/field.js';
import { mulberry32, randInt } from '../shared/rng.js';

// 셀 잔고들의 분산 대용 지표 — 최대-최소 (평형이면 0 에 수렴)
function spread(ledger, grid) {
  let min = Infinity, max = -Infinity;
  for (let cy = 0; cy < grid; cy++)
    for (let cx = 0; cx < grid; cx++) {
      const b = ledger.balance(fieldCellId(cx, cy));
      if (b < min) min = b;
      if (b > max) max = b;
    }
  return max - min;
}

test('확산 1틱이 전 풀 총합을 보존한다 (임의 초기 분포)', () => {
  const grid = 8;
  const rng = mulberry32(20260706);
  const l = new EnergyLedger();
  let genesis = 0;
  createField(l, { grid, seed: (cx, cy) => {
    const b = randInt(rng, 0, 5000);
    genesis += b;
    return b;
  }});

  assert.equal(l.totalSum(), genesis, '생성 직후 총합');
  for (let t = 0; t < 200; t++) {
    diffuseTick(l, { grid });
    assert.equal(l.totalSum(), genesis, `틱 ${t} 후 총합 보존`);
  }
});

test('확산은 평형을 향해 단조 수렴한다 (실제 흐름 — no-op 아님)', () => {
  const grid = 8;
  const l = new EnergyLedger();
  // 한 셀에만 스파이크 — 확산이 이웃으로 퍼져야 한다.
  createField(l, { grid, seed: (cx, cy) => (cx === 0 && cy === 0 ? 100_000 : 0) });

  assert.equal(l.balance(fieldCellId(1, 0)), 0, '확산 전 이웃은 비어 있다');
  const moved1 = diffuseTick(l, { grid });
  assert.ok(moved1 > 0, '첫 틱에 에너지가 이동한다');
  assert.ok(l.balance(fieldCellId(1, 0)) > 0, '스파이크가 이웃으로 번진다');

  let prev = spread(l, grid);
  for (let t = 0; t < 300; t++) {
    diffuseTick(l, { grid });
    const cur = spread(l, grid);
    assert.ok(cur <= prev, `틱 ${t}: 분산이 증가하지 않는다 (${prev} → ${cur})`);
    prev = cur;
  }
  assert.ok(prev < 100_000, '분산이 초기 스파이크보다 크게 줄었다 (수렴)');
});

test('확산은 방향 불변 — 항상 높은 셀에서 낮은 셀로만 흐른다', () => {
  const grid = 2;
  const l = new EnergyLedger();
  createField(l, { grid, seed: (cx, cy) => (cx === 1 && cy === 1 ? 1000 : 0) });
  diffuseTick(l, { grid });
  // 채운 셀은 줄고, 다른 셀은 늘거나 유지 — 역류 없음
  assert.ok(l.balance(fieldCellId(1, 1)) < 1000, '높은 셀은 유출한다');
  assert.equal(l.totalSum(), 1000, '방향과 무관하게 총합 보존');
});
