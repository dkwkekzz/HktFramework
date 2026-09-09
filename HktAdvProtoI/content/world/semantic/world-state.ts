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
import type { PresencePassState } from './presence';
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
  /**
   * World.turnsApplied — 지금까지 **적용한** 뒤척임의 수 (C016 ADDED · spec State · R8).
   *
   * **저장된다.** 때는 세계 시각에서 유도되지만(semantic/clock.ts) **뒤척임은 사건**이라
   * 일어났다는 것을 세계가 기억해야 한다 — 그러지 않으면 껐다 켤 때마다 다시 일어난다
   * (spec 기본형 ⑤ · SPEC-009).
   *
   * 수로 두는 이유 — 시각만으로는 큰 걸음이 사건을 건너뛸 수 있고, "언제 마지막으로" 로
   * 두면 되살린 세계가 다시 뒤척인다. 수로 두면 두 번 세지도 빠뜨리지도 않는다.
   * 세계에 하나다 (철이 세계에 하나이므로 · Time 원칙 T1).
   */
  turnsApplied: number;
  /**
   * World.seasonsApplied — 지금까지 **적용한** 철의 수 (C024 ADDED · spec State · R3).
   *
   * **저장된다.** `turnsApplied` 와 **같은 어법 · 같은 이유**다: 때는 세계 시각에서
   * 유도되지만(semantic/clock.ts 의 seasonsStartedAt) **값이 내리는 것은 사건**이라
   * 일어났다는 것을 세계가 기억해야 한다 — 그러지 않으면 껐다 켤 때마다 같은 철을 두 번
   * 세어 개체군이 거듭 내린다 (spec SPEC-003 경계 ⑥).
   *
   * 수로 두는 이유도 같다 — 시각만으로는 큰 걸음이 철을 건너뛸 수 있고, "언제 마지막으로"
   * 로 두면 되살린 세계가 다시 내린다. 수로 두면 두 번 세지도 빠뜨리지도 않는다 (경계 ⑤).
   * 세계에 하나다 (철이 세계에 하나이므로 · Time 원칙 T1).
   */
  seasonsApplied: number;
  /**
   * World.presences — 지나가는 것 하나의 **지금** (C018 ADDED · spec State · semantic/presence.ts).
   *
   * **저장된다.** 시간표도 마디도 데이터에서 다시 오지만(content/regions), "지금 지나고
   * 있는가 · 이번 바퀴에 이미 왔는가 · 몇 번 지나갔는가 · 이번에 어디로 휘었는가" 는
   * 세계가 겪은 일이라 스냅샷에 실린다 — 그러지 않으면 껐다 켤 때마다 다시 처음부터
   * 지나가고, 남긴 것도 다시 처음이 된다 (spec SPEC-008).
   *
   * **밝힌 경로 전부에 자리가 있다** (spec State) — 지나고 있지 않은 경로도 "아직 지나가지
   * 않았다" 를 들어야 하기 때문이다. 소란이 모든 방에 서는 것과 같은 어법이다 (C017 기본형 ⑩).
   */
  presences: Record<string, PresencePassState>;
}

// InteractionRange — RULE-MINE-001 Precondition 2 의 거리 한계
export const INTERACTION_RANGE = 2.0;

/**
 * 밤에 몸과 원천이 관찰에 실리는 거리 (C015 ADDED · RULE-OBSERVE-PROJECTION · spec R2).
 *
 * 때가 밤이면 관찰자 자신의 몸에서 이보다 먼 몸과 원천은 실리지 않는다. **낮에는 없다** —
 * 낮의 관찰은 지금 그대로 방으로만 잘린다 (spec 기본형 ②: 낮에 범위를 새로 세우면
 * C001~C014 의 모든 관찰이 함께 바뀌고, 그것은 이 Cycle 이 증명할 것이 아니다).
 *
 * 20 인 이유 — 기본 방(40×40)의 **반폭**이다. 한가운데에 서면 벽까지(20) 닿고
 * 구석(28.3)에는 닿지 않는다: 밤은 방을 지우는 것이 아니라 방 저편을 지운다.
 *
 * 결정론에 영향을 주는 시뮬레이션 상수이므로 CVar 가 아니라 헤더 상수로 고정한다 (원칙 6).
 */
export const OBSERVE_RANGE_NIGHT = 20;

/**
 * 되돌아옴이 **눈에 보이기 시작하는** 지점 — recoverySeconds 에 대한 비율 (C013 ADDED).
 *
 * 이 비율을 넘으면 phase 가 depleted 에서 recovering 으로 넘어간다: 그림이 갈리고 둘레 흙이
 * 다시 짙어지며, 자리를 옮기는 원천은 그때 다음 마디로 옮겨 선다 (RULE-SOURCE-RECOVERY-001).
 *
 * 0.5 로 둔다 — Design 은 phase 셋만 말하고 언제 보이기 시작하는지는 말하지 않는다
 * (spec 기본형 ①). 절반은 흔적이 **예보**일 만큼 이르고(미리 가서 기다릴 수 있다),
 * 캐자마자 자리가 옮겨지지 않을 만큼 늦다.
 *
 * 결정론에 영향을 주는 시뮬레이션 상수이므로 CVar 가 아니라 헤더 상수로 고정한다 (원칙 6).
 * **회복의 길이**는 여기 없다 — 그것은 원천마다 다른 세계 데이터다 (content/regions · D3).
 */
export const RECOVERY_VISIBLE_FRACTION = 0.5;

