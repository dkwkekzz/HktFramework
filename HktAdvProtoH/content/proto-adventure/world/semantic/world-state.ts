// World Semantic — 이 팩의 전체 State 와 시뮬레이션 상수 (C001 ADDED / C002 CHANGED)
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.
//
// P1 CHANGED — 시간·관찰자는 Engine 의 CoreWorldState 가 소유하고,
// 이 팩의 세계에 무엇이 있는지(Actor·광맥·타격 결과·권한)는 여기가 확장해 정의한다.

import type { CoreWorldState } from '../../../../engine/world-kernel/state';
import type { AcquaintanceState } from './acquaintance';
import type { ActorState } from './actor';
import type { CancelEvent, StrikeEvent } from './combat';
import type { TargetSelectionState } from './target-selection';
import type { DepositState } from './deposit';
import type { GrowthEvent } from './growth';
import type { UnharmedContact } from './relation';
import type { WorldBounds, WorldPosition } from './position';
import type { GroundZone } from './terrain';

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
  // World.UnharmedContacts (C018 ADDED) — 닿았으나 해가 성립하지 않은 접촉들.
  // StrikeEvents 와 나란한 자리이며 같은 수명을 가진다 (semantic/relation.ts).
  unharmedContacts: UnharmedContact[];
  // World.CancelEvents (C019 ADDED) — 선딜 중에 끊겨 없던 일이 된 기술들.
  // StrikeEvents · UnharmedContacts 와 나란한 자리이며 같은 수명을 가진다
  // (semantic/combat.ts).
  cancelEvents: CancelEvent[];
  // World.GrowthEvents (C-GROWTH-001 ADDED) — 방금 무엇을 해서 얼마가 쌓였고
  // 그것이 단계를 올렸는가. StrikeEvents · UnharmedContacts · CancelEvents 와 나란한
  // 자리이며 **같은 수명을 가진다** — 수명 규칙을 넷으로 나누지 않는다
  // (semantic/growth.ts · RULE-STRIKE-EVENT-EXPIRE-001).
  growthEvents: GrowthEvent[];
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
  /**
   * World.GenesisSeed (C-TERRAIN-003 ADDED) — 태어남의 뿌리.
   *
   * 세계가 만들어질 때 정해지고 **어떤 규칙도 바꾸지 않는다** (chanceSeed 와 같은 지위).
   * 같은 씨앗 → 같은 세계 (INTENT-SAME-SEED-SAME-WORLD-001). State 로 두는 이유는
   * 관찰과 재현이다 — 이 세계가 어느 씨앗에서 태어났는지가 세계 안에 남아야
   * "같은 세계를 다시 띄운다" 가 성립한다.
   *
   * 흔들림의 뿌리(chanceSeed)와 **가른다** (05-review.md 답 3) — 같은 땅에서 다른
   * 흔들림(재현·검증)이 성립해야 하고, 소비 시점도 다르다 (만들어질 때 한 번 vs
   * 도는 동안 계속).
   */
  genesisSeed: number;
  /**
   * World.GroundZones (C-TERRAIN-001 ADDED · C-TERRAIN-003 CHANGED) — 무대의 자리들.
   *
   * **어떤 Rule 도 이 목록을 바꾸지 않는다.** 세계가 만들어질 때 **태어나고** 그대로다 —
   * C-TERRAIN-003 부터 이 목록의 유일한 원천은 RULE-WORLD-GENESIS-001 이다
   * (rules/world-genesis.ts). 자리를 목록으로 적는 형은 사라졌다.
   * 그럼에도 상수가 아니라 State 인 이유는 둘이다 — 관찰이 State 를 투영하는 하나의
   * 길을 지나야 하고(광맥이 그러하듯), **예외가 사라질 수 있다는 것이 이 세계의
   * 원칙**이기 때문이다 (BT §9.2 유랑대지 · DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION).
   * 그 변화를 여는 것은 이 Cycle 이 아니지만, 열릴 때 State 로 옮기는 이사가
   * 따라붙지 않게 한다.
   *
   * 무대 전체가 자리로 덮이지 않는다 — 어느 자리에도 속하지 않은 땅은 아무 법칙도
   * 지니지 않으며, 그것이 이 Cycle 이전의 세계 전부였다.
   */
  groundZones: GroundZone[];
}

// World.ChanceSeed 의 기본 뿌리 (C015 ADDED) — 세계를 띄우는 쪽이 밝히지 않으면 이 값이다.
// 결정론에 영향을 주므로 헤더 상수로 고정한다 (CVar 아님).
export const DEFAULT_CHANCE_SEED = 0x5eedc015;

// InteractionRange — RULE-MINE-001 Precondition 2 의 거리 한계
export const INTERACTION_RANGE = 2.0;

