// S0 검증 시나리오 3종 — 다섯 종류의 주체가 정말 하나의 인터페이스로 서는가,
// 그리고 답하지 못하는 주체는 어디서 막히는가.

import { stateHash } from '@hkt/core/v1';
import { classify, SUBJECT_KINDS } from '@hkt/core/o1';
import { validateDefinition } from '@hkt/core/o0';
import {
  answerFive,
  buildSubject,
  checkSubjectProfile,
  checkSubjects,
  commonInterfaceReport,
  commonInterfaceVerdict,
  perceives,
  QUESTION_KEYS,
  subjectGraphIds,
  subjectIdOf,
  subjectVerdict,
  type SubjectProfile,
} from '@hkt/core/s0';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BROKEN_SUBJECTS,
  guildSpecies,
  hunterId,
  motherGodId,
  nationSpecies,
  S0_DEFINITIONS,
  SUBJECT_SPECS,
  VEIL_SUBJECTS,
} from './s0-veil-subjects.ts';

/** 정상 — 사람·생물·조직·국가·신 다섯이 각자의 방식으로 같은 다섯 질문에 답한다. */
export const s0FiveKindsAnswer = defineScenario({
  id: 's0-five-kinds-answer',
  module: 'S0',
  kind: 'normal',
  purpose:
    '주체 5종이 전부 세계에 서고, 경계·감지·의존·유지·능력이 종류마다 다른 채로 다섯 질문의 스물다섯 칸이 다 찬다.',
  arrange: () => ({ subjects: VEIL_SUBJECTS, definitions: S0_DEFINITIONS }),
  act: ({ subjects, definitions }) => {
    const report = checkSubjects(subjects, definitions);
    const grid = commonInterfaceReport(subjects, definitions);
    return {
      violations: report.violations.map((violation) => violation.rule),
      accepted: report.accepted.length,
      kinds: subjects.map((subject) => subject.subjectKind),
      // 개체는 여전히 O1 Subject 다 — 확장했지 빼지 않았다.
      o1Kinds: subjects.map((subject) => classify(subject).kind),
      // 조직·국가 종 둘은 여기서 새로 세운 정의다. 공리를 지나는지 확인한다.
      newSpecies: [guildSpecies, nationSpecies].map(
        (species) => validateDefinition(species).length,
      ),
      // 다섯 질문 격자
      gaps: grid.gaps,
      missingKinds: grid.missingKinds,
      gridComplete: grid.complete,
      // 감지하는 방법은 종류마다 다르다 — 답이 있다는 것만 같다
      perceiveAnswers: grid.reports.map((entry) => entry.answers[0]?.answer ?? ''),
      answeredCounts: grid.reports.map((entry) => entry.answeredCount),
      // 그래프 4종 자리는 개체에서 갈라져 나온다
      graphsDerived: subjects.every(
        (subject) => stateHash(subjectGraphIds(subject.id)) === stateHash({
          memoryStoreId: subject.memoryStoreId,
          beliefGraphId: subject.beliefGraphId,
          dependencyGraphId: subject.dependencyGraphId,
          possibilityGraphId: subject.possibilityGraphId,
        }),
      ),
      verdict: subjectVerdict(report),
      gridVerdict: commonInterfaceVerdict(grid),
    };
  },
  assert: (result): Assertion[] => [
    expectState('다섯 주체가 하나도 막히지 않는다', [], result.violations),
    expectState('다섯이 모두 섰다', 5, result.accepted),
    expectState('주체 5종이 하나씩이다', [...SUBJECT_KINDS], result.kinds),
    expectState('개체는 여전히 O1 Subject 다', Array(5).fill('Subject'), result.o1Kinds),
    expectState('새로 세운 조직·국가 종도 공리를 지난다', [0, 0], result.newSpecies),
    expectState('격자에 빈 칸이 없다', [], result.gaps),
    expectState('선 주체가 없는 종류가 없다', [], result.missingKinds),
    expectState('다섯이 각각 다섯 질문에 답한다', [5, 5, 5, 5, 5], result.answeredCounts),
    expectState(
      '감지하는 방법은 다섯 다 다르다 — 빛 / 냄새 / 보고 / 보고 / 의념 잔향',
      ['빛', '냄새', '보고', '보고', '의념 잔향'],
      result.perceiveAnswers.map((answer) => answer.split(' ≥')[0] ?? ''),
    ),
    expectTrue('그래프 4종 자리가 전부 개체에서 갈라져 나왔다', result.graphsDerived),
    expectTrue('공통 인터페이스가 선다', result.gridComplete, result.gridVerdict),
    expectDeterministic('같은 선언이면 같은 주체', () =>
      SUBJECT_SPECS.map((spec) => buildSubject(spec).id),
    ),
  ],
});

