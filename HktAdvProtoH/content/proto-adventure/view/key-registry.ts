// 팩이 듣는 손가락 자리의 **단일 출처** (V-003 · UX 문서 §4.1
// "화면에 표시한 힌트와 실제 바인딩은 반드시 같은 Registry").
//
// 이 파일이 서기 전까지 키는 **두 곳에 따로** 살았다. 무엇을 듣는지는 `bindings.ts` 의
// 코드(`KeyB` · `Comma` …)가, 화면에 무엇이라 뜨는지는 presentation 파일들의 표기
// 상수(`'B'` · `','` …)가 쥐었고, 둘을 잇는 것은 아무것도 없었다. 한쪽만 고치면 화면은
// 있지도 않은 키를 안내하고, 그것을 눌러 본 사람만이 그 사실을 안다.
//
// 그래서 여기서는 **코드 하나만** 적고 표기는 코드에서 만든다. 갈라질 자리 자체가 없다.
//
// ── 이 표가 담는 것과 담지 않는 것 ───────────────────────────────────
//
//     담는다      팩이 자기 규칙으로 듣는 키 (`view/bindings.ts` 의 KEY_BINDINGS) 와
//                 그 키가 화면에 뜰 때의 표기.
//                 기반이 먼저 가져가는 자리에 **줄 이름**도 담는다 (아래 ENGINE_KEY_TEXT) —
//                 코드는 기반이 소유하고(ENGINE_KEYS) 사람이 읽는 말은 팩의 것이다
//     담지 않는다  interaction 의 키 (`interaction-presentation.ts` 가 이미 role 마다
//                 하나씩 쥐고 있다 — 그쪽은 세계가 실어 온 목록에 붙는다)
//                 기반 키의 **코드** (원본은 `engine/view-kernel/input/engine-keys.ts`)
//
import { ENGINE_KEYS, type EngineKeyId } from '../../../engine/view-kernel/input/engine-keys';

// 검사는 `view/tests/key-hints.spec.ts` 가 한다. 표기가 코드에서 나오므로 "둘이
// 어긋난다" 는 이제 **다른 형태**로만 일어난다 — 등록했는데 듣지 않거나, 듣는데
// 등록하지 않거나, 남이 먼저 가져간 키를 등록하는 것. 검사가 그 셋을 잡는다.

/**
 * 코드 → 화면 표기. **여기 없는 코드는 표기를 만들 수 없다** — 새 키를 쓰려면
 * 이 표에 한 줄이 늘어야 하고, 그 한 줄이 곧 "화면에 무엇이라 뜨는가" 다.
 */
const LABEL_OF_CODE: Record<string, string> = {
  KeyB: 'B',
  KeyN: 'N',
  KeyM: 'M',
  KeyI: 'I',
  KeyQ: 'Q',
  Comma: ',',
  Enter: 'Enter',
  Escape: 'Esc',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`Digit${i + 1}`, `${i + 1}`])),
};

export interface PackKey {
  /** KeyboardEvent.code — `bindings.ts` 가 실제로 듣는 것 */
  code: string;
  /** 무엇을 부르는가 — 사람이 읽는 이름 (안내 문구를 짓는 쪽이 쓴다) */
  what: string;
  /**
   * 표면이 열린 동안에만 듣는가.
   *
   * 방향키와 Enter 가 그렇다. 이 키들은 평소 엔진이 이동으로 먼저 가져가지만
   * (RESERVED_KEY_CODES), 표면이 열리면 조립 루트가 이동을 멈추므로 팩까지 온다
   * (`app/main.ts` 의 suspendMovement). **그 사정을 여기 적어 두지 않으면**
   * 아래 검사가 "남이 먼저 가져간 키" 로 잡는다.
   */
  whileSurfaceOpen?: boolean;
  /**
   * 듣는 것이 팩이 아닌 자리.
   *
   * `Escape` 가 그렇다 — 표면을 닫는 것은 기반의 표면 능력이며
   * (`engine/view-kernel/hud/surface.ts` 가 붙잡는 단계에서 받는다) 팩의 KEY_BINDINGS
   * 에 없다. 그래도 **화면에는 뜬다**(`닫기 Esc`). 뜨는 표기의 출처가 하나여야 하므로
   * 표에는 있고, 팩이 듣는지는 묻지 않는다.
   */
  boundBy?: 'engine';
  /**
   * 이 키가 **가리는** interaction 역할.
   *
   * 팩의 규칙이 interaction 보다 먼저 불린다 (`app/main.ts` — 바인딩을 찾으면 거기서
   * 끝난다). 그래서 같은 코드를 쓰는 interaction 은 키로 닿지 못한다.
   * 가림이 뜻한 것일 때만 이 자리에 적으며, 적히지 않은 가림은 검사가 잡는다 —
   * 표에도 있고 안내에도 뜨는데 눌러도 아무 일이 없는 조작이 C025 에서 실제로 있었다.
   */
  shadows?: string;
  /**
   * 같은 뜻의 **다른 자리** — 오른쪽 Shift 처럼 손이 둘인 키다.
   *
   * 사람에게는 하나의 키이므로 안내에 두 번 서지 않는다. 듣기는 둘 다 듣는다 —
   * 왼손잡이의 Shift 가 안 먹는 것은 안내의 문제가 아니라 조작의 결손이다.
   */
  sameAs?: string;
}

