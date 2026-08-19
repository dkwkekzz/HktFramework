// Sim Lib — 솔버가 읽는 몸의 형태 (P6 ADDED).
//
// 구조적 타입이다 — 팩의 Actor 가 이 필드들을 지니면 그대로 솔버에 넣을 수 있다.
// 몸이 무엇인지(종류·능력치·이름)는 솔버가 모른다 — 위치·속도·반경·질량뿐이다.

import type { Vec2 } from './vec';

/** 자리만 차지하는 것 — 이동 적분(seek)의 대상 */
export interface PointBody {
  position: Vec2;
}

/** 부피·질량·속도를 가진 몸 — 밀어내기·관성·충격의 대상 */
export interface KineticBody extends PointBody {
  velocity: Vec2;
  bodyRadius: number;
  bodyMass: number;
}
