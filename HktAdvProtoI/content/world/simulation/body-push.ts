// RULE-BODY-PUSH-001 — Implements INTENT-BODY-OCCUPY-001 · INTENT-BODY-PUSH-001
// Input          모든 Actor 쌍 (Tick 마다), dt
// Preconditions  두 몸의 중심 거리 < Radius 합 (겹침 깊이 > 0)
// Transition     겹침 깊이 × PUSH_STIFFNESS 의 힘을 중심선 방향으로 서로 반대로 가한다.
//                힘의 크기는 양쪽이 같다 (제3법칙). Velocity 변화 = 힘 / Mass × dt (제2법칙).
//                중심이 완전히 일치하면 Actors 순서가 앞선 쪽을 -x 로 미는 고정 방향 (결정론).
// Result         Pushed(쌍 수) — 상태 변화는 Velocity 에만 생긴다. 위치는
//                RULE-BODY-MOMENTUM-001 이 옮긴다.
//
// P6 CHANGED — 밀어내기 해법은 엔진 솔버(physics/push)가 한다.
// 이 Rule 이 소유하는 것은 강성 상수(이 세계의 결정론 값)와 "모든 몸이 대상" 이라는 선택이다.
// C001 AFFECTED — 대상 집합은 같은 Region 의 몸들뿐이다. 다른 방의 몸은 좌표가 겹쳐도 밀지 않는다 (R5).

import { resolveCirclePush } from '../../../engine/physics/push';
import { PUSH_STIFFNESS } from '../semantic/collision';
import type { ActorState } from '../semantic/actor';
import type { WorldState } from '../semantic/world-state';

// Region 마다 몸을 묶는다 — actors 배열 순서를 지킨다 (중심 일치 시 앞선 쪽이 밀리는 결정론 조항 그대로)
export function groupByRegion(actors: readonly ActorState[]): Map<string, ActorState[]> {
  const groups = new Map<string, ActorState[]>();
  for (const actor of actors) {
    const group = groups.get(actor.regionId);
    if (group) group.push(actor);
    else groups.set(actor.regionId, [actor]);
  }
  return groups;
}

export function ruleBodyPush(state: WorldState, dt: number): number {
  let pushedPairs = 0;
  for (const group of groupByRegion(state.actors).values()) {
    pushedPairs += resolveCirclePush(group, PUSH_STIFFNESS, dt);
  }
  return pushedPairs;
}
