// S3 검증 시나리오 3종 — 이력과 성격이 정말 개체를 가르는가, 그리고 모든 값이 유래를 대는가.

import { stateHash } from '@hkt/core/v1';
import { classify } from '@hkt/core/o1';
import { answerFive } from '@hkt/core/s0';
import {
  buildInstance,
  capabilityKey,
  checkInstance,
  checkInstances,
  historyResidue,
  instanceVerdict,
  needKey,
  originCounts,
  originOf,
  readingKey,
  scaleFor,
  tunableKeys,
  tuned,
  tuneTable,
  valueKey,
  VALUE_ORIGINS,
  type SubjectInstance,
} from '@hkt/core/s3';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import { hunterArchetype, villagersId } from './s1-veil-species.ts';
import {
  bareInstance,
  BROKEN_INSTANCES,
  greedyInstance,
  greedyTrait,
  INSTANCE_SPECS,
  priestInstance,
  S3_DEFINITIONS,
  timidTrait,
  trackerInstance,
  VEIL_CULTURES,
  VEIL_INSTANCES,
} from './s3-veil-instances.ts';

/** 세 몰이꾼이 공유하는 표식 하나 — 붉은 장막의 빛. */
const confidenceOf = (instance: SubjectInstance): number | null =>
  instance.readings.find((reading) => reading.sign === '붉은 장막의 빛')?.confidence ?? null;

