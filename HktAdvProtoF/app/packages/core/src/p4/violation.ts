// P4 위반 서식 — 목적이 설 수 없을 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// P3 까지 오면 "지금 펼 수 있는 것" 이 값으로 남는다. P4 가 묻는 것은 그 다음이다 —
// **그중 무엇을 좇는가.** 고르는 일은 값을 하나로 접는 일이라 근거를 잃기 쉽다:
// 점수 하나만 남으면 왜 그것이 뽑혔는지 아무도 말하지 못한다. 그래서 이 계층의 관문은
// 대부분 **유래**를 지킨다 — 요소는 앞 계층에서 와야 하고, 점수는 요소에서 재계산돼야 한다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 거부된 자리도 사유·경로와 함께 화면에 실린다.

/** 목적 선택이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type GoalViolationRule =
  // P4-a 재료 선행 판정
  | 'absent-grounding' // 세계 걸림이 없는 원자의 대가를 묻는다 — 무엇을 치르는지 알 수 없다
  | 'unslotted-payment' // 치를 자리가 O2 스키마에 없다 — 세계에 없는 것으로는 치르지 못한다
  | 'unsourced-payment' // 세우는 원자도 없고 예외 선언도 없는 자리를 치른다 (P3-a 관문의 둘째 문)
  // P4-b 평가 요소 아홉
  | 'unsourced-factor' // 앞 계층에서 오지 않은 힘이 목적을 민다 — 출처 없는 요소·선언과 다른 계층
  | 'factor-out-of-range' // 요소 값이 −1~1 밖이다 — 접을 수 없는 힘이다
  | 'phantom-candidate' // P3 이 펴지 않은 것을 후보로 든다 — 놓이지 않은 길은 고를 수 없다
  // P4-c 점수·선택·관성
  | 'score-drift' // 점수가 요소 아홉에서 다시 나오지 않는다 — 손으로 적은 점수는 근거가 아니다
  | 'unheld-goal' // 후보에 없는 것을 좇는다
  | 'premature-goal' // 선행이 서지 않은 것을 골랐다 — 먼저 설 것이 있다
  | 'inertia-without-history'; // 밀어낼 것이 없는데 문턱이 있다 · 아직 오지 않은 시각부터 좇는다

/** 위반 하나 — 어느 후보의 어디가 왜 막혔는가. */
export interface GoalViolation {
  readonly rule: GoalViolationRule;
  /** 어느 후보·원자에서 걸렸는가. 특정할 수 없으면 빈 문자열 */
  readonly subject: string;
  /** 값 안의 경로 (`$.requirements[1].slot`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateGoal(
  out: GoalViolation[],
  subject: string,
  rule: GoalViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, subject, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function goalViolationVerdict(violations: readonly GoalViolation[]): string {
  if (violations.length === 0) return '목적이 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const subjects = [...new Set(violations.map((violation) => violation.subject))].filter(
    (subject) => subject !== '',
  );
  const where = subjects.length === 0 ? '목적 선택' : `${subjects.join(', ')}`;
  return `${where} 이 설 수 없다 — ${rules.join(', ')}`;
}
