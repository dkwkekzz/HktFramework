// proto-adventure 팩의 World — C001 Stone Mining · C002 Character Action · C003 Server
//                                Separation · C004 Multi Observer … C015 Critical
//
// P1 CHANGED — 세계의 껍데기(요청 큐·관찰자 인과·Tick 프레임)는 Engine 의
// world-kernel 이 소유한다. 이 파일은 이 팩의 세계에 **무엇이 있는지**를 등록한다:
// 초기 배치, interaction 목록, 시스템 진행 순서, 관찰자 몸, 투영.

import { createWorldKernel, type World } from '../../../engine/world-kernel/kernel';
import type { WorldContent } from '../../../engine/world-kernel/content';
import { restoreState, type WorldSnapshot } from '../../../engine/world-kernel/persistence';
import { INTERACTIONS } from './actions/interactions';
import { projectObserverView } from './projection/observer-view';
import { DEFAULT_BODY, spawnObserverBody, type BodyDefaults } from './rules/observer-body';
import type { ActorState } from './semantic/actor';
import type { ItemKind } from './semantic/item';
import type { WorldPosition } from './semantic/position';
import { spawnActor } from './semantic/spawn';
import {
  DEFAULT_CHANCE_SEED,
  GROUND_ZONES,
  SPAWN_POINTS,
  STATE_VERSION,
  TICK_INTERVAL,
  WORLD_BOUNDS,
  type WorldState,
} from './semantic/world-state';
import { ruleActionProgress } from './simulation/action-progress';
import { ruleBodyMomentum } from './simulation/body-momentum';
import { ruleBodyPush } from './simulation/body-push';
import { ruleCpRunDrain } from './simulation/cp-run-drain';
import { ruleGroundLawApply } from './simulation/ground-law-apply';
import { ruleGroundVent } from './simulation/ground-vent';
import { ruleMoveProgress } from './simulation/move-progress';
import { ruleNpcAllocationAll } from './simulation/npc-allocation';
import { ruleNpcDecideAll } from './simulation/npc-decide';
import { ruleStrikeEventExpire } from './simulation/strike-event-expire';
import { ruleTargetClearStale } from './simulation/target-clear-stale';
import { ruleSwingStrike } from './simulation/swing-strike';

export type { World } from '../../../engine/world-kernel/kernel';

export interface NpcSetup {
  id: string;
  name?: string; // C007 — 밝히지 않으면 세계가 종류 + 순번으로 정한다
  characterKind?: string;
  position: WorldPosition;
  wanderPath?: WorldPosition[];
  perceptionRange?: number;
  /** C018 — 지키는 자리 (중심 · 반경). 밝히지 않으면 지킬 것이 없다 */
  guardedGround?: { center: WorldPosition; radius: number };
}

export interface WorldSetup {
  /** 첫 번째 관찰자의 몸이 놓일 자리 — 검증용 초기 배치 (SPAWN_POINTS[0] 를 대신한다) */
  actorPosition?: { x: number; z: number };
  /** C020 CHANGED — 세계가 정의한 어떤 종류든 실릴 수 있다 */
  actorItems?: Partial<Record<ItemKind, number>>;
  actorCharacterKind?: string;
  /**
   * C018 — 관찰자의 몸이 지닐 지키는 자리. 밝히지 않으면 없다.
   * 사람의 몸도 지킬 것을 가질 수 있다 — 태도의 규칙에 주체의 종류로 낸 예외가 없다.
   */
  actorGuardedGround?: { center: WorldPosition; radius: number };
  depositPosition?: { x: number; z: number };
  depositAmount?: number;
  npcs?: NpcSetup[];
  /** C007 R2 — 속성 변경을 허용할 것인가 (World.DebugAuthority). 요청으로는 바꿀 수 없다 */
  debugAuthority?: boolean;
  /**
   * C015 — 이 세계가 지닐 흔들림의 뿌리 (World.ChanceSeed). 요청으로는 바꿀 수 없다 —
   * DebugAuthority 와 같은 자리, 즉 세계를 띄우는 쪽의 결정이다.
   * 밝히지 않으면 세계의 기본 뿌리다. 같은 뿌리 + 같은 순서 = 같은 이야기이므로
   * 되짚기는 여기서 뿌리를 지정해 하는 일이지 관찰로 하는 일이 아니다.
   */
  chanceSeed?: number;
}

