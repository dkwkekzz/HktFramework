// S1 검증 시나리오 3종 — 종이 정말 개체를 낳는가, 그리고 설 수 없는 종은 어디서 막히는가.

import { stateHash } from '@hkt/core/v1';
import { classify } from '@hkt/core/o1';
import { validateDefinition } from '@hkt/core/o0';
import {
  answerFive,
  checkSubjectProfile,
  checkSubjects,
  type SubjectProfile,
} from '@hkt/core/s0';
import {
  archetypeVerdict,
  ages,
  birthStage,
  bodySummary,
  capabilitiesAt,
  checkArchetype,
  checkArchetypes,
  collapseTicksAt,
  growthStages,
  lifecycleSummary,
  lifespanTicks,
  perceptionOf,
  seedFromSpecies,
  stageAt,
  stageOf,
  type LifeStage,
} from '@hkt/core/s1';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BROKEN_SPECIES,
  guildArchetype,
  hunterArchetype,
  hunterBodyId,
  nestId,
  S1_DEFINITIONS,
  SPECIES_SPECS,
  veilWormArchetype,
  VEIL_SPECIES,
} from './s1-veil-species.ts';
import { hunterId, VEIL_SUBJECTS, wormsId } from './s0-veil-subjects.ts';

/** 정상 — 종 다섯이 서고, 그 종에서 태어난 개체가 S0 다섯 질문에 그대로 답한다. */
export const s1FiveSpeciesStand = defineScenario({
  id: 's1-five-species-stand',
  module: 'S1',
  kind: 'normal',
  purpose:
    '종 5종이 신체·감각·생애·기본 의존을 갖추고 서고, 종에서 찍어 낸 개체 다섯이 S0 관문을 그대로 지난다.',
  arrange: () => ({ species: VEIL_SPECIES, definitions: S1_DEFINITIONS }),
  act: ({ species, definitions }) => {
    const report = checkArchetypes(species, definitions);
    return {
      violations: report.violations.map((violation) => violation.rule),
      accepted: report.accepted.length,
      kinds: species.map((archetype) => archetype.subjectKind),
      // 원형은 여전히 O1 Rule 이고 O0 종 정의다 — 확장했지 빼지 않았다
      o1Kinds: [...new Set(species.map((archetype) => classify(archetype).kind))],
      axiomViolations: species.map((archetype) => validateDefinition(archetype).length),
      // 몸이 있는 종만 늙는다
      bodies: species.map((archetype) => bodySummary(archetype.body)),
      aging: species.map((archetype) => ages(archetype.lifecycle)),
      lifespans: species.map((archetype) => lifespanTicks(archetype.lifecycle)),
      // 종에서 태어난 개체 다섯이 S0 을 지난다 (S0 장면이 이미 씨앗으로 만들어져 있다)
      subjectViolations: checkSubjects(VEIL_SUBJECTS, definitions).violations.map(
        (violation) => violation.rule,
      ),
      answered: VEIL_SUBJECTS.map(
        (subject) => answerFive(subject, definitions).answeredCount,
      ),
      verdict: archetypeVerdict(report),
    };
  },
  assert: (result): Assertion[] => [
    expectState('종 다섯이 하나도 막히지 않는다', [], result.violations),
    expectState('다섯이 모두 섰다', 5, result.accepted),
    expectState(
      '주체 5종이 하나씩이다',
      ['person', 'creature', 'organization', 'nation', 'god'],
      result.kinds,
    ),
    expectState('원형은 여전히 O1 Rule 이다', ['Rule'], result.o1Kinds),
    expectState('원형은 여전히 O0 공리를 지난다', [0, 0, 0, 0, 0], result.axiomViolations),
    expectState(
      '몸이 있는 것은 사람과 생물뿐이다',
      [true, true, false, false, false],
      result.bodies.map((summary) => summary !== '몸이 없다'),
    ),
    expectState('몸이 있는 종만 늙는다', [true, true, false, false, false], result.aging),
    expectState('늙지 않는 종에게는 수명이 없다', [1000, 340, 0, 0, 0], result.lifespans),
    expectState('종에서 태어난 개체가 S0 을 그대로 지난다', [], result.subjectViolations),
    expectState('다섯이 각각 다섯 질문에 답한다', [5, 5, 5, 5, 5], result.answered),
    expectDeterministic('같은 선언이면 같은 종', () =>
      SPECIES_SPECS.map((spec) => spec.definition.id),
    ),
  ],
});

