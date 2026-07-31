import type { ComponentDefinition, StoreOperation } from '@hkt/k0-entity-state';
import type { RuleSpec } from '@hkt/k2-rule-transaction';
import type { Affordance, SpatialLayout } from '../src/types.js';

/**
 * 대표 장면의 무대 — **문 하나로 갈린 두 방**.
 *
 * 원문 「10」 S0 의 대표 검증은 "벽 너머 물체를 직접 획득할 수 없고 문을 열면 접근 가능"이다.
 * 그 한 줄을 그대로 보이려면 세 가지가 동시에 필요하다.
 *
 * ```text
 * 벽      길을 끊는다            — 문이 닫혀 있는 동안 유물은 닿을 수 없다
 * 문      벽이면서 상태가 바뀐다  — 열면 같은 세계에서 길이 생긴다
 * 유물    벽 바로 너머에 있다     — "멀어서 못 간다"가 아니라 "막혀서 못 간다"
 * ```
 *
 * ```text
 *  y
 *  4  ·  ·  ·  ·  ▓  ·  ·  ·  ·        ▓ stone_wall_north   (x=4, y 2.5…4.5)
 *  3  ·  ·  ·  ·  ▓  ·  ·  ·  ·        ▒ oak_door           (x=4, y 1.5…2.5)
 *  2  ·  @  ·  ·  ▒  ·  ★  ·  ·        @ hunter   (1,2)     ★ sealed_relic (6,2)
 *  1  ·  ·  ·  ·  ▓  ·  ·  ·  ·        ▓ stone_wall_south   (x=4, y -0.5…1.5)
 *  0  ·  ·  ·  ·  ▓  ·  ·  ·  ·
 *     0  1  2  3  4  5  6  7  8   x
 * ```
 *
 * 문을 열기 전 `hunter` 는 유물에서 5m 떨어져 있고 **길이 없다**. 문을 열면 같은 세계에서 길이
 * 생기고, 그때 비로소 `take` 가 제시된다. 세계를 바꾸는 것은 S0 이 아니라 K2 의 규칙이다(GI-01).
 */

export const LAYOUT: SpatialLayout = {
  cellSize: 1,
  origin: { x: 0, y: 0, z: 0 },
  size: { x: 9, y: 5, z: 1 },
};

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
    type: 'extent',
    title: '반-크기 (m)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'z'],
      properties: {
        x: { type: 'number', minimum: 0 },
        y: { type: 'number', minimum: 0 },
        z: { type: 'number', minimum: 0 },
      },
    },
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
    type: 'capability',
    title: '가진 능력',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['names'],
      properties: { names: { type: 'array', items: { type: 'string' } } },
    },
  },
  {
    type: 'reach',
    title: '손이 닿는 거리 (m)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['max'],
      properties: { max: { type: 'number', minimum: 0 } },
    },
  },
  {
    type: 'stamina',
    title: '체력',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['current'],
      properties: { current: { type: 'number', minimum: 0 } },
    },
  },
];

const half = (x: number, y: number, z = 0.5): { x: number; y: number; z: number } => ({ x, y, z });

