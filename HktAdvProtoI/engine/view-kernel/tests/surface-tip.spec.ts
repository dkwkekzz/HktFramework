// 곁말이 어느 쪽으로 펴지는가 — 재어 온 수로 정하는 **판단**만 확인한다.
//
// 지키는 것은 셋이다. 아래가 기본이다 · 아래가 모자라면 위로 접는다 · 위도 모자라면
// 기본으로 돌아간다 (프레임마다 뒤집히지 않는다). 좌우도 같은 규칙이다.

import { describe, expect, it } from 'vitest';
import { tipPlacement, type TipBox } from '../hud/surface-tip';

/** 표면 — 500×400 자리. 곁말은 이 밖으로 나가면 잘린다 */
const ROOM: TipBox = { top: 0, bottom: 400, left: 0, right: 500 };
const TIP = { width: 200, height: 60 };
const GAP = 6;

/** 칸 하나 — 가운데 x, 위 y, 60×58 */
function cell(x: number, y: number): TipBox {
  return { top: y, bottom: y + 58, left: x - 30, right: x + 30 };
}

describe('tipPlacement — 위아래', () => {
  it('아래가 남았으면 아래로 편다 — 기본이다', () => {
    expect(tipPlacement(cell(250, 40), ROOM, TIP, GAP).side).toBe('below');
  });

  it('마지막 줄에서 아래가 모자라면 위로 접는다 — 잘리지 않게', () => {
    // 칸 바닥 378 + 6 + 60 = 444 > 400 이고, 위는 320 - 6 - 60 = 254 >= 0
    expect(tipPlacement(cell(250, 320), ROOM, TIP, GAP).side).toBe('above');
  });

  it('위아래가 둘 다 모자라면 아래다 — 기본으로 돌아가는 편이 뒤집히는 것보다 낫다', () => {
    const tall = { width: 200, height: 390 };
    expect(tipPlacement(cell(250, 100), ROOM, tall, GAP).side).toBe('below');
  });

  it('딱 맞는 자리는 접지 않는다 — 경계는 남은 것으로 센다', () => {
    // 칸 바닥 336 + 6 + 60 = 402 > 400 → 접는다 / 334 면 400 = 400 → 접지 않는다
    expect(tipPlacement(cell(250, 278), ROOM, TIP, GAP).side).toBe('above');
    expect(tipPlacement(cell(250, 276), ROOM, TIP, GAP).side).toBe('below');
  });
});

describe('tipPlacement — 좌우', () => {
  it('가운데에 자리가 있으면 가운데다', () => {
    expect(tipPlacement(cell(250, 40), ROOM, TIP, GAP).align).toBe('center');
  });

  it('왼쪽 끝 열에서는 왼쪽 끝에 맞춘다', () => {
    // 가운데 40 - 100 = -60 < 0
    expect(tipPlacement(cell(40, 40), ROOM, TIP, GAP).align).toBe('start');
  });

  it('오른쪽 끝 열에서는 오른쪽 끝에 맞춘다', () => {
    // 가운데 460 + 100 = 560 > 500
    expect(tipPlacement(cell(460, 40), ROOM, TIP, GAP).align).toBe('end');
  });

  it('위아래와 좌우는 따로 정해진다 — 마지막 줄의 끝 칸은 둘 다 접힌다', () => {
    expect(tipPlacement(cell(460, 320), ROOM, TIP, GAP)).toEqual({
      side: 'above',
      align: 'end',
    });
  });
});
