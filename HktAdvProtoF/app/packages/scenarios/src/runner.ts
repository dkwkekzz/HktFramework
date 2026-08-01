// V2 시나리오 실행기 — 대표 장면을 자동 실행하고, 실패하면 고칠 수 있는 형태로 보고한다.
//
// 실패 보고에는 원문 V2 가 요구하는 다섯 가지가 반드시 담긴다:
//   초기 상태 / 실행된 입력 / 기대 결과 / 실제 결과 / 최초로 달라진 상태 경로

import { compareBy, compareChain, compareStrings, stableSort, stateHash } from '@hkt/core/v1';

import { firstDivergentPath } from './diff.ts';
import type { Assertion, AnyScenario, Scenario, ScenarioKind } from './scenario.ts';

/** 한 시나리오의 실행 결과 — 그대로 직렬화해 증거·Lab 으로 넘긴다. */
export interface ScenarioResult {
  readonly scenarioId: string;
  readonly module: string;
  readonly kind: ScenarioKind;
  readonly purpose: string;
  readonly passed: boolean;
  /** arrange 결과 */
  readonly initialState: unknown;
  /** 실행된 입력 (선언 없으면 초기 상태) */
  readonly input: unknown;
  /** act 결과. 던져졌으면 null */
  readonly output: unknown;
  readonly assertions: readonly Assertion[];
  readonly initialStateHash: string | null;
  readonly outputHash: string | null;
  /** 실패 사유 요약 — 통과했으면 null */
  readonly failure: ScenarioFailure | null;
}

/** 실패 요약 — 무엇이 어디서 어긋났는가. */
export interface ScenarioFailure {
  readonly reason: 'assertion' | 'threw' | 'no-assertion';
  readonly label: string;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly firstDivergentPath: string | null;
}

/** 여러 시나리오의 실행 결과. */
export interface SuiteResult {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly ScenarioResult[];
  /** 모듈별 종류 커버리지 — 정상·실패·경계가 다 있는가 */
  readonly coverage: readonly ModuleCoverage[];
}

/** 모듈 하나의 시나리오 커버리지. */
export interface ModuleCoverage {
  readonly module: string;
  readonly normal: number;
  readonly failure: number;
  readonly boundary: number;
  /** 세 종류가 모두 있고 전부 통과했는가 — 모듈 완료(VERIFIED)의 필요조건 */
  readonly complete: boolean;
}

function safeHash(value: unknown): string | null {
  try {
    return stateHash(value);
  } catch {
    return null;
  }
}

/** 시나리오 하나를 실행한다. 던져진 예외도 결과로 환원한다 — 실행기는 스스로 죽지 않는다. */
export function runScenario<TState, TResult>(
  scenario: Scenario<TState, TResult>,
): ScenarioResult {
  const base = {
    scenarioId: scenario.id,
    module: scenario.module,
    kind: scenario.kind,
    purpose: scenario.purpose,
  } as const;

  let state: TState;
  try {
    state = scenario.arrange();
  } catch (error) {
    return {
      ...base,
      passed: false,
      initialState: null,
      input: null,
      output: null,
      assertions: [],
      initialStateHash: null,
      outputHash: null,
      failure: threw('arrange 가 던졌다', error),
    };
  }

  const input = scenario.input === undefined ? state : scenario.input(state);

  let output: TResult;
  try {
    output = scenario.act(state);
  } catch (error) {
    return {
      ...base,
      passed: false,
      initialState: state,
      input,
      output: null,
      assertions: [],
      initialStateHash: safeHash(state),
      outputHash: null,
      failure: threw('act 가 던졌다', error),
    };
  }

  let assertions: readonly Assertion[];
  try {
    assertions = scenario.assert(output, state);
  } catch (error) {
    return {
      ...base,
      passed: false,
      initialState: state,
      input,
      output,
      assertions: [],
      initialStateHash: safeHash(state),
      outputHash: safeHash(output),
      failure: threw('assert 가 던졌다', error),
    };
  }

  const failed = assertions.find((assertion) => !assertion.passed);
  // 단언이 하나도 없는 시나리오는 통과가 아니다 — 검증 없는 완료를 막는다 (원문 V0/V4 정신).
  const failure: ScenarioFailure | null =
    assertions.length === 0
      ? {
          reason: 'no-assertion',
          label: '단언이 하나도 없다',
          expected: '단언 1개 이상',
          actual: '0개',
          firstDivergentPath: null,
        }
      : failed === undefined
        ? null
        : {
            reason: 'assertion',
            label: failed.label,
            expected: failed.expected,
            actual: failed.actual,
            firstDivergentPath:
              failed.firstDivergentPath ?? firstDivergentPath(failed.expected, failed.actual),
          };

  return {
    ...base,
    passed: failure === null,
    initialState: state,
    input,
    output,
    assertions,
    initialStateHash: safeHash(state),
    outputHash: safeHash(output),
    failure,
  };
}

function threw(label: string, error: unknown): ScenarioFailure {
  return {
    reason: 'threw',
    label,
    expected: '정상 실행',
    actual: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    firstDivergentPath: null,
  };
}

/** 여러 시나리오를 실행한다. 실행 순서는 (모듈, 종류, ID) 안정 정렬로 고정된다. */
export function runScenarios(scenarios: readonly AnyScenario[]): SuiteResult {
  const kindOrder: Record<ScenarioKind, number> = { normal: 0, failure: 1, boundary: 2 };
  const ordered = stableSort(
    scenarios,
    compareChain<AnyScenario>(
      (a, b) => compareStrings(a.module, b.module),
      compareBy((scenario) => kindOrder[scenario.kind]),
      (a, b) => compareStrings(a.id, b.id),
    ),
  );

  const results = ordered.map((scenario) => runScenario(scenario));
  const passed = results.filter((result) => result.passed).length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
    coverage: coverageOf(results),
  };
}

/** 모듈별 시나리오 커버리지 — 정상·실패·경계가 다 있고 전부 통과해야 complete. */
export function coverageOf(results: readonly ScenarioResult[]): ModuleCoverage[] {
  const modules = [...new Set(results.map((result) => result.module))].sort(compareStrings);
  return modules.map((module) => {
    const own = results.filter((result) => result.module === module);
    const count = (kind: ScenarioKind): number =>
      own.filter((result) => result.kind === kind).length;
    const normal = count('normal');
    const failure = count('failure');
    const boundary = count('boundary');
    return {
      module,
      normal,
      failure,
      boundary,
      complete:
        normal > 0 && failure > 0 && boundary > 0 && own.every((result) => result.passed),
    };
  });
}
