// S0-e 5질문 검사기 — 원문 S0 의 검증 조항 그대로.
//
//   "모든 주체가 다음 질문에 답할 수 있어야 한다.
//    무엇을 감지할 수 있는가? / 무엇에 의존하는가? / 무엇을 할 수 있는가? /
//    무엇을 기억하는가? / 어떤 상태를 유지하려 하는가?"
//
// 이것이 S0 의 목적 그 자체다. **공통 인터페이스** 란 필드 이름이 같다는 뜻이 아니라,
// 사람·생물·조직·국가·신이 전부 같은 다섯 질문에 답한다는 뜻이다. 사람은 눈으로 감지하고
// 국가는 보고로 감지하지만, 둘 다 "무엇을 감지하는가" 에 답한다 — 그래서 뒤의 모든 계층
// (D 의존·P 가능성·R 지각)이 주체의 종류를 묻지 않고 한 통로로 다룰 수 있다.
//
// 답을 막는 것은 S0-a~d 가 이미 낸 위반들이다. 여기서 새로 검사하지 않는다 —
// 위반이 어느 질문을 막는지 **배정**하고, 다섯 칸이 다 찼는지 센다.
// 신원·경계·종이 무너진 주체는 다섯 질문 전부에 답하지 못한다: 누구인지 모르는 자,
// 경계가 없어 아무것도 잃지 않는 자에게는 질문 자체가 성립하지 않는다.

import type { Id } from '../v1/id.ts';
import { SUBJECT_KINDS, type SubjectKind } from '../o1/being.ts';
import type { Definition } from '../o0/definition.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import type { SubjectViolation } from './violation.ts';
import { SUBJECT_GRAPH_SPECS } from './boundary.ts';
import { perceptionSummary } from './perception.ts';
import { needSummary, valueSummary } from './stake.ts';
import { abilityOf, checkSubjectProfile, type SubjectProfile } from './subject.ts';

/** 원문 S0 다섯 질문. 순서도 원문 그대로다. */
export const QUESTION_KEYS = ['perceive', 'depend', 'act', 'remember', 'keep'] as const;
export type QuestionKey = (typeof QUESTION_KEYS)[number];

/** 질문 하나 — 원문 문장과, 프로필의 어느 자리가 답이 되는가. */
export interface QuestionSpec {
  readonly key: QuestionKey;
  /** 원문 S0 검증 조항의 문장 그대로 */
  readonly question: string;
  /** 답이 적히는 프로필 자리 (위반 경로의 앞머리로도 쓰인다) */
  readonly paths: readonly string[];
}

export const QUESTION_SPECS: readonly QuestionSpec[] = [
  {
    key: 'perceive',
    question: '무엇을 감지할 수 있는가?',
    paths: ['$.perception', '$.beliefGraphId'],
  },
  {
    key: 'depend',
    question: '무엇에 의존하는가?',
    paths: ['$.needs', '$.dependencyGraphId'],
  },
  {
    key: 'act',
    question: '무엇을 할 수 있는가?',
    paths: ['$.capabilities', '$.possibilityGraphId'],
  },
  {
    key: 'remember',
    question: '무엇을 기억하는가?',
    paths: ['$.memoryStoreId'],
  },
  {
    key: 'keep',
    question: '어떤 상태를 유지하려 하는가?',
    paths: ['$.values'],
  },
];

/**
 * 어느 질문에도 속하지 않고 **다섯 전부**를 막는 자리.
 * 누구인지 모르는 자, 경계가 없어 아무것도 잃지 않는 자, 어느 종에서 왔는지 모르는 자에게는
 * 질문 자체가 성립하지 않는다.
 */
export const FOUNDATION_PATHS = ['$.id', '$.name', '$.subjectKind', '$.boundaries', '$.speciesId'];

/** 질문 하나에 대한 답. */
export interface QuestionAnswer {
  readonly key: QuestionKey;
  readonly question: string;
  readonly answered: boolean;
  /** 답 한 줄 — 답하지 못했으면 왜 못 했는지 */
  readonly answer: string;
  /** 이 질문을 막은 위반들 */
  readonly blockers: readonly SubjectViolation[];
}

/** 주체 하나의 5질문 응답표. */
export interface FiveQuestionReport {
  readonly subjectId: Id;
  readonly subjectName: string;
  readonly subjectKind: SubjectKind;
  readonly answers: readonly QuestionAnswer[];
  readonly answeredCount: number;
  /** 신원·경계·종의 위반 — 있으면 다섯 전부가 막힌다 */
  readonly foundation: readonly SubjectViolation[];
  readonly complete: boolean;
}

/** 위반 하나가 어느 질문을 막는가. 어느 질문에도 속하지 않으면 null (= 토대 위반). */
export function questionOf(violation: SubjectViolation): QuestionKey | null {
  for (const spec of QUESTION_SPECS) {
    if (spec.paths.some((path) => violation.path.startsWith(path))) return spec.key;
  }
  return null;
}

