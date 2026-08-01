// O1 검증 장면 — "붉은 장막 사냥꾼" 한 컷을 존재론 12타입만으로 적는다.
//
// 이 장면은 원문 §21(하나의 세계 요소가 생성되는 전체 예시)을 최소 규모로 줄인 것이다.
// 사냥꾼은 배고프고(의존), 채집이라는 길이 있으며(가능성), 그러려면 세계에 통로가
// 있어야 한다(요구). 약초는 실제로 마비독을 품지만(상태) 사냥꾼은 치유 효과라고
// 믿는다(주장). 행상과의 약속이 걸려 있고(약속), 채집은 소리를 냈다(사건 → 현상).
//
// 시나리오와 Lab 페이지가 같은 장면을 쓴다 — 터미널에서 본 것과 화면에서 본 것이
// 같은 값이어야 눈 검증이 성립한다.

import { deterministicId } from '@hkt/core/v1';
import type {
  Affordance,
  Claim,
  Commitment,
  Dependency,
  Entity,
  Event,
  OnticNode,
  Phenomenon,
  Possibility,
  Rule,
  State,
  Subject,
  WorldRequirement,
} from '@hkt/core/o1';

export const hunterId = deterministicId('subject', 'person', '사냥꾼 04');
export const merchantId = deterministicId('subject', 'person', '행상 02');
export const nestId = deterministicId('entity', 'place', '붉은 장막 둥지');
export const herbId = deterministicId('entity', 'material', '붉은 장막');

export const hunter: Subject = {
  kind: 'Subject',
  id: hunterId,
  subjectKind: 'person',
  name: '사냥꾼 04',
  partOfId: null,
};

export const nest: Entity = {
  kind: 'Entity',
  id: nestId,
  entityKind: 'place',
  name: '붉은 장막 둥지',
  locationId: null,
};

export const herb: Entity = {
  kind: 'Entity',
  id: herbId,
  entityKind: 'material',
  name: '붉은 장막',
  locationId: nestId,
};

export const hunger: State = {
  kind: 'State',
  id: deterministicId('state', hunterId, 'biological.hunger'),
  domain: 'biological',
  ofId: hunterId,
  path: 'hunger',
  value: 0.7,
};

/** 실제 사실 — 약초는 마비독을 품는다. */
export const toxin: State = {
  kind: 'State',
  id: deterministicId('state', herbId, 'biological.toxin'),
  domain: 'biological',
  ofId: herbId,
  path: 'toxin',
  value: '마비독',
};

export const toxinRule: Rule = {
  kind: 'Rule',
  id: deterministicId('rule', 'ecology', '붉은 장막 독성'),
  domain: 'ecological',
  name: '붉은 장막은 마비독을 품는다',
  when: ['붉은 장막이 둥지 반경에서 자란다'],
  then: ['섭취한 주체의 biological.paralysis 가 오른다'],
  axiomId: null,
};

export const forageEvent: Event = {
  kind: 'Event',
  id: deterministicId('event', 12, hunterId, 'forage'),
  tick: 12,
  name: '사냥꾼이 붉은 장막을 채집했다',
  actorId: hunterId,
  changedStateIds: [hunger.id],
  causeIds: [toxinRule.id],
};

export const rustle: Phenomenon = {
  kind: 'Phenomenon',
  id: deterministicId('phenomenon', forageEvent.id, 'sound'),
  channel: 'sound',
  causeEventId: forageEvent.id,
  placeId: nestId,
  intensity: 0.4,
  decaysAtTick: 15,
};

/** 믿는 사실 — 실제(마비독)와 어긋난다. 틀린 믿음이 곧 콘텐츠다. */
export const healingClaim: Claim = {
  kind: 'Claim',
  id: deterministicId('claim', hunterId, herbId, 'effect'),
  holderId: hunterId,
  aboutId: herbId,
  assertion: '붉은 장막은 치유 효과가 있다',
  confidence: 0.61,
  sourceIds: [rustle.id],
};

