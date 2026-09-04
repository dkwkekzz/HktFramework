// World Semantic — Actor
//
// 변경: 모든 Actor 는 전투 자원과 템포 능력치를 지닌다.
//   ADDED   Name · Hp/HpMax · Cp/CpMax · MoveMode · RunSpeedMultiplier · ActionSpeed
//   CHANGED MoveSpeed 는 고정 상수가 아니라 배율이 걸리는 능력치다 (TempoStats).
//   Downed 와 Modifiers 는 저장하지 않는다 — semantic/combat.ts 가 유도한다.
//
// 변경: World 는 Actor 하나가 아니라 여럿을 가진다.
//   ADDED   Id · CharacterKind · Control · AttackRange · PerceptionRange ·
//           WanderPath · WanderIndex · CurrentAction
//   CHANGED MoveTarget 은 독립 State 가 아니라 CurrentAction(move).TargetPosition 으로 흡수됐다.
// 변경: 모든 Actor 는 공간을 차지하는 몸이다 (INTENT-BODY-OCCUPY-001).
//   ADDED   Body.Radius · Body.Height · Body.Mass · Velocity · Facing
//   Velocity 는 의도한 이동(move)과 별개로, 힘(밀어냄·충격량)만이 바꾸는 물리 속도다.
//   Facing 은 몸이 향한 방향 (R1) — 이동이 갱신하고, 휘두름 충돌체가 나가는 쪽이다.
// C001 변경: WorldPosition 은 regionId + (x, z) 다 — 몸은 어느 방에 서 있는지를 가진다.
//   ADDED   RegionId — RULE-REGION-TRANSIT-001 만이 바꾼다. 좌표는 그 Region 의 Local Space 다.

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
  /** Actor.Name — 세계가 순번으로 정하는 부를 이름. 세계 밖 문자열을 섞지 않는다 */
  name: string;
  characterKind: CharacterKind;
  control: ActorControl;
  /** 몸이 선 Region — position 은 이 Region 의 Local Space 좌표다 (C001) */
  regionId: string;
  position: WorldPosition;
  bodyRadius: number; // Body.Radius — 고정 상수
  bodyHeight: number; // Body.Height — 고정 상수 — 캡슐 부피 관찰용
  bodyMass: number; // Body.Mass — 고정 상수
  facing: WorldPosition; // 몸이 향한 방향 (단위 벡터) — RULE-BODY-FACING-001 만이 바꾼다
  velocity: WorldPosition; // 힘이 만든 물리 속도 — RULE-BODY-PUSH/SWING-STRIKE 만이 더한다
  // 전투 자원 — 생명은 타격만이, 기력은 스킬 수지와 달리기만이 바꾼다
  hp: number;
  hpMax: number;
  cp: number;
  cpMax: number;
  // 템포 능력치 — 존재 종류가 정하는 고정값. 세계의 속도를 정한다
  moveMode: MoveMode; // walk | run — RULE-MOVE-MODE-001 만이 바꾼다
  moveSpeed: number; // TempoStats.MoveSpeed — 고정 상수가 아니라 배율이 걸리는 능력치다
  runSpeedMultiplier: number; // 달릴 때 이동 속도에 곱해지는 값
  actionSpeed: number; // 스킬 행동 길이에 걸리는 배율 (클수록 빠르다)
  attackRange: number; // 고정 상수
  perceptionRange: number; // 고정 상수 — control = autonomous 일 때만 의미가 있다
  wanderPath: WorldPosition[]; // 고정 — control = autonomous 일 때만 의미가 있다
  wanderIndex: number;
  /**
   * 이번 tick 에 이 몸이 실제로 움직인 거리 (C008 ADDED — 움직이지 않았으면 0).
   *
   * RULE-MOVE-PROGRESS-001 이 매 tick 기록한다. 게임 명사가 없는 사실이므로 전역이어도
   * 되고(어느 규칙이든 "이 몸이 얼마나 움직였는가" 를 물을 수 있다), 지금 이것을 읽는 것은
   * RULE-MAZE-CONNECTION-001 하나뿐이다 — 통로 규칙을 아는 것은 그 규칙뿐이다.
   */
  movedThisTick: number;
  inventory: Inventory;
  currentAction: CurrentAction;
}
