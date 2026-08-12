// World Semantic 타입 — cycles/C002/artifacts/world-design/world_state.yaml 대응.
// 세계의 사실만 담는다. cache/thread/packet 등 Implementation State 금지.

export type ActorId = string;
export type DepositId = string;

export interface Vec2 {
  x: number;
  z: number;
}

export type ResourceType = 'Stone';

export type ToolCapability = 'Mining';

export interface Tool {
  kind: string; // 예: Pickaxe
  capability: ToolCapability;
}

export type ActionState = 'Idle' | 'Mine';

export interface ActorState {
  id: ActorId;
  position: Vec2;
  inventory: {
    resources: Partial<Record<ResourceType, number>>;
    tools: Tool[];
  };
  knowledge: DepositId[]; // 알고 있는 Deposit
  currentAction: ActionState;
  // Mine 행위가 유지되는 남은 tick — CurrentAction 의 지속을 표현하는 세계 사실
  actionTicksRemaining: number;
}

export interface DepositState {
  id: DepositId;
  position: Vec2;
  resourceType: ResourceType;
  resourceAmount: number;
}

export interface WorldState {
  tick: number;
  actors: Record<ActorId, ActorState>;
  deposits: Record<DepositId, DepositState>;
}

// ── Rule 평가 기록 (Designer Observer 의 관찰 단위: Before → Input → Rule → After) ──

export type FailureReason =
  | 'UNKNOWN_ACTOR'
  | 'UNKNOWN_DEPOSIT'
  | 'INVALID_DIRECTION'
  | 'NO_MINING_TOOL'
  | 'OUT_OF_RANGE'
  | 'DEPOSIT_EMPTY';

export interface PreconditionResult {
  name: string;
  pass: boolean;
}

export interface TransitionRecord {
  tick: number;
  rule: 'RULE-MOVE-001' | 'RULE-MINE-001';
  possibility: 'ApproachDeposit' | 'MineStone';
  input: Record<string, unknown>;
  preconditions: PreconditionResult[];
  result: 'SUCCESS' | 'FAILURE';
  failureReason?: FailureReason;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}
