// S2 검증 시나리오 3종 — 문화가 정말 같은 종의 둘을 가르는가, 그리고 설 수 없는 문화는 어디서 막히는가.

import { stateHash, type Id } from '@hkt/core/v1';
import { classify } from '@hkt/core/o1';
import {
  buildSubject,
  checkSubjectProfile,
  subjectIdOf,
  type SubjectSpec,
} from '@hkt/core/s0';
import { seedFromSpecies } from '@hkt/core/s1';
import {
  applyRole,
  checkCulture,
  checkCultures,
  cultureVerdict,
  divergences,
  mergeReadings,
  mergeValues,
  readingClaim,
  roleOf,
  seedWithCulture,
  sensedChannels,
  type SubjectSeed,
} from '@hkt/core/s2';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  hunterArchetype,
  hunterBodyId,
  veilWormArchetype,
  VEIL_SPECIES,
} from './s1-veil-species.ts';
import {
  beaterRole,
  BROKEN_CULTURES,
  brokerRole,
  followerRole,
  huntCulture,
  porterRole,
  priestRole,
  riteCulture,
  S2_DEFINITIONS,
  tradeCulture,
  VEIL_CULTURES,
} from './s2-veil-cultures.ts';
import { veilId } from './o0-veil-definitions.ts';

/** 같은 사냥꾼 종에서 태어난 셋 — 문화만 다르다. */
const HUNTER_LABELS = ['사냥꾼 04', '사냥꾼 09', '사냥꾼 21'] as const;
const HUNTER_IDS: readonly Id[] = HUNTER_LABELS.map((label) =>
  subjectIdOf(hunterArchetype.id, label),
);
const [tracker, priest, porter] = HUNTER_IDS as readonly [Id, Id, Id];

/** 성체 사냥꾼 하나가 한 문화·한 자리 위에 선다. */
function bornInto(
  subjectId: Id,
  culture: (typeof VEIL_CULTURES)[number],
  roleId: string | null,
): SubjectSeed {
  const seed = seedFromSpecies(hunterArchetype, {
    subjectId,
    bodyId: hunterBodyId,
    stage: '성체',
  });
  return seedWithCulture(
    seed,
    culture,
    roleId === null ? null : roleOf(culture, roleId),
    { subjectId, bodyId: hunterBodyId },
  );
}

/** 씨앗 하나를 S0 주체로 세운다 — 개체가 손으로 적는 것은 이름표와 경계뿐이다. */
function stand(seed: SubjectSeed, label: string): SubjectSpec {
  return {
    speciesId: hunterArchetype.id,
    label,
    name: label,
    subjectKind: 'person',
    partOfId: null,
    boundaries: [{ kind: 'body', ofId: hunterBodyId, note: '이 몸까지가 나다' }],
    perception: seed.perception,
    needs: seed.needs,
    values: seed.values,
    capabilities: seed.capabilities,
  };
}

