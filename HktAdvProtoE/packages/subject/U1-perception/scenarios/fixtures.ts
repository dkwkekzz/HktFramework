import type { ComponentDefinition, JsonObject, StoreOperation } from '@hkt/k0-entity-state';
import type { RuleSpec } from '@hkt/k2-rule-transaction';
import type { SpatialLayout } from '@hkt/s0-spatial-affordance';
import { NATURAL_COMPONENT } from '@hkt/s1-natural-state';
import { SUBJECT_COMPONENT } from '@hkt/u0-subject-core';
import { SENSES_COMPONENT } from '../src/types.js';

/**
 * 대표 장면의 무대 — **벽 하나와 그 양쪽**.
 *
 * 원문 「11」 U1 의 대표 검증은 "벽 뒤 사건은 보지 못하지만 큰 폭발음은 들을 수 있음"이다.
 * 그 한 줄이 나오려면 벽이 **두 감각에 다르게** 작용해야 한다 — 시선은 끊고 소리는 줄인다.
 *
 * ```text
 *  y
 *  3   ·  ·  ·  ·  ✦  ·  ✧  ·  ·  ·  ▓  ·  ·  ✵  ·      ✦ chapel_bell (5,3)
 *      0  1  2  3  4  5  6  7  8  9 10 11 12 13         ✧ watchman_body (7,3)
 *                                    ▓ stone_wall(10,3) ✵ hermit_body (13,3)
 *                                      solid · opaque
 * ```
 *
 * | | 종소리 (audio 12) | 폭발 (audio 40) | 시각 |
 * |---|---|---|---|
 * | 파수꾼 2m · 벽 없음 | 10.34 ≥ 1 들린다 | 34.48 들린다 | 보인다 |
 * | 은자 8m · 벽 하나 | 7.32 × 0.25 = **1.83 < 2.5 못 듣는다** | 24.39 × 0.25 = **6.10 ≥ 2.5 듣는다** | **끊긴다** |
 *
 * 은자의 청각 문턱 2.5 가 종과 폭발을 가른다. 손으로 고른 값이 아니라 **벽 하나를 사이에 둔
 * 8m 에서 종소리와 폭발음이 갈리는 자리**이며, 값을 바꾸면 대표 검증이 깨진다.
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

const vec3 = {
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y', 'z'],
  properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
};

/**
 * 컴포넌트 선언.
 *
 * 셋으로 나뉜다 — S0 의 공간(위치·크기·장애물), S1 의 몸(허기·상처·개체군…), U0 의 주체
 * (욕구·가치·성격·감정·자원·신체 연결). U1 이 새로 더하는 것은 `senses` 하나뿐이다.
 * 지각은 새 상태를 만들지 않는다. 이미 있는 세계를 **거를 뿐**이다.
 */
export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  { type: 'position', title: '위치 (m)', schema: vec3 },
  { type: 'extent', title: '반-크기 (m)', schema: vec3 },
  {
    type: 'wear',
    title: '닳음 (울린 횟수)',
    schema: { type: 'object', additionalProperties: false, required: ['tolls'], properties: { tolls: numberField(0) } },
  },
  {
    type: 'barrier',
    title: '장애물',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['solid', 'opaque'],
      properties: { solid: { type: 'boolean' }, opaque: { type: 'boolean' } },
    },
  },
  {
    type: SENSES_COMPONENT,
    title: '감각 문턱 (채널 → 이 세기를 넘어야 알아챈다)',
    schema: { type: 'object', additionalProperties: numberField(0) },
  },
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
    type: NATURAL_COMPONENT.POPULATION,
    title: '개체군',
    schema: { type: 'object', additionalProperties: false, required: ['count'], properties: { count: numberField(0) } },
  },
  {
    type: NATURAL_COMPONENT.HUNGER,
    title: '허기',
    schema: { type: 'object', additionalProperties: false, required: ['value'], properties: { value: numberField(0) } },
  },
  {
    type: NATURAL_COMPONENT.MASS,
    title: '질량 (kg)',
    schema: { type: 'object', additionalProperties: false, required: ['kg'], properties: { kg: numberField(0) } },
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
    title: '손상',
    schema: { type: 'object', additionalProperties: false, required: ['wounds'], properties: { wounds: numberField(0) } },
  },
  {
    type: NATURAL_COMPONENT.DISEASE,
    title: '질병',
    schema: { type: 'object', additionalProperties: false, required: ['load'], properties: { load: numberField(0) } },
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
    schema: { type: 'object', additionalProperties: false, required: ['radius'], properties: { radius: numberField(0) } },
  },
];

