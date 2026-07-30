import type { ComponentDefinition, StoreOperation } from '@hkt/k0-entity-state';
import type { RuleSpec } from '../src/types.js';

/**
 * 대표 장면의 무대와 규칙집.
 *
 * 원문 「9」 K2 의 대표 검증은 “에너지 부족 시 공격이 실패하며 피해·비용 모두 적용되지 않음” 이고,
 * 원문 「20」 VS0 의 장면은 “에너지 10 · 행동마다 3 소비 · 세 번 성공 · 네 번째 실패 · 결과 1” 이다.
 * 둘은 같은 이야기이므로 하나의 무대로 짠다.
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
    type: 'energy',
    // 하한이 여기 있다. "에너지가 모자라면 실패한다"를 K2 안에 따로 적지 않는 이유다.
    title: '생명 에너지 (하한 0)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['current'],
      properties: { current: { type: 'integer', minimum: 0 } },
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
    type: 'purse',
    title: '지갑 (하한 0)',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['coins'],
      properties: { coins: { type: 'integer', minimum: 0 } },
    },
  },
  {
    type: 'commitments',
    title: '약속',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['open', 'breached'],
      properties: {
        open: { type: 'array', items: { type: 'string' } },
        breached: { type: 'array', items: { type: 'string' } },
      },
    },
  },
];

export const CANYON: StoreOperation[] = [
  {
    op: 'spawn',
    id: 'hunter_a',
    kind: 'person',
    tags: ['human', 'hunter'],
    components: {
      health: { current: 100, max: 100 },
      energy: { current: 10 },
      position: { x: 0, y: 0, z: 0 },
      purse: { coins: 12 },
    },
  },
  {
    op: 'spawn',
    id: 'blessed_knight',
    kind: 'person',
    tags: ['human', 'blessed'],
    components: {
      health: { current: 80, max: 100 },
      energy: { current: 10 },
      position: { x: 0, y: 0, z: 0 },
      purse: { coins: 3 },
    },
  },
  {
    op: 'spawn',
    id: 'dead_knight',
    kind: 'person',
    tags: ['human', 'undead'],
    components: {
      health: { current: 0, max: 100 },
      energy: { current: 9 },
      position: { x: 0, y: 0, z: 0 },
    },
  },
  {
    op: 'spawn',
    id: 'beast_ka',
    kind: 'giant_beast',
    tags: ['beast'],
    components: {
      health: { current: 900, max: 900 },
      position: { x: 1, y: 0, z: 0 },
      purse: { coins: 0 },
    },
  },
  {
    op: 'spawn',
    id: 'far_beast',
    kind: 'giant_beast',
    tags: ['beast'],
    components: { health: { current: 500, max: 500 }, position: { x: 90, y: 0, z: 0 } },
  },
];

const isStrike = { op: 'eq' as const, path: 'intent.intent_spec.verb', value: 'strike' };
const withinReach = { op: 'within_distance' as const, a: 'actor', b: 'target', max: 2 };

/**
 * 규칙집 (원본 15.1 의 L0~L6).
 *
 * 국소적인 규칙(번호가 큰 것)이 예외를 만들 수 있지만, **권위가 높은 규칙이 그은 선 안에서만** 가능하다.
 */
export const RULES: RuleSpec[] = [
  {
    id: 'l1_living_only',
    title: '죽은 신체는 일반 행동을 수행할 수 없다 (원본 15.2 하드 규칙)',
    scope: 'L1',
    priority: 100,
    when: isStrike,
    requires: { op: 'gt', path: 'actor.health.current', value: 0 },
    costs: [],
    effects: [],
    emits: [],
    tags: ['hard', 'life'],
  },
  {
    id: 'l1_strike',
    title: '기본 타격 — 에너지 3 을 쓰고 체력 10 을 깎는다',
    scope: 'L1',
    priority: 10,
    when: isStrike,
    requires: withinReach,
    costs: [{ op: 'add', path: 'actor.energy.current', value: -3 }],
    effects: [{ op: 'add', path: 'target.health.current', value: -10 }],
    emits: [{ id: 'strike_sound', channels: ['audio'], tags: ['combat'] }],
    tags: ['physical'],
  },
  {
    id: 'l4_border_blessing',
    title: '국경 신의 축복을 받은 자는 타격 비용이 1 이다 (지역 특수 규칙)',
    scope: 'L4',
    priority: 10,
    when: { op: 'and', items: [isStrike, { op: 'has_tag', target: 'actor', tag: 'blessed' }] },
    requires: withinReach,
    costs: [{ op: 'add', path: 'actor.energy.current', value: -1 }],
    effects: [{ op: 'add', path: 'target.health.current', value: -10 }],
    emits: [{ id: 'blessed_strike_glow', channels: ['visual', 'aura'], tags: ['divine'] }],
    tags: ['region', 'blessing'],
  },
  {
    id: 'l4_undead_rite',
    title: '언데드 의식은 죽은 자에게도 타격을 허용하려 한다 — 그러나 L1 을 넘을 수는 없다',
    scope: 'L4',
    priority: 10,
    when: { op: 'and', items: [isStrike, { op: 'has_tag', target: 'actor', tag: 'undead' }] },
    requires: withinReach,
    costs: [{ op: 'add', path: 'actor.energy.current', value: -1 }],
    effects: [{ op: 'add', path: 'target.health.current', value: -5 }],
    emits: [],
    tags: ['region', 'forbidden'],
  },
  {
    id: 'l5_pay',
    title: '지불 — 동전을 옮긴다. 총량은 늘지도 줄지도 않는다',
    scope: 'L5',
    priority: 10,
    when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'pay' },
    costs: [],
    effects: [{ op: 'transfer', from: 'actor.purse.coins', to: 'target.purse.coins', amount: 5 }],
    emits: [{ id: 'coin_clink', channels: ['audio'] }],
    tags: ['economy'],
  },
  {
    id: 'l6_swear',
    title: '맹세 — 약속을 만들고 흔적을 예약한다',
    scope: 'L6',
    priority: 10,
    when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'swear' },
    costs: [{ op: 'add', path: 'actor.energy.current', value: -1 }],
    effects: [
      { op: 'create_commitment', templateId: 'oath_of_protection' },
      { op: 'attach_tag', target: 'actor', tag: 'sworn' },
      { op: 'schedule_event', eventTemplateId: 'oath_reminder', delayTicks: 5 },
    ],
    emits: [{ id: 'oath_echo', channels: ['aura'] }],
    tags: ['commitment'],
  },
  {
    id: 'l6_reckless_charge',
    title: '무모한 돌진 — 실패해도 흔적이 남는다 (실패 효과를 선언한 유일한 규칙)',
    scope: 'L6',
    priority: 10,
    when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'charge' },
    requires: withinReach,
    costs: [{ op: 'add', path: 'actor.energy.current', value: -2 }],
    effects: [{ op: 'add', path: 'target.health.current', value: -20 }],
    failureEffects: [{ op: 'attach_tag', target: 'actor', tag: 'stumbled' }],
    emits: [],
    tags: ['physical', 'risky'],
  },
];
