// D0 위반 서식 — 의존 대상 분류가 설 수 없을 때, 어느 종의·어디가·왜 인지를 한 모양으로 적는다.
//
// 분류는 목록이 아니다. "자원·공간·환경…" 을 나열하는 것은 누구나 한다. 그 목록이 세계를
// 굴리려면 각 종이 **세계의 무엇에 걸리는지**를 대야 한다 — 대상이 O1 의 무엇으로 서고,
// 충족을 O2 의 어느 자리에서 읽는가. 그것을 못 대는 종은 이름뿐인 칸이고, 이름뿐인 칸은
// D2 가 종 원형에서 의존 그래프를 지을 때 아무것도 채우지 못한다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 거부된 분류도 사유·경로와 함께 화면에 실려야 한다.

/** 분류가 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type DependencyKindViolationRule =
  // D0-a 대상 11종 확정
  | 'unresolved-original' // 원문이 적은 이름이 확정 11종 어디로도 가지 않았다
  | 'dangling-resolution' // 11종에 없는 종으로 해소했다
  | 'undefined-kind' // O1 이 이름표로 고정한 종에 정의가 없다
  | 'duplicate-kind' // 같은 종을 두 번 적었다
  | 'unsourced-kind' // 원문 근거가 없다 — 지어낸 종은 종이 아니다
  // D0-b 종별 세계 걸림
  | 'unreadable-kind' // 충족을 읽을 자리가 없다 — 아무도 못 읽는 의존은 굴러가지 않는다
  | 'targetless-kind' // 대상 종류가 비었는데 시간 종이 아니다
  | 'phantom-target-kind' // O1 12타입 밖의 대상을 적었다
  | 'phantom-domain' // O2 9영역 밖의 자리를 읽는다
  | 'uncovered-domain' // 세계에 자리가 있는데 아무 종도 그것에 기대지 않는다
  | 'kind-target-mismatch' // 선언한 종이 받을 수 없는 대상이다
  | 'off-domain-state' // 그 종이 읽지 않는 영역의 상태를 대상으로 삼았다
  | 'unwanted-target'; // 대상이 없어야 하는 종에 대상을 달았다

/** 위반 하나 — 어느 종의 어디가 왜 막혔는가. */
export interface DependencyKindViolation {
  readonly rule: DependencyKindViolationRule;
  /** 어느 종에서 걸렸는가. 종을 특정할 수 없으면 빈 문자열 */
  readonly kind: string;
  /** 값 안의 경로 (`$.specs[3].source`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateKind(
  out: DependencyKindViolation[],
  kind: string,
  rule: DependencyKindViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, kind, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function kindViolationVerdict(violations: readonly DependencyKindViolation[]): string {
  if (violations.length === 0) return '분류가 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const kinds = [...new Set(violations.map((violation) => violation.kind))].filter(
    (kind) => kind !== '',
  );
  const where = kinds.length === 0 ? '분류' : `종 ${kinds.join(', ')}`;
  return `${where} 가 막혔다 — ${rules.join(', ')}`;
}