/** 정상 — 같은 문화·같은 자리의 셋이 이력과 성격으로 갈리고, 모든 값이 유래를 댄다. */
export const s3SameCultureDiverges = defineScenario({
  id: 's3-same-culture-diverges',
  module: 'S3',
  kind: 'normal',
  purpose:
    '같은 종·같은 문화·같은 자리에 선 셋이 지고 온 것과 타고난 기울기로 갈리고, 그 개체의 모든 값이 종·문화·자리·이력·성격 중 하나를 유래로 댄다.',
  arrange: () => ({
    instances: VEIL_INSTANCES,
    cultures: VEIL_CULTURES,
    definitions: S3_DEFINITIONS,
  }),
  act: ({ instances, cultures, definitions }) => {
    const report = checkInstances(instances, cultures, definitions);
    const beaters = [trackerInstance, greedyInstance, bareInstance];

    return {
      violations: report.violations.map((violation) => violation.rule),
      verdict: instanceVerdict(report),
      // 개체는 여전히 O1 Subject 이고 S0 다섯 질문에 답한다 — 확장했지 빼지 않았다
      o1Kinds: [...new Set(instances.map((instance) => classify(instance).kind))],
      answered: instances.map((instance) => answerFive(instance, definitions).answeredCount),

      // ① 종이 준 것은 셋이 같다 — 이력도 성격도 감각을 바꾸지 않는다
      perceptionHashes: [...new Set(beaters.map((instance) => stateHash(instance.perception)))],
      needSlots: [
        ...new Set(
          beaters.map((instance) => instance.needs.map((need) => need.slot.path).join(',')),
        ),
      ],
      // ② 성격이 값을 흔든다 — 같은 허기가 셋 다 다른 급함이 된다
      urgencies: beaters.map((instance) => instance.needs[0]?.urgency ?? 0),
      confidences: beaters.map((instance) => confidenceOf(instance)),
      trustWeights: beaters.map(
        (instance) =>
          instance.values.find((value) => value.slot.path.startsWith('trust.'))?.weight ?? 0,
      ),
      // ③ 이력이 지금 남긴 값이 다르다
      residueSlots: beaters.map((instance) =>
        instance.residue.map((entry) => `${entry.slot.domain}:${entry.slot.path.split('.')[0] ?? ''}`).join(' · '),
      ),
      // ④ 모든 값이 유래를 댄다
      trackerOrigins: originCounts(trackerInstance),
      bareOrigins: originCounts(bareInstance),
      // 흔든 값은 성격이, 흔들지 않은 같은 자리는 종이 유래다
      hungerOrigin: [trackerInstance, bareInstance].map(
        (instance) =>
          originOf(instance, needKey(instance.needs[0] as never))?.origin ?? '(못 댄다)',
      ),
      // 원함은 문화와 자리로 갈린다
      valueOrigins: priestInstance.values.map(
        (value) => originOf(priestInstance, valueKey(value))?.origin ?? '(못 댄다)',
      ),
      // 능력도 종과 자리로 갈린다
      capabilityOrigins: priestInstance.capabilities.map(
        (id) => originOf(priestInstance, capabilityKey(id))?.origin ?? '(못 댄다)',
      ),
      // 이력이 남긴 값은 어느 사건이 남겼는지까지 댄다
      residueFrom:
        originOf(trackerInstance, `residue:relational.debt.${villagersId}`)?.from ?? '(못 댄다)',
      // 개체가 스스로 적는 것은 경계뿐이다
      selfOrigin: originOf(trackerInstance, 'boundary:body')?.origin ?? '(못 댄다)',
    };
  },
  assert: (result): Assertion[] => [
    expectState('개체 넷이 하나도 막히지 않는다', [], result.violations),
    expectState('넷이 섰다', '개체 4명이 섰다 (문화 2개)', result.verdict),
    expectState('개체는 여전히 O1 Subject 다', ['Subject'], result.o1Kinds),
    expectState('넷이 각각 다섯 질문에 답한다', [5, 5, 5, 5], result.answered),
    expectTrue(
      '몰이꾼 셋의 감각은 하나다 — 이력도 성격도 눈을 바꾸지 않는다',
      result.perceptionHashes.length === 1,
      result.perceptionHashes,
    ),
    expectTrue(
      '무너질 자리도 하나다',
      result.needSlots.length === 1,
      result.needSlots,
    ),
    expectState(
      '그런데 허기의 급함은 셋 다 다르다 (겁 ×1.4 → 상한 1 · 그대로 0.8 · 욕심 ×0.7)',
      [1, 0.56, 0.8],
      result.urgencies.map((value) => Math.round(value * 100) / 100),
    ),
    expectState(
      '같은 빛에 대한 확신도 갈린다 (겁 ×0.6 · 그대로 · 그대로)',
      [0.42, 0.7, 0.7],
      result.confidences.map((value) => Math.round((value ?? 0) * 100) / 100),
    ),
    expectState(
      '마을을 미는 힘도 갈린다 (그대로 · 욕심 ×1.3 · 그대로)',
      [0.7, 0.91, 0.7],
      result.trustWeights.map((value) => Math.round(value * 100) / 100),
    ),
    expectState(
      '지고 온 것이 지금 남긴 자리가 다르다',
      ['relational:debt · biological:vitality', 'relational:grudge · relational:trust', ''],
      result.residueSlots,
    ),
    expectState(
      '04 의 값은 종 2 · 문화 2 · 자리 1 · 이력 2 · 성격 2 · 개체 1 에서 온다',
      { species: 2, culture: 2, role: 1, history: 2, trait: 2, self: 1 },
      result.trackerOrigins,
    ),
    expectState(
      '23 은 지고 온 것도 기울기도 없다 — 전부 종·문화·자리에서 온다',
      { species: 3, culture: 3, role: 1, history: 0, trait: 0, self: 1 },
      result.bareOrigins,
    ),
    expectState(
      '흔든 값은 성격이, 흔들지 않은 같은 자리는 종이 유래다',
      ['trait', 'species'],
      result.hungerOrigin,
    ),
    expectState('사제의 원함은 문화 둘이다', ['culture', 'culture'], result.valueOrigins),
    expectState('사제의 능력은 종 하나 + 자리 하나다', ['species', 'role'], result.capabilityOrigins),
    expectState('빚은 창고를 연 그 겨울에서 왔다', '겨울에 마을 창고를 열었다', result.residueFrom),
    expectState('경계만이 개체 자신의 것이다', 'self', result.selfOrigin),
    expectDeterministic('같은 선언이면 언제나 같은 개체다', () =>
      stateHash(INSTANCE_SPECS.map((spec) => buildInstance(spec))),
    ),
  ],
});

