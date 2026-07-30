import type { JsonSchema } from '../src/types.js';

/**
 * 시나리오 픽스처.
 *
 * 아래 세계 상태 스키마는 **V1 검증용 예시**다. 정식 세계 상태 스키마는 K0(entity-state)가 소유한다.
 * 여기서는 중첩 객체·배열·$ref·oneOf 를 한 번에 밟기 위한 최소 형태만 만든다.
 */
export const WORLD_STATE_FIXTURE_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://hkt.local/schemas/fixture-world-state.schema.json',
  title: '세계 상태 (픽스처)',
  type: 'object',
  additionalProperties: false,
  required: ['tick', 'entities'],
  properties: {
    tick: { type: 'integer', minimum: 0 },
    entities: { type: 'array', minItems: 1, items: { $ref: '#/$defs/entity' } },
  },
  $defs: {
    entity: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'energy', 'position'],
      properties: {
        id: { type: 'string', pattern: '^e[0-9]+$' },
        energy: { type: 'number', minimum: 0, maximum: 100 },
        position: { oneOf: [{ $ref: '#/$defs/point2' }, { $ref: '#/$defs/point3' }] },
        tags: { type: 'array', items: { type: 'string' }, uniqueItems: true },
      },
    },
    point2: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y'],
      properties: { x: { type: 'number' }, y: { type: 'number' } },
    },
    point3: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'z'],
      properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
    },
  },
};

/** 스키마를 지키는 상태. */
export function validWorldState(): unknown {
  return {
    tick: 12,
    entities: [
      { id: 'e0', energy: 10, position: { x: 0, y: 0 }, tags: ['hungry'] },
      { id: 'e1', energy: 42.5, position: { x: 3, y: 1, z: -2 } },
    ],
  };
}

/** 두 번째 실체의 energy 가 숫자가 아니다 — 오류 경로는 `/entities/1/energy` 여야 한다. */
export function wrongTypeWorldState(): unknown {
  return {
    tick: 12,
    entities: [
      { id: 'e0', energy: 10, position: { x: 0, y: 0 } },
      { id: 'e1', energy: '42', position: { x: 3, y: 1 } },
    ],
  };
}

/** 필수 속성 `position` 이 없다. */
export function missingRequiredWorldState(): unknown {
  return { tick: 3, entities: [{ id: 'e0', energy: 10 }] };
}

/** 선언되지 않은 속성 `mana` 가 있다. */
export function unknownPropertyWorldState(): unknown {
  return { tick: 3, entities: [{ id: 'e0', energy: 10, position: { x: 0, y: 0 }, mana: 5 }] };
}

/** position 이 point2 도 point3 도 아니다 (z 만 있음). */
export function badOneOfWorldState(): unknown {
  return { tick: 3, entities: [{ id: 'e0', energy: 10, position: { z: 1 } }] };
}

/** 지원하지 않는 키워드를 쓴 스키마 — 컴파일 단계에서 실패해야 한다. */
export const UNSUPPORTED_KEYWORD_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    energy: { type: 'number', exclusiveMinimumValue: 0 },
  },
};

/** 자기 자신을 참조하는 스키마 — 무한히 돌지 않는지 확인한다. */
export const RECURSIVE_SCHEMA: JsonSchema = {
  $id: 'https://hkt.local/schemas/fixture-recursive.schema.json',
  $ref: '#/$defs/node',
  $defs: {
    node: {
      type: 'object',
      additionalProperties: false,
      required: ['value'],
      properties: {
        value: { type: 'integer' },
        child: { $ref: '#/$defs/node' },
      },
    },
  },
};
