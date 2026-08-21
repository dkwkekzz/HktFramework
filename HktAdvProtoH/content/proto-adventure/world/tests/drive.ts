// 검증용 시계 — 테스트가 세계의 시계 역할을 대신한다 (C003 · C004).
//
// 실행 중에는 world/clock.ts 가 이 자리를 맡는다. 테스트는 결정론적으로
// 시간을 주기 위해 직접 Tick 을 부른다. 세계를 들여다보는 새 경로가 아니라,
// 세계가 이미 내보낸 마지막 관찰 결과를 읽을 뿐이다.
//
// C004 — 조종되는 몸은 관찰자가 들어와야 생긴다. 그래서 이 Driver 는
// 관찰자 하나를 들여보낸 뒤 시작한다. 그 관찰자의 몸이 PLAYER 다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot, RequestOutcomeView } from '../../protocol/gameview';
import { createWorld, type World, type WorldSetup } from '../index';
import { ACTION_DEFINITIONS } from '../semantic/action';
import { TICK_INTERVAL } from '../semantic/world-state';

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
  /**
   * 요청을 보내고 세계가 그 관찰자에게 되돌린 대답을 읽는다 (C009).
   * dispatch 와 달리 "세계 안의 판정" 이 아니라 "요청한 이에게 실제로 간 것" 을 본다.
   */
  dispatchForOutcome(action: ActionRequest, observerId?: string): RequestOutcomeView[];
  /** dt 만큼 세계를 진행시킨다 */
  tick(dt: number): void;
  /** 관찰자가 들어온다 (다음 Tick 에 판정된다) */
  join(observerId: string): void;
  /** 관찰자가 이어짐을 잃는다 (다음 Tick 에 판정된다) */
  leave(observerId: string): void;
  /** 관찰자가 표식을 보낸다 (다음 Tick 에 받아들여진다) — C005 */
  mark(mark: number, observerId?: string): void;
  /** 그 관찰자에게 마지막으로 나간 관찰 결과 */
  observe(observerId?: string): GameViewSnapshot;
  world: World;
}

/**
 * 대상을 고른다 (C017). 살펴봄·채집은 이제 요청이 아니라 **고른 것**을 대상으로 삼으므로
 * (INTENT-TARGET-DIRECTS-THE-ACT-001), 그 둘을 쓰는 검증은 이 헬퍼를 앞에 둔다.
 * 세계를 약하게 만드는 것이 아니다 — 지목이 플레이의 한 걸음으로 들어온 것이다.
 */
export function selectTarget(
  world: WorldDriver,
  targetEntityId: string,
  observerId: string = OBSERVER,
): ActionResult {
  return world.dispatch({ interactionId: 'select-target', targetEntityId }, observerId);
}

/**
 * 살펴봄을 끝까지 마친다 (C014). 남의 겨루는 힘은 살펴본 뒤에만 관찰에 실리므로
 * 그 값을 읽는 기존 검증들이 이 헬퍼를 앞에 둔다 — 세계를 약하게 만드는 것이 아니라
 * **관찰한 뒤 같은 값이 나오는지**가 이 Cycle 이후의 Regression 기준이다
 * (cycles/C014-.../03-world-semantic.md BALANCE).
 */
export function observeFully(
  world: WorldDriver,
  targetEntityId: string,
  observerId: string = OBSERVER,
): void {
  // C017 — 고르고 나서 살펴본다. 대상은 요청이 아니라 고른 것에서 온다.
  selectTarget(world, targetEntityId, observerId);
  world.dispatch({ interactionId: 'observe' }, observerId);
  const duration = ACTION_DEFINITIONS.observe.duration ?? 1;
  const steps = Math.ceil(duration / TICK_INTERVAL) + 1;
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
}

/**
 * 곡괭이를 건다 (C023). 채집은 이제 **지님이 아니라 적용**에서 온다
 * (INTENT-CAPABILITY-FROM-DECLARED-USE-001 CHANGED), 그래서 캘 수 있는 몸을 만들려면
 * 이 헬퍼가 앞에 와야 한다.
 *
 * **세계를 약하게 만드는 것이 아니다** — 걸기가 플레이의 한 걸음으로 들어온 것이다.
 * 걸지 않은 채로 캐려 하면 `no-mining-tool` 이 오며, 그것을 확인하는 검증은
 * 이 헬퍼를 부르지 않는다 (world/tests/equip.spec.ts).
 * C014 의 observeFully · C017 의 selectTarget 이 같은 자리에 선 것과 같은 성격이다.
 */
export function equipPickaxe(world: WorldDriver, observerId: string = OBSERVER): ActionResult {
  return world.dispatch({ interactionId: 'equip-item', itemKind: 'pickaxe' }, observerId);
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
    dispatchForOutcome(action, observerId = OBSERVER) {
      world.request(observerId, action);
      return world.tick(0).outcomes.get(observerId) ?? [];
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
    mark(value, observerId = OBSERVER) {
      world.mark(observerId, value);
    },
    observe(observerId = OBSERVER) {
      const snapshot = world.latestObservation(observerId);
      if (!snapshot) throw new Error(`관찰 결과가 없다 — ${observerId}`);
      // 이 세계의 투영은 팩 계약(04 spec)의 형태다 — 봉투 형에서 팩 형으로 좁힌다 (P2)
      return snapshot as GameViewSnapshot;
    },
    world,
  };
}
