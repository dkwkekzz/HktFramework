// Facing Presentation — 몸이 향한 방향을 그림의 좌우로 옮기는 결정.
// 04-gameview.spec.yaml 의 `entities.character.facing.read` 와 `spriteOrientation` 이 원본이다.
// 종류별 그림의 기준 방향은 컨텐츠 팩의 kind-presentation(종의 표현 단일 출처)이 정해
// 인자로 들어온다 — 이 파일은 좌우 읽기의 기계장치만 소유한다 (P3 CHANGED).
//
// 여기서 정하는 것은 "보이는 방향" 하나뿐이다. 세계의 몸 방향은 이 파일이 건드리지 않는다 —
// 순서는 언제나 몸 방향 → 화면 좌우 → 그림이며, 뒤집히지 않는다 (02 INTENT-STRIKE-LEGIBLE-001).

export type ScreenSide = 'left' | 'right';

/** 등록되지 않은 종류의 기본값 (04 spriteOrientation.baseline.default) */
export const DEFAULT_SPRITE_BASELINE: ScreenSide = 'right';

/**
 * 좌우 어느 쪽도 아니라고 볼 폭 (04 ambiguous: keep-previous).
 * 몸이 시점의 정면·정후면을 향하면 좌우 성분이 0 근처에서 부호를 오가며 깜빡인다.
 * 이 폭 안에서는 직전에 읽힌 쪽을 그대로 쓴다.
 */
export const AMBIGUOUS_BAND = 0.12;

/**
 * 화면 좌우 성분 → 읽히는 쪽.
 * 모호 구간에서는 직전 쪽을 유지하고, 직전이 없으면 기준 방향 그대로 둔다
 * (뒤집지 않는 쪽이 그림 원본이므로 첫 프레임이 흔들리지 않는다).
 */
export function readSide(
  screenSide: number,
  previous: ScreenSide | undefined,
  baseline: ScreenSide,
): ScreenSide {
  if (Math.abs(screenSide) < AMBIGUOUS_BAND) return previous ?? baseline;
  return screenSide > 0 ? 'right' : 'left';
}

export interface FacingDecision {
  /** 이 몸이 지금 화면에서 향한 것으로 읽히는 쪽 */
  side: ScreenSide;
  /** 그림을 좌우로 뒤집어 그릴 것인가 */
  flip: boolean;
}

/** 몸 방향의 화면 좌우 성분과 그림 기준 방향으로부터 그림 지시를 만든다 */
export function facingDecision(
  baseline: ScreenSide,
  screenSide: number,
  previous: ScreenSide | undefined,
): FacingDecision {
  const side = readSide(screenSide, previous, baseline);
  return { side, flip: side !== baseline };
}
