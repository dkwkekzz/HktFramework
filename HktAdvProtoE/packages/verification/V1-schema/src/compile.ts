import { JSON_TYPES, KEYWORD_ORDER, SUPPORTED_KEYWORDS, type JsonTypeName } from './keywords.js';
import { join } from './pointer.js';
import {
  ISSUE,
  SchemaCompileError,
  type JsonSchema,
  type SchemaIssue,
  type ValidationResult,
  type Validator,
} from './types.js';

/** $ref 로 다른 문서를 가리킬 때 쓰는 문서 저장소. */
export interface SchemaSource {
  /** $id 로 스키마 문서를 찾는다. 없으면 null. */
  resolveById(id: string): JsonSchema | null;
}

export interface CompileOptions {
  /** 외부 문서 참조가 있을 때만 필요하다. */
  source?: SchemaSource;
  /** $ref 중첩 한도. 재귀 스키마가 무한히 돌지 않게 한다. */
  maxRefDepth?: number;
}

const DEFAULT_MAX_REF_DEPTH = 64;

interface DocContext {
  doc: JsonSchema;
  /** schemaPath 앞에 붙는 문서 표시 — 루트 문서는 빈 문자열이다. */
  prefix: string;
}

/**
 * 스키마를 컴파일한다. 지원하지 않는 키워드·형식 오류는 여기서 즉시 던진다.
 * 반환된 Validator 는 데이터를 절대 변경하지 않는다.
 */
export function compileSchema(schema: JsonSchema, options: CompileOptions = {}): Validator {
  assertSchemaShape(schema, '');
  const maxRefDepth = options.maxRefDepth ?? DEFAULT_MAX_REF_DEPTH;
  const rootId = typeof schema['$id'] === 'string' ? schema['$id'] : null;

  return {
    schemaId: rootId,
    validate(data: unknown): ValidationResult {
      const issues: SchemaIssue[] = [];
      validateNode(
        schema,
        '',
        data,
        '',
        { doc: schema, prefix: '' },
        0,
        issues,
        options.source ?? null,
        maxRefDepth,
      );
      return { valid: issues.length === 0, issues };
    },
  };
}

/** 컴파일 없이 한 번만 검증한다. */
export function validate(
  schema: JsonSchema,
  data: unknown,
  options: CompileOptions = {},
): ValidationResult {
  return compileSchema(schema, options).validate(data);
}

// ---------------------------------------------------------------------------
// 컴파일: 스키마 자체의 형식 검사
// ---------------------------------------------------------------------------

