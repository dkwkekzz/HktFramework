// Role Presentation — Entity Role 을 "어떻게 그릴지" 결정한다 (결정 Layer 데이터).
//
// 같은 종류의 대상은 여기 단일 항목으로만 결정된다 — 모든 Cycle 이 이 항목을
// 공유·발전시키며, Cycle 별로 결정 코드를 분리하지 않는다.
// 미등록 role 도 기본 결정으로 일단 그려진다 (spriteId 는 Asset placeholder 로 폴백).
//
// sprite 는 "모션 데이터가 없을 때" 쓰는 절차 생성 그림의 키다.
// 모션 데이터가 주입되어 있으면 (kind, state) 로 고른 모션이 우선한다 — resolve.ts 참조.

export interface RolePresentation {
  sprite: string; // Asset Registry 의 sprite 키
  size: number;
  tint?: number; // 그림에 곱할 색 — 같은 모션을 쓰는 대상을 구분하기 위한 표현 결정
  cameraFollow?: boolean;
  trail?: boolean;
  labelFormat?: (value: number | string) => string;
}

const ROLES: Record<string, RolePresentation> = {
  'player-character': { sprite: 'player-pickaxe', size: 3.4, cameraFollow: true, trail: true },
  // NPC 는 현재 플레이어와 같은 모션 시트를 쓴다 — 누가 내 캐릭터인지 보이도록 색을 달리한다.
  // NPC 전용 시트가 들어오면 tint 를 지워도 된다.
  'npc-character': { sprite: 'wanderer', size: 2.8, tint: 0x9fb6ff },
  'resource-deposit': { sprite: 'stone-deposit', size: 3.4, labelFormat: (v) => `돌 ${v}` },
};

export function rolePresentation(role: string): RolePresentation {
  return ROLES[role] ?? { sprite: role, size: 2.5 }; // 기본 결정 — sprite 키는 role 그대로
}
