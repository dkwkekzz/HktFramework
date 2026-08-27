// World Semantic — Combat (C007 ADDED)
//
// 전투 자원(생명 hp · 기력 cp)과 스킬, 그리고 템포 능력치와 배율 합성.
// R1 — 피해는 판정 없이 스킬이 정한 고정값이다 (INTENT-STRIKE-DAMAGE-001).
//      확률로 갈리는 것이 없으므로 세계는 지금까지대로 완전한 결정론이다.
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다.

import { actionProgress, type ActionKind } from './action';
import type { ActorState } from './actor';
import {
  allocationContribution,
  type AllocatableStat,
  type AllocationId,
} from './allocation';
import { equipmentContributions } from './equipment';
import { growthContribution, type GrowableStat } from './growth';
import type { ContributableStat, Force } from './item';
import type { WorldPosition } from './position';

// Actor.MoveMode — 걷는가 달리는가 (INTENT-RUN-001)
export type MoveMode = 'walk' | 'run';

// 스킬 = 휘두르는 행동. 기존 attack 이 기본 스킬이고, heavy-attack 이 고급 스킬,
// aura-strike 가 C012 에서 더해진 오라 방식 스킬이다.
export type SkillKind = Extract<ActionKind, 'attack' | 'heavy-attack' | 'aura-strike'>;

// DamageType (C012 ADDED, INTENT-DAMAGE-TYPE-001) — 피해를 만드는 방식.
// 값은 둘뿐이고 한 타격은 정확히 하나를 가진다. 혼합 피해는 세계에 없다.
// 이것은 Actor 의 상태가 아니다 — 방식은 스킬이 지니고 모든 Actor 는 네 능력을 모두 지닌다.
export type DamageType = 'physical' | 'aura';

// 타입 대응표 (C012 ADDED, 설계 §4) — 방식이 고를 두 능력의 이름.
// 이 표가 대응의 단일 출처다. 규칙 코드에 방식별 분기를 따로 두지 않는다.
// C013 CHANGED — 표에 관통 한 칸이 더해진다. 관통도 같은 대응을 따르므로
// 대응의 단일 출처는 여전히 이 표 하나다 (INTENT-PENETRATION-MATCH-001).
export const DAMAGE_TYPE_STATS: Readonly<
  Record<
    DamageType,
    { offense: OffenseStatName; defense: DefenseStatName; penetration: PenetrationStatName }
  >
> = {
  physical: { offense: 'physicalAttack', defense: 'armor', penetration: 'armorPenetration' },
  aura: { offense: 'auraAttack', defense: 'resistance', penetration: 'resistancePenetration' },
};

export type OffenseStatName = 'physicalAttack' | 'auraAttack';
export type DefenseStatName = 'armor' | 'resistance';
export type PenetrationStatName = 'armorPenetration' | 'resistancePenetration'; // C013 ADDED

// C010 CHANGED — 스킬은 더 이상 혼자 피해를 정하지 않는다 (INTENT-SKILL-SCALING-001).
// damage 하나가 baseDamage(스킬 자체의 강함)와 attackRatio(공격 능력을 피해로 바꾸는 정도)로
// 나뉜다. 그래야 Actor 의 성장과 스킬의 성장을 따로 조절할 수 있다.
export interface SkillDefinition {
  baseDuration: number; // ActionSpeed 가 걸리기 전의 행동 길이
  baseDamage: number; // 스킬 자체의 강함 (C010 — 구 damage)
  attackRatio: number; // 공격 능력을 얼마나 피해로 바꾸는가 (C010 ADDED)
  cpCharge: number; // 한 번의 타격이 채우는 기력
  cpCost: number; // 한 번의 타격이 소모하는 기력
  damageType: DamageType; // 이 스킬이 피해를 만드는 방식 (C012 ADDED)
  // C019 ADDED — 이 기술의 구간 경계 (행동 진행도 0..1 의 비율).
  // 지금까지 모든 기술이 같은 전역 상수를 썼다 (collision.ts SWING_BEGIN · SWING_END).
  // 이제 기술이 지닌다 — 크게 거는 기술일수록 선딜이 길다 (INTENT-SKILL-PHASE-001).
  swingBegin: number; // 선딜이 끝나는 지점 — 여기부터 효과가 성립한다
  swingEnd: number; // 판정이 끝나는 지점 — 여기부터 끝까지가 후딜이다
  // C025 ADDED — 이 기술이 닿는 **모양** (INTENT-SKILL-SHAPE-001).
  // 지금까지 모든 기술이 같은 전역 상수를 썼다 (collision.ts SWING_ARC ·
  // SWING_BLADE_RADIUS) 하고, 닿는 길이는 그 몸의 교전 거리에서 왔다.
  // 이제 셋 다 기술이 지닌다 — C019 가 시간 축에 한 일을 공간 축에 한다.
  swingArc: number; // 훑는 전체 각 (rad) — 끝점은 +Arc/2 에서 −Arc/2 로 지나간다
  swingReach: number; // 몸 중심에서 끝점 중심까지의 거리
  swingTipRadius: number; // 끝점 충돌 구의 반경 — 닿음의 판정 반경 그 자체다
}

// C019 ADDED — 구간 경계의 기본값. 기술이 자기 값을 갖지만, 기본 기술 둘은 지금까지
// 세계가 쓰던 값 그대로다 (collision.ts 의 SWING_BEGIN · SWING_END 가 이 값이었다).
export const DEFAULT_SWING_BEGIN = 0.25;
export const DEFAULT_SWING_END = 0.75;

