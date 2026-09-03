// RULE-REGION-FALL-001 — 요청 없이 일어나는 전이 (C003 ADDED · 01-spec R1 · SPEC-006)
// Input          모든 Actor
// Preconditions  1. 그 몸이 선 Region 에서 나가는 끝 E 의 transition 이 falling 이다
//                2. 그 끝의 anchor 와 몸의 거리 ≤ INTERACTION_RANGE (건너기와 같은 상수)
//                3. Connector 가 열려 있다 (CLOSED_CONNECTORS 에 없다)
//                4. 건너간 뒤의 region 이 지어져 있다 (Description 이 있다)
// Transition     RULE-REGION-TRANSIT-001 과 **같은 전이** (applyRegionTransition) —
//                RegionId = 반대쪽 끝의 region · Position = 반대쪽 anchor 의 자리 ·
//                Velocity = (0, 0) · CurrentAction = idle
// Result         없음 — 요청이 아니므로 대답할 상대가 없다
//
// 거절이 없고 사유 코드도 없다. 요청이 아니기 때문이다 (01-spec R1).
// 진행 중인 행동을 묻지 않는다 — evaluateActionBegin 을 부르지 않는다. 떨어지는 것은
// 하기로 한 일이 아니므로 대체 가능성을 물을 상대가 없다 (01-spec SPEC-006 경계 ①).
// 요청 없이 데려가는 것은 falling 하나뿐이다 — 다른 transition 의 anchor 위에 서 있어도
// 아무 일도 일어나지 않는다 (경계 ③).
//
// 한 Tick 에 한 몸은 한 번만 옮겨진다 — 옮긴 뒤 그 몸에 대한 판정을 멈추고 다음 몸으로 간다.
// 그래서 떨어진 자리에서 곧바로 또 떨어지는 일이 없다 (경계 ②).
// 대상은 state.actors 전부다 — 관찰자의 몸이든 자율 존재든 세계는 가리지 않는다.
// 순회 순서는 state.actors 순서이고 그 안에서 regionExitsOf 순서다 (결정론).

import { applyRegionTransition } from '../rules/transit';
import { distance } from '../semantic/position';
import {
  anchorPosition,
  isConnectorOpen,
  isRegionBuilt,
  regionExitsOf,
} from '../semantic/region';
import { INTERACTION_RANGE, type WorldState } from '../semantic/world-state';

/** 요청 없이 건너지는 연결의 transition — 이 값 하나뿐이다 (01-spec SPEC-003 표) */
const FALLING_TRANSITION = 'falling';

export function ruleRegionFall(state: WorldState): void {
  for (const actor of state.actors) {
    for (const exit of regionExitsOf(actor.regionId)) {
      if (exit.connector.transition !== FALLING_TRANSITION) continue;

      const here = anchorPosition(exit.here.region, exit.here.anchor);
      if (distance(actor.position, here) > INTERACTION_RANGE) continue;
      if (!isConnectorOpen(exit.connector.id)) continue;
      if (!isRegionBuilt(exit.there.region)) continue;

      applyRegionTransition(actor, exit);
      break; // 한 Tick 에 한 몸은 한 번만 옮겨진다
    }
  }
}
