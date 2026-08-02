// S0 검증 장면 — 붉은 장막 세계에 서는 주체 다섯.
//
// O0 장면은 "무엇이 세계에 설 수 있는가"(정의)를 적었다. 여기서는 그 정의에서 **실제로
// 태어난 개체**를 적는다. 사냥꾼 한 명, 장막벌레 군집 하나, 채집 길드 하나, 협곡 국가 하나,
// 붉은 장막의 어미 하나 — 사람·생물·조직·국가·신 다섯 종류가 하나씩이다.
//
// 다섯이 세계에 걸리는 방식은 전부 다르다. 사냥꾼은 몸으로, 길드는 구성원으로, 국가는
// 영역과 구성원으로, 어미는 앵커로. 감지도 전부 다르다 — 빛 / 냄새 / 보고 / 보고 / 의념 잔향.
// 그런데도 다섯 모두 같은 다섯 질문에 답한다. 그것이 S0 이 주장하는 "공통 인터페이스" 다.
//
// O0 의 종 넷(사냥꾼·장막벌레·어미·길신)을 그대로 쓰고, 조직·국가 종 둘을 여기서 더한다 —
// 원문 S0 이 다섯 종류를 요구하는데 O0 장면에는 조직·국가가 없었기 때문이다. 더한 둘도
// O0 공리를 그대로 지난다 (validateDefinition 이 시나리오에서 확인한다).

import { deterministicId, type Id } from '@hkt/core/v1';
import { axiomId, type Definition, type SpeciesDefinition } from '@hkt/core/o0';
import {
  buildSubject,
  subjectIdOf,
  type Boundary,
  type Need,
  type PerceptionProfile,
  type SubjectProfile,
  type SubjectSpec,
  type ValueTarget,
} from '@hkt/core/s0';

import {
  herbId,
  hunterSpecies,
  inscribeId,
  motherGodSpecies,
  nestId,
  peddlersId,
  toxinReadId,
  veilId,
  veilWorm,
  VEIL_DEFINITIONS,
  villagersId,
} from './o0-veil-definitions.ts';

export { herbId, nestId, villagersId, peddlersId };

/** 사냥꾼의 몸 · 길드 창고 · 협곡의 수도 — 경계가 가리키는 사물들. */
export const hunterBodyId: Id = deterministicId('entity', 'body', '사냥꾼 04의 몸');
export const canyonId: Id = deterministicId('entity', 'place', '국경 협곡');

/** 조직 종 — 채집 길드. 몸이 없고 구성원으로만 세계에 닿는다. */
export const guildSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: deterministicId('rule', 'species', '채집 결사'),
  definitionKind: 'species',
  domain: 'economic',
  name: '채집 결사',
  when: ['같은 것을 캐는 자들이 창고 하나를 함께 쓴다'],
  then: ['창고의 재고로 유지되고, 마을의 신뢰만큼 채집권을 얻는다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'organization',
  alive: true,
  slots: [
    { domain: 'economic', path: 'stock.{entity}' },
    { domain: 'psychic', path: 'conviction' },
  ],
  originId: null,
};

/** 국가 종 — 협곡을 낀 나라. 영역과 구성원 둘 다로 정의된다. */
export const nationSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: deterministicId('rule', 'species', '협곡을 낀 나라'),
  definitionKind: 'species',
  domain: 'transcendent',
  name: '협곡을 낀 나라',
  when: ['한 무리가 같은 땅에서 같은 법을 오래 지킨다'],
  then: ['그 땅에 정당성이 서고, 정당성이 마르면 나라는 조직으로 흩어진다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'nation',
  alive: true,
  slots: [
    { domain: 'transcendent', path: 'legitimacy' },
    { domain: 'psychic', path: 'conviction' },
  ],
  originId: null,
};

/** S0 가 쓰는 정의 전부 — O0 의 일곱 + 조직·국가 종 둘. */
export const S0_DEFINITIONS: readonly Definition[] = [
  ...VEIL_DEFINITIONS,
  guildSpecies,
  nationSpecies,
];

