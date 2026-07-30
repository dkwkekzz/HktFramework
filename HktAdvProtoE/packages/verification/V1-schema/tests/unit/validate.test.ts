import { describe, expect, it } from 'vitest';
import { compileSchema, deepEqual, typeName, validate } from '../../src/compile.js';
import { ISSUE, type JsonSchema } from '../../src/types.js';
import { RECURSIVE_SCHEMA, WORLD_STATE_FIXTURE_SCHEMA, validWorldState } from '../../scenarios/fixtures.js';

const codes = (schema: JsonSchema, data: unknown): string[] =>
  validate(schema, data).issues.map((issue) => issue.code);

const paths = (schema: JsonSchema, data: unknown): string[] =>
  validate(schema, data).issues.map((issue) => issue.instancePath);

describe('type', () => {
  it.each([
    ['string', 'x', true],
    ['string', 1, false],
    ['integer', 3, true],
    ['integer', 3.5, false],
    ['number', 3.5, true],
    ['number', Number.NaN, false],
    ['boolean', false, true],
    ['null', null, true],
    ['null', undefined, false],
    ['object', {}, true],
    ['object', [], false],
    ['object', null, false],
    ['array', [], true],
  ])('type=%s 값=%p → %s', (type, data, expected) => {
    expect(validate({ type }, data).valid).toBe(expected);
  });

  it('타입 배열은 하나만 맞으면 된다', () => {
    expect(validate({ type: ['null', 'string'] }, null).valid).toBe(true);
    expect(validate({ type: ['null', 'string'] }, 3).valid).toBe(false);
  });

  it('타입이 틀리면 하위 조건은 검사하지 않는다 (잡음 방지)', () => {
    expect(codes({ type: 'object', required: ['a'], properties: { a: { type: 'string' } } }, 3)).toEqual([
      ISSUE.TYPE,
    ]);
  });

  it('타입 이름 표기는 integer 와 number 를 구분한다', () => {
    expect(typeName(3)).toBe('integer');
    expect(typeName(3.5)).toBe('number');
    expect(typeName([])).toBe('array');
    expect(typeName(null)).toBe('null');
  });
});

describe('문자열·숫자 제약', () => {
  it('minLength/maxLength 는 코드 포인트로 센다', () => {
    expect(validate({ minLength: 2 }, '한글').valid).toBe(true);
    expect(validate({ minLength: 3 }, '한글').valid).toBe(false);
    expect(validate({ maxLength: 1 }, '한글').valid).toBe(false);
  });

  it('pattern', () => {
    expect(validate({ pattern: '^e[0-9]+$' }, 'e12').valid).toBe(true);
    expect(codes({ pattern: '^e[0-9]+$' }, 'x12')).toEqual([ISSUE.PATTERN]);
  });

  it('경계값을 포함/제외한다', () => {
    expect(validate({ minimum: 0 }, 0).valid).toBe(true);
    expect(validate({ exclusiveMinimum: 0 }, 0).valid).toBe(false);
    expect(validate({ maximum: 100 }, 100).valid).toBe(true);
    expect(validate({ exclusiveMaximum: 100 }, 100).valid).toBe(false);
    expect(codes({ minimum: 0 }, -1)).toEqual([ISSUE.MINIMUM]);
    expect(codes({ maximum: 0 }, 1)).toEqual([ISSUE.MAXIMUM]);
  });

  it('multipleOf 는 부동소수 오차를 허용한다', () => {
    expect(validate({ multipleOf: 0.1 }, 0.3).valid).toBe(true);
    expect(codes({ multipleOf: 2 }, 3)).toEqual([ISSUE.MULTIPLE_OF]);
  });
});

