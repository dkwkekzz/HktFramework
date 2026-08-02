// S1 검증 장면 — 붉은 장막 세계의 종 다섯.
//
// O0 장면은 "무엇이 세계에 설 수 있는가"(정의), S0 장면은 "그 정의에서 태어난 개체"를 적었다.
// 그 사이가 비어 있었다: 개체의 눈이 300m 를 보는 것도 서른 틱을 굶으면 무너지는 것도
// **그 개체 하나의 선언**이었고, 종은 자리 목록(slots)만 갖고 있었다. 여기서 그 사이를 채운다.
//
// 종 다섯 — 사냥꾼(사람) · 장막벌레(생물) · 채집 결사(조직) · 협곡을 낀 나라(국가) ·
// 붉은 장막의 어미(신). 앞의 둘은 몸이 있어 늙고, 뒤의 셋은 몸이 없어 늙지 않는다.
//
// 조직·국가 종 둘은 S0 장면에 있던 것을 여기로 옮겼다 (S0 이 남긴 부채). S0 장면은 이제
// 이 파일에서 종을 가져다 쓰고, 개체의 감각·의존·능력은 seedFromSpecies 로 받는다.

import { deterministicId, type Id } from '@hkt/core/v1';
import { axiomId, type Definition, type SpeciesDefinition } from '@hkt/core/o0';
import { MAX_PERCEPTION_RANGE } from '@hkt/core/s0';
import {
  AGELESS,
  buildArchetype,
  type SpeciesArchetype,
  type SpeciesSpec,
} from '@hkt/core/s1';

import {
  herbId,
  hunterSpecies,
  inscribeId,
  motherGodSpecies,
  nestId,
  peddlersId,
  roadGodSpecies,
  toxinReadId,
  veilId,
  veilWorm,
  VEIL_DEFINITIONS,
  villagersId,
} from './o0-veil-definitions.ts';

export { herbId, nestId, villagersId, peddlersId, toxinReadId, inscribeId, veilId };

/** 사냥꾼의 몸 · 국경 협곡 — 경계와 몸이 가리키는 사물들 (S0 장면이 그대로 쓴다). */
export const hunterBodyId: Id = deterministicId('entity', 'body', '사냥꾼 04의 몸');
export const canyonId: Id = deterministicId('entity', 'place', '국경 협곡');

/** 조직 종 — 채집 결사. 몸이 없고 구성원으로만 세계에 닿는다. */
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

/**
 * 사냥꾼 — 사람. 눈으로 빛과 자국을 읽고 귀로 골짜기의 울림을 듣는다.
 * 유체는 빨리 태우고 덜 보며, 노체는 느려져 더 오래 버티는 대신 눈이 어두워진다.
 */
const hunterSpec: SpeciesSpec = {
  definition: hunterSpecies,
  body: {
    organs: [
      { organ: 'core', count: 1, note: '허기와 독이 적히는 몸통' },
      { organ: 'eye', count: 2, note: '어스름에서도 짐승의 자국을 읽는 눈' },
      { organ: 'ear', count: 2, note: '골짜기를 돌아오는 울림을 듣는 귀' },
      { organ: 'mouth', count: 1, note: '먹고, 마을에 전한다' },
      { organ: 'limb', count: 4, note: '협곡 벽을 기어오르고 약초를 쥔다' },
    ],
  },
  senses: [
    { channel: 'light', threshold: 0.2, range: 300, organ: 'eye' },
    { channel: 'sound', threshold: 0.3, range: 120, organ: 'ear' },
    { channel: 'trace', threshold: 0.1, range: 5, organ: 'eye' },
    { channel: 'report', threshold: 0.5, range: MAX_PERCEPTION_RANGE, organ: null },
  ],
  lifecycle: {
    stages: [
      {
        stage: '유체',
        ticks: 200,
        metabolism: 1.5,
        senseScale: 0.7,
        opens: [toxinReadId],
      },
      { stage: '성체', ticks: 600, metabolism: 1, senseScale: 1, opens: [inscribeId] },
      { stage: '노체', ticks: 200, metabolism: 0.75, senseScale: 0.6, opens: [] },
    ],
  },
  baseNeeds: [
    {
      slot: { domain: 'biological', path: 'hunger' },
      holder: 'self',
      band: { kind: 'range', min: 0, max: 0.6 },
      urgency: 0.8,
      baseTicks: 30,
      note: '허기가 이 위로 서른 틱을 넘기면 사냥할 힘이 남지 않는다',
    },
    {
      slot: { domain: 'biological', path: 'vitality' },
      holder: 'self',
      band: { kind: 'range', min: 0.15, max: 1 },
      urgency: 1,
      baseTicks: 1,
      note: '체력이 바닥나면 그 자리에서 끝난다',
    },
  ],
  capabilities: [toxinReadId, inscribeId],
};

