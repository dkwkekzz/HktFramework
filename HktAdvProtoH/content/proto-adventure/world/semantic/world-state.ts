// World Semantic — 이 팩의 전체 State 와 시뮬레이션 상수 (C001 ADDED / C002 CHANGED)
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.
//
// P1 CHANGED — 시간·관찰자는 Engine 의 CoreWorldState 가 소유하고,
// 이 팩의 세계에 무엇이 있는지(Actor·광맥·타격 결과·권한)는 여기가 확장해 정의한다.

import type { CoreWorldState } from '../../../../engine/world-kernel/state';
import type { AcquaintanceState } from './acquaintance';
import type { ActorState } from './actor';
import type { StrikeEvent } from './combat';
import type { TargetSelectionState } from './target-selection';
import type { DepositState } from './deposit';
import type { WorldBounds, WorldPosition } from './position';

// 관찰자 장부를 읽는 도움들은 Engine 의 것이다 — 같은 이름으로 그대로 쓴다.
export {
  findObserver,
  isAttended,
  presentObserverCount,
} from '../../../../engine/world-kernel/state';
import { findObserver as coreFindObserver } from '../../../../engine/world-kernel/state';

// World.DebugAuthority (C007 R2) — 세계가 속성 변경을 허용하는가.
// 세계 밖(세계를 띄우는 쪽)이 정한다. 요청으로는 바꿀 수 없다 —
// 열고 닫는 권한까지 요청으로 열리면 "허용된 경우에만" 이 아무 뜻도 없어진다.
export interface DebugAuthority {
  open: boolean;
}

export interface WorldState extends CoreWorldState {
  bounds: WorldBounds;
  actors: ActorState[]; // C002 CHANGED — Actor 하나 → 여럿
  deposits: DepositState[];
  strikeEvents: StrikeEvent[]; // World.StrikeEvents — 최근 타격 결과들 (C007 ADDED)
  debugAuthority: DebugAuthority; // C007 R2 ADDED
  // World.Acquaintances (C014 ADDED) — 누가 어떤 존재의 겨루는 힘을 아는가.
  // 항목이 없는 관찰자는 아무것도 모른다 (semantic/acquaintance.ts).
  acquaintances: AcquaintanceState[];
  // World.TargetSelections (C017 ADDED) — 지금 이 관찰자가 누구를 고르고 있는가.
  // 항목이 없는 관찰자는 아무것도 고르지 않은 것이다 (semantic/target-selection.ts).
  targetSelections: TargetSelectionState[];
  // ── 세계가 지닌 흔들림 (C015 ADDED, INTENT-WORLD-CHANCE-001) ──────────
  // 세계 밖에서 매번 새로 들어오는 것이 아니라 세계가 가지고 있는 상태다.
  // 그래서 같은 세계를 같은 순서로 굴리면 언제나 같은 이야기가 나온다.
  // 관찰에는 실리지 않는다 — 실으면 다음 한 방이 터질지가 계산 가능해지고
  // 이 층은 "복잡한 결정론" 이 된다 (03 OBSERVABLE SEMANTIC).
  /** World.ChanceSeed — 흔들림의 뿌리. 세계가 만들어질 때 정해지고 어떤 규칙도 바꾸지 않는다 */
  chanceSeed: number;
  /**
   * World.ChanceCursor — 그 흔들림이 지금까지 몇 번 쓰였는가.
   * **RULE-CRITICAL-STRIKE-001 만이** 1 씩 나아가게 한다. 되돌리는 규칙은 없다.
   * 확률이 0 이거나 1 인 판정은 이 값을 쓰지 않는다 —
   * 이미 정해진 일에 우연을 쓰지 않는다.
   */
  chanceCursor: number;
}

// World.ChanceSeed 의 기본 뿌리 (C015 ADDED) — 세계를 띄우는 쪽이 밝히지 않으면 이 값이다.
// 결정론에 영향을 주므로 헤더 상수로 고정한다 (CVar 아님).
export const DEFAULT_CHANCE_SEED = 0x5eedc015;

// InteractionRange — RULE-MINE-001 Precondition 2 의 거리 한계
export const INTERACTION_RANGE = 2.0;

// ObserveRange — RULE-OBSERVE-BEGIN-001 Precondition 4 의 거리 한계 (C014 ADDED).
// 사거리(2.0)보다 멀고 인지 거리(9.0)보다 가깝다: 살펴봄은 칼이 아니라 눈으로 하는
// 일이므로 사거리까지 붙을 필요는 없지만, 인지 거리 안이므로 **자율 존재는 반드시
// 다가온다** — 알기 위해 상대가 나를 알아채는 거리까지 들어가는 것이 대가다 (03 BALANCE).
export const OBSERVE_RANGE = 5.0;

// Actor.MoveSpeed · AttackRange · PerceptionRange 는 종류가 정하는 값이다 —
// character-catalog.ts 가 단일 출처다 (구 MOVE_SPEED/NPC_MOVE_SPEED/ATTACK_RANGE/PERCEPTION_RANGE).

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

// 요청의 주체 — 세계가 아는 "이 관찰자의 몸" (INTENT-REQUEST-ATTRIBUTION-001).
// 모르는 관찰자면 주체가 없다. 요청은 아무것도 바꾸지 못한다.
export function actorOfObserver(state: WorldState, observerId: string): ActorState | undefined {
  const observer = coreFindObserver(state, observerId);
  return observer ? findActor(state, observer.actorId) : undefined;
}

// World.TickInterval — RULE-WORLD-TICK-001 이 세계를 진행시키는 주기 (초).
// 결정론 시뮬레이션 값이므로 헤더 상수로 고정한다 (C003 ADDED).
export const TICK_INTERVAL = 1 / 30;
