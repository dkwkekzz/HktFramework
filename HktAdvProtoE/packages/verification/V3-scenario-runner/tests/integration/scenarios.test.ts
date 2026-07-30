import { describe, expect, it } from 'vitest';
import { runScenario } from '@hkt/v0-module-contract';
import { compileSchema } from '@hkt/v1-schema';
import { v3Scenarios } from '../../scenarios/index.js';
import { labModule, v3Module } from '../../lab/index.js';
import { V3_INPUT_SCHEMA, V3_OUTPUT_SCHEMA, executeV3 } from '../../src/module.js';
import type { V3Input } from '../../src/module.js';

describe('V3 대표 장면', () => {
  it.each(v3Scenarios.map((scenario) => [scenario.id, scenario] as const))(
    '%s — 장면이 통과하고 원문 「24」 8구획이 채워진다',
    (_id, scenario) => {
      const run = runScenario(scenario, 'V3');
      expect(run.passed, JSON.stringify(run.assertions.filter((a) => !a.passed), null, 2)).toBe(true);
      expect(run.view.purpose).not.toBe('');
      expect(run.view.input.length).toBeGreaterThan(0);
      expect(run.view.candidates.length).toBeGreaterThan(0);
      expect(run.view.result).not.toBe('');
      expect(run.view.reasons.length).toBeGreaterThan(0);
      expect(run.view.before).not.toBe('');
      expect(run.view.after).not.toBe('');
      expect(run.view.checks.length).toBe(run.assertions.length);
    },
  );

  it('Lab 이 계약의 시나리오 목록과 같은 장면을 돌린다', () => {
    expect(labModule.scenarioIds).toEqual(v3Scenarios.map((scenario) => scenario.id));
    expect(labModule.run(0n).map((run) => run.scenarioId)).toEqual(labModule.scenarioIds);
  });
});

describe('모듈 경계', () => {
  const input: V3Input = {
    scenarios: [
      {
        id: 'inline',
        title: '직접 상태로 굴리기',
        given: { state: { counter: 0 } },
        when: [{ step: 'add', params: { path: '/counter', amount: 2 } }],
        then: [{ id: 'counter_is_2', path: '/counter', op: 'equals', value: 2 }],
      },
    ],
  };

  it('입력 스키마가 계약을 강제한다', () => {
    expect(() => v3Module.validateInput(input)).not.toThrow();
    expect(() => v3Module.validateInput({ scenarios: [] })).toThrow(/minItems|최소/);
    expect(() => v3Module.validateInput({ scenarios: [{ id: 'x' }] })).toThrow();
  });

  it('출력이 자기 스키마를 지킨다', () => {
    const output = executeV3(input);
    const result = compileSchema(V3_OUTPUT_SCHEMA).validate(output);
    expect(result.issues, JSON.stringify(result.issues, null, 2)).toEqual([]);
    expect(v3Module.validateOutput(output)).toEqual([]);
  });

  it('입력·출력 스키마가 V1 로 컴파일된다', () => {
    expect(() => compileSchema(V3_INPUT_SCHEMA)).not.toThrow();
    expect(() => compileSchema(V3_OUTPUT_SCHEMA)).not.toThrow();
  });

  it('실행은 입력을 바꾸지 않는다', () => {
    const before = JSON.stringify(input);
    executeV3(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('수직 통합 시나리오', () => {
  /**
   * VS0(원문 「20」)은 V0~V4 와 K0~K3 을 함께 요구한다. K 페이즈가 없으므로 여기서 통과시킬 수 없다.
   * 다만 **장면의 형태**는 V3 의 대표 장면 `rejected_step_leaves_state_unchanged` 가 이미 돌린다 —
   * 에너지 10, 행동마다 3 소비, 네 번째는 실패, 상태 변화 없음.
   */
  it('VS0 의 장면 형태가 실행기 위에서 실제로 돈다', () => {
    const scenario = v3Scenarios.find((item) => item.id === 'rejected_step_leaves_state_unchanged');
    expect(scenario).toBeDefined();
    expect(runScenario(scenario as (typeof v3Scenarios)[number], 'V3').passed).toBe(true);
  });

  it.todo('VS0 — K0~K3 의 세계 규칙으로 다시 통과시킨다 (원문 「20」 VS0)');
});
