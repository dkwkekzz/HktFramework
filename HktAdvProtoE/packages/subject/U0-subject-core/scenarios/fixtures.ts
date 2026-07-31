import type { ComponentDefinition, JsonObject, StoreOperation } from '@hkt/k0-entity-state';
import type { SpatialLayout } from '@hkt/s0-spatial-affordance';
import { NATURAL_COMPONENT } from '@hkt/s1-natural-state';
import { SUBJECT_COMPONENT } from '../src/types.js';

/**
 * 대표 장면의 무대 — **같은 몸, 다른 사람**.
 *
 * 원문 「11」 U0 의 대표 검증은 "동일한 배고픔 상태에서도 가치와 성격이 다른 주체의 우선순위가
 * 달라짐"이다. 그 한 줄을 정직하게 보이려면 **배고픔이 정말로 같아야** 한다. 그래서 파수꾼과
 * 도둑은 몸의 허기도(6), 욕구 수위도(끼니 4 · 맡은 자리 4 · 몸 2) 한 칸도 다르지 않다.
 * 다른 것은 오직 가치와 성격이다.
 *
 * ```text
 *              끼니   맡은 자리   몸        온도    1위
 *   파수꾼      2.05     7.25     2.60      0.80   맡은 자리   (의무 0.9 · 인내 0.8)
 *   도둑        6.80     3.05     3.20      2.75   끼니        (생존 0.9 · 충동 0.9)
 * ```
 *
 * 두 몸은 같은 법칙 아래에서 같은 속도로 굶으므로, 두 주체의 욕구 수위는 **끝까지 같다**.
 * 그런데도 순위는 세 틱 내내 갈린다.
 */

export const LAYOUT: SpatialLayout = {
  cellSize: 1,
  origin: { x: 0, y: 0, z: 0 },
  size: { x: 20, y: 10, z: 1 },
};

export const WORLD_SEED = '20260731';

const numberField = (minimum?: number, maximum?: number): Record<string, unknown> => ({
  type: 'number',
  ...(minimum === undefined ? {} : { minimum }),
  ...(maximum === undefined ? {} : { maximum }),
});

/**
 * 컴포넌트 선언.
 *
 * 앞의 여섯은 U0 의 것이고, 뒤의 아홉은 **몸이 자연의 것이기 때문에** 필요하다 — 이름은 S1 의
 * `NATURAL_COMPONENT` 에서 그대로 가져온다. 손으로 다시 적으면 S1 이 이름을 바꾼 날 조용히 어긋난다.
 *
 * 욕구·가치·성격·감정은 열린 매핑이다. 세계가 어떤 욕구를 가질지 U0 이 미리 정할 수 없다 —
 * 그것은 콘텐츠의 몫이고, U0 은 **어떤 욕구든 같은 방식으로 잰다**는 것만 보장한다.
 */
