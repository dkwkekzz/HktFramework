import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { StoreOperation } from '@hkt/k0-entity-state';
import { NATURAL_LAWS } from '@hkt/s1-natural-state';
import {
  compareSubjects,
  executeU0,
  rankNeeds,
  validateOutput,
  SUBJECT_NEEDS,
  TEMPERAMENT,
  type SubjectView,
  type U0Input,
} from '../../src/index.js';
import { COMPONENT_DEFINITIONS, LAYOUT, WORLD_SEED, body, subject } from '../../scenarios/fixtures.js';

/** 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다. */
const RUN = { seed: 20260731, numRuns: 120 } as const;

const level = fc.integer({ min: 0, max: 10 });
const share = fc.integer({ min: 0, max: 10 }).map((value) => value / 10);

const viewArb: fc.Arbitrary<SubjectView> = fc.record({
  needs: fc.record({ hunger: level, duty: level, safety: level }),
  values: fc.record({ duty: share, survival: share, temperance: share }),
  traits: fc.record({ patient: share, impulsive: share, cautious: share }),
  emotions: fc.record({ fear: share, despair: share }),
  capabilities: fc.subarray(['forage', 'fight', 'stand_watch']),
  resources: fc.record({ provision: fc.integer({ min: 0, max: 5 }), salve: fc.integer({ min: 0, max: 5 }) }),
}).map((seed) => ({ id: 'someone', kind: 'person', bodyEntityIds: [], ...seed }));

/**
 * 무작위 야영지 — 두 사람과 두 몸, 그리고 먹을 것이 있기도 없기도 한 세계.
 *
 * 굶어 죽은 몸, 병든 몸, 상처 입은 몸, 몸이 없는 주체가 모두 나온다. 그런 세계가 필요하다 —
 * "몸은 늘 살아 있다"를 가정한 법칙집은 없는 날에 조용히 틀린다.
 */
const campArb = fc
  .record({
    aliveA: fc.boolean(),
    aliveB: fc.boolean(),
    hungerA: fc.integer({ min: 0, max: 12 }),
    hungerB: fc.integer({ min: 0, max: 12 }),
    wounds: fc.integer({ min: 0, max: 6 }),
    disease: fc.integer({ min: 0, max: 40 }),
    needsA: fc.record({ hunger: level, duty: level, safety: level }),
    needsB: fc.record({ hunger: level, duty: level, safety: level }),
    valuesA: fc.record({ duty: share, survival: share, temperance: share }),
    valuesB: fc.record({ duty: share, survival: share, temperance: share }),
    traitsA: fc.record({ patient: share, impulsive: share, cautious: share }),
    traitsB: fc.record({ patient: share, impulsive: share, cautious: share }),
    capsA: fc.subarray(['forage', 'fight', 'stand_watch']),
    capsB: fc.subarray(['forage', 'fight', 'stand_watch']),
    provisionA: fc.integer({ min: 0, max: 4 }),
    provisionB: fc.integer({ min: 0, max: 4 }),
    bodiless: fc.boolean(),
    natural: fc.boolean(),
    ticks: fc.integer({ min: 0, max: 8 }),
  })
  .map((camp): U0Input => {
    const operations: StoreOperation[] = [
      body('body_a', { x: 2, y: 2 }, camp.hungerA, {
        damage: { wounds: camp.wounds },
        disease: { load: camp.disease },
        diet: { eats: ['carrion'] },
        habitat: { radius: 4 },
      }),
      body('body_b', { x: 4, y: 2 }, camp.hungerB),
      {
        op: 'spawn',
        id: 'carrion_pile',
        kind: 'flora',
        tags: ['carrion'],
        components: { position: { x: 3, y: 2, z: 0 }, population: { count: 4 }, mass: { kg: 20 } },
      },
      subject({
        id: 'alpha',
        kind: 'person',
        needs: camp.needsA,
        values: camp.valuesA,
        traits: camp.traitsA,
        emotions: { fear: 0, despair: 0 },
        resources: { provision: camp.provisionA, salve: 0 },
        bodies: camp.bodiless ? [] : ['body_a'],
        capabilities: camp.capsA,
      }),
      subject({
        id: 'beta',
        kind: 'creature',
        needs: camp.needsB,
        values: camp.valuesB,
        traits: camp.traitsB,
        emotions: { fear: 0, despair: 0 },
        resources: { provision: camp.provisionB, salve: 0 },
        bodies: ['body_b'],
        capabilities: camp.capsB,
      }),
    ];
    if (!camp.aliveA) {
      operations.push({ op: 'set_component', id: 'body_a', type: 'population', data: { count: 0 } });
    }
    if (!camp.aliveB) {
      operations.push({ op: 'set_component', id: 'body_b', type: 'population', data: { count: 0 } });
    }
    return {
      world: { components: COMPONENT_DEFINITIONS, operations },
      layout: LAYOUT,
      worldSeed: WORLD_SEED,
      ticks: camp.ticks,
      ...(camp.natural ? { naturalLaws: NATURAL_LAWS } : {}),
    };
  });

