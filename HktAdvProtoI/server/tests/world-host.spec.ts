// World Host 단독 테스트 — 소켓 없이 "세계가 밖에서 돈다"를 검증한다.
//
// 관찰자는 익명이 아니다. 붙을 때 자신을 밝히고, 첫 관찰 결과는
// 세계가 참여를 판정한 다음 Tick 에 온다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot, RequestOutcomeView } from '../../engine/protocol-core/gameview';
import type { ActionRequest } from '../../content/protocol/actions';
import { parseClientMessage, parseServerMessage } from '../../engine/protocol-core/transport';
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

describe('WorldHost — 표식', () => {
  it('관찰자가 보낸 표식이 세계에 도착해 관찰 결과로 돌아온다', () => {
    const host = createWorldHost({ npcs: [] });
    const seen: GameViewSnapshot[] = [];
    host.attach(A, (s) => seen.push(s));
    host.advance(0);
    expect(seen[seen.length - 1]?.observer.acknowledgedMark).toBe(0);

    host.receiveMark(A, 12);
    host.advance(0);

    expect(seen[seen.length - 1]?.observer.acknowledgedMark).toBe(12);
  });

  it('표식은 다른 관찰자의 관찰 결과를 건드리지 않는다', () => {
    const host = createWorldHost({ npcs: [] });
    const b: GameViewSnapshot[] = [];
    host.attach(A, () => {});
    host.attach(B, (s) => b.push(s));
    host.advance(0);

    host.receiveMark(A, 5);
    host.advance(0);

    expect(b[b.length - 1]?.observer.acknowledgedMark).toBe(0);
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

// 세계 → 관찰자 방향에 관찰 결과 말고 다른 것이 실린다.
describe('WorldHost — 세계의 대답이 요청한 이에게 닿는다', () => {
  function attachWithOutcomes(host: ReturnType<typeof createWorldHost>, observerId: string) {
    const snapshots: GameViewSnapshot[] = [];
    const outcomes: RequestOutcomeView[][] = [];
    host.attach(
      observerId,
      (s) => snapshots.push(s),
      undefined,
      (o) => outcomes.push(o),
    );
    return { snapshots, outcomes };
  }

  it('건 요청의 판정이 그 이어짐으로 돌아온다', () => {
    const host = createWorldHost({ npcs: [] });
    const a = attachWithOutcomes(host, A);
    host.advance(0);

    const setHp42: ActionRequest = { interactionId: 'set-attribute', attribute: { id: 'hp', value: 42 }, mark: 5 };
    host.receive(A, setHp42);
    host.advance(0);

    expect(a.outcomes).toEqual([[{ accepted: true, rule: 'RULE-ATTRIBUTE-SET-001', mark: 5 }]]);
  });

  it('대답은 관찰 결과보다 먼저 나간다 — 그래야 인과가 순서대로 읽힌다', () => {
    const host = createWorldHost({ npcs: [] });
    const order: string[] = [];
    host.attach(
      A,
      () => order.push('observation'),
      undefined,
      () => order.push('outcome'),
    );
    host.advance(0);
    order.length = 0;

    const setHp3: ActionRequest = { interactionId: 'set-attribute', attribute: { id: 'hp', value: 3 } };
    host.receive(A, setHp3);
    host.advance(0);

    expect(order).toEqual(['outcome', 'observation']);
  });

  it('남의 요청의 대답은 오지 않는다', () => {
    const host = createWorldHost({ npcs: [] });
    const a = attachWithOutcomes(host, A);
    const b = attachWithOutcomes(host, B);
    host.advance(0);

    const setHp8: ActionRequest = { interactionId: 'set-attribute', attribute: { id: 'hp', value: 8 } };
    host.receive(B, setHp8);
    host.advance(0);

    expect(b.outcomes).toHaveLength(1);
    expect(a.outcomes).toHaveLength(0);
  });

  it('아무 요청도 없던 Tick 에는 대답이 나가지 않는다', () => {
    const host = createWorldHost({ npcs: [] });
    const a = attachWithOutcomes(host, A);

    host.advance(0.1);
    host.advance(0.1);

    expect(a.snapshots.length).toBeGreaterThan(0);
    expect(a.outcomes).toHaveLength(0);
  });

  it('대답을 받을 자리를 두지 않아도 세계는 그대로 돈다', () => {
    const host = createWorldHost({ npcs: [] });
    const received: GameViewSnapshot[] = [];
    host.attach(A, (s) => received.push(s)); // onOutcomes 없음 — 예전과 같은 붙임
    host.advance(0);

    const setHp4: ActionRequest = { interactionId: 'set-attribute', attribute: { id: 'hp', value: 4 } };
    host.receive(A, setHp4);
    expect(() => host.advance(0)).not.toThrow();
    expect(received.length).toBeGreaterThan(0);
  });
});

describe('transport — 오가는 것의 형태', () => {
  it('관찰 결과 봉투를 주고받을 수 있다', () => {
    const host = createWorldHost({ npcs: [] });
    host.attach(A, () => {});
    const snapshot = host.advance(0.1).get(A);

    const wire = JSON.stringify({ type: 'observation', snapshot });
    const parsed = parseServerMessage(wire);
    expect(parsed?.type === 'observation' && parsed.snapshot).toEqual(snapshot);
  });

  it('대답 봉투를 주고받을 수 있다', () => {
    const outcomes: RequestOutcomeView[] = [
      { accepted: false, rule: 'RULE-ATTRIBUTE-SET-001', reason: 'debug-closed', mark: 3 },
    ];
    const wire = JSON.stringify({ type: 'outcome', outcomes });
    const parsed = parseServerMessage(wire);

    expect(parsed?.type).toBe('outcome');
    expect(parsed?.type === 'outcome' && parsed.outcomes).toEqual(outcomes);
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

  it('표식 봉투를 주고받을 수 있다', () => {
    const message = parseClientMessage(JSON.stringify({ type: 'mark', mark: 9 }));
    expect(message?.type).toBe('mark');
    expect(message?.type === 'mark' && message.mark).toBe(9);
  });

  it('알 수 없는 것은 무시된다 — 세계를 흔들 수 없다', () => {
    expect(parseClientMessage('그냥 문자열')).toBeNull();
    expect(parseClientMessage('{"type":"action"}')).toBeNull();
    expect(parseClientMessage('{"type":"join"}')).toBeNull();
    expect(parseClientMessage('{"type":"mark"}')).toBeNull();
    expect(parseClientMessage('{"type":"mark","mark":"곧"}')).toBeNull();
    expect(parseClientMessage('{"type":"shutdown"}')).toBeNull();
    expect(parseServerMessage('{"type":"observation"}')).toBeNull();
  });
});
