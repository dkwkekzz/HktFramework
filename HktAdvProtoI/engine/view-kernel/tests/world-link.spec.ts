// World Link 단독 테스트 — 소켓 없이 이어짐 상태를 검증한다 (C003 · C004).
// Implements INTENT-OBSERVER-LINK-001 · INTENT-OBSERVER-IDENTITY-001

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol-core/gameview';
import {
  createWorldLink,
  MARK_INTERVAL_MS,
  OBSERVATION_TIMEOUT_MS,
  type LinkHandlers,
  type LinkSocket,
} from '../net/world-link';

const OBSERVER = 'observer-a';

const snapshot = (time: number, acknowledged = 0): GameViewSnapshot => ({
  specId: 'VIEW-LINK-TELEMETRY-001',
  scene: 'mining-field',
  observer: { id: OBSERVER, characterId: 'player-1', acknowledgedMark: acknowledged },
  entities: [
    { id: 'player-1', role: 'player-character', state: 'idle', position: { x: time, z: 0 } },
  ],
  interactions: [],
  hud: [{ id: 'world.time', kind: 'counter', value: time }],
  debug: { open: false }, commands: [],
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
    push: (time: number, acknowledged = 0) =>
      live?.onMessage(
        JSON.stringify({ type: 'observation', snapshot: snapshot(time, acknowledged) }),
      ),
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

    // sent[0] 은 자기를 밝히는 것이고(C004), 요청 뒤에는 표식이 따라붙는다(C005)
    expect(link.send({ interactionId: 'mine' })).toBe(true);
    expect(JSON.parse(w.sent[1]!)).toEqual({
      type: 'action',
      action: { interactionId: 'mine' },
    });
    expect(JSON.parse(w.sent[2]!).type).toBe('mark');

    const before = w.sent.length;
    w.drop();
    expect(link.send({ interactionId: 'mine' })).toBe(false);
    expect(w.sent).toHaveLength(before); // 늘지 않았다 — 표식도 나가지 않는다
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

describe('C005 — 표식을 붙여 보내고 왕복을 잰다', () => {
  it('조용해도 일정 간격으로 표식이 나간다 (게임 요청 없이도 잴 수 있다)', () => {
    const w = fakeWorld();
    let clock = 1000;
    const link = createWorldLink(w.factory, OBSERVER, w.schedule, () => clock);
    w.open();
    const afterJoin = w.sent.length;

    clock += MARK_INTERVAL_MS;
    link.poll(clock);

    expect(w.sent).toHaveLength(afterJoin + 1);
    expect(JSON.parse(w.sent[afterJoin]!)).toEqual({ type: 'mark', mark: 1 });
  });

  it('표식은 뒤로 가지 않는다 — 보낼수록 커진다', () => {
    const w = fakeWorld();
    let clock = 1000;
    const link = createWorldLink(w.factory, OBSERVER, w.schedule, () => clock);
    w.open();

    const marks: number[] = [];
    for (let i = 0; i < 3; i++) {
      clock += MARK_INTERVAL_MS;
      link.poll(clock);
    }
    for (const raw of w.sent) {
      const m = JSON.parse(raw);
      if (m.type === 'mark') marks.push(m.mark);
    }

    expect(marks).toEqual([1, 2, 3]);
  });

  it('받아들여진 표식이 돌아오면 왕복 시간이 잡힌다', () => {
    const w = fakeWorld();
    let clock = 1000;
    const link = createWorldLink(w.factory, OBSERVER, w.schedule, () => clock);
    w.open();

    clock += MARK_INTERVAL_MS;
    link.poll(clock); // mark 1 을 이 시각에 보냈다

    clock += 70;
    w.push(1, 1); // 세계가 1 까지 받아들인 관찰 결과

    expect(link.telemetry(clock).roundTripMs).toBe(70);
  });

  it('아직 받아들여지지 않았으면 왕복은 비어 있다', () => {
    const w = fakeWorld();
    let clock = 1000;
    const link = createWorldLink(w.factory, OBSERVER, w.schedule, () => clock);
    w.open();
    clock += MARK_INTERVAL_MS;
    link.poll(clock);

    clock += 50;
    w.push(1, 0); // 세계는 아직 아무 표식도 받지 않았다

    expect(link.telemetry(clock).roundTripMs).toBeNull();
  });

  it('다시 이은 횟수가 세어진다 — 처음 붙는 것은 세지 않는다', () => {
    const w = fakeWorld();
    const link = createWorldLink(w.factory, OBSERVER, w.schedule);
    w.open();
    expect(link.telemetry(0).reconnectCount).toBe(0);

    w.drop();
    w.runScheduled();
    w.open();

    expect(link.telemetry(0).reconnectCount).toBe(1);
  });

  it('끊긴 동안에는 표식도 나가지 않는다', () => {
    const w = fakeWorld();
    let clock = 1000;
    const link = createWorldLink(w.factory, OBSERVER, w.schedule, () => clock);
    w.open();
    w.drop();
    const before = w.sent.length;

    clock += MARK_INTERVAL_MS * 4;
    link.poll(clock);

    expect(w.sent).toHaveLength(before);
  });

  it('붙어 있는 세계의 주소를 알려준다', () => {
    const w = fakeWorld();
    const link = createWorldLink(
      w.factory,
      OBSERVER,
      w.schedule,
      () => 0,
      'ws://127.0.0.1:5180/world',
    );

    expect(link.address()).toBe('ws://127.0.0.1:5180/world');
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
