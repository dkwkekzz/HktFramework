// World Semantic — Actor (C001 ADDED / C002 CHANGED)
//
// C002 변경: World 는 Actor 하나가 아니라 여럿을 가진다.
//   ADDED   Id · CharacterKind · Control · AttackRange · PerceptionRange ·
//           WanderPath · WanderIndex · CurrentAction
//   CHANGED MoveTarget 은 독립 State 가 아니라 CurrentAction(move).TargetPosition 으로 흡수됐다.

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
  moveSpeed: number; // 고정 상수 — 결정론 시뮬레이션 값
  attackRange: number; // 고정 상수
  perceptionRange: number; // 고정 상수 — control = autonomous 일 때만 의미가 있다
  wanderPath: WorldPosition[]; // 고정 — control = autonomous 일 때만 의미가 있다
  wanderIndex: number;
  inventory: Inventory;
  currentAction: CurrentAction;
}