function assertSchemaShape(schema: unknown, path: string): void {
  if (typeof schema === 'boolean') return; // true/false 스키마
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new SchemaCompileError(
      'E_SCHEMA_NOT_OBJECT',
      path === '' ? '/' : path,
      '스키마는 객체이거나 boolean 이어야 한다.',
    );
  }

  const map = schema as Record<string, unknown>;
  for (const keyword of Object.keys(map).sort()) {
    if (!SUPPORTED_KEYWORDS.includes(keyword)) {
      throw new SchemaCompileError(
        'E_UNSUPPORTED_KEYWORD',
        join(path, keyword),
        `지원하지 않는 키워드다. 지원 목록: ${SUPPORTED_KEYWORDS.join(', ')}`,
      );
    }
  }

  const requireType = (keyword: string, predicate: boolean, expected: string): void => {
    if (keyword in map && !predicate) {
      throw new SchemaCompileError(
        'E_INVALID_KEYWORD_VALUE',
        join(path, keyword),
        `\`${keyword}\` 값은 ${expected} 여야 한다.`,
      );
    }
  };

  if ('type' in map) {
    const value = map['type'];
    const names = Array.isArray(value) ? value : [value];
    if (names.length === 0 || !names.every((name) => typeof name === 'string')) {
      throw new SchemaCompileError(
        'E_INVALID_KEYWORD_VALUE',
        join(path, 'type'),
        '`type` 은 문자열이거나 문자열 배열이어야 한다.',
      );
    }
    for (const name of names as string[]) {
      if (!JSON_TYPES.includes(name as JsonTypeName)) {
        throw new SchemaCompileError(
          'E_UNKNOWN_TYPE',
          join(path, 'type'),
          `알 수 없는 타입 \`${name}\`. 지원: ${JSON_TYPES.join(', ')}`,
        );
      }
    }
  }

  requireType('$ref', typeof map['$ref'] === 'string', '문자열');
  requireType('pattern', typeof map['pattern'] === 'string', '문자열');
  requireType('enum', Array.isArray(map['enum']) && (map['enum'] as unknown[]).length > 0, '비어 있지 않은 배열');
  requireType('required', Array.isArray(map['required']) && (map['required'] as unknown[]).every((v) => typeof v === 'string'), '문자열 배열');
  requireType('uniqueItems', typeof map['uniqueItems'] === 'boolean', 'boolean');
  for (const keyword of [
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
    'minProperties',
    'maxProperties',
  ]) {
    requireType(
      keyword,
      typeof map[keyword] === 'number' && Number.isInteger(map[keyword]) && (map[keyword] as number) >= 0,
      '0 이상의 정수',
    );
  }
  for (const keyword of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum']) {
    requireType(keyword, typeof map[keyword] === 'number', '숫자');
  }
  requireType(
    'multipleOf',
    typeof map['multipleOf'] === 'number' && (map['multipleOf'] as number) > 0,
    '0 보다 큰 숫자',
  );

  if ('pattern' in map) {
    try {
      new RegExp(map['pattern'] as string);
    } catch (error) {
      throw new SchemaCompileError(
        'E_INVALID_PATTERN',
        join(path, 'pattern'),
        `정규식으로 컴파일할 수 없다: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // 하위 스키마 재귀
  if ('properties' in map) {
    const properties = map['properties'];
    if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) {
      throw new SchemaCompileError(
        'E_INVALID_KEYWORD_VALUE',
        join(path, 'properties'),
        '`properties` 는 매핑이어야 한다.',
      );
    }
    for (const key of Object.keys(properties as Record<string, unknown>).sort()) {
      assertSchemaShape((properties as Record<string, unknown>)[key], join(join(path, 'properties'), key));
    }
  }
  if ('$defs' in map) {
    const defs = map['$defs'];
    if (defs === null || typeof defs !== 'object' || Array.isArray(defs)) {
      throw new SchemaCompileError(
        'E_INVALID_KEYWORD_VALUE',
        join(path, '$defs'),
        '`$defs` 는 매핑이어야 한다.',
      );
    }
    for (const key of Object.keys(defs as Record<string, unknown>).sort()) {
      assertSchemaShape((defs as Record<string, unknown>)[key], join(join(path, '$defs'), key));
    }
  }
  for (const keyword of ['items', 'additionalProperties', 'not'] as const) {
    if (keyword in map) assertSchemaShape(map[keyword], join(path, keyword));
  }
  for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
    if (!(keyword in map)) continue;
    const branches = map[keyword];
    if (!Array.isArray(branches) || branches.length === 0) {
      throw new SchemaCompileError(
        'E_INVALID_KEYWORD_VALUE',
        join(path, keyword),
        `\`${keyword}\` 는 비어 있지 않은 배열이어야 한다.`,
      );
    }
    branches.forEach((branch, index) => assertSchemaShape(branch, join(join(path, keyword), index)));
  }
}

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------

