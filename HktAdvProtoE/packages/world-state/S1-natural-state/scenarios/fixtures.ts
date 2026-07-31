import type { ComponentDefinition, StoreOperation } from '@hkt/k0-entity-state';
import type { SpatialLayout } from '@hkt/s0-spatial-affordance';

/**
 * 대표 장면의 무대 — **풀·사슴·늑대의 세 층**.
 *
 * 원문 「10」 S1 의 대표 검증은 "먹이가 줄면 초식 개체군이 감소하고 일정 지연 후 포식자가 감소"다.
 * 그 한 줄이 나오려면 **줄기 전의 균형**이 있어야 한다. 줄기만 하는 세계에서는 "감소"가 그저
 * 처음부터 정해진 하강일 뿐이고, 먹이와의 인과가 보이지 않는다.
 *
 * ```text
 *  풀이 넉넉한 동안      사슴은 먹고 새끼를 친다 → 늑대가 잡아가는 만큼 채워진다 (개체군 유지)
 *  풀이 바닥난 뒤        사슴은 배를 채우지 못해 새끼를 치지 못한다 → 잡아먹히고 굶어 준다
 *  사슴이 사라진 뒤      늑대는 며칠을 버티다 굶어 준다              ← 여기가 "일정 지연"
 * ```
 *
 * 지연은 손으로 넣은 숫자가 아니다. 늑대의 허기가 굶주림 임계(8)를 넘기까지 걸리는 시간이며,
 * 법칙의 상수(허기 +2/일)와 세계의 상태에서 저절로 나온다.
 *
 * ```text
 *  y
 *  8   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ▒     ▒ far_meadow (18,8) — 사슴의 서식지 밖
 *  3   ·  ·  ░  ·  ✦  ·  ·  ✧  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
 *      0  1  2  3  4  5  6  7 …                              18   x
 *            ░ meadow_grass(2,3)   ✦ deer_herd(4,3)   ✧ wolf_pack(7,3)
 * ```
 */

export const LAYOUT: SpatialLayout = {
  cellSize: 1,
  origin: { x: 0, y: 0, z: 0 },
  size: { x: 20, y: 10, z: 1 },
};

export const WORLD_SEED = '20260731';

const numberField = (minimum?: number): Record<string, unknown> =>
  minimum === undefined ? { type: 'number' } : { type: 'number', minimum };

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
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
    type: 'population',
    title: '개체군',
    // 하한이 여기 있는 것이 중요하다 — "개체군은 음수가 될 수 없다"를 법칙마다 다시 적지 않는다.
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['count'],
      properties: { count: numberField(0) },
    },
  },
  {
    type: 'hunger',
    title: '허기 (0 이 배부름)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['value'],
      properties: { value: numberField(0) },
    },
  },
  {
    type: 'mass',
    title: '질량 (kg)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['kg'],
      properties: { kg: numberField(0) },
    },
  },
  {
    type: 'temperature',
    title: '온도 (℃)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['celsius'],
      properties: { celsius: numberField() },
    },
  },
  {
    type: 'damage',
    title: '손상 (상처)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['wounds'],
      properties: { wounds: numberField(0) },
    },
  },
  {
    type: 'disease',
    title: '질병 (병세)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['load'],
      properties: { load: numberField(0) },
    },
  },
  {
    type: 'diet',
    title: '먹이 관계',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['eats'],
      properties: { eats: { type: 'array', items: { type: 'string' }, minItems: 1 } },
    },
  },
  {
    type: 'habitat',
    title: '서식지 반경 (m)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['radius'],
      properties: { radius: numberField(0) },
    },
  },
];

/** 풀 → 사슴 → 늑대. 세 층이 한 줄로 이어진 가장 작은 생태다. */
export const MEADOW: StoreOperation[] = [
  {
    op: 'spawn',
    id: 'meadow_grass',
    kind: 'flora',
    tags: ['grass', 'edible'],
    // 허기가 없다 — 풀은 하루를 살지 않고, 뜯기기만 한다.
    components: { position: { x: 2, y: 3, z: 0 }, population: { count: 10 }, mass: { kg: 40 } },
  },
  {
    op: 'spawn',
    id: 'deer_herd',
    kind: 'beast',
    tags: ['herbivore', 'beast'],
    components: {
      position: { x: 4, y: 3, z: 0 },
      population: { count: 4 },
      hunger: { value: 0 },
      mass: { kg: 200 },
      temperature: { celsius: 38 },
      damage: { wounds: 0 },
      disease: { load: 0 },
      diet: { eats: ['grass'] },
      habitat: { radius: 5 },
    },
  },
  {
    op: 'spawn',
    id: 'wolf_pack',
    kind: 'beast',
    tags: ['predator', 'beast'],
    components: {
      position: { x: 7, y: 3, z: 0 },
      population: { count: 2 },
      hunger: { value: 3 },
      mass: { kg: 90 },
      temperature: { celsius: 38.5 },
      damage: { wounds: 0 },
      disease: { load: 0 },
      diet: { eats: ['herbivore'] },
      habitat: { radius: 6 },
    },
  },
  {
    // 사슴의 서식지(5m) 밖에 있는 풀 — 세계에 먹이가 있다고 먹을 수 있는 것은 아니다.
    op: 'spawn',
    id: 'far_meadow',
    kind: 'flora',
    tags: ['grass', 'edible'],
    components: { position: { x: 18, y: 8, z: 0 }, population: { count: 30 }, mass: { kg: 120 } },
  },
];

/** 상처 입은 무리 — 손상이 질병으로, 질병이 열과 죽음으로 이어지는 길을 보인다. */
export const WOUNDED_HERD: StoreOperation[] = [
  ...MEADOW,
  { op: 'set_component', id: 'deer_herd', type: 'damage', data: { wounds: 8 } },
];

/** 먹이가 서식지 밖에만 있는 무대 — 굶주림의 원인이 "없음"이 아니라 "멀다"인 경우. */
export const OUT_OF_REACH: StoreOperation[] = [
  ...MEADOW,
  { op: 'despawn', id: 'meadow_grass' },
];
