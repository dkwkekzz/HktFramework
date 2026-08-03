// P2 위반 서식 — 가능성 문법이 설 수 없을 때, 어느 유형·어느 원자가 왜 막혔는지를 한 모양으로 적는다.
//
// P1 은 결핍의 **종**이 갈래를 좁히는 것을 보였다. 그러나 거기까지는 누가 그 앞에 서 있든
// 같은 갈래가 나온다 — 자원이 비면 누구에게나 여섯이 열렸다. P2 가 더하는 것은 **누가 서 있는가** 다.
//
// 그래서 P2 의 위반도 둘로 갈린다:
//   ① 접근이 설 수 없다 — 몸 없는 자가 손으로 하겠다거나, 구성원 없는 자가 시키겠다거나,
//      의념 자리 없는 자가 능력으로 하겠다고 적는 경우
//   ② 문법이 설 수 없다 — 없는 능력을 인용하거나, 16원자 밖을 열거나, 금기가 전부를 닫거나,
//      원문이 든 예시가 그 유형의 문법으로 도달되지 않는 경우
//
// ②의 마지막 조항이 이 계층의 시험이다: 원문 P2 는 다섯 유형의 행동을 예시로 들었다.
// 그 다섯 줄이 우리가 지은 문법에서 **계산되어 나오지 않으면**, 문법이 틀렸거나 예시가 틀렸다.

/** 문법이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type GrammarViolationRule =
  // P2-a 주체 유형별 접근
  | 'unknown-access' // 선언되지 않은 접근 방식
  | 'bodiless-direct' // 몸이 없는데 손으로 직접 한다고 적었다
  | 'memberless-delegation' // 구성원이 없는데 시켜서 한다고 적었다
  | 'mindless-ability' // 의념 자리가 없는데 능력으로 한다고 적었다
  | 'unreasoned-denial' // 막았는데 사유가 없다
  | 'atomless-kind' // 어떤 원자도 내지 못하는 유형 — 세계에 설 수 없다
  | 'duplicate-access' // 같은 유형·같은 원자를 두 번 적었다
  | 'missing-access' // 유형 × 원자 격자에 빈 칸이 있다
  | 'phantom-atom' // 16원자 밖의 이름
  | 'phantom-kind' // 주체 5종 밖의 이름
  // P2-b 문화·역할 겹침
  | 'unknown-ability' // 세계에 없는 능력을 인용했다
  | 'ungranted-taboo' // 아무도 열지 않은 것을 금했다 (S2 선례)
  | 'total-taboo' // 금기가 낼 수 있는 원자를 전부 닫았다 (S2 선례)
  | 'foreign-culture' // 그 종이 지닐 수 없는 문화다
  | 'roleless-grant' // 역할이 없는데 역할이 여는 원자를 적었다
  // P2-c 문법 적용·원문 대조
  | 'unreachable-example' // 원문이 든 예시가 그 유형의 문법으로 도달되지 않는다
  | 'unresolved-example' // 원문 예시가 원자로 환원되지 않았다 (P0 환원표 밖)
  | 'foreign-grammar' // 다른 주체의 문법으로 갈래를 좁히려 한다
  | 'widened-branch'; // 좁히기가 갈래를 넓혔다 — 문법은 열지 못하고 닫기만 한다

/** 위반 하나. */
export interface GrammarViolation {
  readonly rule: GrammarViolationRule;
  /** 어느 유형·문화에서 걸렸는가. 특정할 수 없으면 빈 문자열 */
  readonly subject: string;
  /** 값 안의 경로 */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateGrammar(
  out: GrammarViolation[],
  subject: string,
  rule: GrammarViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, subject, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function grammarViolationVerdict(violations: readonly GrammarViolation[]): string {
  if (violations.length === 0) return '문법이 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const subjects = [...new Set(violations.map((violation) => violation.subject))].filter(
    (subject) => subject !== '',
  );
  const where = subjects.length === 0 ? '문법' : `${subjects.join(', ')}`;
  return `${where} 가 막혔다 — ${rules.join(', ')}`;
}
