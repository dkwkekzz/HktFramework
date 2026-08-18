// RULE-OBSERVER-JOIN-001 · RULE-OBSERVER-LEAVE-001 World 단독 테스트 (C004)
// Implements INTENT-OBSERVER-IDENTITY-001 · INTENT-OBSERVER-JOIN-001 ·
//            INTENT-OBSERVER-REJOIN-001 · INTENT-OBSERVER-LEAVE-001 ·
//            INTENT-PER-OBSERVER-PROJECTION-001 · INTENT-REQUEST-ATTRIBUTION-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../../../protocol/gameview';
import { createWorld, type World, type WorldSetup } from '../index';
import { MAX_OBSERVER_ID_LENGTH } from '../../../../engine/world-kernel/observer';

const A = 'observer-a';
const B = 'observer-b';
const solo: WorldSetup = { npcs: [] };

function world(setup: WorldSetup = solo): World {
  return createWorld(setup);
}

const see = (w: World, observerId: string): GameViewSnapshot => {
  const snapshot = w.latestObservation(observerId);
  if (!snapshot) throw new Error(`관찰 결과가 없다 — ${observerId}`);
  return snapshot;
};

const entity = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
const characters = (v: GameViewSnapshot) =>
  v.entities.filter((e) => e.role.endsWith('-character'));

describe('INTENT-OBSERVER-JOIN-001 — 관찰자가 들어오면 몸이 생긴다', () => {
  it('관찰자가 없는 세계에는 조종되는 몸이 없다', () => {
    const w = world();
    w.tick(0);
    expect(w.latestObservation(A)).toBeNull(); // 볼 사람이 없으니 관찰 결과도 없다
  });

  it('들어오면 세계가 몸을 정해 준다', () => {
    const w = world();
    w.join(A);
    w.tick(0);

    const v = see(w, A);
    expect(v.observer.id).toBe(A);
    expect(v.observer.characterId).toBe('player-1');
    expect(entity(v, 'player-1')?.role).toBe('player-character');
  });

  it('참여는 다음 Tick 이 판정한다 — 밝히는 즉시 몸이 생기지 않는다', () => {
    const w = world();
    w.join(A);
    expect(w.latestObservation(A)).toBeNull();

    w.tick(0);
    expect(see(w, A).observer.characterId).toBe('player-1');
  });

  it('둘이 들어오면 몸도 둘이고 서로 다른 자리에 선다', () => {
    const w = world();
    w.join(A);
    w.join(B);
    w.tick(0);

    const va = see(w, A);
    expect(characters(va)).toHaveLength(2);
    expect(entity(va, 'player-1')?.position).not.toEqual(entity(va, 'player-2')?.position);
  });

  it('한 관찰자에게는 하나의 몸만 있다 — 두 번 들어와도 늘지 않는다', () => {
    const w = world();
    w.join(A);
    w.join(A);
    w.tick(0);

    expect(characters(see(w, A))).toHaveLength(1);
  });
});

describe('INTENT-OBSERVER-IDENTITY-001 — 세계는 밝힘으로 관찰자를 가린다', () => {
  it('밝힐 수 있으면 인정된다 — 자격을 따지지 않는다', () => {
    const w = world();
    w.join('아무나');
    const { observerResults } = w.tick(0);

    expect(observerResults).toEqual([{ status: 'success', rule: 'RULE-OBSERVER-JOIN-001' }]);
  });

  it('빈 밝힘과 너무 긴 밝힘은 받아들이지 않는다', () => {
    const w = world();
    w.join('');
    w.join('x'.repeat(MAX_OBSERVER_ID_LENGTH + 1));
    const { observerResults } = w.tick(0);

    expect(observerResults.map((r) => r.status)).toEqual(['failure', 'failure']);
    expect(observerResults[0]).toEqual({
      status: 'failure',
      rule: 'RULE-OBSERVER-JOIN-001',
      reason: 'invalid-observer-id',
    });
  });

  it('다른 밝힘은 다른 관찰자다 — 세계가 둘을 혼동하지 않는다', () => {
    const w = world();
    w.join(A);
    w.join(B);
    w.tick(0);

    expect(see(w, A).observer.characterId).not.toBe(see(w, B).observer.characterId);
  });
});

