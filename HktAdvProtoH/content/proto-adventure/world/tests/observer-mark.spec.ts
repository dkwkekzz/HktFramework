// RULE-OBSERVER-MARK-001 World 단독 테스트 (C005)
// Implements INTENT-OBSERVER-MARK-001
//
// 세계가 이어짐에 대해 아는 것은 이것 하나뿐이다 — "너에게서 여기까지 받았다".
// 왕복 시간 · 도착률 · 보낸 양 · 다시 이은 횟수는 세계의 것이 아니므로 여기에 없다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../../../protocol/gameview';
import { createWorld, type World, type WorldSetup } from '../index';

const A = 'observer-a';
const B = 'observer-b';
const solo: WorldSetup = { npcs: [] };

const see = (w: World, observerId: string): GameViewSnapshot => {
  const snapshot = w.latestObservation(observerId);
  if (!snapshot) throw new Error(`관찰 결과가 없다 — ${observerId}`);
  return snapshot;
};

function joined(setup: WorldSetup = solo, ...observers: string[]): World {
  const w = createWorld(setup);
  for (const id of observers) w.join(id);
  w.tick(0);
  return w;
}

describe('INTENT-OBSERVER-MARK-001 — 세계가 받아들인 자리', () => {
  it('참여 직후 받아들인 자리는 0 이다', () => {
    const w = joined(solo, A);
    expect(see(w, A).observer.acknowledgedMark).toBe(0);
  });

  it('표식을 보내면 세계가 받아들이고 관찰 결과로 되돌린다', () => {
    const w = joined(solo, A);

    w.mark(A, 7);
    expect(see(w, A).observer.acknowledgedMark).toBe(0); // 아직 Tick 이 오지 않았다

    const { observerResults } = w.tick(0);
    expect(observerResults).toEqual([{ status: 'success', rule: 'RULE-OBSERVER-MARK-001' }]);
    expect(see(w, A).observer.acknowledgedMark).toBe(7);
  });

  it('받아들인 자리는 뒤로 가지 않는다 — 늦게 온 옛 표식은 무시된다', () => {
    const w = joined(solo, A);
    w.mark(A, 10);
    w.tick(0);

    w.mark(A, 4); // 늦게 도착한 옛 것
    const { observerResults } = w.tick(0);

    expect(observerResults[0]).toEqual({
      status: 'failure',
      rule: 'RULE-OBSERVER-MARK-001',
      reason: 'stale-mark',
    });
    expect(see(w, A).observer.acknowledgedMark).toBe(10); // 그대로다
  });

  it('같은 표식을 다시 보내도 받아들인 자리는 그대로다', () => {
    const w = joined(solo, A);
    w.mark(A, 3);
    w.tick(0);
    w.mark(A, 3);
    const { observerResults } = w.tick(0);

    expect(observerResults[0]?.status).toBe('failure');
    expect(see(w, A).observer.acknowledgedMark).toBe(3);
  });

  it('수가 아닌 표식은 받아들이지 않는다', () => {
    const w = joined(solo, A);
    w.mark(A, Number.NaN);
    w.mark(A, Number.POSITIVE_INFINITY);
    const { observerResults } = w.tick(0);

    expect(observerResults.map((r) => r.status)).toEqual(['failure', 'failure']);
    expect(see(w, A).observer.acknowledgedMark).toBe(0);
  });

  it('세계가 모르는 관찰자의 표식은 아무것도 바꾸지 못한다', () => {
    const w = joined(solo, A);
    w.mark('낯선 사람', 5);
    const { observerResults } = w.tick(0);

    expect(observerResults[0]).toEqual({
      status: 'failure',
      rule: 'RULE-OBSERVER-MARK-001',
      reason: 'unknown-observer',
    });
    expect(see(w, A).observer.acknowledgedMark).toBe(0);
  });

  it('한 Tick 에 여러 표식이 오면 마지막 것까지 받아들인다', () => {
    const w = joined(solo, A);
    w.mark(A, 1);
    w.mark(A, 2);
    w.mark(A, 3);
    w.tick(0);

    expect(see(w, A).observer.acknowledgedMark).toBe(3);
  });
});