/** 실패 — 답하지 못하는 주체는 어느 질문의 어느 자리에서 왜 막히는지가 함께 나온다. */
export const s0MuteSubjectsRejected = defineScenario({
  id: 's0-mute-subjects-rejected',
  module: 'S0',
  kind: 'failure',
  purpose:
    '결함 주체 13종이 각자의 사유·경로로 거부되고, 막힌 질문이 다섯 칸 중 어디인지 지목된다.',
  arrange: () => ({ broken: BROKEN_SUBJECTS, definitions: S0_DEFINITIONS }),
  act: ({ broken, definitions }) => ({
    rejected: broken.map((entry) => ({
      broke: entry.broke,
      expected: entry.expected,
      actual: checkSubjectProfile(entry.value, definitions)[0]?.rule ?? '(통과해 버렸다)',
    })),
    // O1 은 이들을 전부 통과시킨다 — S0 이 없으면 그대로 세계에 들어갔을 주체들이다.
    o1Verdicts: [...new Set(broken.map((entry) => classify(entry.value).kind))],
    // 거부 사유는 고칠 자리를 가리킨다
    paths: broken.map((entry) => checkSubjectProfile(entry.value, definitions)[0]?.path ?? ''),
    // 막힌 질문
    muteQuestions: broken.map((entry) =>
      answerFive(entry.value, definitions)
        .answers.filter((answer) => !answer.answered)
        .map((answer) => answer.key)
        .join('+'),
    ),
    // 격자는 그 자리를 빈 칸으로 셈한다
    gapsWhenBroken: commonInterfaceReport(
      [...VEIL_SUBJECTS.slice(0, 4), broken[3]?.value as SubjectProfile],
      definitions,
    ).gaps,
  }),
  assert: (result): Assertion[] => [
    expectState(
      '결함 주체 13종이 각자의 사유로 걸린다',
      result.rejected.map((entry) => `${entry.broke} → ${entry.expected}`),
      result.rejected.map((entry) => `${entry.broke} → ${entry.actual}`),
    ),
    expectState('O1 로서는 전부 온전한 Subject 다 — S0 이 없으면 그대로 들어간다', ['Subject'], result.o1Verdicts),
    expectTrue(
      '거부 사유는 고칠 자리를 그대로 가리킨다',
      result.paths.every((path) => path.startsWith('$.')),
      result.paths,
    ),
    expectState(
      '경계·종을 어긴 주체는 다섯 질문 전부가 막히고, 나머지는 자기 질문만 막힌다',
      [
        'perceive+depend+act+remember+keep', // 몸 없는 사람 — 토대
        'perceive+depend+act+remember+keep', // 길드원 자리에 장소 — 토대
        'remember',
        'perceive',
        'perceive',
        'perceive',
        'depend',
        'depend',
        'depend',
        'depend',
        'keep',
        'keep',
        'act',
      ],
      result.muteQuestions,
    ),
    expectState('아무것도 감지 못 하는 주체는 격자에서 그 칸이 빈다', ['person/perceive'], [
      ...result.gapsWhenBroken,
    ]),
  ],
});

