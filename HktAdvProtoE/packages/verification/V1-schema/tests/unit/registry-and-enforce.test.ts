import { describe, expect, it } from 'vitest';
import { createV0Module } from '@hkt/v0-module-contract';
import { v0Scenarios } from '@hkt/v0-module-contract/scenarios';
import { healthySet } from '../../../V0-module-contract/scenarios/fixtures.js';
import { SchemaRegistry, canonicalJson } from '../../src/registry.js';
import { enforceSchemas, guardInput, toVerificationIssues } from '../../src/enforce.js';
import { checkOutputConsistency, executeV1, V1_INPUT_SCHEMA, V1_OUTPUT_SCHEMA, createV1Module } from '../../src/module.js';
import { SchemaCompileError, SchemaValidationError, type JsonSchema } from '../../src/types.js';
import { v1Scenarios } from '../../scenarios/index.js';

const ENTITY_SCHEMA: JsonSchema = {
  $id: 'https://hkt.local/schemas/test-entity.json',
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'string' } },
};

const WRAPPER_SCHEMA: JsonSchema = {
  $id: 'https://hkt.local/schemas/test-wrapper.json',
  type: 'object',
  required: ['entity'],
  properties: { entity: { $ref: 'https://hkt.local/schemas/test-entity.json#' } },
};

describe('SchemaRegistry', () => {
  it('$id 로 등록하고 문서 간 $ref 를 해결한다', () => {
    const registry = new SchemaRegistry().add(ENTITY_SCHEMA).add(WRAPPER_SCHEMA);
    const validator = registry.validator('https://hkt.local/schemas/test-wrapper.json');
    expect(validator.validate({ entity: { id: 'e0' } }).valid).toBe(true);

    const result = validator.validate({ entity: { id: 1 } });
    expect(result.issues[0]?.instancePath).toBe('/entity/id');
    // 외부 문서의 조건은 스키마 경로에 문서 $id 가 함께 남는다
    expect(result.issues[0]?.schemaPath).toBe(
      'https://hkt.local/schemas/test-entity.json#/properties/id/type',
    );
  });

  it('$id 없는 문서는 등록을 거부한다', () => {
    expect(() => new SchemaRegistry().add({ type: 'object' })).toThrow(SchemaCompileError);
  });

  it('같은 $id 로 다른 내용을 등록하면 거부한다', () => {
    const registry = new SchemaRegistry().add(ENTITY_SCHEMA);
    expect(() => registry.add({ ...ENTITY_SCHEMA, type: 'array' })).toThrow(/E_DUPLICATE_SCHEMA_ID/);
    // 같은 내용 재등록은 허용한다 (멱등)
    expect(() => registry.add({ ...ENTITY_SCHEMA })).not.toThrow();
  });

  it('등록되지 않은 $id 의 Validator 를 요구하면 거부한다', () => {
    expect(() => new SchemaRegistry().validator('https://hkt.local/none.json')).toThrow(
      /E_UNKNOWN_SCHEMA_ID/,
    );
  });

  it('해시는 등록 순서에 의존하지 않는다', () => {
    const forward = new SchemaRegistry().add(ENTITY_SCHEMA).add(WRAPPER_SCHEMA).hash();
    const backward = new SchemaRegistry().add(WRAPPER_SCHEMA).add(ENTITY_SCHEMA).hash();
    expect(backward).toBe(forward);
    expect(forward).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('ids 는 오름차순이다', () => {
    expect(new SchemaRegistry().add(WRAPPER_SCHEMA).add(ENTITY_SCHEMA).ids()).toEqual([
      'https://hkt.local/schemas/test-entity.json',
      'https://hkt.local/schemas/test-wrapper.json',
    ]);
  });

  it('canonicalJson 은 키 순서를 정규화한다', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });
});

describe('guardInput', () => {
  const guard = guardInput<{ id: string }>(ENTITY_SCHEMA, '테스트 입력');

  it('통과한 값은 그대로 돌려준다', () => {
    const value = { id: 'e0' };
    expect(guard(value)).toBe(value);
  });

  it('어긴 값은 경로가 담긴 예외로 막는다', () => {
    try {
      guard({ id: 1 });
      expect.unreachable('예외가 나야 한다');
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaValidationError);
      const validationError = error as SchemaValidationError;
      expect(validationError.issues[0]?.instancePath).toBe('/id');
      expect(validationError.message).toContain('/id');
    }
  });
});

