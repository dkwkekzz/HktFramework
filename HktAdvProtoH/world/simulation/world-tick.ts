// RULE-WORLD-TICK-001 — Implements INTENT-WORLD-CLOCK-001 · INTENT-PER-OBSERVER-PROJECTION-001
// Input          경과 시간 dt (세계 자신의 시계가 준다),
//                도착해 있는 참여/이탈, 도착해 있는 Action Request 들
// Preconditions  없음 — 세계는 언제나 진행한다
// Transition     0. 도착한 참여/이탈/표식 처리 (RULE-OBSERVER-JOIN-001 ·
//                   RULE-OBSERVER-LEAVE-001 · RULE-OBSERVER-MARK-001)
//                1. 도착한 요청을 순서대로 처리한다 (주체 = 보낸 관찰자의 몸)
//                2. RULE-NPC-DECIDE-001   3. RULE-MOVE-PROGRESS-001
//                4. RULE-ACTION-PROGRESS-001                     5. World.Time += dt
// Result         Observations — 지금 보고 있는 관찰자 각각의 Observer Projection
//
// 참여가 요청보다 앞서는 이유: 같은 Tick 에 들어오면서 보낸 요청이 그 Tick 에 판정될 수
// 있어야 "요청 → 다음 관찰 결과" 인과가 밀리지 않는다.
// 요청 처리가 진행보다 앞서는 이유도 같다 (C003).
//
// 표식이 요청보다 앞서 처리되어도 되는 이유 (C005): 관찰자는 언제나 요청을 보낸 뒤에
// 표식을 붙이므로, 같은 Tick 안에서 그 요청도 함께 판정된다 — 받아들인 표식과
// 그 요청의 결과가 같은 관찰 결과로 나간다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { dispatchAction } from '../actions/dispatch';
import { projectObserverView } from '../projection/observer-view';
import { ruleObserverJoin, type BodyDefaults } from '../rules/observer-join';
import { ruleObserverLeave } from '../rules/observer-leave';
import { ruleObserverMark } from '../rules/observer-mark';
import type { WorldState } from '../semantic/world-state';
import { ruleActionProgress } from './action-progress';
import { ruleMoveProgress } from './move-progress';
import { ruleNpcDecideAll } from './npc-decide';

/** 세계에 도착했지만 아직 처리되지 않은 참여/이탈/표식 */
export interface PendingObserverEvent {
  kind: 'join' | 'leave' | 'mark';
  observerId: string;
  /** kind = mark 일 때 관찰자가 붙인 표식 (C005) */
  mark?: number;
}

/** 세계에 도착했지만 아직 판정되지 않은 요청 — 어느 이어짐으로 왔는지가 함께 온다 */
export interface PendingRequest {
  observerId: string;
  action: ActionRequest;
}

export interface WorldTickResult {
  /** 이 Tick 이 내보내는 관찰 결과 — 보고 있는 관찰자마다 하나씩 */
  observations: Map<string, GameViewSnapshot>;
  /** 이 Tick 에 처리된 참여/이탈의 판정. 관찰자에게는 보내지 않는다 (진단·검증용) */
  observerResults: ActionResult[];
  /** 이 Tick 에 처리된 요청들의 판정. 관찰자에게는 보내지 않는다 (진단·검증용) */
  results: ActionResult[];
}

export function ruleWorldTick(
  state: WorldState,
  dt: number,
  pendingObservers: PendingObserverEvent[],
  pending: PendingRequest[],
  bodyDefaults?: BodyDefaults,
): WorldTickResult {
  const observerEvents = pendingObservers.splice(0, pendingObservers.length);
  const observerResults = observerEvents.map((event) => {
    if (event.kind === 'join') return ruleObserverJoin(state, event.observerId, bodyDefaults);
    if (event.kind === 'leave') return ruleObserverLeave(state, event.observerId);
    return ruleObserverMark(state, event.observerId, event.mark ?? Number.NaN);
  });

  const arrived = pending.splice(0, pending.length);
  const results = arrived.map((request) => dispatchAction(state, request.observerId, request.action));

  ruleNpcDecideAll(state);
  ruleMoveProgress(state, dt);
  ruleActionProgress(state, dt);
  state.time += dt;

  // Result — 보고 있는 관찰자 각각에 대한 투영.
  // 떠난 관찰자에게는 만들지 않는다. 세계는 그를 위해 아무것도 준비하지 않는다.
  const observations = new Map<string, GameViewSnapshot>();
  for (const observer of state.observers) {
    if (!observer.present) continue;
    const snapshot = projectObserverView(state, observer.id);
    if (snapshot) observations.set(observer.id, snapshot);
  }

  return { observations, observerResults, results };
}