/**
 * 팩의 키들. **키를 늘리는 곳은 여기 하나다** — `bindings.ts` 는 여기서 코드를 받고,
 * 화면 문구는 여기서 표기를 받는다.
 */
export const PACK_KEYS = {
  guard: {
    code: 'KeyQ',
    what: '막기',
    // 세계에는 걸기와 놓기가 따로 있고 화면에서는 한 키로 오간다 — 그래서 걸기 쪽
    // interaction 의 키를 팩 규칙이 가린다 (bindings.ts 의 guardToggle)
    shadows: 'guard-begin',
  },
  moveModeLeft: { code: 'ShiftLeft', what: '달리기 전환', shadows: 'set-move-mode' },
  moveModeRight: { code: 'ShiftRight', what: '달리기 전환', sameAs: 'moveModeLeft' },
  discard: { code: 'KeyB', what: '덜어내기' },
  equip: { code: 'KeyN', what: '걸기' },
  unequip: { code: 'KeyM', what: '풀기' },
  exchange: { code: 'Comma', what: '바꿔 걸기' },
  inventory: { code: 'KeyI', what: '가진 것' },
  pickLeft: { code: 'ArrowLeft', what: '고르기', whileSurfaceOpen: true },
  pickRight: { code: 'ArrowRight', what: '고르기', whileSurfaceOpen: true },
  actionUp: { code: 'ArrowUp', what: '행동', whileSurfaceOpen: true },
  actionDown: { code: 'ArrowDown', what: '행동', whileSurfaceOpen: true },
  invoke: { code: 'Enter', what: '실행', whileSurfaceOpen: true },
  close: {
    code: 'Escape',
    what: '닫기',
    boundBy: 'engine',
    // **표면이 열린 동안에만** 가린다 — 기반의 표면 능력이 붙잡는 단계에서 Escape 를
    // 받아 멈춰 세우므로(engine/view-kernel/hud/surface.ts) 그때 `지목 해제`는 닿지
    // 않는다. 닫혀 있으면 그대로 닿는다. 이 사실은 V-003 의 검사가 찾아냈다 —
    // 어느 파일도 적어 두지 않은 채 참이던 것이다
    shadows: 'clear-target',
  },
  // 칸 번호 아홉. **손으로 적는다** — 만들어 넣으면 이 표의 이름들이 형에서 사라지고,
  // 그러면 `keyLabel('slot3')` 같은 잘못된 이름을 형이 잡아 주지 못한다
  slot1: { code: 'Digit1', what: '소지품 칸' },
  slot2: { code: 'Digit2', what: '소지품 칸' },
  slot3: { code: 'Digit3', what: '소지품 칸' },
  slot4: { code: 'Digit4', what: '소지품 칸' },
  slot5: { code: 'Digit5', what: '소지품 칸' },
  slot6: { code: 'Digit6', what: '소지품 칸' },
  slot7: { code: 'Digit7', what: '소지품 칸' },
  slot8: { code: 'Digit8', what: '소지품 칸' },
  slot9: { code: 'Digit9', what: '소지품 칸' },
} satisfies Record<string, PackKey>;

export type PackKeyId = keyof typeof PACK_KEYS;

/** 그 키가 화면에 뜰 때의 표기 — **코드에서 나온다.** 표에 없는 코드는 코드 그대로다 */
export function keyLabel(id: PackKeyId): string {
  const code = PACK_KEYS[id].code;
  return LABEL_OF_CODE[code] ?? code;
}

/** 그 키의 코드 — `bindings.ts` 가 듣는 값 */
export function keyCode(id: PackKeyId): string {
  return PACK_KEYS[id].code;
}

