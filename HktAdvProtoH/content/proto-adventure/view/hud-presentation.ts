// HUD Presentation — HUD 항목 id 의 표시(라벨·아이콘·토스트)를 결정한다
// (결정 Layer 데이터). id 당 단일 항목 — 미등록 id 는 id 그대로 표시된다.

export interface HudPresentation {
  label: string;
  icon?: string;
  celebrateGain?: boolean;
  format?: (value: number | boolean | string) => string; // 값 표시 형식 (C003)
}

const HUD: Record<string, HudPresentation> = {
  // C020 REMOVED — 'inventory.stone' · 'tool.hasMiningTool'.
  // 종류 전용 칸이 사라졌다. 소지품은 세계가 보낸 목록에서 만들어지며 그 줄들은
  // view/inventory-presentation.ts 가 라벨까지 직접 지닌다 (대상 자리와 같은 자리).
  'player.action': { label: '행동' },
  'world.time': { label: '세계 시간', format: (v) => `${Math.floor(Number(v))}s` },
  // 함께 보고 있는 사람의 수 (C004) — 나를 포함한다.
  'observers.present': { label: '함께', icon: '👥', format: (v) => `${Number(v)}명` },
  // 고른 대상 자리 (C017) — 세계에서 오는 hud 항목이 아니라 결정 Layer 가 계약의
  // 여러 자리를 모아 만든 줄들이다 (view/target-presentation.ts). 라벨은 여기가 소유한다.
  'target.none': { label: '고른 대상', icon: '🎯' },
  'target.name': { label: '고른 대상', icon: '🎯' },
  'target.state': { label: '지금' },
  'target.health': { label: '생명', icon: '❤' },
  'target.observe': { label: '살펴보기' },
  'target.mine': { label: '채집' },
};

export function hudPresentation(id: string): HudPresentation {
  return HUD[id] ?? { label: id };
}
