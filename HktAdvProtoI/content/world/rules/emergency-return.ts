// RULE-EMERGENCY-RETURN-001 — 세계 밖에서 거는 비상 자리로의 옮김 (C009 ADDED · 01-spec R3)
// Input          Actor
// Preconditions  1. 그 몸이 선 방이 비상 자리를 밝혀 두었다 (RegionSpec.emergencyAnchor)
// Transition     Position = 그 anchor 의 자리 · Velocity = (0, 0) · CurrentAction = idle.
//                **RegionId 는 바뀌지 않는다** — 같은 방 안이다
// Result         Success | Failure(no-emergency-exit)
//
// 이것은 **이동이 아니다.** move-progress 를 거치지 않으므로 압력이 오르지 않고, 그래서
// 이 옮김으로 패턴을 넘길 수도 없다 (01-spec SPEC-006 경계). 규칙의 Trigger 가 "이동으로
// 자리가 바뀐다" 인데 이것은 이동이 아니기 때문이다 — 올린다면 탈출로 패턴을 조작할 수 있게 되어
// "걸어서 규칙을 쓴다" 는 이 Play 의 축이 흐려진다.
//
// **방을 건너지도 않는다.** 그래서 applyRegionTransition 을 부르지 않는다 — 그 함수는 두 Local
// Space 사이의 전이이고 여기는 한 Space 안의 일이다. 하는 일은 그 전이와 같은 모양이되
// (몸이 anchor 에 서고 관성과 진행 중이던 행동이 남지 않는다) regionId 는 그대로다.
// 미로 쪽에서 이 명령을 걸어도 심장에 있는 몸을 꺼내 주지 않는 이유가 그것이다 (W14).
//
// 압력 · 패턴 · rearrangedAt 은 한 값도 건드리지 않는다. movedThisTick 도 건드리지 않는다 —
// 옮겨진 것은 몸의 자리 하나뿐이다.
//
// 세계의 규칙 안이 아니라 밖에서 손을 대는 자리다 (RULE-ATTRIBUTE-SET-001 과 같은 성격).
// 그러나 **권한(DebugAuthority)에는 걸지 않았다** — 뜻은 세계의 것이고
// (L2-World-Region §16 이 exit.emergency 를 Region 의 성질로 적었다), 권한이 닫힌 세계에서
// 갇히면 그것은 비상구가 아니다 (01-spec UNRESOLVED 판정).
//
// 규칙은 방 이름도 anchor 이름도 알지 못한다 — 아는 것은 "비상 자리를 밝힌 방" 뿐이고,
// 어느 방의 어디인지는 데이터(content/regions)에만 있다 (C004 가 세운 규율).

import type { ActionResult } from '../../protocol/actions';
import { RULE_EMERGENCY_RETURN } from '../../protocol/semantic-id';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { anchorPosition, regionSpecOf } from '../semantic/region';

/** 실패 사유 코드 — 그 방에는 비상 자리가 없다. 문구는 View 의 표가 옮긴다 */
export type EmergencyReturnFailureReason = 'no-emergency-exit';

/**
 * 가용성 판정 — Observable(commands[emergency-return] · interactions[emergency-return])과
 * Rule 이 **같은 판정을 공유한다** (evaluateTransitPreconditions 의 선례).
 * 두 곳에 따로 적히면 "가용하다고 밝혀 놓고 걸면 거절하는" 세계가 된다.
 *
 * 묻는 것은 하나다 — 그 몸이 선 방이 비상 자리를 밝혀 두었는가. 행동 중인지는 묻지 않는다:
 * 비상구는 하던 일을 이유로 막히지 않는다 (전이가 진행 중이던 행동을 남기지 않는 것과 같은 뜻).
 */
export function evaluateEmergencyReturnAvailability(
  actor: ActorState,
): EmergencyReturnFailureReason | null {
  return regionSpecOf(actor.regionId).emergencyAnchor ? null : 'no-emergency-exit';
}

export function ruleEmergencyReturn(actor: ActorState): ActionResult {
  const failure = evaluateEmergencyReturnAvailability(actor);
  if (failure) return { status: 'failure', rule: RULE_EMERGENCY_RETURN, reason: failure };

  // 가용성이 참이면 이 값이 있다 — 없으면 위에서 이미 거절되었다.
  const anchorTag = regionSpecOf(actor.regionId).emergencyAnchor!;
  // 밝혀 둔 이름의 anchor 가 그 방에 없으면 데이터 오류다 — 조용히 넘기지 않고 throw 한다
  // (anchorPosition 의 규약 그대로).
  const there = anchorPosition(actor.regionId, anchorTag);

  actor.position = { x: there.x, z: there.z };
  actor.velocity = { x: 0, z: 0 };
  actor.currentAction = idleAction();

  return { status: 'success', rule: RULE_EMERGENCY_RETURN };
}
