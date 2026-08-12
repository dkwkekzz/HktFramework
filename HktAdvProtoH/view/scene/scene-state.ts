// Scene State — GameView Snapshot 을 해석한 View 내부 표현 상태.
// 렌더러는 이 상태만 소비한다.

import type { MineFailureReason } from '../../protocol/gameview';

export interface SceneEntity {
  key: 'player' | 'deposit';
  spriteId: string; // Asset Registry 키 — role:state
  position: { x: number; z: number };
}

export interface HudModel {
  stoneCount: number;
  hasMiningTool: boolean;
  mineAvailable: boolean;
  mineReason: MineFailureReason | null;
  depositRemaining: number;
}

export interface SceneState {
  entities: SceneEntity[];
  hud: HudModel;
  mineTargetDepositId: string;
}
