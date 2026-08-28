// Kind Presentation — 존재 종류(CharacterKind)가 정하는 표현 결정의 단일 출처.
//
// role-presentation 이 "역할(role)의 표현"(카메라·꼬리·라벨·자리 비움)을 정한다면,
// 여기는 "종(kind)의 표현" — 그 종류의 그림 자체에 딸린 결정을 정한다.
// 세계는 kind 라는 이름만 알고, 그 종류의 그림이 어떻게 생겼는지는 그림을 가진 이쪽이 안다.
//
// 새 종류 추가는 정확히 세 곳이다 (kind 정적 데이터 3원소 — CLAUDE.md):
//   1. world/semantic/character-catalog.ts 한 항목 (시뮬레이션)
//   2. 여기 한 항목                                 (표현)
//   3. motions/<kind>/ 폴더                         (그림 — 없으면 placeholder 로 그려진다)
// 전체는 `npm run catalog` 로 한눈에 관찰한다 (tools/catalog).

import type { ScreenSide } from '../../../engine/view-kernel/presentation/facing-presentation';

export interface KindPresentation {
  /**
   * 그림 원본이 향한 쪽 (04 spriteOrientation.baseline — C008).
   * 몸이 이쪽과 반대로 읽히면 그림을 좌우로 뒤집는다. 그림을 갈아 끼우면
   * 세계는 그대로인 채 이 값만 바뀐다.
   */
  spriteBaseline: ScreenSide;
}

export const KIND_PRESENTATIONS: Readonly<Record<string, KindPresentation>> = {
  'rabbit-swordsman': { spriteBaseline: 'right' }, // 원본이 오른쪽을 본다 — 휘두름도 오른쪽으로 나간다
  wanderer: { spriteBaseline: 'right' },
};

// 등록되지 않은 종류의 기본 표현 (04 spriteOrientation.baseline.default)
export const DEFAULT_KIND_PRESENTATION: KindPresentation = { spriteBaseline: 'right' };

export function kindPresentation(kind: string | undefined): KindPresentation {
  if (!kind) return DEFAULT_KIND_PRESENTATION;
  return KIND_PRESENTATIONS[kind] ?? DEFAULT_KIND_PRESENTATION;
}
