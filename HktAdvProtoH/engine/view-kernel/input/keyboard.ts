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
  /**
   * 지금 이동을 몰고 있지 않다고 알린다 — 표면이 자판을 잡고 있을 때다.
   *
   * 멈추는 동안 방향키와 시점키는 **이동이 아니라 평범한 키**가 된다. 겹쳐 뜬 표면에서
   * 방향키로 고르는 것이 이동과 같은 키인 것은 우연이 아니라 당연한 일이며, 그 키가
   * 여기서 삼켜지면 표면은 자판으로 닿을 수 없다.
   *
   * 멈춘 동안 눌려 있던 것도 잊는다 — 잡히기 전에 누르고 있던 방향이 표면을 닫는
   * 순간 되살아나면, 겪는 사람이 지시하지 않은 걸음이 된다.
   */
  suspendMovement(suspended: boolean): void;
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

// 이 키들은 이동을 몰고 있는 동안 눌린 순간 삼켜져 interaction 까지 오지 않는다.
// 팩이 자기 키 배치가 여기와 겹치지 않는지 검사하려면 원본을 읽을 수 있어야 한다 —
// 사본을 두면 원본이 늘어날 때 사본이 조용히 낡는다 (C025 · C026 이 실제로 겪었다).
/** 이동 방향키 코드 원본 (KeyboardEvent.code) */
export const MOVE_KEY_CODES: readonly string[] = Object.keys(MOVE_KEYS);
/** 시점 조작키 코드 원본 (KeyboardEvent.code) */
export const TURN_KEY_CODES: readonly string[] = Object.keys(TURN_KEYS);

export function attachKeyboard(): KeyboardState {
  const pressed = new Set<string>();
  let keyPresses: string[] = [];
  let suspended = false;

  window.addEventListener('keydown', (ev) => {
    if (ev.code in MOVE_KEYS || ev.code in TURN_KEYS) {
      // 이동을 몰지 않는 동안 이 키들은 평범한 키다 — 삼키지 않고 흘려보낸다
      if (suspended) {
        ev.preventDefault(); // 화면이 스크롤되지 않게
        if (!ev.repeat) keyPresses.push(ev.code);
        return;
      }
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
      if (suspended) return null;
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
      if (suspended) return null;
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
    suspendMovement(next) {
      if (next === suspended) return;
      suspended = next;
      // 잡히는 순간 눌려 있던 것을 잊는다 — 놓는 것을 못 볼 수 있기 때문이다
      pressed.clear();
    },
  };
}
