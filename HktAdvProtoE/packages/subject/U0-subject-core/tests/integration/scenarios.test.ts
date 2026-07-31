import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { runScenario } from '@hkt/v0-module-contract';
import { u0Scenarios } from '../../scenarios/index.js';
import { labModule, runU0Scenarios } from '../../lab/index.js';

const contract = parseYaml(readFileSync(new URL('../../MODULE.yaml', import.meta.url), 'utf8')) as {
  id: string;
  name: string;
  scenarios: string[];
  depends_on: string[];
};

describe('U0 대표 장면', () => {
  it.each(u0Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s — 모든 단정이 통과한다',
    (_id, scenario) => {
      const run = runScenario(scenario, 'U0');
      const failed = run.assertions.filter((assertion) => !assertion.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    },
  );

  it('계약이 선언한 장면과 실제 장면이 같다', () => {
    expect(labModule.scenarioIds).toEqual(contract.scenarios);
  });

  it('원문 「24」의 여덟 구획이 모두 채워진다', () => {
    for (const run of runU0Scenarios(0n)) {
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
    const first = JSON.stringify(runU0Scenarios(0n));
    for (let run = 0; run < 3; run += 1) expect(JSON.stringify(runU0Scenarios(0n))).toBe(first);
  });
});

describe('U0 계약', () => {
  it('id·name 이 디렉터리와 같고 선행이 원문 「11」과 맞는다', () => {
    expect(contract.id).toBe('U0');
    expect(contract.name).toBe('subject-core');
    // 원문 「11」 U0 의 선행은 "K, S" 다. 지금 존재하는 S 는 S0·S1 이다.
    expect(contract.depends_on).toEqual(
      expect.arrayContaining(['K0', 'K1', 'K2', 'K3', 'S0', 'S1']),
    );
  });
});

describe('VS1 — 한 주체의 생존 행동 (원문 「20」)', () => {
  it('“섭취 사건 후 허기가 감소한다”는 주체의 욕구까지 이어진다', () => {
    const meal = runU0Scenarios(0n).find(
      (run) => run.scenarioId === 'the_body_pushes_the_need_up_and_feeding_lets_it_fall',
    );
    expect(meal?.passed).toBe(true);
  });

  it.todo('VS1 전체는 U1·G0~G3 이 온 뒤 tests/slices 에서 실행한다');
});
