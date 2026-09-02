// Pointer Look (범용 엔진) — 끌어서 시점을 돌린다.
//
// 세계에 아무것도 요청하지 않는다. 시점은 관찰자의 것이므로 (04 viewpoint.owner: observer)
// 이 입력은 Action Request 가 되지 않는다 — 관찰자 자신의 방향만 바꾼다.
//
// 오른쪽 버튼으로 끈다. 왼쪽 클릭은 지금까지대로 이동·상호작용 요청이며
// (view/input/input.ts), 브라우저는 왼쪽 버튼에만 click 을 내므로 둘은 섞이지 않는다.

/** 화면에서 1픽셀 끌었을 때 도는 각 (rad) */
export const TURN_PER_PIXEL = 0.006;
export const TILT_PER_PIXEL = 0.004;

export type LookSink = (dTurn: number, dTilt: number) => void;

export function attachPointerLook(element: HTMLElement, look: LookSink): void {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  element.addEventListener('contextmenu', (ev) => ev.preventDefault());

  element.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 2) return; // 오른쪽 버튼만 시점 조작이다
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    element.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });

  element.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    // 오른쪽으로 끌면 시점이 오른쪽을 향한다. 아래로 끌면 시점이 낮아져 지평선이 올라온다.
    // 프레임마다 조금씩 더해지므로 방향은 이어진 채 바뀐다 (04 continuity: required).
    look(-dx * TURN_PER_PIXEL, -dy * TILT_PER_PIXEL);
  });

  const release = (ev: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (element.hasPointerCapture(ev.pointerId)) element.releasePointerCapture(ev.pointerId);
  };
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  window.addEventListener('blur', () => {
    dragging = false;
  });
}
