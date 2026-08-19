// World Kernel — 컨텐츠 팩이 자신을 등록하는 계약 (P1 ADDED)
//
// Engine 은 컨텐츠를 부르지 않는다 — 컨텐츠가 이 계약으로 자신을 등록한다 (설계 반전 ①②).
// 팩 하나가 이 계약 하나를 구현하면 세계가 된다. Engine 이 소유하는 것은
// 인과의 순서(참여 → 요청 → 진행 → 시간 → 투영)뿐이고, 각 자리에서 무슨 일이
// 일어나는지는 전부 여기 등록된 것이 정한다.

import type { ActionRequest, ActionResult } from '../protocol-core/actions';
import type { GameViewSnapshot } from '../protocol-core/gameview';
import type { CoreWorldState } from './state';

/**
 * Interaction 하나 — 몸이 세계 안에서 하는 일의 수용 경로.
 * 파라미터 검증도 핸들러의 것이다 (무엇이 필요한지는 그 interaction 만 안다).
 */
export interface InteractionHandler<S extends CoreWorldState> {
  /** ActionRequest.interactionId 로 회신되는 그 id */
  id: string;
  handle(state: S, observerId: string, action: ActionRequest): ActionResult;
}

/**
 * Tick 마다 세계를 진행시키는 시스템 하나.
 * 순서는 팩이 **하나의 배열**로 선언한다 — 우선순위 숫자를 흩어 두지 않는다.
 * 결정론은 한 곳에 적힌 순서가 지킨다 (설계 반전 ②).
 */
export type WorldSystem<S extends CoreWorldState> = (state: S, dt: number) => void;

export interface WorldContent<S extends CoreWorldState> {
  /** World.TickInterval — 세계의 시계가 도는 주기 (초). 결정론 시뮬레이션 값이다 */
  tickInterval: number;
  /**
   * 처음 보는 관찰자의 몸을 만들고 Actor.Id 를 돌려준다 (RULE-OBSERVER-JOIN-001 의 몸 부분).
   * 어떤 몸인지(종류·자리·소지품)는 컨텐츠가 정하고, 언제 만들어지는지는 Engine 이 정한다.
   */
  spawnObserverBody(state: S, ordinal: number): string;
  interactions: readonly InteractionHandler<S>[];
  /** time += dt **이전**, 선언된 순서대로 실행된다 */
  systems: readonly WorldSystem<S>[];
  /** time += dt **이후**, 선언된 순서대로 실행된다 */
  postTimeSystems: readonly WorldSystem<S>[];
  /**
   * 관찰자 한 사람의 Semantic Snapshot 투영.
   * 세계가 모르는 관찰자면 null — 세계는 모르는 이에게 자신을 보여주지 않는다.
   */
  projectObserver(state: S, observerId: string): GameViewSnapshot | null;
}
