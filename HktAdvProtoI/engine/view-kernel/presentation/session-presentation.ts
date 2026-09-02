// Session Presentation — 이어짐 상태를 "어떻게 보여줄지" 결정한다 (결정 Layer 데이터).
//
// 04-gameview.spec.yaml 의 session 절(owner: observer)을 소비한다.
// 이것은 World Snapshot 에서 오지 않는다 — 관찰자 쪽 상태이므로 별도로 해석한다.
//
// visibility: always.
// 정상일 때도 이어짐 패널이 보인다. 좋을 때의 값을 알아야 나빠진 것을 알아볼 수 있다
// (INTENT-LINK-ALWAYS-SHOWN-001). 수치와 신원 줄이 여기에 함께 실린다.

import type { LinkState } from '../../protocol-core/transport';
import { RAW_CODE, type CodeTextFn } from './code-text';
import type { LinkLine } from './link-presentation';

/**
 * 이어짐 상태를 부르는 문구 코드 — **말은 팩의 것이다** (문구 반전 ⑤).
 * 무엇이 이어짐이고 어떤 갈래가 있는지는 기반이 알지만, 그것을 사람에게 뭐라 이르는지는
 * 세계마다 다르다.
 */
export const SESSION_TEXT_CODES = [
  'link.state.connected',
  'link.state.connecting',
  'link.state.disconnected',
] as const;

export interface SessionPresentation {
  state: LinkState;
  text: string;
  /** 보고 있는 세계가 현재가 아닐 수 있음 — 화면에 그 사실을 표시한다 */
  stale: boolean;
  /** 이어짐이 얼마나 잘 통하는가 — 언제나 표시된다 */
  telemetry: LinkLine[];
  /** 무엇에 이어져 있는가 */
  binding: LinkLine[];
}

export function sessionPresentation(
  state: LinkState,
  stale: boolean,
  telemetry: LinkLine[] = [],
  binding: LinkLine[] = [],
  textOf: CodeTextFn = RAW_CODE,
): SessionPresentation {
  return { state, text: textOf(`link.state.${state}`), stale, telemetry, binding };
}
