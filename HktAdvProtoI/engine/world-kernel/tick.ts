// RULE-WORLD-TICK-001 — Implements INTENT-WORLD-CLOCK-001 · INTENT-PER-OBSERVER-PROJECTION-001
// Input          경과 시간 dt (세계 자신의 시계가 준다),
//                도착해 있는 참여/이탈/표식, 도착해 있는 Action Request 들
// Preconditions  없음 — 세계는 언제나 진행한다
// Transition     0. 도착한 참여/이탈/표식 처리 (RULE-OBSERVER-JOIN-001 ·
//                   RULE-OBSERVER-LEAVE-001 · RULE-OBSERVER-MARK-001)
//                1. 도착한 요청을 순서대로 처리한다 (주체 = 보낸 관찰자의 몸)
//                2. 컨텐츠가 선언한 systems 를 그 순서대로 (설계 반전 ② — P1 CHANGED)
//                3. World.Time += dt
//                4. 컨텐츠가 선언한 postTimeSystems 를 그 순서대로
// Result         Observations — 지금 보고 있는 관찰자 각각의 Observer Projection
//                Outcomes — 이 Tick 이 판정한 요청들의 대답, 요청한 이별로
//                (RULE-REQUEST-REPLY-001).
//
// 참여가 요청보다 앞서는 이유: 같은 Tick 에 들어오면서 보낸 요청이 그 Tick 에 판정될 수
// 있어야 "요청 → 다음 관찰 결과" 인과가 밀리지 않는다.
// 요청 처리가 진행보다 앞서는 이유도 같다.
//
// 표식이 요청보다 앞서 처리되어도 되는 이유: 관찰자는 언제나 요청을 보낸 뒤에
// 표식을 붙이므로, 같은 Tick 안에서 그 요청도 함께 판정된다 — 받아들인 표식과
// 그 요청의 결과가 같은 관찰 결과로 나간다.
//
// P1 CHANGED — 각 자리에서 무슨 진행이 일어나는지는 컨텐츠 팩이 등록한다 (WorldContent).
// 이 프레임이 소유하는 것은 인과의 순서뿐이다. 어느 시스템이 어느 시스템보다 앞서야
// 하는지(예: 의도한 이동 → 물리 보정 → 기력 정산)는 팩의 배열 선언이 말한다.

import type { ActionRequest, ActionResult } from '../protocol-core/actions';
import type { GameViewSnapshot, RequestOutcomeView } from '../protocol-core/gameview';
import type { InteractionHandler, WorldContent } from './content';
import { dispatchAction } from './dispatch';
import { ruleObserverJoin } from './observer-join';
import { ruleObserverLeave } from './observer-leave';
import { ruleObserverMark } from './observer-mark';
import { groupOutcomesByObserver, ruleRequestReply } from './request-reply';
import type { CoreWorldState } from './state';

/** 세계에 도착했지만 아직 처리되지 않은 참여/이탈/표식 */
export interface PendingObserverEvent {
  kind: 'join' | 'leave' | 'mark';
  observerId: string;
  /** kind = mark 일 때 관찰자가 붙인 표식 */
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
  /** 이 Tick 에 처리된 요청들의 판정 (진단·검증용) */
  results: ActionResult[];
  /**
   * 이 Tick 이 판정한 요청들의 대답, 요청한 관찰자별로 (RULE-REQUEST-REPLY-001).
   * 관찰 결과와 다른 것이며 요청한 이에게만 간다.
   * 세계는 이것을 쌓아 두지 않는다 — 이 Tick 의 산출물이지 World State 가 아니다.
   */
  outcomes: Map<string, RequestOutcomeView[]>;
}

export function runWorldTick<S extends CoreWorldState>(
  state: S,
  dt: number,
  pendingObservers: PendingObserverEvent[],
  pending: PendingRequest[],
  content: WorldContent<S>,
  handlers: ReadonlyMap<string, InteractionHandler<S>>,
): WorldTickResult {
  const observerEvents = pendingObservers.splice(0, pendingObservers.length);
  const observerResults = observerEvents.map((event) => {
    if (event.kind === 'join')
      return ruleObserverJoin(state, event.observerId, content.spawnObserverBody);
    if (event.kind === 'leave') return ruleObserverLeave(state, event.observerId);
    return ruleObserverMark(state, event.observerId, event.mark ?? Number.NaN);
  });

  const arrived = pending.splice(0, pending.length);
  const results = arrived.map((request) =>
    dispatchAction(state, request.observerId, request.action, handlers),
  );
  // 판정 결과를 버리지 않고 요청한 이에게 돌려보낸다 (RULE-REQUEST-REPLY-001).
  // 판정 자체는 위에서 이미 끝났다. 여기서 하는 일은 그것을 주소에 붙이는 것뿐이다.
  const outcomes = groupOutcomesByObserver(
    arrived.map((request, index) =>
      ruleRequestReply(request.observerId, request.action, results[index]!),
    ),
  );

  for (const system of content.systems) system(state, dt);
  state.time += dt;
  for (const system of content.postTimeSystems) system(state, dt);

  // Result — 보고 있는 관찰자 각각에 대한 투영.
  // 떠난 관찰자에게는 만들지 않는다. 세계는 그를 위해 아무것도 준비하지 않는다.
  const observations = new Map<string, GameViewSnapshot>();
  for (const observer of state.observers) {
    if (!observer.present) continue;
    const snapshot = content.projectObserver(state, observer.id);
    if (snapshot) observations.set(observer.id, snapshot);
  }

  return { observations, observerResults, results, outcomes };
}
