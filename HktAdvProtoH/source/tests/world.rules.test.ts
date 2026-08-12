// World Rule 단위 테스트 — preconditions 별 성공/실패 + Authority 경계 (Rule 3·4).
import { describe, expect, it } from 'vitest';
import { AuthoritativeWorld, type WorldConfig } from '../world/authority';
import { WorldConstants } from './helpers';

function baseConfig(overrides?: {
  actorPos?: { x: number; z: number };
  depositAmount?: number;
  withTool?: boolean;
  withKnowledge?: boolean;
}): WorldConfig {
  return {
    actors: [
      {
        id: 'player-1',
        position: overrides?.actorPos ?? { x: 0, z: 0 },
        inventory: {
          resources: {},
          tools: overrides?.withTool === false ? [] : [{ kind: 'Pickaxe', capability: 'Mining' }],
        },
        knowledge: overrides?.withKnowledge === false ? [] : ['deposit-1'],
        currentAction: 'Idle',
        actionTicksRemaining: 0,
      },
    ],
    deposits: [
      {
        id: 'deposit-1',
        position: { x: 1, z: 0 },
        resourceType: 'Stone',
        resourceAmount: overrides?.depositAmount ?? 5,
      },
    ],
  };
}

describe('RULE-MOVE-001', () => {
  it('이동 의도(방향)에 따라 MoveSpeed 한계로 위치를 전진시킨다', () => {
    const world = new AuthoritativeWorld(baseConfig());
    const rec = world.applyCommand({
      id: 'CMD-MOVE-V1',
      actorId: 'player-1',
      direction: { dx: 1, dz: 0 },
    });
    expect(rec?.result).toBe('SUCCESS');
    const pos = world.snapshot().actors['player-1']!.position;
    expect(pos.x).toBeCloseTo(WorldConstants.MOVE_SPEED, 10);
    expect(pos.z).toBeCloseTo(0, 10);
  });

  it('방향 크기와 무관하게 이동량은 세계가 결정한다 (거대 방향 입력 ≠ 순간이동)', () => {
    const world = new AuthoritativeWorld(baseConfig());
    world.applyCommand({
      id: 'CMD-MOVE-V1',
      actorId: 'player-1',
      direction: { dx: 1000, dz: 0 },
    });
    expect(world.snapshot().actors['player-1']!.position.x).toBeCloseTo(
      WorldConstants.MOVE_SPEED,
      10,
    );
  });

  it('UNKNOWN_ACTOR 실패', () => {
    const world = new AuthoritativeWorld(baseConfig());
    const rec = world.applyCommand({
      id: 'CMD-MOVE-V1',
      actorId: 'nobody',
      direction: { dx: 1, dz: 0 },
    });
    expect(rec?.result).toBe('FAILURE');
    expect(rec?.failureReason).toBe('UNKNOWN_ACTOR');
  });

  it('INVALID_DIRECTION 실패 (영벡터/NaN)', () => {
    const world = new AuthoritativeWorld(baseConfig());
    expect(
      world.applyCommand({ id: 'CMD-MOVE-V1', actorId: 'player-1', direction: { dx: 0, dz: 0 } })
        ?.failureReason,
    ).toBe('INVALID_DIRECTION');
    expect(
      world.applyCommand({
        id: 'CMD-MOVE-V1',
        actorId: 'player-1',
        direction: { dx: Number.NaN, dz: 0 },
      })?.failureReason,
    ).toBe('INVALID_DIRECTION');
  });
});

