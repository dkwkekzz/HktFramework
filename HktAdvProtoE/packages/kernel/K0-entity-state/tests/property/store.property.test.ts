import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ComponentRegistry, EntityStore, StoreRejection, applyOperation } from '../../src/index.js';
import type { StoreOperation } from '../../src/index.js';
import { COMPONENT_DEFINITIONS } from '../../scenarios/fixtures.js';

/** 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다. */
const RUN = { seed: 20260730, numRuns: 1000 } as const;

const registry = ComponentRegistry.of(COMPONENT_DEFINITIONS);

const idArb = fc.constantFrom('e0', 'e1', 'e2', 'e3').map((name) => `entity_${name}`);
const kindArb = fc.constantFrom('person', 'item', 'giant_beast');
const tagArb = fc.constantFrom('human', 'rare', 'wounded', 'hunter');

const operationArb: fc.Arbitrary<StoreOperation> = fc.oneof(
  fc.record({
    op: fc.constant('spawn' as const),
    id: idArb,
    kind: kindArb,
    tags: fc.array(tagArb, { maxLength: 3 }),
  }),
  fc.record({ op: fc.constant('despawn' as const), id: idArb }),
  fc.record({
    op: fc.constant('set_component' as const),
    id: idArb,
    type: fc.constantFrom('health', 'position', 'energy'),
    data: fc.oneof(
      fc.record({ current: fc.nat({ max: 100 }), max: fc.integer({ min: 1, max: 100 }) }),
      fc.record({ x: fc.integer({ min: -50, max: 50 }), y: fc.constant(0), z: fc.constant(0) }),
      fc.record({ current: fc.nat({ max: 50 }) }),
      // 스키마를 어기는 값도 섞는다 — 거부 경로가 상태를 남기지 않는지 보려는 것이다.
      fc.record({ current: fc.integer({ min: -50, max: -1 }), max: fc.constant(10) }),
    ),
  }),
  fc.record({
    op: fc.constant('remove_component' as const),
    id: idArb,
    type: fc.constantFrom('health', 'position', 'energy'),
  }),
  fc.record({ op: fc.constant('attach_tag' as const), id: idArb, tag: tagArb }),
  fc.record({ op: fc.constant('remove_tag' as const), id: idArb, tag: tagArb }),
);

const programArb = fc.array(operationArb, { minLength: 1, maxLength: 20 });

/** 거부는 삼키고 성공한 것만 반영한다 — 거부가 상태를 남기지 않는 것이 K0 의 성질이다. */
function run(program: readonly StoreOperation[]): EntityStore {
  let store = EntityStore.empty(registry);
  for (const operation of program) {
    try {
      store = applyOperation(store, operation);
    } catch (error) {
      if (!(error instanceof StoreRejection)) throw error;
    }
  }
  return store;
}

describe('속성: 저장소 불변조건', () => {
  it('어떤 연산 열을 돌려도 인덱스는 전수 재계산과 같다', () => {
    fc.assert(
      fc.property(programArb, (program) => {
        expect(run(program).audit()).toEqual([]);
      }),
      RUN,
    );
  });

  it('거부된 연산은 해시를 바꾸지 않는다', () => {
    fc.assert(
      fc.property(programArb, operationArb, (program, operation) => {
        const store = run(program);
        const before = store.hash();
        try {
          applyOperation(store, operation);
        } catch (error) {
          if (!(error instanceof StoreRejection)) throw error;
        }
        expect(store.hash()).toBe(before);
      }),
      RUN,
    );
  });

  it('스냅샷으로 되살리면 해시가 같다', () => {
    fc.assert(
      fc.property(programArb, (program) => {
        const store = run(program);
        expect(EntityStore.restore(store.snapshot(), registry).hash()).toBe(store.hash());
      }),
      RUN,
    );
  });

  it('같은 연산 열을 두 번 돌리면 같은 해시가 나온다 (GI-12)', () => {
    fc.assert(
      fc.property(programArb, (program) => {
        expect(run(program).hash()).toBe(run(program).hash());
      }),
      RUN,
    );
  });

  it('읽어 간 상태는 언제나 동결되어 있다', () => {
    fc.assert(
      fc.property(programArb, (program) => {
        for (const entity of run(program).list()) {
          expect(Object.isFrozen(entity)).toBe(true);
          for (const data of Object.values(entity.components)) expect(Object.isFrozen(data)).toBe(true);
        }
      }),
      RUN,
    );
  });

  it('실체 목록과 인덱스는 언제나 오름차순이다', () => {
    fc.assert(
      fc.property(programArb, (program) => {
        const store = run(program);
        const ids = store.ids();
        expect(ids).toEqual([...ids].sort());
        for (const kind of store.kinds()) {
          const bucket = [...store.byKind(kind)];
          expect(bucket).toEqual([...bucket].sort());
        }
      }),
      RUN,
    );
  });

  it('spawn 뒤 despawn 은 세계를 원래대로 되돌린다', () => {
    fc.assert(
      fc.property(programArb, idArb, kindArb, (program, id, kind) => {
        const store = run(program);
        if (store.has(id)) return;
        expect(store.spawn({ id, kind }).despawn(id).hash()).toBe(store.hash());
      }),
      RUN,
    );
  });
});
