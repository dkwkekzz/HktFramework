import type { EntityId } from '@hkt/k0-entity-state';

/**
 * S1 의 계약 타입.
 *
 * 원문 「10」 S1 은 "초기 프로토타입에서는 실제 원자 시뮬레이션이 아니라 **콘텐츠에 필요한 거시
 * 상태만** 구현한다"고 못 박는다. 그래서 여기에는 분자도 열역학도 없다. 원문의 포함 항목
 * (질량·온도·손상·허기·질병·개체군·먹이 관계)이 그대로 컴포넌트가 되고, 그것들을 바꾸는 것은
 * S1 의 코드가 아니라 **데이터로 적힌 자연 법칙**(K2 규칙)이다.
 */

/** 원문 「10」 S1 의 포함 항목이 그대로 컴포넌트 이름이 된다. */
export const NATURAL_COMPONENT = {
  /** 질량 (kg) */
  MASS: 'mass',
  /** 온도 (℃) */
  TEMPERATURE: 'temperature',
  /** 손상 (상처 수) */
  DAMAGE: 'damage',
  /** 허기 (0 이 배부름) */
  HUNGER: 'hunger',
  /** 질병 (병세) */
  DISEASE: 'disease',
  /** 개체군 (마릿수·포기 수) */
  POPULATION: 'population',
  /** 먹이 관계 — 무엇을 먹는가 */
  DIET: 'diet',
  /** 서식지 — 얼마나 멀리까지 먹으러 가는가 */
  HABITAT: 'habitat',
} as const;

/**
 * 자연 법칙이 다루는 의도의 동사.
 *
 * 자연에는 "의도"가 없지만, K2 가 세계를 바꾸는 유일한 문이 의도이고 K3 이 그 문을 지날 때만
 * 사건을 남긴다(GI-01). 그래서 **시간의 흐름 자체를 의도로 적는다** — 상처가 곪는 것도,
 * 체온이 식는 것도, 굶는 것도 원인이 있는 사건이 된다.
 */
export const NATURAL_VERB = {
  /** 상처와 병이 하루만큼 진행한다 */
  FESTER: 'fester',
  /** 체온이 하루만큼 움직인다 */
  SETTLE: 'settle',
  /** 먹이가 사정권에 있다 — 대상을 달고 온다 */
  HUNT: 'hunt',
  /** 먹을 것이 없다 */
  ENDURE: 'endure',
} as const;

export type NaturalVerb = (typeof NATURAL_VERB)[keyof typeof NATURAL_VERB];

/**
 * 먹이 관계 한 줄 — **누가 무엇을 먹을 수 있는가**.
 *
 * 원문 「10」 S1 의 선행에 S0 이 있는 이유가 여기다. 먹이 관계는 종만으로 정해지지 않는다.
 * 늑대가 사슴을 먹는다는 사실과, **지금 그 사슴이 사정권 안에 있는가**는 다른 이야기다.
 */
export interface FoodLink {
  consumer: EntityId;
  prey: EntityId;
  /** 두 상자 사이의 거리 (m) */
  distance: number;
  /** 먹이의 남은 개체군 */
  available: number;
  /** 이 먹이를 고른 이유 */
  reason: string;
}

/** 먹이를 찾지 못한 이유 — 없는 것과 멀어서 못 가는 것을 구분한다. */
export interface FoodGap {
  consumer: EntityId;
  code: 'E_NO_DIET' | 'E_NO_PREY_IN_WORLD' | 'E_PREY_OUT_OF_HABITAT' | 'E_PREY_EXHAUSTED';
  message: string;
  /** 세계에는 있으나 이 주체가 먹을 수 없는 후보들 (오름차순) */
  rejected: EntityId[];
}

export interface FoodWeb {
  links: FoodLink[];
  gaps: FoodGap[];
}

/** 한 틱의 자연 상태 단면. 대표 검증은 이 시계열을 읽는다. */
export interface NaturalSample {
  tick: number;
  /** 실체 id → 개체군 (오름차순 키) */
  population: Record<EntityId, number>;
  hunger: Record<EntityId, number>;
  mass: Record<EntityId, number>;
  disease: Record<EntityId, number>;
  temperature: Record<EntityId, number>;
  /** 이 틱에 실제로 성립한 먹이 관계 */
  links: FoodLink[];
  /** 이 틱에 적용된 법칙 id (오름차순·중복 없음) */
  appliedLaws: string[];
  /** 이 틱에 거부된 의도 수 — 법칙이 허락하지 않은 변화다 */
  rejected: number;
}

/**
 * 개체군이 **정점에서 내려온 뒤 다시 돌아가지 못한** 시점.
 *
 * "처음으로 한 마리 줄어든 틱"으로 재면 안 된다. 살아 있는 개체군은 잡아먹히고 새끼를 치며
 * 오르내리므로, 첫 감소는 그저 그날의 물결일 뿐이다. 대표 검증이 말하는 "감소"는 **돌아오지 못하는
 * 감소**이고, 그것은 정점을 마지막으로 찍은 다음 틱부터다.
 */
export interface DeclineMark {
  entity: EntityId;
  start: number;
  peak: number;
  end: number;
  /** 정점을 마지막으로 찍은 틱 */
  peakTick: number | null;
  /** 정점에서 내려와 끝까지 돌아가지 못한 첫 틱. 끝까지 정점이면 null */
  declineTick: number | null;
}
