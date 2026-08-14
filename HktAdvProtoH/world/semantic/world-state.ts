// World Semantic — 공유 World 의 전체 State 와 시뮬레이션 상수 (C001 ADDED / C002 CHANGED)
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import type { ActorState } from './actor';
import type { StrikeEvent } from './combat';
import type { DepositState } from './deposit';
import type { ObserverState } from './observer';
import type { WorldBounds, WorldPosition } from './position';

// World.DebugAuthority (C007 R2) — 세계가 속성 변경을 허용하는가.
// 세계 밖(세계를 띄우는 쪽)이 정한다. 요청으로는 바꿀 수 없다 —
// 열고 닫는 권한까지 요청으로 열리면 "허용된 경우에만" 이 아무 뜻도 없어진다.
export interface DebugAuthority {
  open: boolean;
}

export interface WorldState {
  bounds: WorldBounds;
  actors: ActorState[]; // C002 CHANGED — Actor 하나 → 여럿
  deposits: DepositState[];
  time: number; // World.Time — 세계가 시작된 뒤 흐른 시간 (C003 ADDED)
  observers: ObserverState[]; // World.Observers — 세계가 아는 관찰자들 (C004 ADDED)
  strikeEvents: StrikeEvent[]; // World.StrikeEvents — 최근 타격 결과들 (C007 ADDED)
  debugAuthority: DebugAuthority; // C007 R2 ADDED
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

// World.SpawnPoints — 관찰자의 몸이 처음 놓이는 자리들 (C004 ADDED).
// 몇 번째 몸인지로 자리가 정해지므로 같은 순서로 들어오면 언제나 같은 배치가 된다.
// 결정론 시뮬레이션 값이므로 헤더 상수로 고정한다.
export const SPAWN_POINTS: WorldPosition[] = [
  { x: 0, z: 0 },
  { x: 3, z: 2 },
  { x: -3, z: 2 },
  { x: 3, z: -2 },
  { x: -3, z: -2 },
];

export function findActor(state: WorldState, id: string): ActorState | undefined {
  return state.actors.find((a) => a.id === id);
}

// C004 CHANGED — "그 player Actor" 를 가리키는 의미는 더 이상 없다.
// 조종되는 몸은 관찰자마다 하나이며, 어느 몸인지는 Observer 가 정한다.
export function findObserver(state: WorldState, observerId: string) {
  return state.observers.find((o) => o.id === observerId);
}

// 요청의 주체 — 세계가 아는 "이 관찰자의 몸" (INTENT-REQUEST-ATTRIBUTION-001).
// 모르는 관찰자면 주체가 없다. 요청은 아무것도 바꾸지 못한다.
export function actorOfObserver(state: WorldState, observerId: string): ActorState | undefined {
  const observer = findObserver(state, observerId);
  return observer ? findActor(state, observer.actorId) : undefined;
}

// 그 몸을 지금 조종하는 이가 있는가 (Character.Attended).
// 관찰자의 몸이 아닌 것(자율 존재)은 조종 개념이 없으므로 false 가 아니라 판정 대상이 아니다.
export function isAttended(state: WorldState, actorId: string): boolean {
  return state.observers.some((o) => o.actorId === actorId && o.present);
}

export function presentObserverCount(state: WorldState): number {
  return state.observers.filter((o) => o.present).length;
}

// World.TickInterval — RULE-WORLD-TICK-001 이 세계를 진행시키는 주기 (초).
// 결정론 시뮬레이션 값이므로 헤더 상수로 고정한다 (C003 ADDED).
export const TICK_INTERVAL = 1 / 30;
