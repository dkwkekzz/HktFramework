// D1 위반 서식 — 의존 그래프가 설 수 없을 때, 어느 노드·간선의·어디가·왜 인지를 한 모양으로 적는다.
//
// D0 는 "무엇에 기댈 수 있는가" 를 확정했다. D1 은 그것을 **그래프로 세운다** — 노드는 기대는
// 대상 하나, 간선은 기댐의 방식 하나다. 여기서 지켜야 할 것은 하나로 요약된다:
// **D0 가 못박은 종의 성격을 그래프가 어겨서는 안 된다.** 줄지 않는 것은 소모할 수 없고,
// 그 대상이어야 하는 것은 무엇으로든 대체될 수 없고, 종이 읽지 않는 자리를 조건으로 걸 수 없다.
//
// 앞 계층과 같은 태도다 — 던지지 않는다. 거부된 그래프도 사유·경로와 함께 화면에 실려야 한다.

import type { Id } from '../v1/id.ts';

/** 그래프가 거부되는 사유. 하위 작업이 늘 때마다 여기에 더한다. */
export type GraphViolationRule =
  // D1-a 의존 노드
  | 'bad-node' // 노드의 값이 서식과 다르다
  | 'unknown-kind' // D0 11종에 없는 종이다
  | 'kind-target-mismatch' // 선언한 종이 받을 수 없는 대상이다 (D0 관문)
  | 'off-domain-condition' // 그 종이 읽지 않는 영역을 조건으로 걸었다
  | 'phantom-slot' // 세계에 없는 자리를 조건으로 걸었다
  | 'bad-band' // 조건의 범위가 그 자리의 값 모양과 맞지 않는다
  | 'clock-condition-misuse' // 틱 조건은 시간 종만 쓸 수 있다
  | 'slot-condition-missing' // 시간이 아닌 종이 자리 조건을 갖지 않았다
  | 'duplicate-node' // 같은 종·같은 대상·같은 조건의 노드가 둘이다
  // D1-b 의존 간선
  | 'bad-edge' // 간선의 값이 서식과 다르다
  | 'unknown-relation' // 관계 7종에 없다
  | 'dangling-edge' // 없는 노드를 가리킨다
  | 'self-edge' // 자기 자신에 기댄다
  | 'relation-kind-mismatch' // 그 관계로 기댈 수 없는 종이다
  | 'consumes-undepleting' // 줄지 않는 것을 소모한다고 적었다
  | 'substitutable-named' // 그 대상이어야 하는 종을 무엇으로든 대체 가능하다 적었다
  | 'traceless-failure' // 끊겨도 아무것도 남지 않는다 — 흔적 없는 끊김은 끊김이 아니다
  | 'phantom-effect-slot' // 끊김의 흔적이 세계에 없는 자리를 가리킨다
  | 'duplicate-edge' // 같은 두 노드를 같은 관계로 두 번 이었다
  // D1-c 그래프 조립
  | 'bad-graph' // 그래프의 값이 서식과 다르다
  | 'rootless-graph' // 뿌리가 없다 — 아무 무너짐에도 걸리지 않은 그래프
  | 'phantom-root' // 뿌리가 그래프에 없는 노드를 가리킨다
  | 'unreachable-node' // 뿌리에서 닿지 않는다 — 이 주체의 의존이 아니다
  | 'dependency-cycle' // 한 주체의 그래프 안에서 의존이 맴돈다
  | 'foreign-node'; // 다른 주체의 노드가 섞였다

/** 위반 하나 — 그래프의 어디가 왜 막혔는가. */
export interface GraphViolation {
  readonly rule: GraphViolationRule;
  /** 어느 노드·간선에서 걸렸는가. 그래프 전체면 빈 문자열 */
  readonly at: Id | '';
  /** 화면에서 읽히도록 이름을 함께 싣는다 (앞 계층과 같은 태도) */
  readonly label: string;
  /** 그래프 안의 경로 (`$.nodes[2].condition.band`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateGraph(
  out: GraphViolation[],
  at: Id | '',
  label: string,
  rule: GraphViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, at, label, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function graphViolationVerdict(violations: readonly GraphViolation[]): string {
  if (violations.length === 0) return '그래프가 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const labels = [...new Set(violations.map((violation) => violation.label))].filter(
    (label) => label !== '',
  );
  const where = labels.length === 0 ? '그래프' : labels.join(', ');
  return `${where} 가 막혔다 — ${rules.join(', ')}`;
}
