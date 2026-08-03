// R2-b 단위 테스트 — 사건 하나가 남기는 흔적: 무엇이 새고, 얼마나 세고, 얼마나 남는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { assembleWorld, slotStateId, type StateDomain, type WorldState } from '../../src/o2/index.ts';
import type { ActionProposal } from '../../src/p0/index.ts';
import { mintEvent, type EventValue, type WorldEvent } from '../../src/r1/index.ts';
import {
  LEAK_CHANNELS,
  TRACE_LIFESPAN,
  ambiguityOf,
  emitPhenomena,
  emitVerdict,
  leakingEffects,
  movementOf,
  phenomenonIdOf,
  placeOf,
} from '../../src/r2/index.ts';

const hunterId = deterministicId('subject', 'person', '몰이꾼 04');
const rivalId = deterministicId('subject', 'person', '상단 11');
const meatId = deterministicId('entity', 'resource', '말린 고기');
const canyonId = deterministicId('entity', 'place', '협곡');
const villageId = deterministicId('entity', 'place', '마을');
const toxinClaimId = deterministicId('claim', 'lore', '마비독');

const slot = (domain: StateDomain, ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

/** 협곡의 04 와 마을의 11 — 자리가 다른 둘이 있어야 "흔적은 지닌 자가 선 곳에서 난다" 가 보인다. */
const worldStates: readonly State[] = [
  slot('biological', hunterId, 'hunger', 0.6),
  slot('biological', hunterId, 'vitality', 0.8),
  slot('biological', rivalId, 'vitality', 0.9),
  slot('economic', hunterId, `stock.${meatId}`, 10),
  slot('informational', hunterId, `certainty.${toxinClaimId}`, 0.2),
  slot('physical', hunterId, 'region', canyonId),
  slot('physical', rivalId, 'region', villageId),
];

const world: WorldState = assembleWorld(worldStates).world;

const mint = (
  proposal: ActionProposal,
  values: readonly EventValue[],
  name: string,
  tick = 403,
): WorldEvent => mintEvent({ proposal, world, tick, name, values }).event as WorldEvent;

const seekEvent = mint(
  {
    atom: 'seek',
    actorId: hunterId,
    targetIds: [toxinClaimId],
    changes: [{ domain: 'informational', holderId: hunterId, path: `certainty.${toxinClaimId}` }],
    payments: [{ domain: 'biological', holderId: hunterId, path: 'vitality' }],
    observedIds: [toxinClaimId],
  },
  [
    { kind: 'change', domain: 'informational', holderId: hunterId, path: `certainty.${toxinClaimId}`, to: 0.9 },
    { kind: 'payment', domain: 'biological', holderId: hunterId, path: 'vitality', to: 0.75 },
  ],
  '마비독을 알아본다',
);

const destroyEvent = mint(
  {
    atom: 'destroy',
    actorId: hunterId,
    targetIds: [rivalId],
    changes: [{ domain: 'biological', holderId: rivalId, path: 'vitality' }],
    payments: [
      { domain: 'biological', holderId: hunterId, path: 'vitality' },
      { domain: 'economic', holderId: hunterId, path: `stock.${meatId}` },
    ],
    observedIds: [rivalId],
  },
  [
    { kind: 'change', domain: 'biological', holderId: rivalId, path: 'vitality', to: 0.3 },
    { kind: 'payment', domain: 'biological', holderId: hunterId, path: 'vitality', to: 0.7 },
    { kind: 'payment', domain: 'economic', holderId: hunterId, path: `stock.${meatId}`, to: 9 },
  ],
  '상단 11 을 친다',
  409,
);

describe('R2-b 앎은 새지 않는다', () => {
  const result = emitPhenomena(seekEvent, world);

  test('정보 자리는 흔적을 내지 않는다 — 새지 않는 자리로 남는다', () => {
    assert.deepEqual(result.violations, []);
    assert.equal(result.sealedSlots.length, 1);
    assert.match(result.sealedSlots[0] ?? '', /informational/);
    assert.ok(
      result.phenomena.every((phenomenon) => phenomenon.domain !== 'informational'),
      '앎이 샜다',
    );
  });

  test('새는 것은 그것을 얻느라 닳은 몸뿐이다 — 냄새와 흔적 둘', () => {
    assert.deepEqual(
      result.phenomena.map((phenomenon) => phenomenon.channel),
      ['smell', 'trace'],
    );
    assert.ok(result.phenomena.every((phenomenon) => phenomenon.path === 'vitality'));
    assert.ok(result.phenomena.every((phenomenon) => phenomenon.effectKind === 'payment'));
  });

  test('그 흔적은 거의 아무것도 말해 주지 않는다 — 애매함이 가장 큰 자리다', () => {
    // 체력을 움직일 수 있는 원자가 열둘 → (12-1)/15
    assert.equal(result.phenomena[0]?.ambiguity, ambiguityOf('biological', 'vitality'));
    assert.ok((result.phenomena[0]?.ambiguity ?? 0) > 0.7);
  });

  test('그래서 판정 한 줄이 "무엇을 알아냈는지" 를 말하지 않는다', () => {
    const verdict = emitVerdict(seekEvent, result);
    assert.match(verdict, /현상 2/);
    assert.match(verdict, /새지 않은 자리 1/);
    assert.doesNotMatch(verdict, /certainty/); // 무엇을 알아냈는지는 판정에도 남지 않는다
  });
});

describe('R2-b 어떤 흔적은 사라지지 않는다', () => {
  const result = emitPhenomena(destroyEvent, world);

  test('되돌릴 수 없는 원자가 바꾼 자리의 흔적은 수명이 없다', () => {
    const onRival = result.phenomena.filter((phenomenon) => phenomenon.holderId === rivalId);
    assert.equal(onRival.length, 2); // 냄새 · 흔적
    assert.ok(onRival.every((phenomenon) => phenomenon.decaysAtTick === null));
    assert.ok(onRival.every((phenomenon) => phenomenon.effectKind === 'change'));
  });

  test('그러나 대가로 깎인 제 몸의 자국은 삭는다 — 봉인되는 것은 그 원자가 한 일이다', () => {
    const onSelf = result.phenomena.filter(
      (phenomenon) => phenomenon.holderId === hunterId && phenomenon.path === 'vitality',
    );
    assert.equal(onSelf.length, 2);
    assert.ok(onSelf.every((phenomenon) => phenomenon.decaysAtTick !== null));
    // 세기 0.1 → 수명 2 틱 (0.1 × 20)
    assert.equal(onSelf[0]?.decaysAtTick, 409 + Math.round(0.1 * TRACE_LIFESPAN));
  });

  test('흔적은 지닌 자가 선 곳에서 난다 — 같은 사건이 두 곳에 남는다', () => {
    const places = [...new Set(result.phenomena.map((phenomenon) => phenomenon.placeId))];
    assert.deepEqual(places.sort(), [canyonId, villageId].sort());
    assert.equal(
      result.phenomena.find((phenomenon) => phenomenon.holderId === rivalId)?.placeId,
      villageId,
    );
  });

  test('자리 없는 자의 흔적은 일으킨 자가 선 곳으로 내려간다', () => {
    assert.equal(placeOf(world, rivalId, hunterId), villageId);
    assert.equal(placeOf(world, meatId, hunterId), canyonId); // 고기에는 선 곳이 없다
    assert.equal(placeOf(world, meatId, meatId), null);
  });

  test('모든 현상이 원인 사건을 가리킨다 — 원인 없는 현상은 없다', () => {
    assert.ok(result.phenomena.every((phenomenon) => phenomenon.causeEventId === destroyEvent.id));
    assert.equal(
      result.phenomena[0]?.id,
      phenomenonIdOf(
        destroyEvent.id,
        result.phenomena[0]?.channel as 'light',
        `${result.phenomena[0]?.domain}.${result.phenomena[0]?.holderId}.${result.phenomena[0]?.path}`,
      ),
    );
  });

  test('같은 사건은 언제나 같은 흔적을 낸다', () => {
    const again = emitPhenomena(destroyEvent, world);
    assert.deepEqual(again.phenomena, result.phenomena);
  });
});

describe('R2-b 세기 — 눈금이 어디서 오는가', () => {
  test('세계가 폭을 적어 둔 자리는 그 폭으로 잰다', () => {
    const measured = movementOf({
      kind: 'change',
      domain: 'biological',
      holderId: hunterId,
      path: 'vitality',
      from: 0.8,
      to: 0.3,
    });
    assert.equal(measured.measurable, true);
    assert.equal(Number(measured.intensity.toFixed(2)), 0.5);
  });

  test('상한이 열린 자리는 그 자리 자신이 눈금이 된다', () => {
    const shrunk = movementOf({
      kind: 'change',
      domain: 'economic',
      holderId: hunterId,
      path: `stock.${meatId}`,
      from: 10,
      to: 8,
    });
    assert.equal(shrunk.measurable, false);
    assert.equal(Number(shrunk.intensity.toFixed(2)), 0.2);
  });

  test('창고가 비는 것은 최대치다 — 없던 것이 서는 것도 마찬가지다', () => {
    const emptied = movementOf({
      kind: 'change',
      domain: 'economic',
      holderId: hunterId,
      path: `stock.${meatId}`,
      from: 10,
      to: 0,
    });
    const appeared = movementOf({
      kind: 'change',
      domain: 'economic',
      holderId: hunterId,
      path: `stock.${meatId}`,
      from: null,
      to: 4,
    });
    assert.equal(emptied.intensity, 1);
    assert.equal(appeared.intensity, 1);
  });

  test('참거짓·선택지에는 중간이 없다', () => {
    const flagged = movementOf({
      kind: 'change',
      domain: 'physical',
      holderId: meatId,
      path: 'broken',
      from: false,
      to: true,
    });
    assert.equal(flagged.intensity, 1);
  });

  test('움직이지 않은 자리는 0 이다 — 그리고 흔적을 내지 않는다', () => {
    const still = movementOf({
      kind: 'change',
      domain: 'biological',
      holderId: hunterId,
      path: 'vitality',
      from: 0.8,
      to: 0.8,
    });
    assert.equal(still.intensity, 0);
  });
});

describe('R2-b 애매함 — 같은 자국을 남길 수 있는 자가 몇인가', () => {
  test('부서진 것은 부순 자를 가리킨다', () => {
    assert.equal(ambiguityOf('physical', 'broken'), 0);
  });

  test('재고가 준 자국은 여섯 중 하나다 — 실제 경로로 물어도 같다', () => {
    assert.equal(ambiguityOf('economic', 'stock.{entity}'), (6 - 1) / 15);
    assert.equal(ambiguityOf('economic', `stock.${meatId}`), (6 - 1) / 15);
  });

  test('체력이 깎인 자국이 가장 애매하다', () => {
    assert.ok(ambiguityOf('biological', 'vitality') > ambiguityOf('economic', 'stock.{entity}'));
  });
});

describe('R2-b 흔적이 서지 못하는 자리', () => {
  test('일으킨 자 없는 사건의 흔적은 아직 세우지 않는다 — R1 이 유예한 그 자리다', () => {
    const natural: WorldEvent = { ...destroyEvent, actorId: null };
    const result = emitPhenomena(natural, world);
    assert.deepEqual(result.phenomena, []);
    assert.equal(result.violations[0]?.rule, 'causeless-phenomenon');
  });

  test('원인 사건 id 가 없으면 아무 흔적도 서지 못한다', () => {
    const anonymous: WorldEvent = { ...destroyEvent, id: '' };
    const result = emitPhenomena(anonymous, world);
    assert.deepEqual(result.phenomena, []);
    assert.equal(result.violations[0]?.rule, 'causeless-phenomenon');
  });

  test('표면에 구멍이 있으면 그 자리가 지목된다 — R2-a 표가 곧 이 검사다', () => {
    const holed = LEAK_CHANNELS.filter((entry) => entry.slot.path !== 'vitality');
    const result = emitPhenomena(seekEvent, world, { channels: holed });
    assert.equal(result.violations[0]?.rule, 'unchanneled-slot');
    assert.match(result.violations[0]?.message ?? '', /표면에 구멍이 있다/);
  });

  test('어디서 났는지 못 대면 흔적이 서지 못한다 — 감지될 수 없기 때문이다', () => {
    const placeless = assembleWorld(
      worldStates.filter((state) => state.path !== 'region'),
    ).world;
    const result = emitPhenomena(seekEvent, placeless);
    assert.deepEqual(result.phenomena, []);
    assert.equal(result.violations[0]?.rule, 'placeless-phenomenon');
  });

  test('새는 자리만 세는 목록은 봉인된 자리를 빼고 센다', () => {
    assert.equal(leakingEffects(seekEvent).length, 1); // 체력만
    assert.equal(leakingEffects(destroyEvent).length, 3);
  });
});
