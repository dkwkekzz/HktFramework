import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, stepMotion, ACT, ACT_CHANNELS } from '../core/oracle.mjs';

test('오라클은 순수하다 — (a,t) 만으로 결정되고 재현된다', () => {
  const a = decide(12345, 7);
  const b = decide(12345, 7);
  assert.deepEqual(a, b);
});

test('결정의 형태 불변식', () => {
  for (let t = 0; t < 200; t++) {
    const d = decide(101, t);
    assert.ok([-1, 0, 1].includes(d.turn), `turn ∈ {-1,0,1} (t=${t})`);
    assert.ok(d.act >= 0 && d.act < ACT_CHANNELS, `act 채널 범위 (t=${t})`);
    assert.ok(Number.isInteger(d.mag) && d.mag >= 1, `mag ≥ 1 (t=${t})`);
  }
});

test('서로 다른 주소는 서로 다른 궤도를 밟는다(대개)', () => {
  let differ = 0;
  for (let t = 0; t < 100; t++) {
    if (decide(1, t).n !== decide(2, t).n) differ++;
  }
  assert.ok(differ > 90, `주소 분리: 100틱 중 ${differ}틱에서 결정 색인이 달랐다`);
});

test('stepMotion: MOVE 만 전진하고 heading 은 순환한다', () => {
  const m = stepMotion(0, { turn: 1, act: ACT.MOVE, mag: 3 });
  assert.equal(m.heading, 1);
  assert.ok(m.dx !== 0 || m.dy !== 0);

  const w = stepMotion(0, { turn: 0, act: ACT.WAIT, mag: 3 });
  assert.equal(w.dx, 0);
  assert.equal(w.dy, 0);

  const wrap = stepMotion(7, { turn: 1, act: ACT.MOVE, mag: 1 });
  assert.equal(wrap.heading, 0); // 7 → 0 순환
});
