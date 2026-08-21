// World Semantic — Collision (C006 ADDED / R1 CHANGED)
//
// 모든 Actor 는 반경·높이·질량을 가진 캡슐 부피의 몸으로 공간을 차지한다
// (INTENT-BODY-OCCUPY-001). 서로 밀어내는 판정은 지면 평면에 투영된 원으로 한다.
// 행동은 자신의 종류에 따라 충돌체를 만들 수 있다 (INTENT-ACTION-COLLIDER-001) —
// 기술의 휘두름은 몸이 향한 방향(Facing)의 칼끝 자리에 충돌 구를 만들고,
// 휘두름 구간 동안 호를 그리며 쓸고 지나간다 (R1 — Human Play 반환 반영).
// C023 CHANGED — 그 호의 각·반경·길이는 **그 기술의 값**이다. 전역 상수가 아니다.
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import { arcSweepCollider } from '../../../../engine/physics/sweep';
import { CENTER_EPSILON, normalized } from '../../../../engine/physics/vec';
import { actionProgress } from './action';
import type { ActorState } from './actor';
import { isSkillKind, skillDefinition, skillShape } from './combat';
import type { WorldPosition } from './position';

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

// RULE-SWING-STRIKE-001 — 전달 충격량
//
// C019 CHANGED — 휘두름 구간(SWING_BEGIN · SWING_END)은 더 이상 여기 있는 전역 상수가
// 아니다. 기술마다 다른 값이므로 SkillDefinition 이 지닌다 (semantic/combat.ts).
// 기본값은 그 파일의 DEFAULT_SWING_BEGIN · DEFAULT_SWING_END 이며 값 자체는 그대로다.
export const SWING_IMPULSE = 8.0;

// C023 CHANGED — 휘두름의 각·칼끝 반경·닿는 길이는 더 이상 여기 있는 전역 상수가 아니다.
// 기술마다 다른 값이므로 SkillDefinition 이 지닌다 (semantic/combat.ts 의 SwingArc ·
// SwingTipRadius · SwingReach). 폐지된 것은 셋이다 — SWING_ARC · SWING_BLADE_RADIUS 와
// 파생 함수 swingReach(attackRange). 마지막 것은 닿는 길이를 **몸**에서 끌어왔다:
// 그래서 어떤 기술도 다른 기술보다 멀리 닿지 못했다 (INTENT-REACH-BELONGS-TO-THE-SKILL-001).
// 기본값은 combat.ts 의 DEFAULT_SWING_ARC · DEFAULT_SWING_REACH · DEFAULT_SWING_TIP_RADIUS
// 이며 기본 기술과 오라 기술의 값 자체는 그대로다.

// ActionCollider (파생 상태) — 행동이 만든 충돌체.
// 저장하지 않고 CurrentAction 에서 유도되므로 행동이 끝나면 함께 사라진다.
export interface ActionCollider {
  ownerId: string;
  center: WorldPosition; // 칼끝 자리 (R1) — 휘두름 진행에 따라 호를 그리며 이동
  radius: number; // 칼끝 충돌 구의 반경
  active: boolean;
}

// 기술 진행 중인 Actor 마다 하나. 칼끝은 Facing 기준 +Arc/2 에서 −Arc/2 로 쓸고
// 지나간다 (구간 밖에서는 경계 각에 고정 = 예비/여운 자세).
// P6 CHANGED — 호 스윕 기하는 엔진 솔버(physics/sweep)가 한다. 이 세계가 정하는 것은
// 각·반경·구간 상수와 "어느 행동이 칼끝을 만드는가"(스킬) 다.
export function actionCollider(actor: ActorState): ActionCollider | null {
  // C007 — 스킬이 둘로 늘었다. 충돌체 구조는 그대로이며 어느 스킬이든 같은 칼끝을 만든다.
  if (!isSkillKind(actor.currentAction.kind)) return null;
  const progress = actionProgress(actor.currentAction);
  if (progress === null) return null;

  // C019 CHANGED — 구간 경계를 그 기술에서 읽는다. RULE-SKILL-PHASE-001 과 같은 값을
  // 쓰므로 "칼끝이 활성인 구간" 과 "phase 가 active" 는 언제나 일치한다.
  // C023 CHANGED — 모양도 그 기술에서 읽는다 (RULE-SKILL-SHAPE-001).
  // 이 함수에 기술 이름을 묻는 분기가 없다 — 정의가 답한 값만 기반 솔버로 넘긴다.
  const skill = skillDefinition(actor.currentAction.kind);
  const shape = skillShape(actor.currentAction.kind);
  const sweep = arcSweepCollider(actor.position, actor.facing, progress, {
    arc: shape.arc,
    tipRadius: shape.tipRadius,
    reach: shape.reach,
    begin: skill.swingBegin,
    end: skill.swingEnd,
  });

  return { ownerId: actor.id, center: sweep.center, radius: sweep.radius, active: sweep.active };
}

// RULE-BODY-FACING-001 (R1) — 몸을 그 방향으로 돌린다. 영벡터는 무시한다 (방향이 없다).
export function faceToward(actor: ActorState, dx: number, dz: number): void {
  const direction = normalized(dx, dz);
  if (direction) actor.facing = direction;
}
