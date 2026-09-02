// HUD Presentation — HUD 항목 id 의 표시(라벨·아이콘·토스트)를 결정한다
// (결정 Layer 데이터). id 당 단일 항목 — 미등록 id 는 id 그대로 표시된다.

export interface HudPresentation {
  label: string;
  icon?: string;
  celebrateGain?: boolean;
  format?: (value: number | boolean | string) => string; // 값 표시 형식
}

const HUD: Record<string, HudPresentation> = {
  'inventory.stone': { label: 'Stone', icon: '⛏', celebrateGain: true },
  'tool.hasMiningTool': { label: '곡괭이' },
  'player.action': { label: '행동' },
  'world.time': { label: '세계 시간', format: (v) => `${Math.floor(Number(v))}s` },
  // 함께 보고 있는 사람의 수 — 나를 포함한다.
  'observers.present': { label: '함께', icon: '👥', format: (v) => `${Number(v)}명` },
  // 선 방의 깊이 (C001) — 값은 depth 태그(civil | outer)이고 문구는 code-text 가 정한다
  'region.depth': { label: '깊이' },
};

export function hudPresentation(id: string): HudPresentation {
  return HUD[id] ?? { label: id };
}
