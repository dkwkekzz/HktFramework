// CYCLE C001 — Stone Mining
// 곡괭이를 보유한 캐릭터를 광맥까지 이동시켜 Mine 을 수행하면 Stone 1개를 얻는다.
//
// 이 파일이 C001 이 World 에 더한 것 전부다 — 내용물(seed) · Rule · 시간 법칙 · Projection.
// 이 모듈이 Scope 밖이면 이 Cycle 의 게임은 존재하지 않는다.

import { RULE_MINE, RULE_MOVE, RULE_MOVE_PROGRESS } from '../../../protocol/semantic-id';
import type { CycleModule } from '../../kernel/module';
import { projectPlayerView } from './projection/player-view';
import { ruleMine } from './rules/mine';
import { ruleMove } from './rules/move';
import { createInventory } from './semantic/inventory';
import { ruleMoveProgress } from './simulation/move-progress';
import { MOVE_SPEED, WORLD_BOUNDS } from './semantic/world-state';

export const C001_STONE_MINING: CycleModule = {
  id: 'C001',
  dir: 'C001-stone-mining',
  title: 'Stone Mining — 곡괭이로 광맥에서 Stone 채굴',

  // 이 Cycle 이 세계에 심는 것 — Actor 하나와 유한한 광맥 하나
  seed(state, setup) {
    state.bounds = WORLD_BOUNDS;
    state.actor = {
      position: setup.actorPosition ?? { x: 0, z: 0 },
      moveTarget: null,
      moveSpeed: MOVE_SPEED,
      inventory: createInventory(setup.actorItems ?? { pickaxe: 1 }),
    };
    state.deposits = [
      {
        id: 'deposit-1',
        position: setup.depositPosition ?? { x: 8, z: -6 },
        resourceKind: 'stone',
        resourceAmount: setup.depositAmount ?? 5,
      },
    ];
  },

  rules: [
    { actionType: 'move', ruleId: RULE_MOVE, run: (state, action) => ruleMove(state, action.target) },
    { actionType: 'mine', ruleId: RULE_MINE, run: (state, action) => ruleMine(state, action.depositId) },
  ],

  laws: [{ lawId: RULE_MOVE_PROGRESS, run: (state, dt) => void ruleMoveProgress(state, dt) }],

  project: projectPlayerView,
};
