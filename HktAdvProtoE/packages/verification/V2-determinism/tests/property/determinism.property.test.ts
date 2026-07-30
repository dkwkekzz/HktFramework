import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/rng.js';
import { IdFactory } from '../../src/id.js';
import { TickClock } from '../../src/clock.js';
import { deriveSeed } from '../../src/seed.js';
import { executeV2, validateOutput } from '../../src/module.js';

/** 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다. */
const RUN = { seed: 20260730, numRuns: 1000 } as const;

const seedArb = fc.bigInt({ min: 0n, max: (1n << 64n) - 1n });
const componentsArb = fc.record(
  {
    worldSeed: seedArb,
    tick: fc.nat({ max: 100_000 }),
    subjectId: fc.string({ maxLength: 12 }),
    decisionCounter: fc.nat({ max: 1000 }),
    situationId: fc.string({ maxLength: 12 }),
  },
  { requiredKeys: ['worldSeed'] },
);

describe('속성: 난수열', () => {
  it('같은 시드는 언제나 같은 열을 낸다', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 50 }), (seed, draws) => {
        const a = new Rng(seed);
        const b = new Rng(seed);
        for (let draw = 0; draw < draws; draw += 1) expect(b.nextU64()).toBe(a.nextU64());
      }),
      RUN,
    );
  });

  it('nextFloat 는 항상 [0,1)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const rng = new Rng(seed);
        for (let draw = 0; draw < 20; draw += 1) {
          const value = rng.nextFloat();
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
        }
      }),
      RUN,
    );
  });

  it('nextInt 는 항상 요청 범위 안', () => {
    fc.assert(
      fc.property(
        seedArb,
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: 1, max: 500 }),
        (seed, min, span) => {
          const rng = new Rng(seed);
          for (let draw = 0; draw < 10; draw += 1) {
            const value = rng.nextInt(min, min + span);
            expect(value).toBeGreaterThanOrEqual(min);
            expect(value).toBeLessThan(min + span);
          }
        },
      ),
      RUN,
    );
  });

  it('shuffle 은 원소를 잃거나 더하지 않고 입력을 바꾸지 않는다', () => {
    fc.assert(
      fc.property(seedArb, fc.array(fc.integer(), { maxLength: 30 }), (seed, items) => {
        const snapshot = [...items];
        const shuffled = new Rng(seed).shuffle(items);
        expect(items).toEqual(snapshot);
        expect([...shuffled].sort((a, b) => a - b)).toEqual([...snapshot].sort((a, b) => a - b));
      }),
      RUN,
    );
  });

  it('스냅샷 복원은 정확히 이어진다', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 30 }), (seed, consumed) => {
        const rng = new Rng(seed);
        for (let draw = 0; draw < consumed; draw += 1) rng.nextU64();
        const snapshot = rng.snapshot();
        const expected = [rng.nextU64(), rng.nextU64(), rng.nextU64()];
        const restored = Rng.restore(snapshot);
        expect([restored.nextU64(), restored.nextU64(), restored.nextU64()]).toEqual(expected);
      }),
      RUN,
    );
  });

  it('하위 스트림은 부모의 소비량과 무관하다', () => {
    fc.assert(
      fc.property(
        seedArb,
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.nat({ max: 50 }),
        (seed, label, consumed) => {
          const parent = new Rng(seed);
          const before = parent.fork(label).nextU64();
          for (let draw = 0; draw < consumed; draw += 1) parent.nextU64();
          expect(parent.fork(label).nextU64()).toBe(before);
        },
      ),
      RUN,
    );
  });
});

describe('속성: 시드 파생', () => {
  it('같은 구성은 같은 시드, 다른 worldSeed 는 다른 시드', () => {
    fc.assert(
      fc.property(componentsArb, (components) => {
        expect(deriveSeed({ ...components })).toBe(deriveSeed({ ...components }));
        expect(deriveSeed({ ...components, worldSeed: components.worldSeed + 1n })).not.toBe(
          deriveSeed(components),
        );
      }),
      RUN,
    );
  });

  it('시드는 64비트 범위 안이다', () => {
    fc.assert(
      fc.property(componentsArb, (components) => {
        const seed = deriveSeed(components);
        expect(seed).toBeGreaterThanOrEqual(0n);
        expect(seed).toBeLessThan(1n << 64n);
      }),
      RUN,
    );
  });

  it('주체가 다르면 같은 틱에서도 다른 시드를 받는다', () => {
    fc.assert(
      fc.property(
        seedArb,
        fc.nat({ max: 1000 }),
        fc.tuple(fc.string({ maxLength: 8 }), fc.string({ maxLength: 8 })).filter(([a, b]) => a !== b),
        (worldSeed, tick, [subjectA, subjectB]) => {
          expect(deriveSeed({ worldSeed, tick, subjectId: subjectA })).not.toBe(
            deriveSeed({ worldSeed, tick, subjectId: subjectB }),
          );
        },
      ),
      RUN,
    );
  });
});

describe('속성: ID', () => {
  it('같은 시드에서 발급한 id 열은 재실행에서 같고 서로 유일하다', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 30 }), (seed, count) => {
        const a = new IdFactory(seed);
        const b = new IdFactory(seed);
        const idsA = Array.from({ length: count }, () => a.next('event'));
        const idsB = Array.from({ length: count }, () => b.next('event'));
        expect(idsB).toEqual(idsA);
        expect(new Set(idsA).size).toBe(count);
      }),
      RUN,
    );
  });

  it('종류가 다르면 같은 순번이어도 다른 id 다', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const factory = new IdFactory(seed);
        expect(factory.digest('event', 0)).not.toBe(factory.digest('entity', 0));
      }),
      RUN,
    );
  });
});

describe('속성: 시계', () => {
  it('진행은 단조 증가하고 시각은 틱에 비례한다', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 50 }),
        (startTick, msPerTick, steps) => {
          const clock = new TickClock({ startTick, msPerTick });
          let previous = clock.timeMs;
          for (let step = 0; step < steps; step += 1) {
            clock.advance(1);
            expect(clock.timeMs).toBe(previous + msPerTick);
            previous = clock.timeMs;
          }
          expect(clock.tick).toBe(startTick + steps);
        },
      ),
      RUN,
    );
  });
});

describe('속성: 모듈 출력', () => {
  it('어떤 입력에서도 불변조건을 지키고 재실행에서 같은 digest 를 낸다', () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            worldSeed: seedArb.map((seed) => seed.toString()),
            draws: fc.integer({ min: 0, max: 20 }),
            ticks: fc.integer({ min: 0, max: 10 }),
            idKinds: fc.array(fc.constantFrom('event', 'entity', 'ability'), { maxLength: 5 }),
            forks: fc.array(fc.string({ minLength: 1, maxLength: 6 }), { maxLength: 3 }),
          },
          { requiredKeys: ['worldSeed', 'draws'] },
        ),
        (input) => {
          const output = executeV2(input);
          expect(validateOutput(output)).toEqual([]);
          expect(executeV2(input).digest).toBe(output.digest);
        },
      ),
      RUN,
    );
  });
});