describe('속성: 우선순위', () => {
  it('활성도는 언제나 N + V + T 다', () => {
    fc.assert(
      fc.property(viewArb, (view) => {
        for (const score of rankNeeds(view, SUBJECT_NEEDS, TEMPERAMENT).scores) {
          const rebuilt = score.terms.reduce((sum, term) => sum + term.value, 0);
          expect(rebuilt).toBeCloseTo(score.activation, 6);
          expect(score.urgency).toBe(view.needs[score.needId] ?? 0);
        }
      }),
      RUN,
    );
  });

  it('순서는 활성도 내림차순이고 동점은 id 오름차순이다', () => {
    fc.assert(
      fc.property(viewArb, (view) => {
        const scores = rankNeeds(view, SUBJECT_NEEDS, TEMPERAMENT).scores;
        for (let index = 1; index < scores.length; index += 1) {
          const previous = scores[index - 1];
          const current = scores[index];
          expect(previous?.activation).toBeGreaterThanOrEqual(current?.activation ?? 0);
          if (previous?.activation === current?.activation) {
            expect((previous?.needId ?? '') < (current?.needId ?? '')).toBe(true);
          }
        }
      }),
      RUN,
    );
  });

  it('확률은 언제나 합이 1 이고 순위와 같은 방향이다', () => {
    fc.assert(
      fc.property(viewArb, (view) => {
        const scores = rankNeeds(view, SUBJECT_NEEDS, TEMPERAMENT).scores;
        expect(scores.reduce((sum, score) => sum + score.probability, 0)).toBeCloseTo(1, 6);
        for (let index = 1; index < scores.length; index += 1) {
          expect(scores[index - 1]?.probability).toBeGreaterThanOrEqual(scores[index]?.probability ?? 0);
        }
      }),
      RUN,
    );
  });

  it('능력과 자원은 활성도를 한 칸도 바꾸지 않는다 — F 는 G2 의 몫이다', () => {
    fc.assert(
      fc.property(viewArb, (view) => {
        const bare = rankNeeds({ ...view, capabilities: [], resources: {} }, SUBJECT_NEEDS, TEMPERAMENT);
        const rich = rankNeeds(
          { ...view, capabilities: ['forage', 'fight', 'stand_watch'], resources: { provision: 9, salve: 9 } },
          SUBJECT_NEEDS,
          TEMPERAMENT,
        );
        expect(rich.order).toEqual(bare.order);
        expect(rich.scores.map((score) => score.activation)).toEqual(
          bare.scores.map((score) => score.activation),
        );
      }),
      RUN,
    );
  });

  it('온도는 순서를 바꾸지 않는다', () => {
    fc.assert(
      fc.property(viewArb, fc.integer({ min: 1, max: 40 }), (view, scale) => {
        const hot = rankNeeds(view, SUBJECT_NEEDS, { ...TEMPERAMENT, base: scale });
        const cold = rankNeeds(view, SUBJECT_NEEDS, { ...TEMPERAMENT, base: 0.3 });
        expect(hot.order).toEqual(cold.order);
      }),
      RUN,
    );
  });

  it('같은 사람은 같은 순서를 낸다 — 이름은 판정에 들어가지 않는다', () => {
    fc.assert(
      fc.property(viewArb, (view) => {
        const left = rankNeeds({ ...view, id: 'first' }, SUBJECT_NEEDS, TEMPERAMENT);
        const right = rankNeeds({ ...view, id: 'second', kind: 'god' }, SUBJECT_NEEDS, TEMPERAMENT);
        expect(right.order).toEqual(left.order);
        expect(right.scores.map((score) => score.activation)).toEqual(
          left.scores.map((score) => score.activation),
        );
      }),
      RUN,
    );
  });
});

