// World Semantic — Actor (C001 ADDED / C002 CHANGED / C006 CHANGED)
//
// C007 변경: 모든 Actor 는 전투 자원과 템포 능력치를 지닌다.
//   ADDED   Name · Hp/HpMax · Cp/CpMax · MoveMode · RunSpeedMultiplier · ActionSpeed
//   CHANGED MoveSpeed 는 고정 상수가 아니라 배율이 걸리는 능력치다 (TempoStats).
//   Downed 와 Modifiers 는 저장하지 않는다 — semantic/combat.ts 가 유도한다.
//
// C002 변경: World 는 Actor 하나가 아니라 여럿을 가진다.
//   ADDED   Id · CharacterKind · Control · AttackRange · PerceptionRange ·
//           WanderPath · WanderIndex · CurrentAction
//   CHANGED MoveTarget 은 독립 State 가 아니라 CurrentAction(move).TargetPosition 으로 흡수됐다.
// C006 변경: 모든 Actor 는 공간을 차지하는 몸이다 (INTENT-BODY-OCCUPY-001).
//   ADDED   Body.Radius · Body.Height · Body.Mass · Velocity · Facing
//   Velocity 는 의도한 이동(move)과 별개로, 힘(밀어냄·충격량)만이 바꾸는 물리 속도다.
//   Facing 은 몸이 향한 방향 (R1) — 이동이 갱신하고, 휘두름 충돌체가 나가는 쪽이다.

import type { CurrentAction } from './action';
import type { MoveMode } from './combat';
import type { Inventory } from './inventory';
import type { WorldPosition } from './position';

// Actor.Control — 이 Actor 의 행동을 누가 결정하는가
export type ActorControl = 'player' | 'autonomous';

// Actor.CharacterKind — 어떤 종류의 존재인가 (모션 집합 선택 기준, View 는 이 값만 본다)
export type CharacterKind = string;

export interface ActorState {
  id: string;
  /** Actor.Name (C007) — 세계가 순번으로 정하는 부를 이름. 세계 밖 문자열을 섞지 않는다 */
  name: string;
  characterKind: CharacterKind;
  control: ActorControl;
  position: WorldPosition;
  bodyRadius: number; // Body.Radius — 고정 상수 (C006)
  bodyHeight: number; // Body.Height — 고정 상수 (C006 R1) — 캡슐 부피 관찰용
  bodyMass: number; // Body.Mass — 고정 상수 (C006)
  facing: WorldPosition; // 몸이 향한 방향 (단위 벡터) — RULE-BODY-FACING-001 만이 바꾼다 (C006 R1)
  velocity: WorldPosition; // 힘이 만든 물리 속도 — RULE-BODY-PUSH/SWING-STRIKE 만이 더한다 (C006)
  // 전투 자원 (C007) — 생명은 타격만이, 기력은 스킬 수지와 달리기만이 바꾼다
  hp: number;
  hpMax: number;
  cp: number;
  cpMax: number;
  // 전투 능력치 (C010) — 종류가 초기값을 정한다. 한 방의 크기를 정하는 두 값이며
  // RULE-DAMAGE-CALCULATE-001 만이 읽는다.
  attack: number; // 공격을 얼마나 강하게 만들어 내는가 (INTENT-ATTACK-POWER-001)
  defense: number; // 들어오는 피해를 얼마나 줄여 받는가 (INTENT-DEFENSE-001)
  // 템포 능력치 (C007) — 존재 종류가 정하는 고정값. 세계의 속도를 정한다
  moveMode: MoveMode; // walk | run — RULE-MOVE-MODE-001 만이 바꾼다
  moveSpeed: number; // TempoStats.MoveSpeed (C001 고정 상수 → C007 능력치로 승격)
  runSpeedMultiplier: number; // 달릴 때 이동 속도에 곱해지는 값
  actionSpeed: number; // 스킬 행동 길이에 걸리는 배율 (클수록 빠르다)
  attackRange: number; // 고정 상수
  perceptionRange: number; // 고정 상수 — control = autonomous 일 때만 의미가 있다
  wanderPath: WorldPosition[]; // 고정 — control = autonomous 일 때만 의미가 있다
  wanderIndex: number;
  inventory: Inventory;
  currentAction: CurrentAction;
}
