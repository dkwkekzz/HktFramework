import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ComponentRegistry } from '@hkt/k0-entity-state';
import { RuleBook } from '@hkt/k2-rule-transaction';
import { WorldRuntime, buildWorld, driveTicks, resimulate } from '../../src/index.js';
import type { IntentDriver } from '../../src/index.js';
import { COMPONENT_DEFINITIONS, DRIVER_CANDIDATES, RULES, SHRINE_CANYON, TEMPLATES } from '../../scenarios/fixtures.js';

/**
 * 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다.
 *
 * 한 표본이 세계를 여러 번 굴리므로 표본 수를 크게 잡으면 시간이 폭발한다. 원문 「21」의 증거는
 * `propertyTests.seeds` 를 요구할 뿐 크기를 규정하지 않으므로, **틱을 줄이는 대신 표본을 늘린다.**
 */
const RUN = { seed: 20260730, numRuns: 200 } as const;

const registry = ComponentRegistry.of(COMPONENT_DEFINITIONS);
const rules = RuleBook.of(RULES);
const world = { components: COMPONENT_DEFINITIONS, operations: SHRINE_CANYON };

const seedArb = fc.integer({ min: 1, max: 9_999_999 }).map(String);
const ticksArb = fc.integer({ min: 1, max: 25 });

function make(worldSeed: string): { runtime: WorldRuntime; initial: ReturnType<typeof buildWorld> } {
  const initial = buildWorld(world);
  return {
    runtime: new WorldRuntime({ store: initial, rules, worldSeed, templates: TEMPLATES }),
    initial,
  };
}

const driver: IntentDriver = { candidates: DRIVER_CANDIDATES, ticks: 0 };

describe('속성: 재생', () => {
  it('사건 로그만으로 되짚은 상태가 언제나 실제 상태와 같다 (GI-01)', () => {
    fc.assert(
      fc.property(seedArb, ticksArb, (worldSeed, ticks) => {
        const { runtime, initial } = make(worldSeed);
        driveTicks(runtime, worldSeed, driver, ticks);
        expect(runtime.replayFromLog(initial).hash()).toBe(runtime.store.hash());
      }),
      RUN,
    );
  });

  it('일지를 다시 굴리면 언제나 같은 사건과 같은 상태가 나온다 (GI-12)', () => {
    fc.assert(
      fc.property(seedArb, ticksArb, (worldSeed, ticks) => {
        const { runtime, initial } = make(worldSeed);
        driveTicks(runtime, worldSeed, driver, ticks);
        const again = resimulate(initial, runtime.journal(), {
          rules,
          worldSeed,
          templates: TEMPLATES,
          untilTick: runtime.tick,
        });
        expect(again.logHash()).toBe(runtime.logHash());
        expect(again.store.hash()).toBe(runtime.store.hash());
      }),
      RUN,
    );
  });

  it('중간 스냅샷에서 이어 굴려도 통째로 굴린 것과 같은 곳에 도착한다', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 2, max: 20 }), (worldSeed, ticks) => {
        const half = Math.floor(ticks / 2);
        const whole = make(worldSeed);
        driveTicks(whole.runtime, worldSeed, driver, ticks);

        const part = make(worldSeed);
        driveTicks(part.runtime, worldSeed, driver, half);
        const resumed = WorldRuntime.restore(part.runtime.snapshot(), rules, registry, TEMPLATES);
        driveTicks(resumed, worldSeed, driver, ticks - half);

        expect(resumed.store.hash()).toBe(whole.runtime.store.hash());
        expect(resumed.logHash()).toBe(whole.runtime.logHash());
      }),
      RUN,
    );
  });

  it('스냅샷 왕복은 언제나 같은 해시다', () => {
    fc.assert(
      fc.property(seedArb, ticksArb, (worldSeed, ticks) => {
        const { runtime } = make(worldSeed);
        driveTicks(runtime, worldSeed, driver, ticks);
        const snapshot = runtime.snapshot();
        expect(WorldRuntime.restore(snapshot, rules, registry, TEMPLATES).snapshot().hash).toBe(snapshot.hash);
      }),
      RUN,
    );
  });

  it('로그는 언제나 덧붙이기만 된다', () => {
    fc.assert(
      fc.property(seedArb, ticksArb, (worldSeed, ticks) => {
        const { runtime, initial } = make(worldSeed);
        driveTicks(runtime, worldSeed, driver, ticks);
        const report = runtime.audit(initial);
        expect(report.logIsAppendOnly).toBe(true);
        expect(report.violations).toEqual([]);
        expect(report.storeIssues).toEqual([]);
      }),
      RUN,
    );
  });

  it('모든 사건은 변화를 하나 이상 담고 있다', () => {
    fc.assert(
      fc.property(seedArb, ticksArb, (worldSeed, ticks) => {
        const { runtime } = make(worldSeed);
        driveTicks(runtime, worldSeed, driver, ticks);
        for (const event of runtime.log()) {
          expect(event.stateDelta.length).toBeGreaterThan(0);
          expect(event.id).toMatch(/^event_[0-9a-f]{12}$/);
        }
      }),
      RUN,
    );
  });

  it('사건 수는 언제나 일지보다 적거나 같다 — 거부는 사건을 만들지 않는다', () => {
    fc.assert(
      fc.property(seedArb, ticksArb, (worldSeed, ticks) => {
        const { runtime } = make(worldSeed);
        driveTicks(runtime, worldSeed, driver, ticks);
        expect(runtime.log().length).toBeLessThanOrEqual(runtime.journal().length);
      }),
      RUN,
    );
  });
});