/** 실패 — 설 수 없는 개체는 어느 자리에서 왜 막히는지가 함께 나온다. */
export const s3BrokenInstancesRejected = defineScenario({
  id: 's3-broken-instances-rejected',
  module: 'S3',
  kind: 'failure',
  purpose:
    '결함 개체 13종이 각자의 사유·경로로 거부되고, 유래를 못 대는 값 하나가 개체 전체를 막는다.',
  arrange: () => ({
    broken: BROKEN_INSTANCES,
    cultures: VEIL_CULTURES,
    definitions: S3_DEFINITIONS,
  }),
  act: ({ broken, cultures, definitions }) => {
    const firstOf = (value: SubjectInstance) =>
      checkInstance(
        value,
        cultures.find((culture) => culture.id === value.cultureId) ?? null,
        definitions,
      )[0];

    return {
      rejected: broken.map((entry) => ({
        broke: entry.broke,
        expected: entry.expected,
        actual: firstOf(entry.value)?.rule ?? '(통과해 버렸다)',
      })),
      paths: broken.map((entry) => firstOf(entry.value)?.path ?? ''),
      // 개체가 누구인지가 늘 실린다 — 이름표를 지운 개체는 ID 로만 지목된다
      identified: broken.every((entry) => (firstOf(entry.value)?.subjectId ?? '') !== ''),
      namedCount: broken.filter((entry) => (firstOf(entry.value)?.subjectName ?? '') !== '').length,
      // 유래 없는 능력은 세계에 실재하는 능력이다 — S0 는 통과시킨다. 막는 것은 유래뿐이다
      orphanIsLawful: (() => {
        const orphan = broken.find((entry) => entry.expected === 'orphan-value');
        if (orphan === undefined) return [];
        return checkInstance(orphan.value, null, definitions).map((violation) => violation.rule);
      })(),
    };
  },
  assert: (result): Assertion[] => [
    expectState(
      '결함 개체 13종이 각자의 사유로 걸린다',
      result.rejected.map((entry) => `${entry.broke} → ${entry.expected}`),
      result.rejected.map((entry) => `${entry.broke} → ${entry.actual}`),
    ),
    expectTrue(
      '거부 사유는 고칠 자리를 그대로 가리킨다',
      result.paths.every((path) => path.startsWith('$')),
      result.paths,
    ),
    expectTrue('어느 개체가 막혔는지가 늘 실린다', result.identified, result.identified),
    expectState(
      '이름표를 지운 하나만 이름 없이 ID 로 지목된다',
      BROKEN_INSTANCES.length - 1,
      result.namedCount,
    ),
    expectState(
      '유래 없는 능력은 O0·S0 를 지나도 막힌다 — 지어낸 값은 실재해도 개체의 것이 아니다',
      ['orphan-value'],
      result.orphanIsLawful,
    ),
  ],
});

