// RULE-TARGET-CLEAR-STALE-001 — Implements INTENT-TARGET-RELEASE-001
// Input          World (매 Tick)
// Preconditions  없음 — 훑는 규칙이다
// Transition     TargetEntityId 가 그 관찰자의 관찰에 더 이상 실리지 않는 TargetSelection 을 없앤다
// Result         Cleared(관찰자 Id 들) | NoChange
//
// RULE-TARGET-SELECT-001 의 Precondition 2 와 **같은 판정**(isAddressableEntity)을 쓴다 —
// 고를 수 없게 된 것은 고른 채로 둘 수 없다. 판정이 두 곳에 적히면 어긋난다.
//
// REACHABILITY — **지금 이 세계에서 이 규칙은 플레이로 도달하지 않는다.**
//   존재가 세계에서 사라지는 경로가 0건이다: Actor 는 쓰러져도 목록에 남고
//   (RULE-DOWNED-001), Deposit 은 바닥나도 남으며, 관찰자가 떠나도 몸은 자리에 남는다
//   (RULE-OBSERVER-LEAVE-001 — "몸은 그대로 둔다"). 관찰에 범위 제한도 없다.
//   그래도 규칙으로 둔다: 관계를 지니기로 한 이상 성립하지 않게 되었을 때의 처리는
//   그 관계의 일부이며, 존재를 없애는 첫 Cycle 이 이 자리를 새로 발명하지 않아야 한다.
//   검증은 세계 단위 시험이 맡는다 (world/tests/target.spec.ts) —
//   03-world-semantic.md 의 REACHABILITY 와 08 이 이것이 플레이 검증이 아님을 적는다.
//
// 쓰러짐도 거리도 이 판정에 들어가지 않는다 — 멀어져도 쓰러져도 고른 것은 유지되고
// 달라지는 것은 사유뿐이다 (INTENT-TARGET-PERSISTS-001).

import { isAddressableEntity } from '../rules/target';
import type { WorldState } from '../semantic/world-state';

export function ruleTargetClearStale(state: WorldState): void {
  for (let at = state.targetSelections.length - 1; at >= 0; at--) {
    const entry = state.targetSelections[at]!;
    if (!isAddressableEntity(state, entry.targetEntityId)) state.targetSelections.splice(at, 1);
  }
}