/** 능력 이름들 — 정의를 모르면 ID 그대로. */
function capabilityNames(profile: SubjectProfile, definitions: readonly Definition[]): string {
  return profile.capabilities
    .map((id) => abilityOf(id, definitions)?.name ?? id)
    .join(' · ');
}

/** 답 한 줄을 만든다 — 막혔으면 막은 사유가 답을 대신한다. */
function answerText(
  key: QuestionKey,
  profile: SubjectProfile,
  definitions: readonly Definition[],
  blockers: readonly SubjectViolation[],
): string {
  if (blockers.length > 0) return blockers.map((violation) => violation.message).join(' / ');
  switch (key) {
    case 'perceive':
      return perceptionSummary(profile.perception);
    case 'depend':
      return needSummary(profile.needs);
    case 'act':
      return capabilityNames(profile, definitions);
    case 'remember': {
      const spec = SUBJECT_GRAPH_SPECS.find((entry) => entry.kind === 'memory');
      return `${profile.memoryStoreId} (${spec?.owner ?? ''} 가 채운다)`;
    }
    case 'keep':
      return valueSummary(profile.values);
  }
}

/** 주체 하나가 다섯 질문에 답하는가. */
export function answerFive(
  profile: SubjectProfile,
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): FiveQuestionReport {
  const violations = checkSubjectProfile(profile, definitions, schema);
  const foundation = violations.filter((violation) => questionOf(violation) === null);

  const answers = QUESTION_SPECS.map((spec): QuestionAnswer => {
    // 토대가 무너지면 그 사유가 다섯 질문 전부를 막는다.
    const blockers =
      foundation.length > 0
        ? foundation
        : violations.filter((violation) => questionOf(violation) === spec.key);
    return {
      key: spec.key,
      question: spec.question,
      answered: blockers.length === 0,
      answer: answerText(spec.key, profile, definitions, blockers),
      blockers,
    };
  });

  const answeredCount = answers.filter((answer) => answer.answered).length;
  return {
    subjectId: profile.id,
    subjectName: profile.name,
    subjectKind: profile.subjectKind,
    answers,
    answeredCount,
    foundation,
    complete: answeredCount === QUESTION_KEYS.length,
  };
}

/** 응답표를 한 줄로 접는다. */
export function fiveQuestionVerdict(report: FiveQuestionReport): string {
  if (report.complete) {
    return `${report.subjectName}(${report.subjectKind}) 이 다섯 질문에 전부 답한다`;
  }
  const mute = report.answers.filter((answer) => !answer.answered).map((answer) => answer.question);
  return `${report.subjectName}(${report.subjectKind}) 이 ${String(report.answeredCount)}/5 — 막힌 질문: ${mute.join(' ')}`;
}

/** 공통 인터페이스가 정말 공통인가 — 주체 5종 × 질문 5개 격자. */
export interface CommonInterfaceReport {
  readonly reports: readonly FiveQuestionReport[];
  /** 격자의 빈 칸 (`nation/remember`) */
  readonly gaps: readonly string[];
  /** 한 명도 서지 않은 주체 종류 — 공통이라 말하려면 5종이 다 있어야 한다 */
  readonly missingKinds: readonly SubjectKind[];
  readonly complete: boolean;
}

/** 주체 여럿의 응답표를 격자로 편다. */
export function commonInterfaceReport(
  profiles: readonly SubjectProfile[],
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): CommonInterfaceReport {
  const reports = profiles.map((profile) => answerFive(profile, definitions, schema));

  const gaps: string[] = [];
  for (const report of reports) {
    for (const answer of report.answers) {
      if (!answer.answered) gaps.push(`${report.subjectKind}/${answer.key}`);
    }
  }
  const standing = new Set(reports.filter((report) => report.complete).map((r) => r.subjectKind));
  const missingKinds = SUBJECT_KINDS.filter((kind) => !standing.has(kind));

  return {
    reports,
    gaps,
    missingKinds,
    complete: reports.length > 0 && gaps.length === 0 && missingKinds.length === 0,
  };
}

/** 격자 판정을 한 줄로 접는다. */
export function commonInterfaceVerdict(report: CommonInterfaceReport): string {
  if (report.complete) {
    return `주체 ${String(report.reports.length)}명이 5종을 채우고 각자 다섯 질문에 전부 답한다 — 공통 인터페이스가 선다`;
  }
  const reasons: string[] = [];
  if (report.reports.length === 0) reasons.push('세운 주체가 없다');
  if (report.missingKinds.length > 0) {
    reasons.push(`선 주체가 없는 종류 ${report.missingKinds.join(', ')}`);
  }
  if (report.gaps.length > 0) reasons.push(`빈 칸 ${report.gaps.join(', ')}`);
  return reasons.join(' · ');
}
