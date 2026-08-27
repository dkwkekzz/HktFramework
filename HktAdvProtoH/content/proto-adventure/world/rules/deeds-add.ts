// RULE-DEEDS-ADD-001 — Implements INTENT-THE-WORLD-ADDS-WHAT-WAS-DONE-001 ·
//                                 INTENT-THE-BODY-KEEPS-WHAT-IT-DID-001 ·
//                                 INTENT-ENOUGH-IS-A-STEP-001 ·
//                                 INTENT-GROWING-CARRIES-ITS-REASON-001 ·
//                                 INTENT-ONLY-REAL-ACTS-COUNT-001 (C-GROWTH-001 ADDED)
//
// Input          Actor, DeedSource, World.Time
// Preconditions  없음.
//                **일이 실제로 끝났다는 사실이 곧 이 규칙이 불리는 조건이다** —
//                부르는 자리(RULE-STRIKE-DAMAGE-001 · RULE-MINE-COMPLETE-001 ·
//                RULE-OBSERVE-COMPLETE-001)가 이미 그 관문을 지났으므로 여기서 다시
//                묻지 않는다. 이 규칙은 스스로 어떤 일이 일어났는지 판단하지 않는다.
// Transition     Actor.Deeds += DeedCatalog[source]
//                World.GrowthEvents += GrowthEvent(무엇을 · 얼마 · 전후 단계 · 언제)
// Result         Added(amount, levelBefore, levelAfter)
//
// **조종 주체를 가리지 않는다** — 일을 한 몸이면 누구든 쌓는다. 자율 존재도 관찰자를
// 때리며 쌓으며, 그것이 규칙의 예외가 아니라 이 세계의 일관성이다
// (걸린 것 · 배분 · 열이 모두 몸을 가리지 않는 것과 같다).
//
// **같은 일은 언제나 같은 양을 쌓는다** — 피해의 크기도, 캔 것의 종류도, 세계의
// 흔들림도 이 양에 들어가지 않는다 (DC-COMBAT-PLAYER-CAUSALITY). 이 세계에 흔들림은
// 여전히 한 자리뿐이다 (RULE-CRITICAL-STRIKE-001).
//
// 문턱 둘을 한 번에 넘으면 단계도 둘 오른다 — 세계가 붙잡아 두지 않는다.

import type { ActorState } from '../semantic/actor';
import { DEED_AMOUNTS, growthLevel, type DeedSource } from '../semantic/growth';
import type { WorldState } from '../semantic/world-state';

export interface DeedsAdded {
  amount: number;
  levelBefore: number;
  levelAfter: number;
}

export function ruleDeedsAdd(
  state: WorldState,
  actor: ActorState,
  source: DeedSource,
): DeedsAdded {
  const amount = DEED_AMOUNTS[source];
  const levelBefore = growthLevel(actor.deeds);
  actor.deeds += amount;
  const levelAfter = growthLevel(actor.deeds);

  // **오르지 않은 쌓임도 남긴다** — 터지지 않은 치명이 실리는 이유와 같다 (C015).
  // 오르지 않았다는 사실도 관찰이어야 다음 문턱까지의 거리가 읽힌다.
  state.growthEvents.push({
    actorId: actor.id,
    source,
    amount,
    deedsAfter: actor.deeds,
    levelBefore,
    levelAfter,
    time: state.time,
  });

  return { amount, levelBefore, levelAfter };
}