/** 개체 ID — 종과 이름표에서 나온다. 장면 밖에서도 같은 값으로 가리킬 수 있게 미리 편다. */
export const hunterId = subjectIdOf(hunterSpecies.id, '사냥꾼 04');
export const wormsId = subjectIdOf(veilWorm.id, '둥지의 장막벌레 군집');
export const guildId = subjectIdOf(guildSpecies.id, '아랫마을 채집 길드');
export const nationId = subjectIdOf(nationSpecies.id, '협곡을 낀 나라');
export const motherGodId = subjectIdOf(motherGodSpecies.id, '붉은 장막의 어미');

const perception = (
  ...channels: readonly [string, number, number][]
): PerceptionProfile => ({
  channels: channels.map(([channel, threshold, range]) => ({
    channel: channel as PerceptionProfile['channels'][number]['channel'],
    threshold,
    range,
  })),
});

/** 사냥꾼 04 — 굶고, 다치고, 약초를 쥔다. */
const hunterSpec: SubjectSpec = {
  speciesId: hunterSpecies.id,
  label: '사냥꾼 04',
  name: '사냥꾼 04',
  subjectKind: 'person',
  partOfId: guildId,
  boundaries: [{ kind: 'body', ofId: hunterBodyId, note: '허기와 독이 적히는 몸' }],
  perception: perception(['light', 0.2, 300], ['sound', 0.3, 120], ['trace', 0.1, 5], ['report', 0.5, 1000000]),
  needs: [
    {
      slot: { domain: 'biological', path: 'hunger' },
      holderId: hunterId,
      band: { kind: 'range', min: 0, max: 0.6 },
      urgency: 0.8,
      collapseAfterTicks: 30,
      note: '허기가 이 위로 서른 틱을 넘기면 사냥할 힘이 남지 않는다',
    },
    {
      slot: { domain: 'biological', path: 'vitality' },
      holderId: hunterId,
      band: { kind: 'range', min: 0.15, max: 1 },
      urgency: 1,
      collapseAfterTicks: 1,
      note: '체력이 바닥나면 그 자리에서 끝난다',
    },
  ],
  values: [
    {
      slot: { domain: 'economic', path: `stock.${herbId}` },
      holderId: hunterId,
      band: { kind: 'range', min: 5, max: 1000 },
      weight: 0.5,
      note: '붉은 장막을 늘 다섯 뿌리는 쥐고 있으려 한다',
    },
    {
      slot: { domain: 'institutional', path: `passage.${canyonId}` },
      holderId: hunterId,
      band: { kind: 'is', value: true },
      weight: 0.7,
      note: '협곡을 지날 수 있어야 둥지에 닿는다 — 지금은 가진 것이 아니라 원하는 것이다',
    },
  ],
  capabilities: [toxinReadId, inscribeId],
};

/** 둥지의 장막벌레 군집 — 개체가 아니라 군집 하나가 주체다. */
const wormsSpec: SubjectSpec = {
  speciesId: veilWorm.id,
  label: '둥지의 장막벌레 군집',
  name: '둥지의 장막벌레 군집',
  subjectKind: 'creature',
  partOfId: null,
  boundaries: [{ kind: 'body', ofId: nestId, note: '둥지에 붙어 사는 몸 — 벌레와 둥지는 갈라지지 않는다' }],
  perception: perception(['smell', 0.05, 40], ['psychic', 0.1, 200]),
  needs: [
    {
      slot: { domain: 'ecological', path: 'population' },
      holderId: nestId,
      band: { kind: 'range', min: 20, max: 1000000000 },
      urgency: 0.4,
      collapseAfterTicks: 200,
      note: '스무 마리 아래로 내려가면 군집의 의념이 끊긴다',
    },
  ],
  values: [
    {
      slot: { domain: 'psychic', path: 'energy' },
      holderId: wormsId,
      band: { kind: 'range', min: 40, max: 1000000 },
      weight: 0.4,
      note: '안개를 머금을수록 의념이 두터워진다',
    },
  ],
  capabilities: [veilId],
};