// 세계의 기본 배치 — 자율 캐릭터 둘. 하나는 지킬 것이 있고 하나는 없다 (C018 CHANGED).
// characterKind 를 바꾸면 그 캐릭터가 쓰는 모션 집합이 바뀐다 (motions/<종류>/ 폴더).
//
// C018 — 이 둘의 차이가 이 Cycle 의 플레이다. npc-1 은 자기 자리를 지니고 그 안을
// 순회하므로 그 자리에 든 것을 사냥감으로 대하고, npc-2 는 지킬 것이 없어 누구도
// 쫓지 않는다. 두 몸의 종류·능력치는 완전히 같다 — 다른 것은 지킬 것이 있는가뿐이다.
// 모든 SPAWN_POINTS 가 npc-1 의 자리 밖이라 **처음에는 아무도 나를 사냥감으로 보지
// 않는다** — 다가가는 것이 플레이어의 선택이다 (DC-WORLD-COMBAT-IS-ONE-POSSIBILITY).
const DEFAULT_NPCS: NpcSetup[] = [
  {
    id: 'npc-1',
    characterKind: 'wanderer',
    position: { x: -10, z: -8 },
    // 순회 경로가 자기 자리 안에 있다 — 자기 자리를 도는 존재여야 "지킨다" 로 읽힌다
    wanderPath: [
      { x: -13, z: -8 },
      { x: -7, z: -8 },
      { x: -10, z: -12 },
    ],
    // 반경은 인지 거리(9.0)보다 작다 — 자리에 든 침입자를 대개 곧 알아채고,
    // 자리 밖으로 나간 것을 계속 쫓는 일이 생기지 않는다 (03 BALANCE)
    guardedGround: { center: { x: -10, z: -8 }, radius: 7.0 },
  },
  {
    id: 'npc-2',
    characterKind: 'wanderer',
    position: { x: 12, z: 8 },
    wanderPath: [
      { x: 12, z: 8 },
      { x: 4, z: 12 },
    ],
  },
];

// Tick 진행 순서 — 결정론은 이 한 배열이 지킨다 (설계 반전 ② · RULE-WORLD-TICK-001).
// 의도한 이동(move-progress)이 먼저 자리를 정하고, 물리(swing~momentum)가 그 자리를
// 세계 규칙으로 보정한다. 기력 누수가 물리 뒤에 오는 이유 (C007): 이 Tick 에
// 실제로 달려 움직인 결과에 값을 치른다.
const SYSTEMS: WorldContent<WorldState>['systems'] = [
  // C-COMBAT-001 — 배분이 먼저다. 몰아 두는 일은 **자세**이고 기술 고르기는 그 자세로
  // 하는 **행동**이므로, 같은 Tick 안에서 자세가 먼저 정해져야 그 Tick 의 판정이
  // 방금 고른 배분을 읽는다 (RULE-NPC-ALLOCATION-001).
  (state) => ruleNpcAllocationAll(state),
  (state) => ruleNpcDecideAll(state), // RULE-NPC-DECIDE-001
  (state, dt) => ruleMoveProgress(state, dt), // RULE-MOVE-PROGRESS-001
  (state, dt) => ruleActionProgress(state, dt), // RULE-ACTION-PROGRESS-001
  (state) => ruleSwingStrike(state), // RULE-SWING-STRIKE-001 (C006 — C007 에서 STRIKE-DAMAGE → SKILL-BUDGET → DOWNED 를 함께 부른다)
  (state, dt) => ruleBodyPush(state, dt), // RULE-BODY-PUSH-001 (C006)
  (state, dt) => ruleBodyMomentum(state, dt), // RULE-BODY-MOMENTUM-001 (C006)
  (state, dt) => ruleCpRunDrain(state, dt), // RULE-CP-RUN-DRAIN-001 (C007)
  // C-TERRAIN-001 — 땅이 거두어 간다. 기력 누수 바로 뒤인 이유가 같다: 의도한 이동과
  // 물리 보정이 모두 끝난 뒤라야 "어디에 서 있는가" 가 확정되고, 이 Tick 에 실제로
  // 서 있게 된 자리에 대해 값을 치른다 (RULE-GROUND-LAW-APPLY-001).
  // 지목 정리보다 **앞**이어야 한다 — 이 규칙이 몸을 쓰러뜨릴 수 있다.
  (state, dt) => ruleGroundLawApply(state, dt),
  // C-TERRAIN-002 — 넘친 자리가 뿜고, 뿜는 것을 그 안의 몸이 받고, 다 쓰면 닫힌다.
  // 거두는 규칙 **바로 뒤**여야 한다: 이 Tick 의 kept 가 먼저 확정된 뒤 그것이 넘침인지를
  // 같은 Tick 에서 물어야 "찼다" 와 "열린다" 사이에 한 Tick 의 틈이 없다
  // (RULE-GROUND-VENT-001).
  (state, dt) => ruleGroundVent(state, dt),
  // C017 — 성립하지 않게 된 지목을 비운다. 이 Tick 의 모든 변화가 끝난 뒤에 훑어야
  // 그 Tick 에 사라진 존재까지 본다 (RULE-TARGET-CLEAR-STALE-001).
  (state) => ruleTargetClearStale(state),
];

