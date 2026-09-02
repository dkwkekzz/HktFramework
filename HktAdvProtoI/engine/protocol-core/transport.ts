// World ↔ View 전송 경계
//
// 세계와 관찰자가 서로 다른 프로세스에 있을 때 오가는 것의 전부.
// 여기에는 게임 의미가 없다 — 봉투(envelope)와 방향만 있다.
//
//   관찰자 → 세계   자기 식별을 밝히는 것(join) 하나 · ActionRequest 하나
//   세계 → 관찰자   GameViewSnapshot 하나
//
// 이어짐이 열리면 관찰자는 가장 먼저 자신을 밝힌다 (join).
// 밝히기 전에 오는 요청은 세계에 도착하지 않는다. 요청 자체에는 주체를 적는 자리가 없고,
// 주체는 "이 이어짐에 붙은 관찰자의 몸" 으로만 정해진다 (INTENT-REQUEST-ATTRIBUTION-001).
//
// 세계 → 관찰자 방향에 관찰 결과 말고 다른 것이 처음 실린다.
// 세계는 이제 자신에게 도착한 요청 하나하나에 대답한다 (RULE-REQUEST-REPLY-001).
// 대답은 관찰 결과를 대신하지 않는다 — 세계가 어떻게 되었는지는 지금까지대로
// 관찰 결과가 말하고, 대답이 말하는 것은 "그 요청이 어떻게 되었는가" 하나다.
// (04-gameview.spec.yaml 의 requestResult: from-request-outcome)

import type { ActionRequest } from './actions';
import type { GameViewSnapshot, RequestOutcomeView } from './gameview';

export const TRANSPORT_PATH = '/world'; // WebSocket 경로

export interface ObservationMessage {
  type: 'observation';
  snapshot: GameViewSnapshot;
}

export interface ActionMessage {
  type: 'action';
  action: ActionRequest;
}

// 관찰자가 자신이 누구인지 밝힌다. 이어짐당 한 번, 가장 먼저.
export interface JoinMessage {
  type: 'join';
  observerId: string;
}

// 관찰자가 자기 표식을 세계로 보낸다.
// 게임 요청이 아니다 — 세계를 아무것도 바꾸지 않는다. 세계는 받아들인 자리를
// 그 관찰자의 관찰 결과에 실어 되돌릴 뿐이다 (RULE-OBSERVER-MARK-001).
export interface MarkMessage {
  type: 'mark';
  mark: number;
}

// 세계가 이 관찰자의 요청들에 내놓은 대답.
// 한 Tick 에 여러 요청이 판정되면 여럿이 함께 온다 — 각자 자기 mark 를 지닌다.
export interface OutcomeMessage {
  type: 'outcome';
  outcomes: RequestOutcomeView[];
}

export type ServerMessage = ObservationMessage | OutcomeMessage;
export type ClientMessage = ActionMessage | JoinMessage | MarkMessage;

// 관찰자와 세계 사이의 이어짐 상태 — 관찰자 쪽이 소유하는 의미다
// (03-world-semantic.md: 세계는 누가 보고 있는지에 따라 달라지지 않는다).
export type LinkState = 'connecting' | 'connected' | 'disconnected';

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const value = JSON.parse(raw) as ServerMessage;
    if (!value) return null;
    if (value.type === 'observation') return value.snapshot ? value : null;
    if (value.type === 'outcome') return Array.isArray(value.outcomes) ? value : null;
    return null;
  } catch {
    return null;
  }
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const value = JSON.parse(raw) as ClientMessage;
    if (!value) return null;
    if (value.type === 'join') {
      return typeof value.observerId === 'string' ? value : null;
    }
    if (value.type === 'mark') {
      return typeof value.mark === 'number' && Number.isFinite(value.mark) ? value : null;
    }
    if (value.type !== 'action') return null;
    const action = value.action;
    if (!action || typeof action.interactionId !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}