/** 아랫마을 채집 길드 — 몸이 없다. 창고가 비면 흩어진다. */
const guildSpec: SubjectSpec = {
  speciesId: guildSpecies.id,
  label: '아랫마을 채집 길드',
  name: '아랫마을 채집 길드',
  subjectKind: 'organization',
  partOfId: nationId,
  boundaries: [
    { kind: 'membership', ofId: hunterId, note: '사냥꾼 04 — 길드원' },
    { kind: 'membership', ofId: villagersId, note: '아랫마을 사람들 — 길드의 뿌리' },
  ],
  perception: perception(['report', 0.4, 1000000]),
  needs: [
    {
      slot: { domain: 'economic', path: `stock.${herbId}` },
      holderId: guildId,
      band: { kind: 'range', min: 30, max: 1000000000 },
      urgency: 0.5,
      collapseAfterTicks: 120,
      note: '창고가 서른 뿌리 아래로 오래 머물면 길드는 흩어진다',
    },
  ],
  values: [
    {
      slot: { domain: 'relational', path: `trust.${guildId}` },
      holderId: villagersId,
      band: { kind: 'range', min: 0.3, max: 1 },
      weight: 0.6,
      note: '마을이 믿어야 채집권이 유지된다 — 내 경계 밖의 자리다',
    },
  ],
  capabilities: [inscribeId],
};

/** 협곡을 낀 나라 — 정당성으로 서고 정당성으로 무너진다. */
const nationSpec: SubjectSpec = {
  speciesId: nationSpecies.id,
  label: '협곡을 낀 나라',
  name: '협곡을 낀 나라',
  subjectKind: 'nation',
  partOfId: null,
  boundaries: [
    { kind: 'membership', ofId: guildId, note: '채집 길드 — 국가를 이루는 조직' },
    { kind: 'territory', ofId: canyonId, note: '국경 협곡 — 나라가 미치는 땅' },
  ],
  perception: perception(['report', 0.5, 1000000]),
  needs: [
    {
      slot: { domain: 'transcendent', path: 'legitimacy' },
      holderId: nationId,
      band: { kind: 'range', min: 0.35, max: 1 },
      urgency: 0.5,
      collapseAfterTicks: 400,
      note: '정당성이 이 아래로 오래 머물면 나라는 조직으로 흩어진다',
    },
  ],
  values: [
    {
      slot: { domain: 'institutional', path: `passage.${canyonId}` },
      holderId: villagersId,
      band: { kind: 'is', value: false },
      weight: 0.5,
      note: '협곡의 통행을 막으려 한다 — 사냥꾼이 원하는 것과 정면으로 어긋난다 (D5 가 이 충돌을 본다)',
    },
  ],
  capabilities: [inscribeId],
};

/** 붉은 장막의 어미 — 아랫마을이 대를 이어 바친 제물에서 생긴 신. */
const motherGodSpec: SubjectSpec = {
  speciesId: motherGodSpecies.id,
  label: '붉은 장막의 어미',
  name: '붉은 장막의 어미',
  subjectKind: 'god',
  partOfId: null,
  boundaries: [{ kind: 'anchor', ofId: nestId, note: '둥지 — 어미가 세계에 걸린 지점' }],
  perception: perception(['psychic', 0.05, 1000000], ['report', 0.6, 1000000]),
  needs: [
    {
      slot: { domain: 'transcendent', path: 'worship' },
      holderId: motherGodId,
      band: { kind: 'range', min: 1, max: 1000000000000 },
      urgency: 0.3,
      collapseAfterTicks: 1000,
      note: '아무도 빌지 않으면 어미는 흩어진다 — 신은 숭배로 유지된다',
    },
  ],
  values: [
    {
      slot: { domain: 'psychic', path: 'conviction' },
      holderId: villagersId,
      band: { kind: 'range', min: 0.4, max: 1 },
      weight: 0.7,
      note: '마을의 믿음이 두터워야 신역이 넓어진다',
    },
  ],
  capabilities: [veilId],
};

