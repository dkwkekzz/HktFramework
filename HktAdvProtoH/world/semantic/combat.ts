// World Semantic — Combat (C007 ADDED)
//
// 전투 자원(생명 hp · 기력 cp)과 스킬, 그리고 템포 능력치와 배율 합성.
// R1 — 피해는 판정 없이 스킬이 정한 고정값이다 (INTENT-STRIKE-DAMAGE-001).
//      확률로 갈리는 것이 없으므로 세계는 지금까지대로 완전한 결정론이다.
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import type { ActionKind } from './action';
import type { ActorState } from './actor';
import type { WorldPosition } from './position';

// Actor.MoveMode — 걷는가 달리는가 (INTENT-RUN-001)
export type MoveMode = 'walk' | 'run';

// Actor.Stance — 몸이 취한 자세 (C010, INTENT-GUARD-STANCE-001).
// 행동(CurrentAction)과 별개다 — 걸으면서도 막을 수 있어야 하므로 행동 칸을 쓰지 않는다.
export type Stance = 'open' | 'guard';

// 스킬 = 휘두르는 행동. 기존 attack 이 기본 스킬이고, heavy-attack 이 이번에 더해진 고급 스킬이다.
export type SkillKind = Extract<ActionKind, 'attack' | 'heavy-attack'>;

export interface SkillDefinition {
  baseDuration: number; // ActionSpeed 가 걸리기 전의 행동 길이
  damage: number; // 한 번의 타격이 덜어내는 생명 (고정)
  cpCharge: number; // 한 번의 타격이 채우는 기력
  cpCost: number; // 한 번의 타격이 소모하는 기력
}

export const SKILL_DEFINITIONS: Readonly<Record<SkillKind, SkillDefinition>> = {
  // 기본 스킬 — 소모 없이 충전한다. 이것을 모아야 고급 스킬이 나간다.
  attack: { baseDuration: 0.6, damage: 20, cpCharge: 12, cpCost: 0 },
  // 고급 스킬 — 충전하면서 더 크게 소모한다 (붉은보석식 수지). 순수지 -22.
  'heavy-attack': { baseDuration: 0.9, damage: 55, cpCharge: 8, cpCost: 30 },
};

export function isSkillKind(kind: ActionKind): kind is SkillKind {
  return kind === 'attack' || kind === 'heavy-attack';
}

export function skillDefinition(kind: SkillKind): SkillDefinition {
  return SKILL_DEFINITIONS[kind];
}

// CharacterKind 가 정하는 자원·템포 능력치(구 COMBAT_PROFILES)는
// character-catalog.ts 로 옮겨졌다 — 종류가 정하는 값의 단일 출처는 그쪽이다.

// RULE-CP-RUN-DRAIN-001 — 달리는 동안 초당 흘러나가는 기력
export const RUN_CP_DRAIN = 6.0;

// Actor.Modifiers 의 원천 (INTENT-MODIFIER-COMPOSE-001)
export const RUN_CHARGE_FACTOR = 0.5; // 달리는 중에는 기력이 덜 모인다
export const HIT_CHARGE_FACTOR = 0.2; // 얻어맞은 직후에는 거의 모이지 않는다

// 배율의 상·하한 — 원천이 아무리 늘어도 이 밖으로 나가지 않는다
export const MODIFIER_MIN = 0.1;
export const MODIFIER_MAX = 3.0;

// 행동 길이 배율의 한계 (공격 속도가 아무리 빨라도/느려도 이 안이다)
export const ACTION_SPEED_MIN = 0.5;
export const ACTION_SPEED_MAX = 2.0;

// World.StrikeEvents — 타격 결과가 관찰되는 시간
export const STRIKE_EVENT_TTL = 1.2;

// ── 방어와 막기 (C010) ────────────────────────────────────────────────
// 결정론 시뮬레이션 값이므로 헤더 상수로 고정한다.

// INTENT-DEFENSE-MITIGATION-001 — 방어력이 아무리 커도 본래 피해의 이만큼은 반드시 통과한다.
// "아무리 두꺼워도 피해를 0 으로 만들지는 못한다" 가 이 한 값으로 보장된다.
export const MIN_DAMAGE_RATIO = 0.1;