describe('배열 제약', () => {
  it('minItems/maxItems', () => {
    expect(codes({ minItems: 1 }, [])).toEqual([ISSUE.MIN_ITEMS]);
    expect(codes({ maxItems: 1 }, [1, 2])).toEqual([ISSUE.MAX_ITEMS]);
  });

  it('items 는 원소마다 인덱스 경로를 남긴다', () => {
    expect(paths({ items: { type: 'string' } }, ['a', 2, 'c', 4])).toEqual(['/1', '/3']);
  });

  it('uniqueItems 는 중복된 뒤쪽 원소를 지목한다', () => {
    const result = validate({ uniqueItems: true }, ['a', 'b', 'a']);
    expect(result.issues.map((issue) => [issue.code, issue.instancePath])).toEqual([
      [ISSUE.UNIQUE_ITEMS, '/2'],
    ]);
  });

  it('uniqueItems 는 깊은 값 비교를 쓴다', () => {
    expect(validate({ uniqueItems: true }, [{ a: 1, b: 2 }, { b: 2, a: 1 }]).valid).toBe(false);
    expect(validate({ uniqueItems: true }, [{ a: 1 }, { a: 2 }]).valid).toBe(true);
  });
});

describe('객체 제약', () => {
  const schema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'energy'],
    properties: { id: { type: 'string' }, energy: { type: 'number' } },
  };

  it('필수 속성 누락은 그 자리를 지목한다', () => {
    const result = validate(schema, { id: 'e0' });
    expect(result.issues.map((issue) => [issue.code, issue.instancePath, issue.schemaPath])).toEqual([
      [ISSUE.REQUIRED, '/energy', '/required'],
    ]);
  });

  it('필수 속성이 여러 개 없으면 이름 오름차순으로 보고한다', () => {
    expect(paths(schema, {})).toEqual(['/energy', '/id']);
  });

  it('선언되지 않은 속성은 거부한다', () => {
    const result = validate(schema, { id: 'e0', energy: 1, mana: 2 });
    expect(result.issues[0]?.code).toBe(ISSUE.ADDITIONAL_PROPERTY);
    expect(result.issues[0]?.instancePath).toBe('/mana');
    expect(result.issues[0]?.message).toContain('energy');
  });

  it('additionalProperties 가 스키마면 그 스키마로 검사한다', () => {
    const open: JsonSchema = {
      type: 'object',
      properties: { id: { type: 'string' } },
      additionalProperties: { type: 'integer' },
    };
    expect(validate(open, { id: 'a', n: 1 }).valid).toBe(true);
    expect(paths(open, { id: 'a', n: 'x' })).toEqual(['/n']);
  });

  it('minProperties/maxProperties', () => {
    expect(codes({ minProperties: 1 }, {})).toEqual([ISSUE.MIN_PROPERTIES]);
    expect(codes({ maxProperties: 1 }, { a: 1, b: 2 })).toEqual([ISSUE.MAX_PROPERTIES]);
  });

  it('null 은 객체 조건을 건드리지 않는다', () => {
    expect(validate({ required: ['a'] }, null).valid).toBe(true);
  });
});

describe('조합 키워드', () => {
  it('enum 과 const', () => {
    expect(codes({ enum: ['a', 'b'] }, 'c')).toEqual([ISSUE.ENUM]);
    expect(codes({ const: 'none' }, 'x')).toEqual([ISSUE.CONST]);
    expect(validate({ const: { a: 1 } }, { a: 1 }).valid).toBe(true);
  });

  it('allOf 는 모든 조건을 적용한다', () => {
    const schema: JsonSchema = { allOf: [{ type: 'integer' }, { minimum: 5 }] };
    expect(validate(schema, 6).valid).toBe(true);
    expect(codes(schema, 3)).toEqual([ISSUE.MINIMUM]);
  });

  it('anyOf 는 하나만 맞으면 통과한다', () => {
    const schema: JsonSchema = { anyOf: [{ type: 'string' }, { type: 'integer' }] };
    expect(validate(schema, 'x').valid).toBe(true);
    expect(codes(schema, true)).toEqual([ISSUE.ANY_OF_NO_MATCH]);
  });

  it('oneOf 는 둘 이상 맞으면 실패한다', () => {
    const schema: JsonSchema = { oneOf: [{ type: 'integer' }, { minimum: 0 }] };
    const result = validate(schema, 3);
    expect(result.issues[0]?.code).toBe(ISSUE.ONE_OF_MULTIPLE_MATCH);
    expect(result.issues[0]?.message).toContain('0, 1');
  });

  it('oneOf 실패 메시지는 후보별 첫 위반을 요약한다', () => {
    const schema: JsonSchema = {
      oneOf: [
        { type: 'object', required: ['x', 'y'] },
        { type: 'object', required: ['x', 'y', 'z'] },
      ],
    };
    const message = validate(schema, { z: 1 }).issues[0]?.message ?? '';
    expect(message).toContain('[0] /x E_REQUIRED');
    expect(message).toContain('[1] /x E_REQUIRED');
  });

  it('not', () => {
    expect(codes({ not: { type: 'string' } }, 'x')).toEqual([ISSUE.NOT_MATCHED]);
    expect(validate({ not: { type: 'string' } }, 1).valid).toBe(true);
  });

  it('false 스키마는 어떤 값도 통과시키지 않는다', () => {
    expect(codes({ properties: { a: false } }, { a: 1 })).toEqual([ISSUE.NOT_MATCHED]);
    expect(validate({ properties: { a: true } }, { a: 1 }).valid).toBe(true);
  });
});