/** 정상 — 같은 종·같은 씨앗의 셋이 문화로 갈리고, 그 개체가 S0 을 그대로 지난다. */
export const s2SameSpeciesDiverges = defineScenario({
  id: 's2-same-species-diverges',
  module: 'S2',
  kind: 'normal',
  purpose:
    '문화 3종이 사냥꾼 종 위에 서고, 같은 빛을 보는 셋이 서로 다르게 읽고 다른 것을 원하고 다른 것을 할 수 있게 된다.',
  arrange: () => ({ cultures: VEIL_CULTURES, species: VEIL_SPECIES, definitions: S2_DEFINITIONS }),
  act: ({ cultures, species, definitions }) => {
    const report = checkCultures(cultures, species, definitions);

    const trackerSeed = bornInto(tracker, huntCulture, beaterRole.id);
    const priestSeed = bornInto(priest, riteCulture, priestRole.id);
    const porterSeed = bornInto(porter, tradeCulture, porterRole.id);
    const seeds = [trackerSeed, priestSeed, porterSeed];

    const subjects = [
      buildSubject(stand(trackerSeed, HUNTER_LABELS[0])),
      buildSubject(stand(priestSeed, HUNTER_LABELS[1])),
      buildSubject(stand(porterSeed, HUNTER_LABELS[2])),
    ];

    /** 같은 표식 하나 — 세 문화가 전부 읽는 붉은 장막의 빛. */
    const veilLight = (seed: SubjectSeed) =>
      seed.readings.find(
        (reading) => reading.channel === 'light' && reading.sign === '붉은 장막의 빛',
      );

    return {
      violations: report.violations.map((violation) => violation.rule),
      verdict: cultureVerdict(report),
      // 문화·역할은 여전히 O1 Rule 이다 — 확장했지 빼지 않았다
      o1Kinds: [
        ...new Set([
          ...cultures.map((culture) => classify(culture).kind),
          ...cultures.flatMap((culture) => culture.roles.map((role) => classify(role).kind)),
        ]),
      ],
      // ① 종이 준 것은 그대로다 — 문화가 감각과 의존을 바꾸지는 않는다
      perceptionHashes: [...new Set(seeds.map((seed) => stateHash(seed.perception)))],
      // 무너질 조건도 하나다 — 누구의 자리인지(holderId)만 개체마다 다르다
      needHashes: [
        ...new Set(
          seeds.map((seed) =>
            stateHash(
              seed.needs.map((need) => ({
                slot: need.slot,
                band: need.band,
                urgency: need.urgency,
                collapseAfterTicks: need.collapseAfterTicks,
              })),
            ),
          ),
        ),
      ],
      // ② 같은 빛을 다르게 읽는다
      assertions: seeds.map((seed) => veilLight(seed)?.assertion ?? '(읽지 않는다)'),
      stances: seeds.map((seed) => veilLight(seed)?.stance ?? null),
      // ③ 원하는 자리가 다르다
      wants: seeds.map((seed) => seed.values.map((value) => value.slot.path).sort().join(' · ')),
      // ④ 할 수 있는 것이 다르다
      capabilityCounts: seeds.map((seed) => seed.capabilities.length),
      priestCallsVeil: priestSeed.capabilities.includes(veilId),
      trackerCallsVeil: trackerSeed.capabilities.includes(veilId),
      // 문화가 겹친 개체가 S0 관문을 그대로 지난다
      subjectViolations: subjects.flatMap((subject) =>
        checkSubjectProfile(subject, definitions).map((violation) => violation.rule),
      ),
      // 읽기는 O1 Claim 이 된다 — 실제가 아니라 믿음이다
      claimKinds: [
        ...new Set(
          seeds.map((seed, index) => {
            const reading = veilLight(seed);
            if (reading === undefined) return null;
            const holder = HUNTER_IDS[index] ?? tracker;
            return classify(readingClaim(seed.cultureId, reading, holder, hunterBodyId)).kind;
          }),
        ),
      ],
    };
  },
  assert: (result): Assertion[] => [
    expectState('문화 셋이 하나도 막히지 않는다', [], result.violations),
    expectState('문화 3개 · 자리 6개가 섰다', '문화 3개가 섰다 (자리 6개)', result.verdict),
    expectState('문화도 자리도 여전히 O1 Rule 이다', ['Rule'], result.o1Kinds),
    expectTrue('셋의 감각은 하나다 — 종이 준 것은 문화로 바뀌지 않는다', result.perceptionHashes.length === 1, result.perceptionHashes),
    expectTrue('셋의 무너질 조건도 하나다', result.needHashes.length === 1, result.needHashes),
    expectState(
      '같은 붉은 빛을 셋이 다르게 읽는다',
      [
        '장막벌레가 방금 지나갔다 — 둥지가 가깝다',
        '어미가 숨을 내쉬었다 — 이 자리는 어미의 것이다',
        '고개가 막혔다 — 값이 오른다',
      ],
      result.assertions,
    ),
    expectState('그래서 셋이 서로 다른 쪽으로 움직인다', ['approach', 'avoid', 'observe'], result.stances),
    expectTrue(
      '원하는 자리가 셋 다 다르다',
      new Set(result.wants).size === 3,
      result.wants,
    ),
    expectState('할 수 있는 것의 수도 갈린다', [1, 2, 1], result.capabilityCounts),
    expectTrue('사제만 장막을 부른다', result.priestCallsVeil && !result.trackerCallsVeil, {
      priest: result.priestCallsVeil,
      tracker: result.trackerCallsVeil,
    }),
    expectState('문화가 겹친 개체가 S0 을 그대로 지난다', [], result.subjectViolations),
    expectState('읽기는 O1 Claim 이 된다', ['Claim'], result.claimKinds),
    expectDeterministic('같은 종·같은 문화·같은 자리면 언제나 같은 개체다', () =>
      stateHash(bornInto(tracker, huntCulture, beaterRole.id)),
    ),
  ],
});

