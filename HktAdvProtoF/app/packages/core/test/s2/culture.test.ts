// S2-d 문화 원형 조립 — 같은 종에서 태어난 둘이 문화로 갈린다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, stateHash, type Id } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import {
  axiomId,
  type AbilityDefinition,
  type Definition,
  type SpeciesDefinition,
} from '../../src/o0/index.ts';
import {
  buildSubject,
  checkSubjectProfile,
  subjectIdOf,
  type SubjectSpec,
} from '../../src/s0/index.ts';
import {
  buildArchetype,
  seedFromSpecies,
  type SpeciesArchetype,
  type SpeciesSpec,
} from '../../src/s1/index.ts';
import {
  buildCulture,
  buildRole,
  checkCulture,
  checkCultures,
  cultureSummary,
  cultureVerdict,
  divergences,
  roleOf,
  seedWithCulture,
  type CultureArchetype,
  type CultureSpec,
  type ReadingRule,
  type RoleArchetype,
  type ValuePlace,
  type ValueTemplate,
} from '../../src/s2/index.ts';

const trackId = deterministicId('rule', 'ability', '자국 읽기');
const inscribeId = deterministicId('rule', 'ability', '전언 새김');
const veilCallId = deterministicId('rule', 'ability', '장막 부름');

const track: AbilityDefinition = {
  kind: 'Rule',
  id: trackId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '자국 읽기',
  when: ['땅에 남은 자국을 들여다본다'],
  then: ['지나간 것의 무게와 방향이 읽힌다'],
  axiomId: axiomId('observable-trace'),
  supportIds: [],
  strength: 0.3,
  costs: [],
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${trackId}` }],
};
const inscribe: AbilityDefinition = {
  ...track,
  id: inscribeId,
  name: '전언 새김',
  when: ['상대의 눈을 마주 보고 한 문장을 말한다'],
  then: ['그 문장이 상대의 기억에 새겨진다'],
  strength: 0.4,
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${inscribeId}` }],
};
const veilCall: AbilityDefinition = {
  ...track,
  id: veilCallId,
  name: '장막 부름',
  when: ['어미의 이름을 세 번 부른다'],
  then: ['붉은 장막이 그 자리로 흘러온다'],
  strength: 0.8,
  costs: [{ domain: 'biological', path: 'vitality', amount: 0.2 }],
  traces: [{ channel: 'light', domain: 'psychic', path: `trace.${veilCallId}` }],
};
const hunterSpeciesId = deterministicId('rule', 'species', '사냥꾼');
const hunterSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: hunterSpeciesId,
  definitionKind: 'species',
  domain: 'biological',
  name: '사냥꾼',
  when: ['세계에 사람이 선다'],
  then: ['허기와 체력을 진다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'person',
  alive: true,
  slots: [
    { domain: 'biological', path: 'hunger' },
    { domain: 'biological', path: 'vitality' },
    { domain: 'psychic', path: 'conviction' },
  ],
  originId: null,
};

/** 능력 셋 + 종 하나 — S0 은 개체의 종도 이 집합에서 찾는다. */
const DEFINITIONS: readonly Definition[] = [track, inscribe, veilCall, hunterSpecies];

const hunterSpec: SpeciesSpec = {
  definition: hunterSpecies,
  body: {
    organs: [
      { organ: 'core', count: 1, note: '몸통' },
      { organ: 'eye', count: 2, note: '자국을 읽는 눈' },
      { organ: 'limb', count: 4, note: '기어오르고 쥔다' },
    ],
  },
  senses: [
    { channel: 'light', threshold: 0.2, range: 300, organ: 'eye' },
    { channel: 'report', threshold: 0.5, range: 1000, organ: null },
  ],
  lifecycle: {
    stages: [
      { stage: '유체', ticks: 200, metabolism: 1.5, senseScale: 0.5, opens: [trackId] },
      { stage: '성체', ticks: 600, metabolism: 1, senseScale: 1, opens: [inscribeId] },
    ],
  },
  baseNeeds: [
    {
      slot: { domain: 'biological', path: 'hunger' },
      holder: 'self',
      band: { kind: 'range', min: 0, max: 0.8 },
      urgency: 0.9,
      baseTicks: 30,
      note: '굶으면 무너진다',
    },
  ],
  capabilities: [trackId, inscribeId],
};
const hunter: SpeciesArchetype = buildArchetype(hunterSpec);