// ---------------------------------------------------------------------------
// 무대 조각
// ---------------------------------------------------------------------------

export function body(
  id: string,
  at: { x: number; y: number },
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
      [NATURAL_COMPONENT.HUNGER]: { value: 3 },
      [NATURAL_COMPONENT.MASS]: { kg: 40 },
      [NATURAL_COMPONENT.TEMPERATURE]: { celsius: 37 },
      [NATURAL_COMPONENT.DAMAGE]: { wounds: 0 },
      [NATURAL_COMPONENT.DISEASE]: { load: 0 },
      ...extra,
    },
  };
}

export interface PersonSeed {
  id: string;
  kind?: string;
  bodies: string[];
  /** 채널 → 문턱. 없는 채널은 없는 감각이다 */
  senses: Record<string, number>;
  capabilities?: string[];
  needs?: Record<string, number>;
  emotions?: Record<string, number>;
  resources?: Record<string, number>;
}

export function person(seed: PersonSeed): StoreOperation {
  return {
    op: 'spawn',
    id: seed.id,
    kind: seed.kind ?? 'person',
    tags: (seed.capabilities ?? []).map((capability) => `cap_${capability}`).sort(),
    components: {
      [SENSES_COMPONENT]: seed.senses,
      [SUBJECT_COMPONENT.NEEDS]: seed.needs ?? { hunger: 3, duty: 3, safety: 2 },
      [SUBJECT_COMPONENT.VALUES]: { duty: 0.5, survival: 0.5, temperance: 0.5 },
      [SUBJECT_COMPONENT.TRAITS]: { patient: 0.5, impulsive: 0.5, cautious: 0.5 },
      [SUBJECT_COMPONENT.EMOTIONS]: seed.emotions ?? { fear: 0, despair: 0 },
      [SUBJECT_COMPONENT.RESOURCES]: seed.resources ?? { provision: 1, salve: 0 },
      [SUBJECT_COMPONENT.BODY]: { entity_ids: [...seed.bodies].sort() },
    },
  };
}

/** 사람의 온전한 감각 한 벌. 장면마다 한 칸씩만 바꿔 무엇이 갈랐는지 분명히 한다. */
export const FULL_SENSES: Record<string, number> = {
  visual: 1,
  audio: 1,
  smell: 2,
  touch: 0.5,
  aura: 3,
  report: 0.2,
  rumor: 0.2,
};

export const STONE_WALL: StoreOperation = {
  op: 'spawn',
  id: 'stone_wall',
  kind: 'structure',
  tags: ['wall'],
  components: {
    position: { x: 10, y: 3, z: 0 },
    extent: { x: 0.5, y: 4, z: 2 },
    barrier: { solid: true, opaque: true },
  },
};

export const CHAPEL_BELL: StoreOperation = {
  op: 'spawn',
  id: 'chapel_bell',
  kind: 'fixture',
  tags: ['bell'],
  // 울릴 때마다 조금씩 닳는다 — 세계를 바꾸지 않는 일은 사건이 되지 못한다 (`BELL_RINGS` 주석).
  components: { position: { x: 5, y: 3, z: 0 }, wear: { tolls: 0 } },
};

/**
 * 화약통 — 종과 **같은 자리**에 둔다.
 *
 * 거리도 벽도 똑같아야 대표 검증이 무엇을 보이는지 분명해진다. 종소리와 폭발음을 가르는 것은
 * 자리가 아니라 오직 **세기**다.
 */
export const POWDER_KEG: StoreOperation = {
  op: 'spawn',
  id: 'powder_keg',
  kind: 'fixture',
  tags: ['powder'],
  components: { position: { x: 5, y: 3, z: 0 }, [NATURAL_COMPONENT.MASS]: { kg: 5 } },
};

