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
// C017 변경: 몸이 지나가면 땅에 자국이 남는다 (RULE-TRACK-001).
//   ADDED   DistanceSinceTrack — 마지막 자국 뒤로 걸은 거리. 표본 간격에 닿으면 자국 하나가 난다.

// C039 변경: **몸이 세계에 선다** — 저장되는 것과 유도되는 것이 갈린다 (규칙 1 · R2 · R3).
//   REMOVED HpMax · CpMax · PerceptionRange — 그 셋은 이제 **묻는 것**이다
//           (semantic/body-property.ts · RULE-BODY-PROPERTY-001 · RULE-AWARENESS-001).
//   ADDED   Core — 몸에 귀속된 지속 상태 (RULE-BODY-CORE-001). 지우는 손이 없다.
//   ADDED   PropertySources — **이 몸에 걸린 Source 들**. 최종값이 아니라 **원인**의 자리다
//           (R2 가 금하는 것은 닫힌 최종값 필드다 — 개체별 인지 재정의가 여기로 들어온다).
//
// **여덟 자리의 형** (spec 규칙 1 ① — 아래 필드를 이 자리별로 묶어 둔다).
//   ① 정체       누구인가 · 어떤 종류인가 · 누가 결정하는가 (id · name · characterKind · control)
//   ② 있음       세계의 어디에 어떤 몸으로 서 있는가 (regionId · position · body* · facing · velocity)
//   ③ 몸 상태     지금의 값들 (hp · cp · moveMode · 템포 · 걸음의 셈)
//   ④ Core       몸에 귀속된 지속 상태 (core)
//   ⑤ 인지       무엇을 감지하는가 — **저장되지 않는다** (propertySources 가 그 원인이다)
//   ⑥ 앎         **빈 자리** — C040 이 채운다
//   ⑦ 지금 행동   currentAction (· wanderPath · wanderIndex 가 자율 존재의 다음을 정한다)
//   ⑧ 장착 자리   **빈 자리** — C042 가 채운다
// 종류 · 이름 · 조종 방식을 「정체」에 함께 두는 것은 실현의 몫이다 (spec 기본형 ⑨).

import type { PropertySource } from '../../../engine/world-authoring/property';
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
  // ③ 몸 상태 — 전투 자원. 생명은 타격만이, 기력은 스킬 수지와 달리기만이 바꾼다.
  // **최대는 여기 없다** (C039 REMOVED · 규칙 1 ②) — 최대 HP · 최대 CP 는 묻는 것이다
  // (bodyMaxHp · bodyMaxCp). 현재값은 그 답을 넘지 않는다 (clampBodyVitals · 규칙 3 ②③).
  hp: number;
  cp: number;
  // 템포 능력치 — 존재 종류가 정하는 고정값. 세계의 속도를 정한다
  moveMode: MoveMode; // walk | run — RULE-MOVE-MODE-001 만이 바꾼다
  moveSpeed: number; // TempoStats.MoveSpeed — 고정 상수가 아니라 배율이 걸리는 능력치다
  runSpeedMultiplier: number; // 달릴 때 이동 속도에 곱해지는 값
  actionSpeed: number; // 스킬 행동 길이에 걸리는 배율 (클수록 빠르다)
  attackRange: number; // 고정 상수
  /**
   * ④ Core — 몸에 귀속된 **지속 상태** (C039 ADDED · RULE-BODY-CORE-001 · spec 규칙 7).
   *
   * 계열 하나를 가리키는 **코드**다 (사람이 읽는 말이 아니다 — 그 말은 View 의 표가 옮긴다).
   * 저장되고, 방을 건너도 · HP 가 줄어도 · 세계가 껐다 켜져도 그대로다: 지우는 손이 없다.
   * **아무것도 열지 않는다** — 능력 · 성장 · Class 는 6 · 7층의 것이고 여기는 자리다.
   * 이 세계가 그 몸의 계열을 아직 말하지 않았으면 빈 글자다 (character-catalog 의 기본값).
   */
  core: string;
  /**
   * ⑤ 인지 · 그 밖 — **이 몸에 걸린 Source 들** (C039 ADDED · RULE-BODY-PROPERTY-001).
   *
   * 성질의 **최종값이 아니라 원인**이다: 개체별 인지 재정의(ActorSpawn.perceptionRange)가
   * 여기 「인지에 상한 하나」로 들어오고, 앞으로 장착 · 소지 · 조건이 거는 것도 이 자리로
   * 온다 (4 · 6층 — 지금은 자리만이다). 무엇이 걸렸는지는 저장되고, 그것을 합친 **답**은
   * 저장되지 않는다 (bodyProperty).
   */
  propertySources: PropertySource[];
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
  /**
   * 마지막 자국 뒤로 걸은 거리 (C017 ADDED · spec State · RULE-TRACK-001).
   *
   * **저장된다.** movedThisTick 이 이번 tick 하나의 사실이라 저장되지 않는 것과 갈린다 —
   * 이 값은 여러 tick 에 걸쳐 쌓이므로 껐다 켠 세계가 이어서 세야 한다.
   *
   * 표본 간격(TRACK_STEP_DISTANCE)에 닿으면 자국 하나가 나고 0 으로 돌아간다.
   * **방을 건너도 이어진다** (spec R5 경계 ②) — 걸은 거리는 몸의 것이고, 자국은 선 방에 난다.
   */
  distanceSinceTrack: number;
  inventory: Inventory;
  currentAction: CurrentAction;
}
