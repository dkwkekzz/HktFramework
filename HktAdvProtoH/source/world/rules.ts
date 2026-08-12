// World Rule — cycles/C002/artifacts/world-design/world_rules.yaml 대응.
// Rule 은 코드 함수가 아니라 "세계에서 허용되는 상태 변화"다.
// 모든 상태 변경은 이 파일의 Rule 을 통해서만 일어난다 (Rule 3 — Authoritative World).

import { EXTRACT_AMOUNT, INTERACTION_RANGE, MINE_DURATION_TICKS, MOVE_SPEED } from './constants';
import type {
  ActorState,
  DepositState,
  FailureReason,
  PreconditionResult,
  TransitionRecord,
  WorldState,
} from './types';

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

interface RuleOutcome {
  record: TransitionRecord;
}

// RULE-MOVE-001 — Actor 가 이동 의도(방향)를 표현하면 세계가 MoveSpeed 한계 내에서 위치를 전진시킨다.
export function ruleMove(
  world: WorldState,
  actorId: string,
  direction: { dx: number; dz: number },
): RuleOutcome {
  const actor: ActorState | undefined = world.actors[actorId];
  const magnitude = Math.hypot(direction.dx, direction.dz);
  const preconditions: PreconditionResult[] = [
    { name: 'Actor exists', pass: actor !== undefined },
    {
      name: 'Direction is a bounded unit intent',
      pass: Number.isFinite(magnitude) && magnitude > 0,
    },
  ];
  const before = actor ? { 'Actor.Position': { ...actor.position } } : {};
  const failure: FailureReason | undefined = !actor
    ? 'UNKNOWN_ACTOR'
    : !(Number.isFinite(magnitude) && magnitude > 0)
      ? 'INVALID_DIRECTION'
      : undefined;

  if (!failure && actor) {
    // 세계가 결정하는 한계: 의도는 방향으로만 쓰이고 이동량은 MoveSpeed 로 고정
    const nx = direction.dx / magnitude;
    const nz = direction.dz / magnitude;
    actor.position.x += nx * MOVE_SPEED;
    actor.position.z += nz * MOVE_SPEED;
  }

  return {
    record: {
      tick: world.tick,
      rule: 'RULE-MOVE-001',
      possibility: 'ApproachDeposit',
      input: { actorId, direction },
      preconditions,
      result: failure ? 'FAILURE' : 'SUCCESS',
      failureReason: failure,
      before,
      after: actor ? { 'Actor.Position': { ...actor.position } } : {},
    },
  };
}

// RULE-MINE-001 의 preconditions 평가 — Availability projection 과 실행이 같은 판단을 공유한다.
export function evaluateMinePreconditions(
  world: WorldState,
  actorId: string,
  depositId: string,
): { preconditions: PreconditionResult[]; failure?: FailureReason } {
  const actor = world.actors[actorId];
  const deposit = world.deposits[depositId];

  const knows = !!actor && actor.knowledge.includes(depositId);
  const hasTool = !!actor && actor.inventory.tools.some((t) => t.capability === 'Mining');
  const inRange =
    !!actor && !!deposit && distance(actor.position, deposit.position) <= INTERACTION_RANGE;
  const hasResource = !!deposit && deposit.resourceAmount > 0;

  const preconditions: PreconditionResult[] = [
    { name: 'Actor exists', pass: !!actor },
    { name: 'Deposit exists', pass: !!deposit },
    { name: 'Actor knows Deposit', pass: knows },
    { name: 'Actor owns Mining-capable Tool', pass: hasTool },
    { name: 'Actor in InteractionRange', pass: inRange },
    { name: 'Deposit ResourceAmount > 0', pass: hasResource },
  ];

  const failure: FailureReason | undefined = !actor
    ? 'UNKNOWN_ACTOR'
    : !deposit || !knows
      ? 'UNKNOWN_DEPOSIT' // 모르는 Deposit 은 존재하지 않는 것과 동일하게 취급
      : !hasTool
        ? 'NO_MINING_TOOL'
        : !inRange
          ? 'OUT_OF_RANGE'
          : !hasResource
            ? 'DEPOSIT_EMPTY'
            : undefined;

  return { preconditions, failure };
}

// RULE-MINE-001 — 전제조건 충족 시 자원을 추출한다.
export function ruleMine(world: WorldState, actorId: string, depositId: string): RuleOutcome {
  const { preconditions, failure } = evaluateMinePreconditions(world, actorId, depositId);
  const actor = world.actors[actorId];
  const deposit: DepositState | undefined = world.deposits[depositId];

  const before = {
    'Deposit.ResourceAmount': deposit?.resourceAmount,
    'Actor.Inventory.Stone': actor?.inventory.resources.Stone ?? 0,
    'Actor.CurrentAction': actor?.currentAction,
  };

  if (!failure && actor && deposit) {
    deposit.resourceAmount -= EXTRACT_AMOUNT;
    actor.inventory.resources[deposit.resourceType] =
      (actor.inventory.resources[deposit.resourceType] ?? 0) + EXTRACT_AMOUNT;
    actor.currentAction = 'Mine';
    actor.actionTicksRemaining = MINE_DURATION_TICKS;
  }

  return {
    record: {
      tick: world.tick,
      rule: 'RULE-MINE-001',
      possibility: 'MineStone',
      input: { actorId, depositId },
      preconditions,
      result: failure ? 'FAILURE' : 'SUCCESS',
      failureReason: failure,
      before,
      after: {
        'Deposit.ResourceAmount': deposit?.resourceAmount,
        'Actor.Inventory.Stone': actor?.inventory.resources.Stone ?? 0,
        'Actor.CurrentAction': actor?.currentAction,
      },
    },
  };
}
