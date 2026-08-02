// S2 검증 장면 — 붉은 장막 세계의 문화 셋과 그 안의 자리 여섯.
//
// S1 장면은 종 다섯을 세웠고, 그 종에서 태어난 개체는 전부 같았다. 사냥꾼 종의 둘은 같은
// 빛을 보고 같은 것으로 무너지고 같은 것을 할 수 있었다 — 구별할 방법이 없었다.
// 여기서 그 위에 문화를 얹는다.
//
// 세 문화가 같은 협곡에 있다.
//
//   자국을 쫓는 자들   붉은 빛은 장막벌레가 지나간 자국이다 → 쫓는다. 마을의 신뢰로 산다.
//   어미를 섬기는 자들 같은 붉은 빛이 어미의 숨이다 → 엎드린다. 기원을 쌓는다.
//   고개를 넘는 상단   빛은 길이 열렸다는 표지다 → 지켜본다. 값과 재고를 민다.
//
// **같은 종, 같은 눈, 같은 빛.** 갈리는 것은 그 빛을 무엇으로 읽는가 하나다.
// 그 하나에서 원하는 것이 갈리고, 자리(역할)에서 할 수 있는 것이 갈린다.
//
// 넷째 문화는 종을 넘는다 — 장막벌레 군집은 빛을 보지 못한다(냄새와 의념뿐). 그래서
// 사냥 문화를 벌레에게 씌우려 하면 관문이 막는다. 문화는 종 위에 얹히지 종을 대신하지 않는다.

import { deterministicId, type Id } from '@hkt/core/v1';
import { axiomId, type Definition } from '@hkt/core/o0';
import {
  buildCulture,
  buildRole,
  type CultureArchetype,
  type CultureSpec,
  type ReadingRule,
  type RoleArchetype,
  type ValueTemplate,
} from '@hkt/core/s2';

import {
  canyonId,
  herbId,
  hunterArchetype,
  S1_DEFINITIONS,
  veilWormArchetype,
  villagersId,
} from './s1-veil-species.ts';
import { motherGodId, peddlersId } from './s0-veil-subjects.ts';
import { veilId, toxinReadId, inscribeId } from './o0-veil-definitions.ts';

export { canyonId, herbId, villagersId, peddlersId, motherGodId };

/** S2 가 쓰는 정의 전부 — S1 이 세운 것 그대로. 문화는 정의를 더하지 않고 인용만 한다. */
export const S2_DEFINITIONS: readonly Definition[] = S1_DEFINITIONS;

const cultureId = (name: string): Id => deterministicId('rule', 'culture', name);
const roleId = (culture: string, name: string): Id =>
  deterministicId('rule', 'role', culture, name);

export const huntCultureId = cultureId('자국을 쫓는 자들');
export const riteCultureId = cultureId('어미를 섬기는 자들');
export const tradeCultureId = cultureId('고개를 넘는 상단');

// ── 읽기 ─────────────────────────────────────────────────────────────────────
// 셋 다 `light:붉은 장막의 빛` 을 읽는다. 겹치는 표식 하나가 갈림의 자리다.

const huntVeilLight: ReadingRule = {
  channel: 'light',
  sign: '붉은 장막의 빛',
  assertion: '장막벌레가 방금 지나갔다 — 둥지가 가깝다',
  confidence: 0.7,
  stance: 'approach',
};
const riteVeilLight: ReadingRule = {
  channel: 'light',
  sign: '붉은 장막의 빛',
  assertion: '어미가 숨을 내쉬었다 — 이 자리는 어미의 것이다',
  confidence: 0.95,
  stance: 'avoid',
};
const tradeVeilLight: ReadingRule = {
  channel: 'light',
  sign: '붉은 장막의 빛',
  assertion: '고개가 막혔다 — 값이 오른다',
  confidence: 0.5,
  stance: 'observe',
};

// ── 원함 ─────────────────────────────────────────────────────────────────────
// 전부 종이 무너지는 자리(허기·체력)를 피해 간다. 무너지는 자리는 종의 것이다.

