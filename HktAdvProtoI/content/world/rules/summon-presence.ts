// RULE-PRESENCE-SUMMON-001 — 세계 밖에서 거는 **지나가기의 시작** (C018 ADDED · spec R8)
// Input          경로의 id
// Preconditions  1. 세계가 조작을 허용한다 (World.DebugAuthority.Open — RULE-ATTRIBUTE-SET-001 의 판정 그대로)
//                2. 세계가 아는 경로다
// Transition     그 경로가 **지금부터** 지나간다 — 세계 과정이 시간표로 시작할 때와 한 자리
//                (simulation/presence.ts 의 beginPass) 로 간다. 이번 바퀴의 한 번으로 센다
// Result         Success | Failure(debug-closed | unknown-presence)
//
// **세계의 규칙을 하나도 바꾸지 않는다** (spec R8 경계) — 시간표가 하는 일을 지금 시킬 뿐이고,
// 시작한 뒤로는 마디를 옮기는 것도 소란을 올리는 것도 끝나고 남기는 것도 세계 자신의 규칙이
// 그대로 굴린다. 시간표로 시작한 지나감과 **한 값도 다르지 않다** (SPEC-002).
//
// **부른 것도 그 바퀴의 한 번으로 센다** (SPEC-002 경계 ③) — 시작한 바퀴를 같은 자리에
// 적으므로, 부른 뒤에 시간표가 그 바퀴에 또 시작하지 않는다.
//
// **이미 지나고 있는 것을 부르면 처음부터 다시 지나간다** (경계 ④) — 시작 시각과 고른 방들을
// 다시 세우기 때문이다. 마친 수는 건드리지 않는다: 마치지 않은 지나감은 마친 것이 아니다.
//
// 세계의 규칙 안이 아니라 밖에서 손을 대는 자리다 (RULE-ATTRIBUTE-SET-001 · C009 의
// RULE-EMERGENCY-RETURN-001 과 같은 성격). 다만 **권한에 건다** — 비상구와 갈리는 자리다:
// 비상구는 갇힌 몸을 꺼내는 것이라 권한이 닫힌 세계에서도 열려 있어야 하지만, 이것은
// 세계에 없는 사건을 지금 일으키는 것이므로 조작을 닫아 둔 세계에서는 걸리지 않는다.
//
// 규칙은 어떤 경로도 이름으로 알지 못한다 — 아는 것은 "세계가 아는 경로" 뿐이고, 어느 경로가
// 무엇인지는 데이터(content/regions)에만 있다 (C004 가 세운 규율).

import type { ActionResult } from '../../protocol/actions';
import { findPresenceRoute, presenceCycleAt } from '../semantic/presence';
import { beginPass } from '../simulation/presence';
import type { WorldState } from '../semantic/world-state';
import { evaluateAttributeSetAvailability } from './attribute-set';

/**
 * 이 Rule 의 Traceability id.
 *
 * protocol/semantic-id 에 두지 않는 이유 — 이 Cycle 에서 protocol 은 관찰 계약 쪽이 이미
 * 갱신되어 있어 다른 레인이 함께 만지는 자리다. 소비처가 이 파일 하나뿐인 id 이므로
 * 여기가 소유한다 (한 자리에서만 쓰이는 코드를 공용 표에 올리지 않는다).
 */
export const RULE_PRESENCE_SUMMON = 'RULE-PRESENCE-SUMMON-001';

/** 실패 사유 코드 — 문구는 View 의 표가 옮긴다 */
export type SummonPresenceFailureReason = 'debug-closed' | 'unknown-presence';

/**
 * 가용성 판정 — Observable(commands[summon-presence])과 Rule 이 **같은 판정을 공유한다**
 * (C009 의 emergency-return 이 세운 선례 그대로). 두 곳에 따로 적히면 "가용하다고 밝혀 놓고
 * 걸면 거절하는" 세계가 된다.
 *
 * 묻는 것은 하나 — 지금 세계가 조작을 허용하는가. **어느 경로인지는 여기서 묻지 않는다**:
 * 목록에 실리는 것은 명령 하나이고, 모르는 이름은 걸었을 때 대답으로만 드러난다
 * (set-attribute 가 모르는 속성에 하는 그대로).
 */
export function evaluateSummonPresenceAvailability(
  state: WorldState,
): SummonPresenceFailureReason | null {
  return evaluateAttributeSetAvailability(state) === null ? null : 'debug-closed';
}

export function ruleSummonPresence(state: WorldState, routeId: string): ActionResult {
  const closed = evaluateSummonPresenceAvailability(state);
  if (closed) return { status: 'failure', rule: RULE_PRESENCE_SUMMON, reason: closed };

  const route = findPresenceRoute(routeId);
  // 모르는 경로 이름은 **아무 일도 하지 않는다** (SPEC-002 경계 ②) — 없는 것을 지나가게
  // 하지 않고, 무엇이 없는지를 대답으로 밝힌다.
  if (!route) {
    return { status: 'failure', rule: RULE_PRESENCE_SUMMON, reason: 'unknown-presence' };
  }

  const pass = (state.presences[route.id] ??= { passes: 0 });
  beginPass(state, route, pass, presenceCycleAt(state.time));

  return { status: 'success', rule: RULE_PRESENCE_SUMMON };
}
