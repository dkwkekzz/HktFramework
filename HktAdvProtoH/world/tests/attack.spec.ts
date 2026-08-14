// RULE-ATTACK-001 · RULE-SWING-STRIKE-001 · RULE-HIT-001 World 단독 테스트
// Implements INTENT-ATTACK-001 · INTENT-ATTACK-HIT-001(C006 CHANGED) ·
//            INTENT-HIT-REACTION-001 · INTENT-BODY-FACING-001(R1)
//
// C006 CHANGED — 타격은 완료 순간이 아니라 휘두름 구간 [SWING_BEGIN, SWING_END] 의
// 접촉이 정한다. R1 — 접촉 기준은 몸이 향한 방향(Facing)의 칼끝 충돌 구다:
// 칼끝은 Facing 기준 ±SWING_ARC/2 호를 쓸고 지나가며, 등 뒤는 맞지 않는다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { SWING_BEGIN } from '../semantic/collision';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

const ATTACK_DURATION = 0.6;
const HIT_DURATION = 0.35;
// 휘두름 구간이 열리고 조금 지난 시각 — 정면 대상은 이 시각까지 접촉이 판정돼 있다
const AFTER_SWING_OPEN = SWING_BEGIN * ATTACK_DURATION + 2 * TICK_INTERVAL;

// 물리 구간 판정은 세계의 Tick 주기로 표본화된다 — 검증도 실제 주기로 진행한다
const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

// R1 — 휘두름은 몸이 향한 방향으로 나간다. +x 쪽으로 한 걸음 걸어 그쪽을 보게 한다.
// (한 걸음 = MoveSpeed × TICK ≈ 0.2 — 이후 위치는 x ≈ 0.2 다)
const aimRight = (world: WorldDriver) => {
  world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
  world.tick(TICK_INTERVAL);
};

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
    expect(actor(world.observe(), PLAYER)?.state).toBe('attack');
  });

  it('멀리 있는 캐릭터가 있어도 마찬가지로 시작된다 (사거리는 시작 조건이 아니다)', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(18, 18)] });

    expect(world.dispatch({ interactionId: 'attack' }).status).toBe('success');
    expect(actor(world.observe(), PLAYER)?.state).toBe('attack');
  });

  it('공격 행동에는 대상이 실리지 않는다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(1, 0)] });
    world.dispatch({ interactionId: 'attack' });

    expect(actor(world.observe(), PLAYER)?.targetEntityId).toBeUndefined();
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
    expect(actor(world.observe(), PLAYER)?.state).toBe('attack');
  });
});