const villageTrust: ValueTemplate = {
  slot: { domain: 'relational', path: `trust.${villagersId}` },
  holder: { of: 'self' },
  band: { kind: 'range', min: 0.5, max: 1 },
  weight: 0.7,
  note: '자국을 읽어 주는 값으로 마을에서 얻는 자리 — 신뢰가 마르면 사냥터를 잃는다',
};
const herbStock: ValueTemplate = {
  slot: { domain: 'economic', path: `stock.${herbId}` },
  holder: { of: 'other', id: canyonId },
  band: { kind: 'range', min: 40, max: 1000000000 },
  weight: 0.4,
  note: '협곡 창고의 약초 — 내 것이 아니지만 비면 겨울을 못 넘긴다',
};
const motherWorship: ValueTemplate = {
  slot: { domain: 'transcendent', path: 'worship' },
  holder: { of: 'other', id: motherGodId },
  band: { kind: 'range', min: 500, max: 1000000000000 },
  weight: 0.9,
  note: '어미에게 쌓이는 기원 — 내 것이 아닌 자리를 미는 데서 제의가 나온다',
};
const ownConviction: ValueTemplate = {
  slot: { domain: 'psychic', path: 'conviction' },
  holder: { of: 'self' },
  band: { kind: 'range', min: 0.6, max: 1 },
  weight: 0.6,
  note: '흔들리는 신념으로는 장막 앞에 서지 못한다',
};
const herbPrice: ValueTemplate = {
  slot: { domain: 'economic', path: `price.${herbId}` },
  holder: { of: 'other', id: canyonId },
  band: { kind: 'range', min: 12, max: 1000000000 },
  weight: 0.8,
  note: '고개 너머의 값 — 값이 서야 넘을 이유가 있다',
};
const peddlerTrust: ValueTemplate = {
  slot: { domain: 'relational', path: `trust.${peddlersId}` },
  holder: { of: 'self' },
  band: { kind: 'range', min: 0.3, max: 1 },
  weight: 0.5,
  note: '상단 안의 신용 — 끊기면 짐을 맡길 자가 없다',
};

// ── 자리 ─────────────────────────────────────────────────────────────────────

/** 몰이꾼 — 소리로 몰고, 말로 새기지 않는다 (전언 새김 금기). */
export const beaterRole: RoleArchetype = buildRole({
  cultureId: huntCultureId,
  id: roleId('자국을 쫓는 자들', '몰이꾼'),
  name: '몰이꾼',
  domain: 'ecological',
  when: ['무리의 맨 앞에 서기로 한다'],
  then: ['소리로 몰되 남의 기억에 새기지 않는다 — 새긴 말은 사냥터에 소문을 남긴다'],
  axiomId: axiomId('psychic-life'),
  taboos: [inscribeId],
  readings: [
    {
      channel: 'sound',
      sign: '뒤에서 오는 외침',
      assertion: '무리가 갈라졌다 — 방향을 바꾼다',
      confidence: 0.8,
      stance: 'approach',
    },
  ],
});

/** 독 감별사 — 같은 문화 안에서 창고 쪽을 민다. */
export const herbalistRole: RoleArchetype = buildRole({
  cultureId: huntCultureId,
  id: roleId('자국을 쫓는 자들', '독 감별사'),
  name: '독 감별사',
  domain: 'economic',
  when: ['사냥에서 돌아온 것을 가려내는 일을 맡는다'],
  then: ['창고의 약초를 채우는 쪽으로 움직인다'],
  axiomId: axiomId('psychic-life'),
  values: [herbStock],
});

/** 사제 — 입문 의례로 장막을 부르고, 자국을 쫓는 일이 금해진다. */
export const priestRole: RoleArchetype = buildRole({
  cultureId: riteCultureId,
  id: roleId('어미를 섬기는 자들', '사제'),
  name: '사제',
  domain: 'transcendent',
  when: ['입문 의례를 거쳐 어미의 이름을 받는다'],
  then: ['장막을 부를 수 있게 되고, 짐승의 자국을 가리는 일이 금해진다'],
  axiomId: axiomId('psychic-life'),
  grants: [veilId],
  taboos: [toxinReadId],
});

