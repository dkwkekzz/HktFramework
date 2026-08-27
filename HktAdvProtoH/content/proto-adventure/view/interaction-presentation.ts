// Interaction Presentation — Interaction Role 의 입력 바인딩·프롬프트를 결정한다
// (결정 Layer 데이터). role 당 단일 항목 — Cycle 별로 분리하지 않는다.

import { ENGINE_KEY_CODES } from '../../../engine/view-kernel/input/engine-keys';

export interface InteractionPresentation {
  key?: string; // KeyboardEvent.code
  keyLabel?: string;
  prompt?: string;
  terrainTarget?: boolean;
  /**
   * 바닥 프롬프트에서 앞자리를 다투는 순서 — **작을수록 먼저** (기본 50).
   *
   * 그리는 쪽은 키 지시가 있는 것들 중 **첫 번째**를 골라 프롬프트로 삼는다
   * (가용한 것 우선, 없으면 첫 불가 사유). 그래서 목록의 순서가 곧 "지금 무엇이
   * 눈앞에 뜨는가" 이며, 그 순서를 정하는 것은 화면의 일이다.
   *
   * 이 값이 생기기 전에는 세계가 보낸 순서 그대로였고, 거의 언제나 가용한
   * `지목 해제`(Esc)가 앞에 있어 **프롬프트가 영영 그것으로 고정되어 있었다** —
   * 정작 사람이 알아야 할 "왜 못 캐는가" 는 한 번도 뜨지 못했다.
   *
   * 순서의 뜻: 상대에게 하는 일 → 내 몸을 다루는 일 → 판을 정리하는 일.
   */
  priority?: number;
}

/** 순서를 밝히지 않은 역할의 자리 — 주된 것과 정리하는 것의 사이다 */
export const DEFAULT_INTERACTION_PRIORITY = 50;

