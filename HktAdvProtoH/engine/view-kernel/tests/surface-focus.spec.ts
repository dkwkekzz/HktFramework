// 겹침 표면 안에서 자판이 다니는 길 — 그 **판단**만 확인한다.
//
// 마디를 만지는 일은 브라우저가 있어야 하지만, 판단은 없어도 확인할 수 있다.
// 여기서 지키는 것은 셋이다.
//   · Tab 이 서는 자리는 무리마다 하나이고, 실려 온 초점이 그 자리를 정한다
//   · Escape 한 번은 **가장 가까운 것 하나**만 닫는다 — 표면째 닫히지 않는다
//   · 실려 온 초점(링)이 브라우저의 초점을 끄는 순간은 정해져 있다

import { describe, expect, it } from 'vitest';
import { enterStop, escapeMeans, focusToClaim, tabStopId } from '../hud/surface-focus';

describe('tabStopId — 무리마다 한 자리', () => {
  it('실려 온 초점이 이 무리에 있으면 그 자리가 선다', () => {
    expect(tabStopId(['a', 'b', 'c'], 'b')).toBe('b');
  });

  it('이 무리에 없으면 첫 자리가 선다 — 무리마다 하나는 남아야 한다', () => {
    expect(tabStopId(['a', 'b', 'c'], 'z')).toBe('a');
    expect(tabStopId(['a', 'b', 'c'], undefined)).toBe('a');
  });

  it('빈 무리에는 자리가 없다', () => {
    expect(tabStopId([], 'a')).toBeUndefined();
  });
});

describe('enterStop — 밖에서 들어오는 걸음', () => {
  it('앞으로 오면 첫 자리, 뒤로 오면 마지막 자리다', () => {
    expect(enterStop(4, false)).toBe(0);
    expect(enterStop(4, true)).toBe(3);
  });

  it('자리가 없으면 0 이다 — 부르는 쪽이 그때 아무것도 하지 않는다', () => {
    expect(enterStop(0, true)).toBe(0);
  });
});

describe('escapeMeans — 이 Escape 는 무엇을 닫는가', () => {
  it('열린 표면이 없으면 표면의 것이 아니다', () => {
    expect(escapeMeans({ anyOpen: false, inField: true, tipOpen: true })).toBe('none');
  });

  it('캐럿이 글자 자리에 있으면 그 자리에서 나온다 — 표면은 열린 채다', () => {
    expect(escapeMeans({ anyOpen: true, inField: true, tipOpen: false })).toBe('leave-field');
  });

  it('글자 자리가 곁말보다 먼저다 — 캐럿은 겪는 사람이 놓아 둔 자리다', () => {
    expect(escapeMeans({ anyOpen: true, inField: true, tipOpen: true })).toBe('leave-field');
  });

  it('곁말이 떠 있으면 읽던 것만 닫는다 — 표면째 닫으면 돌아올 길이 사라진다', () => {
    expect(escapeMeans({ anyOpen: true, inField: false, tipOpen: true })).toBe('close-tip');
  });

  it('가까운 것이 아무것도 없으면 표면을 닫는다', () => {
    expect(escapeMeans({ anyOpen: true, inField: false, tipOpen: false })).toBe('close-surface');
  });
});

describe('focusToClaim — 링이 브라우저의 초점을 끄는 순간', () => {
  it('표면이 방금 열리면 링으로 들어간다', () => {
    expect(
      focusToClaim({ focusId: 'row.1', lastFocus: undefined, justOpened: true, typing: false }),
    ).toEqual({ move: 'ring', id: 'row.1' });
  });

  it('열렸는데 실려 온 초점이 없으면 표면 자신으로 들어간다', () => {
    expect(
      focusToClaim({ focusId: undefined, lastFocus: undefined, justOpened: true, typing: false }),
    ).toEqual({ move: 'enter' });
  });

  it('링이 움직이면 브라우저가 따라간다 — 방향키로 옮긴 자리다', () => {
    expect(
      focusToClaim({ focusId: 'row.2', lastFocus: 'row.1', justOpened: false, typing: false }),
    ).toEqual({ move: 'ring', id: 'row.2' });
  });

  it('링이 그대로면 옮기지 않는다 — Tab 이나 손이 놓아 둔 자리를 빼앗지 않는다', () => {
    expect(
      focusToClaim({ focusId: 'row.1', lastFocus: 'row.1', justOpened: false, typing: false }),
    ).toEqual({ move: 'none' });
  });

  it('글자를 치는 중이면 어느 경우에도 옮기지 않는다', () => {
    expect(
      focusToClaim({ focusId: 'row.2', lastFocus: 'row.1', justOpened: true, typing: true }),
    ).toEqual({ move: 'none' });
  });
});
