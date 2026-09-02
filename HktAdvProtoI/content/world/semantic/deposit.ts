// World Semantic — Deposit
// ResourceAmount 는 World Authority — RULE-MINE-001 Transition 에서만 감소한다.
// C001 ADDED — RegionId: 광맥이 있는 Region. position 은 그 Region 의 Local Space 좌표다.

import type { WorldPosition } from './position';

export interface DepositState {
  id: string;
  regionId: string;
  position: WorldPosition;
  resourceKind: 'stone'; // 이번 Cycle 은 stone 고정
  resourceAmount: number;
}
