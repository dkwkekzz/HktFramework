// R1-a 단위 테스트 — 요청 하나가 사건이 되는가, 그리고 무엇이 사건이 되지 못하는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { assembleWorld, slotStateId, type StateDomain, type WorldState } from '../../src/o2/index.ts';
import type { ActionProposal } from '../../src/p0/index.ts';
import {
  effectLine,
  effectText,
  eventHash,
  eventIdOf,
  eventLine,
  mintEvent,
  movedEffects,
  type EventValue,
  type WorldEvent,
} from '../../src/r1/index.ts';

const hunterId = deterministicId('subject', 'person', '몰이꾼 04');
const meatId = deterministicId('entity', 'resource', '말린 고기');
const canyonId = deterministicId('entity', 'place', '협곡');

const slot = (domain: StateDomain, ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

/** 창고에 고기가 stock 인 세계 — 몰이꾼 하나가 서 있다. */
const worldWith = (stock: number): WorldState =>
  assembleWorld([
    slot('biological', hunterId, 'hunger', 0.6),
    slot('biological', hunterId, 'vitality', 0.8),
    slot('economic', hunterId, `stock.${meatId}`, stock),
    slot('physical', hunterId, 'region', canyonId),
  ]).world;

/** 협곡에서 고기를 가져오는 요청 — P0-b 가 acquire 에 열어 둔 자리만 적는다. */
const acquireProposal: ActionProposal = {
  atom: 'acquire',
  actorId: hunterId,
  targetIds: [meatId],
  changes: [
    { domain: 'economic', holderId: hunterId, path: `stock.${meatId}` },
    { domain: 'biological', holderId: hunterId, path: 'hunger' },
  ],
  payments: [{ domain: 'biological', holderId: hunterId, path: 'vitality' }],
  observedIds: [meatId],
};

const values = (stock: number, hunger: number, vitality: number): readonly EventValue[] => [
  { kind: 'change', domain: 'economic', holderId: hunterId, path: `stock.${meatId}`, to: stock },
  { kind: 'change', domain: 'biological', holderId: hunterId, path: 'hunger', to: hunger },
  { kind: 'payment', domain: 'biological', holderId: hunterId, path: 'vitality', to: vitality },
];

const mint = (
  overrides: Partial<Parameters<typeof mintEvent>[0]> = {},
): ReturnType<typeof mintEvent> =>
  mintEvent({
    proposal: acquireProposal,
    world: worldWith(2),
    tick: 400,
    name: '협곡에서 고기를 가져온다',
    values: values(4, 0.3, 0.7),
    ...overrides,
  });

const rulesOf = (result: ReturnType<typeof mintEvent>): readonly string[] => [
  ...new Set(result.violations.map((violation) => violation.rule)),
];

describe('R1-a 요청이 사건이 된다', () => {
  test('요청서의 자리가 그대로 효과가 된다', () => {
    const result = mint();
    assert.deepEqual(result.violations, []);
    const event = result.event as WorldEvent;
    assert.equal(event.kind, 'Event');
    assert.equal(event.atom, 'acquire');
    assert.equal(event.actorId, hunterId);
    assert.equal(event.tick, 400);
    assert.equal(event.effects.length, 3);
    assert.deepEqual(
      event.effects.map((effect) => [effect.kind, effect.from, effect.to]),
      [
        ['change', 0.6, 0.3],
        ['payment', 0.8, 0.7],
        ['change', 2, 4],
      ],
    );
  });

  test('사건은 자기가 선 세계를 기억한다 — from 은 손으로 적지 않는다', () => {
    const stocked = mint({ world: worldWith(9) }).event as WorldEvent;
    const stockEffect = stocked.effects.find((effect) => effect.path.startsWith('stock.'));
    assert.equal(stockEffect?.from, 9);
    assert.equal(stockEffect?.to, 4);
  });

  test('바뀐 상태의 id 는 유래에서 나온다 — 손으로 적지 않는다 (O2)', () => {
    const event = mint().event as WorldEvent;
    assert.deepEqual(event.changedStateIds, [
      slotStateId('biological', hunterId, 'hunger'),
      slotStateId('biological', hunterId, 'vitality'),
      slotStateId('economic', hunterId, `stock.${meatId}`),
    ]);
  });

  test('사건도 다른 원소처럼 O1 관문을 지난다', () => {
    const event = mint().event as WorldEvent;
    assert.equal(classify(event).kind, 'Event');
  });

  test('사건의 id 와 지문은 유래에서 결정된다', () => {
    const event = mint().event as WorldEvent;
    assert.equal(event.id, eventIdOf(hunterId, 'acquire', 400, '협곡에서 고기를 가져온다'));
    assert.equal(eventHash(event), eventHash(mint().event as WorldEvent));
    assert.notEqual(eventHash(event), eventHash(mint({ tick: 401 }).event as WorldEvent));
  });

  test('까닭은 앞선 사건을 가리킨다 — 최초 사건이면 비어 있다', () => {
    assert.deepEqual((mint().event as WorldEvent).causeIds, []);
    const chained = mint({ causeIds: ['event:abcd'] }).event as WorldEvent;
    assert.deepEqual(chained.causeIds, ['event:abcd']);
  });

  test('한 줄 문장이 사람에게 읽힌다', () => {
    const event = mint().event as WorldEvent;
    assert.equal(eventLine(event), '틱 400 · 획득 · 협곡에서 고기를 가져온다 (자리 3)');
    assert.equal(
      effectLine(event.effects[0] as (typeof event.effects)[number]),
      `biological.${hunterId}.hunger 0.6 → 0.3`,
    );
    assert.equal(effectText(event.effects[0] as (typeof event.effects)[number]), `biological.${hunterId}.hunger`);
    assert.equal(movedEffects(event).length, 3);
  });
});

describe('R1-a 사건이 되지 못하는 것', () => {
  test('P0-c 가 막는 요청은 여기서도 막힌다 — 사유를 옮겨 적는다', () => {
    const offAtom = mint({
      proposal: {
        ...acquireProposal,
        // 획득은 남의 신뢰를 바꾸지 않는다 (P0-b writes 밖)
        changes: [{ domain: 'relational', holderId: hunterId, path: `trust.${hunterId}` }],
      },
      values: [
        {
          kind: 'change',
          domain: 'relational',
          holderId: hunterId,
          path: `trust.${hunterId}`,
          to: 0.9,
        },
      ],
    });
    assert.deepEqual(rulesOf(offAtom), ['unfit-proposal']);
    assert.match(offAtom.violations[0]?.message ?? '', /off-atom-change/);
    assert.equal(offAtom.event, null);
  });

  test('공짜 사건은 서지 않는다 — 대가는 P0-b 가 정한 자리다', () => {
    const free = mint({
      proposal: { ...acquireProposal, payments: [] },
      values: values(4, 0.3, 0.7).slice(0, 2),
    });
    assert.deepEqual(rulesOf(free), ['unfit-proposal']);
    assert.match(free.violations[0]?.message ?? '', /unpaid-action/);
  });

  test('요청서에 없는 자리를 슬쩍 바꾸지 못한다', () => {
    const sneaky = mint({
      values: [
        ...values(4, 0.3, 0.7),
        { kind: 'change', domain: 'physical', holderId: hunterId, path: 'region', to: canyonId },
      ],
    });
    assert.deepEqual(rulesOf(sneaky), ['unrequested-effect']);
    assert.equal(sneaky.event, null);
  });

  test('바꾸는 자리와 치르는 자리를 바꿔 적을 수 없다', () => {
    const swapped = mint({
      values: [
        { kind: 'payment', domain: 'economic', holderId: hunterId, path: `stock.${meatId}`, to: 4 },
      ],
    });
    assert.deepEqual(rulesOf(swapped), ['unrequested-effect']);
  });

  test('세계에 없는 자리는 효과가 되지 못한다', () => {
    const phantom = mint({
      proposal: {
        ...acquireProposal,
        changes: [
          ...acquireProposal.changes,
          { domain: 'biological', holderId: hunterId, path: 'despair' },
        ],
      },
      values: [
        ...values(4, 0.3, 0.7),
        { kind: 'change', domain: 'biological', holderId: hunterId, path: 'despair', to: 0.9 },
      ],
    });
    // 요청서 쪽은 P0-c 가, 효과 쪽은 R1 이 잡는다 — 둘 다 세계에 없는 자리를 가리킨다
    assert.equal(rulesOf(phantom).includes('unfit-proposal'), true);
    assert.equal(phantom.event, null);
  });

  test('세계가 그대로면 사건이 아니다', () => {
    const still = mint({ world: worldWith(4), values: values(4, 0.6, 0.8) });
    assert.deepEqual(rulesOf(still), ['changeless-event']);
    const empty = mint({ values: [] });
    assert.deepEqual(rulesOf(empty), ['changeless-event']);
  });

  test('일으킨 자 없는 사건은 아직 낼 수 없다 — 자연 발생은 W2 로 유예했다', () => {
    const natural = mint({ proposal: { ...acquireProposal, actorId: '' } });
    assert.equal(rulesOf(natural).includes('actorless-event'), true);
    assert.equal(natural.event, null);
  });

  test('거부는 사유와 함께 남는다 — 던지지 않는다', () => {
    const broken = mint({ values: [] });
    assert.equal(broken.violations.every((violation) => violation.message.length > 0), true);
    assert.equal(broken.violations[0]?.event, '협곡에서 고기를 가져온다');
  });
});
