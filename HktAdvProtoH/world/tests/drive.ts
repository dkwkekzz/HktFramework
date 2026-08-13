// 검증용 시계 — 테스트가 세계의 시계 역할을 대신한다 (C003).
//
// 실행 중에는 world/clock.ts 가 이 자리를 맡는다. 테스트는 결정론적으로
// 시간을 주기 위해 직접 Tick 을 부른다. 세계를 들여다보는 새 경로가 아니라,
// 세계가 이미 내보낸 마지막 관찰 결과를 읽을 뿐이다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { createWorld, type World, type WorldSetup } from '../index';

export interface WorldDriver {
  /** 요청을 보내고 그 Tick 의 판정을 돌려준다 (시간은 흐르지 않는다) */
  dispatch(action: ActionRequest): ActionResult;
  /** dt 만큼 세계를 진행시킨다 */
  tick(dt: number): void;
  /** 마지막 Tick 이 내보낸 관찰 결과 */
  observe(): GameViewSnapshot;
  world: World;
}

export function driveWorld(setup: WorldSetup = {}): WorldDriver {
  const world = createWorld(setup);
  return {
    dispatch(action) {
      world.request(action);
      const result = world.tick(0).results[0];
      if (!result) throw new Error('요청이 처리되지 않았다');
      return result;
    },
    tick(dt) {
      world.tick(dt);
    },
    observe: () => world.latestObservation(),
    world,
  };
}
