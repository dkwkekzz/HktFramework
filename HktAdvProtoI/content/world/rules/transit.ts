// RULE-REGION-TRANSIT-001 — 방 사이의 건너기 (C001 ADDED · C002 CHANGED · 02-world R1)
// Input          Actor, ConnectorId
// Preconditions  1. Connector 가 Graph 에 있다
//                2. Connector 의 한쪽 끝(from 또는 to — 양방향이므로 둘 다)이 Actor 의 Region 에 있다
//                3. 그 끝의 anchor 와 Actor 의 거리 ≤ INTERACTION_RANGE (RULE-MINE-001 과 같은 상수)
//                4. Connector 가 열려 있다 — RULE-CONNECTOR-ACTIVATION-001         (C002 ADDED)
//                   (C009 CHANGED — 정적 목록에 없고 **그리고** 그 문의 활성 조건을 통과한다)
//                   (C016 CHANGED — 활성 조건이 패턴과 **철**을 함께 본다)
//                5. 건너간 뒤의 region 이 지어져 있다 — Description 이 있다           (C002 ADDED)
//                6. 현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001)
// Transition     Actor.RegionId = 반대쪽 끝의 region · Position = 반대쪽 anchor 의 자리 ·
//                Velocity = (0, 0) · CurrentAction = idle ·
//                **떠난 방**의 소란 += DISTURBANCE_PER_TRANSIT (C017 ADDED · RULE-DISTURBANCE-001)
// Result         Success | Failure(unknown-connector | wrong-region | out-of-range |
//                connector-inactive | not-this-season | region-not-built | action-busy)
//
// 거절 사유는 위 순서로 첫 번째로 걸리는 하나다 (01-spec SPEC-006). 거리가 닫힘·경계보다 앞인 것은
// 뜻이 있다 — 멀리서도 사유가 보이면 걸어가 볼 이유가 사라진다. 목적지는 붙어서 물어봐야 안다.
// 거절은 세계 State 를 하나도 바꾸지 않는다 — 몸의 regionId · position · velocity · currentAction 이
// 요청 전과 같다 (01-spec SPEC-006 경계).
//
// 두 Local Space 는 이어져 있지 않다 — 건너는 순간 관성은 없고, 진행 중이던 이동 목표는 뜻이 없다
// (01-spec UNRESOLVED 판정).
//
// C009 CHANGED — 전제 4 가 **지금의 세계 State 를 읽는다** (01-spec R2). 전제의 **순서도 사유 코드도
// 하나도 바뀌지 않는다** — 거리 → 닫힘 → 경계 → 행동이고 사유는 그대로 connector-inactive 다.
// 바뀐 것은 "닫힘" 이 무엇을 보는가 하나다: 정적 사실에 그 방의 지금 pattern 이 더해졌다
// (판정은 semantic/region.ts 의 isConnectorOpen 이 소유한다 — 규칙은 문 이름도 패턴 이름도 모른다).
// 멀리서는 여전히 거리가 먼저 걸린다 — 문이 왜 잠겼는지는 붙어서 물어야 안다.
// 그래서 이 함수가 WorldState 를 받는다: 판정이 세계를 읽어야 하기 때문이고, 세계를 바꾸지는 않는다.
//
// C016 CHANGED — 전제 4 가 세계 State 에 더해 **세계 시각**을 함께 읽고(spec R4), 닫힘의 사유가
// 둘로 갈린다 (spec R5). **철 때문에** 닫힌 문만 not-this-season 이고 그 밖의 닫힘은 여전히
// connector-inactive 다 — 잠긴 것(C009 의 미로 심장 문)과 지금이 그때가 아닌 것은 다른 말이다.
// **전제의 순서는 한 자리도 바뀌지 않는다** — 거리가 여전히 닫힘보다 앞이다 (위 15~16 줄이
// 적어 둔 뜻 그대로: 멀리서 사유가 보이면 걸어가 볼 이유가 사라진다).
// 어느 사유인가는 여기서 다시 판정하지 않는다 — connectorClosedReason 하나가 낸 답을 옮길 뿐이다.
//
// C003 CHANGED — 전이(regionId · position · velocity · currentAction)를 applyRegionTransition 하나로
// 빼서 RULE-REGION-FALL-001 과 나눠 쓴다 (01-spec R2). 전제·사유 여섯·관찰 가능한 행동은 그대로다 —
// 두 규칙이 **같은 전이**를 하되 묻는 것이 다를 뿐임을 코드가 말한다.
// 방을 바꾸는 자리는 이제 그 함수 하나다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_REGION_TRANSIT } from '../../protocol/semantic-id';
import type { ConnectorExit } from '../../../engine/world-authoring/graph';
import { findConnector } from '../../../engine/world-authoring/graph';
import { REGION_GRAPH } from '../../regions';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { distance } from '../semantic/position';
import { anchorPosition, connectorClosedReason, isRegionBuilt } from '../semantic/region';
import { addDisturbance } from '../semantic/region-state';
import {
  DISTURBANCE_PER_TRANSIT,
  INTERACTION_RANGE,
  type WorldState,
} from '../semantic/world-state';
import { evaluateActionBegin } from './action-begin';

