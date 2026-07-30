/**
 * 지원 키워드 명세.
 *
 * V1 은 JSON Schema 2020-12 의 **부분집합**만 구현한다. 목록에 없는 키워드가 스키마에 있으면
 * 컴파일을 실패시킨다 — 모르는 조건을 조용히 통과시키는 것은 검증 조건 완화(원문 「23」)다.
 */

/** 값 검증에 실제로 쓰는 키워드. */
export const ASSERTION_KEYWORDS = [
  '$ref',
  'type',
  'const',
  'enum',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'items',
  'minProperties',
  'maxProperties',
  'required',
  'properties',
  'additionalProperties',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
] as const;

/** 검증에 영향을 주지 않는 주석성 키워드 — 있어도 통과시키지만 무시한다. */
export const ANNOTATION_KEYWORDS = [
  '$schema',
  '$id',
  '$comment',
  '$defs',
  'title',
  'description',
  'examples',
  'default',
  'deprecated',
] as const;

export const SUPPORTED_KEYWORDS: readonly string[] = [
  ...ASSERTION_KEYWORDS,
  ...ANNOTATION_KEYWORDS,
];

/** 키워드 적용 순서 — 같은 데이터·스키마라면 언제나 같은 순서로 오류가 나오게 고정한다. */
export const KEYWORD_ORDER: readonly string[] = ASSERTION_KEYWORDS;

export const JSON_TYPES = [
  'null',
  'boolean',
  'object',
  'array',
  'number',
  'integer',
  'string',
] as const;

export type JsonTypeName = (typeof JSON_TYPES)[number];