describe('표식은 게임을 바꾸지 않는다', () => {
  it('몸 · 광맥 · 세계 시간 중 어느 것도 표식 때문에 달라지지 않는다', () => {
    const w = joined({ ...solo, actorPosition: { x: 8, z: -5 } }, A);
    const before = see(w, A);
    const bodyBefore = before.entities.find((e) => e.id === before.observer.characterId);
    const depositBefore = before.entities.find((e) => e.id === 'deposit-1');
    const timeBefore = before.hud.find((h) => h.id === 'world.time')?.value;

    for (let i = 1; i <= 20; i++) {
      w.mark(A, i);
      w.tick(0); // 시간을 흘리지 않는다
    }

    const after = see(w, A);
    const bodyAfter = after.entities.find((e) => e.id === after.observer.characterId);
    expect(bodyAfter?.position).toEqual(bodyBefore?.position);
    expect(bodyAfter?.state).toBe(bodyBefore?.state);
    expect(after.entities.find((e) => e.id === 'deposit-1')?.labelValue).toBe(
      depositBefore?.labelValue,
    );
    expect(after.hud.find((h) => h.id === 'world.time')?.value).toBe(timeBefore);
    expect(after.observer.acknowledgedMark).toBe(20);
  });

  it('표식은 어떤 행동 판정도 부르지 않는다 — 요청 판정 목록이 비어 있다', () => {
    const w = joined(solo, A);
    w.mark(A, 1);
    const { results } = w.tick(0);

    expect(results).toEqual([]); // dispatch 가 한 번도 불리지 않았다
  });
});

describe('표식은 관찰자마다의 일이다 (INTENT-PER-OBSERVER-PROJECTION-001)', () => {
  it('내 관찰 결과에는 내 표식만 실린다', () => {
    const w = joined(solo, A, B);
    w.mark(A, 11);
    w.mark(B, 22);
    w.tick(0);

    expect(see(w, A).observer.acknowledgedMark).toBe(11);
    expect(see(w, B).observer.acknowledgedMark).toBe(22);
  });

  it('한 관찰자의 표식이 다른 관찰자의 것을 건드리지 않는다', () => {
    const w = joined(solo, A, B);
    w.mark(A, 99);
    w.tick(0);

    expect(see(w, B).observer.acknowledgedMark).toBe(0);
  });
});

describe('표식과 요청이 같은 Tick 에 왔을 때 (인과의 왕복)', () => {
  it('요청을 보낸 뒤 붙인 표식은 그 요청의 결과와 같은 관찰 결과로 돌아온다', () => {
    const w = joined({ ...solo, actorPosition: { x: 8, z: -5 } }, A);

    // 관찰자는 언제나 요청을 보낸 뒤에 표식을 붙인다
    w.request(A, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    w.mark(A, 5);

    const snapshot = w.tick(0).observations.get(A)!;

    // 표식이 돌아온 그 관찰 결과에 요청의 결과가 이미 들어 있다
    expect(snapshot.observer.acknowledgedMark).toBe(5);
    expect(snapshot.entities.find((e) => e.id === snapshot.observer.characterId)?.state).toBe(
      'mine',
    );
  });
});

describe('INTENT-OBSERVER-REJOIN-001 — 다시 이어도 받아들인 자리는 이어진다', () => {
  it('떠났다 돌아와도 세계가 받아들인 자리는 되돌아가지 않는다', () => {
    const w = joined(solo, A);
    w.mark(A, 42);
    w.tick(0);

    w.leave(A);
    w.tick(1.0);
    w.join(A);
    w.tick(0);

    expect(see(w, A).observer.acknowledgedMark).toBe(42);
  });

  it('돌아온 뒤 이어서 매긴 표식이 그대로 받아들여진다', () => {
    const w = joined(solo, A);
    w.mark(A, 42);
    w.tick(0);
    w.leave(A);
    w.tick(0);
    w.join(A);
    w.mark(A, 43);
    w.tick(0);

    expect(see(w, A).observer.acknowledgedMark).toBe(43);
  });
});