export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    type: SUBJECT_COMPONENT.NEEDS,
    title: '욕구 (0~10)',
    schema: { type: 'object', additionalProperties: numberField(0, 10) },
  },
  {
    type: SUBJECT_COMPONENT.VALUES,
    title: '가치관 (0~1)',
    schema: { type: 'object', additionalProperties: numberField(0, 1) },
  },
  {
    type: SUBJECT_COMPONENT.TRAITS,
    title: '특성 (0~1)',
    schema: { type: 'object', additionalProperties: numberField(0, 1) },
  },
  {
    type: SUBJECT_COMPONENT.EMOTIONS,
    title: '감정 (0~1)',
    schema: { type: 'object', additionalProperties: numberField(0, 1) },
  },
  {
    type: SUBJECT_COMPONENT.RESOURCES,
    title: '자원',
    schema: { type: 'object', additionalProperties: numberField(0) },
  },
  {
    type: SUBJECT_COMPONENT.BODY,
    title: '신체 연결',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['entity_ids'],
      properties: { entity_ids: { type: 'array', items: { type: 'string' } } },
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
    type: NATURAL_COMPONENT.POPULATION,
    title: '개체군',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['count'],
      properties: { count: numberField(0) },
    },
  },
  {
    type: NATURAL_COMPONENT.HUNGER,
    title: '허기 (0 이 배부름)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['value'],
      properties: { value: numberField(0) },
    },
  },
  {
    type: NATURAL_COMPONENT.MASS,
    title: '질량 (kg)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['kg'],
      properties: { kg: numberField(0) },
    },
  },
  {
    type: NATURAL_COMPONENT.TEMPERATURE,
    title: '온도 (℃)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['celsius'],
      properties: { celsius: numberField() },
    },
  },
  {
    type: NATURAL_COMPONENT.DAMAGE,
    title: '손상 (상처)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['wounds'],
      properties: { wounds: numberField(0) },
    },
  },
  {
    type: NATURAL_COMPONENT.DISEASE,
    title: '질병 (병세)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['load'],
      properties: { load: numberField(0) },
    },
  },
  {
    type: NATURAL_COMPONENT.DIET,
    title: '먹이 관계',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['eats'],
      properties: { eats: { type: 'array', items: { type: 'string' }, minItems: 1 } },
    },
  },
  {
    type: NATURAL_COMPONENT.HABITAT,
    title: '서식지 반경 (m)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['radius'],
      properties: { radius: numberField(0) },
    },
  },
];

/** 사람의 몸 하나 — 개체군 1 인 무리다. 자연에게 사람은 한 마리다. */
export function body(
  id: string,
  at: { x: number; y: number },
  hunger: number,
  extra: Record<string, JsonObject> = {},
): StoreOperation {
  return {
    op: 'spawn',
    id,
    kind: 'body',
    tags: ['flesh'],
    components: {
      position: { x: at.x, y: at.y, z: 0 },
      [NATURAL_COMPONENT.POPULATION]: { count: 1 },
      [NATURAL_COMPONENT.HUNGER]: { value: hunger },
      // 40kg — 번식 법칙(l1_breed)의 문턱(50) 아래다. 사람의 몸은 하루 만에 둘이 되지 않는다.
      [NATURAL_COMPONENT.MASS]: { kg: 40 },
      [NATURAL_COMPONENT.TEMPERATURE]: { celsius: 37 },
      [NATURAL_COMPONENT.DAMAGE]: { wounds: 0 },
      [NATURAL_COMPONENT.DISEASE]: { load: 0 },
      ...extra,
    },
  };
}

export interface SubjectSeed {
  id: string;
  kind: string;
  needs: Record<string, number>;
  values: Record<string, number>;
  traits: Record<string, number>;
  emotions: Record<string, number>;
  resources: Record<string, number>;
  bodies: string[];
  /** 능력 id — 태그 `cap_<id>` 가 된다 */
  capabilities: string[];
}

export function subject(seed: SubjectSeed): StoreOperation {
  return {
    op: 'spawn',
    id: seed.id,
    kind: seed.kind,
    tags: seed.capabilities.map((capability) => `cap_${capability}`).sort(),
    components: {
      [SUBJECT_COMPONENT.NEEDS]: seed.needs,
      [SUBJECT_COMPONENT.VALUES]: seed.values,
      [SUBJECT_COMPONENT.TRAITS]: seed.traits,
      [SUBJECT_COMPONENT.EMOTIONS]: seed.emotions,
      [SUBJECT_COMPONENT.RESOURCES]: seed.resources,
      [SUBJECT_COMPONENT.BODY]: { entity_ids: [...seed.bodies].sort() },
    },
  };
}

/** 두 주체가 공유하는 욕구 수위 — 한 곳에 두어야 "같다"가 사고로 깨지지 않는다. */
export const SHARED_NEEDS: Record<string, number> = { hunger: 4, duty: 4, safety: 2 };

export const SENTINEL: SubjectSeed = {
  id: 'sentinel',
  kind: 'person',
  needs: { ...SHARED_NEEDS },
  values: { duty: 0.9, survival: 0.3, temperance: 0.7 },
  traits: { patient: 0.8, impulsive: 0.1, cautious: 0.5 },
  emotions: { fear: 0, despair: 0 },
  resources: { provision: 2, salve: 0 },
  bodies: ['sentinel_body'],
  capabilities: ['stand_watch'],
};

