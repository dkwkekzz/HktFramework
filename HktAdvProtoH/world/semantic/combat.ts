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

// 스킬 = 휘두르는 행동. 기존 attack 이 기본 스킬이고, heavy-attack 이 이번에 더해진 고급 스킬이다.
export type SkillKind = Extract<ActionKind, 'attack' | 'heavy-attack'>;

// C010 CHANGED — 스킬은 더 이상 혼자 피해를 정하지 않는다 (INTENT-SKILL-SCALING-001).
// damage 하나가 baseDamage(스킬 자체의 강함)와 attackRatio(공격 능력을 피해로 바꾸는 정도)로
// 나뉜다. 그래야 Actor 의 성장과 스킬의 성장을 따로 조절할 수 있다.
export interface SkillDefinition {
  baseDuration: number; // ActionSpeed 가 걸리기 전의 행동 길이
  baseDamage: number; // 스킬 자체의 강함 (C010 — 구 damage)
  attackRatio: number; // 공격 능력을 얼마나 피해로 바꾸는가 (C010 ADDED)
  cpCharge: number; // 한 번의 타격이 채우는 기력
  cpCost: number; // 한 번의 타격이 소모하는 기력
}

// C010 — 값은 재밸런싱이 아니라 C007 의 체감을 보존하는 방향으로 역산했다.
// 관찰자(Attack 40) → 자율 존재(Defense 30) 기준:
//   기본  (6 + 40×0.5)  = 26 × 100/130 = 20   ← C007 의 고정 20 과 같다
//   고급  (32 + 40×1.0) = 72 × 100/130 = 55   ← C007 의 고정 55 와 같다
// 계수가 큰 스킬일수록 공격 능력이 오를 때 더 크게 자란다 (빠른 기술은 낮게, 강한 기술은 높게).
export const SKILL_DEFINITIONS: Readonly<Record<SkillKind, SkillDefinition>> = {
  // 기본 스킬 — 소모 없이 충전한다. 이것을 모아야 고급 스킬이 나간다.
  attack: { baseDuration: 0.6, baseDamage: 6, attackRatio: 0.5, cpCharge: 12, cpCost: 0 },
  // 고급 스킬 — 충전하면서 더 크게 소모한다 (붉은보석식 수지). 순수지 -22.
  'heavy-attack': { baseDuration: 0.9, baseDamage: 32, attackRatio: 1.0, cpCharge: 8, cpCost: 30 },
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

// World.DefenseConstant (C010 ADDED) — 방어 감쇄의 세계 상수 (INTENT-DEFENSE-001).
// 방어 능력이 이 값과 같을 때 피해가 정확히 절반이 된다.
// 결정론에 영향을 주므로 헤더 상수로 고정한다.
export const DEFENSE_CONSTANT = 100;

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

// Actor.DefenseMultiplier (파생 상태, C010 ADDED) — 이 몸이 들어온 피해를 몇 할로 받는가.
// Defense 가 0 이상이므로 결과는 0 초과 1 이하다 — 방어는 줄일 뿐 없애지 못하고,
// 값이 오를수록 추가 방어의 효율이 완만해진다 (INTENT-DEFENSE-001).
export function defenseMultiplier(actor: ActorState): number {
  return DEFENSE_CONSTANT / (DEFENSE_CONSTANT + actor.defense);
}

// 지금 이 Actor 가 이 스킬을 쓰면 나오는 공격 피해 (파생, C010 ADDED).
// 방어를 적용하기 전의 값이다 — 최종 피해는 맞는 자가 정해져야 알 수 있다.
export function rawDamage(actor: ActorState, kind: SkillKind): number {
  const skill = skillDefinition(kind);
  return skill.baseDamage + actor.attack * skill.attackRatio;
}

// 한 방의 크기가 어떻게 나왔는가 (C010 ADDED) — RULE-DAMAGE-CALCULATE-001 의 산출물.
// 저장하지 않는다. 계산이 낳고 StrikeEvent 가 싣는다.
// C011 CHANGED — 뒤의 두 항목이 더해진다. finalDamage 의 의미는 그대로다
// (공식이 내놓은 값 = 막지 않았다면 들어왔을 값).
export interface DamageBreakdown {
  baseDamage: number;
  attackContribution: number;
  rawDamage: number;
  targetDefense: number;
  defenseMultiplier: number;
  finalDamage: number;
  /** 실제로 생명에서 빠진 값 (C011). 막지 않은 타격에서는 finalDamage 와 같다 */
  appliedDamage: number;
  /** 막기가 이 한 방에 한 일 (C011). 막지 않은 타격에는 실리지 않는다 */
  guard?: GuardOutcome;
}

// ── 막기 (C011 ADDED) ────────────────────────────────────────────────
//
// 결정론에 영향을 주므로 전부 헤더 상수로 고정한다 (CVar 아님).

/** 막힌 타격이 남기는 비율 — R1 §14 `Guard → Damage Taken × 0.5` 그대로 */
export const GUARD_DAMAGE_FACTOR = 0.5;

/** Facing 과 이루는 각의 코사인 하한 — 0.5 는 정면 ±60° (INTENT-GUARD-DIRECTION-001) */
export const GUARD_ARC_COS = 0.5;

/**
 * 막지 않았다면 들어왔을 피해 1 당 치르는 기력.
 * 감쇄 **전** 값으로 매긴다 — 감쇄 후 값으로 매기면 잘 막을수록 싸져서
 * "생명 대신 기력" 이 흐려진다 (INTENT-GUARD-COST-001).
 */
export const GUARD_CP_PER_DAMAGE = 0.6;

/** 방어가 무너진 뒤 다시 막을 수 없는 시간(초) */
export const GUARD_BREAK_RECOVERY = 1.0;

/** 한 번의 막기 판정 결과 (파생 — 저장하지 않는다) */
export interface GuardOutcome {
  blocked: boolean; // 막혔는가
  broken: boolean; // 이 타격에 방어가 무너졌는가
  cpPaid: number; // 실제로 치른 기력 (무너졌으면 0)
  prevented: number; // 막아서 덜 들어간 값 = finalDamage - appliedDamage
}

/**
 * Actor.Guard.Broken (파생 상태) — 지금 무너져 있어 다시 들지 못하는가.
 * 절대 시각(GuardBrokenUntil)이 아니라 이 판정만이 밖으로 나간다 —
 * 보는 이에게 필요한 것은 "언제까지" 가 아니라 "지금 못 든다" 다.
 */
export function isGuardBroken(actor: ActorState, worldTime: number): boolean {
  return worldTime < actor.guardBrokenUntil;
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
// C010 CHANGED — amount 는 그대로 남고 그 옆에 계산 경위가 붙는다
// (amount === breakdown.finalDamage).
export interface StrikeEvent {
  attackerId: string;
  targetId: string;
  skill: SkillKind;
  amount: number;
  breakdown: DamageBreakdown;
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
  | 'attack'
  | 'defense'
  | 'moveSpeed'
  | 'runSpeedMultiplier'
  | 'actionSpeed'
  | 'moveMode';

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
  // C010 ADDED — 두 능력의 하한이 0 인 것은 음수 방어(피해 증폭)를 이 층에서
  // 만들지 않기 위해서다. 증폭은 위층(Critical · Aura)의 일이다.
  { id: 'attack', min: 0, max: 100000 },
  { id: 'defense', min: 0, max: 100000 },
  { id: 'moveSpeed', min: 0, max: 100 },
  { id: 'runSpeedMultiplier', min: 0.1, max: 10 },
  { id: 'actionSpeed', min: 0.1, max: 10 },
  { id: 'moveMode', values: ['walk', 'run'] },
];

export function findMutableAttribute(id: string): MutableAttribute | undefined {
  return MUTABLE_ATTRIBUTES.find((a) => a.id === id);
}
