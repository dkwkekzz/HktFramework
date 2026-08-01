// V2 결과 요약 — 실행 결과를 항상 직렬화 가능한 형태로 접는다.
//
// 시나리오의 초기 상태·결과는 임의의 값이다. 규칙상 직렬화 가능해야 하지만(원칙 ③),
// 위반한 장면도 실행기는 끝까지 돌린다 — 그 결과를 증거 파일이나 Lab 으로 넘기려면
// 원본이 아니라 "요약" 이 필요하다. 요약은 언제나 해시 가능하다.

import { preview } from './diff.ts';
import type { ModuleCoverage, ScenarioResult, SuiteResult } from './runner.ts';
import type { ScenarioKind } from './scenario.ts';

/** 단언 하나의 요약 — 기대·실제는 한 줄 미리보기로 접는다. */
export interface AssertionDigest {
  readonly label: string;
  readonly passed: boolean;
  readonly expected: string;
  readonly actual: string;
  readonly firstDivergentPath: string | null;
}

/** 시나리오 하나의 요약. */
export interface ScenarioDigest {
  readonly scenarioId: string;
  readonly module: string;
  readonly kind: ScenarioKind;
  readonly passed: boolean;
  readonly initialStateHash: string | null;
  readonly outputHash: string | null;
  /** 상태 원소 규칙(직렬화 가능)을 지켰는가 — 해시가 null 이면 위반이다. */
  readonly serializableState: boolean;
  readonly assertions: readonly AssertionDigest[];
  readonly failure: {
    readonly reason: string;
    readonly label: string;
    readonly expected: string;
    readonly actual: string;
    readonly firstDivergentPath: string | null;
  } | null;
}

/** 스위트 전체 요약. */
export interface SuiteDigest {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly coverage: readonly ModuleCoverage[];
  readonly results: readonly ScenarioDigest[];
}

/** 시나리오 결과를 직렬화 가능한 요약으로 접는다. */
export function digestResult(result: ScenarioResult): ScenarioDigest {
  return {
    scenarioId: result.scenarioId,
    module: result.module,
    kind: result.kind,
    passed: result.passed,
    initialStateHash: result.initialStateHash,
    outputHash: result.outputHash,
    serializableState: result.initialStateHash !== null && result.outputHash !== null,
    assertions: result.assertions.map((assertion) => ({
      label: assertion.label,
      passed: assertion.passed,
      expected: preview(assertion.expected),
      actual: preview(assertion.actual),
      firstDivergentPath: assertion.firstDivergentPath,
    })),
    failure:
      result.failure === null
        ? null
        : {
            reason: result.failure.reason,
            label: result.failure.label,
            expected: preview(result.failure.expected),
            actual: preview(result.failure.actual),
            firstDivergentPath: result.failure.firstDivergentPath,
          },
  };
}

/** 스위트 결과를 직렬화 가능한 요약으로 접는다. */
export function digestSuite(suite: SuiteResult): SuiteDigest {
  return {
    total: suite.total,
    passed: suite.passed,
    failed: suite.failed,
    coverage: suite.coverage,
    results: suite.results.map((result) => digestResult(result)),
  };
}
