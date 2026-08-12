// Observer Projection 테스트 — OBS-MINING-V1 의 모든 항목 제공 여부 (Rule 5·6).
import { describe, expect, it } from 'vitest';
import { AuthoritativeWorld, type WorldConfig } from '../world/authority';
import { projectDesigner, projectPlayer } from '../world/projection';

function config(): WorldConfig {
  return {
    actors: [
      {
        id: 'player-1',
        position: { x: 0, z: 0 },
        inventory: { resources: {}, tools: [{ kind: 'Pickaxe', capability: 'Mining' }] },
        knowledge: ['deposit-1'],
        currentAction: 'Idle',
        actionTicksRemaining: 0,
      },
    ],
    deposits: [
      { id: 'deposit-1', position: { x: 1, z: 0 }, resourceType: 'Stone', resourceAmount: 2 },
    ],
  };
}

describe('Player Projection (OBS-MINING-V1 / player)', () => {
  it('state 항목: Position / Inventory.Stone / CurrentAction / VisibleDeposit / Deposit.Position / Deposit.ResourceAmount', () => {
    const world = new AuthoritativeWorld(config());
    const obs = projectPlayer(world, 'player-1');
    expect(obs.actor.position).toEqual({ x: 0, z: 0 });
    expect(obs.actor.inventoryStone).toBe(0);
    expect(obs.actor.currentAction).toBe('Idle');
    expect(obs.visibleDeposits).toHaveLength(1);
    expect(obs.visibleDeposits[0]).toMatchObject({
      id: 'deposit-1',
      position: { x: 1, z: 0 },
      resourceAmount: 2,
    });
  });

  it('Knowledge 에 없는 Deposit 은 VisibleDeposit 에 나타나지 않는다 (Projection 경계)', () => {
    const c = config();
    c.deposits.push({
      id: 'secret',
      position: { x: 3, z: 3 },
      resourceType: 'Stone',
      resourceAmount: 9,
    });
    const world = new AuthoritativeWorld(c);
    const obs = projectPlayer(world, 'player-1');
    expect(obs.visibleDeposits.map((d) => d.id)).toEqual(['deposit-1']);
  });

  it('MineStone.Availability — 범위 내 AVAILABLE, 실행과 동일한 판단', () => {
    const world = new AuthoritativeWorld(config());
    const obs = projectPlayer(world, 'player-1');
    expect(obs.mineAvailability).toEqual({ status: 'AVAILABLE', target: 'deposit-1' });
  });

  it('MineStone.Availability — 사유 포함 UNAVAILABLE (DEPOSIT_EMPTY)', () => {
    const world = new AuthoritativeWorld(config());
    world.applyCommand({ id: 'CMD-MINE-V1', actorId: 'player-1', depositId: 'deposit-1' });
    world.applyCommand({ id: 'CMD-MINE-V1', actorId: 'player-1', depositId: 'deposit-1' });
    const obs = projectPlayer(world, 'player-1');
    expect(obs.mineAvailability.status).toBe('UNAVAILABLE');
    expect(obs.mineAvailability.reason).toBe('DEPOSIT_EMPTY');
  });

  it('ActionResult / ResourceTransition — 마지막 행동과 자원 변화 관측', () => {
    const world = new AuthoritativeWorld(config());
    world.applyCommand({ id: 'CMD-MINE-V1', actorId: 'player-1', depositId: 'deposit-1' });
    const obs = projectPlayer(world, 'player-1');
    expect(obs.actionResult).toEqual({
      command: 'CMD-MINE-V1',
      result: 'SUCCESS',
      failureReason: undefined,
    });
    expect(obs.resourceTransition).toEqual({
      depositId: 'deposit-1',
      depositBefore: 2,
      depositAfter: 1,
      stoneBefore: 0,
      stoneAfter: 1,
    });
  });
});

describe('Designer Projection (OBS-MINING-V1 / designer — §23 8항목)', () => {
  it('Goal / Possibility / Availability / Preconditions / Rule / Before / Input / After / FailureReason', () => {
    const world = new AuthoritativeWorld(config());
    world.applyCommand({ id: 'CMD-MINE-V1', actorId: 'player-1', depositId: 'deposit-1' });
    const designer = projectDesigner(world);
    expect(designer.transitions).toHaveLength(1);
    const t = designer.transitions[0]!;
    expect(t.currentGoal).toBe('AcquireStone');
    expect(t.currentPossibility).toBe('MineStone');
    expect(t.possibilityAvailability).toBe('AVAILABLE');
    expect(t.preconditions.every((p) => p.pass)).toBe(true);
    expect(t.selectedRule).toBe('RULE-MINE-001');
    expect(t.beforeState['Deposit.ResourceAmount']).toBe(2);
    expect(t.input).toEqual({ actorId: 'player-1', depositId: 'deposit-1' });
    expect(t.afterState['Deposit.ResourceAmount']).toBe(1);
    expect(t.failureReason).toBeNull();
  });

  it('실패 Transition 도 FailureReason 과 함께 관측된다', () => {
    const world = new AuthoritativeWorld(config());
    world.applyCommand({ id: 'CMD-MINE-V1', actorId: 'player-1', depositId: 'ghost' });
    const t = projectDesigner(world).transitions[0]!;
    expect(t.possibilityAvailability).toBe('UNAVAILABLE');
    expect(t.failureReason).toBe('UNKNOWN_DEPOSIT');
    expect(t.preconditions.some((p) => !p.pass)).toBe(true);
  });
});
