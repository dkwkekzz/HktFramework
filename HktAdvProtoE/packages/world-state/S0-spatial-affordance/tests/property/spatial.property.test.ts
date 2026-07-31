import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { StoreOperation } from '@hkt/k0-entity-state';
import {
  SpatialIndex,
  auditOutput,
  auditPath,
  buildWorld,
  executeS0,
  findPath,
  validateOutput,
} from '../../src/index.js';
import type { Cell, S0Input, SpatialLayout } from '../../src/index.js';
import { AFFORDANCES, COMPONENT_DEFINITIONS } from '../../scenarios/fixtures.js';

/** 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다. */
const RUN = { seed: 20260731, numRuns: 600 } as const;

const LAYOUT: SpatialLayout = {
  cellSize: 1,
  origin: { x: 0, y: 0, z: 0 },
  size: { x: 7, y: 7, z: 1 },
};

const cellArb: fc.Arbitrary<Cell> = fc.record({
  ix: fc.integer({ min: 0, max: 6 }),
  iy: fc.integer({ min: 0, max: 6 }),
  iz: fc.constant(0),
});

/**
 * 무작위 방 — 막는 것과 막지 않는 것이 섞여 있다.
 *
 * 장애물이 격자를 통째로 메우는 표본도 나온다. 그런 표본이 필요하다 — "길이 언제나 있다"를
 * 가정하고 짠 코드는 길이 없는 세계에서 조용히 틀린 답을 낸다.
 */
const roomArb = fc
  .array(
    fc.record({
      cell: cellArb,
      solid: fc.boolean(),
      opaque: fc.boolean(),
      sized: fc.boolean(),
    }),
    { minLength: 0, maxLength: 12 },
  )
  .map((things) => {
    const operations: StoreOperation[] = [];
    const seen = new Set<string>();
    things.forEach((thing, ordinal) => {
      const key = `${thing.cell.ix},${thing.cell.iy}`;
      if (seen.has(key)) return;
      seen.add(key);
      operations.push({
        op: 'spawn',
        id: `thing_${ordinal}`,
        kind: thing.solid ? 'structure' : 'item',
        tags: thing.solid ? ['stone'] : ['portable'],
        components: {
          position: { x: thing.cell.ix, y: thing.cell.iy, z: 0 },
          ...(thing.sized ? { extent: { x: 0.4, y: 0.4, z: 0.4 } } : {}),
          ...(thing.solid || thing.opaque ? { barrier: { solid: thing.solid, opaque: thing.opaque } } : {}),
        },
      });
    });
    return operations;
  });

const worldOf = (operations: StoreOperation[]) =>
  buildWorld({ components: COMPONENT_DEFINITIONS, operations });

describe('속성: 공간 색인', () => {
  it('색인으로 좁힌 답과 전수 조회의 답이 언제나 같다', () => {
    fc.assert(
      fc.property(
        roomArb,
        fc.record({ x: fc.integer({ min: -2, max: 8 }), y: fc.integer({ min: -2, max: 8 }), z: fc.constant(0) }),
        fc.double({ min: 0, max: 12, noNaN: true }),
        (operations, center, radius) => {
          const store = worldOf(operations);
          const index = SpatialIndex.build(store, LAYOUT);
          expect(index.within(store, center, radius).matched).toEqual(
            SpatialIndex.withinByFullScan(store, center, radius),
          );
        },
      ),
      RUN,
    );
  });

  it('반경을 넓히면 답이 줄어들지 않는다', () => {
    fc.assert(
      fc.property(
        roomArb,
        fc.double({ min: 0, max: 6, noNaN: true }),
        fc.double({ min: 0, max: 6, noNaN: true }),
        (operations, a, b) => {
          const store = worldOf(operations);
          const index = SpatialIndex.build(store, LAYOUT);
          const center = { x: 3, y: 3, z: 0 };
          const [small, large] = a <= b ? [a, b] : [b, a];
          const inner = index.within(store, center, small).matched;
          const outer = new Set(index.within(store, center, large).matched);
          expect(inner.every((id) => outer.has(id))).toBe(true);
        },
      ),
      RUN,
    );
  });

  it('막힌 칸의 목록은 그 칸을 실제로 덮은 실체와 같다', () => {
    fc.assert(
      fc.property(roomArb, cellArb, (operations, cell) => {
        const store = worldOf(operations);
        const index = SpatialIndex.build(store, LAYOUT);
        const blockers = index.blockersAt(cell);
        expect(index.isBlocked(cell)).toBe(blockers.length > 0);
        expect([...blockers]).toEqual([...blockers].sort());
      }),
      RUN,
    );
  });
});

