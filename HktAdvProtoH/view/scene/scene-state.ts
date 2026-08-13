// Scene State — GameView Snapshot 을 해석한 View 내부 표현 상태.
// 렌더러는 이 상태만 소비한다. 어떤 Cycle 도, 어떤 게임 의미도 여기 없다.

import type { GameViewHud, GameViewInteraction } from '../../protocol/gameview';

export interface SceneEntity {
  /** Snapshot Entity 식별자 — 상호작용 대상 판정에 그대로 쓴다 */
  id: string;
  /** Asset Registry 키 — `role` 또는 `role:state` */
  spriteId: string;
  /** 에셋을 못 찾았을 때의 대체 표현인가 */
  placeholder: boolean;
  position: { x: number; z: number };
  focus: boolean;
  label: string | null;
}

export interface ScenePrompt {
  text: string;
  available: boolean;
}

export interface SceneState {
  scene: string;
  entities: SceneEntity[];
  /** 그대로 통과시킨다 — 발동은 조립 루트가, 표시는 HUD 가 한다 */
  interactions: readonly GameViewInteraction[];
  hud: GameViewHud;
  /** 화면 하단에 띄울 안내 (키가 달린 상호작용에서 뽑는다) */
  prompts: ScenePrompt[];
}