function validateNode(
  schema: JsonSchema | boolean,
  schemaPath: string,
  data: unknown,
  instancePath: string,
  ctx: DocContext,
  depth: number,
  issues: SchemaIssue[],
  source: SchemaSource | null,
  maxRefDepth: number,
): void {
  if (schema === true) return;
  if (schema === false) {
    issues.push({
      code: ISSUE.NOT_MATCHED,
      instancePath,
      schemaPath: `${ctx.prefix}${schemaPath}`,
      message: '이 위치에는 어떤 값도 올 수 없다 (false 스키마).',
    });
    return;
  }

  const map = schema;
  const at = (keyword: string): string => `${ctx.prefix}${join(schemaPath, keyword)}`;

  for (const keyword of KEYWORD_ORDER) {
    if (!(keyword in map)) continue;

    switch (keyword) {
      case '$ref': {
        if (depth >= maxRefDepth) {
          issues.push({
            code: ISSUE.REF_DEPTH,
            instancePath,
            schemaPath: at('$ref'),
            message: `참조 중첩이 한도(${maxRefDepth})를 넘었다.`,
          });
          return;
        }
        const resolved = resolveRef(map['$ref'] as string, ctx, source, at('$ref'));
        validateNode(
          resolved.schema,
          resolved.path,
          data,
          instancePath,
          resolved.ctx,
          depth + 1,
          issues,
          source,
          maxRefDepth,
        );
        break;
      }

      case 'type': {
        const names = (Array.isArray(map['type']) ? map['type'] : [map['type']]) as JsonTypeName[];
        if (!names.some((name) => matchesType(data, name))) {
          issues.push({
            code: ISSUE.TYPE,
            instancePath,
            schemaPath: at('type'),
            message: `타입이 ${names.join(' | ')} 이어야 하는데 ${typeName(data)} 이다.`,
          });
          // 타입이 틀리면 나머지 조건은 의미가 없다 — 잡음을 만들지 않고 멈춘다.
          return;
        }
        break;
      }

      case 'const': {
        if (!deepEqual(data, map['const'])) {
          issues.push({
            code: ISSUE.CONST,
            instancePath,
            schemaPath: at('const'),
            message: `값이 ${stringify(map['const'])} 여야 하는데 ${stringify(data)} 이다.`,
          });
        }
        break;
      }

      case 'enum': {
        const allowed = map['enum'] as unknown[];
        if (!allowed.some((candidate) => deepEqual(data, candidate))) {
          issues.push({
            code: ISSUE.ENUM,
            instancePath,
            schemaPath: at('enum'),
            message: `허용 값 ${allowed.map(stringify).join(', ')} 중 하나여야 하는데 ${stringify(data)} 이다.`,
          });
        }
        break;
      }

      case 'minLength':
      case 'maxLength': {
        if (typeof data !== 'string') break;
        const limit = map[keyword] as number;
        const length = [...data].length; // 코드 포인트 기준
        const violated = keyword === 'minLength' ? length < limit : length > limit;
        if (violated) {
          issues.push({
            code: keyword === 'minLength' ? ISSUE.MIN_LENGTH : ISSUE.MAX_LENGTH,
            instancePath,
            schemaPath: at(keyword),
            message: `길이가 ${keyword === 'minLength' ? '최소' : '최대'} ${limit} 여야 하는데 ${length} 이다.`,
          });
        }
        break;
      }

      case 'pattern': {
        if (typeof data !== 'string') break;
        if (!new RegExp(map['pattern'] as string).test(data)) {
          issues.push({
            code: ISSUE.PATTERN,
            instancePath,
            schemaPath: at('pattern'),
            message: `\`${map['pattern'] as string}\` 형식이어야 하는데 ${stringify(data)} 이다.`,
          });
        }
        break;
      }

      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum': {
        if (typeof data !== 'number') break;
        const limit = map[keyword] as number;
        const violated =
          keyword === 'minimum'
            ? data < limit
            : keyword === 'maximum'
              ? data > limit
              : keyword === 'exclusiveMinimum'
                ? data <= limit
                : data >= limit;
        if (violated) {
          const codes = {
            minimum: ISSUE.MINIMUM,
            maximum: ISSUE.MAXIMUM,
            exclusiveMinimum: ISSUE.EXCLUSIVE_MINIMUM,
            exclusiveMaximum: ISSUE.EXCLUSIVE_MAXIMUM,
          } as const;
          issues.push({
            code: codes[keyword],
            instancePath,
            schemaPath: at(keyword),
            message: `${keyword} ${limit} 조건을 어겼다 (실제 ${data}).`,
          });
        }
        break;
      }

      case 'multipleOf': {
        if (typeof data !== 'number') break;
        const divisor = map['multipleOf'] as number;
        const quotient = data / divisor;
        if (!Number.isFinite(quotient) || Math.abs(quotient - Math.round(quotient)) > 1e-9) {
          issues.push({
            code: ISSUE.MULTIPLE_OF,
            instancePath,
            schemaPath: at('multipleOf'),
            message: `${divisor} 의 배수여야 하는데 ${data} 이다.`,
          });
        }
        break;
      }

      case 'minItems':
      case 'maxItems': {
        if (!Array.isArray(data)) break;
        const limit = map[keyword] as number;
        const violated = keyword === 'minItems' ? data.length < limit : data.length > limit;
        if (violated) {
          issues.push({
            code: keyword === 'minItems' ? ISSUE.MIN_ITEMS : ISSUE.MAX_ITEMS,
            instancePath,
            schemaPath: at(keyword),
            message: `원소가 ${keyword === 'minItems' ? '최소' : '최대'} ${limit} 개여야 하는데 ${data.length} 개다.`,
          });
        }
        break;
      }

      case 'uniqueItems': {
        if (!Array.isArray(data) || map['uniqueItems'] !== true) break;
        for (let i = 0; i < data.length; i += 1) {
          for (let j = i + 1; j < data.length; j += 1) {
            if (deepEqual(data[i], data[j])) {
              issues.push({
                code: ISSUE.UNIQUE_ITEMS,
                instancePath: join(instancePath, j),
                schemaPath: at('uniqueItems'),
                message: `${i} 번 원소와 값이 같다 (${stringify(data[j])}).`,
              });
            }
          }
        }
        break;
      }

      case 'items': {
        if (!Array.isArray(data)) break;
        data.forEach((item, index) => {
          validateNode(
            map['items'] as JsonSchema | boolean,
            join(schemaPath, 'items'),
            item,
            join(instancePath, index),
            ctx,
            depth,
            issues,
            source,
            maxRefDepth,
          );
        });
        break;
      }

      case 'minProperties':
      case 'maxProperties': {
        if (!isPlainObject(data)) break;
        const count = Object.keys(data).length;
        const limit = map[keyword] as number;
        const violated = keyword === 'minProperties' ? count < limit : count > limit;
        if (violated) {
          issues.push({
            code: keyword === 'minProperties' ? ISSUE.MIN_PROPERTIES : ISSUE.MAX_PROPERTIES,
            instancePath,
            schemaPath: at(keyword),
            message: `속성이 ${keyword === 'minProperties' ? '최소' : '최대'} ${limit} 개여야 하는데 ${count} 개다.`,
          });
        }
        break;
      }

      case 'required': {
        if (!isPlainObject(data)) break;
        for (const key of [...(map['required'] as string[])].sort()) {
          if (key in data) continue;
          issues.push({
            code: ISSUE.REQUIRED,
            // 없는 값의 자리를 지목한다 — 어디를 채워야 하는지가 오류의 핵심이다.
            instancePath: join(instancePath, key),
            schemaPath: at('required'),
            message: `필수 속성 \`${key}\` 이 없다.`,
          });
        }
        break;
      }

      case 'properties': {
        if (!isPlainObject(data)) break;
        const properties = map['properties'] as Record<string, JsonSchema | boolean>;
        for (const key of Object.keys(properties).sort()) {
          if (!(key in data)) continue;
          validateNode(
            properties[key] as JsonSchema | boolean,
            join(join(schemaPath, 'properties'), key),
            data[key],
            join(instancePath, key),
            ctx,
            depth,
            issues,
            source,
            maxRefDepth,
          );
        }
        break;
      }

      case 'additionalProperties': {
        if (!isPlainObject(data)) break;
        const declared = new Set(
          Object.keys((map['properties'] as Record<string, unknown> | undefined) ?? {}),
        );
        const additional = map['additionalProperties'] as JsonSchema | boolean;
        for (const key of Object.keys(data).sort()) {
          if (declared.has(key)) continue;
          if (additional === false) {
            issues.push({
              code: ISSUE.ADDITIONAL_PROPERTY,
              instancePath: join(instancePath, key),
              schemaPath: at('additionalProperties'),
              message: `선언되지 않은 속성 \`${key}\` 이다. 허용 속성: ${[...declared].sort().join(', ') || '없음'}`,
            });
            continue;
          }
          validateNode(
            additional,
            join(schemaPath, 'additionalProperties'),
            data[key],
            join(instancePath, key),
            ctx,
            depth,
            issues,
            source,
            maxRefDepth,
          );
        }
        break;
      }

      case 'allOf': {
        (map['allOf'] as (JsonSchema | boolean)[]).forEach((branch, index) => {
          validateNode(
            branch,
            join(join(schemaPath, 'allOf'), index),
            data,
            instancePath,
            ctx,
            depth,
            issues,
            source,
            maxRefDepth,
          );
        });
        break;
      }

      case 'anyOf':
      case 'oneOf': {
        const branches = map[keyword] as (JsonSchema | boolean)[];
        const branchIssues = branches.map((branch, index) => {
          const collected: SchemaIssue[] = [];
          validateNode(
            branch,
            join(join(schemaPath, keyword), index),
            data,
            instancePath,
            ctx,
            depth,
            collected,
            source,
            maxRefDepth,
          );
          return collected;
        });
        const matched = branchIssues
          .map((collected, index) => (collected.length === 0 ? index : -1))
          .filter((index) => index >= 0);

        if (matched.length === 0) {
          issues.push({
            code: keyword === 'oneOf' ? ISSUE.ONE_OF_NO_MATCH : ISSUE.ANY_OF_NO_MATCH,
            instancePath,
            schemaPath: at(keyword),
            message: `어느 후보에도 맞지 않는다. ${branchIssues
              .map((collected, index) => `[${index}] ${summarize(collected)}`)
              .join(' / ')}`,
          });
        } else if (keyword === 'oneOf' && matched.length > 1) {
          issues.push({
            code: ISSUE.ONE_OF_MULTIPLE_MATCH,
            instancePath,
            schemaPath: at('oneOf'),
            message: `후보 ${matched.join(', ')} 에 동시에 맞는다 — oneOf 는 하나만 맞아야 한다.`,
          });
        }
        break;
      }

      case 'not': {
        const collected: SchemaIssue[] = [];
        validateNode(
          map['not'] as JsonSchema | boolean,
          join(schemaPath, 'not'),
          data,
          instancePath,
          ctx,
          depth,
          collected,
          source,
          maxRefDepth,
        );
        if (collected.length === 0) {
          issues.push({
            code: ISSUE.NOT_MATCHED,
            instancePath,
            schemaPath: at('not'),
            message: `금지된 형태에 맞는다 (${stringify(data)}).`,
          });
        }
        break;
      }

      default:
        break;
    }
  }
}

