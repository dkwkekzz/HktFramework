// World Semantic — Deposit
// ResourceAmount 는 World Authority — RULE-MINE-001 Transition 에서만 감소한다.

import type { WorldPosition } from './position';

export interface DepositState {
  id: string;
  position: WorldPosition;
  resourceKind: 'stone'; // 이번 Cycle 은 stone 고정
  resourceAmount: number;
}
