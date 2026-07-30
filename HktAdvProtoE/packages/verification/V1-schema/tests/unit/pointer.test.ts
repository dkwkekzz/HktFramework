import { describe, expect, it } from 'vitest';
import { display, escapeToken, join, parse, resolve, unescapeToken } from '../../src/pointer.js';

describe('JSON Pointer', () => {
  it('토큰의 ~ 와 / 를 이스케이프한다', () => {
    expect(escapeToken('a/b')).toBe('a~1b');
    expect(escapeToken('m~n')).toBe('m~0n');
    expect(unescapeToken('a~1b')).toBe('a/b');
    expect(unescapeToken('m~0n')).toBe('m~n');
  });

  it('이스케이프 왕복이 값을 보존한다', () => {
    for (const token of ['a', 'a/b', '~', '~0', '~1', 'x/~/y', '한글', '']) {
      expect(unescapeToken(escapeToken(token))).toBe(token);
    }
  });

  it('경로를 잇는다', () => {
    expect(join('', 'entities')).toBe('/entities');
    expect(join('/entities', 1)).toBe('/entities/1');
    expect(join('/a', 'b/c')).toBe('/a/b~1c');
  });

  it('경로를 토큰으로 나눈다', () => {
    expect(parse('')).toEqual([]);
    expect(parse('/entities/1/energy')).toEqual(['entities', '1', 'energy']);
    expect(parse('/a~1b')).toEqual(['a/b']);
    expect(() => parse('entities')).toThrow();
  });

  it('경로가 가리키는 값을 꺼낸다', () => {
    const data = { entities: [{ energy: 10 }, { energy: 20 }], 'a/b': 1 };
    expect(resolve(data, '')).toBe(data);
    expect(resolve(data, '/entities/1/energy')).toBe(20);
    expect(resolve(data, '/a~1b')).toBe(1);
    expect(resolve(data, '/entities/9')).toBeUndefined();
    expect(resolve(data, '/nope/deep')).toBeUndefined();
  });

  it('루트는 / 로 표시한다', () => {
    expect(display('')).toBe('/');
    expect(display('/a')).toBe('/a');
  });
});
