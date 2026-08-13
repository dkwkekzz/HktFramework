// Keyboard Input — WASD/방향키 이동 방향과 그 밖의 문자 키 입력을 추적한다.
// 상태를 바꾸지 않고, 어떤 키가 무엇을 뜻하는지도 모른다 — 뜻은 Snapshot 의 interactions 가 정한다.

export interface KeyboardState {
  /** 현재 눌린 이동 방향 (정규화, 없으면 null) */
  direction(): { x: number; z: number } | null;
  /** 이번에 눌린 문자 키들을 한 번만 돌려준다 (예: ['E']) */
  consumeKeys(): string[];
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
  const struck = new Set<string>();

  window.addEventListener('keydown', (ev) => {
    if (ev.code in MOVE_KEYS) {
      pressed.add(ev.code);
      ev.preventDefault();
    }
    // 이동에 쓰이지 않는 문자 키는 그대로 모아둔다 — 의미 부여는 조립 루트가 한다
    const letter = /^Key([A-Z])$/.exec(ev.code)?.[1];
    if (letter && !ev.repeat && !(ev.code in MOVE_KEYS)) struck.add(letter);
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
    consumeKeys() {
      const keys = [...struck];
      struck.clear();
      return keys;
    },
  };
}
