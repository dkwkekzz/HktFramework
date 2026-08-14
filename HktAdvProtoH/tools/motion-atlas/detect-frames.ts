// Frame Rect Detector — 시트 하나에서 진짜 프레임 사각형을 찾아낸다.
//
// 왜 필요한가: 지금까지는 `시트크기 ÷ 격자` 로 균등 분할했다. 그런데 실제 시트는
// 바깥 여백이 비대칭이고 칸 간격도 고르지 않아서, 균등 절단선이 그림을 관통한다
// (실측: attack 시트는 절단선 4개 전부가 25~43px 씩 그림을 잘라먹고 있었다).
//
// 검출 방법 — 알파 투영의 "빈 줄(gutter)" 을 찾는다.
//   1. 바깥 여백 제거   잉크가 있는 첫/마지막 줄까지가 실제 콘텐츠 범위다
//   2. gutter 우선      기대 위치 근처에 잉크 0 인 구간이 있으면 그 중앙을 절단선으로
//   3. valley 폴백      gutter 가 없으면(프레임끼리 맞닿은 시트) 잉크가 가장 적은 줄
//
// 3번까지 가도 잉크가 0 이 아니면 그건 시트 자체의 결함이다 — 고칠 수 없으므로
// 경고로 남긴다. 조용히 뭉개는 것보다 데이터를 고치도록 알리는 편이 낫다.
//
// 순수 함수 — 파일 시스템도 이미지 포맷도 모른다.

import type { AlphaImage } from './png-alpha';

/** 이 값보다 진한 픽셀을 "그림이 있다"고 본다. 안티에일리어싱 가장자리를 무시하는 문턱 */
export const INK_THRESHOLD = 16;
/** 잡음이 아닌 진짜 gutter 로 인정할 최소 두께(px) */
export const MIN_GUTTER = 4;
/** 기대 위치에서 이만큼(칸 간격 대비 비율) 안에 있는 gutter 만 후보로 본다 */
export const GUTTER_TOLERANCE = 0.45;
/** valley 폴백이 훑는 범위(칸 간격 대비 비율) */
export const VALLEY_WINDOW = 0.25;

export type CutMethod = 'gutter' | 'valley' | 'even';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectedFrame {
  /** 시트 안에서 이 프레임이 차지하는 사각형 */
  rect: Rect;
  /** 그 안에서 실제로 그림이 있는 범위. 빈 프레임이면 rect 와 같다 */
  content: Rect;
  /** 그림이 전혀 없는 칸 */
  empty: boolean;
}

export interface DetectedSheet {
  width: number;
  height: number;
  cols: number;
  rows: number;
  method: { x: CutMethod; y: CutMethod };
  frames: DetectedFrame[];
  /** 절단선 위에 남은 잉크(px). 0 이어야 깨끗하다 */
  bleed: { axis: 'x' | 'y'; at: number; ink: number }[];
}

/** 축 하나의 잉크 투영 — counts[i] = 그 줄에 있는 불투명 픽셀 수 */
function project(image: AlphaImage, axis: 'x' | 'y'): number[] {
  const { width, height, alpha } = image;
  const counts = new Array<number>(axis === 'x' ? width : height).fill(0);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x]! > INK_THRESHOLD) counts[axis === 'x' ? x : y]!++;
    }
  }
  return counts;
}

/** 잉크가 있는 첫/마지막 인덱스 — 바깥 여백을 뺀 실제 콘텐츠 범위 [lo, hi) */
function contentRange(counts: number[]): { lo: number; hi: number } {
  let lo = 0;
  while (lo < counts.length && counts[lo] === 0) lo++;
  let hi = counts.length;
  while (hi > lo && counts[hi - 1] === 0) hi--;
  return lo < hi ? { lo, hi } : { lo: 0, hi: counts.length };
}

/** 잉크가 0 인 연속 구간들 */
function emptyRuns(counts: number[], lo: number, hi: number): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start: number | null = null;
  for (let i = lo; i < hi; i++) {
    if (counts[i] === 0) {
      if (start === null) start = i;
    } else if (start !== null) {
      runs.push([start, i - 1]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, hi - 1]);
  return runs;
}

/**
 * n 조각으로 나누는 내부 절단선 n-1 개를 찾는다.
 * gutter → valley 순으로 시도하며, 어느 쪽을 썼는지도 함께 돌려준다.
 */