/**
 * 몸이 지닌 자리의 수 (C022 ADDED — World.InventoryCapacity).
 *
 * **세계의 성질이지 State 가 아니다** — 세계가 굴러가며 달라지지 않는다.
 * 몸마다 다른 자리를 지니는 것은 가방 확장의 의미이며 이 Cycle 이 그것을 열지 않는다.
 * 몸으로 옮기는 것은 값이 달라져야 할 이유가 생겼을 때의 한 줄 이동이다
 * (03-world-semantic.md RATIONALE 2).
 *
 * **어떤 규칙도 이 수를 조건으로 삼지 않는다.** 판정은 `≤ Capacity` 하나이며,
 * 그래서 이 값을 바꿔도 규칙 코드는 한 줄도 열리지 않는다
 * (DC-ITEM-CAPACITY-IS-FINITE).
 */
export const INVENTORY_CAPACITY = 4;

// ObserveRange — RULE-OBSERVE-BEGIN-001 Precondition 4 의 거리 한계 (C014 ADDED).
// 사거리(2.0)보다 멀고 인지 거리(9.0)보다 가깝다: 살펴봄은 칼이 아니라 눈으로 하는
// 일이므로 사거리까지 붙을 필요는 없지만, 인지 거리 안이므로 **자율 존재는 반드시
// 다가온다** — 알기 위해 상대가 나를 알아채는 거리까지 들어가는 것이 대가다 (03 BALANCE).
export const OBSERVE_RANGE = 5.0;

// Actor.MoveSpeed · AttackRange · PerceptionRange 는 종류가 정하는 값이다 —
// character-catalog.ts 가 단일 출처다 (구 MOVE_SPEED/NPC_MOVE_SPEED/ATTACK_RANGE/PERCEPTION_RANGE).

// World.Bounds — RULE-MOVE-001 Precondition 의 도달 가능 영역
export const WORLD_BOUNDS: WorldBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

/**
 * 몸이 지닐 수 있는 열의 최대 (C-TERRAIN-001 ADDED — World.WarmthMax).
 *
 * **세계의 성질이지 State 가 아니다** — 세계가 굴러가며 달라지지 않는다. 종류마다
 * 다른 값을 지니는 것은 이 Cycle 이 열지 않는 의미이며, 몸으로 옮기는 것은 값이
 * 달라져야 할 이유가 생겼을 때의 한 줄 이동이다 (C022 의 INVENTORY_CAPACITY 와 같은 판단).
 *
 * **어떤 규칙도 이 수를 조건으로 삼지 않는다.** 판정은 "남았는가" 하나이며,
 * 그래서 이 값을 바꿔도 규칙 코드는 한 줄도 열리지 않는다.
 *
 * 결정론 시뮬레이션 값이므로 헤더 상수로 고정한다 (CVar 아님).
 */
export const WARMTH_MAX = 100;

// World.GenesisSeed 의 기본 뿌리 (C-TERRAIN-003 ADDED) — 세계를 띄우는 쪽이 밝히지
// 않으면 이 값이다 (DEFAULT_CHANCE_SEED 와 같은 판단).
//
// **씨앗을 고르는 것은 손배치가 아니다** (03 RATIONALE 1) — 자리를 적는 형은 사라졌고,
// 고를 수 있는 것은 "태어난 세계들 가운데 어느 것을 기본으로 보여 주는가" 뿐이다.
// 이 값은 03 BALANCE 2 의 조건(맥 넷이 이웃하여 서고 하나가 뿜는다 · 조용한 자리가
// 비어 있다 · 시작 자리에서 걸어 닿는다)을 만족하는 세계를 고른 것이며, 그 확인은
// world/tests/world-genesis.spec.ts 가 지킨다. 조건을 어기는 값으로 바꾸면 그 검사가
// 막는다 — 규칙이 먼저다.
//
// 결정론에 영향을 주므로 헤더 상수로 고정한다 (CVar 아님).
export const DEFAULT_GENESIS_SEED = 1;

// 손배치 GROUND_ZONES 는 C-TERRAIN-003 으로 사라졌다 — 자리의 유일한 원천은
// RULE-WORLD-GENESIS-001 (rules/world-genesis.ts) 이다.

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

// 스냅샷에 찍히는 State 형태 버전 (design/Design-World-Persistence.md).
// WorldState 나 그 하위 형태를 바꾸는 Cycle 이 숫자를 올린다 — 불일치 스냅샷은
// 복구되지 않고 버려지므로, 올리지 않으면 옛 형태의 State 가 새 규칙 위에서 돈다.
// C-TERRAIN-001 CHANGED — 1 → 2. 그 Cycle 이 State 의 **형태**를 바꿨다:
// WorldState 에 groundZones 가, ActorState 에 warmth · warmthMax 가 늘었다.
// 형태를 바꾼 Cycle 이 버전을 올릴 책임을 진다 (engine/world-kernel/persistence.ts).
//
// C-TERRAIN-002 CHANGED — 2 → 3. GroundZone 의 형태가 바뀌었다:
// `role` 이 사라지고 `kept` · `phase` 가 늘었다. 올리지 않으면 옛 스냅샷이 **복구되어**
// role 만 있는 자리 위에서 새 규칙이 돌고, 모든 자리가 phase 없이 굴러 아무것도 거두지
// 않는 세계가 된다. 마이그레이션은 없다 — 불일치 스냅샷은 복구를 포기하고 새 세계로
// 시작한다.
export const STATE_VERSION = 'proto-adventure/4';
