// Scene State — Render 지시 Snapshot 을 해석한 View 내부 상태.
// 렌더러·HUD 는 이 상태만 소비한다. 특정 게임 의미를 담지 않는다.

import type { HudItemView, InteractionView } from '../../protocol/gameview';

export interface SceneEntity {
  id: string;
  spriteId: string; // `${sprite}:${variant}` — Asset Registry 키
  size: number;
  position: { x: number; z: number };
  label?: string;
  cameraFollow: boolean;
  trail: boolean;
}

export interface SceneState {
  specId: string;
  terrain: string;
  entities: SceneEntity[];
  interactions: InteractionView[];
  hud: HudItemView[];
}
