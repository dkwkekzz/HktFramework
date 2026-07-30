import type { ComponentDefinition, StoreOperation } from '../src/types.js';

/**
 * 대표 장면이 쓰는 무대.
 *
 * 원문 「9」 K0 의 대표 검증은 "두 실체의 체력·위치·소유권이 섞이지 않고 독립적으로 조회됨" 이다.
 * 그래서 무대는 **비슷하게 생긴 두 사람과 그중 한쪽이 가진 물건** 으로 짠다 — 섞인다면 여기서 섞인다.
 */

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    type: 'health',
    title: '체력',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['current', 'max'],
      properties: {
        current: { type: 'integer', minimum: 0 },
        max: { type: 'integer', minimum: 1 },
      },
    },
  },
  {
    type: 'position',
    title: '위치 (m)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'z'],
      properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
    },
  },
  {
    type: 'ownership',
    title: '소유권',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['ownerId'],
      properties: { ownerId: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' } },
    },
  },
  {
    type: 'energy',
    title: '생명 에너지',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['current'],
      properties: { current: { type: 'integer', minimum: 0 } },
    },
  },
];

/** 사냥꾼 둘과 희귀 기관 하나. 기관의 소유자는 하나뿐이다 (GI-11). */
export const BORDER_CANYON: StoreOperation[] = [
  {
    op: 'spawn',
    id: 'hunter_a',
    kind: 'person',
    tags: ['human', 'hunter'],
    components: {
      health: { current: 42, max: 100 },
      position: { x: 0, y: 0, z: 0 },
      energy: { current: 10 },
    },
  },
  {
    op: 'spawn',
    id: 'hunter_b',
    kind: 'person',
    tags: ['human', 'healer'],
    components: {
      health: { current: 91, max: 100 },
      position: { x: 30, y: 0, z: 0 },
      energy: { current: 4 },
    },
  },
  {
    op: 'spawn',
    id: 'relic_organ',
    kind: 'item',
    tags: ['rare', 'organ'],
    components: {
      position: { x: 4, y: 0, z: 0 },
      ownership: { ownerId: 'hunter_a' },
    },
  },
];
