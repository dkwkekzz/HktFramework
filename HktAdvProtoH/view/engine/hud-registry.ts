// HUD Registry — HUD 항목 id 별 표시 특성 (엔진 데이터).
// 새 Cycle 은 항목을 추가할 뿐이며, 미등록 id 도 기본 형식으로 표시된다.

export interface HudTraits {
  label: string;
  icon?: string;
  celebrateGain?: boolean; // counter 증가 시 획득 토스트
}

const HUD: Record<string, HudTraits> = {
  'inventory.stone': { label: 'Stone', icon: '⛏', celebrateGain: true },
  'tool.hasMiningTool': { label: '곡괭이' },
};

export function hudTraits(id: string): HudTraits {
  return HUD[id] ?? { label: id };
}
