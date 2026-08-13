// Interaction Registry — Interaction Role 별 입력 바인딩·프롬프트 (엔진 데이터).
// 새 Cycle 은 항목을 추가할 뿐, 엔진 코드는 수정하지 않는다.

export interface InteractionTraits {
  key?: string; // KeyboardEvent.code
  keyLabel?: string; // 안내 표기용 (예: "E")
  promptLabel?: string; // 가용 시 프롬프트 문구 (예: "채굴" → "[E] 채굴")
  terrainTarget?: boolean; // 지형 지점을 대상으로 한다 (클릭·이동키가 여기에 매핑)
}

const INTERACTIONS: Record<string, InteractionTraits> = {
  'move-to': { terrainTarget: true },
  'mine-deposit': { key: 'KeyE', keyLabel: 'E', promptLabel: '채굴' },
};

export function interactionTraits(role: string): InteractionTraits {
  return INTERACTIONS[role] ?? {};
}
