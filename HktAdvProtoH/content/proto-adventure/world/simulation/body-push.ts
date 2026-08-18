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

import { resolveCirclePush } from '../../../../engine/physics/push';
import { PUSH_STIFFNESS } from '../semantic/collision';
import type { WorldState } from '../semantic/world-state';

export function ruleBodyPush(state: WorldState, dt: number): number {
  return resolveCirclePush(state.actors, PUSH_STIFFNESS, dt);
}
