// P3 위반 서식 — 가능성 그래프가 설 수 없을 때, 어디가 왜 막혔는지를 한 모양으로 적는다.
//
// P0~P2 는 "무엇을 할 수 있는가" 까지 세웠다. P3 이 묻는 것은 그 다음이다 —
// **무엇이 먼저 서야 하는가.** 선행이 계산되지 않으면 가능성은 순서 없는 목록이고,
// 순서 없는 목록으로는 P5 가 계획을 분해하지 못한다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 막힌 자리도 사유·경로와 함께 화면에 실린다.

/** 가능성 그래프가 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type PossibilityGraphViolationRule =
  // P3-a 원자 선행 관계
  | 'unsourced-cost' // 치르거나 읽어야 할 자리를 아무 원자도 세우지 못하는데 예외 선언이 없다
  | 'stale-cost-exception' // 세울 수 없다고 적어 놓고 실제로는 세우는 원자가 있다
  | 'rootless-atoms' // 뿌리가 하나도 없다 — 아무 원자도 첫 걸음이 되지 못한다
  | 'unreachable-atom' // 뿌리에서 닿지 않는다 — 영영 설 수 없는 원자다
  | 'self-only-source'; // 그 자리를 세우는 것이 자기 자신뿐이다 — 스스로를 딛고 서지 못한다

/** 위반 하나 — 어느 원자의 어디가 왜 막혔는가. */
export interface PossibilityGraphViolation {
  readonly rule: PossibilityGraphViolationRule;
  /** 어느 원자에서 걸렸는가. 특정할 수 없으면 빈 문자열 */
  readonly atom: string;
  /** 값 안의 경로 (`$.prerequisites[3].satisfiedBy`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateExpansion(
  out: PossibilityGraphViolation[],
  atom: string,
  rule: PossibilityGraphViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, atom, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function expansionViolationVerdict(
  violations: readonly PossibilityGraphViolation[],
): string {
  if (violations.length === 0) return '선행 관계가 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const atoms = [...new Set(violations.map((violation) => violation.atom))].filter(
    (atom) => atom !== '',
  );
  const where = atoms.length === 0 ? '선행 관계' : `원자 ${atoms.join(', ')}`;
  return `${where} 가 막혔다 — ${rules.join(', ')}`;
}
