// World Semantic — 공유 World 의 전체 State 와 시뮬레이션 상수 (C001 ADDED / C002 CHANGED)
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import type { ActorState } from './actor';
import type { DepositState } from './deposit';
import type { WorldBounds } from './position';

export interface WorldState {
  bounds: WorldBounds;
  actors: ActorState[]; // C002 CHANGED — Actor 하나 → 여럿
  deposits: DepositState[];
}

// InteractionRange — RULE-MINE-001 Precondition 2 의 거리 한계
export const INTERACTION_RANGE = 2.0;

// Actor.MoveSpeed — RULE-MOVE-PROGRESS-001 의 이동 속도 (unit/sec)
export const MOVE_SPEED = 6.0;
export const NPC_MOVE_SPEED = 2.5; // 자율 Actor 는 더 느리게 움직인다 — 행동 관찰이 목적

// Actor.AttackRange — RULE-ATTACK-001 Precondition 2 의 거리 한계
export const ATTACK_RANGE = 2.0;

// Actor.PerceptionRange — RULE-NPC-DECIDE-001 의 인지 거리
export const PERCEPTION_RANGE = 9.0;

// World.Bounds — RULE-MOVE-001 Precondition 의 도달 가능 영역
export const WORLD_BOUNDS: WorldBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

// Control = player 인 Actor — Client 의 Action Request 는 이 Actor 를 주체로 한다.
export function playerActor(state: WorldState): ActorState {
  const actor = state.actors.find((a) => a.control === 'player');
  if (!actor) throw new Error('World 에 player Actor 가 없다');
  return actor;
}

export function findActor(state: WorldState, id: string): ActorState | undefined {
  return state.actors.find((a) => a.id === id);
}
