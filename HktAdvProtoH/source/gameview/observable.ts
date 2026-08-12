// GameView 가 소비하는 Observable 타입 — contracts/observable/OBS-MINING-V1.yaml 의 미러.
// World 모듈을 import 하지 않는다 (Rule 7·8). Integration 층이 구조 동일 데이터를 주입한다.

export interface Vec2 {
  x: number;
  z: number;
}

export type ObservableAction = 'Idle' | 'Mine';

export interface ObservableDeposit {
  id: string;
  position: Vec2; // Deposit.Position
  resourceAmount: number; // Deposit.ResourceAmount
}

export interface ObservableAvailability {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  target?: string;
  reason?: string;
}

export interface ObservableActionResult {
  command: string;
  result: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
}

export interface ObservableResourceTransition {
  depositId: string;
  depositBefore: number;
  depositAfter: number;
  stoneBefore: number;
  stoneAfter: number;
}

// OBS-MINING-V1 observers.player 전체
export interface PlayerObservable {
  actor: {
    position: Vec2; // Actor.Position
    inventoryStone: number; // Actor.Inventory.Stone
    currentAction: ObservableAction; // Actor.CurrentAction
  };
  visibleDeposits: ObservableDeposit[]; // VisibleDeposit
  mineAvailability: ObservableAvailability; // MineStone.Availability
  actionResult: ObservableActionResult | null; // ActionResult
  resourceTransition: ObservableResourceTransition | null; // ResourceTransition
}
