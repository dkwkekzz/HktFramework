// V-010 — 새로 온 것에 표식이 붙었다가 상세를 보면 사라진다 (UX 문서 §3).
//
// 이 파일이 지는 짐은 하나다: **처음 본 것과 새로 온 것은 다르다.**
// 세계에 이어 붙는 순간 가방에 있던 것을 전부 새 것으로 세우면, 표식은 "방금 얻었다"
// 가 아니라 "가방에 무언가 있다" 가 되고 그러면 아무 말도 하지 않는 것과 같다.

import { beforeEach, describe, expect, it } from 'vitest';
import { freshKinds, isFresh, markSeen, noteObserved, resetFresh } from '../inventory-new';

beforeEach(() => resetFresh());

describe('첫 관찰은 기준선이다', () => {
  it('이어 붙는 순간 지니고 있던 것은 새 것이 아니다', () => {
    noteObserved(['stone', 'pickaxe']);
    expect(freshKinds()).toEqual([]);
  });

  it('그 뒤에 온 것이 새 것이다', () => {
    noteObserved(['pickaxe']);
    noteObserved(['pickaxe', 'stone']);
    expect(isFresh('stone')).toBe(true);
    expect(isFresh('pickaxe')).toBe(false);
  });
});

describe('표식이 사라지는 자리', () => {
  it('상세를 보면 사라진다', () => {
    noteObserved([]);
    noteObserved(['stone']);
    expect(isFresh('stone')).toBe(true);
    markSeen('stone');
    expect(isFresh('stone')).toBe(false);
  });

  it('한 번 본 것은 다시 붙지 않는다 — 관찰이 계속 와도 그대로다', () => {
    noteObserved([]);
    noteObserved(['stone']);
    markSeen('stone');
    noteObserved(['stone']);
    noteObserved(['stone']);
    expect(isFresh('stone')).toBe(false);
  });
});

describe('가방을 떠난 것', () => {
  it('다시 얻으면 그때가 새로 온 때다 — 잊지 않으면 두 번째 획득이 조용하다', () => {
    noteObserved([]);
    noteObserved(['stone']);
    markSeen('stone');
    noteObserved([]); // 전부 덜어냈다
    noteObserved(['stone']); // 다시 캤다
    expect(isFresh('stone')).toBe(true);
  });

  it('떠난 것의 표식은 함께 사라진다 — 없는 것에 붙은 표식은 아무 데도 없다', () => {
    noteObserved([]);
    noteObserved(['stone']);
    expect(isFresh('stone')).toBe(true);
    noteObserved([]);
    expect(freshKinds()).toEqual([]);
  });
});

describe('여럿이 함께 와도 각자 센다', () => {
  it('한 관찰에 둘이 늘면 둘 다 표식을 얻는다', () => {
    noteObserved(['pickaxe']);
    noteObserved(['pickaxe', 'stone', 'buckler']);
    expect(freshKinds().sort()).toEqual(['buckler', 'stone']);
    markSeen('stone');
    expect(freshKinds()).toEqual(['buckler']);
  });
});
