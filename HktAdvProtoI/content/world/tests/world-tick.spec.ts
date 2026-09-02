// RULE-WORLD-TICK-001 World 단독 테스트
// Implements INTENT-WORLD-CLOCK-001 · INTENT-WORLD-OBSERVATION-001 · INTENT-REMOTE-REQUEST-001
// · INTENT-PER-OBSERVER-PROJECTION-001
//
// 조종되는 몸은 관찰자가 들어와야 생긴다. 그래서 각 시나리오는
// 관찰자 하나를 들여보낸 뒤 시작한다. 세계의 진행은 관찰자와 무관하다는 성질은 그대로다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { createWorld, type World, type WorldSetup } from '../index';
import { OBSERVER, PLAYER } from './drive';

const solo = { npcs: [] };
const worldTime = (v: GameViewSnapshot) => v.hud.find((h) => h.id === 'world.time')?.value as number;
const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === PLAYER);
const npc = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'npc-1');

// 관찰자 하나가 들어와 있는 세계
function joinedWorld(setup: WorldSetup = {}): World {
  const world = createWorld(setup);
  world.join(OBSERVER);
  world.tick(0);
  return world;
}

const observe = (world: World): GameViewSnapshot => {
  const snapshot = world.latestObservation(OBSERVER);
  if (!snapshot) throw new Error('관찰 결과가 없다');
  // 이 세계의 투영은 팩 계약(04 spec)의 형태다 — 봉투 형에서 팩 형으로 좁힌다 (P2)
  return snapshot as GameViewSnapshot;
};

describe('INTENT-WORLD-CLOCK-001 — 세계는 자기 시계로 진행한다', () => {
  it('World.Time 이 Tick 마다 누적되고 관찰된다', () => {
    const world = joinedWorld(solo);
    expect(worldTime(observe(world))).toBe(0);

    world.tick(0.5);
    world.tick(0.25);

    expect(worldTime(observe(world))).toBeCloseTo(0.75);
  });

  it('관찰자가 하나도 붙지 않아도 세계는 진행한다', () => {
    // 관찰자를 들여보내지 않는다 — 조종되는 몸이 아예 없는 세계다
    const world = createWorld({
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
    });

    // 아무도 보고 있지 않은 동안에도 NPC 는 자기 길을 간다
    for (let i = 0; i < 60; i++) world.tick(1 / 30);

    // 뒤늦게 들어온 관찰자가 그 사실을 확인한다
    world.join(OBSERVER);
    world.tick(0);
    expect(npc(observe(world))?.position.z).toBeLessThan(4);
    expect(worldTime(observe(world))).toBeCloseTo(2, 1);
  });
});

describe('INTENT-REMOTE-REQUEST-001 — 요청은 도착하고 나서 판정된다', () => {
  it('request 만으로는 세계가 변하지 않는다 — Tick 이 와야 판정된다', () => {
    const world = joinedWorld({ ...solo, actorPosition: { x: 8, z: -5 } });

    world.request(OBSERVER, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    expect(player(observe(world))?.state).toBe('idle'); // 아직 아무 일도 없다

    const { results } = world.tick(0);
    expect(results).toEqual([{ status: 'success', rule: 'RULE-MINE-001' }]);
    expect(player(observe(world))?.state).toBe('mine');
  });

  it('한 Tick 에 도착한 요청들은 도착 순서대로 판정된다', () => {
    const world = joinedWorld({ ...solo, actorPosition: { x: 8, z: -5 } });

    world.request(OBSERVER, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    world.request(OBSERVER, { interactionId: 'move', position: { x: 0, z: 0 } }); // 채굴 중 → 거부

    const { results } = world.tick(0);
    expect(results.map((r) => r.status)).toEqual(['success', 'failure']);
    expect(results[1]).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'action-busy',
    });
  });

  it('판정 결과는 관찰 결과로도 드러난다 (요청 → 다음 관찰 결과)', () => {
    const world = joinedWorld({ ...solo, actorPosition: { x: 8, z: -5 } });

    world.request(OBSERVER, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    const snapshot = world.tick(0).observations.get(OBSERVER)!;

    // 관찰자는 results 를 받지 못한다 — 이 snapshot 만으로 알아야 한다
    expect(snapshot.entities.find((e) => e.id === PLAYER)?.state).toBe('mine');
    expect(snapshot.interactions.find((i) => i.id === 'move')?.reason).toBe('action-busy');
  });
});

describe('INTENT-WORLD-OBSERVATION-001 — 관찰 결과는 Tick 이 내보낸다', () => {
  it('latestObservation 은 마지막 Tick 이 내보낸 바로 그 값이다', () => {
    const world = joinedWorld(solo);

    const snapshot = world.tick(0.1).observations.get(OBSERVER);

    expect(world.latestObservation(OBSERVER)).toBe(snapshot); // 새로 만들지 않는다
  });

  it('관찰 결과는 직렬화 가능하다 (선을 탈 수 있는 모양)', () => {
    const world = joinedWorld();
    world.request(OBSERVER, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    const snapshot = world.tick(0.2).observations.get(OBSERVER)!;

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('관찰 결과를 고쳐도 세계는 변하지 않는다', () => {
    const world = joinedWorld(solo);
    const snapshot = observe(world);

    const p = snapshot.entities.find((e) => e.id === PLAYER);
    if (p) p.position.x = 999;

    world.tick(0);
    expect(player(observe(world))?.position.x).toBe(0);
  });

  it('세계가 모르는 관찰자에게는 관찰 결과가 없다', () => {
    const world = joinedWorld(solo);
    expect(world.latestObservation('낯선 사람')).toBeNull();
  });
});
