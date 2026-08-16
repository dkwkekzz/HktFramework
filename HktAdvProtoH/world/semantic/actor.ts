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

// C010 변경: 몸은 행동에 더해 자세를 지닌다 (INTENT-ACTION-STATE-001 CHANGED).
//   ADDED   Stance · GuardBrokenUntil · Defense
//   자세는 행동 칸을 쓰지 않는다 — 걸으면서도 막을 수 있어야 하기 때문이다.
//   GuardBroken 은 저장하지 않는다 — semantic/combat.ts 가 World.Time 에서 유도한다.
//
// C011 변경: 자세는 "언제 세웠는가" 를 함께 지니고, 몸은 열릴 수 있다.
//   ADDED   GuardStartedAt · ExposedUntil
//   그것만으로 완벽한 막기(시점)와 되받아침(열린 틈)이 성립한다 — 새 자세도 새 행동도 없다.
//   Exposed 와 PerfectWindowOpen 은 저장하지 않는다 — World.Time 에서 유도한다.

import type { CurrentAction } from './action';
import type { MoveMode, Stance } from './combat';
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
  // 방어 (C010) — 맞은 피해를 줄이는 값. 종류가 정하는 고정값이며 막든 안 막든 작동한다.
  // 아무리 커도 피해를 0 으로 만들지 못한다 (INTENT-DEFENSE-MITIGATION-001).
  defense: number;
  // 자세 (C010) — open | guard. 행동과 나란히 존재한다 (INTENT-GUARD-STANCE-001).
  // RULE-GUARD-SET-001 이 세우고, GUARD-BREAK / MOVE-MODE(run) / DOWNED 가 푼다.
  stance: Stance;
  // 방어가 무너진 여파가 가시는 세계 시각 (C010). 0 이면 여파가 없다.
  // RULE-GUARD-BREAK-001 만이 세운다 — 지우는 Rule 은 없고 시간이 지나가면 의미를 잃는다.
  guardBrokenUntil: number;
  // 마지막으로 자세를 세운 세계 시각 (C011, INTENT-GUARD-ONSET-001).
  // RULE-GUARD-SET-001 이 open → guard 로 세울 때만 찍는다 — guard → guard 재요청은 찍지
  // 않는다(창의 재발행 금지). open 으로 놓아도 지우지 않는다 — 재세움 간격을 재는 기준이다.
  guardStartedAt: number;
  // 열림이 가시는 세계 시각 (C011, INTENT-EXPOSED-001). 0 이면 열려 있지 않다.
  // RULE-EXPOSE-001 만이 세우고 RULE-DOWNED-001 만이 지운다.
  // Exposed 는 저장하지 않는다 — semantic/combat.ts 가 World.Time 에서 유도한다.
  exposedUntil: number;
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
