import { describe, expect, it } from 'vitest';
import { compileSchema, validate } from '../../src/compile.js';
import { SUPPORTED_KEYWORDS } from '../../src/keywords.js';
import { SchemaCompileError, type JsonSchema } from '../../src/types.js';
import subsetSchema from '../../schemas/json-schema-subset.schema.json';

describe('컴파일 — 지원 키워드 검사', () => {
  it('모르는 키워드는 컴파일 단계에서 막는다', () => {
    expect(() => compileSchema({ type: 'object', nullable: true })).toThrow(SchemaCompileError);
    try {
      compileSchema({ type: 'object', properties: { a: { minimumValue: 1 } } });
      expect.unreachable('컴파일이 실패해야 한다');
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaCompileError);
      const compileError = error as SchemaCompileError;
      expect(compileError.code).toBe('E_UNSUPPORTED_KEYWORD');
      expect(compileError.schemaPath).toBe('/properties/a/minimumValue');
    }
  });

  it('format 은 지원하지 않는다 — 조용히 무시하지 않는다', () => {
    expect(() => compileSchema({ type: 'string', format: 'date-time' })).toThrow(
      SchemaCompileError,
    );
  });

  it('지원 목록과 명세 문서가 일치한다', () => {
    const declared = ((subsetSchema as JsonSchema)['$defs'] as Record<string, JsonSchema>)[
      'supportedKeyword'
    ] as JsonSchema;
    expect([...(declared['enum'] as string[])].sort()).toEqual([...SUPPORTED_KEYWORDS].sort());
  });

  it('알 수 없는 타입 이름은 막는다', () => {
    expect(() => compileSchema({ type: 'int' })).toThrow(/E_UNKNOWN_TYPE/);
  });

  it('키워드 값 형식이 틀리면 막는다', () => {
    expect(() => compileSchema({ minLength: -1 })).toThrow(/E_INVALID_KEYWORD_VALUE/);
    expect(() => compileSchema({ required: ['a', 1] as unknown as string[] })).toThrow(
      /E_INVALID_KEYWORD_VALUE/,
    );
    expect(() => compileSchema({ enum: [] })).toThrow(/E_INVALID_KEYWORD_VALUE/);
    expect(() => compileSchema({ oneOf: [] })).toThrow(/E_INVALID_KEYWORD_VALUE/);
    expect(() => compileSchema({ multipleOf: 0 })).toThrow(/E_INVALID_KEYWORD_VALUE/);
    expect(() => compileSchema({ properties: [] as unknown as JsonSchema })).toThrow(
      /E_INVALID_KEYWORD_VALUE/,
    );
  });

  it('컴파일되지 않는 정규식은 막는다', () => {
    expect(() => compileSchema({ pattern: '[' })).toThrow(/E_INVALID_PATTERN/);
  });

  it('스키마가 객체도 boolean 도 아니면 막는다', () => {
    expect(() => compileSchema(null as unknown as JsonSchema)).toThrow(/E_SCHEMA_NOT_OBJECT/);
    expect(() => compileSchema({ properties: { a: 3 as unknown as JsonSchema } })).toThrow(
      /E_SCHEMA_NOT_OBJECT/,
    );
  });

  it('찾을 수 없는 $ref 는 막는다', () => {
    expect(() => validate({ $ref: '#/$defs/none' }, {})).toThrow(/E_UNRESOLVED_REF/);
    expect(() =>
      validate({ $ref: 'https://hkt.local/schemas/absent.json#/$defs/x' }, {}),
    ).toThrow(/E_UNRESOLVED_REF/);
  });

  it('$id 와 같은 문서를 가리키는 절대 $ref 는 자기 문서에서 해결한다', () => {
    const schema: JsonSchema = {
      $id: 'https://hkt.local/schemas/self.json',
      $ref: 'https://hkt.local/schemas/self.json#/$defs/leaf',
      $defs: { leaf: { type: 'integer' } },
    };
    expect(validate(schema, 3).valid).toBe(true);
    expect(validate(schema, 'x').issues[0]?.code).toBe('E_TYPE');
  });
});

describe('컴파일 — 재사용', () => {
  it('컴파일한 Validator 를 여러 값에 재사용할 수 있다', () => {
    const validator = compileSchema({ type: 'integer', minimum: 0 });
    expect(validator.validate(1).valid).toBe(true);
    expect(validator.validate(-1).valid).toBe(false);
    expect(validator.validate(1).valid).toBe(true);
  });

  it('$id 를 노출한다', () => {
    expect(compileSchema({ $id: 'https://hkt.local/x.json' }).schemaId).toBe(
      'https://hkt.local/x.json',
    );
    expect(compileSchema({}).schemaId).toBeNull();
  });
});
