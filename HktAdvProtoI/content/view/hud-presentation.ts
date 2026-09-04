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
  // 지금 선 자리가 왜 안전한가 (C006 R4) — 값은 세계가 준 조건 코드들을 code-text 로 옮겨
  // 이어 붙인 한 줄이다. 조건 area 밖에 서면 이 줄 자체가 뜨지 않는다 (SPEC-007 경계).
  // "안전" 이 아니라 "안전한 이유" 인 것이 W2 의 전부다 — 안전지대를 칠하는 것이 아니라
  // 안전할 수 있는 조건을 읽는 것이므로, 이름표가 이유를 묻는 말이어야 한다.
  'region.safe-by': { label: '안전한 이유' },
};

export function hudPresentation(id: string): HudPresentation {
  return HUD[id] ?? { label: id };
}