describe('INTENT-PER-OBSERVER-PROJECTION-001 — 관찰 결과는 관찰자마다 다르다', () => {
  it('같은 몸이 보는 이에 따라 내 몸이거나 남의 몸이다', () => {
    const w = world();
    w.join(A);
    w.join(B);
    w.tick(0);

    expect(entity(see(w, A), 'player-1')?.role).toBe('player-character');
    expect(entity(see(w, B), 'player-1')?.role).toBe('other-player-character');
    expect(entity(see(w, A), 'player-2')?.role).toBe('other-player-character');
    expect(entity(see(w, B), 'player-2')?.role).toBe('player-character');
  });

  it('세계의 사실은 모두에게 같다 — 위치·상태·세계 시간', () => {
    const w = world();
    w.join(A);
    w.join(B);
    w.tick(0.5);

    const va = see(w, A);
    const vb = see(w, B);
    expect(entity(va, 'player-2')?.position).toEqual(entity(vb, 'player-2')?.position);
    expect(hud(va, 'world.time')).toBe(hud(vb, 'world.time'));
  });

  it('나만의 것은 내 몸의 것이다 — 남의 소지품은 실리지 않는다', () => {
    const w = world({ ...solo, actorPosition: { x: 8, z: -5 } });
    w.join(A);
    w.join(B);
    w.tick(0);

    // A 만 채굴한다 (B 는 다른 자리에 있다)
    w.request(A, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    for (let i = 0; i < 60; i++) w.tick(1 / 30);

    expect(hud(see(w, A), 'inventory.stone')).toBe(1);
    expect(hud(see(w, B), 'inventory.stone')).toBe(0);
  });

  it('가용성도 내 몸 기준이다', () => {
    const w = world({ ...solo, actorPosition: { x: 8, z: -5 } });
    w.join(A); // 광맥 옆
    w.join(B); // 멀리
    w.tick(0);

    const mine = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'mine');
    expect(mine(see(w, A))?.available).toBe(true);
    expect(mine(see(w, B))?.available).toBe(false);
    expect(mine(see(w, B))?.reason).toBe('out-of-range');
  });

  it('함께 보고 있는 사람의 수가 관찰된다', () => {
    const w = world();
    w.join(A);
    w.tick(0);
    expect(hud(see(w, A), 'observers.present')).toBe(1);

    w.join(B);
    w.tick(0);
    expect(hud(see(w, A), 'observers.present')).toBe(2);
  });
});

describe('INTENT-REQUEST-ATTRIBUTION-001 — 요청은 보낸 이의 몸에만 닿는다', () => {
  it('내 요청은 내 몸을 움직인다', () => {
    const w = world();
    w.join(A);
    w.join(B);
    w.tick(0);

    w.request(A, { interactionId: 'move', position: { x: 5, z: 5 } });
    w.tick(0);

    expect(entity(see(w, A), 'player-1')?.state).toBe('move');
    expect(entity(see(w, A), 'player-2')?.state).toBe('idle'); // 남의 몸은 그대로다
  });

  it('요청에 남의 몸을 적어도 남의 몸은 움직이지 않는다', () => {
    const w = world();
    w.join(A);
    w.join(B);
    w.tick(0);

    // targetEntityId 로 남의 몸을 적어 보낸다 — 주체를 지정하는 수단이 아니다
    w.request(A, { interactionId: 'mine', targetEntityId: 'player-2' });
    const { results } = w.tick(0);

    expect(results[0]?.status).toBe('failure'); // 광맥이 아니다
    expect(entity(see(w, B), 'player-2')?.state).toBe('idle');
  });

  it('세계가 모르는 관찰자의 요청은 아무것도 바꾸지 못한다', () => {
    const w = world({ ...solo, actorPosition: { x: 8, z: -5 } });
    w.join(A);
    w.tick(0);

    w.request('낯선 사람', { interactionId: 'mine', targetEntityId: 'deposit-1' });
    const { results } = w.tick(0);

    expect(results[0]).toEqual({
      status: 'failure',
      rule: 'DISPATCH',
      reason: 'unknown-observer',
    });
    expect(entity(see(w, A), 'player-1')?.state).toBe('idle');
  });
});

