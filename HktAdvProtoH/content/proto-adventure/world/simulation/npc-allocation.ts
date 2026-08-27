// RULE-NPC-ALLOCATION-001 — Implements INTENT-AUTONOMOUS-BODIES-ALLOCATE-001
//                            (C-COMBAT-001 ADDED)
// Input          Control = autonomous 인 Actor
// Preconditions  쓰러지지 않았다
// Transition     국면이 정한 배분 = (Hp / HpMax <= 문턱) ? reinforce : balanced
//                그것이 지금과 다르면 RULE-ALLOCATION-SET-001 을 그대로 지난다
// Result         Decided | Unchanged
//
// 이 Rule 은 세계 규칙이지 Client 요청이 아니다 — Tick 에서 실행된다.
//
// **국면은 하나이고 문턱도 하나다.** RULE-NPC-DECIDE-001 이 기술 고르기에 대해 내린
// 판단(패턴도 국면도 만들지 않는다)과 나란히 둔다 — 이 Cycle 이 여는 것은 "자율
// 존재도 배분을 지닌다" 이지 판단 구조가 아니다. 습성의 설계는 아직 승인되지 않은
// 문서의 몫이다 (Design-Creature-Behavior-R0 — Master 의 HUMAN 대기).
//
// **양방향이다.** 생명이 문턱 위로 돌아오면 균형으로 내려온다. 지금 세계에 회복이
// 없으므로 실제로 그 길을 지나는 것은 밖에서 값에 손댈 때뿐이지만(RULE-ATTRIBUTE-SET-001),
// 한쪽 길만 여는 것은 "국면에 따라" 가 아니라 "한 번 넘으면 끝" 이다. 상태를 더 두지
// 않고 매 Tick 다시 판정하므로 되돌아오는 데 드는 것도 없다.
//
// **거절도 그대로 받는다.** 기력이 모자라면 바꾸지 못하고 그대로 싸운다 — 자율
// 존재에게만 무는 예외를 두지 않는다 (조종 여부가 규칙을 가르지 않는다). 그래서 큰
// 기술을 자주 건 개체는 다쳐도 몸으로 몰지 못하고, 그것이 이 규칙이 만드는 실제
// 선택이다: 읽을 것 셋(남은 생명 · 지금 배분 · 남은 기력)이 전부 관찰에 실려 있다.

import type { ActorState } from '../semantic/actor';
import type { AllocationId } from '../semantic/allocation';
import { isDowned } from '../semantic/combat';
import type { WorldState } from '../semantic/world-state';
import { ruleAllocationSet } from '../rules/allocation-set';

/**
 * 자율 존재가 몸에 몰기 시작하는 생명 문턱 (World.NpcAllocationHurtRatio).
 *
 * 결정론에 영향을 주므로 헤더 상수다. 이 값을 **관찰에 싣지 않는다** — 사람이
 * 관찰로 배우는 것이 이 층의 목적이며(UL §39), 생명도 배분도 이미 실려 있으므로
 * 배울 재료는 다 있다 (04 OBSERVABLE PROJECTION NOTE 5).
 */
const NPC_ALLOCATION_HURT_RATIO = 0.5;

export function ruleNpcAllocation(actor: ActorState): 'decided' | 'unchanged' {
  if (isDowned(actor)) return 'unchanged';

  const hurt = actor.hpMax > 0 && actor.hp / actor.hpMax <= NPC_ALLOCATION_HURT_RATIO;
  const wanted: AllocationId = hurt ? 'reinforce' : 'balanced';
  if (wanted === actor.allocation) return 'unchanged';

  return ruleAllocationSet(actor, wanted).status === 'success' ? 'decided' : 'unchanged';
}

export function ruleNpcAllocationAll(state: WorldState): void {
  for (const actor of state.actors) {
    if (actor.control === 'autonomous') ruleNpcAllocation(actor);
  }
}
