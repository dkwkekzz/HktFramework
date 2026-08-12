// GameView Specification 경계 타입 — VIEW-STONE-MINING-001 (C001)
// World → View 의 유일한 공개 계약. World 내부 자료구조를 노출하지 않는다.

export interface GameViewPosition {
  x: number;
  z: number;
}

export type MineFailureReason =
  | 'no-mining-tool'
  | 'out-of-range'
  | 'deposit-depleted';

export interface GameViewSnapshot {
  id: 'VIEW-STONE-MINING-001';
  scene: 'mining-field';
  entities: {
    player: {
      role: 'player-character';
      position: GameViewPosition;
      state: 'moving' | 'idle';
    };
    deposit: {
      role: 'resource-deposit';
      resourceKind: 'stone';
      id: string;
      position: GameViewPosition;
      state: 'available' | 'depleted';
      remaining: number;
    };
  };
  interactions: {
    move: { role: 'move-to'; available: true };
    mine: {
      role: 'mine-deposit';
      available: boolean;
      unavailableReason?: MineFailureReason;
    };
  };
  hud: {
    inventory: { stone: number };
    tool: { hasMiningTool: boolean };
    mineHint: { available: boolean; reason?: MineFailureReason };
  };
}
