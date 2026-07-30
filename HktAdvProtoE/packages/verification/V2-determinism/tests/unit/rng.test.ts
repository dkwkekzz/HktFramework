import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/rng.js';
import { deriveSeed } from '../../src/seed.js';

describe('Rng — 결정성', () => {
  it('같은 시드는 같은 열을 낸다', () => {
    const a = new Rng(42n);
    const b = new Rng(42n);
    const seqA = Array.from({ length: 100 }, () => a.nextU64().toString(16));
    const seqB = Array.from({ length: 100 }, () => b.nextU64().toString(16));
    expect(seqB).toEqual(seqA);
  });

  it('시드가 1 만 달라도 열이 갈라진다', () => {
    const a = Array.from({ length: 10 }, ((rng) => () => rng.nextFloat())(new Rng(42n)));
    const b = Array.from({ length: 10 }, ((rng) => () => rng.nextFloat())(new Rng(43n)));
    expect(b).not.toEqual(a);
  });

  it('SplitMix64 의 알려진 값과 일치한다 (구현 고정)', () => {
    // seed 0 에서의 SplitMix64 첫 세 출력
    const rng = new Rng(0n);
    expect([rng.nextU64(), rng.nextU64(), rng.nextU64()].map((value) => value.toString(16))).toEqual([
      'e220a8397b1dcdaf',
      '6e789e6aa1b965f4',
      '6c45d188009454f',
    ]);
  });

  it('100회 재실행에서 열 해시가 하나다', () => {
    const digests = new Set(
      Array.from({ length: 100 }, () => {
        const rng = new Rng(deriveSeed({ worldSeed: 7n, tick: 3 }));
        return Array.from({ length: 20 }, () => rng.nextFloat()).join(',');
      }),
    );
    expect(digests.size).toBe(1);
  });
});

describe('Rng — 값의 범위', () => {
  it('nextFloat 는 [0,1) 안에 있다', () => {
    const rng = new Rng(1n);
    for (let draw = 0; draw < 5000; draw += 1) {
      const value = rng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('nextInt 는 [min,max) 안에 있고 모든 값이 나온다', () => {
    const rng = new Rng(2n);
    const seen = new Set<number>();
    for (let draw = 0; draw < 2000; draw += 1) {
      const value = rng.nextInt(5, 10);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThan(10);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([5, 6, 7, 8, 9]);
  });

  it('nextInt 의 분포가 크게 치우치지 않는다', () => {
    const rng = new Rng(3n);
    const counts = new Array<number>(10).fill(0);
    const total = 20000;
    for (let draw = 0; draw < total; draw += 1) {
      const bucket = rng.nextInt(0, 10);
      counts[bucket] = (counts[bucket] as number) + 1;
    }
    for (const count of counts) {
      // 균등이면 2000. 거절 표집이 깨지면 한쪽으로 크게 쏠린다.
      expect(count).toBeGreaterThan(total / 10 - 250);
      expect(count).toBeLessThan(total / 10 + 250);
    }
  });

  it.each([
    [0, 0],
    [5, 5],
    [3, 1],
  ])('빈 범위는 거부한다 (%i, %i)', (min, max) => {
    expect(() => new Rng(1n).nextInt(min, max)).toThrow(RangeError);
  });

  it('정수가 아닌 범위는 거부한다', () => {
    expect(() => new Rng(1n).nextInt(0, 1.5)).toThrow(TypeError);
  });
});

describe('Rng — 선택·섞기', () => {
  it('pick 은 목록 안에서 고른다', () => {
    const rng = new Rng(4n);
    const items = ['a', 'b', 'c'];
    for (let draw = 0; draw < 100; draw += 1) expect(items).toContain(rng.pick(items));
  });

  it('빈 목록은 오류다 — undefined 를 돌려주지 않는다', () => {
    expect(() => new Rng(1n).pick([])).toThrow(RangeError);
    expect(() => new Rng(1n).weighted([])).toThrow(RangeError);
  });

  it('shuffle 은 입력을 바꾸지 않고 같은 원소를 담는다', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const snapshot = [...items];
    const shuffled = new Rng(5n).shuffle(items);
    expect(items).toEqual(snapshot);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(snapshot);
  });

  it('shuffle 은 같은 시드에서 같은 순열을 낸다', () => {
    const items = [1, 2, 3, 4, 5];
    expect(new Rng(6n).shuffle(items)).toEqual(new Rng(6n).shuffle(items));
  });

  it('weighted 는 가중치를 따른다', () => {
    const rng = new Rng(7n);
    const entries = [
      { value: 'rare', weight: 1 },
      { value: 'common', weight: 9 },
    ];
    let common = 0;
    const total = 10000;
    for (let draw = 0; draw < total; draw += 1) {
      if (rng.weighted(entries) === 'common') common += 1;
    }
    expect(common / total).toBeGreaterThan(0.87);
    expect(common / total).toBeLessThan(0.93);
  });

  it('가중치 0 은 절대 뽑히지 않는다', () => {
    const rng = new Rng(8n);
    const entries = [
      { value: 'never', weight: 0 },
      { value: 'always', weight: 1 },
    ];
    for (let draw = 0; draw < 500; draw += 1) expect(rng.weighted(entries)).toBe('always');
  });

  it('음수 가중치와 합 0 은 거부한다', () => {
    expect(() => new Rng(1n).weighted([{ value: 'a', weight: -1 }])).toThrow(RangeError);
    expect(() => new Rng(1n).weighted([{ value: 'a', weight: 0 }])).toThrow(RangeError);
  });
});

describe('Rng — fork', () => {
  it('이름표가 다르면 다른 스트림이다', () => {
    const parent = new Rng(9n);
    expect(parent.fork('a').seed).not.toBe(parent.fork('b').seed);
  });

  it('부모의 소비량이 하위 스트림을 바꾸지 않는다', () => {
    const parent = new Rng(10n);
    const before = parent.fork('perception').nextFloat();
    for (let draw = 0; draw < 100; draw += 1) parent.nextFloat();
    expect(parent.fork('perception').nextFloat()).toBe(before);
  });

  it('하위의 하위도 결정적이다', () => {
    const root = new Rng(11n);
    expect(root.fork('a').fork('b').seed).toBe(new Rng(11n).fork('a').fork('b').seed);
  });
});

describe('Rng — 스냅샷', () => {
  it('복원하면 정확히 이어진다', () => {
    const rng = new Rng(12n);
    for (let draw = 0; draw < 7; draw += 1) rng.nextFloat();
    const snapshot = rng.snapshot();
    const expected = Array.from({ length: 5 }, () => rng.nextFloat());
    expect(Array.from({ length: 5 }, () => Rng.restore(snapshot).nextFloat())[0]).toBe(expected[0]);

    const restored = Rng.restore(snapshot);
    expect(Array.from({ length: 5 }, () => restored.nextFloat())).toEqual(expected);
    expect(restored.snapshot().drawn).toBe(snapshot.drawn + 5);
  });

  it('스냅샷은 뽑은 횟수를 기록한다', () => {
    const rng = new Rng(13n);
    expect(rng.drawn).toBe(0);
    rng.nextU64();
    rng.nextFloat();
    expect(rng.snapshot().drawn).toBe(2);
  });
});
