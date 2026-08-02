// D0 검증 장면 — 붉은 장막 세계에서 사냥꾼 하나가 기댈 수 있는 것들.
//
// S3 까지는 개체가 무엇으로 무너지는지(Need)만 세웠다. 몰이꾼 04 는 허기로 무너지고,
// 그 허기는 자기 경계 안의 자리다. 여기서 밖을 본다 — **그 자리를 무엇이 채우는가.**
//
// 굶주림 하나 앞에 놓인 것이 식량뿐이라면 이 세계는 채집물과 몬스터를 배치한 흔한 MMORPG 다.
// 실제로 놓인 것은 열한 갈래다:
//
//   말린 고기(자원)   협곡(공간)      협곡 바닥의 온기(환경)   제 몸의 허기(신체)
//   붉은 장막의 어미(주체)            마을의 신뢰(관계)        마비독을 아는 것(정보)
//   고개 통행법(제도·규칙·의례 셋)    장막이 걷히는 주기(시간)
//
// 마지막이 이 장면의 핵심이다. **고개 통행법 하나가 세 종으로 걸린다** — 통행권으로 두르면
// 제도, 세계가 그렇게 작동한다는 사실로 기대면 규칙, 되풀이해야 유지되는 것으로 기대면 의례.
// 종을 정하는 것은 대상이 아니라 기대는 방식이다.

import { deterministicId, type Id } from '@hkt/core/v1';
import type { Claim, Commitment, Dependency, Entity, OnticBase, Rule, State, Subject } from '@hkt/core/o1';
import type { DependencyKind, KindGrounding } from '@hkt/core/d0';

const beaterId: Id = deterministicId('subject', 'person', '몰이꾼 04');
const priestId: Id = deterministicId('subject', 'person', '사제 09');
const traderId: Id = deterministicId('subject', 'person', '행상 21');

/** 자원 — 먹으면 없어진다. */
export const driedMeat: Entity = {
  kind: 'Entity',
  id: deterministicId('entity', 'material', '말린 고기'),
  entityKind: 'material',
  name: '말린 고기',
  locationId: null,
};

/** 공간 — 써도 없어지지 않는다. 다만 붐빈다. */
export const ravine: Entity = {
  kind: 'Entity',
  id: deterministicId('entity', 'place', '붉은 장막 협곡'),
  entityKind: 'place',
  name: '붉은 장막 협곡',
  locationId: null,
};

/** 환경 — 누구의 것도 아닌, 나를 둘러싼 값. */
export const ravineWarmth: State = {
  kind: 'State',
  id: deterministicId('state', ravine.id, 'physical.temperature'),
  domain: 'physical',
  ofId: ravine.id,
  path: 'temperature',
  value: 12,
};

/** 신체 — 내 몸의 값. 남의 허기로 내가 죽지 않는다. */
export const beaterHunger: State = {
  kind: 'State',
  id: deterministicId('state', beaterId, 'biological.hunger'),
  domain: 'biological',
  ofId: beaterId,
  path: 'hunger',
  value: 62,
};

/** 주체 — 그가 있어야 한다. 아무나로 바뀌면 이 의존이 아니다. */
export const veilMother: Subject = {
  kind: 'Subject',
  id: deterministicId('subject', 'god', '붉은 장막의 어미'),
  subjectKind: 'god',
  name: '붉은 장막의 어미',
  partOfId: null,
};

/** 관계 — 나와 그 사이의 값. 청구할수록 깎인다. */
export const villageTrust: State = {
  kind: 'State',
  id: deterministicId('state', traderId, 'relational.trust'),
  domain: 'relational',
  ofId: traderId,
  path: `trust.${beaterId}`,
  value: 0.55,
};

/** 정보 — 나눠 줘도 내가 잃지 않는다. */
export const poisonClaim: Claim = {
  kind: 'Claim',
  id: deterministicId('claim', beaterId, '붉은 잎'),
  holderId: beaterId,
  aboutId: deterministicId('entity', 'material', '붉은 잎 약초'),
  assertion: '붉은 잎 약초는 마비독이다',
  confidence: 0.8,
  sourceIds: [],
};

/** 하나의 규칙 — 이것이 제도로도, 규칙으로도, 의례로도 걸린다. */
export const passageLaw: Rule = {
  kind: 'Rule',
  id: deterministicId('rule', 'institutional', '고개 통행법'),
  domain: 'institutional',
  name: '고개 통행법',
  when: ['통행권 없는 자가 고개에 들어선다'],
  then: ['이동이 막히고 현상금이 걸린다'],
  axiomId: null,
};