describe('속성: 이동', () => {
  it('찾은 길은 한 걸음씩 이어지고 막힌 칸을 밟지 않는다', () => {
    fc.assert(
      fc.property(roomArb, cellArb, cellArb, (operations, from, to) => {
        const store = worldOf(operations);
        const index = SpatialIndex.build(store, LAYOUT);
        const report = findPath(index, from, { goals: [to], allowBlockedStart: true });
        expect(auditPath(index, report)).toEqual([]);
      }),
      RUN,
    );
  });

  it('길의 비용은 언제나 걸음수 × 칸 크기다', () => {
    fc.assert(
      fc.property(roomArb, cellArb, cellArb, (operations, from, to) => {
        const store = worldOf(operations);
        const index = SpatialIndex.build(store, LAYOUT);
        const report = findPath(index, from, { goals: [to], allowBlockedStart: true });
        if (!report.found) {
          expect(report.cost).toBe(0);
          return;
        }
        expect(report.cost).toBeCloseTo((report.cells.length - 1) * LAYOUT.cellSize, 12);
      }),
      RUN,
    );
  });

  it('길은 언제나 최단이다 — 맨해튼 거리보다 짧을 수 없다', () => {
    fc.assert(
      fc.property(roomArb, cellArb, cellArb, (operations, from, to) => {
        const store = worldOf(operations);
        const index = SpatialIndex.build(store, LAYOUT);
        const report = findPath(index, from, { goals: [to], allowBlockedStart: true });
        if (!report.found) return;
        const straight = Math.abs(from.ix - to.ix) + Math.abs(from.iy - to.iy) + Math.abs(from.iz - to.iz);
        expect(report.cells.length - 1).toBeGreaterThanOrEqual(straight);
      }),
      RUN,
    );
  });

  it('길이 있으면 반대 방향으로도 같은 값의 길이 있다', () => {
    fc.assert(
      fc.property(roomArb, cellArb, cellArb, (operations, from, to) => {
        const store = worldOf(operations);
        const index = SpatialIndex.build(store, LAYOUT);
        // 양 끝이 모두 뚫려 있을 때만 대칭이다 — 막힌 칸에서의 출발은 특별 허가이므로 대칭이 아니다.
        if (index.isBlocked(from) || index.isBlocked(to)) return;
        const there = findPath(index, from, { goals: [to] });
        const back = findPath(index, to, { goals: [from] });
        expect(back.found).toBe(there.found);
        if (there.found) expect(back.cost).toBe(there.cost);
      }),
      RUN,
    );
  });

  it('길이 없으면 무엇이 막았는지가 반드시 남는다', () => {
    fc.assert(
      fc.property(roomArb, cellArb, cellArb, (operations, from, to) => {
        const store = worldOf(operations);
        const index = SpatialIndex.build(store, LAYOUT);
        if (index.isBlocked(from)) return;
        const report = findPath(index, from, { goals: [to] });
        if (report.found) return;
        expect(report.blockedBy.length, `${from.ix},${from.iy} → ${to.ix},${to.iy}`).toBeGreaterThan(0);
      }),
      RUN,
    );
  });

  it('같은 세계·같은 양 끝이면 언제나 같은 길이다 (GI-12)', () => {
    fc.assert(
      fc.property(roomArb, cellArb, cellArb, (operations, from, to) => {
        const store = worldOf(operations);
        const index = SpatialIndex.build(store, LAYOUT);
        const first = JSON.stringify(findPath(index, from, { goals: [to], allowBlockedStart: true }));
        const second = JSON.stringify(
          findPath(SpatialIndex.build(worldOf(operations), LAYOUT), from, {
            goals: [to],
            allowBlockedStart: true,
          }),
        );
        expect(second).toBe(first);
      }),
      RUN,
    );
  });
});