/**
 * 대표 검증의 무대 — 벽 이쪽의 파수꾼, 저쪽의 은자.
 *
 * 은자의 청각 문턱만 2.5 다. 나머지는 파수꾼과 똑같다 — 갈리는 이유가 감각의 차이가 아니라
 * **벽**임을 분명히 하기 위해서다. (문턱이 같으면 은자도 종소리를 듣고, 그러면 이 장면은
 * "벽이 소리를 줄인다"까지만 보이고 "큰 소리는 넘어온다"를 보이지 못한다.)
 */
export const TWO_SIDES_OF_A_WALL: StoreOperation[] = [
  STONE_WALL,
  CHAPEL_BELL,
  POWDER_KEG,
  body('watchman_body', { x: 7, y: 3 }),
  body('hermit_body', { x: 13, y: 3 }),
  person({ id: 'watchman', bodies: ['watchman_body'], senses: FULL_SENSES }),
  person({ id: 'hermit', bodies: ['hermit_body'], senses: { ...FULL_SENSES, audio: 2.5 } }),
];

/** 귀가 없는 대장장이를 파수꾼 곁에 더한다 — 같은 자리에서도 감각이 다르면 아는 것이 다르다. */
export const WITH_A_DEAF_SMITH: StoreOperation[] = [
  ...TWO_SIDES_OF_A_WALL,
  body('smith_body', { x: 7, y: 4 }),
  person({
    id: 'deaf_smith',
    bodies: ['smith_body'],
    // audio 가 아예 없다. 문턱이 높은 것과 감각이 없는 것은 다른 일이다.
    senses: { visual: 1, smell: 2, touch: 0.5, aura: 3, report: 0.2, rumor: 0.2 },
  }),
];

/**
 * 의념을 느끼는 자와 못 느끼는 자.
 *
 * 둘은 같은 자리에 서서 같은 것을 본다. 다만 한 사람만 `cap_sense_aura` 를 가졌다.
 * 곪는 상처의 냄새(물리 흔적)는 둘 다 맡지만, 굶주림의 기척(의념)은 한 사람만 느낀다 —
 * 원문 「10」 S3 의 대표 검증과 같은 선이다.
 */
export const THE_ATTUNED_AND_THE_BLIND: StoreOperation[] = [
  body('seer_body', { x: 4, y: 5 }),
  body('plain_body', { x: 5, y: 5 }),
  // 굶주리고 곪은 몸 — 의념(허기의 기척)과 물리 흔적(곪는 냄새)을 함께 낸다.
  body('beggar_body', { x: 6, y: 5 }, {
    [NATURAL_COMPONENT.HUNGER]: { value: 9 },
    [NATURAL_COMPONENT.DAMAGE]: { wounds: 5 },
  }),
  person({ id: 'seer', bodies: ['seer_body'], senses: FULL_SENSES, capabilities: ['sense_aura'] }),
  person({ id: 'plain_walker', bodies: ['plain_body'], senses: FULL_SENSES }),
  person({
    id: 'beggar',
    bodies: ['beggar_body'],
    senses: FULL_SENSES,
    needs: { hunger: 9, duty: 0, safety: 4 },
    resources: { provision: 0, salve: 0 },
  }),
];

/**
 * 아무도 없는 벌판의 늑대 — 세계는 사건을 나눠 주지 않는다.
 *
 * 늑대와 사슴은 마을에서 **260m** 떨어져 있다. 청각이 닿는 60m 밖이다. 사냥은 실제로 일어나고
 * 사건 로그에도 남지만, 그것을 아는 주체는 아무도 없다.
 *
 * 처음에는 40m 에 두었는데 마을 사람이 사냥 소리를 들었다 — `14 / (1 + 0.08 × 38.5) = 3.43`
 * 으로 문턱 1 을 넉넉히 넘는다. "멀다"는 느낌이 아니라 **수치로 확인해야 하는 값**이다.
 */
export const WIDE_LAYOUT: SpatialLayout = {
  cellSize: 1,
  origin: { x: 0, y: 0, z: 0 },
  size: { x: 300, y: 100, z: 1 },
};