interface ResolvedRef {
  schema: JsonSchema | boolean;
  path: string;
  ctx: DocContext;
}

function resolveRef(
  ref: string,
  ctx: DocContext,
  source: SchemaSource | null,
  schemaPath: string,
): ResolvedRef {
  const hashIndex = ref.indexOf('#');
  const docPart = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
  const pointer = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

  let doc = ctx.doc;
  let prefix = ctx.prefix;
  if (docPart !== '') {
    const selfId = typeof ctx.doc['$id'] === 'string' ? ctx.doc['$id'] : null;
    if (docPart !== selfId) {
      const external = source?.resolveById(docPart) ?? null;
      if (!external) {
        throw new SchemaCompileError(
          'E_UNRESOLVED_REF',
          schemaPath,
          `참조 \`${ref}\` 의 문서를 찾을 수 없다. SchemaRegistry 에 등록했는지 확인할 것.`,
        );
      }
      doc = external;
      prefix = `${docPart}#`;
    }
  }

  const target = resolvePointerInSchema(doc, pointer);
  if (target === undefined) {
    throw new SchemaCompileError(
      'E_UNRESOLVED_REF',
      schemaPath,
      `참조 \`${ref}\` 가 가리키는 위치가 없다.`,
    );
  }
  return { schema: target, path: pointer, ctx: { doc, prefix } };
}

