// S0 위반 서식 — 주체가 세계에 설 수 없을 때, 누가·어디가·왜 인지를 한 모양으로 적는다.
//
// O1 은 "값이 존재론 원소인가", O2 는 "값이 놓일 자리가 있는가", O0 는 "정의가 공리를 어기는가" 를 본다.
// S0 가 보는 것은 그 다음이다: **이 주체는 다섯 질문에 답할 수 있는가.**
// 답 못 하는 주체는 세계에 서지 못하고, 어느 질문의 어느 자리가 비었는지가 값으로 남는다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 거부된 주체도 사유·경로와 함께 화면에 실려야 한다.

import type { Id } from '../v1/id.ts';
import type { SubjectKind } from '../o1/being.ts';

/** 검사에 필요한 주체의 최소 신원 — O1 Subject 에서 그대로 뽑힌다. */
export interface SubjectRef {
  readonly id: Id;
  readonly name: string;
  readonly subjectKind: SubjectKind;
}

/** 주체가 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다 — 사유가 늘어나는 것이 보인다. */
export type SubjectViolationRule =
  // S0-a 경계와 그래프 자리
  | 'bad-subject' // 주체 자신이 O1 Subject 로서 온전하지 않다
  | 'unbounded-subject' // 그 종류의 주체에게 반드시 있어야 할 경계가 없다
  | 'bad-boundary' // 경계 선언 자체가 결함이다 (종류·대상·근거)
  | 'foreign-boundary' // 경계 대상의 존재 종류가 그 경계가 받는 종류가 아니다
  | 'manufactured-graph' // 매달린 그래프 ID 가 이 주체에서 유래하지 않았다
  // S0-b 감지 프로필
  | 'senseless-subject' // 통로가 하나도 없다 — 세계가 이 주체에게 일어나지 않는다
  | 'unknown-channel' // 현상 통로 6종 밖으로 감지한다고 적었다
  | 'duplicate-channel' // 같은 통로를 두 번 선언했다
  | 'omniscient-channel' // 문턱이 0 이하다 — 전지한 감각은 은폐도 기만도 무너뜨린다
  | 'bad-range' // 도달 거리가 O2 거리 범위 밖이다
  | 'bodiless-sense'; // 몸 없는 주체가 몸의 감각을 선언했다

/** 위반 하나 — 어느 주체의 어느 자리가 왜 막혔는가. */
export interface SubjectViolation {
  readonly rule: SubjectViolationRule;
  readonly subjectId: Id;
  /** 화면에서 읽히도록 이름을 함께 싣는다 (O0 AxiomViolation 과 같은 태도) */
  readonly subjectName: string;
  readonly subjectKind: SubjectKind;
  /** 주체 선언 안의 경로 (`$.boundaries[0].ofId`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateSubject(
  out: SubjectViolation[],
  subject: SubjectRef,
  rule: SubjectViolationRule,
  path: string,
  message: string,
): void {
  out.push({
    rule,
    subjectId: subject.id,
    subjectName: subject.name,
    subjectKind: subject.subjectKind,
    path,
    message,
  });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function violationVerdict(violations: readonly SubjectViolation[]): string {
  if (violations.length === 0) return '주체가 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const names = [...new Set(violations.map((violation) => violation.subjectName))];
  return `주체 ${names.join(', ')} 가 막혔다 — ${rules.join(', ')}`;
}
