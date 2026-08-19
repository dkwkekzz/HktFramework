// proto-adventure 팩의 World — C001 Stone Mining · C002 Character Action · C003 Server
//                                Separation · C004 Multi Observer … C013 Penetration
//
// P1 CHANGED — 세계의 껍데기(요청 큐·관찰자 인과·Tick 프레임)는 Engine 의
// world-kernel 이 소유한다. 이 파일은 이 팩의 세계에 **무엇이 있는지**를 등록한다:
// 초기 배치, interaction 목록, 시스템 진행 순서, 관찰자 몸, 투영.
//
// 구현은 base(세계 골격) + 도메인 모듈(기능 영역)의 조합이다
// (design/Design-Pack-Domain-Modules.md). 도메인은 부품만 내놓고,
// **순서·State 한 벌·계약 전체는 이 조립과 base 가 소유한다** — 여기가 그 단일 출처다.

import { createWorldKernel, type World } from '../../../engine/world-kernel/kernel';
import type { WorldContent } from '../../../engine/world-kernel/content';
import * as base from './base/index';
import type { ActionCompletions } from './base/action-progress';
import { composeProjection } from './base/projection';
import { DEFAULT_BODY, spawnObserverBody, type BodyDefaults } from './base/observer-body';
import type { ActorState } from './base/actor';
import type { WorldPosition } from './base/position';
import { spawnActor } from './base/spawn';
import {
  SPAWN_POINTS,
  TICK_INTERVAL,
  WORLD_BOUNDS,
  type WorldState,
} from './base/world-state';
import type { WorldDomain } from './domain';
import { autonomy } from './domains/autonomy/index';
import { combat } from './domains/combat/index';
import { debug } from './domains/debug/index';
import { mining } from './domains/mining/index';
import { movement } from './domains/movement/index';

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

// 도메인 목록 — interaction 과 투영 기여를 잇는 순서다 (결정론의 Tick 순서와는 별개다).
// 새 도메인 신설 = 폴더 하나 + 이 배열의 항목 하나.
const DOMAINS: readonly WorldDomain[] = [movement, mining, combat, autonomy, debug];

// 행동 완료 효과 — 각 도메인이 자기 행동의 것을 내놓고 조립이 한 표로 모은다.
// 같은 행동을 두 도메인이 주장하면 뒤에 온 도메인이 이긴다 (팩 안의 일이다).
const ACTION_COMPLETIONS = Object.assign(
  {},
  ...DOMAINS.map((domain) => domain.actionCompletions ?? {}),
) as ActionCompletions;

const baseSystems = base.createSystems(ACTION_COMPLETIONS);

// Tick 진행 순서 — 결정론은 이 한 배열이 지킨다 (설계 반전 ② · RULE-WORLD-TICK-001).
// 도메인은 이름 붙은 부품만 내놓고 순서는 여기가 소유한다 (사실 1).
// 의도한 이동(move-progress)이 먼저 자리를 정하고, 물리(swing~momentum)가 그 자리를
// 세계 규칙으로 보정한다. 기력 누수가 물리 뒤에 오는 이유 (C007): 이 Tick 에
// 실제로 달려 움직인 결과에 값을 치른다.
const SYSTEMS: WorldContent<WorldState>['systems'] = [
  autonomy.systems.decide, // RULE-NPC-DECIDE-001
  movement.systems.progress, // RULE-MOVE-PROGRESS-001
  baseSystems.actionProgress, // RULE-ACTION-PROGRESS-001
  combat.systems.swingStrike, // RULE-SWING-STRIKE-001 (C006 — C007 에서 STRIKE-DAMAGE → SKILL-BUDGET → DOWNED 를 함께 부른다)
  baseSystems.bodyPush, // RULE-BODY-PUSH-001 (C006)
  baseSystems.bodyMomentum, // RULE-BODY-MOMENTUM-001 (C006)
  combat.systems.cpRunDrain, // RULE-CP-RUN-DRAIN-001 (C007)
];

// 만료가 시간 진행 뒤에 오는 이유 (C007): 방금 일어난 결과가 최소 한 번은 관찰되어야 한다.
const POST_TIME_SYSTEMS: WorldContent<WorldState>['postTimeSystems'] = [
  combat.systems.strikeEventExpire, // RULE-STRIKE-EVENT-EXPIRE-001 (C007)
];

// 투영 조립기 — 도메인 기여를 DOMAINS 순서로 합쳐 하나의 Snapshot 을 만든다 (사실 3).
const projectObserverView = composeProjection(DOMAINS);

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
    interactions: DOMAINS.flatMap((domain) => domain.interactions),
    systems: SYSTEMS,
    postTimeSystems: POST_TIME_SYSTEMS,
    projectObserver: projectObserverView,
  };

  return createWorldKernel(state, content);
}
