// RULE-WORLD-TICK-001 World 단독 테스트
// Implements INTENT-WORLD-CLOCK-001 · INTENT-WORLD-OBSERVATION-001 · INTENT-REMOTE-REQUEST-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { createWorld } from '../index';

const solo = { npcs: [] };
const worldTime = (v: GameViewSnapshot) => v.hud.find((h) => h.id === 'world.time')?.value as number;
const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'player');
const npc = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'npc-1');

describe('INTENT-WORLD-CLOCK-001 — 세계는 자기 시계로 진행한다', () => {
  it('World.Time 이 Tick 마다 누적되고 관찰된다', () => {
    const world = createWorld(solo);
    expect(worldTime(world.latestObservation())).toBe(0);

    world.tick(0.5);
    world.tick(0.25);

    expect(worldTime(world.latestObservation())).toBeCloseTo(0.75);
  });

  it('관찰자가 하나도 붙지 않아도 세계는 진행한다', () => {
    const world = createWorld({
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
    });

    // 아무도 latestObservation 을 읽지 않는 동안에도 NPC 는 자기 길을 간다
    for (let i = 0; i < 60; i++) world.tick(1 / 30);

    expect(npc(world.latestObservation())?.position.z).toBeLessThan(4);
    expect(worldTime(world.latestObservation())).toBeCloseTo(2, 1);
  });
});

describe('INTENT-REMOTE-REQUEST-001 — 요청은 도착하고 나서 판정된다', () => {
  it('request 만으로는 세계가 변하지 않는다 — Tick 이 와야 판정된다', () => {
    const world = createWorld({ ...solo, actorPosition: { x: 8, z: -5 } });

    world.request({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    expect(player(world.latestObservation())?.state).toBe('idle'); // 아직 아무 일도 없다

    const { results } = world.tick(0);
    expect(results).toEqual([{ status: 'success', rule: 'RULE-MINE-001' }]);
    expect(player(world.latestObservation())?.state).toBe('mine');
  });

  it('한 Tick 에 도착한 요청들은 도착 순서대로 판정된다', () => {
    const world = createWorld({ ...solo, actorPosition: { x: 8, z: -5 } });

    world.request({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    world.request({ interactionId: 'move', position: { x: 0, z: 0 } }); // 채굴 시작 뒤 → 거부

    const { results } = world.tick(0);
    expect(results.map((r) => r.status)).toEqual(['success', 'failure']);
    expect(results[1]).toEqual({
      status: 'failure',
      rule: 'RULE-MOVE-001',
      reason: 'action-busy',
    });
  });

  it('판정 결과는 관찰 결과로도 드러난다 (요청 → 다음 관찰 결과)', () => {
    const world = createWorld({ ...solo, actorPosition: { x: 8, z: -5 } });

    world.request({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    const { snapshot } = world.tick(0);

    // 관찰자는 results 를 받지 못한다 — 이 snapshot 만으로 알아야 한다
    expect(snapshot.entities.find((e) => e.id === 'player')?.state).toBe('mine');
    expect(snapshot.interactions.find((i) => i.id === 'move')?.reason).toBe('action-busy');
  });
});

describe('INTENT-WORLD-OBSERVATION-001 — 관찰 결과는 Tick 이 내보낸다', () => {
  it('latestObservation 은 마지막 Tick 이 내보낸 바로 그 값이다', () => {
    const world = createWorld(solo);

    const { snapshot } = world.tick(0.1);

    expect(world.latestObservation()).toBe(snapshot); // 새로 만들지 않는다
  });

  it('관찰 결과는 직렬화 가능하다 (선을 탈 수 있는 모양)', () => {
    const world = createWorld();
    world.request({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    const { snapshot } = world.tick(0.2);

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('관찰 결과를 고쳐도 세계는 변하지 않는다', () => {
    const world = createWorld(solo);
    const snapshot = world.latestObservation();

    const p = snapshot.entities.find((e) => e.id === 'player');
    if (p) p.position.x = 999;

    world.tick(0);
    expect(player(world.latestObservation())?.position.x).toBe(0);
  });
});
