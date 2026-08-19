// Session Presentation — 이어짐 상태를 "어떻게 보여줄지" 결정한다 (결정 Layer 데이터, C003).
//
// 04-gameview.spec.yaml 의 session 절(owner: observer)을 소비한다.
// 이것은 World Snapshot 에서 오지 않는다 — 관찰자 쪽 상태이므로 별도로 해석한다.
//
// C005 CHANGED — visibility: always.
// 정상일 때도 이어짐 패널이 보인다. 좋을 때의 값을 알아야 나빠진 것을 알아볼 수 있다
// (INTENT-LINK-ALWAYS-SHOWN-001). 수치와 신원 줄이 여기에 함께 실린다.

import type { LinkState } from '../../protocol-core/transport';
import type { LinkLine } from './link-presentation';

export interface SessionPresentation {
  state: LinkState;
  text: string;
  /** 보고 있는 세계가 현재가 아닐 수 있음 — 화면에 그 사실을 표시한다 */
  stale: boolean;
  /** 이어짐이 얼마나 잘 통하는가 (C005) — 언제나 표시된다 */
  telemetry: LinkLine[];
  /** 무엇에 이어져 있는가 (C005) */
  binding: LinkLine[];
}

const LINK_TEXT: Record<LinkState, string> = {
  connected: '세계와 이어짐',
  connecting: '세계에 잇는 중…',
  disconnected: '세계와 끊김 — 마지막으로 본 모습입니다',
};

export function sessionPresentation(
  state: LinkState,
  stale: boolean,
  telemetry: LinkLine[] = [],
  binding: LinkLine[] = [],
): SessionPresentation {
  return { state, text: LINK_TEXT[state], stale, telemetry, binding };
}