describe('RULE-SWING-STRIKE-001 — 휘두름 구간의 칼끝 접촉이 정한다', () => {
  it('구간이 열리기 전에는 맞지 않고, 열리면 완료 전에 맞는다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(1, 0)] });
    aimRight(world);
    world.dispatch({ interactionId: 'attack' });

    tickFor(world, 0.1); // 아직 SWING_BEGIN(0.15초) 이전
    expect(actor(world.observe(), 'npc-1')?.state).toBe('idle');

    tickFor(world, AFTER_SWING_OPEN - 0.1);
    const view = world.observe();
    expect(actor(view, 'npc-1')?.state).toBe('hit');
    expect(actor(view, PLAYER)?.state).toBe('attack'); // 완료 전이다 — 휘두름은 계속된다
  });

  it('등 뒤의 캐릭터는 맞지 않는다 (R1 — 휘두름은 향한 방향으로만 나간다)', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(-1, 0)] });
    aimRight(world); // +x 를 본다 — npc 는 등 뒤(-x)에 있다
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, ATTACK_DURATION + TICK_INTERVAL);

    expect(actor(world.observe(), 'npc-1')?.state).toBe('idle');
  });

  it('칼끝 도달 밖의 캐릭터는 맞지 않는다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(10, 0)] });
    aimRight(world);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, ATTACK_DURATION);

    expect(actor(world.observe(), 'npc-1')?.state).toBe('idle');
  });

  it('아무도 없으면 아무도 맞지 않고 휘두름은 그대로 끝난다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] });
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, ATTACK_DURATION);

    expect(actor(world.observe(), PLAYER)?.state).toBe('idle');
  });

  it('앞의 호 안에 여럿이면 여럿이 맞고, 등 뒤는 맞지 않는다 (대상을 고르지 않으므로)', () => {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [dummyAt(1, 0, 'npc-1'), dummyAt(1.2, 0.6, 'npc-2'), dummyAt(-1, 0, 'npc-3')],
    });
    aimRight(world);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN); // 정면의 둘은 구간이 열리며 접촉한다

    const view = world.observe();
    expect(actor(view, 'npc-1')?.state).toBe('hit');
    expect(actor(view, 'npc-2')?.state).toBe('hit');

    tickFor(world, ATTACK_DURATION); // 호가 전부 쓸고 지나가도 —
    expect(actor(world.observe(), 'npc-3')?.state).toBe('idle'); // 등 뒤는 끝내 맞지 않는다 (R1)
  });

  it('물러서는 중이어도 구간에 접촉했으면 맞는다 (완료 순간 판정이 아니다 — C006 CHANGED)', () => {
    // npc 가 플레이어를 인지해 다가오지 않도록 인지 0, 대신 스스로 멀어지는 순회를 준다.
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

    aimRight(world);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN);

    expect(actor(world.observe(), 'npc-1')?.state).toBe('hit');
  });

  it('구간이 닫힌 뒤에 들어온 캐릭터는 맞지 않는다', () => {
    // npc 가 4 에서 2.5/s 로 다가온다 — SWING_END(0.45초) 시점에도 칼끝 도달 밖이고,
    // 그 뒤로는 구간이 닫혔으므로 맞지 않는다 (옛 완료 순간 판정이라면 경계 접촉).
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [
        {
          id: 'npc-1',
          position: { x: 4, z: 0 },
          perceptionRange: 0,
          wanderPath: [{ x: 0.5, z: 0 }],
        },
      ],
    });

    aimRight(world);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, ATTACK_DURATION + TICK_INTERVAL);

    expect(actor(world.observe(), 'npc-1')?.state).not.toBe('hit');
  });

  it('같은 몸은 휘두름당 한 번만 맞는다 (StruckActorIds)', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(1, 0)] });
    aimRight(world);
    world.dispatch({ interactionId: 'attack' });

    // 구간이 열려 있는 동안 접촉이 이어져도 struck 목록은 한 번만 쌓인다
    tickFor(world, AFTER_SWING_OPEN);
    expect(actor(world.observe(), PLAYER)?.swing?.struck).toEqual(['npc-1']);

    tickFor(world, 0.15); // 구간이 닫힐 때까지 계속 접촉
    expect(actor(world.observe(), PLAYER)?.swing?.struck).toEqual(['npc-1']);
  });

  it('맞은 몸은 휘두른 몸에서 밀쳐지고, 마찰로 곧 멈춘다 (INTENT-SWING-IMPACT · MOMENTUM)', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(1, 0)] });
    aimRight(world);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, 1.2);

    const npc = actor(world.observe(), 'npc-1');
    expect(npc?.position.x).toBeGreaterThan(2); // 몸 중심에서 멀어지는 +x 로 밀쳐졌다
    expect(npc?.position.z).toBeCloseTo(0, 1);
    expect(npc?.body?.velocity).toEqual({ x: 0, z: 0 }); // 마찰로 잦아들어 멈췄다
  });

  it('칼끝 충돌체는 관찰된다 — 호를 그리며 이동하고 구간에서만 활성이다 (R1)', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] });
    expect(actor(world.observe(), PLAYER)?.swing).toBeUndefined(); // idle — 충돌체 없음

    aimRight(world);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, 0.1); // 구간 이전 — 예비 자세 (경계 각에 고정)
    const me = actor(world.observe(), PLAYER)!;
    const before = me.swing;
    expect(before).toMatchObject({ radius: 0.7, active: false, struck: [] });
    // 칼끝은 몸 중심이 아니라 SwingReach(1.3) 만큼 떨어진 자리다
    const reach = Math.hypot(before!.center.x - me.position.x, before!.center.z - me.position.z);
    expect(reach).toBeCloseTo(1.3, 5);

    tickFor(world, AFTER_SWING_OPEN - 0.1); // 구간 안 — 칼끝이 쓸고 지나간다
    const during = actor(world.observe(), PLAYER)!.swing;
    expect(during?.active).toBe(true);
    expect(during!.center.x).not.toBeCloseTo(before!.center.x, 3); // 호를 따라 이동했다

    tickFor(world, ATTACK_DURATION); // 행동이 끝나면 함께 사라진다
    expect(actor(world.observe(), PLAYER)?.swing).toBeUndefined();
  });
});

describe('RULE-HIT-001 — 맞으면 하던 일이 끊긴다', () => {
  it('피격은 잠시 지속되고 대기로 돌아간다', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [dummyAt(1, 0)] });
    aimRight(world);
    world.dispatch({ interactionId: 'attack' });
    tickFor(world, AFTER_SWING_OPEN); // 구간이 열리며 타격된다
    expect(actor(world.observe(), 'npc-1')?.state).toBe('hit');

    tickFor(world, HIT_DURATION / 2);
    const during = actor(world.observe(), 'npc-1');
    expect(during?.state).toBe('hit');
    expect(during?.progress).toBeGreaterThan(0.3); // 피격에도 진행도가 있다
    expect(during?.progress).toBeLessThan(1);

    tickFor(world, HIT_DURATION / 2 + TICK_INTERVAL);
    expect(actor(world.observe(), 'npc-1')?.state).toBe('idle');
  });

  it('대체 불가능한 행동 중이어도 피격은 그 행동을 끊는다', () => {
    // 플레이어가 채굴하는 동안 NPC 가 곁에서 휘두른다
    const world = driveWorld({
      actorPosition: { x: 8, z: -5 },
      npcs: [{ id: 'npc-1', position: { x: 8, z: -4 }, wanderPath: [] }],
    });

    expect(world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' }).status).toBe(
      'success',
    );

    // NPC 는 사거리 안이므로 곧장 휘두르고, 구간이 열리는 시점(≈0.17초)에 타격한다
    tickFor(world, AFTER_SWING_OPEN + TICK_INTERVAL);
    const view = world.observe();
    expect(actor(view, 'npc-1')?.state).toBe('attack'); // 휘두름은 계속 진행 중이다
    expect(actor(view, PLAYER)?.state).toBe('hit'); // 채굴이 끊겼다
  });

  it('피격 중에는 요청이 거부된다 (hit 은 Replaceable 이 아니다)', () => {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [{ id: 'npc-1', position: { x: 1, z: 0 }, wanderPath: [] }],
    });

    tickFor(world, AFTER_SWING_OPEN + TICK_INTERVAL); // NPC 가 휘둘러 플레이어를 때린다
    expect(actor(world.observe(), PLAYER)?.state).toBe('hit');

    expect(world.dispatch({ interactionId: 'move', position: { x: 5, z: 5 } })).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'action-busy',
    });
  });
});
