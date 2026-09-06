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
  // 원천에서 캐기 (C011) — 대상이 광맥에서 재료의 원천으로 바뀌었다. **행위는 하나 그대로다**
  // (Play 확정 3): 키도 자리도 그대로이고, 말만 대상에 맞춰 '채취' 가 되었다
  'harvest-source': { key: 'KeyE', keyLabel: 'E', prompt: '채취' },
  'attack-swing': { key: 'KeyF', keyLabel: 'F', prompt: '공격' }, // 예전 role 이름 — 남겨 둔다
  // 휘두름이 스킬 둘로 갈렸다. 기본은 기존 자리(F)를 그대로 쓴다.
  'skill-basic': { key: 'KeyF', keyLabel: 'F', prompt: '기본 스킬' },
  'skill-heavy': { key: 'KeyG', keyLabel: 'G', prompt: '고급 스킬' },
  // 이동 모드는 값을 실어 보내야 하므로(walk | run) 조립 루트가 직접 다룬다.
  // 여기서는 안내에 쓸 키 표기만 정한다.
  'set-move-mode': { key: 'ShiftLeft', keyLabel: 'Shift', prompt: '달리기 전환' },
  // 방 사이 건너기 (C001) — 대상은 region-exit 존재(Connector id). 조립 루트가 targetEntityId 와 함께 보낸다.
  // Q — 이동(WASD)·시점(ZXRT)·관찰(CV)·명령(/)·다른 interaction(EFG·Shift)이 비워 둔 자리 가운데
  // 걷던 왼손이 그대로 닿는 키다.
  'transit-connector': { key: 'KeyQ', keyLabel: 'Q', prompt: '건너기' },
  // 속성 변경 — 이번 Cycle 은 경로만 연다. 조작 수단은 이후 Cycle 이 얹는다.
  'debug-set-attribute': {},
  // 돌아가기 (C009) — 명령 표면(/)에서 거는 것이므로 키를 주지 않는다 (Play §5.6 "개발 명령
  // 표면 재사용" · 위 debug-set-attribute 의 선례). 안내 문구도 두지 않는다: 프롬프트는
  // 키가 있을 때만 화면에 뜨므로(hud.ts · touch-pad.ts 가 key && prompt 를 함께 본다)
  // 키 없는 자리의 문구는 어디에도 그려지지 않는 죽은 값이다. 명령 표면의 말은
  // code-text 의 'emergency-return' 이 소유한다.
  'emergency-return': {},
};

export function interactionPresentation(role: string): InteractionPresentation {
  return INTERACTIONS[role] ?? {};
}