export const deal: Commitment = {
  kind: 'Commitment',
  id: deterministicId('commitment', hunterId, merchantId, 'herb-delivery'),
  fromId: hunterId,
  toId: merchantId,
  obligation: '붉은 장막 다섯 다발을 가져온다',
  reward: '은화 20닢',
  dueTick: 40,
  state: 'accepted',
  breachEffect: '행상이 신용을 낮추고 시장에 소문을 낸다',
};

export const gather: Affordance = {
  kind: 'Affordance',
  id: deterministicId('affordance', herbId, 'acquire'),
  providerId: herbId,
  action: 'acquire',
  requires: ['둥지 반경에 접근할 수 있다'],
  yields: ['붉은 장막 1다발'],
  cost: 2,
};

export const foodNeed: Dependency = {
  kind: 'Dependency',
  id: deterministicId('dependency', hunterId, 'resource', 'food'),
  subjectId: hunterId,
  dependencyKind: 'resource',
  targetId: null,
  desiredCondition: 'biological.hunger 가 0.3 이하로 유지된다',
  strength: 0.9,
  urgency: 0.6,
  substitutability: 0.7,
};

export const forageWay: Possibility = {
  kind: 'Possibility',
  id: deterministicId('possibility', foodNeed.id, 'fulfill', 'forage'),
  subjectId: hunterId,
  forDependencyId: foodNeed.id,
  direction: 'fulfill',
  atoms: ['find', 'acquire'],
  preconditionIds: [],
};

export const accessPath: WorldRequirement = {
  kind: 'WorldRequirement',
  id: deterministicId('requirement', forageWay.id, 'space'),
  requirementKind: 'space',
  fromPossibilityId: forageWay.id,
  description: '둥지 반경까지 은폐한 채 접근할 수 있는 통로',
  scope: 'local',
  weight: 0.5,
};

/** 장면 전체 — 12타입이 모두 한 번 이상 등장한다. */
export const HUNTER_SCENE: readonly OnticNode[] = [
  hunter,
  nest,
  herb,
  hunger,
  toxin,
  toxinRule,
  forageEvent,
  rustle,
  healingClaim,
  deal,
  gather,
  foodNeed,
  forageWay,
  accessPath,
];

/** 같은 장면의 결함판 — 무엇을 어겼고 어디서 걸려야 하는지를 함께 들고 다닌다. */
export interface BrokenNode {
  /** 무엇을 어겼는가 (한 문장) */
  readonly broke: string;
  readonly value: unknown;
  /** 걸려야 하는 `사유 경로` */
  readonly expected: string;
}

export const BROKEN_NODES: readonly BrokenNode[] = [
  {
    broke: '식별자를 손으로 지었다 — 유래가 없어 리플레이가 성립하지 않는다',
    value: { ...hunter, id: 'hunter_04' },
    expected: 'bad-field $.id',
  },
  {
    broke: '아무 상태도 바꾸지 않는 사건',
    value: { ...forageEvent, changedStateIds: [] },
    expected: 'bad-field $.changedStateIds',
  },
  {
    broke: '원인 사건이 없는 현상',
    value: { ...rustle, causeEventId: null },
    expected: 'bad-field $.causeEventId',
  },
  {
    broke: '비용 0 의 어포던스 — 공짜 가능성',
    value: { ...gather, cost: 0 },
    expected: 'bad-field $.cost',
  },
  {
    broke: '결핍을 가리키지 않는 가능성 — 가능성이 아니라 바람',
    value: { ...forageWay, forDependencyId: null },
    expected: 'bad-field $.forDependencyId',
  },
  {
    broke: '청구한 가능성이 없는 요구 — 근거 없는 세계 요구',
    value: { ...accessPath, fromPossibilityId: null },
    expected: 'bad-field $.fromPossibilityId',
  },
  {
    broke: '12타입 밖의 이름표',
    value: { kind: 'Monster', id: herbId },
    expected: 'unknown-kind $.kind',
  },
  {
    broke: '함수로만 존재하는 개념 — 직렬화할 수 없다',
    value: { ...toxinRule, evaluate: (): boolean => true },
    expected: 'not-serializable $',
  },
];
