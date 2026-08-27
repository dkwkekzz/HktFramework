// 곁말이 **어느 쪽으로 펴지는가** — 그 판단만 모아 둔 자리.
//
// 곁말은 칸 아래로 편다. 표면이 세로로 구르는 자리라 위로 펴면 첫 줄의 곁말이 잘리기
// 때문이다. 그런데 격자의 **마지막 줄**에서는 아래가 없다 — 그대로 펴면 이번에는
// 마지막 줄이 잘린다. 좌우도 같다: 곁말은 칸 가운데에 서므로 양 끝 열에서는 표면 밖으로
// 나가고, 표면은 넘친 것을 잘라 낸다.
//
// **어느 쪽이 남았는지를 재는 일**은 그리는 쪽의 몫이다 (V-011 REPORT ②). 결정 Layer 는
// 곁말에 무엇이 적히는지만 알고, 그것이 화면 어디에 놓이는지는 알지 못한다.
//
// 여기 있는 것은 산수뿐이고 DOM 이 없다 — 재는 일은 `surface.ts` 가 하고, 잰 수로
// 어느 쪽인지 정하는 일은 여기서 한다. 브라우저 없이 확인할 수 있어야 하는 성질이다.
//
// 이 파일에도 게임의 명사가 하나도 없다.

/** 화면 위의 네모 하나 — `getBoundingClientRect` 가 주는 것과 같은 뜻이다 */
export interface TipBox {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/** 곁말이 펴지는 쪽 — 위아래 */
export type TipSide = 'below' | 'above';

/**
 * 곁말이 서는 자리 — 좌우.
 *
 *     center   칸 가운데 (기본)
 *     start    곁말의 왼쪽 끝을 칸의 왼쪽 끝에 맞춘다 — 왼쪽 가장자리에서
 *     end      곁말의 오른쪽 끝을 칸의 오른쪽 끝에 맞춘다 — 오른쪽 가장자리에서
 */
export type TipAlign = 'center' | 'start' | 'end';

export interface TipPlacement {
  readonly side: TipSide;
  readonly align: TipAlign;
}

/**
 * 이 칸의 곁말은 어느 쪽으로 펴지는가.
 *
 * `room` 은 곁말이 잘리는 자리다 — 표면 자신이다 (넘친 것을 잘라 내는 마디).
 * `tip` 은 곁말의 크기이며 **자리가 아니다**: 자리를 재면 접은 뒤의 값을 다시 읽어
 * 판단이 프레임마다 뒤집힌다.
 *
 * 아래가 기본이고, 아래가 모자랄 때만 위를 본다. 위도 모자라면 다시 아래다 —
 * 어느 쪽도 안 될 때 기본으로 돌아가는 편이 프레임마다 뒤집히는 것보다 낫다.
 */
export function tipPlacement(
  cell: TipBox,
  room: TipBox,
  tip: { readonly width: number; readonly height: number },
  gap: number,
): TipPlacement {
  const fitsBelow = cell.bottom + gap + tip.height <= room.bottom;
  const fitsAbove = cell.top - gap - tip.height >= room.top;
  const side: TipSide = fitsBelow || !fitsAbove ? 'below' : 'above';

  // 가운데에 세웠을 때 양 끝이 어디에 닿는가 — 넘치는 쪽으로 접는다
  const middle = (cell.left + cell.right) / 2;
  const half = tip.width / 2;
  let align: TipAlign = 'center';
  if (middle - half < room.left) align = 'start';
  else if (middle + half > room.right) align = 'end';

  return { side, align };
}