// INTENT-GUARD-DIRECTION-001 — 막히는 정면 범위.
// 몸이 향한 쪽과 들어온 쪽의 dot 이 이 값 이상이어야 막힌다 (0.5 = 좌우 60도, 합 120도).
export const GUARD_FRONT_COS = 0.5;

// INTENT-GUARD-ABSORB-001 — 막아 냈을 때 그래도 생명으로 새어 드는 몫의 비율.
// 나머지는 기력이 대신 받는다. 피해가 사라지는 것이 아니라 어느 자원으로 받을지가 바뀐다.
export const GUARD_DAMAGE_RATIO = 0.15;

// INTENT-GUARD-ABSORB-001 — 기력으로 대신 받는 몫에 걸리는 환율 (피해 1 을 기력 0.8 로 산다).
// 큰 것을 막을수록 비싸다 — CpPaid 가 막아 낸 몫에 비례하기 때문이다.
export const GUARD_CP_PER_DAMAGE = 0.8;

// INTENT-GUARD-BREAK-AFTERMATH-001 — 무너진 뒤 다시 막지 못하는 시간 (초).
// 계속 막기만 하는 선택이 스스로를 끝내는 자리다.
export const GUARD_BREAK_LOCK = 1.5;

// ── 시점과 열림 (C011) ────────────────────────────────────────────────
// 결정론 시뮬레이션 값이므로 헤더 상수로 고정한다.
// 앞의 넷은 원본 기획서 §8.2 · §8.4 의 값 그대로이고, 마지막 하나만 이 Cycle 이 정한다.

// INTENT-PERFECT-GUARD-001 — 자세를 세운 뒤 이 시간 안에 닿은 타격이 완벽하게 막힌다 (초).
// 성패를 가르는 것은 확률이 아니라 두 시각의 관계다 (DC-COMBAT-PLAYER-CAUSALITY).
export const PERFECT_GUARD_WINDOW = 0.2;

// INTENT-PERFECT-GUARD-REWARD-001 — 완벽하게 막아 낸 자가 얻는 기력.
// 지금까지 기력이 도는 길은 때려서 맞히는 것 하나뿐이었다. 여기서 두 번째 길이 열린다.
// 새 자원이 아니라 같은 Cp 다 (DC-COMBAT-SHARED-BUDGET).
export const PERFECT_GUARD_CP_GAIN = 10;

// INTENT-EXPOSED-001 — 완벽하게 막힌 자가 열려 있는 시간 (초).
export const EXPOSED_DURATION = 0.8;

// INTENT-COUNTER-001 — 되받아침이 본래 피해에 더하는 비율.
// 방어력 감쇄보다 앞에 걸린다 — 본래 피해 자체가 커지는 것이다.
export const COUNTER_DAMAGE_BONUS = 0.25;

// INTENT-PERFECT-GUARD-ONCE-001 — 자세를 세운 뒤 다시 세울 수 있게 되기까지의 시간 (초).
// 원본에 없는 값이며 C011 이 소유한다 — 이것이 없으면 자세를 여닫는 것만으로 완벽 창이
// 끊임없이 새로 열려 "되풀이되지 않는다" 가 말뿐인 문장이 된다.
// 기본 스킬 한 번의 길이(0.6)와 같게 두어 한 번의 공격을 읽는 주기가 그대로 재세움 주기다.
export const GUARD_REARM_LOCK = 0.6;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

// Actor.Modifiers (파생 상태 — 저장하지 않고 세계 상태에서 유도)
// 각 값은 자기에게 걸린 원천들을 모두 곱한 뒤 상·하한으로 묶은 것이다.
// 원천이 하나도 없으면 1 (빈 곱). 원천이 늘어도 이 합성 규칙은 바뀌지 않는다.
export interface Modifiers {
  cpCharge: number;
  cpConsume: number;
  moveSpeed: number;
  actionSpeed: number;
}

export function actorModifiers(actor: ActorState): Modifiers {
  let cpCharge = 1;
  // 원천 1 — 달리는 중 (INTENT-MODIFIER-COMPOSE-001)
  if (actor.moveMode === 'run') cpCharge *= RUN_CHARGE_FACTOR;
  // 원천 2 — 얻어맞은 직후. "직후 잠시" 는 피격 반응(hit) 행동이 이어지는 동안이다 —
  // 기존 상태를 그대로 쓰고 새 타이머를 만들지 않는다.
  if (actor.currentAction.kind === 'hit') cpCharge *= HIT_CHARGE_FACTOR;

  return {
    cpCharge: clamp(cpCharge, MODIFIER_MIN, MODIFIER_MAX),
    // 아래 셋은 이번 Cycle 에 걸리는 원천이 없다. 자리는 열려 있다.
    cpConsume: clamp(1, MODIFIER_MIN, MODIFIER_MAX),
    moveSpeed: clamp(1, MODIFIER_MIN, MODIFIER_MAX),
    actionSpeed: clamp(1, MODIFIER_MIN, MODIFIER_MAX),
  };
}

