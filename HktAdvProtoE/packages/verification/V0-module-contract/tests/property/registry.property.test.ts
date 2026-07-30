import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildRegistry, topologicalOrder } from '../../src/registry.js';
import { validateOutput } from '../../src/module.js';
import { ISSUE } from '../../src/types.js';
import {
  contract,
  contractMissing,
  OPTIONAL_FIELD_NAMES,
  type ContractFields,
} from '../../scenarios/fixtures.js';

/**
 * 속성 테스트 — 원문 「5」 G3 속성 게이트.
 *
 * 시드를 고정해 실행마다 같은 표본을 쓴다(원문 「23」: 결정성을 깨는 무작위 사용 금지).
 */
const RUN = { seed: 20260730, numRuns: 1000 } as const;
const PHASES = ['V', 'K', 'S', 'U', 'G'] as const;
const MAX_MODULES = 12;

/** 인덱스로 모듈 id 를 결정한다 — 표본 안에서 유일하다. */
const idOf = (index: number): string =>
  `${PHASES[index % PHASES.length] as string}${Math.floor(index / PHASES.length)}`;

interface Plan {
  /** planned[i] = i 번 모듈의 선행 인덱스 목록 (항상 i 보다 작다 → 순환 없음) */
  deps: number[][];
}

const planArbitrary: fc.Arbitrary<Plan> = fc
  .array(fc.array(fc.nat({ max: MAX_MODULES - 1 }), { maxLength: 4 }), {
    minLength: 1,
    maxLength: MAX_MODULES,
  })
  .map((raw) => ({
    deps: raw.map((depsOfNode, index) =>
      index === 0
        ? []
        : [...new Set(depsOfNode.map((value) => value % index))].sort((a, b) => a - b),
    ),
  }));

function toDocuments(plan: Plan, override?: (index: number) => ContractFields | null) {
  return plan.deps.map((deps, index) => {
    const custom = override?.(index) ?? null;
    if (custom) return contract(custom.id, custom.name, 'verification', custom);
    return contract(idOf(index), `mod-${index}`, 'verification', {
      depends_on: deps.length > 0 ? deps.map(idOf) : ['none'],
    });
  });
}

/** 시드로 결정되는 순열 — Math.random 금지. */
function permute<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed % 2147483647 || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 16807) % 2147483647;
    const j = state % (i + 1);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

describe('속성: 정상 DAG', () => {
  it('모든 문서가 등록되고 불변조건 위반이 없다', () => {
    fc.assert(
      fc.property(planArbitrary, (plan) => {
        const documents = toDocuments(plan);
        const report = buildRegistry(documents);
        expect(report.rejected).toEqual([]);
        expect(report.registered).toHaveLength(documents.length);
        expect(validateOutput(report)).toEqual([]);
      }),
      RUN,
    );
  });

  it('위상 순서에서 선행은 항상 후행보다 앞이다', () => {
    fc.assert(
      fc.property(planArbitrary, (plan) => {
        const { registry } = buildRegistry(toDocuments(plan));
        const position = new Map(registry.order.map((id, index) => [id, index]));
        for (const module of registry.modules) {
          for (const dep of module.dependsOn) {
            expect(position.get(dep)).toBeLessThan(position.get(module.id) as number);
          }
        }
      }),
      RUN,
    );
  });

  it('문서 순서를 어떻게 섞어도 레지스트리 해시와 위상 순서가 같다', () => {
    fc.assert(
      fc.property(planArbitrary, fc.integer({ min: 1, max: 1_000_000 }), (plan, seed) => {
        const documents = toDocuments(plan);
        const base = buildRegistry(documents);
        const shuffled = buildRegistry(permute(documents, seed));
        expect(shuffled.registry.hash).toBe(base.registry.hash);
        expect(shuffled.registry.order).toEqual(base.registry.order);
        expect(shuffled.registered).toEqual(base.registered);
      }),
      RUN,
    );
  });

  it('같은 입력을 두 번 등록하면 같은 해시가 나온다', () => {
    fc.assert(
      fc.property(planArbitrary, (plan) => {
        const documents = toDocuments(plan);
        expect(buildRegistry(documents).registry.hash).toBe(buildRegistry(documents).registry.hash);
      }),
      RUN,
    );
  });
});