// 개체 ID 는 손으로 짓지 않는다 — 종 + 이름표에서 나온다 (S0-d)
const hunterId = subjectIdOf(hunterSpeciesId, '사냥꾼 04');
const priestId = subjectIdOf(hunterSpeciesId, '사냥꾼 09');
const bodyId = deterministicId('entity', 'veil', '사냥꾼 04의 몸');
const villagersId = deterministicId('subject', 'veil', '마을 사람들');
const where: ValuePlace = { subjectId: hunterId, bodyId };

const huntCultureId = deterministicId('rule', 'culture', '자국을 쫓는 자들');
const riteCultureId = deterministicId('rule', 'culture', '어미를 섬기는 자들');

const trustValue: ValueTemplate = {
  slot: { domain: 'relational', path: `trust.${villagersId}` },
  holder: { of: 'self' },
  band: { kind: 'range', min: 0.6, max: 1 },
  weight: 0.7,
  note: '자국을 읽어 주는 대가로 마을에 얻는 자리',
};
const worshipValue: ValueTemplate = {
  slot: { domain: 'transcendent', path: 'worship' },
  holder: { of: 'self' },
  band: { kind: 'range', min: 100, max: 1000000 },
  weight: 0.9,
  note: '기원이 쌓여야 어미가 대답한다',
};

const huntReading: ReadingRule = {
  channel: 'light',
  sign: '붉은 빛',
  assertion: '장막벌레가 지나간 자국이다',
  confidence: 0.7,
  stance: 'approach',
};
const riteReading: ReadingRule = {
  channel: 'light',
  sign: '붉은 빛',
  assertion: '어미가 숨을 내쉬었다',
  confidence: 0.9,
  stance: 'avoid',
};

/** 몰이꾼 — 사냥 문화의 자리. 전언 새김을 금하고(입은 사냥을 망친다) 자기 읽기를 덧댄다. */
const beater: RoleArchetype = buildRole({
  cultureId: huntCultureId,
  id: deterministicId('rule', 'role', '몰이꾼'),
  name: '몰이꾼',
  domain: 'ecological',
  when: ['무리의 맨 앞에 서기로 한다'],
  then: ['소리로 몰되 말로 새기지 않는다'],
  axiomId: axiomId('psychic-life'),
  taboos: [inscribeId],
  readings: [
    {
      channel: 'report',
      sign: '뒤의 외침',
      assertion: '갈라졌다 — 방향을 바꾼다',
      confidence: 0.8,
      stance: 'approach',
    },
  ],
});

/** 사제 — 제의 문화의 자리. 장막 부름을 열고 자국 읽기를 금한다. */
const priest: RoleArchetype = buildRole({
  cultureId: riteCultureId,
  id: deterministicId('rule', 'role', '사제'),
  name: '사제',
  domain: 'transcendent',
  when: ['입문 의례를 거쳐 어미의 이름을 받는다'],
  then: ['장막을 부를 수 있게 되고, 자국을 쫓는 일이 금해진다'],
  axiomId: axiomId('psychic-life'),
  grants: [veilCallId],
  taboos: [trackId],
});

function cultureSpec(overrides: Partial<CultureSpec> = {}): CultureSpec {
  return {
    id: huntCultureId,
    name: '자국을 쫓는 자들',
    domain: 'ecological',
    when: ['같은 골짜기에서 같은 것을 쫓으며 자란다'],
    then: ['빛과 자국을 사냥의 표식으로 읽고, 마을의 신뢰로 산다'],
    axiomId: axiomId('psychic-life'),
    speciesIds: [hunterSpeciesId],
    readings: [huntReading],
    values: [trustValue],
    roles: [beater],
    ...overrides,
  };
}