/** 실패 — 설 수 없는 문화는 어느 자리에서 왜 막히는지가 함께 나온다. */
export const s2BrokenCulturesRejected = defineScenario({
  id: 's2-broken-cultures-rejected',
  module: 'S2',
  kind: 'failure',
  purpose:
    '결함 문화 15종이 각자의 사유·경로로 거부되고, 종을 넘어서려는 문화가 그 종에게 얹히지 못한다.',
  arrange: () => ({
    broken: BROKEN_CULTURES,
    species: VEIL_SPECIES,
    definitions: S2_DEFINITIONS,
  }),
  act: ({ broken, species, definitions }) => ({
    rejected: broken.map((entry) => ({
      broke: entry.broke,
      expected: entry.expected,
      actual: checkCulture(entry.value, species, definitions)[0]?.rule ?? '(통과해 버렸다)',
    })),
    paths: broken.map(
      (entry) => checkCulture(entry.value, species, definitions)[0]?.path ?? '',
    ),
    // 사유마다 어느 문화·어느 자리에서 걸렸는지가 실린다
    named: broken.every(
      (entry) => (checkCulture(entry.value, species, definitions)[0]?.cultureName ?? '') !== '',
    ),
    // 장막벌레는 빛을 열지 않는다 — 그래서 빛의 문화가 얹히지 않는다
    wormChannels: [...sensedChannels(veilWormArchetype.senses)],
    hunterChannels: [...sensedChannels(hunterArchetype.senses)],
  }),
  assert: (result): Assertion[] => [
    expectState(
      '결함 문화 15종이 각자의 사유로 걸린다',
      result.rejected.map((entry) => `${entry.broke} → ${entry.expected}`),
      result.rejected.map((entry) => `${entry.broke} → ${entry.actual}`),
    ),
    expectTrue(
      '거부 사유는 고칠 자리를 그대로 가리킨다',
      result.paths.every((path) => path.startsWith('$')),
      result.paths,
    ),
    expectTrue('어느 문화가 막혔는지가 함께 실린다', result.named, result.named),
    expectState('장막벌레의 통로', ['smell', 'psychic'], result.wormChannels),
    expectState('사냥꾼의 통로', ['light', 'sound', 'trace', 'report'], result.hunterChannels),
  ],
});

