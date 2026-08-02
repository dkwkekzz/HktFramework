// P0 위반 서식 — 행동이 설 수 없을 때, 어느 원자의·어디가·왜 인지를 한 모양으로 적는다.
//
// 행동 목록은 쉽다. "찾는다·획득한다·생산한다…" 를 나열하는 것은 누구나 한다. 그 목록으로
// 세계가 굴러가려면 각 원자가 세 가지에 답해야 한다: 무엇을 읽어야 하는가, 세계의 어느 자리를
// 바꾸겠다는 것인가, 무엇을 치르는가. 못 대는 원자는 이름뿐인 칸이고, 이름뿐인 칸으로는
// P1 이 대응 방향을 세울 수 없고 P5 가 계획을 분해할 수 없다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 거부된 행동도 사유·경로와 함께 화면에 실려야 한다.

/** 행동이 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type ActionAtomViolationRule =
  // P0-a 원자 16종 확정
  | 'unresolved-original' // 원문이 적은 행동이 16원자 어디로도 환원되지 않았다
  | 'dangling-resolution' // 16종에 없는 원자로 환원했다
  | 'duplicate-atom' // 같은 원자를 두 번 적었다
  | 'unsourced-atom' // 원문 근거·하는 일·예가 없다 — 지어낸 원자는 원자가 아니다
  // P0-b 원자별 세계 걸림
  | 'ungrounded-atom' // 걸림이 없다 — 무엇을 읽고 바꾸고 치르는지를 대지 못한다
  | 'changeless-atom' // 아무 자리도 바꾸지 않는다 — 세계를 안 바꾸는 것은 행동이 아니다
  | 'costless-atom' // 아무것도 치르지 않는다 (O0 verifiable-cost · MasterPlan §3.2 1계층)
  | 'phantom-slot' // O2 스키마에 없는 자리를 읽거나 바꾸거나 치른다
  | 'redundant-atom' // 다른 원자와 축·자리·대가가 모두 같다 — 최소 집합이 아니다
  | 'aimless-atom' // 어느 의존에도 닿지 않는다 (벗어나는 원자는 제외)
  | 'kindful-escape' // 벗어나는 원자가 특정 종을 지목했다 — 탈피는 종을 가리지 않는다
  | 'consent-without-other' // 상대가 없는 원자에 동의 축을 적었다
  | 'consentless-encounter' // 상대가 있는 원자가 동의 축을 비웠다
  | 'blind-manipulation' // 대상을 안 보고 앎 밖의 자리를 바꾼다 (O0 observed-manipulation)
  | 'broken-pair' // 짝이 서로를 가리키지 않는다
  | 'unfillable-kind' // 아무 원자도 채우지 못하는 의존 종인데 예외로 선언되지 않았다
  | 'stale-exception' // 채울 수 없다고 적어 놓고 실제로는 채우는 원자가 있다
  // P0-c 행동 요청 문법
  | 'unknown-action' // 16원자 밖의 행동 이름
  | 'changeless-action' // 아무것도 바꾸지 않겠다는 요청
  | 'off-atom-change' // 그 원자가 열지 않은 자리를 바꾸겠다고 한다
  | 'unpaid-action' // 대가를 적지 않았다
  | 'off-atom-payment' // 그 원자가 치르지 않는 자리를 치른다고 적었다
  | 'targetless-action' // 상대가 있어야 하는 원자인데 대상이 없다
  | 'self-atom-on-other' // 자기를 바꾸는 원자를 남에게 겨눴다
  | 'unobserved-action'; // 보지 못한 대상을 정밀하게 조작하려 한다

/** 위반 하나 — 어느 원자의 어디가 왜 막혔는가. */
export interface ActionAtomViolation {
  readonly rule: ActionAtomViolationRule;
  /** 어느 원자에서 걸렸는가. 원자를 특정할 수 없으면 빈 문자열 */
  readonly atom: string;
  /** 값 안의 경로 (`$.groundings[3].pays`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateAtom(
  out: ActionAtomViolation[],
  atom: string,
  rule: ActionAtomViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, atom, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function atomViolationVerdict(violations: readonly ActionAtomViolation[]): string {
  if (violations.length === 0) return '행동 문법이 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const atoms = [...new Set(violations.map((violation) => violation.atom))].filter(
    (atom) => atom !== '',
  );
  const where = atoms.length === 0 ? '행동' : `원자 ${atoms.join(', ')}`;
  return `${where} 가 막혔다 — ${rules.join(', ')}`;
}
