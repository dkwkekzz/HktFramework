// Authoritative World — C001 Stone Mining · C002 Character Action · C003 Server Separation
//                       · C004 Multi Observer
// State 는 이 모듈 내부에만 존재한다. 밖으로 나가는 것은 Tick 이 내보내는 관찰 결과뿐이고,
// 안으로 들어오는 것은 참여/이탈과 Action Request 뿐이다 (World Authority).

import type { ActionRequest } from '../protocol/actions';
import type { GameViewSnapshot } from '../protocol/gameview';
import { idleAction } from './semantic/action';
import type { ActorState } from './semantic/actor';
import { BODY_HEIGHT, BODY_MASS, BODY_RADIUS, DEFAULT_FACING } from './semantic/collision';
import { combatProfile } from './semantic/combat';
import { createInventory } from './semantic/inventory';
import type { WorldPosition } from './semantic/position';
import { DEFAULT_BODY, type BodyDefaults } from './rules/observer-join';
import {
  ruleWorldTick,
  type PendingObserverEvent,
  type PendingRequest,
  type WorldTickResult,
} from './simulation/world-tick';
import {
  ATTACK_RANGE,
  NPC_MOVE_SPEED,
  PERCEPTION_RANGE,
  SPAWN_POINTS,
  WORLD_BOUNDS,
  type WorldState,
} from './semantic/world-state';

// C003 CHANGED — 세계는 요청을 "받아 두고" 자기 Tick 에 판정한다.
// C004 CHANGED — 관찰자가 누구인지 세계가 알아야 하므로 참여/이탈이 경계에 생겼고,
//                요청은 어느 이어짐으로 왔는지와 함께 도착한다.
//                외부가 상태를 읽어 가는 경로(pull)는 여전히 없다.
export interface World {
  /** 관찰자가 자신을 밝히고 들어온다. 다음 Tick 이 RULE-OBSERVER-JOIN-001 로 판정한다 */
  join(observerId: string): void;
  /** 관찰자가 이어짐을 잃었다. 다음 Tick 이 RULE-OBSERVER-LEAVE-001 로 판정한다 */
  leave(observerId: string): void;
  /** 요청이 세계에 도착한다. 즉시 판정되지 않는다 (INTENT-REMOTE-REQUEST-001) */
  request(observerId: string, action: ActionRequest): void;
  /**
   * 관찰자의 표식이 세계에 도착한다 (C005). 게임을 아무것도 바꾸지 않는다 —
   * 다음 Tick 이 RULE-OBSERVER-MARK-001 로 받아들이고, 받아들인 자리가
   * 그 관찰자의 관찰 결과에 실려 돌아간다.
   */
  mark(observerId: string, mark: number): void;
  /** RULE-WORLD-TICK-001 — 세계의 시계만이 부른다 (검증 시에는 테스트가 직접 부른다) */
  tick(dt: number): WorldTickResult;
  /** 그 관찰자에게 마지막으로 나간 관찰 결과. 새로 만들지 않는다 */
  latestObservation(observerId: string): GameViewSnapshot | null;
}

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

export function createWorld(setup: WorldSetup = {}): World {
  // C004 CHANGED — 세계가 시작할 때 조종되는 몸은 없다.
  // 몸은 관찰자가 들어올 때 RULE-OBSERVER-JOIN-001 이 만든다.
  const npcs: ActorState[] = (setup.npcs ?? DEFAULT_NPCS).map((npc, ordinal) => {
    const kind = npc.characterKind ?? 'wanderer';
    // C007 — 자율 존재도 자기 종류의 자원·템포 능력치를 갖는다. 이름은 종류 + 순번이다.
    const profile = combatProfile(kind);
    return {
      id: npc.id,
      name: npc.name ?? `Wanderer ${ordinal + 1}`,
      characterKind: kind,
      control: 'autonomous' as const,
      position: { x: npc.position.x, z: npc.position.z },
      bodyRadius: BODY_RADIUS,
      bodyHeight: BODY_HEIGHT,
      bodyMass: BODY_MASS,
      facing: { x: DEFAULT_FACING.x, z: DEFAULT_FACING.z },
      velocity: { x: 0, z: 0 },
      hp: profile.hpMax,
      hpMax: profile.hpMax,
      cp: profile.cpStart,
      cpMax: profile.cpMax,
      moveMode: 'walk' as const,
      moveSpeed: profile.moveSpeed,
      runSpeedMultiplier: profile.runSpeedMultiplier,
      actionSpeed: profile.actionSpeed,
      attackRange: ATTACK_RANGE,
      perceptionRange: npc.perceptionRange ?? PERCEPTION_RANGE,
      wanderPath: (npc.wanderPath ?? []).map((p) => ({ x: p.x, z: p.z })),
      wanderIndex: 0,
      inventory: createInventory(),
      currentAction: idleAction(),
    };
  });

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

  // 도착했지만 아직 처리되지 않은 것들 — 다음 Tick 의 처리 대상이다.
  const pendingObservers: PendingObserverEvent[] = [];
  const pending: PendingRequest[] = [];
  // 관찰자마다 마지막으로 나간 관찰 결과. 세계는 이미 내보낸 것을 되돌려줄 뿐이다.
  const latest = new Map<string, GameViewSnapshot>();

  return {
    join: (observerId) => {
      pendingObservers.push({ kind: 'join', observerId });
    },
    leave: (observerId) => {
      pendingObservers.push({ kind: 'leave', observerId });
    },
    request: (observerId, action) => {
      pending.push({ observerId, action });
    },
    mark: (observerId, mark) => {
      pendingObservers.push({ kind: 'mark', observerId, mark });
    },
    tick: (dt) => {
      const result = ruleWorldTick(state, dt, pendingObservers, pending, bodyDefaults);
      for (const [observerId, snapshot] of result.observations) latest.set(observerId, snapshot);
      return result;
    },
    latestObservation: (observerId) => latest.get(observerId) ?? null,
  };
}
