// P1 위반 서식 — 대응 전개가 설 수 없을 때, 어느 방향의·어디가·왜 인지를 한 모양으로 적는다.
//
// 방향 목록도 쉽다. "충족·대체·감소…" 를 나열하는 것은 누구나 한다. 그 목록이 세계를 굴리려면
// 각 방향이 **실제 원자로 이루어져야** 하고(P0), **그 결핍에 정말 열리는지** 판정되어야 한다.
// 언제나 일곱이 다 열린다면 그것은 전개가 아니라 목록을 복사한 것이다.
//
// 그래서 P1 의 위반은 둘로 갈린다:
//   ① 방향 자체가 설 수 없다 — 원자가 없거나 P0 환원표와 어긋나거나 근거가 없다
//   ② 전개가 설 수 없다 — 결핍 없는 자리를 펼치거나 남의 노드를 펼치거나 사유 없이 막는다
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 막힌 갈래도 사유와 함께 화면에 실려야 한다.
// 오히려 P1 에서는 **막힌 갈래가 더 중요하다**: 무엇을 할 수 없는지가 그 주체를 말한다.

/** 전개가 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type StrategyViolationRule =
  // P1-a 방향 7종 확정
  | 'unresolved-example' // 원문이 든 갈래가 방향 어디로도 붙지 않았다
  | 'dangling-example' // 7종에 없는 방향으로 붙였다
  | 'duplicate-direction' // 같은 방향을 두 번 적었다
  | 'unsourced-direction' // 원문 근거·하는 일·예가 없다
  | 'atomless-direction' // 그 방향을 이루는 원자가 없다 — 원자 없는 방향은 계획이 되지 못한다
  | 'direction-atom-drift' // P0 환원표가 배정한 원자와 다르다 — 두 곳이 어긋나면 하나는 거짓이다
  | 'phantom-atom' // 16원자 밖의 이름을 방향에 넣었다
  // P1-b 열림 판정
  | 'unreasoned-block' // 막혔다면서 사유를 대지 않았다
  | 'unknown-block' // 선언되지 않은 사유로 막았다
  | 'open-without-atom' // 열렸다면서 쓸 원자가 하나도 없다
  | 'unowed-block' // 지금은 볼 수 없어 막는다면서 갚을 모듈을 적지 않았다
  // P1-c 대응 트리 조립
  | 'unknown-node' // 그래프에 없는 노드를 펼쳤다
  | 'foreign-node' // 다른 주체의 노드를 펼쳤다
  | 'unpressured-expansion' // 결핍 0 인 자리를 펼쳤다 — 채워진 의존은 아무 목적도 만들지 않는다 (D4)
  | 'missing-direction' // 갈래에 일곱 방향이 다 서지 않았다 — 막힌 것도 자리를 지켜야 한다
  | 'empty-tree'; // 압력이 있는데 갈래가 하나도 서지 않았다

/** 위반 하나 — 어느 방향의 어디가 왜 막혔는가. */
export interface StrategyViolation {
  readonly rule: StrategyViolationRule;
  /** 어느 방향에서 걸렸는가. 방향을 특정할 수 없으면 빈 문자열 */
  readonly direction: string;
  /** 값 안의 경로 (`$.branches[0].options[3]`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateStrategy(
  out: StrategyViolation[],
  direction: string,
  rule: StrategyViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, direction, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function strategyViolationVerdict(violations: readonly StrategyViolation[]): string {
  if (violations.length === 0) return '전개가 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const directions = [...new Set(violations.map((violation) => violation.direction))].filter(
    (direction) => direction !== '',
  );
  const where = directions.length === 0 ? '전개' : `방향 ${directions.join(', ')}`;
  return `${where} 가 막혔다 — ${rules.join(', ')}`;
}
