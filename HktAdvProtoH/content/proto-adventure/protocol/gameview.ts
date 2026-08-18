// proto-adventure 팩의 GameView 확장 (P2 ADDED) — World → View 계약의 팩 소유분.
//
// 봉투(entities/interactions/hud/commands/outcomes 구조)는 engine/protocol-core 가
// 소유하고, 이 세계의 의미(생명·능력치·타격 경위·스킬 profile)는 여기가 소유한다.
// 팩의 world 가 채우고 팩의 view 가 읽으므로 타입 안전은 팩 안에서 완결된다.
// 구체 계약의 원본은 cycles/<CycleId>/04-gameview.spec.yaml 이다.

import type {
  EntityView as CoreEntityView,
  GameViewSnapshot as CoreGameViewSnapshot,
  GameViewPosition,
  InteractionView as CoreInteractionView,
} from '../../../engine/protocol-core/gameview';

// 봉투 타입은 그대로 다시 내보낸다 — 팩 코드는 자기 protocol 하나만 바라본다.
export type {
  BodyView,
  CommandDomainKind,
  CommandDomainOptionView,
  CommandDomainView,
  CommandParameterView,
  CommandView,
  DebugAuthorityView,
  GameViewPosition,
  HudItemView,
  ObserverView,
  RequestOutcomeView,
  SwingView,
} from '../../../engine/protocol-core/gameview';

// 생명 (C007) — 누구의 것이든 관찰된다. 몸 위 기본 표시가 이 값이다.
export interface VitalityView {
  health: number;
  healthMaximum: number;
  downed: boolean; // 참이면 더 이상 행동하지 않고 타격 대상도 되지 않는다
}

// 그 밖의 모든 속성 (C007 R2) — 세계는 어떤 속성도 숨기지 않는다.
// 실린다고 해서 늘 화면에 띄우라는 뜻은 아니다. 표시 기본값은 View 가 정한다.
export interface AttributesView {
  energy: number;
  energyMaximum: number;
  moveMode: string; // walk | run
  control: string; // player | autonomous
  tempoStats: {
    moveSpeed: number;
    runSpeedMultiplier: number;
    actionSpeed: number;
  };
  modifiers: {
    energyCharge: number;
    energyConsume: number;
    moveSpeed: number;
    actionSpeed: number;
  };
  // 전투 능력치 (C010 ADDED / C012 CHANGED) — 한 방의 크기를 정하는 **네** 값.
  // 어느 둘을 읽을지는 그 타격의 방식이 정한다. 네 값 모두 실린다 —
  // 고르지 않은 쪽도 보여야 "저쪽으로 쳤다면 어땠을까" 를 견줄 수 있다.
  // 두 Multiplier 는 파생값이다. 방어가 체감식이라 수치만 보고는 효과를 알 수 없어
  // "그래서 몇 할로 받는가" 를 함께 싣는다 (0 초과 1 이하 — 0 이 되지 않는다).
  // C013 CHANGED — 관통 둘이 더해져 여섯 값이다. 관통은 공격 쪽 능력이지만
  // **피해를 키우는 값이 아니다** — 하는 일은 상대 방어의 값어치를 떨어뜨리는 것뿐이다.
  combatStats: {
    physicalAttack: number;
    auraAttack: number;
    armor: number;
    resistance: number;
    armorPenetration: number;
    resistancePenetration: number;
    armorMultiplier: number;
    resistanceMultiplier: number;
  };
  // 이 존재의 두 방어가 **보는 이의 관통에게** 얼마로 읽히는가 (C013 ADDED).
  // **세계가 계산한 값이다.** View 가 combatStats 와 자기 관통을 곱해
  // 만들어내서는 안 된다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
  versusObserver: {
    armor: number;
    resistance: number;
    armorMultiplier: number;
    resistanceMultiplier: number;
  };
  // 두 방어 중 어느 쪽이 더 단단한가 (C012 ADDED) — physical-tougher | aura-tougher | even.
  // **세계가 계산한 판정이다** (DC-WORLD-OWNS-THE-SURFACE-LIST).
  defenseShape: string;
  // 막기 (C011 ADDED) — 모든 존재에 실린다. guarding 은 state 와 별개다.
  guard: {
    guarding: boolean;
    broken: boolean;
  };
}

