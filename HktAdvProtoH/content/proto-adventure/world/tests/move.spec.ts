// RULE-MOVE-001 · RULE-MOVE-PROGRESS-001 World 단독 테스트
// C002 CHANGED — 이동은 CurrentAction 의 한 종류다 (state: 'move')

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { driveWorld, PLAYER } from './drive';

const solo = { npcs: [] };
const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === PLAYER);
const mine = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'mine');

describe('RULE-MOVE-001', () => {
  it('Bounds 안 지점 → 이동 행동 진입, move 상태 관찰', () => {
    const world = driveWorld(solo);

    const result = world.dispatch({ interactionId: 'move', position: { x: 8, z: -6 } });

    expect(result).toEqual({ status: 'success', rule: 'RULE-MOVE-001' });
    expect(player(world.observe())?.state).toBe('move');
  });

  it('Bounds 밖 지점 → Failure(out-of-bounds), idle 유지', () => {
    const world = driveWorld(solo);

    const result = world.dispatch({ interactionId: 'move', position: { x: 999, z: 0 } });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MOVE-001', reason: 'out-of-bounds' });
    expect(player(world.observe())?.state).toBe('idle');
  });
});

describe('RULE-MOVE-PROGRESS-001', () => {
  it('tick 진행에 따라 목표에 도달하고 대기 행동으로 돌아간다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    world.dispatch({ interactionId: 'move', position: { x: 6, z: 0 } }); // MoveSpeed 6/s → 1초 거리

    world.tick(0.5);
    let p = player(world.observe());
    expect(p?.position.x).toBeCloseTo(3);
    expect(p?.state).toBe('move');

    world.tick(0.6); // 초과 진행해도 목표를 지나치지 않는다
    p = player(world.observe());
    expect(p?.position.x).toBeCloseTo(6);
    expect(p?.state).toBe('idle');
  });

  it('이동으로 광맥에 접근하면 Mine 이 가용해진다 (out-of-range → available)', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    // C017 — 채집은 고른 것에 대해 판정된다. 고르고 나서 거리 사유를 본다
    world.dispatch({ interactionId: 'select-target', targetEntityId: 'deposit-1' });
    expect(mine(world.observe())?.reason).toBe('out-of-range');

    world.dispatch({ interactionId: 'move', position: { x: 8, z: -6 } });
    for (let i = 0; i < 60; i++) world.tick(1 / 30); // 2초 진행 — 거리 10 도달 충분

    expect(mine(world.observe())?.available).toBe(true);
  });

  it('이동 중 다른 이동 요청은 목적지를 대체한다 (move 는 Replaceable)', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });
    world.dispatch({ interactionId: 'move', position: { x: 12, z: 0 } });
    world.tick(0.5);

    const result = world.dispatch({ interactionId: 'move', position: { x: 0, z: 0 } });
    expect(result.status).toBe('success');

    for (let i = 0; i < 30; i++) world.tick(1 / 30);
    const p = player(world.observe());
    expect(p?.position.x).toBeCloseTo(0);
    expect(p?.state).toBe('idle');
  });
});
