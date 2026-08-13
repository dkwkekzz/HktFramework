// 검증용 시계 — 테스트가 세계의 시계 역할을 대신한다 (C003 · C004).
//
// 실행 중에는 world/clock.ts 가 이 자리를 맡는다. 테스트는 결정론적으로
// 시간을 주기 위해 직접 Tick 을 부른다. 세계를 들여다보는 새 경로가 아니라,
// 세계가 이미 내보낸 마지막 관찰 결과를 읽을 뿐이다.
//
// C004 — 조종되는 몸은 관찰자가 들어와야 생긴다. 그래서 이 Driver 는
// 관찰자 하나를 들여보낸 뒤 시작한다. 그 관찰자의 몸이 PLAYER 다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { createWorld, type World, type WorldSetup } from '../index';

/** 검증용 기본 관찰자 */
export const OBSERVER = 'observer-1';
/** 그 관찰자의 몸 — RULE-OBSERVER-JOIN-001 이 순번으로 정한다 */
export const PLAYER = 'player-1';
/** 두 번째 관찰자와 그 몸 */
export const OBSERVER_2 = 'observer-2';
export const PLAYER_2 = 'player-2';

export interface WorldDriver {
  /** 요청을 보내고 그 Tick 의 판정을 돌려준다 (시간은 흐르지 않는다) */
  dispatch(action: ActionRequest, observerId?: string): ActionResult;
  /** dt 만큼 세계를 진행시킨다 */
  tick(dt: number): void;
  /** 관찰자가 들어온다 (다음 Tick 에 판정된다) */
  join(observerId: string): void;
  /** 관찰자가 이어짐을 잃는다 (다음 Tick 에 판정된다) */
  leave(observerId: string): void;
  /** 그 관찰자에게 마지막으로 나간 관찰 결과 */
  observe(observerId?: string): GameViewSnapshot;
  world: World;
}

export function driveWorld(setup: WorldSetup = {}): WorldDriver {
  const world = createWorld(setup);
  // 관찰자 하나를 들여보내고 그 참여를 판정시킨다 — 여기서부터 몸이 있다.
  world.join(OBSERVER);
  world.tick(0);

  return {
    dispatch(action, observerId = OBSERVER) {
      world.request(observerId, action);
      const result = world.tick(0).results[0];
      if (!result) throw new Error('요청이 처리되지 않았다');
      return result;
    },
    tick(dt) {
      world.tick(dt);
    },
    join(observerId) {
      world.join(observerId);
    },
    leave(observerId) {
      world.leave(observerId);
    },
    observe(observerId = OBSERVER) {
      const snapshot = world.latestObservation(observerId);
      if (!snapshot) throw new Error(`관찰 결과가 없다 — ${observerId}`);
      return snapshot;
    },
    world,
  };
}
