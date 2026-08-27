// RULE-ALLOCATION-SET-001 — Implements INTENT-CHANGE-ALLOCATION-001 ·
//                            INTENT-CHANGE-ALLOCATION-REFUSAL-001 ·
//                            INTENT-BODY-HAS-AN-ALLOCATION-001 (C-COMBAT-001 ADDED)
// Input          Actor, 요청한 배분 이름
// Preconditions  ① 요청한 이름이 AllocationCatalog 에 있다   아니면 unknown-allocation
//                ② 쓰러지지 않았다                          아니면 downed
//                ③ 요청이 지금과 **다르면** Cp >= 대가        아니면 insufficient-cp
// Transition     요청이 지금과 같으면 아무것도 하지 않는다
//                다르면  Cp -= ALLOCATION_SWITCH_CP_COST
//                        Allocation = 요청값
// Result         Success | Failure(unknown-allocation | downed | insufficient-cp)
//
// **요청은 토글이 아니라 명시값이다** — 같은 요청이 두 번 와도 결과가 같다
// (RULE-MOVE-MODE-001 의 형태 그대로).
//
// 지금과 같은 배분을 고르는 일은 **성공이며 아무것도 바뀌지 않는다.** 대가도 들지
// 않는다 — 이미 그 자리에 있는 것에 값을 물릴 이유가 없다. 실패로 두지 않는 이유는
// INTENT-CHANGE-ALLOCATION-REFUSAL-001 이 적었다: 그것은 거절이 아니다.
//
// **바뀌는 것은 그 순간부터다.** 유효 값은 저장되지 않고 매번 다시 세어지므로
// (RULE-EFFECTIVE-STATS-001), 휘두르는 도중에 바꾸면 그 타격은 새 배분으로 셈해진다.
// 예외가 아니라 "저장하지 않는다" 의 당연한 귀결이며, 선딜 중에 몸으로 몰아 큰 것을
// 넣는 수가 성립한다 (C019 의 구간 위에 선다).
//
// **대가만 있고 잠금은 없다.** 다시 바꾸기까지 기다리는 시간을 두지 않는다 — 그것은
// 새 상태(언제까지 못 바꾸는가)를 하나 더 낳고, 이 Cycle 이 더하는 상태는 하나뿐이다.
// 자주 바꾸는 일은 기력이 막는다 (DC-COMBAT-SHARED-BUDGET).
//
// 조종 주체를 가리지 않는다 — 자율 존재의 배분도 이 규칙 하나를 지난다
// (RULE-NPC-ALLOCATION-001). 조종 여부가 규칙을 가르지 않는다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_ALLOCATION_SET } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import {
  ALLOCATION_SWITCH_CP_COST,
  isAllocationId,
  type AllocationId,
} from '../semantic/allocation';
import { isDowned } from '../semantic/combat';

export type AllocationSetFailureReason = 'unknown-allocation' | 'downed' | 'insufficient-cp';

/**
 * Observable(Allocation.Availability) 과 Rule 이 **같은 판정을 공유한다** —
 * 투영이 배분마다 이 함수를 불러 available 과 사유를 싣는다
 * (DC-WORLD-OWNS-THE-SURFACE-LIST · RULE-MOVE-MODE-001 의 evaluate 와 같은 자리).
 *
 * 지금과 같은 배분에 대해서는 null(가능)을 낸다 — 거절이 아니기 때문이다.
 * 화면은 그것을 `current` 로 구분한다.
 */
export function evaluateAllocationSet(
  actor: ActorState,
  allocationId: string,
): AllocationSetFailureReason | null {
  if (!isAllocationId(allocationId)) return 'unknown-allocation';
  if (isDowned(actor)) return 'downed';
  if (allocationId === actor.allocation) return null; // 이미 그 자리에 있다 — 대가가 없다
  if (actor.cp < ALLOCATION_SWITCH_CP_COST) return 'insufficient-cp';
  return null;
}

export function ruleAllocationSet(actor: ActorState, allocationId: string): ActionResult {
  const failure = evaluateAllocationSet(actor, allocationId);
  if (failure)
    return { status: 'failure', rule: RULE_ALLOCATION_SET, reason: failure };

  // 지금과 같은 배분 — 성공이되 세계는 변하지 않는다 (기력도 그대로다).
  if (allocationId === actor.allocation)
    return { status: 'success', rule: RULE_ALLOCATION_SET };

  // 관문이 전부 앞에 섰으므로 여기서부터는 실패하지 않는다 —
  // 거절된 요청이 기력만 깎고 배분은 그대로인 일이 생길 수 없다
  // (INTENT-CHANGE-ALLOCATION-REFUSAL-001 "아무것도 남기지 않는다").
  actor.cp -= ALLOCATION_SWITCH_CP_COST;
  actor.allocation = allocationId as AllocationId;
  return { status: 'success', rule: RULE_ALLOCATION_SET };
}
