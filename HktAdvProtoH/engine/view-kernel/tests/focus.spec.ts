// 초점 이동 — 나란한 것들 사이를 자판으로 오가는 산수.
//
// 이 검사가 지키는 것은 셋이다. 사라진 자리를 붙들지 않는다 · 옆으로는 감긴다 ·
// 위아래로는 감기지 않는다. 마지막 하나가 가장 안 읽히는 성질이라 따로 검사한다.

import { describe, expect, it } from 'vitest';
import { moveFocus, moveFocusGrid } from '../input/focus';

const IDS = ['a', 'b', 'c', 'd'];

describe('moveFocus — 한 줄 사이의 이동', () => {
  it('빈 목록에는 초점이 없다', () => {
    expect(moveFocus([], undefined, 1)).toBeUndefined();
    expect(moveFocus([], 'a', 1)).toBeUndefined();
  });

  it('초점이 없으면 첫 자리로 온다', () => {
    expect(moveFocus(IDS, undefined, 1)).toBe('a');
    expect(moveFocus(IDS, undefined, -1)).toBe('a');
  });

  it('지금 자리가 목록에 없으면 첫 자리로 되돌린다 — 방금 사라진 자리를 붙들지 않는다', () => {
    expect(moveFocus(IDS, 'zzz', 1)).toBe('a');
  });

  it('앞뒤로 한 칸씩 간다', () => {
    expect(moveFocus(IDS, 'b', 1)).toBe('c');
    expect(moveFocus(IDS, 'b', -1)).toBe('a');
  });

  it('양 끝에서 감긴다 — 막다른 곳이 되면 조작이 죽은 것과 구별되지 않는다', () => {
    expect(moveFocus(IDS, 'd', 1)).toBe('a');
    expect(moveFocus(IDS, 'a', -1)).toBe('d');
  });

  it('여러 칸을 건너뛰어도 감긴다', () => {
    expect(moveFocus(IDS, 'a', 6)).toBe('c');
    expect(moveFocus(IDS, 'a', -6)).toBe('c');
  });

  it('제자리(0)는 제자리다', () => {
    expect(moveFocus(IDS, 'c', 0)).toBe('c');
  });
});

describe('moveFocusGrid — 여러 줄 사이의 이동', () => {
  // 여섯을 3열로 놓으면  a b c / d e f
  const SIX = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('아래는 한 줄만큼 건너뛴다', () => {
    expect(moveFocusGrid(SIX, 'a', 3, { dy: 1 })).toBe('d');
    expect(moveFocusGrid(SIX, 'f', 3, { dy: -1 })).toBe('c');
  });

  it('위아래로는 감기지 않고 양 끝에서 멈춘다', () => {
    // 감으면 마지막 줄의 빈 자리 때문에 초점이 어디로 갈지 예측되지 않는다
    expect(moveFocusGrid(SIX, 'a', 3, { dy: -1 })).toBe('a');
    expect(moveFocusGrid(SIX, 'f', 3, { dy: 1 })).toBe('f');
  });

  it('줄 수가 딱 떨어지지 않아도 넘어가지 않는다', () => {
    const FIVE = ['a', 'b', 'c', 'd', 'e'];
    // e 는 마지막 줄의 둘째 칸. 아래로 가면 목록 밖이므로 제자리다
    expect(moveFocusGrid(FIVE, 'e', 3, { dy: 1 })).toBe('e');
  });

  it('좌우는 한 줄 이동과 같다 — 감긴다', () => {
    expect(moveFocusGrid(SIX, 'f', 3, { dx: 1 })).toBe('a');
    expect(moveFocusGrid(SIX, 'a', 3, { dx: -1 })).toBe('f');
  });

  it('열 수가 0 이하로 와도 멈추지 않는다', () => {
    expect(moveFocusGrid(SIX, 'a', 0, { dy: 1 })).toBe('b');
  });

  it('빈 목록에는 초점이 없다', () => {
    expect(moveFocusGrid([], undefined, 3, { dy: 1 })).toBeUndefined();
  });
});
