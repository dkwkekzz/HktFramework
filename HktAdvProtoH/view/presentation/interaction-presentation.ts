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
  'attack-swing': { key: 'KeyF', keyLabel: 'F', prompt: '공격' },
};

export function interactionPresentation(role: string): InteractionPresentation {
  return INTERACTIONS[role] ?? {};
}
