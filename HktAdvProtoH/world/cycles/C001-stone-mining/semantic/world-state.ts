// C001 이 도입한 World State 조각과 시뮬레이션 상수.
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.
//
// 선언 병합으로 커널 WorldState 에 이 Cycle 몫만 더한다 — 이 파일이 곧 "C001 이 소유한 State".
// C001 이 Scope 밖이면 이 조각은 심어지지 않는다(그리고 C001 은 첫 Cycle 이므로 세계가 없다).

import type { ActorState } from './actor';
import type { DepositState } from './deposit';
import type { WorldBounds } from './position';

declare module '../../../kernel/state' {
  interface WorldState {
    bounds: WorldBounds;
    actor: ActorState;
    deposits: DepositState[];
  }

  interface WorldSetup {
    actorPosition?: { x: number; z: number };
    actorItems?: Partial<Record<'stone' | 'pickaxe', number>>;
    depositPosition?: { x: number; z: number };
    depositAmount?: number;
  }
}

// InteractionRange — RULE-MINE-001 Precondition 2 의 거리 한계
export const INTERACTION_RANGE = 2.0;

// Actor.MoveSpeed — RULE-MOVE-PROGRESS-001 의 이동 속도 (unit/sec)
export const MOVE_SPEED = 6.0;

// World.Bounds — RULE-MOVE-001 Precondition 의 도달 가능 영역
export const WORLD_BOUNDS: WorldBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
