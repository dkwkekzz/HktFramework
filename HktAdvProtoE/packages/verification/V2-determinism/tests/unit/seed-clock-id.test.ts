import { describe, expect, it } from 'vitest';
import { deriveChildSeed, deriveSeed, seedLabel } from '../../src/seed.js';
import { TickClock } from '../../src/clock.js';
import { IdFactory } from '../../src/id.js';

describe('deriveSeed — 원문 29장의 조합 규칙', () => {
  const base = {
    worldSeed: 100n,
    tick: 5,
    subjectId: 'npc_1',
    decisionCounter: 2,
    situationId: 'sit_1',
  };

  it('같은 구성은 같은 시드', () => {
    expect(deriveSeed(base)).toBe(deriveSeed({ ...base }));
  });

  it.each([
    ['worldSeed', { ...base, worldSeed: 101n }],
    ['tick', { ...base, tick: 6 }],
    ['subjectId', { ...base, subjectId: 'npc_2' }],
    ['decisionCounter', { ...base, decisionCounter: 3 }],
    ['situationId', { ...base, situationId: 'sit_2' }],
  ])('%s 를 바꾸면 시드가 달라진다', (_label, changed) => {
    expect(deriveSeed(changed)).not.toBe(deriveSeed(base));
  });

  it('빠진 항목과 빈 문자열을 구분한다', () => {
    expect(deriveSeed({ worldSeed: 1n })).not.toBe(deriveSeed({ worldSeed: 1n, subjectId: '' }));
    expect(deriveSeed({ worldSeed: 1n })).not.toBe(deriveSeed({ worldSeed: 1n, tick: 0 }));
  });

  it('구성요소가 뒤섞여도 자리로 구분한다', () => {
    expect(deriveSeed({ worldSeed: 1n, subjectId: 'a', situationId: 'b' })).not.toBe(
      deriveSeed({ worldSeed: 1n, subjectId: 'b', situationId: 'a' }),
    );
  });

  it('64비트 범위 안이다', () => {
    for (let tick = 0; tick < 200; tick += 1) {
      const seed = deriveSeed({ worldSeed: 1n, tick });
      expect(seed).toBeGreaterThanOrEqual(0n);
      expect(seed).toBeLessThan(1n << 64n);
    }
  });

  it('표기는 다섯 구성요소를 순서대로 담는다', () => {
    expect(seedLabel(base)).toBe('["100",5,"npc_1",2,"sit_1"]');
    expect(seedLabel({ worldSeed: 1n })).toBe('["1",null,null,null,null]');
  });

  it('하위 시드는 이름표로 갈라지고 되풀이 가능하다', () => {
    expect(deriveChildSeed(5n, 'a')).toBe(deriveChildSeed(5n, 'a'));
    expect(deriveChildSeed(5n, 'a')).not.toBe(deriveChildSeed(5n, 'b'));
    expect(deriveChildSeed(5n, 'a')).not.toBe(deriveChildSeed(6n, 'a'));
  });
});

describe('TickClock', () => {
  it('시각은 틱에서 계산한다', () => {
    const clock = new TickClock({ msPerTick: 50 });
    expect(clock.tick).toBe(0);
    expect(clock.timeMs).toBe(0);
    clock.advance(4);
    expect(clock.tick).toBe(4);
    expect(clock.timeMs).toBe(200);
    expect(clock.timeAt(10)).toBe(500);
  });

  it('기본 주기는 10Hz (원문 30장의 전투·능력 규칙 주기)', () => {
    expect(new TickClock().msPerTick).toBe(100);
  });

  it('시작 틱을 정할 수 있다', () => {
    const clock = new TickClock({ startTick: 7, msPerTick: 10 });
    expect(clock.tick).toBe(7);
    expect(clock.timeMs).toBe(70);
  });

  it.each([-1, 0, 1.5])('advance(%p) 는 거부한다', (ticks) => {
    expect(() => new TickClock().advance(ticks)).toThrow(RangeError);
  });

  it.each([
    [{ startTick: -1 }],
    [{ startTick: 1.5 }],
    [{ msPerTick: 0 }],
    [{ msPerTick: -10 }],
  ])('잘못된 설정은 거부한다 (%o)', (options) => {
    expect(() => new TickClock(options)).toThrow(RangeError);
  });

  it('timeline 은 앞으로만 간다', () => {
    const clock = new TickClock({ startTick: 2, msPerTick: 100 });
    expect(clock.timeline(3)).toEqual([
      { tick: 2, timeMs: 200 },
      { tick: 3, timeMs: 300 },
      { tick: 4, timeMs: 400 },
    ]);
    // timeline 은 시계를 진행시키지 않는다
    expect(clock.tick).toBe(2);
  });

  it('복원하면 같은 시각이 나온다', () => {
    const clock = new TickClock({ startTick: 1, msPerTick: 25 });
    clock.advance(9);
    const restored = TickClock.restore(clock.snapshot());
    expect(restored.tick).toBe(clock.tick);
    expect(restored.timeMs).toBe(clock.timeMs);
    expect(restored.msPerTick).toBe(25);
  });
});

describe('IdFactory', () => {
  it('같은 시드는 같은 id 열을 낸다', () => {
    const a = new IdFactory(1n);
    const b = new IdFactory(1n);
    expect(Array.from({ length: 20 }, () => a.next('event'))).toEqual(
      Array.from({ length: 20 }, () => b.next('event')),
    );
  });

  it('시드가 다르면 id 가 다르다', () => {
    expect(new IdFactory(1n).next('event')).not.toBe(new IdFactory(2n).next('event'));
  });

  it('한 실행 안에서 유일하다', () => {
    const factory = new IdFactory(3n);
    const ids = Array.from({ length: 20000 }, () => factory.next('event'));
    expect(new Set(ids).size).toBe(20000);
  });

  it('종류별로 순번을 세므로 새 종류가 기존 열을 밀지 않는다', () => {
    const a = new IdFactory(4n);
    const first = [a.next('event'), a.next('event')];

    const b = new IdFactory(4n);
    b.next('entity'); // 사이에 다른 종류를 끼워 넣는다
    const second = [b.next('event'), b.next('event')];

    expect(second).toEqual(first);
  });

  it('발급 형태는 <종류>_<해시>', () => {
    expect(new IdFactory(5n).next('world_event')).toMatch(/^world_event_[0-9a-f]{12}$/);
  });

  it('digest 는 순번을 소비하지 않는다', () => {
    const factory = new IdFactory(6n);
    const peek = factory.digest('event', 0);
    expect(factory.next('event')).toBe(`event_${peek}`);
  });

  it.each(['Event', '1event', 'event-x', '', 'event x'])('잘못된 종류는 거부한다 (%s)', (kind) => {
    expect(() => new IdFactory(1n).next(kind)).toThrow(TypeError);
  });

  it('해시 길이를 벗어난 설정은 거부한다', () => {
    expect(() => new IdFactory(1n, { hexLength: 4 })).toThrow(RangeError);
    expect(() => new IdFactory(1n, { hexLength: 65 })).toThrow(RangeError);
  });

  it('복원하면 순번이 이어진다', () => {
    const factory = new IdFactory(7n);
    factory.next('event');
    factory.next('entity');
    factory.next('event');
    const restored = IdFactory.restore(factory.snapshot());
    expect(restored.next('event')).toBe(factory.next('event'));
    expect(restored.issued()).toEqual([
      { kind: 'entity', count: 1 },
      { kind: 'event', count: 3 },
    ]);
  });
});