export const FORAGER: SubjectSeed = {
  id: 'forager',
  kind: 'person',
  needs: { ...SHARED_NEEDS },
  values: { duty: 0.1, survival: 0.9, temperance: 0.1 },
  traits: { patient: 0.1, impulsive: 0.9, cautious: 0.2 },
  emotions: { fear: 0, despair: 0 },
  resources: { provision: 0, salve: 0 },
  bodies: ['forager_body'],
  capabilities: ['forage'],
};

/** 대표 검증의 무대 — 두 사람과 똑같이 굶은 두 몸. */
export const TWO_PEOPLE: StoreOperation[] = [
  body('sentinel_body', { x: 2, y: 3 }, 6),
  body('forager_body', { x: 4, y: 3 }, 6),
  subject(SENTINEL),
  subject(FORAGER),
];

/**
 * 굶은 개와 널린 고기 — **자연 법칙과 함께** 굴리는 무대.
 *
 * S1 의 법칙집을 같이 넣으면 몸이 스스로 굶고 스스로 먹는다. U0 의 법칙은 그 몸을 느낄 뿐이다.
 * 신체 연결이 장식이 아니라는 것은 이렇게만 보일 수 있다 — U0 이 아무것도 하지 않아도
 * 몸이 배를 채우면 욕구가 내려간다.
 *
 * 허기를 4 에서 시작하는 것이 중요하다. S1 의 `l1_feed` 는 허기 5 를 넘어야 사냥하므로,
 * 개는 **하루를 더 굶은 뒤에** 먹는다. 그 하루가 "욕구가 오른다"를 보이는 자리다.
 *
 * ```text
 *   0일  몸 4 · 욕구 2      1일  몸 6 · 욕구 4 ↑    2일  몸 0(먹었다) · 욕구 2 ↓
 * ```
 */
export const HOUND_AND_CARRION: StoreOperation[] = [
  body('hound_body', { x: 3, y: 3 }, 4, {
    [NATURAL_COMPONENT.DIET]: { eats: ['carrion'] },
    [NATURAL_COMPONENT.HABITAT]: { radius: 4 },
  }),
  {
    op: 'spawn',
    id: 'carrion_pile',
    kind: 'flora',
    tags: ['carrion'],
    components: {
      position: { x: 5, y: 3, z: 0 },
      [NATURAL_COMPONENT.POPULATION]: { count: 6 },
      [NATURAL_COMPONENT.MASS]: { kg: 30 },
    },
  },
  subject({
    id: 'stray_hound',
    kind: 'creature',
    needs: { hunger: 2, duty: 0, safety: 1 },
    values: { survival: 0.8, duty: 0, temperance: 0.1 },
    traits: { impulsive: 0.6, patient: 0.2, cautious: 0.4 },
    emotions: { fear: 0, despair: 0 },
    resources: { provision: 0, salve: 0 },
    bodies: ['hound_body'],
    capabilities: ['forage'],
  }),
];

/**
 * 수단이 있는 자와 없는 자 — 능력과 자원이 무엇을 하는지 보이는 무대.
 *
 * 두 사람은 욕구도 가치도 성격도 같다. 다른 것은 **손에 쥔 것**뿐이다.
 */
export const EQUIPPED_AND_HELPLESS: StoreOperation[] = [
  body('equipped_body', { x: 2, y: 5 }, 9),
  body('helpless_body', { x: 4, y: 5 }, 9),
  subject({
    id: 'equipped',
    kind: 'person',
    needs: { hunger: 7, duty: 1, safety: 2 },
    values: { survival: 0.7, duty: 0.2, temperance: 0.2 },
    traits: { impulsive: 0.4, patient: 0.4, cautious: 0.4 },
    emotions: { fear: 0, despair: 0.4 },
    resources: { provision: 3, salve: 0 },
    bodies: ['equipped_body'],
    capabilities: ['forage'],
  }),
  subject({
    id: 'helpless',
    kind: 'person',
    needs: { hunger: 7, duty: 1, safety: 2 },
    values: { survival: 0.7, duty: 0.2, temperance: 0.2 },
    traits: { impulsive: 0.4, patient: 0.4, cautious: 0.4 },
    emotions: { fear: 0, despair: 0.4 },
    resources: { provision: 0, salve: 0 },
    bodies: ['helpless_body'],
    capabilities: [],
  }),
];