describe('RULE-MINE-001', () => {
  it('전제조건 충족 시 Deposit -1 / Inventory +1 / CurrentAction=Mine', () => {
    const world = new AuthoritativeWorld(baseConfig());
    const rec = world.applyCommand({
      id: 'CMD-MINE-V1',
      actorId: 'player-1',
      depositId: 'deposit-1',
    });
    expect(rec?.result).toBe('SUCCESS');
    const state = world.snapshot();
    expect(state.deposits['deposit-1']!.resourceAmount).toBe(4);
    expect(state.actors['player-1']!.inventory.resources.Stone).toBe(1);
    expect(state.actors['player-1']!.currentAction).toBe('Mine');
  });

  it('Before → Input → Rule → After 가 Transition 으로 기록된다', () => {
    const world = new AuthoritativeWorld(baseConfig());
    const rec = world.applyCommand({
      id: 'CMD-MINE-V1',
      actorId: 'player-1',
      depositId: 'deposit-1',
    })!;
    expect(rec.rule).toBe('RULE-MINE-001');
    expect(rec.before['Deposit.ResourceAmount']).toBe(5);
    expect(rec.after['Deposit.ResourceAmount']).toBe(4);
    expect(rec.before['Actor.Inventory.Stone']).toBe(0);
    expect(rec.after['Actor.Inventory.Stone']).toBe(1);
  });

  it('UNKNOWN_DEPOSIT — 모르는 Deposit (Knowledge 없음)', () => {
    const world = new AuthoritativeWorld(baseConfig({ withKnowledge: false }));
    const rec = world.applyCommand({
      id: 'CMD-MINE-V1',
      actorId: 'player-1',
      depositId: 'deposit-1',
    });
    expect(rec?.failureReason).toBe('UNKNOWN_DEPOSIT');
  });

  it('NO_MINING_TOOL — Mining Capability 도구 미보유', () => {
    const world = new AuthoritativeWorld(baseConfig({ withTool: false }));
    const rec = world.applyCommand({
      id: 'CMD-MINE-V1',
      actorId: 'player-1',
      depositId: 'deposit-1',
    });
    expect(rec?.failureReason).toBe('NO_MINING_TOOL');
  });

  it('OUT_OF_RANGE — InteractionRange 밖', () => {
    const world = new AuthoritativeWorld(baseConfig({ actorPos: { x: 50, z: 50 } }));
    const rec = world.applyCommand({
      id: 'CMD-MINE-V1',
      actorId: 'player-1',
      depositId: 'deposit-1',
    });
    expect(rec?.failureReason).toBe('OUT_OF_RANGE');
  });

  it('DEPOSIT_EMPTY — 고갈된 광맥', () => {
    const world = new AuthoritativeWorld(baseConfig({ depositAmount: 0 }));
    const rec = world.applyCommand({
      id: 'CMD-MINE-V1',
      actorId: 'player-1',
      depositId: 'deposit-1',
    });
    expect(rec?.failureReason).toBe('DEPOSIT_EMPTY');
    expect(world.snapshot().actors['player-1']!.inventory.resources.Stone ?? 0).toBe(0);
  });

  it('실패한 Rule 은 어떤 상태도 바꾸지 않는다', () => {
    const world = new AuthoritativeWorld(baseConfig({ actorPos: { x: 50, z: 50 } }));
    const before = world.snapshot();
    world.applyCommand({ id: 'CMD-MINE-V1', actorId: 'player-1', depositId: 'deposit-1' });
    const after = world.snapshot();
    expect(after.deposits['deposit-1']!.resourceAmount).toBe(
      before.deposits['deposit-1']!.resourceAmount,
    );
    expect(after.actors['player-1']!.inventory.resources.Stone ?? 0).toBe(0);
  });
});

describe('Authority 경계 (Rule 3·4)', () => {
  it('prohibited field 가 실린 Command 는 Rule 까지 가지 않고 거부된다', () => {
    const world = new AuthoritativeWorld(baseConfig());
    const cheat = {
      id: 'CMD-MINE-V1',
      actorId: 'player-1',
      depositId: 'deposit-1',
      inventory_delta: 999,
    } as never;
    const rec = world.applyCommand(cheat);
    expect(rec).toBeNull();
    expect(world.snapshot().actors['player-1']!.inventory.resources.Stone ?? 0).toBe(0);
  });

  it('snapshot 은 deep-frozen — Observer 가 World 를 변경할 수 없다', () => {
    const world = new AuthoritativeWorld(baseConfig());
    const snap = world.snapshot();
    expect(() => {
      (snap.actors['player-1']!.inventory.resources as Record<string, number>).Stone = 999;
    }).toThrow();
    expect(world.snapshot().actors['player-1']!.inventory.resources.Stone ?? 0).toBe(0);
  });

  it('Mine 지속시간이 tick 으로 만료되면 Idle 로 복귀한다', () => {
    const world = new AuthoritativeWorld(baseConfig());
    world.applyCommand({ id: 'CMD-MINE-V1', actorId: 'player-1', depositId: 'deposit-1' });
    for (let i = 0; i < WorldConstants.MINE_DURATION_TICKS; i++) world.tick();
    expect(world.snapshot().actors['player-1']!.currentAction).toBe('Idle');
  });
});
