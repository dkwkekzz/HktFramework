// 가상 조이스틱 (Phase-9 §9.3) — 모바일 MMORPG 관례의 좌하단 이동 스틱.
//
// DOM 과 포인터 이벤트만 안다 — 시뮬레이션 의미는 없다. 방향 벡터(-1~1)를 입력층에 넘길 뿐이다.

export interface JoystickState {
  /** 정규화 방향 (-1~1). 스틱을 놓으면 undefined */
  direction?: { x: number; y: number };
}

const DEAD_ZONE = 0.18;

export class VirtualJoystick {
  readonly state: JoystickState = {};
  private pointerId: number | undefined;

  constructor(
    private readonly base: HTMLElement,
    private readonly knob: HTMLElement,
  ) {
    base.addEventListener("pointerdown", (event) => this.begin(event));
    base.addEventListener("pointermove", (event) => this.track(event));
    base.addEventListener("pointerup", (event) => this.end(event));
    base.addEventListener("pointercancel", (event) => this.end(event));
  }

  private begin(event: PointerEvent): void {
    if (this.pointerId !== undefined) return;
    this.pointerId = event.pointerId;
    this.base.setPointerCapture(event.pointerId);
    this.track(event);
  }

  private track(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    const rect = this.base.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = (event.clientX - (rect.left + radius)) / radius;
    let dy = (event.clientY - (rect.top + radius)) / radius;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    this.knob.style.transform = `translate(${dx * radius * 0.55}px, ${dy * radius * 0.55}px)`;
    if (length < DEAD_ZONE) delete this.state.direction;
    else this.state.direction = { x: dx, y: dy };
  }

  private end(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = undefined;
    delete this.state.direction;
    this.knob.style.transform = "translate(0, 0)";
  }
}
