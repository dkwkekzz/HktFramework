// HUD Presentation — HUD 항목 id 의 표시(라벨·아이콘·토스트)를 결정한다
// (결정 Layer 데이터). id 당 단일 항목 — 미등록 id 는 id 그대로 표시된다.

export interface HudPresentation {
  label: string;
  icon?: string;
  celebrateGain?: boolean;
}

const HUD: Record<string, HudPresentation> = {
  'inventory.stone': { label: 'Stone', icon: '⛏', celebrateGain: true },
  'tool.hasMiningTool': { label: '곡괭이' },
  'player.action': { label: '행동' },
};

export function hudPresentation(id: string): HudPresentation {
  return HUD[id] ?? { label: id };
}
