import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { runScenario } from '@hkt/v0-module-contract';
import { buildRegistry } from '@hkt/v0-module-contract';
import { k0Scenarios } from '../../scenarios/index.js';
import { labModule, runK0Scenarios } from '../../lab/index.js';

const contractPath = new URL('../../MODULE.yaml', import.meta.url);
const contract = parseYaml(readFileSync(contractPath, 'utf8')) as {
  id: string;
  name: string;
  scenarios: string[];
  depends_on: string[];
};

describe('K0 대표 장면', () => {
  it.each(k0Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s — 모든 단정이 통과한다',
    (_id, scenario) => {
      const run = runScenario(scenario, 'K0');
      const failed = run.assertions.filter((assertion) => !assertion.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    },
  );

  it('계약이 선언한 장면과 실제 장면이 같다', () => {
    expect(labModule.scenarioIds).toEqual(contract.scenarios);
  });

  it('원문 「24」의 여덟 구획이 모두 채워진다', () => {
    for (const run of runK0Scenarios(0n)) {
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
    const first = JSON.stringify(runK0Scenarios(0n));
    for (let run = 0; run < 5; run += 1) expect(JSON.stringify(runK0Scenarios(0n))).toBe(first);
  });
});

describe('K0 계약', () => {
  it('V0 이 거부 없이 등록한다', () => {
    const report = buildRegistry([
      {
        path: 'packages/kernel/K0-entity-state/MODULE.yaml',
        text: readFileSync(contractPath, 'utf8'),
      },
    ]);
    // 선행(V0·V1)은 이 문서 하나만 넣었으므로 미등록으로 잡히는 것이 정상이다.
    const codes = report.issues.map((issue) => issue.code);
    expect(codes.every((code) => code === 'E_UNKNOWN_DEPENDENCY')).toBe(true);
  });

  it('id·name 이 디렉터리와 같다', () => {
    expect(contract.id).toBe('K0');
    expect(contract.name).toBe('entity-state');
  });

  it('선행이 원문 「9」의 K 페이즈 순서를 벗어나지 않는다', () => {
    expect(contract.depends_on.every((id) => id.startsWith('V'))).toBe(true);
  });
});

describe('VS0 — 결정적 세계 변화 (원문 「20」)', () => {
  it.todo('VS0 전체는 K3 이 온 뒤 tests/slices/vs0 에서 실행한다');
});
