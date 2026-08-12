// Observer Projection — contracts/observable/OBS-MINING-V1.yaml 구현 (Rule 5·6).
// Observable 은 World Semantic 의 Projection 이다 — packet/serialization 형식이 아니다.
// Player / Designer 는 이 결과만 본다. World 내부 객체는 노출하지 않는다.

import { evaluateMinePreconditions } from './rules';
import type { AuthoritativeWorld } from './authority';
import type { ActionState, FailureReason, TransitionRecord, Vec2 } from './types';

// ── Player Observable (OBS-MINING-V1 observers.player) ──────────────────────

export interface VisibleDeposit {
  id: string;
  position: Vec2; // Deposit.Position
  resourceAmount: number; // Deposit.ResourceAmount
}

export interface MineAvailability {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  target?: string; // 평가 대상 Deposit (알고 있는 것 중 최근접)
  reason?: FailureReason;
}

export interface ActionResult {
  command: 'CMD-MOVE-V1' | 'CMD-MINE-V1';
  result: 'SUCCESS' | 'FAILURE';
  failureReason?: FailureReason;
}

export interface ResourceTransition {
  depositId: string;
  depositBefore: number;
  depositAfter: number;
  stoneBefore: number;
  stoneAfter: number;
}

export interface PlayerObservable {
  actor: {
    position: Vec2; // Actor.Position
    inventoryStone: number; // Actor.Inventory.Stone
    currentAction: ActionState; // Actor.CurrentAction
  };
  visibleDeposits: VisibleDeposit[]; // VisibleDeposit
  mineAvailability: MineAvailability; // MineStone.Availability
  actionResult: ActionResult | null; // ActionResult (마지막 행동)
  resourceTransition: ResourceTransition | null; // ResourceTransition (마지막 채굴 관측)
}

export function projectPlayer(world: AuthoritativeWorld, actorId: string): PlayerObservable {
  const state = world.snapshot();
  const actor = state.actors[actorId];
  if (!actor) {
    return {
      actor: { position: { x: 0, z: 0 }, inventoryStone: 0, currentAction: 'Idle' },
      visibleDeposits: [],
      mineAvailability: { status: 'UNAVAILABLE', reason: 'UNKNOWN_ACTOR' },
      actionResult: null,
      resourceTransition: null,
    };
  }

  // VisibleDeposit — 알고 있는 Deposit 만 (Knowledge projection)
  const visibleDeposits: VisibleDeposit[] = actor.knowledge
    .map((id) => state.deposits[id])
    .filter((d): d is NonNullable<typeof d> => d !== undefined)
    .map((d) => ({ id: d.id, position: { ...d.position }, resourceAmount: d.resourceAmount }));

  // MineStone.Availability — 최근접 known Deposit 에 대해 Rule 전제조건과 동일한 판단
  let availability: MineAvailability = { status: 'UNAVAILABLE', reason: 'UNKNOWN_DEPOSIT' };
  if (visibleDeposits.length > 0) {
    const nearest = [...visibleDeposits].sort(
      (a, b) =>
        Math.hypot(a.position.x - actor.position.x, a.position.z - actor.position.z) -
        Math.hypot(b.position.x - actor.position.x, b.position.z - actor.position.z),
    )[0]!;
    // snapshot 은 frozen 이므로 mutable clone 위에서 평가한다 (평가는 상태를 바꾸지 않는다)
    const evalState = structuredClone(state) as import('./types').WorldState;
    const { failure } = evaluateMinePreconditions(evalState, actorId, nearest.id);
    availability = failure
      ? { status: 'UNAVAILABLE', target: nearest.id, reason: failure }
      : { status: 'AVAILABLE', target: nearest.id };
  }

  // ActionResult / ResourceTransition — Transition log 의 semantic projection
  const log = world.transitionLog();
  const last = log.length > 0 ? log[log.length - 1]! : null;
  const lastMineSuccess = [...log].reverse().find((t) => t.rule === 'RULE-MINE-001' && t.result === 'SUCCESS') ?? null;

  return {
    actor: {
      position: { ...actor.position },
      inventoryStone: actor.inventory.resources.Stone ?? 0,
      currentAction: actor.currentAction,
    },
    visibleDeposits,
    mineAvailability: availability,
    actionResult: last
      ? {
          command: last.rule === 'RULE-MOVE-001' ? 'CMD-MOVE-V1' : 'CMD-MINE-V1',
          result: last.result,
          failureReason: last.failureReason,
        }
      : null,
    resourceTransition: lastMineSuccess
      ? {
          depositId: String((lastMineSuccess.input as { depositId?: string }).depositId ?? ''),
          depositBefore: Number(lastMineSuccess.before['Deposit.ResourceAmount'] ?? 0),
          depositAfter: Number(lastMineSuccess.after['Deposit.ResourceAmount'] ?? 0),
          stoneBefore: Number(lastMineSuccess.before['Actor.Inventory.Stone'] ?? 0),
          stoneAfter: Number(lastMineSuccess.after['Actor.Inventory.Stone'] ?? 0),
        }
      : null,
  };
}

// ── Designer Observable (OBS-MINING-V1 observers.designer — §23 8항목) ──────

export interface DesignerTransitionView {
  currentGoal: 'AcquireStone';
  currentPossibility: string;
  possibilityAvailability: 'AVAILABLE' | 'UNAVAILABLE';
  preconditions: { name: string; pass: boolean }[];
  selectedRule: string;
  beforeState: Record<string, unknown>;
  input: Record<string, unknown>;
  afterState: Record<string, unknown>;
  failureReason: FailureReason | null;
}

export interface DesignerObservable {
  transitions: DesignerTransitionView[];
}

export function projectDesigner(world: AuthoritativeWorld): DesignerObservable {
  const toView = (t: TransitionRecord): DesignerTransitionView => ({
    currentGoal: 'AcquireStone',
    currentPossibility: t.possibility,
    possibilityAvailability: t.result === 'SUCCESS' ? 'AVAILABLE' : 'UNAVAILABLE',
    preconditions: t.preconditions.map((p) => ({ ...p })),
    selectedRule: t.rule,
    beforeState: { ...t.before },
    input: { ...t.input },
    afterState: { ...t.after },
    failureReason: t.failureReason ?? null,
  });
  return { transitions: world.transitionLog().map(toView) };
}
