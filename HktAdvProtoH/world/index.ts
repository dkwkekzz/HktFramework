// Authoritative World 커널 — Cycle Module 을 등록 순서대로 조립한다.
// State 는 이 모듈 내부에만 존재한다. 외부는 dispatch / tick / project 로만 접근한다.
//
// upToCycle 을 주면 그 Cycle 까지의 모듈만 조립한다 —
// 게임의 역사를 임의 시점까지 재생할 수 있다.

import type { ActionRequest, ActionResult } from '../protocol/actions';
import type { GameViewSnapshot } from '../protocol/gameview';
import { CYCLE_MODULES } from './cycles/index';
import type { CycleModule, WorldSetupOptions } from './kernel/cycle-module';
import { createInventory } from './semantic/inventory';
import { MOVE_SPEED, WORLD_BOUNDS, type WorldState } from './semantic/world-state';

export interface World {
  dispatch(action: ActionRequest): ActionResult;
  tick(dt: number): void;
  projectPlayerView(): GameViewSnapshot;
  /** 조립된 Cycle ID 목록 (등록 순서) */
  cycles: string[];
}

export interface WorldOptions extends WorldSetupOptions {
  /** 이 Cycle 까지만 조립한다 (생략 시 전체 = 최신 게임) */
  upToCycle?: string;
}

function modulesUpTo(upToCycle?: string): CycleModule[] {
  if (!upToCycle) return CYCLE_MODULES;
  const index = CYCLE_MODULES.findIndex((m) => m.id === upToCycle);
  if (index < 0) {
    throw new Error(
      `알 수 없는 Cycle: ${upToCycle} (등록: ${CYCLE_MODULES.map((m) => m.id).join(', ')})`,
    );
  }
  return CYCLE_MODULES.slice(0, index + 1);
}

export function createWorld(options: WorldOptions = {}): World {
  const modules = modulesUpTo(options.upToCycle);

  // 공유 World 의 뼈대 — 내용물(장비·Deposit 등)은 각 Cycle 의 setup 이 더한다
  const state: WorldState = {
    bounds: WORLD_BOUNDS,
    actor: {
      position: { x: 0, z: 0 },
      moveTarget: null,
      moveSpeed: MOVE_SPEED,
      inventory: createInventory({}),
    },
    deposits: [],
  };
  for (const m of modules) m.setup(state, options);

  return {
    cycles: modules.map((m) => m.id),

    dispatch(action) {
      // 뒤 Cycle 이 같은 interactionId 를 등록하면 override 한다
      for (let i = modules.length - 1; i >= 0; i--) {
        const handler = modules[i]?.actions[action.interactionId];
        if (handler) return handler(state, action);
      }
      return { status: 'failure', rule: 'DISPATCH', reason: 'unknown-interaction' };
    },

    tick(dt) {
      for (const m of modules) for (const law of m.laws) law(state, dt);
    },

    projectPlayerView() {
      const snapshot: GameViewSnapshot = {
        specId: '',
        scene: '',
        entities: [],
        interactions: [],
        hud: [],
      };
      for (const m of modules) m.project(state, snapshot);
      return snapshot;
    },
  };
}