// 실패 사유 코드 — Rule 이 소유하며 protocol 로는 문자열 코드로 흐른다
export type TransitFailureReason =
  | 'out-of-range'
  | 'action-busy'
  | 'unknown-connector'
  | 'wrong-region'
  | 'connector-inactive'
  // C016 ADDED (spec R5) — **철 때문에** 닫힌 문의 사유. 잠긴 것과 갈린다
  | 'not-this-season'
  | 'region-not-built';

// Precondition 평가 — Observable(interactions[transit].available / reason)과 Rule 이 같은 판정을 공유한다.
// exit 는 이미 Actor 의 Region 에 있는 끝이다 (here.region === actor.regionId).
export function evaluateTransitPreconditions(
  state: WorldState,
  actor: ActorState,
  exit: ConnectorExit,
): TransitFailureReason | null {
  if (exit.here.region !== actor.regionId) return 'wrong-region';
  const here = anchorPosition(exit.here.region, exit.here.anchor);
  if (distance(actor.position, here) > INTERACTION_RANGE) return 'out-of-range';
  // C002 ADDED — 닫힌 문이 먼저다. 열려 있어도 건너간 뒤가 아직 지어지지 않았으면 갈 수 없다.
  // C009 CHANGED — 그 열림을 세계 State 가 함께 정한다. 자리도 사유도 그대로다.
  // C016 CHANGED — 세계 시각도 함께 본다. **자리는 그대로**이고 사유만 둘로 갈린다 (spec R5).
  const closed = connectorClosedReason(state.regionStates, exit.connector.id, state.time);
  if (closed) return closed === 'season' ? 'not-this-season' : 'connector-inactive';
  if (!isRegionBuilt(exit.there.region)) return 'region-not-built';
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

/**
 * 방을 건너는 전이 — RULE-REGION-TRANSIT-001 과 RULE-REGION-FALL-001 이 함께 쓰는 자리 (C003 ADDED · R2).
 * 무엇을 묻는가는 두 규칙이 각자 정하고, **일어나는 일은 하나**다:
 * 몸은 반대쪽 anchor 에 서고 관성과 진행 중이던 행동은 남지 않는다.
 * 두 Local Space 는 이어져 있지 않기 때문이다.
 * 세계 State 를 바꾸는 것은 Rule 의 Transition 뿐이다 (원칙 4) — 이 함수는 그 Transition 의 몸통이다.
 */
export function applyRegionTransition(actor: ActorState, exit: ConnectorExit): void {
  const there = anchorPosition(exit.there.region, exit.there.anchor);
  actor.regionId = exit.there.region;
  actor.position = { x: there.x, z: there.z };
  actor.velocity = { x: 0, z: 0 };
  actor.currentAction = idleAction();
}

export function ruleTransit(state: WorldState, actor: ActorState, connectorId: string): ActionResult {
  const exit = exitFor(actor, connectorId);
  if (typeof exit === 'string') return { status: 'failure', rule: RULE_REGION_TRANSIT, reason: exit };

  const failure = evaluateTransitPreconditions(state, actor, exit);
  if (failure) return { status: 'failure', rule: RULE_REGION_TRANSIT, reason: failure };

  // RULE-DISTURBANCE-001 (C017 ADDED · spec R1 · R11) — **건넌 것이 소란이 된다.**
  // 오르는 것은 **떠난 방**이다 (spec 기본형 ⑦ · SPEC-001 경계 ③) — 소란은 그 방 안의 몸들이
  // 한 일이 쌓이는 값이고, 건너기를 건 몸은 떠나는 방에 있었다. 그래서 전이 **앞에서** 읽는다:
  // 전이가 끝나면 그 몸은 이미 저쪽 방에 서 있다.
  // 거절은 한 값도 올리지 않는다 (위에서 이미 돌아갔다) — 일어나지 않은 일은 방을 흔들지 않는다.
  const departed = actor.regionId;

  applyRegionTransition(actor, exit);

  // 요청 없이 일어나는 전이(RULE-REGION-FALL-001)는 여기 오지 않는다 — 추락은 이동의 한 갈래라
  // 한 값도 올리지 않는다 (spec R1 경계 ② · SPEC-001 경계 ④). 그래서 이 한 줄은 두 규칙이
  // 나눠 쓰는 applyRegionTransition 이 아니라 **이 규칙**에 있다.
  addDisturbance(state.regionStates, departed, DISTURBANCE_PER_TRANSIT);

  return { status: 'success', rule: RULE_REGION_TRANSIT };
}
