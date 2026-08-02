// D4 위반 서식 — 압력을 잴 수 없을 때, 무엇을 재려다 어디서 왜 막혔는지를 한 모양으로 적는다.
//
// D4 는 세계를 **읽기만** 한다. 그래서 이 계층의 위반은 대부분 "읽을 수 없다" 이다:
// 세계에 없는 자리를 조건으로 걸었거나, 스키마를 어긴 값이 세계에 들어오려 했거나,
// 아직 오지 않은 시각의 결핍을 적었거나.
//
// 결핍 자체는 위반이 아니다. 굶주림은 세계의 사실이지 어긋남이 아니다 — 그것은 `DeficitReading`
// 으로 남고, 압력이 되어 P 계층의 목적이 된다.

import type { Id } from '../v1/id.ts';

/** 압력을 재지 못하는 사유. */
export type PressureViolationRule =
  // D4-a 세계 모으기
  | 'bad-state' // O2 스키마를 어긴 값이 세계에 들어오려 했다
  | 'duplicate-state' // 같은 자리에 값이 둘이다 (O0 state-exclusion)
  | 'bad-tick' // 지금이 틱이 아니다
  // D4-b 결핍 읽기
  | 'unreadable-condition' // 노드의 조건 자리를 세계 스키마에서 찾을 수 없다
  // D4-c 압력
  | 'unknown-node' // 그래프에 없는 노드의 결핍 시작을 적었다
  | 'future-since'; // 결핍이 아직 오지 않은 시각에 시작됐다고 적었다

/** 위반 하나 — 무엇을 재려다 어디서 왜 막혔는가. */
export interface PressureViolation {
  readonly rule: PressureViolationRule;
  /** 어느 노드·어느 자리에서 걸렸는가 */
  readonly at: Id | string;
  readonly label: string;
  /** 입력 안의 경로 (`$.snapshot.states[3]`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violatePressure(
  out: PressureViolation[],
  at: Id | string,
  label: string,
  rule: PressureViolationRule,
  path: string,
  message: string,
): void {
  out.push({ rule, at, label, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function pressureViolationVerdict(violations: readonly PressureViolation[]): string {
  if (violations.length === 0) return '세계를 읽을 수 있다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  return `압력을 잴 수 없다 — ${rules.join(', ')}`;
}
