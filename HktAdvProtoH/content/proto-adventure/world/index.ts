// proto-adventure 팩의 World — C001 Stone Mining · C002 Character Action · C003 Server
//                                Separation · C004 Multi Observer … C015 Critical
//
// P1 CHANGED — 세계의 껍데기(요청 큐·관찰자 인과·Tick 프레임)는 Engine 의
// world-kernel 이 소유한다. 이 파일은 이 팩의 세계에 **무엇이 있는지**를 등록한다:
// 초기 배치, interaction 목록, 시스템 진행 순서, 관찰자 몸, 투영.

import { createWorldKernel, type World } from '../../../engine/world-kernel/kernel';
import type { WorldContent } from '../../../engine/world-kernel/content';
import { INTERACTIONS } from './actions/interactions';
import { projectObserverView } from './projection/observer-view';
import { DEFAULT_BODY, spawnObserverBody, type BodyDefaults } from './rules/observer-body';
import type { ActorState } from './semantic/actor';
import type { WorldPosition } from './semantic/position';
import { spawnActor } from './semantic/spawn';
import {
  DEFAULT_CHANCE_SEED,
  SPAWN_POINTS,
  TICK_INTERVAL,
  WORLD_BOUNDS,
  type WorldState,
} from './semantic/world-state';
import { ruleActionProgress } from './simulation/action-progress';
import { ruleBodyMomentum } from './simulation/body-momentum';
import { ruleBodyPush } from './simulation/body-push';
import { ruleCpRunDrain } from './simulation/cp-run-drain';
import { ruleMoveProgress } from './simulation/move-progress';
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
}

export interface WorldSetup {
  /** 첫 번째 관찰자의 몸이 놓일 자리 — 검증용 초기 배치 (SPAWN_POINTS[0] 를 대신한다) */
  actorPosition?: { x: number; z: number };
  actorItems?: Partial<Record<'stone' | 'pickaxe', number>>;
  actorCharacterKind?: string;
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

// 세계의 기본 배치 — 자율 캐릭터 둘이 각자의 순회 경로를 돈다.
// characterKind 를 바꾸면 그 캐릭터가 쓰는 모션 집합이 바뀐다 (motions/<종류>/ 폴더).
const DEFAULT_NPCS: NpcSetup[] = [
  {
    id: 'npc-1',
    characterKind: 'wanderer',
    position: { x: -8, z: 4 },
    wanderPath: [
      { x: -8, z: 4 },
      { x: -8, z: -6 },
      { x: 2, z: -6 },
      { x: 2, z: 4 },
    ],
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
  (state) => ruleNpcDecideAll(state), // RULE-NPC-DECIDE-001
  (state, dt) => ruleMoveProgress(state, dt), // RULE-MOVE-PROGRESS-001
  (state, dt) => ruleActionProgress(state, dt), // RULE-ACTION-PROGRESS-001
  (state) => ruleSwingStrike(state), // RULE-SWING-STRIKE-001 (C006 — C007 에서 STRIKE-DAMAGE → SKILL-BUDGET → DOWNED 를 함께 부른다)
  (state, dt) => ruleBodyPush(state, dt), // RULE-BODY-PUSH-001 (C006)
  (state, dt) => ruleBodyMomentum(state, dt), // RULE-BODY-MOMENTUM-001 (C006)
  (state, dt) => ruleCpRunDrain(state, dt), // RULE-CP-RUN-DRAIN-001 (C007)
  // C017 — 성립하지 않게 된 지목을 비운다. 이 Tick 의 모든 변화가 끝난 뒤에 훑어야
  // 그 Tick 에 사라진 존재까지 본다 (RULE-TARGET-CLEAR-STALE-001).
  (state) => ruleTargetClearStale(state),
];

// 만료가 시간 진행 뒤에 오는 이유 (C007): 방금 일어난 결과가 최소 한 번은 관찰되어야 한다.
const POST_TIME_SYSTEMS: WorldContent<WorldState>['postTimeSystems'] = [
  (state) => ruleStrikeEventExpire(state), // RULE-STRIKE-EVENT-EXPIRE-001 (C007)
];

export function createWorld(setup: WorldSetup = {}): World {
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
    }),
  );

  const state: WorldState = {
    bounds: WORLD_BOUNDS,
    actors: npcs,
    deposits: [
      {
        id: 'deposit-1',
        position: setup.depositPosition ?? { x: 8, z: -6 },
        resourceKind: 'stone',
        resourceAmount: setup.depositAmount ?? 5,
      },
    ],
    time: 0,
    observers: [],
    strikeEvents: [],
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
    spawnPoints: setup.actorPosition
      ? [{ x: setup.actorPosition.x, z: setup.actorPosition.z }, ...SPAWN_POINTS.slice(1)]
      : SPAWN_POINTS,
  };

  const content: WorldContent<WorldState> = {
    tickInterval: TICK_INTERVAL,
    spawnObserverBody: (worldState, ordinal) =>
      spawnObserverBody(worldState, ordinal, bodyDefaults),
    interactions: INTERACTIONS,
    systems: SYSTEMS,
    postTimeSystems: POST_TIME_SYSTEMS,
    projectObserver: projectObserverView,
  };

  return createWorldKernel(state, content);
}
