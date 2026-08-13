// Scene State — GameView Snapshot 을 해석한 View 내부 표현 상태 (범용).
// 렌더러·HUD 는 이 상태만 소비한다. 구조는 Cycle 이 늘어도 바뀌지 않는다.

import type { HudItemView, InteractionView } from '../../protocol/gameview';

export interface SceneEntity {
  id: string;
  role: string;
  spriteId: string; // `${role}:${state}` — Asset Registry 키
  position: { x: number; z: number };
  labelValue?: number | string;
}

export interface SceneState {
  specId: string;
  entities: SceneEntity[];
  interactions: InteractionView[];
  hud: HudItemView[];
}