// C025 ADDED — 모양의 기본값. 기본 기술과 오라 기술은 지금까지 세계가 쓰던 값 그대로다
// (collision.ts 의 SWING_ARC · SWING_BLADE_RADIUS 가 이 값이었고, 닿는 길이는
// attackRange(2.0) − BladeRadius(0.7) = 1.3 이었다). **한 톨도 바뀌지 않는다.**
export const DEFAULT_SWING_ARC = (150 * Math.PI) / 180;
export const DEFAULT_SWING_REACH = 1.3;
export const DEFAULT_SWING_TIP_RADIUS = 0.7;

// C010 — 값은 재밸런싱이 아니라 C007 의 체감을 보존하는 방향으로 역산했다.
// 관찰자(Attack 40) → 자율 존재(Defense 30) 기준:
//   기본  (6 + 40×0.5)  = 26 × 100/130 = 20   ← C007 의 고정 20 과 같다
//   고급  (32 + 40×1.0) = 72 × 100/130 = 55   ← C007 의 고정 55 와 같다
// 계수가 큰 스킬일수록 공격 능력이 오를 때 더 크게 자란다 (빠른 기술은 낮게, 강한 기술은 높게).
// C012 — 기존 두 스킬은 설계 §9 의 이행 규칙대로 전부 physical 이다. 그 밖의 값은
// 한 톨도 바뀌지 않았으므로 물리 타격의 피해 결과가 C010 과 완전히 같다 (수용 기준 §14-8).
export const SKILL_DEFINITIONS: Readonly<Record<SkillKind, SkillDefinition>> = {
  // 기본 스킬 — 소모 없이 충전한다. 이것을 모아야 고급 스킬이 나간다.
  attack: {
    baseDuration: 0.6,
    baseDamage: 6,
    attackRatio: 0.5,
    cpCharge: 12,
    cpCost: 0,
    damageType: 'physical',
    swingBegin: DEFAULT_SWING_BEGIN, // C019 — 기본 기술은 한 톨도 바뀌지 않는다
    swingEnd: DEFAULT_SWING_END,
    swingArc: DEFAULT_SWING_ARC, // C025 — 모양도 마찬가지다 (03 BALANCE ①)
    swingReach: DEFAULT_SWING_REACH,
    swingTipRadius: DEFAULT_SWING_TIP_RADIUS,
  },
  // 고급 스킬 — 충전하면서 더 크게 소모한다 (붉은보석식 수지). 순수지 -22.
  'heavy-attack': {
    baseDuration: 0.9,
    baseDamage: 32,
    attackRatio: 1.0,
    cpCharge: 8,
    cpCost: 30,
    damageType: 'physical',
    // C019 — 큰 기술만 값이 바뀐다. 선딜 0.9 × 0.5 = 0.45초 — 사람이 보고 반응할 수 있는
    // 길이다 (기본 기술의 0.15초는 아니다). SwingEnd 도 함께 늦춘다: 0.75 로 두면 판정
    // 구간이 0.225초로 좁아져, 선딜을 길게 한 대가가 "칼이 잘 안 맞는다" 로 나타난다.
    // 후딜 0.135초는 남긴다 — 나간 뒤에도 잠깐 묶여야 큰 기술이 무겁다 (03 BALANCE ①).
    swingBegin: 0.5,
    swingEnd: 0.85,
    // C025 — 큰 기술만 모양이 움직인다. 좁고 멀리 — 정면 먼 것에 깊이 찌른다.
    // 선딜 0.45초를 치르고 얻는 것이 피해뿐이었다 (C019). 이제 치른 값에 대응하는
    // 성질이 생긴다: 기본 기술로는 닿지 않는 거리에 닿는 대신 옆을 훑지 못한다.
    // 값의 근거와 판별 자리는 03-world-semantic.md 의 BALANCE ②③④ 가 소유한다.
    swingArc: (40 * Math.PI) / 180,
    swingReach: 2.2,
    swingTipRadius: 0.55,
  },
  // 오라 스킬 (C012 ADDED) — 기본 스킬과 **모든 값이 같고 방식만 다르다**.
  // 일부러 그렇게 두었다: 값이 다르면 결과 차이가 방식 때문인지 값 때문인지 갈리지 않는다.
  // 이 층이 만드는 것은 세기의 차이가 아니라 선택 하나다 (INTENT-AURA-SKILL-001).
  'aura-strike': {
    baseDuration: 0.6,
    baseDamage: 6,
    attackRatio: 0.5,
    cpCharge: 12,
    cpCost: 0,
    damageType: 'aura',
    swingBegin: DEFAULT_SWING_BEGIN, // 기본 기술과 모든 값이 같다 (C012 의 뜻 그대로)
    swingEnd: DEFAULT_SWING_END,
    // C025 — 모양도 같다. 모양은 새로 생기는 값이므로 C012 의 뜻이 그대로 적용된다 —
    // 이 층이 만드는 차이는 세기도 모양도 아니라 **방식** 하나다.
    swingArc: DEFAULT_SWING_ARC,
    swingReach: DEFAULT_SWING_REACH,
    swingTipRadius: DEFAULT_SWING_TIP_RADIUS,
  },
};