/** 경계 — 지고 온 것 없음·기울기 없음·배수의 끝·유래 여섯 갈래. */
export const s3Boundary = defineScenario({
  id: 's3-boundary',
  module: 'S3',
  kind: 'boundary',
  purpose:
    '이력 없는 개체 · 성격 없는 개체 · 배수가 상한을 넘는 자리 · 빈 목록에서도 조립이 흔들리지 않는다.',
  arrange: () => ({ instances: VEIL_INSTANCES, definitions: S3_DEFINITIONS }),
  act: ({ instances, definitions }) => {
    const table = tuneTable([timidTrait, greedyTrait]);
    const bareSpec = INSTANCE_SPECS[2];

    return {
      origins: [...VALUE_ORIGINS],
      // 지고 온 것도 기울기도 없는 개체 — 종·문화가 준 것 그대로
      bareResidue: bareInstance.residue.length,
      bareHistory: bareInstance.history.length,
      bareTraits: bareInstance.traits.length,
      bareUrgency: bareInstance.needs[0]?.urgency ?? 0,
      speciesUrgency: hunterArchetype.baseNeeds[0]?.urgency ?? 0,
      // 성격은 상한을 넘기지 못한다 — 0.8 × 1.4 는 1 에서 멈춘다
      clamped: tuned(0.8, 1.4),
      raw: 0.8 * 1.4,
      // 사제의 확신은 0.95 × 2 여도 1 이다
      priestConfidence: confidenceOf(priestInstance),
      // 흔들지 않는 자리의 배수는 1 이다
      untouched: scaleFor(table, 'need-urgency', 'vitality'),
      // 성격이 흔들 수 있는 자리 = 이 개체가 실제로 가진 자리
      tunable: tunableKeys(trackerInstance),
      // 자리 없이 문화만 지녀도 개체는 선다
      roleless: (() => {
        if (bareSpec === undefined) return null;
        const instance = buildInstance({ ...bareSpec, role: null });
        return {
          roleId: instance.roleId,
          capabilities: instance.capabilities.length,
          violations: checkInstance(instance, null, definitions).length,
          roleOrigins: originCounts(instance).role,
        };
      })(),
      // 이력이 비면 남는 것도 없다
      emptyResidue: historyResidue([]).length,
      // 빈 목록
      emptyReport: checkInstances([], [], definitions).complete,
      emptyVerdict: instanceVerdict(checkInstances([], [], definitions)),
      // 모든 개체의 모든 값이 유래를 댄다 (유래 없는 값 0)
      orphans: instances.flatMap((instance) =>
        [
          ...instance.needs.map((need) => needKey(need)),
          ...instance.values.map((value) => valueKey(value)),
          ...instance.readings.map((reading) => readingKey(reading)),
          ...instance.capabilities.map((id) => capabilityKey(id)),
        ].filter((key) => originOf(instance, key) === null),
      ),
    };
  },
  assert: (result): Assertion[] => [
    expectState(
      '값이 올 수 있는 곳은 여섯이다',
      ['species', 'culture', 'role', 'history', 'trait', 'self'],
      result.origins,
    ),
    expectState('지고 온 것이 없으면 남는 것도 없다', 0, result.bareResidue),
    expectState('기울기가 없으면 흔들리지 않는다', 0, result.bareTraits),
    expectState('그때 급함은 종의 값 그대로다', result.speciesUrgency, result.bareUrgency),
    expectState('성격은 상한을 넘기지 못한다', 1, result.clamped),
    expectTrue('흔들지 않았다면 1.12 였을 것이다', result.raw > 1, result.raw),
    expectState('사제의 확신도 1 에서 멈춘다', 1, result.priestConfidence),
    expectState('흔들지 않는 자리의 배수는 1 이다', 1, result.untouched),
    expectState('흔들 수 있는 것은 이 개체가 가진 자리뿐이다', ['hunger', 'vitality'], [
      ...result.tunable.needs,
    ]),
    expectState('자리 없이 문화만 지녀도 개체는 선다', 0, result.roleless?.violations ?? -1),
    expectState('그때 자리가 유래인 값은 없다', 0, result.roleless?.roleOrigins ?? -1),
    expectState('그리고 자리가 없다', null, result.roleless === null ? '(못 세웠다)' : result.roleless.roleId),
    expectState('빈 이력은 빈 값이다', 0, result.emptyResidue),
    expectState('세울 개체가 없으면 완결도 없다', false, result.emptyReport),
    expectState('그 판정은 한 줄로 남는다', '세울 개체가 없다', result.emptyVerdict),
    expectState('유래를 못 대는 값이 하나도 없다', [], result.orphans),
  ],
});

export const s3Scenarios = [s3SameCultureDiverges, s3BrokenInstancesRejected, s3Boundary];
