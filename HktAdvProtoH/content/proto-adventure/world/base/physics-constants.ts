// World Base — 몸의 물리 상수와 방향 (C006 ADDED / R1 CHANGED)
//
// 모든 Actor 는 반경·높이·질량을 가진 캡슐 부피의 몸으로 공간을 차지한다
// (INTENT-BODY-OCCUPY-001). 서로 밀어내는 판정은 지면 평면에 투영된 원으로 한다.
// 여기 남는 것은 **모든 몸의 성질**이다 — 어느 도메인도 없이 성립한다.
// 휘두름(칼끝 충돌체·호·충격량)은 전투 도메인의 것이며 domains/combat/swing.ts 가 소유한다.
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import { normalized } from '../../../../engine/physics/vec';
import type { ActorState } from './actor';

// 0 나눗셈 방지 한계는 엔진 물리의 것이다 — 같은 이름으로 그대로 쓴다 (P6).
export { CENTER_EPSILON } from '../../../../engine/physics/vec';

// Actor.Body 의 종류별 반경·높이·질량과 스폰 시 기본 방향은
// character-catalog.ts 로 옮겨졌다 — 종류가 정하는 값의 단일 출처는 그쪽이다.
// 이 파일에는 종류와 무관한 물리 법칙 상수만 남는다.

// RULE-BODY-PUSH-001 — 겹침 깊이(unit) → 밀어내는 가속(unit/s²) 비례 계수
export const PUSH_STIFFNESS = 60.0;

// RULE-BODY-MOMENTUM-001 — 초당 속도 감쇠 계수와 정지 판정 속도
export const FRICTION = 6.0;
export const REST_SPEED = 0.02;

// RULE-BODY-FACING-001 (R1) — 몸을 그 방향으로 돌린다. 영벡터는 무시한다 (방향이 없다).
export function faceToward(actor: ActorState, dx: number, dz: number): void {
  const direction = normalized(dx, dz);
  if (direction) actor.facing = direction;
}
