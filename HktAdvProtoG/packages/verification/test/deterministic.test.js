import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SeededRandom, createIdGenerator, stableSort, canonicalize, stateHash, runTicks, firstDivergence,
} from '../src/deterministic.js';

test('같은 시드는 같은 난수열을 낸다', () => {
  const a = new SeededRandom(42);
  const b = new SeededRandom(42);
  const seqA = Array.from({ length: 20 }, () => a.int(1000));
  const seqB = Array.from({ length: 20 }, () => b.int(1000));
  assert.deepEqual(seqA, seqB);
});

test('다른 시드는 다른 난수열을 낸다', () => {
  const a = new SeededRandom(1);
  const b = new SeededRandom(2);
  const seqA = Array.from({ length: 20 }, () => a.int(1000));
  const seqB = Array.from({ length: 20 }, () => b.int(1000));
  assert.notDeepEqual(seqA, seqB);
});

test('정수가 아닌 시드는 거부한다 (실패 경로)', () => {
  assert.throws(() => new SeededRandom(0.5));
});

test('상태 해시는 키 순서와 무관하다', () => {
  assert.equal(stateHash({ a: 1, b: [{ x: 1, y: 2 }] }), stateHash({ b: [{ y: 2, x: 1 }], a: 1 }));
});

test('상태 해시는 값 차이를 구분한다', () => {
  assert.notEqual(stateHash({ a: 1 }), stateHash({ a: 2 }));
});

test('직렬화 불가 수치는 거부한다 (실패 경로)', () => {
  assert.throws(() => canonicalize({ a: Infinity }));
});

test('stableSort 는 동률의 원래 순서를 보존한다', () => {
  const arr = [{ k: 1, tag: 'a' }, { k: 0, tag: 'b' }, { k: 1, tag: 'c' }];
  const sorted = stableSort(arr, (x, y) => x.k - y.k);
  assert.deepEqual(sorted.map((v) => v.tag), ['b', 'a', 'c']);
});

test('ID 생성기는 결정적 순차 ID 를 낸다', () => {
  const gen = createIdGenerator('ev');
  assert.equal(gen(), 'ev-000001');
  assert.equal(gen(), 'ev-000002');
});

test('runTicks 는 같은 입력에서 같은 해시 궤적을 낸다', () => {
  const tickFn = (s, t) => ({ n: s.n + t });
  const a = runTicks({ n: 0 }, tickFn, 5);
  const b = runTicks({ n: 0 }, tickFn, 5);
  assert.deepEqual(a.trail, b.trail);
  assert.equal(a.state.n, 15);
});

test('firstDivergence 는 최초 차이 지점을 찾는다', () => {
  assert.equal(firstDivergence(['h0', 'h1', 'h2'], ['h0', 'h1', 'h2']), -1);
  assert.equal(firstDivergence(['h0', 'h1', 'h2'], ['h0', 'hX', 'h2']), 1);
  assert.equal(firstDivergence(['h0'], ['h0', 'h1']), 1);
});