function resolvePointerInSchema(doc: JsonSchema, pointer: string): JsonSchema | boolean | undefined {
  if (pointer === '' || pointer === '/') return doc;
  let current: unknown = doc;
  for (const rawToken of pointer.replace(/^\//, '').split('/')) {
    const token = rawToken.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || typeof current !== 'object') return undefined;
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }
    const record = current as Record<string, unknown>;
    if (!(token in record)) return undefined;
    current = record[token];
  }
  if (typeof current === 'boolean') return current;
  if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
  return current as JsonSchema;
}

// ---------------------------------------------------------------------------
// 값 비교 · 표기
// ---------------------------------------------------------------------------

export function typeName(data: unknown): string {
  if (data === null) return 'null';
  if (Array.isArray(data)) return 'array';
  const type = typeof data;
  if (type === 'number') return Number.isInteger(data) ? 'integer' : 'number';
  if (type === 'object') return 'object';
  return type;
}

function matchesType(data: unknown, name: JsonTypeName): boolean {
  switch (name) {
    case 'null':
      return data === null;
    case 'boolean':
      return typeof data === 'boolean';
    case 'string':
      return typeof data === 'string';
    case 'number':
      return typeof data === 'number' && Number.isFinite(data);
    case 'integer':
      return typeof data === 'number' && Number.isInteger(data);
    case 'array':
      return Array.isArray(data);
    case 'object':
      return isPlainObject(data);
    default:
      return false;
  }
}

export function isPlainObject(data: unknown): data is Record<string, unknown> {
  return data !== null && typeof data === 'object' && !Array.isArray(data);
}

/** 값 동등성 — enum·const·uniqueItems 판정에 쓴다. 키 순서는 무관하다. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length) return false;
    if (!keysA.every((key, index) => key === keysB[index])) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }
  return false;
}

function stringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  const text = JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

/** 후보 분기 실패를 한 줄로 요약한다 — 순서가 고정되어 결과가 결정적이다. */
function summarize(issues: readonly SchemaIssue[]): string {
  if (issues.length === 0) return '통과';
  const first = issues[0] as SchemaIssue;
  const rest = issues.length > 1 ? ` (외 ${issues.length - 1}건)` : '';
  return `${first.instancePath || '/'} ${first.code}${rest}`;
}