/** 장막벌레 — 생물. 개체가 아니라 군집이 주체이고, 몸은 둥지와 갈라지지 않는다. */
const veilWormSpec: SpeciesSpec = {
  definition: veilWorm,
  body: {
    organs: [
      { organ: 'core', count: 1, note: '둥지에 붙은 군체 — 벌레와 둥지는 갈라지지 않는다' },
      { organ: 'nose', count: 1, note: '안개에 섞인 피 냄새를 맡는 더듬이' },
      { organ: 'mouth', count: 1, note: '안개를 먹는다' },
    ],
  },
  senses: [
    { channel: 'smell', threshold: 0.05, range: 40, organ: 'nose' },
    { channel: 'psychic', threshold: 0.1, range: 200, organ: null },
  ],
  lifecycle: {
    stages: [
      { stage: '유체', ticks: 40, metabolism: 2, senseScale: 0.4, opens: [] },
      { stage: '성체', ticks: 300, metabolism: 1, senseScale: 1, opens: [veilId] },
    ],
  },
  baseNeeds: [
    {
      slot: { domain: 'ecological', path: 'population' },
      holder: 'body',
      band: { kind: 'range', min: 20, max: 1000000000 },
      urgency: 0.4,
      baseTicks: 200,
      note: '스무 마리 아래로 내려가면 군집의 의념이 끊긴다',
    },
  ],
  capabilities: [veilId],
};

/** 채집 결사 — 조직. 몸이 없어 보고로만 알고, 늙지 않고, 창고가 비면 흩어진다. */
const guildSpec: SpeciesSpec = {
  definition: guildSpecies,
  body: null,
  senses: [{ channel: 'report', threshold: 0.4, range: MAX_PERCEPTION_RANGE, organ: null }],
  lifecycle: AGELESS,
  baseNeeds: [
    {
      slot: { domain: 'economic', path: `stock.${herbId}` },
      holder: 'self',
      band: { kind: 'range', min: 30, max: 1000000000 },
      urgency: 0.5,
      baseTicks: 120,
      note: '창고가 서른 뿌리 아래로 오래 머물면 길드는 흩어진다',
    },
  ],
  capabilities: [inscribeId],
};

/** 협곡을 낀 나라 — 국가. 늙지 않지만 정당성이 마르면 조직으로 흩어진다. */
const nationSpec: SpeciesSpec = {
  definition: nationSpecies,
  body: null,
  senses: [{ channel: 'report', threshold: 0.5, range: MAX_PERCEPTION_RANGE, organ: null }],
  lifecycle: AGELESS,
  baseNeeds: [
    {
      slot: { domain: 'transcendent', path: 'legitimacy' },
      holder: 'self',
      band: { kind: 'range', min: 0.35, max: 1 },
      urgency: 0.5,
      baseTicks: 400,
      note: '정당성이 이 아래로 오래 머물면 나라는 조직으로 흩어진다',
    },
  ],
  capabilities: [inscribeId],
};

/** 붉은 장막의 어미 — 신. 몸이 없어 의념 잔향과 기원으로 세계를 알고, 숭배가 끊기면 흩어진다. */
const motherGodSpec: SpeciesSpec = {
  definition: motherGodSpecies,
  body: null,
  senses: [
    { channel: 'psychic', threshold: 0.05, range: MAX_PERCEPTION_RANGE, organ: null },
    { channel: 'report', threshold: 0.6, range: MAX_PERCEPTION_RANGE, organ: null },
  ],
  lifecycle: AGELESS,
  baseNeeds: [
    {
      slot: { domain: 'transcendent', path: 'worship' },
      holder: 'self',
      band: { kind: 'range', min: 1, max: 1000000000000 },
      urgency: 0.3,
      baseTicks: 1000,
      note: '아무도 빌지 않으면 어미는 흩어진다 — 신은 숭배로 유지된다',
    },
  ],
  capabilities: [veilId],
};

export const SPECIES_SPECS: readonly SpeciesSpec[] = [
  hunterSpec,
  veilWormSpec,
  guildSpec,
  nationSpec,
  motherGodSpec,
];

/** 붉은 장막 세계의 종 다섯 — 사람·생물·조직·국가·신 하나씩. */
export const VEIL_SPECIES: readonly SpeciesArchetype[] = SPECIES_SPECS.map(buildArchetype);

export const [hunterArchetype, veilWormArchetype, guildArchetype, nationArchetype, motherGodArchetype] =
  VEIL_SPECIES as readonly [
    SpeciesArchetype,
    SpeciesArchetype,
    SpeciesArchetype,
    SpeciesArchetype,
    SpeciesArchetype,
  ];

