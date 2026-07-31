import type { ComponentDefinition, StoreOperation } from '@hkt/k0-entity-state';

/**
 * 대표 장면의 무대.
 *
 * 원문 「9」 K1 의 대표 검증은 “체력 50 이하이며 반경 10m 내에 있는 인간”만 정확히 선택하는 것이다.
 * 그러려면 **떨어져야 할 이유가 서로 다른** 후보들이 필요하다 — 체력이 넘치는 자, 멀리 있는 자,
 * 인간이 아닌 자, 그리고 **체력이라는 것 자체가 없는 것**.
 */

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    type: 'health',
    title: '체력',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['current', 'max'],
      properties: { current: { type: 'integer', minimum: 0 }, max: { type: 'integer', minimum: 1 } },
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
    type: 'faction',
    title: '소속',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: { name: { type: 'string' } },
    },
  },
];

/**
 * 기준점은 `hero` 다. 나머지는 하나씩 다른 이유로 떨어지거나 붙는다.
 *
 * | 실체 | 인간 | 체력 | hero 로부터 | 뽑혀야 하나 |
 * |---|---|---|---|---|
 * | `wounded_scout` | ○ | 12 | 3m | **○** |
 * | `dying_healer`  | ○ | 50 | 8m | **○** (경계값 — 50 이하) |
 * | `strong_guard`  | ○ | 88 | 2m | × 체력이 넘친다 |
 * | `far_beggar`    | ○ | 9  | 40m | × 멀다 |
 * | `beast_ka`      | × | 20 | 5m | × 인간이 아니다 |
 * | `ghost_child`   | ○ | 없음 | 4m | × 체력이라는 것이 없다 |
 * | `stone_wall`    | × | 없음 | 1m | × 인간도 아니고 체력도 없다 |
 *
 * `ghost_child` 가 이 무대의 핵심이다. “체력 50 이하”를 `not(gt(체력, 50))` 로 적으면 **체력이 없는
 * 것까지 뽑힌다** — 없는 값은 `gt` 를 만족하지 못하므로 `not` 이 참이 되기 때문이다.
 */
export const ROOM: StoreOperation[] = [
  {
    op: 'spawn',
    id: 'hero',
    kind: 'person',
    tags: ['human', 'player'],
    components: { health: { current: 70, max: 100 }, position: { x: 0, y: 0, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'wounded_scout',
    kind: 'person',
    tags: ['human', 'scout'],
    components: { health: { current: 12, max: 100 }, position: { x: 3, y: 0, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'dying_healer',
    kind: 'person',
    tags: ['human', 'healer'],
    components: { health: { current: 50, max: 100 }, position: { x: 8, y: 0, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'strong_guard',
    kind: 'person',
    tags: ['human', 'guard'],
    components: { health: { current: 88, max: 100 }, position: { x: 2, y: 0, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'far_beggar',
    kind: 'person',
    tags: ['human', 'beggar'],
    components: { health: { current: 9, max: 100 }, position: { x: 40, y: 0, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'beast_ka',
    kind: 'giant_beast',
    tags: ['beast'],
    components: { health: { current: 20, max: 900 }, position: { x: 5, y: 0, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'ghost_child',
    kind: 'person',
    tags: ['human', 'ghost'],
    components: { position: { x: 4, y: 0, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'stone_wall',
    kind: 'structure',
    tags: ['stone'],
    components: { position: { x: 1, y: 0, z: 0 } },
  },
];
