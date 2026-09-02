// World Semantic — Collision (ADDED / R1 CHANGED)
//
// 모든 Actor 는 반경·높이·질량을 가진 캡슐 부피의 몸으로 공간을 차지한다
// (INTENT-BODY-OCCUPY-001). 서로 밀어내는 판정은 지면 평면에 투영된 원으로 한다.
// 행동은 자신의 종류에 따라 충돌체를 만들 수 있다 (INTENT-ACTION-COLLIDER-001) —
// 기술의 휘두름은 몸이 향한 방향(Facing)의 칼끝 자리에 충돌 구를 만들고,
// 휘두름 구간 동안 호를 그리며 쓸고 지나간다 (R1 — Human Play 반환 반영).
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import { arcSweepCollider } from '../../../engine/physics/sweep';
import { normalized } from '../../../engine/physics/vec';
import { actionProgress } from './action';
import type { ActorState } from './actor';
import { isSkillKind } from './combat';
import type { WorldPosition } from './position';

// 0 나눗셈 방지 한계는 엔진 물리의 것이다 — 같은 이름으로 그대로 쓴다 (P6).
export { CENTER_EPSILON } from '../../../engine/physics/vec';

// Actor.Body 의 종류별 반경·높이·질량과 스폰 시 기본 방향은
// character-catalog.ts 로 옮겨졌다 — 종류가 정하는 값의 단일 출처는 그쪽이다.
// 이 파일에는 종류와 무관한 물리 법칙 상수만 남는다.

// RULE-BODY-PUSH-001 — 겹침 깊이(unit) → 밀어내는 가속(unit/s²) 비례 계수
export const PUSH_STIFFNESS = 60.0;

// RULE-BODY-MOMENTUM-001 — 초당 속도 감쇠 계수와 정지 판정 속도
export const FRICTION = 6.0;
export const REST_SPEED = 0.02;

// RULE-SWING-STRIKE-001 — 휘두름 구간 (ActionProgress 비율)과 전달 충격량
export const SWING_BEGIN = 0.25;
export const SWING_END = 0.75;
export const SWING_IMPULSE = 8.0;

// R1 — 휘두름이 쓸고 지나가는 호의 각과 칼끝 충돌 구의 반경.
// 칼끝 도달(SwingReach + BladeRadius)이 AttackRange 가 되도록 Reach 를 뺀 값으로 정의한다.
export const SWING_ARC = (150 * Math.PI) / 180;
export const SWING_BLADE_RADIUS = 0.7;
export function swingReach(attackRange: number): number {
  return attackRange - SWING_BLADE_RADIUS;
}

// ActionCollider (파생 상태) — 행동이 만든 충돌체.
// 저장하지 않고 CurrentAction 에서 유도되므로 행동이 끝나면 함께 사라진다.
export interface ActionCollider {
  ownerId: string;
  center: WorldPosition; // 칼끝 자리 (R1) — 휘두름 진행에 따라 호를 그리며 이동
  radius: number; // 칼끝 충돌 구의 반경
  active: boolean;
}

// 기술 진행 중인 Actor 마다 하나. 칼끝은 Facing 기준 +SWING_ARC/2 에서
// -SWING_ARC/2 로 쓸고 지나간다 (구간 밖에서는 경계 각에 고정 = 예비/여운 자세).
// P6 CHANGED — 호 스윕 기하는 엔진 솔버(physics/sweep)가 한다. 이 세계가 정하는 것은
// 각·반경·구간 상수와 "어느 행동이 칼끝을 만드는가"(스킬) 다.
export function actionCollider(actor: ActorState): ActionCollider | null {
  // 스킬이 둘로 늘었다. 충돌체 구조는 그대로이며 어느 스킬이든 같은 칼끝을 만든다.
  if (!isSkillKind(actor.currentAction.kind)) return null;
  const progress = actionProgress(actor.currentAction);
  if (progress === null) return null;

  const sweep = arcSweepCollider(actor.position, actor.facing, progress, {
    arc: SWING_ARC,
    tipRadius: SWING_BLADE_RADIUS,
    reach: swingReach(actor.attackRange),
    begin: SWING_BEGIN,
    end: SWING_END,
  });

  return { ownerId: actor.id, center: sweep.center, radius: sweep.radius, active: sweep.active };
}

// RULE-BODY-FACING-001 (R1) — 몸을 그 방향으로 돌린다. 영벡터는 무시한다 (방향이 없다).
export function faceToward(actor: ActorState, dx: number, dz: number): void {
  const direction = normalized(dx, dz);
  if (direction) actor.facing = direction;
}
