import { SchemaRegistry, type JsonSchema } from '@hkt/v1-schema';
import { deepClone, deepFreeze } from './json.js';
import type { Fixture, JsonObject, RunIssue } from './types.js';

/**
 * Fixture Loader (원문 「8」 V3 의 산출물 중 하나).
 *
 * 적재 시점에 두 가지를 보장한다.
 *
 * 1. **형식** — `schemaId` 가 선언된 픽스처는 V1 로 검증한다. 어긋난 값은 실행 전에,
 *    JSON Pointer 경로와 함께 거부한다. 잘못된 초기 상태로 굴린 장면은 무엇을 증명하지도 못한다.
 * 2. **불변** — 꺼낸 상태는 깊게 동결한다. 단계가 초기 상태를 몰래 고치면 전후 비교가 거짓이 된다.
 */
export class FixtureLoader {
  readonly schemas: SchemaRegistry;
  #fixtures = new Map<string, Fixture>();

  constructor(options: { schemas?: SchemaRegistry } = {}) {
    this.schemas = options.schemas ?? new SchemaRegistry();
  }

  /** 스키마 문서를 저장소에 넣는다. 픽스처의 `schemaId` 가 이 `$id` 를 가리킨다. */
  addSchema(schema: JsonSchema): this {
    this.schemas.add(schema);
    return this;
  }

  /**
   * 픽스처를 등록한다. 형식 위반은 여기서 즉시 걸린다 — 실행 시점까지 미루지 않는다.
   * 같은 id 를 다른 내용으로 두 번 등록하는 것도 거부한다.
   */
  add(fixture: Fixture): this {
    const issues = this.check(fixture);
    if (issues.length > 0) {
      throw new FixtureError(`픽스처 ${fixture.id} 를 등록할 수 없다`, issues);
    }
    // 저장본은 키 순서를 정규화해 두므로, 비교도 정규화한 값끼리 한다.
    const stored = deepFreeze(deepClone(fixture as unknown as JsonObject));
    const existing = this.#fixtures.get(fixture.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(stored)) {
      throw new FixtureError(`픽스처 ${fixture.id} 를 등록할 수 없다`, [
        {
          code: 'E_DUPLICATE_FIXTURE_ID',
          path: `/fixtures/${fixture.id}`,
          message: `\`${fixture.id}\` 가 다른 내용으로 이미 등록되어 있다.`,
        },
      ]);
    }
    this.#fixtures.set(fixture.id, stored as unknown as Fixture);
    return this;
  }

  /** 등록 없이 형식만 본다 — 거부 사유를 경로와 함께 돌려준다. */
  check(fixture: Fixture): RunIssue[] {
    const issues: RunIssue[] = [];
    const at = `/fixtures/${fixture.id}`;

    if (typeof fixture.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(fixture.id)) {
      issues.push({
        code: 'E_FIXTURE_ID_FORMAT',
        path: `${at}/id`,
        message: `픽스처 id 는 소문자 snake_case 여야 한다: ${JSON.stringify(fixture.id)}`,
      });
    }
    if (fixture.state === null || typeof fixture.state !== 'object' || Array.isArray(fixture.state)) {
      issues.push({
        code: 'E_FIXTURE_STATE_TYPE',
        path: `${at}/state`,
        message: '픽스처의 상태는 객체여야 한다.',
      });
      return issues;
    }

    if (fixture.schemaId !== undefined) {
      const document = this.schemas.resolveById(fixture.schemaId);
      if (!document) {
        issues.push({
          code: 'E_UNKNOWN_SCHEMA_ID',
          path: `${at}/schemaId`,
          message: `스키마 \`${fixture.schemaId}\` 가 등록되어 있지 않다.`,
        });
        return issues;
      }
      const result = this.schemas.validator(fixture.schemaId).validate(fixture.state);
      for (const issue of result.issues) {
        issues.push({
          code: issue.code,
          path: `${at}/state${issue.instancePath}`,
          message: `${issue.message} (스키마 ${fixture.schemaId}${issue.schemaPath})`,
        });
      }
    }
    return issues;
  }

  has(id: string): boolean {
    return this.#fixtures.has(id);
  }

  /** 등록된 id 목록 (오름차순 — 등록 순서와 무관하다). */
  ids(): string[] {
    return [...this.#fixtures.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  /**
   * 초기 상태를 꺼낸다. 매번 **새로 복사해서 동결한** 값을 준다 —
   * 한 장면이 다른 장면의 초기 상태를 오염시키지 못한다.
   */
  load(id: string): JsonObject {
    const fixture = this.#fixtures.get(id);
    if (!fixture) {
      throw new FixtureError(`픽스처 ${id} 가 없다`, [
        {
          code: 'E_UNKNOWN_FIXTURE',
          path: `/given/fixture`,
          message: `\`${id}\` 는 등록된 픽스처가 아니다. 등록된 것: ${this.ids().join(', ') || '없음'}`,
        },
      ]);
    }
    return deepFreeze(deepClone(fixture.state));
  }

  title(id: string): string {
    return this.#fixtures.get(id)?.title ?? id;
  }
}

export class FixtureError extends Error {
  readonly issues: readonly RunIssue[];

  constructor(label: string, issues: readonly RunIssue[]) {
    super(`${label} (${issues.length}건):\n${issues.map((issue) => `  ${issue.path} · ${issue.code} · ${issue.message}`).join('\n')}`);
    this.name = 'FixtureError';
    this.issues = issues;
  }
}
