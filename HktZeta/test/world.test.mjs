import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedWorld, step, run, hashState } from '../core/world.mjs';

test('결정론: 같은 seed → 완전히 같은 궤적 지문', () => {
  const a = run(42, 300, 8);
  const b = run(42, 300, 8);
  assert.equal(hashState(a), hashState(b));
});

test('다른 seed 는 다른 세계를 만든다', () => {
  const a = hashState(run(42, 300, 8));
  const b = hashState(run(43, 300, 8));
  assert.notEqual(a, b);
});

test('창발: 세계는 죽어있지 않다 — 이동·성장·개체수 변화가 관측된다', () => {
  const s = run(7, 500, 8);

  // 이동: 원점에 머무는 존재가 전부는 아니다.
  const moved = s.beings.filter((b) => b.x !== 0 || b.y !== 0).length;
  assert.ok(moved > 0, '아무도 움직이지 않았다 — 궤적이 죽어있다');

  // 공간 다양성: 서로 다른 위치가 여럿이다.
  const cells = new Set(s.beings.map((b) => `${b.x},${b.y}`));
  assert.ok(cells.size > 1, '모든 존재가 한 점에 겹쳐있다');

  // 성장/분열: 개체수가 초기(8)에서 변했다.
  assert.notEqual(s.beings.length, 8);
});

test('순수성: step 은 입력 상태를 변형하지 않는다', () => {
  const s0 = seedWorld(1, 4);
  const snapshot = hashState(s0);
  step(s0);
  assert.equal(hashState(s0), snapshot, 'step 이 이전 상태를 오염시켰다');
});
