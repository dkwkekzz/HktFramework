import type { ComponentDefinition, StoreOperation } from '@hkt/k0-entity-state';
import type { RuleSpec } from '@hkt/k2-rule-transaction';
import type { ScheduledEventTemplate } from '../src/types.js';

/**
 * 대표 장면의 무대.
 *
 * 원문 「9」 K3 의 대표 검증은 “1,000틱 실행 후 재생한 최종 상태와 사건 해시가 완전히 동일”이다.
 * 1,000틱 동안 **여러 갈래의 일**이 벌어져야 재생이 진짜로 확인된다 — 성공·거부·자원 고갈·예약된
 * 사건이 뒤섞이도록 무대를 짠다.
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
    type: 'marks',
    title: '기도 흔적',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['count'],
      properties: { count: { type: 'integer', minimum: 0 } },
    },
  },
];

export const SHRINE_CANYON: StoreOperation[] = [
  {
    op: 'spawn',
    id: 'hunter_a',
    kind: 'person',
    tags: ['human', 'hunter'],
    components: {
      health: { current: 100, max: 100 },
      energy: { current: 10 },
      position: { x: 0, y: 0, z: 0 },
    },
  },
  {
    op: 'spawn',
    id: 'beast_ka',
    kind: 'giant_beast',
    tags: ['beast'],
    components: { health: { current: 900, max: 900 }, position: { x: 1, y: 0, z: 0 } },
  },
  {
    op: 'spawn',
    id: 'border_shrine',
    kind: 'structure',
    tags: ['divine'],
    components: { position: { x: 0, y: 0, z: 0 }, marks: { count: 0 } },
  },
];

const verbIs = (verb: string) => ({ op: 'eq' as const, path: 'intent.intent_spec.verb', value: verb });
const withinReach = { op: 'within_distance' as const, a: 'actor', b: 'target', max: 2 };

export const RULES: RuleSpec[] = [
  {
    id: 'l1_living_only',
    title: '죽은 신체는 타격할 수 없다 (제약 규칙)',
    scope: 'L1',
    priority: 100,
    when: verbIs('strike'),
    requires: { op: 'gt', path: 'actor.health.current', value: 0 },
    costs: [],
    effects: [],
    emits: [],
    tags: ['hard'],
  },
  {
    id: 'l1_strike',
    title: '타격 — 에너지 3 을 쓰고 체력 10 을 깎는다',
    scope: 'L1',
    priority: 10,
    when: verbIs('strike'),
    requires: withinReach,
    costs: [{ op: 'add', path: 'actor.energy.current', value: -3 }],
    effects: [{ op: 'add', path: 'target.health.current', value: -10 }],
    emits: [{ id: 'strike_sound', channels: ['audio'], tags: ['combat'] }],
    tags: ['physical'],
  },
  {
    id: 'l2_rest',
    title: '휴식 — 에너지 2 를 되찾는다',
    scope: 'L2',
    priority: 10,
    when: verbIs('rest'),
    costs: [],
    effects: [{ op: 'add', path: 'actor.energy.current', value: 2 }],
    emits: [{ id: 'rest_sigh', channels: ['audio'] }],
    tags: ['body'],
  },
  {
    id: 'l6_pray',
    title: '기도 — 흔적을 하나 남기고 사흘 뒤 축복을 예약한다',
    scope: 'L6',
    priority: 10,
    when: verbIs('pray'),
    requires: withinReach,
    costs: [{ op: 'add', path: 'actor.energy.current', value: -1 }],
    effects: [
      { op: 'add', path: 'target.marks.count', value: 1 },
      { op: 'schedule_event', eventTemplateId: 'blessing', delayTicks: 3 },
    ],
    emits: [{ id: 'prayer_whisper', channels: ['aura'] }],
    tags: ['divine'],
  },
  {
    id: 'l4_blessing',
    title: '축복 — 예약된 사건이 스스로 일어나 흔적을 더 남긴다',
    scope: 'L4',
    priority: 10,
    when: verbIs('blessing_falls'),
    costs: [],
    effects: [{ op: 'add', path: 'target.marks.count', value: 5 }],
    emits: [{ id: 'blessing_light', channels: ['visual', 'aura'] }],
    tags: ['divine'],
  },
];

/** 예약 사건의 본체 — 무엇을 하는지도 데이터로 적는다. */
export const TEMPLATES: ScheduledEventTemplate[] = [
  { id: 'blessing', verb: 'blessing_falls', title: '기도한 자리에 축복이 내린다' },
];

/**
 * 1,000틱을 굴릴 후보.
 *
 * `sing` 은 어떤 규칙도 다루지 않는다 — 거부가 섞여야 “거부는 사건을 남기지 않는다”가 확인된다.
 * `strike_far` 는 사거리 밖이라 조건에서 걸린다.
 */
export const DRIVER_CANDIDATES = [
  { actor: 'hunter_a', verb: 'strike', targets: ['beast_ka'] },
  { actor: 'hunter_a', verb: 'rest', targets: [] },
  { actor: 'hunter_a', verb: 'pray', targets: ['border_shrine'] },
  { actor: 'hunter_a', verb: 'sing', targets: [] },
];