export function findCuts(
  counts: number[],
  n: number,
): { lo: number; hi: number; cuts: number[]; method: CutMethod } {
  const { lo, hi } = contentRange(counts);
  if (n <= 1) return { lo, hi, cuts: [], method: 'even' };

  const pitch = (hi - lo) / n;
  const expected = Array.from({ length: n - 1 }, (_, k) => lo + pitch * (k + 1));

  // 바깥 여백에 걸치지 않는, 충분히 두꺼운 gutter 만 후보다.
  const candidates = emptyRuns(counts, lo, hi)
    .filter(([a, b]) => b - a + 1 >= MIN_GUTTER && a > lo && b < hi - 1)
    .map(([a, b]) => (a + b) / 2);

  const used = new Set<number>();
  const cuts: number[] = [];
  const methods: CutMethod[] = [];

  for (const target of expected) {
    let best: number | null = null;
    for (const c of candidates) {
      if (used.has(c)) continue;
      if (Math.abs(c - target) > pitch * GUTTER_TOLERANCE) continue;
      if (best === null || Math.abs(c - target) < Math.abs(best - target)) best = c;
    }

    if (best !== null) {
      used.add(best);
      cuts.push(Math.round(best));
      methods.push('gutter');
      continue;
    }

    // gutter 가 없다 — 프레임끼리 맞닿은 시트다. 기대 위치 근처에서 잉크가 가장 적은 줄로.
    const span = Math.max(1, Math.round(pitch * VALLEY_WINDOW));
    const from = Math.max(lo + 1, Math.round(target) - span);
    const to = Math.min(hi - 1, Math.round(target) + span);
    let pick = Math.round(target);
    let pickInk = Number.POSITIVE_INFINITY;
    for (let i = from; i <= to; i++) {
      const ink = counts[i]!;
      // 잉크가 같으면 기대 위치에 가까운 쪽 — 격자가 무너지지 않게 한다
      if (ink < pickInk || (ink === pickInk && Math.abs(i - target) < Math.abs(pick - target))) {
        pick = i;
        pickInk = ink;
      }
    }
    cuts.push(pick);
    methods.push(pickInk === 0 ? 'gutter' : 'valley');
  }

  cuts.sort((a, b) => a - b);
  const method: CutMethod = methods.includes('valley') ? 'valley' : 'gutter';
  return { lo, hi, cuts, method };
}

/** 사각형 안에서 그림이 실제로 있는 범위 */
function contentBox(image: AlphaImage, rect: Rect): Rect | null {
  const { width, alpha } = image;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = -1;

  for (let y = rect.y; y < rect.y + rect.h; y++) {
    const row = y * width;
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (alpha[row + x]! <= INK_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * 시트 하나를 격자로 나눈다. 프레임은 왼쪽 위에서 오른쪽으로, 그다음 아래 줄로 센다
 * (Motion Data Injection Format v1 의 읽는 순서와 같다).
 */
export function detectSheet(image: AlphaImage, cols: number, rows: number): DetectedSheet {
  const x = findCuts(project(image, 'x'), cols);
  const y = findCuts(project(image, 'y'), rows);

  const xs = [x.lo, ...x.cuts, x.hi];
  const ys = [y.lo, ...y.cuts, y.hi];

  const frames: DetectedFrame[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rect: Rect = {
        x: xs[c]!,
        y: ys[r]!,
        w: xs[c + 1]! - xs[c]!,
        h: ys[r + 1]! - ys[r]!,
      };
      const content = contentBox(image, rect);
      frames.push({ rect, content: content ?? { ...rect }, empty: content === null });
    }
  }

  // 절단선 위에 남은 잉크를 그대로 보고한다 — 시트 결함을 숨기지 않는다.
  const colCounts = project(image, 'x');
  const rowCounts = project(image, 'y');
  const bleed: DetectedSheet['bleed'] = [];
  for (const at of x.cuts) if (colCounts[at]! > 0) bleed.push({ axis: 'x', at, ink: colCounts[at]! });
  for (const at of y.cuts) if (rowCounts[at]! > 0) bleed.push({ axis: 'y', at, ink: rowCounts[at]! });

  return {
    width: image.width,
    height: image.height,
    cols,
    rows,
    method: { x: x.method, y: y.method },
    frames,
    bleed,
  };
}