/**
 * 소지품 칸 번호들 — 화면이 칸에 붙이는 표기 아홉을 순서대로 낸다.
 *
 * 소지품 띠 · 걸어 둔 것 패널이 각자 같은 배열을 적어 두던 자리다. 숫자 키가 옮겨 가면
 * 세 곳이 함께 옮겨져야 하므로 표가 한 번에 낸다.
 */
export const SLOT_KEY_IDS = [
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9',
] as const satisfies readonly PackKeyId[];

export const SLOT_KEY_LABELS: readonly string[] = SLOT_KEY_IDS.map((id) => keyLabel(id));

/**
 * 기반이 먼저 가져가는 자리에 **팩이 주는 이름** (기반 부채 ②).
 *
 * 그 넷은 지금까지 `engine/view-kernel/hud/hud.ts` 안에 한국어 문장으로 박혀 있었다 —
 * 팩을 갈아 끼워도 그 줄만은 이 세계의 말로 떠 있었다는 뜻이다. 코드는 여전히 기반의
 * 것이고(어느 키를 먼저 삼키는지는 기반이 안다), **부르는 말만** 여기로 왔다.
 *
 * 시점(`turn`)은 뺀다 — 지금까지도 안내에 서지 않았고, 이 작업은 말의 자리를 옮길 뿐
 * 화면에 없던 줄을 새로 세우지 않는다.
 */
const ENGINE_KEY_TEXT: Partial<Record<EngineKeyId, { what: string; keys: string }>> = {
  // 명령이 맨 위다 — 여기부터가 "무엇을 할 수 있는지" 의 입구이고,
  // 아래 둘은 그 목록에도 있는 것의 지름길이다 (C009)
  command: { what: '명령', keys: '/' },
  move: { what: '이동', keys: 'WASD / 방향키' },
  colliderObserve: { what: '충돌체 관찰', keys: 'C' },
  attributeInspect: { what: '속성 관찰', keys: 'V' },
};

/** 기반 키의 안내 줄 — 패널의 위 네 줄이다 */
export function engineKeyHints(): string[] {
  return (Object.keys(ENGINE_KEYS) as EngineKeyId[])
    .filter((id) => ENGINE_KEY_TEXT[id] !== undefined)
    .map((id) => `${ENGINE_KEY_TEXT[id]!.what}: ${ENGINE_KEY_TEXT[id]!.keys}`);
}

/**
 * 조작 안내 패널에 설 줄들 (V-005 · 기반 부채 ②) — `<무엇>: <표기>` 꼴이다.
 * 기반 키 넷이 먼저 서고 팩의 키가 그 아래에 선다.
 *
 * **팩 쪽에서 여기 서는 것은 팩만의 키다.** 셋을 뺀다.
 *   · 표면이 열린 동안에만 듣는 키 (방향키·Enter) — 그 안내는 표면 자신의 아래 줄이
 *     이미 지닌다. 늘 떠 있는 패널에 두면 표면이 닫혀 있을 때 거짓이 된다
 *   · 칸 번호 아홉 — 무엇을 부르는지가 소지품 줄에 이미 번호로 붙어 있다
 *   · interaction 을 가리는 키 (막기 Q · 달리기 Shift) — 그 줄은 세계가 실어 온
 *     목록에서 이미 서고, 여기 또 두면 한 화면에 같은 말이 두 번이다
 *     (같은 뜻의 다른 자리 `sameAs` 도 같은 이유로 빠진다 — 오른쪽 Shift)
 *
 * 남는 것이 곧 **한 번도 뜬 적 없던 다섯**이다 — 가진 것 · 덜어내기 · 걸기 · 풀기 ·
 * 바꿔 걸기.
 */
export function panelKeyHints(): string[] {
  return [
    ...engineKeyHints(),
    ...packKeys()
      .filter((k) => !k.whileSurfaceOpen && k.boundBy !== 'engine' && k.shadows === undefined)
      .filter((k) => k.sameAs === undefined)
      .filter((k) => !k.code.startsWith('Digit'))
      .map((k) => `${k.what}: ${keyLabel(k.id as PackKeyId)}`),
  ];
}

/** 검증용 — 표가 쥔 전부 */
export function packKeys(): (PackKey & { id: string })[] {
  return Object.entries(PACK_KEYS).map(([id, key]) => ({ id, ...(key as PackKey) }));
}

/** 검증용 — 코드에 표기가 있는가 (없으면 화면이 코드를 그대로 뱉는다) */
export function hasLabel(code: string): boolean {
  return LABEL_OF_CODE[code] !== undefined;
}