/** 실패 — 설 수 없는 종은 어느 자리에서 왜 막히는지가 함께 나온다. */
export const s1BrokenSpeciesRejected = defineScenario({
  id: 's1-broken-species-rejected',
  module: 'S1',
  kind: 'failure',
  purpose:
    '결함 종 14종이 각자의 사유·경로로 거부되고, 그 종에서 태어났을 개체가 세계에 들어가지 못한다.',
  arrange: () => ({ broken: BROKEN_SPECIES, definitions: S1_DEFINITIONS }),
  act: ({ broken, definitions }) => ({
    rejected: broken.map((entry) => ({
      broke: entry.broke,
      expected: entry.expected,
      actual: checkArchetype(entry.value, definitions)[0]?.rule ?? '(통과해 버렸다)',
    })),
    // 전부 O0 로서는 온전한 종 정의다 — S1 이 없으면 그대로 세계에 들어갔을 종들이다
    axiomVerdicts: [...new Set(broken.map((entry) => validateDefinition(entry.value).length))],
    paths: broken.map((entry) => checkArchetype(entry.value, definitions)[0]?.path ?? ''),
    // 막힌 종은 개체를 낳지 못한다 — 몸 없는 사냥꾼에서 태어난 개체는 S0 에서도 막힌다
    heirBlocked: (() => {
      const bodiless = broken[0]?.value;
      if (bodiless === undefined) return [];
      const seed = seedFromSpecies(bodiless, { subjectId: hunterId, bodyId: null, stage: '성체' });
      const heir = {
        ...(VEIL_SUBJECTS[0] as SubjectProfile),
        perception: seed.perception,
        needs: seed.needs,
        boundaries: [],
      };
      return checkSubjectProfile(heir, definitions).map((violation) => violation.rule);
    })(),
  }),
  assert: (result): Assertion[] => [
    expectState(
      '결함 종 14종이 각자의 사유로 걸린다',
      result.rejected.map((entry) => `${entry.broke} → ${entry.expected}`),
      result.rejected.map((entry) => `${entry.broke} → ${entry.actual}`),
    ),
    expectState('O0 로서는 전부 온전한 종 정의다 — S1 이 없으면 그대로 들어간다', [0], result.axiomVerdicts),
    expectTrue(
      '거부 사유는 고칠 자리를 그대로 가리킨다',
      result.paths.every((path) => path.startsWith('$.')),
      result.paths,
    ),
    expectState(
      '몸을 잃은 종의 개체는 S0 에서 경계도 감각도 함께 잃는다 — 몸이 열던 통로가 전부 닫힌다',
      ['unbounded-subject', 'bodiless-sense', 'bodiless-sense', 'bodiless-sense'],
      result.heirBlocked,
    ),
  ],
});

