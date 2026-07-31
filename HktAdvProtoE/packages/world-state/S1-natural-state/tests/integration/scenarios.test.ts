import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { runScenario } from '@hkt/v0-module-contract';
import { s1Scenarios } from '../../scenarios/index.js';
import { labModule, runS1Scenarios } from '../../lab/index.js';

const contract = parseYaml(readFileSync(new URL('../../MODULE.yaml', import.meta.url), 'utf8')) as {
  id: string;
  name: string;
  scenarios: string[];
  depends_on: string[];
};

describe('S1 대표 장면', () => {
  it.each(s1Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s — 모든 단정이 통과한다',
    (_id, scenario) => {
      const run = runScenario(scenario, 'S1');
      const failed = run.assertions.filter((assertion) => !assertion.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    },
  );

  it('계약이 선언한 장면과 실제 장면이 같다', () => {
    expect(labModule.scenarioIds).toEqual(contract.scenarios);
  });

  it('원문 「24」의 여덟 구획이 모두 채워진다', () => {
    for (const run of runS1Scenarios(0n)) {
      expect(run.view.purpose).not.toBe('');
      expect(run.view.input.length).toBeGreaterThan(0);
      expect(run.view.candidates.length).toBeGreaterThan(0);
      expect(run.view.result).not.toBe('');
      expect(run.view.reasons.length).toBeGreaterThan(0);
      expect(run.view.before).not.toBe('');
      expect(run.view.after).not.toBe('');
      expect(run.view.checks.length).toBe(run.assertions.length);
    }
  });

  it('다시 실행해도 결과가 같다 (GI-12)', () => {
    const first = JSON.stringify(runS1Scenarios(0n));
    for (let run = 0; run < 3; run += 1) expect(JSON.stringify(runS1Scenarios(0n))).toBe(first);
  });
});

describe('S1 계약', () => {
  it('id·name 이 디렉터리와 같고 선행이 원문 「10」과 맞는다', () => {
    expect(contract.id).toBe('S1');
    expect(contract.name).toBe('natural-state');
    // 원문 「10」 S1 의 선행은 "K, S0" 이다.
    expect(contract.depends_on).toEqual(expect.arrayContaining(['K0', 'K1', 'K2', 'K3', 'S0']));
  });
});

describe('VS1 — 한 주체의 생존 행동 (원문 「20」)', () => {
  it('“섭취 사건 후 허기가 감소한다”는 이미 S1 에서 확인된다', () => {
    const meal = runS1Scenarios(0n).find((run) => run.scenarioId === 'a_meal_conserves_what_it_moves');
    expect(meal?.passed).toBe(true);
  });

  it.todo('VS1 전체는 U0·U1·G0~G3 이 온 뒤 tests/slices 에서 실행한다');
});