/**
 * 지나가는 것이 **마디 하나에 머무는 세계 초** (C018 ADDED · spec 데이터 값 · 기본형 ②).
 *
 * 45 인 이유 — 마디 넷을 가진 경로는 180 초이고 낮이 240 초이므로 **하루 안에 시작하고
 * 끝난다**. 마디 둘을 가진 경로는 90 초이고 긴 밤이 360 초다. 지나가는 것이 철을 넘겨
 * 이어지면 "지나갔다" 가 아니라 "머문다" 가 되고, 그러면 때를 맞출 것이 없어진다.
 *
 * 세계에 하나인 값이다 — 마디의 길이는 경로마다의 사정이 아니라 "지나간다" 라는 것의
 * 걸음걸이다. 결정론에 영향을 주는 시뮬레이션 상수이므로 CVar 가 아니라 헤더 상수로
 * 고정한다 (원칙 6). **몇 마디인가**는 여기 없다 — 그것은 경로마다 다른 세계 데이터다.
 */
export const PRESENCE_SECONDS_PER_NODE = 45;

/**
 * 소란의 상수들 (C017 ADDED · spec 데이터 값 절 · 확정 5 · 11).
 *
 * **소란은 모든 방에 있는 값이다** (Time §2.5) — 미로의 압력처럼 방 하나에만 있는 특수한
 * 값이 아니다. 그래서 임계도 오름폭도 방 데이터가 아니라 여기 헤더 상수다: 어느 방에서도
 * 같은 일이 같은 값을 올린다 (미로의 압력 상수 P · k 가 그 방 데이터에 있는 것과 갈린다).
 *
 * 결정론에 영향을 주는 시뮬레이션 상수이므로 CVar 가 아니라 헤더 상수로 고정한다 (원칙 6).
 *
 *   임계 300 은 **한 몸이 한 철에 채울 수 없는 값**이다 — 셋이 함께라야 닿는다 (SPEC-004).
 *   값의 상한은 임계와 같다 (spec 기본형 ①): 임계(300)를 가라앉는 속도(0.5/s)로 비우는 데
 *   600 초이고 고요 한 철은 1080 초라, **넘친 만큼을 쌓아 두지 않아야** "깨어난 뒤 고요
 *   한 철을 비우면 잠든다" 가 참이 된다.
 */
export const DISTURBANCE_THRESHOLD = 300;
/** 채취 한 번이 올리는 값 — 캐는 것이 가장 크게 흔든다 */
export const DISTURBANCE_PER_HARVEST = 10;
/** **닿은** 타격 한 번 (빗나간 휘두름은 아무것도 올리지 않는다) */
export const DISTURBANCE_PER_STRIKE = 5;
/** 건너기 한 번 — 오르는 것은 **떠난 방**이다 (spec 기본형 ⑦) */
export const DISTURBANCE_PER_TRANSIT = 3;
/** 초당 가라앉는 값 — **고요에만** 준다 (spec R2). 0 에서 멈춘다 */
export const DISTURBANCE_DECAY_PER_SECOND = 0.5;

/**
 * 자국의 상수들 (C017 ADDED · spec 데이터 값 절 · 기본형 ④ ⑤).
 *
 *   나이 상한 60 초 — 자국은 나이로 사라진다 (spec R6)
 *   표본 간격 4.0 — 상호작용 거리(2.0)의 두 배다: 자국끼리 겹치지 않을 만큼 성글고,
 *                  기본 방(40×40)을 가로지르면 열 개 남짓이 남아 **방향**이 읽힌다
 *   한 방의 상한 48 — 저장되는 값이므로 상한이 없으면 스냅샷이 끝없이 커진다.
 *                  관찰자 셋이 저마다 열여섯 걸음(64 거리)씩 남긴 최근 자취다
 *
 * 결정론에 영향을 주는 시뮬레이션 상수이므로 CVar 가 아니라 헤더 상수로 고정한다 (원칙 6).
 */
export const TRACK_LIFETIME_SECONDS = 60;
export const TRACK_STEP_DISTANCE = 4.0;
export const TRACK_LIMIT_PER_REGION = 48;

/**
 * **다 찼다** 를 판정하는 티끌 (C023 ADDED · spec SPEC-003 · SPEC-007).
 *
 * 0..1 의 진행에 `dt / 길이` 를 더해 가면 부동소수의 티끌이 남는다 — 1/90 을 아흔 번 더해도
 * 1 에 닿지 않는다 (0.999…84). 그대로 두면 데이터가 말한 **90 세계 초가 91 초**가 되어
 * 세계가 자기 데이터와 다른 말을 한다 (60 은 우연히 딱 떨어져 C022 에서 드러나지 않았다).
 *
 * 그래서 1 에 이만큼보다 가까우면 다 찬 것으로 친다. 세계 초 하나에 견주면 티끌보다 작으므로
 * 어떤 길이의 탄생지도 이 값 때문에 한 tick 일찍 차지 않는다.
 * 결정론에 영향을 주는 시뮬레이션 상수이므로 CVar 가 아니라 헤더 상수로 고정한다 (원칙 6).
 */
export const PROGRESS_EPSILON = 1e-9;

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
// C016 — World.turnsApplied 가 실린다 (뒤척임은 사건이므로 세계가 기억한다). 형태가 바뀌므로
//        옛 스냅샷은 복구되지 않는다 (spec SPEC-009 경계).
// C017 — 방의 State 에 소란(모든 방)과 자국이, 몸에 마지막 자국 뒤로 걸은 거리가 실린다.
//        지금까지 State 자체가 없던 방에도 State 가 생기므로 형태가 바뀐다 —
//        옛 스냅샷은 복구되지 않는다 (spec SPEC-010 경계).
// C018 — World.presences 가 실린다 (지나가는 것의 지금 — 시작한 시각 · 시작한 바퀴 ·
//        지나간 수 · 이번에 고른 방들). 형태가 바뀌므로 옛 스냅샷은 복구되지 않는다
//        (spec SPEC-008 경계).
export const STATE_VERSION = 'hkt-adv-proto-i/10';
