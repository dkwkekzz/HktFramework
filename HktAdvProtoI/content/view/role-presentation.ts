// Role Presentation — Entity Role 을 "어떻게 그릴지" 결정한다 (결정 Layer 데이터).
//
// 같은 종류의 대상은 여기 단일 항목으로만 결정된다 — 모든 Cycle 이 이 항목을
// 공유·발전시키며, Cycle 별로 결정 코드를 분리하지 않는다.
// 미등록 role 도 기본 결정으로 일단 그려진다 (spriteId 는 Asset placeholder 로 폴백).
//
// sprite 는 "모션 데이터가 없을 때" 쓰는 절차 생성 그림의 키다.
// 모션 데이터가 주입되어 있으면 (kind, state) 로 고른 모션이 우선한다 — resolve.ts 참조.

import { TRANSITION_TINTS } from './region-presentation';

export interface RolePresentation {
  sprite: string; // Asset Registry 의 sprite 키
  size: number; // 몸(body)이 없는 존재의 표시 크기 — 몸이 있으면 Body.Height 가 우선한다
  tint?: number; // 그림에 곱할 색 — 같은 모션을 쓰는 대상을 구분하기 위한 표현 결정
  /**
   * 종류(entity.kind)별로 곱할 색 — 같은 role 을 kind 로 가르는 표. 항목이 있으면 tint 보다 우선한다.
   * 표를 참조하므로 종류가 늘어도 이 항목은 바뀌지 않는다.
   */
  tintByKind?: Readonly<Record<string, number>>;
  /**
   * 종류(entity.kind)별로 쓸 그림 — tintByKind 와 **정확히 같은 어법**의 표다.
   * 항목이 있으면 sprite 보다 우선한다 (resolve.ts 가 그 규율을 지킨다).
   *
   * 필요한 이유: 같은 role 하나에 자연 형태가 여럿인 것이 생겼다 (C011 — 재료의 원천 넷은
   * 전부 'resource-source' 이면서 노두 · 뿌리혹 · 허물 조각 · 선광 더미로 갈린다).
   * 색만으로는 그 넷이 갈리지 않으므로 그림 자체를 kind 가 고른다.
   */
  spriteByKind?: Readonly<Record<string, string>>;
  cameraFollow?: boolean;
  trail?: boolean;
  labelFormat?: (value: number | string) => string;
  // 조종하는 이가 없을 때의 표현 — attended = false 인 대상에만 쓰인다.
  unattendedTint?: number;
  unattendedLabel?: string;
}

// 역할별 표현 결정 — 종(kind)이 정하는 표현은 kind-presentation.ts 가 맡는다.
// 전체는 `npm run catalog` 로 한눈에 관찰한다 (tools/catalog).
export const ROLE_PRESENTATIONS: Readonly<Record<string, RolePresentation>> = {
  'player-character': { sprite: 'player-pickaxe', size: 3.4, cameraFollow: true, trail: true },
  // 다른 관찰자의 몸 — 내 몸과 같은 시트를 쓰되 색으로 구분한다.
  // 카메라는 따라가지 않는다. 카메라가 따라가는 것은 내 몸 하나뿐이다.
  // 조종하는 이가 없으면 탈색하고 자리 비움을 알린다 — 세계에 남아 있지만 아무도 없다.
  'other-player-character': {
    sprite: 'player-pickaxe',
    size: 3.4,
    tint: 0xffd9a0,
    unattendedTint: 0x6b6b6b,
    unattendedLabel: '자리 비움',
  },
  // NPC 는 현재 플레이어와 같은 모션 시트를 쓴다 — 누가 내 캐릭터인지 보이도록 색을 달리한다.
  // NPC 전용 시트가 들어오면 tint 를 지워도 된다.
  'npc-character': { sprite: 'wanderer', size: 2.8, tint: 0x9fb6ff },
  // 재료의 원천 (C011) — 같은 role 넷이 자연 형태(kind)로 갈린다. **labelFormat 이 없다**:
  // 세계 위에 글자가 없고(C026 R4 RULE-QUIET-GROUND-001 · spec SPEC-008) 남은 양도 실리지 않는다.
  // 무엇인지 · 무엇을 줄 수 있는지는 **물었을 때** 판이 답한다 (target-frame-presentation).
  // 크기는 광맥이 서 있던 자리 그대로(3.4)다 — 사람의 몸과 비슷한 부피로 그 자리에 선다.
  'resource-source': {
    sprite: 'source',
    size: 3.4,
    spriteByKind: {
      outcrop: 'source:outcrop',
      'root-nodule': 'source:root-nodule',
      'molt-litter': 'source:molt-litter',
      'spoil-pile': 'source:spoil-pile',
    },
  },
  // 방의 출구 표식 (C001) — anchor 자리에 선 표식 하나. kind(= 전이 종류) 별 색은 region-presentation 의 표.
  // 라벨이 없다 — 목적지 이름은 관찰 결과 어디에도 실리지 않는다 ("목적지는 건너야 안다").
  'region-exit': { sprite: 'region-exit', size: 2.0, tintByKind: TRANSITION_TINTS },
};

// 미등록 role 의 기본 결정 — sprite 키는 role 그대로 (Asset placeholder 로 폴백)
export const DEFAULT_ROLE_SIZE = 2.5;

export function rolePresentation(role: string): RolePresentation {
  return ROLE_PRESENTATIONS[role] ?? { sprite: role, size: DEFAULT_ROLE_SIZE };
}
