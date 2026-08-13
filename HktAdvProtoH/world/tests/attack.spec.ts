// RULE-ATTACK-001 · RULE-ATTACK-COMPLETE-001 · RULE-HIT-001 World 단독 테스트
// Implements INTENT-ATTACK-001 · INTENT-ATTACK-HIT-001 · INTENT-HIT-REACTION-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { driveWorld } from './drive';

const ATTACK_DURATION = 0.6;
const HIT_DURATION = 0.35;

// 순회 경로도 인지도 없는 정지 NPC — 타격 대상으로만 쓴다 (결정론)
const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
});

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const attack = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'attack');

describe('RULE-ATTACK-001 — 대상 없이 휘두른다', () => {
  it('곁에 아무도 없어도 공격이 시작된다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] });

    const result = world.dispatch({ interactionId: 'attack' });

    expect(result).toEqual({ status: 'success', rule: 'RULE-ATTACK-001' });
    expect(actor(world.observe(), 'player')?.state).toBe('attack');
  });

  it('멀리 있는 캐릭터가 있어도 마찬가지로 시작된다 (사거리는 시작 조건이 아니다)', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(18, 18)] });

    expect(world.dispatch({ interactionId: 'attack' }).status).toBe('success');
    expect(actor(world.observe(), 'player')?.state).toBe('attack');
  });

  it('공격 행동에는 대상이 실리지 않는다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(1, 0)] });
    world.dispatch({ interactionId: 'attack' });

    expect(actor(world.observe(), 'player')?.targetEntityId).toBeUndefined();
  });

  it('공격의 유일한 실패 사유는 action-busy 다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] });
    world.dispatch({ interactionId: 'attack' });
    world.tick(0.1);

    expect(world.dispatch({ interactionId: 'attack' })).toEqual({
      status: 'failure',
      rule: 'RULE-ATTACK-001',
      reason: 'action-busy',
    });
    expect(attack(world.observe())?.available).toBe(false);
    expect(attack(world.observe())?.reason).toBe('action-busy');
  });

  it('이동 중에는 휘두를 수 있다 (move 는 Replaceable)', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] });
    world.dispatch({ interactionId: 'move', position: { x: 0, z: 5 } });
    world.tick(0.05);

    expect(world.dispatch({ interactionId: 'attack' }).status).toBe('success');
    expect(actor(world.observe(), 'player')?.state).toBe('attack');
  });
});

describe('RULE-ATTACK-COMPLETE-001 — 끝나는 순간의 범위가 정한다', () => {
  it('범위 안의 캐릭터가 맞는다 (휘두름이 끝난 시점)', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(1, 0)] });
    world.dispatch({ interactionId: 'attack' });

    world.tick(ATTACK_DURATION / 2);
    expect(actor(world.observe(), 'npc-1')?.state).toBe('idle'); // 아직 안 맞았다

    world.tick(ATTACK_DURATION / 2);
    const view = world.observe();
    expect(actor(view, 'npc-1')?.state).toBe('hit');
    expect(actor(view, 'player')?.state).toBe('idle'); // 공격자는 대기로 돌아간다
  });

  it('범위 밖의 캐릭터는 맞지 않는다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(10, 0)] });
    world.dispatch({ interactionId: 'attack' });
    world.tick(ATTACK_DURATION);

    expect(actor(world.observe(), 'npc-1')?.state).toBe('idle');
  });

  it('아무도 없으면 아무도 맞지 않고 휘두름은 그대로 끝난다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] });
    world.dispatch({ interactionId: 'attack' });
    world.tick(ATTACK_DURATION);

    expect(actor(world.observe(), 'player')?.state).toBe('idle');
  });

  it('범위 안에 여럿이면 여럿이 맞는다 (대상을 고르지 않으므로)', () => {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [dummyAt(1, 0, 'npc-1'), dummyAt(-1, 0, 'npc-2'), dummyAt(9, 0, 'npc-3')],
    });
    world.dispatch({ interactionId: 'attack' });
    world.tick(ATTACK_DURATION);

    const view = world.observe();
    expect(actor(view, 'npc-1')?.state).toBe('hit');
    expect(actor(view, 'npc-2')?.state).toBe('hit');
    expect(actor(view, 'npc-3')?.state).toBe('idle'); // 범위 밖
  });

  it('휘두르는 동안 물러선 캐릭터는 맞지 않는다', () => {
    // npc 가 플레이어를 인지해 다가오지 않도록 인지 0, 대신 스스로 멀어지는 순회를 준다
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [
        {
          id: 'npc-1',
          position: { x: 1, z: 0 },
          perceptionRange: 0,
          wanderPath: [{ x: 15, z: 0 }],
        },
      ],
    });

    world.dispatch({ interactionId: 'attack' });
    world.tick(ATTACK_DURATION); // 그동안 npc 는 순회로 멀어진다 (2.5/s × 0.6 = 1.5)

    // 시작 시점 거리 1(범위 안) → 끝나는 시점 거리 2.5(범위 2 밖)
    expect(actor(world.observe(), 'npc-1')?.state).not.toBe('hit');
  });
});

describe('RULE-HIT-001 — 맞으면 하던 일이 끊긴다', () => {
  it('피격은 잠시 지속되고 대기로 돌아간다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(1, 0)] });
    world.dispatch({ interactionId: 'attack' });
    world.tick(ATTACK_DURATION);
    expect(actor(world.observe(), 'npc-1')?.state).toBe('hit');

    world.tick(HIT_DURATION / 2);
    const during = actor(world.observe(), 'npc-1');
    expect(during?.state).toBe('hit');
    expect(during?.progress).toBeCloseTo(0.5); // 피격에도 진행도가 있다

    world.tick(HIT_DURATION / 2);
    expect(actor(world.observe(), 'npc-1')?.state).toBe('idle');
  });

  it('대체 불가능한 행동 중이어도 피격은 그 행동을 끊는다', () => {
    // 플레이어가 채굴하는 동안 NPC 가 다가와 휘두른다
    const world = driveWorld({
      actorPosition: { x: 8, z: -5 },
      npcs: [{ id: 'npc-1', position: { x: 8, z: -4 }, wanderPath: [] }],
    });

    expect(world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' }).status).toBe(
      'success',
    );

    // NPC 는 사거리 안이므로 곧장 휘두르고, 0.6초 뒤 타격한다
    for (let i = 0; i < 20; i++) world.tick(1 / 30); // 0.67초
    const view = world.observe();
    expect(actor(view, 'npc-1')?.state).toBe('attack'); // 다음 휘두름을 이미 시작했을 수 있다
    expect(actor(view, 'player')?.state).toBe('hit'); // 채굴이 끊겼다
  });

  it('피격 중에는 요청이 거부된다 (hit 은 Replaceable 이 아니다)', () => {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [{ id: 'npc-1', position: { x: 1, z: 0 }, wanderPath: [] }],
    });

    for (let i = 0; i < 20; i++) world.tick(1 / 30); // NPC 가 휘둘러 플레이어를 때린다
    expect(actor(world.observe(), 'player')?.state).toBe('hit');

    expect(world.dispatch({ interactionId: 'move', position: { x: 5, z: 5 } })).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'action-busy',
    });
  });
});
