// Motion Geometry — 시트 안에서 프레임이 실제로 놓인 자리.
//
// 이 값은 정적 분석 도구(tools/motion-atlas)가 PNG 알파를 읽어 미리 구해 둔 것이다.
// 런타임은 픽셀을 훑지 않는다 — 1518×1452 시트의 알파를 브라우저에서 읽으면
// 시트마다 수백 ms 가 메인 스레드에서 날아간다.
//
// 좌표는 전부 **시트 픽셀**(왼쪽 위 원점)이다. UV 변환은 frameUv 가 맡는다.

/** [x, y, w, h] — 시트 픽셀, 왼쪽 위 원점 */
export type PixelRect = readonly [number, number, number, number];

export interface MotionFrameGeometry {
  /** 이 프레임이 차지하는 사각형 */
  readonly rect: PixelRect;
  /** 그 안에서 실제로 그림이 있는 범위 (진단·검증용) */
  readonly content: PixelRect;
  /**
   * 프레임 안의 기준점 — 스프라이트가 세계 좌표에 놓이는 지점.
   * [u, v], 좌하단 원점. v 는 이 모션의 접지선(가장 낮게 선 프레임의 발끝)이다.
   */
  readonly anchor: readonly [number, number];
}

export interface MotionGeometry {
  /** 원본 시트 크기 [w, h] — 이미지를 축소해도 이 값으로 정규화하므로 UV 가 변하지 않는다 */
  readonly sheet: readonly [number, number];
  readonly cols: number;
  readonly rows: number;
  /**
   * 캐릭터 대표 높이(px) — 이 모션에서 가장 큰 포즈의 그림 높이.
   * 월드 크기 환산 기준이다. 모션마다 이 값으로 나누므로 캐릭터 크기가 행동 간에 일정해진다.
   */
  readonly refHeightPx: number;
  readonly frames: readonly MotionFrameGeometry[];
  /** 절단선이 그림을 관통하는 등 시트 자체의 문제 — 게임은 계속 돈다 */
  readonly warnings: readonly string[];
}

/** 시트 경로(import.meta.glob 키) → 기하 */
export type MotionAtlas = Readonly<Record<string, MotionGeometry>>;

/**
 * 정적 분석 결과가 없을 때의 기하 — 예전처럼 균등 분할한다.
 * webp 처럼 도구가 읽지 못하는 형식이나, 도구를 아직 돌리지 않은 새 파일이 여기로 온다.
 * 게임은 멈추지 않고, 대신 도구가 경고를 남긴다.
 */
export function uniformGeometry(
  sheetW: number,
  sheetH: number,
  cols: number,
  rows: number,
): MotionGeometry {
  const w = Math.floor(sheetW / cols);
  const h = Math.floor(sheetH / rows);
  const frames: MotionFrameGeometry[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rect: PixelRect = [c * w, r * h, w, h];
      frames.push({ rect, content: rect, anchor: [0.5, 0.06] });
    }
  }
  return {
    sheet: [sheetW, sheetH],
    cols,
    rows,
    refHeightPx: h,
    frames,
    warnings: [],
  };
}

/**
 * 프레임의 UV 영역 (three.js 텍스처 좌표 — 좌하단 원점).
 *
 * insetTexels 만큼 안쪽으로 좁힌다. 선형 보간이 가장자리에서 반 텍셀 바깥을 집어
 * 이웃 프레임이 번지는 것을 막는다. 축소된 이미지 기준이어야 하므로 호출자가 준다.
 */
export function frameUv(
  geometry: MotionGeometry,
  frame: number,
  insetTexels = 0,
): { offsetX: number; offsetY: number; repeatX: number; repeatY: number } {
  const [sheetW, sheetH] = geometry.sheet;
  const entry = geometry.frames[Math.min(Math.max(frame, 0), geometry.frames.length - 1)];
  if (!entry || sheetW <= 0 || sheetH <= 0) {
    return { offsetX: 0, offsetY: 0, repeatX: 1, repeatY: 1 };
  }

  const [x, y, w, h] = entry.rect;
  // inset 이 프레임을 뒤집지 않도록 폭의 1/4 로 제한한다 (아주 작은 프레임 대비)
  const ix = Math.min(insetTexels, w / 4);
  const iy = Math.min(insetTexels, h / 4);

  return {
    offsetX: (x + ix) / sheetW,
    offsetY: 1 - (y + h - iy) / sheetH, // 시트는 위에서 아래로, UV 는 아래에서 위로
    repeatX: (w - ix * 2) / sheetW,
    repeatY: (h - iy * 2) / sheetH,
  };
}

/**
 * 프레임의 월드 크기 — 세로 기준 크기(size)를 이 모션의 대표 높이에 맞춰 환산한다.
 * 프레임마다 사각형 크기가 달라도 픽셀당 월드 크기는 일정하므로,
 * 웅크림·도약 같은 *의도된* 포즈 변화는 그대로 살아 있고 시트 간 크기 차이만 사라진다.
 */
export function frameWorldSize(
  geometry: MotionGeometry,
  frame: number,
  size: number,
): { width: number; height: number } {
  const entry = geometry.frames[Math.min(Math.max(frame, 0), geometry.frames.length - 1)];
  const ref = geometry.refHeightPx > 0 ? geometry.refHeightPx : 1;
  if (!entry) return { width: size, height: size };
  const [, , w, h] = entry.rect;
  return { width: (size * w) / ref, height: (size * h) / ref };
}