/** 의례에 걸린 약속 — 되풀이가 끊기면 위반 결과가 남는다. */
export const altarVow: Commitment = {
  kind: 'Commitment',
  id: deterministicId('commitment', priestId, '제단 서약'),
  fromId: priestId,
  toId: veilMother.id,
  obligation: '열흘마다 제단에 제물을 올린다',
  reward: '어미의 숨이 협곡을 덮는다',
  dueTick: 10,
  state: 'accepted',
  breachEffect: '숭배량이 마르고 제단의 앵커가 흐려진다',
};

/** 어느 종도 받지 않는 원소 — 사건은 지나간 일이지 기댈 대상이 아니다. */
export const veilLifted: OnticBase = {
  kind: 'Event',
  id: deterministicId('event', 'veil', '장막이 걷혔다'),
};

/** 굶주림 하나 앞에 놓인 대상들 — 화면·시나리오가 함께 쓴다. */
export interface TargetCase {
  /** 무엇인가 (화면 표기) */
  readonly label: string;
  readonly element: OnticBase;
  /** 몰이꾼 04 에게 이것이 무엇인지 한 줄 */
  readonly why: string;
}

export const TARGET_CASES: readonly TargetCase[] = [
  { label: '말린 고기', element: driedMeat, why: '먹으면 허기가 내려간다 — 먹으면 없어진다' },
  { label: '붉은 장막 협곡', element: ravine, why: '거기 있어야 사냥이 시작된다' },
  { label: '협곡 바닥의 온기', element: ravineWarmth, why: '식으면 장막벌레가 굳어 사냥감이 사라진다' },
  { label: '제 몸의 허기', element: beaterHunger, why: '내 몸의 값 — 무너짐이 일어나는 자리 그 자체다' },
  { label: '붉은 장막의 어미', element: veilMother, why: '어미가 죽으면 장막도 벌레도 없다' },
  { label: '행상의 신뢰', element: villageTrust, why: '신뢰가 남아야 외상으로 고기를 얻는다' },
  { label: '마비독을 아는 것', element: poisonClaim, why: '모르면 굶주림을 독으로 갚는다' },
  { label: '고개 통행법', element: passageLaw, why: '고개 너머 마을로 가려면 이 법이 나를 지나가게 해야 한다' },
  { label: '제단 서약', element: altarVow, why: '서약이 끊기면 어미의 숨도 끊긴다' },
  { label: '장막이 걷혔다(사건)', element: veilLifted, why: '지나간 일이다 — 기댈 대상이 아니다' },
];

/** 몰이꾼 04 가 실제로 선언한 의존 — 이 선언들이 D0 관문을 지난다. */
export interface DependencyCase {
  readonly label: string;
  readonly dependency: Dependency;
  /** 대상 원소. 종류로만 걸린 의존이면 null */
  readonly target: OnticBase | null;
}

const dependency = (
  name: string,
  dependencyKind: DependencyKind,
  targetId: Id | null,
  desiredCondition: string,
  strength: number,
  urgency: number,
  substitutability: number,
): Dependency => ({
  kind: 'Dependency',
  id: deterministicId('dependency', beaterId, name),
  subjectId: beaterId,
  dependencyKind,
  targetId,
  desiredCondition,
  strength,
  urgency,
  substitutability,
});

export const DEPENDENCY_CASES: readonly DependencyCase[] = [
  {
    label: '아무 식량이든 (종류로만 걸린다)',
    dependency: dependency('식량', 'resource', null, '먹을 것의 재고가 3 이상이다', 0.9, 0.7, 0.8),
    target: null,
  },
  {
    label: '이 협곡이어야 한다',
    dependency: dependency('사냥터', 'space', ravine.id, '협곡 어귀에 있다', 0.6, 0.3, 0.2),
    target: ravine,
  },
  {
    label: '통행법을 제도로 기댄다',
    dependency: dependency('통행권', 'institution', passageLaw.id, '고개 통행권을 지닌다', 0.5, 0.2, 0.4),
    target: passageLaw,
  },
  {
    label: '통행법을 세계의 작동으로 기댄다',
    dependency: dependency('통행 규칙', 'rule', passageLaw.id, '통행법이 아직 성립한다', 0.4, 0.1, 0.0),
    target: passageLaw,
  },
];

