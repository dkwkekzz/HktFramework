// RULE-BODY-MOMENTUM-001 — Implements INTENT-BODY-MOMENTUM-001
// Input          모든 Actor, dt
// Preconditions  없음 — 몸은 언제나 물리 아래 있다
// Transition     Position += Velocity × dt (관성). Velocity 는 FRICTION 으로 감쇠하고,
//                REST_SPEED 아래로 잦아들면 0 이 된다. World.Bounds 를 벗어나면 경계에
//                고정하고 그 축의 Velocity 를 0 으로 한다 (경계 너머로는 밀리지 않는다).
// Result         Moved | Rested
//
// P6 CHANGED — 관성 적분은 엔진 솔버(physics/momentum)가 한다.
// 이 Rule 이 소유하는 것은 마찰·정지 속도 상수와 이 세계의 경계다.

import { integrateMomentum } from '../../../engine/physics/momentum';
import { FRICTION, REST_SPEED } from '../semantic/collision';
import type { WorldState } from '../semantic/world-state';

export function ruleBodyMomentum(state: WorldState, dt: number): void {
  integrateMomentum(state.actors, FRICTION, REST_SPEED, dt, state.bounds);
}
