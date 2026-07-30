import { sha256Tagged } from '@hkt/v0-module-contract';
import type { ModuleContext, ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import { canonicalJson, enforceSchemas, type JsonSchema } from '@hkt/v1-schema';
import { FixtureError, FixtureLoader } from './fixture.js';
import { diffStates } from './json.js';
import { ScenarioRunner } from './runner.js';
import inputSchema from '../schemas/v3-input.schema.json';
import outputSchema from '../schemas/v3-output.schema.json';
import type { Fixture, RunIssue, ScenarioReport, ScenarioSpec } from './types.js';

export interface V3Input {
  /** 등록할 픽스처. 시나리오의 `given.fixture` 가 이 id 를 가리킨다. */
  fixtures?: Fixture[];
  /** 픽스처 검증에 쓸 스키마 문서 */
  schemas?: JsonSchema[];
  scenarios: ScenarioSpec[];
}

export interface V3Output {
  reports: ScenarioReport[];
  /** 등록된 단계 id — 시나리오가 쓸 수 있는 어휘 */
  stepIds: string[];
  /** 적재 단계에서 거부된 픽스처·스키마의 사유 (경로 포함) */
  fixtureIssues: RunIssue[];
  passed: boolean;
  digest: string;
}

export const V3_VERSION = '0.1.0';

export const V3_PURPOSE =
  'Given-When-Then 시나리오를 결정적으로 실행하고, 실패한 조건마다 그 값의 전후 상태와 그것을 바꾼 단계를 함께 보고한다.';

export const V3_INPUT_SCHEMA = inputSchema as JsonSchema;
export const V3_OUTPUT_SCHEMA = outputSchema as JsonSchema;

/**
 * 픽스처를 등록하고 시나리오를 선언 순서대로 굴린다.
 *
 * 적재에 실패한 픽스처는 예외로 올리지 않고 `fixtureIssues` 로 보고한다 — 그 픽스처를 가리키는
 * 시나리오는 자동으로 `E_UNKNOWN_FIXTURE` 로 거부되므로, 나머지 시나리오의 판정을 잃지 않으면서도
 * 잘못된 초기 상태로 굴러가는 일은 생기지 않는다.
 */
export function executeV3(input: V3Input): V3Output {
  const fixtures = new FixtureLoader();
  const fixtureIssues: RunIssue[] = [];

  for (const schema of input.schemas ?? []) {
    try {
      fixtures.addSchema(schema);
    } catch (error) {
      const compileError = error as { code?: string; schemaPath?: string; message: string };
      fixtureIssues.push({
        code: compileError.code ?? 'E_SCHEMA_REGISTER_FAILED',
        path: `/schemas${compileError.schemaPath ?? ''}`,
        message: compileError.message,
      });
    }
  }
  for (const fixture of input.fixtures ?? []) {
    try {
      fixtures.add(fixture);
    } catch (error) {
      if (!(error instanceof FixtureError)) throw error;
      fixtureIssues.push(...error.issues);
    }
  }

  const runner = new ScenarioRunner({ fixtures });
  const reports = runner.runAll(input.scenarios);

  return {
    reports,
    stepIds: runner.stepIds(),
    fixtureIssues,
    passed: fixtureIssues.length === 0 && reports.every((report) => report.passed),
    digest: sha256Tagged(
      canonicalJson({ reports: reports.map((report) => report.digest), fixtureIssues }),
    ),
  };
}

/**
 * 출력만 보고 판정할 수 있는 불변조건.
 *
 * 형식은 `schemas/v3-output.schema.json` 이 맡으므로, 여기에는 스키마로 표현할 수 없는 것만 남긴다.
 * 핵심은 **보고가 스스로에 대해 거짓말하지 못하게** 하는 것이다 — 기록된 변경 목록이 실제 전후 차이와
 * 다르면, 그 보고를 근거로 한 모든 판정이 무의미해진다.
 */
export function checkOutputConsistency(output: V3Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `V3 출력/${path}`, message });
  };

  output.reports.forEach((report, index) => {
    // 실행 전에 거부된 명세는 단계를 하나도 굴리지 않아야 한다
    if (report.issues.length > 0 && report.transitions.length > 0) {
      at(
        `reports/${index}`,
        'E_INVARIANT_rejected_spec_must_not_execute',
        `거부 ${report.issues.length}건인데 단계가 ${report.transitions.length}개 실행되었다.`,
      );
    }

    for (const transition of report.transitions) {
      // 규칙이 막은 단계는 상태를 전혀 바꾸지 않는다 (VS0 의 "네 번째 행동" 형태)
      if (transition.rejection && transition.changes.length > 0) {
        at(
          `reports/${index}/transitions/${transition.index}`,
          'E_INVARIANT_rejected_step_must_not_change_state',
          `\`${transition.step}\` 이 거부되었는데 ${transition.changes.length}곳이 바뀌었다.`,
        );
      }
      if (
        canonicalJson(transition.changes) !== canonicalJson(diffStates(transition.before, transition.after))
      ) {
        at(
          `reports/${index}/transitions/${transition.index}/changes`,
          'E_INVARIANT_changes_must_match_before_after',
          '기록된 변경 목록이 실제 전후 차이와 다르다.',
        );
      }
    }

    // 전후 값과 원인 지목은 서로 어긋날 수 없다 (원문 「8」 V3 직관 검증의 근거)
    for (const condition of report.conditions) {
      if (condition.blame === null && canonicalJson(condition.before) !== canonicalJson(condition.after)) {
        at(
          `reports/${index}/conditions/${condition.id}`,
          'E_INVARIANT_changed_value_must_have_a_blamed_step',
          `${condition.path} 가 ${canonicalJson(condition.before)} 에서 ${canonicalJson(condition.after)} 로 바뀌었는데 바꾼 단계가 없다.`,
        );
      }
      if (condition.blame !== null && !report.transitions.some((t) => t.index === condition.blame?.index)) {
        at(
          `reports/${index}/conditions/${condition.id}`,
          'E_INVARIANT_blame_must_point_at_an_executed_step',
          `${condition.blame.index}번 단계를 지목했는데 그런 단계가 없다.`,
        );
      }
    }

    const failed = report.conditions.filter((condition) => !condition.passed);
    if (report.passed && (failed.length > 0 || report.stoppedAt !== null)) {
      at(
        `reports/${index}/passed`,
        'E_INVARIANT_passed_must_agree_with_conditions',
        `passed=true 인데 실패 조건 ${failed.length}건 · stoppedAt=${report.stoppedAt}`,
      );
    }
  });

  return issues;
}

export function createV3Module(
  scenarios: ModuleDefinition<V3Input, V3Output>['scenarios'],
): ModuleDefinition<V3Input, V3Output> {
  return enforceSchemas<V3Input, V3Output>(
    {
      id: 'V3',
      version: V3_VERSION,
      purpose: V3_PURPOSE,
      dependencies: ['V0', 'V1', 'V2'],
      validateInput: (input: unknown) => input as V3Input,
      execute: (input: V3Input, _context: ModuleContext) => executeV3(input),
      validateOutput: () => [],
      scenarios,
    },
    {
      inputSchema: V3_INPUT_SCHEMA,
      outputSchema: V3_OUTPUT_SCHEMA,
      extraOutputChecks: checkOutputConsistency,
    },
  );
}

export type { ScenarioReport };