/** 경계 — 빈 목록·문턱 양끝·거리 끝·자기 참조·종 자리의 끝에서도 판정이 흔들리지 않는다. */
export const s0Boundary = defineScenario({
  id: 's0-boundary',
  module: 'S0',
  kind: 'boundary',
  purpose: '빈 목록 · 감지 문턱과 거리의 양끝 · 자기 참조 · 없는 정의 집합에서도 판정이 흔들리지 않는다.',
  arrange: () => ({ subjects: VEIL_SUBJECTS, definitions: S0_DEFINITIONS }),
  act: ({ subjects, definitions }) => {
    const hunter = subjects[0] as SubjectProfile;
    const eyes = hunter.perception;
    return {
      // 아무도 없는 세계
      emptyComplete: checkSubjects([], definitions).complete,
      emptyVerdict: subjectVerdict(checkSubjects([], definitions)),
      emptyGrid: commonInterfaceReport([], definitions).complete,
      // 정의 집합이 비면 능력도 종도 인용할 수 없다
      noDefinitions: [
        ...new Set(checkSubjectProfile(hunter, []).map((violation) => violation.rule)),
      ],
      // 문턱과 거리의 끝은 감지 쪽이다
      atThreshold: perceives(eyes, { channel: 'light', intensity: 0.2 }, 300).perceived,
      belowThreshold: perceives(eyes, { channel: 'light', intensity: 0.199 }, 300).perceived,
      atRange: perceives(eyes, { channel: 'light', intensity: 0.6 }, 300).perceived,
      beyondRange: perceives(eyes, { channel: 'light', intensity: 0.6 }, 301).perceived,
      // 통로가 아예 없으면 세기·거리와 무관하게 못 본다
      noChannel: perceives(eyes, { channel: 'smell', intensity: 1 }, 0).miss,
      // 같은 종·같은 이름표면 같은 개체, 이름표 한 글자만 달라도 다른 개체
      sameLabel: subjectIdOf(guildSpecies.id, '아랫마을 채집 길드'),
      otherLabel: subjectIdOf(guildSpecies.id, '아랫마을 채집 길드 '),
      // 자기 자신은 언제나 자기 경계 안 — 사냥꾼의 허기는 사냥꾼에게 적힌다
      selfNeedOk: checkSubjectProfile(hunter, definitions).length,
      // 신이 자기 앵커를 자기라고 적으면 걸린다
      selfAnchor: checkSubjectProfile(
        {
          ...(subjects[4] as SubjectProfile),
          boundaries: [{ kind: 'anchor', ofId: motherGodId, note: '자기 자신' }],
        },
        definitions,
      ).map((violation) => violation.rule),
      // 질문 다섯은 늘 다섯이다
      questionCount: QUESTION_KEYS.length,
      answerCount: answerFive(hunter, definitions).answers.length,
    };
  },
  assert: (result): Assertion[] => [
    expectTrue('아무도 없는 세계는 완결이 아니다', !result.emptyComplete),
    expectState('세울 주체가 없다는 사실이 문장으로 나온다', '세울 주체가 없다', result.emptyVerdict),
    expectTrue('빈 격자도 완결이 아니다', !result.emptyGrid),
    expectState(
      '정의 집합이 비면 능력도 종도 인용할 수 없다',
      ['unknown-capability', 'unknown-species'],
      result.noDefinitions,
    ),
    expectState('문턱과 거리의 끝은 감지 쪽이다', [true, false, true, false], [
      result.atThreshold,
      result.belowThreshold,
      result.atRange,
      result.beyondRange,
    ]),
    expectState('없는 통로는 세기·거리와 무관하다', 'no-channel', result.noChannel),
    expectTrue('이름표 한 글자가 달라지면 다른 개체다', result.sameLabel !== result.otherLabel),
    expectState('자기 자신의 자리는 언제나 자기 경계 안이다', 0, result.selfNeedOk),
    expectState(
      '자기를 앵커로 삼은 신은 세 사유로 걸린다 — 주체는 앵커가 아니고, 자기는 이미 자기 안이며, 그래서 앵커가 없다',
      ['foreign-boundary', 'bad-boundary', 'unbounded-subject'],
      [...result.selfAnchor],
    ),
    expectState('질문은 늘 다섯이다', result.questionCount, result.answerCount),
    expectDeterministic('같은 주체면 같은 응답표', () =>
      answerFive(VEIL_SUBJECTS[0] as SubjectProfile, S0_DEFINITIONS),
    ),
  ],
});

export const s0Scenarios = [s0FiveKindsAnswer, s0MuteSubjectsRejected, s0Boundary] as const;
