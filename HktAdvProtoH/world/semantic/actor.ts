// World Semantic — Actor (C001 ADDED)
// Position · MoveTarget · MoveSpeed · Inventory 는 모두 World Authority.

import type { Inventory } from './inventory';
import type { WorldPosition } from './position';

export interface ActorState {
  position: WorldPosition;
  moveTarget: WorldPosition | null;
  moveSpeed: number; // 고정 상수 — 결정론 시뮬레이션 값
  inventory: Inventory;
}
