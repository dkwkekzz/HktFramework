// R2-c 단위 테스트 — 흔적이 쌓이고 삭는 자리, 그리고 사건과 흔적을 맞대는 감사.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { assembleWorld, slotStateId, type StateDomain, type WorldState } from '../../src/o2/index.ts';
import type { ActionProposal } from '../../src/p0/index.ts';
import {
  appendLog,
  mintEvent,
  openLog,
  type EventLog,
  type EventValue,
  type WorldEvent,
} from '../../src/r1/index.ts';
import {
  LEAK_CHANNELS,
  SEALED_SLOTS,
  auditField,
  emitPhenomena,
  fieldVerdict,
  openField,
  permanentPhenomena,
  recordPhenomena,
  remembersSlot,
  silentEvents,
  standingAt,
  standingIn,
  witnessEvent,
  type PhenomenonField,
  type WorldPhenomenon,
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

const world: WorldState = assembleWorld([
  slot('biological', hunterId, 'hunger', 0.6),
  slot('biological', hunterId, 'vitality', 0.8),
  slot('biological', rivalId, 'vitality', 0.9),
  slot('economic', hunterId, `stock.${meatId}`, 10),
  slot('informational', hunterId, `certainty.${toxinClaimId}`, 0.2),
  slot('physical', hunterId, 'region', canyonId),
  slot('physical', rivalId, 'region', villageId),
]).world;

const mint = (
  proposal: ActionProposal,
  values: readonly EventValue[],
  name: string,
  tick: number,
): WorldEvent => mintEvent({ proposal, world, tick, name, values }).event as WorldEvent;

/** 앎만 움직이는 사건 — 몸도 닳지 않게 대가를 0.8 그대로 둔다. 세계는 바뀌는데 아무것도 안 남는다. */
const quietSeek = mint(
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
    { kind: 'payment', domain: 'biological', holderId: hunterId, path: 'vitality', to: 0.8 },
  ],
  '아무도 모르게 알아본다',
  402,
);

/** 상단 11 을 치는 사건 — 되돌릴 수 없는 원자다. */
const strike = mint(
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
  405,
);

const log: EventLog = appendLog(appendLog(openLog(), quietSeek), strike);

const filled: PhenomenonField = [quietSeek, strike].reduce(
  (field, event) => witnessEvent(field, event, world).field,
  openField(),
);

describe('R2-c 현상장 — 담기고 삭는다', () => {
  test('사건마다 난 흔적이 원인 사건으로 색인된다', () => {
    assert.equal(filled.byEvent.get(quietSeek.id), undefined); // 아무것도 나지 않았다
    assert.equal((filled.byEvent.get(strike.id) ?? []).length, 5);
  });

  test('같은 사건을 두 번 담아도 흔적은 늘지 않는다 — id 는 유래에서 나온다', () => {
    const again = witnessEvent(filled, strike, world).field;
    assert.equal(again.phenomena.length, filled.phenomena.length);
    assert.equal(again, filled); // 더할 것이 없으면 그대로 돌려준다
  });

  test('아직 나지 않은 흔적은 서 있지 않다', () => {
    assert.deepEqual(standingAt(filled, 404), []);
    assert.equal(standingAt(filled, 405).length, 5);
  });

  test('삭는 흔적은 시간이 지나면 사라지고, 사라지지 않는 흔적은 남는다', () => {
    // 04 의 몸(0.8 → 0.7)은 세기 0.1 → 수명 2 틱, 재고(10 → 9)는 세기 0.1 → 2 틱
    assert.equal(standingAt(filled, 407).length, 5);
    assert.equal(standingAt(filled, 408).length, 2); // 상단 11 의 몸에 난 둘만 남는다
    assert.equal(standingAt(filled, 100000).length, 2);
    assert.deepEqual(permanentPhenomena(filled).map((entry) => entry.holderId), [rivalId, rivalId]);
  });

  test('흔적은 자리를 갖는다 — 협곡의 흔적과 마을의 흔적이 갈린다', () => {
    assert.equal(standingIn(filled, 405, canyonId).length, 3);
    assert.equal(standingIn(filled, 405, villageId).length, 2);
    assert.equal(standingIn(filled, 408, canyonId).length, 0);
    assert.equal(standingIn(filled, 408, villageId).length, 2);
  });

  test('그 자리를 세계가 아직 기억하는가', () => {
    assert.equal(remembersSlot(filled, 405, 'economic', hunterId, `stock.${meatId}`), true);
    assert.equal(remembersSlot(filled, 408, 'economic', hunterId, `stock.${meatId}`), false);
    assert.equal(remembersSlot(filled, 99999, 'biological', rivalId, 'vitality'), true);
  });
});

