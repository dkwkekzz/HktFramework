// Keyboard Input (범용 엔진) — 이동 방향키와 그 외 눌린 키 코드를 추적한다.
// 어떤 키가 어떤 interaction 인지는 Interaction Registry 가 정한다.
// 상태를 바꾸지 않는다 — 조립 루트가 이를 Action Request 로 변환한다.

export interface KeyboardState {
  /** 현재 눌린 이동 방향 (정규화, 없으면 null) — 관찰자 기준이다 (C008) */
  direction(): { x: number; z: number } | null;
  /**
   * 현재 눌린 시점 조작 (C008) — 도는 쪽과 기우는 쪽의 부호만 준다.
   * 얼마나 빨리 도는지는 이 값을 받는 쪽이 정한다. 없으면 null.
   */
  turn(): { turn: number; tilt: number } | null;
  /** 이번 프레임에 눌린 (이동·시점 외) 키 코드들을 한 번만 돌려준다 */
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

// 시점 조작 키 (C008) — 마우스가 없어도 시점을 돌릴 수 있어야 한다.
// 상호작용 키(E·F·G·Shift)와 관찰 토글(C·V)을 피해 배치한다.
//   Z / X  왼쪽으로 · 오른쪽으로 돈다
//   R / T  올려다본다 (지평선) · 내려다본다
const TURN_KEYS: Record<string, { turn: number; tilt: number }> = {
  KeyZ: { turn: 1, tilt: 0 },
  KeyX: { turn: -1, tilt: 0 },
  KeyR: { turn: 0, tilt: -1 },
  KeyT: { turn: 0, tilt: 1 },
};

export function attachKeyboard(): KeyboardState {
  const pressed = new Set<string>();
  let keyPresses: string[] = [];

  window.addEventListener('keydown', (ev) => {
    if (ev.code in MOVE_KEYS || ev.code in TURN_KEYS) {
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
    turn() {
      let turn = 0;
      let tilt = 0;
      for (const code of pressed) {
        const t = TURN_KEYS[code];
        if (t) {
          turn += t.turn;
          tilt += t.tilt;
        }
      }
      if (turn === 0 && tilt === 0) return null;
      return { turn, tilt };
    },
    consumeKeyPresses() {
      const was = keyPresses;
      keyPresses = [];
      return was;
    },
  };
}
