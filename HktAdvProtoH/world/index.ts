// Authoritative World — C001 Stone Mining
// State 는 이 모듈 내부에만 존재한다. 외부는 dispatch / tick / project 로만 접근한다 (World Authority).

import type { ActionRequest, ActionResult } from '../protocol/actions';
import type { GameViewSnapshot } from '../protocol/gameview';
import { dispatchAction } from './actions/dispatch';
import { projectPlayerView } from './projection/player-view';
import { createInventory } from './semantic/inventory';
import { ruleMoveProgress } from './simulation/move-progress';
import { MOVE_SPEED, WORLD_BOUNDS, type WorldState } from './semantic/world-state';

export interface World {
  dispatch(action: ActionRequest): ActionResult;
  tick(dt: number): void;
  projectPlayerView(): GameViewSnapshot;
}

export interface WorldSetup {
  actorPosition?: { x: number; z: number };
  actorItems?: Partial<Record<'stone' | 'pickaxe', number>>;
  depositPosition?: { x: number; z: number };
  depositAmount?: number;
}

export function createWorld(setup: WorldSetup = {}): World {
  const state: WorldState = {
    bounds: WORLD_BOUNDS,
    actor: {
      position: setup.actorPosition ?? { x: 0, z: 0 },
      moveTarget: null,
      moveSpeed: MOVE_SPEED,
      inventory: createInventory(setup.actorItems ?? { pickaxe: 1 }),
    },
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
    tick: (dt) => {
      ruleMoveProgress(state, dt);
    },
    projectPlayerView: () => projectPlayerView(state),
  };
}
