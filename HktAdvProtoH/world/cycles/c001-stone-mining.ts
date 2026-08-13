// C001 Stone Mining — 이 Cycle 이 공유 World 에 더한 Delta.
// cycles/C001-stone-mining/03-world-semantic.md 가 의미의 단일 출처다.

import type { CycleModule } from '../kernel/cycle-module';
import { createInventory } from '../semantic/inventory';
import { MOVE_SPEED } from '../semantic/world-state';
import { ruleMine } from '../rules/mine';
import { ruleMove } from '../rules/move';
import { ruleMoveProgress } from '../simulation/move-progress';
import { projectC001 } from '../projection/player-view';

export const c001StoneMining: CycleModule = {
  id: 'C001-stone-mining',

  setup(state, options) {
    state.actor.position = options.actorPosition ?? { x: 0, z: 0 };
    state.actor.moveSpeed = MOVE_SPEED;
    state.actor.inventory = createInventory(options.actorItems ?? { pickaxe: 1 });
    state.deposits.push({
      id: 'deposit-1',
      position: options.depositPosition ?? { x: 8, z: -6 },
      resourceKind: 'stone',
      resourceAmount: options.depositAmount ?? 5,
    });
  },

  actions: {
    move: (state, action) =>
      action.position
        ? ruleMove(state, action.position)
        : { status: 'failure', rule: 'DISPATCH', reason: 'missing-position' },
    mine: (state, action) =>
      action.targetEntityId
        ? ruleMine(state, action.targetEntityId)
        : { status: 'failure', rule: 'DISPATCH', reason: 'missing-target' },
  },

  laws: [(state, dt) => void ruleMoveProgress(state, dt)],

  project: projectC001,
};