const huntCulture: CultureArchetype = buildCulture(cultureSpec());
const riteCulture: CultureArchetype = buildCulture(
  cultureSpec({
    id: riteCultureId,
    name: '어미를 섬기는 자들',
    domain: 'transcendent',
    when: ['장막이 걷히는 자리에서 태어나 자란다'],
    then: ['붉은 빛을 어미의 숨으로 읽고, 기원을 쌓는다'],
    readings: [riteReading],
    values: [worshipValue],
    roles: [priest],
  }),
);

function check(culture: CultureArchetype): readonly string[] {
  return checkCulture(culture, [hunter], DEFINITIONS).map((violation) => violation.rule);
}

describe('S2-d 문화 원형 조립 — 종 위에 문화가 겹친다', () => {
  test('두 문화가 같은 종 위에 나란히 선다 — 그리고 여전히 O1 Rule 이다', () => {
    const report = checkCultures([huntCulture, riteCulture], [hunter], DEFINITIONS);
    assert.deepEqual(report.violations, []);
    assert.equal(report.complete, true);
    assert.equal(classify(huntCulture).kind, 'Rule');
    assert.equal(classify(riteCulture).kind, 'Rule');
    assert.equal(cultureVerdict(report), '문화 2개가 섰다 (자리 2개)');
  });

  test('같은 종·같은 씨앗의 둘이 문화로 갈린다', () => {
    const speciesSeed = seedFromSpecies(hunter, {
      subjectId: hunterId,
      bodyId,
      stage: '성체',
    });
    const hunterSide = seedWithCulture(speciesSeed, huntCulture, beater, where);
    const priestSide = seedWithCulture(
      seedFromSpecies(hunter, { subjectId: priestId, bodyId: null, stage: '성체' }),
      riteCulture,
      priest,
      { subjectId: priestId, bodyId: null },
    );

    // ① 감각은 같다 — 종이 준 것이므로 문화로 바뀌지 않는다
    assert.deepEqual(hunterSide.perception, priestSide.perception);
    assert.deepEqual(
      hunterSide.needs.map((need) => need.slot.path),
      priestSide.needs.map((need) => need.slot.path),
    );

    // ② 같은 붉은 빛을 다르게 읽는다
    const split = divergences(hunterSide.readings, priestSide.readings);
    assert.equal(split.length, 1);
    assert.equal(split[0]?.differs, true);
    assert.equal(split[0]?.left.assertion, '장막벌레가 지나간 자국이다');
    assert.equal(split[0]?.right.assertion, '어미가 숨을 내쉬었다');

    // ③ 원하는 자리가 다르다
    assert.deepEqual(
      hunterSide.values.map((value) => value.slot.path),
      [`trust.${villagersId}`],
    );
    assert.deepEqual(
      priestSide.values.map((value) => value.slot.path),
      ['worship'],
    );

    // ④ 할 수 있는 것이 다르다 — 하나는 막히고 하나는 열린다
    assert.deepEqual(hunterSide.capabilities, [trackId], '몰이꾼은 새기지 않는다');
    assert.deepEqual(priestSide.capabilities, [inscribeId, veilCallId], '사제는 쫓지 않고 부른다');

    // ⑤ 같은 씨앗은 언제나 같다
    assert.equal(
      stateHash(seedWithCulture(speciesSeed, huntCulture, beater, where)),
      stateHash(hunterSide),
    );
  });

  test('문화가 겹친 씨앗은 S0 주체를 그대로 세운다', () => {
    const seed = seedWithCulture(
      seedFromSpecies(hunter, { subjectId: hunterId, bodyId, stage: '성체' }),
      huntCulture,
      beater,
      where,
    );
    const spec: SubjectSpec = {
      speciesId: hunter.id,
      label: '사냥꾼 04',
      name: '사냥꾼 04',
      subjectKind: 'person',
      partOfId: null,
      boundaries: [{ kind: 'body', ofId: bodyId, note: '이 몸까지가 나다' }],
      perception: seed.perception,
      needs: seed.needs,
      values: seed.values,
      capabilities: seed.capabilities,
    };
    const subject = buildSubject(spec);
    assert.deepEqual(checkSubjectProfile(subject, DEFINITIONS), []);
    // 개체가 손으로 적은 것은 이름표와 경계뿐이다
    assert.equal(subject.values.length, 1);
    assert.equal(subject.values[0]?.holderId, hunterId);
  });

  test('자리 없이 문화만 지녀도 씨앗이 선다', () => {
    const seed = seedWithCulture(
      seedFromSpecies(hunter, { subjectId: hunterId, bodyId, stage: '성체' }),
      huntCulture,
      null,
      where,
    );
    assert.equal(seed.roleId, null);
    assert.deepEqual(seed.capabilities, [trackId, inscribeId], '금기가 없으니 종의 것 그대로다');
    assert.equal(seed.readings.length, 1);
  });

  test('종이 열지 않은 통로를 읽는 문화는 그 종에게 얹히지 않는다', () => {
    const psychicRite = buildCulture(
      cultureSpec({
        name: '떨림을 듣는 자들',
        readings: [
          {
            channel: 'psychic',
            sign: '남은 떨림',
            assertion: '어미가 아직 깨어 있다',
            confidence: 0.6,
            stance: 'avoid',
          },
        ],
      }),
    );
    assert.deepEqual(check(psychicRite), ['unsensed-reading']);
  });

  test('설 수 없는 문화는 각자의 사유로 거부된다', () => {
    assert.deepEqual(check(buildCulture(cultureSpec({ speciesIds: [] }))), [
      'speciesless-culture',
    ]);
    assert.deepEqual(
      check(buildCulture(cultureSpec({ speciesIds: [deterministicId('rule', 'species', '없는 종')] }))),
      ['unknown-species'],
    );
    assert.deepEqual(
      check(buildCulture(cultureSpec({ speciesIds: [hunterSpeciesId, hunterSpeciesId] }))),
      ['duplicate-culture-species'],
    );
    assert.deepEqual(check(buildCulture(cultureSpec({ readings: [] }))), ['unreadable-culture']);
    assert.deepEqual(check(buildCulture(cultureSpec({ values: [] }))), ['valueless-culture']);
    assert.deepEqual(check(buildCulture(cultureSpec({ roles: [] }))), ['roleless-culture']);
    assert.deepEqual(check(buildCulture(cultureSpec({ roles: [beater, beater] }))), [
      'duplicate-role',
    ]);
  });

  test('O1 Rule 로 서지 못하면 그 사유만 나온다 — 두 겹으로 쌓이지 않는다', () => {
    const broken = { ...huntCulture, when: [] } as CultureArchetype;
    const rules = check(broken);
    assert.ok(rules.length > 0);
    assert.deepEqual([...new Set(rules)], ['bad-culture']);
  });

  test('금기가 능력을 전부 막으면 그것은 문화가 아니라 소멸이다', () => {
    const silenced = buildCulture(
      cultureSpec({
        taboos: [trackId, inscribeId],
        roles: [beater],
      }),
    );
    assert.ok(check(silenced).includes('total-taboo'));

    // 문화가 이미 막은 것을 자리가 또 막으면 막을 것이 없다
    const doubled = buildCulture(cultureSpec({ taboos: [inscribeId], roles: [beater] }));
    assert.ok(check(doubled).includes('phantom-taboo'));
  });

  test('자리를 ID 로 찾는다', () => {
    assert.equal(roleOf(huntCulture, beater.id)?.name, '몰이꾼');
    assert.equal(roleOf(huntCulture, priest.id), null);
  });

  test('사람이 읽는 줄로 접힌다', () => {
    assert.match(cultureSummary(huntCulture), /자국을 쫓는 자들 — 읽기 1 · 원함 1 · 자리 몰이꾼/);
    assert.equal(cultureVerdict(checkCultures([], [hunter], DEFINITIONS)), '세울 문화가 없다');
    assert.match(
      cultureVerdict(checkCultures([buildCulture(cultureSpec({ roles: [] }))], [hunter], DEFINITIONS)),
      /^문화 1개가 막혔다/,
    );
  });
});
