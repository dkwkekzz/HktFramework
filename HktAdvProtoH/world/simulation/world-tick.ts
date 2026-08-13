// RULE-WORLD-TICK-001 — Implements INTENT-WORLD-CLOCK-001 · INTENT-WORLD-OBSERVATION-001
// Input          경과 시간 dt (세계 자신의 시계가 준다), 도착해 있는 Action Request 들
// Preconditions  없음 — 세계는 언제나 진행한다
// Transition     1. 도착한 요청을 순서대로 처리한다   2. RULE-NPC-DECIDE-001
//                3. RULE-MOVE-PROGRESS-001            4. RULE-ACTION-PROGRESS-001
//                5. World.Time += dt
// Result         Observation — 이 시점의 Observer Projection
//
// 요청 처리가 진행보다 앞서는 이유: 그 Tick 에 도착한 조작이 그 Tick 의 진행에
// 반영되어야 "요청 → 다음 관찰 결과" 인과가 한 칸 이상 밀리지 않는다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { dispatchAction } from '../actions/dispatch';
import { projectPlayerView } from '../projection/player-view';
import type { WorldState } from '../semantic/world-state';
import { ruleActionProgress } from './action-progress';
import { ruleMoveProgress } from './move-progress';
import { ruleNpcDecideAll } from './npc-decide';

export interface WorldTickResult {
  /** 이 Tick 이 내보내는 관찰 결과 — 세계 밖으로 나가는 유일한 것 */
  snapshot: GameViewSnapshot;
  /** 이 Tick 에 처리된 요청들의 판정. 관찰자에게는 보내지 않는다 (진단·검증용) */
  results: ActionResult[];
}

export function ruleWorldTick(
  state: WorldState,
  dt: number,
  pending: ActionRequest[],
): WorldTickResult {
  const arrived = pending.splice(0, pending.length);
  const results = arrived.map((action) => dispatchAction(state, action));

  ruleNpcDecideAll(state);
  ruleMoveProgress(state, dt);
  ruleActionProgress(state, dt);
  state.time += dt;

  return { snapshot: projectPlayerView(state), results };
}