// 이 팩의 존재 관찰 — 봉투의 EntityView 에 생명과 속성이 더해진다.
export interface EntityView extends CoreEntityView {
  vitality?: VitalityView; // C007 — character 에만 실린다
  attributes?: AttributesView; // C007 R2 — character 에만 실린다
}

// 스킬 interaction 의 profile (C007 → C012) — 쓰기 전에 알 수 있어야 하는 값.
export interface SkillProfileView {
  baseDamage: number;
  attackRatio: number;
  rawDamage: number;
  charge: number;
  cost: number;
  damageType: string; // physical | aura
}

export interface InteractionView extends CoreInteractionView {
  profile?: SkillProfileView;
}

// 방식이 고른 능력 하나 (C012 ADDED) — 무엇을 얼마로 읽었는가.
export interface TypedStatView {
  // physicalAttack | auraAttack | armor | resistance |
  // armorPenetration | resistancePenetration (C013)
  name: string;
  value: number;
}

// 막기가 이 한 방에 한 일 (C011 ADDED).
// blocked 와 broken 은 동시에 참이 되지 않는다 — 막았거나 무너졌거나 둘 중 하나다.
export interface GuardOutcomeView {
  blocked: boolean;
  broken: boolean; // 이 타격에 방어가 무너졌다 — 피해는 줄지 않았고 방어는 사라졌다
  cpPaid: number; // 생명 대신 치른 기력 (무너졌으면 0)
  prevented: number; // 막아서 덜 들어간 값 = finalDamage - appliedDamage
}

// 한 방의 크기가 어떻게 나왔는가 (C010 ADDED) — 세계는 결과와 함께 그 경위를 낸다.
export interface DamageBreakdownView {
  damageType: string; // C012 — 이 타격의 방식 (physical | aura)
  offenseStat: TypedStatView; // C012 — 방식이 고른 공격 능력
  baseDamage: number; // 스킬 자체의 강함
  attackContribution: number; // 고른 공격 능력이 더한 몫 = OffenseStat × AttackRatio
  rawDamage: number; // baseDamage + attackContribution
  // C013 — 걷히기 전 값 (상대가 지닌 방어와 같은 수). 감쇄식에 실제로 들어간 값은
  // effectiveDefense 가 가진다.
  defenseStat: TypedStatView;
  penetrationStat: TypedStatView; // C013 — 이 타격에서 작용한 관통. 0 이어도 실린다
  effectiveDefense: number; // C013 — 걷힌 뒤의 방어. defenseMultiplier 가 실제로 읽은 값
  defenseMultiplier: number; // 걷힌 방어가 남긴 비율 (0 초과 1 이하)
  finalDamage: number; // 공식이 내놓은 값 — "막지 않았다면 들어왔을 값"
  appliedDamage: number; // C011 — 실제로 생명에서 빠진 값. amount 와 언제나 같다
  guard?: GuardOutcomeView; // C011 — 막지 않은 타격에는 실리지 않는다
}

// 한 번의 타격이 낳은 결과 (C007) — 맞은 자리에서 잠시 드러났다가 사라진다.
//   amount === breakdown.appliedDamage    항상 참
//   amount === breakdown.finalDamage      막지 않은 타격에서만 참
export interface StrikeEventView {
  attackerId: string;
  targetId: string;
  skill: string; // attack | heavy-attack | aura-strike
  amount: number;
  at: GameViewPosition; // 맞은 몸의 중심
  since: number; // 일어난 세계 시각 — 얼마나 지났는지 판단용
  breakdown: DamageBreakdownView; // C010 ADDED
}

// 이 팩의 관찰 결과 — 봉투에 타격 결과가 더해지고, 존재/interaction 이 팩 형으로 좁혀진다.
export interface GameViewSnapshot extends CoreGameViewSnapshot {
  entities: EntityView[];
  interactions: InteractionView[];
  strikes: StrikeEventView[]; // C007 ADDED
}
