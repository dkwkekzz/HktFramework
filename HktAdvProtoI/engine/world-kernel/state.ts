// World Kernel — Core World State (P1 ADDED)
//
// 기반(Engine)이 세계에 대해 아는 전부다: 시간이 흐르고, 관찰자가 있다.
// 그 밖의 모든 것(Actor·물건·능력치)은 컨텐츠 팩의 State 가 이 형태를 확장해 정의한다 —
// Engine 은 팩의 State 를 들여다보지 않고 이 최소 형태만 요구한다 (설계 반전 ③).

import type { ObserverState } from './observer';

export interface CoreWorldState {
  /** World.Time — 세계가 시작된 뒤 흐른 시간 */
  time: number;
  /** World.Observers — 세계가 아는 관찰자들 */
  observers: ObserverState[];
}

export function findObserver(
  state: CoreWorldState,
  observerId: string,
): ObserverState | undefined {
  return state.observers.find((o) => o.id === observerId);
}

// 그 몸을 지금 조종하는 이가 있는가 (Character.Attended).
// 관찰자의 몸이 아닌 것(자율 존재)은 조종 개념이 없으므로 false 가 아니라 판정 대상이 아니다.
export function isAttended(state: CoreWorldState, actorId: string): boolean {
  return state.observers.some((o) => o.actorId === actorId && o.present);
}

export function presentObserverCount(state: CoreWorldState): number {
  return state.observers.filter((o) => o.present).length;
}
