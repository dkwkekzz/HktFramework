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
import type { AllocationId } from './allocation';
import type { MoveMode } from './combat';
import type { Equipment } from './equipment';
import type { Inventory } from './inventory';
import type { GuardedGround } from './relation';
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
  // C023 CHANGED — 아래 여덟 값은 이제 **기본값**이라는 뜻을 가진다. 이름은 그대로다.
  // 판정이 읽는 것은 이 값이 아니라 걸린 것을 반영해 다시 센 **유효 값**이며,
  // 그것은 저장되지 않는다 (semantic/combat.ts effectiveStat · RULE-EFFECTIVE-STATS-001).
  // 밖에서 손대는 값(RULE-ATTRIBUTE-SET-001)도 여전히 기본값이다.
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
  // C015 ADDED — Critical. 자기 타격이 크게 터질 가능성과 터졌을 때의 증폭
  // (INTENT-CRITICAL-001). 둘 다 **치는 자의 능력**이며 맞는 자에게서는 읽히지 않는다.
  // 그 자체로는 아무것도 일으키지 않고 평소의 피해를 한 톨도 키우지 않는다 —
  // RULE-CRITICAL-STRIKE-001 에서만 읽힌다. "터뜨릴 수 없다" 는 값 0 이다.
  criticalChance: number; // 0~1 — 이 몸의 타격이 크게 터질 가능성
  criticalDamage: number; // 1 이상 — 터졌을 때 최종 피해에 걸리는 배율
  // C016 ADDED — 통찰. 살펴보지 않고도 상대의 어느 자리까지 아는가를 정한다
  // (INTENT-INSIGHT-001). 겨루는 힘이 아니라 **아는 힘**이며 어떤 계산에도 들어가지
  // 않는다 — 피해·기력·속도·판정 어디에도 이 값이 없다. 읽히는 곳은 가려짐 관문
  // 하나뿐이다 (RULE-INSIGHT-REVEAL-001). "다가가야만 안다" 는 값 0 이다.
  insight: number; // 0~100 — 살펴보지 않고도 아는 범위를 정한다
  /**
   * C-COMBAT-001 ADDED — 지금의 배분 (INTENT-BODY-HAS-AN-ALLOCATION-001).
   *
   * 지금 자신의 힘을 몸 · 능력 · 인지 중 어디에 몰아 두었는가. 이름 하나이며
   * 몫의 묶음이 아니다 (DC-COMBAT-AURA-IS-A-PROFILE-NOT-A-DIAL).
   *
   * **어떤 몸이든 언제나 정확히 하나를 지닌다** — 조종 주체를 가리지 않고 비어 있는
   * 값도 없다. 그러므로 걸고 푸는 것이 아니며 "배분이 없는 몸" 이라는 갈래가 세계에
   * 생기지 않는다: 그런 몸은 고르게 나눈 배분(balanced)을 지닌 몸이다.
   *
   * 종류가 정하는 값이 아니다 — 카탈로그에 두지 않는다. 같은 종류라도 지금 어디에
   * 몰아 두었는지는 개체마다 다르며 국면마다 바뀐다 (C018 의 guardedGround 와 같은 자리).
   *
   * 유효 값에 어떻게 들어가는지는 semantic/allocation.ts 와 semantic/combat.ts 의
   * effectiveStat 이 소유한다. RULE-ALLOCATION-SET-001 만이 이 값을 바꾼다
   * (자율 존재의 RULE-NPC-ALLOCATION-001 도 그 규칙을 지나간다).
   */
  allocation: AllocationId;
  // 막기 (C011) — 행동과 나란한 몸의 상태다. CurrentAction 자리를 쓰지 않는다.
  // 막으면서 걸을 수 있어야 하는데, 행동 자리를 쓰면 걷기와 자리를 다투게 되어
  // INTENT-ACTION-STATE-001("언제나 정확히 하나의 행동")을 깨야 하기 때문이다.
  guarding: boolean; // 지금 앞을 향해 버티고 있는가 — RULE-GUARD-* 와 RULE-MOVE-MODE-001 만이 바꾼다
  guardBrokenUntil: number; // 이 세계 시각까지는 다시 막을 수 없다 (무너짐의 대가). 초기값 0
  // 템포 능력치 (C007) — 존재 종류가 정하는 고정값. 세계의 속도를 정한다
  moveMode: MoveMode; // walk | run — RULE-MOVE-MODE-001 만이 바꾼다
  moveSpeed: number; // TempoStats.MoveSpeed (C001 고정 상수 → C007 능력치로 승격)
  runSpeedMultiplier: number; // 달릴 때 이동 속도에 곱해지는 값
  actionSpeed: number; // 스킬 행동 길이에 걸리는 배율 (클수록 빠르다)
  engagementRange: number; // 고정 상수 (C025 — 구 attackRange · 다가가는 거리)
  perceptionRange: number; // 고정 상수 — control = autonomous 일 때만 의미가 있다
  wanderPath: WorldPosition[]; // 고정 — control = autonomous 일 때만 의미가 있다
  wanderIndex: number;
  // C018 ADDED — 지키는 자리 (INTENT-STANCE-FROM-GUARDED-GROUND-001).
  // 이 자리에 든 존재를 사냥감으로 대한다. 없으면 이 사정으로는 누구도 그렇게 대하지 않는다.
  // **어떤 몸이든 지닐 수 있다** — 조종 주체를 가리지 않는다. 보는 이의 몸도 같은 자리를
  // 지니며 지금은 값이 없을 뿐이다 (RULE-OBSERVER-JOIN-001 무변경).
  // 개체가 지니는 값이므로 종류 카탈로그에 두지 않는다 — 같은 종류라도 지킬 것이 있는
  // 개체와 없는 개체가 있다.
  guardedGround: GuardedGround | null;
  inventory: Inventory;
  /**
   * C023 ADDED — 지금 몸에 걸려 있는 것들 (INTENT-BODY-HAS-APPLY-PLACES-001).
   *
   * 자리가 물건을 직접 담는다 — 걸린 것은 소지품에 없다 (DC-ITEM-LIVES-IN-ONE-PLACE).
   * **어떤 몸이든 지닌다** — 조종 주체를 가리지 않는다. 자율 존재도 같은 자리를 지니며
   * 지금은 비어 있을 뿐이고, 그래서 유효 값과 기본값이 같다 (회귀 무변경).
   */
  equipment: Equipment;
  currentAction: CurrentAction;
  /**
   * C-TERRAIN-001 ADDED — 몸이 지닌 열 (INTENT-BODY-HOLDS-WHAT-THE-LAND-TAKES-001).
   *
   * 땅이 거두어 가는 것이다. **줄어드는 동안 몸은 상하지 않는다** — 얼어 죽는 것보다
   * 위험한 것은 잃고 있다는 사실을 즉시 느끼지 못하는 것이다 (BT §5.2). 그래서 이것은
   * 피해가 아니다. 피해는 맞는 것이고 이것은 **빠져나가는 것**이며, 둘을 같은 것으로
   * 만들면 땅의 법칙이 "지형이 때린다" 가 되어 그 문장이 통째로 사라진다.
   *
   * RULE-GROUND-LAW-APPLY-001 과 RULE-ATTRIBUTE-SET-001 만이 바꾼다.
   * **되채우는 규칙이 아직 없다** — 채우는 것은 다음 후보의 몫이다
   * (FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED · 05-review.md 승인 ②).
   *
   * 겨루는 힘(Cp)이 그러하듯 **몸의 형편**이지 물건의 성질이 아니다.
   * 어떤 몸이든 지닌다 — 조종 주체를 가리지 않는다.
   */
  warmth: number;
  /**
   * C-TERRAIN-001 ADDED — 지닐 수 있는 열의 최대.
   *
   * 지금은 모든 몸이 같은 값이다 (WARMTH_MAX). 종류마다 다른 값은 종류의 정의
   * (character-catalog)로 옮기는 한 줄 이사이며, 그럴 이유가 생겼을 때 한다 —
   * C022 가 InventoryCapacity 에 대해 내린 판단 그대로다.
   */
  warmthMax: number;
}
