// RULE-ATTACK-001 World 단독 테스트 — Implements INTENT-ATTACK-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { createWorld } from '../index';

const ATTACK_DURATION = 0.6;

// 순회 경로가 없는 정지 NPC — 공격 대상으로만 쓴다 (결정론)
const dummyAt = (x: number, z: number) => [{ id: 'npc-1', position: { x, z }, wanderPath: [] }];

const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'player');
const attackOn = (v: GameViewSnapshot, id: string) =>
  v.interactions.find((i) => i.id === 'attack' && i.targetEntityId === id);

describe('RULE-ATTACK-001', () => {
  it('사거리 안의 대상 → 공격 행동 진입, 대상이 함께 관찰된다', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 }, npcs: dummyAt(1, 0) });

    const result = world.dispatch({ interactionId: 'attack', targetEntityId: 'npc-1' });

    expect(result).toEqual({ status: 'success', rule: 'RULE-ATTACK-001' });
    const p = player(world.projectPlayerView());
    expect(p?.state).toBe('attack');
    expect(p?.targetEntityId).toBe('npc-1');
  });

  it('사거리 밖 대상 → Failure(out-of-range) + 사유 투영', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 }, npcs: dummyAt(10, 0) });

    const result = world.dispatch({ interactionId: 'attack', targetEntityId: 'npc-1' });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-ATTACK-001', reason: 'out-of-range' });
    expect(attackOn(world.projectPlayerView(), 'npc-1')?.reason).toBe('out-of-range');
    expect(player(world.projectPlayerView())?.state).toBe('idle');
  });

  it('없는 대상 / 자기 자신 → Failure(no-target)', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 }, npcs: dummyAt(1, 0) });

    expect(world.dispatch({ interactionId: 'attack', targetEntityId: 'ghost' })).toEqual({
      status: 'failure',
      rule: 'RULE-ATTACK-001',
      reason: 'no-target',
    });
    expect(world.dispatch({ interactionId: 'attack', targetEntityId: 'player' })).toEqual({
      status: 'failure',
      rule: 'RULE-ATTACK-001',
      reason: 'no-target',
    });
  });

  it('공격은 소요 시간을 채우면 끝나고 대기로 돌아간다 (대상은 변하지 않는다)', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 }, npcs: dummyAt(1, 0) });
    world.dispatch({ interactionId: 'attack', targetEntityId: 'npc-1' });

    world.tick(ATTACK_DURATION / 2);
    let view = world.projectPlayerView();
    expect(player(view)?.state).toBe('attack');
    expect(player(view)?.progress).toBeCloseTo(0.5);

    world.tick(ATTACK_DURATION / 2);
    view = world.projectPlayerView();
    expect(player(view)?.state).toBe('idle');
    // C002 EXCLUDED — 공격의 결과(피해·사망)는 정의되지 않는다. 대상은 그대로 존재한다.
    expect(view.entities.find((e) => e.id === 'npc-1')).toBeDefined();
  });

  it('공격 중에는 이동·공격 요청이 거부된다 (attack 은 Replaceable 이 아니다)', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 }, npcs: dummyAt(1, 0) });
    world.dispatch({ interactionId: 'attack', targetEntityId: 'npc-1' });
    world.tick(0.1);

    expect(world.dispatch({ interactionId: 'move', position: { x: 5, z: 5 } })).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'action-busy',
    });
    expect(world.dispatch({ interactionId: 'attack', targetEntityId: 'npc-1' })).toEqual({
      status: 'failure',
      rule: 'RULE-ATTACK-001',
      reason: 'action-busy',
    });
    expect(attackOn(world.projectPlayerView(), 'npc-1')?.reason).toBe('action-busy');
  });

  it('이동 중에는 공격을 시작할 수 있다 (move 는 Replaceable)', () => {
    const world = createWorld({ actorPosition: { x: 0, z: 0 }, npcs: dummyAt(1, 0) });
    world.dispatch({ interactionId: 'move', position: { x: 0, z: 5 } });
    world.tick(0.05);

    expect(world.dispatch({ interactionId: 'attack', targetEntityId: 'npc-1' }).status).toBe(
      'success',
    );
    expect(player(world.projectPlayerView())?.state).toBe('attack');
  });
});