// Actor.Downed (파생 상태) — 생명이 다한 몸 (INTENT-DOWNED-001)
export function isDowned(actor: ActorState): boolean {
  return actor.hp <= 0;
}

// Actor.GuardBroken (파생 상태 — C010, INTENT-GUARD-BREAK-AFTERMATH-001)
// 여파를 거두는 Rule 은 없다. 세계 시각이 그 값을 지나가면 저절로 끝난다 —
// 그래서 새 Tick 단계도, 만료 Rule 도 필요하지 않다.
export function isGuardBroken(actor: ActorState, time: number): boolean {
  return time < actor.guardBrokenUntil;
}

// Actor.Exposed (파생 상태 — C011, INTENT-EXPOSED-001 · INTENT-EXPOSED-EXPIRES-001)
// GuardBroken 과 같은 형태다 — 거두는 Rule 없이 세계 시각이 지나가면 저절로 끝난다.
// 열려 있는 동안 이 몸에 닿는 모든 타격이 되받아침이 된다.
export function isExposed(actor: ActorState, time: number): boolean {
  return time < actor.exposedUntil;
}

// Self.PerfectWindowOpen (파생 상태 — C011, INTENT-PERFECT-GUARD-OBSERVE-001)
// 지금 이 자세가 아직 완벽하게 막을 수 있는 창 안인가.
// 읽어야 할 것은 상대의 공격이지 자기 세계의 규칙이 아니므로 관찰로 제공한다.
export function isPerfectWindowOpen(actor: ActorState, time: number): boolean {
  return actor.stance === 'guard' && time - actor.guardStartedAt <= PERFECT_GUARD_WINDOW;
}

// Self.GuardRearmAt (파생 — C011) — 자세를 다시 세울 수 있게 되는 세계 시각.
export function guardRearmAt(actor: ActorState): number {
  return actor.guardStartedAt + GUARD_REARM_LOCK;
}

// 이 Actor 가 지금 실제로 나아가는 빠르기 (INTENT-TEMPO-MOVE-001 · INTENT-RUN-001)
export function effectiveMoveSpeed(actor: ActorState): number {
  const modifiers = actorModifiers(actor);
  const run = actor.moveMode === 'run' ? actor.runSpeedMultiplier : 1;
  return actor.moveSpeed * modifiers.moveSpeed * run;
}

// 지금 이 스킬을 시작하면 그 행동이 얼마나 걸리는가 (INTENT-TEMPO-ACTION-001).
// 길이는 시작하는 순간 확정된다 — 진행 중에 바뀌면 진행도의 기준이 흔들린다.
export function skillDuration(actor: ActorState, kind: SkillKind): number {
  const base = skillDefinition(kind).baseDuration;
  const speed = actor.actionSpeed * actorModifiers(actor).actionSpeed;
  return clamp(base / speed, base / ACTION_SPEED_MAX, base / ACTION_SPEED_MIN);
}

