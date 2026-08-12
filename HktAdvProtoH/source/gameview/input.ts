// 입력 → Command 의도 변환기 — World 상태를 직접 만지지 않는다 (Rule 4).
// WASD/화살표 = 이동 방향 의도, E = 채굴 의도. Integration 층이 콜백으로 Command 를 만든다.

export interface InputIntent {
  direction: { dx: number; dz: number } | null; // 이동 의도 (없으면 null)
  minePressed: boolean; // 이번 프레임 채굴 의도
}

export class InputReader {
  private keys = new Set<string>();
  private mineQueued = false;

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.mineQueued = true;
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
  }

  poll(): InputIntent {
    let dx = 0;
    let dz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    const minePressed = this.mineQueued;
    this.mineQueued = false;
    return {
      direction: dx !== 0 || dz !== 0 ? { dx, dz } : null,
      minePressed,
    };
  }
}
