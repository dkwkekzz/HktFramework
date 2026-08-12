// Keyboard Input — WASD/방향키 이동 방향과 E(채굴) 입력을 추적한다.
// 상태를 바꾸지 않는다 — 조립 루트가 이 방향을 Move Action Request 로 변환한다.

export interface KeyboardState {
  /** 현재 눌린 이동 방향 (정규화, 없으면 null) */
  direction(): { x: number; z: number } | null;
  /** E 가 이번에 눌렸으면 true 를 한 번만 돌려준다 */
  consumeMinePressed(): boolean;
}

const MOVE_KEYS: Record<string, { x: number; z: number }> = {
  KeyW: { x: 0, z: -1 },
  ArrowUp: { x: 0, z: -1 },
  KeyS: { x: 0, z: 1 },
  ArrowDown: { x: 0, z: 1 },
  KeyA: { x: -1, z: 0 },
  ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

export function attachKeyboard(): KeyboardState {
  const pressed = new Set<string>();
  let minePressed = false;

  window.addEventListener('keydown', (ev) => {
    if (ev.code in MOVE_KEYS) {
      pressed.add(ev.code);
      ev.preventDefault();
    }
    if (ev.code === 'KeyE' && !ev.repeat) minePressed = true;
  });
  window.addEventListener('keyup', (ev) => pressed.delete(ev.code));
  window.addEventListener('blur', () => pressed.clear());

  return {
    direction() {
      let x = 0;
      let z = 0;
      for (const code of pressed) {
        const d = MOVE_KEYS[code];
        if (d) {
          x += d.x;
          z += d.z;
        }
      }
      if (x === 0 && z === 0) return null;
      const len = Math.sqrt(x * x + z * z);
      return { x: x / len, z: z / len };
    },
    consumeMinePressed() {
      const was = minePressed;
      minePressed = false;
      return was;
    },
  };
}
