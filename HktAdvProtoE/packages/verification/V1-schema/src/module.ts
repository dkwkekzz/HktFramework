import type { ModuleContext, ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import { compileSchema } from './compile.js';
import { enforceSchemas } from './enforce.js';
import { SchemaCompileError, type JsonSchema, type SchemaIssue } from './types.js';
import inputSchema from '../schemas/v1-input.schema.json';
import outputSchema from '../schemas/v1-output.schema.json';

export interface V1Instance {
  label: string;
  data: unknown;
}

export interface V1Input {
  schemaLabel?: string;
  schema: JsonSchema;
  instances: V1Instance[];
}

export interface V1InstanceResult {
  label: string;
  valid: boolean;
  issues: SchemaIssue[];
}

export interface V1Output {
  results: V1InstanceResult[];
  validCount: number;
  invalidCount: number;
  compileError: { code: string; schemaPath: string; message: string } | null;
}

export const V1_VERSION = '0.1.0';

export const V1_PURPOSE =
  '모듈의 입력·출력 데이터가 선언된 스키마를 지키도록 런타임에 강제하고, 어긋난 값은 JSON Pointer 경로와 함께 거부한다.';

export const V1_INPUT_SCHEMA = inputSchema as JsonSchema;
export const V1_OUTPUT_SCHEMA = outputSchema as JsonSchema;

/** 스키마 하나로 인스턴스 여러 개를 판정한다. 스키마가 컴파일되지 않으면 compileError 로 보고한다. */
export function executeV1(input: V1Input): V1Output {
  let validate: ((data: unknown) => SchemaIssue[]) | null = null;
  let compileError: V1Output['compileError'] = null;

  try {
    const validator = compileSchema(input.schema);
    validate = (data) => [...validator.validate(data).issues];
  } catch (error) {
    if (!(error instanceof SchemaCompileError)) throw error;
    compileError = { code: error.code, schemaPath: error.schemaPath, message: error.message };
  }

  if (!validate) {
    return { results: [], validCount: 0, invalidCount: 0, compileError };
  }

  const results = input.instances.map((instance) => {
    const issues = validate(instance.data);
    return { label: instance.label, valid: issues.length === 0, issues };
  });

  return {
    results,
    validCount: results.filter((result) => result.valid).length,
    invalidCount: results.filter((result) => !result.valid).length,
    compileError: null,
  };
}

/**
 * V1 의 ModuleDefinition.
 *
 * 입력·출력 검증을 V1 자신의 스키마로 처리한다 — 모듈의 목적을 자기 자신에게 먼저 적용한 것이다.
 */
export function createV1Module(
  scenarios: ModuleDefinition<V1Input, V1Output>['scenarios'],
): ModuleDefinition<V1Input, V1Output> {
  const base: ModuleDefinition<V1Input, V1Output> = {
    id: 'V1',
    version: V1_VERSION,
    purpose: V1_PURPOSE,
    dependencies: ['V0'],
    validateInput: (input: unknown) => input as V1Input,
    execute: (input: V1Input, _context: ModuleContext) => executeV1(input),
    validateOutput: () => [],
    scenarios,
  };

  return enforceSchemas(base, {
    inputSchema: V1_INPUT_SCHEMA,
    outputSchema: V1_OUTPUT_SCHEMA,
    extraOutputChecks: checkOutputConsistency,
  });
}

/** 스키마로는 표현할 수 없는 조건 — 필드 사이의 일관성. */
export function checkOutputConsistency(output: V1Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  output.results.forEach((result, index) => {
    if (result.valid !== (result.issues.length === 0)) {
      issues.push({
        code: 'E_INVARIANT_valid_flag_must_match_issue_count',
        path: `V1 출력/results/${index}`,
        message: `valid=${result.valid} 인데 위반이 ${result.issues.length} 건이다.`,
      });
    }
  });

  const valid = output.results.filter((result) => result.valid).length;
  if (output.validCount !== valid || output.invalidCount !== output.results.length - valid) {
    issues.push({
      code: 'E_INVARIANT_counts_must_match_results',
      path: 'V1 출력/validCount',
      message: `집계가 결과와 다르다. valid ${output.validCount}/${valid} · invalid ${output.invalidCount}/${output.results.length - valid}`,
    });
  }

  if (output.compileError !== null && output.results.length > 0) {
    issues.push({
      code: 'E_INVARIANT_compile_error_must_stop_validation',
      path: 'V1 출력/compileError',
      message: '스키마 컴파일이 실패했는데 인스턴스 판정 결과가 남아 있다.',
    });
  }

  return issues;
}
