// World Semantic — Actor (C001 ADDED / C002 CHANGED / C006 CHANGED)
//
// C002 변경: World 는 Actor 하나가 아니라 여럿을 가진다.
//   ADDED   Id · CharacterKind · Control · AttackRange · PerceptionRange ·
//           WanderPath · WanderIndex · CurrentAction
//   CHANGED MoveTarget 은 독립 State 가 아니라 CurrentAction(move).TargetPosition 으로 흡수됐다.
// C006 변경: 모든 Actor 는 공간을 차지하는 몸이다 (INTENT-BODY-OCCUPY-001).
//   ADDED   Body.Radius · Body.Mass · Velocity
//   Velocity 는 의도한 이동(move)과 별개로, 힘(밀어냄·충격량)만이 바꾸는 물리 속도다.

import type { CurrentAction } from './action';
import type { Inventory } from './inventory';
import type { WorldPosition } from './position';

// Actor.Control — 이 Actor 의 행동을 누가 결정하는가
export type ActorControl = 'player' | 'autonomous';

// Actor.CharacterKind — 어떤 종류의 존재인가 (모션 집합 선택 기준, View 는 이 값만 본다)
export type CharacterKind = string;

export interface ActorState {
  id: string;
  characterKind: CharacterKind;
  control: ActorControl;
  position: WorldPosition;
  bodyRadius: number; // Body.Radius — 고정 상수 (C006)
  bodyMass: number; // Body.Mass — 고정 상수 (C006)
  velocity: WorldPosition; // 힘이 만든 물리 속도 — RULE-BODY-PUSH/SWING-STRIKE 만이 더한다 (C006)
  moveSpeed: number; // 고정 상수 — 결정론 시뮬레이션 값
  attackRange: number; // 고정 상수
  perceptionRange: number; // 고정 상수 — control = autonomous 일 때만 의미가 있다
  wanderPath: WorldPosition[]; // 고정 — control = autonomous 일 때만 의미가 있다
  wanderIndex: number;
  inventory: Inventory;
  currentAction: CurrentAction;
}