describe('$ref', () => {
  it('내부 참조를 따라간다', () => {
    const result = validate(WORLD_STATE_FIXTURE_SCHEMA, {
      tick: 0,
      entities: [{ id: 'bad', energy: 1, position: { x: 0, y: 0 } }],
    });
    expect(result.issues.map((issue) => [issue.instancePath, issue.schemaPath])).toEqual([
      ['/entities/0/id', '/$defs/entity/properties/id/pattern'],
    ]);
  });

  it('재귀 스키마도 끝난다', () => {
    expect(validate(RECURSIVE_SCHEMA, { value: 1, child: { value: 2, child: { value: 3 } } }).valid).toBe(
      true,
    );
    const result = validate(RECURSIVE_SCHEMA, { value: 1, child: { value: 'x' } });
    expect(result.issues[0]?.instancePath).toBe('/child/value');
  });

  it('참조 한도를 넘으면 통과시키지 않고 보고한다', () => {
    let deep: Record<string, unknown> = { value: 0 };
    for (let i = 0; i < 40; i += 1) deep = { value: i, child: deep };
    const result = compileSchema(RECURSIVE_SCHEMA, { maxRefDepth: 8 }).validate(deep);
    expect(result.issues.some((issue) => issue.code === ISSUE.REF_DEPTH)).toBe(true);
  });
});

describe('검증의 순수성', () => {
  it('데이터를 변경하지 않는다', () => {
    const data = validWorldState();
    const snapshot = JSON.stringify(data);
    validate(WORLD_STATE_FIXTURE_SCHEMA, data);
    expect(JSON.stringify(data)).toBe(snapshot);
  });

  it('같은 입력은 같은 위반 목록을 만든다', () => {
    const data = { tick: -1, entities: [] };
    const first = JSON.stringify(validate(WORLD_STATE_FIXTURE_SCHEMA, data));
    for (let run = 0; run < 20; run += 1) {
      expect(JSON.stringify(validate(WORLD_STATE_FIXTURE_SCHEMA, data))).toBe(first);
    }
  });

  it('속성 선언 순서가 달라도 같은 결과가 나온다', () => {
    const a: JsonSchema = { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'] };
    const b: JsonSchema = { required: ['y', 'x'], properties: { y: { type: 'integer' }, x: { type: 'integer' } }, type: 'object' };
    expect(JSON.stringify(validate(a, { x: 'bad' }).issues.map((i) => [i.code, i.instancePath]))).toBe(
      JSON.stringify(validate(b, { x: 'bad' }).issues.map((i) => [i.code, i.instancePath])),
    );
  });
});

describe('deepEqual', () => {
  it.each([
    [1, 1, true],
    [1, '1', false],
    [null, null, true],
    [[1, 2], [1, 2], true],
    [[1, 2], [2, 1], false],
    [{ a: 1, b: 2 }, { b: 2, a: 1 }, true],
    [{ a: 1 }, { a: 1, b: undefined }, false],
  ])('deepEqual(%p, %p) === %s', (a, b, expected) => {
    expect(deepEqual(a, b)).toBe(expected);
  });
});
