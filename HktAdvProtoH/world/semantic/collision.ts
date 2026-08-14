// World Semantic — Collision (C006 ADDED / R1 CHANGED)
//
// 모든 Actor 는 반경·높이·질량을 가진 캡슐 부피의 몸으로 공간을 차지한다
// (INTENT-BODY-OCCUPY-001). 서로 밀어내는 판정은 지면 평면에 투영된 원으로 한다.
// 행동은 자신의 종류에 따라 충돌체를 만들 수 있다 (INTENT-ACTION-COLLIDER-001) —
// attack 의 휘두름은 몸이 향한 방향(Facing)의 칼끝 자리에 충돌 구를 만들고,
// 휘두름 구간 동안 호를 그리며 쓸고 지나간다 (R1 — Human Play 반환 반영).
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import { actionProgress } from './action';
import type { ActorState } from './actor';
import { isSkillKind } from './combat';
import type { WorldPosition } from './position';

// Actor.Body — 몸 캡슐의 반경·높이·질량.
// R2 — 몸 크기는 CharacterKind 마다 정한다. 그림 크기는 View 가 Body.Height 에서
// 유도하므로(04 spec), 새 종류는 여기 한 줄이면 충돌체와 이미지가 항상 일치한다.
export interface BodySize {
  radius: number;
  height: number;
}

export const BODY_SIZE_BY_KIND: Readonly<Record<string, BodySize>> = {
  'rabbit-swordsman': { radius: 0.85, height: 3.4 },
  wanderer: { radius: 0.7, height: 2.8 },
};

// 등록되지 않은 종류의 기본 몸 — 존재가 크기 없이 서 있지 않게 한다
export const DEFAULT_BODY_SIZE: BodySize = { radius: 0.6, height: 2.4 };

export function bodySize(characterKind: string): BodySize {
  return BODY_SIZE_BY_KIND[characterKind] ?? DEFAULT_BODY_SIZE;
}

export const BODY_MASS = 1.0;

// Actor.Facing — 몸이 처음 만들어질 때 향하는 방향 (단위 벡터)
export const DEFAULT_FACING: Readonly<WorldPosition> = { x: 0, z: 1 };

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

// 중심이 완전히 일치했을 때의 방향 판정 한계 (결정론 — 0 나눗셈 방지)
export const CENTER_EPSILON = 1e-9;

// ActionCollider (파생 상태) — 행동이 만든 충돌체.
// 저장하지 않고 CurrentAction 에서 유도되므로 행동이 끝나면 함께 사라진다.
export interface ActionCollider {
  ownerId: string;
  center: WorldPosition; // 칼끝 자리 (R1) — 휘두름 진행에 따라 호를 그리며 이동
  radius: number; // 칼끝 충돌 구의 반경
  active: boolean;
}

// attack 진행 중인 Actor 마다 하나. 칼끝은 Facing 기준 +SWING_ARC/2 에서
// -SWING_ARC/2 로 쓸고 지나간다 (구간 밖에서는 경계 각에 고정 = 예비/여운 자세).
export function actionCollider(actor: ActorState): ActionCollider | null {
  // C007 — 스킬이 둘로 늘었다. 충돌체 구조는 그대로이며 어느 스킬이든 같은 칼끝을 만든다.
  if (!isSkillKind(actor.currentAction.kind)) return null;
  const progress = actionProgress(actor.currentAction);
  if (progress === null) return null;

  // 구간 안 진행도 0..1 (구간 밖은 경계에 고정)
  const sweep = Math.min(1, Math.max(0, (progress - SWING_BEGIN) / (SWING_END - SWING_BEGIN)));
  const theta = SWING_ARC / 2 - SWING_ARC * sweep;

  const f = actor.facing;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // 지면 평면(x, z)에서 Facing 을 theta 만큼 회전한 방향
  const dx = f.x * cos - f.z * sin;
  const dz = f.x * sin + f.z * cos;
  const reach = swingReach(actor.attackRange);

  return {
    ownerId: actor.id,
    center: { x: actor.position.x + dx * reach, z: actor.position.z + dz * reach },
    radius: SWING_BLADE_RADIUS,
    active: progress >= SWING_BEGIN && progress <= SWING_END,
  };
}

// RULE-BODY-FACING-001 (R1) — 몸을 그 방향으로 돌린다. 영벡터는 무시한다 (방향이 없다).
export function faceToward(actor: ActorState, dx: number, dz: number): void {
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < CENTER_EPSILON) return;
  actor.facing = { x: dx / len, z: dz / len };
}
