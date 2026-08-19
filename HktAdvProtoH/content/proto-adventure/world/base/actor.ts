// World Base — Actor 한 벌 (C001 ADDED / C002 CHANGED / C006 CHANGED)
//
// 사실 2 — Actor 는 하나의 몸이다 (hp·위치·소지품이 한 존재에 산다).
// 그래서 State 는 도메인별로 쪼개지 않고 base 가 **한 벌로** 소유한다.
// 대신 필드마다 [도메인] 을 표기한다. 읽기는 어느 도메인이든 자유이고,
// **쓰기는 그 도메인의 함수를 통해서만 한다** — 다른 도메인이 hp 를 깎고 싶으면
// combat 의 함수를 부른다 (design/Design-Pack-Domain-Modules.md 소유권 규칙).
//
// C007 변경: 모든 Actor 는 전투 자원과 템포 능력치를 지닌다.
//   ADDED   Name · Hp/HpMax · Cp/CpMax · MoveMode · RunSpeedMultiplier · ActionSpeed
//   CHANGED MoveSpeed 는 고정 상수가 아니라 배율이 걸리는 능력치다 (TempoStats).
//   Downed 와 Modifiers 는 저장하지 않는다 — domains/combat/combat.ts 가 유도한다.
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
import type { MoveMode } from '../domains/movement/move-mode';
import type { Inventory } from '../domains/mining/inventory';
import type { WorldPosition } from './position';

// Actor.Control — 이 Actor 의 행동을 누가 결정하는가
export type ActorControl = 'player' | 'autonomous';

// Actor.CharacterKind — 어떤 종류의 존재인가 (모션 집합 선택 기준, View 는 이 값만 본다)
export type CharacterKind = string;

export interface ActorState {
  // ── [base] 정체성 ─────────────────────────────────────────────────
  id: string;
  /** Actor.Name (C007) — 세계가 순번으로 정하는 부를 이름. 세계 밖 문자열을 섞지 않는다 */
  name: string;
  characterKind: CharacterKind;
  control: ActorControl; // [autonomy] 조종되는가 스스로 정하는가

  // ── [base] 몸 ─────────────────────────────────────────────────────
  position: WorldPosition; // [movement] 가 옮기고 [base] 물리가 보정한다
  bodyRadius: number; // Body.Radius — 고정 상수 (C006)
  bodyHeight: number; // Body.Height — 고정 상수 (C006 R1) — 캡슐 부피 관찰용
  bodyMass: number; // Body.Mass — 고정 상수 (C006)
  facing: WorldPosition; // 몸이 향한 방향 (단위 벡터) — RULE-BODY-FACING-001 만이 바꾼다 (C006 R1)
  velocity: WorldPosition; // 힘이 만든 물리 속도 — RULE-BODY-PUSH/SWING-STRIKE 만이 더한다 (C006)
  // ── [combat] 전투 자원 (C007) — 생명은 타격만이, 기력은 스킬 수지와 달리기만이 바꾼다
  hp: number;
  hpMax: number;
  cp: number;
  cpMax: number;
  // ── [combat] 전투 능력치 (C010) — 종류가 초기값을 정한다. 한 방의 크기를 정하는 두 값이며
  // RULE-DAMAGE-CALCULATE-001 만이 읽는다.
  // C012 CHANGED — C010 의 attack/defense 두 값이 방식별 네 값으로 갈린다.
  // 일반 attack/defense 는 남기지 않는다 — 두 이름이 공존하면 어느 값이 계산의
  // 권위인지 모호해진다 (설계 §9).
  physicalAttack: number; // 물리 방식 피해를 키운다 (INTENT-TYPED-OFFENSE-001)
  auraAttack: number; // 오라 방식 피해를 키운다 (INTENT-TYPED-OFFENSE-001)
  armor: number; // 물리 방식 피해를 줄인다 (INTENT-TYPED-DEFENSE-001)
  resistance: number; // 오라 방식 피해를 줄인다 (INTENT-TYPED-DEFENSE-001)
  // C013 ADDED — 관통. 상대의 마주한 방어를 얼마간 통하지 않게 만든다
  // (INTENT-PENETRATION-001). 그 자체로는 아무것도 일으키지 않고 자기 피해도 키우지 않는다 —
  // RULE-DAMAGE-CALCULATE-001 Step 1 에서만 읽힌다. "관통이 없다" 는 값 0 이다.
  armorPenetration: number; // 상대의 Armor 를 통하지 않게 만든다
  resistancePenetration: number; // 상대의 Resistance 를 통하지 않게 만든다
  // ── [combat] 막기 (C011) — 행동과 나란한 몸의 상태다. CurrentAction 자리를 쓰지 않는다.
  // 막으면서 걸을 수 있어야 하는데, 행동 자리를 쓰면 걷기와 자리를 다투게 되어
  // INTENT-ACTION-STATE-001("언제나 정확히 하나의 행동")을 깨야 하기 때문이다.
  guarding: boolean; // 지금 앞을 향해 버티고 있는가 — RULE-GUARD-* 와 RULE-MOVE-MODE-001 만이 바꾼다
  guardBrokenUntil: number; // 이 세계 시각까지는 다시 막을 수 없다 (무너짐의 대가). 초기값 0
  // ── 템포 능력치 (C007) — 존재 종류가 정하는 고정값. 세계의 속도를 정한다
  moveMode: MoveMode; // [movement] walk | run — RULE-MOVE-MODE-001 만이 바꾼다
  moveSpeed: number; // [movement] TempoStats.MoveSpeed (C001 고정 상수 → C007 능력치로 승격)
  runSpeedMultiplier: number; // [movement] 달릴 때 이동 속도에 곱해지는 값
  actionSpeed: number; // [combat] 스킬 행동 길이에 걸리는 배율 (클수록 빠르다)
  attackRange: number; // [combat] 고정 상수 — 칼끝이 닿는 거리
  perceptionRange: number; // [autonomy] 고정 상수 — control = autonomous 일 때만 의미가 있다
  wanderPath: WorldPosition[]; // [autonomy] 고정 — control = autonomous 일 때만 의미가 있다
  wanderIndex: number; // [autonomy]
  inventory: Inventory; // [mining] 소지품 — 항목의 뜻과 셈은 domains/mining 이 소유한다
  currentAction: CurrentAction; // [base] 언제나 정확히 하나 (INTENT-ACTION-STATE-001)
}
