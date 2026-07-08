// ============================================================================
// 프로토콜 바이너리 tx 인코딩 테스트 — A4
//
// 핵심 주장: tx-only OPS 프레임이 16B/tx 바이너리로 무손실 라운드트립되고,
// 이벤트/문자열 iid 는 JSON 으로 폴백한다. 그리고 JSON 대비 대역폭이 준다.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, encodeOps, decode, MSG } from '../shared/protocol.js';

test('tx-only 프레임은 16B 바이너리로 무손실 라운드트립', () => {
  const ops = [
    { op: 'tx', seq: 1, from: 'F:0_4', to: 'N:0', amount: 40, cause: 'regen' },        // iid 없음
    { op: 'tx', seq: 2, from: 'N:0', to: 'P:1', amount: 25, cause: 'gather', iid: 7 },  // 숫자 iid
    { op: 'tx', seq: 3, from: 'P:1', to: 'W:SINK', amount: 5, cause: 'atk-cost', iid: 8 },
    { op: 'tx', seq: 4, from: 'P:2', to: 'P:1', amount: 15, cause: 'leech', iid: 8 },
    { op: 'tx', seq: 5, from: 'P:2', to: 'W:SINK', amount: 15, cause: 'burn' },
    { op: 'tx', seq: 6, from: 'W:SRC', to: 'F:3_7', amount: 40, cause: 'regen' },
    { op: 'tx', seq: 7, from: 'I:3', to: 'W:SINK', amount: 5, cause: 'wear' },
  ];
  const frame = encodeOps(42, ops);
  assert.ok(frame instanceof Uint8Array, '바이너리 프레임');
  assert.equal(frame.byteLength, 8 + ops.length * 16, '헤더 8B + 16B/tx');

  const back = decode(frame);
  assert.equal(back.t, MSG.OPS);
  assert.equal(back.tick, 42);
  assert.equal(back.ops.length, ops.length);
  for (let i = 0; i < ops.length; i++) {
    const a = ops[i], b = back.ops[i];
    assert.equal(b.op, 'tx');
    assert.equal(b.from, a.from, `from[${i}]`);
    assert.equal(b.to, a.to, `to[${i}]`);
    assert.equal(b.amount, a.amount, `amount[${i}]`);
    assert.equal(b.cause, a.cause, `cause[${i}]`);
    assert.equal(b.iid ?? undefined, a.iid ?? undefined, `iid[${i}]`); // seq·at 는 의도적 생략
  }
});

test('이벤트·문자열 iid 는 JSON 으로 폴백 (인과 순서·하위호환)', () => {
  const withEvent = encodeOps(1, [
    { op: 'tx', from: 'N:0', to: 'P:1', amount: 25, cause: 'gather', iid: 1 },
    { op: 'event', kind: 'death', id: 'M:2' },
  ]);
  assert.equal(typeof withEvent, 'string', '이벤트 포함 → JSON');
  assert.equal(decode(withEvent).ops.length, 2);

  const strIid = encodeOps(1, [{ op: 'tx', from: 'N:0', to: 'P:1', amount: 25, cause: 'gather', iid: 'g0' }]);
  assert.equal(typeof strIid, 'string', '문자열 iid → JSON');
});

test('바이너리 tx 는 JSON 대비 대역폭을 줄인다 (실측)', () => {
  const N = 200;
  const ops = [];
  for (let i = 0; i < N; i++) {
    // A4 이전 실제 전송 형태: seq·at·iid 포함 tx
    ops.push({ op: 'tx', seq: i + 1, from: 'N:0', to: `P:${(i % 8) + 1}`, amount: 25, cause: 'gather', iid: (i % 100) + 1, at: { x: 222, y: 1020 } });
  }
  const bin = encodeOps(1, ops);
  const json = encode(MSG.OPS, { tick: 1, ops }); // A4 이전 JSON 경로 (seq·at 포함)
  const binPerTx = bin.byteLength / N;
  const jsonPerTx = json.length / N;
  const cut = (1 - bin.byteLength / json.length) * 100;
  console.log(`    [A4] ${N} tx — JSON ${json.length}B(${jsonPerTx.toFixed(1)}/tx) → 바이너리 ${bin.byteLength}B(${binPerTx.toFixed(1)}/tx) · 절감 ${cut.toFixed(0)}%`);
  assert.equal(bin.byteLength, 8 + N * 16);
  assert.ok(bin.byteLength < json.length, '바이너리가 더 작다');
  assert.ok(cut > 50, '절반 이상 절감');
});
