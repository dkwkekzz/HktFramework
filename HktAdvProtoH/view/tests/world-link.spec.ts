// World Link 단독 테스트 — 소켓 없이 이어짐 상태를 검증한다 (C003 · C004).
// Implements INTENT-OBSERVER-LINK-001 · INTENT-OBSERVER-IDENTITY-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  createWorldLink,
  OBSERVATION_TIMEOUT_MS,
  type LinkHandlers,
  type LinkSocket,
} from '../net/world-link';

const OBSERVER = 'observer-a';

const snapshot = (time: number): GameViewSnapshot => ({
  specId: 'VIEW-MULTI-OBSERVER-001',
  scene: 'mining-field',
  observer: { id: OBSERVER, characterId: 'player-1' },
  entities: [
    { id: 'player-1', role: 'player-character', state: 'idle', position: { x: time, z: 0 } },
  ],
  interactions: [],
  hud: [{ id: 'world.time', kind: 'counter', value: time }],
});

// 세계 대신 손으로 미는 가짜 소켓
function fakeWorld() {
  const sent: string[] = [];
  const pending: Array<() => void> = [];
  let live: LinkHandlers | null = null;
  let opened = 0;

  const factory = (handlers: LinkHandlers): LinkSocket => {
    live = handlers;
    opened += 1;
    return {
      send: (data) => sent.push(data),
      close: () => handlers.onClose(),
    };
  };

  return {
    factory,
    schedule: (fn: () => void) => pending.push(fn),
    runScheduled: () => pending.splice(0).forEach((fn) => fn()),
    open: () => live?.onOpen(),
    push: (time: number) => live?.onMessage(JSON.stringify({ type: 'observation', snapshot: snapshot(time) })),
    drop: () => live?.onClose(),
    sent,
    opened: () => opened,
  };
}

describe('INTENT-OBSERVER-LINK-001 — 이어짐 상태', () => {
  it('처음에는 잇는 중이고, 열리면 이어짐이 된다', () => {
    const w = fakeWorld();
    const link = createWorldLink(w.factory, OBSERVER, w.schedule);

    expect(link.state()).toBe('connecting');
    expect(link.latest()).toBeNull();

    w.open();
    expect(link.state()).toBe('connected');
  });

  it('받은 관찰 결과가 화면의 원천이 되고, 늦게 온 것이 앞선 것을 대체한다', () => {
    const w = fakeWorld();
    const link = createWorldLink(w.factory, OBSERVER, w.schedule);
    w.open();

    w.push(1);
    expect(link.latest()?.hud[0]?.value).toBe(1);
    w.push(2);
    expect(link.latest()?.hud[0]?.value).toBe(2);
  });

  it('끊기면 마지막으로 받은 세계를 계속 보되 stale 로 표시된다', () => {
    const w = fakeWorld();
    const link = createWorldLink(w.factory, OBSERVER, w.schedule);
    w.open();
    w.push(7);

    expect(link.stale()).toBe(false);
    w.drop();

    expect(link.state()).toBe('disconnected');
    expect(link.latest()?.hud[0]?.value).toBe(7); // 마지막 세계는 남는다
    expect(link.stale()).toBe(true);
  });

  it('끊긴 동안에는 요청을 보낼 수 없다', () => {
    const w = fakeWorld();
    const link = createWorldLink(w.factory, OBSERVER, w.schedule);
    w.open();

    // sent[0] 은 자기를 밝히는 것이다 (C004) — 요청은 그 뒤에 온다
    expect(link.send({ interactionId: 'mine' })).toBe(true);
    expect(w.sent).toHaveLength(2);
    expect(JSON.parse(w.sent[1]!)).toEqual({
      type: 'action',
      action: { interactionId: 'mine' },
    });

    w.drop();
    expect(link.send({ interactionId: 'mine' })).toBe(false);
    expect(w.sent).toHaveLength(2); // 늘지 않았다
  });

  it('끊기면 스스로 다시 잇고, 이어지면 최신 세계로 돌아온다', () => {
    const w = fakeWorld();
    const link = createWorldLink(w.factory, OBSERVER, w.schedule);
    w.open();
    w.push(3);
    w.drop();

    expect(w.opened()).toBe(1);
    w.runScheduled(); // 재시도 시각이 되었다
    expect(w.opened()).toBe(2);
    expect(link.state()).toBe('connecting');

    w.open();
    w.push(50); // 그동안 세계는 계속 돌고 있었다
    expect(link.state()).toBe('connected');
    expect(link.stale()).toBe(false);
    expect(link.latest()?.hud[0]?.value).toBe(50);
  });

  it('망가진 메시지는 무시된다 — 화면이 깨지지 않는다', () => {
    const w = fakeWorld();
    const link = createWorldLink(w.factory, OBSERVER, w.schedule);
    w.open();
    w.push(4);

    // 세계가 아닌 무언가가 흘러들어와도 마지막 세계는 그대로다
    createWorldLink(w.factory, OBSERVER, w.schedule);
    expect(link.latest()?.hud[0]?.value).toBe(4);
  });

  it('닫으면 다시 잇지 않는다', () => {
    const w = fakeWorld();
    const link = createWorldLink(w.factory, OBSERVER, w.schedule);
    w.open();

    link.close();
    w.runScheduled();

    expect(link.state()).toBe('disconnected');
    expect(w.opened()).toBe(1);
  });
});

describe('INTENT-OBSERVER-IDENTITY-001 — 이어질 때마다 같은 나를 밝힌다', () => {
  it('이어짐이 열리면 가장 먼저 자신을 밝힌다', () => {
    const w = fakeWorld();
    createWorldLink(w.factory, OBSERVER, w.schedule);

    expect(w.sent).toHaveLength(0); // 아직 열리지 않았다
    w.open();

    expect(JSON.parse(w.sent[0]!)).toEqual({ type: 'join', observerId: OBSERVER });
  });

  it('다시 이을 때도 같은 것을 밝힌다 — 그래서 같은 몸으로 돌아온다', () => {
    const w = fakeWorld();
    createWorldLink(w.factory, OBSERVER, w.schedule);
    w.open();
    w.drop();

    w.runScheduled();
    w.open();

    expect(w.sent).toHaveLength(2);
    expect(JSON.parse(w.sent[1]!)).toEqual({ type: 'join', observerId: OBSERVER });
  });

  it('관찰 결과가 누구의 것인지 알 수 있다', () => {
    const w = fakeWorld();
    const link = createWorldLink(w.factory, OBSERVER, w.schedule);
    w.open();
    w.push(1);

    expect(link.latest()?.observer.id).toBe(OBSERVER);
    expect(link.latest()?.observer.characterId).toBe('player-1');
  });
});

describe('조용히 죽은 이어짐', () => {
  it('관찰 결과가 한동안 오지 않으면 끊긴 것으로 본다 (close 를 못 받아도)', () => {
    const w = fakeWorld();
    let clock = 1000;
    const link = createWorldLink(w.factory, OBSERVER, w.schedule, () => clock);
    w.open();
    w.push(5);

    clock += 500;
    link.poll(clock);
    expect(link.state()).toBe('connected'); // 아직은 정상

    clock += OBSERVATION_TIMEOUT_MS;
    link.poll(clock);

    expect(link.state()).toBe('disconnected');
    expect(link.stale()).toBe(true);
    expect(link.send({ interactionId: 'mine' })).toBe(false);

    // 그리고 스스로 다시 잇는다
    w.runScheduled();
    w.open();
    w.push(60);
    expect(link.state()).toBe('connected');
    expect(link.stale()).toBe(false);
  });
});
