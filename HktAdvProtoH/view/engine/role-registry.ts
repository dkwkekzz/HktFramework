// Role Registry — Semantic Role 별 표현 특성 (엔진 데이터).
//
// 핵심 명제: 새 Cycle 은 여기(와 Asset Registry)에 항목을 *추가*할 뿐,
// 기존 role 의 항목과 엔진 코드는 수정하지 않는다.
// 미등록 role 도 기본 특성으로 일단 그려진다.

export interface RoleTraits {
  scale: number; // 스프라이트 크기
  cameraFollow?: boolean; // 카메라가 이 role 을 따라간다
  trail?: boolean; // 이동 자취를 남긴다
  labelFormat?: (value: number | string) => string; // labelValue 표시 형식
}

const ROLES: Record<string, RoleTraits> = {
  'player-character': { scale: 2.6, cameraFollow: true, trail: true },
  'resource-deposit': { scale: 3.4, labelFormat: (v) => `돌 ${v}` },
};

const DEFAULT_TRAITS: RoleTraits = { scale: 2.5 };

export function roleTraits(role: string): RoleTraits {
  return ROLES[role] ?? DEFAULT_TRAITS;
}
