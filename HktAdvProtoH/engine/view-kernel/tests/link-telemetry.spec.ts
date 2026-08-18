// Link Telemetry 단독 테스트 (C005) — 소켓도 브라우저도 없이 검증한다.
// Implements INTENT-LINK-ROUNDTRIP-001 · INTENT-LINK-FLOW-001 · INTENT-LINK-EFFORT-001

import { describe, expect, it } from 'vitest';
import { ARRIVAL_WINDOW_MS, createLinkTelemetry } from '../net/link-telemetry';
import { bindingLines, telemetryLines } from '../presentation/link-presentation';

describe('INTENT-LINK-ROUNDTRIP-001 — 표식이 돌아오는 데 걸린 시간', () => {
  it('아직 돌아온 표식이 없으면 잴 것이 없다', () => {
    const t = createLinkTelemetry();
    expect(t.read(1000).roundTripMs).toBeNull();
  });

  it('보낸 표식이 받아들여져 돌아오면 그 시간이 잰 값이다', () => {
    const t = createLinkTelemetry();
    t.recordMarkSent(1, 1000);
    t.recordObservation(1, 1080);

    expect(t.read(1100).roundTripMs).toBe(80);
  });

  it('아직 받아들여지지 않은 표식은 왕복을 닫지 않는다', () => {
    const t = createLinkTelemetry();
    t.recordMarkSent(5, 1000);
    t.recordObservation(4, 1050); // 세계는 아직 4 까지만 받았다

    expect(t.read(1100).roundTripMs).toBeNull();
  });

  it('여러 표식이 한 번에 답해지면 가장 나중 것으로 닫는다', () => {
    const t = createLinkTelemetry();
    t.recordMarkSent(1, 1000);
    t.recordMarkSent(2, 1020);
    t.recordMarkSent(3, 1040);
    t.recordObservation(3, 1100);

    expect(t.read(1100).roundTripMs).toBe(60); // 3 을 보낸 1040 기준
  });

  it('나중에 온 관찰 결과가 다음 표식을 닫으면 값이 갱신된다', () => {
    const t = createLinkTelemetry();
    t.recordMarkSent(1, 1000);
    t.recordObservation(1, 1100);
    expect(t.read(1100).roundTripMs).toBe(100);

    t.recordMarkSent(2, 1200);
    t.recordObservation(2, 1230);
    expect(t.read(1230).roundTripMs).toBe(30);
  });
});

describe('INTENT-LINK-FLOW-001 — 오는 것이 제때 오는가', () => {
  it('도착이 없으면 도착률은 0 이다', () => {
    const t = createLinkTelemetry();
    expect(t.read(1000).arrivalRatePerSecond).toBe(0);
    expect(t.read(1000).sinceLastObservationMs).toBeNull();
  });

  it('창 안의 도착 수로 초당 건수를 낸다', () => {
    const t = createLinkTelemetry();
    // 2초 창에 40건 → 20/s
    for (let i = 0; i < 40; i++) t.recordObservation(0, 1000 + i * 50);

    expect(t.read(1000 + 39 * 50).arrivalRatePerSecond).toBeCloseTo(20, 1);
  });

  it('끊겨서 아무것도 오지 않으면 도착률이 0 으로 내려간다', () => {
    const t = createLinkTelemetry();
    for (let i = 0; i < 20; i++) t.recordObservation(0, 1000 + i * 50);
    expect(t.read(2000).arrivalRatePerSecond).toBeGreaterThan(0);

    // 창을 넘겨 아무것도 오지 않은 뒤
    expect(t.read(2000 + ARRIVAL_WINDOW_MS + 1).arrivalRatePerSecond).toBe(0);
  });

  it('마지막 도착 이후 흐른 시간이 계속 는다', () => {
    const t = createLinkTelemetry();
    t.recordObservation(0, 1000);

    expect(t.read(1000).sinceLastObservationMs).toBe(0);
    expect(t.read(1500).sinceLastObservationMs).toBe(500);
    expect(t.read(5000).sinceLastObservationMs).toBe(4000);
  });
});

describe('INTENT-LINK-EFFORT-001 — 내가 보낸 양과 다시 이은 횟수', () => {
  it('보낸 것이 세어진다', () => {
    const t = createLinkTelemetry();
    t.recordSent();
    t.recordSent();
    t.recordSent();

    expect(t.read(0).sentCount).toBe(3);
  });

  it('다시 이은 것이 세어진다', () => {
    const t = createLinkTelemetry();
    expect(t.read(0).reconnectCount).toBe(0);

    t.recordReconnect();
    t.recordReconnect();
    expect(t.read(0).reconnectCount).toBe(2);
  });
});

describe('Link Presentation — 수치를 어떻게 보여줄지', () => {
  const base = {
    roundTripMs: null as number | null,
    arrivalRatePerSecond: 0,
    sinceLastObservationMs: null as number | null,
    sentCount: 0,
    reconnectCount: 0,
  };

  it('아직 잰 것이 없으면 줄은 있고 값만 비어 있다 (언제나 보인다)', () => {
    const lines = telemetryLines(base);

    expect(lines.map((l) => l.id)).toEqual([
      'link.roundTrip',
      'link.arrivalRate',
      'link.sinceLast',
      'link.sent',
      'link.reconnects',
    ]);
    expect(lines.find((l) => l.id === 'link.roundTrip')?.value).toBe('—');
  });

  it('왕복이 빠르면 좋음, 느리면 나쁨으로 등급이 갈린다', () => {
    const good = telemetryLines({ ...base, roundTripMs: 40 });
    const warn = telemetryLines({ ...base, roundTripMs: 200 });
    const bad = telemetryLines({ ...base, roundTripMs: 900 });

    expect(good.find((l) => l.id === 'link.roundTrip')).toMatchObject({
      value: '40ms',
      grade: 'good',
    });
    expect(warn.find((l) => l.id === 'link.roundTrip')?.grade).toBe('warn');
    expect(bad.find((l) => l.id === 'link.roundTrip')?.grade).toBe('bad');
  });

  it('도착률이 낮으면 나쁨으로 표시된다', () => {
    expect(
      telemetryLines({ ...base, arrivalRatePerSecond: 30 }).find((l) => l.id === 'link.arrivalRate'),
    ).toMatchObject({ value: '30.0/s', grade: 'good' });
    expect(
      telemetryLines({ ...base, arrivalRatePerSecond: 2 }).find((l) => l.id === 'link.arrivalRate')
        ?.grade,
    ).toBe('bad');
  });

  it('다시 이은 적이 있으면 눈에 띈다', () => {
    expect(telemetryLines(base).find((l) => l.id === 'link.reconnects')?.grade).toBeUndefined();
    expect(
      telemetryLines({ ...base, reconnectCount: 1 }).find((l) => l.id === 'link.reconnects')?.grade,
    ).toBe('warn');
  });

  it('무엇에 이어져 있는지가 세 줄로 표시된다', () => {
    const lines = bindingLines({
      observerId: 'observer-abc',
      characterId: 'player-2',
      worldAddress: 'ws://127.0.0.1:5180/world',
    });

    expect(lines.map((l) => l.value)).toEqual([
      'observer-abc',
      'player-2',
      'ws://127.0.0.1:5180/world',
    ]);
  });
});
