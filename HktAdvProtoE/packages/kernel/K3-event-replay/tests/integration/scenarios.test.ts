import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { runScenario } from '@hkt/v0-module-contract';
import { k3Scenarios } from '../../scenarios/index.js';
import { labModule, runK3Scenarios } from '../../lab/index.js';

const contract = parseYaml(readFileSync(new URL('../../MODULE.yaml', import.meta.url), 'utf8')) as {
  id: string;
  name: string;
  scenarios: string[];
  depends_on: string[];
};

describe('K3 대표 장면', () => {
  it.each(k3Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s — 모든 단정이 통과한다',
    (_id, scenario) => {
      const run = runScenario(scenario, 'K3');
      const failed = run.assertions.filter((assertion) => !assertion.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    },
    30_000,
  );

  it('계약이 선언한 장면과 실제 장면이 같다', () => {
    expect(labModule.scenarioIds).toEqual(contract.scenarios);
  });

  it(
    '원문 「24」의 여덟 구획이 모두 채워진다',
    () => {
      for (const run of runK3Scenarios(0n)) {
        expect(run.view.purpose).not.toBe('');
        expect(run.view.input.length).toBeGreaterThan(0);
        expect(run.view.candidates.length).toBeGreaterThan(0);
        expect(run.view.result).not.toBe('');
        expect(run.view.reasons.length).toBeGreaterThan(0);
        expect(run.view.before).not.toBe('');
        expect(run.view.after).not.toBe('');
        expect(run.view.checks.length).toBe(run.assertions.length);
      }
    },
    30_000,
  );

  it(
    '다시 실행해도 결과가 같다 (GI-12)',
    () => {
      const first = JSON.stringify(runK3Scenarios(0n));
      expect(JSON.stringify(runK3Scenarios(0n))).toBe(first);
    },
    60_000,
  );
});

describe('K3 계약', () => {
  it('id·name 이 디렉터리와 같고 선행이 원문 「9」와 맞는다', () => {
    expect(contract.id).toBe('K3');
    expect(contract.name).toBe('event-replay');
    expect(contract.depends_on).toEqual(expect.arrayContaining(['K0', 'K1', 'K2', 'V2']));
  });
});
