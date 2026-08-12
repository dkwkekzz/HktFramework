// Authoritative World — C001 Stone Mining
// State 는 이 모듈 내부에만 존재한다. 외부는 dispatch / tick / project 로만 접근한다 (World Authority).
// 실행 범위는 Cycle Scope 가 정한다 — 지정한 Cycle 까지의 Rule 만 굴린다.

import type { ActionRequest, ActionResult } from '../protocol/actions';
import type { GameViewSnapshot } from '../protocol/gameview';
import { RULE_MOVE_PROGRESS } from '../protocol/semantic-id';
import { dispatchAction } from './actions/dispatch';
import { resolveCycleScope, type CycleScope } from './cycle/scope';
import type { CycleEntry } from './cycle/registry';
import { projectPlayerView } from './projection/player-view';
import { createInventory } from './semantic/inventory';
import { ruleMoveProgress } from './simulation/move-progress';
import { MOVE_SPEED, WORLD_BOUNDS, type WorldState } from './semantic/world-state';

export interface World {
  dispatch(action: ActionRequest): ActionResult;
  tick(dt: number): void;
  projectPlayerView(): GameViewSnapshot;
  /** 이 World 가 굴리고 있는 Cycle 범위 — 실행 정보이지 View 계약이 아니다 */
  readonly scope: CycleScope;
}

export interface WorldSetup {
  /** 어느 Cycle 까지의 게임을 굴릴 것인가 — 미지정이면 최신 Cycle(현재 게임) */
  upToCycle?: string | null;
  /** Cycle Registry 주입 (테스트용) */
  cycleRegistry?: readonly CycleEntry[];
  actorPosition?: { x: number; z: number };
  actorItems?: Partial<Record<'stone' | 'pickaxe', number>>;
  depositPosition?: { x: number; z: number };
  depositAmount?: number;
}

export function createWorld(setup: WorldSetup = {}): World {
  const scope = resolveCycleScope(setup.upToCycle, setup.cycleRegistry);

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
    scope,
    dispatch: (action) => dispatchAction(state, action, scope),
    tick: (dt) => {
      if (scope.allowsRule(RULE_MOVE_PROGRESS)) ruleMoveProgress(state, dt);
    },
    projectPlayerView: () => projectPlayerView(state),
  };
}

export { listCycles, latestCycleId, resolveCycleScope, UnknownCycleError } from './cycle/scope';
export type { CycleScope } from './cycle/scope';
export type { CycleEntry, CycleId } from './cycle/registry';