const INTERACTIONS: Record<string, InteractionPresentation> = {
  'move-to': { terrainTarget: true },
  // C017 CHANGED — 대상이 사라졌다. 이제 고른 것을 캐므로 키 하나로 부른다
  // (예전에는 광맥마다 실려 그 몸을 눌러 불렀다).
  'mine-deposit': { priority: 10, key: 'KeyE', keyLabel: 'E', prompt: '채굴' },
  'attack-swing': { priority: 12, key: 'KeyF', keyLabel: 'F', prompt: '공격' }, // C002 role (C007 이전)
  // C007 — 휘두름이 스킬 둘로 갈렸다. 기본은 기존 자리(F)를 그대로 쓴다.
  'skill-basic': { priority: 12, key: 'KeyF', keyLabel: 'F', prompt: '기본 스킬' },
  'skill-heavy': { priority: 13, key: 'KeyG', keyLabel: 'G', prompt: '고급 스킬' },
  // C012 — 오라 스킬. 기본 스킬(F) 과 나란히 둔다 — 둘은 세기가 아니라
  // 방식으로 갈리는 선택이므로 나란히 놓여야 고르는 일로 읽힌다.
  //
  // C025 CHANGED — **R 에서 H 로 옮겼다.** `KeyR` 은 엔진이 시점 조작에 이미 쓰고 있고
  // (`engine/view-kernel/input/keyboard.ts` 의 TURN_KEYS — R 올려다보기 · T 내려다보기),
  // 그 키들은 눌린 순간 삼켜져 interaction 까지 오지 않는다. 그래서 **C012 이래로
  // 오라 스킬은 키보드로 부를 수 없었다** — 표에는 있고 화면 안내에도 떴지만
  // 눌러도 아무 일이 없었다. 아래 RESERVED_KEY_CODES 가 이것이 다시 생기지 않게 한다.
  'skill-aura': { priority: 14, key: 'KeyH', keyLabel: 'H', prompt: '오라 스킬' },
  // C-COMBAT-003 — 발현 일격. 세계의 사정을 지는 첫 기술이며, 화면에서는 **다른 기술과
  // 똑같은 한 칸**이다 (skill-presentation 이 이름으로 가르지 않는다).
  //
  // 자리를 F·G·H 옆에 두지 못했다 — `KeyJ`~`KeyL` 은 표면 안의 조작이 쥐고 있고,
  // `KeyZ`·`KeyX`·`KeyR`·`KeyT` 는 시점이, `KeyC`·`KeyV` 는 관찰 토글이 기반에서 먼저
  // 가져간다 (engine-keys.ts). 남은 글자가 `KeyO`·`KeyP` 둘뿐이라 앞의 것으로 간다.
  // **기술이 늘수록 이 자리 찾기가 좁아진다** — 08 MASTER FEEDBACK 에 적는다.
  'skill-hatsu': { priority: 16, key: 'KeyO', keyLabel: 'O', prompt: '발현 일격' },
  // 막기 (C011) — 세계에는 걸기와 놓기가 따로 있다(명시값). 화면에서는 한 키로 오간다.
  // 어떤 손짓으로 그 둘을 부를지는 View 의 결정이며, 이동 모드가 이미 같은 모양이다.
  // 그래서 키는 걸기 쪽에만 두고, 오가는 것은 조립 루트가 다룬다 —
  // 두 항목 모두에 키를 두면 같은 키에 두 요청이 걸려 어느 쪽이 나갈지 알 수 없다.
  'guard-begin': { priority: 30, key: 'KeyQ', keyLabel: 'Q', prompt: '막기' },
  'guard-release': {},
  // 이동 모드는 값을 실어 보내야 하므로(walk | run) 조립 루트가 직접 다룬다.
  // 여기서는 안내에 쓸 키 표기만 정한다.
  'set-move-mode': { priority: 40, key: 'ShiftLeft', keyLabel: 'Shift', prompt: '달리기 전환' },
  // 살펴봄 (C014 → C017 CHANGED) — **이제 키를 둔다.**
  // C014 가 키를 두지 않은 이유는 "키는 대상을 고를 수단이 없다" 였다. 그 이유가
  // 사라졌다: 대상을 고르는 수단이 세계에 생겼고(select-target), 살펴봄은 고른 것으로
  // 나간다. View 가 선택 규칙을 발명하는 일도 없다 — 무엇을 살펴볼지는 세계가 지닌다.
  // C025 CHANGED — **T 에서 Y 로 옮겼다.** 오라 스킬과 똑같은 결손이었다
  // (`KeyT` 는 엔진의 내려다보기다). 이 Cycle 의 일이 아니지만, 눌러도 아무 일이
  // 없는 조작을 알고도 두는 것이 더 나쁘다. 08 MASTER FEEDBACK 에 함께 적는다.
  'observe-character': { priority: 15, key: 'KeyY', keyLabel: 'Y', prompt: '살펴보기' },
  // 고르기 (C017) — 존재마다 실린다. 그 몸을 눌러 부르므로 키를 두지 않는다.
  // 이 자리가 곧 "화면에서 존재를 짚으면 무슨 요청이 되는가" 의 답이다.
  'select-target': { prompt: '지목' },
  // 풀기 (C017) — 대상이 없는 interaction 이므로 키로 부른다.
  'clear-target': { priority: 90, key: 'Escape', keyLabel: 'Esc', prompt: '지목 해제' },
  // 속성 변경 (C007 R2) — 이번 Cycle 은 경로만 연다. 조작 수단은 이후 Cycle 이 얹는다.
  'debug-set-attribute': {},
  // 되돌림 (C014) — 명령 한 줄로 부른다 (command-request). 키를 두지 않는다.
  'debug-forget-acquaintance': {},
};

/**
 * 조립 루트보다 **먼저** 키를 가져가는 자리들 — 여기 있는 코드를 interaction 에 주면
 * 그 조작은 눌러도 아무 일이 없다.
 *
 * **더 이상 사본이 아니다** (문구 반전 ⑤). 이 목록은 손으로 적혀 있었고, 그 자리에
 * "원본은 기반의 두 파일이며 팩이 읽을 수 있게 내보내지 않는다 — 그것을 내보내는 것은
 * 기반 트랙의 일" 이라고 적혀 있었다. 기반이 그것을 내보냈다
 * (`engine/view-kernel/input/engine-keys.ts` — 이동·시점·명령·관찰 토글 한 자리).
 * 이제 원본이 늘면 이 목록도 같은 실행에서 함께 는다.
 */
export const RESERVED_KEY_CODES: readonly string[] = ENGINE_KEY_CODES;

export function interactionPresentation(role: string): InteractionPresentation {
  return INTERACTIONS[role] ?? {};
}

/** 검증용 — 지금 표가 쥐고 있는 (역할, 키) 전부 */
export function boundKeys(): { role: string; key: string }[] {
  return Object.entries(INTERACTIONS)
    .filter(([, p]) => p.key !== undefined)
    .map(([role, p]) => ({ role, key: p.key as string }));
}

/** 이 역할이 프롬프트 자리를 다투는 순서 — 밝히지 않았으면 가운데 자리다 */
export function interactionPriority(role: string): number {
  return INTERACTIONS[role]?.priority ?? DEFAULT_INTERACTION_PRIORITY;
}
