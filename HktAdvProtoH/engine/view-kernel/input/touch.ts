// 손가락 조작 (범용 엔진) — 키보드도 마우스 버튼도 없는 기기에서 세계를 만진다.
//
// 세계에 새로운 것을 요청하지 않는다. 키보드와 마우스가 만들던 것과 똑같은 것을 만든다 —
// 방향은 attachKeyboard().direction() 과 같은 모양(단위 벡터)이고, 시점은 attachPointerLook
// 과 같은 비율로 돈다. 세계는 무엇이 자기를 만졌는지 알지 못하며 알 필요도 없다.
//
// 화면을 둘로 나눈다.
//
//   왼쪽 절반    손가락을 대면 그 자리에 스틱이 생기고, 끄는 쪽으로 계속 간다.
//                자리가 고정돼 있지 않으므로 기기 크기나 손 크기를 가리지 않는다.
//   오른쪽 절반  끌면 시점이 돈다. 끌지 않고 떼면 탭 — 지금까지의 지목(이동·상호작용)이다.
//
// 조작 버튼(view/hud/touch-pad.ts)은 이 위에 얹히며, 버튼 위에서 시작된 손짓은
// 여기까지 오지 않는다.

import { TILT_PER_PIXEL, TURN_PER_PIXEL, type LookSink } from './pointer';

/** 스틱을 최대로 민 것으로 치는 거리 (px) */
export const STICK_RADIUS = 56;
/** 이 안에서는 민 것으로 치지 않는다 (px) — 손가락은 가만히 있어도 조금 흔들린다 */
export const STICK_DEADZONE = 10;
/** 이만큼 넘게 움직였으면 탭이 아니라 끌기다 (px) */
export const TAP_SLOP = 12;
/** 끌기가 끝난 뒤 이 시간 동안의 click 은 탭으로 치지 않는다 (ms) */
export const TAP_SUPPRESS_MS = 400;

/** 화면에 그려질 스틱의 상태 — 그리는 것은 HUD 의 일이다 */
export interface StickView {
  active: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
}

export interface TouchControls {
  /** 지금 밀고 있는 방향 (단위 벡터, 없으면 null) — 키보드와 같은 모양이다 */
  direction(): { x: number; z: number } | null;
  stick(): StickView;
  /** 방금 끝난 손짓이 끌기였으면 그 뒤에 오는 click 을 지목으로 치지 않는다 */
  tapSuppressed(now: number): boolean;
  /** 손가락이 한 번이라도 닿았는가 — 닿기 전에는 조작 자리를 보이지 않는다 */
  engaged(): boolean;
}

/**
 * 스틱을 민 거리를 방향으로 바꾼다.
 *
 * 화면 좌표 그대로 받는다 — 아래로 밀면(dy > 0) 뒤로(z > 0), 오른쪽으로 밀면 오른쪽(x > 0).
 * 이는 KeyS = {x:0,z:1} · KeyD = {x:1,z:0} 과 같은 규약이다 (view/input/keyboard.ts).
 *
 * 얼마나 세게 밀었는지는 돌려주지 않는다 — 키보드도 그것을 주지 않으며,
 * 세계로 가는 요청이 키보드일 때와 달라지면 안 되기 때문이다.
 */
export function stickVector(dx: number, dy: number): { x: number; z: number } | null {
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < STICK_DEADZONE) return null;
  return { x: dx / length, z: dy / length };
}

/** 스틱 손잡이가 실제로 놓일 자리 — 최대 거리를 넘어가지 않는다 */
export function clampKnob(dx: number, dy: number): { x: number; y: number } {
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length <= STICK_RADIUS) return { x: dx, y: dy };
  const scale = STICK_RADIUS / length;
  return { x: dx * scale, y: dy * scale };
}

const IDLE_STICK: StickView = { active: false, originX: 0, originY: 0, knobX: 0, knobY: 0 };

export function attachTouchControls(element: HTMLElement, look: LookSink): TouchControls {
  // 스틱과 시점은 동시에 쓸 수 있어야 한다 — 손가락 둘을 따로 기억한다.
  let stickId: number | null = null;
  let stickOrigin = { x: 0, y: 0 };
  let stickDelta = { x: 0, y: 0 };

  let lookId: number | null = null;
  let lookLast = { x: 0, y: 0 };
  let lookMoved = 0;

  let engaged = false;
  let suppressUntil = 0;

  const isTouch = (ev: PointerEvent): boolean => ev.pointerType !== 'mouse';

  element.addEventListener('pointerdown', (ev) => {
    if (!isTouch(ev)) return; // 마우스는 지금까지대로다 (view/input/pointer.ts)
    engaged = true;

    // 왼쪽 절반은 이동, 오른쪽 절반은 시점·지목.
    const half = element.clientWidth / 2;
    if (ev.clientX < half) {
      if (stickId !== null) return;
      stickId = ev.pointerId;
      stickOrigin = { x: ev.clientX, y: ev.clientY };
      stickDelta = { x: 0, y: 0 };
      // 스틱을 잡은 손가락은 지목이 아니다 — 뒤따르는 click 을 막는다.
      suppressUntil = performance.now() + TAP_SUPPRESS_MS;
    } else {
      if (lookId !== null) return;
      lookId = ev.pointerId;
      lookLast = { x: ev.clientX, y: ev.clientY };
      lookMoved = 0;
    }
    element.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });

  element.addEventListener('pointermove', (ev) => {
    if (ev.pointerId === stickId) {
      stickDelta = { x: ev.clientX - stickOrigin.x, y: ev.clientY - stickOrigin.y };
      suppressUntil = performance.now() + TAP_SUPPRESS_MS;
      ev.preventDefault();
      return;
    }
    if (ev.pointerId !== lookId) return;

    const dx = ev.clientX - lookLast.x;
    const dy = ev.clientY - lookLast.y;
    lookLast = { x: ev.clientX, y: ev.clientY };
    lookMoved += Math.abs(dx) + Math.abs(dy);
    // 마우스로 끌 때와 같은 비율로 돈다 — 기기가 달라도 같은 조작이다.
    look(-dx * TURN_PER_PIXEL, -dy * TILT_PER_PIXEL);
    ev.preventDefault();
  });

  const release = (ev: PointerEvent): void => {
    if (ev.pointerId === stickId) {
      stickId = null;
      stickDelta = { x: 0, y: 0 };
      suppressUntil = performance.now() + TAP_SUPPRESS_MS;
    } else if (ev.pointerId === lookId) {
      lookId = null;
      // 끌었으면 지목이 아니다. 제자리에서 뗐으면 지목이므로 막지 않는다.
      if (lookMoved > TAP_SLOP) suppressUntil = performance.now() + TAP_SUPPRESS_MS;
      lookMoved = 0;
    } else {
      return;
    }
    if (element.hasPointerCapture(ev.pointerId)) element.releasePointerCapture(ev.pointerId);
  };
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);

  return {
    direction() {
      if (stickId === null) return null;
      return stickVector(stickDelta.x, stickDelta.y);
    },
    stick() {
      if (stickId === null) return IDLE_STICK;
      const knob = clampKnob(stickDelta.x, stickDelta.y);
      return {
        active: true,
        originX: stickOrigin.x,
        originY: stickOrigin.y,
        knobX: stickOrigin.x + knob.x,
        knobY: stickOrigin.y + knob.y,
      };
    },
    tapSuppressed(now) {
      return now < suppressUntil;
    },
    engaged() {
      return engaged;
    },
  };
}
