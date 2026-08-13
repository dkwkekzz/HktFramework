// World Host — 세계 하나를 붙들고 있는 것 (C003).
//
// 세계는 여기서 자기 시계로 돈다. 관찰자는 붙었다 떨어질 뿐이고,
// 관찰자가 하나도 없어도 세계는 계속 진행한다 (INTENT-WORLD-CLOCK-001).
//
// 이 파일은 전송 수단(WebSocket)을 모른다 — 관찰자를 "관찰 결과를 받는 함수"로만 본다.
// 덕분에 소켓 없이 테스트할 수 있다.

import type { ActionRequest } from '../protocol/actions';
import type { GameViewSnapshot } from '../protocol/gameview';
import { startWorldClock, type WorldClock } from '../world/clock';
import { createWorld, type World, type WorldSetup } from '../world/index';

export type Observer = (snapshot: GameViewSnapshot) => void;

export interface WorldHost {
  /** 관찰자가 붙는다. 붙는 즉시 마지막 관찰 결과를 한 번 받는다 */
  attach(observer: Observer): () => void;
  /** 관찰자가 보낸 요청이 세계에 도착한다 */
  receive(action: ActionRequest): void;
  /** 시계를 직접 돌린다 — 검증용. 실행 중에는 startClock 이 맡는다 */
  advance(dt: number): GameViewSnapshot;
  startClock(now?: () => number): void;
  stop(): void;
  observerCount(): number;
  world: World;
}

export function createWorldHost(setup: WorldSetup = {}): WorldHost {
  const world = createWorld(setup);
  const observers = new Set<Observer>();
  let clock: WorldClock | null = null;

  function emit(snapshot: GameViewSnapshot): void {
    for (const observer of observers) observer(snapshot);
  }

  return {
    attach(observer) {
      observers.add(observer);
      observer(world.latestObservation()); // 붙자마자 현재 세계를 한 번 준다
      return () => observers.delete(observer);
    },
    receive(action) {
      world.request(action);
    },
    advance(dt) {
      const snapshot = world.tick(dt).snapshot;
      emit(snapshot);
      return snapshot;
    },
    startClock(now) {
      if (clock) return;
      clock = startWorldClock(world, emit, now);
    },
    stop() {
      clock?.stop();
      clock = null;
      observers.clear();
    },
    observerCount: () => observers.size,
    world,
  };
}
