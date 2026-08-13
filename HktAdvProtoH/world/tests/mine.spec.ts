// RULE-MINE-001 World 단독 테스트 — Before → Input → Rule → After

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { createWorld } from '../index';

const stoneCount = (v: GameViewSnapshot) =>
  v.hud.find((h) => h.id === 'inventory.stone')?.value;
const deposit = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'deposit-1');
const mine = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'mine');

describe('RULE-MINE-001', () => {
  it('곡괭이 보유 + 인접 + 자원 있음 → Stone 1 획득, Deposit 1 감소', () => {
    const world = createWorld({
      actorPosition: { x: 8, z: -5 }, // deposit(8,-6) 과 거리 1 <= InteractionRange 2
      depositAmount: 5,
    });

    const result = world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });

    expect(result).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    const view = world.projectPlayerView();
    expect(stoneCount(view)).toBe(1);
    expect(deposit(view)?.labelValue).toBe(4);
  });

  it('곡괭이 없음 → Failure(no-mining-tool), 상태 불변 + 사유 코드 투영', () => {
    const world = createWorld({ actorPosition: { x: 8, z: -5 }, actorItems: {} });

    const result = world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'no-mining-tool' });
    const view = world.projectPlayerView();
    expect(stoneCount(view)).toBe(0);
    expect(deposit(view)?.labelValue).toBe(5);
    expect(mine(view)?.reason).toBe('no-mining-tool');
  });

  it('거리 밖 → Failure(out-of-range)', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 } }); // deposit 까지 10

    const result = world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'out-of-range' });
  });

  it('자원 고갈 → Failure(deposit-depleted), depleted 상태 관찰', () => {
    const world = createWorld({ actorPosition: { x: 8, z: -5 }, depositAmount: 0 });

    const result = world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });

    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: 'deposit-depleted',
    });
    expect(deposit(world.projectPlayerView())?.state).toBe('depleted');
  });

  it('마지막 1개를 캐면 available → depleted 로 전이', () => {
    const world = createWorld({ actorPosition: { x: 8, z: -5 }, depositAmount: 1 });

    expect(deposit(world.projectPlayerView())?.state).toBe('available');
    world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });

    const view = world.projectPlayerView();
    expect(deposit(view)?.state).toBe('depleted');
    expect(stoneCount(view)).toBe(1);
    expect(mine(view)?.available).toBe(false);
    expect(mine(view)?.reason).toBe('deposit-depleted');
  });
});
