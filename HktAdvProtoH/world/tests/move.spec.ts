// RULE-MOVE-001 · RULE-MOVE-PROGRESS-001 World 단독 테스트

import { describe, expect, it } from 'vitest';
import { createWorld } from '../index';

describe('RULE-MOVE-001', () => {
  it('Bounds 안 지점 → MoveTarget 설정, moving 상태 관찰', () => {
    const world = createWorld();

    const result = world.dispatch({ type: 'move', target: { x: 8, z: -6 } });

    expect(result).toEqual({ status: 'success', rule: 'RULE-MOVE-001' });
    expect(world.projectPlayerView().entities.player.state).toBe('moving');
  });

  it('Bounds 밖 지점 → Failure(out-of-bounds), idle 유지', () => {
    const world = createWorld();

    const result = world.dispatch({ type: 'move', target: { x: 999, z: 0 } });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MOVE-001', reason: 'out-of-bounds' });
    expect(world.projectPlayerView().entities.player.state).toBe('idle');
  });
});

describe('RULE-MOVE-PROGRESS-001', () => {
  it('tick 진행에 따라 목표에 도달하고 MoveTarget 이 해제된다', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 } });
    world.dispatch({ type: 'move', target: { x: 6, z: 0 } }); // MoveSpeed 6/s → 1초 거리

    world.tick(0.5);
    let view = world.projectPlayerView();
    expect(view.entities.player.position.x).toBeCloseTo(3);
    expect(view.entities.player.state).toBe('moving');

    world.tick(0.6); // 초과 진행해도 목표를 지나치지 않는다
    view = world.projectPlayerView();
    expect(view.entities.player.position.x).toBeCloseTo(6);
    expect(view.entities.player.state).toBe('idle');
  });

  it('이동으로 광맥에 접근하면 Mine 이 가용해진다 (out-of-range → available)', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 } });
    expect(world.projectPlayerView().interactions.mine.unavailableReason).toBe('out-of-range');

    world.dispatch({ type: 'move', target: { x: 8, z: -6 } });
    for (let i = 0; i < 60; i++) world.tick(1 / 30); // 2초 진행 — 거리 10 도달 충분

    expect(world.projectPlayerView().interactions.mine.available).toBe(true);
  });
});
