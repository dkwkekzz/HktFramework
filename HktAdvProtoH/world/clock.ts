// World Clock — 세계 자신의 시계 (C003 ADDED).
//
// INTENT-WORLD-CLOCK-001: 관찰자가 있든 없든, 보고 있든 아니든 세계는 진행한다.
// 그래서 시계는 관찰자(렌더 루프)가 아니라 세계 쪽에 있다.
// 관찰자는 이 시계를 멈추거나 앞당길 수 없다.

import { TICK_INTERVAL, type WorldState } from './semantic/world-state';
import type { World } from './index';
import type { GameViewSnapshot } from '../protocol/gameview';

// C004 CHANGED — 한 Tick 이 내보내는 것은 관찰 결과 하나가 아니라
// 보고 있는 관찰자마다의 관찰 결과다 (INTENT-PER-OBSERVER-PROJECTION-001).
export type ObservationSink = (observations: Map<string, GameViewSnapshot>) => void;

export interface WorldClock {
  stop(): void;
}

// 한 Tick 이 감당할 최대 dt — 프로세스가 잠시 멈췄다 돌아와도
// 세계가 한 번에 건너뛰지 않게 막는다 (결정론 보호).
const MAX_TICK_DT = 0.25;

export function startWorldClock(
  world: World,
  onObservation: ObservationSink,
  now: () => number = () => Date.now(),
): WorldClock {
  let last = now();

  const timer = setInterval(() => {
    const current = now();
    const dt = Math.min((current - last) / 1000, MAX_TICK_DT);
    last = current;
    onObservation(world.tick(dt).observations);
  }, TICK_INTERVAL * 1000);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

export type { WorldState };
