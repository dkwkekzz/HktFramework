import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compileSchema, validate } from '../../src/compile.js';
import { resolve as resolvePointer } from '../../src/pointer.js';
import { SUPPORTED_KEYWORDS } from '../../src/keywords.js';
import { SchemaCompileError, type JsonSchema, type SchemaIssue } from '../../src/types.js';
import { WORLD_STATE_FIXTURE_SCHEMA } from '../../scenarios/fixtures.js';

/** 원문 「5」 G3 속성 게이트. 시드를 고정해 표본을 재현 가능하게 둔다. */
const RUN = { seed: 20260730, numRuns: 1000 } as const;

/** 임의의 JSON 값. */
const jsonValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  node: fc.oneof(
    { depthSize: 'small' },
    fc.constant(null),
    fc.boolean(),
    fc.integer({ min: -1000, max: 1000 }),
    fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
    fc.string({ maxLength: 8 }),
    fc.array(tie('node'), { maxLength: 4 }),
    fc.dictionary(fc.string({ minLength: 1, maxLength: 4 }), tie('node'), { maxKeys: 4 }),
  ),
})).node;

/** 스키마를 지키는 세계 상태 (픽스처 스키마용). */
const validState = fc.record({
  tick: fc.nat({ max: 10_000 }),
  entities: fc.array(
    fc.record(
      {
        id: fc.nat({ max: 999 }).map((n) => `e${n}`),
        energy: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        position: fc.oneof(
          fc.record({ x: fc.integer({ min: -50, max: 50 }), y: fc.integer({ min: -50, max: 50 }) }),
          fc.record({
            x: fc.integer({ min: -50, max: 50 }),
            y: fc.integer({ min: -50, max: 50 }),
            z: fc.integer({ min: -50, max: 50 }),
          }),
        ),
      },
      { requiredKeys: ['id', 'energy', 'position'] },
    ),
    { minLength: 1, maxLength: 4 },
  ),
});

describe('속성: 판정의 안정성', () => {
  it('어떤 JSON 값에도 예외를 던지지 않고 판정을 낸다', () => {
    fc.assert(
      fc.property(jsonValue, (data) => {
        const result = validate(WORLD_STATE_FIXTURE_SCHEMA, data);
        expect(typeof result.valid).toBe('boolean');
        expect(result.valid).toBe(result.issues.length === 0);
      }),
      RUN,
    );
  });

  it('같은 값을 두 번 판정하면 위반 목록이 완전히 같다', () => {
    fc.assert(
      fc.property(jsonValue, (data) => {
        expect(JSON.stringify(validate(WORLD_STATE_FIXTURE_SCHEMA, data))).toBe(
          JSON.stringify(validate(WORLD_STATE_FIXTURE_SCHEMA, data)),
        );
      }),
      RUN,
    );
  });

  it('판정은 데이터를 변경하지 않는다', () => {
    fc.assert(
      fc.property(jsonValue, (data) => {
        const before = JSON.stringify(data);
        validate(WORLD_STATE_FIXTURE_SCHEMA, data);
        expect(JSON.stringify(data)).toBe(before);
      }),
      RUN,
    );
  });

  it('모든 위반은 코드·메시지·스키마 경로를 갖고, 인스턴스 경로가 실제 위치를 가리킨다', () => {
    fc.assert(
      fc.property(jsonValue, (data) => {
        for (const issue of validate(WORLD_STATE_FIXTURE_SCHEMA, data).issues) {
          expectWellFormed(issue);
          // 없는 값(E_REQUIRED)을 뺀 나머지는 경로가 데이터 안의 실제 위치여야 한다
          if (issue.code !== 'E_REQUIRED' && issue.instancePath !== '') {
            expect(resolvePointer(data, issue.instancePath)).not.toBeUndefined();
          }
        }
      }),
      RUN,
    );
  });
});

describe('속성: 스키마를 지킨 값', () => {
  it('생성기가 만든 정상 상태는 언제나 통과한다', () => {
    fc.assert(
      fc.property(validState, (state) => {
        const result = validate(WORLD_STATE_FIXTURE_SCHEMA, state);
        expect(result.issues, JSON.stringify(result.issues)).toEqual([]);
      }),
      RUN,
    );
  });

  it('정상 상태에서 필수 속성을 하나 지우면 반드시 거부된다', () => {
    fc.assert(
      fc.property(validState, fc.constantFrom('id', 'energy', 'position'), fc.nat(), (state, field, rawIndex) => {
        const index = rawIndex % state.entities.length;
        const entities = state.entities.map((entity, i) => {
          if (i !== index) return entity;
          const copy: Record<string, unknown> = { ...entity };
          delete copy[field];
          return copy;
        });
        const result = validate(WORLD_STATE_FIXTURE_SCHEMA, { ...state, entities });
        expect(result.valid).toBe(false);
        expect(
          result.issues.some(
            (issue) =>
              issue.code === 'E_REQUIRED' && issue.instancePath === `/entities/${index}/${field}`,
          ),
        ).toBe(true);
      }),
      RUN,
    );
  });

  it('정상 상태에 모르는 속성을 넣으면 반드시 거부된다', () => {
    fc.assert(
      fc.property(
        validState,
        fc.string({ minLength: 1, maxLength: 6 }).filter((key) => !['id', 'energy', 'position', 'tags'].includes(key)),
        (state, key) => {
          const entities = state.entities.map((entity, index) =>
            index === 0 ? { ...entity, [key]: 1 } : entity,
          );
          const result = validate(WORLD_STATE_FIXTURE_SCHEMA, { ...state, entities });
          expect(result.valid).toBe(false);
          expect(result.issues.some((issue) => issue.code === 'E_ADDITIONAL_PROPERTY')).toBe(true);
        },
      ),
      RUN,
    );
  });
});

describe('속성: 스키마 부분집합 강제', () => {
  it('지원 목록에 없는 키워드를 넣으면 항상 컴파일이 실패한다', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }).filter((keyword) => !SUPPORTED_KEYWORDS.includes(keyword)),
        (keyword) => {
          expect(() => compileSchema({ type: 'object', [keyword]: 1 })).toThrow(SchemaCompileError);
        },
      ),
      RUN,
    );
  });

  it('지원 목록의 키워드만으로 만든 스키마는 컴파일된다', () => {
    fc.assert(
      fc.property(
        fc.subarray(['type', 'title', 'description', 'minProperties'] as const, { minLength: 1 }),
        (keywords) => {
          const schema: JsonSchema = {};
          for (const keyword of keywords) {
            schema[keyword] =
              keyword === 'type' ? 'object' : keyword === 'minProperties' ? 0 : '설명';
          }
          expect(() => compileSchema(schema)).not.toThrow();
        },
      ),
      RUN,
    );
  });
});

function expectWellFormed(issue: SchemaIssue): void {
  expect(issue.code).toMatch(/^E_[A-Z_]+$/);
  expect(issue.message.length).toBeGreaterThan(0);
  expect(issue.schemaPath.length).toBeGreaterThan(0);
  expect(typeof issue.instancePath).toBe('string');
}
