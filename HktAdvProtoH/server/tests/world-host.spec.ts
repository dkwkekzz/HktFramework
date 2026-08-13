// World Host 단독 테스트 — 소켓 없이 "세계가 밖에서 돈다"를 검증한다 (C003 · C004).
//
// C004 — 관찰자는 익명이 아니다. 붙을 때 자신을 밝히고, 첫 관찰 결과는
// 세계가 참여를 판정한 다음 Tick 에 온다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { parseClientMessage, parseServerMessage } from '../../protocol/transport';
import { createWorldHost } from '../world-host';

const A = 'observer-a';
const B = 'observer-b';
const worldTime = (v: GameViewSnapshot) => v.hud.find((h) => h.id === 'world.time')?.value as number;
const stone = (v: GameViewSnapshot) =>
  v.hud.find((h) => h.id === 'inventory.stone')?.value as number;

describe('WorldHost — 관찰자 붙었다 떨어지기', () => {
  it('붙은 뒤 첫 Tick 에 자기 몸이 있는 세계를 받는다', () => {
    const host = createWorldHost({ npcs: [] });
    const received: GameViewSnapshot[] = [];

    host.attach(A, (s) => received.push(s));
    expect(received).toHaveLength(0); // 밝힘은 아직 세계에 도착만 했다

    host.advance(0);
    expect(received).toHaveLength(1);
    expect(received[0]?.observer.id).toBe(A);
    expect(received[0]?.entities.some((e) => e.id === received[0]!.observer.characterId)).toBe(true);
  });

  it('Tick 마다 붙어 있는 관찰자 모두에게 자기 관찰 결과가 간다', () => {
    const host = createWorldHost({ npcs: [] });
    const a: GameViewSnapshot[] = [];
    const b: GameViewSnapshot[] = [];
    host.attach(A, (s) => a.push(s));
    host.attach(B, (s) => b.push(s));

    host.advance(0.1);
    host.advance(0.1);

    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    expect(worldTime(a[1]!)).toBeCloseTo(0.2);
    // 각자 자기 몸을 받는다
    expect(a[1]?.observer.id).toBe(A);
    expect(b[1]?.observer.id).toBe(B);
    expect(a[1]?.observer.characterId).not.toBe(b[1]?.observer.characterId);
  });

  it('한 사람의 몸이 다른 사람의 화면에 다른 관찰자의 몸으로 나타난다', () => {
    const host = createWorldHost({ npcs: [] });
    const a: GameViewSnapshot[] = [];
    const b: GameViewSnapshot[] = [];
    host.attach(A, (s) => a.push(s));
    host.attach(B, (s) => b.push(s));
    host.advance(0);

    const mine = a[0]!.observer.characterId;
    expect(b[0]?.entities.find((e) => e.id === mine)?.role).toBe('other-player-character');
    expect(a[0]?.entities.find((e) => e.id === mine)?.role).toBe('player-character');
  });

  it('관찰자가 떨어져도 세계는 계속 진행한다', () => {
    const host = createWorldHost({ npcs: [] });
    const detach = host.attach(A, () => {});
    host.advance(0.5);

    detach();
    expect(host.observerCount()).toBe(0);
    host.advance(0.5);
    host.advance(0.5);

    // 아무도 보고 있지 않은 동안에도 시간은 흘렀다
    const later: GameViewSnapshot[] = [];
    host.attach(A, (s) => later.push(s));
    host.advance(0);
    expect(worldTime(later[0]!)).toBeCloseTo(1.5);
  });

  it('관찰자가 보낸 요청은 다음 Tick 에 판정된다', () => {
    const host = createWorldHost({ npcs: [], actorPosition: { x: 8, z: -5 } });
    const seen: GameViewSnapshot[] = [];
    host.attach(A, (s) => seen.push(s));
    host.advance(0);

    const body = () => {
      const last = seen[seen.length - 1]!;
      return last.entities.find((e) => e.id === last.observer.characterId);
    };

    host.receive(A, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    expect(body()?.state).toBe('idle');

    host.advance(0);
    expect(body()?.state).toBe('mine');
  });
});

describe('WorldHost — 같은 관찰자로 다시 들어오기 (INTENT-OBSERVER-REJOIN-001)', () => {
  it('끊겼다 같은 밝힘으로 돌아오면 같은 몸과 가진 것이 이어진다', () => {
    const host = createWorldHost({ npcs: [], actorPosition: { x: 8, z: -5 } });
    const first: GameViewSnapshot[] = [];
    const detach = host.attach(A, (s) => first.push(s));
    host.advance(0);

    host.receive(A, { interactionId: 'mine', targetEntityId: 'deposit-1' });
    for (let i = 0; i < 60; i++) host.advance(1 / 30);
    const before = first[first.length - 1]!;
    expect(stone(before)).toBe(1);

    detach();
    host.advance(1.0);

    const again: GameViewSnapshot[] = [];
    host.attach(A, (s) => again.push(s));
    host.advance(0);

    expect(again[0]?.observer.characterId).toBe(before.observer.characterId);
    expect(stone(again[0]!)).toBe(1);
  });

  it('같은 관찰자로 다른 곳에서 들어오면 먼저 있던 이어짐이 떨어진다', () => {
    const host = createWorldHost({ npcs: [] });
    let evicted = false;
    const firstDetach = host.attach(
      A,
      () => {},
      () => {
        evicted = true;
      },
    );
    host.advance(0);

    const second: GameViewSnapshot[] = [];
    host.attach(A, (s) => second.push(s));
    host.advance(0);

    expect(evicted).toBe(true);
    expect(host.observerCount()).toBe(1); // 몸 하나에 조종하는 이는 하나다
    expect(second).toHaveLength(1);

    // 밀려난 쪽이 뒤늦게 정리해도 새 이어짐을 끊지 않는다
    firstDetach();
    host.advance(0);
    expect(second).toHaveLength(2);
  });

  it('떠난 사람의 몸은 남은 사람에게 조종되지 않는 것으로 보인다', () => {
    const host = createWorldHost({ npcs: [] });
    const detachA = host.attach(A, () => {});
    const b: GameViewSnapshot[] = [];
    host.attach(B, (s) => b.push(s));
    host.advance(0);

    const bodyA = 'player-1';
    expect(b[b.length - 1]?.entities.find((e) => e.id === bodyA)?.attended).toBe(true);

    detachA();
    host.advance(0);

    const last = b[b.length - 1]!;
    expect(last.entities.find((e) => e.id === bodyA)?.attended).toBe(false);
    expect(last.entities.find((e) => e.id === bodyA)).toBeDefined(); // 몸은 남아 있다
  });
});

describe('WorldHost — 자기 시계', () => {
  it('시계를 붙이면 관찰자 없이도 스스로 진행한다', async () => {
    const host = createWorldHost({ npcs: [] });
    host.startClock();

    await new Promise((resolve) => setTimeout(resolve, 200));
    const seen: GameViewSnapshot[] = [];
    host.attach(A, (s) => seen.push(s));
    await new Promise((resolve) => setTimeout(resolve, 100));
    host.stop();

    expect(worldTime(seen[0]!)).toBeGreaterThan(0.1); // 실제 시간이 흘렀다
  });
});

describe('transport — 오가는 것의 형태', () => {
  it('관찰 결과 봉투를 주고받을 수 있다', () => {
    const host = createWorldHost({ npcs: [] });
    host.attach(A, () => {});
    const snapshot = host.advance(0.1).get(A);

    const wire = JSON.stringify({ type: 'observation', snapshot });
    expect(parseServerMessage(wire)?.snapshot).toEqual(snapshot);
  });

  it('자기를 밝히는 봉투를 주고받을 수 있다', () => {
    const wire = JSON.stringify({ type: 'join', observerId: A });
    const message = parseClientMessage(wire);
    expect(message?.type).toBe('join');
    expect(message?.type === 'join' && message.observerId).toBe(A);
  });

  it('요청 봉투를 주고받을 수 있다 — 주체를 적는 자리가 없다', () => {
    const wire = JSON.stringify({
      type: 'action',
      action: { interactionId: 'mine', targetEntityId: 'deposit-1' },
    });
    const message = parseClientMessage(wire);
    expect(message?.type === 'action' && message.action.interactionId).toBe('mine');
  });

  it('알 수 없는 것은 무시된다 — 세계를 흔들 수 없다', () => {
    expect(parseClientMessage('그냥 문자열')).toBeNull();
    expect(parseClientMessage('{"type":"action"}')).toBeNull();
    expect(parseClientMessage('{"type":"join"}')).toBeNull();
    expect(parseClientMessage('{"type":"shutdown"}')).toBeNull();
    expect(parseServerMessage('{"type":"observation"}')).toBeNull();
  });
});
