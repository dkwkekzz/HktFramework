// Authoritative World — C001 Stone Mining · C002 Character Action & Animation
// State 는 이 모듈 내부에만 존재한다. 외부는 dispatch / tick / project 로만 접근한다 (World Authority).

import type { ActionRequest, ActionResult } from '../protocol/actions';
import type { GameViewSnapshot } from '../protocol/gameview';
import { dispatchAction } from './actions/dispatch';
import { projectPlayerView } from './projection/player-view';
import { idleAction } from './semantic/action';
import type { ActorState } from './semantic/actor';
import { createInventory } from './semantic/inventory';
import type { WorldPosition } from './semantic/position';
import { ruleActionProgress } from './simulation/action-progress';
import { ruleMoveProgress } from './simulation/move-progress';
import { ruleNpcDecideAll } from './simulation/npc-decide';
import {
  ATTACK_RANGE,
  MOVE_SPEED,
  NPC_MOVE_SPEED,
  PERCEPTION_RANGE,
  WORLD_BOUNDS,
  type WorldState,
} from './semantic/world-state';

export interface World {
  dispatch(action: ActionRequest): ActionResult;
  tick(dt: number): void;
  projectPlayerView(): GameViewSnapshot;
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

// 세계의 기본 배치 — 자율 캐릭터 2종이 각자의 순회 경로를 돈다.
const DEFAULT_NPCS: NpcSetup[] = [
  {
    id: 'npc-1',
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
  };

  return {
    dispatch: (action) => dispatchAction(state, action),
    // Tick 순서는 결정론의 일부다 — 결정 → 이동 진행 → 행동 진행(완료 효과)
    tick: (dt) => {
      ruleNpcDecideAll(state);
      ruleMoveProgress(state, dt);
      ruleActionProgress(state, dt);
    },
    projectPlayerView: () => projectPlayerView(state),
  };
}