// RULE-SKILL-PHASE-001 — Implements INTENT-SKILL-PHASE-001 (C019 ADDED)
// Input          Actor
// Preconditions  없음 — 어떤 Actor 에게도 답이 있다
// Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
// Result         none | startup | active | recovery
//
// 경계는 **기술에서 읽는다** — 전역 상수를 쓰지 않는다. 그래야 기술마다 다른 선딜이
// 성립한다. ActionCollider(semantic/collision.ts)와 **같은 경계**를 쓴다: 칼끝이 활성인
// 구간이 곧 active 다. 두 곳이 각자 경계를 가지면 "칼날이 지나는 중인데 아직 선딜" 같은
// 어긋남이 생긴다.
export type SkillPhase = 'startup' | 'active' | 'recovery';

export function skillPhase(actor: ActorState): SkillPhase | null {
  const action = actor.currentAction;
  if (!isSkillKind(action.kind)) return null; // 기술이 아닌 행동에는 구간이 없다
  const progress = actionProgress(action);
  if (progress === null) return null;

  const skill = skillDefinition(action.kind);
  if (progress < skill.swingBegin) return 'startup';
  if (progress < skill.swingEnd) return 'active';
  return 'recovery';
}

export function isSkillKind(kind: ActionKind): kind is SkillKind {
  return kind === 'attack' || kind === 'heavy-attack' || kind === 'aura-strike';
}

export function skillDefinition(kind: SkillKind): SkillDefinition {
  return SKILL_DEFINITIONS[kind];
}

/** 이 기술이 닿는 모양 (C025 ADDED) */
export interface SkillShape {
  arc: number; // 훑는 전체 각 (rad)
  reach: number; // 몸 중심에서 끝점 중심까지
  tipRadius: number; // 끝점 충돌 구의 반경
}

// RULE-SKILL-SHAPE-001 — Implements INTENT-SKILL-SHAPE-001 ·
//                                   INTENT-SHAPE-IS-A-VALUE-NOT-A-BRANCH-001 (C025 ADDED)
// Input          SkillKind
// Preconditions  없음 — 모든 기술에 답이 있다
// Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
// Result         Shape(Arc, Reach, TipRadius)
//
// 그 기술의 정의가 지닌 값을 그대로 돌려준다. **어느 기술인지를 묻는 분기가 이 함수
// 안에도 이것을 부르는 쪽에도 없다** — 정의를 찾는 열쇠로 이름을 쓰는 것과, 찾은 정의
// 대신 이름 자체를 판정 조건으로 쓰는 것은 다르다 (DC-SKILL-IS-COMBINATION-NOT-NAME).
//
// RULE-SKILL-PHASE-001 이 같은 정의에서 구간 경계를 읽는 것과 나란한 규칙이다.
export function skillShape(kind: SkillKind): SkillShape {
  const skill = SKILL_DEFINITIONS[kind];
  return { arc: skill.swingArc, reach: skill.swingReach, tipRadius: skill.swingTipRadius };
}

// RULE-ENGAGEMENT-REACHES-001 — Implements INTENT-REACH-BELONGS-TO-THE-SKILL-001 (C025 ADDED)
// Input          Actor.EngagementRange, 모든 SkillDefinition
// Preconditions  없음 — 세계가 서는 조건이다
// Transition     없음 — 세계 상태를 바꾸지 않는다 (정합 조건)
// Result         Holds | Violated(기술, 사유)
//
// 닿는 길이가 기술에서 오고 다가가는 거리가 몸에서 오므로, 둘이 어긋나면 스스로
// 판단하는 존재가 **영원히 닿지 못하는 자리에서 헛되이 휘두르는** 상태가 생긴다.
// 그것을 막는 것은 자율 존재를 똑똑하게 만드는 일이 아니라 값의 정합이다.
//
//     Reach − TipRadius  ≤  EngagementRange  ≤  Reach + TipRadius
//
// 상대의 몸 반경은 언제나 바깥을 넓히고 안쪽을 줄이므로 몸을 빼고 세운 이 조건은
// **보수적**이다. 조건이 서면 실제 접촉은 그보다 넉넉하다.
//
// 이 규칙은 값이 바뀔 때 깨지는 것이 목적이다 — 새 기술이나 새 값이 이것을 어기면
// 그것이 곧 "다가가는 거리를 함께 정하지 않았다" 는 신호다.
export function engagementReachViolations(engagementRange: number): SkillKind[] {
  const violated: SkillKind[] = [];
  for (const kind of Object.keys(SKILL_DEFINITIONS) as SkillKind[]) {
    const shape = skillShape(kind);
    if (engagementRange < shape.reach - shape.tipRadius) violated.push(kind);
    else if (engagementRange > shape.reach + shape.tipRadius) violated.push(kind);
  }
  return violated;
}

/**
 * 이 스킬이 피해 공식에 넘기는 위력 (C020 ADDED).
 *
 * C020 — 피해 공식의 입력이 SkillKind 에서 **위력 정의**로 넓어졌다. 스킬은 자기
 * 정의가 지닌 세 값을 넘겨 주고, 물건은 자기 정의가 지닌 세 값을 넘겨 준다.
 * 식은 한 글자도 바뀌지 않았으므로 같은 입력이면 이 Cycle 전후로 같은 값이 나온다
 * (DC-COMBAT-ONE-FORMULA).
 */
