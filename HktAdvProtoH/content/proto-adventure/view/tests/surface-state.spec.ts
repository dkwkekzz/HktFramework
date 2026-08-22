// 표면의 열림 — **세계의 상태가 아니다.**
//
// 여닫는 것으로 세계에 아무것도 나가지 않으므로, 이 검사에 세계가 등장하지 않는 것이
// 곧 그 사실의 증거다.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  closeSurface,
  openSurfaces,
  surfaceIsOpen,
  toggleSurface,
} from '../surface-state';

beforeEach(() => {
  for (const id of openSurfaces()) closeSurface(id);
});

describe('surface-state — 무엇이 열려 있는가', () => {
  it('처음에는 아무것도 열려 있지 않다', () => {
    expect(openSurfaces()).toEqual([]);
    expect(surfaceIsOpen('bag')).toBe(false);
  });

  it('같은 손짓이 열고 닫는다 — 여는 길과 닫는 길이 다르면 갇힐 수 있다', () => {
    toggleSurface('bag');
    expect(surfaceIsOpen('bag')).toBe(true);
    toggleSurface('bag');
    expect(surfaceIsOpen('bag')).toBe(false);
  });

  it('닫는 요청이 여는 요청이 되지 않는다 — Esc 를 두 번 눌러 되살아나면 안 된다', () => {
    closeSurface('bag');
    closeSurface('bag');
    expect(surfaceIsOpen('bag')).toBe(false);
  });

  it('여러 표면이 따로 논다', () => {
    toggleSurface('bag');
    toggleSurface('gear');
    closeSurface('bag');
    expect(surfaceIsOpen('bag')).toBe(false);
    expect(surfaceIsOpen('gear')).toBe(true);
  });
});
