// World Semantic — Collision (C006 ADDED)
//
// 모든 Actor 는 지면 평면에서 반경과 질량을 가진 몸으로 공간을 차지한다
// (INTENT-BODY-OCCUPY-001). 행동은 자신의 종류에 따라 충돌 반경을 만들 수 있다
// (INTENT-ACTION-COLLIDER-001) — 이번 Cycle 에서는 attack 의 휘두름 하나다.
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import { actionProgress } from './action';
import type { ActorState } from './actor';
import type { WorldPosition } from './position';

// Actor.Body — 몸이 차지하는 원의 반경과 질량
export const BODY_RADIUS = 0.5;
export const BODY_MASS = 1.0;

// RULE-BODY-PUSH-001 — 겹침 깊이(unit) → 밀어내는 가속(unit/s²) 비례 계수
export const PUSH_STIFFNESS = 60.0;

// RULE-BODY-MOMENTUM-001 — 초당 속도 감쇠 계수와 정지 판정 속도
export const FRICTION = 6.0;
export const REST_SPEED = 0.02;

// RULE-SWING-STRIKE-001 — 휘두름 구간 (ActionProgress 비율)과 전달 충격량
export const SWING_BEGIN = 0.25;
export const SWING_END = 0.75;
export const SWING_IMPULSE = 8.0;

// 중심이 완전히 일치했을 때의 방향 판정 한계 (결정론 — 0 나눗셈 방지)
export const CENTER_EPSILON = 1e-9;

// ActionCollider (파생 상태) — 행동이 만든 충돌 반경.
// 저장하지 않고 CurrentAction 에서 유도되므로 행동이 끝나면 함께 사라진다.
export interface ActionCollider {
  ownerId: string;
  center: WorldPosition;
  radius: number;
  active: boolean;
}

// attack 진행 중인 Actor 마다 하나 — 휘두르는 몸을 따라다닌다.
// Active 는 ActionProgress ∈ [SWING_BEGIN, SWING_END] 인 동안이다.
export function actionCollider(actor: ActorState): ActionCollider | null {
  if (actor.currentAction.kind !== 'attack') return null;
  const progress = actionProgress(actor.currentAction);
  return {
    ownerId: actor.id,
    center: actor.position,
    radius: actor.attackRange,
    active: progress !== null && progress >= SWING_BEGIN && progress <= SWING_END,
  };
}