describe('enforceSchemas — 모듈 경계 강제', () => {
  it('V0 모듈의 입력 검증을 스키마로 대체할 수 있다', () => {
    const v0InputSchema: JsonSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['documents'],
      properties: {
        documents: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['path', 'text'],
            properties: { path: { type: 'string', minLength: 1 }, text: { type: 'string' } },
          },
        },
      },
    };
    const guarded = enforceSchemas(createV0Module(v0Scenarios), {
      inputSchema: v0InputSchema,
      outputSchema: { type: 'object' },
    });

    expect(guarded.validateInput({ documents: healthySet() }).documents).toHaveLength(4);
    expect(() => guarded.validateInput({ documents: [{ path: '', text: 'x' }] })).toThrow(
      SchemaValidationError,
    );
    // 원래 모듈의 정체성은 유지된다
    expect(guarded.id).toBe('V0');
    expect(guarded.scenarios).toHaveLength(v0Scenarios.length);
  });

  it('출력 위반은 V0 의 VerificationIssue 로 번역된다', () => {
    const issues = toVerificationIssues(
      [{ code: 'E_TYPE', instancePath: '/a/b', schemaPath: '/properties/a/type', message: '틀렸다' }],
      'X 출력',
    );
    expect(issues).toEqual([
      { code: 'E_TYPE', path: 'X 출력/a/b', message: '틀렸다 (스키마 /properties/a/type)' },
    ]);
  });
});

describe('V1 모듈 자기 적용', () => {
  const v1 = createV1Module(v1Scenarios);

  it('자기 입력 스키마로 입력을 검증한다', () => {
    const input = { schema: { type: 'integer' }, instances: [{ label: '값', data: 1 }] };
    expect(v1.validateInput(input)).toEqual(input);
  });

  it.each([
    ['instances 가 없음', { schema: {} }],
    ['instances 가 비어 있음', { schema: {}, instances: [] }],
    ['label 이 빈 문자열', { schema: {}, instances: [{ label: '', data: 1 }] }],
    ['schema 가 객체가 아님', { schema: 3, instances: [{ label: 'a', data: 1 }] }],
    ['모르는 필드', { schema: {}, instances: [{ label: 'a', data: 1 }], extra: 1 }],
  ])('잘못된 입력은 거부한다 (%s)', (_label, input) => {
    expect(() => v1.validateInput(input)).toThrow(SchemaValidationError);
  });

  it('자기 출력 스키마로 출력을 검증한다', () => {
    const output = v1.execute(
      { schema: { type: 'integer' }, instances: [{ label: '값', data: 'x' }] },
      { moduleId: 'V1', seed: 1n, tick: 0 },
    );
    expect(v1.validateOutput(output)).toEqual([]);
    expect(output.invalidCount).toBe(1);
  });

  it('출력 스키마와 일관성 검사가 조작된 출력을 잡아낸다', () => {
    const output = executeV1({ schema: { type: 'integer' }, instances: [{ label: '값', data: 'x' }] });
    const forged = { ...output, validCount: 5 };
    expect(v1.validateOutput(forged).map((issue) => issue.code)).toEqual([
      'E_INVARIANT_counts_must_match_results',
    ]);

    const shapeBroken = { ...output, results: [{ label: '값', valid: 'yes', issues: [] }] } as never;
    expect(v1.validateOutput(shapeBroken).some((issue) => issue.code === 'E_TYPE')).toBe(true);
  });

  it('컴파일 실패 시 판정을 남기지 않는다', () => {
    const output = executeV1({
      schema: { type: 'object', nullable: true },
      instances: [{ label: '값', data: {} }],
    });
    expect(output.compileError?.code).toBe('E_UNSUPPORTED_KEYWORD');
    expect(output.results).toEqual([]);
    expect(checkOutputConsistency(output)).toEqual([]);
  });

  it('V1 의 입력·출력 스키마 자체가 컴파일된다', () => {
    expect(() => guardInput(V1_INPUT_SCHEMA, '입력')).not.toThrow();
    expect(() => guardInput(V1_OUTPUT_SCHEMA, '출력')).not.toThrow();
  });
});