/**
 * S1 이 쓰는 정의 전부 — O0 의 일곱 중 종 넷은 원형으로 갈아 끼우고, 조직·국가 종 둘을 더한다.
 * 원형은 여전히 종 정의이므로(SpeciesArchetype extends SpeciesDefinition) 그대로 들어간다.
 */
export const S1_DEFINITIONS: readonly Definition[] = [
  ...VEIL_DEFINITIONS.filter(
    (definition) =>
      definition.definitionKind === 'ability' || definition.id === roadGodSpecies.id,
  ),
  ...VEIL_SPECIES,
];

/** 결함 종 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenSpecies {
  readonly broke: string;
  readonly expected: string;
  readonly value: SpeciesArchetype;
}

const hunterBody = hunterArchetype.body as NonNullable<SpeciesArchetype['body']>;

/** 결함 종 14종 — 사유마다 하나씩. 전부 O0 로서는 온전한 종 정의다. */
export const BROKEN_SPECIES: readonly BrokenSpecies[] = [
  {
    broke: '몸 없는 사람 — 허기가 적힐 곳이 없다',
    expected: 'bodiless-life',
    value: { ...hunterArchetype, body: null },
  },
  {
    broke: '몸을 단 조직 — 나라와 결사에는 몸이 없다',
    expected: 'bodied-abstraction',
    value: { ...guildArchetype, body: hunterBody },
  },
  {
    broke: '본체 없는 몸 — 나머지 기관이 붙을 곳이 없다',
    expected: 'coreless-body',
    value: {
      ...hunterArchetype,
      body: { organs: hunterBody.organs.filter((organ) => organ.organ !== 'core') },
    },
  },
  {
    broke: '눈 없이 빛을 본다',
    expected: 'organless-sense',
    value: {
      ...hunterArchetype,
      body: { organs: hunterBody.organs.filter((organ) => organ.organ !== 'eye') },
    },
  },
  {
    broke: '귀로 빛을 본다',
    expected: 'mismatched-organ',
    value: {
      ...hunterArchetype,
      senses: [{ channel: 'light', threshold: 0.2, range: 300, organ: 'ear' }],
    },
  },
  {
    broke: '보고를 기관으로 받는다 — 보고는 몸이 아니라 관계를 타고 온다',
    expected: 'mediated-organ',
    value: {
      ...guildArchetype,
      senses: [{ channel: 'report', threshold: 0.4, range: 1000, organ: 'ear' }],
    },
  },
  {
    broke: '문턱 0 — 이 종 앞에서는 은폐가 성립하지 않는다',
    expected: 'omniscient-sense',
    value: {
      ...guildArchetype,
      senses: [{ channel: 'report', threshold: 0, range: 1000, organ: null }],
    },
  },
  {
    broke: '늙지 않는 몸 — 죽지 않는 것은 자리를 비우지 않는다',
    expected: 'ageless-body',
    value: { ...hunterArchetype, lifecycle: AGELESS },
  },
  {
    broke: '늙는 나라 — 성장 단계는 생물 영역의 자리다',
    expected: 'aging-abstraction',
    value: { ...nationArchetype, lifecycle: hunterArchetype.lifecycle },
  },
  {
    broke: '노체에서 유체로 돌아가는 생애',
    expected: 'unordered-stage',
    value: {
      ...hunterArchetype,
      lifecycle: { stages: [...hunterArchetype.lifecycle.stages].reverse() },
    },
  },
  {
    broke: '대사 0 — 아무것도 태우지 않으면 굶주림이 성립하지 않는다',
    expected: 'bad-stage',
    value: {
      ...hunterArchetype,
      lifecycle: {
        stages: hunterArchetype.lifecycle.stages.map((stage) => ({ ...stage, metabolism: 0 })),
      },
    },
  },
  {
    broke: '종이 열지 않은 자리로 무너진다 — 결사는 굶지 않는다',
    expected: 'off-species-slot',
    value: {
      ...guildArchetype,
      baseNeeds: [
        {
          slot: { domain: 'biological', path: 'hunger' },
          holder: 'self',
          band: { kind: 'range', min: 0, max: 0.6 },
          urgency: 0.8,
          baseTicks: 30,
          note: '결사가 굶는다',
        },
      ],
    },
  },
  {
    broke: '무너질 조건이 없는 종 — 잃을 것이 없으면 목적도 자라지 않는다',
    expected: 'needless-species',
    value: { ...motherGodArchetype, baseNeeds: [] },
  },
  {
    broke: '평생 열리지 않는 능력을 인용했다',
    expected: 'unreachable-capability',
    value: {
      ...hunterArchetype,
      lifecycle: {
        stages: hunterArchetype.lifecycle.stages.map((stage) => ({ ...stage, opens: [] })),
      },
    },
  },
];