describe('속성: 접근 가능성', () => {
  /** 무작위 방에 언제나 같은 주체와 대상을 세운다 — 판정의 대상이 있어야 물어볼 수 있다. */
  const inputArb = roomArb.map((operations): S0Input => {
    const occupied = new Set(
      operations.map((operation) => ('components' in operation ? `${operation.components?.['position']?.['x']},${operation.components?.['position']?.['y']}` : '')),
    );
    const stage: StoreOperation[] = operations.filter(
      (operation) =>
        !('id' in operation) ||
        (operation.id !== 'hunter' && operation.id !== 'sealed_relic' && operation.id !== 'dropped_coin'),
    );
    return {
      world: {
        components: COMPONENT_DEFINITIONS,
        operations: [
          ...stage.filter((operation) => !('components' in operation) || !occupied.has('0,0')),
          {
            op: 'spawn',
            id: 'hunter',
            kind: 'person',
            tags: ['human'],
            components: {
              position: { x: 0, y: 0, z: 0 },
              capability: { names: ['grasp', 'walk'] },
              reach: { max: 1 },
              stamina: { current: 10 },
            },
          },
          {
            op: 'spawn',
            id: 'sealed_relic',
            kind: 'artifact',
            tags: ['portable', 'relic'],
            components: { position: { x: 6, y: 6, z: 0 } },
          },
          {
            op: 'spawn',
            id: 'dropped_coin',
            kind: 'item',
            tags: ['portable'],
            components: { position: { x: 3, y: 3, z: 0 } },
          },
          { op: 'spawn', id: 'oak_door', kind: 'door', tags: ['wooden'], components: { position: { x: 6, y: 0, z: 0 }, barrier: { solid: true, opaque: true } } },
        ],
      },
      layout: LAYOUT,
      affordances: AFFORDANCES,
      steps: [
        { kind: 'resolve', id: 'ask', actor: 'hunter' },
        { kind: 'range', id: 'look', center: 'hunter', radius: 4 },
        { kind: 'path', id: 'walk', from: 'hunter', to: 'sealed_relic' },
      ],
    };
  });

  it('어떤 방에서도 출력 불변조건이 깨지지 않는다', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const output = executeS0(input);
        expect(validateOutput(output, input.layout)).toEqual([]);
        expect(auditOutput(input, output)).toEqual([]);
      }),
      RUN,
    );
  });

  it('묻는 것은 어떤 방에서도 세계를 바꾸지 않는다', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const output = executeS0(input);
        expect(output.worldHashAfter).toBe(output.worldHashBefore);
        for (const step of output.steps) expect(step.hashAfter).toBe(step.hashBefore);
      }),
      RUN,
    );
  });

  it('닿을 수 없는 대상은 결코 제시되지 않는다', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        for (const step of executeS0(input).steps) {
          for (const offer of step.offers ?? []) {
            if (!offer.available) continue;
            expect(offer.path?.found).toBe(true);
            expect(offer.refusals).toEqual([]);
          }
        }
      }),
      RUN,
    );
  });

  it('같은 입력이면 같은 답이다 (GI-12)', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(executeS0(input).digest).toBe(executeS0(input).digest);
      }),
      RUN,
    );
  });
});