describe('속성: 결손 문서', () => {
  it('필수 필드를 하나 지우면 그 문서는 반드시 거부되고, 남은 레지스트리는 불변조건을 지킨다', () => {
    fc.assert(
      fc.property(
        planArbitrary,
        fc.nat({ max: MAX_MODULES - 1 }),
        fc.constantFrom(...OPTIONAL_FIELD_NAMES),
        (plan, rawIndex, field) => {
          const target = rawIndex % plan.deps.length;
          const targetId = idOf(target);
          const deps = plan.deps[target] as number[];
          const broken = contractMissing(targetId, `mod-${target}`, 'verification', field, {
            depends_on: deps.length > 0 ? deps.map(idOf) : ['none'],
          });
          const documents = toDocuments(plan).map((doc, index) =>
            index === target ? broken : doc,
          );

          const report = buildRegistry(documents);
          expect(report.registered).not.toContain(targetId);
          const rejection = report.rejected.find((r) => r.path === broken.path);
          expect(rejection).toBeDefined();
          expect(rejection?.issues.some((issue) => issue.code === ISSUE.MISSING_FIELD)).toBe(true);
          expect(validateOutput(report)).toEqual([]);
        },
      ),
      RUN,
    );
  });

  it('거부된 모듈을 선행으로 삼은 모듈은 등록되지 않는다', () => {
    fc.assert(
      fc.property(planArbitrary, fc.nat({ max: MAX_MODULES - 1 }), (plan, rawIndex) => {
        const target = rawIndex % plan.deps.length;
        const targetId = idOf(target);
        const broken = contractMissing(targetId, `mod-${target}`, 'verification', 'purpose');
        const report = buildRegistry(
          toDocuments(plan).map((doc, index) => (index === target ? broken : doc)),
        );

        const registered = new Set(report.registered);
        expect(registered.has(targetId)).toBe(false);
        // 전이적으로 target 에 닿는 모듈은 전부 빠져야 한다
        const blocked = new Set<number>([target]);
        plan.deps.forEach((deps, index) => {
          if (deps.some((dep) => blocked.has(dep))) blocked.add(index);
        });
        for (const index of blocked) {
          expect(registered.has(idOf(index))).toBe(false);
        }
        // 그 외에는 모두 등록된다
        plan.deps.forEach((_deps, index) => {
          if (blocked.has(index)) return;
          expect(registered.has(idOf(index))).toBe(true);
        });
      }),
      RUN,
    );
  });
});

describe('속성: 순환', () => {
  it('두 모듈을 서로 참조시키면 순환 참여 모듈이 거부되고 레지스트리에는 순환이 남지 않는다', () => {
    fc.assert(
      fc.property(
        planArbitrary.filter((plan) => plan.deps.length >= 2),
        (plan) => {
          const firstId = idOf(0);
          const lastIndex = plan.deps.length - 1;
          const lastId = idOf(lastIndex);
          const documents = toDocuments(plan).map((doc, index) => {
            if (index === 0) {
              return contract(firstId, 'mod-0', 'verification', { depends_on: [lastId] });
            }
            if (index === lastIndex) {
              return contract(lastId, `mod-${lastIndex}`, 'verification', {
                depends_on: [firstId],
              });
            }
            return doc;
          });

          const report = buildRegistry(documents);
          const modules = new Map(report.registry.modules.map((m) => [m.id, m]));

          expect(topologicalOrder(modules).leftover).toEqual([]);
          expect(validateOutput(report)).toEqual([]);
          expect(report.registered).not.toContain(firstId);
          expect(report.registered).not.toContain(lastId);
          expect(
            report.rejected.some((r) =>
              r.issues.some((issue) => issue.code === ISSUE.DEPENDENCY_CYCLE),
            ),
          ).toBe(true);
        },
      ),
      RUN,
    );
  });
});
