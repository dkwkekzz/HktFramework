/** JSON Schema 문서 — 지원 키워드는 SUPPORTED_KEYWORDS 가 규정한다. */
export type JsonSchema = { [keyword: string]: unknown };

/** 스키마 위반 하나. 경로는 두 방향으로 모두 남긴다 — 데이터의 어디가, 스키마의 어느 조건에 걸렸는지. */
export interface SchemaIssue {
  code: IssueCode;
  /** 데이터 내 위치 (RFC 6901 JSON Pointer). 루트는 빈 문자열이다. */
  instancePath: string;
  /** 위반한 조건의 스키마 내 위치 (JSON Pointer). */
  schemaPath: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: readonly SchemaIssue[];
}

export interface Validator {
  /** 스키마 문서의 $id (없으면 null) */
  readonly schemaId: string | null;
  validate(data: unknown): ValidationResult;
}

export const ISSUE = {
  TYPE: 'E_TYPE',
  REQUIRED: 'E_REQUIRED',
  ADDITIONAL_PROPERTY: 'E_ADDITIONAL_PROPERTY',
  ENUM: 'E_ENUM',
  CONST: 'E_CONST',
  PATTERN: 'E_PATTERN',
  MIN_LENGTH: 'E_MIN_LENGTH',
  MAX_LENGTH: 'E_MAX_LENGTH',
  MINIMUM: 'E_MINIMUM',
  MAXIMUM: 'E_MAXIMUM',
  EXCLUSIVE_MINIMUM: 'E_EXCLUSIVE_MINIMUM',
  EXCLUSIVE_MAXIMUM: 'E_EXCLUSIVE_MAXIMUM',
  MULTIPLE_OF: 'E_MULTIPLE_OF',
  MIN_ITEMS: 'E_MIN_ITEMS',
  MAX_ITEMS: 'E_MAX_ITEMS',
  UNIQUE_ITEMS: 'E_UNIQUE_ITEMS',
  MIN_PROPERTIES: 'E_MIN_PROPERTIES',
  MAX_PROPERTIES: 'E_MAX_PROPERTIES',
  ONE_OF_NO_MATCH: 'E_ONE_OF_NO_MATCH',
  ONE_OF_MULTIPLE_MATCH: 'E_ONE_OF_MULTIPLE_MATCH',
  ANY_OF_NO_MATCH: 'E_ANY_OF_NO_MATCH',
  NOT_MATCHED: 'E_NOT_MATCHED',
  REF_DEPTH: 'E_REF_DEPTH',
} as const;

export type IssueCode = (typeof ISSUE)[keyof typeof ISSUE];

/**
 * 스키마 컴파일 실패.
 *
 * 지원하지 않는 키워드를 조용히 무시하면 "검증 조건 완화"(원문 「23」)가 되므로,
 * 알 수 없는 키워드는 검증 시점이 아니라 컴파일 시점에 터뜨린다.
 */
export class SchemaCompileError extends Error {
  readonly code: string;
  readonly schemaPath: string;

  constructor(code: string, schemaPath: string, message: string) {
    super(`${schemaPath} · ${code} · ${message}`);
    this.name = 'SchemaCompileError';
    this.code = code;
    this.schemaPath = schemaPath;
  }
}

/** 검증 실패를 예외로 올릴 때 쓴다 — 모듈 경계에서 계약을 강제할 때 사용한다. */
export class SchemaValidationError extends Error {
  readonly issues: readonly SchemaIssue[];

  constructor(label: string, issues: readonly SchemaIssue[]) {
    super(
      `${label} 이 스키마를 위반했다 (${issues.length}건):\n` +
        issues.map((issue) => `  ${issue.instancePath || '/'} · ${issue.code} · ${issue.message}`).join('\n'),
    );
    this.name = 'SchemaValidationError';
    this.issues = issues;
  }
}