export const A_HUNT_NOBODY_SEES: StoreOperation[] = [
  body('wolf_body', { x: 250, y: 80 }, {
    [NATURAL_COMPONENT.DIET]: { eats: ['prey'] },
    [NATURAL_COMPONENT.HABITAT]: { radius: 4 },
    [NATURAL_COMPONENT.HUNGER]: { value: 8 },
  }),
  {
    op: 'spawn',
    id: 'deer_herd',
    kind: 'beast',
    tags: ['prey'],
    components: {
      position: { x: 252, y: 80, z: 0 },
      [NATURAL_COMPONENT.POPULATION]: { count: 6 },
      [NATURAL_COMPONENT.MASS]: { kg: 200 },
    },
  },
  body('villager_body', { x: 2, y: 2 }),
  person({ id: 'villager', bodies: ['villager_body'], senses: FULL_SENSES }),
];

// ---------------------------------------------------------------------------
// 장면 규칙 — 세계에서 무슨 일이 일어나는가
// ---------------------------------------------------------------------------

const verbIs = (verb: string): RuleSpec['when'] => ({
  op: 'eq',
  path: 'intent.intent_spec.verb',
  value: verb,
});

/**
 * 종이 울린다.
 *
 * ## 왜 종이 닳는가
 *
 * 효과 없이 흔적만 남기는 규칙을 쓰면 **아무에게도 닿지 않는다.** K3 은 상태 변화(델타)가 없는
 * 의도를 사건으로 남기지 않기 때문이다 — "아무 일도 없었던 것이므로 사건도 없다". 현상은 사건에
 * 얹혀 오므로, 세계를 한 칸도 바꾸지 않은 일은 지각될 수도 없다.
 *
 * 이것을 U1 쪽에서 우회하지 않는다. 오히려 옳은 규정이다. 종이 울리면 실제로 무엇인가가
 * 움직이고 닳는다. 그래서 종은 울릴 때마다 `wear.tolls` 가 하나 는다.
 *
 * ## 채널 이름
 *
 * 흔적의 채널을 일부러 S1 의 말씨(`sound` · `sight`)로 적었다. 원본 10장의 이름은
 * `audio` · `visual` 이며, 옮기는 일은 그 이름을 쓰는 쪽인 U1 이 한다(`CHANNEL_ALIASES`).
 * 이 장면이 그 표가 실제로 일한다는 증거다 — 표가 없으면 종소리는 아무에게도 닿지 않는다.
 */
export const BELL_RINGS: RuleSpec = {
  id: 'l4_the_bell_is_rung',
  title: '종이 울린다',
  scope: 'L4',
  priority: 10,
  when: verbIs('toll'),
  costs: [],
  effects: [{ op: 'add', path: 'actor.wear.tolls', value: 1 }],
  emits: [{ id: 'bell_toll', channels: ['sound', 'sight'] }],
  tags: ['scene'],
};

/** 폭발이 난다. 이쪽은 원본 10장의 이름을 그대로 쓴다 — 두 말씨가 함께 굴러간다. */
export const POWDER_BLAST: RuleSpec = {
  id: 'l4_the_powder_goes_off',
  title: '화약이 터진다',
  scope: 'L4',
  priority: 10,
  when: verbIs('detonate'),
  costs: [],
  // 터진 화약통은 남지 않는다. 이 변화가 있어야 폭발이 사건이 되고, 사건이 되어야 들린다.
  effects: [{ op: 'multiply', path: 'actor.mass.kg', value: 0 }],
  emits: [{ id: 'blast', channels: ['audio', 'visual', 'touch'] }],
  tags: ['scene'],
};

/** 아무 흔적도 남기지 않는 일 — 세계에는 그런 일도 있다. */
export const SILENT_SETTLING: RuleSpec = {
  id: 'l4_the_dust_settles',
  title: '먼지가 조용히 가라앉는다',
  scope: 'L4',
  priority: 10,
  when: verbIs('settle_dust'),
  costs: [],
  effects: [{ op: 'add', path: 'actor.mass.kg', value: 0.1 }],
  emits: [],
  tags: ['scene'],
};

export const SCENE_RULES: RuleSpec[] = [BELL_RINGS, POWDER_BLAST, SILENT_SETTLING];
