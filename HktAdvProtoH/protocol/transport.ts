// World ↔ View 전송 경계 (C003 ADDED)
//
// 세계와 관찰자가 서로 다른 프로세스에 있을 때 오가는 것의 전부.
// 여기에는 게임 의미가 없다 — 봉투(envelope)와 방향만 있다.
//
//   관찰자 → 세계   자기 식별을 밝히는 것(join) 하나 · ActionRequest 하나
//   세계 → 관찰자   GameViewSnapshot 하나
//
// C004 ADDED — 이어짐이 열리면 관찰자는 가장 먼저 자신을 밝힌다 (join).
// 밝히기 전에 오는 요청은 세계에 도착하지 않는다. 요청 자체에는 주체를 적는 자리가 없고,
// 주체는 "이 이어짐에 붙은 관찰자의 몸" 으로만 정해진다 (INTENT-REQUEST-ATTRIBUTION-001).
//
// 판정 결과는 되돌려 보내지 않는다. 요청이 받아들여졌는지는 그 뒤에 오는
// 관찰 결과로만 드러난다 (04-gameview.spec.yaml 의 requestResult: from-next-observation).

import type { ActionRequest } from './actions';
import type { GameViewSnapshot } from './gameview';

export const TRANSPORT_PATH = '/world'; // WebSocket 경로

export interface ObservationMessage {
  type: 'observation';
  snapshot: GameViewSnapshot;
}

export interface ActionMessage {
  type: 'action';
  action: ActionRequest;
}

// 관찰자가 자신이 누구인지 밝힌다 (C004 ADDED). 이어짐당 한 번, 가장 먼저.
export interface JoinMessage {
  type: 'join';
  observerId: string;
}

export type ServerMessage = ObservationMessage;
export type ClientMessage = ActionMessage | JoinMessage;

// 관찰자와 세계 사이의 이어짐 상태 — 관찰자 쪽이 소유하는 의미다
// (03-world-semantic.md: 세계는 누가 보고 있는지에 따라 달라지지 않는다).
export type LinkState = 'connecting' | 'connected' | 'disconnected';

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const value = JSON.parse(raw) as ServerMessage;
    return value && value.type === 'observation' && value.snapshot ? value : null;
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
    if (value.type !== 'action') return null;
    const action = value.action;
    if (!action || typeof action.interactionId !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}