/** 경계 — 단계의 끝·대사의 끝·배수의 끝에서도 파생이 흔들리지 않는다. */
export const s1Boundary = defineScenario({
  id: 's1-boundary',
  module: 'S1',
  kind: 'boundary',
  purpose:
    '생애 단계의 경계 · 대사의 양끝 · 감각 배수의 클램프 · 빈 목록에서도 종에서 개체를 뽑는 일이 흔들리지 않는다.',
  arrange: () => ({ hunter: hunterArchetype, worm: veilWormArchetype, guild: guildArchetype }),
  act: ({ hunter, worm, guild }) => {
    const larva = stageOf(hunter.lifecycle, '유체') as LifeStage;
    const elder = stageOf(hunter.lifecycle, '노체') as LifeStage;
    const seedAt = (stage: string) =>
      seedFromSpecies(hunter, { subjectId: hunterId, bodyId: hunterBodyId, stage });
    return {
      // 단계 이름은 O2 자리의 선택지에서만 나온다
      options: [...growthStages()],
      stages: hunter.lifecycle.stages.map((stage) => stage.stage),
      // 단계의 경계 — 마지막 틱과 그 다음
      atBirth: stageAt(hunter.lifecycle, 0)?.stage ?? null,
      lastLarvaTick: stageAt(hunter.lifecycle, larva.ticks - 1)?.stage ?? null,
      firstAdultTick: stageAt(hunter.lifecycle, larva.ticks)?.stage ?? null,
      afterLifespan: stageAt(hunter.lifecycle, lifespanTicks(hunter.lifecycle)),
      // 대사가 붕괴 시한을 흔든다 — 같은 허기, 다른 시간
      collapse: ['유체', '성체', '노체'].map((name) =>
        collapseTicksAt(30, stageOf(hunter.lifecycle, name)),
      ),
      // 아무리 빨리 태워도 즉사보다 짧아지지 않는다
      instant: collapseTicksAt(1, larva),
      // 늙지 않는 종은 기준 시한 그대로
      ageless: collapseTicksAt(120, null),
      // 감각도 단계를 탄다 — 유체는 210m, 성체는 300m, 노체는 180m
      lightRange: ['유체', '성체', '노체'].map(
        (name) => seedAt(name).perception.channels[0]?.range ?? 0,
      ),
      // 능력은 누적된다 — 유체는 하나, 성체부터 둘
      capabilityCounts: ['유체', '성체', '노체'].map((name) => seedAt(name).capabilities.length),
      // 늙지 않는 종은 단계를 물어도 null 이고 능력은 종의 것 그대로
      guildStage: birthStage(guild),
      guildSeed: seedFromSpecies(guild, { subjectId: hunterId, bodyId: null }).capabilities.length,
      // 없는 단계로 태어나려 하면 단계 없이 태어난다 (기준값 그대로)
      unknownStage: seedFromSpecies(hunter, {
        subjectId: hunterId,
        bodyId: hunterBodyId,
        stage: '씨',
      }).needs[0]?.collapseAfterTicks,
      // 빈 목록
      emptyReport: checkArchetypes([], S1_DEFINITIONS).complete,
      emptyVerdict: archetypeVerdict(checkArchetypes([], S1_DEFINITIONS)),
      emptySenses: perceptionOf([], 2).channels.length,
      emptyCapabilities: capabilitiesAt({ stages: [] }, null).length,
      // 유체 장막벌레는 냄새가 16m 까지만 닿는다 (40 × 0.4)
      wormLarvaSmell:
        seedFromSpecies(worm, { subjectId: wormsId, bodyId: nestId, stage: '유체' }).perception
          .channels[0]?.range ?? 0,
      summaries: [lifecycleSummary(hunter.lifecycle), lifecycleSummary(guild.lifecycle)],
      elderMetabolism: elder.metabolism,
    };
  },
  assert: (result): Assertion[] => [
    expectState('O2 growthStage 의 선택지', ['씨', '유체', '성체', '노체'], result.options),
    expectState('사냥꾼은 그중 셋을 지난다', ['유체', '성체', '노체'], result.stages),
    expectState(
      '단계의 경계는 마지막 틱과 그 다음에서 갈린다',
      ['유체', '유체', '성체', null],
      [result.atBirth, result.lastLarvaTick, result.firstAdultTick, result.afterLifespan],
    ),
    expectState('같은 허기라도 유체는 20틱, 성체는 30틱, 노체는 40틱', [20, 30, 40], result.collapse),
    expectState('아무리 빨리 태워도 즉사보다 짧아지지 않는다', 1, result.instant),
    expectState('늙지 않는 종은 기준 시한 그대로다', 120, result.ageless),
    expectState('빛이 닿는 거리도 단계를 탄다', [210, 300, 180], result.lightRange),
    expectState('능력은 단계와 함께 누적된다', [1, 2, 2], result.capabilityCounts),
    expectState('늙지 않는 종은 단계가 없다', null, result.guildStage),
    expectState('늙지 않는 종의 개체는 종의 능력을 그대로 받는다', 1, result.guildSeed),
    expectState('이 종이 지나지 않는 단계로는 태어날 수 없다 — 기준 시한 그대로다', 30, result.unknownStage),
    expectTrue('세울 종이 없으면 완결이 아니다', !result.emptyReport),
    expectState('세울 종이 없다는 사실이 문장으로 나온다', '세울 종이 없다', result.emptyVerdict),
    expectState('빈 감각·빈 생애는 빈 채로 나온다', [0, 0], [
      result.emptySenses,
      result.emptyCapabilities,
    ]),
    expectState('유체 장막벌레의 냄새는 16m 까지만 닿는다', 16, result.wormLarvaSmell),
    expectState('노체는 느려진다', 0.75, result.elderMetabolism),
    expectState(
      '생애를 한 줄로 접으면 수명이 함께 보인다',
      [
        '유체 200틱 (대사 1.5) → 성체 600틱 (대사 1) → 노체 200틱 (대사 0.75) · 수명 1000틱',
        '늙지 않는다',
      ],
      result.summaries,
    ),
    expectDeterministic('같은 종·같은 자리·같은 단계면 같은 씨앗', () =>
      stateHash(
        seedFromSpecies(hunterArchetype, {
          subjectId: hunterId,
          bodyId: hunterBodyId,
          stage: '성체',
        }),
      ),
    ),
  ],
});

export const s1Scenarios = [s1FiveSpeciesStand, s1BrokenSpeciesRejected, s1Boundary] as const;
