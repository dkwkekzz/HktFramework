// Frame Rect Detector 단위 테스트 — 합성 알파 이미지만으로 검증한다.
// 실제 시트에 대한 회귀 고정은 view/tests/motion-atlas.spec.ts 가 맡는다.

import { describe, expect, it } from 'vitest';
import { detectSheet, findCuts } from '../detect-frames';
import type { AlphaImage } from '../png-alpha';

/** 잉크 사각형 목록으로 알파 이미지를 만든다 */
function image(
  width: number,
  height: number,
  boxes: Array<{ x: number; y: number; w: number; h: number }>,
): AlphaImage {
  const alpha = new Uint8Array(width * height);
  for (const b of boxes) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) alpha[y * width + x] = 255;
    }
  }
  return { width, height, alpha };
}

/** counts[i] = i 번 줄의 잉크 픽셀 수 */
function profile(length: number, inked: Array<[number, number, number]>): number[] {
  const counts = new Array<number>(length).fill(0);
  for (const [from, to, value] of inked) {
    for (let i = from; i <= to; i++) counts[i] = value;
  }
  return counts;
}

describe('findCuts — 절단선 찾기', () => {
  it('바깥 여백을 잘라내고 콘텐츠 범위만 나눈다', () => {
    // 0~9 여백, 10~99 콘텐츠, 100~119 여백. 가운데 45~54 가 gutter
    const counts = profile(120, [
      [10, 44, 5],
      [55, 99, 5],
    ]);
    const { lo, hi, cuts, method } = findCuts(counts, 2);

    expect({ lo, hi }).toEqual({ lo: 10, hi: 100 });
    expect(cuts).toEqual([50]); // gutter 45~54 의 중앙
    expect(method).toBe('gutter');
  });

  it('칸 간격이 고르지 않아도 gutter 를 따라간다 — 균등 분할이 실패하는 자리', () => {
    // 세 칸의 폭이 30 / 20 / 40 으로 다르다. 균등 분할이면 절단선이 40, 70 이지만
    // 진짜 경계는 32.5(gutter 30~35), 57.5(gutter 55~60) 다.
    const counts = profile(100, [
      [0, 29, 5],
      [36, 54, 5],
      [61, 99, 5],
    ]);
    const { cuts, method } = findCuts(counts, 3);

    expect(cuts).toEqual([33, 58]);
    expect(method).toBe('gutter');
    for (const cut of cuts) expect(counts[cut]).toBe(0); // 그림을 관통하지 않는다
  });

  it('gutter 가 없으면(프레임끼리 맞닿으면) 잉크가 가장 적은 줄로 물러난다', () => {
    // 빈 줄이 하나도 없다. 49~51 이 계곡이다.
    const counts = profile(100, [
      [0, 48, 40],
      [49, 51, 3],
      [52, 99, 40],
    ]);
    const { cuts, method } = findCuts(counts, 2);

    expect(cuts).toHaveLength(1);
    expect(counts[cuts[0]!]).toBe(3); // 최소 잉크 지점
    expect(method).toBe('valley'); // 완전히 나누지 못했음을 알린다
  });

  it('얇은 빈 줄(잡음)은 gutter 로 인정하지 않는다', () => {
    // 진짜 gutter 는 48~55, 20~21 은 그림 안의 2px 틈이다
    const counts = profile(100, [
      [0, 19, 5],
      [22, 47, 5],
      [56, 99, 5],
    ]);
    const [cut] = findCuts(counts, 2).cuts;
    expect(cut).toBeGreaterThanOrEqual(48); // 얇은 틈(20~21)이 아니라
    expect(cut).toBeLessThanOrEqual(55); //   진짜 gutter(48~55) 안에서 자른다
    expect(counts[cut!]).toBe(0);
  });

  it('한 칸짜리는 절단선이 없다', () => {
    expect(findCuts(profile(50, [[5, 44, 3]]), 1)).toMatchObject({ lo: 5, hi: 45, cuts: [] });
  });
});

describe('detectSheet — 격자 나누기', () => {
  // 2x2. 칸마다 그림 크기와 여백이 다르다.
  const sheet = image(100, 100, [
    { x: 5, y: 5, w: 30, h: 20 }, // 좌상
    { x: 60, y: 8, w: 35, h: 30 }, // 우상
    { x: 10, y: 60, w: 20, h: 35 }, // 좌하
    { x: 55, y: 70, w: 40, h: 25 }, // 우하
  ]);

  it('프레임을 왼쪽 위에서 오른쪽으로, 그다음 아래 줄로 센다', () => {
    const detected = detectSheet(sheet, 2, 2);

    expect(detected.frames).toHaveLength(4);
    expect(detected.frames[0]!.content).toMatchObject({ x: 5, y: 5, w: 30, h: 20 });
    expect(detected.frames[1]!.content).toMatchObject({ x: 60, y: 8, w: 35, h: 30 });
    expect(detected.frames[2]!.content).toMatchObject({ x: 10, y: 60, w: 20, h: 35 });
    expect(detected.frames[3]!.content).toMatchObject({ x: 55, y: 70, w: 40, h: 25 });
  });

  it('절단선이 그림을 관통하지 않는다', () => {
    expect(detectSheet(sheet, 2, 2).bleed).toEqual([]);
  });

  it('바깥 여백은 프레임에 포함되지 않는다 — 첫 프레임이 시트 원점에서 시작하지 않는다', () => {
    const first = detectSheet(sheet, 2, 2).frames[0]!;
    expect(first.rect.x).toBeGreaterThan(0);
    expect(first.rect.y).toBeGreaterThan(0);
  });

  it('마지막 칸이 비면 비었다고 알린다 — 격자를 잘못 적었을 때의 단서다', () => {
    const detected = detectSheet(
      image(100, 100, [
        { x: 5, y: 5, w: 30, h: 20 },
        { x: 60, y: 8, w: 35, h: 30 },
        { x: 10, y: 60, w: 20, h: 35 },
      ]),
      2,
      2,
    );

    expect(detected.frames.map((f) => f.empty)).toEqual([false, false, false, true]);
  });

  it('맞닿은 프레임은 잉크가 남은 자리를 그대로 보고한다 (숨기지 않는다)', () => {
    // 위아래 두 칸이 한 줄에서 3px 겹친다
    const fused = image(50, 100, [
      { x: 5, y: 5, w: 40, h: 44 }, // 위 칸: y 5~48
      { x: 24, y: 49, w: 3, h: 2 }, // 경계를 가로지르는 잉크: y 49~50
      { x: 5, y: 51, w: 40, h: 44 }, // 아래 칸: y 51~94
    ]);
    const detected = detectSheet(fused, 1, 2);

    expect(detected.method.y).toBe('valley');
    expect(detected.bleed).toHaveLength(1);
    expect(detected.bleed[0]).toMatchObject({ axis: 'y', ink: 3 });
  });
});
