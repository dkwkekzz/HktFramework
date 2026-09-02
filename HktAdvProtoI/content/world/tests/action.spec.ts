// RULE-ACTION-BEGIN-001 · RULE-ACTION-PROGRESS-001 World 단독 테스트
// INTENT-ACTION-STATE-001 · INTENT-ACTION-PROGRESS-001 · INTENT-ACTION-EXCLUSIVE-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { driveWorld, PLAYER } from './drive';

const solo = { npcs: [] };
const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === PLAYER);
const move = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'move');
const hudAction = (v: GameViewSnapshot) => v.hud.find((h) => h.id === 'player.action');

describe('INTENT-ACTION-STATE-001 — 언제나 하나의 행동 안에 있다', () => {
  it('세계가 시작되면 모든 Actor 는 대기 행동이다', () => {
    // 관찰 결과는 관찰자가 들어온 Tick 에 만들어지고, 그 Tick 에서 이미
    // RULE-NPC-DECIDE-001 이 돈다. 그래서 "시작 상태"를 보려면 스스로 갈 곳도
    // 인지할 대상도 없는 자율 존재를 둔다.
    const world = driveWorld({
      npcs: [{ id: 'npc-1', position: { x: -8, z: 4 }, wanderPath: [], perceptionRange: 0 }],
    });
    const view = world.observe();

    const characters = view.entities.filter((e) => e.role.endsWith('-character'));
    expect(characters.length).toBeGreaterThan(1); // player + npc
    for (const c of characters) expect(c.state).toBe('idle');
  });

  it('행동 상태와 진행도는 HUD 로도 관찰된다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 } });
    expect(hudAction(world.observe())?.value).toBe('idle');

    world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    world.tick(0.6);

    const item = hudAction(world.observe());
    expect(item?.value).toBe('mine');
    expect(item?.progress).toBeCloseTo(0.5);
  });
});

describe('RULE-ACTION-BEGIN-001 — 대체 불가 행동 중의 요청', () => {
  it('채굴 중에는 이동 요청이 거부되고 사유(action-busy)를 알 수 있다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 } });
    world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    world.tick(0.2);

    const result = world.dispatch({ interactionId: 'move', position: { x: 0, z: 0 } });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MOVE-001', reason: 'action-busy' });
    const view = world.observe();
    expect(player(view)?.state).toBe('mine');
    expect(move(view)?.available).toBe(false);
    expect(move(view)?.reason).toBe('action-busy');
  });

  it('채굴 중에는 다른 채굴 요청도 거부된다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 } });
    world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    world.tick(0.2);

    const result = world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'action-busy' });
  });

  it('행동이 끝나면 다시 대체 가능해진다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 } });
    world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    world.tick(1.2);

    expect(move(world.observe())?.available).toBe(true);
    expect(world.dispatch({ interactionId: 'move', position: { x: 0, z: 0 } }).status).toBe(
      'success',
    );
  });
});

describe('RULE-ACTION-PROGRESS-001 — 진행도', () => {
  it('소요 시간이 없는 행동(대기·이동)에는 진행도가 없다', () => {
    const world = driveWorld({ ...solo });
    expect(player(world.observe())?.progress).toBeUndefined();

    world.dispatch({ interactionId: 'move', position: { x: 6, z: 0 } });
    world.tick(0.2);
    expect(player(world.observe())?.progress).toBeUndefined();
  });

  it('진행도는 0..1 을 벗어나지 않는다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 } });
    world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });

    world.tick(0.3);
    const p = player(world.observe())?.progress ?? -1;
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});
