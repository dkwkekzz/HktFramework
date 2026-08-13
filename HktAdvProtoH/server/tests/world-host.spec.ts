// World Host 단독 테스트 — 소켓 없이 "세계가 밖에서 돈다"를 검증한다 (C003).

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { parseClientMessage, parseServerMessage } from '../../protocol/transport';
import { createWorldHost } from '../world-host';

const worldTime = (v: GameViewSnapshot) => v.hud.find((h) => h.id === 'world.time')?.value as number;

describe('WorldHost — 관찰자 붙었다 떨어지기', () => {
  it('붙는 즉시 현재 세계를 한 번 받는다', () => {
    const host = createWorldHost({ npcs: [] });
    const received: GameViewSnapshot[] = [];

    host.attach((s) => received.push(s));

    expect(received).toHaveLength(1);
    expect(received[0]?.entities.some((e) => e.id === 'player')).toBe(true);
  });

  it('Tick 마다 붙어 있는 관찰자 모두에게 관찰 결과가 간다', () => {
    const host = createWorldHost({ npcs: [] });
    const a: GameViewSnapshot[] = [];
    const b: GameViewSnapshot[] = [];
    host.attach((s) => a.push(s));
    host.attach((s) => b.push(s));

    host.advance(0.1);
    host.advance(0.1);

    expect(a).toHaveLength(3); // 붙을 때 1 + Tick 2
    expect(b).toHaveLength(3);
    expect(worldTime(a[2]!)).toBeCloseTo(0.2);
  });

  it('관찰자가 떨어져도 세계는 계속 진행한다', () => {
    const host = createWorldHost({ npcs: [] });
    const detach = host.attach(() => {});
    host.advance(0.5);

    detach();
    expect(host.observerCount()).toBe(0);
    host.advance(0.5);
    host.advance(0.5);

    // 아무도 보고 있지 않은 동안에도 시간은 흘렀다
    const later: GameViewSnapshot[] = [];
    host.attach((s) => later.push(s));
    expect(worldTime(later[0]!)).toBeCloseTo(1.5);
  });

  it('관찰자가 보낸 요청은 다음 Tick 에 판정된다', () => {
    const host = createWorldHost({ npcs: [], actorPosition: { x: 8, z: -5 } });
    const seen: GameViewSnapshot[] = [];
    host.attach((s) => seen.push(s));

    host.receive({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    expect(seen[seen.length - 1]?.entities.find((e) => e.id === 'player')?.state).toBe('idle');

    host.advance(0);
    expect(seen[seen.length - 1]?.entities.find((e) => e.id === 'player')?.state).toBe('mine');
  });
});

describe('WorldHost — 자기 시계', () => {
  it('시계를 붙이면 관찰자 없이도 스스로 진행한다', async () => {
    const host = createWorldHost({ npcs: [] });
    host.startClock();

    await new Promise((resolve) => setTimeout(resolve, 200));
    const seen: GameViewSnapshot[] = [];
    host.attach((s) => seen.push(s));
    host.stop();

    expect(worldTime(seen[0]!)).toBeGreaterThan(0.1); // 실제 시간이 흘렀다
  });
});

describe('transport — 오가는 것의 형태', () => {
  it('관찰 결과 봉투를 주고받을 수 있다', () => {
    const host = createWorldHost({ npcs: [] });
    const snapshot = host.advance(0.1);

    const wire = JSON.stringify({ type: 'observation', snapshot });
    expect(parseServerMessage(wire)?.snapshot).toEqual(snapshot);
  });

  it('요청 봉투를 주고받을 수 있다', () => {
    const wire = JSON.stringify({
      type: 'action',
      action: { interactionId: 'mine', targetEntityId: 'deposit-1' },
    });
    expect(parseClientMessage(wire)?.action.interactionId).toBe('mine');
  });

  it('알 수 없는 것은 무시된다 — 세계를 흔들 수 없다', () => {
    expect(parseClientMessage('그냥 문자열')).toBeNull();
    expect(parseClientMessage('{"type":"action"}')).toBeNull();
    expect(parseClientMessage('{"type":"shutdown"}')).toBeNull();
    expect(parseServerMessage('{"type":"observation"}')).toBeNull();
  });
});