export function forceOfSkill(kind: SkillKind): Force {
  const skill = SKILL_DEFINITIONS[kind];
  return {
    baseDamage: skill.baseDamage,
    attackRatio: skill.attackRatio,
    damageType: skill.damageType,
  };
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

// 감쇄율 (파생, C010 ADDED / C012 CHANGED) — 이 방어 값이 들어온 피해를 몇 할로 남기는가.
// C012 — 인자가 Actor 가 아니라 **방어 값**이다. 방어가 둘이 되었으므로 어느 쪽을 쓸지는
// 타격의 방식이 정하며(DAMAGE_TYPE_STATS), 이 함수는 고른 값을 받기만 한다.
// 두 방어가 같은 식을 쓴다 — 방식마다 다른 감쇄식은 없다 (DC-COMBAT-ONE-FORMULA).
// 방어가 0 이상이므로 결과는 0 초과 1 이하다 (INTENT-TYPED-DEFENSE-001).
export function defenseMultiplier(defenseValue: number): number {
  return DEFENSE_CONSTANT / (DEFENSE_CONSTANT + defenseValue);
}

/**
 * World.PenetrationConstant (C013 ADDED) — 걷히는 몫을 정하는 세계 상수.
 * DefenseConstant 와 같은 값이지만 **다른 이름으로 둔다** — 한쪽을 조정할 때
 * 다른 쪽이 따라 움직이면 안 되기 때문이다. 결정론에 영향을 주므로 헤더 상수다 (CVar 아님).
 */
export const PENETRATION_CONSTANT = 100;

/**
 * 관통 앞에서 방어가 **남기는 비율** (C013 ADDED, INTENT-EFFECTIVE-DEFENSE-001).
 * 방어에 이미 걸려 있는 그 곡선을 그대로 쓴다 — 새 곡선을 만들지 않는다
 * (DC-COMBAT-ONE-FORMULA · R1 핵심 원칙).
 * 관통 0 이면 1 이고, 아무리 커도 0 에 이르지 않는다 — 방어를 통째로 걷어내는 값은 없다.
 */
export function penetrationRemainingRatio(penetrationValue: number): number {
  return PENETRATION_CONSTANT / (PENETRATION_CONSTANT + penetrationValue);
}

/**
 * EffectiveDefense (파생, C013 ADDED) — 걷히고 남은 방어. 감쇄식에 실제로 들어가는 값이다.
 * 걷히는 것은 정해진 양이 아니라 **몫**이므로 두꺼운 방어일수록 많이 걷히고,
 * 방어가 0 인 상대에게서는 걷어낼 것이 없어 아무 일도 일어나지 않는다.
 * 정수로 반올림하지 않는다 — 보이는 값과 계산에 쓰인 값이 어긋나면 안 된다
 * (defenseMultiplier 도 같은 이유로 정수가 아닌 채 관찰에 실린다).
 */
export function effectiveDefense(defenseValue: number, penetrationValue: number): number {
  return defenseValue * penetrationRemainingRatio(penetrationValue);
}

// Actor.DefenseShape (파생 상태, C012 ADDED, INTENT-DAMAGE-TYPE-OBSERVE-001) —
// 두 방어 중 어느 쪽이 더 단단한가. **세계가 계산해** 내놓는 판정이다 —
// 보는 이가 종류 이름이나 생김새로 약점을 짐작하지 않게 한다
// (DC-WORLD-OWNS-THE-SURFACE-LIST).
// 임계값을 두지 않는다 — 두 값의 대소만 본다. 임의 상수가 판정에 끼어들지 않는다.
export type DefenseShape = 'physical-tougher' | 'aura-tougher' | 'even';

// C023 CHANGED — 유효 값끼리 견준다. 걸린 것이 한쪽 방어만 올리면 무른 쪽이 바뀐다.
export function defenseShape(actor: ActorState): DefenseShape {
  const armor = effectiveStat(actor, 'armor');
  const resistance = effectiveStat(actor, 'resistance');
  if (armor > resistance) return 'physical-tougher';
  if (resistance > armor) return 'aura-tougher';
  return 'even';
}

/**
 * 유효 값을 물을 수 있는 값의 목록 (C-COMBAT-001 ADDED / C-GROWTH-001 CHANGED).
 *
 * 걸린 것이 보탤 수 있는 목록(item.ts ContributableStat — 여덟) · 배분이 보탤 수 있는
 * 목록(allocation.ts AllocatableStat — 다섯) · 단계가 보탤 수 있는 목록
 * (growth.ts GrowableStat — 넷)의 **합집합**이다. 셋은 서로 다른 목록이며 그것이
 * 정상이다 — 물건이 통찰을 보태지 않고, 배분이 관통을 움직이지 않으며, 성장은
 * 겨룸에서 읽히는 값에만 닿는다.
 *
 * **C-GROWTH-001 로 목록이 넓어지지 않는다** — GrowableStat 넷은 이미 ContributableStat
 * 안에 있다. 늘어나는 것은 합의 항이지 물을 수 있는 이름이 아니다.
 * ContributableStat 은 한 글자도 바뀌지 않는다 (C023 그대로).
 */
export type EffectiveStatName = ContributableStat | AllocatableStat | GrowableStat;

/**
 * RULE-EFFECTIVE-STATS-001 — Implements
 * INTENT-EFFECTIVE-IS-RECOMPUTED-NOT-ACCUMULATED-001 ·
 * INTENT-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-001 (C023 ADDED)
 *
 * Input          Actor, 능력 이름
 * Preconditions  없음 — 언제나 답할 수 있다
 * Transition     없음 (읽기 판정)
 * Result         Effective = Base + Σ 걸린 것들의 기여
 *
 * **저장하지 않는다.** 저장하면 Equipment 와 EffectiveStats 라는 두 개의 진실이 생기고
 * 둘을 맞추는 책임이 모든 변경 지점으로 흩어진다 — C022 가 UsedSlots 에 대해 내린 것과
 * 같은 판정이다 (03-world-semantic.md RATIONALE 1). 세는 비용은 자리 수에 비례하고
 * 자리 수는 고정이므로 상수다.
 *
 * **가감이 아니라 재계산이다.** 걸 때 더하고 풀 때 빼는 형태가 아니라 기본값에서 매번
 * 다시 센다. 그래서 "백 번 걸고 백 번 풀어도 값이 표류하지 않는다" 가 검사가 아니라
 * **구조**로 성립하고, 무엇이 어떤 순서로 걸렸는지가 결과를 바꾸지 않는다.
 *
 * 아무것도 걸지 않은 몸에서는 기본값과 같다 — 그러므로 이 함수가 들어오는 것만으로는
 * 지금까지의 어떤 결과도 달라지지 않는다 (회귀).
 *
 * 이 파일에 있는 이유: semantic 은 rules 를 import 하지 않으며(계층), 아래 세 함수와
 * rawDamage 가 semantic 안에서 이 값을 읽어야 한다. 순수 파생이므로 semantic 에 둔다.
 *
 * C-COMBAT-001 CHANGED — 셋이 바뀐다 (INTENT-ALLOCATION-ENTERS-THE-EFFECTIVE-VALUE-001).
 *
 *     항이 하나 는다   합에 **지금의 배분**이 더해진다. 걸린 것의 기여 옆에 서는
 *                      다른 항이지, 같은 항의 확장이 아니다
 *     바닥이 생긴다     배분이 음의 항을 낳으므로 결과가 0 아래로 내려가지 않게 막는다
 *     목록이 넓어진다   물을 수 있는 값이 여덟에서 아홉으로 — insight 가 든다
 *                      (INTENT-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-001 CHANGED)
 *
 * **새 공식이 아니다.** 피해도 방어도 감쇄도 지금의 한 공식을 그대로 지나며, 배분이
 * 하는 일은 그 공식이 읽는 입력값을 바꾸는 것뿐이다 (DC-COMBAT-ONE-FORMULA).
 * 그리고 고른 배분(balanced)에서는 세 항 중 셋째가 모두 0 이므로, 배분을 한 번도
 * 바꾸지 않은 몸의 값은 C023 까지와 한 톨도 다르지 않다 (DC-COMBAT-ONE-LAYER-AT-A-TIME).
 *
 * C-GROWTH-001 CHANGED — **항이 하나 더 는다** (INTENT-THE-STEP-ENTERS-THE-EFFECTIVE-VALUE-001).
 *
 *     넷째 항   합에 **지금 단계의 기여**가 더해진다. 걸린 것·배분 옆에 서는 또 하나의
 *               항이며, 저장되지 않고 쌓인 것에서 매번 다시 세어진다.
 *               **기본값은 이 일로 한 톨도 바뀌지 않는다** — 그래야 밖의 손
 *               (RULE-ATTRIBUTE-SET-001)과 안의 성장이 서로를 지우지 않는다
 *     목록은 그대로  물을 수 있는 이름이 늘지 않는다 (GrowableStat 넷은 이미 안에 있다)
 *     바닥도 그대로  성장의 항은 음수가 되지 않는다 — 자라는 것은 얻는 일이다
 *
 * 아무것도 쌓지 않은 몸(deeds 0)의 단계는 0 이고 그 기여는 어느 값에서도 0 이므로,
 * 이 항이 들어오는 것만으로는 지금까지의 어떤 결과도 달라지지 않는다 (회귀).
 */
export function effectiveStat(actor: ActorState, stat: EffectiveStatName): number {
  const contributions = equipmentContributions(actor.equipment) as Partial<
    Record<EffectiveStatName, number>
  >;
  const sum =
    actor[stat] +
    (contributions[stat] ?? 0) +
    allocationContribution(actor.allocation, stat) +
    growthContribution(actor.deeds, stat);
  // C-COMBAT-001 — 바닥. 배분이 처음으로 **음의 항**을 낳으므로 합이 0 아래로 갈 수 있다.
  // 음의 방어는 감쇄식을 1 초과로 만들어 "맞으면 더 아프다" 를 낳고, 음의 통찰은 문턱
  // 비교의 뜻을 흐린다. 그러므로 여기서 막는다.
  // **지금까지의 어떤 결과도 바꾸지 않는다** — 기본값이 0 이상이고 걸린 것의 기여가
  // 음이 아니므로 배분 전에는 언제나 0 이상이었다 (회귀 무변경).
  return Math.max(0, sum);
}

// 이 방식이 이 Actor 에게서 고르는 공격 능력의 값 (C012 ADDED / C023 CHANGED — 유효 값).
export function offenseStatValue(actor: ActorState, type: DamageType): number {
  return effectiveStat(actor, type === 'physical' ? 'physicalAttack' : 'auraAttack');
}

// 이 방식이 이 Actor 에게서 고르는 방어 능력의 값 (C012 ADDED / C023 CHANGED — 유효 값).
export function defenseStatValue(actor: ActorState, type: DamageType): number {
  return effectiveStat(actor, type === 'physical' ? 'armor' : 'resistance');
}

// 이 방식이 이 Actor 에게서 고르는 관통 능력의 값 (C013 ADDED / C023 CHANGED — 유효 값).
// 고르지 않은 관통은 그 타격에서 한 번도 읽히지 않는다 (INTENT-PENETRATION-MATCH-001).
export function penetrationStatValue(actor: ActorState, type: DamageType): number {
  return effectiveStat(actor, type === 'physical' ? 'armorPenetration' : 'resistancePenetration');
}

// 지금 이 Actor 가 이 스킬을 쓰면 나오는 공격 피해 (파생, C010 ADDED / C012 CHANGED).
// 방어를 적용하기 전의 값이다 — 최종 피해는 맞는 자가 정해져야 알 수 있다.
// C012 — 어느 공격 능력을 읽을지는 스킬의 방식이 정한다.
export function rawDamage(actor: ActorState, kind: SkillKind): number {
  const skill = skillDefinition(kind);
  return skill.baseDamage + offenseStatValue(actor, skill.damageType) * skill.attackRatio;
}

/**
 * 방식이 고른 능력 하나와, 그 값이 어떻게 그만큼이 되었는가 (C012 → C-COMBAT-001).
 *
 * `value` 는 판정이 실제로 읽은 **유효 값**이고, `fromAllocation` 은 그중 배분이
 * 보탠 몫이다. 음수일 수 있고 **0 이어도 실린다** — 터지지 않은 치명이 실리는 이유와
 * 같다 (C015): "이번 한 방에 배분이 아무것도 하지 않았다" 는 사실 역시 관찰이어야
 * 배분을 바꿀 근거가 생긴다. 관통에서는 언제나 0 이다 (어느 축에도 들지 않는다).
 */
export interface TypedStat {
  name: OffenseStatName | DefenseStatName | PenetrationStatName;
  value: number;
  fromAllocation: number;
  /**
   * C-GROWTH-001 ADDED — 그 값 중 **지금 단계가 보탠 몫**.
   *
   * `fromAllocation` 과 나란히 서며 같은 성질이다 — 0 이어도 실린다. 관통에서는
   * 언제나 0 이다 (자라지 않는 값이므로). 그럼에도 자리를 비우지 않는 이유는
   * 세 칸의 생김새가 같아야 화면이 갈래를 짓지 않기 때문이다.
   *
   * `fromAllocation` 과 달리 **음수가 되지 않는다** — 자라는 것은 얻는 일이지
   * 나누는 일이 아니다.
   */
  fromGrowth: number;
}

// 한 방의 크기가 어떻게 나왔는가 (C010 ADDED) — RULE-DAMAGE-CALCULATE-001 의 산출물.
// 저장하지 않는다. 계산이 낳고 StrikeEvent 가 싣는다.
// C011 CHANGED — 뒤의 두 항목이 더해진다. finalDamage 의 의미는 그대로다
// (공식이 내놓은 값 = 막지 않았다면 들어왔을 값).
export interface DamageBreakdown {
  /** 이 타격의 방식 (C012 ADDED) */
  damageType: DamageType;
  /**
   * 타격 시점 두 몸의 배분 (C-COMBAT-001 ADDED, INTENT-DAMAGE-BREAKDOWN-001 CHANGED).
   *
   * 같은 몸이 같은 기술로 다른 피해를 냈을 때 그 차이가 배분에서 왔다면, 그것이
   * 경위에서 읽혀야 한다. 읽히지 않으면 배분은 "가끔 숫자가 달라지는 일" 이 되고
   * 고르는 근거가 사라진다.
   */
  attackerAllocation: AllocationId;
  targetAllocation: AllocationId;
  /** 방식이 고른 공격 능력 (C012 ADDED) — 이름이 없으면 왜 이 값인지 알 수 없다 */
  offenseStat: TypedStat;
  baseDamage: number;
  attackContribution: number;
  rawDamage: number;
  /**
   * 방식이 고른 방어 능력 (C012 CHANGED — C010 의 targetDefense 를 대신한다).
   * C013 — 이 값의 의미를 **걷히기 전** 으로 고정한다. 상대가 지닌 방어와 같은 수이며,
   * 감쇄식에 실제로 들어간 값은 아래 effectiveDefense 가 가진다.
   * 값만으로는 무엇을 읽었는지 알 수 없게 되었다 — 30 이 물리 방어인지 오라 방어인지가
   * 결과를 완전히 가른다. 옛 이름은 별칭으로도 남기지 않는다 (설계 §9).
   */
  defenseStat: TypedStat;
  /**
   * 이 타격에서 작용한 관통 (C013 ADDED). 값이 0 이어도 실린다 —
   * 이름이 없으면 "왜 안 걷혔는가" 를 알 수 없다 (INTENT-DAMAGE-BREAKDOWN-001).
   */
  penetrationStat: TypedStat;
  /**
   * 걷힌 뒤의 방어 (C013 ADDED) — defenseMultiplier 가 실제로 읽은 값이다.
   * defenseStat.value 와 이 값이 같다는 것이 "이 상대에게는 통하지 않았다" 의 관찰이다.
   */
  effectiveDefense: number;
  defenseMultiplier: number;
  /**
   * 공식이 내놓은 값 — "막지 않았다면 들어왔을 값".
   * C015 CHANGED — 이제 이 값이 **증폭을 포함한다.** 뜻은 그대로이고 크기만 커질 수 있다.
   * 커지기 전 값은 critical.damageBeforeCritical 이 가진다 —
   * C013 이 defenseStat.value 와 effectiveDefense 를 나란히 둔 것과 같은 자리다.
   */
  finalDamage: number;
  /**
   * 이 타격이 크게 터졌는가와 그 경위 (C015 ADDED, INTENT-DAMAGE-BREAKDOWN-001).
   * **터지지 않은 타격에도 실린다** — 터지지 않았다는 사실 역시 관찰이어야 하고,
   * chance 가 0 인 몸과 이번에 운이 없었던 몸을 경위만으로 가를 수 있어야 한다.
   */
  critical: CriticalOutcome;
  /** 실제로 생명에서 빠진 값 (C011). 막지 않은 타격에서는 finalDamage 와 같다 */
  appliedDamage: number;
  /** 막기가 이 한 방에 한 일 (C011). 막지 않은 타격에는 실리지 않는다 */
  guard?: GuardOutcome;
}

/**
 * 계산이 내놓는 것 (C015 ADDED) — RULE-DAMAGE-CALCULATE-001 의 산출물.
 *
 * 그 계산은 **흔들림도 막기도 모른다.** 둘 다 계산 밖에서 결과값에 작용하며
 * (DC-COMBAT-ONE-FORMULA), 그 둘을 얹어 온전한 DamageBreakdown 을 만드는 것은
 * RULE-STRIKE-DAMAGE-001 이다.
 *
 * critical 을 이 형에서 뺀 것은 자리를 아끼려는 것이 아니라, 계산이 판정 이전의
 * 값이라는 것을 형이 말하게 하기 위해서다 — 중립값을 미리 채워 두면
 * "가능성 0" 과 "아직 판정하지 않았다" 가 같은 모양이 되어 경위를 읽을 수 없다.
 */
export type DamageCalculation = Omit<DamageBreakdown, 'critical' | 'guard'>;

// ── Critical (C015 ADDED) ────────────────────────────────────────────
//
// 이 세계에 처음으로 들어오는 **흔들림**이다. 지금까지 같은 조건은 언제나 같은 결과였고
// (R1 §6), 이 층이 그 성질에 정확히 한 구멍을 뚫는다 —
// Q11(b) 로 DC-COMBAT-PLAYER-CAUSALITY 가 REVISED 되며 허용한 단일 예외다.
// 명중·회피·피해량의 난수 금지는 그대로다.
//
// 구멍을 뚫되 세계 밖의 우연을 끌어오지 않는다. 원천은 세계가 지니는 상태이고
// (World.ChanceSeed · World.ChanceCursor — semantic/world-state.ts),
// 그 위의 순수 함수가 값을 낸다. 그래서 같은 세계를 같은 순서로 굴리면 같은 이야기가 나온다
// (INTENT-WORLD-CHANCE-001).
//
// 결정론에 영향을 주므로 상수도 형태도 헤더에 고정한다 (CVar 아님).

/** World.ChanceStep — 흔들림이 한 걸음에 건너뛰는 폭 (황금비 역수의 32비트 표현) */
export const CHANCE_STEP = 0x9e3779b9;

/**
 * ChanceAt(Seed, Cursor) — 그 자리의 흔들림 값 ∈ [0, 1) (C015 ADDED).
 *
 * 이 식은 세계의 법이다 — DefenseConstant 나 감쇄식과 같은 자리에 있다.
 * Seed 와 Cursor 가 같으면 언제나 같은 값이 나온다 (되짚을 수 있다).
 * Cursor 가 하나만 달라도 값이 전혀 다른 자리로 흩어진다 (미리 알 수 없다).
 * 범위가 `[0, 1)` 로 닫혀 있다는 것이 두 경계 규칙을 지탱한다 —
 * 1 은 나올 수 없고 0 은 나올 수 있다.
 */
export function chanceAt(seed: number, cursor: number): number {
  // 32비트 부호 없는 정수 연산. `>>> 0` 이 매 단계 그 폭을 강제한다.
  let x = (seed + Math.imul(cursor, CHANCE_STEP)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  return x / 4294967296;
}

/** 한 타격의 Critical 판정 결과 (파생 — 저장하지 않는다) */
export interface CriticalOutcome {
  /** 이 타격이 크게 터졌는가 */
  occurred: boolean;
  /** 판정에 실제로 쓰인 가능성 (0~1 로 묶인 뒤의 값). 0 이어도 실린다 */
  chance: number;
  /** 치는 자의 증폭 성질 (1 이상). 터지지 않아도 실린다 */
  multiplier: number;
  /** 커지기 전의 최종 피해. finalDamage 와 같으면 이 숫자는 흔들리지 않은 것이다 */
  damageBeforeCritical: number;
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
  /**
   * 무엇으로 — 이름표다 (C020 CHANGED). 스킬 이름뿐이던 자리에 **쓰인 것의 이름**이
   * 실릴 수 있다. 형태는 그대로인 의미 코드이며, 관찰하는 쪽은 모르는 값을 만나면
   * 받은 코드를 그대로 보여도 화면이 성립해야 한다.
   */
  skill: string;
  amount: number;
  breakdown: DamageBreakdown;
  position: WorldPosition;
  time: number;
}

/**
 * World.CancelEvents — 선딜 중에 끊겨 없던 일이 된 기술들 (C019 ADDED).
 *
 * World.StrikeEvents · World.UnharmedContacts 와 **나란한 자리**이며 같은 수명을 가진다
 * (STRIKE_EVENT_TTL). 셋은 섞이지 않는다 — 셋이 답하는 질문이 다르기 때문이다.
 *
 *     StrikeEvent      닿았고 해가 성립했다              피해 산정 경위를 지닌다
 *     UnharmedContact  닿았으나 관계가 막았다            산정이 없다 · 사유가 있다
 *     CancelEvent      맞은 쪽이 하려던 것이 사라졌다     산정이 없다
 *
 * 캔슬은 StrikeEvent 와 **함께** 온다 — 끊은 타격 자체는 성립한 타격이므로 피해도
 * 들어가고 경위도 실린다. 둘은 같은 순간의 다른 두 사실이다.
 */
export interface CancelEvent {
  attackerId: string; // 끊은 쪽
  targetId: string; // 끊긴 쪽 — 하려던 것이 사라진 존재
  skill: SkillKind; // 무엇이 끊겼는가. 큰 기술이 끊긴 것과 기본 기술이 끊긴 것은 다르다
  position: WorldPosition; // 끊긴 몸의 자리
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
  | 'physicalAttack'
  | 'auraAttack'
  | 'armor'
  | 'resistance'
  | 'armorPenetration'
  | 'resistancePenetration'
  | 'criticalChance'
  | 'criticalDamage'
  | 'insight'
  | 'deeds' // C-GROWTH-001
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
  // C010 ADDED / C012 CHANGED — 두 능력이 넷으로 갈린다. 하한이 0 인 것은 음수 방어
  // (피해 증폭)를 이 층에서 만들지 않기 위해서다. 증폭은 위층(Critical · Aura)의 일이다.
  { id: 'physicalAttack', min: 0, max: 100000 },
  { id: 'auraAttack', min: 0, max: 100000 },
  { id: 'armor', min: 0, max: 100000 },
  { id: 'resistance', min: 0, max: 100000 },
  // C013 ADDED — 관통 둘. 하한 0 은 "관통이 없다" 가 별도 상태가 아니라 값 0 이라는 뜻이며,
  // 음수 관통(방어를 두껍게 만드는 공격)은 이 층에서 만들지 않는다.
  { id: 'armorPenetration', min: 0, max: 100000 },
  { id: 'resistancePenetration', min: 0, max: 100000 },
  // C015 ADDED — Critical 둘. 기존 항목과 달리 **범위가 좁다.**
  // 가능성은 없음(0)과 가득함(1) 사이이고, 증폭은 키우는 쪽으로만 열린다(1 이상) —
  // 터진 한 방이 안 터진 한 방보다 작아지는 일은 세계에 없다.
  // 두 끝(0 · 1)이 모두 범위 안이라 "이 세계에 흔들림은 한 자리뿐" 을 직접 만들어 볼 수 있다.
  { id: 'criticalChance', min: 0, max: 1 },
  { id: 'criticalDamage', min: 1, max: 100 },
  // C016 ADDED — 통찰. 겨루는 힘이 아니라 아는 힘이며, 이 목록에 있는 다른 값들과 달리
  // 어떤 계산에도 들어가지 않는다. 상한 100 이 곧 "전부 읽는 눈" 이다 —
  // 세 문턱(30·60·90)을 모두 넘는 값이 범위 안에 있어야 "통찰만으로 전부 아는 몸" 을
  // 만들어 보고 그때 살펴봄이 거절되는 것까지 확인할 수 있다 (03 BALANCE).
  { id: 'insight', min: 0, max: 100 },
  // C-GROWTH-001 ADDED — 지금까지 한 일. 이 목록의 다른 값들과 달리 **그 자체로는
  // 아무 판정에도 들어가지 않고**, 단계를 세는 자리 하나에서만 읽힌다
  // (semantic/growth.ts growthLevel). 올리면 단계가 따라 오르고 겨루는 값 넷이 커진다.
  // **줄이는 쪽으로도 열린다** — 밖의 손은 되돌릴 수 있어야 디버그의 자리이며,
  // "쌓인 것은 줄지 않는다" 는 세계 **안**의 사정을 말한 것이다
  // (INTENT-WHAT-IS-KEPT-ONLY-GROWS-001).
  // 단계(growthLevel)는 이 목록에 들지 않는다 — 파생이므로 따로 밀어 올리면 세계에
  // 두 개의 진실이 생긴다 (INTENT-ENOUGH-IS-A-STEP-001).
  // 상한 100000 은 다른 수량 값들과 같다. 최대 단계 문턱(200)이 한참 안쪽이므로
  // 다섯 단계를 전부 만들어 볼 수 있다.
  { id: 'deeds', min: 0, max: 100000 },
  { id: 'moveSpeed', min: 0, max: 100 },
  { id: 'runSpeedMultiplier', min: 0.1, max: 10 },
  { id: 'actionSpeed', min: 0.1, max: 10 },
  { id: 'moveMode', values: ['walk', 'run'] },
];

export function findMutableAttribute(id: string): MutableAttribute | undefined {
  return MUTABLE_ATTRIBUTES.find((a) => a.id === id);
}
