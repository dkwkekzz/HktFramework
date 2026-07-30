import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '@hkt/v1-schema';
import { FixtureLoader } from '../../src/fixture.js';
import { ScenarioRunner } from '../../src/runner.js';
import { diffStates } from '../../src/json.js';
import type { JsonObject, ScenarioSpec, StepCall } from '../../src/types.js';

/**
 * 속성 테스트 — 시드를 고정한다 (원문 「22」 6단계 · 체크리스트 5절).
 * 무작위로 지은 단계 열에서도 실행기의 불변조건이 유지되는지 본다.
 */
const RUN_OPTIONS = { seed: 20260730, numRuns: 500, verbose: false } as const;

const fixture = {
  id: 'scene',
  title: '무작위 장면',
  state: { actor: { energy: 12 }, log: [] } as JsonObject,
};

function runner(): ScenarioRunner {
  return new ScenarioRunner({ fixtures: new FixtureLoader().add(fixture) });
}

const stepArb: fc.Arbitrary<StepCall> = fc.oneof(
  fc
    .integer({ min: 1, max: 9 })
    .map((amount) => ({ step: 'consume', params: { path: '/actor/energy', amount } })),
  fc.integer({ min: -5, max: 5 }).map((amount) => ({ step: 'add', params: { path: '/actor/energy', amount } })),
  fc.constant({ step: 'append', params: { path: '/log', value: 'x' } }),
  fc.constant({ step: 'record_event', params: { path: '/log', kind: 'acted' } }),
  fc
    .integer({ min: 0, max: 50 })
    .map((min) => ({ step: 'roll', params: { path: '/actor/energy', min, max: min + 10 } })),
);

const specArb: fc.Arbitrary<ScenarioSpec> = fc
  .tuple(fc.array(stepArb, { minLength: 0, maxLength: 12 }), fc.integer({ min: 0, max: 1_000_000 }))
  .map(([when, seed]) => ({
    id: 'random_scene',
    title: '무작위 단계 열',
    given: { fixture: 'scene' },
    when,
    then: [{ id: 'energy_present', path: '/actor/energy', op: 'present' as const }],
    seed: { worldSeed: String(seed), subjectId: 'npc' },
  }));

describe('시나리오 실행기의 불변조건', () => {
  it('Given 상태는 어떤 단계 열에서도 바뀌지 않는다', () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        const report = runner().run(spec);
        expect(report.given).toEqual(fixture.state);
      }),
      RUN_OPTIONS,
    );
  });

  it('거부된 단계는 상태를 전혀 바꾸지 않는다', () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        for (const transition of runner().run(spec).transitions) {
          if (!transition.rejection) continue;
          expect(transition.changes).toEqual([]);
          expect(canonicalJson(transition.before)).toBe(canonicalJson(transition.after));
        }
      }),
      RUN_OPTIONS,
    );
  });

  it('기록된 변경 목록은 실제 전후 차이와 언제나 같다', () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        for (const transition of runner().run(spec).transitions) {
          expect(transition.changes).toEqual(diffStates(transition.before, transition.after));
        }
      }),
      RUN_OPTIONS,
    );
  });

  it('같은 명세를 다시 굴리면 같은 digest 가 나온다 (GI-12)', () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        expect(runner().run(spec).digest).toBe(runner().run(spec).digest);
      }),
      RUN_OPTIONS,
    );
  });

  it('실패한 조건에는 언제나 전후 값이 붙어 있다', () => {
    fc.assert(
      fc.property(specArb, fc.integer({ min: -100, max: 100 }), (spec, expected) => {
        const report = runner().run({
          ...spec,
          then: [{ id: 'energy_equals', path: '/actor/energy', op: 'equals', value: expected }],
        });
        const condition = report.conditions[0];
        expect(condition).toBeDefined();
        expect(condition?.before).toBe(12);
        if (condition?.passed === false) {
          expect(condition.after).not.toBe(expected);
        }
      }),
      RUN_OPTIONS,
    );
  });

  it('에너지는 소비 규칙 아래에서 음수가 되지 않는다', () => {
    fc.assert(
      fc.property(
        fc
          .array(
            fc.integer({ min: 1, max: 9 }).map((amount) => ({
              step: 'consume',
              params: { path: '/actor/energy', amount },
            })),
            { minLength: 0, maxLength: 12 },
          )
          .map(
            (when): ScenarioSpec => ({
              id: 'consume_only',
              title: '소비만',
              given: { fixture: 'scene' },
              when,
              then: [{ id: 'never_negative', path: '/actor/energy', op: 'atLeast', value: 0 }],
            }),
          ),
        (spec) => {
          const report = runner().run(spec);
          expect(report.conditions[0]?.passed).toBe(true);
        },
      ),
      RUN_OPTIONS,
    );
  });
});
