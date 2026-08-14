// RULE-BODY-PUSH-001 · RULE-BODY-MOMENTUM-001 World 단독 테스트
// Implements INTENT-BODY-OCCUPY-001 · INTENT-BODY-PUSH-001 · INTENT-BODY-MOMENTUM-001 ·
//            INTENT-COLLISION-OBSERVE-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { characterDefinition } from '../semantic/character-catalog';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

// 순회도 인지도 없는 정지 NPC — 몸으로만 쓴다 (결정론)
const bodyAt = (x: number, z: number, id: string) => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
});

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const distanceBetween = (v: GameViewSnapshot, a: string, b: string) => {
  const pa = actor(v, a)!.position;
  const pb = actor(v, b)!.position;
  return Math.sqrt((pa.x - pb.x) ** 2 + (pa.z - pb.z) ** 2);
};

describe('INTENT-BODY-OCCUPY-001 — 모든 몸은 부피로 공간을 차지하고 관찰된다', () => {
  it('몸 충돌체(반경·높이·질량·방향·속도)가 종류별 크기로 실려 나온다 (R2)', () => {
    const world = driveWorld({
      actorPosition: { x: 10, z: 10 },
      npcs: [bodyAt(0, 0, 'npc-1')],
    });

    // 몸 크기는 CharacterKind 가 정한다 — 그림 크기가 이 값에서 유도되므로 언제나 일치한다
    const cases = [
      { id: PLAYER, kind: 'rabbit-swordsman' },
      { id: 'npc-1', kind: 'wanderer' },
    ];
    for (const { id, kind } of cases) {
      const def = characterDefinition(kind);
      const body = actor(world.observe(), id)?.body;
      expect(body).toEqual({
        radius: def.body.radius,
        height: def.body.height,
        mass: def.body.mass,
        facing: { x: def.facing.x, z: def.facing.z },
        velocity: { x: 0, z: 0 },
      });
    }
  });

  it('움직이면 그 방향을 향한다 (RULE-BODY-FACING-001 — R1)', () => {
    const world = driveWorld({ actorPosition: { x: 0, z: 0 }, npcs: [] });
    world.dispatch({ interactionId: 'move', position: { x: 5, z: 0 } });
    tickFor(world, 0.1);

    expect(actor(world.observe(), PLAYER)?.body?.facing).toEqual({ x: 1, z: 0 });
  });
});

describe('RULE-BODY-PUSH-001 — 겹친 몸은 서로 밀어낸다', () => {
  it('겹친 두 몸은 겹침이 풀릴 때까지 서로 반대 방향으로 밀려난다', () => {
    const world = driveWorld({
      actorPosition: { x: 10, z: 10 }, // 플레이어는 멀리 — 물리에 끼어들지 않는다
      npcs: [bodyAt(0.2, 0, 'npc-1'), bodyAt(-0.2, 0, 'npc-2')],
    });
    const before = distanceBetween(world.observe(), 'npc-1', 'npc-2');
    expect(before).toBeLessThan(2 * characterDefinition('wanderer').body.radius); // 겹쳐 있다

    tickFor(world, 1.5);

    const view = world.observe();
    const after = distanceBetween(view, 'npc-1', 'npc-2');
    expect(after).toBeGreaterThan(before);
    expect(after).toBeGreaterThanOrEqual(2 * characterDefinition('wanderer').body.radius - 0.05); // 겹침이 거의 풀렸다
    // 서로 반대 방향 — npc-1 은 +x, npc-2 는 -x
    expect(actor(view, 'npc-1')!.position.x).toBeGreaterThan(0.2);
    expect(actor(view, 'npc-2')!.position.x).toBeLessThan(-0.2);
  });

  it('뉴턴 제3법칙 — 같은 질량이면 밀려남이 대칭이다', () => {
    const world = driveWorld({
      actorPosition: { x: 10, z: 10 },
      npcs: [bodyAt(0.2, 0, 'npc-1'), bodyAt(-0.2, 0, 'npc-2')],
    });
    tickFor(world, 1.5);

    const view = world.observe();
    const moved1 = actor(view, 'npc-1')!.position.x - 0.2;
    const moved2 = -0.2 - actor(view, 'npc-2')!.position.x;
    expect(moved1).toBeCloseTo(moved2, 6);
  });

  it('중심이 완전히 일치해도 결정론적 고정 방향으로 갈라진다', () => {
    const world = driveWorld({
      actorPosition: { x: 10, z: 10 },
      npcs: [bodyAt(0, 0, 'npc-1'), bodyAt(0, 0, 'npc-2')],
    });
    tickFor(world, 1.5);

    const view = world.observe();
    // Actors 순서가 앞선 npc-1 이 -x 로 밀린다 (RULE-BODY-PUSH-001 결정론 조항)
    expect(actor(view, 'npc-1')!.position.x).toBeLessThan(0);
    expect(actor(view, 'npc-2')!.position.x).toBeGreaterThan(0);
    expect(actor(view, 'npc-1')!.position.z).toBe(0);
  });

  it('겹쳐 서려 해도 밀려나 겹침이 풀린다 — 이동이 정한 자리를 물리가 보정한다', () => {
    // 플레이어가 정지한 npc 의 자리로 걸어 들어간다 (move 는 그 자리 도착을 허용한다)
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [bodyAt(3, 0, 'npc-1')],
    });
    world.dispatch({ interactionId: 'move', position: { x: 3, z: 0 } });
    tickFor(world, 2.0); // 도착(0.5초) 후 밀어냄이 겹침을 푼다

    const view = world.observe();
    const contact = characterDefinition('rabbit-swordsman').body.radius + characterDefinition('wanderer').body.radius;
    expect(distanceBetween(view, PLAYER, 'npc-1')).toBeGreaterThanOrEqual(contact - 0.05);
  });
});

describe('RULE-BODY-MOMENTUM-001 — 관성 · 마찰 · 경계', () => {
  it('밀려난 몸은 마찰로 잦아들어 멈춘다', () => {
    const world = driveWorld({
      actorPosition: { x: 10, z: 10 },
      npcs: [bodyAt(0.2, 0, 'npc-1'), bodyAt(-0.2, 0, 'npc-2')],
    });
    tickFor(world, 3.0);

    const view = world.observe();
    expect(actor(view, 'npc-1')?.body?.velocity).toEqual({ x: 0, z: 0 });
    const settled = actor(view, 'npc-1')!.position.x;

    tickFor(world, 0.5); // 멈춘 뒤에는 더 움직이지 않는다
    expect(actor(world.observe(), 'npc-1')!.position.x).toBe(settled);
  });

  it('몸은 세계 경계 밖으로 밀리지 않는다', () => {
    // 경계(x=20) 바로 앞에서 겹친 두 몸 — 바깥쪽 몸은 경계에 고정된다
    const world = driveWorld({
      actorPosition: { x: -10, z: -10 },
      npcs: [bodyAt(19.5, 0, 'npc-1'), bodyAt(19.9, 0, 'npc-2')],
    });
    tickFor(world, 2.0);

    const view = world.observe();
    expect(actor(view, 'npc-2')!.position.x).toBeLessThanOrEqual(20);
    expect(actor(view, 'npc-1')!.position.x).toBeLessThan(actor(view, 'npc-2')!.position.x);
  });
});
