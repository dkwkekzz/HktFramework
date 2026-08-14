// World Semantic — Combat (C007 ADDED)
//
// 전투 자원(생명 hp · 기력 cp)과 스킬, 그리고 템포 능력치와 배율 합성.
// R1 — 피해는 판정 없이 스킬이 정한 고정값이다 (INTENT-STRIKE-DAMAGE-001).
//      확률로 갈리는 것이 없으므로 세계는 지금까지대로 완전한 결정론이다.
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import type { ActionKind } from './action';
import type { ActorState, CharacterKind } from './actor';
import type { WorldPosition } from './position';

// Actor.MoveMode — 걷는가 달리는가 (INTENT-RUN-001)
export type MoveMode = 'walk' | 'run';

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

// CharacterKind 가 정하는 자원·템포 능력치 (COMBAT_PROFILES).
export interface CombatProfile {
  hpMax: number;
  cpMax: number;
  cpStart: number;
  moveSpeed: number; // TempoStats.MoveSpeed — C001 상수의 승격
  runSpeedMultiplier: number;
  actionSpeed: number;
}

// 기본 스킬 20 · 고급 스킬 55 를 기준으로 —
//   자율 존재(120)는 기본 6대 또는 고급 2대 + 기본 1대에 쓰러진다.
//   관찰자의 몸(200)은 자율 존재의 기본 스킬 10대를 견딘다.
//   고급 스킬(소모 30, 충전 8)은 기본 스킬 3대(충전 36)를 모아야 한 번 나간다.
export const COMBAT_PROFILES: Readonly<Record<string, CombatProfile>> = {
  'rabbit-swordsman': {
    hpMax: 200,
    cpMax: 100,
    cpStart: 30,
    moveSpeed: 6.0,
    runSpeedMultiplier: 1.8,
    actionSpeed: 1.0,
  },
  wanderer: {
    hpMax: 120,
    cpMax: 60,
    cpStart: 20,
    moveSpeed: 2.5,
    runSpeedMultiplier: 1.4,
    actionSpeed: 0.85,
  },
};

// 모르는 종류의 존재도 세계에 놓일 수 있어야 한다 — 자원 없는 몸을 만들지 않는다.
export const DEFAULT_COMBAT_PROFILE: CombatProfile = COMBAT_PROFILES['wanderer']!;

export function combatProfile(kind: CharacterKind): CombatProfile {
  return COMBAT_PROFILES[kind] ?? DEFAULT_COMBAT_PROFILE;
}

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
export interface StrikeEvent {
  attackerId: string;
  targetId: string;
  skill: SkillKind;
  amount: number;
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
  { id: 'moveSpeed', min: 0, max: 100 },
  { id: 'runSpeedMultiplier', min: 0.1, max: 10 },
  { id: 'actionSpeed', min: 0.1, max: 10 },
  { id: 'moveMode', values: ['walk', 'run'] },
];

export function findMutableAttribute(id: string): MutableAttribute | undefined {
  return MUTABLE_ATTRIBUTES.find((a) => a.id === id);
}
