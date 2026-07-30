import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex, sha256Tagged } from '../../src/sha256.js';

/** 자체 SHA-256 구현이 표준과 일치함을 node:crypto 로 교차 검증한다. */
describe('sha256', () => {
  const cases = [
    '',
    'a',
    'abc',
    'hkt-adv-proto-e',
    '한국어 문자열 · 멀티바이트',
    'x'.repeat(55),
    'x'.repeat(56),
    'x'.repeat(57),
    'x'.repeat(63),
    'x'.repeat(64),
    'x'.repeat(65),
    'y'.repeat(1000),
  ];

  it.each(cases)('node:crypto 와 같은 결과 (길이 %#)', (input) => {
    expect(sha256Hex(input)).toBe(createHash('sha256').update(input, 'utf8').digest('hex'));
  });

  it('증거 표기는 sha256: 접두를 붙인다', () => {
    expect(sha256Tagged('abc')).toBe(`sha256:${sha256Hex('abc')}`);
  });

  it('같은 입력은 항상 같은 해시', () => {
    const hashes = new Set(Array.from({ length: 100 }, () => sha256Hex('determinism')));
    expect(hashes.size).toBe(1);
  });
});
