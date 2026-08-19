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
  // 살펴봄 (C014) — 대상이 있는 interaction 이므로 그 몸을 눌러 부른다.
  // 키를 두지 않는다: 키는 대상을 고를 수단이 없고, "가장 가까운 하나" 같은 규칙을
  // View 가 만들면 세계가 정하지 않은 선택 규칙을 화면이 발명하게 된다.
  // 대상 지목은 이미 계약이 실어 보낸다 (targetEntityId) — 그 지시대로 누르면 된다.
  'observe-character': { prompt: '살펴보기' },
  // 속성 변경 (C007 R2) — 이번 Cycle 은 경로만 연다. 조작 수단은 이후 Cycle 이 얹는다.
  'debug-set-attribute': {},
  // 되돌림 (C014) — 명령 한 줄로 부른다 (command-request). 키를 두지 않는다.
  'debug-forget-acquaintance': {},
};

export function interactionPresentation(role: string): InteractionPresentation {
  return INTERACTIONS[role] ?? {};
}
