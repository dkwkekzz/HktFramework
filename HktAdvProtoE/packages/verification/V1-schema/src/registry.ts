import { sha256Tagged } from '@hkt/v0-module-contract';
import { compileSchema, type CompileOptions, type SchemaSource } from './compile.js';
import { SchemaCompileError, type JsonSchema, type Validator } from './types.js';

/**
 * 스키마 저장소 — V1 이 소유하는 유일한 상태(`schema_registry`).
 *
 * `$id` 로 문서를 등록하고, 컴파일된 Validator 를 캐시한다. 등록 순서는 결과에 영향을 주지 않는다.
 */
export class SchemaRegistry implements SchemaSource {
  #documents = new Map<string, JsonSchema>();
  #validators = new Map<string, Validator>();
  #options: CompileOptions;

  constructor(options: Omit<CompileOptions, 'source'> = {}) {
    this.#options = { ...options, source: this };
  }

  /** 문서를 등록한다. `$id` 가 없거나 이미 다른 내용으로 등록되어 있으면 실패한다. */
  add(schema: JsonSchema): this {
    const id = schema['$id'];
    if (typeof id !== 'string' || id.trim() === '') {
      throw new SchemaCompileError('E_MISSING_SCHEMA_ID', '/$id', '등록하려면 `$id` 가 있어야 한다.');
    }
    const existing = this.#documents.get(id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(schema)) {
      throw new SchemaCompileError(
        'E_DUPLICATE_SCHEMA_ID',
        '/$id',
        `\`${id}\` 가 다른 내용으로 이미 등록되어 있다.`,
      );
    }
    this.#documents.set(id, schema);
    this.#validators.delete(id);
    return this;
  }

  resolveById(id: string): JsonSchema | null {
    return this.#documents.get(id) ?? null;
  }

  /** 등록된 스키마의 Validator. 두 번째 호출부터는 캐시를 쓴다. */
  validator(id: string): Validator {
    const cached = this.#validators.get(id);
    if (cached) return cached;
    const document = this.#documents.get(id);
    if (!document) {
      throw new SchemaCompileError('E_UNKNOWN_SCHEMA_ID', '/$id', `\`${id}\` 가 등록되어 있지 않다.`);
    }
    const validator = compileSchema(document, this.#options);
    this.#validators.set(id, validator);
    return validator;
  }

  /** 등록된 $id 목록 (오름차순 — 등록 순서와 무관하게 같다). */
  ids(): string[] {
    return [...this.#documents.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  get size(): number {
    return this.#documents.size;
  }

  /** 저장소 내용의 해시 — 증거에 남긴다. 등록 순서에 의존하지 않는다. */
  hash(): string {
    return sha256Tagged(
      JSON.stringify(this.ids().map((id) => [id, canonicalJson(this.#documents.get(id))])),
    );
  }
}

/** 키 순서를 정렬해 정규화한 JSON 문자열 — 같은 내용이면 같은 문자열이 된다. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = canonicalize(record[key]);
    return out;
  }
  return value;
}