/** 신도 — 아무것도 열리지 않지만 더 세게 믿는다. */
export const followerRole: RoleArchetype = buildRole({
  cultureId: riteCultureId,
  id: roleId('어미를 섬기는 자들', '신도'),
  name: '신도',
  domain: 'psychic',
  when: ['이름을 받지 못한 채 제의에 선다'],
  then: ['부르지는 못하고 믿는다'],
  axiomId: axiomId('psychic-life'),
  values: [{ ...ownConviction, band: { kind: 'range', min: 0.8, max: 1 }, weight: 0.9, note: '이름을 받지 못한 자는 믿음으로만 선다' }],
});

/** 짐꾼 — 전언 새김을 쓰지 않는다(값이 새어 나간다). */
export const porterRole: RoleArchetype = buildRole({
  cultureId: tradeCultureId,
  id: roleId('고개를 넘는 상단', '짐꾼'),
  name: '짐꾼',
  domain: 'economic',
  when: ['짐을 지고 고개에 오른다'],
  then: ['값을 입에 담지 않는다 — 새긴 값은 다음 장에서 되돌아온다'],
  axiomId: axiomId('psychic-life'),
  taboos: [inscribeId],
});

/** 거간 — 전언 새김으로 값을 세운다. 같은 문화 안에서 짐꾼과 정확히 반대다. */
export const brokerRole: RoleArchetype = buildRole({
  cultureId: tradeCultureId,
  id: roleId('고개를 넘는 상단', '거간'),
  name: '거간',
  domain: 'economic',
  when: ['장이 서는 자리에서 값을 부른다'],
  then: ['말을 새겨 값을 세운다'],
  axiomId: axiomId('psychic-life'),
  values: [{ ...herbPrice, weight: 1, note: '값을 세우는 것이 이 자리의 전부다' }],
  readings: [
    {
      channel: 'report',
      sign: '고개 너머의 전언',
      assertion: '아직 아무도 넘지 않았다 — 값이 더 오른다',
      confidence: 0.6,
      stance: 'observe',
    },
  ],
});

// ── 문화 ─────────────────────────────────────────────────────────────────────

const huntSpec: CultureSpec = {
  id: huntCultureId,
  name: '자국을 쫓는 자들',
  domain: 'ecological',
  when: ['같은 골짜기에서 같은 것을 쫓으며 자란다'],
  then: ['빛과 자국을 사냥의 표식으로 읽고, 마을의 신뢰로 산다'],
  axiomId: axiomId('psychic-life'),
  speciesIds: [hunterArchetype.id],
  readings: [
    huntVeilLight,
    {
      channel: 'trace',
      sign: '눌린 이끼',
      assertion: '한 시진 안에 무엇이 지났다',
      confidence: 0.85,
      stance: 'approach',
    },
  ],
  values: [villageTrust],
  roles: [beaterRole, herbalistRole],
};

const riteSpec: CultureSpec = {
  id: riteCultureId,
  name: '어미를 섬기는 자들',
  domain: 'transcendent',
  when: ['장막이 걷히는 자리에서 태어나 자란다'],
  then: ['붉은 빛을 어미의 숨으로 읽고, 기원을 쌓는다'],
  axiomId: axiomId('psychic-life'),
  speciesIds: [hunterArchetype.id],
  readings: [
    riteVeilLight,
    {
      channel: 'trace',
      sign: '눌린 이끼',
      assertion: '어미가 지나간 자리다 — 밟지 않는다',
      confidence: 0.7,
      stance: 'avoid',
    },
  ],
  values: [motherWorship, ownConviction],
  roles: [priestRole, followerRole],
};

const tradeSpec: CultureSpec = {
  id: tradeCultureId,
  name: '고개를 넘는 상단',
  domain: 'economic',
  when: ['고개를 넘어 값을 나르며 자란다'],
  then: ['빛도 자국도 길의 표지로 읽고, 값과 신용을 민다'],
  axiomId: axiomId('psychic-life'),
  speciesIds: [hunterArchetype.id],
  readings: [
    tradeVeilLight,
    {
      channel: 'report',
      sign: '아랫마을의 소문',
      assertion: '누가 무엇을 얼마에 원하는지가 여기 있다',
      confidence: 0.55,
      stance: 'approach',
    },
  ],
  values: [herbPrice, peddlerTrust],
  roles: [porterRole, brokerRole],
};

export const CULTURE_SPECS: readonly CultureSpec[] = [huntSpec, riteSpec, tradeSpec];