/**
 * 사람 · 생물 · 조직 · 신 — 원문 「6」의 "모두 같은 `Subject` 인터페이스를 구현할 수 있다".
 *
 * 조직의 몸은 **구성원**이고 신의 몸은 **앵커**다. 조직이 추상적인 의지만으로 움직일 수 없다는
 * 것(GI-08)이 여기서 구조로 나타난다 — 쓰러진 구성원에게서는 아무것도 올라오지 않는다.
 */
export const FOUR_KINDS: StoreOperation[] = [
  body('warden_body', { x: 2, y: 7 }, 7),
  body('boar_body', { x: 5, y: 7 }, 7, {
    [NATURAL_COMPONENT.DIET]: { eats: ['carrion'] },
    [NATURAL_COMPONENT.HABITAT]: { radius: 3 },
  }),
  body('militia_standing', { x: 8, y: 7 }, 7),
  // 쓰러진 구성원. 개체군은 아래 `FOUR_KINDS_WORLD` 에서 0 으로 내린다 —
  // 조직은 이 몸을 통해서는 아무것도 느끼지 못하게 된다.
  body('militia_fallen', { x: 9, y: 7 }, 7),
  body('boundary_stone', { x: 12, y: 7 }, 7),
  subject({
    id: 'warden',
    kind: 'person',
    needs: { hunger: 5, duty: 6, safety: 3 },
    values: { duty: 0.8, survival: 0.4, temperance: 0.5 },
    traits: { patient: 0.7, impulsive: 0.2, cautious: 0.6 },
    emotions: { fear: 0.1, despair: 0 },
    resources: { provision: 1, salve: 1 },
    bodies: ['warden_body'],
    capabilities: ['stand_watch', 'fight'],
  }),
  subject({
    id: 'wild_boar',
    kind: 'creature',
    needs: { hunger: 8, duty: 0, safety: 5 },
    values: { survival: 1, duty: 0, temperance: 0 },
    traits: { impulsive: 0.8, patient: 0.1, cautious: 0.3 },
    emotions: { fear: 0.2, despair: 0 },
    resources: { provision: 0, salve: 0 },
    bodies: ['boar_body'],
    capabilities: ['forage'],
  }),
  subject({
    id: 'border_watch',
    kind: 'organization',
    needs: { hunger: 3, duty: 8, safety: 4 },
    values: { duty: 1, survival: 0.2, temperance: 0.6 },
    traits: { patient: 0.9, impulsive: 0.1, cautious: 0.7 },
    emotions: { fear: 0, despair: 0.1 },
    resources: { provision: 5, salve: 2 },
    bodies: ['militia_standing', 'militia_fallen'],
    capabilities: ['stand_watch'],
  }),
  subject({
    id: 'boundary_god',
    kind: 'god',
    needs: { hunger: 0, duty: 9, safety: 1 },
    values: { duty: 1, survival: 0.1, temperance: 1 },
    traits: { patient: 1, impulsive: 0, cautious: 0.4 },
    emotions: { fear: 0, despair: 0 },
    resources: { provision: 0, salve: 0 },
    bodies: ['boundary_stone'],
    capabilities: ['stand_watch'],
  }),
];

/** 쓰러진 구성원 — 개체군 0 으로 내린다. */
export const FOUR_KINDS_WORLD: StoreOperation[] = [
  ...FOUR_KINDS,
  { op: 'set_component', id: 'militia_fallen', type: NATURAL_COMPONENT.POPULATION, data: { count: 0 } },
];