describe('속성: 주체가 사는 세계', () => {
  it('어떤 야영지에서도 출력 불변조건이 깨지지 않는다', () => {
    fc.assert(
      fc.property(campArb, (input) => {
        expect(validateOutput(executeU0(input))).toEqual([]);
      }),
      RUN,
    );
  });

  it('모든 상태 변화에 원인 사건이 있다 (GI-01)', () => {
    fc.assert(
      fc.property(campArb, (input) => {
        const output = executeU0(input);
        expect(output.audit.everyChangeHasAnEvent).toBe(true);
        expect(output.audit.violations).toEqual([]);
        expect(output.audit.storeIssues).toEqual([]);
      }),
      RUN,
    );
  });

  it('일지를 원인부터 다시 굴려도 같은 사건이 나온다 (GI-12)', () => {
    fc.assert(
      fc.property(campArb, (input) => {
        const output = executeU0(input);
        expect(output.resimulatedLogHash).toBe(output.logHash);
        expect(executeU0(input).digest).toBe(output.digest);
      }),
      RUN,
    );
  });

  it('주체를 바꾼 것은 언제나 U0 의 법칙이다', () => {
    fc.assert(
      fc.property(campArb, (input) => {
        for (const law of executeU0(input).subjectDeltaLaws) expect(law.startsWith('u0_')).toBe(true);
      }),
      RUN,
    );
  });

  it('욕구는 0~10 안에 머문다', () => {
    fc.assert(
      fc.property(campArb, (input) => {
        for (const sample of executeU0(input).series) {
          for (const view of Object.values(sample.views)) {
            for (const [need, value] of Object.entries(view.needs)) {
              expect(value, `${view.id}/${need} @ ${sample.tick}`).toBeGreaterThanOrEqual(0);
              expect(value, `${view.id}/${need} @ ${sample.tick}`).toBeLessThanOrEqual(10);
            }
          }
        }
      }),
      RUN,
    );
  });

  it('몸이 없는 주체는 욕구가 저절로 변하지 않는다', () => {
    fc.assert(
      fc.property(campArb, (input) => {
        const output = executeU0(input);
        const first = output.series[0]?.views['alpha'];
        const last = output.series[output.series.length - 1]?.views['alpha'];
        if ((first?.bodyEntityIds.length ?? 0) > 0) return;
        expect(last?.needs).toEqual(first?.needs);
      }),
      RUN,
    );
  });

  it('짧게 굴린 세계는 길게 굴린 세계의 앞부분이다', () => {
    fc.assert(
      fc.property(campArb, fc.integer({ min: 0, max: 8 }), (input, shorter) => {
        const cut = Math.min(shorter, input.ticks);
        const short = executeU0({ ...input, ticks: cut });
        const long = executeU0(input);
        expect(JSON.stringify(short.series.map((sample) => sample.views))).toBe(
          JSON.stringify(long.series.slice(0, cut + 1).map((sample) => sample.views)),
        );
      }),
      RUN,
    );
  });

  it('욕구가 같은데 순서가 다르면 가치나 성격도 반드시 다르다', () => {
    fc.assert(
      fc.property(campArb, (input) => {
        for (const sample of executeU0(input).series) {
          const report = compareSubjects(sample, 'alpha', 'beta');
          if (!report.diverged) continue;
          const alpha = sample.views['alpha'];
          const beta = sample.views['beta'];
          const same =
            JSON.stringify(alpha?.values) === JSON.stringify(beta?.values) &&
            JSON.stringify(alpha?.traits) === JSON.stringify(beta?.traits);
          expect(same, `${sample.tick}일 — 같은 사람이 다른 순서를 냈다`).toBe(false);
        }
      }),
      RUN,
    );
  });
});
