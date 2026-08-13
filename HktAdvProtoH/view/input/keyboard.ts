// Keyboard Input (범용 엔진) — 이동 방향키와 그 외 눌린 키 코드를 추적한다.
// 어떤 키가 어떤 interaction 인지는 Interaction Registry 가 정한다.
// 상태를 바꾸지 않는다 — 조립 루트가 이를 Action Request 로 변환한다.

export interface KeyboardState {
  /** 현재 눌린 이동 방향 (정규화, 없으면 null) */
  direction(): { x: number; z: number } | null;
  /** 이번 프레임에 눌린 (이동 외) 키 코드들을 한 번만 돌려준다 */
  consumeKeyPresses(): string[];
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
  let keyPresses: string[] = [];

  window.addEventListener('keydown', (ev) => {
    if (ev.code in MOVE_KEYS) {
      pressed.add(ev.code);
      ev.preventDefault();
      return;
    }
    if (!ev.repeat) keyPresses.push(ev.code);
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
    consumeKeyPresses() {
      const was = keyPresses;
      keyPresses = [];
      return was;
    },
  };
}
