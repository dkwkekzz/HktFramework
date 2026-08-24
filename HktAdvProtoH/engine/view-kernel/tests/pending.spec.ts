// 기다리는 요청 — 보낸 것과 돌아온 대답을 짚어 맞춘다.
//
// 이 표가 지키는 것: 보내지 못한 것은 기다리지 않는다 · 대답 하나가 요청 하나를 푼다 ·
// 표식 없는 대답도 버려지지 않는다. 셋 중 하나라도 어긋나면 영영 풀리지 않는
// 기다림이 화면에 남고, 그 자리는 다시 눌러도 아무 일이 일어나지 않게 된다.

import { describe, expect, it } from 'vitest';
import { createPendingRequests } from '../net/pending';

describe('createPendingRequests', () => {
  it('처음에는 아무것도 기다리지 않는다', () => {
    const pending = createPendingRequests<string>();
    expect(pending.size()).toBe(0);
    expect(pending.values()).toEqual([]);
  });

  it('보내지 못한 요청은 기다림에 오르지 않는다 — 영영 풀리지 않을 자리다', () => {
    const pending = createPendingRequests<string>();
    expect(pending.add(null, 'stone')).toBe(false);
    expect(pending.add(undefined, 'stone')).toBe(false);
    expect(pending.size()).toBe(0);
  });

  it('보낸 요청은 표식으로 기다림에 오른다', () => {
    const pending = createPendingRequests<string>();
    expect(pending.add(7, 'stone')).toBe(true);
    expect(pending.size()).toBe(1);
    expect(pending.values()).toEqual(['stone']);
  });

  it('대답이 그 요청을 짚어 푼다', () => {
    const pending = createPendingRequests<string>();
    pending.add(1, 'stone');
    pending.add(2, 'pickaxe');
    expect(pending.resolve(2)).toBe('pickaxe');
    expect(pending.size()).toBe(1);
    expect(pending.values()).toEqual(['stone']);
  });

  it('모르는 표식의 대답은 아무것도 풀지 않는다', () => {
    const pending = createPendingRequests<string>();
    pending.add(1, 'stone');
    expect(pending.resolve(99)).toBeUndefined();
    expect(pending.size()).toBe(1);
  });

  it('표식 없는 대답은 가장 오래 기다린 것에 붙는다 — 버리면 그 자리는 영영 기다린다', () => {
    const pending = createPendingRequests<string>();
    pending.add(1, 'stone');
    pending.add(2, 'pickaxe');
    expect(pending.resolve(undefined)).toBe('stone');
    expect(pending.values()).toEqual(['pickaxe']);
  });

  it('기다릴 것이 없을 때 온 대답은 아무 일도 만들지 않는다', () => {
    const pending = createPendingRequests<string>();
    expect(pending.resolve(undefined)).toBeUndefined();
  });

  it('같은 것을 지금 기다리는 중인지 물을 수 있다 — 두 번 보내지 않기 위한 물음이다', () => {
    const pending = createPendingRequests<{ kind: string }>();
    pending.add(1, { kind: 'stone' });
    expect(pending.waiting((v) => v.kind === 'stone')).toBe(true);
    expect(pending.waiting((v) => v.kind === 'pickaxe')).toBe(false);
    pending.resolve(1);
    expect(pending.waiting((v) => v.kind === 'stone')).toBe(false);
  });

  it('같은 표식으로 다시 올리면 앞의 것을 대신한다 — 표식은 요청 하나에 하나다', () => {
    const pending = createPendingRequests<string>();
    pending.add(1, 'stone');
    pending.add(1, 'pickaxe');
    expect(pending.size()).toBe(1);
    expect(pending.resolve(1)).toBe('pickaxe');
  });

  it('전부 잊을 수 있다 — 대답이 영영 오지 않게 된 자리', () => {
    const pending = createPendingRequests<string>();
    pending.add(1, 'stone');
    pending.clear();
    expect(pending.size()).toBe(0);
  });
});