describe('R2-c 흔적 없이 지나간 사건 — 위반이 아니라 사실이다', () => {
  test('앎만 움직인 사건은 세계를 바꾸고도 아무것도 남기지 않는다', () => {
    const silent = silentEvents(log);
    assert.deepEqual(silent.map((event) => event.name), ['아무도 모르게 알아본다']);
  });

  test('감사는 그것을 위반이 아니라 값으로 센다', () => {
    const audit = auditField(filled, log);
    assert.equal(audit.complete, true, fieldVerdict(audit));
    assert.deepEqual(audit.violations, []);
    assert.equal(audit.witnessed, 1);
    assert.deepEqual(audit.silent, ['찾다 — 아무도 모르게 알아본다']);
    assert.equal(audit.permanent, 2);
  });

  test('판정 한 줄이 흔적·사건·침묵을 함께 센다', () => {
    const verdict = fieldVerdict(auditField(filled, log));
    assert.match(verdict, /흔적 5/);
    assert.match(verdict, /흔적 없이 지나간 사건 1/);
    assert.match(verdict, /사라지지 않는 흔적 2/);
  });

  test('앎이 새게 만들면 그 침묵이 사라진다 — 봉인이 무엇을 지키는지 보이는 자리', () => {
    const unsealed = SEALED_SLOTS.filter((entry) => entry.slot.domain !== 'informational');

    // ① 봉인만 걷으면 통로가 없어 표면에 구멍이 뚫린 것으로 걸린다 — 조용한 것은 그대로다.
    const holed = emitPhenomena(quietSeek, world, { sealed: unsealed });
    assert.equal(holed.violations[0]?.rule, 'unchanneled-slot');
    assert.equal(silentEvents(log, { sealed: unsealed }).length, 1);

    // ② 통로까지 내주면 **남의 확신이 그대로 읽힌다** — 이것이 막아야 하는 세계다.
    const opened = emitPhenomena(quietSeek, world, {
      sealed: unsealed,
      channels: [
        ...LEAK_CHANNELS,
        {
          slot: { domain: 'informational', path: 'certainty.{claim}' },
          channels: ['light'],
          note: '검사용 — 이렇게 적으면 앎이 새는 세계가 된다',
        },
      ],
    });
    assert.deepEqual(opened.violations, []);
    assert.equal(opened.phenomena.length, 1);
    assert.equal(opened.phenomena[0]?.domain, 'informational');
    assert.equal(
      silentEvents(log, {
        sealed: unsealed,
        channels: [
          ...LEAK_CHANNELS,
          {
            slot: { domain: 'informational', path: 'certainty.{claim}' },
            channels: ['light'],
            note: '검사용',
          },
        ],
      }).length,
      0,
    );
  });
});

describe('R2-c 감사가 잡는 것', () => {
  const first = (field: PhenomenonField): WorldPhenomenon =>
    field.phenomena[0] as WorldPhenomenon;

  const withOne = (phenomenon: WorldPhenomenon): PhenomenonField =>
    recordPhenomena(openField(), [phenomenon]);

  test('원인을 가리키지 않는 흔적', () => {
    const audit = auditField(withOne({ ...first(filled), causeEventId: '' }), log);
    assert.equal(audit.violations[0]?.rule, 'causeless-phenomenon');
  });

  test('로그에 없는 사건을 가리키는 흔적 — 없던 일이 흔적을 남길 수는 없다', () => {
    const audit = auditField(
      withOne({ ...first(filled), causeEventId: deterministicId('event', '없던 일') }),
      log,
    );
    assert.equal(audit.violations[0]?.rule, 'unlogged-cause');
    assert.match(audit.violations[0]?.message ?? '', /없던 일이 흔적을 남길 수는 없다/);
  });

  test('새지 않는 자리에서 났다는 흔적 — 봉인된 자리가 새면 아무것도 숨길 수 없다', () => {
    const audit = auditField(
      withOne({
        ...first(filled),
        causeEventId: quietSeek.id,
        domain: 'informational',
        holderId: hunterId,
        path: `certainty.${toxinClaimId}`,
      }),
      log,
    );
    assert.equal(audit.violations[0]?.rule, 'sealed-leak');
  });

  test('움직이지 않은 자리에서 났다는 흔적 — 04 는 그 사건에서 자리를 옮기지 않았다', () => {
    const audit = auditField(
      withOne({
        ...first(filled),
        causeEventId: strike.id,
        domain: 'physical',
        holderId: hunterId,
        path: 'region',
      }),
      log,
    );
    assert.equal(audit.violations[0]?.rule, 'still-phenomenon');
    assert.match(audit.violations[0]?.message ?? '', /세계가 그대로면 흔적도 없다/);
  });

  test('새는 자리를 움직였는데 흔적이 하나도 없는 사건 — 세계가 소리 없이 바뀌었다', () => {
    const empty = auditField(openField(), log);
    assert.deepEqual(
      [...new Set(empty.violations.map((violation) => violation.rule))],
      ['missing-trace'],
    );
    assert.match(empty.violations[0]?.message ?? '', /세계가 소리 없이 바뀌었다/);
    // 조용한 사건은 그때도 위반이 아니다.
    assert.deepEqual(empty.silent, ['찾다 — 아무도 모르게 알아본다']);
  });

  test('빈 현상장과 빈 로그는 감사를 지난다 — 아무 일도 없었으면 어긋날 것도 없다', () => {
    const audit = auditField(openField(), openLog());
    assert.equal(audit.complete, true);
    assert.equal(audit.recorded, 0);
    assert.equal(audit.witnessed, 0);
  });
});
