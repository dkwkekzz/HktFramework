import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { runScenario } from '@hkt/v0-module-contract';
import { u1Scenarios } from '../../scenarios/index.js';
import { labModule, runU1Scenarios } from '../../lab/index.js';

const contract = parseYaml(readFileSync(new URL('../../MODULE.yaml', import.meta.url), 'utf8')) as {
  id: string;
  name: string;
  scenarios: string[];
  depends_on: string[];
};

describe('U1 대표 장면', () => {
  it.each(u1Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s — 모든 단정이 통과한다',
    (_id, scenario) => {
      const run = runScenario(scenario, 'U1');
      const failed = run.assertions.filter((assertion) => !assertion.passed);
      expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    },
  );

  it('계약이 선언한 장면과 실제 장면이 같다', () => {
    expect(labModule.scenarioIds).toEqual(contract.scenarios);
  });

  it('원문 「24」의 여덟 구획이 모두 채워진다', () => {
    for (const run of runU1Scenarios(0n)) {
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
    const first = JSON.stringify(runU1Scenarios(0n));
    for (let run = 0; run < 3; run += 1) expect(JSON.stringify(runU1Scenarios(0n))).toBe(first);
  });
});

describe('U1 계약', () => {
  it('id·name 이 디렉터리와 같고 선행이 원문 「11」과 맞는다', () => {
    expect(contract.id).toBe('U1');
    expect(contract.name).toBe('perception');
    // 원문 「11」 U1 의 선행은 "S0, S3, U0" 이다. S3 는 원문 「28」 6단계이므로 아직 없다.
    expect(contract.depends_on).toEqual(expect.arrayContaining(['S0', 'U0']));
    expect(contract.depends_on).not.toContain('S3');
  });
});

describe('원문 「2.4」 — 지각 모듈의 대표 장면', () => {
  it('벽 양쪽의 두 사람과 종소리가 한 화면에서 확인된다', () => {
    const scene = runU1Scenarios(0n).find(
      (run) => run.scenarioId === 'sight_and_sound_arrive_as_separate_perceptions',
    );
    expect(scene?.passed).toBe(true);
    // "브라우저의 /lab/U1-perception 페이지에서 한 번에 확인할 수 있어야 한다"
    expect(scene?.view.candidates.length).toBeGreaterThan(0);
  });
});

describe('VS1 — 한 주체의 생존 행동 (원문 「20」)', () => {
  it('“음식을 보기 전에는 알 수 없다”의 앞 절이 여기서 선다', () => {
    const scene = runU1Scenarios(0n).find(
      (run) => run.scenarioId === 'the_world_does_not_hand_its_events_to_everyone',
    );
    expect(scene?.passed).toBe(true);
  });

  it.todo('VS1 전체는 G0~G3 이 온 뒤 tests/slices 에서 실행한다');
});