/** 붉은 장막 세계의 문화 셋 — 전부 사냥꾼 종 위에 선다. */
export const VEIL_CULTURES: readonly CultureArchetype[] = CULTURE_SPECS.map(buildCulture);

export const [huntCulture, riteCulture, tradeCulture] = VEIL_CULTURES as readonly [
  CultureArchetype,
  CultureArchetype,
  CultureArchetype,
];

/** 결함 문화 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenCulture {
  readonly broke: string;
  readonly expected: string;
  readonly value: CultureArchetype;
}

/** 결함 문화 15종 — 사유마다 하나씩. 전부 O1 Rule 로서는 온전하거나, 온전함이 먼저 무너진다. */
export const BROKEN_CULTURES: readonly BrokenCulture[] = [
  {
    broke: 'O1 Rule 로 서지 못한다 — 조건 없는 규칙',
    expected: 'bad-culture',
    value: { ...huntCulture, when: [] },
  },
  {
    broke: '어느 종의 문화인지 없다',
    expected: 'speciesless-culture',
    value: { ...huntCulture, speciesIds: [] },
  },
  {
    broke: '세계에 없는 종에 얹힌다',
    expected: 'unknown-species',
    value: { ...huntCulture, speciesIds: [deterministicId('rule', 'species', '없는 종')] },
  },
  {
    broke: '같은 종을 두 번 적었다',
    expected: 'duplicate-culture-species',
    value: { ...huntCulture, speciesIds: [hunterArchetype.id, hunterArchetype.id] },
  },
  {
    broke: '읽는 것이 없다 — 같은 세계를 남과 똑같이 본다',
    expected: 'unreadable-culture',
    value: { ...huntCulture, readings: [] },
  },
  {
    broke: '빛을 보지 못하는 종에게 빛의 읽기를 씌운다',
    expected: 'unsensed-reading',
    value: { ...huntCulture, speciesIds: [veilWormArchetype.id] },
  },
  {
    broke: '같은 표식을 두 가지로 읽는다',
    expected: 'duplicate-reading',
    value: { ...huntCulture, readings: [huntVeilLight, riteVeilLight] },
  },
  {
    broke: '믿지 않는 읽기 — 확신 0',
    expected: 'bad-confidence',
    value: { ...huntCulture, readings: [{ ...huntVeilLight, confidence: 0 }] },
  },
  {
    broke: '원하는 것이 없다',
    expected: 'valueless-culture',
    value: { ...huntCulture, values: [] },
  },
  {
    broke: '종이 무너지는 자리(허기)를 문화가 다시 민다',
    expected: 'need-shadowing-value',
    value: {
      ...huntCulture,
      values: [
        {
          slot: { domain: 'biological', path: 'hunger' },
          holder: { of: 'self' },
          band: { kind: 'range', min: 0, max: 0.2 },
          weight: 0.5,
          note: '배부름을 미덕으로 삼는다',
        },
      ],
    },
  },
  {
    broke: '세계에 없는 자리를 원한다',
    expected: 'phantom-slot',
    value: {
      ...huntCulture,
      values: [{ ...villageTrust, slot: { domain: 'relational', path: 'envy.someone' } }],
    },
  },
  {
    broke: '자리가 없는 문화 — 그 안의 둘을 더 가르지 못한다',
    expected: 'roleless-culture',
    value: { ...huntCulture, roles: [] },
  },
  {
    broke: '종이 이미 여는 능력을 입문 의례로 또 연다',
    expected: 'redundant-grant',
    value: {
      ...riteCulture,
      roles: [{ ...priestRole, grants: [inscribeId] }, followerRole],
    },
  },
  {
    broke: '아무도 열지 않은 능력을 금한다',
    expected: 'phantom-taboo',
    value: { ...huntCulture, roles: [{ ...beaterRole, taboos: [veilId] }, herbalistRole] },
  },
  {
    broke: '문화 금기 + 자리 금기가 능력을 전부 막는다 — 아무것도 할 수 없는 개체',
    expected: 'total-taboo',
    // 문화가 독 감별을, 몰이꾼 자리가 전언 새김을 막는다 — 사냥꾼에게 남는 것이 없다
    value: { ...huntCulture, taboos: [toxinReadId] },
  },
];
