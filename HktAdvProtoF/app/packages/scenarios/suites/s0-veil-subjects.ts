// S0 검증 장면 — 붉은 장막 세계에 서는 주체 다섯.
//
// O0 장면은 "무엇이 세계에 설 수 있는가"(정의)를 적었고, S1 장면은 그 정의에 살을 붙여
// **종 원형**을 세웠다. 여기서는 그 종에서 **실제로 태어난 개체**를 적는다. 사냥꾼 한 명,
// 장막벌레 군집 하나, 채집 길드 하나, 협곡 국가 하나, 붉은 장막의 어미 하나 —
// 사람·생물·조직·국가·신 다섯 종류가 하나씩이다.
//
// 다섯이 세계에 걸리는 방식은 전부 다르다. 사냥꾼은 몸으로, 길드는 구성원으로, 국가는
// 영역과 구성원으로, 어미는 앵커로. 감지도 전부 다르다 — 빛 / 냄새 / 보고 / 보고 / 의념 잔향.
// 그런데도 다섯 모두 같은 다섯 질문에 답한다. 그것이 S0 이 주장하는 "공통 인터페이스" 다.
//
// **감각·의존·능력은 손으로 적지 않는다.** S1 이 서면서 그것들은 종의 것이 되었다 —
// 개체는 `seedFromSpecies` 로 물려받는다. 개체가 스스로 적는 것은 둘뿐이다:
// 어디까지가 자기인가(경계)와 무엇을 밀고 가는가(유지). 무너지는 조건은 종이 주고,
// 원하는 것은 개체가 고른다.

import type { Id } from '@hkt/core/v1';
import type { Definition } from '@hkt/core/o0';
import {
  buildSubject,
  subjectIdOf,
  type Boundary,
  type Need,
  type SubjectProfile,
  type SubjectSpec,
  type ValueTarget,
} from '@hkt/core/s0';
import { seedFromSpecies, type SpeciesArchetype } from '@hkt/core/s1';

import {
  canyonId,
  guildArchetype,
  guildSpecies,
  herbId,
  hunterArchetype,
  hunterBodyId,
  motherGodArchetype,
  nationArchetype,
  nationSpecies,
  nestId,
  peddlersId,
  S1_DEFINITIONS,
  veilWormArchetype,
  villagersId,
} from './s1-veil-species.ts';

export {
  herbId,
  nestId,
  villagersId,
  peddlersId,
  hunterBodyId,
  canyonId,
  guildSpecies,
  nationSpecies,
};

/** S0 가 쓰는 정의 전부 — S1 이 세운 종 원형 다섯 + O0 의 능력 셋 + 길신. */
export const S0_DEFINITIONS: readonly Definition[] = S1_DEFINITIONS;

/** 개체 ID — 종과 이름표에서 나온다. 장면 밖에서도 같은 값으로 가리킬 수 있게 미리 편다. */
export const hunterId = subjectIdOf(hunterArchetype.id, '사냥꾼 04');
export const wormsId = subjectIdOf(veilWormArchetype.id, '둥지의 장막벌레 군집');
export const guildId = subjectIdOf(guildArchetype.id, '아랫마을 채집 길드');
export const nationId = subjectIdOf(nationArchetype.id, '협곡을 낀 나라');
export const motherGodId = subjectIdOf(motherGodArchetype.id, '붉은 장막의 어미');

/** 개체 하나가 종에서 태어난다 — 감각·의존·능력은 씨앗에서, 경계·유지는 개체에서. */
function born(
  archetype: SpeciesArchetype,
  born: {
    readonly label: string;
    readonly subjectId: Id;
    readonly bodyId: Id | null;
    readonly stage?: string;
    readonly partOfId: Id | null;
    readonly boundaries: readonly Boundary[];
    readonly values: readonly ValueTarget[];
  },
): SubjectSpec {
  const seed = seedFromSpecies(archetype, {
    subjectId: born.subjectId,
    bodyId: born.bodyId,
    stage: born.stage,
  });
  return {
    speciesId: archetype.id,
    label: born.label,
    name: born.label,
    subjectKind: archetype.subjectKind,
    partOfId: born.partOfId,
    boundaries: born.boundaries,
    perception: seed.perception,
    needs: seed.needs,
    values: born.values,
    capabilities: seed.capabilities,
  };
}

/** 사냥꾼 04 — 성체로 선다. 굶고, 다치고, 약초를 쥔다. */
const hunterSpec: SubjectSpec = born(hunterArchetype, {
  label: '사냥꾼 04',
  subjectId: hunterId,
  bodyId: hunterBodyId,
  stage: '성체',
  partOfId: guildId,
  boundaries: [{ kind: 'body', ofId: hunterBodyId, note: '허기와 독이 적히는 몸' }],
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
});

/** 둥지의 장막벌레 군집 — 개체가 아니라 군집 하나가 주체다. 몸은 둥지와 갈라지지 않는다. */
const wormsSpec: SubjectSpec = born(veilWormArchetype, {
  label: '둥지의 장막벌레 군집',
  subjectId: wormsId,
  bodyId: nestId,
  stage: '성체',
  partOfId: null,
  boundaries: [
    { kind: 'body', ofId: nestId, note: '둥지에 붙어 사는 몸 — 벌레와 둥지는 갈라지지 않는다' },
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
});

/** 아랫마을 채집 길드 — 몸이 없다. 창고가 비면 흩어진다. */
const guildSpec: SubjectSpec = born(guildArchetype, {
  label: '아랫마을 채집 길드',
  subjectId: guildId,
  bodyId: null,
  partOfId: nationId,
  boundaries: [
    { kind: 'membership', ofId: hunterId, note: '사냥꾼 04 — 길드원' },
    { kind: 'membership', ofId: villagersId, note: '아랫마을 사람들 — 길드의 뿌리' },
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
});

/** 협곡을 낀 나라 — 정당성으로 서고 정당성으로 무너진다. */
const nationSpec: SubjectSpec = born(nationArchetype, {
  label: '협곡을 낀 나라',
  subjectId: nationId,
  bodyId: null,
  partOfId: null,
  boundaries: [
    { kind: 'membership', ofId: guildId, note: '채집 길드 — 국가를 이루는 조직' },
    { kind: 'territory', ofId: canyonId, note: '국경 협곡 — 나라가 미치는 땅' },
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
});

/** 붉은 장막의 어미 — 아랫마을이 대를 이어 바친 제물에서 생긴 신. */
const motherGodSpec: SubjectSpec = born(motherGodArchetype, {
  label: '붉은 장막의 어미',
  subjectId: motherGodId,
  bodyId: null,
  partOfId: null,
  boundaries: [{ kind: 'anchor', ofId: nestId, note: '둥지 — 어미가 세계에 걸린 지점' }],
  values: [
    {
      slot: { domain: 'psychic', path: 'conviction' },
      holderId: villagersId,
      band: { kind: 'range', min: 0.4, max: 1 },
      weight: 0.7,
      note: '마을의 믿음이 두터워야 신역이 넓어진다',
    },
  ],
});

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
const perception = (
  ...channels: readonly [string, number, number][]
): SubjectProfile['perception'] => ({
  channels: channels.map(([channel, threshold, range]) => ({
    channel: channel as SubjectProfile['perception']['channels'][number]['channel'],
    threshold,
    range,
  })),
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
