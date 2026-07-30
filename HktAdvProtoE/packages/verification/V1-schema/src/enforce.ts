import type { ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import { compileSchema, type CompileOptions } from './compile.js';
import { display } from './pointer.js';
import {
  SchemaValidationError,
  type JsonSchema,
  type SchemaIssue,
  type Validator,
} from './types.js';

/**
 * 모듈 경계에서 계약을 강제한다 — V1 의 목적("입력·출력 데이터가 계약을 지키도록 강제한다")이
 * 실제로 쓰이는 지점이다.
 */

/** 스키마를 통과하면 그대로 돌려주고, 어기면 경로가 담긴 예외를 던진다. */
export function guardInput<T>(
  schema: JsonSchema,
  label: string,
  options: CompileOptions = {},
): (input: unknown) => T {
  const validator = compileSchema(schema, options);
  return (input: unknown): T => {
    const result = validator.validate(input);
    if (!result.valid) throw new SchemaValidationError(label, result.issues);
    return input as T;
  };
}

/** 출력 검증용 — 예외 대신 V0 의 `VerificationIssue` 목록으로 변환한다. */
export function toVerificationIssues(
  issues: readonly SchemaIssue[],
  label: string,
): VerificationIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    path: `${label}${display(issue.instancePath)}`,
    message: `${issue.message} (스키마 ${issue.schemaPath})`,
  }));
}

export interface EnforceOptions<Input, Output> {
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  compile?: CompileOptions;
  /** 스키마 검증 뒤에 남는 모듈 고유 검사 — 스키마로 표현할 수 없는 조건에 쓴다. */
  extraOutputChecks?: (output: Output) => VerificationIssue[];
  /** 스키마 검증 뒤에 남는 입력 정규화 — 통과한 값에만 적용된다. */
  normalizeInput?: (input: Input) => Input;
}

/**
 * 기존 ModuleDefinition 의 validateInput/validateOutput 을 스키마 검증으로 대체한다.
 * 모듈 코드가 손으로 쓴 타입 검사를 반복하지 않게 하는 것이 목적이다.
 */
export function enforceSchemas<Input, Output>(
  definition: ModuleDefinition<Input, Output>,
  options: EnforceOptions<Input, Output>,
): ModuleDefinition<Input, Output> {
  const inputGuard = guardInput<Input>(
    options.inputSchema,
    `${definition.id} 입력`,
    options.compile ?? {},
  );
  const outputValidator: Validator = compileSchema(options.outputSchema, options.compile ?? {});

  return {
    ...definition,
    validateInput: (input: unknown): Input => {
      const checked = inputGuard(input);
      return options.normalizeInput ? options.normalizeInput(checked) : checked;
    },
    validateOutput: (output: Output): VerificationIssue[] => [
      ...toVerificationIssues(outputValidator.validate(output).issues, `${definition.id} 출력`),
      ...(options.extraOutputChecks?.(output) ?? []),
    ],
  };
}
