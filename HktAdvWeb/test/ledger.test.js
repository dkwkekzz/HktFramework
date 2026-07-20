// A3 — 에너지 원장
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../src/substrate/ledger.js';

test('개설·이체·잔고가 정합하고 총량이 보존된다', () => {
  const L = new Ledger();
  L.open('a', 100);
  L.open('b', 0);
  L.transfer('a', 'b', 30, '거래 대금');
  assert.equal(L.balance('a'), 70);
  assert.equal(L.balance('b'), 30);
  assert.equal(L.audit().ok, true);
});

test('무작위 이체 N회 후에도 audit() 가 성립한다 (보존 불변식)', () => {
  const L = new Ledger();
  const ids = ['a', 'b', 'c', 'd'];
  for (const id of ids) L.open(id, 50);
  // 결정론적 의사난수 (Math.random 회피 — 재현성)
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 200; i++) {
    const from = ids[Math.floor(rnd() * ids.length)];
    const to = ids[Math.floor(rnd() * ids.length)];
    if (from === to) continue;
    const amt = Math.floor(rnd() * 10) + 1;
    try { L.transfer(from, to, amt, `이체#${i}`); } catch { /* 잔고 부족은 정상 거부 */ }
  }
  const a = L.audit();
  assert.equal(a.ok, true);
  assert.equal(a.minted, 200); // 4계좌 × 50
});

test('음수·0·무사유 이체는 거부된다', () => {
  const L = new Ledger();
  L.open('a', 10);
  L.open('b', 0);
  assert.throws(() => L.transfer('a', 'b', -5, 'x'), /0보다 커야/);
  assert.throws(() => L.transfer('a', 'b', 0, 'x'), /0보다 커야/);
  assert.throws(() => L.transfer('a', 'b', 5), /사유/); // cause 누락
});

test('잔고 부족 이체는 거부된다', () => {
  const L = new Ledger();
  L.open('a', 3);
  L.open('b', 0);
  assert.throws(() => L.transfer('a', 'b', 5, '과다'), /잔고 부족/);
});

test('mint/burn 은 세계 경계 사유로만, 총량 감사에 반영된다', () => {
  const L = new Ledger();
  L.open('a', 100);
  L.mint('a', 20, '재앙 유출');
  assert.equal(L.balance('a'), 120);
  L.burn('a', 50, '소멸');
  assert.equal(L.balance('a'), 70);
  const au = L.audit();
  assert.equal(au.ok, true);
  assert.equal(au.minted, 120);
  assert.equal(au.burned, 50);
  assert.throws(() => L.mint('a', 5), /사유/);
});
