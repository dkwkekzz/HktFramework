// Interaction Presentation — Interaction Role 의 입력 바인딩·프롬프트를 결정한다
// (결정 Layer 데이터). role 당 단일 항목 — Cycle 별로 분리하지 않는다.

export interface InteractionPresentation {
  key?: string; // KeyboardEvent.code
  keyLabel?: string;
  prompt?: string;
  terrainTarget?: boolean;
}

const INTERACTIONS: Record<string, InteractionPresentation> = {
  'move-to': { terrainTarget: true },
  // C017 CHANGED — 대상이 사라졌다. 이제 고른 것을 캐므로 키 하나로 부른다
  // (예전에는 광맥마다 실려 그 몸을 눌러 불렀다).
  'mine-deposit': { key: 'KeyE', keyLabel: 'E', prompt: '채굴' },
  'attack-swing': { key: 'KeyF', keyLabel: 'F', prompt: '공격' }, // C002 role (C007 이전)
  // C007 — 휘두름이 스킬 둘로 갈렸다. 기본은 기존 자리(F)를 그대로 쓴다.
  'skill-basic': { key: 'KeyF', keyLabel: 'F', prompt: '기본 스킬' },
  'skill-heavy': { key: 'KeyG', keyLabel: 'G', prompt: '고급 스킬' },
  // C012 — 오라 스킬. 기본 스킬(F) 바로 옆자리(R)에 둔다 — 둘은 세기가 아니라
  // 방식으로 갈리는 선택이므로 나란히 놓여야 고르는 일로 읽힌다.
  'skill-aura': { key: 'KeyR', keyLabel: 'R', prompt: '오라 스킬' },
  // 막기 (C011) — 세계에는 걸기와 놓기가 따로 있다(명시값). 화면에서는 한 키로 오간다.
  // 어떤 손짓으로 그 둘을 부를지는 View 의 결정이며, 이동 모드가 이미 같은 모양이다.
  // 그래서 키는 걸기 쪽에만 두고, 오가는 것은 조립 루트가 다룬다 —
  // 두 항목 모두에 키를 두면 같은 키에 두 요청이 걸려 어느 쪽이 나갈지 알 수 없다.
  'guard-begin': { key: 'KeyQ', keyLabel: 'Q', prompt: '막기' },
  'guard-release': {},
  // 이동 모드는 값을 실어 보내야 하므로(walk | run) 조립 루트가 직접 다룬다.
  // 여기서는 안내에 쓸 키 표기만 정한다.
  'set-move-mode': { key: 'ShiftLeft', keyLabel: 'Shift', prompt: '달리기 전환' },
  // 살펴봄 (C014 → C017 CHANGED) — **이제 키를 둔다.**
  // C014 가 키를 두지 않은 이유는 "키는 대상을 고를 수단이 없다" 였다. 그 이유가
  // 사라졌다: 대상을 고르는 수단이 세계에 생겼고(select-target), 살펴봄은 고른 것으로
  // 나간다. View 가 선택 규칙을 발명하는 일도 없다 — 무엇을 살펴볼지는 세계가 지닌다.
  'observe-character': { key: 'KeyT', keyLabel: 'T', prompt: '살펴보기' },
  // 고르기 (C017) — 존재마다 실린다. 그 몸을 눌러 부르므로 키를 두지 않는다.
  // 이 자리가 곧 "화면에서 존재를 짚으면 무슨 요청이 되는가" 의 답이다.
  'select-target': { prompt: '지목' },
  // 풀기 (C017) — 대상이 없는 interaction 이므로 키로 부른다.
  'clear-target': { key: 'Escape', keyLabel: 'Esc', prompt: '지목 해제' },
  // 속성 변경 (C007 R2) — 이번 Cycle 은 경로만 연다. 조작 수단은 이후 Cycle 이 얹는다.
  'debug-set-attribute': {},
  // 되돌림 (C014) — 명령 한 줄로 부른다 (command-request). 키를 두지 않는다.
  'debug-forget-acquaintance': {},
};

export function interactionPresentation(role: string): InteractionPresentation {
  return INTERACTIONS[role] ?? {};
}
