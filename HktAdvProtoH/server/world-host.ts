// World Host — 세계 하나를 붙들고 있는 것 (C003 · C004).
//
// 세계는 여기서 자기 시계로 돈다. 관찰자는 붙었다 떨어질 뿐이고,
// 관찰자가 하나도 없어도 세계는 계속 진행한다 (INTENT-WORLD-CLOCK-001).
//
// C004 — 관찰자는 익명이 아니다. 붙을 때 자신이 누구인지 밝히고,
// 그 이어짐으로 오는 요청은 그 관찰자의 것으로 세계에 도착한다
// (INTENT-REQUEST-ATTRIBUTION-001). 같은 관찰자로 두 곳에서 붙으면
// 나중에 온 이어짐이 몸을 갖고 먼저 있던 이어짐은 떨어진다 (INTENT-OBSERVER-REJOIN-001).
//
// 이 파일은 전송 수단(WebSocket)을 모른다 — 관찰자를 "관찰 결과를 받는 함수"로만 본다.
// 덕분에 소켓 없이 테스트할 수 있다.

import type { ActionRequest } from '../engine/protocol-core/actions';
import type { GameViewSnapshot, RequestOutcomeView } from '../engine/protocol-core/gameview';
import { startWorldClock, type WorldClock } from '../engine/world-kernel/clock';
import {
  createWorld,
  TICK_INTERVAL,
  type World,
  type WorldSetup,
  type WorldState,
} from '../content/active';

export type Observer = (snapshot: GameViewSnapshot) => void;

/** 세계가 이 관찰자의 요청들에 내놓은 대답 (C009) — 관찰 결과와 다른 것이다 */
export type OutcomeSink = (outcomes: RequestOutcomeView[]) => void;

/** 같은 관찰자로 다른 곳에서 들어와 이 이어짐이 밀려났을 때 불린다 */
export type Evicted = () => void;

interface Link {
  send: Observer;
  onEvicted?: Evicted;
  onOutcomes?: OutcomeSink;
}

export interface WorldHost {
  /**
   * 관찰자가 자신을 밝히고 붙는다. 첫 관찰 결과는 세계가 참여를 판정한 다음 Tick 에 온다 —
   * 세계는 모르는 이에게 자신을 보여주지 않는다.
   */
  attach(
    observerId: string,
    observer: Observer,
    onEvicted?: Evicted,
    onOutcomes?: OutcomeSink,
  ): () => void;
  /** 관찰자가 보낸 요청이 세계에 도착한다 */
  receive(observerId: string, action: ActionRequest): void;
  /** 관찰자가 보낸 표식이 세계에 도착한다 (C005) — 게임을 바꾸지 않는다 */
  receiveMark(observerId: string, mark: number): void;
  /** 시계를 직접 돌린다 — 검증용. 실행 중에는 startClock 이 맡는다 */
  advance(dt: number): Map<string, GameViewSnapshot>;
  startClock(now?: () => number): void;
  stop(): void;
  observerCount(): number;
  world: World;
}

// restored — 스냅샷에서 되살린 State (restoreWorld). 있으면 세계는 그 순간부터 이어진다.
export function createWorldHost(setup: WorldSetup = {}, restored?: WorldState): WorldHost {
  const world = createWorld(setup, restored);
  const links = new Map<string, Link>();
  let clock: WorldClock | null = null;

  function emit(
    observations: Map<string, GameViewSnapshot>,
    outcomes?: Map<string, RequestOutcomeView[]>,
  ): void {
    // C009 — 대답이 관찰 결과보다 먼저 나간다. 대답은 "그 요청이 어떻게 되었는가" 이고
    // 뒤이어 오는 관찰 결과가 "그래서 세계가 어떠한가" 다. 이 순서로 읽혀야 인과가 맞다.
    // 떠난 관찰자에게는 관찰 결과가 만들어지지 않지만 대답은 나갈 수 있다 —
    // 그가 건 요청은 이 Tick 에 판정되었기 때문이다.
    if (outcomes) {
      for (const [observerId, list] of outcomes) {
        if (list.length > 0) links.get(observerId)?.onOutcomes?.(list);
      }
    }
    for (const [observerId, snapshot] of observations) {
      links.get(observerId)?.send(snapshot);
    }
  }

  return {
    attach(observerId, observer, onEvicted, onOutcomes) {
      // 몸 하나에 조종하는 이는 하나다 — 먼저 있던 이어짐을 떼어낸다.
      const previous = links.get(observerId);
      if (previous) previous.onEvicted?.();

      const link: Link = { send: observer, onEvicted, onOutcomes };
      links.set(observerId, link);
      world.join(observerId);

      return () => {
        // 이미 다른 이어짐으로 교체되었다면 그 이어짐을 끊지 않는다.
        if (links.get(observerId) !== link) return;
        links.delete(observerId);
        world.leave(observerId);
      };
    },
    receive(observerId, action) {
      world.request(observerId, action);
    },
    receiveMark(observerId, mark) {
      world.mark(observerId, mark);
    },
    advance(dt) {
      const result = world.tick(dt);
      emit(result.observations, result.outcomes);
      return result.observations;
    },
    startClock(now) {
      if (clock) return;
      clock = startWorldClock(world, emit, TICK_INTERVAL, now);
    },
    stop() {
      clock?.stop();
      clock = null;
      links.clear();
    },
    observerCount: () => links.size,
    world,
  };
}
