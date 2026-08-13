// Authoritative World — C001 Stone Mining · C002 Character Action · C003 Server Separation
// State 는 이 모듈 내부에만 존재한다. 밖으로 나가는 것은 Tick 이 내보내는 관찰 결과뿐이고,
// 안으로 들어오는 것은 Action Request 뿐이다 (World Authority).

import type { ActionRequest } from '../protocol/actions';
import type { GameViewSnapshot } from '../protocol/gameview';
import { projectPlayerView } from './projection/player-view';
import { idleAction } from './semantic/action';
import type { ActorState } from './semantic/actor';
import { createInventory } from './semantic/inventory';
import type { WorldPosition } from './semantic/position';
import { ruleWorldTick, type WorldTickResult } from './simulation/world-tick';
import {
  ATTACK_RANGE,
  MOVE_SPEED,
  NPC_MOVE_SPEED,
  PERCEPTION_RANGE,
  WORLD_BOUNDS,
  type WorldState,
} from './semantic/world-state';

// C003 CHANGED — 세계는 요청을 "받아 두고" 자기 Tick 에 판정한다.
// 외부가 상태를 읽어 가는 경로(pull)는 없다 — 관찰 결과는 Tick 이 내보낸다.
export interface World {
  /** 요청이 세계에 도착한다. 즉시 판정되지 않는다 (INTENT-REMOTE-REQUEST-001) */
  request(action: ActionRequest): void;
  /** RULE-WORLD-TICK-001 — 세계의 시계만이 부른다 (검증 시에는 테스트가 직접 부른다) */
  tick(dt: number): WorldTickResult;
  /** 마지막 Tick 이 내보낸 관찰 결과. 새로 만들지 않는다 — 이미 나간 것을 되돌려줄 뿐 */
  latestObservation(): GameViewSnapshot;
}

export interface NpcSetup {
  id: string;
  characterKind?: string;
  position: WorldPosition;
  wanderPath?: WorldPosition[];
  perceptionRange?: number;
}

export interface WorldSetup {
  actorPosition?: { x: number; z: number };
  actorItems?: Partial<Record<'stone' | 'pickaxe', number>>;
  actorCharacterKind?: string;
  depositPosition?: { x: number; z: number };
  depositAmount?: number;
  npcs?: NpcSetup[];
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
  const player: ActorState = {
    id: 'player',
    characterKind: setup.actorCharacterKind ?? 'rabbit-swordsman',
    control: 'player',
    position: setup.actorPosition ?? { x: 0, z: 0 },
    moveSpeed: MOVE_SPEED,
    attackRange: ATTACK_RANGE,
    perceptionRange: PERCEPTION_RANGE,
    wanderPath: [],
    wanderIndex: 0,
    inventory: createInventory(setup.actorItems ?? { pickaxe: 1 }),
    currentAction: idleAction(),
  };

  const npcs: ActorState[] = (setup.npcs ?? DEFAULT_NPCS).map((npc) => ({
    id: npc.id,
    characterKind: npc.characterKind ?? 'wanderer',
    control: 'autonomous',
    position: { x: npc.position.x, z: npc.position.z },
    moveSpeed: NPC_MOVE_SPEED,
    attackRange: ATTACK_RANGE,
    perceptionRange: npc.perceptionRange ?? PERCEPTION_RANGE,
    wanderPath: (npc.wanderPath ?? []).map((p) => ({ x: p.x, z: p.z })),
    wanderIndex: 0,
    inventory: createInventory(),
    currentAction: idleAction(),
  }));

  const state: WorldState = {
    bounds: WORLD_BOUNDS,
    actors: [player, ...npcs],
    deposits: [
      {
        id: 'deposit-1',
        position: setup.depositPosition ?? { x: 8, z: -6 },
        resourceKind: 'stone',
        resourceAmount: setup.depositAmount ?? 5,
      },
    ],
    time: 0,
  };

  // 도착했지만 아직 판정되지 않은 요청들 — 다음 Tick 의 처리 대상이다.
  const pending: ActionRequest[] = [];
  let latest: GameViewSnapshot = projectPlayerView(state);

  return {
    request: (action) => {
      pending.push(action);
    },
    tick: (dt) => {
      const result = ruleWorldTick(state, dt, pending);
      latest = result.snapshot;
      return result;
    },
    latestObservation: () => latest,
  };
}