// World.StrikeEvents — 한 번의 타격이 낳은 결과. 시간이 지나면 세계에서 사라진다.
//
// C010 CHANGED — 값 하나가 아니라 그 값을 만든 내역 전부가 실린다
// (INTENT-STRIKE-BREAKDOWN-001).
//
// C011 CHANGED — 여기에 "시점이 무엇을 했는가" 가 더해진다
// (INTENT-TIMING-BREAKDOWN-001). 열한 값의 관계가 곧 계산 순서다:
//   (되받아침) → baseAmount → (방어력) → mitigated → (막기)
//     → amount(생명) + cpPaid(기력) 또는 cpGained(기력)
export interface StrikeEvent {
  attackerId: string;
  targetId: string;
  skill: SkillKind;
  baseAmount: number; // 증폭까지 끝난 본래 피해 (되받아침이면 이미 커져 있다)
  counterBonus: number; // C011 — 되받아침이 키운 몫. 증폭 전 값 = baseAmount - counterBonus
  counter: boolean; // C011 — 되받아친 타격인가 (맞은 자가 열려 있었는가)
  mitigated: number; // 방어력이 걷어낸 뒤 남은 피해
  guarded: boolean; // 막아 낸 타격인가 (완벽하게 막은 것도 참이다)
  perfectGuard: boolean; // C011 — 완벽하게 막아 낸 타격인가
  // C011 — 막힌 타격이면 자세를 세운 뒤 닿기까지 걸린 시간.
  // 막히지 않았으면 null 이다 — 잴 대상이 없기 때문이다.
  // 이 값과 PERFECT_GUARD_WINDOW 의 비교가 곧 완벽 판정의 전부이므로,
  // 보는 이는 상수를 몰라도 여러 번의 값을 비교해 창의 크기를 스스로 안다.
  guardElapsed: number | null;
  cpPaid: number; // 막느라 치른 기력 (막지 않았거나 완벽했으면 0)
  cpGained: number; // C011 — 완벽하게 막아 얻은 기력 (아니면 0)
  amount: number; // 실제로 생명에서 나간 몫
  guardBroken: boolean; // 이 타격으로 방어가 무너졌는가
  position: WorldPosition;
  time: number;
}

// ── 디버그 조작 기반 (R2, INTENT-ATTRIBUTE-MUTATE-001) ────────────────
//
// MutableAttribute — 바꿀 수 있는 속성의 목록과 각자의 허용 범위.
// 파생 상태(Downed · Modifiers)와 정체성(Id · Name · CharacterKind · Control)은 없다 —
// 유도되는 값이거나 존재를 존재이게 하는 값이다.
export type MutableAttributeId =
  | 'hp'
  | 'hpMax'
  | 'cp'
  | 'cpMax'
  | 'moveSpeed'
  | 'runSpeedMultiplier'
  | 'actionSpeed'
  | 'moveMode'
  // C010 — 방어력과 자세. GuardBroken 은 파생이므로 여기 없고,
  // GuardBrokenUntil 은 세계 시각이라 밖에서 넣을 값이 아니다.
  | 'defense'
  | 'stance'
  // C011 — 열림. ExposedUntil 을 직접 넣게 하지 않는 이유는 그것이 세계 시각이어서
  // 밖에서 의미 있는 값을 고를 수 없기 때문이다 (C010 이 guardBrokenUntil 에 내린 판단과 같다).
  // 대신 "지금부터 몇 초 동안 열려 있게 한다" 를 받는다. 0 이면 그 자리에서 닫힌다.
  | 'exposedFor';

export interface MutableAttribute {
  id: MutableAttributeId;
  /** 수치 속성의 허용 범위 */
  min?: number;
  max?: number;
  /** 값이 정해진 몇 가지뿐인 속성 (moveMode) */
  values?: string[];
}

export const MUTABLE_ATTRIBUTES: readonly MutableAttribute[] = [
  { id: 'hp', min: 0, max: 100000 },
  { id: 'hpMax', min: 1, max: 100000 },
  { id: 'cp', min: 0, max: 100000 },
  { id: 'cpMax', min: 1, max: 100000 },
  { id: 'moveSpeed', min: 0, max: 100 },
  { id: 'runSpeedMultiplier', min: 0.1, max: 10 },
  { id: 'actionSpeed', min: 0.1, max: 10 },
  { id: 'moveMode', values: ['walk', 'run'] },
  // C010 — defense 를 크게 올려 보면 "아무리 두꺼워도 피해가 0 이 되지 않는다" 가
  // strikeEvents 의 내역으로 직접 확인된다 (MIN_DAMAGE_RATIO).
  { id: 'defense', min: 0, max: 100000 },
  { id: 'stance', values: ['open', 'guard'] },
  // C011 — 아무 몸이나 열어 두면 자율 존재의 공격을 기다리지 않고도
  // 되받아침(+COUNTER_DAMAGE_BONUS)이 strikeEvents 의 내역으로 직접 확인된다.
  { id: 'exposedFor', min: 0, max: 600 },
];

export function findMutableAttribute(id: string): MutableAttribute | undefined {
  return MUTABLE_ATTRIBUTES.find((a) => a.id === id);
}
