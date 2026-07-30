import { compileSchema, type Validator } from '@hkt/v1-schema';
import { StoreRejection } from './errors.js';
import { NAME_PATTERN, STORE_ISSUE, type ComponentDefinition, type ComponentType, type JsonObject } from './types.js';

/**
 * 컴포넌트 종류 목록 — 저장소가 무엇을 담을 수 있는지 선언한다.
 *
 * 선언되지 않은 종류의 컴포넌트는 저장하지 않는다. "아무거나 담기는 자루"가 되면
 * `health` 와 `healt` 가 조용히 공존하고, 질의(K1)는 영원히 빈 결과를 돌려준다.
 * 형식 검사는 V1 에 맡긴다 — 스키마 해석 규칙을 두 곳에 두지 않는다.
 */
export class ComponentRegistry {
  readonly #definitions: ReadonlyMap<ComponentType, ComponentDefinition>;
  readonly #validators: ReadonlyMap<ComponentType, Validator>;

  private constructor(
    definitions: ReadonlyMap<ComponentType, ComponentDefinition>,
    validators: ReadonlyMap<ComponentType, Validator>,
  ) {
    this.#definitions = definitions;
    this.#validators = validators;
  }

  /** 선언 목록으로 레지스트리를 만든다. 같은 종류를 두 번 선언하면 거부한다. */
  static of(definitions: readonly ComponentDefinition[] = []): ComponentRegistry {
    const map = new Map<ComponentType, ComponentDefinition>();
    const validators = new Map<ComponentType, Validator>();
    for (const definition of definitions) {
      if (!NAME_PATTERN.test(definition.type)) {
        throw new StoreRejection(
          STORE_ISSUE.UNKNOWN_COMPONENT_TYPE,
          `components/${definition.type}`,
          `컴포넌트 종류는 소문자 snake_case 여야 한다: ${JSON.stringify(definition.type)}`,
        );
      }
      if (map.has(definition.type)) {
        throw new StoreRejection(
          STORE_ISSUE.UNKNOWN_COMPONENT_TYPE,
          `components/${definition.type}`,
          `컴포넌트 종류가 두 번 선언되었다: ${definition.type}`,
        );
      }
      map.set(definition.type, definition);
      validators.set(definition.type, compileSchema(definition.schema));
    }
    return new ComponentRegistry(map, validators);
  }

  /** 선언된 종류 (오름차순). */
  types(): ComponentType[] {
    return [...this.#definitions.keys()].sort();
  }

  has(type: ComponentType): boolean {
    return this.#definitions.has(type);
  }

  definition(type: ComponentType): ComponentDefinition | null {
    return this.#definitions.get(type) ?? null;
  }

  /**
   * 값이 선언된 스키마를 지키는지 본다. 어긋나면 **어느 경로가** 왜 틀렸는지까지 실어 거부한다.
   * 선언되지 않은 종류도 거부다 — 모르는 것을 조용히 통과시키지 않는다(원문 「23」).
   */
  assertValid(type: ComponentType, data: JsonObject, at: string): void {
    const validator = this.#validators.get(type);
    if (!validator) {
      throw new StoreRejection(
        STORE_ISSUE.UNKNOWN_COMPONENT_TYPE,
        at,
        `선언되지 않은 컴포넌트 종류다: ${type} (선언된 것: ${this.types().join(', ') || '없음'})`,
      );
    }
    const result = validator.validate(data);
    if (result.valid) return;
    const first = result.issues[0];
    throw new StoreRejection(
      STORE_ISSUE.COMPONENT_SCHEMA,
      `${at}${first?.instancePath ?? ''}`,
      `컴포넌트 \`${type}\` 이 스키마를 어긴다: ${result.issues
        .map((issue) => `${issue.instancePath || '/'} ${issue.message}`)
        .join(' · ')}`,
    );
  }

  /** 새 선언을 더한 레지스트리. 원본은 바뀌지 않는다. */
  extend(definitions: readonly ComponentDefinition[]): ComponentRegistry {
    return ComponentRegistry.of([...this.#definitions.values(), ...definitions]);
  }
}
