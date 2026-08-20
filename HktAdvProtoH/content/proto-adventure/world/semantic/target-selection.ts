// World Semantic — World.TargetSelections (C017 ADDED)
//
// 지금 이 관찰자가 누구를 고르고 있는가 (INTENT-TARGET-SELECT-001).
//
// 이 장부의 성질 셋이 이 Cycle 의 핵심이며, 셋 다 C014 의 앎 장부(acquaintance.ts)에서
// 그대로 가져온 것이다 — 새로 발명하지 않았다.
//   1. 고른 것은 **세계가 지니는 사실**이다. 보는 이가 자기 쪽에 적어 두는 것이 아니다 —
//      그러면 Client 가 세계 상태를 소유하게 된다 (World Authority).
//   2. 담는 것은 **Id 뿐**이다. 이름도 자리도 생명도 베껴 담지 않는다. 값은 언제나
//      그 순간의 존재에서 읽는다 — 베끼면 대상이 달라져도 고른 자리에는 옛 값이 남는다.
//   3. 열은 **ObserverId** 다. 고르는 것은 몸이 아니라 보는 이의 의도이므로
//      (INTENT-TARGET-PER-OBSERVER-001), 한 몸을 둘이 번갈아 조종해도 고른 것은 갈린다.
//
// 항목이 없는 관찰자는 아무것도 고르지 않은 것이다 — "없음" 을 따로 저장하지 않는다.
//
// 대상 쪽에는 아무것도 적지 않는다. 존재는 자기가 골라졌는지 알 수 없고,
// 그 사실로 달라지지도 않는다 (DC-TARGET-IS-INTENT-NOT-AIM).
// 자율 존재는 이 장부를 읽지 않는다 (RULE-NPC-DECIDE-001 무변경).

/** 한 관찰자가 고른 존재 하나 */
export interface TargetSelectionState {
  observerId: string;
  targetEntityId: string;
}

/** 왜 고를 수 없는가 (RULE-TARGET-SELECT-001 Preconditions 순서 그대로) */
export type TargetSelectFailureReason =
  | 'unknown-observer'
  | 'no-such-target'
  | 'target-is-self';

/** 대상을 정해야 하는 행동이 고른 것을 읽을 때의 실패 사유 (C017 ADDED) */
export type TargetDirectedFailureReason = 'no-target-selected' | 'target-kind-mismatch';

export function findSelection(
  selections: TargetSelectionState[],
  observerId: string,
): TargetSelectionState | undefined {
  return selections.find((entry) => entry.observerId === observerId);
}

/** 지금 고른 존재의 Id — 아무것도 고르지 않았으면 없다 */
export function selectedEntityId(
  selections: TargetSelectionState[],
  observerId: string,
): string | undefined {
  return findSelection(selections, observerId)?.targetEntityId;
}

/** 고른다 — 앞의 것을 대신한다. 같은 것을 다시 골라도 결과가 같다 (토글이 아니다) */
export function selectTarget(
  selections: TargetSelectionState[],
  observerId: string,
  targetEntityId: string,
): void {
  const entry = findSelection(selections, observerId);
  if (entry) {
    entry.targetEntityId = targetEntityId;
    return;
  }
  selections.push({ observerId, targetEntityId });
}

/** 푼다 — 없었으면 없던 대로 둔다. 있었는지를 돌려준다 */
export function clearTarget(selections: TargetSelectionState[], observerId: string): boolean {
  const at = selections.findIndex((entry) => entry.observerId === observerId);
  if (at < 0) return false;
  selections.splice(at, 1);
  return true;
}