/** 경계 — 자리 없음·덮기·전부 금기·빈 목록에서도 겹침이 흔들리지 않는다. */
export const s2Boundary = defineScenario({
  id: 's2-boundary',
  module: 'S2',
  kind: 'boundary',
  purpose:
    '자리 없이 문화만 지닌 개체 · 역할이 문화를 덮는 자리 · 아무것도 열지 않는 자리 · 빈 목록에서도 겹침이 흔들리지 않는다.',
  arrange: () => ({ cultures: VEIL_CULTURES, species: VEIL_SPECIES, definitions: S2_DEFINITIONS }),
  act: ({ species, definitions }) => {
    const bare = bornInto(tracker, huntCulture, null);
    const beater = bornInto(tracker, huntCulture, beaterRole.id);
    const follower = bornInto(priest, riteCulture, followerRole.id);
    const broker = bornInto(porter, tradeCulture, brokerRole.id);

    return {
      // 자리 없이 문화만 지녀도 선다 — 능력은 종의 것 그대로
      bareRole: bare.roleId,
      bareCapabilities: bare.capabilities.length,
      speciesCapabilities: hunterArchetype.capabilities.length,
      // 자리가 금기를 걸면 하나가 빠진다
      beaterCapabilities: beater.capabilities.length,
      // 자리의 읽기가 문화 위에 덧대진다 (덮을 표식이 없으면 늘어난다)
      cultureReadings: huntCulture.readings.length,
      beaterReadings: beater.readings.length,
      // 자리의 원함이 문화의 같은 자리를 덮는다 — 늘지 않고 세기만 바뀐다
      riteValues: riteCulture.values.length,
      followerValues: follower.values.length,
      followerConviction: follower.values.find((value) => value.slot.path === 'conviction')?.weight,
      cultureConviction: riteCulture.values.find((value) => value.slot.path === 'conviction')?.weight,
      // 거간은 값을 더 세게 민다 (문화 0.8 → 자리 1)
      brokerPrice: broker.values.find((value) => value.slot.path.startsWith('price.'))?.weight,
      // 아무것도 열지 않는 자리도 금기가 없으면 종의 것 그대로다
      followerCapabilities: follower.capabilities.length,
      // 겹침의 양끝
      emptyApply: applyRole([], [], []).length,
      allBlocked: applyRole(hunterArchetype.capabilities, [], [...hunterArchetype.capabilities]).length,
      emptyMergeReadings: mergeReadings(huntCulture.readings, []).length,
      emptyMergeValues: mergeValues(huntCulture.values, []).length,
      // 빈 목록
      emptyReport: checkCultures([], species, definitions).complete,
      emptyVerdict: cultureVerdict(checkCultures([], species, definitions)),
      // 같은 표식을 두고 갈리는 자리 — 세 문화가 전부 붉은 장막의 빛을 읽는다
      huntVsRite: divergences(huntCulture.readings, riteCulture.readings).map((entry) => ({
        sign: entry.sign,
        differs: entry.differs,
      })),
      huntVsSelf: divergences(huntCulture.readings, huntCulture.readings).map(
        (entry) => entry.differs,
      ),
    };
  },
  assert: (result): Assertion[] => [
    expectState('자리 없이 문화만 지니면 자리는 비어 있다', null, result.bareRole),
    expectState('그때 능력은 종의 것 그대로다', result.speciesCapabilities, result.bareCapabilities),
    expectState('몰이꾼은 금기 하나로 하나를 잃는다', 1, result.beaterCapabilities),
    expectState('덮을 표식이 없는 자리의 읽기는 더해진다', result.cultureReadings + 1, result.beaterReadings),
    expectState('덮는 자리의 원함은 늘지 않는다', result.riteValues, result.followerValues),
    expectTrue(
      '신도는 문화보다 더 세게 믿는다 — 자리가 문화를 덮었다',
      (result.followerConviction ?? 0) > (result.cultureConviction ?? 1),
      { role: result.followerConviction, culture: result.cultureConviction },
    ),
    expectState('거간은 값을 끝까지 민다', 1, result.brokerPrice),
    expectState('금기 없는 자리는 종의 능력을 그대로 지닌다', result.speciesCapabilities, result.followerCapabilities),
    expectState('빈 겹침은 빈 목록이다', 0, result.emptyApply),
    expectState('전부 금기면 아무것도 남지 않는다', 0, result.allBlocked),
    expectState('빈 덮기는 원본 그대로다 — 읽기', result.cultureReadings, result.emptyMergeReadings),
    expectState('빈 덮기는 원본 그대로다 — 원함', huntCulture.values.length, result.emptyMergeValues),
    expectState('세울 문화가 없으면 완결도 없다', false, result.emptyReport),
    expectState('그 판정은 한 줄로 남는다', '세울 문화가 없다', result.emptyVerdict),
    expectState(
      '사냥과 제의는 겹치는 표식 둘에서 전부 갈린다',
      [
        { sign: '붉은 장막의 빛', differs: true },
        { sign: '눌린 이끼', differs: true },
      ],
      result.huntVsRite,
    ),
    expectState('자기 자신과는 갈리지 않는다', [false, false], result.huntVsSelf),
  ],
});

export const s2Scenarios = [s2SameSpeciesDiverges, s2BrokenCulturesRejected, s2Boundary];