export const SUBJECT_SPECS: readonly SubjectSpec[] = [
  hunterSpec,
  wormsSpec,
  guildSpec,
  nationSpec,
  motherGodSpec,
];

/** 붉은 장막 세계에 선 주체 다섯 — 사람·생물·조직·국가·신 하나씩. */
export const VEIL_SUBJECTS: readonly SubjectProfile[] = SUBJECT_SPECS.map(buildSubject);

/** 결함 주체 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenSubject {
  readonly broke: string;
  readonly expected: string;
  readonly value: SubjectProfile;
}

const hunterProfile = VEIL_SUBJECTS[0] as SubjectProfile;
const guildProfile = VEIL_SUBJECTS[2] as SubjectProfile;
const godProfile = VEIL_SUBJECTS[4] as SubjectProfile;

const need = (over: Partial<Need>): Need => ({ ...(hunterProfile.needs[0] as Need), ...over });
const value = (over: Partial<ValueTarget>): ValueTarget => ({
  ...(hunterProfile.values[0] as ValueTarget),
  ...over,
});
const boundary = (over: Partial<Boundary>): Boundary => ({
  ...(hunterProfile.boundaries[0] as Boundary),
  ...over,
});

/** 결함 주체 13종 — 사유마다 하나씩. 전부 O1 로서는 온전한 Subject 다. */
export const BROKEN_SUBJECTS: readonly BrokenSubject[] = [
  {
    broke: '몸 없는 사람 — 경계를 지웠다',
    expected: 'unbounded-subject',
    value: { ...hunterProfile, boundaries: [] },
  },
  {
    broke: '길드원 자리에 장소를 넣었다',
    expected: 'foreign-boundary',
    value: { ...guildProfile, boundaries: [boundary({ kind: 'membership', ofId: canyonId })] },
  },
  {
    broke: '기억 저장소 ID 를 손으로 지었다',
    expected: 'manufactured-graph',
    value: { ...hunterProfile, memoryStoreId: 'memory:사냥꾼의기억' },
  },
  {
    broke: '아무 통로도 없다 — 세계가 그에게 일어나지 않는다',
    expected: 'senseless-subject',
    value: { ...hunterProfile, perception: { channels: [] } },
  },
  {
    broke: '문턱 0 — 세기 0 의 현상까지 감지한다',
    expected: 'omniscient-channel',
    value: { ...hunterProfile, perception: perception(['light', 0, 300]) },
  },
  {
    broke: '몸 없는 길드가 눈을 달았다',
    expected: 'bodiless-sense',
    value: { ...guildProfile, perception: perception(['light', 0.2, 300]) },
  },
  {
    broke: '무너질 조건이 없다 — 잃을 것이 없다',
    expected: 'no-need',
    value: { ...hunterProfile, needs: [] },
  },
  {
    broke: '남의 허기로 내가 무너진다고 적었다',
    expected: 'foreign-need',
    value: { ...hunterProfile, needs: [need({ holderId: motherGodId })] },
  },
  {
    broke: '세계에 없는 자리를 지킨다',
    expected: 'phantom-slot',
    value: { ...hunterProfile, needs: [need({ slot: { domain: 'biological', path: 'mood' } })] },
  },
  {
    broke: '허기 0~1 — 결코 벗어나지 않는 조건',
    expected: 'bad-band',
    value: { ...hunterProfile, needs: [need({ band: { kind: 'range', min: 0, max: 1 } })] },
  },
  {
    broke: '밀고 가는 방향이 없다',
    expected: 'no-value',
    value: { ...hunterProfile, values: [] },
  },
  {
    broke: '미는 힘 0 — 밀지 않는 방향은 가치가 아니다',
    expected: 'bad-stake',
    value: { ...hunterProfile, values: [value({ weight: 0 })] },
  },
  {
    broke: '아무것도 할 수 없다 — 그것은 사물이다',
    expected: 'incapable-subject',
    value: { ...godProfile, capabilities: [] },
  },
];
