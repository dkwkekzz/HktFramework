import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { RuleBook, buildWorld, runTransaction, totalOf } from '../../src/index.js';
import type { Intent } from '../../src/index.js';
import { CANYON, COMPONENT_DEFINITIONS, RULES } from '../../scenarios/fixtures.js';

/** 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다. */
const RUN = { seed: 20260730, numRuns: 1000 } as const;

const book = RuleBook.of(RULES);
const base = buildWorld({ components: COMPONENT_DEFINITIONS, operations: CANYON });

const actorArb = fc.constantFrom('hunter_a', 'blessed_knight', 'dead_knight', 'no_such_hunter');
const targetArb = fc.constantFrom('beast_ka', 'far_beast', 'hunter_a', 'no_such_target');
const verbArb = fc.constantFrom('strike', 'pay', 'swear', 'charge', 'sing');

const intentArb: fc.Arbitrary<Intent> = fc
  .tuple(fc.nat({ max: 999 }), actorArb, verbArb, targetArb)
  .map(([index, actor, verb, target]) => ({ id: `intent_${index}`, actor, verb, targets: [target] }));

const programArb = fc.array(intentArb, { minLength: 1, maxLength: 8 });

function run(program: readonly Intent[]): ReturnType<typeof buildWorld> {
  let store = base;
  for (const intent of program) store = runTransaction(store, book, intent).store;
  return store;
}

describe('속성: 트랜잭션', () => {
  it('거부되면 세계가 바뀌지 않는다 (실패 효과를 선언한 규칙은 제외)', () => {
    fc.assert(
      fc.property(programArb, intentArb, (program, intent) => {
        const store = run(program);
        const before = store.hash();
        const { store: next, outcome } = runTransaction(store, book, intent);
        if (outcome.ok) return;
        if (outcome.delta.length === 0) expect(next.hash()).toBe(before);
        // 실패 효과가 있었다면 그 변화도 반드시 델타에 적혀 있어야 한다 (GI-01).
        else expect(outcome.delta.every((change) => change.path.startsWith('entity/'))).toBe(true);
      }),
      RUN,
    );
  });

  it('거부는 비용도 효과도 적용하지 않는다', () => {
    fc.assert(
      fc.property(programArb, intentArb, (program, intent) => {
        const { outcome } = runTransaction(run(program), book, intent);
        if (outcome.ok) return;
        expect(outcome.costDelta).toEqual([]);
        expect(outcome.effectDelta).toEqual([]);
        expect(outcome.appliedRuleId).toBeNull();
        expect(outcome.rejection).not.toBeNull();
      }),
      RUN,
    );
  });

  it('동전 총량은 어떤 순서로 굴려도 그대로다', () => {
    const total = totalOf(base, 'purse', 'coins');
    fc.assert(
      fc.property(programArb, (program) => {
        expect(totalOf(run(program), 'purse', 'coins')).toBe(total);
      }),
      RUN,
    );
  });

  it('자원은 스키마의 하한 아래로 내려가지 않는다', () => {
    fc.assert(
      fc.property(programArb, (program) => {
        const store = run(program);
        for (const id of store.withComponent('energy')) {
          expect((store.component(id, 'energy') ?? {})['current']).toBeGreaterThanOrEqual(0);
        }
        for (const id of store.withComponent('purse')) {
          expect((store.component(id, 'purse') ?? {})['coins']).toBeGreaterThanOrEqual(0);
        }
      }),
      RUN,
    );
  });

  it('같은 의도 열은 같은 세계를 만든다 (GI-12)', () => {
    fc.assert(
      fc.property(programArb, (program) => {
        expect(run(program).hash()).toBe(run(program).hash());
      }),
      RUN,
    );
  });

  it('임시 의도 실체는 어떤 경로로도 남지 않는다', () => {
    fc.assert(
      fc.property(programArb, (program) => {
        expect(run(program).has('transient_intent')).toBe(false);
      }),
      RUN,
    );
  });

  it('성공한 트랜잭션의 델타는 언제나 비용+효과다', () => {
    fc.assert(
      fc.property(programArb, intentArb, (program, intent) => {
        const { outcome } = runTransaction(run(program), book, intent);
        if (!outcome.ok) return;
        expect(outcome.delta).toEqual([...outcome.costDelta, ...outcome.effectDelta]);
      }),
      RUN,
    );
  });

  it('규칙 검토 기록은 언제나 권위 순서다', () => {
    fc.assert(
      fc.property(programArb, intentArb, (program, intent) => {
        const { outcome } = runTransaction(run(program), book, intent);
        if (outcome.matches.length === 0) return;
        expect(outcome.matches.map((match) => match.ruleId)).toEqual(
          book.all().map((rule) => rule.id),
        );
      }),
      RUN,
    );
  });
});