// 만료가 시간 진행 뒤에 오는 이유 (C007): 방금 일어난 결과가 최소 한 번은 관찰되어야 한다.
const POST_TIME_SYSTEMS: WorldContent<WorldState>['postTimeSystems'] = [
  (state) => ruleStrikeEventExpire(state), // RULE-STRIKE-EVENT-EXPIRE-001 (C007)
];

/**
 * 스냅샷에서 이 팩의 State 를 되살린다 — 버전이 다르면 null (복구 포기, 새 세계).
 * 되살린 State 는 createWorld 의 restored 로 넘긴다. 팩은 복구 State 를 해석하지
 * 않는다 — 초기 배치 대신 그것으로 커널을 조립할 뿐이다.
 */
export function restoreWorld(snapshot: WorldSnapshot): WorldState | null {
  return restoreState<WorldState>(snapshot, STATE_VERSION);
}

export function createWorld(setup: WorldSetup = {}, restored?: WorldState): World {
  // C004 CHANGED — 세계가 시작할 때 조종되는 몸은 없다.
  // 몸은 관찰자가 들어올 때 RULE-OBSERVER-JOIN-001 이 만든다.
  // C007 — 자율 존재도 자기 종류의 자원·템포 능력치를 갖는다 (character-catalog).
  // 이름은 종류 + 순번이다.
  const npcs: ActorState[] = (setup.npcs ?? DEFAULT_NPCS).map((npc, ordinal) =>
    spawnActor({
      id: npc.id,
      name: npc.name ?? `Wanderer ${ordinal + 1}`,
      characterKind: npc.characterKind ?? 'wanderer',
      control: 'autonomous',
      position: npc.position,
      wanderPath: npc.wanderPath,
      ...(npc.perceptionRange === undefined ? {} : { perceptionRange: npc.perceptionRange }),
      ...(npc.guardedGround === undefined ? {} : { guardedGround: npc.guardedGround }),
    }),
  );

  // 복구된 State 가 있으면 초기 배치는 일어나지 않는다 — 세계는 스냅샷의 그 순간부터
  // 이어진다 (design/Design-World-Persistence.md). setup 은 새 세계에만 뜻이 있다.
  const state: WorldState = restored ?? {
    bounds: WORLD_BOUNDS,
    actors: npcs,
    // C-TERRAIN-001 — 무대의 자리들. 헤더 상수를 State 로 놓는다 (world-state.ts#GROUND_ZONES).
    // 어떤 Rule 도 이것을 바꾸지 않는다 — 그럼에도 State 인 이유는 그 파일이 적는다.
    // C-TERRAIN-002 — kept · phase 가 실제로 변하므로 복사는 이제 필수다.
    // 헤더 상수를 그대로 넘기면 세계가 상수를 갈아 다음 세계가 오염된다.
    groundZones: GROUND_ZONES.map((zone) => ({
      ...zone,
      center: { x: zone.center.x, z: zone.center.z },
    })),
    deposits: [
      {
        id: 'deposit-1',
        position: setup.depositPosition ?? { x: 8, z: -6 },
        resourceKind: 'stone',
        // C022 — 5 → 12. 자리의 유한함은 **세계에 캘 것이 자리보다 많을 때만** 겪힌다.
        // 5 로는 가방이 차기 전에 광맥이 말라 그 Cycle 의 Goal 이 플레이에서 성립하지
        // 않는다. 규칙이 아니라 세계를 띄우는 값이다 (C022 03 RATIONALE 4).
        //
        // C023 — 12 → 15. **곡괭이가 가방을 떠났기 때문이다.** 걸면 가방이 한 자리
        // 가벼워져 담을 수 있는 돌이 9 에서 12 로 늘었고, 광맥 12 로는 가방이 차는
        // 순간과 광맥이 마르는 순간이 겹쳐 `no-room` 이 플레이에서 관찰되지 않는다.
        // C022 가 세운 그 관찰을 그대로 지키려고 값 하나를 옮긴 것이며, 규칙 코드는
        // 한 줄도 열리지 않았다 (C023 03-world-semantic.md BALANCE).
        resourceAmount: setup.depositAmount ?? 15,
      },
    ],
    time: 0,
    observers: [],
    strikeEvents: [],
    // C018 — 아무것도 무산되지 않은 채로 세계가 시작된다 (semantic/relation.ts).
    unharmedContacts: [],
    cancelEvents: [], // C019 ADDED
    growthEvents: [], // C-GROWTH-001 ADDED
    // C007 R2 — 속성 변경 권한은 세계 밖(세계를 띄우는 쪽)이 정한다.
    // 기본은 열려 있다: 이 프로토타입은 관찰과 시험이 목적이며, 닫으려면 세계를 그렇게 띄운다.
    debugAuthority: { open: setup.debugAuthority ?? true },
    // C014 — 아무도 아무것도 모르는 채로 세계가 시작된다.
    // 항목이 없다는 것이 곧 "아무것도 모른다" 다 (semantic/acquaintance.ts).
    acquaintances: [],
    // C017 — 아무도 아무것도 고르지 않은 채로 세계가 시작된다.
    // 항목이 없다는 것이 곧 "안 골랐다" 다 (semantic/target-selection.ts).
    targetSelections: [],
    // C015 — 세계가 지닌 흔들림. 뿌리는 세계 밖이 정하고, 커서는 0 에서 시작해
    // RULE-CRITICAL-STRIKE-001 만이 나아가게 한다 (INTENT-WORLD-CHANCE-001).
    chanceSeed: setup.chanceSeed ?? DEFAULT_CHANCE_SEED,
    chanceCursor: 0,
  };

  // 관찰자의 몸이 처음 만들어질 때 쓰는 기본값 — 세계의 초기 설정이다.
  const bodyDefaults: BodyDefaults = {
    characterKind: setup.actorCharacterKind ?? DEFAULT_BODY.characterKind,
    items: setup.actorItems ?? DEFAULT_BODY.items,
    ...(setup.actorGuardedGround === undefined
      ? {}
      : { guardedGround: setup.actorGuardedGround }),
    spawnPoints: setup.actorPosition
      ? [{ x: setup.actorPosition.x, z: setup.actorPosition.z }, ...SPAWN_POINTS.slice(1)]
      : SPAWN_POINTS,
  };

  const content: WorldContent<WorldState> = {
    tickInterval: TICK_INTERVAL,
    stateVersion: STATE_VERSION,
    spawnObserverBody: (worldState, ordinal) =>
      spawnObserverBody(worldState, ordinal, bodyDefaults),
    interactions: INTERACTIONS,
    systems: SYSTEMS,
    postTimeSystems: POST_TIME_SYSTEMS,
    projectObserver: projectObserverView,
  };

  return createWorldKernel(state, content);
}
