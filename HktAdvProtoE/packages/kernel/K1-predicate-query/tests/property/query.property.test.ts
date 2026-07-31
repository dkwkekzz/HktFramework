import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evaluate, runQuery, runQueryByFullScan } from '../../src/index.js';
import type { PredicateSpec, QuerySpec } from '../../src/index.js';
import { buildWorld } from '../../src/module.js';
import { COMPONENT_DEFINITIONS, ROOM } from '../../scenarios/fixtures.js';

/** 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다. */
const RUN = { seed: 20260730, numRuns: 1000 } as const;

const store = buildWorld({ components: COMPONENT_DEFINITIONS, operations: ROOM });
const ids = store.ids();

const leafArb: fc.Arbitrary<PredicateSpec> = fc.oneof(
  fc.record({
    op: fc.constant('eq' as const),
    path: fc.constantFrom('s.kind', 's.id', 's.health.current', 's.health.max'),
    value: fc.oneof(fc.constantFrom('person', 'structure', 'giant_beast'), fc.integer({ min: 0, max: 100 })),
  }),
  fc.record({
    op: fc.constantFrom('gt' as const, 'lt' as const),
    path: fc.constantFrom('s.health.current', 's.health.max', 's.position.x'),
    value: fc.integer({ min: -10, max: 110 }),
  }),
  fc.record({
    op: fc.constant('has_tag' as const),
    target: fc.constant('s'),
    tag: fc.constantFrom('human', 'beast', 'healer', 'stone', 'ghost'),
  }),
  fc.record({
    op: fc.constant('within_distance' as const),
    a: fc.constant('s'),
    b: fc.constant('hero'),
    max: fc.integer({ min: 0, max: 50 }),
  }),
);

const predicateArb: fc.Arbitrary<PredicateSpec> = fc.letrec<{ node: PredicateSpec }>((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    leafArb,
    fc.record({ op: fc.constant('and' as const), items: fc.array(tie('node'), { minLength: 1, maxLength: 3 }) }),
    fc.record({ op: fc.constant('or' as const), items: fc.array(tie('node'), { minLength: 1, maxLength: 3 }) }),
    fc.record({ op: fc.constant('not' as const), item: tie('node') }),
  ),
})).node;

const sourceArb = fc.oneof(
  fc.constant(undefined),
  fc.record({ kind: fc.constantFrom('person', 'structure', 'giant_beast') }),
  fc.record({ withComponent: fc.constantFrom('health', 'position', 'faction') }),
  fc.record({ tag: fc.constantFrom('human', 'beast') }),
);

const specArb: fc.Arbitrary<QuerySpec> = fc
  .tuple(predicateArb, sourceArb)
  .map(([where, from]) => ({ as: 's', where, bindings: { hero: 'hero' }, ...(from === undefined ? {} : { from }) }));

describe('속성: 질의', () => {
  it('계획으로 좁힌 답과 전수 조회의 답이 언제나 같다', () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        expect(runQuery(store, spec).matched).toEqual(runQueryByFullScan(store, spec));
      }),
      RUN,
    );
  });

  it('결과는 언제나 오름차순이고 세계의 실체만 담는다', () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        const matched = runQuery(store, spec).matched;
        expect(matched).toEqual([...matched].sort());
        for (const id of matched) expect(ids).toContain(id);
      }),
      RUN,
    );
  });

  it('같은 질의를 두 번 돌리면 같은 digest 다 (GI-12)', () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        expect(runQuery(store, spec).digest).toBe(runQuery(store, spec).digest);
      }),
      RUN,
    );
  });

  it('이중 부정은 원래 조건과 같다', () => {
    fc.assert(
      fc.property(predicateArb, fc.constantFrom(...ids), (predicate, id) => {
        const bindings = { s: id, hero: 'hero' };
        expect(evaluate(store, { op: 'not', item: { op: 'not', item: predicate } }, bindings).passed).toBe(
          evaluate(store, predicate, bindings).passed,
        );
      }),
      RUN,
    );
  });

  it('드모르간이 성립한다', () => {
    fc.assert(
      fc.property(predicateArb, predicateArb, fc.constantFrom(...ids), (a, b, id) => {
        const bindings = { s: id, hero: 'hero' };
        const value = (predicate: PredicateSpec): boolean => evaluate(store, predicate, bindings).passed;
        expect(value({ op: 'not', item: { op: 'and', items: [a, b] } })).toBe(
          value({ op: 'or', items: [{ op: 'not', item: a }, { op: 'not', item: b }] }),
        );
        expect(value({ op: 'not', item: { op: 'or', items: [a, b] } })).toBe(
          value({ op: 'and', items: [{ op: 'not', item: a }, { op: 'not', item: b }] }),
        );
      }),
      RUN,
    );
  });

  it('거짓이면 언제나 원인이 하나 이상 남는다', () => {
    fc.assert(
      fc.property(predicateArb, fc.constantFrom(...ids), (predicate, id) => {
        const result = evaluate(store, predicate, { s: id, hero: 'hero' });
        if (result.passed) expect(result.causes).toEqual([]);
        else expect(result.causes.length).toBeGreaterThan(0);
      }),
      RUN,
    );
  });

  it('질의는 세계 해시를 바꾸지 않는다', () => {
    const before = store.hash();
    fc.assert(
      fc.property(specArb, (spec) => {
        runQuery(store, spec);
        expect(store.hash()).toBe(before);
      }),
      RUN,
    );
  });
});
