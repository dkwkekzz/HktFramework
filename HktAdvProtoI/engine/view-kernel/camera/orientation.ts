// 시점 방향 — 04-gameview.spec.yaml `viewpoint.orientation`.
//
// 관찰자가 소유하는 값이다. 세계는 이 값을 알지 않는다 (03-world-semantic.md WORLD STATE).
// 그래서 여기에는 World 에서 오는 것이 하나도 없다 — 두 각과 그로부터 유도되는 방향뿐이다.
//
// three 를 쓰지 않는 순수 계산으로 둔다. 시점 기준 이동과 몸 방향의 좌우 읽기가
// 모두 이 파일의 함수 위에 서므로, 렌더러 없이 값으로 검증할 수 있어야 한다.
//
// 좌표 약속 (지면 평면 x, z — 세계와 같은 평면)
//   turn = 0 일 때 시점은 -z 쪽을 본다. 화면의 오른쪽이 +x 다.
//   tilt 는 "내려다보는 각" — 0 이면 수평, 커질수록 위에서 내려다본다.

export interface ViewOrientation {
  /** 수평으로 도는 각 (rad) */
  turn: number;
  /** 위아래로 기우는 각 (rad) — 내려다보는 정도 */
  tilt: number;
}

export interface PlaneDirection {
  x: number;
  z: number;
}

/** 기본 시점 — 예전의 고정 오프셋(0, 7.5, 13)과 같은 자리를 만든다 */
export const DEFAULT_ORIENTATION: Readonly<ViewOrientation> = { turn: 0, tilt: Math.PI / 6 };

/** 시점이 몸에서 떨어져 있는 거리 — 줌은 이번 Cycle 의 대상이 아니다 (01 EXCLUDED) */
export const VIEW_DISTANCE = 15;

// tilt 한계 (04 viewpoint.orientation.tilt.bounded) — 세계가 뒤집혀 보이지 않도록 묶는다.
// 아래쪽 한계는 지평선이 화면에 남는 각, 위쪽 한계는 완전한 수직 직전이다.
export const TILT_MIN = 0.08;
export const TILT_MAX = 1.25;

const TAU = Math.PI * 2;

export function clampTilt(tilt: number): number {
  return Math.min(TILT_MAX, Math.max(TILT_MIN, tilt));
}

/** turn 을 (-π, π] 로 접는다 — 값의 표현일 뿐 방향은 이어진 채다 */
export function wrapTurn(turn: number): number {
  const wrapped = ((turn + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return wrapped;
}

/**
 * 시점을 그만큼 더 돌린 결과 (04 continuity: required).
 * 절대 각을 지정하는 함수는 두지 않는다 — 시점은 늘 "지금 방향에서 얼마만큼" 바뀐다.
 */
export function turned(current: ViewOrientation, dTurn: number, dTilt: number): ViewOrientation {
  return { turn: wrapTurn(current.turn + dTurn), tilt: clampTilt(current.tilt + dTilt) };
}

/** 지면 위에서 시점이 보고 있는 방향 */
export function viewForward(turn: number): PlaneDirection {
  return { x: -Math.sin(turn), z: -Math.cos(turn) };
}

/** 지면 위에서 화면의 오른쪽에 해당하는 방향 */
export function viewRight(turn: number): PlaneDirection {
  return { x: Math.cos(turn), z: -Math.sin(turn) };
}

/**
 * 관찰자 기준 입력 → 세계 방향 (04 interactions.move.direction.conversion).
 *
 * local 은 입력 장치가 주는 관찰자 기준 방향이다 — x 는 화면 오른쪽, z 는 화면 안쪽이 음수
 * (방향키의 관례 그대로). 여기서 세계 좌표로 환산되며, 그 뒤로는 어떤 기준으로 정해진
 * 방향인지가 남지 않는다 — 세계는 목적지만 받는다.
 */
export function worldDirection(turn: number, local: PlaneDirection): PlaneDirection {
  const forward = viewForward(turn);
  const right = viewRight(turn);
  const x = right.x * local.x + forward.x * -local.z;
  const z = right.z * local.x + forward.z * -local.z;
  const len = Math.sqrt(x * x + z * z);
  if (len < 1e-9) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

/**
 * 몸이 향한 방향이 이 시점에서 화면의 어느 쪽으로 읽히는가 (04 entities.character.facing.read).
 * 양수면 오른쪽, 음수면 왼쪽. 0 에 가까울수록 정면이나 정후면을 향한 것이라 좌우가 흐려진다.
 */
export function screenSideValue(turn: number, facing: PlaneDirection): number {
  const right = viewRight(turn);
  return facing.x * right.x + facing.z * right.z;
}

/**
 * 시점이 놓이는 자리 — 몸을 두고 그 주위를 돈다 (04 viewpoint.follows).
 * 높이는 지면 기준 상대값이다. 지형을 뚫지 않게 하는 것은 이 자리를 받는 쪽의 몫이다.
 *
 * distance 는 몸에서 떨어져 있을 거리다 — 주지 않으면 VIEW_DISTANCE 다.
 * 왜 그 거리인지는 이 함수가 알지 못한다. 거리는 그냥 거리다.
 */
export function viewOffset(
  orientation: ViewOrientation,
  distance: number = VIEW_DISTANCE,
): { x: number; y: number; z: number } {
  const forward = viewForward(orientation.turn);
  const horizontal = distance * Math.cos(orientation.tilt);
  return {
    x: -forward.x * horizontal,
    y: distance * Math.sin(orientation.tilt),
    z: -forward.z * horizontal,
  };
}
