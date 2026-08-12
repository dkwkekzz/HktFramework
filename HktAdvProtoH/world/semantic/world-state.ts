// World Semantic — 공유 World 의 전체 State 와 시뮬레이션 상수 (C001 ADDED)
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import type { ActorState } from './actor';
import type { DepositState } from './deposit';
import type { WorldBounds } from './position';

export interface WorldState {
  bounds: WorldBounds;
  actor: ActorState;
  deposits: DepositState[];
}

// InteractionRange — RULE-MINE-001 Precondition 2 의 거리 한계
export const INTERACTION_RANGE = 2.0;

// Actor.MoveSpeed — RULE-MOVE-PROGRESS-001 의 이동 속도 (unit/sec)
export const MOVE_SPEED = 6.0;

// World.Bounds — RULE-MOVE-001 Precondition 의 도달 가능 영역
export const WORLD_BOUNDS: WorldBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
