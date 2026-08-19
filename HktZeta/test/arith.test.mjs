import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  factorize, mobius, omegaDistinct, omegaTotal, liouville, leastPrimeFactor,
} from '../core/arith.mjs';

test('factorize: 알려진 값', () => {
  assert.deepEqual(factorize(1), []);
  assert.deepEqual(factorize(2), [[2, 1]]);
  assert.deepEqual(factorize(12), [[2, 2], [3, 1]]);
  assert.deepEqual(factorize(97), [[97, 1]]); // 소수
});

test('factorize: 양의 정수만 허용', () => {
  assert.throws(() => factorize(0));
  assert.throws(() => factorize(-3));
  assert.throws(() => factorize(2.5));
});

test('mobius: 뫼비우스 함수 스팟 체크', () => {
  assert.equal(mobius(1), 1);
  assert.equal(mobius(2), -1);   // 소수 1개
  assert.equal(mobius(4), 0);    // 제곱인수
  assert.equal(mobius(6), 1);    // 소수 2개
  assert.equal(mobius(30), -1);  // 소수 3개
  assert.equal(mobius(12), 0);   // 2² 포함
});

test('omega 계열', () => {
  assert.equal(omegaDistinct(12), 2); // {2,3}
  assert.equal(omegaTotal(12), 3);    // 2·2·3
  assert.equal(omegaDistinct(1), 0);
  assert.equal(omegaTotal(1), 0);
});

test('liouville: λ(n)=(-1)^Ω(n)', () => {
  assert.equal(liouville(1), 1);
  assert.equal(liouville(2), -1);
  assert.equal(liouville(4), 1);  // Ω=2
  assert.equal(liouville(12), -1); // Ω=3
});

test('leastPrimeFactor', () => {
  assert.equal(leastPrimeFactor(1), 1);
  assert.equal(leastPrimeFactor(15), 3);
  assert.equal(leastPrimeFactor(1024), 2);
});
