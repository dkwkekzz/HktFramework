// C039 — 성질은 물음의 답이다: 합성기(property.ts).
//
// 이 파일은 **게임을 모른다** — 어떤 몸도 어떤 성질 이름도 여기서 지어 준다 (`p` · `q` · `o1`).
// 합성기가 이름 하나로 Source 들을 모아 몫 셋(상한 · 더함 · 참거짓)만으로 답하는가,
// 답할 Source 가 없을 때 「0」이나 「거짓」으로 눌리지 않는가, 같은 입력이 언제나 같은 답인가 —
// 그것이 이 기구의 규율이고 그것을 재는 자리가 여기다.

import { describe, expect, it } from 'vitest';
import {
  PROPERTY_SHARE_KINDS,
  propertySourcesOf,
  resolveProperty,
  type PropertySource,
} from '../property';

/** Source 하나 — origin 은 기계가 읽는 코드일 뿐이다 */
function cap(property: string, value: number, origin = 'o'): PropertySource {
  return { origin, property, share: { kind: 'cap', value } };
}
function add(property: string, value: number, origin = 'o'): PropertySource {
  return { origin, property, share: { kind: 'add', value } };
}
function flag(property: string, value: boolean, origin = 'o'): PropertySource {
  return { origin, property, share: { kind: 'flag', value } };
}

describe('PROPERTY_SHARE_KINDS — 몫은 셋뿐이다', () => {
  it('상한 · 더함 · 참거짓 — 곱은 없다', () => {
    expect(PROPERTY_SHARE_KINDS).toEqual(['cap', 'add', 'flag']);
  });
});

describe('propertySourcesOf — 그 성질에 답하는 Source 들', () => {
  it('이름이 같은 것만 · 적힌 차례 그대로', () => {
    const sources = [add('p', 1, 'a'), add('q', 9, 'b'), cap('p', 5, 'c')];
    expect(propertySourcesOf('p', sources).map((one) => one.origin)).toEqual(['a', 'c']);
    expect(propertySourcesOf('q', sources).map((one) => one.origin)).toEqual(['b']);
  });

  it('아무도 답하지 않으면 빈 목록이다', () => {
    expect(propertySourcesOf('z', [add('p', 1)])).toEqual([]);
  });
});

describe('resolveProperty — 없는 것과 모르는 것', () => {
  it('답할 Source 가 하나도 없으면 없음이다 — 「0」도 「거짓」도 아니다', () => {
    expect(resolveProperty('p', [])).toBeUndefined();
    expect(resolveProperty('p', [add('q', 3), flag('q', true)])).toBeUndefined();
  });
});

describe('resolveProperty — 수의 몫', () => {
  it('add 들은 합이다', () => {
    expect(resolveProperty('p', [add('p', 200), add('p', 50)])).toBe(250);
  });

  it('cap 둘이면 작은 쪽이 이긴다', () => {
    expect(resolveProperty('p', [cap('p', 20), cap('p', 10)])).toBe(10);
    expect(resolveProperty('p', [cap('p', 10), cap('p', 20)])).toBe(10);
  });

  it('cap 만 있고 add 가 없으면 그 cap 이다', () => {
    expect(resolveProperty('p', [cap('p', 9)])).toBe(9);
  });

  it('cap 이 무제한 하나뿐이면 답도 무제한이다', () => {
    expect(resolveProperty('p', [cap('p', Number.POSITIVE_INFINITY)])).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('add 와 cap 이 함께면 합에 상한이 씌워진다', () => {
    expect(resolveProperty('p', [add('p', 30), cap('p', 10)])).toBe(10);
    expect(resolveProperty('p', [add('p', 30), cap('p', 50)])).toBe(30);
    expect(resolveProperty('p', [add('p', 30), add('p', 30), cap('p', 50), cap('p', 40)])).toBe(40);
  });
});

describe('resolveProperty — 참거짓의 몫', () => {
  it('하나라도 참이면 참이다', () => {
    expect(resolveProperty('p', [flag('p', false), flag('p', true)])).toBe(true);
  });

  it('전부 거짓이면 거짓이다 — 없음이 아니다', () => {
    expect(resolveProperty('p', [flag('p', false)])).toBe(false);
    expect(resolveProperty('p', [flag('p', false), flag('p', false)])).toBe(false);
  });
});

describe('resolveProperty — 한 이름에 형이 섞이면 수가 이긴다', () => {
  it('flag 는 수가 있는 성질에 답하지 않는다', () => {
    expect(resolveProperty('p', [flag('p', true), add('p', 7)])).toBe(7);
    expect(resolveProperty('p', [flag('p', true), cap('p', 7)])).toBe(7);
    expect(resolveProperty('p', [add('p', 7), flag('p', false)])).toBe(7);
  });
});

describe('resolveProperty — 결정론', () => {
  it('같은 이름 · 같은 목록이면 두 번 물어도 같은 답이다', () => {
    const sources = [add('p', 200), add('p', 50), cap('p', 220), flag('q', true)];
    expect(resolveProperty('p', sources)).toBe(resolveProperty('p', sources));
    expect(resolveProperty('p', sources)).toBe(220);
    // 아무것도 저장하지 않는다 — 목록 자체도 그대로다
    expect(sources.length).toBe(4);
    expect(resolveProperty('q', sources)).toBe(true);
  });
});
