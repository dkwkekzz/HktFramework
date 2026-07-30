import { describe, expect, it } from 'vitest';
import { deepClone, deepFreeze, diffStates, readPath, writePath } from '../../src/json.js';
import type { JsonObject } from '../../src/types.js';

describe('상태 다루기', () => {
  const base: JsonObject = { actor: { id: 'a', energy: 10 }, log: [] };

  it('deepClone 은 원본과 끊어진 값을 준다', () => {
    const copy = deepClone(base);
    (copy['actor'] as JsonObject)['energy'] = 0;
    expect((base['actor'] as JsonObject)['energy']).toBe(10);
  });

  it('deepClone 은 키 순서를 정렬해 같은 내용이면 같은 문자열이 되게 한다', () => {
    expect(JSON.stringify(deepClone({ b: 1, a: 2 } as JsonObject))).toBe(
      JSON.stringify(deepClone({ a: 2, b: 1 } as JsonObject)),
    );
  });

  it('deepFreeze 는 중첩 값까지 얼린다', () => {
    const frozen = deepFreeze(deepClone(base));
    expect(Object.isFrozen(frozen['actor'])).toBe(true);
    expect(() => {
      (frozen['actor'] as JsonObject)['energy'] = 0;
    }).toThrow(TypeError);
  });

  it('writePath 는 원본을 두고 새 상태를 돌려준다', () => {
    const frozen = deepFreeze(deepClone(base));
    const next = writePath(frozen, '/actor/energy', 7);
    expect(readPath(next, '/actor/energy')).toBe(7);
    expect(readPath(frozen, '/actor/energy')).toBe(10);
  });

  it('writePath 는 없는 중간 경로를 만든다', () => {
    expect(readPath(writePath(base, '/belief/hunger', 3), '/belief/hunger')).toBe(3);
  });

  it('writePath 의 `-` 는 배열 끝에 붙인다', () => {
    const next = writePath(base, '/log/-', 'first');
    expect(readPath(next, '/log')).toEqual(['first']);
  });

  it('writePath 는 범위를 벗어난 배열 인덱스를 거부한다', () => {
    expect(() => writePath(base, '/log/5', 'x')).toThrow(RangeError);
  });

  describe('diffStates', () => {
    it('바뀐 잎만 경로로 모은다', () => {
      const after = writePath(base, '/actor/energy', 7);
      expect(diffStates(base, after)).toEqual([
        { path: '/actor/energy', kind: 'changed', before: 10, after: 7 },
      ]);
    });

    it('추가·삭제를 구분한다', () => {
      const added = writePath(base, '/actor/posture', 'idle');
      expect(diffStates(base, added)).toEqual([
        { path: '/actor/posture', kind: 'added', before: null, after: 'idle' },
      ]);
      expect(diffStates(added, base)).toEqual([
        { path: '/actor/posture', kind: 'removed', before: 'idle', after: null },
      ]);
    });

    it('같은 상태면 변화가 없다', () => {
      expect(diffStates(base, deepClone(base))).toEqual([]);
    });

    it('배열 원소를 인덱스 경로로 지목한다', () => {
      const after = writePath(base, '/log/-', { kind: 'acted' });
      expect(diffStates(base, after).map((change) => change.path)).toEqual(['/log/0']);
    });

    it('경로 토큰의 `/` 와 `~` 를 이스케이프한다', () => {
      const before: JsonObject = { 'a/b': 1 };
      const after: JsonObject = { 'a/b': 2 };
      expect(diffStates(before, after)[0]?.path).toBe('/a~1b');
    });
  });
});