describe('INTENT-OBSERVER-LEAVE-001 — 떠나도 몸은 세계에 남는다', () => {
  it('떠난 사람의 몸이 그 자리에 남는다', () => {
    const w = world();
    w.join(A);
    w.join(B);
    w.tick(0);
    const before = entity(see(w, B), 'player-1')?.position;

    w.leave(A);
    w.tick(0.5);

    const after = entity(see(w, B), 'player-1');
    expect(after).toBeDefined();
    expect(after?.position).toEqual(before);
  });

  it('조종하는 이가 없는 몸이라는 사실이 남은 사람에게 보인다', () => {
    const w = world();
    w.join(A);
    w.join(B);
    w.tick(0);
    expect(entity(see(w, B), 'player-1')?.attended).toBe(true);

    w.leave(A);
    w.tick(0);
    expect(entity(see(w, B), 'player-1')?.attended).toBe(false);
    expect(hud(see(w, B), 'observers.present')).toBe(1);
  });

  it('내 몸과 자율 존재에는 attended 가 실리지 않는다', () => {
    const w = world({ npcs: [{ id: 'npc-1', position: { x: 1, z: 1 }, wanderPath: [] }] });
    w.join(A);
    w.tick(0);

    const v = see(w, A);
    expect(entity(v, 'player-1')?.attended).toBeUndefined();
    expect(entity(v, 'npc-1')?.attended).toBeUndefined();
  });

  it('하던 행동은 세계의 시간대로 끝까지 진행된다', () => {
    const w = world({ ...solo, actorPosition: { x: 8, z: -5 } });
    w.join(A);
    w.join(B);
    w.tick(0);

    w.request(A, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    w.tick(0);
    expect(entity(see(w, B), 'player-1')?.state).toBe('mine');

    w.leave(A); // 채굴 도중에 떠난다
    for (let i = 0; i < 60; i++) w.tick(1 / 30);

    // 채굴은 끝났다 — 몸은 대기로 돌아가 있고 광맥은 줄었다
    expect(entity(see(w, B), 'player-1')?.state).toBe('idle');
    expect(entity(see(w, B), 'deposit-1')?.labelValue).toBe(4);
  });

  it('보는 이가 없는 몸은 스스로 새 행동을 시작하지 않는다', () => {
    const w = world();
    w.join(A);
    w.join(B);
    w.tick(0);

    w.leave(A);
    for (let i = 0; i < 120; i++) w.tick(1 / 30);

    expect(entity(see(w, B), 'player-1')?.state).toBe('idle'); // 자율 존재가 아니다
  });

  it('떠난 관찰자에게는 관찰 결과가 만들어지지 않는다', () => {
    const w = world();
    w.join(A);
    w.tick(0);

    w.leave(A);
    const { observations } = w.tick(0.1);
    expect(observations.has(A)).toBe(false);
  });

  it('세계가 모르는 이의 이탈은 실패로 판정된다', () => {
    const w = world();
    w.leave('낯선 사람');
    const { observerResults } = w.tick(0);

    expect(observerResults[0]).toEqual({
      status: 'failure',
      rule: 'RULE-OBSERVER-LEAVE-001',
      reason: 'unknown-observer',
    });
  });
});

describe('INTENT-OBSERVER-REJOIN-001 — 다시 이어져도 나는 나다', () => {
  it('같은 밝힘으로 돌아오면 같은 몸을 되찾는다', () => {
    const w = world({ ...solo, actorPosition: { x: 8, z: -5 } });
    w.join(A);
    w.tick(0);

    // 자리와 소지품을 만든다
    w.request(A, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    for (let i = 0; i < 60; i++) w.tick(1 / 30);
    const stone = hud(see(w, A), 'inventory.stone');

    w.leave(A);
    w.tick(1.0);
    w.join(A);
    w.tick(0);

    const v = see(w, A);
    expect(v.observer.characterId).toBe('player-1'); // 새 몸이 아니다
    expect(hud(v, 'inventory.stone')).toBe(stone); // 가진 것이 이어진다
    expect(entity(v, 'player-1')?.position).toEqual({ x: 8, z: -5 }); // 자리도 이어진다
  });

  it('다시 들어와도 몸이 늘지 않는다', () => {
    const w = world();
    w.join(A);
    w.tick(0);
    w.leave(A);
    w.tick(0);
    w.join(A);
    w.tick(0);

    expect(characters(see(w, A))).toHaveLength(1);
  });

  it('끊긴 동안 흐른 세계가 돌아온 관찰자에게 한 번에 보인다', () => {
    const w = world();
    w.join(A);
    w.tick(0);

    w.leave(A);
    for (let i = 0; i < 30; i++) w.tick(0.1);
    w.join(A);
    w.tick(0);

    expect(hud(see(w, A), 'world.time')).toBeCloseTo(3.0, 5);
  });
});
