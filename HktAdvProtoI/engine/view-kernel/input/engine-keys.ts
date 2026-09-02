// 기반이 먼저 가져가는 손가락 자리 — **원본이자 단일 출처** (문구 반전 ⑤).
//
// 이 파일이 서기 전까지 이 사실은 세 곳에 흩어져 있었다. 이동·시점은
// `input/keyboard.ts` 가, 명령·관찰 토글은 조립 루트(`app/main.ts`)의 상수가,
// 그리고 "무엇이 예약되어 있는가" 는 팩이 손으로 적어 둔 **사본**이 쥐고 있었다
// (`view/interaction-presentation.ts` 의 RESERVED_KEY_CODES — 그 파일이 스스로
// "사본인 동안에는 검사가 어긋남을 잡는다" 고 적어 둔 자리다).
//
// 사본은 원본이 늘 때 조용히 낡는다. 실제로 그렇게 걸린 적이 있다 — 표에도 있고
// 안내에도 뜨는데 눌러도 아무 일이 없는 조작이 두 개 있었다.
//
// ── 여기 있는 것과 없는 것 ───────────────────────────────────────────
//
//     있다    무슨 자리가 있고 그 자리가 **어떤 코드**를 먼저 가져가는가
//     없다    그 자리를 **무엇이라 부르는가**. 이름은 사람이 읽는 말이고,
//             사람이 읽는 말은 전부 컨텐츠 팩의 것이다 (문구 반전 ⑤).
//             팩이 `view/key-registry.ts` 에서 이 자리들에 이름을 준다

import { MOVE_KEY_CODES, TURN_KEY_CODES } from './keyboard';

export const ENGINE_KEYS = {
  /** 명령 표면을 여는 자리 — 조립 루트가 interaction 보다 먼저 가로챈다 */
  command: { codes: ['Slash'] },
  /** 이동 — `keyboard.ts` 가 눌린 순간 삼킨다 (표면이 열려 있지 않은 동안) */
  move: { codes: MOVE_KEY_CODES },
  /** 시점 — 이동과 같은 자리에서 삼켜진다 */
  turn: { codes: TURN_KEY_CODES },
  /** 충돌체 관찰 토글 — 세계에 아무것도 요청하지 않는 관찰자 쪽 결정 */
  colliderObserve: { codes: ['KeyC'] },
  /** 속성 관찰 토글 — 같은 성격의 자리 */
  attributeInspect: { codes: ['KeyV'] },
} as const satisfies Record<string, { codes: readonly string[] }>;

export type EngineKeyId = keyof typeof ENGINE_KEYS;

/** 그 자리의 첫 코드 — 코드가 하나뿐인 자리(명령·관찰 토글)가 쓴다 */
export function engineKeyCode(id: EngineKeyId): string {
  return ENGINE_KEYS[id].codes[0]!;
}

/**
 * 기반이 먼저 가져가는 코드 **전부**.
 *
 * 팩은 이것으로 자기 키가 남의 자리와 겹치는지 잰다. 사본이 아니라 원본을 읽으므로,
 * 기반이 자리를 늘리면 팩의 검사가 다음 실행에서 바로 그것을 본다.
 */
export const ENGINE_KEY_CODES: readonly string[] = Object.values(ENGINE_KEYS).flatMap((key) => [
  ...key.codes,
]);

/**
 * 그 자리를 **무엇이라 부르는가** 를 묻는 문구 코드.
 *
 * 이름 자체는 여기 없다 (위 머리말) — 기반은 코드를 부르고 팩의 문구 표가 말을 준다.
 * 한 자리에 한 이름이므로, 안내 줄에 서는 말과 손가락 버튼에 적히는 말이 갈라질 수 없다.
 */
export function engineKeyTextCode(id: EngineKeyId): string {
  return `engine.key.${id}`;
}

/** 팩이 이름을 주어야 하는 자리 전부 — 덮지 못한 것은 팩의 검사가 잡는다 */
export const ENGINE_KEY_TEXT_CODES: readonly string[] = (
  Object.keys(ENGINE_KEYS) as EngineKeyId[]
).map(engineKeyTextCode);
