// D5 위반 서식 — 다툼이 설 수 없을 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// D4 까지의 세계에는 **혼자 서 있는 주체**만 있었다. 그래프가 넷이어도 넷은 서로를 모르고,
// 압력은 각자의 것이었다. 원문 §18 이 다툼을 다주체가 선 뒤에 두는 이유가 그것이다 —
// 혼자 있는 세계에는 다툴 것이 없다.
//
// D5 가 잇는 자리는 이것이다: **여러 그래프를 한 세계에 겹쳐 놓으면 무엇이 부딪히는가.**
//
// D5 도 새 문법을 지어내지 않는다.
//
//   무엇을 요구하는가     D1 `DependencyNode.condition`(자리·대역) · `target`(대상)
//   대신할 수 있는가       D1 `DependencyEdge.substitutability`
//   얼마나 급한가         D4 `NodePressure.pressure` — D5 가 다시 재지 않는다
//   세계에 얼마나 있는가   D4 `WorldSnapshot` — **모자람을 잴 때만** 본다
//
// D5 가 더하는 것은 **다툼의 조건 셋**이다: 양립 불가(`opposed`) · 나뉘지 않음(`exclusive`) ·
// 모자람(`scarcity`). 그리고 그만큼 중요한 못이 하나 더 있다:
//
//   **겹친다고 다툼은 아니다.** 같은 것을 원하는 둘이 나란히 만족될 수 있으면 그것은 다툼이
//   아니다. 이것이 없으면 세계는 모든 겹침이 싸움인 곳이 되고, 다툼이 흔해지면 아무 뜻도 없다.
//
//   **D5 는 이기는 자를 정하지 않는다.** 다툼이 났다는 것과 각자가 얼마나 급한지까지다 —
//   상황으로 묶는 것은 E0, 결과를 확정하는 것은 E3 다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 서지 못한 다툼도 사유를 값으로 남긴다.

/** 다툼이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type ConflictViolationRule =
  // D5-a 요구의 자리
  | 'clock-claim' // 주기 조건을 요구로 세웠다 — 시간은 자리를 잡지 않는다
  | 'phantom-claim' // 그래프에 없는 노드의 요구다
  | 'foreign-claim' // 그래프 주인이 아닌 자의 요구가 섞였다
  | 'bad-substitutability' // 대체 가능성이 0~1 밖이다
  // D5-b 겹침과 다툼
  | 'lonely-conflict' // 한쪽뿐인 다툼 — 다투려면 둘이 있어야 한다
  | 'unrelated-conflict' // 겹치지도 않은 요구 둘을 다툼이라 적었다
  | 'reasonless-conflict' // 셋 중 어느 조건도 대지 못하는 다툼이다
  | 'scarcity-without-world' // 모자람을 주장하면서 세계를 보지 않았다
  | 'severity-drift' // 급함이 D4 압력과 다르다 — D5 는 다시 재지 않는다
  // D5-c 충돌장과 감사
  | 'missing-contest' // 다툼의 조건을 갖췄는데 충돌장에 없다
  | 'winner-declared'; // 이기는 자를 적었다 — 그것은 E0·E3 의 몫이다

/** 위반 하나 — 누구의 어느 다툼이 왜 막혔는가. */
export interface ConflictViolation {
  readonly rule: ConflictViolationRule;
  /** 어느 주체인가. 특정할 수 없으면 빈 문자열 */
  readonly subject: string;
  /** 값 안의 경로 (`$.conflicts[1].sides`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateConflict(
  out: ConflictViolation[],
  subject: string,
  rule: ConflictViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, subject, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function conflictViolationVerdict(violations: readonly ConflictViolation[]): string {
  if (violations.length === 0) return '다툼이 설 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const subjects = [...new Set(violations.map((violation) => violation.subject))].filter(
    (subject) => subject !== '',
  );
  const who = subjects.length === 0 ? '다툼' : subjects.join(', ');
  return `${who} 이 설 수 없다 — ${rules.join(', ')}`;
}
