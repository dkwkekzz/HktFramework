// RULE-REGION-TRANSIT-001 — 방 사이의 건너기 (C001 ADDED · 02-world R1)
// Input          Actor, ConnectorId
// Preconditions  1. Connector 가 Graph 에 있다
//                2. Connector 의 한쪽 끝(from 또는 to — 양방향이므로 둘 다)이 Actor 의 Region 에 있다
//                3. 그 끝의 anchor 와 Actor 의 거리 ≤ INTERACTION_RANGE (RULE-MINE-001 과 같은 상수)
//                4. 현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001)
// Transition     Actor.RegionId = 반대쪽 끝의 region · Position = 반대쪽 anchor 의 자리 ·
//                Velocity = (0, 0) · CurrentAction = idle
// Result         Success | Failure(unknown-connector | wrong-region | out-of-range | action-busy)
//
// 두 Local Space 는 이어져 있지 않다 — 건너는 순간 관성은 없고, 진행 중이던 이동 목표는 뜻이 없다
// (01-spec UNRESOLVED 판정). 위치 이동은 이 Rule 만이 방을 바꾼다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_REGION_TRANSIT } from '../../protocol/semantic-id';
import type { ConnectorExit } from '../../../engine/world-authoring/graph';
import { findConnector } from '../../../engine/world-authoring/graph';
import { REGION_GRAPH } from '../../regions';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { distance } from '../semantic/position';
import { anchorPosition } from '../semantic/region';
import { INTERACTION_RANGE, type WorldState } from '../semantic/world-state';
import { evaluateActionBegin } from './action-begin';

// 실패 사유 코드 — Rule 이 소유하며 protocol 로는 문자열 코드로 흐른다
export type TransitFailureReason =
  | 'out-of-range'
  | 'action-busy'
  | 'unknown-connector'
  | 'wrong-region';

// Precondition 평가 — Observable(interactions[transit].available / reason)과 Rule 이 같은 판정을 공유한다.
// exit 는 이미 Actor 의 Region 에 있는 끝이다 (here.region === actor.regionId).
export function evaluateTransitPreconditions(
  actor: ActorState,
  exit: ConnectorExit,
): TransitFailureReason | null {
  if (exit.here.region !== actor.regionId) return 'wrong-region';
  const here = anchorPosition(exit.here.region, exit.here.anchor);
  if (distance(actor.position, here) > INTERACTION_RANGE) return 'out-of-range';
  return evaluateActionBegin(actor);
}

// Connector 의 끝 가운데 Actor 의 Region 에 있는 쪽 — from 은 언제나, to 는 양방향일 때만.
function exitFor(actor: ActorState, connectorId: string): ConnectorExit | 'unknown-connector' | 'wrong-region' {
  const connector = findConnector(REGION_GRAPH, connectorId);
  if (!connector) return 'unknown-connector';
  if (connector.from.region === actor.regionId) {
    return { connector, here: connector.from, there: connector.to };
  }
  if (connector.direction === 'bidirectional' && connector.to.region === actor.regionId) {
    return { connector, here: connector.to, there: connector.from };
  }
  return 'wrong-region';
}

export function ruleTransit(_state: WorldState, actor: ActorState, connectorId: string): ActionResult {
  const exit = exitFor(actor, connectorId);
  if (typeof exit === 'string') return { status: 'failure', rule: RULE_REGION_TRANSIT, reason: exit };

  const failure = evaluateTransitPreconditions(actor, exit);
  if (failure) return { status: 'failure', rule: RULE_REGION_TRANSIT, reason: failure };

  const there = anchorPosition(exit.there.region, exit.there.anchor);
  actor.regionId = exit.there.region;
  actor.position = { x: there.x, z: there.z };
  actor.velocity = { x: 0, z: 0 };
  actor.currentAction = idleAction();
  return { status: 'success', rule: RULE_REGION_TRANSIT };
}
