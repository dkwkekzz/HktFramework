import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { StoreOperation } from '@hkt/k0-entity-state';
import { executeS1, validateOutput } from '../../src/index.js';
import type { NaturalSample, S1Input } from '../../src/index.js';
import { COMPONENT_DEFINITIONS, LAYOUT } from '../../scenarios/fixtures.js';

/** 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다. */
const RUN = { seed: 20260731, numRuns: 120 } as const;

/**
 * 무작위 초원 — 풀·초식·포식자의 수와 배고픔과 상처를 흔든다.
 *
 * 먹이가 하나도 없는 세계, 포식자만 있는 세계, 처음부터 굶주린 세계가 모두 나온다.
 * 그런 세계가 필요하다 — "먹이가 늘 있다"를 가정한 법칙집은 없는 날에 조용히 틀린다.
 */
const meadowArb = fc
  .record({
    grass: fc.integer({ min: 0, max: 12 }),
    deer: fc.integer({ min: 0, max: 6 }),
    wolf: fc.integer({ min: 0, max: 6 }),
    deerHunger: fc.integer({ min: 0, max: 12 }),
    wolfHunger: fc.integer({ min: 0, max: 12 }),
    deerWounds: fc.integer({ min: 0, max: 10 }),
    deerReach: fc.integer({ min: 0, max: 9 }),
    ticks: fc.integer({ min: 0, max: 14 }),
  })
  .map((world): S1Input => {
    const operations: StoreOperation[] = [
      {
        op: 'spawn',
        id: 'meadow_grass',
        kind: 'flora',
        tags: ['grass'],
        components: { position: { x: 2, y: 3, z: 0 }, population: { count: world.grass }, mass: { kg: 40 } },
      },
      {
        op: 'spawn',
        id: 'deer_herd',
        kind: 'beast',
        tags: ['herbivore'],
        components: {
          position: { x: 4, y: 3, z: 0 },
          population: { count: world.deer },
          hunger: { value: world.deerHunger },
          mass: { kg: 200 },
          temperature: { celsius: 38 },
          damage: { wounds: world.deerWounds },
          disease: { load: 0 },
          diet: { eats: ['grass'] },
          habitat: { radius: world.deerReach },
        },
      },
      {
        op: 'spawn',
        id: 'wolf_pack',
        kind: 'beast',
        tags: ['predator'],
        components: {
          position: { x: 7, y: 3, z: 0 },
          population: { count: world.wolf },
          hunger: { value: world.wolfHunger },
          mass: { kg: 90 },
          temperature: { celsius: 38.5 },
          damage: { wounds: 0 },
          disease: { load: 0 },
          diet: { eats: ['herbivore'] },
          habitat: { radius: 6 },
        },
      },
    ];
    return {
      world: { components: COMPONENT_DEFINITIONS, operations },
      layout: LAYOUT,
      worldSeed: '20260731',
      ticks: world.ticks,
    };
  });

const totalOf = (sample: NaturalSample): number =>
  Object.values(sample.population).reduce((sum, count) => sum + count, 0);

describe('속성: 자연 상태', () => {
  it('어떤 초원에서도 출력 불변조건이 깨지지 않는다', () => {
    fc.assert(
      fc.property(meadowArb, (input) => {
        expect(validateOutput(executeS1(input))).toEqual([]);
      }),
      RUN,
    );
  });

  it('모든 상태 변화에 원인 사건이 있다 (GI-01)', () => {
    fc.assert(
      fc.property(meadowArb, (input) => {
        const output = executeS1(input);
        expect(output.audit.everyChangeHasAnEvent).toBe(true);
        expect(output.audit.violations).toEqual([]);
        expect(output.audit.storeIssues).toEqual([]);
      }),
      RUN,
    );
  });

  it('일지를 원인부터 다시 굴려도 같은 사건이 나온다 (GI-12)', () => {
    fc.assert(
      fc.property(meadowArb, (input) => {
        const output = executeS1(input);
        expect(output.resimulatedLogHash).toBe(output.logHash);
        expect(executeS1(input).digest).toBe(output.digest);
      }),
      RUN,
    );
  });

  it('개체군도 허기도 질량도 선언된 하한 아래로 내려가지 않는다', () => {
    fc.assert(
      fc.property(meadowArb, (input) => {
        for (const sample of executeS1(input).series) {
          for (const reading of [sample.population, sample.hunger, sample.mass, sample.disease]) {
            for (const [id, value] of Object.entries(reading)) {
              expect(value, `${id} @ ${sample.tick}`).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }),
      RUN,
    );
  });

  it('먹이로 이어진 것은 반드시 남아 있는 것이다', () => {
    fc.assert(
      fc.property(meadowArb, (input) => {
        for (const sample of executeS1(input).series) {
          for (const link of sample.links) {
            expect(link.available).toBeGreaterThan(0);
            expect(link.consumer).not.toBe(link.prey);
          }
        }
      }),
      RUN,
    );
  });

  it('짧게 굴린 세계는 길게 굴린 세계의 앞부분이다', () => {
    fc.assert(
      fc.property(meadowArb, fc.integer({ min: 0, max: 14 }), (input, shorter) => {
        const cut = Math.min(shorter, input.ticks);
        const short = executeS1({ ...input, ticks: cut });
        const long = executeS1(input);
        expect(JSON.stringify(short.series.map((sample) => sample.population))).toBe(
          JSON.stringify(long.series.slice(0, cut + 1).map((sample) => sample.population)),
        );
      }),
      RUN,
    );
  });

  it('개체군 총량이 늘어난 날에는 반드시 번식 법칙이 적용되었다', () => {
    fc.assert(
      fc.property(meadowArb, (input) => {
        const series = executeS1(input).series;
        for (let index = 1; index < series.length; index += 1) {
          const before = series[index - 1] as NaturalSample;
          const after = series[index] as NaturalSample;
          if (totalOf(after) > totalOf(before)) {
            expect(after.appliedLaws, `${after.tick}일`).toContain('l1_breed');
          }
        }
      }),
      RUN,
    );
  });

  it('먹이가 사정권 밖이면 그 먹이는 한 포기도 줄지 않는다', () => {
    fc.assert(
      fc.property(meadowArb, (input) => {
        const output = executeS1(input);
        const gap = output.initialWeb.gaps.find((entry) => entry.consumer === 'deer_herd');
        if (gap?.code !== 'E_PREY_OUT_OF_HABITAT') return;
        const first = output.series[0] as NaturalSample;
        // 첫 틱에 닿지 못한 먹이는, 무리가 움직이지 않는 한 끝까지 그대로다.
        for (const sample of output.series) {
          expect(sample.population['meadow_grass']).toBe(first.population['meadow_grass']);
        }
      }),
      RUN,
    );
  });
});
