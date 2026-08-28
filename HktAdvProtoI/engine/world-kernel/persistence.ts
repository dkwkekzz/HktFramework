// World Kernel — 영속 (design/Design-World-Persistence.md)
//
// 사실은 영속되고 과정은 영속되지 않는다. 스냅샷은 Tick 사이의 State 전체를
// **데이터 그대로** 담는다 — Engine 은 팩 State 를 해석하지 않으므로(분리 설계 반전 ③)
// 팩에 필드가 늘어도 이 파일은 열리지 않는다.
//
// 복구 시 Engine 이 손대는 유일한 지점은 CoreWorldState 안이다:
// 모든 관찰자의 present=false — 기동 직후 아무도 세계를 보고 있지 않다.
// 이어짐은 과정이지 사실이 아니다.

import type { CoreWorldState } from './state';

export interface WorldSnapshot {
  /**
   * 팩 id + State 형태 버전 (WorldContent.stateVersion). 형태를 바꾼 Cycle 이
   * 버전을 올릴 책임을 진다 — 불일치 스냅샷은 복구하지 않는다 (마이그레이션 없음).
   */
  version: string;
  /** 팩 State 전체 — plain JSON 데이터 (함수·클래스·Map 금지가 팩 State 의 계약이다) */
  state: unknown;
}

/** Tick 사이의 State 를 스냅샷으로 뜬다 — 이후의 세계 진행이 스냅샷을 건드리지 못하게 복제한다 */
export function takeSnapshot<S extends CoreWorldState>(version: string, state: S): WorldSnapshot {
  return { version, state: structuredClone(state) };
}

/**
 * 스냅샷에서 State 를 되살린다. 버전이 다르면 null — 복구를 포기하고 새 세계로
 * 시작하는 것은 부르는 쪽(세계를 띄우는 쪽)의 일이며, 버렸다는 사실을 숨기지 않는다.
 */
export function restoreState<S extends CoreWorldState>(
  snapshot: WorldSnapshot,
  version: string,
): S | null {
  if (snapshot.version !== version) return null;
  const state = structuredClone(snapshot.state) as S;
  for (const observer of state.observers) observer.present = false;
  return state;
}