/** 설 수 없는 선언들 — 각자의 사유로 거부되어야 한다. */
export interface BrokenCase {
  readonly broke: string;
  readonly expected: string;
  readonly kind: DependencyKind;
  readonly target: OnticBase | null;
}

export const BROKEN_CASES: readonly BrokenCase[] = [
  {
    broke: '자원이라 적고 장소를 가리켰다',
    expected: 'kind-target-mismatch',
    kind: 'resource',
    target: ravine,
  },
  {
    broke: '공간이라 적고 먹을 것을 가리켰다',
    expected: 'kind-target-mismatch',
    kind: 'space',
    target: driedMeat,
  },
  {
    broke: '환경이라 적고 제 몸의 허기를 가리켰다 — 밖의 상태와 내 몸의 상태는 다른 종이다',
    expected: 'off-domain-state',
    kind: 'environment',
    target: beaterHunger,
  },
  {
    broke: '신체라 적고 협곡의 온기를 가리켰다 — 반대 방향의 같은 착각',
    expected: 'off-domain-state',
    kind: 'body',
    target: ravineWarmth,
  },
  {
    broke: '관계라 적고 믿음을 가리켰다 — 믿음은 나와 그 사이의 값이 아니다',
    expected: 'kind-target-mismatch',
    kind: 'relationship',
    target: poisonClaim,
  },
  {
    broke: '주체라 적고 아무나로 걸었다 — 그가 아니어도 되면 주체 의존이 아니다',
    expected: 'kind-target-mismatch',
    kind: 'subject',
    target: null,
  },
  {
    broke: '시간에 대상을 달았다 — 아무도 그것을 채우지 못한다',
    expected: 'unwanted-target',
    kind: 'time',
    target: ravine,
  },
  {
    broke: '지나간 사건에 기댔다 — 어느 종도 받지 않는다',
    expected: 'kind-target-mismatch',
    kind: 'information',
    target: veilLifted,
  },
  {
    broke: '11종 밖의 종을 지어냈다',
    expected: 'undefined-kind',
    kind: 'supply' as DependencyKind,
    target: driedMeat,
  },
];

/** 설 수 없는 걸림들 — 분류표 자체가 무너지는 자리. */
export interface BrokenGrounding {
  readonly broke: string;
  readonly expected: string;
  readonly patch: (grounded: readonly KindGrounding[]) => readonly KindGrounding[];
}

const patched = (kind: DependencyKind, patch: Partial<KindGrounding>) =>
  (grounded: readonly KindGrounding[]): readonly KindGrounding[] =>
    grounded.map((entry) => (entry.kind === kind ? { ...entry, ...patch } : entry));

export const BROKEN_GROUNDINGS: readonly BrokenGrounding[] = [
  {
    broke: '의례가 아무 자리도 읽지 않는다 — 읽을 자리가 없으면 결핍도 없다',
    expected: 'unreadable-kind',
    patch: patched('ritual', { readDomains: [] }),
  },
  {
    broke: '자원이 세계의 자리와 틱을 함께 읽는다',
    expected: 'unreadable-kind',
    patch: patched('resource', { readsClock: true }),
  },
  {
    broke: '신체가 9영역 밖의 자리를 읽는다',
    expected: 'phantom-domain',
    patch: patched('body', { readDomains: ['flesh' as never] }),
  },
  {
    broke: '주체가 O1 12타입 밖의 대상을 받는다',
    expected: 'phantom-target-kind',
    patch: patched('subject', { targetKinds: ['Person' as never] }),
  },
  {
    broke: '공간이 사물을 받으면서 어느 사물인지 적지 않았다',
    expected: 'phantom-target-kind',
    patch: patched('space', { targetEntityKinds: [] }),
  },
  {
    broke: '시간이 가리킬 대상을 들었다',
    expected: 'unwanted-target',
    patch: patched('time', { targetKinds: ['Subject'] }),
  },
  {
    broke: '정보가 무엇을 가리키는지 적지 않았다',
    expected: 'targetless-kind',
    patch: patched('information', { targetKinds: [] }),
  },
  {
    broke: '제도의 걸림이 통째로 빠졌다 — 제도 영역을 아무도 읽지 않게 된다',
    expected: 'unreadable-kind',
    patch: (grounded) => grounded.filter((entry) => entry.kind !== 'institution'),
  },
  {
    broke: '규칙이 왜 그렇게 걸리는지 적지 않았다',
    expected: 'unsourced-kind',
    patch: patched('rule', { note: '' }),
  },
];
