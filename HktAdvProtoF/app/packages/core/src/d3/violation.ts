// D3 위반 서식 — 개체의 변형이 설 수 없을 때, 누구의·어느 변형의·어디가·왜 인지를 한 모양으로 적는다.
//
// D2 의 사유는 "이 종은 살 수 없다" 였다. D3 의 사유는 결이 다르다: **"이 개체는 공짜로 벗어났다."**
// 원문 D3 가 D2 와 다른 조항을 건 자리가 여기다 — 새 능력이 의존을 **완전히 제거하는 것이 아니라
// 다른 비용이나 의존 대상으로 전환되는지** 확인한다.
//
// 그래서 이 계층의 위반은 대부분 하나를 가리킨다: 덜어 낸 무게만큼 다른 것이 서지 않았다.
// (O0 `verifiable-cost` 가 정의 층위에서 막는 것을 D3 는 그래프 층위에서 막는다 — 같은 결이지만
// 공리의 관문은 아니다. 공리는 정의를 보고, 여기서는 이미 선 능력이 그래프에 하는 일을 본다.)

import type { Id } from '../v1/id.ts';

/** 개체의 변형이 거부되는 사유. */
export type PersonalViolationRule =
  // D3-a 개인화
  | 'unrooted-instance' // 개체의 무너짐과 기본 그래프의 뿌리가 맞지 않는다
  | 'foreign-base' // 다른 주체의 그래프를 개인화하려 한다
  // D3-b 변형 문법
  | 'orphan-variation' // 이 개체가 갖지 않은 것을 유래로 든다
  | 'phantom-edit' // 그래프에 없는 노드·간선을 고친다
  | 'bad-variation' // 변형의 값이 서식과 다르다
  // D3-c 전환 검사 (원문 D3 조항)
  | 'free-conversion' // 줄이거나 끊으면서 아무 의존도 더하지 않았다 — 공짜로 벗어났다
  | 'light-conversion' // 더한 무게가 덜어 낸 무게보다 작다
  | 'costless-conversion' // 능력이 유래인데 새 의존이 그 능력이 치르는 대가와 무관하다
  | 'severed-need' // 변형 뒤 어떤 무너짐이 채움을 잃었다
  // 옮겨 온 판정
  | 'broken-graph'; // 변형된 그래프가 D1 관문을 지나지 못한다

/** 누구의 변형인가. */
export interface PersonalRef {
  readonly subjectId: Id;
  readonly name: string;
}

/** 위반 하나 — 개체의 변형 어디가 왜 막혔는가. */
export interface PersonalViolation {
  readonly rule: PersonalViolationRule;
  readonly subject: PersonalRef;
  /** 어느 변형·어느 노드에서 걸렸는가 */
  readonly at: string;
  /** 변형 목록 안의 경로 (`$.variations[1].edits[0]`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violatePersonal(
  out: PersonalViolation[],
  subject: PersonalRef,
  rule: PersonalViolationRule,
  at: string,
  path: string,
  message: string,
): void {
  out.push({ rule, subject, at, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function personalViolationVerdict(violations: readonly PersonalViolation[]): string {
  if (violations.length === 0) return '변형이 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const names = [...new Set(violations.map((violation) => violation.subject.name))];
  return `${names.join(', ')} 의 변형이 막혔다 — ${rules.join(', ')}`;
}
