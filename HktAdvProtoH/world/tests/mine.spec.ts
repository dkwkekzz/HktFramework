// RULE-MINE-001 World 단독 테스트 — Before → Input → Rule → After

import { describe, expect, it } from 'vitest';
import { createWorld } from '../index';

describe('RULE-MINE-001', () => {
  it('곡괭이 보유 + 인접 + 자원 있음 → Stone 1 획득, Deposit 1 감소', () => {
    const world = createWorld({
      actorPosition: { x: 8, z: -5 }, // deposit(8,-6) 과 거리 1 <= InteractionRange 2
      depositAmount: 5,
    });

    const result = world.dispatch({ type: 'mine', depositId: 'deposit-1' });

    expect(result).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    const view = world.projectPlayerView();
    expect(view.hud.inventory.stone).toBe(1);
    expect(view.entities.deposit.remaining).toBe(4);
  });

  it('곡괭이 없음 → Failure(no-mining-tool), 상태 불변', () => {
    const world = createWorld({ actorPosition: { x: 8, z: -5 }, actorItems: {} });

    const result = world.dispatch({ type: 'mine', depositId: 'deposit-1' });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'no-mining-tool' });
    const view = world.projectPlayerView();
    expect(view.hud.inventory.stone).toBe(0);
    expect(view.entities.deposit.remaining).toBe(5);
    expect(view.hud.mineHint.reason).toBe('no-mining-tool');
  });

  it('거리 밖 → Failure(out-of-range)', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 } }); // deposit 까지 10

    const result = world.dispatch({ type: 'mine', depositId: 'deposit-1' });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'out-of-range' });
  });

  it('자원 고갈 → Failure(deposit-depleted), depleted 관찰', () => {
    const world = createWorld({ actorPosition: { x: 8, z: -5 }, depositAmount: 0 });

    const result = world.dispatch({ type: 'mine', depositId: 'deposit-1' });

    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: 'deposit-depleted',
    });
    expect(world.projectPlayerView().entities.deposit.state).toBe('depleted');
  });

  it('마지막 1개를 캐면 available → depleted 로 전이', () => {
    const world = createWorld({ actorPosition: { x: 8, z: -5 }, depositAmount: 1 });

    expect(world.projectPlayerView().entities.deposit.state).toBe('available');
    world.dispatch({ type: 'mine', depositId: 'deposit-1' });

    const view = world.projectPlayerView();
    expect(view.entities.deposit.state).toBe('depleted');
    expect(view.hud.inventory.stone).toBe(1);
    expect(view.interactions.mine.available).toBe(false);
    expect(view.interactions.mine.unavailableReason).toBe('deposit-depleted');
  });
});
