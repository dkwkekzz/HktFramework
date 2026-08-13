// Session Presentation — 이어짐 상태를 "어떻게 보여줄지" 결정한다 (결정 Layer 데이터, C003).
//
// 04-gameview.spec.yaml 의 session 절(owner: observer)을 소비한다.
// 이것은 World Snapshot 에서 오지 않는다 — 관찰자 쪽 상태이므로 별도로 해석한다.

import type { LinkState } from '../../protocol/transport';

export interface SessionPresentation {
  state: LinkState;
  text: string;
  /** 보고 있는 세계가 현재가 아닐 수 있음 — 화면에 그 사실을 표시한다 */
  stale: boolean;
}

const LINK_TEXT: Record<LinkState, string> = {
  connected: '세계와 이어짐',
  connecting: '세계에 잇는 중…',
  disconnected: '세계와 끊김 — 마지막으로 본 모습입니다',
};

export function sessionPresentation(state: LinkState, stale: boolean): SessionPresentation {
  return { state, text: LINK_TEXT[state], stale };
}
