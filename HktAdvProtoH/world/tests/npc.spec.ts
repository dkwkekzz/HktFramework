// RULE-NPC-DECIDE-001 World 단독 테스트 — Implements INTENT-NPC-AUTONOMY-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import type { WorldSetup } from '../index';
import { driveWorld } from './drive';

const npc = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'npc-1');

// 플레이어를 인지 범위 밖에 두고 순회만 관찰하는 배치
const wanderingOnly: WorldSetup = {
  actorPosition: { x: 18, z: 18 },
  npcs: [
    {
      id: 'npc-1',
      position: { x: -8, z: 4 },
      perceptionRange: 1,
      wanderPath: [
        { x: -8, z: 4 },
        { x: -8, z: -6 },
      ],
    },
  ],
};

describe('RULE-NPC-DECIDE-001 — 인지 대상이 없을 때', () => {
  it('스스로 순회 지점으로 이동한다 (플레이어 입력 없이 행동이 시작된다)', () => {
    const world = driveWorld(wanderingOnly);
    expect(npc(world.observe())?.state).toBe('idle');

    world.tick(0.1);
    expect(npc(world.observe())?.state).toBe('move');

    for (let i = 0; i < 60; i++) world.tick(1 / 30); // 2초 — NPC 속도 2.5 → 5 이동
    const p = npc(world.observe())?.position;
    expect(p?.z).toBeLessThan(4); // (-8,4) → (-8,-6) 방향으로 진행했다
  });

  it('순회 지점에 도달하면 다음 지점으로 방향을 바꾼다', () => {
    const world = driveWorld(wanderingOnly);

    // (-8,4) → (-8,-6) 거리 10, 속도 2.5 → 4초에 도달한 뒤 되돌아간다
    let reached = 4;
    for (let i = 0; i < 150; i++) {
      world.tick(1 / 30); // 총 5초
      const z = npc(world.observe())?.position.z ?? 4;
      if (z < reached) reached = z;
    }

    expect(reached).toBeLessThanOrEqual(-5.9); // 첫 순회 지점에 도달했다
    const after = npc(world.observe());
    expect(after?.state).toBe('move');
    expect(after?.position.z).toBeGreaterThan(reached + 0.5); // 다음 지점으로 방향을 바꿨다
  });
});

describe('RULE-NPC-DECIDE-001 — 인지 대상이 있을 때', () => {
  it('인지 범위 안의 캐릭터에게 접근하고, 사거리에 이르면 공격한다', () => {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [{ id: 'npc-1', position: { x: -8, z: 0 }, wanderPath: [] }], // 거리 8 <= 인지 9
    });

    world.tick(0.1);
    expect(npc(world.observe())?.state).toBe('move'); // 접근

    let sawAttack = false;
    for (let i = 0; i < 150; i++) {
      world.tick(1 / 30);
      if (npc(world.observe())?.state === 'attack') {
        sawAttack = true;
        break;
      }
    }
    expect(sawAttack).toBe(true);
    // 공격은 대상을 담지 않는다 — 무엇이 맞을지는 휘두름이 끝나는 순간이 정한다
    expect(npc(world.observe())?.targetEntityId).toBeUndefined();
  });

  it('대체 불가 행동(공격) 중에는 새로운 결정을 하지 않는다', () => {
    const world = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [{ id: 'npc-1', position: { x: 1, z: 0 }, wanderPath: [] }], // 즉시 사거리 안
    });

    world.tick(1 / 30);
    expect(npc(world.observe())?.state).toBe('attack');

    for (let i = 0; i < 10; i++) world.tick(1 / 60); // 총 0.17초 — ATTACK_DURATION 0.6 미만
    const during = npc(world.observe());
    expect(during?.state).toBe('attack');
    expect(during?.progress).toBeGreaterThan(0); // 재시작되지 않고 계속 진행한다
  });
});

describe('결정론', () => {
  it('같은 초기 배치 · 같은 tick 순서면 같은 결과가 나온다', () => {
    const run = () => {
      const world = driveWorld(wanderingOnly);
      for (let i = 0; i < 200; i++) world.tick(1 / 30);
      const view = world.observe();
      return view.entities.map((e) => `${e.id}:${e.state}:${e.position.x}:${e.position.z}`);
    };

    expect(run()).toEqual(run());
  });
});