/** 두 방과 그 사이의 문. `hunter` 는 서쪽 방에, `sealed_relic` 은 동쪽 방에 있다. */
export const TWO_ROOMS: StoreOperation[] = [
  {
    op: 'spawn',
    id: 'hunter',
    kind: 'person',
    tags: ['human'],
    components: {
      position: { x: 1, y: 2, z: 0 },
      capability: { names: ['grasp', 'walk'] },
      reach: { max: 1 },
      stamina: { current: 10 },
    },
  },
  {
    op: 'spawn',
    id: 'sealed_relic',
    kind: 'artifact',
    tags: ['portable', 'relic'],
    components: { position: { x: 6, y: 2, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'oak_door',
    kind: 'door',
    tags: ['wooden'],
    components: {
      position: { x: 4, y: 2, z: 0 },
      extent: half(0.5, 0.5),
      barrier: { solid: true, opaque: true },
    },
  },
  {
    op: 'spawn',
    id: 'stone_wall_south',
    kind: 'structure',
    tags: ['stone'],
    components: {
      position: { x: 4, y: 0.5, z: 0 },
      extent: half(0.5, 1),
      barrier: { solid: true, opaque: true },
    },
  },
  {
    op: 'spawn',
    id: 'stone_wall_north',
    kind: 'structure',
    tags: ['stone'],
    components: {
      position: { x: 4, y: 3.5, z: 0 },
      extent: half(0.5, 1),
      barrier: { solid: true, opaque: true },
    },
  },
  {
    // 크기도 장애물성도 없는 것 — 격자와 반경 질의가 이런 것을 잊지 않는지 본다.
    op: 'spawn',
    id: 'dropped_coin',
    kind: 'item',
    tags: ['portable'],
    components: { position: { x: 2, y: 3, z: 0 } },
  },
  {
    // 격자(x 0…8) 밖에 있는 것. 색인이 좁힐 때 빠뜨리기 쉬운 자리다.
    op: 'spawn',
    id: 'far_watchtower',
    kind: 'structure',
    tags: ['stone'],
    components: { position: { x: 30, y: 2, z: 0 } },
  },
];

/** 손이 없는 주체 — 능력 거절과 조건 거절이 서로 다른 이유임을 보이는 데 쓴다. */
export const ARMLESS_GHOST: StoreOperation[] = [
  {
    op: 'spawn',
    id: 'armless_ghost',
    kind: 'person',
    tags: ['human', 'ghost'],
    components: {
      position: { x: 5, y: 2, z: 0 },
      capability: { names: ['walk'] },
      reach: { max: 1 },
      stamina: { current: 10 },
    },
  },
];

/** 문 앞에 이미 서 있는 두 번째 주체 — 같은 행동의 비용이 **어디에서 묻느냐**로 달라짐을 보인다. */
export const PATIENT_SCOUT: StoreOperation[] = [
  {
    op: 'spawn',
    id: 'patient_scout',
    kind: 'person',
    tags: ['human'],
    components: {
      position: { x: 3, y: 2, z: 0 },
      capability: { names: ['grasp', 'walk'] },
      reach: { max: 1 },
      stamina: { current: 10 },
    },
  },
];

/**
 * 끝이 트인 벽 — "벽이 있으면 우회한다"(VS1 완료 조건)를 보이는 무대.
 *
 * 벽이 `y = 0…3` 만 막고 `y = 4` 는 트여 있다. 직선으로는 5걸음이면 될 길이 **8걸음**이 된다.
 */
export const DETOUR_ROOM: StoreOperation[] = [
  {
    op: 'spawn',
    id: 'hunter',
    kind: 'person',
    tags: ['human'],
    components: {
      position: { x: 1, y: 2, z: 0 },
      capability: { names: ['grasp', 'walk'] },
      reach: { max: 1 },
      stamina: { current: 10 },
    },
  },
  {
    op: 'spawn',
    id: 'sealed_relic',
    kind: 'artifact',
    tags: ['portable', 'relic'],
    components: { position: { x: 6, y: 2, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'long_wall',
    kind: 'structure',
    tags: ['stone'],
    components: {
      position: { x: 4, y: 1.5, z: 0 },
      extent: half(0.5, 2),
      barrier: { solid: true, opaque: true },
    },
  },
];

/**
 * 손은 닿는 거리인데 사이에 문이 있는 무대.
 *
 * `hunter` 를 문 바로 앞(3,2)으로 옮기고 닿는 거리를 2.5m 로 늘렸다. 열쇠는 2m 앞(5,2)에 있으니
 * **거리로만 보면 닿는다.** 그러나 문이 사이에 있다 — 거리와 접근 가능성은 다른 것이다.
 */
export const REACH_TEST: StoreOperation[] = [
  ...TWO_ROOMS,
  { op: 'set_component', id: 'hunter', type: 'position', data: { x: 3, y: 2, z: 0 } },
  { op: 'set_component', id: 'hunter', type: 'reach', data: { max: 2.5 } },
  {
    op: 'spawn',
    id: 'iron_key',
    kind: 'item',
    tags: ['portable'],
    components: { position: { x: 5, y: 2, z: 0 } },
  },
];

/** 유물을 집는다 — 문이 닫혀 있으면 길이 없다. */
export const TAKE_RELIC: Affordance = {
  id: 'take_relic',
  verb: 'take',
  targetEntityId: 'sealed_relic',
  condition: { op: 'has_tag', target: 'target', tag: 'portable' },
  requiredCapabilities: ['grasp'],
  estimatedCost: { stamina: 1 },
};

/** 문을 연다 — **닫혀 있을 때만** 열 수 있다. 조건이 상태를 읽는다는 사실이 여기서 드러난다. */
export const OPEN_DOOR: Affordance = {
  id: 'open_the_door',
  verb: 'open',
  targetEntityId: 'oak_door',
  condition: { op: 'eq', path: 'target.barrier.solid', value: true },
  requiredCapabilities: ['grasp'],
  estimatedCost: { stamina: 2 },
};

/** 동전을 줍는다 — 같은 방 안이라 언제나 닿는다. 비교 기준선이다. */
export const TAKE_COIN: Affordance = {
  id: 'take_coin',
  verb: 'take',
  targetEntityId: 'dropped_coin',
  condition: { op: 'has_tag', target: 'target', tag: 'portable' },
  requiredCapabilities: ['grasp'],
  estimatedCost: { stamina: 1 },
};

/** 열쇠를 집는다 — 거리와 접근 가능성을 가르는 장면에서 쓴다. */
export const TAKE_KEY: Affordance = {
  id: 'take_key',
  verb: 'take',
  targetEntityId: 'iron_key',
  condition: { op: 'has_tag', target: 'target', tag: 'portable' },
  requiredCapabilities: ['grasp'],
  estimatedCost: { stamina: 1 },
};

/** 벽을 집는다 — 조건이 어긋나는 행동. 능력은 있는데 대상이 그 행동을 허용하지 않는다. */
export const TAKE_WALL: Affordance = {
  id: 'take_wall',
  verb: 'take',
  targetEntityId: 'stone_wall_south',
  condition: { op: 'has_tag', target: 'target', tag: 'portable' },
  requiredCapabilities: ['grasp'],
  estimatedCost: { stamina: 5 },
};

/** 세계에 없는 것을 가리키는 행동 — 사라진 대상과 막힌 대상을 구분한다. */
export const TAKE_LOST_LANTERN: Affordance = {
  id: 'take_lost_lantern',
  verb: 'take',
  targetEntityId: 'lost_lantern',
  condition: { op: 'has_tag', target: 'target', tag: 'portable' },
  requiredCapabilities: ['grasp'],
  estimatedCost: { stamina: 1 },
};

/** 이미 이동 비용을 선언해 둔 행동 — S0 이 계산한 이동 비용은 **덮어쓰지 않고 더해진다.** */
export const SHOVE_DOOR: Affordance = {
  id: 'shove_the_door',
  verb: 'shove',
  targetEntityId: 'oak_door',
  condition: { op: 'eq', path: 'target.barrier.solid', value: true },
  requiredCapabilities: ['grasp'],
  estimatedCost: { stamina: 4, movement: 1 },
};

export const AFFORDANCES: Affordance[] = [TAKE_RELIC, OPEN_DOOR, TAKE_COIN];

/**
 * 문을 여는 규칙 (K2).
 *
 * S0 은 세계를 고치지 않는다. 문이 열리는 것은 규칙이 비용을 받고 효과를 적용한 결과이며,
 * 그 변화는 `StateDelta` 에 남는다 — 그래야 K3 이 사건으로 기록할 수 있다(GI-01).
 */
export const OPEN_DOOR_RULE: RuleSpec = {
  id: 'l1_open_a_door',
  title: '문은 손으로 열 수 있다',
  scope: 'L1',
  priority: 10,
  when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'open' },
  requires: { op: 'eq', path: 'target.barrier.solid', value: true },
  costs: [{ op: 'add', path: 'actor.stamina.current', value: -2 }],
  effects: [
    { op: 'set', path: 'target.barrier.solid', value: false },
    { op: 'set', path: 'target.barrier.opaque', value: false },
  ],
  emits: [{ id: 'door_creaks', channels: ['sound'] }],
  tags: ['physical'],
};

export const RULES: RuleSpec[] = [OPEN_DOOR_RULE];
