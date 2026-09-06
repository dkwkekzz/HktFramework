// World Semantic — 이 세계의 전체 State 와 시뮬레이션 상수
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.
//
// P1 CHANGED — 시간·관찰자는 Engine 의 CoreWorldState 가 소유하고,
// 이 팩의 세계에 무엇이 있는지(Actor·타격 결과·권한)는 여기가 확장해 정의한다.
//
// C001 CHANGED — World.bounds 제거. 이동의 경계는 그 몸이 선 Region 의 extent 다 (semantic/region.ts).
// World.regions · World.graph 는 State 가 아니다 — 컨텐츠 데이터(content/regions)에서 다시 온다.
//
// C011 CHANGED — World.deposits 제거. 캘 것은 이제 **원천**이고, 그것도 State 가 아니다 —
// content/regions 의 resourceEcology 와 Description 에서 유도된다 (semantic/resource.ts).

import type { CoreWorldState } from '../../../engine/world-kernel/state';
import type { ActorState } from './actor';
import type { StrikeEvent } from './combat';
import type { RegionState } from './region-state';
import type { WorldPosition } from './position';

// 관찰자 장부를 읽는 도움들은 Engine 의 것이다 — 같은 이름으로 그대로 쓴다.
export {
  findObserver,
  isAttended,
  presentObserverCount,
} from '../../../engine/world-kernel/state';
import { findObserver as coreFindObserver } from '../../../engine/world-kernel/state';

// World.DebugAuthority — 세계가 속성 변경을 허용하는가.
// 세계 밖(세계를 띄우는 쪽)이 정한다. 요청으로는 바꿀 수 없다 —
// 열고 닫는 권한까지 요청으로 열리면 "허용된 경우에만" 이 아무 뜻도 없어진다.
export interface DebugAuthority {
  open: boolean;
}

export interface WorldState extends CoreWorldState {
  actors: ActorState[]; // Actor 는 하나가 아니라 여럿이다
  strikeEvents: StrikeEvent[]; // World.StrikeEvents — 최근 타격 결과들
  debugAuthority: DebugAuthority;
  /**
   * World.RegionStates — 방 하나가 기억하는 것 (C008 ADDED · C012 CHANGED · semantic/region-state.ts).
   *
   * **저장된다.** 컴파일 결과(terrain)와 달리 Description 에서 유도되지 않는다 —
   * 세계가 겪은 일의 결과이므로 스냅샷에 실린다.
   *
   * C012 — 규칙과 원천을 **함께** 든다 (rule · sources). 규칙 없는 방에 rule 은, 원천 없는 방에
   * sources 는 자리 자체가 없고, 둘 다 없는 방은 State 자체가 없다.
   */
  regionStates: Record<string, RegionState>;
}

// InteractionRange — RULE-MINE-001 Precondition 2 의 거리 한계
export const INTERACTION_RANGE = 2.0;

// Actor.MoveSpeed · AttackRange · PerceptionRange 는 종류가 정하는 값이다 —
// character-catalog.ts 가 단일 출처다 (구 MOVE_SPEED/NPC_MOVE_SPEED/ATTACK_RANGE/PERCEPTION_RANGE).

// World.SpawnPoints — 관찰자의 몸이 처음 놓이는 자리들 (START_REGION 의 Local Space 좌표 — C001).
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

// 요청의 주체 — 세계가 아는 "이 관찰자의 몸" (INTENT-REQUEST-ATTRIBUTION-001).
// 모르는 관찰자면 주체가 없다. 요청은 아무것도 바꾸지 못한다.
export function actorOfObserver(state: WorldState, observerId: string): ActorState | undefined {
  const observer = coreFindObserver(state, observerId);
  return observer ? findActor(state, observer.actorId) : undefined;
}

// World.TickInterval — RULE-WORLD-TICK-001 이 세계를 진행시키는 주기 (초).
// 결정론 시뮬레이션 값이므로 헤더 상수로 고정한다.
export const TICK_INTERVAL = 1 / 30;

// 스냅샷에 찍히는 State 형태 버전 (design/Design-World-Persistence.md).
// WorldState 나 그 하위 형태를 바꾸는 Cycle 이 숫자를 올린다 — 불일치 스냅샷은
// 복구되지 않고 버려지므로, 올리지 않으면 옛 형태의 State 가 새 규칙 위에서 돈다.
// C001 — Actor.regionId · Deposit.regionId 가 실린다. World.bounds 는 사라졌다.
// C008 — World.regionStates 와 Actor.movedThisTick 이 실린다. 옛 스냅샷은 복구되지 않는다 (spec R5).
// C011 — deposits 가 사라지고 소지품의 품목이 재료가 된다. 옛 스냅샷은 복구되지 않는다.
// C012 — 방의 State 가 규칙과 원천을 함께 든다 (RegionState.rule · .sources). 형태가 바뀌므로
//        옛 스냅샷은 복구되지 않는다 (spec SPEC-009 경계).
export const STATE_VERSION = 'hkt-adv-proto-i/5';
